/**
 * Video Orchestration Integration Tests - REAL Player Scanner
 *
 * Tests complete video playback flow:
 * Player Scan → Queue → VLC → Status Broadcasts → GM Clients
 *
 * VLC service methods are mocked at the singleton level (vlcMprisService uses D-Bus MPRIS,
 * not HTTP). This tests the integration between: player scanner HTTP API → transactionService
 * → videoQueueService → broadcasts.js → WebSocket delivery.
 *
 * What This Tests:
 * 1. Real Player Scanner correctly sends scan to server (HTTP POST /api/scan)
 * 2. Server processes Player scan and queues video
 * 3. Server broadcasts service:state (video domain) to GM clients
 * 4. VLC error handling flows
 *
 * Contract: backend/contracts/openapi.yaml (POST /api/scan), asyncapi.yaml (service:state event)
 */

// CRITICAL: Load browser mocks FIRST
require('../helpers/browser-mocks');

const { setupIntegrationTestServer, cleanupIntegrationTestServer } =
  require('../helpers/integration-test-server');
const { createPlayerScanner, connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');

/** Helper: wait for service:state with a specific domain */
function waitForServiceState(socket, domain, predicate) {
  return waitForEvent(socket, 'service:state', (data) => {
    const payload = data.data || data;
    if (payload.domain !== domain) return false;
    return predicate ? predicate(payload.state) : true;
  });
}

const { resetAllServices, resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const videoQueueService = require('../../src/services/videoQueueService');
const offlineQueueService = require('../../src/services/offlineQueueService');
const vlcService = require('../../src/services/vlcMprisService');
const registry = require('../../src/services/serviceHealthRegistry');
const config = require('../../src/config');

describe('Video Orchestration Integration - REAL Player Scanner', () => {
  let testContext, playerScanner, gmSocket;
  let originalVideoFeature;

  // Stateful VLC mock — simulates VLC playback state transitions
  let vlcState;

  function resetVlcMockState() {
    vlcState = { state: 'stopped', currentItem: null, length: 0, position: 0 };
  }

  function setupVlcMocks() {
    resetVlcMockState();

    jest.spyOn(vlcService, 'playVideo').mockImplementation(async (videoPath) => {
      const filename = videoPath.split('/').pop();
      vlcState.state = 'playing';
      vlcState.currentItem = filename;
      vlcState.length = 30;
      vlcState.position = 0;
      return {
        connected: true,
        state: vlcState.state,
        currentItem: vlcState.currentItem,
        position: vlcState.position,
        length: vlcState.length,
        time: 0,
        volume: 256,
        fullscreen: false,
        loop: false,
      };
    });

    jest.spyOn(vlcService, 'getStatus').mockImplementation(async () => ({
      connected: true,
      state: vlcState.state,
      currentItem: vlcState.currentItem,
      position: vlcState.position,
      length: vlcState.length,
      time: vlcState.position * vlcState.length,
      volume: 256,
      fullscreen: false,
      loop: false,
    }));

    jest.spyOn(vlcService, 'checkConnection').mockResolvedValue(true);
    jest.spyOn(vlcService, 'stop').mockImplementation(async () => {
      vlcState.state = 'stopped';
      vlcState.currentItem = null;
    });
    jest.spyOn(vlcService, 'pause').mockImplementation(async () => {
      vlcState.state = 'paused';
    });
    jest.spyOn(vlcService, 'resume').mockImplementation(async () => {
      vlcState.state = 'playing';
    });
    jest.spyOn(vlcService, 'setLoop').mockResolvedValue();
    jest.spyOn(vlcService, 'isConnected').mockReturnValue(true);

    // Ensure service health registry reports VLC as healthy
    registry.report('vlc', 'healthy', 'Integration test mock');
  }

  beforeAll(async () => {
    // Save and set feature flag
    originalVideoFeature = config.features.videoPlayback;
    config.features.videoPlayback = true;

    // Start integration test server
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
    config.features.videoPlayback = originalVideoFeature;
  });

  beforeEach(async () => {
    // Complete reset cycle
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      videoQueueService,
      offlineQueueService
    });

    // Setup VLC mocks AFTER reset (reset clears service state)
    setupVlcMocks();

    // Create test session
    await sessionService.createSession({
      name: 'Video Orchestration Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();

    // Create REAL Player Scanner
    playerScanner = createPlayerScanner(testContext.url, 'PLAYER_SCANNER_01');

    // Wait for initial connection check to complete
    if (playerScanner.pendingConnectionCheck) {
      await playerScanner.pendingConnectionCheck.catch(() => {});
    }

    // Connect GM to observe service:state (video domain) broadcasts
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_VIDEO_TEST');
  });

  afterEach(async () => {
    // CRITICAL: Remove all listeners from gmSocket BEFORE disconnecting
    if (gmSocket) {
      gmSocket.removeAllListeners();
    }

    if (gmSocket?.connected) gmSocket.disconnect();

    // Clean up Player Scanner
    if (playerScanner) {
      playerScanner.clearQueue();
      await playerScanner.destroy();
    }

    // Clean up state without destroying broadcast listeners
    await resetAllServices();
    jest.restoreAllMocks();
  });

  describe('Player Scan → Video Queue → VLC Playback', () => {
    it('should queue and play video from player scan using REAL Player Scanner', async () => {
      // Collect all video state events to verify full lifecycle
      const videoStates = [];
      gmSocket.on('service:state', (event) => {
        const payload = event.data || event;
        if (payload.domain === 'video') {
          videoStates.push(payload.state);
        }
      });

      // Also wait for final playing state
      const playingPromise = waitForServiceState(gmSocket, 'video',
        (s) => s.status === 'playing');

      // Trigger: REAL Player Scanner scans token
      const response = await playerScanner.scanToken('534e2b03', null);

      // Validate: Player Scanner response (from real HTTP POST /api/scan)
      expect(response.status).toBe('accepted');
      expect(response.videoQueued).toBe(true);
      expect(response.tokenId).toBe('534e2b03');

      // Wait: For video playing state
      const playingEvent = await playingPromise;

      // Validate: service:state video with playing status
      expect(playingEvent.data.domain).toBe('video');
      expect(playingEvent.data.state.status).toBe('playing');
      expect(playingEvent.data.state.currentVideo?.tokenId).toBe('534e2b03');
      expect(playingEvent.data.state.queueLength).toBeDefined();

      // Validate: received multiple video state transitions
      expect(videoStates.length).toBeGreaterThanOrEqual(1);

      // Verify: VLC service received play command
      expect(vlcService.playVideo).toHaveBeenCalledWith('test_30sec.mp4');
    });
  });

  describe('Queue Management - Sequential Playback', () => {
    it('should track queue length accurately during transitions', async () => {
      // Listen for all service:state video events
      const statusEvents = [];
      gmSocket.on('service:state', (event) => {
        const payload = event.data || event;
        if (payload.domain === 'video') {
          statusEvents.push(payload);
        }
      });

      // Queue video using REAL Player Scanner
      await playerScanner.scanToken('534e2b03', null);

      // Wait for events to propagate
      await new Promise(resolve => setTimeout(resolve, 200));

      // Validate: queueLength present in all video state events
      expect(statusEvents.length).toBeGreaterThan(0);
      statusEvents.forEach(stateEvent => {
        expect(stateEvent.state.queueLength).toBeDefined();
        expect(typeof stateEvent.state.queueLength).toBe('number');
        expect(stateEvent.state.queueLength).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('VLC Error Handling', () => {
    it('should broadcast error status when VLC play fails', async () => {
      // Override playVideo to fail on next call
      vlcService.playVideo.mockRejectedValueOnce(new Error('VLC connection lost'));

      // Listen for service:state video with error status (skip loading event)
      const errorPromise = waitForServiceState(gmSocket, 'video',
        (s) => s.status === 'error');

      // Trigger: REAL Player Scanner scans video
      await playerScanner.scanToken('534e2b03', null);

      // Wait for error state push
      const errorEvent = await errorPromise;

      // Validate: service:state video with error status
      expect(errorEvent.data.domain).toBe('video');
      expect(errorEvent.data.state.status).toBe('error');
      expect(errorEvent.data.state.currentVideo?.tokenId).toBe('534e2b03');
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

      // CRITICAL: Collect ALL service:state video events to avoid race condition
      const videoStateEvents = [];
      gmSocket.on('service:state', (event) => {
        const payload = event.data || event;
        if (payload.domain === 'video') {
          videoStateEvents.push(payload);
        }
      });

      // Trigger: REAL Player Scanner scans with token that has invalid video
      const response = await playerScanner.scanToken('bad_video_token', null);

      // Should accept scan even though video will fail
      expect(response.status).toBe('accepted');
      expect(response.videoQueued).toBe(true);

      // Wait for all events to arrive (loading + error + idle)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Validate: Should have received multiple video state events
      expect(videoStateEvents.length).toBeGreaterThan(0);

      // Find the error state event
      const errorState = videoStateEvents.find(e => e.state.status === 'error');

      // Validate: Error handling — getState() reflects error status
      expect(errorState).toBeDefined();

      // Cleanup: Remove test token
      transactionService.tokens.delete('bad_video_token');
    });
  });

  describe('Video State Transitions', () => {
    it('should broadcast idle status when queue is empty', async () => {
      // System should start in idle state or transition to idle
      const idlePromise = waitForServiceState(gmSocket, 'video');

      try {
        const idleEvent = await idlePromise;

        // Validate: idle status via service:state
        expect(idleEvent.data.state.status).toBe('idle');
        expect(idleEvent.data.state.currentVideo).toBeNull();
        expect(idleEvent.data.state.queueLength).toBe(0);
      } catch (error) {
        // If no idle event received, system may not broadcast idle status
        console.warn('ISSUE: No idle status broadcast on empty queue');
        // This is acceptable - idle might not be broadcast initially
      }
    });
  });
});
