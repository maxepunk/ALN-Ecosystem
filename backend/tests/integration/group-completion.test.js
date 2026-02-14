/**
 * Group Completion Integration Tests - SINGLE GM with REAL SCANNER
 *
 * Tests complete group completion flow using REAL GM Scanner:
 * Single team scans all tokens in group → bonus calculated → group:completed broadcast
 *
 * TRANSFORMATION: Phase 3.6d - COMPLETE ✅
 * - All 3 tests use real scanner (single GM, single team 001)
 * - Multi-GM coordination tests moved to multi-gm-coordination.test.js
 *
 * ARCHITECTURAL DECISION:
 * Scanner modules (App, Settings) are singleton objects designed for one-GM-per-browser-tab.
 * In Node.js, module caching prevents multiple independent scanner instances.
 * Therefore: Single-GM integration tests here, multi-GM coordination tests elsewhere.
 *
 * Tests in this file:
 * 1. ✅ "should detect group completion and award bonus"
 * 2. ✅ "should not award bonus for incomplete group"
 * 3. ✅ "should complete group regardless of scan order"
 *
 * Group Details (from ALN-TokenData/tokens.json):
 * - rat001: Business, rating 4, value = 15000 (5000 × 3), group "Marcus Sucks"
 * - asm001: Personal, rating 3, value = 1000 (1000 × 1), group "Marcus Sucks"
 * - Group multiplier: 2 (from "(x2)" suffix)
 * - Expected bonus: (2-1) × (15000 + 1000) = 16000 points
 *
 * Contract: backend/contracts/asyncapi.yaml (group:completed event)
 * Functional Requirements: Section 1.3.6 (Group Completion)
 */

// CRITICAL: Load browser mocks FIRST
require('../helpers/browser-mocks');

