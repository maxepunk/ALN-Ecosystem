/**
 * Display Control Service
 * State machine for managing HDMI display modes
 *
 * Display Modes:
 * - IDLE_LOOP: VLC plays idle-loop.mp4 on continuous loop
 * - SCOREBOARD: Browser displays scoreboard.html in kiosk mode
 * - VIDEO: VLC plays triggered video, returns to previous mode after
 *
 * Architecture:
 * - Primary Display: HDMI projector (VLC or browser window)
 * - 2nd Display: Chromecast (browser tab casting)
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const displayDriver = require('../utils/displayDriver');

// Display mode constants
const DisplayMode = {
  IDLE_LOOP: 'IDLE_LOOP',
  SCOREBOARD: 'SCOREBOARD',
  VIDEO: 'VIDEO'
};

class DisplayControlService extends EventEmitter {
  constructor() {
    super();
    this.currentMode = DisplayMode.IDLE_LOOP;
    this.previousMode = DisplayMode.IDLE_LOOP;
    this.vlcService = null;
    this.videoQueueService = null;
    this.pendingVideo = null;  // Track video being played
    this._initialized = false;
    this._switchLock = Promise.resolve();
  }

  /**
   * Initialize the display control service with dependencies
   * @param {Object} options - Service dependencies
   * @param {Object} options.vlcService - VLC service instance
   * @param {Object} options.videoQueueService - Video queue service instance
   */
  init({ vlcService, videoQueueService }) {
    if (this._initialized) {
      logger.warn('[DisplayControl] Already initialized');
      return;
    }

    this.vlcService = vlcService;
    this.videoQueueService = videoQueueService;

    // ONLY listen to video:idle (queue empty), NOT video:completed (per-video).
    // video:completed fires after each video even when more are queued.
    // displayControlService should only restore the display when the entire queue drains.
    if (this.videoQueueService) {
      this._boundVideoIdleHandler = () => this._handleVideoComplete();
      this.videoQueueService.on('video:idle', this._boundVideoIdleHandler);
    }

    // Enter VIDEO mode for ALL video triggers (player scan, compound cue, manual)
    if (this.videoQueueService) {
      this.videoQueueService.registerPrePlayHook(async () => {
        if (this.currentMode !== DisplayMode.VIDEO) {
          this.previousMode = this.currentMode;
          if (this.currentMode === DisplayMode.SCOREBOARD) {
            await displayDriver.hideScoreboard();
          }
          this.currentMode = DisplayMode.VIDEO;
          this.emit('display:mode:changed', {
            mode: DisplayMode.VIDEO,
            previousMode: this.previousMode
          });
          logger.info('[DisplayControl] Pre-play hook: entered VIDEO mode', {
            previousMode: this.previousMode
          });
        }
      });
    }

    // Pre-launch scoreboard Chromium so showScoreboard() is instant.
    // Fire-and-forget: init should not block on Chromium spawn.
    displayDriver.ensureBrowserRunning().catch(err => {
      logger.warn('[DisplayControl] Chromium pre-launch failed (non-fatal)', { error: err.message });
    });

    this._initialized = true;
    logger.info('[DisplayControl] Initialized', { mode: this.currentMode });
  }

  /**
   * Get current display mode
   * @returns {string} Current display mode
   */
  getCurrentMode() {
    return this.currentMode;
  }

  /**
   * Get display mode status for API responses
   * @returns {Object} Status object with mode and metadata
   */
  getStatus() {
    return {
      currentMode: this.currentMode,
      previousMode: this.previousMode,
      pendingVideo: this.pendingVideo,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Serialize async transitions so only one runs at a time.
   * Each call waits for the previous lock holder to finish before executing.
   * @param {Function} fn - Async function to execute under the lock
   * @returns {Promise<*>} Result of fn()
   * @private
   */
  _withLock(fn) {
    const prev = this._switchLock;
    let resolve;
    this._switchLock = new Promise(r => { resolve = r; });
    return prev.then(() => fn()).finally(resolve);
  }

  /**
   * Switch to Idle Loop mode
   * VLC plays idle-loop.mp4 on continuous loop
   * @returns {Promise<Object>} Result of mode switch
   */
  async setIdleLoop() {
    return this._withLock(() => this._doSetIdleLoop());
  }

  /**
   * Internal: Switch to Idle Loop mode (no lock, for use inside _withLock)
   * @returns {Promise<Object>} Result of mode switch
   * @private
   */
  async _doSetIdleLoop() {
    logger.info('[DisplayControl] Switching to IDLE_LOOP mode');

    const oldMode = this.currentMode;
    this.previousMode = oldMode;
    this.currentMode = DisplayMode.IDLE_LOOP;
    this.pendingVideo = null;

    try {
      // Hide scoreboard browser if it was showing
      await displayDriver.hideScoreboard();

      // Start idle loop via VLC
      if (this.vlcService && this.vlcService.isConnected()) {
        await this.vlcService.returnToIdleLoop();
      }

      this.emit('display:mode:changed', {
        mode: DisplayMode.IDLE_LOOP,
        previousMode: oldMode
      });

      logger.info('[DisplayControl] Now showing IDLE_LOOP');
      return { success: true, mode: DisplayMode.IDLE_LOOP };
    } catch (error) {
      logger.error('[DisplayControl] Failed to switch to IDLE_LOOP', { error: error.message });
      // Revert mode on failure
      this.currentMode = oldMode;
      return { success: false, error: error.message };
    }
  }

  /**
   * Switch to Scoreboard mode
   * Browser fullscreen on scoreboard.html
   * Launches Chromium in kiosk mode via displayDriver
   * @returns {Promise<Object>} Result of mode switch
   */
  async setScoreboard() {
    return this._withLock(() => this._doSetScoreboard());
  }

  /**
   * Internal: Switch to Scoreboard mode (no lock, for use inside _withLock)
   * @returns {Promise<Object>} Result of mode switch
   * @private
   */
  async _doSetScoreboard() {
    logger.info('[DisplayControl] Switching to SCOREBOARD mode');

    const oldMode = this.currentMode;
    // When overlaying scoreboard on video, preserve previousMode (the restore-to target
    // set by the pre-play hook). Only update previousMode for non-overlay transitions.
    if (oldMode !== DisplayMode.VIDEO) {
      this.previousMode = oldMode;
    }
    this.currentMode = DisplayMode.SCOREBOARD;
    this.pendingVideo = null;

    try {
      // Stop VLC only when switching from non-VIDEO modes.
      // When switching from VIDEO, VLC keeps playing behind the scoreboard.
      if (oldMode !== DisplayMode.VIDEO && this.vlcService && this.vlcService.isConnected()) {
        await this.vlcService.stop();
      }

      // Launch scoreboard in kiosk browser
      const shown = await displayDriver.showScoreboard();
      if (!shown) {
        logger.warn('[DisplayControl] displayDriver.showScoreboard returned false — physical display may not have switched');
      }

      this.emit('display:mode:changed', {
        mode: DisplayMode.SCOREBOARD,
        previousMode: oldMode
      });

      logger.info('[DisplayControl] Now showing SCOREBOARD');
      return { success: true, mode: DisplayMode.SCOREBOARD };
    } catch (error) {
      logger.error('[DisplayControl] Failed to switch to SCOREBOARD', { error: error.message });
      // Revert mode on failure
      this.currentMode = oldMode;
      return { success: false, error: error.message };
    }
  }

  /**
   * Return to video from scoreboard overlay.
   * Hides scoreboard to reveal the still-playing VLC video.
   * Only valid when in SCOREBOARD mode with a video playing behind it.
   * @returns {Promise<Object>} Result of mode switch
   */
  async returnToVideo() {
    return this._withLock(async () => {
      if (this.currentMode !== DisplayMode.SCOREBOARD) {
        return { success: false, error: 'Not in scoreboard mode' };
      }

      if (!this.videoQueueService?.currentItem?.isPlaying()) {
        return { success: false, error: 'No video playing' };
      }

      logger.info('[DisplayControl] Returning to video from scoreboard overlay');

      const oldMode = this.currentMode;
      this.currentMode = DisplayMode.VIDEO;
      // Do NOT touch previousMode — it's already correct from the pre-play hook

      try {
        await displayDriver.hideScoreboard();

        this.emit('display:mode:changed', {
          mode: DisplayMode.VIDEO,
          previousMode: oldMode
        });

        logger.info('[DisplayControl] Now showing VIDEO (returned from overlay)');
        return { success: true, mode: DisplayMode.VIDEO };
      } catch (error) {
        logger.error('[DisplayControl] Failed to return to video', { error: error.message });
        this.currentMode = oldMode;
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Play a video (switches to VIDEO mode)
   * After video completes, returns to previous mode
   * @param {string} videoFile - Video filename to play
   * @returns {Promise<Object>} Result of video play
   */
  async playVideo(videoFile) {
    return this._withLock(() => this._doPlayVideo(videoFile));
  }

  /**
   * Internal: Play a video (no lock, for use inside _withLock)
   * @param {string} videoFile - Video filename to play
   * @returns {Promise<Object>} Result of video play
   * @private
   */
  async _doPlayVideo(videoFile) {
    logger.info('[DisplayControl] Playing video', { videoFile });

    // Store current mode to return to after video
    if (this.currentMode !== DisplayMode.VIDEO) {
      this.previousMode = this.currentMode;
    }

    // Hide scoreboard if it was showing (video takes priority)
    if (this.currentMode === DisplayMode.SCOREBOARD) {
      await displayDriver.hideScoreboard();
    }

    this.currentMode = DisplayMode.VIDEO;
    this.pendingVideo = videoFile;

    try {
      // Play video via VLC
      if (!this.vlcService || !this.vlcService.isConnected()) {
        throw new Error('VLC not connected — cannot play video');
      }
      await this.vlcService.playVideo(videoFile);

      this.emit('display:mode:changed', {
        mode: DisplayMode.VIDEO,
        previousMode: this.previousMode,
        video: videoFile
      });

      logger.info('[DisplayControl] Now playing VIDEO', { videoFile });
      return { success: true, mode: DisplayMode.VIDEO, video: videoFile };
    } catch (error) {
      logger.error('[DisplayControl] Failed to play video', { videoFile, error: error.message });
      // Return to previous mode on failure
      this.currentMode = this.previousMode;
      this.pendingVideo = null;
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle video completion - return to previous mode
   * Called from video:idle listener, acquires lock to serialize with other transitions.
   * Mode check is inside the lock to prevent TOCTOU race: another transition could
   * change currentMode between the check and the lock acquisition.
   * Internal _do* methods used to avoid deadlock (lock already held).
   * @private
   */
  async _handleVideoComplete() {
    return this._withLock(async () => {
      if (this.currentMode !== DisplayMode.VIDEO) {
        return;
      }

      logger.info('[DisplayControl] Video complete, returning to previous mode', {
        previousMode: this.previousMode
      });

      const completedVideo = this.pendingVideo;
      this.pendingVideo = null;

      switch (this.previousMode) {
        case DisplayMode.SCOREBOARD:
          await this._doSetScoreboard();
          break;
        case DisplayMode.IDLE_LOOP:
        default:
          await this._doSetIdleLoop();
          break;
      }

      this.emit('display:video:complete', {
        video: completedVideo,
        returnedTo: this.currentMode
      });
    });
  }

  /**
   * Reset service for tests
   */
  reset() {
    // Remove listeners WE added to other services FIRST
    if (this.videoQueueService) {
      this.videoQueueService.removeListener('video:idle', this._boundVideoIdleHandler);
    }

    // Then remove our own listeners
    this.removeAllListeners();

    // Hide scoreboard if visible (prevents stale Chromium window after reset)
    displayDriver.hideScoreboard().catch(() => {});

    // Reset state
    this.currentMode = DisplayMode.IDLE_LOOP;
    this.previousMode = DisplayMode.IDLE_LOOP;
    this.pendingVideo = null;
    this.vlcService = null;
    this.videoQueueService = null;
    this._initialized = false;
    this._switchLock = Promise.resolve();
    this._boundVideoIdleHandler = null;
    logger.info('[DisplayControl] Service reset');
  }
}

// Export singleton instance
const displayControlService = new DisplayControlService();

// Export both instance and class for testing
module.exports = displayControlService;
module.exports.DisplayControlService = DisplayControlService;
module.exports.DisplayMode = DisplayMode;
module.exports.resetForTests = () => displayControlService.reset();
