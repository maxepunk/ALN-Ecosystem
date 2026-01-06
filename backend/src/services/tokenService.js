const fs = require('fs');
const path = require('path');
const config = require('../config');

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
    console.warn(`⚠️  Token ${tokenId}: summary exceeds ${MAX_LENGTH} chars (${summary.length}), truncating`);
    return summary.substring(0, MAX_LENGTH);
  }

  return summary;
};

/**
 * Calculate token value based on rating and type
 * @param {number} rating - SF_ValueRating (1-5)
 * @param {string} type - SF_MemoryType (Personal, Business, Technical)
 * @returns {number} Calculated point value
 */
const calculateTokenValue = (rating, type) => {
  // Get base value from rating map
  const baseValue = config.game.valueRatingMap[rating] || config.game.valueRatingMap[1];

  // Get type multiplier
  const typeKey = (type || 'personal').toLowerCase();
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
    path.join(__dirname, '../../../ALN-TokenData/tokens.json'),
    path.join(__dirname, '../../../aln-memory-scanner/data/tokens.json')
  ];

  for (const tokenPath of paths) {
    try {
      const data = fs.readFileSync(tokenPath, 'utf8');
      console.log(`Loaded tokens from: ${tokenPath}`);
      return JSON.parse(data);
    } catch (e) {
      console.error(`Failed to load from ${tokenPath}:`, e.message);
      // Continue to next path
    }
  }

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
      memoryType: token.SF_MemoryType || 'Personal',  // AsyncAPI contract requires capitalized (Decision #4)
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
        summary: validateSummary(token.summary, token.SF_RFID)
      }
    };
  });

  console.log(`Transformed ${tokensArray.length} tokens from submodule`);
  return tokensArray;
};

const getTestTokens = () => [
  { id: 'MEM_001', name: 'First Memory', value: 10, memoryType: 'visual', mediaAssets: {}, metadata: {} },
  { id: 'MEM_002', name: 'Second Memory', value: 20, memoryType: 'audio', mediaAssets: {}, metadata: {} },
  { id: 'MEM_VIDEO_001', name: 'Video Memory', value: 30, memoryType: 'mixed',
    mediaAssets: { video: '/videos/sample.mp4' }, metadata: { duration: 30 } },
  { id: 'MEM_VIDEO_002', name: 'Second Video Memory', value: 25, memoryType: 'mixed',
    mediaAssets: { video: '/videos/sample2.mp4' }, metadata: { duration: 30 } },
  { id: 'MEM_REGULAR_001', name: 'Regular Memory', value: 15, memoryType: 'visual', mediaAssets: {}, metadata: {} }
];

module.exports = {
  loadTokens,
  loadRawTokens,
  getTestTokens,
  parseGroupMultiplier,
  extractGroupName,
  calculateTokenValue
};