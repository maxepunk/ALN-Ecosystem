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
const { createAuthenticatedScanner, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { validateWebSocketEvent } = require('../helpers/contract-validator');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../src/websocket/broadcasts');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Group Completion Integration - REAL Scanner', () => {
  let testContext, gmScanner, rawTokens;

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

    // CRITICAL: Cleanup old broadcast listeners before adding new ones
    cleanupBroadcastListeners();

    // Re-initialize tokens after reset
    const tokenService = require('../../src/services/tokenService');
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // CRITICAL: Load RAW tokens for scanner (scanner expects raw format from ALN-TokenData)
    const rawTokensPath = path.join(__dirname, '../../../ALN-TokenData/tokens.json');
    rawTokens = JSON.parse(fs.readFileSync(rawTokensPath, 'utf8'));
    global.TokenManager.database = rawTokens;

    // Re-setup broadcast listeners
    const stateService = require('../../src/services/stateService');
    const videoQueueService = require('../../src/services/videoQueueService');
    const offlineQueueService = require('../../src/services/offlineQueueService');

    // CRITICAL: Reset videoQueueService to clear all timers (prevents async leaks)
    videoQueueService.reset();

    setupBroadcastListeners(testContext.io, {
      sessionService,
      transactionService,
      stateService,
      videoQueueService,
      offlineQueueService
    });

    // Create test session
    await sessionService.createSession({
      name: 'Group Completion Test',
      teams: ['001', '002']
    });

    // Connect REAL GM scanner
    gmScanner = await createAuthenticatedScanner(testContext.url, 'GM_GROUP_TEST', 'blackmarket');
  });

  afterEach(async () => {
    if (gmScanner?.socket?.connected) gmScanner.socket.disconnect();
    await sessionService.reset();
  });

  describe('Complete Group Bonus', () => {
    it('should detect group completion and award bonus', async () => {
      // CRITICAL: Set up ALL listeners BEFORE any transactions to avoid race conditions
      const groupCompletedPromise = waitForEvent(gmScanner.socket, 'group:completed');

      // Scan first token - set up listener before scanning
      const firstScorePromise = waitForEvent(gmScanner.socket, 'score:updated');

      // Set team for scanner
      gmScanner.App.currentTeamId = '001';

      // Use REAL scanner API - scan rat001
      gmScanner.App.processNFCRead({ id: 'rat001' });

      // Wait for first transaction to complete
      await firstScorePromise;

      // Verify: First token scored, NO group completion yet
      let scores = transactionService.getTeamScores();
      let team001Score = scores.find(s => s.teamId === '001');
      expect(team001Score.currentScore).toBe(15000); // Only base score (rat001)
      expect(team001Score.baseScore).toBe(15000);
      expect(team001Score.bonusPoints).toBe(0); // NO bonus yet
      expect(team001Score.completedGroups).toEqual([]); // Group NOT complete

      // Scan second token in group (asm001 - Personal, rating 3, value 1000)
      // This should COMPLETE the group and award bonus
      // CRITICAL: Group completion emits TWO score:updated events:
      //   1. After adding asm001 points (baseScore = 16000)
      //   2. After adding group bonus (currentScore = 32000)
      // We need to wait for the SECOND one
      let scoreEventCount = 0;
      let finalScoreEvent;
      const scoreUpdatedPromise = new Promise((resolve) => {
        gmScanner.socket.on('score:updated', (event) => {
          scoreEventCount++;
          finalScoreEvent = event;
          if (scoreEventCount === 2) {
            resolve(event);
          }
        });
      });

      // Use REAL scanner API - scan asm001 (completes group)
      gmScanner.App.processNFCRead({ id: 'asm001' });

      // Wait for group completion events
      const [groupEvent, scoreEvent] = await Promise.all([
        groupCompletedPromise,
        scoreUpdatedPromise
      ]);

      // Validate: group:completed event structure
      expect(groupEvent.event).toBe('group:completed');
      expect(groupEvent.data.teamId).toBe('001');
      expect(groupEvent.data.group).toBe('Marcus Sucks'); // groupId without "(x2)"
      expect(groupEvent.data.bonusPoints).toBe(16000); // (2-1) × (15000 + 1000)
      expect(groupEvent.data.completedAt).toBeDefined();

      // Validate: Contract compliance
      validateWebSocketEvent(groupEvent, 'group:completed');

      // Validate: score:updated includes bonus
      expect(scoreEvent.data.teamId).toBe('001');
      expect(scoreEvent.data.currentScore).toBe(32000); // 15000 + 1000 + 16000
      expect(scoreEvent.data.baseScore).toBe(16000); // 15000 + 1000
      expect(scoreEvent.data.bonusPoints).toBe(16000); // Group bonus
      expect(scoreEvent.data.completedGroups).toContain('Marcus Sucks');

      // Validate: Service state matches broadcasts
      scores = transactionService.getTeamScores();
      team001Score = scores.find(s => s.teamId === '001');
      expect(team001Score.currentScore).toBe(32000);
      expect(team001Score.bonusPoints).toBe(16000);
      expect(team001Score.completedGroups).toContain('Marcus Sucks');
    });

    it('should not award bonus for incomplete group', async () => {
      // CRITICAL: Set up listeners BEFORE scanning to avoid race condition
      const resultPromise = waitForEvent(gmScanner.socket, 'transaction:result');
      const scorePromise = waitForEvent(gmScanner.socket, 'score:updated');

      // Set team
      gmScanner.App.currentTeamId = '001';

      // Scan only ONE token from the group (rat001) - Use REAL scanner
      gmScanner.App.processNFCRead({ id: 'rat001' });

      await resultPromise;
      await scorePromise;

      // Verify: NO group completion (only 1 of 2 tokens)
      const scores = transactionService.getTeamScores();
      const team001Score = scores.find(s => s.teamId === '001');
      expect(team001Score.currentScore).toBe(15000); // Only token value
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
      gmScanner.App.currentTeamId = '001';

      // First: asm001 (Personal, rating 3, value 3000) - Use REAL scanner
      gmScanner.App.processNFCRead({ id: 'asm001' });

      await result1Promise;
      await score1Promise;

      // Second: rat001 (completes group) - Use REAL scanner
      gmScanner.App.processNFCRead({ id: 'rat001' });

      const groupEvent = await groupCompletedPromise;

      // Validate: Group completed with same bonus (order doesn't matter)
      expect(groupEvent.data.group).toBe('Marcus Sucks');
      expect(groupEvent.data.bonusPoints).toBe(16000);

      // Validate: Final score same as forward order
      const scores = transactionService.getTeamScores();
      const team001Score = scores.find(s => s.teamId === '001');
      expect(team001Score.currentScore).toBe(32000); // 1000 + 15000 + 16000
    });
  });
});
