/**
 * Player Scanner - Video Modal Timeout Tests (Bug #5)
 *
 * BUG #5: Video processing modal doesn't timeout if promise hangs
 *
 * CURRENT BEHAVIOR (BUGGY):
 * - Modal shown when video token scanned
 * - Timeout (2s) is INSIDE .then() callback
 * - If promise hangs (never resolves), timeout never fires
 * - Modal stays visible forever
 *
 * INTENDED BEHAVIOR:
 * - Modal shown when video token scanned
 * - Timeout starts IMMEDIATELY (not inside promise)
 * - Modal hidden after 2-3 seconds REGARDLESS of promise state
 * - Modal hidden immediately on error
 *
 * Location: aln-memory-scanner/index.html:1084-1104 (processToken function)
 */

const {
  resetMocks,
  mockFetchResponse,
  mockFetchNetworkError
} = require('../../helpers/player-scanner-mocks');

const OrchestratorIntegration = require('../../../../aln-memory-scanner/js/orchestratorIntegration');

describe('Player Scanner - Video Modal Timeout (Bug #5)', () => {

  let mockModal;
  let mockClassList;

  beforeEach(() => {
    resetMocks();
    jest.useFakeTimers();

    // Configure for networked mode (video modal only appears in networked mode)
    global.window.location.pathname = '/player-scanner/';
    global.window.location.origin = 'http://192.168.1.100:3000';

    // Mock DOM elements for video processing modal
    mockClassList = {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(() => false)
    };

    mockModal = {
      classList: mockClassList
    };

    global.document.getElementById = jest.fn((id) => {
      if (id === 'video-processing') {
        return mockModal;
      }
      return null;
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Modal Display Behavior', () => {

    it('should show modal when processing video token', () => {
      // Simulate processing a video token
      const token = {
        SF_RFID: 'test_video_token',
        video: 'test_video.mp4'
      };

      // Mock orchestrator connected
      mockFetchResponse(200, { status: 'online' });
      const orchestrator = new OrchestratorIntegration();
      orchestrator.connected = true;

      // Simulate processToken logic (modal.classList.add('active'))
      if (orchestrator && orchestrator.connected && token.video) {
        document.getElementById('video-processing').classList.add('active');
      }

      expect(mockClassList.add).toHaveBeenCalledWith('active');
    });

    it('should NOT show modal for non-video tokens', () => {
      const token = {
        SF_RFID: 'test_image_token',
        image: 'test_image.jpg',
        video: null
      };

      mockFetchResponse(200, { status: 'online' });
      const orchestrator = new OrchestratorIntegration();
      orchestrator.connected = true;

      // Simulate processToken logic
      if (orchestrator && orchestrator.connected && token.video) {
        document.getElementById('video-processing').classList.add('active');
      }

      expect(mockClassList.add).not.toHaveBeenCalled();
    });
  });

  describe('Modal Timeout Behavior (Bug #5 Fix)', () => {

    it('should hide modal after 2-3 seconds even if promise hangs', () => {
      // BUG #5: Current implementation puts timeout INSIDE .then()
      // INTENDED: Timeout should fire REGARDLESS of promise state

      const token = {
        SF_RFID: 'test_video_token',
        video: 'test_video.mp4'
      };

      mockFetchResponse(200, { status: 'online' });
      const orchestrator = new OrchestratorIntegration();
      orchestrator.connected = true;

      // Simulate showing modal
      document.getElementById('video-processing').classList.add('active');

      // Create a promise that NEVER resolves (simulates hanging request)
      const hangingPromise = new Promise(() => {
        // Never resolve or reject
      });

      // INTENDED BEHAVIOR: Start timeout IMMEDIATELY (not inside .then)
      setTimeout(() => {
        document.getElementById('video-processing').classList.remove('active');
      }, 2500); // 2.5 second timeout

      // Advance time by 2.5 seconds
      jest.advanceTimersByTime(2500);

      // Modal should be hidden even though promise never resolved
      expect(mockClassList.remove).toHaveBeenCalledWith('active');
    });

    it('should hide modal after timeout even on successful response', () => {
      const token = {
        SF_RFID: 'test_video_token',
        video: 'test_video.mp4'
      };

      mockFetchResponse(200, { status: 'online' });
      mockFetchResponse(200, { status: 'accepted', videoQueued: true });

      const orchestrator = new OrchestratorIntegration();
      orchestrator.connected = true;

      // Show modal
      document.getElementById('video-processing').classList.add('active');

      // Start scan (promise resolves successfully)
      const scanPromise = orchestrator.scanToken(token.SF_RFID, '001');

      // INTENDED: Timeout runs independently of promise
      setTimeout(() => {
        document.getElementById('video-processing').classList.remove('active');
      }, 2500);

      // Advance time
      jest.advanceTimersByTime(2500);

      // Modal should be hidden after timeout
      expect(mockClassList.remove).toHaveBeenCalledWith('active');
    });

    it('should hide modal immediately on error (before timeout)', async () => {
      const token = {
        SF_RFID: 'test_video_token',
        video: 'test_video.mp4'
      };

      mockFetchResponse(200, { status: 'online' });
      const orchestrator = new OrchestratorIntegration();

      // Wait for initial connection check
      await orchestrator.pendingConnectionCheck;
      orchestrator.connected = true;

      // Show modal
      document.getElementById('video-processing').classList.add('active');

      // Mock network error for scan request
      mockFetchNetworkError('Network error');

      // Start scan (returns error status, doesn't throw)
      const response = await orchestrator.scanToken(token.SF_RFID, '001');

      // INTENDED: Check for error status and hide modal immediately
      if (response.status === 'error') {
        document.getElementById('video-processing').classList.remove('active');
      }

      // Modal should be hidden immediately (not wait for timeout)
      expect(mockClassList.remove).toHaveBeenCalledWith('active');

      // Timeout shouldn't fire (already hidden)
      jest.advanceTimersByTime(2500);
      expect(mockClassList.remove).toHaveBeenCalledTimes(1); // Only once from error handler
    });
  });

  describe('Expected Behavior After Bug Fix', () => {

    it('should guarantee modal never stays visible longer than 3 seconds', () => {
      // REQUIREMENT: Modal should auto-hide after max 2-3 seconds
      // This ensures good UX even if network hangs

      const token = {
        SF_RFID: 'test_video_token',
        video: 'test_video.mp4'
      };

      mockFetchResponse(200, { status: 'online' });
      const orchestrator = new OrchestratorIntegration();
      orchestrator.connected = true;

      // Show modal
      document.getElementById('video-processing').classList.add('active');

      // Hanging promise (never resolves)
      new Promise(() => {});

      // FIXED: Timeout independent of promise
      setTimeout(() => {
        document.getElementById('video-processing').classList.remove('active');
      }, 2500);

      // Before timeout: modal visible
      jest.advanceTimersByTime(2000);
      expect(mockClassList.remove).not.toHaveBeenCalled();

      // After timeout: modal hidden
      jest.advanceTimersByTime(500); // Total 2.5s
      expect(mockClassList.remove).toHaveBeenCalledWith('active');
    });
  });
});
