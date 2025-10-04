/**
 * Mock VLC HTTP Server for Integration Tests
 *
 * Simulates VLC HTTP API (/requests/status.json) for testing video orchestration
 * WITHOUT requiring actual VLC installation.
 *
 * IMPORTANT: This mock accurately replicates VLC's actual API behavior based on
 * vlcService.js implementation analysis.
 */

const http = require('http');
const url = require('url');
const logger = require('../../src/utils/logger');

class MockVlcServer {
  constructor() {
    this.server = null;
    this.port = null;

    // VLC state
    this.state = 'stopped';  // stopped | playing | paused
    this.currentVideo = null;
    this.currentLength = 0;  // Duration in SECONDS (VLC uses seconds, not ms!)
    this.currentTime = 0;    // Current position in SECONDS
    this.volume = 256;
    this.fullscreen = false;

    // Playlist (for testing queue behavior)
    this.playlist = [];

    // Error simulation
    this.shouldFailNext = false;
    this.failureReason = null;
  }

  /**
   * Start mock VLC HTTP server
   * @returns {Promise<number>} Port number
   */
  async start() {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Use random available port
      this.server.listen(0, () => {
        this.port = this.server.address().port;
        logger.info('Mock VLC server started', { port: this.port });
        resolve(this.port);
      });
    });
  }

  /**
   * Handle VLC HTTP API requests
   * ENDPOINT: GET /requests/status.json
   * COMMANDS: in_play, pl_play, pl_pause, pl_stop, (none for status only)
   */
  handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);

    // VLC only has ONE endpoint: /requests/status.json
    if (parsedUrl.pathname !== '/requests/status.json') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const command = parsedUrl.query.command;
    const input = parsedUrl.query.input;

    // Check for auth (VLC requires HTTP Basic Auth)
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="VLC"' });
      res.end('Unauthorized');
      return;
    }

    // Simulate command failure if configured
    if (this.shouldFailNext) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: this.failureReason || 'VLC error' }));
      this.shouldFailNext = false;
      this.failureReason = null;
      return;
    }

    // Process command
    if (command === 'in_play') {
      // in_play: Load and play video immediately
      this.handleInPlay(input);
    } else if (command === 'pl_play') {
      // pl_play: Start/resume playback
      this.handlePlay();
    } else if (command === 'pl_pause') {
      // pl_pause: Pause playback (toggle)
      this.handlePause();
    } else if (command === 'pl_stop') {
      // pl_stop: Stop playback
      this.handleStop();
    } else if (command === 'pl_loop') {
      // pl_loop: Enable loop mode (for idle loop)
      logger.debug('Mock VLC: Loop enabled');
    } else if (command === 'pl_repeat') {
      // pl_repeat: Disable loop mode
      logger.debug('Mock VLC: Loop disabled');
    }
    // If no command, just return status

    // Return VLC status JSON
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.getStatus()));
  }

  /**
   * Handle in_play command (load and play video)
   */
  handleInPlay(input) {
    if (!input) {
      logger.warn('Mock VLC: in_play called without input');
      return;
    }

    // Extract filename from file:// URL
    // Example: file:///path/to/public/videos/test.mp4 → test.mp4
    let filename = input;
    if (input.includes('videos/')) {
      filename = input.split('videos/').pop();
    } else if (input.includes('/')) {
      filename = input.split('/').pop();
    }

    this.currentVideo = filename;
    this.state = 'playing';
    this.currentTime = 0;

    // Set realistic duration based on filename
    this.currentLength = this.getVideoDuration(filename);

    logger.debug('Mock VLC: Playing video', {
      input,
      filename,
      duration: this.currentLength
    });
  }

  /**
   * Handle pl_play command (start/resume)
   */
  handlePlay() {
    if (this.currentVideo) {
      this.state = 'playing';
      logger.debug('Mock VLC: Playback started/resumed');
    }
  }

  /**
   * Handle pl_pause command (pause/unpause toggle)
   */
  handlePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      logger.debug('Mock VLC: Paused');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      logger.debug('Mock VLC: Unpaused');
    }
  }

  /**
   * Handle pl_stop command
   */
  handleStop() {
    this.state = 'stopped';
    this.currentVideo = null;
    this.currentLength = 0;
    this.currentTime = 0;
    logger.debug('Mock VLC: Stopped');
  }

  /**
   * Get current VLC status (matches real VLC response format)
   * @returns {Object} VLC status response
   */
  getStatus() {
    return {
      // VLC state
      state: this.state,

      // Current video information (nested structure matches VLC)
      information: this.currentVideo ? {
        category: {
          meta: {
            filename: this.currentVideo
          }
        }
      } : {},

      // Playback info (CRITICAL: VLC uses SECONDS, not milliseconds!)
      length: this.currentLength,  // Duration in SECONDS
      time: this.currentTime,      // Current position in SECONDS
      position: this.currentLength > 0 ? this.currentTime / this.currentLength : 0,

      // Other VLC properties
      volume: this.volume,
      fullscreen: this.fullscreen,

      // VLC version info (for completeness)
      version: '3.0.0-mock',
      apiversion: 3
    };
  }

  /**
   * Get mock video duration in SECONDS
   * videoQueueService expects realistic values (> 1 second)
   */
  getVideoDuration(filename) {
    // Special test videos
    if (filename === 'test_30sec.mp4') return 30;
    if (filename === 'test_60sec.mp4') return 60;
    if (filename === 'test_10sec.mp4') return 10;
    if (filename === 'idle-loop.mp4') return 300; // 5 minutes

    // Default: 30 seconds for any other video
    return 30;
  }

  /**
   * Simulate video completion (test control method)
   * Advances time to end and sets state to stopped
   */
  simulateVideoComplete() {
    if (this.state === 'playing' && this.currentVideo) {
      this.currentTime = this.currentLength;
      this.state = 'stopped';
      logger.debug('Mock VLC: Video completed', { video: this.currentVideo });

      // Clear current video
      const completedVideo = this.currentVideo;
      this.currentVideo = null;
      this.currentLength = 0;
      this.currentTime = 0;

      return completedVideo;
    }
    return null;
  }

  /**
   * Simulate playback progress (test control method)
   * @param {number} seconds - Seconds to advance
   */
  simulateProgress(seconds) {
    if (this.state === 'playing' && this.currentVideo) {
      this.currentTime = Math.min(this.currentTime + seconds, this.currentLength);
      logger.debug('Mock VLC: Progress', {
        current: this.currentTime,
        total: this.currentLength
      });
    }
  }

  /**
   * Configure next command to fail (test control method)
   * @param {string} reason - Failure reason
   */
  simulateFailure(reason = 'Simulated VLC error') {
    this.shouldFailNext = true;
    this.failureReason = reason;
    logger.debug('Mock VLC: Next command will fail', { reason });
  }

  /**
   * Get current mock state (test assertions)
   */
  getMockState() {
    return {
      state: this.state,
      currentVideo: this.currentVideo,
      currentLength: this.currentLength,
      currentTime: this.currentTime
    };
  }

  /**
   * Reset mock state (test cleanup)
   */
  reset() {
    this.state = 'stopped';
    this.currentVideo = null;
    this.currentLength = 0;
    this.currentTime = 0;
    this.volume = 256;
    this.fullscreen = false;
    this.playlist = [];
    this.shouldFailNext = false;
    this.failureReason = null;
    logger.debug('Mock VLC: State reset');
  }

  /**
   * Stop mock VLC server
   */
  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Mock VLC server stopped');
          resolve();
        });
      });
    }
  }
}

module.exports = MockVlcServer;
