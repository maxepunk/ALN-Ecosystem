/**
 * TokenLoader - Load token database from ALN-TokenData submodule
 * Mirrors the pattern from tokenService.js but standalone
 */

const fs = require('fs');
const path = require('path');

class TokenLoader {
  constructor() {
    this.tokens = null;
    this.tokensMap = null;
  }

  /**
   * Parse group bonus multiplier from group field
   * @param {string} group - Group field like "Marcus Sucks (x2)"
   * @returns {number} Multiplier value, defaults to 1 if not found
   */
  static parseGroupMultiplier(group) {
    if (!group) return 1;
    const match = group.match(/\(x(\d+)\)/i);
    return match ? parseInt(match[1], 10) : 1;
  }

  /**
   * Extract group name without multiplier
   * @param {string} group - Group field like "Marcus Sucks (x2)"
   * @returns {string} Group name without multiplier
   */
  static extractGroupName(group) {
    if (!group) return null;
    return group.replace(/\s*\(x\d+\)/i, '').trim() || null;
  }

  /**
   * Load raw tokens.json file
   */
  loadRawTokens() {
    const paths = [
      path.join(__dirname, '../../../ALN-TokenData/tokens.json'),
      path.join(__dirname, '../../../aln-memory-scanner/data/tokens.json')
    ];

    for (const tokenPath of paths) {
      try {
        const data = fs.readFileSync(tokenPath, 'utf8');
        return JSON.parse(data);
      } catch (e) {
        // Continue to next path
      }
    }

    throw new Error('Failed to load tokens from any configured path');
  }

  /**
   * Load and transform tokens for validation use
   * @returns {Array} Array of transformed tokens with calculated values
   */
  loadTokens() {
    if (this.tokens) return this.tokens;

    const rawTokens = this.loadRawTokens();

    // Scoring constants (must match config/index.js)
    const BASE_VALUES = { 1: 100, 2: 500, 3: 1000, 4: 5000, 5: 10000 };
    const TYPE_MULTIPLIERS = { personal: 1, business: 3, technical: 5 };

    this.tokens = Object.entries(rawTokens).map(([id, token]) => {
      const groupName = TokenLoader.extractGroupName(token.SF_Group);
      const groupMultiplier = TokenLoader.parseGroupMultiplier(token.SF_Group);

      // Calculate value
      const rating = token.SF_ValueRating || 1;
      const typeKey = (token.SF_MemoryType || 'personal').toLowerCase();
      const baseValue = BASE_VALUES[rating] || BASE_VALUES[1];
      const multiplier = TYPE_MULTIPLIERS[typeKey] || 1;
      const value = Math.floor(baseValue * multiplier);

      return {
        id,
        value,
        rating,
        memoryType: token.SF_MemoryType || 'Personal',
        memoryTypeLower: typeKey,
        groupId: groupName,
        groupMultiplier,
        rawGroup: token.SF_Group,
        hasVideo: !!token.video,
        summary: token.summary
      };
    });

    // Build map for quick lookups
    this.tokensMap = new Map(this.tokens.map(t => [t.id, t]));

    return this.tokens;
  }

  /**
   * Get token by ID
   */
  getToken(tokenId) {
    if (!this.tokensMap) {
      this.loadTokens();
    }
    return this.tokensMap.get(tokenId);
  }

  /**
   * Get all tokens in a group
   */
  getGroupTokens(groupId) {
    if (!this.tokens) {
      this.loadTokens();
    }
    return this.tokens.filter(t => t.groupId === groupId);
  }

  /**
   * Get all unique groups
   */
  getGroups() {
    if (!this.tokens) {
      this.loadTokens();
    }

    const groups = new Map();
    for (const token of this.tokens) {
      if (token.groupId && !groups.has(token.groupId)) {
        groups.set(token.groupId, {
          id: token.groupId,
          multiplier: token.groupMultiplier,
          tokens: []
        });
      }
      if (token.groupId) {
        groups.get(token.groupId).tokens.push(token);
      }
    }

    return Array.from(groups.values());
  }
}

module.exports = TokenLoader;
