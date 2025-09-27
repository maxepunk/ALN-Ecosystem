/**
 * VLC Service
 * Manages VLC HTTP API integration for video playback control
 */

const axios = require('axios');
const EventEmitter = require('events');
const config = require('../config');
const logger = require('../utils/logger');

class VlcService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.connected = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Initialize VLC connection
   * @returns {Promise<void>}
   */
  async init() {
    try {
      // Create axios instance with VLC config
      this.client = axios.create({
        baseURL: config.vlc.host.startsWith('http') 
          ? config.vlc.host 
          : `http://${config.vlc.host}:${config.vlc.port}`,
        auth: {
          username: '',
          password: config.vlc.password,
        },
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Test connection
      await this.checkConnection();
      
      // Start health check interval
      this.startHealthCheck();
    } catch (error) {
      logger.warn('VLC service initialization failed - running in degraded mode', error);
      // Don't throw - allow system to run without VLC
      this.connected = false;
      this.emit('degraded');
    }
  }

  /**
   * Check VLC connection
   * @returns {Promise<boolean>}
   */
  async checkConnection() {
    try {
      const response = await this.client.get('/requests/status.json');
      
      if (response.status === 200) {
        if (!this.connected) {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          logger.info('VLC connection established');
        }
        return true;
      }
    } catch (error) {
      if (this.connected) {
        this.connected = false;
        this.emit('disconnected');
        logger.warn('VLC connection lost');
      }
      return false;
    }
  }

  /**
   * Play video file
   * @param {string} videoPath - Path to video file
   * @returns {Promise<Object>} VLC response or degraded response
   */
  async playVideo(videoPath) {
    if (!this.connected) {
      logger.warn('VLC not connected - returning degraded response');
      this.emit('video:played', videoPath);
      return {
        connected: false,
        state: 'playing',
        currentItem: videoPath,
        degraded: true,
        message: 'VLC not available - video control simulated'
      };
    }

    try {
      // Convert relative paths to absolute file:// URLs for VLC
      let vlcPath = videoPath;
      if (videoPath.startsWith('/')) {
        // Relative to public directory (e.g., /videos/sample.mp4)
        vlcPath = `file://${process.cwd()}/public${videoPath}`;
        logger.debug('Converted relative path to absolute', { original: videoPath, converted: vlcPath });
      } else if (!videoPath.startsWith('http') && !videoPath.startsWith('file://')) {
        // Assume it's relative to videos directory
        vlcPath = `file://${process.cwd()}/public/videos/${videoPath}`;
        logger.debug('Converted filename to absolute path', { original: videoPath, converted: vlcPath });
      }

      // Clear playlist and add new video
      await this.client.get('/requests/status.json', {
        params: {
          command: 'in_play',
          input: encodeURIComponent(vlcPath),
        },
      });

      logger.info('Video playback started', { videoPath });
      this.emit('video:played', videoPath);
      
      return await this.getStatus();
    } catch (error) {
      logger.error('Failed to play video - returning degraded response', { videoPath, error });
      // Graceful degradation - don't crash
      this.emit('video:played', videoPath);
      return {
        connected: false,
        state: 'playing',
        currentItem: videoPath,
        degraded: true,
        error: error.message
      };
    }
  }

  /**
   * Stop current playback
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.connected) {
      logger.warn('VLC not connected - simulating stop');
      this.emit('video:stopped');
      return;
    }

    try {
      await this.client.get('/requests/status.json', {
        params: { command: 'pl_stop' },
      });

      logger.info('Video playback stopped');
      this.emit('video:stopped');
    } catch (error) {
      logger.error('Failed to stop video - simulating stop', error);
      // Graceful degradation
      this.emit('video:stopped');
    }
  }

  /**
   * Pause current playback
   * @returns {Promise<void>}
   */
  async pause() {
    if (!this.connected) {
      logger.warn('VLC not connected - simulating pause');
      this.emit('video:paused');
      return;
    }

    try {
      await this.client.get('/requests/status.json', {
        params: { command: 'pl_pause' },
      });

      logger.info('Video playback paused');
      this.emit('video:paused');
    } catch (error) {
      logger.error('Failed to pause video - simulating pause', error);
      // Graceful degradation
      this.emit('video:paused');
    }
  }

  /**
   * Resume playback
   * @returns {Promise<void>}
   */
  async resume() {
    if (!this.connected) {
      logger.warn('VLC not connected - simulating resume');
      this.emit('video:resumed');
      return;
    }

    try {
      await this.client.get('/requests/status.json', {
        params: { command: 'pl_play' },
      });

      logger.info('Video playback resumed');
      this.emit('video:resumed');
    } catch (error) {
      logger.error('Failed to resume video - simulating resume', error);
      // Graceful degradation
      this.emit('video:resumed');
    }
  }

  /**
   * Skip to next item in playlist
   * @returns {Promise<void>}
   */
  async skip() {
    if (!this.connected) {
      logger.warn('VLC not connected - simulating skip');
      this.emit('video:skipped');
      return;
    }

    try {
      await this.client.get('/requests/status.json', {
        params: { command: 'pl_next' },
      });

      logger.info('Skipped to next video');
      this.emit('video:skipped');
    } catch (error) {
      logger.error('Failed to skip video - simulating skip', error);
      // Graceful degradation
      this.emit('video:skipped');
    }
  }

  /**
   * Get current VLC status
   * @returns {Promise<Object>} Status object
   */
  async getStatus() {
    if (!this.connected) {
      return {
        connected: false,
        state: 'disconnected',
        currentItem: null,
        position: 0,
        length: 0,
        volume: 0,
      };
    }

    try {
      const response = await this.client.get('/requests/status.json');
      const status = response.data;

      return {
        connected: true,
        state: status.state,
        currentItem: status.information?.category?.meta?.filename || null,
        position: status.position || 0,
        length: status.length || 0,
        time: status.time || 0,
        volume: status.volume || 0,
        fullscreen: status.fullscreen || false,
      };
    } catch (error) {
      logger.error('Failed to get VLC status', error);
      return {
        connected: false,
        state: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Set volume
   * @param {number} volume - Volume level (0-256)
   * @returns {Promise<void>}
   */
  async setVolume(volume) {
    if (!this.connected) {
      logger.warn('VLC not connected - volume change simulated');
      return;
    }

    try {
      await this.client.get('/requests/status.json', {
        params: {
          command: 'volume',
          val: Math.max(0, Math.min(256, volume)),
        },
      });

      logger.info('Volume set', { volume });
    } catch (error) {
      logger.error('Failed to set volume - change simulated', { volume, error });
      // Graceful degradation - don't throw
    }
  }

  /**
   * Toggle fullscreen
   * @returns {Promise<void>}
   */
  async toggleFullscreen() {
    if (!this.connected) {
      logger.warn('VLC not connected - fullscreen toggle simulated');
      return;
    }

    try {
      await this.client.get('/requests/status.json', {
        params: { command: 'fullscreen' },
      });

      logger.info('Fullscreen toggled');
    } catch (error) {
      logger.error('Failed to toggle fullscreen - simulated', error);
      // Graceful degradation - don't throw
    }
  }

  /**
   * Clear playlist
   * @returns {Promise<void>}
   */
  async clearPlaylist() {
    if (!this.connected) {
      logger.warn('VLC not connected - playlist clear simulated');
      return;
    }

    try {
      await this.client.get('/requests/status.json', {
        params: { command: 'pl_empty' },
      });

      logger.info('Playlist cleared');
    } catch (error) {
      logger.error('Failed to clear playlist - simulated', error);
      // Graceful degradation - don't throw
    }
  }

  /**
   * Add video to playlist
   * @param {string} videoPath - Path to video file
   * @returns {Promise<void>}
   */
  async addToPlaylist(videoPath) {
    if (!this.connected) {
      logger.warn('VLC not connected - playlist addition simulated', { videoPath });
      return;
    }

    try {
      await this.client.get('/requests/status.json', {
        params: {
          command: 'in_enqueue',
          input: encodeURIComponent(videoPath),
        },
      });

      logger.info('Video added to playlist', { videoPath });
    } catch (error) {
      logger.error('Failed to add video to playlist - simulated', { videoPath, error });
      // Graceful degradation - don't throw
    }
  }

  /**
   * Seek to position
   * @param {number} position - Position in seconds
   * @returns {Promise<void>}
   */
  async seek(position) {
    if (!this.connected) {
      logger.warn('VLC not connected - seek simulated', { position });
      return;
    }

    try {
      await this.client.get('/requests/status.json', {
        params: {
          command: 'seek',
          val: position,
        },
      });

      logger.info('Seeked to position', { position });
    } catch (error) {
      logger.error('Failed to seek - simulated', { position, error });
      // Graceful degradation - don't throw
    }
  }

  /**
   * Start health check interval
   * @private
   */
  startHealthCheck() {
    // Store interval so it can be cleared
    this.healthCheckInterval = setInterval(async () => {
      await this.checkConnection();
      if (!this.connected) {
        this.scheduleReconnect();
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop health check interval
   * @private
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   * @private
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      config.vlc.reconnectInterval * this.reconnectAttempts,
      30000
    );

    logger.info('Scheduling VLC reconnection', {
      attempt: this.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      if (this.reconnectAttempts < config.vlc.maxRetries) {
        await this.checkConnection();
        if (!this.connected) {
          this.scheduleReconnect();
        }
      } else {
        logger.error('Max VLC reconnection attempts reached');
        this.emit('error', new Error('VLC connection failed'));
      }
    }, delay);
  }

  /**
   * Check if service is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Cleanup on shutdown
   */
  cleanup() {
    this.stopHealthCheck();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Reset service for tests
   */
  reset() {
    this.cleanup();
    this.connected = false;
    this.isPlaying = false;
    this.currentVideo = null;
  }
}

// Export singleton instance
module.exports = new VlcService();