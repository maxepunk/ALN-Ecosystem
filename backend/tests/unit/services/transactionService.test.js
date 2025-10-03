/**
 * TransactionService Unit Tests
 * Tests score:updated event emission per asyncapi.yaml
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const transactionService = require('../../../src/services/transactionService');
const sessionService = require('../../../src/services/sessionService');

describe('TransactionService - Event Emission', () => {
  beforeEach(async () => {
    // Reset services
    await sessionService.reset();
    await transactionService.reset();

    // Re-register listeners after reset
    if (!transactionService.sessionListenerRegistered) {
      transactionService.registerSessionListener();
      transactionService.sessionListenerRegistered = true;
    }
  });

  afterEach(async () => {
    // Cleanup
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
    transactionService.removeAllListeners();
  });

  describe('score:updated event', () => {
    it('should emit score:updated when team score changes', async () => {
      // Setup: Create session and initialize transaction service
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      const Token = require('../../../src/models/token');
      const testToken = new Token({
        id: 'test123',
        name: 'Test Token',
        value: 100,
        memoryType: 'technical',
        mediaAssets: {},
        metadata: {},
      });

      // Initialize tokens in transactionService
      transactionService.tokens.set('test123', testToken);

      // Listen for score:updated event
      const eventPromise = new Promise((resolve, reject) => {
        transactionService.once('score:updated', (eventData) => {
          try {
            // Validate against asyncapi.yaml schema (wrapped envelope)
            validateWebSocketEvent(eventData, 'score:updated');

            // Verify wrapper structure
            expect(eventData.event).toBe('score:updated');
            expect(eventData.data).toBeDefined();
            expect(eventData.timestamp).toBeDefined();

            // Verify score data per AsyncAPI schema
            expect(eventData.data.teamId).toBe('001');
            expect(eventData.data.currentScore).toBeDefined();
            expect(eventData.data.baseScore).toBeDefined();
            expect(eventData.data.bonusPoints).toBeDefined();
            expect(eventData.data.tokensScanned).toBeDefined();
            expect(eventData.data.completedGroups).toBeDefined();
            expect(eventData.data.lastUpdate).toBeDefined();

            resolve(eventData);
          } catch (error) {
            reject(error);
          }
        });
      });

      // Trigger: Update team score (should emit score:updated)
      transactionService.updateTeamScore('001', testToken);

      // Wait for event
      await eventPromise;
    });

    it('should NOT directly modify sessionService state', async () => {
      // Setup
      await sessionService.createSession({
        name: 'Test Session',
        teams: [] // No teams initially
      });

      const Token = require('../../../src/models/token');
      const testToken = new Token({
        id: 'test123',
        name: 'Test Token',
        value: 100,
        memoryType: 'technical',
        mediaAssets: {},
        metadata: {},
      });

      transactionService.tokens.set('test123', testToken);

      // Trigger: Update score for new team
      transactionService.updateTeamScore('002', testToken);

      // Verify: transactionService should NOT have modified sessionService.scores directly
      const session = sessionService.getCurrentSession();
      const teamInSessionScores = session.scores.find(s => s.teamId === '002');

      // Session should NOT have team 002 (transactionService shouldn't modify it directly)
      expect(teamInSessionScores).toBeUndefined();
    });
  });

  describe('service imports (Phase 1.1.6)', () => {
    it('should use top-level sessionService import in isGroupComplete()', async () => {
      // Setup session with tokens
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      const Token = require('../../../src/models/token');
      const token1 = new Token({
        id: 'token1',
        name: 'Token 1',
        value: 10,
        memoryType: 'visual',
        group: 'test-group',
        groupMultiplier: 2,
        mediaAssets: {},
        metadata: {},
      });

      transactionService.tokens.set('token1', token1);

      // isGroupComplete() uses sessionService.getCurrentSession()
      // This should work with top-level import (not lazy require)
      const result = transactionService.isGroupComplete('001', 'test-group');

      // Should return false (group not complete - needs multiple tokens)
      expect(result).toBe(false);
    });

    it('should use top-level videoQueueService import in createScanResponse()', async () => {
      // Setup session
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      const Token = require('../../../src/models/token');

      const testToken = new Token({
        id: 'test_video',
        name: 'Test Video Token',
        value: 10,
        memoryType: 'visual',
        mediaAssets: {},
        metadata: {},
      });

      transactionService.tokens.set('test_video', testToken);

      // Use processScan which creates a proper Transaction and calls createScanResponse
      const session = sessionService.getCurrentSession();
      const scanRequest = {
        tokenId: 'test_video',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString()
      };

      // processScan internally calls createScanResponse which uses videoQueueService.isPlaying()
      // This should work with top-level import (not lazy require)
      const response = await transactionService.processScan(scanRequest, session);

      // Verify response structure includes video status from videoQueueService
      expect(response).toBeDefined();
      expect(response.status).toBeDefined();
      expect(response.videoPlaying).toBeDefined(); // This field comes from videoQueueService.isPlaying()
    });
  });
});
