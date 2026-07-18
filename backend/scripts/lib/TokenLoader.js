/**
 * TokenLoader - Load token database from ALN-TokenData submodule
 * Mirrors the pattern from tokenService.js but standalone
 */

const fs = require('fs');
const path = require('path');

class TokenLoader {
  /**
   * @param {string|null} packDir - resolved pack directory (D4s2). When
   *   given, tokens.json MUST live there — no silent fallback (the
   *   engine's PACK_PATH rule: an explicitly-resolved pack that is
   *   missing its tokens is an error, never a quiet substitute). When
   *   absent, the legacy production-checkout chain applies.
   */
  constructor(packDir = null) {
    this.packDir = packDir;
    this.tokens = null;
    this.tokensMap = null;
    this._loadedDir = null; // dir tokens.json actually loaded from (groups source)
  }

  /**
   * Extract group name (v2: SF_Group IS the pure name — the "(xN)"
   * suffix parser died at the tokens-v2 cutover, A3 slice 2b/D3b; the
   * Notion sync is the sole parser of the authoring shorthand)
   * @param {string} group - v2 SF_Group: pure group name ('' = none)
   * @returns {string|null} Trimmed group name, null when ungrouped
   */
  static extractGroupName(group) {
    if (!group) return null;
    return group.trim() || null;
  }

  /**
   * Load raw tokens.json file
   */
  loadRawTokens() {
    if (this.packDir) {
      const tokenPath = path.join(this.packDir, 'tokens.json');
      try {
        const parsed = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        this._loadedDir = this.packDir;
        return parsed;
      } catch (e) {
        throw new Error(`Resolved pack has no readable tokens.json (${tokenPath}): ${e.message}`);
      }
    }

    const paths = [
      path.join(__dirname, '../../../ALN-TokenData/tokens.json'),
      path.join(__dirname, '../../../aln-memory-scanner/data/tokens.json')
    ];

    for (const tokenPath of paths) {
      try {
        const data = fs.readFileSync(tokenPath, 'utf8');
        const parsed = JSON.parse(data);
        // Remember WHERE tokens came from so the groups block resolves
        // from the same pack (v2: game.json is the sole multiplier source)
        this._loadedDir = path.dirname(tokenPath);
        return parsed;
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

    const { BASE_VALUES, TYPE_MULTIPLIERS } =
      require('./scoringConfigLoader').loadScoringConstants(this.packDir || undefined);

    // D1b/v2 (A3 slice 2b): the pack `groups` block is the SOLE
    // multiplier source — the "(xN)" fallback parse died at the cutover.
    // Undeclared names read 1 ("group with no completion bonus") —
    // unreachable for gated packs, reachable only for legacy game.json-
    // less checkouts.
    let packGroups = null;
    const groupsDir = this.packDir || this._loadedDir;
    if (groupsDir) {
      try {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        packGroups = require(path.join(groupsDir, 'game.json')).groups || null;
      } catch { /* no game.json — every multiplier reads 1 */ }
    }

    this.tokens = Object.entries(rawTokens).map(([id, token]) => {
      const groupName = TokenLoader.extractGroupName(token.SF_Group);
      const groupMultiplier = (packGroups && groupName && packGroups[groupName])
        ? packGroups[groupName].multiplier
        : 1;

      // Calculate value — mirror the ENGINE (tokenService.calculateTokenValue):
      // missing rating → 0 base, unknown type → `unknown` multiplier (0x).
      // The old 'personal'/`|| 1` defaults made validators pay tokens the
      // engine scored 0x (review finding).
      const rating = token.SF_ValueRating || 0;
      // EXACT-CASE lookup (D2b, engine parity): pack-declared ids matched
      // verbatim; null/unmatched types score the UNKNOWN bucket (0x)
      const baseValue = BASE_VALUES[rating] || 0;
      const multiplier = TYPE_MULTIPLIERS[token.SF_MemoryType] ?? TYPE_MULTIPLIERS.UNKNOWN;
      const value = Math.floor(baseValue * multiplier);

      return {
        id,
        value,
        rating,
        memoryType: token.SF_MemoryType || 'Personal',
        memoryTypeLower: (token.SF_MemoryType || 'unknown').toLowerCase(),
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
