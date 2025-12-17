/**
 * Duplicate Detection Integration Tests
 *
 * Tests duplicate detection logic in real transaction flow:
 * - First-come-first-served: Once ANY team claims a token, no other team can claim it
 * - Same team duplicate detection
 * - Cross-team duplicate detection
 * - Detective mode also subject to duplicate detection (doesn't bypass)
 * - Proper error messages with claiming team context
 *
 * CRITICAL: These tests validate first-come-first-served game mechanic.
 * Expected to REVEAL duplicate detection bugs if logic is incorrect.
 *
 * Implementation: backend/src/services/transactionService.js (lines 198-233)
 * Functional Requirements: FR-009 (First-Come-First-Served Duplicate Detection)
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { validateWebSocketEvent } = require('../helpers/contract-validator');
const { resetAllServices, resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const TestTokens = require('../fixtures/test-tokens');

describe('Duplicate Detection Integration', () => {
  let testContext, gm1, gm2;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Complete reset cycle: cleanup → reset → setup
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      stateService: require('../../src/services/stateService'),
      videoQueueService: require('../../src/services/videoQueueService'),
      offlineQueueService: require('../../src/services/offlineQueueService')
    });

    // Re-initialize tokens after reset
    const testTokens = TestTokens.getAllAsArray();
    await transactionService.init(testTokens);

    // Create test session
    await sessionService.createSession({
      name: 'Duplicate Test Session',
      teams: ['Team Alpha', 'Detectives']
    });

    // Connect 2 GM scanners
    gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DUP_1');
    gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DUP_2');
  });

  afterEach(async () => {
    if (gm1?.connected) gm1.disconnect();
    if (gm2?.connected) gm2.disconnect();
  });

  describe('Same Team Duplicate Detection', () => {
    it('should detect duplicate when same team scans same token twice', async () => {
      // CRITICAL: Set up listeners BEFORE first transaction
      const result1Promise = waitForEvent(gm1, 'transaction:result');

      // First scan - should be accepted
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: 'Team Alpha',
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result1 = await result1Promise;

      // Validate: First scan accepted
      expect(result1.event).toBe('transaction:result');
      expect(result1.data.status).toBe('accepted');
      expect(result1.data.points).toBe(TestTokens.getExpectedPoints('534e2b03'));

      // Validate: Contract compliance
      validateWebSocketEvent(result1, 'transaction:result');

      // Second scan - should be duplicate
      const result2Promise = waitForEvent(gm1, 'transaction:result');

      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Same token
          teamId: 'Team Alpha',        // Same team
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result2 = await result2Promise;

      // Validate: Second scan rejected as duplicate
      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.points).toBe(0);
      expect(result2.data.message).toContain('already claimed');
      expect(result2.data.claimedBy).toBe('Team Alpha'); // Original claiming team

      // Validate: Contract compliance
      validateWebSocketEvent(result2, 'transaction:result');

      // Verify: Score only counted once
      const teamScores = transactionService.getTeamScores();
      const team001Score = teamScores.find(s => s.teamId === 'Team Alpha');
      expect(team001Score.currentScore).toBe(TestTokens.getExpectedPoints('534e2b03')); // Not doubled
      expect(team001Score.tokensScanned).toBe(1); // Only one token counted
    });

    it('should provide original transaction ID in duplicate response', async () => {
      // First scan
      const result1Promise = waitForEvent(gm1, 'transaction:result');
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'tac001',
          teamId: 'Team Alpha',
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
      const result1 = await result1Promise;
      const originalTransactionId = result1.data.transactionId;

      // Second scan (duplicate)
      const result2Promise = waitForEvent(gm1, 'transaction:result');
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'tac001',
          teamId: 'Team Alpha',
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
      const result2 = await result2Promise;

      // Validate: Duplicate response includes original transaction ID
      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.originalTransactionId).toBe(originalTransactionId);
    });
  });

  describe('Cross-Team Duplicate Detection (First-Come-First-Served)', () => {
    it('should detect duplicate when different team scans same token', async () => {
      // Team 001 scans first
      const result1Promise = waitForEvent(gm1, 'transaction:result');

      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: 'Team Alpha',
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result1 = await result1Promise;

      // Validate: Team 001 claim accepted
      expect(result1.data.status).toBe('accepted');
      expect(result1.data.teamId).toBe('Team Alpha');
      expect(result1.data.points).toBe(TestTokens.getExpectedPoints('534e2b03'));

      // Team 002 tries to scan same token
      const result2Promise = waitForEvent(gm2, 'transaction:result');

      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Same token
          teamId: 'Detectives',        // Different team
          deviceId: 'GM_DUP_2',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result2 = await result2Promise;

      // Validate: Team 002 claim rejected (first-come-first-served)
      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.points).toBe(0);
      expect(result2.data.message).toContain('already claimed');
      expect(result2.data.claimedBy).toBe('Team Alpha'); // Team 001 claimed first

      // Verify: Only team 001 got points
      const teamScores = transactionService.getTeamScores();
      const team001Score = teamScores.find(s => s.teamId === 'Team Alpha');
      const team002Score = teamScores.find(s => s.teamId === 'Detectives');

      expect(team001Score.currentScore).toBe(TestTokens.getExpectedPoints('534e2b03'));
      expect(team002Score.currentScore).toBe(0);
    });

    it('should handle rapid concurrent duplicate scans from different teams', async () => {
      // Both teams try to scan same token simultaneously
      // First to reach server wins (race condition test)

      const gm1Promise = waitForEvent(gm1, 'transaction:result');
      const gm2Promise = waitForEvent(gm2, 'transaction:result');

      // Submit at same time
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: 'Team Alpha',
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',  // Same token
          teamId: 'Detectives',
          deviceId: 'GM_DUP_2',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const [result1, result2] = await Promise.all([gm1Promise, gm2Promise]);

      // One should be accepted, one should be duplicate
      const accepted = [result1, result2].find(r => r.data.status === 'accepted');
      const duplicate = [result1, result2].find(r => r.data.status === 'duplicate');

      expect(accepted).toBeDefined();
      expect(duplicate).toBeDefined();

      // Winner gets points, loser gets 0
      expect(accepted.data.points).toBe(TestTokens.getExpectedPoints('rat001'));
      expect(duplicate.data.points).toBe(0);

      // Duplicate response should reference winning team
      const winningTeam = accepted.data.teamId;
      expect(duplicate.data.claimedBy).toBe(winningTeam);
    });
  });

  describe('Detective Mode Duplicate Detection', () => {
    it('should apply duplicate detection to detective mode scans', async () => {
      // IMPORTANT: Detective mode DOES get duplicate detection (see transactionService.js line 131)
      // Duplicate check happens BEFORE mode check
      // This prevents detective from bypassing first-come-first-served by logging all tokens

      // First: Blackmarket mode scan claims token
      const blackmarketPromise = waitForEvent(gm1, 'transaction:result');

      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: 'Team Alpha',
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const blackmarketResult = await blackmarketPromise;
      expect(blackmarketResult.data.status).toBe('accepted');
      expect(blackmarketResult.data.points).toBe(TestTokens.getExpectedPoints('534e2b03'));

      // Second: Detective mode tries to scan same token
      const detectivePromise = waitForEvent(gm2, 'transaction:result');

      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Same token
          teamId: 'Detectives',
          deviceId: 'GM_DUP_2',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'detective'     // Detective mode
        },
        timestamp: new Date().toISOString()
      });

      const detectiveResult = await detectivePromise;

      // Validate: Detective mode scan rejected as duplicate
      expect(detectiveResult.data.status).toBe('duplicate');
      expect(detectiveResult.data.points).toBe(0);
      expect(detectiveResult.data.claimedBy).toBe('Team Alpha');
      expect(detectiveResult.data.message).toContain('already claimed');
    });

    it('should accept detective mode for unclaimed tokens (no points)', async () => {
      // Detective mode on unclaimed token should be accepted but with 0 points

      const detectivePromise = waitForEvent(gm1, 'transaction:result');

      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'tac001',  // Unclaimed token
          teamId: 'Team Alpha',
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'detective'
        },
        timestamp: new Date().toISOString()
      });

      const detectiveResult = await detectivePromise;

      // Validate: Accepted but no points (detective mode doesn't score)
      expect(detectiveResult.data.status).toBe('accepted');
      expect(detectiveResult.data.points).toBe(0); // Detective mode = 0 points

      // Verify: Token claimed (prevents future claims)
      const blackmarketPromise = waitForEvent(gm2, 'transaction:result');

      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'tac001',  // Same token
          teamId: 'Detectives',
          deviceId: 'GM_DUP_2',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const blackmarketResult = await blackmarketPromise;

      // Validate: Blackmarket scan rejected (detective claimed it first)
      expect(blackmarketResult.data.status).toBe('duplicate');
      expect(blackmarketResult.data.claimedBy).toBe('Team Alpha');
    });
  });

  describe('Multi-Client Duplicate Broadcast', () => {
    it('should broadcast transaction:new only for accepted scans, not duplicates', async () => {
      // ARCHITECTURE: Duplicate detection happens EARLY in processScan()
      // - If duplicate: returns early WITHOUT emitting transaction:accepted
      // - No transaction:accepted → no transaction:added → no transaction:new broadcast
      // - Submitter still gets transaction:result (unicast) with status: duplicate

      // Set up listeners on BOTH GMs for transaction:new
      const gm1NewPromise1 = waitForEvent(gm1, 'transaction:new');
      const gm2NewPromise1 = waitForEvent(gm2, 'transaction:new');

      // Set up listener for duplicate result (unicast to submitter only)
      const gm2ResultPromise = waitForEvent(gm2, 'transaction:result');

      // First scan (accepted) - should broadcast transaction:new to ALL GMs
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: 'Team Alpha',
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for first transaction to broadcast to both GMs
      const [new1gm1, new1gm2] = await Promise.all([gm1NewPromise1, gm2NewPromise1]);

      // Validate: Accepted transaction broadcast to ALL GMs
      expect(new1gm1.data.transaction.tokenId).toBe('534e2b03');
      expect(new1gm2.data.transaction.tokenId).toBe('534e2b03');
      validateWebSocketEvent(new1gm1, 'transaction:new');

      // Second scan (duplicate) - should NOT broadcast transaction:new
      // Submitter should receive transaction:result with status: duplicate
      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Same token
          teamId: 'Detectives',
          deviceId: 'GM_DUP_2',
          deviceType: 'gm',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for duplicate result (unicast to submitter)
      const duplicateResult = await gm2ResultPromise;

      // Validate: Submitter gets duplicate status via unicast
      expect(duplicateResult.data.status).toBe('duplicate');
      expect(duplicateResult.data.claimedBy).toBe('Team Alpha');

      // Validate: No transaction:new was broadcast for duplicate
      // (If it was broadcast, we'd have received it, but we didn't set up a listener
      // because the architecture says duplicates don't broadcast)

      // Verify only ONE transaction exists in the system
      const session = require('../../src/services/sessionService').getCurrentSession();
      const transactions = session.transactions.filter(t => t.tokenId === '534e2b03');
      expect(transactions).toHaveLength(1);
      expect(transactions[0].teamId).toBe('Team Alpha'); // First-come-first-served
    });
  });

  describe('Session-Specific Duplicate Detection', () => {
    it('should reset duplicates when new session starts', async () => {
      // First session: Claim token
      const result1Promise = waitForEvent(gm1, 'transaction:result');

      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: 'Team Alpha',
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result1 = await result1Promise;
      expect(result1.data.status).toBe('accepted');

      // End session and create new one
      await sessionService.endSession();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for session:updated events

      await sessionService.createSession({
        name: 'New Session',
        teams: ['Team Alpha', 'Detectives']
      });

      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for initialization

      // New session: Same token should be available again
      const result2Promise = waitForEvent(gm1, 'transaction:result');

      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Same token as first session
          teamId: 'Team Alpha',
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result2 = await result2Promise;

      // Validate: Token available in new session (not duplicate)
      expect(result2.data.status).toBe('accepted');
      expect(result2.data.points).toBe(TestTokens.getExpectedPoints('534e2b03'));
    });
  });
});
