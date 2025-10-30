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
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../src/websocket/broadcasts');
const { resetAllServices } = require('../helpers/service-reset');
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
    // Reset services
    await resetAllServices();
    // CRITICAL: Cleanup old broadcast listeners
    cleanupBroadcastListeners();

    // Re-initialize tokens
    // Use test fixtures instead of production tokens
    const testTokens = TestTokens.getAllAsArray();
    await transactionService.init(testTokens);

    // Re-setup broadcast listeners
    const stateService = require('../../src/services/stateService');
    const videoQueueService = require('../../src/services/videoQueueService');
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
      name: 'Duplicate Test Session',
      teams: ['001', '002']
    });

    // Connect 2 GM scanners
    gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DUP_1');
    gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DUP_2');
  });

  afterEach(async () => {
    if (gm1?.connected) gm1.disconnect();
    if (gm2?.connected) gm2.disconnect();
    await resetAllServices();
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
          teamId: '001',
          deviceId: 'GM_DUP_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result1 = await result1Promise;

      // Validate: First scan accepted
      expect(result1.event).toBe('transaction:result');
      expect(result1.data.status).toBe('accepted');
      expect(result1.data.points).toBe(30); // Test fixture value for 534e2b03

      // Validate: Contract compliance
      validateWebSocketEvent(result1, 'transaction:result');

      // Second scan - should be duplicate
      const result2Promise = waitForEvent(gm1, 'transaction:result');

      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Same token
          teamId: '001',        // Same team
          deviceId: 'GM_DUP_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result2 = await result2Promise;

      // Validate: Second scan rejected as duplicate
      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.points).toBe(0);
      expect(result2.data.message).toContain('already claimed');
      expect(result2.data.claimedBy).toBe('001'); // Original claiming team

      // Validate: Contract compliance
      validateWebSocketEvent(result2, 'transaction:result');

      // Verify: Score only counted once
      const teamScores = transactionService.getTeamScores();
      const team001Score = teamScores.find(s => s.teamId === '001');
      expect(team001Score.currentScore).toBe(30); // Test fixture value for 534e2b03 (not doubled)
      expect(team001Score.tokensScanned).toBe(1); // Only one token counted
    });

    it('should provide original transaction ID in duplicate response', async () => {
      // First scan
      const result1Promise = waitForEvent(gm1, 'transaction:result');
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'tac001',
          teamId: '001',
          deviceId: 'GM_DUP_1',
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
          teamId: '001',
          deviceId: 'GM_DUP_1',
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
          teamId: '001',
          deviceId: 'GM_DUP_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result1 = await result1Promise;

      // Validate: Team 001 claim accepted
      expect(result1.data.status).toBe('accepted');
      expect(result1.data.teamId).toBe('001');
      expect(result1.data.points).toBe(30); // Test fixture value for 534e2b03

      // Team 002 tries to scan same token
      const result2Promise = waitForEvent(gm2, 'transaction:result');

      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Same token
          teamId: '002',        // Different team
          deviceId: 'GM_DUP_2',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result2 = await result2Promise;

      // Validate: Team 002 claim rejected (first-come-first-served)
      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.points).toBe(0);
      expect(result2.data.message).toContain('already claimed');
      expect(result2.data.claimedBy).toBe('001'); // Team 001 claimed first

      // Verify: Only team 001 got points
      const teamScores = transactionService.getTeamScores();
      const team001Score = teamScores.find(s => s.teamId === '001');
      const team002Score = teamScores.find(s => s.teamId === '002');

      expect(team001Score.currentScore).toBe(30); // Test fixture value for 534e2b03
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
          teamId: '001',
          deviceId: 'GM_DUP_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',  // Same token
          teamId: '002',
          deviceId: 'GM_DUP_2',
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
      expect(accepted.data.points).toBe(40); // Test fixture value for rat001
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
          teamId: '001',
          deviceId: 'GM_DUP_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const blackmarketResult = await blackmarketPromise;
      expect(blackmarketResult.data.status).toBe('accepted');
      expect(blackmarketResult.data.points).toBe(30); // Test fixture value for 534e2b03

      // Second: Detective mode tries to scan same token
      const detectivePromise = waitForEvent(gm2, 'transaction:result');

      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Same token
          teamId: '002',
          deviceId: 'GM_DUP_2',
          mode: 'detective'     // Detective mode
        },
        timestamp: new Date().toISOString()
      });

      const detectiveResult = await detectivePromise;

      // Validate: Detective mode scan rejected as duplicate
      expect(detectiveResult.data.status).toBe('duplicate');
      expect(detectiveResult.data.points).toBe(0);
      expect(detectiveResult.data.claimedBy).toBe('001');
      expect(detectiveResult.data.message).toContain('already claimed');
    });

    it('should accept detective mode for unclaimed tokens (no points)', async () => {
      // Detective mode on unclaimed token should be accepted but with 0 points

      const detectivePromise = waitForEvent(gm1, 'transaction:result');

      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'tac001',  // Unclaimed token
          teamId: '001',
          deviceId: 'GM_DUP_1',
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
          teamId: '002',
          deviceId: 'GM_DUP_2',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const blackmarketResult = await blackmarketPromise;

      // Validate: Blackmarket scan rejected (detective claimed it first)
      expect(blackmarketResult.data.status).toBe('duplicate');
      expect(blackmarketResult.data.claimedBy).toBe('001');
    });
  });

  describe('Multi-Client Duplicate Broadcast', () => {
    it('should broadcast transaction:new for both accepted and duplicate scans', async () => {
      // Both accepted and duplicate transactions should broadcast to ALL GMs

      // Set up listeners on BOTH GMs for transaction:new
      const gm1NewPromise1 = waitForEvent(gm1, 'transaction:new');
      const gm2NewPromise1 = waitForEvent(gm2, 'transaction:new');

      // First scan (accepted)
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '001',
          deviceId: 'GM_DUP_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for first transaction to broadcast to both
      const [new1gm1, new1gm2] = await Promise.all([gm1NewPromise1, gm2NewPromise1]);

      expect(new1gm1.data.transaction.status).toBe('accepted');
      expect(new1gm2.data.transaction.status).toBe('accepted');

      // Set up listeners for second transaction
      const gm1NewPromise2 = waitForEvent(gm1, 'transaction:new');
      const gm2NewPromise2 = waitForEvent(gm2, 'transaction:new');

      // Second scan (duplicate)
      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Same token
          teamId: '002',
          deviceId: 'GM_DUP_2',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for duplicate transaction to broadcast to both
      const [new2gm1, new2gm2] = await Promise.all([gm1NewPromise2, gm2NewPromise2]);

      expect(new2gm1.data.transaction.status).toBe('duplicate');
      expect(new2gm2.data.transaction.status).toBe('duplicate');

      // Validate: Contract compliance for both broadcasts
      validateWebSocketEvent(new1gm1, 'transaction:new');
      validateWebSocketEvent(new2gm1, 'transaction:new');
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
          teamId: '001',
          deviceId: 'GM_DUP_1',
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
        teams: ['001', '002']
      });

      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for initialization

      // New session: Same token should be available again
      const result2Promise = waitForEvent(gm1, 'transaction:result');

      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Same token as first session
          teamId: '001',
          deviceId: 'GM_DUP_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result2 = await result2Promise;

      // Validate: Token available in new session (not duplicate)
      expect(result2.data.status).toBe('accepted');
      expect(result2.data.points).toBe(30); // Test fixture value for 534e2b03
    });
  });
});
