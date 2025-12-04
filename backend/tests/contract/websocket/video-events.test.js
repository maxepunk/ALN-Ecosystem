/**
 * Video Events - Contract Validation Tests
 * Tests video:status event for all 6 status types against AsyncAPI schema
 *
 * Layer 3 (Contract): Validates event structure, NOT business logic flow
 * Pattern B: Direct service emission (like score-events.test.js)
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const { resetAllServices } = require('../../helpers/service-reset');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../../src/websocket/broadcasts');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const stateService = require('../../../src/services/stateService');
const videoQueueService = require('../../../src/services/videoQueueService');
const offlineQueueService = require('../../../src/services/offlineQueueService');

describe('Video Events - Contract Validation', () => {
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

    // CRITICAL: Re-register broadcast listeners after resetAllServices
    // resetAllServices() calls videoQueueService.reset() which removes all listeners
    // We need the broadcast listeners to translate video:* events → video:status broadcasts
    setupBroadcastListeners(testContext.io, {
      sessionService,
      stateService,
      videoQueueService,
      offlineQueueService,
      transactionService
    });

    // Create session (not strictly needed for direct emission, but good practice)
    await sessionService.createSession({
      name: 'Video Test Session',
      teams: ['001', '002']
    });

    // Connect GM socket
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_VIDEO');
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }

    // Clean up broadcast listeners before resetAllServices to prevent leaks
    cleanupBroadcastListeners();

    await resetAllServices();

    // Clean up timers
    if (videoQueueService.playbackTimer) {
      clearTimeout(videoQueueService.playbackTimer);
      videoQueueService.playbackTimer = null;
    }
    if (videoQueueService.progressTimer) {
      clearInterval(videoQueueService.progressTimer);
      videoQueueService.progressTimer = null;
    }
    if (videoQueueService.fallbackTimer) {
      clearTimeout(videoQueueService.fallbackTimer);
      videoQueueService.fallbackTimer = null;
    }
  });

  describe('video:status event - all status types', () => {
    it('should match AsyncAPI schema for status=idle', async () => {
      // Setup: Listen for video:status BEFORE triggering
      const eventPromise = waitForEvent(socket, 'video:status');

      // Trigger: Directly emit video:idle event (Pattern B - no business logic)
      videoQueueService.emit('video:idle');

      // Wait: For video:status broadcast
      const event = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'video:status');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Payload content
      expect(event.data.status).toBe('idle');
      expect(event.data.tokenId).toBeNull();
      expect(event.data).toHaveProperty('queueLength');
      expect(typeof event.data.queueLength).toBe('number');

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'video:status');
    });

    it('should match AsyncAPI schema for status=loading', async () => {
      const eventPromise = waitForEvent(socket, 'video:status');

      // Trigger: Directly emit video:loading event
      videoQueueService.emit('video:loading', {
        tokenId: '534e2b03'
      });

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'video:status');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data.status).toBe('loading');
      expect(event.data.tokenId).toBe('534e2b03');
      expect(event.data).toHaveProperty('queueLength');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'video:status');
    });

    it('should match AsyncAPI schema for status=playing', async () => {
      const eventPromise = waitForEvent(socket, 'video:status');

      // Trigger: Directly emit video:started event (broadcasts as 'playing')
      videoQueueService.emit('video:started', {
        queueItem: {
          tokenId: 'test-video',
          filename: 'test.mp4'
        },
        duration: 120,
        expectedEndTime: new Date(Date.now() + 120000).toISOString()
      });

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'video:status');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data.status).toBe('playing');
      expect(event.data.tokenId).toBe('test-video');
      expect(event.data).toHaveProperty('queueLength');
      expect(event.data).toHaveProperty('duration');
      expect(event.data).toHaveProperty('expectedEndTime');
      expect(event.data).toHaveProperty('progress');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'video:status');
    });

    it('should match AsyncAPI schema for status=paused', async () => {
      const eventPromise = waitForEvent(socket, 'video:status');

      // Trigger: Directly emit video:paused event
      videoQueueService.emit('video:paused', {
        tokenId: 'paused-video',
        progress: 50
      });

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'video:status');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data.status).toBe('paused');
      expect(event.data.tokenId).toBe('paused-video');
      expect(event.data).toHaveProperty('queueLength');
      expect(event.data).toHaveProperty('progress');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'video:status');
    });

    it('should match AsyncAPI schema for status=completed', async () => {
      const eventPromise = waitForEvent(socket, 'video:status');

      // Trigger: Directly emit video:completed event
      videoQueueService.emit('video:completed', {
        tokenId: 'completed-video',
        filename: 'completed.mp4'
      });

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'video:status');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data.status).toBe('completed');
      expect(event.data.tokenId).toBe('completed-video');
      expect(event.data).toHaveProperty('queueLength');
      expect(event.data.progress).toBe(100);

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'video:status');
    });

    it('should match AsyncAPI schema for status=error', async () => {
      const eventPromise = waitForEvent(socket, 'video:status');

      // Trigger: Directly emit video:failed event (broadcasts as 'error')
      videoQueueService.emit('video:failed', {
        tokenId: 'failed-video',
        error: 'VLC connection lost'
      });

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'video:status');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data.status).toBe('error');
      expect(event.data.tokenId).toBe('failed-video');
      expect(event.data).toHaveProperty('queueLength');
      expect(event.data).toHaveProperty('error');
      expect(event.data.error).toBe('VLC connection lost');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'video:status');
    });
  });
});
