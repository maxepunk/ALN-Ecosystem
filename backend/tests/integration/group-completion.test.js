/**
 * Group Completion Integration Tests
 *
 * Tests complete group completion flow:
 * Team scans all tokens in group → bonus calculated → group:completed broadcast
 *
 * CRITICAL: These tests validate group completion bonus mechanics.
 * Expected to REVEAL implementation bugs if bonus calculation or broadcasting is incorrect.
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

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { validateWebSocketEvent } = require('../helpers/contract-validator');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../src/websocket/broadcasts');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Group Completion Integration', () => {
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

    // CRITICAL: Cleanup old broadcast listeners before adding new ones
    cleanupBroadcastListeners();

    // Re-initialize tokens after reset
    const tokenService = require('../../src/services/tokenService');
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

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

    // Connect GM scanner
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_GROUP_TEST');
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
    await sessionService.reset();
  });

  describe('Complete Group Bonus', () => {
    it('should detect group completion and award bonus', async () => {
      // CRITICAL: Set up ALL listeners BEFORE any transactions to avoid race conditions
      const groupCompletedPromise = waitForEvent(gmSocket, 'group:completed');

      // Scan first token - set up listener before emitting
      const firstScorePromise = waitForEvent(gmSocket, 'score:updated');

      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: '001',
          deviceId: 'GM_GROUP_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

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
        gmSocket.on('score:updated', (event) => {
          scoreEventCount++;
          finalScoreEvent = event;
          if (scoreEventCount === 2) {
            resolve(event);
          }
        });
      });

      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'asm001',
          teamId: '001',
          deviceId: 'GM_GROUP_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

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
      // CRITICAL: Set up listeners BEFORE emitting to avoid race condition
      const resultPromise = waitForEvent(gmSocket, 'transaction:result');
      const scorePromise = waitForEvent(gmSocket, 'score:updated');

      // Scan only ONE token from the group (rat001)
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: '001',
          deviceId: 'GM_GROUP_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      await resultPromise;
      await scorePromise;

      // Verify: NO group completion (only 1 of 2 tokens)
      const scores = transactionService.getTeamScores();
      const team001Score = scores.find(s => s.teamId === '001');
      expect(team001Score.currentScore).toBe(15000); // Only token value
      expect(team001Score.bonusPoints).toBe(0); // NO bonus
      expect(team001Score.completedGroups).toEqual([]); // NOT complete
    });

    it('should prevent group completion if other team claimed a token', async () => {
      // CRITICAL: Set up listeners BEFORE first transaction
      const result1Promise = waitForEvent(gmSocket, 'transaction:result');
      const score1Promise = waitForEvent(gmSocket, 'score:updated');

      // Team 001 scans first token (rat001)
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: '001',
          deviceId: 'GM_GROUP_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      await result1Promise;
      await score1Promise;

      // CRITICAL: Set up listeners BEFORE second transaction
      const result2Promise = waitForEvent(gmSocket, 'transaction:result');
      const score2Promise = waitForEvent(gmSocket, 'score:updated');

      // Team 002 scans second token (asm001) - "steals" it
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'asm001',
          teamId: '002', // Different team
          deviceId: 'GM_GROUP_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      await result2Promise;
      await score2Promise;

      // Verify: Team 001 did NOT complete group (asm001 claimed by team 002)
      const scores = transactionService.getTeamScores();
      const team001Score = scores.find(s => s.teamId === '001');
      const team002Score = scores.find(s => s.teamId === '002');

      expect(team001Score.completedGroups).toEqual([]); // NOT complete
      expect(team001Score.bonusPoints).toBe(0); // NO bonus
      expect(team002Score.completedGroups).toEqual([]); // Also not complete
      expect(team002Score.bonusPoints).toBe(0);

      // Both teams have only their individual token values
      expect(team001Score.currentScore).toBe(15000); // rat001 only
      expect(team002Score.currentScore).toBe(1000); // asm001 only
    });
  });

  describe('Group Completion Order Independence', () => {
    it('should complete group regardless of scan order', async () => {
      // CRITICAL: Set up ALL listeners BEFORE any transactions
      const groupCompletedPromise = waitForEvent(gmSocket, 'group:completed');
      const result1Promise = waitForEvent(gmSocket, 'transaction:result');
      const score1Promise = waitForEvent(gmSocket, 'score:updated');

      // First: asm001 (Personal, rating 3, value 3000)
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'asm001',
          teamId: '001',
          deviceId: 'GM_GROUP_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      await result1Promise;
      await score1Promise;

      // Second: rat001 (completes group)
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: '001',
          deviceId: 'GM_GROUP_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

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

  describe('Multi-Client Group Completion Broadcast', () => {
    it('should broadcast group:completed to all connected GMs', async () => {
      // Connect 2 additional GMs
      const gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_GROUP_2');
      const gm3 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_GROUP_3');

      // CRITICAL: Set up ALL listeners BEFORE any transactions
      const promises = [
        waitForEvent(gmSocket, 'group:completed'),
        waitForEvent(gm2, 'group:completed'),
        waitForEvent(gm3, 'group:completed')
      ];
      const result1Promise = waitForEvent(gmSocket, 'transaction:result');

      // Complete group via gmSocket
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: '001',
          deviceId: 'GM_GROUP_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      await result1Promise;

      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'asm001',
          teamId: '001',
          deviceId: 'GM_GROUP_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const [event1, event2, event3] = await Promise.all(promises);

      // Validate: All 3 GMs received identical group:completed event
      expect(event1.data).toEqual(event2.data);
      expect(event2.data).toEqual(event3.data);

      expect(event1.data.group).toBe('Marcus Sucks');
      expect(event1.data.bonusPoints).toBe(16000);

      // Cleanup
      gm2.disconnect();
      gm3.disconnect();
    });
  });

  describe('Detective Mode and Group Completion', () => {
    it('should NOT complete group with detective mode scans (no scoring)', async () => {
      // Team scans first token in BLACKMARKET mode (scoring)
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: '001',
          deviceId: 'GM_GROUP_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      await waitForEvent(gmSocket, 'transaction:result');

      // Scan second token in DETECTIVE mode (logging only, no scoring)
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'asm001',
          teamId: '001',
          deviceId: 'GM_GROUP_TEST',
          mode: 'detective' // Detective mode
        },
        timestamp: new Date().toISOString()
      });

      await waitForEvent(gmSocket, 'transaction:result');

      // Wait a bit to ensure no group:completed event
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify: Group NOT completed (detective mode doesn't count toward groups)
      const scores = transactionService.getTeamScores();
      const team001Score = scores.find(s => s.teamId === '001');
      expect(team001Score.completedGroups).toEqual([]); // NOT complete
      expect(team001Score.bonusPoints).toBe(0); // NO bonus
      expect(team001Score.currentScore).toBe(15000); // Only rat001 (blackmarket scan)
    });
  });
});
