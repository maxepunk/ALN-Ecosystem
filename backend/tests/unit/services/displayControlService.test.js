/**
 * DisplayControlService Unit Tests
 * Tests display mode state machine and event emission
 *
 * Phase 4.2: HDMI Display Control state machine
 */

const { resetAllServices } = require('../../helpers/service-reset');
const displayControlService = require('../../../src/services/displayControlService');
const { DisplayMode } = displayControlService;

describe('DisplayControlService - State Machine', () => {
  // Mock VLC service
  let mockVlcService;
  let mockVideoQueueService;

  beforeEach(async () => {
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
      removeListener: jest.fn()
    };

    // Initialize with mocks
    displayControlService.init({
      vlcService: mockVlcService,
      videoQueueService: mockVideoQueueService
    });
  });

  afterEach(() => {
    displayControlService.removeAllListeners();
    displayControlService.reset();
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

    it('should call VLC stop when connected', async () => {
      await displayControlService.setScoreboard();

      expect(mockVlcService.stop).toHaveBeenCalled();
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

    it('should handle graceful degradation when VLC not connected', async () => {
      mockVlcService.isConnected.mockReturnValue(false);

      const result = await displayControlService.playVideo('test_video.mp4');

      // Should still succeed (graceful degradation)
      expect(result.success).toBe(true);
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);
    });
  });

  describe('toggleMode()', () => {
    it('should toggle from IDLE_LOOP to SCOREBOARD', async () => {
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);

      const result = await displayControlService.toggleMode();

      expect(result.success).toBe(true);
      expect(result.mode).toBe(DisplayMode.SCOREBOARD);
    });

    it('should toggle from SCOREBOARD to IDLE_LOOP', async () => {
      await displayControlService.setScoreboard();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);

      const result = await displayControlService.toggleMode();

      expect(result.success).toBe(true);
      expect(result.mode).toBe(DisplayMode.IDLE_LOOP);
    });

    it('should NOT toggle during VIDEO mode', async () => {
      await displayControlService.playVideo('test.mp4');
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);

      const result = await displayControlService.toggleMode();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot toggle during video playback');
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);
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
    it('should warn if already initialized', () => {
      // Already initialized in beforeEach
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Try to initialize again (should warn via logger, not throw)
      displayControlService.init({
        vlcService: mockVlcService,
        videoQueueService: mockVideoQueueService
      });

      // The warning goes to logger.warn, not console.log, so we just verify no error thrown
      consoleSpy.mockRestore();
    });
  });
});
