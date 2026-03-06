/**
 * Token Selection Helper - Dynamic Token Discovery for E2E Tests
 *
 * Queries production token database via /api/tokens and selects suitable tokens
 * based on test requirements. Enables tests to work with any production token data
 * without hardcoding specific token IDs.
 *
 * Usage:
 *   const tokens = await selectTestTokens(orchestratorUrl);
 *   await scanner.manualScan(tokens.personalToken.SF_RFID);
 *   expect(score).toBe(calculateScore(tokens.personalToken));
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { calculateScore } = require('./scoring');

// Path to video files directory
const VIDEOS_DIR = path.join(__dirname, '../../../public/videos');

/**
 * Query backend for available tokens
 * @param {string} orchestratorUrl - Backend URL (e.g., 'https://localhost:3000')
 * @returns {Promise<Object>} Token database (tokenId -> token data)
 */
async function fetchTokenDatabase(orchestratorUrl) {
  return new Promise((resolve, reject) => {
    const url = `${orchestratorUrl}/api/tokens`;

    https.get(url, {
      rejectUnauthorized: false  // Accept self-signed certs in test
    }, (res) => {
      let data = '';

      res.on('data', chunk => data += chunk);

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✓ Fetched ${response.count} tokens from ${url}`);
          resolve(response.tokens);
        } catch (err) {
          reject(new Error(`Failed to parse token response: ${err.message}`));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Failed to fetch tokens from ${url}: ${err.message}`));
    });
  });
}

/**
 * Find ALL tokens in the same group (for group completion bonus tests)
 * Group completion requires scanning ALL tokens in a group, not just a subset.
 *
 * @param {Object} tokens - Token database
 * @param {number} minCount - Minimum tokens required in group
 * @returns {Array<Object>} Array of ALL tokens in same group, or [] if none found
 */
function findGroupTokens(tokens, minCount = 2) {
  const grouped = {};

  // Group tokens by SF_Group field (without multiplier)
  Object.values(tokens).forEach(token => {
    if (token.SF_Group && token.SF_Group.trim() !== '') {
      // Extract group name without multiplier (e.g., "Server Logs (x5)" -> "Server Logs")
      const groupName = token.SF_Group.replace(/\s*\(x\d+\)/i, '').trim();

      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(token);
    }
  });

  // Find first group with at least minCount tokens, return ALL tokens in that group
  for (const [groupName, groupTokens] of Object.entries(grouped)) {
    if (groupTokens.length >= minCount) {
      console.log(`  → Selected group "${groupName}" with ${groupTokens.length} tokens (returning all ${groupTokens.length})`);
      return groupTokens;  // Return ALL tokens, not slice
    }
  }

  return [];  // No suitable group found
}

/**
 * Select tokens suitable for E2E testing with EXCLUSIVE allocation
 * Ensures no token is used for multiple purposes (except in duplicate tests)
 *
 * @param {string} orchestratorUrl - Backend URL
 * @returns {Promise<Object>} Selected tokens for various test scenarios
 * @throws {Error} If required token types not found in database
 */
