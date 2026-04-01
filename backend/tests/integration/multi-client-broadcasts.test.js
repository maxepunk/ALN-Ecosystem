/**
 * Multi-Client Broadcast Validation Tests
 *
 * Tests that broadcasts reach ALL connected clients consistently:
 * - Identical data across all clients
 * - Timing consistency (<100ms variance)
 * - No event loss under concurrent load
 * - Device connection notifications
 *
 * IMPORTANT: These tests validate multi-client broadcasting behavior.
 * All GMs should receive identical events in a timely manner.
 *
 * Contract: backend/contracts/asyncapi.yaml
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { validateWebSocketEvent } = require('../helpers/contract-validator');
const { resetAllServices, resetAllServicesForTesting, logTestFileEntry, logTestFileExit } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const TestTokens = require('../fixtures/test-tokens');

describe('Multi-Client Broadcast Validation', () => {
  let testContext;
  let gm1, gm2, gm3;

  beforeAll(async () => {
    logTestFileEntry('multi-client-broadcasts.test.js');
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
    logTestFileExit('multi-client-broadcasts.test.js');
  });

  beforeEach(async () => {
    // Remove socket-specific listeners from previous tests
    [gm1, gm2, gm3].forEach(socket => {
      if (socket) {
        socket.removeAllListeners();
      }
    });

    // Complete reset cycle: cleanup → reset → setup
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      videoQueueService: require('../../src/services/videoQueueService'),
      offlineQueueService: require('../../src/services/offlineQueueService')
    });

    // Re-initialize tokens after reset
    const testTokens = TestTokens.getAllAsArray();
    await transactionService.init(testTokens);

    // Create test session
    await sessionService.createSession({
      name: 'Multi-Client Test',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();

    // Connect 3 GM scanners
    gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_MULTI_1');
    gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_MULTI_2');
    gm3 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_MULTI_3');
  });

  afterEach(async () => {
    // Disconnect all clients
    [gm1, gm2, gm3].forEach(socket => {
      if (socket?.connected) socket.disconnect();
    });
  });

  describe('Transaction Broadcasts', () => {
    it('should broadcast transaction:new to all 3 GMs identically', async () => {
      // Listen on all 3 clients
      const promises = [
        waitForEvent(gm1, 'transaction:new'),
        waitForEvent(gm2, 'transaction:new'),
        waitForEvent(gm3, 'transaction:new')
      ];

      // Trigger transaction from gm1
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Technical rating 3 = 30 points (value field in test fixtures)
          teamId: 'Team Alpha',
          deviceId: 'GM_MULTI_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const [event1, event2, event3] = await Promise.all(promises);

      // Validate: All 3 received identical transaction data
      expect(event1.data.transaction).toEqual(event2.data.transaction);
      expect(event2.data.transaction).toEqual(event3.data.transaction);

      // Validate: Contract compliance
      validateWebSocketEvent(event1, 'transaction:new');
      validateWebSocketEvent(event2, 'transaction:new');
      validateWebSocketEvent(event3, 'transaction:new');

      // Validate: Timestamps should be very close (within 100ms)
      const time1 = new Date(event1.timestamp).getTime();
      const time2 = new Date(event2.timestamp).getTime();
      const time3 = new Date(event3.timestamp).getTime();
      expect(Math.abs(time1 - time2)).toBeLessThan(100);
      expect(Math.abs(time2 - time3)).toBeLessThan(100);

      // Validate: Transaction content
      expect(event1.data.transaction.tokenId).toBe('534e2b03');
      expect(event1.data.transaction.teamId).toBe('Team Alpha');
    });

    it('should include teamScore in transaction:new broadcast to all clients', async () => {
      // Listen on all 3 clients for transaction:new (which now carries teamScore)
      const promises = [
        waitForEvent(gm1, 'transaction:new'),
        waitForEvent(gm2, 'transaction:new'),
        waitForEvent(gm3, 'transaction:new')
      ];

      // Trigger transaction
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Technical rating 3
          teamId: 'Team Alpha',
          deviceId: 'GM_MULTI_1',
          deviceType: 'gm',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const [tx1, tx2, tx3] = await Promise.all(promises);

      // Validate: All receive identical teamScore in transaction:new
      expect(tx1.data.teamScore).toEqual(tx2.data.teamScore);
      expect(tx2.data.teamScore).toEqual(tx3.data.teamScore);

      // Validate: teamScore data is correct
      expect(tx1.data.teamScore.teamId).toBe('Team Alpha');
      expect(tx1.data.teamScore.currentScore).toBe(TestTokens.getExpectedPoints('534e2b03'));

      // Validate: Contract compliance
      validateWebSocketEvent(tx1, 'transaction:new');
      validateWebSocketEvent(tx2, 'transaction:new');
      validateWebSocketEvent(tx3, 'transaction:new');
    });
  });

  describe('Device Connection Broadcasts', () => {
    it('should broadcast device:connected when new GM joins', async () => {
      // Wait a bit for any pending events from beforeEach to clear
      await new Promise(resolve => setTimeout(resolve, 50));

      // Set up listeners BEFORE connecting 4th GM
      const promises = [
        waitForEvent(gm1, 'device:connected'),
        waitForEvent(gm2, 'device:connected'),
        waitForEvent(gm3, 'device:connected')
      ];

      // Connect 4th GM (should trigger broadcasts to existing 3)
      const gm4 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_MULTI_4');

      const [conn1, conn2, conn3] = await Promise.all(promises);

      // Validate: All 3 existing GMs were notified of GM_MULTI_4
      expect(conn1.data.deviceId).toBe('GM_MULTI_4');
      expect(conn2.data.deviceId).toBe('GM_MULTI_4');
      expect(conn3.data.deviceId).toBe('GM_MULTI_4');

      // Validate: Contract compliance
      validateWebSocketEvent(conn1, 'device:connected');

      // Cleanup
      gm4.disconnect();
    });
  });

  describe('Concurrent Load Handling', () => {
    it('should maintain broadcast integrity under rapid session updates', async () => {
      // Listen for session:update on all 3 GMs
      const gm1Updates = [];
      const gm2Updates = [];
      const gm3Updates = [];

      gm1.on('session:update', e => gm1Updates.push(e));
      gm2.on('session:update', e => gm2Updates.push(e));
      gm3.on('session:update', e => gm3Updates.push(e));

      // Trigger rapid session state changes
      await sessionService.updateSession({ status: 'paused' });
      await new Promise(resolve => setTimeout(resolve, 50));
      await sessionService.updateSession({ status: 'active' });
      await new Promise(resolve => setTimeout(resolve, 50));
      await sessionService.updateSession({ name: 'Updated Session Name' });

      // Wait for all events to propagate
      await new Promise(resolve => setTimeout(resolve, 200));

      // Validate: All GMs received all session updates
      expect(gm1Updates.length).toBeGreaterThanOrEqual(3);
      expect(gm2Updates.length).toBeGreaterThanOrEqual(3);
      expect(gm3Updates.length).toBeGreaterThanOrEqual(3);

      // Validate: All GMs have identical event count
      expect(gm1Updates.length).toBe(gm2Updates.length);
      expect(gm2Updates.length).toBe(gm3Updates.length);

      // Validate: Final state matches across all clients
      const finalGm1 = gm1Updates[gm1Updates.length - 1];
      const finalGm2 = gm2Updates[gm2Updates.length - 1];
      const finalGm3 = gm3Updates[gm3Updates.length - 1];

      expect(finalGm1.data).toEqual(finalGm2.data);
      expect(finalGm2.data).toEqual(finalGm3.data);
    });
  });

  describe('Broadcast Timing Consistency', () => {
    it('should deliver broadcasts within acceptable time window', async () => {
      // Record exact receive times for each client
      const receiveTimes = {
        gm1: null,
        gm2: null,
        gm3: null
      };

      const promises = [
        waitForEvent(gm1, 'transaction:new').then(e => {
          receiveTimes.gm1 = Date.now();
          return e;
        }),
        waitForEvent(gm2, 'transaction:new').then(e => {
          receiveTimes.gm2 = Date.now();
          return e;
        }),
        waitForEvent(gm3, 'transaction:new').then(e => {
          receiveTimes.gm3 = Date.now();
          return e;
        })
      ];

      // Trigger transaction
      const sendTime = Date.now();
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: 'Team Alpha',
          deviceId: 'GM_MULTI_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      await Promise.all(promises);

      // Validate: All clients received within 100ms of each other
      const times = [receiveTimes.gm1, receiveTimes.gm2, receiveTimes.gm3];
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const variance = maxTime - minTime;

      expect(variance).toBeLessThan(100);

      // Validate: Total delivery time reasonable (<500ms from send)
      const maxDeliveryTime = maxTime - sendTime;
      expect(maxDeliveryTime).toBeLessThan(500);
    });
  });
});
