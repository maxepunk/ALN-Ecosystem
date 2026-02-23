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

    it('should match AsyncAPI schema for display:toggle command (IDLE_LOOP -> SCOREBOARD)', async () => {
      // Ensure we're starting in IDLE_LOOP mode
      expect(displayControlService.getCurrentMode()).toBe('IDLE_LOOP');

      const eventPromise = waitForEvent(socket, 'display:mode');

      // Trigger: Send display:toggle command
      sendGmCommand(socket, 'display:toggle', {});

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'display:mode');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content (toggled to SCOREBOARD)
      expect(event.data.mode).toBe('SCOREBOARD');
      expect(event.data).toHaveProperty('previousMode');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'display:mode');
    });

    it('should match AsyncAPI schema for display:toggle command (SCOREBOARD -> IDLE_LOOP)', async () => {
      // First switch to SCOREBOARD and consume that broadcast
      const setupPromise = waitForEvent(socket, 'display:mode');
      await displayControlService.setScoreboard();
      await setupPromise;
      expect(displayControlService.getCurrentMode()).toBe('SCOREBOARD');

      const eventPromise = waitForEvent(socket, 'display:mode');

      // Trigger: Send display:toggle command
      sendGmCommand(socket, 'display:toggle', {});

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'display:mode');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content (toggled back to IDLE_LOOP)
      expect(event.data.mode).toBe('IDLE_LOOP');
      expect(event.data).toHaveProperty('previousMode');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'display:mode');
    });
  });

  describe('display:status via ack', () => {
    it('should include display status in gm:command:ack data', async () => {
      // display:status is now returned via gm:command:ack data field (not a separate broadcast)
      const ackPromise = waitForEvent(socket, 'gm:command:ack');

      // Trigger: Send display:status command
      sendGmCommand(socket, 'display:status', {});

      // Wait: For ack response
      const ack = await ackPromise;

      // Validate: Ack structure
      expect(ack).toHaveProperty('event', 'gm:command:ack');
      expect(ack).toHaveProperty('data');
      expect(ack.data.success).toBe(true);
      expect(ack.data.action).toBe('display:status');

      // Validate: Display status in ack data
      expect(ack.data.data).toBeDefined();
      expect(ack.data.data.displayStatus).toBeDefined();
      expect(ack.data.data.displayStatus).toHaveProperty('currentMode');
      expect(ack.data.data.displayStatus).toHaveProperty('previousMode');
      expect(ack.data.data.displayStatus).toHaveProperty('timestamp');
      expect(['IDLE_LOOP', 'SCOREBOARD', 'VIDEO']).toContain(ack.data.data.displayStatus.currentMode);
      expect(['IDLE_LOOP', 'SCOREBOARD', 'VIDEO']).toContain(ack.data.data.displayStatus.previousMode);
    });

    it('should return correct status after mode changes', async () => {
      // Switch to SCOREBOARD first
      await displayControlService.setScoreboard();

      const ackPromise = waitForEvent(socket, 'gm:command:ack');

      // Trigger: Send display:status command
      sendGmCommand(socket, 'display:status', {});

      const ack = await ackPromise;

      // Validate: Current mode is SCOREBOARD
      expect(ack.data.data.displayStatus.currentMode).toBe('SCOREBOARD');
      expect(ack.data.data.displayStatus.previousMode).toBe('IDLE_LOOP');
      expect(ack.data.data.displayStatus.pendingVideo).toBeNull();
    });
  });
});
