/**
 * Integration Tests: Admin Panel Commands
 *
 * Tests admin panel WebSocket commands: session control, video control,
 * score adjustments, and system reset.
 *
 * Uses createAuthenticatedScanner (real ALNScanner App code) for
 * end-to-end validation through the actual WebSocket command path.
 *
 * Note: Admin panel availability (networked vs standalone mode) is tested
 * in ALNScanner/tests/unit/app/sessionModeManager.test.js.
 */

// Load browser mocks first
require('../helpers/browser-mocks');

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { createAuthenticatedScanner, waitForEvent } = require('../helpers/websocket-helpers');
const { clearEventCache } = require('../helpers/websocket-core');
const { resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Admin Panel Commands (Integration)', () => {
  let testContext, scanner;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Full reset cycle including broadcast listener re-registration
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      videoQueueService: require('../../src/services/videoQueueService'),
      offlineQueueService: require('../../src/services/offlineQueueService')
    });

    const session = await sessionService.createSession({
      name: 'Admin Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();

    global.DataManager.clearScannedTokens();
    global.DataManager.currentSessionId = session.id;

    scanner = await createAuthenticatedScanner(testContext.url, 'GM_ADMIN_TEST', 'blackmarket');
  });

  afterEach(async () => {
    if (scanner?.cleanup) await scanner.cleanup();
  });

  describe('WebSocket-Based Commands', () => {
    it('should send admin commands via WebSocket (not HTTP)', async () => {
      clearEventCache(scanner.socket);
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:pause', payload: {} },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;
      expect(ack.event).toBe('gm:command:ack');
      expect(ack.data.action).toBe('session:pause');
    });

    it('should receive command acknowledgments', async () => {
      clearEventCache(scanner.socket);
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:resume', payload: {} },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;
      expect(ack.data.success).toBeDefined();
      expect(ack.data.message).toBeDefined();
    });
  });

  describe('Session Control Commands', () => {
    it('should support session:create command', async () => {
      clearEventCache(scanner.socket);

      // Set up listeners BEFORE emit
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:create',
          payload: {
            name: 'New Session',
            teams: ['Team Alpha', 'Detectives', 'Blue Squad']
          }
        },
        timestamp: new Date().toISOString()
      });

      // Wait for ack first (reliable direct response)
      const ack = await ackPromise;
      expect(ack.data.success).toBe(true);

      // Verify new session was created on the server
      const currentSession = sessionService.getCurrentSession();
      expect(currentSession.name).toBe('New Session');
      expect(currentSession.status).toBe('setup');
    });

    it('should support session:pause command', async () => {
      clearEventCache(scanner.socket);

      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');
      const sessionPromise = waitForEvent(scanner.socket, 'session:update');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:pause', payload: {} },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionPromise]);

      expect(ack.data.success).toBe(true);
      expect(sessionUpdate.data.status).toBe('paused');
    });

    it('should support session:resume command', async () => {
      // Pause first
      clearEventCache(scanner.socket);
      const pausePromise = waitForEvent(scanner.socket, 'session:update');
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:pause', payload: {} },
        timestamp: new Date().toISOString()
      });
      await pausePromise;

      // Resume
      clearEventCache(scanner.socket);
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');
      const sessionPromise = waitForEvent(scanner.socket, 'session:update');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:resume', payload: {} },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionPromise]);

      expect(ack.data.success).toBe(true);
      expect(sessionUpdate.data.status).toBe('active');
    });

    it('should support session:end command', async () => {
      clearEventCache(scanner.socket);

      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');
      const sessionPromise = waitForEvent(scanner.socket, 'session:update');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:end', payload: {} },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionPromise]);

      expect(ack.data.success).toBe(true);
      expect(sessionUpdate.data.status).toBe('ended');
    });
  });

  describe('Video Control Commands', () => {
    it('should support video:play command', async () => {
      clearEventCache(scanner.socket);
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'video:play', payload: {} },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;
      expect(ack.data.success).toBeDefined();
      expect(ack.data.action).toBe('video:play');
    });

    it('should support video:pause command', async () => {
      clearEventCache(scanner.socket);
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'video:pause', payload: {} },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;
      expect(ack.data.action).toBe('video:pause');
    });

    it('should support video:stop command', async () => {
      clearEventCache(scanner.socket);
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'video:stop', payload: {} },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;
      expect(ack.data.action).toBe('video:stop');
    });

    it('should support video:skip command', async () => {
      clearEventCache(scanner.socket);
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'video:skip', payload: {} },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;
      expect(ack.data.action).toBe('video:skip');
    });
  });

  describe('Score Adjustment Commands', () => {
    it('should support score:adjust command with positive delta', async () => {
      clearEventCache(scanner.socket);

      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');
      const scorePromise = waitForEvent(scanner.socket, 'score:adjusted');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: { teamId: 'Team Alpha', delta: 1000, reason: 'Bonus points' }
        },
        timestamp: new Date().toISOString()
      });

      const [ack, scoreUpdate] = await Promise.all([ackPromise, scorePromise]);

      expect(ack.data.success).toBe(true);
      expect(scoreUpdate.data.teamScore.teamId).toBe('Team Alpha');
      expect(scoreUpdate.data.teamScore.currentScore).toBeGreaterThanOrEqual(1000);
    });

    it('should support score:adjust command with negative delta (penalties)', async () => {
      clearEventCache(scanner.socket);

      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');
      const scorePromise = waitForEvent(scanner.socket, 'score:adjusted');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: { teamId: 'Detectives', delta: -500, reason: 'Penalty' }
        },
        timestamp: new Date().toISOString()
      });

      const [ack, scoreUpdate] = await Promise.all([ackPromise, scorePromise]);

      expect(ack.data.success).toBe(true);
      expect(scoreUpdate.data.teamScore.teamId).toBe('Detectives');
    });
  });

  describe('System Reset Command', () => {
    it('should support system:reset command', async () => {
      clearEventCache(scanner.socket);
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'system:reset', payload: {} },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;
      expect(ack.data.success).toBeDefined();
      expect(ack.data.action).toBe('system:reset');
    });
  });
});
