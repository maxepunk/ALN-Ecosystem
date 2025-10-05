/**
 * Session Lifecycle Integration Tests
 *
 * Tests complete session lifecycle via WebSocket gm:command:
 * Admin sends gm:command → Service processes → session:update broadcasts
 *
 * CRITICAL: These tests are designed to REVEAL actual behavior vs. contract.
 * Expected failures indicate implementation bugs that must be fixed.
 *
 * Known Issues This Test Will Reveal:
 * 1. Missing session:create handler in adminEvents.js
 * 2. Wrong event names (session:paused/resumed/ended vs session:update)
 * 3. Missing transaction blocking when session paused
 * 4. Wrong score:adjust implementation (resets vs adjusts by delta)
 *
 * Contract: backend/contracts/asyncapi.yaml (gm:command actions line 1087-1101)
 * Functional Requirements: docs/api-alignment/08-functional-requirements.md Section 1.2
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { validateWebSocketEvent } = require('../helpers/contract-validator');
const { setupBroadcastListeners } = require('../../src/websocket/broadcasts');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Session Lifecycle Integration', () => {
  let testContext, gmSocket;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Reset services for clean test state
    await sessionService.reset();
    await transactionService.reset();

    // CRITICAL: Re-initialize tokens after reset
    const tokenService = require('../../src/services/tokenService');
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // CRITICAL: Re-setup broadcast listeners after reset
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
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
    await sessionService.reset();
  });

  describe('session:create command', () => {
    it('should create session via gm:command and broadcast session:update', async () => {
      // Connect GM before session exists
      gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_LIFECYCLE_1');

      // Listen for session:update broadcast (should use session:update NOT session:new)
      const sessionUpdatePromise = waitForEvent(gmSocket, 'session:update');
      const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');

      // Trigger: Create session via gm:command (AsyncAPI line 1113-1121)
      gmSocket.emit('gm:command', {
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

      gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_PAUSE_TEST');

      // Listen for session:update (NOT session:paused per AsyncAPI line 968)
      const sessionUpdatePromise = waitForEvent(gmSocket, 'session:update');
      const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');

      // Trigger: Pause session via gm:command
      gmSocket.emit('gm:command', {
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

      gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_PAUSE_BLOCK_TEST');

      // Pause session
      const pauseAckPromise = waitForEvent(gmSocket, 'gm:command:ack');
      gmSocket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:pause',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });
      await pauseAckPromise;

      // Try to submit transaction while paused (should be REJECTED per FR 1.2)
      const resultPromise = waitForEvent(gmSocket, 'transaction:result');
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '001',
          deviceId: 'GM_PAUSE_BLOCK_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

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

      gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_RESUME_TEST');

      // Listen for session:update (NOT session:resumed per AsyncAPI line 969)
      const sessionUpdatePromise = waitForEvent(gmSocket, 'session:update');
      const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');

      // Trigger: Resume session
      gmSocket.emit('gm:command', {
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

      // Validate: Transactions now allowed
      const resultPromise = waitForEvent(gmSocket, 'transaction:result');
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '001',
          deviceId: 'GM_RESUME_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

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

      gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_END_TEST');

      // Listen for session:update (NOT session:ended per AsyncAPI line 970)
      const sessionUpdatePromise = waitForEvent(gmSocket, 'session:update');
      const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');

      // Trigger: End session
      gmSocket.emit('gm:command', {
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

      gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_SCORE_ADJUST_TEST');

      // Listen for score:updated broadcast
      const scoreUpdatedPromise = waitForEvent(gmSocket, 'score:updated');
      const ackPromise = waitForEvent(gmSocket, 'gm:command:ack');

      // Trigger: Adjust team 001 score by -500 (penalty per AsyncAPI example line 1136)
      gmSocket.emit('gm:command', {
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

      scores = transactionService.getTeamScores();
      team001 = scores.find(s => s.teamId === '001');
      expect(team001.currentScore).toBe(5000);

      gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_SCORE_BONUS_TEST');

      const scoreUpdatedPromise = waitForEvent(gmSocket, 'score:updated');

      // Trigger: Add bonus points
      gmSocket.emit('gm:command', {
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
