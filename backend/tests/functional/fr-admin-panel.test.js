/**
 * Functional Requirements Validation: Admin Panel
 *
 * Tests FR Section 4: Admin Panel
 * Validates admin panel availability, WebSocket-based commands,
 * command acknowledgments, and admin intervention functions.
 */

// Load browser mocks first
require('../helpers/browser-mocks');

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { createAuthenticatedScanner, waitForEvent } = require('../helpers/websocket-helpers');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../src/websocket/broadcasts');
const { resetAllServices } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const tokenService = require('../../src/services/tokenService');
const SessionModeManager = require('../../../ALNScanner/js/app/sessionModeManager');

describe('FR Section 4: Admin Panel', () => {
  let testContext, scanner;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // CRITICAL: Cleanup old broadcast listeners FIRST
    cleanupBroadcastListeners();

    // Reset services using centralized helper
    await resetAllServices();

    // Re-load tokens
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // CRITICAL: Re-setup broadcast listeners after cleanup
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
      name: 'Admin Test Session',
      teams: ['001', '002']
    });

    // Create scanner (AFTER session created, networked mode for admin panel)
    scanner = await createAuthenticatedScanner(testContext.url, 'GM_ADMIN_TEST', 'blackmarket');
  });

  afterEach(async () => {
    if (scanner?.socket?.connected) scanner.socket.disconnect();
    await resetAllServices();
  });

  describe('FR 4.1: Admin Panel Availability', () => {
    it('should make admin panel available in networked mode', () => {
      const manager = new SessionModeManager();
      manager.setMode('networked');

      // FR 4.1: Admin panel only in networked mode
      expect(manager.isNetworked()).toBe(true);
      // In production, App.viewController checks isNetworked() to enable admin panel
    });

    it('should NOT make admin panel available in standalone mode', () => {
      const manager = new SessionModeManager();
      manager.setMode('standalone');

      // FR 4.1: No admin panel in standalone
      expect(manager.isNetworked()).toBe(false);
      // In production, admin panel UI is hidden when !isNetworked()
    });
  });

  describe('FR 4.2: WebSocket-Based Commands', () => {
    it('should send admin commands via WebSocket (not HTTP)', async () => {
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      // FR 4.2: Admin commands use WebSocket
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:pause',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;

      // Command sent via WebSocket, not HTTP POST
      expect(ack.event).toBe('gm:command:ack');
      expect(ack.data.action).toBe('session:pause');
    });

    it('should receive command acknowledgments', async () => {
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:resume',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;

      // FR 4.2: Command acknowledgments received
      expect(ack.data.success).toBeDefined();
      expect(ack.data.message).toBeDefined();
    });
  });

  describe('FR 4.2.1: Session Control Commands', () => {
    it('should support session:create command', async () => {
      // Note: createSession() automatically ends existing session, which emits TWO session:update events:
      // 1. Ended session (status='ended')
      // 2. New session (status='active')
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:create',
          payload: {
            name: 'New Session',
            teams: ['001', '002', '003']
          }
        },
        timestamp: new Date().toISOString()
      });

      // Wait for first session:update (ended session)
      const endedSession = await waitForEvent(scanner.socket, 'session:update');
      expect(endedSession.data.status).toBe('ended');
      expect(endedSession.data.name).toBe('Admin Test Session');

      // Wait for second session:update (new session)
      const newSession = await waitForEvent(scanner.socket, 'session:update');
      expect(newSession.data.status).toBe('active');
      expect(newSession.data.name).toBe('New Session');

      // Wait for acknowledgment
      const ack = await ackPromise;
      expect(ack.data.success).toBe(true);
    });

    it('should support session:pause command', async () => {
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');
      const sessionPromise = waitForEvent(scanner.socket, 'session:update');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:pause',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionPromise]);

      expect(ack.data.success).toBe(true);
      expect(sessionUpdate.data.status).toBe('paused');
    });

    it('should support session:resume command', async () => {
      // Pause first via admin command
      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:pause',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });
      await waitForEvent(scanner.socket, 'session:update');

      // Now resume - set up listeners BEFORE emitting
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');
      const sessionPromise = waitForEvent(scanner.socket, 'session:update');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:resume',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionPromise]);

      expect(ack.data.success).toBe(true);
      expect(sessionUpdate.data.status).toBe('active');
    });

    it('should support session:end command', async () => {
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');
      const sessionPromise = waitForEvent(scanner.socket, 'session:update');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:end',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionPromise]);

      expect(ack.data.success).toBe(true);
      expect(sessionUpdate.data.status).toBe('ended');
    });
  });

  describe('FR 4.2.2: Video Control Commands', () => {
    it('should support video:play command', async () => {
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'video:play',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;

      expect(ack.data.success).toBeDefined();
      expect(ack.data.action).toBe('video:play');
    });

    it('should support video:pause command', async () => {
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'video:pause',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;

      expect(ack.data.action).toBe('video:pause');
    });

    it('should support video:stop command', async () => {
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'video:stop',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;

      expect(ack.data.action).toBe('video:stop');
    });

    it('should support video:skip command', async () => {
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'video:skip',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;

      expect(ack.data.action).toBe('video:skip');
    });
  });

  describe('FR 4.2.4: Score Adjustment Commands', () => {
    it('should support score:adjust command with positive delta', async () => {
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');
      const scorePromise = waitForEvent(scanner.socket, 'score:updated');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: {
            teamId: '001',
            delta: 1000,
            reason: 'Bonus points'
          }
        },
        timestamp: new Date().toISOString()
      });

      const [ack, scoreUpdate] = await Promise.all([ackPromise, scorePromise]);

      expect(ack.data.success).toBe(true);
      expect(scoreUpdate.data.teamId).toBe('001');
      expect(scoreUpdate.data.currentScore).toBeGreaterThanOrEqual(1000);
    });

    it('should support score:adjust command with negative delta (penalties)', async () => {
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');
      const scorePromise = waitForEvent(scanner.socket, 'score:updated');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: {
            teamId: '002',
            delta: -500,
            reason: 'Penalty for rule violation'
          }
        },
        timestamp: new Date().toISOString()
      });

      const [ack, scoreUpdate] = await Promise.all([ackPromise, scorePromise]);

      expect(ack.data.success).toBe(true);
      expect(scoreUpdate.data.teamId).toBe('002');
    });
  });

  describe('FR 4.2.5: System Reset Command', () => {
    it('should support system:reset command', async () => {
      const ackPromise = waitForEvent(scanner.socket, 'gm:command:ack');

      scanner.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'system:reset',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;

      expect(ack.data.success).toBeDefined();
      expect(ack.data.action).toBe('system:reset');
    });
  });
});
