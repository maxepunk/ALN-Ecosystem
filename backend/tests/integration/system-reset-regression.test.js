/**
 * System Reset Regression Tests
 *
 * Verifies that multiple system:reset calls don't cause listener accumulation.
 * This is a regression test for the listener leak bug discovered during
 * integration test suite analysis.
 *
 * Bug History:
 * - sessionService.reset() did NOT call removeAllListeners()
 * - system:reset admin command did NOT cleanup infrastructure listeners
 * - Each reset accumulated more listeners on sessionService
 * - Under load, this caused duplicate broadcasts and WebSocket errors
 *
 * Expected Behavior:
 * - Multiple system:reset calls should be idempotent
 * - Listener counts should remain stable across resets
 * - No duplicate broadcasts should occur
 */

const { connectAndIdentify, waitForEvent, disconnectAndWait } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { logTestFileEntry, logTestFileExit, getServiceListenerCounts } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const stateService = require('../../src/services/stateService');

describe('System Reset Regression Tests', () => {
  let testContext;
  let gmSocket;

  beforeAll(async () => {
    logTestFileEntry('system-reset-regression.test.js');
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
    logTestFileExit('system-reset-regression.test.js');
  });

  beforeEach(async () => {
    // Connect GM scanner with admin privileges
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_RESET_TEST');

    // Create initial session
    await sessionService.createSession({
      name: 'Reset Test Session',
      teams: ['001']
    });
  });

  afterEach(async () => {
    // Use condition-based waiting to ensure socket fully disconnects
    // Critical after rapid resets which can leave connections in transitional states
    await disconnectAndWait(gmSocket);
  });

  describe('Multiple system:reset Calls', () => {
    it('should not accumulate listeners across multiple resets', async () => {
      // Track listener counts across all resets
      const listenerHistory = [];

      // Perform 3 consecutive system resets
      for (let i = 1; i <= 3; i++) {
        // Capture counts BEFORE reset
        const beforeReset = {
          session: sessionService.listenerCount('session:created') +
                   sessionService.listenerCount('session:updated'),
          transaction: transactionService.listenerCount('score:updated'),
          state: stateService.listenerCount('state:updated')
        };

        // Send system:reset command
        const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');
        gmSocket.emit('gm:command', {
          event: 'gm:command',
          data: {
            action: 'system:reset',
            payload: {}
          },
          timestamp: new Date().toISOString()
        });

        // Wait for acknowledgment
        const ack = await ackPromise;
        expect(ack.data.success).toBe(true);

        // Wait for reset to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Capture counts AFTER reset
        const afterReset = {
          session: sessionService.listenerCount('session:created') +
                   sessionService.listenerCount('session:updated'),
          transaction: transactionService.listenerCount('score:updated'),
          state: stateService.listenerCount('state:updated')
        };

        listenerHistory.push({ reset: i, beforeReset, afterReset });

        // Create new session for next iteration
        await sessionService.createSession({
          name: `Reset Test Session ${i + 1}`,
          teams: ['001']
        });
      }

      // CRITICAL: Listener counts should remain stable across resets
      // Each reset should produce identical before/after counts
      expect(listenerHistory[0].afterReset).toEqual(listenerHistory[1].afterReset);
      expect(listenerHistory[1].afterReset).toEqual(listenerHistory[2].afterReset);

      // After reset, listeners should be re-registered (not zero, not accumulated)
      // This verifies infrastructure is properly re-initialized
      expect(listenerHistory[2].afterReset.session).toBeGreaterThan(0);
      expect(listenerHistory[2].afterReset.transaction).toBeGreaterThan(0);
      expect(listenerHistory[2].afterReset.state).toBeGreaterThan(0);
    });

    it('should not cause duplicate broadcasts after multiple resets', async () => {
      // Perform 2 system resets
      for (let i = 0; i < 2; i++) {
        const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');
        gmSocket.emit('gm:command', {
          event: 'gm:command',
          data: { action: 'system:reset', payload: {} },
          timestamp: new Date().toISOString()
        });
        await ackPromise;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create new session and track broadcasts
      const sessionUpdates = [];
      gmSocket.on('session:update', (event) => {
        sessionUpdates.push(event);
      });

      await sessionService.createSession({
        name: 'Duplicate Broadcast Test',
        teams: ['001']
      });

      // Wait for broadcasts to arrive
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should receive exactly 1 session:update broadcast
      // (not 2 or 3 due to accumulated listeners)
      expect(sessionUpdates.length).toBe(1);
      expect(sessionUpdates[0].data.name).toBe('Duplicate Broadcast Test');
    });

    it('should handle rapid consecutive resets without errors', async () => {
      // Fire 5 system:reset commands rapidly (no waiting)
      const ackPromises = [];
      for (let i = 0; i < 5; i++) {
        const ackPromise = waitForEvent(gmSocket, 'gm:command:ack', 10000);
        gmSocket.emit('gm:command', {
          event: 'gm:command',
          data: { action: 'system:reset', payload: {} },
          timestamp: new Date().toISOString()
        });
        ackPromises.push(ackPromise);
      }

      // All should succeed
      const acks = await Promise.all(ackPromises);
      acks.forEach(ack => {
        expect(ack.data.success).toBe(true);
      });

      // System should still be functional - session creation is the real condition
      // If the system isn't ready, this will fail (no arbitrary timeout needed)
      await sessionService.createSession({
        name: 'Post-Rapid-Reset Session',
        teams: ['001']
      });

      const session = sessionService.getCurrentSession();
      expect(session).not.toBeNull();
      expect(session.name).toBe('Post-Rapid-Reset Session');
    });
  });

  describe('Reset State Verification', () => {
    it('should fully reset all service state', async () => {
      // Add some transactions
      const TestTokens = require('../fixtures/test-tokens');
      await transactionService.init(TestTokens.getAllAsArray());

      const session = sessionService.getCurrentSession();
      await transactionService.processScan({
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_RESET_TEST',
          deviceType: 'gm',  // Required by Phase 3 P0.1
        mode: 'blackmarket'
      }, session);

      // Verify transaction exists
      expect(session.transactions.length).toBe(1);
      expect(transactionService.teamScores.size).toBe(1);

      // Perform system reset
      const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');
      gmSocket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'system:reset', payload: {} },
        timestamp: new Date().toISOString()
      });
      await ackPromise;
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all state cleared
      expect(sessionService.getCurrentSession()).toBeNull();
      expect(transactionService.teamScores.size).toBe(0);

      // Create new session - should start fresh
      await sessionService.createSession({
        name: 'Fresh Session',
        teams: ['002']
      });

      const newSession = sessionService.getCurrentSession();
      expect(newSession.transactions.length).toBe(0);
      expect(newSession.scores.length).toBe(1);
      expect(newSession.scores[0].teamId).toBe('002');
    });
  });
});
