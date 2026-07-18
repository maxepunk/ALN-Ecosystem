/**
 * ScoringCalculator - Recalculate scores from transactions
 * Implements the scoring formula from SCORING_LOGIC.md
 *
 * Pack-aware since D4s2: mode behavior resolves through the SAME
 * modeSemantics seam the engine uses (never mode-id literals — under the
 * old `mode === 'detective'` test every unknown mode string invented
 * money), and group math adopts the engine's §2f semantics via the pure
 * gameRules functions: completion counts any countsTowardGroups claim;
 * the bonus base sums only claims that are BOTH standard-scoring AND
 * counting (gameRules/scoring.groupBonusAmount).
 *
 * The validator's INDEPENDENT-recomputation property is deliberately
 * preserved where it matters: base scores are recomputed from the token
 * CATALOG (never trusting recorded tx.points — that is exactly what
 * lets it catch engine mispricing), while the group currencies reuse the
 * dependency-free pure seam (re-deriving those by hand is how the old
 * calculator drifted from §2f in the first place).
 */

const { loadScoringConstants } = require('./scoringConfigLoader');
const { resolveMode } = require('../../src/gameRules/modeSemantics');
const gameRules = require('../../src/gameRules/scoring');

class ScoringCalculator {
  /**
   * @param {Array} tokens - TokenLoader-transformed tokens
   * @param {Object} [opts]
   * @param {Object|null} [opts.gameConfig] - resolved pack game.json
   *   (packResolver); null rides the baked legacy ALN mode table
   * @param {string|null} [opts.packDir] - resolved pack dir for scoring
   *   constants (defaults to the production checkout)
   */
  constructor(tokens, opts = {}) {
    this.tokens = tokens;
    this.tokensMap = new Map(tokens.map(t => [t.id, t]));
    this.gameConfig = opts.gameConfig || null;

    const { BASE_VALUES, TYPE_MULTIPLIERS } = loadScoringConstants(opts.packDir || undefined);
    this.BASE_VALUES = BASE_VALUES;
    this.TYPE_MULTIPLIERS = TYPE_MULTIPLIERS;
  }

  /**
   * Catalog value for a token (what a standard-scoring claim pays)
   * @param {string} tokenId
   * @returns {number}
   */
  calculateTokenValue(tokenId) {
    const token = this.tokensMap.get(tokenId);
    if (!token) return 0;
    return token.value;
  }

  /**
   * Expected points for a transaction — the engine rule, via the seam:
   * a standard-scoring mode pays catalog value; every other resolved
   * policy pays 0; an UNRESOLVED mode pays 0 (the engine's null-record
   * reading — the old literal test paid unknown modes full value).
   * @param {Object} transaction - {tokenId, mode}
   * @returns {number}
   */
  calculateExpectedPoints(transaction) {
    const record = resolveMode(this.gameConfig, transaction.mode);
    if (!record || record.scoringPolicy !== 'standard') {
      return 0;
    }
    return this.calculateTokenValue(transaction.tokenId);
  }

  /** Is this mode's claim scored? (seam sugar for the checks) */
  isScoringMode(modeId) {
    return resolveMode(this.gameConfig, modeId)?.scoringPolicy === 'standard';
  }

  /**
   * Does the resolved pack allow negative team scores? (D2s2 —
   * scoring.semantics.allowNegative, strict === true like the engine's
   * _normalizeScoring; the legacy/packless reading mirrors ALN: true,
   * because the baked shim declares it)
   */
  get allowNegative() {
    const semantics = this.gameConfig && this.gameConfig.scoring && this.gameConfig.scoring.semantics;
    if (this.gameConfig && this.gameConfig.scoring) {
      return !!(semantics && semantics.allowNegative === true);
    }
    return true; // packless → baked ALN shim → allowNegative true
  }

  /** Does this mode's claim build group progress? (seam sugar) */
  countsTowardGroups(modeId) {
    return resolveMode(this.gameConfig, modeId)?.countsTowardGroups === true;
  }

  /**
   * A team's banked (counting-claim) token ids — the COMPLETION currency,
   * straight from the engine seam. The single predicate both group
   * validators consume (re-implementing it inline is how the old
   * `!== 'detective'` filters drifted).
   * @param {Array} transactions
   * @param {string} teamId
   * @returns {Set<string>}
   */
  teamBankedTokenIds(transactions, teamId) {
    return gameRules.teamBankedTokenIds(transactions, teamId, this.gameConfig);
  }

