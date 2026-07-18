/**
 * TransactionService Unit Tests
 * Tests UNWRAPPED domain event emission from transactionService
 * NOTE: This is Layer 1 (service logic) - validates unwrapped events, NOT WebSocket structure
 */

const fs = require('fs');
const path = require('path');
const transactionService = require('../../../src/services/transactionService');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');

// session.scores is the single canonical score store (Phase 2 collapse).
// Helper reads the live TeamScore instance for a team from the current session.
const getScore = (teamId) =>
  sessionService.getCurrentSession()?.scores.find(s => s.teamId === teamId);

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

  describe('score:adjusted event (admin changes)', () => {
    it('should emit score:adjusted when admin adjusts team score', async () => {
      // Setup: Create session and initialize transaction service
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

      // Listen for score:adjusted event (emitted by adjustTeamScore for admin changes)
      const eventPromise = new Promise((resolve) => {
        transactionService.once('score:adjusted', (payload) => {
          // Validate payload structure
          expect(payload).toHaveProperty('teamScore');
          expect(payload).toHaveProperty('reason');
          expect(payload).toHaveProperty('isAdminAction', true);

          // Validate teamScore structure
          const { teamScore } = payload;
          expect(teamScore).toHaveProperty('teamId', 'Team Alpha');
          expect(teamScore).toHaveProperty('currentScore');
          expect(teamScore).toHaveProperty('baseScore');
          expect(teamScore).toHaveProperty('bonusPoints');
          expect(teamScore).toHaveProperty('tokensScanned');
          expect(teamScore).toHaveProperty('completedGroups');
          expect(teamScore).toHaveProperty('lastUpdate');

          resolve(payload);
        });
      });

      // Trigger: Admin adjusts team score (should emit score:adjusted)
      transactionService.adjustTeamScore('Team Alpha', 500, 'manual adjustment', 'gm-station-1');

      // Wait for event
      await eventPromise;
    });

    it('should write scores directly into session.scores (single canonical store)', async () => {
      // Setup
      await sessionService.createSession({
        name: 'Test Session',
        teams: [] // No teams initially
      });
      await sessionService.startGame();

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
      transactionService.updateTeamScore('Detectives', testToken);

      // Verify: the write landed in session.scores — there is no second
      // store kept in sync by listeners (Phase 2 dual-ownership collapse)
      const session = sessionService.getCurrentSession();
      const teamInSessionScores = session.scores.find(s => s.teamId === 'Detectives');

      expect(teamInSessionScores).toBeDefined();
      expect(teamInSessionScores.currentScore).toBe(100);
    });
  });

  describe('transaction:accepted event (Slice 3)', () => {
    it('should emit transaction:accepted with full payload from processScan', async () => {
      // Setup: Create session with team
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

      const Token = require('../../../src/models/token');
      const testToken = new Token({
        id: 'test123',
        name: 'Test Token',
        value: 100,
        memoryType: 'Technical',
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 },
      });

      transactionService.tokens.set('test123', testToken);

      // Listen for transaction:accepted event
      const eventPromise = new Promise((resolve) => {
        transactionService.once('transaction:accepted', (payload) => {
          // Validate payload structure per Slice 3 architecture
          expect(payload).toHaveProperty('transaction');
          expect(payload).toHaveProperty('teamScore');
          expect(payload).toHaveProperty('deviceTracking');

          // Validate transaction structure
          expect(payload.transaction).toHaveProperty('tokenId', 'test123');
          expect(payload.transaction).toHaveProperty('teamId', 'Team Alpha');
          expect(payload.transaction).toHaveProperty('status', 'accepted');

          // Validate teamScore structure (should be serialized)
          expect(payload.teamScore).toHaveProperty('teamId', 'Team Alpha');
          expect(payload.teamScore).toHaveProperty('currentScore');
          expect(payload.teamScore).toHaveProperty('tokensScanned');

          // Validate deviceTracking
          expect(payload.deviceTracking).toHaveProperty('deviceId');
          expect(payload.deviceTracking).toHaveProperty('tokenId', 'test123');

          resolve(payload);
        });
      });

      // Trigger: processScan should emit transaction:accepted
      await transactionService.processScan({
        tokenId: 'test123',
        teamId: 'Team Alpha',
        deviceId: 'test-device',
        deviceType: 'gm',
        mode: 'blackmarket'
      }, sessionService.getCurrentSession());

      await eventPromise;
    });
  });

  describe('service imports (Phase 1.1.6)', () => {
    it('should use top-level sessionService import in isGroupComplete()', async () => {
      // Setup session with tokens
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

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
      await sessionService.startGame();

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
      await sessionService.startGame();

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
      await sessionService.startGame();

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
      await sessionService.startGame();

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
      await sessionService.startGame();

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
      await sessionService.startGame();

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
      await sessionService.startGame();

      const scores = transactionService.getTeamScores();
      expect(scores).toHaveLength(3);
      expect(scores.map(s => s.teamId)).toEqual(
        expect.arrayContaining(['Team Alpha', 'Detectives', 'Blue Squad'])
      );
    });

    it('should clear teams when session ends (teams exist only within session)', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha', 'Detectives']
      });
      await sessionService.startGame();

      expect(transactionService.getTeamScores()).toHaveLength(2);

      // Add some points
      getScore('Team Alpha').addPoints(500);

      await sessionService.endSession();

      // ARCHITECTURE: Teams exist only within a session — scores live in
      // session.scores, so no session means no teams
      expect(transactionService.getTeamScores()).toHaveLength(0);
    });

    it('should get all team scores', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha', 'Detectives']
      });
      await sessionService.startGame();

      await new Promise(resolve => setTimeout(resolve, 10));

      const scores = transactionService.getTeamScores();
      expect(Array.isArray(scores)).toBe(true);
      expect(scores.length).toBe(2);
    });

    it('should reset scores to zero manually (preserving team membership)', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

      expect(transactionService.getTeamScores()).toHaveLength(1);

      // Add some points to verify they get reset
      const teamAlpha = getScore('Team Alpha');
      teamAlpha.addPoints(500);
      expect(teamAlpha.currentScore).toBe(500);

      transactionService.resetScores();

      // Per AsyncAPI contract: teams should still exist after reset with zero scores
      expect(transactionService.getTeamScores()).toHaveLength(1);
      expect(getScore('Team Alpha').currentScore).toBe(0);
    });
  });

  describe('Group Completion Logic', () => {
    it('should detect incomplete group', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

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
      await sessionService.startGame();

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
      const isComplete = transactionService.isGroupComplete('Team Alpha', 'alpha-group');
      expect(isComplete).toBe(true);
    });

    it('should return false for single-token groups', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

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
      const isComplete = transactionService.isGroupComplete('Team Alpha', 'solo-group');
      expect(isComplete).toBe(false);
    });

    it('should return false for null groupId', () => {
      const isComplete = transactionService.isGroupComplete('Team Alpha', null);
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

      // (the dead calculateGroupBonus adapter was deleted — review finding;
      // the pure rule is the surface production actually uses)
      const scoringRules = require('../../../src/gameRules/scoring');
      const multiplier = scoringRules.groupMultiplier(transactionService.tokens, 'bonus-group');
      expect(multiplier).toBe(3);
    });

    it('should return 0 for null groupId bonus', () => {
      const scoringRules = require('../../../src/gameRules/scoring');
      const multiplier = scoringRules.groupMultiplier(transactionService.tokens, null);
      expect(multiplier).toBe(0);
    });

    it('should return 0 for non-existent group', () => {
      const scoringRules = require('../../../src/gameRules/scoring');
      const multiplier = scoringRules.groupMultiplier(transactionService.tokens, 'nonexistent-group');
      expect(multiplier).toBe(0);
    });
  });

  describe('Group Completion — blackmarket-only (F-SCAN-06, decision A1)', () => {
    // Uses the shared 2-token group fixture (MARCUS_SUCKS, x2) so the test
    // mirrors real token data. E2E flow 07c still self-skips against
    // production tokens.json (its only group has 1 token) — fixing that
    // requires an ALN-TokenData change, out of scope here.
    const fixtures = require('../../fixtures/test-tokens');
    const Token = require('../../../src/models/token');

    const wait = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));

    let groupTokens, groupName, multiplier, expectedBonus;

    beforeEach(async () => {
      await sessionService.createSession({
        name: 'Group Parity Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

      ({ groupName, multiplier } = fixtures.MARCUS_SUCKS);
      groupTokens = fixtures.MARCUS_SUCKS.tokens.map(t => new Token(t));
      groupTokens.forEach(t => transactionService.tokens.set(t.id, t));
      expectedBonus = (multiplier - 1) * groupTokens.reduce((sum, t) => sum + t.value, 0);
    });

    const scan = (tokenId, mode) => transactionService.processScan({
      tokenId,
      teamId: 'Team Alpha',
      deviceId: 'GM_GRP',
      deviceType: 'gm',
      mode,
      timestamp: new Date().toISOString()
    });

    it('does NOT complete a group when a member token was processed as detective', async () => {
      // Detective first, blackmarket last — the order that (pre-fix) paid
      // the full bonus on the backend while standalone paid nothing
      await scan(groupTokens[0].id, 'detective');
      const result = await scan(groupTokens[1].id, 'blackmarket');
      await wait();

      expect(result.status).toBe('accepted');
      const teamScore = getScore('Team Alpha');
      // Only the sold token's value — no group bonus
      expect(teamScore.currentScore).toBe(groupTokens[1].value);
      expect(teamScore.bonusPoints).toBe(0);
      expect(teamScore.completedGroups).not.toContain(groupName);
    });

    it('completes the group and pays the bonus when ALL members are blackmarket', async () => {
      await scan(groupTokens[0].id, 'blackmarket');
      const result = await scan(groupTokens[1].id, 'blackmarket');
      await wait();

      expect(result.status).toBe('accepted');
      const teamScore = getScore('Team Alpha');
      const baseSum = groupTokens.reduce((sum, t) => sum + t.value, 0);
      expect(teamScore.completedGroups).toContain(groupName);
      expect(teamScore.bonusPoints).toBe(expectedBonus);
      expect(teamScore.currentScore).toBe(baseSum + expectedBonus);
    });

    it('live path agrees with the rebuild path for detective-member groups', async () => {
      await scan(groupTokens[0].id, 'detective');
      await scan(groupTokens[1].id, 'blackmarket');
      await wait();

      const liveScore = getScore('Team Alpha').currentScore;

      // Rebuild from the same history (what transaction:delete does)
      const session = sessionService.getCurrentSession();
      transactionService.rebuildScoresFromTransactions(session.transactions);
      const rebuiltScore = getScore('Team Alpha').currentScore;

      expect(rebuiltScore).toBe(liveScore);
    });
  });

  describe('Group Completion — scored-only bonus base + event-only groups (§2f, A3 slice 2)', () => {
    // The flavor-ii retirement executed: a none∧counting mode is legal,
    // its claims build group progress, and the completion bonus sums only
    // SCORED contributions (catalog values of members claimed in a
    // standard-scoring mode). Parity: the scanner's LocalStorage path has
    // always summed recorded points, where unscored claims contribute 0.
    const os = require('os');
    const Token = require('../../../src/models/token');
    const packService = require('../../../src/services/packService');

    const wait = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));
    let tmpPack, savedPackPath;

    beforeEach(async () => {
      savedPackPath = process.env.PACK_PATH;
      tmpPack = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-2f-'));
      fs.writeFileSync(path.join(tmpPack, 'game.json'), JSON.stringify({
        kind: 'game', schemaVersion: 2, id: 'event-pack',
        modes: [
          { id: 'fence', label: 'Fence', scoringPolicy: 'standard', entityRole: 'ledger', countsTowardGroups: true, displayBehavior: { surface: 'scoreboard-rankings' } },
          { id: 'stash', label: 'Stash', scoringPolicy: 'none', entityRole: 'ledger', countsTowardGroups: true, displayBehavior: { surface: 'none' } },
          { id: 'quickcash', label: 'Quick Cash', scoringPolicy: 'standard', entityRole: 'ledger', countsTowardGroups: false, displayBehavior: { surface: 'scoreboard-rankings' } },
        ],
      }));
      packService._resetForTesting();
      process.env.PACK_PATH = tmpPack;

      await sessionService.createSession({ name: 'Event Groups', teams: ['Crew'] });
      await sessionService.startGame();

      for (const id of ['setA', 'setB']) {
        transactionService.tokens.set(id, new Token({
          id, name: id, value: 100, memoryType: 'Technical',
          groupId: 'heist-set', groupMultiplier: 2,
          mediaAssets: { image: null, audio: null, video: null, processingImage: null },
          metadata: { rating: 3 },
        }));
      }
    });

    afterEach(() => {
      if (savedPackPath === undefined) delete process.env.PACK_PATH;
      else process.env.PACK_PATH = savedPackPath;
      packService._resetForTesting();
      fs.rmSync(tmpPack, { recursive: true, force: true });
    });

    const scan = (tokenId, mode) => transactionService.processScan({
      tokenId,
      teamId: 'Crew',
      deviceId: 'GM_EVT',
      deviceType: 'gm',
      mode,
      timestamp: new Date().toISOString()
    });

    it('an unscored counting claim COMPLETES the group live; bonus = scored contributions only', async () => {
      const completions = [];
      transactionService.on('group:completed', (info) => completions.push(info));

      await scan('setA', 'fence');   // scored: 100
      const result = await scan('setB', 'stash'); // presence only
      await wait();

      expect(result.status).toBe('accepted');
      expect(result.points).toBe(0);

      const teamScore = getScore('Crew');
      expect(teamScore.completedGroups).toContain('heist-set');
      expect(teamScore.baseScore).toBe(100);
      expect(teamScore.bonusPoints).toBe(100); // (2-1) × 100 scored, NOT × 200 catalog
      expect(teamScore.currentScore).toBe(200);
      expect(teamScore.tokensScanned).toBe(1); // unscored claims are not "scanned" for scoring stats

      expect(completions).toHaveLength(1);
      expect(completions[0]).toEqual(expect.objectContaining({
        teamId: 'Crew', groupId: 'heist-set', bonus: 100, multiplier: 2,
      }));
    });

    it('an all-unscored completion fires group:completed with a $0 bonus (the event IS the point)', async () => {
      const completions = [];
      transactionService.on('group:completed', (info) => completions.push(info));

      await scan('setA', 'stash');
      await scan('setB', 'stash');
      await wait();

      const teamScore = getScore('Crew');
      expect(teamScore.completedGroups).toContain('heist-set');
      expect(teamScore.currentScore).toBe(0);
      expect(completions).toHaveLength(1);
      expect(completions[0].bonus).toBe(0);
    });

    it('live path agrees with the rebuild path for mixed scored/unscored groups', async () => {
      await scan('setA', 'fence');
      await scan('setB', 'stash');
      await wait();

      const liveScore = getScore('Crew').currentScore;
      const session = sessionService.getCurrentSession();
      transactionService.rebuildScoresFromTransactions(session.transactions);
      const rebuilt = getScore('Crew');

      expect(rebuilt.currentScore).toBe(liveScore);
      expect(rebuilt.completedGroups).toContain('heist-set');
    });

    it('a standard∧NON-counting claim never completes a group (review finding: live/rebuild parity)', async () => {
      // quickcash scores money but builds no group progress. Pre-fix, the
      // live path's unconditional currentTokenId injection completed the
      // group here while the rebuild (which honors countsTowardGroups)
      // un-completed it on the next transaction:delete.
      const completions = [];
      transactionService.on('group:completed', (info) => completions.push(info));

      await scan('setA', 'fence');       // counting, scored: 100
      await scan('setB', 'quickcash');   // scored, NON-counting: 100, no progress
      await wait();

      const teamScore = getScore('Crew');
      expect(teamScore.baseScore).toBe(200);
      expect(teamScore.completedGroups).not.toContain('heist-set');
      expect(teamScore.bonusPoints).toBe(0);
      expect(completions).toHaveLength(0);

      // and the rebuild agrees exactly
      const session = sessionService.getCurrentSession();
      transactionService.rebuildScoresFromTransactions(session.transactions);
      const rebuilt = getScore('Crew');
      expect(rebuilt.completedGroups).not.toContain('heist-set');
      expect(rebuilt.currentScore).toBe(200);
    });

    it('an event-only completion for an UNREGISTERED team auto-creates the score row and still fires (review finding)', async () => {
      // Pre-fix, the unscored branch guarded with `if (teamScore)` and
      // silently dropped the completion — the cue engine missed the event
      // that IS the payload for event-only groups.
      const completions = [];
      transactionService.on('group:completed', (info) => completions.push(info));

      const ghostScan = (tokenId) => transactionService.processScan({
        tokenId, teamId: 'Ghost Crew', deviceId: 'GM_EVT', deviceType: 'gm',
        mode: 'stash', timestamp: new Date().toISOString()
      });
      await ghostScan('setA');
      await ghostScan('setB');
      await wait();

      const teamScore = getScore('Ghost Crew');
      expect(teamScore).toBeDefined(); // auto-created
      expect(teamScore.completedGroups).toContain('heist-set');
      expect(completions).toHaveLength(1);
      expect(completions[0]).toEqual(expect.objectContaining({
        teamId: 'Ghost Crew', groupId: 'heist-set', bonus: 0,
      }));
    });
  });

  describe('Recent Transactions', () => {
    it('should track recent transactions', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

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
      await sessionService.startGame();

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
      await sessionService.startGame();

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
      await sessionService.startGame();

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
      const teamScore = getScore('Team Alpha');
      expect(teamScore).toBeDefined();
      expect(teamScore.tokensScanned).toBe(1);
    });

    it('should skip detective mode transactions when rebuilding', async () => {
      // Create session without initializing teams (empty teams array)
      await sessionService.createSession({
        name: 'Test Session',
        teams: []
      });
      await sessionService.startGame();

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
      const teamScore = getScore('Team Alpha');
      expect(teamScore).not.toBeDefined();
    });
  });

  describe('Session Metadata Tracking (F-BCORE-01)', () => {
    it('should update totalScans and uniqueTokensScanned exactly once per accepted GM scan via processScan', async () => {
      await sessionService.createSession({
        name: 'Metadata Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

      const Token = require('../../../src/models/token');
      const makeToken = (id) => new Token({
        id,
        name: `Token ${id}`,
        value: 100,
        memoryType: 'Technical',
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 }
      });
      transactionService.tokens.set('meta001', makeToken('meta001'));
      transactionService.tokens.set('meta002', makeToken('meta002'));

      const session = sessionService.getCurrentSession();

      await transactionService.processScan({
        tokenId: 'meta001',
        teamId: 'Team Alpha',
        deviceId: 'GM_META',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      });

      // Let the async sessionService persistence listener run — its
      // idempotent addTransaction() must NOT double-count the metadata
      await new Promise(resolve => setTimeout(resolve, 25));

      expect(session.metadata.totalScans).toBe(1);
      expect(session.metadata.uniqueTokensScanned).toEqual(['meta001']);

      await transactionService.processScan({
        tokenId: 'meta002',
        teamId: 'Team Alpha',
        deviceId: 'GM_META',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      });

      await new Promise(resolve => setTimeout(resolve, 25));

      expect(session.metadata.totalScans).toBe(2);
      expect(session.metadata.uniqueTokensScanned).toEqual(['meta001', 'meta002']);
    });

    it('should not count rejected or duplicate scans in metadata', async () => {
      await sessionService.createSession({
        name: 'Metadata Session 2',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

      const Token = require('../../../src/models/token');
      transactionService.tokens.set('meta003', new Token({
        id: 'meta003',
        name: 'Token meta003',
        value: 100,
        memoryType: 'Technical',
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 }
      }));

      const session = sessionService.getCurrentSession();
      const scanRequest = {
        tokenId: 'meta003',
        teamId: 'Team Alpha',
        deviceId: 'GM_META',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      };

      await transactionService.processScan(scanRequest);
      // Duplicate scan (same device, same token) — must not increment
      await transactionService.processScan(scanRequest);
      // Invalid token — must not increment
      await transactionService.processScan({ ...scanRequest, tokenId: 'nonexistent' });

      await new Promise(resolve => setTimeout(resolve, 25));

      expect(session.metadata.totalScans).toBe(1);
      expect(session.metadata.uniqueTokensScanned).toEqual(['meta003']);
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
      await sessionService.startGame();

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
      await sessionService.startGame();
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
    // NOTE (Phase 2 collapse): the old syncTeamFromSession/restoreFromSession
    // describes were deleted with those methods — session.scores is the single
    // canonical store now, so there is nothing to sync. The canonical-store
    // contract is pinned in tests/unit/services/score-ownership.test.js.

    it('should emit scores:reset event with teamsReset array', async () => {
      await sessionService.createSession({
        name: 'Reset Event Session',
        teams: ['Team Alpha', 'Detectives']
      });
      await sessionService.startGame();

      getScore('Team Alpha').addPoints(500);
      getScore('Detectives').addPoints(300);

      // Listen for event using Promise pattern
      const eventPromise = new Promise((resolve) => {
        transactionService.once('scores:reset', resolve);
      });

      // Execute
      transactionService.resetScores();

      // Verify
      const eventData = await eventPromise;
      expect(eventData.teamsReset).toEqual(expect.arrayContaining(['Team Alpha', 'Detectives']));
      expect(eventData.teamsReset.length).toBe(2);
    });

    it('should reset scores to zero while preserving team membership', async () => {
      await sessionService.createSession({
        name: 'Reset Membership Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

      getScore('Team Alpha').addPoints(500);

      expect(transactionService.getTeamScores()).toHaveLength(1);
      expect(getScore('Team Alpha').currentScore).toBe(500);

      // Execute
      transactionService.resetScores();

      // Verify: Team still exists but score is zero
      expect(transactionService.getTeamScores()).toHaveLength(1);
      expect(getScore('Team Alpha').currentScore).toBe(0);
    });
  });

  describe('deleteTransaction', () => {
    it('should remove transaction from duplicate registry', async () => {
      // Setup: Create session and submit transaction
      const session = await sessionService.createSession({
        name: 'Delete Test Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

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
      await sessionService.startGame();

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

    it('should preserve ALL teams\' admin adjustments and keep session.scores in sync on delete (F-BCORE-03)', async () => {
      const session = await sessionService.createSession({
        name: 'Adjustment Preservation Session',
        teams: ['Team Alpha', 'Team Beta']
      });
      await sessionService.startGame();

      const Token = require('../../../src/models/token');
      const makeToken = (id, value) => new Token({
        id,
        name: `Token ${id}`,
        value,
        memoryType: 'Technical',
        mediaAssets: { image: null, audio: null, video: null, processingImage: null },
        metadata: { rating: 3 }
      });
      transactionService.tokens.set('adj001', makeToken('adj001', 300000));
      transactionService.tokens.set('adj002', makeToken('adj002', 75000));

      const wait = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));

      // Team Alpha scans + receives an admin adjustment
      await transactionService.processScan({
        tokenId: 'adj001',
        teamId: 'Team Alpha',
        deviceId: 'GM_ADJ',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      });
      // Team Beta scans
      const betaScan = await transactionService.processScan({
        tokenId: 'adj002',
        teamId: 'Team Beta',
        deviceId: 'GM_ADJ',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      });
      await wait();

      transactionService.adjustTeamScore('Team Alpha', 123456, 'test bonus', 'GM_ADJ');
      await wait();

      expect(getScore('Team Alpha').currentScore).toBe(423456);
      expect(getScore('Team Alpha').adminAdjustments).toHaveLength(1);

      // Delete TEAM BETA's transaction — must not touch Team Alpha's adjustment
      const eventPromise = new Promise((resolve) => {
        transactionService.once('transaction:deleted', resolve);
      });
      transactionService.deleteTransaction(betaScan.transaction.id, session);
      const deletedEvent = await eventPromise;
      await wait();

      // Team Alpha keeps its adjustment (score AND audit trail)
      const alpha = getScore('Team Alpha');
      expect(alpha.currentScore).toBe(423456);
      expect(alpha.adminAdjustments).toHaveLength(1);
      expect(alpha.adminAdjustments[0].delta).toBe(123456);

      // Team Beta rebuilt to zero (its only transaction was deleted)
      expect(getScore('Team Beta').currentScore).toBe(0);

      // The broadcast snapshot must cover EVERY rebuilt team and match the
      // canonical store (session.scores) — pre-collapse, only the affected
      // team was synced, leaving the rest split-brained (F-BCORE-03)
      expect(deletedEvent.allTeamScores).toHaveLength(session.scores.length);
      for (const snapshot of deletedEvent.allTeamScores) {
        const sessionScore = session.scores.find(s => s.teamId === snapshot.teamId);
        expect(sessionScore).toBeDefined();
        expect(snapshot.currentScore).toBe(sessionScore.currentScore);
        expect(snapshot.baseScore).toBe(sessionScore.baseScore);
        expect(snapshot.adminAdjustments).toEqual(sessionScore.adminAdjustments);
      }
    });

    it('should recalculate team scores after deletion', async () => {
      // Setup: Create session with multiple transactions
      const session = await sessionService.createSession({
        name: 'Score Recalc Test Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

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
      const initialScore = getScore('Team Alpha').currentScore;

      // Delete first transaction
      const deleteResult = transactionService.deleteTransaction(scan1.transaction.id, session);

      // Verify score recalculated (should only include token2 now)
      const newScore = getScore('Team Alpha').currentScore;
      expect(newScore).toBeLessThan(initialScore);
      expect(deleteResult.updatedScore.currentScore).toBe(newScore);
    });
  });
});
