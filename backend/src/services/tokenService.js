const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Parse group bonus multiplier from group field
 * @param {string} group - Group field like "Marcus Sucks (x2)"
 * @returns {number} Multiplier value, defaults to 1 if not found
 */
const parseGroupMultiplier = (group) => {
  if (!group) return 1;
  const match = group.match(/\(x(\d+)\)/i);
  return match ? parseInt(match[1], 10) : 1;
};

/**
 * Extract group name without multiplier
 * @param {string} group - Group field like "Marcus Sucks (x2)"
 * @returns {string} Group name without multiplier
 */
const extractGroupName = (group) => {
  if (!group) return null;
  return group.replace(/\s*\(x\d+\)/i, '').trim() || null;
};

/**
 * Validate and sanitize summary field per AsyncAPI contract
 * @param {string} summary - Summary text from token data
 * @param {string} tokenId - Token ID for logging purposes
 * @returns {string|null} Validated summary (max 350 chars) or null
 */
const validateSummary = (summary, tokenId) => {
  if (!summary) return null;

  const MAX_LENGTH = 350;  // Per AsyncAPI contract

  if (summary.length > MAX_LENGTH) {
    logger.warn(`Token ${tokenId}: summary exceeds ${MAX_LENGTH} chars (${summary.length}), truncating`);
    return summary.substring(0, MAX_LENGTH);
  }

  return summary;
};

/**
 * Calculate token value based on rating and type
 * @param {number} rating - SF_ValueRating (1-5)
 * @param {string} type - SF_MemoryType
 * @returns {number} Calculated point value
 */
const calculateTokenValue = (rating, type) => {
  // Get base value from rating map
  const baseValue = config.game.valueRatingMap[rating] || 0;

  // Get type multiplier
  const typeKey = (type || 'unknown').toLowerCase();
  const multiplier = config.game.typeMultipliers[typeKey] || config.game.typeMultipliers.unknown || 0;

  // Return calculated value
  return Math.floor(baseValue * multiplier);
};

/**
 * PRIVATE: Load tokens.json from submodule (raw object format)
 * Single source of truth for file loading
 * @returns {Object} Raw tokens object (tokenId -> token data)
 */
const _loadTokensFile = () => {
  const paths = [
    // Injection seam (Phase 2.x.4 → grows into Phase 3 runtime pack
    // loading): an explicit TOKENS_PATH wins over the submodule defaults.
    // Used by the E2E harness to run the system on a fixture token set
    // (and later: a full game pack).
    ...(process.env.TOKENS_PATH ? [process.env.TOKENS_PATH] : []),
    path.join(__dirname, '../../../ALN-TokenData/tokens.json'),
    path.join(__dirname, '../../../aln-memory-scanner/data/tokens.json')
  ];

  const failures = [];
  for (const tokenPath of paths) {
    try {
      const data = fs.readFileSync(tokenPath, 'utf8');
      logger.info(`Loaded tokens from: ${tokenPath}`);
      return JSON.parse(data);
    } catch (e) {
      // Missing fallback paths are normal on most deployments — record and
      // continue; only escalate to an error if every path fails
      failures.push(`${tokenPath}: ${e.message}`);
      logger.debug(`Token path unavailable: ${tokenPath} (${e.message})`);
    }
  }

  logger.error('Failed to load tokens from any configured path', { failures });
  throw new Error('CRITICAL: Failed to load tokens from any configured path. Check submodule configuration.');
};

/**
 * Load raw tokens for API serving (scanners cache original format)
 * @returns {Object} Raw tokens object (tokenId -> token data)
 */
const loadRawTokens = () => _loadTokensFile();

/**
 * Load and transform tokens for backend use (game logic needs calculated values)
 * Transforms raw token data into backend format with:
 * - Calculated value scores (based on rating + memory type)
 * - Parsed group multipliers
 * - Optional summary field (max 350 chars, for detective mode display)
 * @returns {Array} Transformed tokens array with calculated scores and metadata
 */
const loadTokens = () => {
  const tokensObject = _loadTokensFile();

  // Transform object format to array format expected by backend
  const tokensArray = Object.entries(tokensObject).map(([id, token]) => {
    const groupName = extractGroupName(token.SF_Group);
    const groupMultiplier = parseGroupMultiplier(token.SF_Group);
    const calculatedValue = calculateTokenValue(
      token.SF_ValueRating,
      token.SF_MemoryType
    );

    return {
      id: id,
      name: token.SF_Group || `Memory ${id}`,
      value: calculatedValue,
      memoryType: token.SF_MemoryType || 'UNKNOWN',
      groupId: groupName,
      groupMultiplier: groupMultiplier,
      mediaAssets: {
        image: token.image,
        audio: token.audio,
        video: token.video,
        processingImage: token.processingImage
      },
      metadata: {
        rfid: token.SF_RFID,
        group: token.SF_Group,
        originalType: token.SF_MemoryType,
        rating: token.SF_ValueRating,
        summary: validateSummary(token.summary, token.SF_RFID),
        owner: token.owner || null
      }
    };
  });

  logger.info(`Transformed ${tokensArray.length} tokens from submodule`);
  return tokensArray;
};

module.exports = {
  loadTokens,
  loadRawTokens,
  parseGroupMultiplier,
  extractGroupName,
  calculateTokenValue
};