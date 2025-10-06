/**
 * Session Lifecycle Integration Tests - REAL SCANNER
 *
 * Tests GM scanner experiencing session lifecycle:
 * GM sends admin commands → GM receives state broadcasts → GM transaction behavior changes
 *
 * TRANSFORMATION: Phase 3.6f - Use real scanner for lifecycle experience
 * - GM uses createAuthenticatedScanner() (real scanner integration)
 * - GM sends admin commands via scanner.socket.emit('gm:command') (Admin Panel integrated per FR 4.2)
 * - GM scans via scanner.App.processNFCRead() (real scanner API)
 * - GM receives broadcasts via scanner.socket (session:update, score:updated)
 * - Tests single-GM integration (GM experiences its own admin actions)
 *
 * What This Tests:
 * 1. GM can control session via Admin Panel (gm:command events)
 * 2. GM experiences state changes it initiated (receives broadcasts)
 * 3. GM transaction behavior changes based on session state (blocked when paused)
 *
 * Contract: backend/contracts/asyncapi.yaml (gm:command actions line 1087-1101)
 * Functional Requirements: docs/api-alignment/08-functional-requirements.md Section 1.2
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

describe('Session Lifecycle Integration - REAL Scanner', () => {
  let testContext, scanner, rawTokens;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // CRITICAL: Cleanup old broadcast listeners FIRST (sessionService.reset() doesn't remove them)
    cleanupBroadcastListeners();

    // Reset services for clean test state
    await sessionService.reset();
    await transactionService.reset();

    // CRITICAL: Re-initialize tokens after reset
    const tokenService = require('../../src/services/tokenService');
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // CRITICAL: Load RAW tokens for scanner (scanner expects raw format from ALN-TokenData)
    const rawTokensPath = path.join(__dirname, '../../../ALN-TokenData/tokens.json');
    rawTokens = JSON.parse(fs.readFileSync(rawTokensPath, 'utf8'));
    global.TokenManager.database = rawTokens;

    // Re-setup broadcast listeners after cleanup
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
  });

  afterEach(async () => {
    if (scanner?.socket?.connected) scanner.socket.disconnect();
    await sessionService.reset();
  });

  describe('session:create command', () => {
    it('should create session via gm:command and broadcast session:update', async () => {
      // Connect REAL GM scanner before session exists
      scanner = await createAuthenticatedScanner(testContext.url, 'GM_LIFECYCLE_1', 'blackmarket');

      // Listen for session:update broadcast (should use session:update NOT session:new)
      const sessionUpdatePromise = waitForEvent(scanner.socket, 'session:update');
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      // Trigger: GM sends admin command to create session (Admin Panel integrated per FR 4.2)
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:create',  // Contract-specified action
          payload: {
            name: 'Lifecycle Test Session',
            teams: ['001', '002', '003']
          }
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For command ack and session:update broadcast
      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionUpdatePromise]);

      // Validate: Command ack structure (AsyncAPI line 1168-1171)
      expect(ack.event).toBe('gm:command:ack');
      expect(ack.data.action).toBe('session:create');
      expect(ack.data.success).toBe(true);
      expect(ack.data.message).toBeDefined(); // REQUIRED field
      validateWebSocketEvent(ack, 'gm:command:ack');

      // Validate: session:update broadcast (NOT session:new per AsyncAPI line 967)
      expect(sessionUpdate.event).toBe('session:update');
      expect(sessionUpdate.data.status).toBe('active');
      expect(sessionUpdate.data.name).toBe('Lifecycle Test Session');
      expect(sessionUpdate.data.teams).toEqual(['001', '002', '003']);
      expect(sessionUpdate.data.id).toBeDefined(); // Decision #4: 'id' within resource
      validateWebSocketEvent(sessionUpdate, 'session:update');

      // Validate: transactionService initialized team scores
      const scores = transactionService.getTeamScores();
      const team001Score = scores.find(s => s.teamId === '001');
      expect(team001Score).toBeDefined();
      expect(team001Score.currentScore).toBe(0);
      expect(team001Score.teamId).toBe('001');
    });
  });

  describe('session:pause command', () => {
    it('should pause session and broadcast session:update (NOT session:paused)', async () => {
      // Setup: Create session first
      await sessionService.createSession({
        name: 'Pause Test Session',
        teams: ['001', '002']
      });

      scanner = await createAuthenticatedScanner(testContext.url, 'GM_PAUSE_TEST', 'blackmarket');

      // Listen for session:update (NOT session:paused per AsyncAPI line 968)
      const sessionUpdatePromise = waitForEvent(scanner.socket, 'session:update');
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      // Trigger: GM sends pause command
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:pause',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionUpdatePromise]);

      // Validate: Command ack
      expect(ack.data.action).toBe('session:pause');
      expect(ack.data.success).toBe(true);
      expect(ack.data.message).toContain('paused');

      // Validate: Uses session:update NOT session:paused (per Decision #7, AsyncAPI line 968)
      expect(sessionUpdate.event).toBe('session:update');
      expect(sessionUpdate.data.status).toBe('paused');
      validateWebSocketEvent(sessionUpdate, 'session:update');
    });

    it('should block transactions when session is paused', async () => {
      // Setup: Create session
      await sessionService.createSession({
        name: 'Pause Block Test',
        teams: ['001']
      });

      scanner = await createAuthenticatedScanner(testContext.url, 'GM_PAUSE_BLOCK_TEST', 'blackmarket');

      // Pause session via admin command
      const pauseAckPromise = waitForEvent(scanner.socket, 'gm:command:ack');
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:pause',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });
      await pauseAckPromise;

      // Try to scan while paused using REAL scanner API (should be REJECTED per FR 1.2)
      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');

      scanner.App.currentTeamId = '001';
      scanner.App.processNFCRead({ id: '534e2b03' });

      const result = await resultPromise;

      // Validate: Transaction REJECTED (per FR 1.2: "Transactions rejected with error: Session is paused")
      expect(result.data.status).toBe('error');
      expect(result.data.message).toContain('paused'); // Error message indicates paused state
      expect(result.data.points).toBe(0); // No points awarded

      // Validate: Team score unchanged (transaction was blocked)
      const scores = transactionService.getTeamScores();
      const teamScore = scores.find(s => s.teamId === '001');
      expect(teamScore.currentScore).toBe(0);
    });
  });

  describe('session:resume command', () => {
    it('should resume session and allow transactions', async () => {
      // Setup: Create and pause session
      await sessionService.createSession({
        name: 'Resume Test Session',
        teams: ['001']
      });
      await sessionService.updateSession({ status: 'paused' });

      scanner = await createAuthenticatedScanner(testContext.url, 'GM_RESUME_TEST', 'blackmarket');

      // Listen for session:update (NOT session:resumed per AsyncAPI line 969)
      const sessionUpdatePromise = waitForEvent(scanner.socket, 'session:update');
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      // Trigger: GM sends resume command
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:resume',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionUpdatePromise]);

      // Validate: Command ack
      expect(ack.data.action).toBe('session:resume');
      expect(ack.data.success).toBe(true);
      expect(ack.data.message).toContain('resumed');

      // Validate: Uses session:update NOT session:resumed (AsyncAPI line 969)
      expect(sessionUpdate.event).toBe('session:update');
      expect(sessionUpdate.data.status).toBe('active'); // Resumed = 'active' status
      validateWebSocketEvent(sessionUpdate, 'session:update');

      // Validate: Transactions now allowed - use REAL scanner API
      const resultPromise = waitForEvent(scanner.socket, 'transaction:result');

      scanner.App.currentTeamId = '001';
      scanner.App.processNFCRead({ id: '534e2b03' });

      const result = await resultPromise;
      expect(result.data.status).toBe('accepted'); // Transaction succeeds after resume
      expect(result.data.points).toBe(5000);
    });
  });

  describe('session:end command', () => {
    it('should end session and broadcast session:update (NOT session:ended)', async () => {
      // Setup: Create session with transactions
      await sessionService.createSession({
        name: 'End Test Session',
        teams: ['001']
      });

      // Add a transaction
      const session = sessionService.getCurrentSession();
      const txResult = await transactionService.processScan({
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'SETUP',
        mode: 'blackmarket'
      }, session);
      await sessionService.addTransaction(txResult.transaction);

      scanner = await createAuthenticatedScanner(testContext.url, 'GM_END_TEST', 'blackmarket');

      // Listen for session:update (NOT session:ended per AsyncAPI line 970)
      const sessionUpdatePromise = waitForEvent(scanner.socket, 'session:update');
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      // Trigger: GM sends end command
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:end',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionUpdatePromise]);

      // Validate: Command ack
      expect(ack.data.action).toBe('session:end');
      expect(ack.data.success).toBe(true);
      expect(ack.data.message).toContain('ended');

      // Validate: Uses session:update NOT session:ended (AsyncAPI line 970)
      expect(sessionUpdate.event).toBe('session:update');
      expect(sessionUpdate.data.status).toBe('ended');
      expect(sessionUpdate.data.endTime).toBeDefined(); // endTime set when ended
      validateWebSocketEvent(sessionUpdate, 'session:update');
    });
  });

  describe('score:adjust command', () => {
    it('should adjust team score by delta (NOT reset)', async () => {
      // Setup: Create session with existing score
      await sessionService.createSession({
        name: 'Score Adjust Test',
        teams: ['001', '002']
      });

      // Add transactions to create initial scores
      const session = sessionService.getCurrentSession();
      const tx1 = await transactionService.processScan({
        tokenId: '534e2b03',  // 5000 points
        teamId: '001',
        deviceId: 'SETUP',
        mode: 'blackmarket'
      }, session);
      await sessionService.addTransaction(tx1.transaction);

      const tx2 = await transactionService.processScan({
        tokenId: 'tac001',  // 100 points (rating 1, Personal type)
        teamId: '002',
        deviceId: 'SETUP',
        mode: 'blackmarket'
      }, session);
      await sessionService.addTransaction(tx2.transaction);

      // Verify initial scores
      let scores = transactionService.getTeamScores();
      let team001 = scores.find(s => s.teamId === '001');
      let team002 = scores.find(s => s.teamId === '002');
      expect(team001.currentScore).toBe(5000);
      expect(team002.currentScore).toBe(100);  // Corrected: rating 1 Personal = 100

      scanner = await createAuthenticatedScanner(testContext.url, 'GM_SCORE_ADJUST_TEST', 'blackmarket');

      // Listen for score:updated broadcast
      const scoreUpdatedPromise = waitForEvent(scanner.socket, 'score:updated');
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      // Trigger: GM sends score:adjust command (penalty per AsyncAPI example line 1136)
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: {
            teamId: '001',
            delta: -500,  // ADJUST by delta, not RESET
            reason: 'Penalty for rule violation'
          }
        },
        timestamp: new Date().toISOString()
      });

      const [ack, scoreUpdate] = await Promise.all([ackPromise, scoreUpdatedPromise]);

      // Validate: Command ack
      expect(ack.data.action).toBe('score:adjust');
      expect(ack.data.success).toBe(true);
      expect(ack.data.message).toBeDefined();

      // Validate: Score ADJUSTED by delta (5000 - 500 = 4500), NOT reset to 0
      expect(scoreUpdate.event).toBe('score:updated');
      expect(scoreUpdate.data.teamId).toBe('001');
      expect(scoreUpdate.data.currentScore).toBe(4500); // 5000 - 500
      validateWebSocketEvent(scoreUpdate, 'score:updated');

      // Validate: Team 002 score UNCHANGED
      scores = transactionService.getTeamScores();
      team002 = scores.find(s => s.teamId === '002');
      expect(team002.currentScore).toBe(100); // No change (still 100)

      // Validate: Service state matches broadcast
      team001 = scores.find(s => s.teamId === '001');
      expect(team001.currentScore).toBe(4500);
    });

    it('should handle positive delta (bonus points)', async () => {
      // Setup: Create session
      await sessionService.createSession({
        name: 'Score Bonus Test',
        teams: ['001']
      });

      const session = sessionService.getCurrentSession();
      const tx = await transactionService.processScan({
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'SETUP',
        mode: 'blackmarket'
      }, session);
      await sessionService.addTransaction(tx.transaction);

      let scores = transactionService.getTeamScores();
      let team001 = scores.find(s => s.teamId === '001');
      expect(team001.currentScore).toBe(5000);

      scanner = await createAuthenticatedScanner(testContext.url, 'GM_SCORE_BONUS_TEST', 'blackmarket');

      const scoreUpdatedPromise = waitForEvent(scanner.socket, 'score:updated');

      // Trigger: GM sends score:adjust command (bonus)
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: {
            teamId: '001',
            delta: 1000,  // Positive delta = bonus
            reason: 'Bonus for excellent teamwork'
          }
        },
        timestamp: new Date().toISOString()
      });

      const scoreUpdate = await scoreUpdatedPromise;

      // Validate: Score increased by delta
      expect(scoreUpdate.data.teamId).toBe('001');
      expect(scoreUpdate.data.currentScore).toBe(6000); // 5000 + 1000
    });
  });
});
