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
 * Calculate token value based on rating and type (A3 slice 2: tables come
 * from the ACTIVE pack's game.json scoring block via packService — the
 * legacy scoring-config.json read retired with ledger L1. Token load runs
 * at the same boot moment as activatePack(), so values always derive from
 * the frozen pack snapshot; packless checkouts ride the baked legacy shim
 * inside getScoringRules(), loudly.)
 * @param {number} rating - SF_ValueRating (1-5)
 * @param {string} type - SF_MemoryType
 * @returns {number} Calculated point value
 */
const calculateTokenValue = (rating, type) => {
  const packService = require('./packService');
  const scoring = packService.getScoringRules();

  const baseValue = scoring.baseValues[rating] || 0;
  // EXACT-CASE lookup (D2b): types are pack-declared ids, matched
  // verbatim — scanner parity (its lookup was always exact-case). The
  // activation gate refuses tokens whose type is absent from the pack's
  // own typeMultipliers, so the UNKNOWN fallback is reached only by
  // null-typed tokens (legal, scores 0×) and packless legacy paths.
  // `??` (not `||`) lets a pack legitimately declare a 0 multiplier.
  const multiplier = scoring.typeMultipliers[type] ?? scoring.typeMultipliers.UNKNOWN;

  return Math.floor(baseValue * multiplier);
};

/**
 * PRIVATE: Load tokens.json from submodule (raw object format)
 * Single source of truth for file loading
 * @returns {Object} Raw tokens object (tokenId -> token data)
 */
const _loadTokensFile = () => {
  // Injection seam (Phase 2.x.4, generalized from a tokens.json FILE to a
  // whole pack DIRECTORY in Phase 3 A2): PACK_PATH points the entire engine
  // at an alternate game pack. packService.getPackDir() resolves it and
  // loud-warns when the override is active. With an explicit override there
  // is NO fallback: a harness-injected pack missing tokens.json must fail
  // the boot, not silently run a different token set (split-brain — the
  // harness would test against data the server never loaded).
  const packService = require('./packService');
  if (process.env.PACK_PATH) {
    const injected = path.join(packService.getPackDir(), 'tokens.json');
    try {
      const data = fs.readFileSync(injected, 'utf8');
      logger.info(`Loaded tokens from: ${injected}`);
      return JSON.parse(data);
    } catch (e) {
      logger.error(`PACK_PATH is set but its tokens.json is unreadable: ${injected} (${e.message})`);
      throw new Error(
        `CRITICAL: PACK_PATH override active but ${injected} is unreadable — refusing to fall back to a different pack.`
      );
    }
  }

  const paths = [
    path.join(packService.getPackDir(), 'tokens.json'),  // ALN-TokenData (default pack dir)
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

  // D1b (A3 slice 2b): group multipliers are pack RULES. When the active
  // pack declares a `groups` block, it is AUTHORITATIVE — the "(xN)"
  // suffix parse below survives only for packs published before the
  // block existed, and deletes entirely at the tokens-v2 cutover (D3b:
  // the Notion sync becomes the sole microformat parser).
  // eslint-disable-next-line global-require
  const packGroups = require('./packService').getGameConfig()?.groups || null;

  // Transform object format to array format expected by backend
  const tokensArray = Object.entries(tokensObject).map(([id, token]) => {
    const groupName = extractGroupName(token.SF_Group);
    const groupMultiplier = (packGroups && groupName && packGroups[groupName])
      ? packGroups[groupName].multiplier
      : parseGroupMultiplier(token.SF_Group);
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