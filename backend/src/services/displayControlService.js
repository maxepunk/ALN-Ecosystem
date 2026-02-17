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
    this.previousMode = oldMode;
    this.currentMode = DisplayMode.SCOREBOARD;
    this.pendingVideo = null;

    try {
      // Stop VLC playback when switching to scoreboard
      if (this.vlcService && this.vlcService.isConnected()) {
        await this.vlcService.stop();
      }

      // Launch scoreboard in kiosk browser
      await displayDriver.showScoreboard();

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
      if (this.vlcService && this.vlcService.isConnected()) {
        await this.vlcService.playVideo(videoFile);
      } else {
        // Graceful degradation - emit event even without VLC
        logger.warn('[DisplayControl] VLC not connected - video play simulated');
      }

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
   * @private
   */
  async _handleVideoComplete() {
    if (this.currentMode !== DisplayMode.VIDEO) {
      return;
    }

    logger.info('[DisplayControl] Video complete, returning to previous mode', {
      previousMode: this.previousMode
    });

    const completedVideo = this.pendingVideo;
    this.pendingVideo = null;

    // Return to previous mode (goes through public API to acquire lock)
    switch (this.previousMode) {
      case DisplayMode.SCOREBOARD:
        await this.setScoreboard();
        break;
      case DisplayMode.IDLE_LOOP:
      default:
        await this.setIdleLoop();
        break;
    }

    this.emit('display:video:complete', {
      video: completedVideo,
      returnedTo: this.currentMode
    });
  }

  /**
   * Toggle between IDLE_LOOP and SCOREBOARD modes
   * Useful for quick switching from admin panel
   * @returns {Promise<Object>} Result of mode toggle
   */
  async toggleMode() {
    return this._withLock(async () => {
      if (this.currentMode === DisplayMode.IDLE_LOOP) {
        // Call internal _do* method to avoid deadlock (already holding the lock)
        return await this._doSetScoreboard();
      } else if (this.currentMode === DisplayMode.SCOREBOARD) {
        return await this._doSetIdleLoop();
      } else {
        // If in VIDEO mode, do nothing (let video complete)
        logger.info('[DisplayControl] Cannot toggle while in VIDEO mode');
        return { success: false, error: 'Cannot toggle during video playback' };
      }
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