const fs = require('fs');
const path = require('path');
const { createAuthenticatedScanner, waitForEvent, waitForMultipleEvents } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { validateWebSocketEvent } = require('../helpers/contract-validator');
const { resetAllServices, resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const TestTokens = require('../fixtures/test-tokens');

describe('Group Completion Integration - REAL Scanner', () => {
  let testContext, gmScanner, rawTokens;

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

    // CRITICAL: Load RAW tokens for scanner (scanner expects raw format from ALN-TokenData)
    const rawTokensPath = path.join(__dirname, '../../../ALN-TokenData/tokens.json');
    rawTokens = JSON.parse(fs.readFileSync(rawTokensPath, 'utf8'));
    global.TokenManager.database = rawTokens;

    // Create test session
    await sessionService.createSession({
      name: 'Group Completion Test',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();

    // Connect REAL GM scanner
    gmScanner = await createAuthenticatedScanner(testContext.url, 'GM_GROUP_TEST', 'blackmarket');
  });

  afterEach(async () => {
    // Use scanner.cleanup() to properly disconnect and clear resources
    if (gmScanner?.cleanup) await gmScanner.cleanup();
    // CRITICAL: Clear DataManager scanned tokens to prevent duplicate detection across tests
    global.DataManager.clearScannedTokens();
    await resetAllServices();
  });

  describe('Complete Group Bonus', () => {
    it('should detect group completion and award bonus', async () => {
      // CRITICAL: Set up ALL listeners BEFORE any transactions to avoid race conditions
      const groupCompletedPromise = waitForEvent(gmScanner.socket, 'group:completed');

      // Scan first token - set up listener before scanning
      const firstScorePromise = waitForEvent(gmScanner.socket, 'score:updated');

      // Set team for scanner
      gmScanner.App.currentTeamId = 'Team Alpha';

      // Use REAL scanner API - scan rat001
      gmScanner.App.processNFCRead({ id: 'rat001' });

      // Wait for first transaction to complete
      await firstScorePromise;

      // Verify: First token scored, NO group completion yet
      let scores = transactionService.getTeamScores();
      let team001Score = scores.find(s => s.teamId === 'Team Alpha');
      const rat001Points = TestTokens.getExpectedPoints('rat001');
      expect(team001Score.currentScore).toBe(rat001Points); // Only base score (rat001)
      expect(team001Score.baseScore).toBe(rat001Points);
      expect(team001Score.bonusPoints).toBe(0); // NO bonus yet
      expect(team001Score.completedGroups).toEqual([]); // Group NOT complete

      // Scan second token in group (asm001 - Personal, rating 3, value 1000)
      // This should COMPLETE the group and award bonus
      // NOTE (Slice 3): New architecture emits ONE score:updated with complete score including bonus
      const scoreUpdatedPromise = waitForEvent(gmScanner.socket, 'score:updated');

      // Use REAL scanner API - scan asm001 (completes group)
      gmScanner.App.processNFCRead({ id: 'asm001' });

      // Wait for group completion events
      const [groupEvent, scoreEvent] = await Promise.all([
        groupCompletedPromise,
        scoreUpdatedPromise
      ]);

      // NOTE (Slice 3): Single event now includes complete score with bonuses

      // Validate: group:completed event structure
      expect(groupEvent.event).toBe('group:completed');
      expect(groupEvent.data.teamId).toBe('Team Alpha');
      expect(groupEvent.data.group).toBe('Marcus Sucks'); // groupId without "(x2)"
      // Group bonus = sum(token values) * (multiplier - 1) per transactionService.js
      const expectedGroupBonus = (TestTokens.getExpectedPoints('rat001') + TestTokens.getExpectedPoints('asm001')) * (TestTokens.MARCUS_SUCKS.multiplier - 1);
      expect(groupEvent.data.bonusPoints).toBe(expectedGroupBonus);
      expect(groupEvent.data.completedAt).toBeDefined();

      // Validate: Contract compliance
      validateWebSocketEvent(groupEvent, 'group:completed');

      // Validate: score:updated includes bonus
      const asm001Points = TestTokens.getExpectedPoints('asm001');
      const expectedBaseScore = rat001Points + asm001Points;
      const expectedTotalScore = expectedBaseScore + expectedGroupBonus;
      expect(scoreEvent.data.teamId).toBe('Team Alpha');
      expect(scoreEvent.data.currentScore).toBe(expectedTotalScore);
      expect(scoreEvent.data.baseScore).toBe(expectedBaseScore);
      expect(scoreEvent.data.bonusPoints).toBe(expectedGroupBonus);
      expect(scoreEvent.data.completedGroups).toContain('Marcus Sucks');

      // Validate: Service state matches broadcasts
      scores = transactionService.getTeamScores();
      team001Score = scores.find(s => s.teamId === 'Team Alpha');
      expect(team001Score.currentScore).toBe(expectedTotalScore);
      expect(team001Score.bonusPoints).toBe(expectedGroupBonus);
      expect(team001Score.completedGroups).toContain('Marcus Sucks');
    });

    it('should not award bonus for incomplete group', async () => {
      // CRITICAL: Set up listeners BEFORE scanning to avoid race condition
      const resultPromise = waitForEvent(gmScanner.socket, 'transaction:result');
      const scorePromise = waitForEvent(gmScanner.socket, 'score:updated');

      // Set team
      gmScanner.App.currentTeamId = 'Team Alpha';

      // Scan only ONE token from the group (rat001) - Use REAL scanner
      gmScanner.App.processNFCRead({ id: 'rat001' });

      await resultPromise;
      await scorePromise;

      // Verify: NO group completion (only 1 of 2 tokens)
      const scores = transactionService.getTeamScores();
      const team001Score = scores.find(s => s.teamId === 'Team Alpha');
      expect(team001Score.currentScore).toBe(TestTokens.getExpectedPoints('rat001')); // Only token value
      expect(team001Score.bonusPoints).toBe(0); // NO bonus
      expect(team001Score.completedGroups).toEqual([]); // NOT complete
    });
  });

  describe('Group Completion Order Independence', () => {
    it('should complete group regardless of scan order', async () => {
      // CRITICAL: Set up ALL listeners BEFORE any transactions
      const groupCompletedPromise = waitForEvent(gmScanner.socket, 'group:completed');
      const result1Promise = waitForEvent(gmScanner.socket, 'transaction:result');
      const score1Promise = waitForEvent(gmScanner.socket, 'score:updated');

      // Set team
      gmScanner.App.currentTeamId = 'Team Alpha';

      // First: asm001 (Personal, rating 3, value 3000) - Use REAL scanner
      gmScanner.App.processNFCRead({ id: 'asm001' });

      await result1Promise;
      await score1Promise;

      // Second: rat001 (completes group) - Use REAL scanner
      gmScanner.App.processNFCRead({ id: 'rat001' });

      const groupEvent = await groupCompletedPromise;

      // Validate: Group completed with same bonus (order doesn't matter)
      expect(groupEvent.data.group).toBe('Marcus Sucks');
      const expectedBonus = (TestTokens.getExpectedPoints('rat001') + TestTokens.getExpectedPoints('asm001')) * (TestTokens.MARCUS_SUCKS.multiplier - 1);
      expect(groupEvent.data.bonusPoints).toBe(expectedBonus);

      // Validate: Final score same as forward order
      const scores = transactionService.getTeamScores();
      const team001Score = scores.find(s => s.teamId === 'Team Alpha');
      const expectedTotal = TestTokens.getExpectedPoints('rat001') + TestTokens.getExpectedPoints('asm001') + expectedBonus;
      expect(team001Score.currentScore).toBe(expectedTotal);
    });
  });
});
