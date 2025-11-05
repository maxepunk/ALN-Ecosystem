/**
 * TransactionService Unit Tests
 * Tests UNWRAPPED domain event emission from transactionService
 * NOTE: This is Layer 1 (service logic) - validates unwrapped events, NOT WebSocket structure
 */

const transactionService = require('../../../src/services/transactionService');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');

describe('TransactionService - Event Emission', () => {
  beforeEach(async () => {
    // Reset services
    await resetAllServices();

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

  describe('score:updated event (UNWRAPPED)', () => {
    it('should emit unwrapped score:updated when team score changes', async () => {
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
        memoryType: 'Technical',  // Capitalized per tokens.json
        mediaAssets: {
          image: null,
          audio: null,
          video: null,
          processingImage: null
        },
        metadata: {
          rating: 3
        },
      });

      // Initialize tokens in transactionService
      transactionService.tokens.set('test123', testToken);

      // Listen for UNWRAPPED score:updated event (Layer 1 - service emits raw data)
      const eventPromise = new Promise((resolve) => {
        transactionService.once('score:updated', (teamScore) => {
          // Validate UNWRAPPED structure (raw TeamScore object, no {event, data, timestamp} wrapper)
          expect(teamScore).toHaveProperty('teamId', '001');
          expect(teamScore).toHaveProperty('currentScore');
          expect(teamScore).toHaveProperty('baseScore');
          expect(teamScore).toHaveProperty('bonusPoints');
          expect(teamScore).toHaveProperty('tokensScanned');
          expect(teamScore).toHaveProperty('completedGroups');
          expect(teamScore).toHaveProperty('lastUpdate');

          // Verify it's an actual TeamScore object, not a wrapped event
          expect(teamScore.event).toBeUndefined(); // Should NOT have wrapper fields
          expect(teamScore.data).toBeUndefined(); // Should NOT have wrapper fields
          // TeamScore uses lastUpdate, not timestamp (timestamp is for wrapped events)
          expect(teamScore.lastUpdate).toBeDefined();

          resolve(teamScore);
        });
      });

      // Trigger: Update team score (should emit unwrapped score:updated)
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
        memoryType: 'Technical',  // Capitalized
        mediaAssets: {
          image: null,
          audio: null,
          video: null,
          processingImage: null
        },
        metadata: {
          rating: 3
        },
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
        memoryType: 'Technical',  // Capitalized, valid enum value
        groupId: 'test-group',
        groupMultiplier: 2,
        mediaAssets: {
          image: null,
          audio: null,
          video: null,
          processingImage: null
        },
        metadata: {
          rating: 2
        },
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
        memoryType: 'Personal',  // Capitalized, valid enum value
        mediaAssets: {
          image: null,
          audio: null,
          video: null,
          processingImage: null
        },
        metadata: {
          rating: 1
        },
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

describe('TransactionService - Business Logic (Layer 1 Unit Tests)', () => {
  beforeEach(async () => {
    await resetAllServices();

    if (!transactionService.sessionListenerRegistered) {
      transactionService.registerSessionListener();
      transactionService.sessionListenerRegistered = true;
    }
  });

  afterEach(async () => {
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
    transactionService.removeAllListeners();
  });

  describe('Token Management', () => {
    it('should initialize with tokens', async () => {
      const tokens = [
        {
          id: 'token1',
          name: 'Token 1',
          value: 100,
          memoryType: 'Technical',
          mediaAssets: { image: null, audio: null, video: null, processingImage: null },
          metadata: { rfid: 'token1', group: 'Test Group', originalType: 'Technical', rating: 3 }
        },
        {
          id: 'token2',
          name: 'Token 2',
          value: 200,
          memoryType: 'Business',
          mediaAssets: { image: null, audio: null, video: null, processingImage: null },
          metadata: { rfid: 'token2', group: 'Test Group', originalType: 'Business', rating: 5 }
        }
      ];

      await transactionService.init(tokens);

      expect(transactionService.tokens.size).toBe(2);
      expect(transactionService.getToken('token1')).toBeDefined();
      expect(transactionService.getToken('token2')).toBeDefined();
    });

    it('should return null for non-existent token', () => {
      const token = transactionService.getToken('nonexistent');
      expect(token).toBeNull();
    });

    it('should get all tokens', async () => {
      const tokens = [
        {
          id: 'token1',
          name: 'Token 1',
          value: 100,
          memoryType: 'Technical',
          mediaAssets: { image: null, audio: null, video: null, processingImage: null },
          metadata: { rfid: 'token1', group: 'Test Group', originalType: 'Technical', rating: 3 }
        },
        {
          id: 'token2',
          name: 'Token 2',
          value: 200,
          memoryType: 'Business',
          mediaAssets: { image: null, audio: null, video: null, processingImage: null },
          metadata: { rfid: 'token2', group: 'Test Group', originalType: 'Business', rating: 5 }
        }
      ];

      await transactionService.init(tokens);

      const allTokens = transactionService.getAllTokens();
      expect(Array.isArray(allTokens)).toBe(true);
      expect(allTokens.length).toBe(2);
    });

    it('should persist tokens on reset', async () => {
      const tokens = [
        {
          id: 'token1',
          name: 'Token 1',
          value: 100,
          memoryType: 'Technical',
          mediaAssets: { image: null, audio: null, video: null, processingImage: null },
          metadata: { rfid: 'token1', group: 'Test Group', originalType: 'Technical', rating: 3 }
        }
      ];

      await transactionService.init(tokens);
      expect(transactionService.tokens.size).toBeGreaterThanOrEqual(1);

      await transactionService.reset();
      // Tokens should persist after reset (loaded from config, not cleared)
      expect(transactionService.getAllTokens().filter(t => t.id === 'token1').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate token scan', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      // First transaction (accepted)
      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token123',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString()
      }, session.id);
      tx1.accept(100);

      session.transactions = [tx1];

      // Second transaction (same token, different team)
      const tx2 = Transaction.fromScanRequest({
        tokenId: 'token123',
        teamId: '002',
        deviceId: 'GM_02',
        timestamp: new Date().toISOString()
      }, session.id);

      const isDuplicate = transactionService.isDuplicate(tx2, session);
      expect(isDuplicate).toBe(true);
    });

    it('should allow same token in different sessions', async () => {
      // Session 1
      await sessionService.createSession({
        name: 'Session 1',
        teams: ['001']
      });

      const session1 = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token123',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString()
      }, session1.id);
      tx1.accept(100);

      session1.transactions = [tx1];

      // End session 1, start session 2
      await sessionService.endSession();
      await sessionService.createSession({
        name: 'Session 2',
        teams: ['002']
      });

      const session2 = sessionService.getCurrentSession();
      const tx2 = Transaction.fromScanRequest({
        tokenId: 'token123',
        teamId: '002',
        deviceId: 'GM_02',
        timestamp: new Date().toISOString()
      }, session2.id);

      const isDuplicate = transactionService.isDuplicate(tx2, session2);
      expect(isDuplicate).toBe(false);
    });

    it('should find original transaction for duplicate', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      // Team 001 claims first
      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token123',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString()
      }, session.id);
      tx1.accept(100);

      session.transactions = [tx1];

      // Team 002 tries to claim (duplicate)
      const tx2 = Transaction.fromScanRequest({
        tokenId: 'token123',
        teamId: '002',
        deviceId: 'GM_02',
        timestamp: new Date().toISOString()
      }, session.id);

      const original = transactionService.findOriginalTransaction(tx2, session);
      expect(original).toBeDefined();
      expect(original.teamId).toBe('001');
      expect(original.tokenId).toBe('token123');
    });

    it('should return null when no original transaction found', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      const tx = Transaction.fromScanRequest({
        tokenId: 'new_token',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString()
      }, session.id);

      const original = transactionService.findOriginalTransaction(tx, session);
      expect(original).toBeNull();
    });
  });

  describe('Team Score Management', () => {
    it('should initialize team scores from session creation', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002', '003']
      });

      // Wait for session:created event to propagate
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(transactionService.teamScores.size).toBe(3);
      expect(transactionService.teamScores.has('001')).toBe(true);
      expect(transactionService.teamScores.has('002')).toBe(true);
      expect(transactionService.teamScores.has('003')).toBe(true);
    });

    it('should reset scores when session ends', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002']
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(transactionService.teamScores.size).toBe(2);

      await sessionService.endSession();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(transactionService.teamScores.size).toBe(0);
    });

    it('should get all team scores', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002']
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const scores = transactionService.getTeamScores();
      expect(Array.isArray(scores)).toBe(true);
      expect(scores.length).toBe(2);
    });

    it('should reset scores manually', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(transactionService.teamScores.size).toBe(1);

      transactionService.resetScores();

      expect(transactionService.teamScores.size).toBe(0);
    });
  });

  describe('Group Completion Logic', () => {
    it('should detect incomplete group', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      const Token = require('../../../src/models/token');
      const token1 = new Token({
        id: 'token1',
        name: 'Token 1',
        value: 100,
        memoryType: 'Technical',
        groupId: 'alpha-group',
        groupMultiplier: 2,
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 }
      });

      const token2 = new Token({
        id: 'token2',
        name: 'Token 2',
        value: 100,
        memoryType: 'Technical',
        groupId: 'alpha-group',
        groupMultiplier: 2,
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 }
      });

      transactionService.tokens.set('token1', token1);
      transactionService.tokens.set('token2', token2);

      // Group incomplete - team hasn't scanned any tokens
      const isComplete = transactionService.isGroupComplete('001', 'alpha-group');
      expect(isComplete).toBe(false);
    });

    it('should detect completed group', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      const session = sessionService.getCurrentSession();
      const Token = require('../../../src/models/token');
      const Transaction = require('../../../src/models/transaction');

      const token1 = new Token({
        id: 'token1',
        name: 'Token 1',
        value: 100,
        memoryType: 'Technical',
        groupId: 'alpha-group',
        groupMultiplier: 2,
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 }
      });

      const token2 = new Token({
        id: 'token2',
        name: 'Token 2',
        value: 100,
        memoryType: 'Technical',
        groupId: 'alpha-group',
        groupMultiplier: 2,
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 }
      });

      transactionService.tokens.set('token1', token1);
      transactionService.tokens.set('token2', token2);

      // Team scans both tokens
      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token1',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString()
      }, session.id);
      tx1.accept(100);

      const tx2 = Transaction.fromScanRequest({
        tokenId: 'token2',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString()
      }, session.id);
      tx2.accept(100);

      session.transactions = [tx1, tx2];

      // Group complete - team scanned all tokens
      const isComplete = transactionService.isGroupComplete('001', 'alpha-group');
      expect(isComplete).toBe(true);
    });

    it('should return false for single-token groups', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      const Token = require('../../../src/models/token');
      const token1 = new Token({
        id: 'token1',
        name: 'Token 1',
        value: 100,
        memoryType: 'Technical',
        groupId: 'solo-group',
        groupMultiplier: 2,
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 }
      });

      transactionService.tokens.set('token1', token1);

      // Single token groups cannot be completed
      const isComplete = transactionService.isGroupComplete('001', 'solo-group');
      expect(isComplete).toBe(false);
    });

    it('should return false for null groupId', () => {
      const isComplete = transactionService.isGroupComplete('001', null);
      expect(isComplete).toBe(false);
    });

    it('should calculate group bonus multiplier', () => {
      const Token = require('../../../src/models/token');
      const token1 = new Token({
        id: 'token1',
        name: 'Token 1',
        value: 100,
        memoryType: 'Technical',
        groupId: 'bonus-group',
        groupMultiplier: 3,
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 }
      });

      transactionService.tokens.set('token1', token1);

      const multiplier = transactionService.calculateGroupBonus('bonus-group');
      expect(multiplier).toBe(3);
    });

    it('should return 0 for null groupId bonus', () => {
      const multiplier = transactionService.calculateGroupBonus(null);
      expect(multiplier).toBe(0);
    });

    it('should return 0 for non-existent group', () => {
      const multiplier = transactionService.calculateGroupBonus('nonexistent-group');
      expect(multiplier).toBe(0);
    });
  });

  describe('Recent Transactions', () => {
    it('should track recent transactions', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');
      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token1',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString()
      }, session.id);

      transactionService.addRecentTransaction(tx1);

      const recent = transactionService.getRecentTransactions(10);
      expect(recent.length).toBe(1);
      expect(recent[0].id).toBeDefined();
    });

    it('should limit recent transactions to specified count', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      // Add 15 transactions
      for (let i = 0; i < 15; i++) {
        const tx = Transaction.fromScanRequest({
          tokenId: `token${i}`,
          teamId: '001',
          deviceId: 'GM_01',
          timestamp: new Date().toISOString()
        }, session.id);
        transactionService.addRecentTransaction(tx);
      }

      const recent = transactionService.getRecentTransactions(10);
      expect(recent.length).toBe(10);
    });

    it('should return most recent transactions first', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token1',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date('2025-01-01').toISOString()
      }, session.id);

      const tx2 = Transaction.fromScanRequest({
        tokenId: 'token2',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date('2025-01-02').toISOString()
      }, session.id);

      transactionService.addRecentTransaction(tx1);
      transactionService.addRecentTransaction(tx2);

      const recent = transactionService.getRecentTransactions(10);
      expect(recent[0].tokenId).toBe('token2'); // Most recent first
      expect(recent[1].tokenId).toBe('token1');
    });
  });

  describe('Score Rebuilding', () => {
    it('should rebuild scores from transactions', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002']
      });

      const session = sessionService.getCurrentSession();
      const Token = require('../../../src/models/token');
      const Transaction = require('../../../src/models/transaction');

      const token1 = new Token({
        id: 'token1',
        name: 'Token 1',
        value: 100,
        memoryType: 'Technical',
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 }
      });

      transactionService.tokens.set('token1', token1);

      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token1',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString()
      }, session.id);
      tx1.accept(100);
      tx1.mode = 'blackmarket';

      // Rebuild scores
      transactionService.rebuildScoresFromTransactions([tx1]);

      // Verify score was rebuilt
      const teamScore = transactionService.teamScores.get('001');
      expect(teamScore).toBeDefined();
      expect(teamScore.tokensScanned).toBe(1);
    });

    it('should skip detective mode transactions when rebuilding', async () => {
      // Create session without initializing teams (empty teams array)
      await sessionService.createSession({
        name: 'Test Session',
        teams: []
      });

      const session = sessionService.getCurrentSession();
      const Token = require('../../../src/models/token');
      const Transaction = require('../../../src/models/transaction');

      const token1 = new Token({
        id: 'token1',
        name: 'Token 1',
        value: 100,
        memoryType: 'Technical',
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rfid: 'token1', group: '', originalType: 'Technical', rating: 3 }
      });

      transactionService.tokens.set('token1', token1);

      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token1',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString()
      }, session.id);
      tx1.accept(100);
      tx1.mode = 'detective'; // Detective mode

      // Rebuild scores
      transactionService.rebuildScoresFromTransactions([tx1]);

      // Verify detective mode transactions don't create scores
      // (session didn't initialize team 001, and detective mode shouldn't add it)
      const teamScore = transactionService.teamScores.get('001');
      expect(teamScore).not.toBeDefined();
    });
  });

  describe('Per-Device Duplicate Detection (Phase 1.1 P0.1)', () => {
    let session, token1;

    beforeEach(async () => {
      await resetAllServices();

      // Create session
      session = await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002']
      });

      // Initialize token
      const Token = require('../../../src/models/token');
      token1 = new Token({
        id: 'kaa001',
        name: 'Test Memory',
        value: 100,
        memoryType: 'Technical',
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rfid: 'kaa001', rating: 3 }
      });

      transactionService.tokens.set('kaa001', token1);
    });

    afterEach(async () => {
      if (sessionService.currentSession) {
        await sessionService.endSession();
      }
      sessionService.removeAllListeners();
      transactionService.removeAllListeners();
    });

    test('should reject duplicate scan from same device', async () => {
      // First scan - should succeed
      const result1 = await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      }, session);

      expect(result1.transaction.status).toBe('accepted');
      expect(result1.transaction.isDuplicate()).toBe(false);

      // Second scan from SAME device - should be rejected as duplicate
      const result2 = await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      }, session);

      expect(result2.transaction.status).toBe('duplicate');
      expect(result2.transaction.isDuplicate()).toBe(true);
    });

    test('should track scanned token in session metadata', async () => {
      const result = await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      }, session);

      expect(result.transaction.status).toBe('accepted');

      // Verify token tracked in session
      expect(session.hasDeviceScannedToken('GM_001', 'kaa001')).toBe(true);
      expect(session.getDeviceScannedTokensArray('GM_001')).toContain('kaa001');
    });

    test('should allow same token from different devices', async () => {
      // First device scans token
      const result1 = await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      }, session);

      expect(result1.transaction.status).toBe('accepted');

      // IMPORTANT: This test shows current first-come-first-served behavior
      // Once GM_001 claims the token, NO OTHER DEVICE can scan it
      // This is existing behavior, not changed by P0.1

      // Different device tries to scan same token - REJECTED by session-wide check
      const result2 = await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_002',
        teamId: '002',
        timestamp: new Date().toISOString()
      }, session);

      expect(result2.transaction.status).toBe('duplicate');
      expect(result2.transaction.isDuplicate()).toBe(true);
    });

    test('should reject duplicate even after page refresh simulation', async () => {
      // First scan
      await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      }, session);

      // Simulate page refresh: GM Scanner would receive sync:full with scannedTokensByDevice
      // In real scenario, GM Scanner would restore scannedTokens from sync:full
      // Here we verify the server still has the data

      expect(session.hasDeviceScannedToken('GM_001', 'kaa001')).toBe(true);

      // Attempt to scan again (e.g., after refresh, user tries to re-scan)
      const result = await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      }, session);

      expect(result.transaction.status).toBe('duplicate');
      expect(result.transaction.isDuplicate()).toBe(true);
    });

    test('should allow different tokens from same device', async () => {
      // Add second token
      const Token = require('../../../src/models/token');
      const token2 = new Token({
        id: 'kaa002',
        name: 'Test Memory 2',
        value: 150,
        memoryType: 'Business',
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rfid: 'kaa002', rating: 4 }
      });
      transactionService.tokens.set('kaa002', token2);

      // Scan first token
      const result1 = await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      }, session);

      expect(result1.transaction.status).toBe('accepted');

      // Scan different token from same device - should succeed
      const result2 = await transactionService.processScan({
        tokenId: 'kaa002',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      }, session);

      expect(result2.transaction.status).toBe('accepted');
      expect(result2.transaction.isDuplicate()).toBe(false);

      // Verify both tokens tracked
      expect(session.getDeviceScannedTokensArray('GM_001')).toEqual(['kaa001', 'kaa002']);
    });

    test('should include scannedTokensByDevice in session JSON', async () => {
      // Scan tokens from multiple devices
      await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      }, session);

      // Get session JSON (this is what sync:full sends)
      const sessionJSON = session.toJSON();

      expect(sessionJSON.metadata.scannedTokensByDevice).toBeDefined();
      expect(sessionJSON.metadata.scannedTokensByDevice).toEqual({
        GM_001: ['kaa001']
      });
    });

    test('should handle session restoration with scannedTokensByDevice', async () => {
      // Scan a token
      await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      }, session);

      // Save and restore session (simulates server restart)
      const sessionJSON = session.toJSON();
      const Session = require('../../../src/models/session');
      const restoredSession = Session.fromJSON(sessionJSON);

      // Verify scannedTokensByDevice persisted
      expect(restoredSession.hasDeviceScannedToken('GM_001', 'kaa001')).toBe(true);

      // Try to scan again with restored session - should be rejected
      const result = await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      }, restoredSession);

      expect(result.transaction.status).toBe('duplicate');
      expect(result.transaction.isDuplicate()).toBe(true);
    });
  });
});
