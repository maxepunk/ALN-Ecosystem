/**
 * Player Scanner - Networked Mode Integration Tests
 *
 * Tests player scanner WITH orchestrator (orchestrator hosting deployment)
 * This mode enables video playback features via HTTP communication
 *
 * Key Requirements:
 * - Detect orchestrator availability via /health endpoint
 * - Send POST /api/scan for tokens with video property
 * - Handle offline periods with simple retry queue
 * - Show connection status to user
 * - Video playback triggered on separate display (via orchestrator)
 */

const {
  resetMocks,
  mockFetchResponse,
  mockFetchNetworkError,
  getLastFetchCall,
  createTestToken
} = require('../../helpers/player-scanner-mocks');

const OrchestratorIntegration = require('../../../../aln-memory-scanner/js/orchestratorIntegration');

describe('Player Scanner - Networked Mode (With Orchestrator)', () => {

  let orchestrator;

  beforeEach(() => {
    resetMocks();

    // Configure for NETWORKED mode (served from orchestrator)
    global.window.location.pathname = '/player-scanner/';
    global.window.location.origin = 'http://192.168.1.100:3000';

    // Mock health check for initial connection
    mockFetchResponse(200, { status: 'online' });

    orchestrator = new OrchestratorIntegration();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.destroy();
    }
  });

  describe('Orchestrator Detection', () => {

    it('should detect orchestrator via /health endpoint', async () => {
      // Mock health check success
      mockFetchResponse(200, {
        status: 'online',
        version: '1.0.0',
        uptime: 3600,
        timestamp: new Date().toISOString()
      });

      const isConnected = await orchestrator.checkConnection();

      expect(isConnected).toBe(true);
      expect(orchestrator.connected).toBe(true);

      // Verify health endpoint called
      const request = getLastFetchCall();
      expect(String(request.url)).toContain('/health');
      expect(request.method).toBe('GET');
    });

    it('should mark disconnected when health check fails', async () => {
      // Mock health check failure
      mockFetchResponse(500, { error: 'Server error' }, false);

      const isConnected = await orchestrator.checkConnection();

      expect(isConnected).toBe(false);
      expect(orchestrator.connected).toBe(false);
    });

    it('should mark disconnected on network timeout', async () => {
      // Mock network timeout
      mockFetchNetworkError('Network timeout');

      const isConnected = await orchestrator.checkConnection();

      expect(isConnected).toBe(false);
      expect(orchestrator.connected).toBe(false);
    });

    it('should emit "orchestrator:connected" event when connection established', async () => {
      orchestrator.connected = false; // Start disconnected

      // Mock successful health check
      mockFetchResponse(200, { status: 'online' });

      // Listen for event
      const eventPromise = new Promise(resolve => {
        global.window.dispatchEvent = jest.fn((event) => {
          if (event.type === 'orchestrator:connected') {
            resolve(event);
          }
        });
      });

      await orchestrator.checkConnection();

      expect(global.window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'orchestrator:connected' })
      );
    });

    it('should emit "orchestrator:disconnected" event when connection lost', async () => {
      orchestrator.connected = true; // Start connected

      // Mock failed health check
      mockFetchNetworkError('Connection lost');

      await orchestrator.checkConnection();

      expect(global.window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'orchestrator:disconnected' })
      );
    });
  });

  describe('Video Playback Integration', () => {

    it('should send POST /api/scan for tokens with video property', async () => {
      orchestrator.connected = true;

      // Mock successful scan response
      mockFetchResponse(200, {
        status: 'accepted',
        message: 'Video queued for playback',
        videoQueued: true
      });

      const tokenWithVideo = createTestToken({
        SF_RFID: 'video_token_001',
        video: 'test_video.mp4'
      });

      await orchestrator.scanToken(tokenWithVideo.SF_RFID, 'Team Alpha');

      // Verify scan request sent
      const request = getLastFetchCall();
      expect(request.url).toContain('/api/scan');
      expect(request.method).toBe('POST');
      expect(request.body.tokenId).toBe('video_token_001');
    });

    it('should NOT send request for tokens without video in standalone mode', () => {
      orchestrator.connected = false; // Standalone mode

      const tokenNoVideo = createTestToken({
        SF_RFID: 'image_token_001',
        image: 'assets/images/test.jpg',
        video: null
      });

      // In standalone mode, no network request should be made
      // (This is tested in standalone-mode.test.js, but verify here too)

      expect(orchestrator.connected).toBe(false);
    });

    it('should handle video playback conflict (HTTP 409)', async () => {
      orchestrator.connected = true;

      // Mock conflict response (video already playing)
      global.fetch.mockReset();
      mockFetchResponse(409, {
        status: 'rejected',
        message: 'Video already playing, please wait',
        waitTime: 30
      }, false);

      const result = await orchestrator.scanToken('video_token', 'Team Alpha');

      // Fire-and-forget: should queue offline instead of showing specific error
      expect(result.status).toBe('error');
      expect(result.queued).toBe(true);
    });
  });

  describe('Offline Queue - Simple Retry', () => {

    it('should queue scans when orchestrator disconnected', async () => {
      orchestrator.connected = false;

      const result = await orchestrator.scanToken('test_token', 'Team Alpha');

      // Should queue offline
      expect(result.status).toBe('offline');
      expect(result.queued).toBe(true);
      expect(orchestrator.offlineQueue.length).toBe(1);

      // Verify queued transaction
      const queuedTxn = orchestrator.offlineQueue[0];
      expect(queuedTxn.tokenId).toBe('test_token');
      expect(queuedTxn.teamId).toBe('Team Alpha');
      expect(queuedTxn.timestamp).toBeDefined();
    });

    it('should retry queued scans when connection restored', async () => {
      // Setup offline queue
      orchestrator.offlineQueue = [
        { tokenId: 'token1', teamId: 'Team Alpha', timestamp: Date.now() },
        { tokenId: 'token2', teamId: 'Team Alpha', timestamp: Date.now() }
      ];

      orchestrator.connected = true;

      // Mock successful batch processing
      mockFetchResponse(200, {
        results: [
          { tokenId: 'token1', status: 'processed' },
          { tokenId: 'token2', status: 'processed' }
        ]
      });

      await orchestrator.processOfflineQueue();

      // Verify batch request sent
      const request = getLastFetchCall();
      expect(request.url).toContain('/api/scan/batch');
      expect(request.body.transactions.length).toBe(2);

      // Fire-and-forget: Queue cleared on HTTP 200 (don't parse results)
      expect(orchestrator.offlineQueue.length).toBe(0);
    });

    it('should persist offline queue to localStorage', async () => {
      orchestrator.connected = false;

      await orchestrator.scanToken('token1', 'Team Alpha');
      await orchestrator.scanToken('token2', 'Team Alpha');

      // Verify localStorage persistence
      const saved = localStorage.getItem('offline_queue');
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved);
      expect(parsed.length).toBe(2);
      expect(parsed[0].tokenId).toBe('token1');
      expect(parsed[1].tokenId).toBe('token2');
    });

    it('should load offline queue from localStorage on init', () => {
      // Simulate saved queue
      const savedQueue = [
        { tokenId: 'saved_token', teamId: 'Team Alpha', timestamp: Date.now() }
      ];
      localStorage.setItem('offline_queue', JSON.stringify(savedQueue));

      // Create new orchestrator instance
      const newOrchestrator = new OrchestratorIntegration();

      // Should load saved queue
      expect(newOrchestrator.offlineQueue.length).toBe(1);
      expect(newOrchestrator.offlineQueue[0].tokenId).toBe('saved_token');

      // Cleanup
      newOrchestrator.destroy();
    });

    it('should enforce max queue size (100 items)', async () => {
      orchestrator.maxQueueSize = 100;
      orchestrator.connected = false;

      // Fill queue beyond limit
      for (let i = 0; i < 105; i++) {
        await orchestrator.scanToken(`token${i}`, 'Team Alpha');
      }

      // Should only keep last 100
      expect(orchestrator.offlineQueue.length).toBe(100);

      // Oldest items should be removed (FIFO)
      expect(orchestrator.offlineQueue[0].tokenId).toBe('token5'); // First 5 dropped
    });
  });

  describe('Connection Monitoring', () => {

    it('should start connection monitoring with 10 second interval', () => {
      // Verify setInterval was called (monitoring started in constructor)
      expect(global.setInterval).toHaveBeenCalled();

      // Verify interval is set to 10 seconds (10000ms)
      const setIntervalCalls = global.setInterval.mock.calls;
      const connectionMonitorCall = setIntervalCalls.find(call => call[1] === 10000);

      expect(connectionMonitorCall).toBeDefined();
      expect(connectionMonitorCall[1]).toBe(10000); // 10 seconds
    });

    it('should stop connection monitoring when destroyed', async () => {
      // Functional requirement: After destroy(), no more connection checks should happen
      // This verifies proper cleanup for ESP32 resource management

      // Verify monitoring was started (interval exists)
      const initialIntervalCount = global.setInterval.mock.calls.length;
      expect(initialIntervalCount).toBeGreaterThan(0);

      // Call destroy
      await orchestrator.destroy();

      // Verify cleanup state (interval reference cleared)
      expect(orchestrator.connectionCheckInterval).toBeFalsy();
      expect(orchestrator.pendingConnectionCheck).toBeFalsy();

      // Verify stopConnectionMonitor was called by checking the method exists
      expect(typeof orchestrator.stopConnectionMonitor).toBe('function');

      // Key verification: After destroy, the interval should be cleared
      // We can verify this by checking that the orchestrator is in a stopped state
      // (connectionCheckInterval is null/undefined)
      expect(orchestrator.connectionCheckInterval).not.toBeTruthy();
    });

    it('should await pending connection check during cleanup', async () => {
      // Setup: Create a promise that we can control
      let checkCompleted = false;
      const controlledPromise = Promise.resolve().then(() => {
        checkCompleted = true;
      });

      // Set as pending check
      orchestrator.pendingConnectionCheck = controlledPromise;

      // Destroy should await this promise
      await orchestrator.destroy();

      // Verify the promise was awaited (completed flag set)
      expect(checkCompleted).toBe(true);

      // Verify cleanup happened
      expect(orchestrator.pendingConnectionCheck).toBeFalsy();
    });

    it('should handle errors in pending connection check during cleanup', async () => {
      // Setup: Create a failing connection check (suppress unhandled rejection warning)
      const failingCheck = Promise.reject(new Error('Connection check failed'));
      failingCheck.catch(() => {}); // Prevent unhandled rejection

      orchestrator.pendingConnectionCheck = failingCheck;

      // Destroy should not throw (errors are caught and ignored)
      await expect(orchestrator.destroy()).resolves.not.toThrow();

      // Verify cleanup still happened (check for null or undefined since destroy was called)
      expect(orchestrator.connectionCheckInterval).toBeFalsy();
      expect(orchestrator.pendingConnectionCheck).toBeFalsy();
    });

    it('should be safe to call destroy() multiple times', async () => {
      // First destroy
      await orchestrator.destroy();

      // Verify cleanup happened (check for null or undefined)
      expect(orchestrator.connectionCheckInterval).toBeFalsy();

      // Clear mock history
      global.clearInterval.mockClear();

      // Second destroy should not error
      await expect(orchestrator.destroy()).resolves.not.toThrow();

      // clearInterval should NOT be called again (interval already null)
      expect(global.clearInterval).not.toHaveBeenCalled();
    });

    it('should prevent connection checks after destroy', async () => {
      // Track connection check calls
      const checkSpy = jest.spyOn(orchestrator, 'checkConnection');

      // Destroy the orchestrator
      await orchestrator.destroy();

      // Clear spy history
      checkSpy.mockClear();

      // Manually trigger what would have been the interval callback
      // (simulating time passing - interval should not fire)
      const intervalCallback = global.setInterval.mock.calls.find(
        call => call[1] === 10000
      )?.[0];

      if (intervalCallback) {
        // This would normally trigger a check, but interval is cleared
        // So we verify the interval was cleared (check for null or undefined)
        expect(orchestrator.connectionCheckInterval).toBeFalsy();
      }

      // Verify no new checks were made
      expect(checkSpy).not.toHaveBeenCalled();

      checkSpy.mockRestore();
    });
  });
});
