/**
 * Room-Based Broadcast Integration Tests (Phase 2.2 P1.2)
 * Tests that broadcasts are delivered to correct rooms
 */

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { resetAllServices } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const stateService = require('../../src/services/stateService');

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
    await resetAllServices();
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

      // Listen for state updates on all GMs
      const statePromise1 = waitForEvent(gm1, 'state:update');
      const statePromise2 = waitForEvent(gm2, 'state:update');
      const statePromise3 = waitForEvent(gm3, 'state:update');

      // Trigger state update (should broadcast to 'gm' room)
      await sessionService.createSession({
        name: 'Broadcast Test',
        teams: ['001']
      });

      // All GMs should receive the event
      const [state1, state2, state3] = await Promise.all([
        statePromise1,
        statePromise2,
        statePromise3
      ]);

      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state3).toBeDefined();
    });

    it('should NOT broadcast to player scanners in gm room', async () => {
      // PHASE 2.2 P1.2: Player scanners are not in 'gm' room

      // Connect 1 GM and 1 player
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      const player = await connectAndIdentify(testContext.socketUrl, 'player', 'PLAYER_001');

      // Listen for events
      const gmEventPromise = waitForEvent(gm1, 'state:update', 2000);

      let playerReceivedEvent = false;
      player.on('state:update', () => {
        playerReceivedEvent = true;
      });

      // Trigger GM-only broadcast
      await sessionService.createSession({
        name: 'GM Only Test',
        teams: ['001']
      });

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
        teams: ['001']
      });

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
            tokenId: 'jaw011',
            deviceId: 'GM_001',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        deviceType: 'gm',  // Required by Phase 3 P0.1
            teamId: '001',
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
        teams: ['001', '002', '003']
      });

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

      expect(rooms).toContain('team:001');
      expect(rooms).toContain('team:002');
      expect(rooms).toContain('team:003');
    });

    it('should allow team-specific broadcasts in the future', async () => {
      // PHASE 2.2 P1.2: Prepare for team-specific broadcasts
      // (Not implemented yet, but rooms are ready)

      await sessionService.createSession({
        name: 'Future Team Broadcast',
        teams: ['001', '002']
      });

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      // Test that we CAN emit to team room (infrastructure ready)
      let receivedTeamMessage = false;
      gm1.on('team:message', (data) => {
        receivedTeamMessage = true;
      });

      // Emit to team:001 room
      const { emitWrapped } = require('../../src/websocket/eventWrapper');
      emitWrapped(testContext.io.to('team:001'), 'team:message', {
        message: 'Team 001 only'
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // GM should receive (it's in team:001)
      expect(receivedTeamMessage).toBe(true);
    });
  });

  describe('Session Room (Legacy)', () => {
    it('should still join session room for backward compatibility', async () => {
      // PHASE 2.2 P1.2: Session room maintained for existing broadcasts

      const session = await sessionService.createSession({
        name: 'Session Room Test',
        teams: ['001']
      });

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
