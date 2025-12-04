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
        teams: ['Team Alpha']
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
          expect(teamScore).toHaveProperty('teamId', 'Team Alpha');
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
      const teamInSessionScores = session.scores.find(s => s.teamId === 'Detectives');

      // Session should NOT have team 002 (transactionService shouldn't modify it directly)
      expect(teamInSessionScores).toBeUndefined();
    });
  });

  describe('service imports (Phase 1.1.6)', () => {
    it('should use top-level sessionService import in isGroupComplete()', async () => {
      // Setup session with tokens
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
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
        teams: ['Team Alpha']
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
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
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
        teams: ['Team Alpha', 'Detectives']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      // First transaction (accepted)
      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token123',
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        timestamp: new Date().toISOString()
      }, session.id);
      tx1.accept(100);

      session.transactions = [tx1];

      // Second transaction (same token, different team)
      const tx2 = Transaction.fromScanRequest({
        tokenId: 'token123',
        teamId: 'Detectives',
        deviceId: 'GM_02',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        timestamp: new Date().toISOString()
      }, session.id);

      const isDuplicate = transactionService.isDuplicate(tx2, session);
      expect(isDuplicate).toBe(true);
    });

    it('should allow same token in different sessions', async () => {
      // Session 1
      await sessionService.createSession({
        name: 'Session 1',
        teams: ['Team Alpha']
      });

      const session1 = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token123',
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
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
        teamId: 'Detectives',
        deviceId: 'GM_02',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        timestamp: new Date().toISOString()
      }, session2.id);

      const isDuplicate = transactionService.isDuplicate(tx2, session2);
      expect(isDuplicate).toBe(false);
    });

    it('should find original transaction for duplicate', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha', 'Detectives']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      // Team 001 claims first
      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token123',
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        timestamp: new Date().toISOString()
      }, session.id);
      tx1.accept(100);

      session.transactions = [tx1];

      // Team 002 tries to claim (duplicate)
      const tx2 = Transaction.fromScanRequest({
        tokenId: 'token123',
        teamId: 'Detectives',
        deviceId: 'GM_02',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        timestamp: new Date().toISOString()
      }, session.id);

      const original = transactionService.findOriginalTransaction(tx2, session);
      expect(original).toBeDefined();
      expect(original.teamId).toBe('Team Alpha');
      expect(original.tokenId).toBe('token123');
    });

    it('should return null when no original transaction found', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      const tx = Transaction.fromScanRequest({
        tokenId: 'new_token',
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
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
        teams: ['Team Alpha', 'Detectives', 'Blue Squad']
      });

      // Wait for session:created event to propagate
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(transactionService.teamScores.size).toBe(3);
      expect(transactionService.teamScores.has('Team Alpha')).toBe(true);
      expect(transactionService.teamScores.has('Detectives')).toBe(true);
      expect(transactionService.teamScores.has('Blue Squad')).toBe(true);
    });

    it('should reset scores when session ends', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha', 'Detectives']
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
        teams: ['Team Alpha', 'Detectives']
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const scores = transactionService.getTeamScores();
      expect(Array.isArray(scores)).toBe(true);
      expect(scores.length).toBe(2);
    });

    it('should reset scores manually', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
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
        teams: ['Team Alpha']
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
        teams: ['Team Alpha']
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
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        timestamp: new Date().toISOString()
      }, session.id);
      tx1.accept(100);

      const tx2 = Transaction.fromScanRequest({
        tokenId: 'token2',
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
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
        teams: ['Team Alpha']
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
        teams: ['Team Alpha']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');
      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token1',
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
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
        teams: ['Team Alpha']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      // Add 15 transactions
      for (let i = 0; i < 15; i++) {
        const tx = Transaction.fromScanRequest({
          tokenId: `token${i}`,
          teamId: 'Team Alpha',
          deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
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
        teams: ['Team Alpha']
      });

      const session = sessionService.getCurrentSession();
      const Transaction = require('../../../src/models/transaction');

      const tx1 = Transaction.fromScanRequest({
        tokenId: 'token1',
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        timestamp: new Date('2025-01-01').toISOString()
      }, session.id);

      const tx2 = Transaction.fromScanRequest({
        tokenId: 'token2',
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
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
        teams: ['Team Alpha', 'Detectives']
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
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        timestamp: new Date().toISOString()
      }, session.id);
      tx1.accept(100);
      tx1.mode = 'blackmarket';

      // Rebuild scores
      transactionService.rebuildScoresFromTransactions([tx1]);

      // Verify score was rebuilt
      const teamScore = transactionService.teamScores.get('Team Alpha');
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
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        timestamp: new Date().toISOString()
      }, session.id);
      tx1.accept(100);
      tx1.mode = 'detective'; // Detective mode

      // Rebuild scores
      transactionService.rebuildScoresFromTransactions([tx1]);

      // Verify detective mode transactions don't create scores
      // (session didn't initialize team 001, and detective mode shouldn't add it)
      const teamScore = transactionService.teamScores.get('Team Alpha');
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
        teams: ['Team Alpha', 'Detectives']
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
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Team Alpha',
        timestamp: new Date().toISOString()
      }, session);

      expect(result1.transaction.status).toBe('accepted');
      expect(result1.transaction.isDuplicate()).toBe(false);

      // Second scan from SAME device - should be rejected as duplicate
      const result2 = await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Team Alpha',
        timestamp: new Date().toISOString()
      }, session);

      expect(result2.transaction.status).toBe('duplicate');
      expect(result2.transaction.isDuplicate()).toBe(true);
    });

    test('should track scanned token in session metadata', async () => {
      const result = await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Team Alpha',
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
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Team Alpha',
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
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Detectives',
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
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Team Alpha',
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
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Team Alpha',
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
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Team Alpha',
        timestamp: new Date().toISOString()
      }, session);

      expect(result1.transaction.status).toBe('accepted');

      // Scan different token from same device - should succeed
      const result2 = await transactionService.processScan({
        tokenId: 'kaa002',
        deviceId: 'GM_001',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Team Alpha',
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
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Team Alpha',
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
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Team Alpha',
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
        deviceType: 'gm',  // Required by Phase 3 P0.1
        teamId: 'Team Alpha',
        timestamp: new Date().toISOString()
      }, restoredSession);

      expect(result.transaction.status).toBe('duplicate');
      expect(result.transaction.isDuplicate()).toBe(true);
    });
  });

  describe('Transaction Enrichment (Summary Field)', () => {
    let session;

    beforeEach(async () => {
      // Create session for all enrichment tests
      session = await sessionService.createSession({
        name: 'Enrichment Test Session',
        teams: ['Team Alpha']
      });
    });

    test('should enrich transaction with token default summary when not provided', async () => {
      // Setup: Token with default summary
      const Token = require('../../../src/models/token');
      const token = new Token({
        id: 'det001',
        name: 'Detective Token',
        value: 0,
        memoryType: 'Technical',
        groupId: null,
        groupMultiplier: 1,
        mediaAssets: {},
        metadata: {
          rfid: 'det001',
          rating: 2,
          summary: 'Default summary from token data'
        }
      });

      transactionService.tokens.set('det001', token);

      // Scan request WITHOUT summary
      const scanRequest = {
        tokenId: 'det001',
        teamId: 'Team Alpha',
        deviceId: 'TEST_GM',
        deviceType: 'gm',
        mode: 'detective',
        // summary: NOT PROVIDED
        timestamp: new Date().toISOString()
      };

      // Execute
      const result = await transactionService.processScan(scanRequest, session);

      // Verify: Transaction should be enriched with token's default summary
      expect(result.transaction.summary).toBe('Default summary from token data');

      // Verify: Persisted transaction has summary
      const persistedTransaction = session.transactions.find(t => t.tokenId === 'det001');
      expect(persistedTransaction.summary).toBe('Default summary from token data');
    });

    test('should use custom summary from scan request when provided', async () => {
      // Setup: Token with default summary
      const Token = require('../../../src/models/token');
      const token = new Token({
        id: 'det001',
        name: 'Detective Token',
        value: 0,
        memoryType: 'Technical',
        groupId: null,
        groupMultiplier: 1,
        mediaAssets: {},
        metadata: {
          rfid: 'det001',
          rating: 2,
          summary: 'Default summary from token data'
        }
      });

      transactionService.tokens.set('det001', token);

      // Scan request WITH custom summary
      const scanRequest = {
        tokenId: 'det001',
        teamId: 'Team Alpha',
        deviceId: 'TEST_GM',
        deviceType: 'gm',
        mode: 'detective',
        summary: 'Custom summary from GM operator',  // Custom override
        timestamp: new Date().toISOString()
      };

      // Execute
      const result = await transactionService.processScan(scanRequest, session);

      // Verify: Custom summary takes precedence
      expect(result.transaction.summary).toBe('Custom summary from GM operator');

      // Verify: Persisted transaction has custom summary
      const persistedTransaction = session.transactions.find(t => t.tokenId === 'det001');
      expect(persistedTransaction.summary).toBe('Custom summary from GM operator');
    });

    test('should handle tokens without default summary gracefully', async () => {
      // Setup: Token WITHOUT summary
      const Token = require('../../../src/models/token');
      const token = new Token({
        id: 'alr001',
        name: 'Regular Token',
        value: 1000,
        memoryType: 'Technical',
        groupId: null,
        groupMultiplier: 1,
        mediaAssets: {},
        metadata: {
          rfid: 'alr001',
          rating: 3,
          // No summary field
        }
      });

      transactionService.tokens.set('alr001', token);

      const scanRequest = {
        tokenId: 'alr001',
        teamId: 'Team Alpha',
        deviceId: 'TEST_GM',
        deviceType: 'gm',
        mode: 'detective',
        timestamp: new Date().toISOString()
      };

      // Execute
      const result = await transactionService.processScan(scanRequest, session);

      // Verify: Summary should be null (graceful handling)
      expect(result.transaction.summary).toBeNull();

      // Verify: Persisted transaction has null summary
      const persistedTransaction = session.transactions.find(t => t.tokenId === 'alr001');
      expect(persistedTransaction.summary).toBeNull();
    });

    test('should handle token with empty metadata object gracefully', async () => {
      // Setup: Token with empty metadata (no summary field)
      const Token = require('../../../src/models/token');
      const token = new Token({
        id: 'test001',
        name: 'Test Token',
        value: 100,
        memoryType: 'Technical',
        groupId: null,
        groupMultiplier: 1,
        mediaAssets: {},
        metadata: {}  // Empty metadata object (no summary field)
      });

      transactionService.tokens.set('test001', token);

      const scanRequest = {
        tokenId: 'test001',
        teamId: 'Team Alpha',
        deviceId: 'TEST_GM',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      };

      // Execute
      const result = await transactionService.processScan(scanRequest, session);

      // Verify: Should not crash, summary should be null
      expect(result.transaction.summary).toBeNull();
      expect(result.transaction.status).toBe('accepted');
    });

    test('should enrich summary for both detective and blackmarket modes', async () => {
      // Summary enrichment should work regardless of game mode
      const Token = require('../../../src/models/token');
      const token = new Token({
        id: 'det002',
        name: 'Detective Token',
        value: 0,
        memoryType: 'Technical',
        groupId: null,
        groupMultiplier: 1,
        mediaAssets: {},
        metadata: {
          rfid: 'det002',
          rating: 5,
          summary: 'This is a test summary'
        }
      });

      transactionService.tokens.set('det002', token);

      // Test blackmarket mode
      const blackmarketRequest = {
        tokenId: 'det002',
        teamId: 'Team Alpha',
        deviceId: 'TEST_GM',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      };

      const result = await transactionService.processScan(blackmarketRequest, session);

      // Verify: Summary enriched even in blackmarket mode
      expect(result.transaction.summary).toBe('This is a test summary');
      expect(result.transaction.mode).toBe('blackmarket');
    });
  });

  describe('resetScores', () => {
    it('should emit scores:reset event with teamsReset array', () => {
      // Setup: Add some team scores
      transactionService.teamScores.set('001', { currentScore: 500 });
      transactionService.teamScores.set('002', { currentScore: 300 });

      // Listen for event using Promise pattern
      const eventPromise = new Promise((resolve) => {
        transactionService.once('scores:reset', resolve);
      });

      // Execute
      transactionService.resetScores();

      // Verify
      return eventPromise.then((eventData) => {
        expect(eventData.teamsReset).toEqual(expect.arrayContaining(['Team Alpha', 'Detectives']));
        expect(eventData.teamsReset.length).toBe(2);
      });
    });

    it('should clear teamScores Map', () => {
      transactionService.teamScores.set('001', { currentScore: 500 });
      transactionService.resetScores();

      expect(transactionService.teamScores.size).toBe(0);
    });
  });

  describe('deleteTransaction', () => {
    it('should remove transaction from duplicate registry', async () => {
      // Setup: Create session and submit transaction
      const session = await sessionService.createSession({
        name: 'Delete Test Session',
        teams: ['Team Alpha']
      });

      const Token = require('../../../src/models/token');
      const testToken = new Token({
        id: 'test_delete_token',
        name: 'Delete Test Token',
        value: 100,
        memoryType: 'Technical',
        mediaAssets: {
          image: null,
          audio: null,
          video: null,
          processingImage: null
        },
        metadata: {
          rating: 3
        }
      });

      // Initialize token in transactionService
      transactionService.tokens.set('test_delete_token', testToken);

      const scanRequest = {
        tokenId: 'test_delete_token',
        teamId: 'Team Alpha',
        deviceId: 'GM_DELETE_TEST',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      };

      const scanResult = await transactionService.processScan(scanRequest, session, testToken);
      const transactionId = scanResult.transaction.id;

      // Verify token is in duplicate registry (device-specific tracking)
      expect(session.metadata.scannedTokensByDevice['GM_DELETE_TEST']).toContain('test_delete_token');

      // Listen for transaction:deleted event
      const eventPromise = new Promise((resolve) => {
        transactionService.once('transaction:deleted', resolve);
      });

      // Execute: Delete transaction
      const deleteResult = transactionService.deleteTransaction(transactionId, session);

      // Wait for event
      await eventPromise;

      // Verify: Transaction removed from session
      expect(session.transactions).toHaveLength(0);

      // CRITICAL: Verify token removed from duplicate registry (allows re-scanning)
      expect(session.metadata.scannedTokensByDevice['GM_DELETE_TEST']).not.toContain('test_delete_token');

      // Verify: Result structure
      expect(deleteResult.deletedTransaction).toBeDefined();
      expect(deleteResult.deletedTransaction.id).toBe(transactionId);
      expect(deleteResult.deletedTransaction.tokenId).toBe('test_delete_token');
      expect(deleteResult.updatedScore).toBeDefined();
    });

    it('should allow re-scanning token after deletion', async () => {
      // Setup: Create session and submit transaction
      const session = await sessionService.createSession({
        name: 'Re-scan Test Session',
        teams: ['Team Alpha']
      });

      const Token = require('../../../src/models/token');
      const testToken = new Token({
        id: 'test_rescan_token',
        name: 'Re-scan Test Token',
        value: 200,
        memoryType: 'Personal',
        mediaAssets: {
          image: null,
          audio: null,
          video: null,
          processingImage: null
        },
        metadata: {
          rating: 2
        }
      });

      // Initialize token in transactionService
      transactionService.tokens.set('test_rescan_token', testToken);

      const scanRequest = {
        tokenId: 'test_rescan_token',
        teamId: 'Team Alpha',
        deviceId: 'GM_RESCAN_TEST',
        deviceType: 'gm',
        mode: 'detective',
        timestamp: new Date().toISOString()
      };

      // First scan
      const firstScan = await transactionService.processScan(scanRequest, session, testToken);
      expect(firstScan.transaction.status).toBe('accepted');

      const transactionId = firstScan.transaction.id;

      // Attempt second scan (should be duplicate)
      const duplicateScan = await transactionService.processScan(scanRequest, session, testToken);
      expect(duplicateScan.transaction.status).toBe('duplicate');

      // Delete the transaction
      transactionService.deleteTransaction(transactionId, session);

      // Attempt third scan (should be accepted now)
      const rescan = await transactionService.processScan(scanRequest, session, testToken);
      expect(rescan.transaction.status).toBe('accepted');
      expect(rescan.transaction.id).not.toBe(transactionId); // New transaction ID
    });

    it('should recalculate team scores after deletion', async () => {
      // Setup: Create session with multiple transactions
      const session = await sessionService.createSession({
        name: 'Score Recalc Test Session',
        teams: ['Team Alpha']
      });

      const Token = require('../../../src/models/token');
      const token1 = new Token({
        id: 'token_recalc_1',
        name: 'Token 1',
        value: 300,
        memoryType: 'Technical',
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 }
      });

      const token2 = new Token({
        id: 'token_recalc_2',
        name: 'Token 2',
        value: 500,
        memoryType: 'Business',
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 5 }
      });

      // Initialize tokens in transactionService
      transactionService.tokens.set('token_recalc_1', token1);
      transactionService.tokens.set('token_recalc_2', token2);

      // Submit two transactions
      const scan1 = await transactionService.processScan({
        tokenId: 'token_recalc_1',
        teamId: 'Team Alpha',
        deviceId: 'GM_RECALC_TEST',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      }, session, token1);

      const scan2 = await transactionService.processScan({
        tokenId: 'token_recalc_2',
        teamId: 'Team Alpha',
        deviceId: 'GM_RECALC_TEST',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      }, session, token2);

      // Get initial score (should be sum of both tokens)
      const initialScore = transactionService.teamScores.get('Team Alpha').currentScore;

      // Delete first transaction
      const deleteResult = transactionService.deleteTransaction(scan1.transaction.id, session);

      // Verify score recalculated (should only include token2 now)
      const newScore = transactionService.teamScores.get('Team Alpha').currentScore;
      expect(newScore).toBeLessThan(initialScore);
      expect(deleteResult.updatedScore.currentScore).toBe(newScore);
    });
  });
});
