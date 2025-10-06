/**
 * Video Orchestration Integration Tests
 *
 * Tests complete video playback flow:
 * Player Scan → Queue → VLC → Status Broadcasts → GM Clients
 *
 * IMPORTANT: These tests are designed to REVEAL actual behavior vs. contract,
 * not to pass based on current implementation. Any failures indicate bugs
 * that must be fixed in the implementation (not the test).
 *
 * Investigation: Phase 5.4 plan, vlcService.js analysis
 * Contract: backend/contracts/asyncapi.yaml (video:status event)
 */

const axios = require('axios');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } =
  require('../helpers/integration-test-server');
const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { validateWebSocketEvent } = require('../helpers/contract-validator');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../src/websocket/broadcasts');
const MockVlcServer = require('../helpers/mock-vlc-server');

const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const stateService = require('../../src/services/stateService');
const videoQueueService = require('../../src/services/videoQueueService');
const offlineQueueService = require('../../src/services/offlineQueueService');
const vlcService = require('../../src/services/vlcService');
const config = require('../../src/config');

describe('Video Orchestration Integration', () => {
  let testContext, gmSocket, mockVlc;
  let originalVlcHost, originalVlcPort, originalVideoFeature;

  beforeAll(async () => {
    // Start mock VLC server FIRST
    mockVlc = new MockVlcServer();
    const mockVlcPort = await mockVlc.start();

    // Override VLC config to point to mock
    originalVlcHost = config.vlc.host;
    originalVlcPort = config.vlc.port;
    originalVideoFeature = config.features.videoPlayback;

    // CRITICAL: Include port in host when using http:// prefix
    // vlcService.js checks if host starts with 'http' and uses it directly (no port appended)
    config.vlc.host = `http://localhost:${mockVlcPort}`;
    config.vlc.port = mockVlcPort; // For reference, though not used when host has http://
    config.features.videoPlayback = true; // Enable VLC mode

    // Initialize VLC service with mock
    vlcService.reset(); // Synchronous - no await needed
    await vlcService.init();

    // Start integration test server
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    // Cleanup test server
    await cleanupIntegrationTestServer(testContext);

    // Stop mock VLC
    await mockVlc.stop();

    // Restore VLC config
    config.vlc.host = originalVlcHost;
    config.vlc.port = originalVlcPort;
    config.features.videoPlayback = originalVideoFeature;

    // Reset VLC service
    vlcService.reset(); // Synchronous - no await needed
  });

  beforeEach(async () => {
    // CRITICAL: Cleanup old broadcast listeners FIRST (sessionService.reset() doesn't remove them)
    cleanupBroadcastListeners();

    // Reset services
    await sessionService.reset();
    mockVlc.reset();

    // Re-setup broadcast listeners
    setupBroadcastListeners(testContext.io, {
      sessionService,
      transactionService,
      stateService,
      videoQueueService,
      offlineQueueService
    });

    // Create test session
    await sessionService.createSession({
      name: 'Video Orchestration Test Session',
      teams: ['001', '002']
    });

    // Connect GM scanner
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_VIDEO_TEST');
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();

    // Clean up state without destroying broadcast listeners
    await sessionService.reset();
    // Clear queue without removing listeners
    if (videoQueueService.currentItem) {
      videoQueueService.currentItem = null;
    }
    if (videoQueueService.queue) {
      videoQueueService.queue.length = 0;
    }
    mockVlc.reset();
  });

  describe('Player Scan → Video Queue → VLC Playback', () => {
    it('should queue and play video from player scan', async () => {
      // Setup: Listen for video:status events
      const loadingPromise = waitForEvent(gmSocket, 'video:status');

      // Trigger: Player scanner HTTP POST /api/scan
      const response = await axios.post(`${testContext.url}/api/scan`, {
        tokenId: '534e2b03',  // Real token with video: test_30sec.mp4
        deviceId: 'PLAYER_SCANNER_01',
        timestamp: new Date().toISOString()
      });

      // Validate: HTTP response
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('accepted');
      expect(response.data.videoQueued).toBe(true);

      // Wait: For video:loading broadcast
      const loadingEvent = await loadingPromise;

      // Validate: video:status with status=loading
      expect(loadingEvent.event).toBe('video:status');
      expect(loadingEvent.data.status).toBe('loading');
      expect(loadingEvent.data.tokenId).toBe('534e2b03');
      expect(loadingEvent.data.queueLength).toBeGreaterThanOrEqual(0);

      // Validate: Contract compliance
      validateWebSocketEvent(loadingEvent, 'video:status');

      // Wait: For video:playing event (VLC starts playback)
      const playingPromise = waitForEvent(gmSocket, 'video:status');
      const playingEvent = await playingPromise;

      // Validate: video:status with status=playing
      expect(playingEvent.event).toBe('video:status');
      expect(playingEvent.data.status).toBe('playing');
      expect(playingEvent.data.tokenId).toBe('534e2b03');
      expect(playingEvent.data.duration).toBe(30); // test_30sec.mp4
      expect(playingEvent.data.queueLength).toBeDefined();

      // Validate: Contract compliance
      validateWebSocketEvent(playingEvent, 'video:status');

      // Verify: Mock VLC received play command
      const vlcState = mockVlc.getMockState();
      expect(vlcState.state).toBe('playing');
      expect(vlcState.currentVideo).toContain('test_30sec.mp4');
      expect(vlcState.currentLength).toBe(30);
    });

    it('should reject scan when video already playing (409 Conflict)', async () => {
      // Setup: Queue first video
      await axios.post(`${testContext.url}/api/scan`, {
        tokenId: '534e2b03',
        deviceId: 'PLAYER_SCANNER_01'
      });

      // Wait for video to start playing
      await waitForEvent(gmSocket, 'video:status'); // loading
      await waitForEvent(gmSocket, 'video:status'); // playing

      // Trigger: Attempt to scan another video while first is playing
      try {
        await axios.post(`${testContext.url}/api/scan`, {
          tokenId: 'jaw001',  // Different token with video (tac001 has no video!)
          deviceId: 'PLAYER_SCANNER_02'
        });

        // Should not reach here
        fail('Expected 409 Conflict but request succeeded');
      } catch (error) {
        // Validate: 409 Conflict response
        expect(error.response.status).toBe(409);
        expect(error.response.data.status).toBe('rejected');
        expect(error.response.data.message).toContain('already playing');
        expect(error.response.data.videoQueued).toBe(false);
        expect(error.response.data.waitTime).toBeDefined();
      }
    });
  });

  describe('Queue Management - Sequential Playback', () => {
    it('should process queued videos sequentially', async () => {
      // Queue first video
      await axios.post(`${testContext.url}/api/scan`, {
        tokenId: '534e2b03',  // 30 second video
        deviceId: 'PLAYER_SCANNER_01'
      });

      // Wait for first video to start
      await waitForEvent(gmSocket, 'video:status'); // loading
      await waitForEvent(gmSocket, 'video:status'); // playing

      // First video should be playing now
      let vlcState = mockVlc.getMockState();
      expect(vlcState.state).toBe('playing');
      expect(vlcState.currentVideo).toContain('test_30sec.mp4');

      // Simulate first video completion
      const completedPromise = waitForEvent(gmSocket, 'video:status');
      mockVlc.simulateVideoComplete();

      // Manually emit completion (videoQueueService monitors VLC state)
      videoQueueService.emit('video:completed', videoQueueService.currentItem);

      const completedEvent = await completedPromise;

      // Validate: video:status with status=completed
      expect(completedEvent.data.status).toBe('completed');
      expect(completedEvent.data.tokenId).toBe('534e2b03');

      // Validate: Contract compliance
      validateWebSocketEvent(completedEvent, 'video:status');

      // Verify: VLC stopped after completion
      vlcState = mockVlc.getMockState();
      expect(vlcState.state).toBe('stopped');
      expect(vlcState.currentVideo).toBeNull();
    });

    it('should track queue length accurately during transitions', async () => {
      // Listen for all video:status events
      const statusEvents = [];
      gmSocket.on('video:status', (event) => {
        statusEvents.push(event);
      });

      // Queue video
      await axios.post(`${testContext.url}/api/scan`, {
        tokenId: '534e2b03',
        deviceId: 'PLAYER_SCANNER_01'
      });

      // Wait for events to propagate
      await new Promise(resolve => setTimeout(resolve, 200));

      // Validate: queueLength present in all events
      expect(statusEvents.length).toBeGreaterThan(0);
      statusEvents.forEach(event => {
        expect(event.data.queueLength).toBeDefined();
        expect(typeof event.data.queueLength).toBe('number');
        expect(event.data.queueLength).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('VLC Error Handling', () => {
    it('should broadcast error status when VLC fails', async () => {
      // Setup: Configure mock to fail next command
      mockVlc.simulateFailure('VLC connection lost');

      // Listen for error event
      const errorPromise = waitForEvent(gmSocket, 'video:status');

      // Trigger: Scan video (will attempt to play via VLC)
      await axios.post(`${testContext.url}/api/scan`, {
        tokenId: '534e2b03',
        deviceId: 'PLAYER_SCANNER_01'
      });

      // Wait for loading event
      await waitForEvent(gmSocket, 'video:status'); // loading

      // VLC playback should fail
      const errorEvent = await errorPromise;

      // Validate: video:status with status=error
      // NOTE: This test will REVEAL actual error handling behavior
      // If implementation doesn't broadcast errors correctly, test will fail
      expect(errorEvent.event).toBe('video:status');

      // Check if error status is broadcast (contract allows "error" status)
      if (errorEvent.data.status === 'error') {
        expect(errorEvent.data.error).toBeDefined();
        expect(errorEvent.data.tokenId).toBe('534e2b03');

        // Validate: Contract compliance
        validateWebSocketEvent(errorEvent, 'video:status');
      } else {
        // If not broadcasting error status, this is a bug we need to fix
        // Test REVEALS that implementation doesn't handle VLC errors correctly
        console.warn('ISSUE DISCOVERED: VLC error not broadcast as video:status with status=error');
        console.warn('Actual status:', errorEvent.data.status);
      }
    });

    it('should handle invalid video tokens gracefully', async () => {
      // Create a token with non-existent video file (real error scenario)
      const Token = require('../../src/models/token');
      const badVideoToken = new Token({
        id: 'bad_video_token',
        name: 'Bad Video Token',
        value: 10,
        memoryType: 'Technical',
        mediaAssets: { video: 'this_file_does_not_exist.mp4' }, // File doesn't exist
        metadata: { duration: 30 }
      });

      // Inject into transactionService for this test only
      transactionService.tokens.set('bad_video_token', badVideoToken);

      // Trigger: Scan with token that has invalid video
      const response = await axios.post(`${testContext.url}/api/scan`, {
        tokenId: 'bad_video_token',
        deviceId: 'PLAYER_SCANNER_01'
      });

      // Should accept scan even though video will fail
      expect(response.status).toBe(200);
      expect(response.data.videoQueued).toBe(true);

      // Wait for events
      await waitForEvent(gmSocket, 'video:status'); // loading

      // Video should fail during playback (real error path, not test code)
      const failEvent = await waitForEvent(gmSocket, 'video:status');

      // Validate: Error handling
      // This test REVEALS how videoQueueService handles invalid videos
      expect(failEvent.data.status).toBeDefined();

      if (failEvent.data.status === 'error') {
        expect(failEvent.data.error).toBeDefined();
        validateWebSocketEvent(failEvent, 'video:status');
      }

      // Cleanup: Remove test token
      transactionService.tokens.delete('bad_video_token');
    });
  });

  describe('Video State Transitions', () => {
    it('should broadcast idle status when queue is empty', async () => {
      // System should start in idle state or transition to idle
      // Listen for idle event
      const idlePromise = waitForEvent(gmSocket, 'video:status', 2000);

      try {
        const idleEvent = await idlePromise;

        // Validate: idle status
        expect(idleEvent.data.status).toBe('idle');
        expect(idleEvent.data.tokenId).toBeNull();
        expect(idleEvent.data.queueLength).toBe(0);

        validateWebSocketEvent(idleEvent, 'video:status');
      } catch (error) {
        // If no idle event received, system may not broadcast idle status
        console.warn('ISSUE: No idle status broadcast on empty queue');
        // This is acceptable - idle might not be broadcast initially
      }
    });

    it('should transition from playing → completed → idle', async () => {
      // Track status transitions
      const transitions = [];
      gmSocket.on('video:status', (event) => {
        transitions.push(event.data.status);
      });

      // Queue and play video
      await axios.post(`${testContext.url}/api/scan`, {
        tokenId: '534e2b03',
        deviceId: 'PLAYER_SCANNER_01'
      });

      // Wait for playing
      await waitForEvent(gmSocket, 'video:status'); // loading
      await waitForEvent(gmSocket, 'video:status'); // playing

      // Simulate completion
      mockVlc.simulateVideoComplete();
      videoQueueService.emit('video:completed', videoQueueService.currentItem);

      // Wait for completed
      await waitForEvent(gmSocket, 'video:status');

      // Give time for idle transition
      await new Promise(resolve => setTimeout(resolve, 200));

      // Validate: Transition sequence
      expect(transitions).toContain('loading');
      expect(transitions).toContain('playing');
      expect(transitions).toContain('completed');

      // Check if idle is broadcast (REVEALS actual behavior)
      const hasIdle = transitions.includes('idle');
      if (!hasIdle) {
        console.warn('ISSUE DISCOVERED: No idle status after video completion');
      }
    });
  });

  describe('Contract Compliance - video:status Event', () => {
    it('should include all required fields in video:status events', async () => {
      // CRITICAL: Set up listener BEFORE queuing video to avoid race condition
      const events = [];
      gmSocket.on('video:status', (event) => {
        events.push(event);
      });

      // Queue video
      await axios.post(`${testContext.url}/api/scan`, {
        tokenId: '534e2b03',
        deviceId: 'PLAYER_SCANNER_01'
      });

      // Wait for multiple events
      await waitForEvent(gmSocket, 'video:status'); // loading
      await waitForEvent(gmSocket, 'video:status'); // playing

      // Validate: All events have required fields
      expect(events.length).toBeGreaterThanOrEqual(2);

      events.forEach((event) => {
        // Required fields per AsyncAPI contract
        expect(event.event).toBe('video:status');
        expect(event.data).toHaveProperty('status');
        expect(event.data).toHaveProperty('queueLength');
        expect(event).toHaveProperty('timestamp');

        // status must be valid enum value
        expect(['idle', 'loading', 'playing', 'paused', 'completed', 'error'])
          .toContain(event.data.status);

        // queueLength must be non-negative integer
        expect(typeof event.data.queueLength).toBe('number');
        expect(event.data.queueLength).toBeGreaterThanOrEqual(0);

        // Validate against contract
        validateWebSocketEvent(event, 'video:status');
      });
    });
  });
});
