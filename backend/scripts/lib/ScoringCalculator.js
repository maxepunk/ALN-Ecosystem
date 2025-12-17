/**
 * ScoringCalculator - Recalculate scores from transactions
 * Implements the scoring formula from SCORING_LOGIC.md
 *
 * CRITICAL ARCHITECTURE NOTE:
 * - session.scores is initialized to zeros and NEVER updated during gameplay
 * - Live scores exist only in transactionService.teamScores (in-memory, not persisted)
 * - Post-session validation can ONLY recalculate from transaction history
 * - Detective mode transactions ALWAYS have points = 0 (no scoring)
 * - Blackmarket mode transactions have points = BASE_VALUES[rating] × TYPE_MULTIPLIERS[type]
 */

class ScoringCalculator {
  constructor(tokens) {
    this.tokens = tokens;
    this.tokensMap = new Map(tokens.map(t => [t.id, t]));

    // Scoring constants (must match config/index.js)
    this.BASE_VALUES = { 1: 10000, 2: 25000, 3: 50000, 4: 75000, 5: 150000 };
    this.TYPE_MULTIPLIERS = { personal: 1, business: 3, technical: 5 };
  }

  /**
   * Calculate expected value for a token (blackmarket mode only)
   * @param {string} tokenId - Token ID
   * @returns {number} Expected point value
   */
  calculateTokenValue(tokenId) {
    const token = this.tokensMap.get(tokenId);
    if (!token) return 0;
    return token.value;
  }

  /**
   * Calculate expected points for a transaction based on mode
   * @param {Object} transaction - Transaction with tokenId and mode
   * @returns {number} Expected points (0 for detective, token.value for blackmarket)
   */
  calculateExpectedPoints(transaction) {
    // Detective mode ALWAYS has 0 points - this is core business logic
    if (transaction.mode === 'detective') {
      return 0;
    }
    // Blackmarket mode uses token value
    return this.calculateTokenValue(transaction.tokenId);
  }

  /**
   * Calculate expected value from rating and type directly
   * @param {number} rating - Star rating (1-5)
   * @param {string} memoryType - Memory type (Personal, Business, Technical)
   * @returns {number} Expected point value
   */
  calculateFromRatingAndType(rating, memoryType) {
    const baseValue = this.BASE_VALUES[rating] || this.BASE_VALUES[1];
    const typeKey = (memoryType || 'personal').toLowerCase();
    const multiplier = this.TYPE_MULTIPLIERS[typeKey] || 1;
    return Math.floor(baseValue * multiplier);
  }

  /**
   * Calculate total score for a team from transactions
   * CRITICAL: Only blackmarket mode transactions contribute to score
   * Detective mode transactions have 0 points by design
   * @param {Array} transactions - All session transactions
   * @param {string} teamId - Team to calculate for
   * @returns {Object} Score breakdown
   */
  calculateTeamScore(transactions, teamId) {
    const teamTxs = transactions.filter(tx =>
      tx.teamId === teamId &&
      tx.status === 'accepted'
    );

    let baseScore = 0;
    let bonusScore = 0;
    const tokenScores = [];
    const scannedTokenIds = new Set();
    let detectiveCount = 0;
    let blackmarketCount = 0;

    // Calculate base scores from transactions
    for (const tx of teamTxs) {
      // Detective mode ALWAYS 0 points - this is by design
      const isDetective = tx.mode === 'detective';
      if (isDetective) {
        detectiveCount++;
        tokenScores.push({
          tokenId: tx.tokenId,
          expected: 0,
          actual: tx.points || 0,
          match: (tx.points || 0) === 0,
          mode: 'detective'
        });
        // Detective tokens don't count toward group completion bonuses
        continue;
      }

      blackmarketCount++;
      const expectedValue = this.calculateTokenValue(tx.tokenId);
      const actualValue = tx.points || 0;

      baseScore += expectedValue;
      scannedTokenIds.add(tx.tokenId);

      tokenScores.push({
        tokenId: tx.tokenId,
        expected: expectedValue,
        actual: actualValue,
        match: expectedValue === actualValue,
        mode: tx.mode || 'blackmarket'
      });
    }

    // Calculate group bonuses
    const completedGroups = this.findCompletedGroups(scannedTokenIds);
    for (const group of completedGroups) {
      const bonus = this.calculateGroupBonus(group);
      bonusScore += bonus.amount;
    }

    return {
      teamId,
      baseScore,
      bonusScore,
      totalScore: baseScore + bonusScore,
      tokenCount: teamTxs.length,
      blackmarketCount,
      detectiveCount,
      tokenScores,
      completedGroups,
      scannedTokenIds: Array.from(scannedTokenIds)
    };
  }

  /**
   * Find all completed groups from scanned tokens
   * @param {Set} scannedTokenIds - Set of scanned token IDs
   * @returns {Array} Completed group info
   */
  findCompletedGroups(scannedTokenIds) {
    const groups = new Map();

    // Group tokens by groupId
    for (const token of this.tokens) {
      if (!token.groupId) continue;

      if (!groups.has(token.groupId)) {
        groups.set(token.groupId, {
          id: token.groupId,
          multiplier: token.groupMultiplier,
          tokens: [],
          scanned: []
        });
      }

      const group = groups.get(token.groupId);
      group.tokens.push(token);

      if (scannedTokenIds.has(token.id)) {
        group.scanned.push(token);
      }
    }

    // Find completed groups (all tokens scanned)
    const completed = [];
    for (const group of groups.values()) {
      // Groups need 2+ tokens to be completable
      if (group.tokens.length < 2) continue;

      // Check if all tokens scanned
      if (group.scanned.length === group.tokens.length) {
        completed.push(group);
      }
    }

    return completed;
  }

  /**
   * Calculate bonus for a completed group
   * @param {Object} group - Group with tokens
   * @returns {Object} Bonus calculation
   */
  calculateGroupBonus(group) {
    if (group.multiplier <= 1) {
      return { amount: 0, formula: 'No bonus (multiplier <= 1)' };
    }

    // Total base value of all tokens in group
    const totalBaseValue = group.tokens.reduce((sum, t) => sum + t.value, 0);

    // Bonus formula: (multiplier - 1) × totalBaseValue
    const bonus = (group.multiplier - 1) * totalBaseValue;

    return {
      amount: bonus,
      multiplier: group.multiplier,
      totalBaseValue,
      formula: `(${group.multiplier} - 1) × $${totalBaseValue.toLocaleString()} = $${bonus.toLocaleString()}`
    };
  }

  /**
   * Calculate all team scores for a session
   * @param {Object} session - Session data
   * @returns {Map} Team ID -> score breakdown
   */
  calculateAllTeamScores(session) {
    const transactions = session.transactions || [];
    const teamIds = new Set(transactions.map(tx => tx.teamId).filter(Boolean));

    const scores = new Map();
    for (const teamId of teamIds) {
      scores.set(teamId, this.calculateTeamScore(transactions, teamId));
    }

    return scores;
  }
}

module.exports = ScoringCalculator;