  /**
   * Calculate expected value from rating and type directly
   * @param {number} rating - Star rating (1-5)
   * @param {string} memoryType - Memory type (Personal, Business, Technical)
   * @returns {number} Expected point value
   */
  calculateFromRatingAndType(rating, memoryType) {
    // Mirror the ENGINE exactly (tokenService.calculateTokenValue):
    // missing rating → 0 base, missing/unknown type → the `unknown`
    // multiplier (0x). The old `|| 1` / 'personal' defaults made the
    // validator score unknown-typed tokens at 1x where the engine paid
    // 0x — false discrepancies on ALN's null-type tokens (review finding).
    const baseValue = this.BASE_VALUES[rating] || 0;
    const typeKey = (memoryType || 'unknown').toLowerCase();
    const multiplier = this.TYPE_MULTIPLIERS[typeKey] ?? this.TYPE_MULTIPLIERS.unknown;
    return Math.floor(baseValue * multiplier);
  }

  /**
   * Calculate total score for a team from transactions.
   * Base = catalog value of every SCORED claim (scoringPolicy 'standard').
   * Completion currency = every COUNTING claim (countsTowardGroups).
   * Bonus base = engine §2f (scored ∧ counting only, via gameRules).
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
    let scoredCount = 0;
    let unscoredCount = 0;
    const modeCounts = {};

    for (const tx of teamTxs) {
      const scored = this.isScoringMode(tx.mode);
      const expectedValue = scored ? this.calculateTokenValue(tx.tokenId) : 0;
      const actualValue = tx.points || 0;

      modeCounts[tx.mode || '(none)'] = (modeCounts[tx.mode || '(none)'] || 0) + 1;
      if (scored) {
        scoredCount++;
        baseScore += expectedValue;
      } else {
        unscoredCount++;
      }

      tokenScores.push({
        tokenId: tx.tokenId,
        expected: expectedValue,
        actual: actualValue,
        match: expectedValue === actualValue,
        mode: tx.mode || '(none)'
      });
    }

    // Group currencies via the engine's pure seam (§2f):
    // banked (completion) = accepted ∧ countsTowardGroups
    const bankedTokenIds = gameRules.teamBankedTokenIds(transactions, teamId, this.gameConfig);
    const completedGroups = this.findCompletedGroups(bankedTokenIds, { transactions, teamId });
    for (const group of completedGroups) {
      bonusScore += group.bonus.amount;
    }

    return {
      teamId,
      baseScore,
      bonusScore,
      totalScore: baseScore + bonusScore,
      tokenCount: teamTxs.length,
      scoredCount,
      unscoredCount,
      modeCounts,
      tokenScores,
      completedGroups,
      scannedTokenIds: Array.from(bankedTokenIds)
    };
  }

  /**
   * Find all completed groups from a team's banked (counting) claims.
   * When transactions+teamId are supplied, each completed group carries
   * its §2f bonus (scored-claims-only base via gameRules.groupBonusAmount).
   * @param {Set} bankedTokenIds - counting-claim token IDs
   * @param {Object} [context] - {transactions, teamId} for bonus math
   * @returns {Array} Completed group info
   */
  findCompletedGroups(bankedTokenIds, context = null) {
    const groups = new Map();

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

      if (bankedTokenIds.has(token.id)) {
        group.scanned.push(token);
      }
    }

    const completed = [];
    for (const group of groups.values()) {
      // Groups need 2+ tokens to be completable
      if (group.tokens.length < 2) continue;

      if (group.scanned.length === group.tokens.length) {
        group.bonus = context
          ? this.calculateGroupBonus(group, context)
          : { amount: 0, formula: 'no bonus context supplied' };
        completed.push(group);
      }
    }

    return completed;
  }

  /**
   * §2f bonus for a completed group: (multiplier − 1) × Σ catalog value
   * of the members this team claimed in a SCORED ∧ COUNTING mode — the
   * engine's groupBonusAmount, reused verbatim (a none-mode counting
   * claim contributes presence + $0; the old all-members base over-paid
   * any pack with event-only contributions).
   * @param {Object} group - Group with tokens
   * @param {Object} context - {transactions, teamId}
   * @returns {Object} Bonus calculation
   */
  calculateGroupBonus(group, context) {
    if (group.multiplier <= 1) {
      return { amount: 0, formula: 'No bonus (multiplier <= 1)' };
    }

    const amount = gameRules.groupBonusAmount({
      tokens: this.tokensMap,
      groupId: group.id,
      transactions: context.transactions,
      teamId: context.teamId,
      gameConfig: this.gameConfig,
    });
    const scoredBase = amount / (group.multiplier - 1);

    return {
      amount,
      multiplier: group.multiplier,
      totalBaseValue: scoredBase,
      formula: `(${group.multiplier} - 1) × $${scoredBase.toLocaleString()} = $${amount.toLocaleString()} (scored claims only, §2f)`
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
