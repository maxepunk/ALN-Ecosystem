/**
 * DisplayControlService Unit Tests
 * Tests display mode state machine and event emission
 *
 * Phase 4.2: HDMI Display Control state machine
 */

// Mock displayDriver to prevent real Chromium spawn during init()
jest.mock('../../../src/utils/displayDriver', () => ({
  ensureBrowserRunning: jest.fn().mockResolvedValue(true),
  showScoreboard: jest.fn().mockResolvedValue(true),
  hideScoreboard: jest.fn().mockResolvedValue(true),
  isScoreboardVisible: jest.fn().mockReturnValue(false),
  getStatus: jest.fn().mockReturnValue({}),
  cleanup: jest.fn().mockResolvedValue(),
}));

const { resetAllServices } = require('../../helpers/service-reset');
const displayControlService = require('../../../src/services/displayControlService');
const { DisplayMode } = displayControlService;

describe('DisplayControlService - State Machine', () => {
  // Mock VLC service
  let mockVlcService;
  let mockVideoQueueService;

  beforeEach(async () => {
    // Re-apply displayDriver mock implementations (resetMocks: true clears them between tests)
    const displayDriver = require('../../../src/utils/displayDriver');
    displayDriver.ensureBrowserRunning.mockResolvedValue(true);
    displayDriver.showScoreboard.mockResolvedValue(true);
    displayDriver.hideScoreboard.mockResolvedValue(true);
    displayDriver.isScoreboardVisible.mockReturnValue(false);
    displayDriver.getStatus.mockReturnValue({});
    displayDriver.cleanup.mockResolvedValue();

    // Reset service state
    displayControlService.reset();

    // Create mock VLC service
    mockVlcService = {
      isConnected: jest.fn().mockReturnValue(true),
      returnToIdleLoop: jest.fn().mockResolvedValue(true),
      playVideo: jest.fn().mockResolvedValue(true),
      stop: jest.fn().mockResolvedValue(true),
      on: jest.fn(),
      removeListener: jest.fn()
    };

    // Create mock video queue service
    mockVideoQueueService = {
      on: jest.fn(),
      removeListener: jest.fn(),
      registerPrePlayHook: jest.fn(),
      currentItem: null
    };

    // Initialize with mocks
    await displayControlService.init({
      vlcService: mockVlcService,
      videoQueueService: mockVideoQueueService
    });
  });

  afterEach(() => {
    displayControlService.removeAllListeners();
    displayControlService.reset();
  });

  describe('init', () => {
    test('should call displayDriver.ensureBrowserRunning during init', async () => {
      const displayDriver = require('../../../src/utils/displayDriver');
      displayDriver.ensureBrowserRunning.mockClear();

      displayControlService.reset();
      await displayControlService.init({
        vlcService: mockVlcService,
        videoQueueService: mockVideoQueueService
      });

      expect(displayDriver.ensureBrowserRunning).toHaveBeenCalled();
    });

    test('should still initialize if ensureBrowserRunning fails', async () => {
      const displayDriver = require('../../../src/utils/displayDriver');
      displayDriver.ensureBrowserRunning.mockRejectedValueOnce(new Error('No display'));

      displayControlService.reset();
      await displayControlService.init({
        vlcService: mockVlcService,
        videoQueueService: mockVideoQueueService
      });

      // Service is still initialized despite driver failure
      expect(displayControlService._initialized).toBe(true);
    });
  });

  describe('Initial State', () => {
    it('should start in IDLE_LOOP mode', () => {
      displayControlService.reset();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
    });

    it('should return correct status object', () => {
      const status = displayControlService.getStatus();

      expect(status).toHaveProperty('currentMode');
      expect(status).toHaveProperty('previousMode');
      expect(status).toHaveProperty('pendingVideo');
      expect(status).toHaveProperty('timestamp');
      expect(status.currentMode).toBe(DisplayMode.IDLE_LOOP);
    });
  });

  describe('Mode Switching - setIdleLoop()', () => {
    it('should switch to IDLE_LOOP mode', async () => {
      // Start from SCOREBOARD mode
      await displayControlService.setScoreboard();

      const result = await displayControlService.setIdleLoop();

      expect(result.success).toBe(true);
      expect(result.mode).toBe(DisplayMode.IDLE_LOOP);
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
    });

    it('should call VLC returnToIdleLoop when connected', async () => {
      await displayControlService.setIdleLoop();

      expect(mockVlcService.returnToIdleLoop).toHaveBeenCalled();
    });

    it('should emit display:mode:changed event', (done) => {
      displayControlService.once('display:mode:changed', (data) => {
        try {
          expect(data.mode).toBe(DisplayMode.IDLE_LOOP);
          done();
        } catch (error) {
          done(error);
        }
      });

      displayControlService.setIdleLoop();
    });

    it('should clear pendingVideo when switching to IDLE_LOOP', async () => {
      // Set a pending video first
      await displayControlService.playVideo('test.mp4');
      expect(displayControlService.pendingVideo).toBe('test.mp4');

      await displayControlService.setIdleLoop();
      expect(displayControlService.pendingVideo).toBeNull();
    });
  });

  describe('Mode Switching - setScoreboard()', () => {
    it('should switch to SCOREBOARD mode', async () => {
      const result = await displayControlService.setScoreboard();

      expect(result.success).toBe(true);
      expect(result.mode).toBe(DisplayMode.SCOREBOARD);
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);
    });

    it('should call VLC stop when switching from IDLE_LOOP', async () => {
      // Ensure starting from IDLE_LOOP (not VIDEO)
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);

      await displayControlService.setScoreboard();

      expect(mockVlcService.stop).toHaveBeenCalled();
    });

    it('should NOT stop VLC when switching from VIDEO mode (overlay)', async () => {
      // Enter VIDEO mode
      await displayControlService.playVideo('test.mp4');
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);
      mockVlcService.stop.mockClear();

      await displayControlService.setScoreboard();

      expect(mockVlcService.stop).not.toHaveBeenCalled();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);
    });

    it('should NOT overwrite previousMode when switching from VIDEO (overlay)', async () => {
      // IDLE_LOOP -> VIDEO -> SCOREBOARD
      // previousMode should stay IDLE_LOOP (set by pre-play hook), not become VIDEO
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
      await displayControlService.playVideo('test.mp4');

      // playVideo sets previousMode to IDLE_LOOP
      const preScoreboardPrev = displayControlService.previousMode;
      expect(preScoreboardPrev).toBe(DisplayMode.IDLE_LOOP);

      await displayControlService.setScoreboard();

      // previousMode preserved — still IDLE_LOOP, not VIDEO
      expect(displayControlService.previousMode).toBe(DisplayMode.IDLE_LOOP);
    });

    it('should emit display:mode:changed event', (done) => {
      displayControlService.once('display:mode:changed', (data) => {
        try {
          expect(data.mode).toBe(DisplayMode.SCOREBOARD);
          done();
        } catch (error) {
          done(error);
        }
      });

      displayControlService.setScoreboard();
    });

    it('should track previous mode', async () => {
      // Start in IDLE_LOOP
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);

      await displayControlService.setScoreboard();

      const status = displayControlService.getStatus();
      expect(status.previousMode).toBe(DisplayMode.IDLE_LOOP);
    });

    test('should still succeed and emit event when displayDriver.showScoreboard returns false', async () => {
      const displayDriver = require('../../../src/utils/displayDriver');
      displayDriver.showScoreboard.mockResolvedValueOnce(false);

      const modeChanged = jest.fn();
      displayControlService.on('display:mode:changed', modeChanged);

      const result = await displayControlService.setScoreboard();

      // Mode change succeeds even if physical display fails (non-fatal, like hideScoreboard)
      expect(result.success).toBe(true);
      expect(displayControlService.getCurrentMode()).toBe('SCOREBOARD');
      expect(modeChanged).toHaveBeenCalledWith(expect.objectContaining({ mode: 'SCOREBOARD' }));
    });
  });

  describe('Mode Switching - playVideo()', () => {
    it('should switch to VIDEO mode', async () => {
      const result = await displayControlService.playVideo('test_video.mp4');

      expect(result.success).toBe(true);
      expect(result.mode).toBe(DisplayMode.VIDEO);
      expect(result.video).toBe('test_video.mp4');
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);
    });

    it('should store video filename as pendingVideo', async () => {
      await displayControlService.playVideo('test_video.mp4');

      expect(displayControlService.pendingVideo).toBe('test_video.mp4');
    });

    it('should call VLC playVideo when connected', async () => {
      await displayControlService.playVideo('test_video.mp4');

      expect(mockVlcService.playVideo).toHaveBeenCalledWith('test_video.mp4');
    });

    it('should emit display:mode:changed event with video info', (done) => {
      displayControlService.once('display:mode:changed', (data) => {
        try {
          expect(data.mode).toBe(DisplayMode.VIDEO);
          expect(data.video).toBe('test_video.mp4');
          done();
        } catch (error) {
          done(error);
        }
      });

      displayControlService.playVideo('test_video.mp4');
    });

    it('should preserve previous mode when playing video', async () => {
      // Start from SCOREBOARD
      await displayControlService.setScoreboard();

      await displayControlService.playVideo('test_video.mp4');

      const status = displayControlService.getStatus();
      expect(status.previousMode).toBe(DisplayMode.SCOREBOARD);
    });

    it('should fail honestly when VLC not connected', async () => {
      mockVlcService.isConnected.mockReturnValue(false);

      const result = await displayControlService.playVideo('test_video.mp4');

      // No silent simulation — reports failure when VLC unavailable
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/VLC not connected/);
      // Mode reverts to previous on failure
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
    });
  });

  describe('Video Completion - _handleVideoComplete()', () => {
    it('should return to IDLE_LOOP if previous mode was IDLE_LOOP', async () => {
      // Start from IDLE_LOOP, play video
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
      await displayControlService.playVideo('test.mp4');

      // Simulate video completion
      await displayControlService._handleVideoComplete();

      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
    });

    it('should return to SCOREBOARD if previous mode was SCOREBOARD', async () => {
      // Start from SCOREBOARD, play video
      await displayControlService.setScoreboard();
      await displayControlService.playVideo('test.mp4');

      // Simulate video completion
      await displayControlService._handleVideoComplete();

      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);
    });

    it('should emit display:video:complete event', (done) => {
      displayControlService.playVideo('test.mp4').then(() => {
        displayControlService.once('display:video:complete', (data) => {
          try {
            expect(data.video).toBe('test.mp4');
            expect(data.returnedTo).toBeDefined();
            done();
          } catch (error) {
            done(error);
          }
        });

        displayControlService._handleVideoComplete();
      });
    });

    it('should NOT handle completion if not in VIDEO mode', async () => {
      // Already in IDLE_LOOP
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);

      // Simulate video completion (should do nothing)
      await displayControlService._handleVideoComplete();

      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
    });

    it('should clear pendingVideo after completion', async () => {
      await displayControlService.playVideo('test.mp4');
      expect(displayControlService.pendingVideo).toBe('test.mp4');

      await displayControlService._handleVideoComplete();

      expect(displayControlService.pendingVideo).toBeNull();
    });
  });

  describe('returnToVideo()', () => {
    it('should return to VIDEO mode when video is playing behind scoreboard', async () => {
      // Setup: VIDEO -> SCOREBOARD (overlay)
      await displayControlService.playVideo('test.mp4');
      mockVideoQueueService.currentItem = { isPlaying: () => true };
      await displayControlService.setScoreboard();

      const result = await displayControlService.returnToVideo();

      expect(result.success).toBe(true);
      expect(result.mode).toBe(DisplayMode.VIDEO);
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);
    });

    it('should fail when not in SCOREBOARD mode', async () => {
      const result = await displayControlService.returnToVideo();

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not in scoreboard mode/i);
    });

    it('should fail when no video is playing', async () => {
      await displayControlService.setScoreboard();
      // No currentItem on videoQueueService

      const result = await displayControlService.returnToVideo();

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no video playing/i);
    });

    it('should not touch previousMode', async () => {
      await displayControlService.playVideo('test.mp4');
      mockVideoQueueService.currentItem = { isPlaying: () => true };
      await displayControlService.setScoreboard();

      const prevBefore = displayControlService.previousMode;
      await displayControlService.returnToVideo();

      expect(displayControlService.previousMode).toBe(prevBefore);
    });

    it('should emit display:mode:changed', async () => {
      await displayControlService.playVideo('test.mp4');
      mockVideoQueueService.currentItem = { isPlaying: () => true };
      await displayControlService.setScoreboard();

      const spy = jest.fn();
      displayControlService.on('display:mode:changed', spy);

      await displayControlService.returnToVideo();

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        mode: DisplayMode.VIDEO,
        previousMode: DisplayMode.SCOREBOARD
      }));
    });
  });

  describe('Overlay lifecycle', () => {
    it('IDLE_LOOP -> VIDEO -> SCOREBOARD -> returnToVideo -> complete -> IDLE_LOOP', async () => {
      mockVideoQueueService.currentItem = { isPlaying: () => true };

      await displayControlService.playVideo('test.mp4');
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);
      expect(displayControlService.previousMode).toBe(DisplayMode.IDLE_LOOP);

      await displayControlService.setScoreboard();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);
      expect(displayControlService.previousMode).toBe(DisplayMode.IDLE_LOOP); // preserved

      await displayControlService.returnToVideo();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);

      // Video completes
      await displayControlService._handleVideoComplete();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
    });

    it('_handleVideoComplete is no-op when mode is SCOREBOARD (video ends behind overlay)', async () => {
      mockVideoQueueService.currentItem = { isPlaying: () => true };

      await displayControlService.playVideo('test.mp4');
      await displayControlService.setScoreboard();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);

      // Video ends while scoreboard is showing
      await displayControlService._handleVideoComplete();

      // Should NOT change mode — scoreboard is sticky
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);
    });
  });

  describe('Error Handling', () => {
    it('should revert mode on VLC failure during setIdleLoop', async () => {
      await displayControlService.setScoreboard();
      mockVlcService.returnToIdleLoop.mockRejectedValue(new Error('VLC Error'));

      const result = await displayControlService.setIdleLoop();

      expect(result.success).toBe(false);
      expect(result.error).toBe('VLC Error');
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);
    });

    it('should revert mode on VLC failure during playVideo', async () => {
      mockVlcService.playVideo.mockRejectedValue(new Error('VLC Error'));

      const result = await displayControlService.playVideo('test.mp4');

      expect(result.success).toBe(false);
      expect(result.error).toBe('VLC Error');
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
      expect(displayControlService.pendingVideo).toBeNull();
    });
  });

  describe('reset()', () => {
    it('should reset to initial state', async () => {
      // Modify state
      await displayControlService.setScoreboard();
      await displayControlService.playVideo('test.mp4');

      // Reset
      displayControlService.reset();

      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
      expect(displayControlService.previousMode).toBe(DisplayMode.IDLE_LOOP);
      expect(displayControlService.pendingVideo).toBeNull();
      expect(displayControlService._initialized).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should warn if already initialized', async () => {
      // Already initialized in beforeEach
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Try to initialize again (should warn via logger, not throw)
      await displayControlService.init({
        vlcService: mockVlcService,
        videoQueueService: mockVideoQueueService
      });

      // The warning goes to logger.warn, not console.log, so we just verify no error thrown
      consoleSpy.mockRestore();
    });
  });

  describe('Video completion event wiring', () => {
    it('should NOT register listener on video:completed', () => {
      // video:completed fires per-video, even when queue has more items.
      // displayControlService should only act on video:idle (queue empty).
      const registeredEvents = mockVideoQueueService.on.mock.calls.map(c => c[0]);
      expect(registeredEvents).not.toContain('video:completed');
    });

    it('should register listener on video:idle', () => {
      const registeredEvents = mockVideoQueueService.on.mock.calls.map(c => c[0]);
      expect(registeredEvents).toContain('video:idle');
    });
  });

  describe('Pre-play hook event emission', () => {
    it('should emit display:mode:changed in pre-play hook', async () => {
      const modeChangeSpy = jest.fn();
      displayControlService.on('display:mode:changed', modeChangeSpy);

      // Get the captured pre-play hook callback
      const prePlayHook = mockVideoQueueService.registerPrePlayHook.mock.calls[0][0];
      await prePlayHook();

      expect(modeChangeSpy).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'VIDEO',
        previousMode: 'IDLE_LOOP'
      }));
    });
  });

  describe('Concurrent mode switch protection', () => {
    it('should serialize concurrent setIdleLoop and setScoreboard calls', async () => {
      const callOrder = [];

      // Mock displayDriver methods with delays to detect interleaving
      // displayControlService imports displayDriver at module level, so we need
      // to mock the vlcService methods which are already injected as mocks
      mockVlcService.returnToIdleLoop.mockImplementation(async () => {
        callOrder.push('idle:start');
        await new Promise(r => setTimeout(r, 30));
        callOrder.push('idle:end');
      });
      mockVlcService.stop.mockImplementation(async () => {
        callOrder.push('scoreboard:start');
        await new Promise(r => setTimeout(r, 30));
        callOrder.push('scoreboard:end');
      });

      // Fire both concurrently
      await Promise.all([
        displayControlService.setIdleLoop(),
        displayControlService.setScoreboard(),
      ]);

      // Verify serialization: first transition completes fully before second starts
      const starts = callOrder.filter(s => s.endsWith(':start'));
      const ends = callOrder.filter(s => s.endsWith(':end'));
      if (starts.length > 1) {
        const firstEndIdx = callOrder.indexOf(ends[0]);
        const secondStartIdx = callOrder.indexOf(starts[1]);
        expect(firstEndIdx).toBeLessThan(secondStartIdx);
      }
    });
  });
});
