/**
 * Room-Based Broadcast Integration Tests (Phase 2.2 P1.2)
 * Tests that broadcasts are delivered to correct rooms
 */

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const videoQueueService = require('../../src/services/videoQueueService');
const offlineQueueService = require('../../src/services/offlineQueueService');

describe('Room-Based Broadcasts (Phase 2.2 P1.2)', () => {
  let testContext;
  let gm1, gm2, gm3;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // CRITICAL: Use resetAllServicesForTesting to properly cleanup and re-register broadcast listeners
    // Room broadcast tests depend on session:update events which are emitted by broadcast listeners
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      videoQueueService,
      offlineQueueService
    });
  });

  afterEach(async () => {
    if (gm1 && gm1.connected) gm1.disconnect();
    if (gm2 && gm2.connected) gm2.disconnect();
    if (gm3 && gm3.connected) gm3.disconnect();
  });

  describe('GM Room Broadcasts', () => {
    it('should broadcast to all GMs via gm room', async () => {
      // PHASE 2.2 P1.2: All GMs should receive broadcasts sent to 'gm' room

      // Connect 3 GMs
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_002');
      gm3 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_003');

      // Listen for session updates on all GMs (broadcast globally via emitWrapped)
      const sessionPromise1 = waitForEvent(gm1, 'session:update');
      const sessionPromise2 = waitForEvent(gm2, 'session:update');
      const sessionPromise3 = waitForEvent(gm3, 'session:update');

      // Trigger session update (should broadcast to all connected clients)
      await sessionService.createSession({
        name: 'Broadcast Test',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

      // All GMs should receive the event
      const [session1, session2, session3] = await Promise.all([
        sessionPromise1,
        sessionPromise2,
        sessionPromise3
      ]);

      expect(session1).toBeDefined();
      expect(session2).toBeDefined();
      expect(session3).toBeDefined();
    });

    it('should NOT broadcast to player scanners in gm room', async () => {
      // PHASE 2.2 P1.2: Player scanners are not in 'gm' room

      // Connect 1 GM and 1 player
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      const player = await connectAndIdentify(testContext.socketUrl, 'player', 'PLAYER_001');

      // Directly emit to gm room to test room isolation
      const { emitToRoom } = require('../../src/websocket/eventWrapper');

      // Listen for GM-room-only event
      const gmEventPromise = waitForEvent(gm1, 'test:gm-only', 2000);

      let playerReceivedEvent = false;
      player.on('test:gm-only', () => {
        playerReceivedEvent = true;
      });

      // Emit directly to gm room
      emitToRoom(testContext.io, 'gm', 'test:gm-only', { test: true });

      // GM should receive
      await gmEventPromise;

      // Player should NOT receive (wait a bit to be sure)
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(playerReceivedEvent).toBe(false);

      player.disconnect();
    });
  });

  describe('Device-Specific Broadcasts', () => {
    it('should send batch:ack to specific device room only', async () => {
      // PHASE 2.2 P1.2: batch:ack uses device-specific room

      // Connect 2 GMs
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_002');

      // Create session
      await sessionService.createSession({
        name: 'Batch ACK Test',
        teams: ['Team Alpha']
      });
    await sessionService.startGame();

      // Listen for batch:ack on both GMs
      let gm1ReceivedAck = false;
      let gm2ReceivedAck = false;

      gm1.on('batch:ack', () => {
        gm1ReceivedAck = true;
      });

      gm2.on('batch:ack', () => {
        gm2ReceivedAck = true;
      });

      // Send batch from GM_001 (ACK should go to device:GM_001 only)
      const response = await fetch(`${testContext.url}/api/scan/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: `test-${Date.now()}`,
          transactions: [{
            tokenId: 'jaw001',
            deviceId: 'GM_001',
          deviceType: 'gm',  // Required by Phase 3 P0.1
            teamId: 'Team Alpha',
            mode: 'networked'
          }]
        })
      });

      expect(response.ok).toBe(true);

      // Wait for ACK
      await new Promise(resolve => setTimeout(resolve, 500));

      // Only GM_001 should receive ACK
      expect(gm1ReceivedAck).toBe(true);
      expect(gm2ReceivedAck).toBe(false);
    });
  });

  describe('Team Room Broadcasts (Future)', () => {
    it('should join team rooms for all teams in session', async () => {
      // PHASE 2.2 P1.2: GMs join team rooms (for future team-specific broadcasts)

      // Create session with teams
      await sessionService.createSession({
        name: 'Team Test',
        teams: ['Team Alpha', 'Detectives', 'Blue Squad']
      });
    await sessionService.startGame();

      // Connect GM
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      // Wait for connection to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get socket from server side
      const serverSockets = await testContext.io.fetchSockets();
      const gmSocket = serverSockets.find(s => s.deviceId === 'GM_001');

      expect(gmSocket).toBeDefined();

      // Verify rooms (socket.rooms is a Set)
      const rooms = Array.from(gmSocket.rooms);

      expect(rooms).toContain('team:Team Alpha');
      expect(rooms).toContain('team:Detectives');
      expect(rooms).toContain('team:Blue Squad');
    });

    it('should allow team-specific broadcasts in the future', async () => {
      // PHASE 2.2 P1.2: Prepare for team-specific broadcasts
      // (Not implemented yet, but rooms are ready)

      await sessionService.createSession({
        name: 'Future Team Broadcast',
        teams: ['Team Alpha', 'Detectives']
      });
    await sessionService.startGame();

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      // Test that we CAN emit to team room (infrastructure ready)
      let receivedTeamMessage = false;
      gm1.on('team:message', (data) => {
        receivedTeamMessage = true;
      });

      // Emit to team:Team Alpha room
      const { emitWrapped } = require('../../src/websocket/eventWrapper');
      emitWrapped(testContext.io.to('team:Team Alpha'), 'team:message', {
        message: 'Team Alpha only'
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // GM should receive (it's in team:Team Alpha)
      expect(receivedTeamMessage).toBe(true);
    });
  });

  describe('Session Room (Legacy)', () => {
    it('should still join session room for backward compatibility', async () => {
      // PHASE 2.2 P1.2: Session room maintained for existing broadcasts

      const session = await sessionService.createSession({
        name: 'Session Room Test',
        teams: ['Team Alpha']
      });
    await sessionService.startGame();

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get socket from server
      const serverSockets = await testContext.io.fetchSockets();
      const gmSocket = serverSockets.find(s => s.deviceId === 'GM_001');

      // Verify session room
      const rooms = Array.from(gmSocket.rooms);
      expect(rooms).toContain(`session:${session.id}`);
    });
  });
});
