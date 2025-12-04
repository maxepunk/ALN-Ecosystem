/**
 * Display Events - Contract Validation Tests
 * Tests display:mode and display:status events against AsyncAPI schema
 *
 * Phase 4.2: HDMI Display Control state machine
 * Layer 3 (Contract): Validates event structure, NOT business logic flow
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
    setupBroadcastListeners(testContext.io, {
      sessionService,
      stateService,
      videoQueueService,
      offlineQueueService,
      transactionService
    });

    // Create session (needed for GM authentication)
    await sessionService.createSession({
      name: 'Display Test Session',
      teams: ['Team Alpha', 'Detectives']
    });

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

      // Wait: For display:mode broadcast
      const event = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'display:mode');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Payload content
      expect(event.data.mode).toBe('IDLE_LOOP');
      expect(event.data).toHaveProperty('changedBy');

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
      expect(event.data).toHaveProperty('changedBy');

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
      expect(event.data).toHaveProperty('changedBy');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'display:mode');
    });

    it('should match AsyncAPI schema for display:toggle command (SCOREBOARD -> IDLE_LOOP)', async () => {
      // First switch to SCOREBOARD
      await displayControlService.setScoreboard();
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
      expect(event.data).toHaveProperty('changedBy');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'display:mode');
    });
  });

  describe('display:status event', () => {
    it('should match AsyncAPI schema for display:status command', async () => {
      // Setup: Listen for display:status BEFORE triggering
      const eventPromise = waitForEvent(socket, 'display:status');

      // Trigger: Send display:status command
      sendGmCommand(socket, 'display:status', {});

      // Wait: For display:status response
      const event = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'display:status');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Payload content
      expect(event.data).toHaveProperty('currentMode');
      expect(event.data).toHaveProperty('previousMode');
      expect(event.data).toHaveProperty('timestamp');
      expect(['IDLE_LOOP', 'SCOREBOARD', 'VIDEO']).toContain(event.data.currentMode);
      expect(['IDLE_LOOP', 'SCOREBOARD', 'VIDEO']).toContain(event.data.previousMode);

      // Validate: Against AsyncAPI contract schema
      validateWebSocketEvent(event, 'display:status');
    });

    it('should return correct status after mode changes', async () => {
      // Switch to SCOREBOARD first
      await displayControlService.setScoreboard();

      const eventPromise = waitForEvent(socket, 'display:status');

      // Trigger: Send display:status command
      sendGmCommand(socket, 'display:status', {});

      const event = await eventPromise;

      // Validate: Current mode is SCOREBOARD
      expect(event.data.currentMode).toBe('SCOREBOARD');
      expect(event.data.previousMode).toBe('IDLE_LOOP');
      expect(event.data.pendingVideo).toBeNull();

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'display:status');
    });
  });
});