async function selectTestTokens(orchestratorUrl) {
  const tokens = await fetchTokenDatabase(orchestratorUrl);
  let availableTokens = Object.values(tokens);

  // Filter to only scoreable tokens (those with valid MemoryType and ValueRating)
  const scoreableTokens = availableTokens.filter(t =>
    t.SF_MemoryType && t.SF_ValueRating
  );

  // Select tokens by MULTIPLIER TIER, not specific type name.
  // This makes E2E tests resilient to type distribution shifts.
  // Tier 1 (1x): Personal
  // Tier 3 (3x): Business, Mention
  // Tier 5 (5x): Technical, Party
  const TIER_1_TYPES = ['Personal'];
  const TIER_3_TYPES = ['Business', 'Mention'];
  const TIER_5_TYPES = ['Technical', 'Party'];

  const tier1Tokens = scoreableTokens.filter(t => TIER_1_TYPES.includes(t.SF_MemoryType));
  const tier3Tokens = scoreableTokens.filter(t => TIER_3_TYPES.includes(t.SF_MemoryType));
  const tier5Tokens = scoreableTokens.filter(t => TIER_5_TYPES.includes(t.SF_MemoryType));

  // Find video tokens (have non-null video field)
  const videoTokens = availableTokens.filter(t => t.video && t.video !== '');

  // Validation: Need at least 2 tiers with tokens for meaningful scoring tests.
  // If only 1 tier exists, scoring parity tests can't verify differentiation.
  const populatedTiers = [tier1Tokens, tier3Tokens, tier5Tokens].filter(t => t.length > 0);
  if (populatedTiers.length < 2) {
    throw new Error(
      `Need tokens in at least 2 multiplier tiers for scoring tests. ` +
      `Found: Tier1(1x)=${tier1Tokens.length}, Tier3(3x)=${tier3Tokens.length}, Tier5(5x)=${tier5Tokens.length}. ` +
      `Check tokens.json has tokens with valid SF_MemoryType values.`
    );
  }

  // Need at least 3 total scoreable tokens for multi-scan tests
  if (scoreableTokens.length < 3) {
    throw new Error(
      `Need at least 3 scoreable tokens. Found ${scoreableTokens.length}. ` +
      `Check tokens.json has tokens with valid SF_MemoryType and SF_ValueRating.`
    );
  }

  const totalTokenCount = availableTokens.length;
  const selected = {};
  const usedTokenIds = new Set();

  // Helper to mark token as used and remove from available pool
  const allocateToken = (token) => {
    usedTokenIds.add(token.SF_RFID);
    availableTokens = availableTokens.filter(t => t.SF_RFID !== token.SF_RFID);
    return token;
  };

  // 1. ALLOCATE GROUP TOKENS FIRST (most restrictive - need complete group)
  selected.groupTokens = findGroupTokens(tokens, 2);
  if (selected.groupTokens.length > 0) {
    selected.groupTokens.forEach(t => usedTokenIds.add(t.SF_RFID));
    availableTokens = availableTokens.filter(t => !usedTokenIds.has(t.SF_RFID));
  }

  // 2. ALLOCATE TIER TOKENS from remaining pool (excluding group members)
  // These are exposed as personalToken/businessToken/technicalToken for
  // backward compatibility with existing E2E tests. The names are labels
  // for multiplier tiers, not type requirements.
  const availableTier1 = tier1Tokens.filter(t => !usedTokenIds.has(t.SF_RFID));
  const availableTier3 = tier3Tokens.filter(t => !usedTokenIds.has(t.SF_RFID));
  const availableTier5 = tier5Tokens.filter(t => !usedTokenIds.has(t.SF_RFID));
  const availableScoreable = scoreableTokens.filter(t => !usedTokenIds.has(t.SF_RFID));

  // Helper to pick best token from a tier with fallback to any scoreable
  const pickFromTier = (tierTokens, preferredRating) => {
    const available = tierTokens.filter(t => !usedTokenIds.has(t.SF_RFID));
    const fallback = scoreableTokens.filter(t => !usedTokenIds.has(t.SF_RFID));
    const pick = (available.find(t => t.SF_ValueRating === preferredRating) || available[0]) || fallback[0];
    if (!pick) {
      throw new Error(
        `No scoreable tokens remaining for allocation. ` +
        `Groups consumed too many tokens. Scoreable: ${scoreableTokens.length}, Used: ${usedTokenIds.size}`
      );
    }
    return allocateToken(pick);
  };

  // personalToken = Tier 1 (1x) preferred, fallback to any scoreable
  selected.personalToken = pickFromTier(availableTier1, 2);

  // businessToken = Tier 3 (3x) preferred, fallback to any scoreable
  selected.businessToken = pickFromTier(availableTier3, 3);

  // technicalToken = Tier 5 (5x) preferred, fallback to any scoreable
  selected.technicalToken = pickFromTier(availableTier5, 5);

  // Video token (for video alert testing) - exclude already used tokens AND verify video file exists
  const availableVideo = videoTokens.filter(t => {
    if (usedTokenIds.has(t.SF_RFID)) return false;
    // Verify video file actually exists on disk
    const videoPath = path.join(VIDEOS_DIR, t.video);
    const exists = fs.existsSync(videoPath);
    if (!exists) {
      console.log(`  -> Skipping video token ${t.SF_RFID}: video file "${t.video}" not found`);
    }
    return exists;
  });
  if (availableVideo.length > 0) {
    selected.videoToken = allocateToken(availableVideo[0]);
    console.log(`  -> Video token verified: ${selected.videoToken.video} exists at ${VIDEOS_DIR}`);
  } else {
    selected.videoToken = null;
  }

  // 3. ALLOCATE UNIQUE TOKENS for duplicate detection (from remaining pool)
  selected.uniqueTokens = availableTokens.slice(0, 5);

  // All tokens (for reference)
  selected.allTokens = Object.values(tokens);

  // Log selected tokens for debugging (with tier info)
  const tierLabel = (type) => {
    if (TIER_1_TYPES.includes(type)) return '1x';
    if (TIER_3_TYPES.includes(type)) return '3x';
    if (TIER_5_TYPES.includes(type)) return '5x';
    return '?x';
  };
  console.log('Token Selection Summary:');
  console.log(`  -> personalToken (tier1): ${selected.personalToken.SF_RFID} (${selected.personalToken.SF_MemoryType} ${tierLabel(selected.personalToken.SF_MemoryType)}, ${selected.personalToken.SF_ValueRating}*)`);
  console.log(`  -> businessToken (tier3): ${selected.businessToken.SF_RFID} (${selected.businessToken.SF_MemoryType} ${tierLabel(selected.businessToken.SF_MemoryType)}, ${selected.businessToken.SF_ValueRating}*)`);
  console.log(`  -> technicalToken (tier5): ${selected.technicalToken.SF_RFID} (${selected.technicalToken.SF_MemoryType} ${tierLabel(selected.technicalToken.SF_MemoryType)}, ${selected.technicalToken.SF_ValueRating}*)`);
  console.log(`  -> Video token: ${selected.videoToken ? selected.videoToken.SF_RFID : 'NONE FOUND'}`);
  console.log(`  -> Group tokens: ${selected.groupTokens.length > 0 ? selected.groupTokens.map(t => t.SF_RFID).join(', ') : 'NONE FOUND'}`);
  console.log(`  -> Unique tokens: ${selected.uniqueTokens.slice(0, 3).map(t => t.SF_RFID).join(', ')}... (${selected.uniqueTokens.length} total)`);
  console.log(`  -> Scoreable: ${scoreableTokens.length}, Null-scoring: ${totalTokenCount - scoreableTokens.length}`);

  // Validation: Warn if group tokens not found
  if (selected.groupTokens.length < 2) {
    console.warn('Warning: No group with 2+ tokens found. Group completion bonus tests will be skipped.');
  }

  // Validation: Warn if video tokens not found
  if (!selected.videoToken) {
    console.warn('Warning: No video token found. Video alert tests will be skipped.');
  }

  // Validation: Check for overlap (should never happen with exclusive allocation)
  const allSelections = [
    selected.personalToken.SF_RFID,
    selected.businessToken.SF_RFID,
    selected.technicalToken.SF_RFID,
    ...(selected.videoToken ? [selected.videoToken.SF_RFID] : []),
    ...selected.groupTokens.map(t => t.SF_RFID),
    ...selected.uniqueTokens.map(t => t.SF_RFID)
  ];
  const uniqueSelections = new Set(allSelections);
  if (allSelections.length !== uniqueSelections.size) {
    console.warn('WARNING: Token overlap detected in selection! This violates exclusivity.');
  }

  return selected;
}

module.exports = {
  selectTestTokens,
  fetchTokenDatabase,
  findGroupTokens
};
