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
/** Helper: wait for service:state with a specific domain */
function waitForServiceState(socket, domain, predicate) {
  return waitForEvent(socket, 'service:state', (data) => {
    const payload = data.data || data;
    if (payload.domain !== domain) return false;
    return predicate ? predicate(payload.state) : true;
  });
}

async function createAndStartSession(socket, name, teams) {
  sendGmCommand(socket, 'session:create', { name, teams });
  await waitForEvent(socket, 'session:update');
  sendGmCommand(socket, 'session:start', {});
  await waitForServiceState(socket, 'gameclock');
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
      videoQueueService: require('../../src/services/videoQueueService'),
      offlineQueueService: require('../../src/services/offlineQueueService'),
      gameClockService,
      cueEngineService
    });

    // Isolate from host PipeWire state: performSystemReset re-loads ducking
    // rules from routing.json, so sound:started / video:started events emitted
    // by the cue engine would otherwise reach audioRoutingService.handleDuckingEvent
    // and run real pactl reads/writes against the host. Stub the entry point so
    // nothing in this file touches live volumes. Matches the isolation pattern
    // used in audio-routing-phase3.test.js (commit f1cb7cb3).
    const audioRoutingService = require('../../src/services/audioRoutingService');
    jest.spyOn(audioRoutingService, 'handleDuckingEvent').mockResolvedValue();

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
      const gameClockPromise = waitForServiceState(gm1, 'gameclock', (s) => s.status === 'running');
      sendGmCommand(gm1, 'session:start', {});

      // Wait for service:state gameclock with status: 'running'
      const clockStatus = await gameClockPromise;
      expect(clockStatus.data.state.status).toBe('running');
      expect(clockStatus.data.state.elapsed).toBe(0);

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

  describe('cue dispatches music command', () => {
    it('cue with music:loadPlaylist action invokes musicService.loadPlaylist', async () => {
      const musicService = require('../../src/services/musicService');
      const registry = require('../../src/services/serviceHealthRegistry');

      // Music service must be healthy for commandExecutor to dispatch the action
      // (SERVICE_DEPENDENCIES gates pre-dispatch — see commandExecutor.js).
      registry.report('music', 'healthy', 'test setup');
      const loadSpy = jest.spyOn(musicService, 'loadPlaylist').mockResolvedValue(undefined);

      try {
        cueEngineService.loadCues([
          {
            id: 'test-music-cue',
            label: 'Test Music Cue',
            trigger: { event: 'transaction:accepted' },
            commands: [
              { action: 'music:loadPlaylist', payload: { playlistId: 'all-tracks' } },
            ],
          },
        ]);

        await createAndStartSession(gm1, 'Music Cue Test', ['Team Alpha']);
        cueEngineService.activate();

        const cueFiredPromise = waitForEvent(gm1, 'cue:fired');
        const testToken = TestTokens.STANDALONE_TOKENS[0];
        submitTransaction(gm1, testToken.id, 'Team Alpha');

        const cueFired = await cueFiredPromise;
        expect(cueFired.data.cueId).toBe('test-music-cue');

        // commandExecutor invocation is async — give the event loop a tick.
        await new Promise(r => setImmediate(r));

        expect(loadSpy).toHaveBeenCalledWith('all-tracks');
      } finally {
        loadSpy.mockRestore();
      }
    });

    it('music:track:changed payload is normalized to flat fields for cue conditions', async () => {
      // Proves the EVENT_NORMALIZERS music entries added in commit 5ff8c9e5
      // actually flatten the nested payload for condition evaluation. Without
      // the normalizer, condition.field=title would resolve to undefined
      // (raw payload is { track: { title } } — nested), and the cue would
      // never match.
      //
      // We exercise handleGameEvent directly rather than emitting on the
      // service singleton because integration tests inherit cueEngineWiring
      // listeners from prior test files via process-wide module state — that
      // works but is fragile and adds an extra hop. Direct invocation tests
      // the normalizer + condition-eval path in isolation.
      const musicService = require('../../src/services/musicService');
      const registry = require('../../src/services/serviceHealthRegistry');
      registry.report('music', 'healthy', 'test setup');
      const stopSpy = jest.spyOn(musicService, 'stop').mockResolvedValue(undefined);

      try {
        cueEngineService.loadCues([
          {
            id: 'music-title-cue',
            label: 'Stop music when "GameEnd" plays',
            trigger: {
              event: 'music:track:changed',
              conditions: [{ field: 'title', op: 'eq', value: 'GameEnd' }],
            },
            commands: [{ action: 'music:stop', payload: {} }],
          },
          // Negative-match cue: ensures we don't fire when title differs
          {
            id: 'music-decoy-cue',
            trigger: {
              event: 'music:track:changed',
              conditions: [{ field: 'title', op: 'eq', value: 'NEVER_MATCHES' }],
            },
            commands: [{ action: 'music:stop', payload: {} }],
          },
        ]);

        await createAndStartSession(gm1, 'Music Normalizer Test', ['Team Alpha']);
        cueEngineService.activate();

        // Drive cueEngineService directly to test the normalizer path.
        cueEngineService.handleGameEvent('music:track:changed', {
          track: { title: 'GameEnd', artist: 'X', file: 'end.mp3' },
        });

        // Fire is async — let the microtask drain
        await new Promise(r => setImmediate(r));
        await new Promise(r => setImmediate(r));

        // Positive match fired exactly once (decoy did NOT fire — confirms
        // normalizer is producing the right field name AND condition eval
        // is reading the normalized value).
        expect(stopSpy).toHaveBeenCalledTimes(1);
      } finally {
        stopSpy.mockRestore();
      }
    });
  });

  describe('pause cascade', () => {
    it('should pause game clock and suspend cue engine on session:pause', async () => {
      // Create session and start game
      await createAndStartSession(gm1, 'Pause Test Session', ['Team Alpha']);

      // Verify game clock is running
      expect(gameClockService.status).toBe('running');

      // Pause session
      const pauseClockPromise = waitForServiceState(gm1, 'gameclock', (s) => s.status === 'paused');
      sendGmCommand(gm1, 'session:pause', {});

      // Wait for service:state gameclock with status: 'paused'
      const pausedClock = await pauseClockPromise;
      expect(pausedClock.data.state.status).toBe('paused');
      expect(pausedClock.data.state.elapsed).toBeGreaterThanOrEqual(0);

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

    it('should call music.pauseForGameClock on session:pause', async () => {
      // sessionService.setStatus uses a lazy require for musicService, so we
      // spy on the actual singleton method.
      const musicService = require('../../src/services/musicService');
      const pauseSpy = jest.spyOn(musicService, 'pauseForGameClock')
        .mockResolvedValue(undefined);

      try {
        await createAndStartSession(gm1, 'Music Pause Test Session', ['Team Alpha']);

        sendGmCommand(gm1, 'session:pause', {});
        await waitForServiceState(gm1, 'gameclock', (s) => s.status === 'paused');

        // sessionService fires music.pauseForGameClock() fire-and-forget;
        // the await above guarantees the pause cascade has run.
        expect(pauseSpy).toHaveBeenCalled();
      } finally {
        pauseSpy.mockRestore();
      }
    });

    it('should call music.resumeFromGameClock on session:resume', async () => {
      const musicService = require('../../src/services/musicService');
      const resumeSpy = jest.spyOn(musicService, 'resumeFromGameClock')
        .mockResolvedValue(undefined);

      try {
        await createAndStartSession(gm1, 'Music Resume Test Session', ['Team Alpha']);

        sendGmCommand(gm1, 'session:pause', {});
        await waitForServiceState(gm1, 'gameclock', (s) => s.status === 'paused');

        resumeSpy.mockClear();
        sendGmCommand(gm1, 'session:resume', {});
        await waitForServiceState(gm1, 'gameclock', (s) => s.status === 'running');

        expect(resumeSpy).toHaveBeenCalled();
      } finally {
        resumeSpy.mockRestore();
      }
    });

    it('should resume everything on session:resume', async () => {
      // Create session, start, and pause
      await createAndStartSession(gm1, 'Resume Test Session', ['Team Alpha']);

      sendGmCommand(gm1, 'session:pause', {});
      await waitForServiceState(gm1, 'gameclock', (s) => s.status === 'paused');

      // Resume session
      const resumeClockPromise = waitForServiceState(gm1, 'gameclock', (s) => s.status === 'running');
      sendGmCommand(gm1, 'session:resume', {});

      // Wait for service:state gameclock with status: 'running'
      const resumedClock = await resumeClockPromise;
      expect(resumedClock.data.state.status).toBe('running');
      expect(resumedClock.data.state.elapsed).toBeGreaterThanOrEqual(0);

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
