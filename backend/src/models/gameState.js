/**
 * GameState Model
 * Current authoritative state of the game, derived from session data
 */

const { gameStateSchema, validate } = require('../utils/validators');

class GameState {
  /**
   * Create a new GameState instance
   * @param {Object} data - GameState data
   */
  constructor(data = {}) {
    // Set defaults
    if (!data.lastUpdate) {
      data.lastUpdate = new Date().toISOString();
    }

    if (!data.scores) {
      data.scores = [];
    }

    if (!data.recentTransactions) {
      data.recentTransactions = [];
    }

    if (!data.systemStatus) {
      data.systemStatus = {
        orchestratorOnline: true,
        vlcConnected: false,
        videoDisplayReady: false,
        offline: false,
      };
    }

    this.validate(data);
    Object.assign(this, data);
  }

  /**
   * Validate game state data
   * @param {Object} data - GameState data to validate
   * @throws {ValidationError} If validation fails
   */
  validate(data) {
    const validated = validate(data, gameStateSchema);
    return validated;
  }

  /**
   * Update the game state timestamp
   */
  touch() {
    this.lastUpdate = new Date().toISOString();
  }

  /**
   * Check if video is currently playing
   * @returns {boolean}
   */
  isVideoPlaying() {
    if (!this.currentVideo) {
      return false;
    }

    const expectedEnd = new Date(this.currentVideo.expectedEndTime).getTime();
    const now = Date.now();
    return now < expectedEnd;
  }

  /**
   * Get remaining video time in seconds
   * @returns {number} Remaining time in seconds, 0 if no video playing
   */
  getRemainingVideoTime() {
    if (!this.isVideoPlaying()) {
      return 0;
    }

    const expectedEnd = new Date(this.currentVideo.expectedEndTime).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((expectedEnd - now) / 1000));
  }

  /**
   * Set current video
   * @param {Object} videoInfo - Video information
   */
  setCurrentVideo(videoInfo) {
    if (!videoInfo) {
      this.currentVideo = null;
    } else {
      this.currentVideo = {
        tokenId: videoInfo.tokenId,
        startTime: videoInfo.startTime || new Date().toISOString(),
        expectedEndTime: videoInfo.expectedEndTime,
        requestedBy: videoInfo.requestedBy,
      };
    }
    this.touch();
  }

  /**
   * Clear current video
   */
  clearCurrentVideo() {
    this.currentVideo = null;
    this.touch();
  }

  /**
   * Update scores
   * @param {Array} scores - Updated scores array
   */
  updateScores(scores) {
    // Create a map of existing scores by teamId for efficient lookup
    const existingScoresMap = new Map();
    if (this.scores && Array.isArray(this.scores)) {
      this.scores.forEach(score => {
        existingScoresMap.set(score.teamId, score);
      });
    }

    // Update or add scores from the input array
    scores.forEach(newScore => {
      existingScoresMap.set(newScore.teamId, newScore);
    });

    // Convert map back to array, maintaining all teams
    this.scores = Array.from(existingScoresMap.values());

    this.touch();
  }

  /**
   * Update recent transactions
   * @param {Array} transactions - Recent transactions array
   */
  updateRecentTransactions(transactions) {
    this.recentTransactions = transactions;
    this.touch();
  }

  /**
   * Update system status
   * @param {Object} status - Partial status update
   */
  updateSystemStatus(status) {
    Object.assign(this.systemStatus, status);
    this.touch();
  }

  /**
   * Get team score
   * @param {string} teamId - Team ID
   * @returns {Object|null} Team score or null if not found
   */
  getTeamScore(teamId) {
    return this.scores.find(s => s.teamId === teamId) || null;
  }

  /**
   * Get winning team
   * @returns {Object|null} Winning team score or null if no scores
   */
  getWinningTeam() {
    if (this.scores.length === 0) {
      return null;
    }

    return this.scores.reduce((winner, score) => {
      return score.currentScore > winner.currentScore ? score : winner;
    });
  }

  /**
   * Check if system is fully operational
   * @returns {boolean}
   */
  isSystemOperational() {
    return this.systemStatus.orchestratorOnline &&
           this.systemStatus.vlcConnected &&
           this.systemStatus.videoDisplayReady;
  }

  /**
   * Convert to JSON representation
   * @returns {Object}
   */
  toJSON() {
    return {
      sessionId: this.sessionId,
      lastUpdate: this.lastUpdate,
      currentVideo: this.currentVideo || null,
      scores: this.scores,
      recentTransactions: this.recentTransactions,
      systemStatus: this.systemStatus,
    };
  }

  /**
   * Create GameState from JSON data
   * @param {Object} json - JSON data
   * @returns {GameState}
   */
  static fromJSON(json) {
    return new GameState(json);
  }

  /**
   * Create GameState from Session
   * @param {Object} session - Session object
   * @param {Object} systemStatus - Current system status
   * @returns {GameState}
   */
  static fromSession(session, systemStatus = {}) {
    const currentVideo = session.videoQueue?.find(v => v.status === 'playing');
    
    return new GameState({
      sessionId: session.id,
      lastUpdate: new Date().toISOString(),
      currentVideo: currentVideo ? {
        tokenId: currentVideo.tokenId,
        startTime: currentVideo.playbackStart,
        expectedEndTime: currentVideo.expectedEndTime || new Date().toISOString(),
        requestedBy: currentVideo.requestedBy,
      } : null,
      scores: session.scores || [],
      recentTransactions: session.getRecentTransactions ? 
        session.getRecentTransactions() : 
        session.transactions.slice(-10),
      systemStatus: {
        orchestratorOnline: true,
        vlcConnected: systemStatus.vlcConnected || false,
        videoDisplayReady: systemStatus.videoDisplayReady || false,
        offline: systemStatus.offline || false,
      },
    });
  }

  /**
   * Create a delta update object
   * @param {GameState|Object} previousState - Previous state to compare against (GameState or plain JSON)
   * @returns {Object} Delta update object
   */
  createDelta(previousState) {
    const delta = {};

    // Handle both GameState instances and plain JSON objects
    const prevData = previousState.toJSON ? previousState.toJSON() : previousState;

    // Check for video changes
    if (JSON.stringify(this.currentVideo) !== JSON.stringify(prevData.currentVideo)) {
      delta.currentVideo = this.currentVideo;
    }

    // Check for score changes
    if (JSON.stringify(this.scores) !== JSON.stringify(prevData.scores)) {
      delta.scores = this.scores;
    }

    // Check for transaction changes
    if (JSON.stringify(this.recentTransactions) !== JSON.stringify(prevData.recentTransactions)) {
      delta.recentTransactions = this.recentTransactions;
    }

    // Check for system status changes
    if (JSON.stringify(this.systemStatus) !== JSON.stringify(prevData.systemStatus)) {
      delta.systemStatus = this.systemStatus;
    }

    // Always include lastUpdate if there are any changes
    if (Object.keys(delta).length > 0) {
      delta.lastUpdate = this.lastUpdate;
      delta.sessionId = this.sessionId;
    }

    return delta;
  }
}

module.exports = GameState;