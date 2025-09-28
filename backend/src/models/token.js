/**
 * Token Model
 * Represents a memory element with potential video trigger capability
 */

const { tokenSchema, validate } = require('../utils/validators');

class Token {
  /**
   * Create a new Token instance
   * @param {Object} data - Token data
   */
  constructor(data = {}) {
    this.validate(data);
    Object.assign(this, data);
    // Ensure groupMultiplier defaults to 1 if not provided
    this.groupMultiplier = data.groupMultiplier || 1;
  }

  /**
   * Validate token data
   * @param {Object} data - Token data to validate
   * @throws {ValidationError} If validation fails
   */
  validate(data) {
    const validated = validate(data, tokenSchema);
    return validated;
  }

  /**
   * Check if token has video asset
   * @returns {boolean}
   */
  hasVideo() {
    return !!(this.mediaAssets && this.mediaAssets.video);
  }

  /**
   * Get video duration or default
   * @returns {number} Duration in seconds
   */
  getVideoDuration() {
    if (this.metadata && this.metadata.duration) {
      return this.metadata.duration;
    }
    return 0;
  }

  /**
   * Get priority or default
   * @returns {number} Priority level
   */
  getPriority() {
    if (this.metadata && this.metadata.priority !== undefined) {
      return this.metadata.priority;
    }
    return 5; // Default priority
  }

  /**
   * Check if token belongs to a group
   * @returns {boolean}
   */
  isGrouped() {
    return !!this.groupId;
  }

  /**
   * Get group multiplier
   * @returns {number}
   */
  getGroupMultiplier() {
    return this.groupMultiplier || 1;
  }

  /**
   * Convert to JSON representation
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      value: this.value,
      memoryType: this.memoryType,
      groupId: this.groupId || null,
      groupMultiplier: this.groupMultiplier || 1,
      mediaAssets: {
        image: this.mediaAssets?.image || null,
        audio: this.mediaAssets?.audio || null,
        video: this.mediaAssets?.video || null,
      },
      metadata: {
        duration: this.metadata?.duration || null,
        priority: this.metadata?.priority || null,
      },
    };
  }

  /**
   * Create Token from JSON data
   * @param {Object} json - JSON data
   * @returns {Token}
   */
  static fromJSON(json) {
    return new Token(json);
  }

  /**
   * Clone the token
   * @returns {Token}
   */
  clone() {
    return new Token(this.toJSON());
  }
}

module.exports = Token;