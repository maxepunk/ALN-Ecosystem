/**
 * TeamScore Model
 * Tracks scoring for each team in the session
 */

const { teamScoreSchema, validate } = require('../utils/validators');

class TeamScore {
  /**
   * Create a new TeamScore instance
   * @param {Object} data - TeamScore data
   */
  constructor(data = {}) {
    // Set defaults
    if (data.currentScore === undefined) {
      data.currentScore = 0;
    }

    if (data.baseScore === undefined) {
      data.baseScore = 0;
    }

    if (data.tokensScanned === undefined) {
      data.tokensScanned = 0;
    }

    if (data.bonusPoints === undefined) {
      data.bonusPoints = 0;
    }

    if (!data.completedGroups) {
      data.completedGroups = [];
    }

    if (!data.lastUpdate) {
      data.lastUpdate = new Date().toISOString();
    }

    this.validate(data);
    Object.assign(this, data);
  }

  /**
   * Validate team score data
   * @param {Object} data - TeamScore data to validate
   * @throws {ValidationError} If validation fails
   */
  validate(data) {
    const validated = validate(data, teamScoreSchema);
    return validated;
  }

  /**
   * Add points to the team score (base points from tokens)
   * @param {number} points - Points to add
   */
  addPoints(points) {
    this.baseScore += points;
    this.currentScore = this.baseScore + this.bonusPoints;
    this.lastUpdate = new Date().toISOString();
  }

  /**
   * Add bonus points (from group completions)
   * @param {number} bonus - Bonus points to add
   */
  addBonus(bonus) {
    this.bonusPoints += bonus;
    this.currentScore = this.baseScore + this.bonusPoints;
    this.lastUpdate = new Date().toISOString();
  }

  /**
   * Increment tokens scanned count
   */
  incrementTokensScanned() {
    this.tokensScanned++;
    this.lastUpdate = new Date().toISOString();
  }

  /**
   * Mark a group as completed
   * @param {string} groupId - Group ID to mark as completed
   * @returns {boolean} True if newly completed, false if already completed
   */
  completeGroup(groupId) {
    if (this.completedGroups.includes(groupId)) {
      return false;
    }
    this.completedGroups.push(groupId);
    this.lastUpdate = new Date().toISOString();
    return true;
  }

  /**
   * Check if a group is completed
   * @param {string} groupId - Group ID to check
   * @returns {boolean}
   */
  hasCompletedGroup(groupId) {
    return this.completedGroups.includes(groupId);
  }

  /**
   * Get base score (without bonuses)
   * @returns {number}
   */
  getBaseScore() {
    return this.currentScore - this.bonusPoints;
  }

  /**
   * Get average points per token
   * @returns {number}
   */
  getAveragePointsPerToken() {
    if (this.tokensScanned === 0) {
      return 0;
    }
    return this.currentScore / this.tokensScanned;
  }

  /**
   * Reset the score
   */
  reset() {
    this.currentScore = 0;
    this.tokensScanned = 0;
    this.bonusPoints = 0;
    this.completedGroups = [];
    this.lastUpdate = new Date().toISOString();
  }

  /**
   * Compare with another team score
   * @param {TeamScore} other - Other team score to compare
   * @returns {number} Positive if this team is winning, negative if losing, 0 if tied
   */
  compare(other) {
    return this.currentScore - other.currentScore;
  }

  /**
   * Get score difference with another team
   * @param {TeamScore} other - Other team score
   * @returns {number} Score difference
   */
  getScoreDifference(other) {
    return Math.abs(this.currentScore - other.currentScore);
  }

  /**
   * Check if this team is winning against another
   * @param {TeamScore} other - Other team score
   * @returns {boolean}
   */
  isWinning(other) {
    return this.currentScore > other.currentScore;
  }

  /**
   * Convert to JSON representation
   * @returns {Object}
   */
  toJSON() {
    return {
      teamId: this.teamId,
      currentScore: this.currentScore,
      tokensScanned: this.tokensScanned,
      bonusPoints: this.bonusPoints,
      completedGroups: [...this.completedGroups],
      lastUpdate: this.lastUpdate,
      lastTokenTime: this.lastTokenTime || null,
    };
  }

  /**
   * Create TeamScore from JSON data
   * @param {Object} json - JSON data
   * @returns {TeamScore}
   */
  static fromJSON(json) {
    return new TeamScore(json);
  }

  /**
   * Create initial team score
   * @param {string} teamId - Team ID
   * @returns {TeamScore}
   */
  static createInitial(teamId) {
    return new TeamScore({
      teamId: teamId,
      currentScore: 0,
      baseScore: 0,
      tokensScanned: 0,
      bonusPoints: 0,
      completedGroups: [],
      lastUpdate: new Date().toISOString(),
    });
  }

  /**
   * Merge scores from multiple sources (for recovery)
   * @param {Array<TeamScore>} scores - Array of team scores for same team
   * @returns {TeamScore}
   */
  static merge(scores) {
    if (scores.length === 0) {
      throw new Error('Cannot merge empty scores array');
    }

    const teamId = scores[0].teamId;
    const merged = TeamScore.createInitial(teamId);

    // Take highest values
    merged.currentScore = Math.max(...scores.map(s => s.currentScore));
    merged.tokensScanned = Math.max(...scores.map(s => s.tokensScanned));
    merged.bonusPoints = Math.max(...scores.map(s => s.bonusPoints));

    // Merge completed groups
    const allGroups = new Set();
    scores.forEach(s => {
      s.completedGroups.forEach(g => allGroups.add(g));
    });
    merged.completedGroups = Array.from(allGroups);

    // Take most recent update
    const updates = scores.map(s => new Date(s.lastUpdate).getTime());
    merged.lastUpdate = new Date(Math.max(...updates)).toISOString();

    return merged;
  }
}

module.exports = TeamScore;