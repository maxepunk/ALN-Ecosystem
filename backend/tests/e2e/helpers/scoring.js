/**
 * Scoring Helper - Expected Score Calculation for E2E Tests
 *
 * Uses PRODUCTION scoring functions to calculate expected scores.
 * This ensures tests validate that backend applies its own logic correctly,
 * rather than duplicating scoring algorithms in test code.
 *
 * Single source of truth: src/services/tokenService.js
 */

const { calculateTokenValue, parseGroupMultiplier, extractGroupName } = require('../../../src/services/tokenService');

/**
 * Calculate expected score for a single token using production scoring logic
 * @param {Object} token - Token object with SF_ValueRating and SF_MemoryType
 * @returns {number} Expected score (base value × type multiplier)
 */
function calculateExpectedScore(token) {
  return calculateTokenValue(token.SF_ValueRating, token.SF_MemoryType);
}

/**
 * Calculate expected group completion bonus using production logic
 * @param {Array<Object>} tokens - Array of tokens in the same group
 * @returns {number} Expected bonus score (0 if no valid group)
 */
function calculateExpectedGroupBonus(tokens) {
  if (!tokens || tokens.length === 0) {
    return 0;
  }

  // Extract group info from first token
  const firstToken = tokens[0];
  if (!firstToken.SF_Group || firstToken.SF_Group.trim() === '') {
    return 0;
  }

  // Use production functions to parse group metadata
  const groupName = extractGroupName(firstToken.SF_Group);
  const multiplier = parseGroupMultiplier(firstToken.SF_Group);

  // Group bonus only applies if multiplier > 1x
  if (multiplier <= 1) {
    return 0;
  }

  // Calculate base score for all tokens in group
  const baseScore = tokens.reduce((sum, token) => {
    return sum + calculateExpectedScore(token);
  }, 0);

  // Bonus formula: (multiplier - 1) × baseScore
  // Example: x3 group with $10k base = (3-1) × $10k = $20k bonus
  return (multiplier - 1) * baseScore;
}

/**
 * Calculate expected total score for a team (base scores + group bonuses)
 * @param {Array<Object>} scannedTokens - All tokens scanned by team
 * @returns {number} Expected total score
 */
function calculateExpectedTotalScore(scannedTokens) {
  // Calculate base score
  const baseScore = scannedTokens.reduce((sum, token) => {
    return sum + calculateExpectedScore(token);
  }, 0);

  // Calculate group bonuses
  const groups = {};
  scannedTokens.forEach(token => {
    if (token.SF_Group && token.SF_Group.trim() !== '') {
      const groupName = extractGroupName(token.SF_Group);
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(token);
    }
  });

  const totalBonus = Object.values(groups).reduce((sum, groupTokens) => {
    return sum + calculateExpectedGroupBonus(groupTokens);
  }, 0);

  return baseScore + totalBonus;
}

module.exports = {
  calculateExpectedScore,
  calculateExpectedGroupBonus,
  calculateExpectedTotalScore
};
