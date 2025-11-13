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
const { calculateScore } = require('./scoring');

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

  // Find tokens by memory type and rating
  const personalTokens = availableTokens.filter(t => t.SF_MemoryType === 'Personal');
  const businessTokens = availableTokens.filter(t => t.SF_MemoryType === 'Business');
  const technicalTokens = availableTokens.filter(t => t.SF_MemoryType === 'Technical');

  // Validation: Ensure minimum required tokens exist
  if (personalTokens.length === 0) {
    throw new Error('No Personal tokens found in database. Cannot run E2E tests.');
  }
  if (businessTokens.length === 0) {
    throw new Error('No Business tokens found in database. Cannot run E2E tests.');
  }
  if (technicalTokens.length === 0) {
    throw new Error('No Technical tokens found in database. Cannot run E2E tests.');
  }

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

  // 2. ALLOCATE INDIVIDUAL TOKENS from remaining pool (excluding group members)
  const availablePersonal = personalTokens.filter(t => !usedTokenIds.has(t.SF_RFID));
  const availableBusiness = businessTokens.filter(t => !usedTokenIds.has(t.SF_RFID));
  const availableTechnical = technicalTokens.filter(t => !usedTokenIds.has(t.SF_RFID));

  // Basic scan test: any low-value Personal token (2-star)
  selected.personalToken = allocateToken(
    availablePersonal.find(t => t.SF_ValueRating === 2) || availablePersonal[0]
  );

  // Type multiplier test: Business token (3x multiplier)
  selected.businessToken = allocateToken(
    availableBusiness.find(t => t.SF_ValueRating === 3) || availableBusiness[0]
  );

  // High-value Technical token (5x multiplier)
  selected.technicalToken = allocateToken(
    availableTechnical.find(t => t.SF_ValueRating === 5) || availableTechnical[0]
  );

  // 3. ALLOCATE UNIQUE TOKENS for duplicate detection (from remaining pool)
  selected.uniqueTokens = availableTokens.slice(0, 5);

  // All tokens (for reference)
  selected.allTokens = Object.values(tokens);

  // Log selected tokens for debugging
  console.log('Token Selection Summary:');
  console.log(`  → Personal token: ${selected.personalToken.SF_RFID} (${selected.personalToken.SF_ValueRating}⭐)`);
  console.log(`  → Business token: ${selected.businessToken.SF_RFID} (${selected.businessToken.SF_ValueRating}⭐)`);
  console.log(`  → Technical token: ${selected.technicalToken.SF_RFID} (${selected.technicalToken.SF_ValueRating}⭐)`);
  console.log(`  → Group tokens: ${selected.groupTokens.length > 0 ? selected.groupTokens.map(t => t.SF_RFID).join(', ') : 'NONE FOUND'}`);
  console.log(`  → Unique tokens: ${selected.uniqueTokens.slice(0, 3).map(t => t.SF_RFID).join(', ')}... (${selected.uniqueTokens.length} total)`);

  // Validation: Warn if group tokens not found
  if (selected.groupTokens.length < 2) {
    console.warn('⚠️  Warning: No group with 2+ tokens found. Group completion bonus tests will be skipped.');
  }

  // Validation: Check for overlap (should never happen with exclusive allocation)
  const allSelections = [
    selected.personalToken.SF_RFID,
    selected.businessToken.SF_RFID,
    selected.technicalToken.SF_RFID,
    ...selected.groupTokens.map(t => t.SF_RFID),
    ...selected.uniqueTokens.map(t => t.SF_RFID)
  ];
  const uniqueSelections = new Set(allSelections);
  if (allSelections.length !== uniqueSelections.size) {
    console.warn('⚠️  WARNING: Token overlap detected in selection! This violates exclusivity.');
  }

  return selected;
}

module.exports = {
  selectTestTokens,
  fetchTokenDatabase,
  findGroupTokens
};
