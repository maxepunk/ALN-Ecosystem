/**
 * Video Queue Service
 * Manages video playback queue and coordination
 */

const EventEmitter = require('events');
const VideoQueueItem = require('../models/videoQueueItem');
const config = require('../config');
const logger = require('../utils/logger');
const vlcService = require('./vlcMprisService'); // Load at top to avoid lazy require in timer callbacks
const registry = require('./serviceHealthRegistry');
const fs = require('fs');
const path = require('path');

let heldIdCounter = 0;

class VideoQueueService extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners for integration tests (20 test files accumulate listeners)
    // Default is 10, which triggers warnings during test suite execution
    this.setMaxListeners(20);
    this.queue = [];
    this.currentItem = null;
    this.playbackTimer = null;
    this._heldVideos = [];
    this._prePlayHooks = [];

    // Listen for VLC recovery to notify GM about held items
    registry.on('health:changed', ({ serviceId, status }) => {
      if (serviceId === 'vlc' && status === 'healthy' && this._heldVideos.length > 0) {
        this.emit('video:recoverable', { heldCount: this._heldVideos.length });
      }
    });
  }

  /**
   * Register a pre-play hook that runs BEFORE video starts (blocking).
   * Used by cue engine to fire video:loading cues before VLC begins playback.
   * @param {Function} fn - Async function receiving {queueItem, tokenId}
   */
  registerPrePlayHook(fn) {
    this._prePlayHooks.push(fn);
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
      // displayControlService handles display restoration via video:idle listener
      this.emit('video:idle');
      return; // Nothing to play
    }

    // Check VLC health before attempting playback
    if (!registry.isHealthy('vlc')) {
      // Guard against duplicate holds (addToQueue triggers processQueue for each item)
      if (!this._heldVideos.some(h => h.queueItemId === nextItem.id)) {
        this._holdVideo(nextItem, 'service_down');
      }
      return;
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
    // Run pre-play hooks (blocking — e.g., attention sound completes before video)
    for (const hook of this._prePlayHooks) {
      try {
        await hook({ queueItem, tokenId: queueItem.tokenId });
      } catch (err) {
        logger.warn('[VideoQueue] Pre-play hook failed:', err.message);
      }
    }

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

    // Check if video file exists before attempting playback
    const fullPath = videoPath.startsWith('/')
      ? path.join(process.cwd(), 'public', videoPath)
      : path.join(process.cwd(), 'public', 'videos', videoPath);

    if (!fs.existsSync(fullPath)) {
      const error = new Error(`Video file not found: ${videoPath}`);
      logger.error('Video file does not exist', { videoPath, fullPath });
      throw error; // Will be caught by processQueue's try-catch
    }

    try {
      // If video playback is enabled, use VLC
      if (config.features.videoPlayback) {
        // Actually play the video through VLC
        await vlcService.playVideo(videoPath);

        // Wait for VLC to actually load and play the NEW video (condition-based waiting)
        // ROOT CAUSE FIX: VLC's in_play doesn't immediately switch videos
        // We need to wait for currentItem to match the expected video file
        const expectedFilename = videoPath.split('/').pop(); // Extract filename
        const status = await this.waitForVlcLoaded(
          expectedFilename,
          'VLC to load and play new video',
          30000  // 30s — Pi 4 needs time to buffer large video files (e.g., 1.6GB ENDGAME)
        );

        // VLC is now playing - duration is reliable
        let duration = status.length || 0;

        if (duration <= 1) {
          // Fallback to default if VLC still hasn't loaded metadata
          duration = this.getVideoDuration(queueItem.tokenId);
          logger.warn('VLC playing but no duration metadata, using default', {
            tokenId: queueItem.tokenId,
            defaultDuration: duration
          });
        } else {
          logger.debug('Got reliable duration from playing VLC', {
            tokenId: queueItem.tokenId,
            duration
          });
        }

        // Update queue item with real duration
        queueItem.duration = duration;

        const expectedEndTime = queueItem.calculateExpectedEndTime(duration);

        // Emit play event with VLC data
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
          vlcHealthy: registry.isHealthy('vlc'),
        });

        // Start monitoring immediately (VLC is confirmed playing)
        this.monitorVlcPlayback(queueItem, duration);

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
   * Wait for VLC to load and play a specific video file (condition-based waiting pattern)
   * @param {string} expectedFilename - Filename to wait for (e.g., 'jaw001.mp4')
   * @param {string} description - Description for timeout error message
   * @param {number} timeoutMs - Timeout in milliseconds (default 5000)
   * @returns {Promise<Object>} VLC status when condition met
   * @throws {Error} If timeout exceeded
   * @private
   */
  async waitForVlcLoaded(expectedFilename, description, timeoutMs = 5000) {
    const startTime = Date.now();

    while (true) {
      try {
        const status = await vlcService.getStatus();

        // Check if VLC is playing the CORRECT video file
        if (status.state === 'playing' && status.currentItem === expectedFilename) {
          logger.debug('VLC loaded and playing correct video', {
            expectedFilename,
            actualItem: status.currentItem,
            state: status.state,
            elapsed: Date.now() - startTime
          });
          return status; // Success!
        }

        // Check timeout
        const elapsed = Date.now() - startTime;
        if (elapsed > timeoutMs) {
          throw new Error(
            `Timeout waiting for ${description} after ${timeoutMs}ms. ` +
            `Expected file: ${expectedFilename}, ` +
            `Current item: ${status.currentItem || 'null'}, ` +
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

    // Small grace period (1 check) to handle brief VLC state transitions
    // This is NOT the old 3-second grace period that masked the bug
    let nonPlayingChecks = 0;
    const maxNonPlayingChecks = 1; // Allow 1 check (1 second) of non-playing state

    const checkStatus = async () => {
      try {
        const status = await vlcService.getStatus();

        // Check if still playing or paused
        if (status.state !== 'playing' && status.state !== 'paused') {
          nonPlayingChecks++;

          // If consistently non-playing for more than 1 check, video is complete
          if (nonPlayingChecks > maxNonPlayingChecks) {
            logger.debug('Video confirmed stopped after grace period', {
              state: status.state,
              nonPlayingChecks
            });
            clearInterval(this.progressTimer);
            this.progressTimer = null;
            this.completePlayback(queueItem);
            return;
          }

          // Still in grace period, wait for next check
          logger.debug('Video in non-playing state, checking again', {
            state: status.state,
            nonPlayingChecks,
            maxNonPlayingChecks
          });
          return;
        }

        // Video is playing/paused, reset grace counter
        nonPlayingChecks = 0;

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

    // Fallback timeout in case monitoring fails.
    // Use 30 min ceiling for unknown durations (standalone videos where VLC hasn't reported length).
    const fallbackDuration = expectedDuration > 0 ? expectedDuration + 5 : 1800;
    this.playbackTimer = setTimeout(() => {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
      this.completePlayback(queueItem);
    }, fallbackDuration * 1000);
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

    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    if (config.features.videoPlayback) {
      await vlcService.stop();
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
      await vlcService.pause();
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
      await vlcService.resume();

      // Restart monitoring
      const status = await vlcService.getStatus();
      const remaining = status.length ? status.length * (1 - status.position) : 30;
      this.monitorVlcPlayback(this.currentItem, remaining);
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
   * Get current video domain state snapshot.
   * This is the canonical source for the 'video' service:state domain.
   * Includes queue state AND current playback state (reads from vlcMprisService).
   * @returns {{status: string, currentVideo: Object|null, queue: Array, queueLength: number, connected: boolean}}
   */
  getState() {
    const vlcState = vlcService.getState();
    const current = this.currentItem;
    let currentVideo = null;
    let status = 'idle';

    if (current) {
      if (current.isPlaying()) {
        status = 'playing';
      } else if (current.isPending()) {
        status = 'loading';
      } else if (current.hasFailed()) {
        status = 'error';
      }
      currentVideo = {
        tokenId: current.tokenId,
        filename: current.videoPath,
      };
      if (current.isPlaying() && current.duration > 0) {
        const elapsed = (Date.now() - new Date(current.playbackStart).getTime()) / 1000;
        currentVideo.position = Math.min(elapsed / current.duration, 1);
        currentVideo.duration = current.duration;
      }
    }
    const pendingItems = this.queue.filter(item => item.isPending());
    return {
      status,
      currentVideo,
      queue: pendingItems.map(item => ({
        tokenId: item.tokenId,
        filename: item.videoPath,
      })),
      queueLength: pendingItems.length,
      connected: vlcState.connected,
    };
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

    let queueItem;
    if (token && tokenId && token.mediaAssets?.video) {
      // Token-linked video: use token metadata
      queueItem = new VideoQueueItem({
        tokenId: tokenId,
        videoPath: token.mediaAssets.video,
        requestedBy: requestedBy || 'ADMIN',
        duration: token.getVideoDuration(),
      });
    } else {
      // Standalone video (no token association, e.g., ENDGAME sequence)
      // Use filename as tokenId; duration discovered by VLC at playback
      queueItem = new VideoQueueItem({
        tokenId: potentialTokenId,
        videoPath: videoFile,
        requestedBy: requestedBy || 'ADMIN',
        duration: 0,
      });
      logger.info('Standalone video queued (no token)', { videoFile, tokenId: potentialTokenId });
    }

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
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
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
   * Check if the system can accept a new video right now.
   * Single source of truth for "can we play a video?" — checks VLC health and queue state.
   * @returns {{available: boolean, reason?: string, message?: string, waitTime?: number}}
   */
  canAcceptVideo() {
    if (!registry.isHealthy('vlc')) {
      const { message } = registry.getStatus('vlc');
      return { available: false, reason: 'vlc_down', message: `VLC is offline: ${message}` };
    }
    if (this.isPlaying()) {
      return { available: false, reason: 'video_busy', waitTime: this.getRemainingTime() };
    }
    return { available: true };
  }

  videoFileExists(filename) {
    const videoDir = path.resolve(__dirname, '../../public/videos');
    const basename = path.basename(filename);
    return fs.existsSync(path.resolve(videoDir, basename));
  }

  // ── Held video management ──

  _holdVideo(queueItem, reason) {
    const held = {
      id: `held-video-${++heldIdCounter}`,
      type: 'video',
      heldAt: new Date().toISOString(),
      reason,
      tokenId: queueItem.tokenId,
      videoFile: queueItem.videoPath,
      requestedBy: queueItem.requestedBy,
      queueItemId: queueItem.id,
      status: 'held',
    };
    this._heldVideos.push(held);
    logger.info('Video held', { heldId: held.id, tokenId: held.tokenId, reason });
    this.emit('video:held', held);
  }

  getHeldVideos() {
    return [...this._heldVideos];
  }

  /**
   * Release a held video for playback.
   * Note: This triggers processQueue() which plays the next pending item in FIFO order.
   * If multiple items are held, releasing one allows the queue to resume from the earliest item.
   */
  releaseHeld(heldId) {
    const idx = this._heldVideos.findIndex(h => h.id === heldId);
    if (idx === -1) throw new Error(`Held video not found: ${heldId}`);
    if (!registry.isHealthy('vlc')) {
      throw new Error('Cannot release held video: VLC is still down');
    }
    const held = this._heldVideos.splice(idx, 1)[0];
    held.status = 'released';
    this.emit('video:released', { heldId: held.id, tokenId: held.tokenId });
    // Re-trigger queue processing (GM decided to release — plays next FIFO item)
    setImmediate(() => this.processQueue());
  }

  discardHeld(heldId) {
    const idx = this._heldVideos.findIndex(h => h.id === heldId);
    if (idx === -1) throw new Error(`Held video not found: ${heldId}`);
    const held = this._heldVideos.splice(idx, 1)[0];
    held.status = 'discarded';
    // Remove the specific queue item by ID (not just tokenId — same token could be queued multiple times)
    const queueIdx = this.queue.findIndex(q => q.id === held.queueItemId);
    if (queueIdx !== -1) this.queue.splice(queueIdx, 1);
    this.emit('video:discarded', { heldId: held.id, tokenId: held.tokenId });
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
    // 1. Clear ALL timers/intervals FIRST
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    // 2. Reset state (but NOT listeners - broadcasts.js listeners must persist)
    this.queue = [];
    this.currentItem = null;
    this._heldVideos = [];
    this._prePlayHooks = [];
    heldIdCounter = 0;

    // 3. Log completion
    logger.info('Video queue service reset');
  }
}

// Export singleton instance
module.exports = new VideoQueueService();