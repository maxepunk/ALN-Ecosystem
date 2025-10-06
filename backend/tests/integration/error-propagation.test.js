/**
 * Error Propagation Integration Tests
 *
 * Tests error handling across service boundaries:
 * - Invalid token errors → transaction:result with status='error'
 * - Handler errors → error event to submitter
 * - Service errors → error event broadcast to all clients
 * - System stability after multiple errors
 *
 * CRITICAL: These tests validate graceful error handling and system resilience.
 * Expected to REVEAL error handling bugs if error events don't propagate correctly.
 *
 * Contract: backend/contracts/asyncapi.yaml (error event, transaction:result)
 * Functional Requirements: Section 3.2 (Error Handling)
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { validateWebSocketEvent } = require('../helpers/contract-validator');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../src/websocket/broadcasts');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const videoQueueService = require('../../src/services/videoQueueService');

describe('Error Propagation Integration', () => {
  let testContext, gmSocket;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Reset services
    await sessionService.reset();
    await transactionService.reset();

    // CRITICAL: Cleanup old broadcast listeners
    cleanupBroadcastListeners();

    // Re-initialize tokens
    const tokenService = require('../../src/services/tokenService');
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // Re-setup broadcast listeners
    const stateService = require('../../src/services/stateService');
    const offlineQueueService = require('../../src/services/offlineQueueService');

    setupBroadcastListeners(testContext.io, {
      sessionService,
      transactionService,
      stateService,
      videoQueueService,
      offlineQueueService
    });

    // Create test session
    await sessionService.createSession({
      name: 'Error Test Session',
      teams: ['001', '002']
    });

    // Connect GM scanner
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ERROR_TEST');
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
    await sessionService.reset();
  });

  describe('Invalid Token Error Handling', () => {
    it('should propagate invalid token error to client', async () => {
      // CRITICAL: Set up listener BEFORE submitting transaction
      const resultPromise = waitForEvent(gmSocket, 'transaction:result');

      // Trigger: Submit transaction with invalid token
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'invalid_token',  // Explicitly invalid (see transactionService.js line 118-121)
          teamId: '001',
          deviceId: 'GM_ERROR_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:result with error
      const result = await resultPromise;

      // Validate: Error response structure
      expect(result.event).toBe('transaction:result');
      expect(result.data.status).toBe('error');
      expect(result.data.message).toContain('Invalid token');
      expect(result.data.points).toBe(0);
      expect(result.data.transactionId).toBeDefined();

      // Validate: Contract compliance
      validateWebSocketEvent(result, 'transaction:result');

      // Verify: Service state unchanged (no score added)
      const teamScores = transactionService.getTeamScores();
      const team001Score = teamScores.find(s => s.teamId === '001');
      expect(team001Score.currentScore).toBe(0);
    });

    it('should handle nonexistent token gracefully', async () => {
      const resultPromise = waitForEvent(gmSocket, 'transaction:result');

      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'NONEXISTENT_FAKE_TOKEN_12345',
          teamId: '001',
          deviceId: 'GM_ERROR_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result = await resultPromise;

      expect(result.data.status).toBe('error');
      expect(result.data.message).toContain('Invalid token');
      expect(result.data.points).toBe(0);
    });
  });

  describe('Handler Error Handling', () => {
    it('should handle missing required parameters', async () => {
      // CRITICAL: Set up listener BEFORE emitting
      const errorPromise = waitForEvent(gmSocket, 'error');

      // Trigger: Submit transaction with missing teamId (validation error)
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          // Missing teamId (required)
          deviceId: 'GM_ERROR_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For error event (handler catch block emits this)
      const errorEvent = await errorPromise;

      // Validate: Error event structure
      expect(errorEvent.event).toBe('error');
      expect(errorEvent.data.code).toBe('VALIDATION_ERROR');  // AsyncAPI contract value
      expect(errorEvent.data.message).toContain('Failed to process transaction');
      expect(errorEvent.data.details).toBeDefined();

      // Validate: Contract compliance
      validateWebSocketEvent(errorEvent, 'error');
    });

    it('should handle malformed transaction data', async () => {
      const errorPromise = waitForEvent(gmSocket, 'error');

      // Trigger: Submit invalid data structure
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          // Malformed data - tokenId is object instead of string
          tokenId: { invalid: 'structure' },
          teamId: '001',
          deviceId: 'GM_ERROR_TEST'
        },
        timestamp: new Date().toISOString()
      });

      const errorEvent = await errorPromise;

      expect(errorEvent.data.code).toBe('VALIDATION_ERROR');  // AsyncAPI contract value
      expect(errorEvent.data.message).toBeDefined();
    });
  });

  describe('System Stability Under Errors', () => {
    it('should remain stable after multiple rapid errors', async () => {
      // Trigger: Submit 5 invalid transactions rapidly
      const promises = [];

      for (let i = 0; i < 5; i++) {
        const promise = waitForEvent(gmSocket, 'transaction:result');
        gmSocket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: `INVALID_${i}`,
            teamId: '001',
            deviceId: 'GM_ERROR_TEST',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });
        promises.push(promise);
      }

      // Wait: For all errors to be handled
      const results = await Promise.all(promises);

      // Validate: All errors handled gracefully
      results.forEach(result => {
        expect(result.data.status).toBe('error');
        expect(result.data.message).toContain('Invalid token');
      });

      // Wait a bit to ensure error transactions fully complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify: System still functional after errors
      const validPromise = waitForEvent(gmSocket, 'transaction:result');
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Valid token
          teamId: '001',
          deviceId: 'GM_ERROR_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const validResult = await validPromise;

      // Validate: Valid transaction processed correctly
      expect(validResult.data.status).toBe('accepted');
      expect(validResult.data.points).toBe(5000); // Technical rating 3 = 5000 points
    });

    it('should handle concurrent errors from multiple GMs', async () => {
      // Connect second GM
      const gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ERROR_2');

      try {
        // Both GMs submit invalid transactions simultaneously
        const gm1Promise = waitForEvent(gmSocket, 'transaction:result');
        const gm2Promise = waitForEvent(gm2, 'transaction:result');

        gmSocket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: 'invalid_token',
            teamId: '001',
            deviceId: 'GM_ERROR_TEST',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        gm2.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: 'ANOTHER_INVALID_TOKEN',
            teamId: '002',
            deviceId: 'GM_ERROR_2',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        const [result1, result2] = await Promise.all([gm1Promise, gm2Promise]);

        // Both errors should be handled independently
        expect(result1.data.status).toBe('error');
        expect(result2.data.status).toBe('error');

        // System should still be functional
        const validPromise = waitForEvent(gmSocket, 'transaction:result');
        gmSocket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: '534e2b03',
            teamId: '001',
            deviceId: 'GM_ERROR_TEST',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        const validResult = await validPromise;
        expect(validResult.data.status).toBe('accepted');
      } finally {
        gm2.disconnect();
      }
    });
  });

  describe('Service Error Broadcasting', () => {
    it('should broadcast service errors to all connected clients', async () => {
      // Connect second GM to verify broadcast
      const gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_ERROR_2');

      try {
        // Set up listeners on BOTH GMs BEFORE triggering error
        const gm1ErrorPromise = waitForEvent(gmSocket, 'error', 2000);
        const gm2ErrorPromise = waitForEvent(gm2, 'error', 2000);

        // Trigger: Simulate a critical service error
        // Services emit 'error' events that broadcasts.js listens to (see broadcasts.js line 338-352)
        videoQueueService.emit('error', {
          message: 'VLC connection lost',
          code: 'VLC_ERROR'
        });

        // Wait: For error to be broadcast to ALL clients
        const [error1, error2] = await Promise.all([gm1ErrorPromise, gm2ErrorPromise]);

        // Validate: Both GMs received identical error event
        expect(error1.event).toBe('error');
        expect(error1.data.service).toBe('video');
        expect(error1.data.message).toContain('VLC connection lost');
        expect(error1.data.code).toBe('VLC_ERROR');

        expect(error2.event).toBe('error');
        expect(error2.data).toEqual(error1.data);

        // Validate: Contract compliance
        validateWebSocketEvent(error1, 'error');
      } finally {
        gm2.disconnect();
      }
    });

    it('should broadcast video:failed on video playback errors', async () => {
      // CRITICAL: Set up listener BEFORE triggering error
      const failedPromise = waitForEvent(gmSocket, 'video:status');

      // Trigger: Simulate video playback failure
      videoQueueService.emit('video:failed', {
        tokenId: '534e2b03',  // Real token with video asset
        error: 'Video file not found'
      });

      // Wait: For video:status with status='error'
      const failedEvent = await failedPromise;

      // Validate: Error status broadcast
      expect(failedEvent.data.status).toBe('error');
      expect(failedEvent.data.tokenId).toBe('534e2b03');
      expect(failedEvent.data.error).toContain('Video file not found');

      // Validate: Contract compliance
      validateWebSocketEvent(failedEvent, 'video:status');
    });
  });

  describe('Error Recovery', () => {
    it('should allow valid transactions after errors are resolved', async () => {
      // Step 1: Trigger error
      const errorPromise = waitForEvent(gmSocket, 'transaction:result');
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'invalid_token',
          teamId: '001',
          deviceId: 'GM_ERROR_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
      const errorResult = await errorPromise;
      expect(errorResult.data.status).toBe('error');

      // Step 2: Submit valid transaction (recovery)
      const validPromise = waitForEvent(gmSocket, 'transaction:result');
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '001',
          deviceId: 'GM_ERROR_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
      const validResult = await validPromise;

      // Validate: Valid transaction processed successfully
      expect(validResult.data.status).toBe('accepted');
      expect(validResult.data.points).toBe(5000);

      // Verify: Score updated correctly
      const teamScores = transactionService.getTeamScores();
      const team001Score = teamScores.find(s => s.teamId === '001');
      expect(team001Score.currentScore).toBe(5000);
    });

    it('should maintain correct state after mixed valid/invalid transactions', async () => {
      // Sequence: Valid → Invalid → Valid → Invalid → Valid
      const transactions = [
        { tokenId: '534e2b03', valid: true, points: 5000 },   // Technical 3
        { tokenId: 'invalid_token', valid: false, points: 0 },
        { tokenId: 'tac001', valid: true, points: 100 },      // Personal 1
        { tokenId: 'NONEXISTENT', valid: false, points: 0 },
        { tokenId: 'rat001', valid: true, points: 15000 }     // Business 4
      ];

      let expectedScore = 0;

      for (const tx of transactions) {
        const resultPromise = waitForEvent(gmSocket, 'transaction:result');

        gmSocket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: tx.tokenId,
            teamId: '001',
            deviceId: 'GM_ERROR_TEST',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        const result = await resultPromise;

        if (tx.valid) {
          expect(result.data.status).toBe('accepted');
          expect(result.data.points).toBe(tx.points);
          expectedScore += tx.points;
        } else {
          expect(result.data.status).toBe('error');
          expect(result.data.points).toBe(0);
        }
      }

      // Validate: Final score reflects only valid transactions
      const teamScores = transactionService.getTeamScores();
      const team001Score = teamScores.find(s => s.teamId === '001');
      expect(team001Score.currentScore).toBe(expectedScore); // 5000 + 100 + 15000 = 20100
    });
  });
});
