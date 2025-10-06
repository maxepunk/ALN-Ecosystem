/**
 * VideoQueueItem Model
 * Manages video playback requests and state
 */

const { v4: uuidv4 } = require('uuid');
const { videoQueueItemSchema, validate } = require('../utils/validators');

class VideoQueueItem {
  /**
   * Create a new VideoQueueItem instance
   * @param {Object} data - VideoQueueItem data
   */
  constructor(data = {}) {
    // Generate ID if not provided
    if (!data.id) {
      data.id = uuidv4();
    }

    // Set defaults
    if (!data.requestTime) {
      data.requestTime = new Date().toISOString();
    }

    if (!data.status) {
      data.status = 'pending';
    }

    this.validate(data);
    Object.assign(this, data);
  }

  /**
   * Validate video queue item data
   * @param {Object} data - VideoQueueItem data to validate
   * @throws {ValidationError} If validation fails
   */
  validate(data) {
    const validated = validate(data, videoQueueItemSchema);
    return validated;
  }

  /**
   * Check if item is pending
   * @returns {boolean}
   */
  isPending() {
    return this.status === 'pending';
  }

  /**
   * Check if item is playing
   * @returns {boolean}
   */
  isPlaying() {
    return this.status === 'playing';
  }

  /**
   * Check if item is completed
   * @returns {boolean}
   */
  isCompleted() {
    return this.status === 'completed';
  }

  /**
   * Check if item failed
   * @returns {boolean}
   */
  hasFailed() {
    return this.status === 'failed';
  }

  /**
   * Start playing the video
   */
  startPlayback() {
    if (this.status !== 'pending') {
      throw new Error(`Cannot start playback for item with status ${this.status}`);
    }
    this.status = 'playing';
    this.playbackStart = new Date().toISOString();
    this.error = null;
  }

  /**
   * Complete the video playback
   */
  completePlayback() {
    if (this.status !== 'playing') {
      throw new Error(`Cannot complete playback for item with status ${this.status}`);
    }
    this.status = 'completed';
    this.playbackEnd = new Date().toISOString();
  }

  /**
   * Mark playback as failed
   * @param {string} error - Error message
   */
  failPlayback(error) {
    this.status = 'failed';
    this.error = error;
    if (this.status === 'playing' && !this.playbackEnd) {
      this.playbackEnd = new Date().toISOString();
    }
  }

  /**
   * Get playback duration in seconds
   * @returns {number|null} Duration in seconds or null if not completed
   */
  getPlaybackDuration() {
    if (!this.playbackStart || !this.playbackEnd) {
      return null;
    }
    const start = new Date(this.playbackStart).getTime();
    const end = new Date(this.playbackEnd).getTime();
    return Math.floor((end - start) / 1000);
  }

  /**
   * Get wait time in seconds (time from request to playback start)
   * @returns {number|null} Wait time in seconds or null if not started
   */
  getWaitTime() {
    if (!this.playbackStart) {
      return null;
    }
    const request = new Date(this.requestTime).getTime();
    const start = new Date(this.playbackStart).getTime();
    return Math.floor((start - request) / 1000);
  }

  /**
   * Calculate expected end time based on duration
   * @param {number} duration - Video duration in seconds
   * @returns {string} Expected end time in ISO format
   */
  calculateExpectedEndTime(duration) {
    if (!this.playbackStart) {
      throw new Error('Cannot calculate end time without playback start');
    }
    const start = new Date(this.playbackStart).getTime();
    const expectedEnd = new Date(start + (duration * 1000));
    return expectedEnd.toISOString();
  }

  /**
   * Check if video should timeout
   * @param {number} maxDuration - Maximum duration in seconds
   * @returns {boolean}
   */
  shouldTimeout(maxDuration = 300) {
    if (this.status !== 'playing' || !this.playbackStart) {
      return false;
    }
    const start = new Date(this.playbackStart).getTime();
    const now = Date.now();
    const elapsed = (now - start) / 1000;
    return elapsed > maxDuration;
  }

  /**
   * Convert to JSON representation
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      tokenId: this.tokenId,
      requestedBy: this.requestedBy,
      requestTime: this.requestTime,
      status: this.status,
      videoPath: this.videoPath,
      playbackStart: this.playbackStart || null,
      playbackEnd: this.playbackEnd || null,
      error: this.error || null,
    };
  }

  /**
   * Create VideoQueueItem from JSON data
   * @param {Object} json - JSON data
   * @returns {VideoQueueItem}
   */
  static fromJSON(json) {
    return new VideoQueueItem(json);
  }

  /**
   * Create VideoQueueItem from token and request info
   * @param {Object} token - Token with video asset
   * @param {string} requestedBy - Device ID that requested the video
   * @returns {VideoQueueItem}
   */
  static fromToken(token, requestedBy) {
    if (!token.mediaAssets?.video) {
      throw new Error('Token does not have a video asset');
    }

    return new VideoQueueItem({
      tokenId: token.id,
      requestedBy: requestedBy,
      requestTime: new Date().toISOString(),
      status: 'pending',
      videoPath: token.mediaAssets.video,
      duration: token.getVideoDuration(), // Store token's duration
    });
  }
}

module.exports = VideoQueueItem;