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
const { clearEventCache } = require('../helpers/websocket-core');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { logTestFileEntry, logTestFileExit, getServiceListenerCounts } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

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
      teams: ['Team Alpha']
    });
    await sessionService.startGame();
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
        // NOTE (Slice 6): score:updated replaced by transaction:accepted in new event architecture
        const beforeReset = {
          session: sessionService.listenerCount('session:created') +
                   sessionService.listenerCount('session:updated'),
          transaction: transactionService.listenerCount('transaction:accepted')
        };

        // Clear cached ack from previous iteration so waitForEvent waits for
        // the REAL ack from THIS reset. Without this, the cached ack resolves
        // immediately, gm:command fires but the test proceeds before
        // performSystemReset() completes — leaving async resets in flight
        // that race with subsequent iterations and contaminate later tests.
        clearEventCache(gmSocket);

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
        // NOTE (Slice 6): score:updated replaced by transaction:accepted in new event architecture
        const afterReset = {
          session: sessionService.listenerCount('session:created') +
                   sessionService.listenerCount('session:updated'),
          transaction: transactionService.listenerCount('transaction:accepted')
        };

        listenerHistory.push({ reset: i, beforeReset, afterReset });

        // Create new session for next iteration
        await sessionService.createSession({
          name: `Reset Test Session ${i + 1}`,
          teams: ['Team Alpha']
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
    });

    it('should not cause duplicate broadcasts after multiple resets', async () => {
      // Perform 2 system resets
      for (let i = 0; i < 2; i++) {
        // waitForEvent resolves from cache if lastGmCommandAck is set from a
        // previous iteration. Clear it so we wait for the REAL ack from THIS
        // reset — otherwise the command is emitted but the test proceeds before
        // performSystemReset() completes, leaving stale session state.
        clearEventCache(gmSocket);
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
        teams: ['Team Alpha']
      });
    await sessionService.startGame();

      // Wait for broadcasts to arrive
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should receive exactly 2 session:update broadcasts:
      // 1. createSession (status='setup')
      // 2. startGame (status='active')
      // (not 3 or 4 due to accumulated listeners)
      expect(sessionUpdates.length).toBe(2);
      expect(sessionUpdates[0].data.name).toBe('Duplicate Broadcast Test');
      expect(sessionUpdates[0].data.status).toBe('setup');
      expect(sessionUpdates[1].data.status).toBe('active');
    });

    it('should handle rapid consecutive resets without crashing', async () => {
      // Fire 5 system:reset commands rapidly (no waiting)
      // Due to mutex protection in adminEvents.js, only the first should succeed
      // while others get "System reset already in progress" rejection
      clearEventCache(gmSocket);
      // Wait for the SUCCESS ack — the one from the reset that actually ran.
      // The 4 mutex-rejected commands ack {success: false} almost immediately;
      // the predicate keeps listening past those. This replaces the old fixed
      // 500ms sleep, which was shorter than a real reset on toolless
      // environments (~1.2s: Chromium respawn timeout) and left the reset
      // IN FLIGHT past the end of this test — the mutex then rejected the
      // NEXT test's reset, which is what the quarantined failure really was.
      const successAckPromise = waitForEvent(
        gmSocket,
        'gm:command:ack',
        (ack) => ack.data?.action === 'system:reset' && ack.data?.success === true,
        15000
      );
      for (let i = 0; i < 5; i++) {
        gmSocket.emit('gm:command', {
          event: 'gm:command',
          data: { action: 'system:reset', payload: {} },
          timestamp: new Date().toISOString()
        });
      }

      // The ack is sent only after performSystemReset() resolves — when this
      // returns, no reset is in flight and the mutex is released
      await successAckPromise;

      // The real test: System should still be functional after rapid resets
      // If the system crashed or is in a bad state, this will fail
      await sessionService.createSession({
        name: 'Post-Rapid-Reset Session',
        teams: ['Team Alpha']
      });
    await sessionService.startGame();

      const session = sessionService.getCurrentSession();
      expect(session).not.toBeNull();
      expect(session.name).toBe('Post-Rapid-Reset Session');
    });
  });

  describe('Reset State Verification', () => {
    // UN-QUARANTINED (2026-06-11). Root cause found and fixed: the 'rapid
    // consecutive resets' test above used a fixed 500ms sleep, shorter than
    // a real reset on toolless environments (~1.2s — Chromium respawn
    // timeout), so its reset was still IN FLIGHT when this test fired its
    // own — which the adminEvents mutex rejected with {success: false}.
    // This test never checked the ack, so the failure surfaced downstream
    // as 'session not cleared'. The sibling now waits for the actual
    // success ack and this test asserts its own. The reset logic itself
    // was always sound (the test passes in isolation on every platform).
    it('should fully reset all service state', async () => {
      // Add some transactions
      const TestTokens = require('../fixtures/test-tokens');
      await transactionService.init(TestTokens.getAllAsArray());

      // Slice 5: processScan gets session internally, no longer passed as param
      await transactionService.processScan({
        tokenId: '534e2b03',
        teamId: 'Team Alpha',
        deviceId: 'GM_RESET_TEST',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        mode: 'blackmarket'
      });

      const session = sessionService.getCurrentSession();

      // Verify transaction exists
      expect(session.transactions.length).toBe(1);
      expect(transactionService.getTeamScores()).toHaveLength(1);

      // Perform system reset
      const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');
      gmSocket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'system:reset', payload: {} },
        timestamp: new Date().toISOString()
      });
      const resetAck = await ackPromise;
      // The ack is emitted only after performSystemReset() resolves; a
      // success:false ack means the mutex rejected us (another reset in
      // flight) and every assertion below would fail confusingly
      expect(resetAck.data.success).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all state cleared
      expect(sessionService.getCurrentSession()).toBeNull();
      expect(transactionService.getTeamScores()).toHaveLength(0);

      // Create new session - should start fresh
      await sessionService.createSession({
        name: 'Fresh Session',
        teams: ['Detectives']
      });
    await sessionService.startGame();

      const newSession = sessionService.getCurrentSession();
      expect(newSession.transactions.length).toBe(0);
      expect(newSession.scores.length).toBe(1);
      expect(newSession.scores[0].teamId).toBe('Detectives');
    });
  });
});
