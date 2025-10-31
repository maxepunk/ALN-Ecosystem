/**
 * Video Queue Service
 * Manages video playback queue and coordination
 */

const EventEmitter = require('events');
const VideoQueueItem = require('../models/videoQueueItem');
const config = require('../config');
const logger = require('../utils/logger');
const vlcService = require('./vlcService'); // Load at top to avoid lazy require in timer callbacks

class VideoQueueService extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners for integration tests (20 test files accumulate listeners)
    // Default is 10, which triggers warnings during test suite execution
    this.setMaxListeners(20);
    this.queue = [];
    this.currentItem = null;
    this.playbackTimer = null;
    this.monitoringDelayTimer = null; // Track VLC monitoring delay timer
  }

  /**
   * Add video to queue
   * @param {Object} token - Token with video asset
   * @param {string} requestedBy - Device ID requesting video
   * @returns {VideoQueueItem}
   */
  addToQueue(token, requestedBy) {
    if (!token.mediaAssets?.video) {
      throw new Error('Token does not have a video asset');
    }

    const queueItem = VideoQueueItem.fromToken(token, requestedBy);
    this.queue.push(queueItem);

    logger.info('Video added to queue', {
      itemId: queueItem.id,
      tokenId: token.id,
      requestedBy,
      queueLength: this.queue.length,
    });

    this.emit('queue:added', queueItem);

    // Process queue if not playing
    if (!this.currentItem) {
      // Use setImmediate to ensure event handlers are set up
      logger.debug('Scheduling queue processing for', { tokenId: token.id });
      setImmediate(() => {
        logger.debug('Processing queue for', { tokenId: token.id });
        this.processQueue();
      });
    } else {
      logger.debug('Queue not processed - video already playing', { currentItem: this.currentItem?.tokenId });
    }

    return queueItem;
  }

  /**
   * Process the queue
   * @returns {Promise<void>}
   */
  async processQueue() {
    if (this.currentItem && this.currentItem.isPlaying()) {
      return; // Already playing something
    }

    // Find next pending item
    const nextItem = this.queue.find(item => item.isPending());
    if (!nextItem) {
      this.currentItem = null;

      // Return to idle loop if enabled
      if (config.features.videoPlayback) {
        await vlcService.returnToIdleLoop();
      }

      this.emit('video:idle'); // Emit idle when queue is empty
      return; // Nothing to play
    }

    try {
      await this.playVideo(nextItem);
    } catch (error) {
      logger.error('Failed to play video', { error, itemId: nextItem.id });
      nextItem.failPlayback(error.message);
      this.emit('video:failed', nextItem);

      // Clean up failed items from queue
      this.clearCompleted();

      // Try next item
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Play a video
   * @param {VideoQueueItem} queueItem - Queue item to play
   * @returns {Promise<void>}
   * @private
   */
  async playVideo(queueItem) {
    // Emit loading status first
    logger.debug('Emitting video:loading for', { tokenId: queueItem.tokenId });
    this.emit('video:loading', {
      queueItem,
      tokenId: queueItem.tokenId
    });

    // Mark as playing
    queueItem.startPlayback();
    this.currentItem = queueItem;

    // Get video path from queue item
    const videoPath = queueItem.videoPath;

    try {
      // If video playback is enabled, use VLC
      if (config.features.videoPlayback) {
        // Actually play the video through VLC
        const vlcResponse = await vlcService.playVideo(videoPath);

        // Wait for VLC to switch to the new video and load metadata
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get duration from VLC status with retry
        let duration = 0;
        let retries = 5;
        while (retries > 0) {
          const status = await vlcService.getStatus();
          // VLC returns length in seconds (not milliseconds!)
          // Only trust duration if it's reasonable (> 1 second)
          if (status.length > 1) {
            duration = status.length; // Already in seconds, no division needed!
            logger.debug('Got video duration from VLC', {
              tokenId: queueItem.tokenId,
              duration,
              filename: status.information?.category?.meta?.filename
            });
            break;
          }
          retries--;
          if (retries > 0) {
            logger.debug('Waiting for VLC to load video metadata', {
              attempt: 6 - retries,
              currentLength: status.length
            });
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Fallback to default if still no reasonable duration
        if (duration <= 1) {
          duration = this.getVideoDuration(queueItem.tokenId);
          logger.warn('Could not get valid duration from VLC, using default', {
            tokenId: queueItem.tokenId,
            defaultDuration: duration
          });
        }

        // Update queue item with real duration from VLC
        queueItem.duration = duration;

        const expectedEndTime = queueItem.calculateExpectedEndTime(duration);

        // Emit play event with real VLC data
        logger.debug('Emitting video:started with VLC data', { tokenId: queueItem.tokenId, duration });
        this.emit('video:started', {
          queueItem,
          duration,
          expectedEndTime,
        });

        logger.info('Video playback started via VLC', {
          itemId: queueItem.id,
          tokenId: queueItem.tokenId,
          duration,
          vlcConnected: vlcService.connected,
        });

        // Give VLC a moment to transition before monitoring (especially from idle loop)
        this.monitoringDelayTimer = setTimeout(() => {
          this.monitoringDelayTimer = null;
          // Monitor VLC status for completion
          this.monitorVlcPlayback(queueItem, duration);
        }, 1500); // 1.5 second delay before monitoring starts

      } else {
        // Only in test mode without VLC - use timer simulation
        const duration = this.getVideoDuration(queueItem.tokenId);
        const expectedEndTime = queueItem.calculateExpectedEndTime(duration);

        this.emit('video:started', {
          queueItem,
          duration,
          expectedEndTime,
        });

        logger.info('Video playback simulated (test mode)', {
          itemId: queueItem.id,
          tokenId: queueItem.tokenId,
          duration,
        });

        // Set timer for completion (test mode only)
        this.playbackTimer = setTimeout(() => {
          this.completePlayback(queueItem);
        }, duration * 1000);
      }
    } catch (error) {
      logger.error('Failed to play video through VLC', { error, itemId: queueItem.id });
      queueItem.failPlayback(error.message);
      this.emit('video:failed', queueItem);

      // Try next item
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Wait for VLC to reach expected state (condition-based waiting pattern)
   * @param {Array<string>} expectedStates - States to wait for (e.g., ['playing'])
   * @param {string} description - Description for timeout error message
   * @param {number} timeoutMs - Timeout in milliseconds (default 5000)
   * @returns {Promise<Object>} VLC status when condition met
   * @throws {Error} If timeout exceeded
   * @private
   */
  async waitForVlcState(expectedStates, description, timeoutMs = 5000) {
    const startTime = Date.now();

    while (true) {
      try {
        const status = await vlcService.getStatus();

        // Check if VLC reached expected state
        if (expectedStates.includes(status.state)) {
          logger.debug('VLC reached expected state', {
            expectedStates,
            actualState: status.state,
            elapsed: Date.now() - startTime
          });
          return status; // Success!
        }

        // Check timeout
        const elapsed = Date.now() - startTime;
        if (elapsed > timeoutMs) {
          throw new Error(
            `Timeout waiting for ${description} after ${timeoutMs}ms. ` +
            `Expected states: [${expectedStates.join(', ')}], ` +
            `Current state: ${status.state}`
          );
        }

        // Poll every 100ms (not too fast, not too slow)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        // If it's our timeout error, rethrow it
        if (error.message.includes('Timeout waiting for')) {
          throw error;
        }

        // VLC connection error - check if we've exceeded timeout
        if (Date.now() - startTime > timeoutMs) {
          throw new Error(
            `VLC connection failed while waiting for ${description}: ${error.message}`
          );
        }

        // Otherwise, keep trying (VLC might be recovering)
        logger.debug('VLC status check failed, retrying', { error: error.message });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Monitor VLC playback status
   * @param {VideoQueueItem} queueItem - Queue item being played
   * @param {number} expectedDuration - Expected duration in seconds
   * @private
   */
  async monitorVlcPlayback(queueItem, expectedDuration) {
    const checkInterval = 1000; // Check every second

    // Clear any existing progress timer
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    // Grace period tracking for video transitions
    let graceCounter = 0;
    const maxGracePeriod = 3; // Allow up to 3 checks (3 seconds) of non-playing state

    const checkStatus = async () => {
      try {
        const status = await vlcService.getStatus();

        // Check if still playing
        if (status.state !== 'playing' && status.state !== 'paused') {
          // Video might be transitioning, use grace period
          graceCounter++;

          if (graceCounter >= maxGracePeriod) {
            // Video has been stopped for too long, consider it complete
            clearInterval(this.progressTimer);
            this.progressTimer = null;
            this.completePlayback(queueItem);
            return;
          }

          // Still in grace period, wait for next check
          logger.debug('Video in transition state', {
            state: status.state,
            graceCounter,
            maxGracePeriod
          });
          return;
        }

        // Video is playing/paused, reset grace counter
        graceCounter = 0;

        // Emit progress updates
        if (status.position !== undefined && status.length > 0) {
          const progress = Math.round(status.position * 100);
          this.emit('video:progress', {
            queueItem,
            progress,
            position: status.position,
            duration: status.length // VLC returns length in seconds already
          });
        }

        // Check if near end
        if (status.position >= 0.95) {
          clearInterval(this.progressTimer);
          this.progressTimer = null;
          this.completePlayback(queueItem);
        }
      } catch (error) {
        logger.error('Error monitoring VLC playback', { error });
        clearInterval(this.progressTimer);
        this.progressTimer = null;

        // Mark video as failed and clear currentItem to unblock queue
        if (queueItem && queueItem === this.currentItem) {
          queueItem.failPlayback(`VLC monitoring error: ${error.message}`);
          this.currentItem = null;
          this.emit('video:failed', queueItem);
        }

        // Try to process next item in queue
        setImmediate(() => this.processQueue());
      }
    };

    // Start monitoring
    this.progressTimer = setInterval(checkStatus, checkInterval);

    // Fallback timeout in case monitoring fails
    this.playbackTimer = setTimeout(() => {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
      this.completePlayback(queueItem);
    }, (expectedDuration + 5) * 1000); // Add 5 seconds buffer
  }

  /**
   * Complete video playback
   * @param {VideoQueueItem} queueItem - Queue item that completed
   * @private
   */
  completePlayback(queueItem) {
    if (!queueItem || queueItem !== this.currentItem) {
      return;
    }

    queueItem.completePlayback();
    this.currentItem = null;

    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    logger.info('Video playback completed', {
      itemId: queueItem.id,
      tokenId: queueItem.tokenId,
      duration: queueItem.getPlaybackDuration(),
    });

    this.emit('video:completed', queueItem);

    // Clean up completed items from queue to prevent accumulation
    this.clearCompleted();

    // Process next in queue
    setImmediate(() => this.processQueue());
  }

  /**
   * Skip current video
   * @returns {Promise<boolean>} True if skipped, false if nothing playing
   */
  async skipCurrent() {
    if (!this.currentItem || !this.currentItem.isPlaying()) {
      return false;
    }

    logger.info('Skipping current video', {
      itemId: this.currentItem.id,
      tokenId: this.currentItem.tokenId,
    });


    if (config.features.videoPlayback) {
      try {
        // Stop through VLC
        await vlcService.stop();
      } catch (error) {
        logger.error('Failed to stop video through VLC', { error });
      }
    }

    this.completePlayback(this.currentItem);
    return true;
  }

  /**
   * Pause current video
   * @returns {Promise<boolean>} True if paused, false if nothing playing
   */
  async pauseCurrent() {
    if (!this.currentItem || !this.currentItem.isPlaying()) {
      return false;
    }


    if (config.features.videoPlayback) {
      try {
        // Pause through VLC
        await vlcService.pause();
      } catch (error) {
        logger.error('Failed to pause video through VLC', { error });
      }
    }

    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    this.emit('video:paused', this.currentItem);
    return true;
  }

  /**
   * Resume current video
   * @returns {Promise<boolean>} True if resumed, false if nothing to resume
   */
  async resumeCurrent() {
    if (!this.currentItem || !this.currentItem.isPlaying()) {
      return false;
    }


    if (config.features.videoPlayback) {
      try {
        // Resume through VLC
        await vlcService.resume();

        // Restart monitoring
        const status = await vlcService.getStatus();
        const remaining = status.length ? (status.length / 1000) * (1 - status.position) : 30;
        this.monitorVlcPlayback(this.currentItem, remaining);
      } catch (error) {
        logger.error('Failed to resume video through VLC', { error });
      }
    } else {
      // Test mode - calculate remaining time
      const elapsed = (Date.now() - new Date(this.currentItem.playbackStart).getTime()) / 1000;
      const duration = this.getVideoDuration(this.currentItem.tokenId);
      const remaining = Math.max(0, duration - elapsed);

      // Set new timer for remaining time
      this.playbackTimer = setTimeout(() => {
        this.completePlayback(this.currentItem);
      }, remaining * 1000);
    }

    this.emit('video:resumed', this.currentItem);
    return true;
  }

  /**
   * Clear only pending videos from queue (keeps completed/failed items)
   * @returns {number} Number of items cleared
   */
  clearPending() {
    const pending = this.queue.filter(item => item.isPending());
    const cleared = pending.length;

    // Mark all pending as cancelled
    pending.forEach(item => {
      item.failPlayback('Queue cleared');
    });

    // Remove all pending items
    this.queue = this.queue.filter(item => !item.isPending());

    logger.info('Pending items cleared from queue', { itemsCleared: cleared });
    this.emit('queue:pending-cleared', { itemsCleared: cleared });

    return cleared;
  }

  /**
   * Get current queue status
   * @returns {Object}
   */
  getQueueStatus() {
    return {
      currentItem: this.currentItem?.toJSON() || null,
      queueLength: this.queue.length,
      pendingCount: this.queue.filter(item => item.isPending()).length,
      completedCount: this.queue.filter(item => item.isCompleted()).length,
      failedCount: this.queue.filter(item => item.hasFailed()).length,
    };
  }

  /**
   * Get queue items
   * @param {string} status - Optional status filter
   * @returns {Array<VideoQueueItem>}
   */
  getQueueItems(status = null) {
    if (!status) {
      return [...this.queue];
    }

    return this.queue.filter(item => item.status === status);
  }

  /**
   * Clear completed items from queue
   * @returns {number} Number of items cleared
   */
  clearCompleted() {
    const before = this.queue.length;
    this.queue = this.queue.filter(item => 
      !item.isCompleted() && !item.hasFailed()
    );
    const cleared = before - this.queue.length;

    if (cleared > 0) {
      logger.info('Cleared completed items from queue', { cleared });
      this.emit('queue:cleared', cleared);
    }

    return cleared;
  }

  /**
   * Add video to queue by filename (admin manual add - FR 4.2.2 line 907)
   * @param {string} videoFile - Video filename (e.g., 'rat001.mp4' or 'test_30sec.mp4')
   * @param {string} requestedBy - Device ID requesting video
   * @returns {VideoQueueItem}
   */
  addVideoByFilename(videoFile, requestedBy) {
    // Search for token by video filename (not by ID)
    const transactionService = require('./transactionService');
    let token = null;
    let tokenId = null;

    // First try: assume filename is tokenId (e.g., "jaw001.mp4" → token "jaw001")
    const potentialTokenId = videoFile.replace(/\.\w+$/, '');
    token = transactionService.tokens.get(potentialTokenId);

    if (token && token.mediaAssets?.video === videoFile) {
      tokenId = potentialTokenId;
    } else {
      // Second try: search all tokens for matching video filename
      for (const [id, t] of transactionService.tokens.entries()) {
        if (t.mediaAssets?.video === videoFile) {
          token = t;
          tokenId = id;
          break;
        }
      }
    }

    if (!token || !tokenId) {
      throw new Error(`No token found with video: ${videoFile}`);
    }

    if (!token.mediaAssets?.video) {
      throw new Error(`Token ${tokenId} does not have a video asset`);
    }

    // Create queue item with duration from token
    const queueItem = new VideoQueueItem({
      tokenId: tokenId,
      videoPath: token.mediaAssets.video,
      requestedBy: requestedBy || 'ADMIN',
      duration: token.getVideoDuration(),
    });

    this.queue.push(queueItem);

    logger.info('Video added to queue by admin', {
      itemId: queueItem.id,
      videoFile,
      tokenId,
      duration: queueItem.duration,
      requestedBy,
      queueLength: this.queue.length,
    });

    this.emit('queue:added', queueItem);

    // Process queue if not playing
    if (!this.currentItem) {
      setImmediate(() => this.processQueue());
    }

    return queueItem;
  }

  /**
   * Reorder queue - move video from one position to another (FR 4.2.2 line 908)
   * @param {number} fromIndex - Source position (0-based)
   * @param {number} toIndex - Destination position (0-based)
   */
  reorderQueue(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.queue.length) {
      throw new Error(`Invalid fromIndex: ${fromIndex} (queue length: ${this.queue.length})`);
    }
    if (toIndex < 0 || toIndex >= this.queue.length) {
      throw new Error(`Invalid toIndex: ${toIndex} (queue length: ${this.queue.length})`);
    }

    // Remove item from source position
    const [item] = this.queue.splice(fromIndex, 1);

    // Insert at destination position
    this.queue.splice(toIndex, 0, item);

    logger.info('Video queue reordered', {
      fromIndex,
      toIndex,
      tokenId: item.tokenId,
      queueLength: this.queue.length,
    });

    this.emit('queue:reordered', { fromIndex, toIndex, item });
  }

  /**
   * Clear entire queue
   */
  clearQueue() {
    // Stop current playback
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    if (this.currentItem) {
      this.currentItem.failPlayback('Queue cleared');
    }

    this.queue = [];
    this.currentItem = null;

    logger.info('Video queue cleared');
    this.emit('queue:reset');

    // Always emit idle when queue is cleared, regardless of previous state
    // This ensures GM stations know the system is idle after a stop command
    this.emit('video:idle');
  }

  /**
   * Check if video is currently playing
   * @returns {boolean}
   */
  isPlaying() {
    return this.currentItem?.isPlaying() || false;
  }

  /**
   * Get current playing video info
   * @returns {Object|null}
   */
  getCurrentVideo() {
    if (!this.currentItem || !this.currentItem.isPlaying()) {
      return null;
    }

    return {
      tokenId: this.currentItem.tokenId,
      requestedBy: this.currentItem.requestedBy,
      startTime: this.currentItem.playbackStart,
      expectedEndTime: this.currentItem.calculateExpectedEndTime(
        this.getVideoDuration(this.currentItem.tokenId)
      ),
      status: this.currentItem.status // Include status for route checks
    };
  }

  /**
   * Get video duration for a token
   * @param {string} tokenId - Token ID
   * @returns {number} Duration in seconds
   * @throws {Error} If token not found or has no duration metadata
   * @private
   */
  getVideoDuration(tokenId) {
    // Find queue item with this tokenId
    const item = this.queue.find(q => q.tokenId === tokenId) || this.currentItem;

    if (!item) {
      throw new Error(`Video not found in queue: ${tokenId}`);
    }

    // Check for undefined/null specifically (0 is valid for videos without metadata)
    if (item.duration === undefined || item.duration === null) {
      throw new Error(`Video ${tokenId} has no duration metadata`);
    }

    return item.duration;
  }

  /**
   * Get wait time for new video
   * @returns {number} Wait time in seconds
   */
  getWaitTime() {
    if (!this.isPlaying()) {
      return 0;
    }

    const pendingCount = this.queue.filter(item => item.isPending()).length;
    const currentRemaining = this.getRemainingTime();
    
    // Estimate based on current video and queue
    return currentRemaining + (pendingCount * 30); // Assume 30s average
  }

  /**
   * Get remaining time for current video
   * @returns {number} Remaining time in seconds
   */
  getRemainingTime() {
    if (!this.currentItem || !this.currentItem.isPlaying()) {
      return 0;
    }

    const elapsed = (Date.now() - new Date(this.currentItem.playbackStart).getTime()) / 1000;
    const duration = this.getVideoDuration(this.currentItem.tokenId);
    return Math.max(0, Math.ceil(duration - elapsed));
  }

  /**
   * Check queue health and timeout stuck items
   */
  checkQueueHealth() {
    // Check for stuck playing items
    if (this.currentItem && this.currentItem.shouldTimeout()) {
      logger.warn('Video playback timeout', {
        itemId: this.currentItem.id,
        tokenId: this.currentItem.tokenId,
      });
      this.currentItem.failPlayback('Playback timeout');
      this.currentItem = null;
      this.processQueue();
    }

    // Check for old pending items
    const maxPendingAge = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    this.queue.forEach(item => {
      if (item.isPending()) {
        const age = now - new Date(item.requestTime).getTime();
        if (age > maxPendingAge) {
          item.failPlayback('Request timeout');
          logger.warn('Pending video timeout', {
            itemId: item.id,
            age: Math.floor(age / 1000),
          });
        }
      }
    });
  }

  /**
   * Update queue from session
   * @param {Array} videoQueue - Video queue from session
   */
  updateFromSession(videoQueue) {
    this.queue = videoQueue.map(item => VideoQueueItem.fromJSON(item));
    this.currentItem = this.queue.find(item => item.isPlaying()) || null;
  }

  /**
   * Reset service state (for testing)
   * NOTE: Does NOT remove listeners - broadcast listeners must persist across resets
   * @returns {void}
   */
  reset() {
    // 1. Clear ALL timers/intervals FIRST (including fallback timer AND monitoring delay)
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.monitoringDelayTimer) {
      clearTimeout(this.monitoringDelayTimer);
      this.monitoringDelayTimer = null;
    }

    // 2. Reset state (but NOT listeners - broadcasts.js listeners must persist)
    this.queue = [];
    this.currentItem = null;

    // 3. Log completion
    logger.info('Video queue service reset');
  }
}

// Export singleton instance
module.exports = new VideoQueueService();