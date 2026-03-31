/**
 * Display Events - Contract Validation Tests
 * Tests display:mode and display:status events against AsyncAPI schema
 *
 * Phase 4.2: HDMI Display Control state machine
 * Layer 3 (Contract): Validates event structure, NOT business logic flow
 *
 * display:mode is broadcast via displayControlService EventEmitter → broadcasts.js
 * display:status is returned via gm:command:ack data field (not a broadcast)
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent, sendGmCommand } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const { resetAllServices } = require('../../helpers/service-reset');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../../src/websocket/broadcasts');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const stateService = require('../../../src/services/stateService');
const videoQueueService = require('../../../src/services/videoQueueService');
const offlineQueueService = require('../../../src/services/offlineQueueService');
const displayControlService = require('../../../src/services/displayControlService');
const serviceHealthRegistry = require('../../../src/services/serviceHealthRegistry');

describe('Display Events - Contract Validation', () => {
  let testContext;
  let socket;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Clean up any existing broadcast listeners first (prevents duplicates)
    cleanupBroadcastListeners();

    await resetAllServices();

    // Reset display control service
    displayControlService.reset();

    // Mark VLC as healthy (required for display:idle-loop SERVICE_DEPENDENCIES gate)
    serviceHealthRegistry.report('vlc', 'healthy', 'test mock');

    // Initialize display control service with mocked VLC
    displayControlService.init({
      vlcService: {
        isConnected: () => false,  // No VLC in tests
        returnToIdleLoop: async () => true,
        stop: async () => true,
        playVideo: async () => true
      },
      videoQueueService
    });

    // CRITICAL: Re-register broadcast listeners after resetAllServices
    // Must include displayControlService for display:mode:changed → display:mode broadcasts
    setupBroadcastListeners(testContext.io, {
      sessionService,
      stateService,
      videoQueueService,
      offlineQueueService,
      transactionService,
      displayControlService
    });

    // Create session (needed for GM authentication)
    await sessionService.createSession({
      name: 'Display Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();

    // Connect GM socket
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_DISPLAY');
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }

    // Clean up broadcast listeners before resetAllServices to prevent leaks
    cleanupBroadcastListeners();

    // Reset display control service
    displayControlService.reset();

    await resetAllServices();
  });

  describe('display:mode event', () => {
    it('should match AsyncAPI schema for display:idle-loop command', async () => {
      // Setup: Listen for display:mode BEFORE triggering
      const eventPromise = waitForEvent(socket, 'display:mode');

      // Trigger: Send display:idle-loop command
      sendGmCommand(socket, 'display:idle-loop', {});

      // Wait: For display:mode broadcast (via displayControlService EventEmitter → broadcasts.js)
      const event = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'display:mode');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Payload content (from displayControlService display:mode:changed event)
      expect(event.data.mode).toBe('IDLE_LOOP');
      expect(event.data).toHaveProperty('previousMode');

      // Validate: Against AsyncAPI contract schema
      validateWebSocketEvent(event, 'display:mode');
    });

    it('should match AsyncAPI schema for display:scoreboard command', async () => {
      const eventPromise = waitForEvent(socket, 'display:mode');

      // Trigger: Send display:scoreboard command
      sendGmCommand(socket, 'display:scoreboard', {});

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'display:mode');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data.mode).toBe('SCOREBOARD');
      expect(event.data).toHaveProperty('previousMode');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'display:mode');
    });

    it('should match AsyncAPI schema for display:return-to-video command', async () => {
      // Re-init displayControlService with VLC "connected" so playVideo succeeds
      displayControlService.reset();
      displayControlService.init({
        vlcService: {
          isConnected: () => true,
          returnToIdleLoop: async () => true,
          stop: async () => true,
          playVideo: async () => true
        },
        videoQueueService
      });

      // Re-register broadcast listeners with updated displayControlService
      cleanupBroadcastListeners();
      setupBroadcastListeners(testContext.io, {
        sessionService,
        stateService,
        videoQueueService,
        offlineQueueService,
        transactionService,
        displayControlService
      });

      // Step 1: Enter VIDEO mode
      const videoEventPromise = waitForEvent(socket, 'display:mode',
        (data) => data?.data?.mode === 'VIDEO');
      await displayControlService.playVideo('test-video.mp4');
      await videoEventPromise; // consume VIDEO mode event

      // Step 2: Set videoQueueService.currentItem to simulate a playing video
      videoQueueService.currentItem = { isPlaying: () => true };

      // Step 3: Switch to SCOREBOARD (overlay — VLC keeps playing)
      const sbEventPromise = waitForEvent(socket, 'display:mode',
        (data) => data?.data?.mode === 'SCOREBOARD');
      await displayControlService.setScoreboard();
      await sbEventPromise; // consume SCOREBOARD mode event

      // Step 4: Listen for return-to-video display:mode broadcast
      const eventPromise = waitForEvent(socket, 'display:mode',
        (data) => data?.data?.mode === 'VIDEO');

      // Trigger: Send display:return-to-video command via WebSocket
      sendGmCommand(socket, 'display:return-to-video', {});

      const event = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'display:mode');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.data.mode).toBe('VIDEO');
      expect(event.data).toHaveProperty('previousMode');

      // Validate: Against AsyncAPI contract schema
      validateWebSocketEvent(event, 'display:mode');

      // Cleanup: remove mock currentItem
      videoQueueService.currentItem = null;
    });

  });

  describe('display:status via ack', () => {
    it('should acknowledge display:status command with success', async () => {
      // display:status returns success ack; actual display state comes via service:state
      const ackPromise = waitForEvent(socket, 'gm:command:ack');

      sendGmCommand(socket, 'display:status', {});

      const ack = await ackPromise;

      expect(ack).toHaveProperty('event', 'gm:command:ack');
      expect(ack).toHaveProperty('data');
      expect(ack.data.success).toBe(true);
      expect(ack.data.action).toBe('display:status');
      expect(ack.data.message).toBeDefined();
    });
  });
});
