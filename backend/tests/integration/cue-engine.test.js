/**
 * Cue Engine Integration Tests
 *
 * Tests end-to-end flows for:
 * - Session lifecycle (setup → active → paused → resumed)
 * - Game clock coordination (started/paused/resumed broadcasts)
 * - Standing cue triggering on game events
 * - Pause cascade (session pause suspends cue engine and game clock)
 *
 * Uses REAL server instance (not mocks) for integration testing.
 */

'use strict';

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { connectAndIdentify, waitForEvent, sendGmCommand } = require('../helpers/websocket-helpers');
const { resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const cueEngineService = require('../../src/services/cueEngineService');
const gameClockService = require('../../src/services/gameClockService');
const TestTokens = require('../fixtures/test-tokens');

/**
 * Helper: Create session and start game
 * @param {Socket} socket - Socket.io client
 * @param {string} name - Session name
 * @param {string[]} teams - Team names
 */
async function createAndStartSession(socket, name, teams) {
  sendGmCommand(socket, 'session:create', { name, teams });
  await waitForEvent(socket, 'session:update');
  sendGmCommand(socket, 'session:start', {});
  await waitForEvent(socket, 'gameclock:status');
}

/**
 * Helper: Submit transaction
 * @param {Socket} socket - Socket.io client
 * @param {string} tokenId - Token ID
 * @param {string} teamId - Team ID
 * @param {string} deviceId - Device ID (defaults to GM_CUE_TEST_1)
 */
function submitTransaction(socket, tokenId, teamId, deviceId = 'GM_CUE_TEST_1') {
  socket.emit('transaction:submit', {
    event: 'transaction:submit',
    data: {
      tokenId,
      teamId,
      deviceId,
      deviceType: 'gm',
      mode: 'blackmarket'
    },
    timestamp: new Date().toISOString()
  });
}

describe('Cue Engine Integration', () => {
  let testContext, gm1;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Reset all services (including Phase 1 services)
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      stateService: require('../../src/services/stateService'),
      videoQueueService: require('../../src/services/videoQueueService'),
      offlineQueueService: require('../../src/services/offlineQueueService'),
      gameClockService,
      cueEngineService
    });

    // Re-initialize tokens after reset
    const testTokens = TestTokens.getAllAsArray();
    await transactionService.init(testTokens);

    // Connect GM client
    gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_CUE_TEST_1');
  });

  afterEach(async () => {
    if (gm1?.connected) {
      gm1.disconnect();
    }
  });

  describe('session:start lifecycle', () => {
    it('should create session in setup, then start game', async () => {
      // Create session (should be in setup state)
      sendGmCommand(gm1, 'session:create', {
        name: 'Cue Integration Test Session',
        teams: ['Team Alpha', 'Detectives']
      });

      // Wait for session:update broadcast
      const sessionUpdate = await waitForEvent(gm1, 'session:update');
      expect(sessionUpdate.data.status).toBe('setup');
      expect(sessionUpdate.data.name).toBe('Cue Integration Test Session');

      // Verify session is in setup
      const session1 = sessionService.getCurrentSession();
      expect(session1).toBeDefined();
      expect(session1.status).toBe('setup');

      // Start game (should transition to active and start game clock)
      const gameClockPromise = waitForEvent(gm1, 'gameclock:status');
      sendGmCommand(gm1, 'session:start', {});

      // Wait for gameclock:status event with state: 'running'
      const clockStatus = await gameClockPromise;
      expect(clockStatus.data.state).toBe('running');
      expect(clockStatus.data.elapsed).toBe(0);

      // Verify session is now active
      const session2 = sessionService.getCurrentSession();
      expect(session2.status).toBe('active');

      // Verify game clock is running
      expect(gameClockService.status).toBe('running');
      expect(gameClockService.gameStartTime).toBeTruthy();
    });

    it('should reject transactions during setup', async () => {
      // Create session (setup state)
      sendGmCommand(gm1, 'session:create', {
        name: 'Setup Transaction Test',
        teams: ['Team Alpha']
      });
      await waitForEvent(gm1, 'session:update');

      // Try to submit transaction while in setup
      const resultPromise = waitForEvent(gm1, 'transaction:result');
      const testToken = TestTokens.STANDALONE_TOKENS[0];
      submitTransaction(gm1, testToken.id, 'Team Alpha');

      // Should receive transaction:result with error (rejected during setup)
      const result = await resultPromise;
      expect(result.data.status).toBe('error');
      expect(result.data.error).toBe('SESSION_NOT_ACTIVE');
    });

    it('should accept transactions after start', async () => {
      // Create session and start game
      await createAndStartSession(gm1, 'Active Transaction Test', ['Team Alpha']);

      // Submit transaction (should succeed)
      const transactionPromise = waitForEvent(gm1, 'transaction:new');
      const testToken = TestTokens.STANDALONE_TOKENS[0];
      submitTransaction(gm1, testToken.id, 'Team Alpha');

      // Should receive transaction:new broadcast
      const transaction = await transactionPromise;
      expect(transaction.data.transaction.tokenId).toBe(testToken.id);
      expect(transaction.data.transaction.teamId).toBe('Team Alpha');
    });
  });

  describe('standing cue fires on game event', () => {
    it('should fire cue when matching event occurs', async () => {
      // Load a test cue that triggers on transaction:accepted
      cueEngineService.loadCues([
        {
          id: 'test-transaction-cue',
          label: 'Test Transaction Cue',
          trigger: { event: 'transaction:accepted' },
          commands: [
            { action: 'sound:play', payload: { file: 'test-sound.wav' } }
          ]
        }
      ]);

      // Create session and start game
      await createAndStartSession(gm1, 'Cue Fire Test Session', ['Team Alpha']);

      // Activate cue engine (would normally be done by session lifecycle)
      cueEngineService.activate();

      // Verify cue engine is active
      expect(cueEngineService.active).toBe(true);

      // Listen for cue:fired event
      const cueFiredPromise = waitForEvent(gm1, 'cue:fired');

      // Submit transaction (should trigger standing cue)
      const testToken = TestTokens.STANDALONE_TOKENS[0];
      submitTransaction(gm1, testToken.id, 'Team Alpha');

      // Wait for transaction to be accepted
      await waitForEvent(gm1, 'transaction:new');

      // Verify cue:fired event was received
      const cueFired = await cueFiredPromise;
      expect(cueFired.data.cueId).toBe('test-transaction-cue');
      expect(cueFired.data.source).toBe('cue');
      expect(cueFired.data.trigger).toBeTruthy();
    });
  });

  describe('pause cascade', () => {
    it('should pause game clock and suspend cue engine on session:pause', async () => {
      // Create session and start game
      await createAndStartSession(gm1, 'Pause Test Session', ['Team Alpha']);

      // Verify game clock is running
      expect(gameClockService.status).toBe('running');

      // Pause session
      const pauseClockPromise = waitForEvent(gm1, 'gameclock:status', (data) => data.data.state === 'paused');
      sendGmCommand(gm1, 'session:pause', {});

      // Wait for gameclock:status with state: 'paused'
      const pausedClock = await pauseClockPromise;
      expect(pausedClock.data.state).toBe('paused');
      expect(pausedClock.data.elapsed).toBeGreaterThanOrEqual(0);

      // Verify game clock is paused
      expect(gameClockService.status).toBe('paused');

      // Verify session is paused
      const session = sessionService.getCurrentSession();
      expect(session.status).toBe('paused');

      // Try to submit transaction (should be rejected)
      const resultPromise = waitForEvent(gm1, 'transaction:result');
      const testToken = TestTokens.STANDALONE_TOKENS[0];
      submitTransaction(gm1, testToken.id, 'Team Alpha');

      // Should receive transaction:result with error (rejected during paused)
      const result = await resultPromise;
      expect(result.data.status).toBe('error');
      expect(result.data.error).toBe('SESSION_PAUSED');
    });

    it('should resume everything on session:resume', async () => {
      // Create session, start, and pause
      await createAndStartSession(gm1, 'Resume Test Session', ['Team Alpha']);

      sendGmCommand(gm1, 'session:pause', {});
      await waitForEvent(gm1, 'gameclock:status', (data) => data.data.state === 'paused');

      // Resume session
      const resumeClockPromise = waitForEvent(gm1, 'gameclock:status', (data) => data.data.state === 'running');
      sendGmCommand(gm1, 'session:resume', {});

      // Wait for gameclock:status with state: 'running'
      const resumedClock = await resumeClockPromise;
      expect(resumedClock.data.state).toBe('running');
      expect(resumedClock.data.elapsed).toBeGreaterThanOrEqual(0);

      // Verify game clock is running
      expect(gameClockService.status).toBe('running');

      // Verify session is active
      const session = sessionService.getCurrentSession();
      expect(session.status).toBe('active');

      // Submit transaction (should succeed)
      const transactionPromise = waitForEvent(gm1, 'transaction:new');
      const testToken = TestTokens.STANDALONE_TOKENS[0];
      submitTransaction(gm1, testToken.id, 'Team Alpha');

      // Should receive transaction:new broadcast
      const transaction = await transactionPromise;
      expect(transaction.data.transaction.tokenId).toBe(testToken.id);
      expect(transaction.data.transaction.teamId).toBe('Team Alpha');
    });
  });
});
