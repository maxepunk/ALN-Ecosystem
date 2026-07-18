/**
 * NonScoringModeCheck - Verify non-scoring-mode transactions handled
 * correctly (was DetectiveModeCheck — generalized in D4s2: mode behavior
 * resolves through the semantics seam, never the 'detective' literal).
 *
 * Rules verified (ANY pack):
 * - A transaction in a mode whose scoringPolicy is not 'standard' MUST
 *   have points: 0 (the engine's pointsFor rule; unresolved modes score 0
 *   too — the null-record reading)
 * - A transaction in a mode that publishes to the EVIDENCE surface
 *   SHOULD carry a summary field (that is what the surface displays)
 */

class NonScoringModeCheck {
  /**
   * @param {Map} tokensMap
   * @param {ScoringCalculator} calculator - supplies the mode seam
   *   (isScoringMode / gameConfig-resolved semantics)
   */
  constructor(tokensMap, calculator) {
    this.tokensMap = tokensMap;
    this.calculator = calculator;
    this.name = 'Non-Scoring Modes';
  }

  _surfacesEvidence(modeId) {
    // Evidence-surfaced modes are the ones whose transactions the
    // scoreboard renders from summary text (ALN: detective).
    const { resolveMode } = require('../../../src/gameRules/modeSemantics');
    return resolveMode(this.calculator.gameConfig, modeId)?.displayBehavior.surface === 'scoreboard-evidence';
  }

  /**
   * Run the validation check
   * @param {Object} session - Session data
   * @returns {Object} Check result
   */
  async run(session) {
    const findings = [];
    let status = 'PASS';

    const transactions = session.transactions || [];
    const nonScoringTxs = transactions.filter(tx => !this.calculator.isScoringMode(tx.mode));
    const scoringTxs = transactions.filter(tx => this.calculator.isScoringMode(tx.mode));

    // Stats
    let nonZeroPoints = 0;
    let missingSummary = 0;
    let validNonScoring = 0;
    const teamNonScoringCounts = new Map();
    const modeCounts = {};

    for (const tx of nonScoringTxs) {
      const txRef = `Transaction ${tx.id || tx.tokenId}`;
      let txValid = true;
      modeCounts[tx.mode || '(none)'] = (modeCounts[tx.mode || '(none)'] || 0) + 1;

      // CRITICAL: a non-scoring mode MUST record 0 points
      if (tx.points && tx.points !== 0) {
        nonZeroPoints++;
        txValid = false;
        findings.push({
          severity: 'ERROR',
          message: `${txRef}: non-scoring mode '${tx.mode}' recorded non-zero points`,
          details: {
            tokenId: tx.tokenId,
            teamId: tx.teamId,
            mode: tx.mode,
            points: tx.points,
            expected: 0
          }
        });
      }

      // Evidence-surfaced transactions SHOULD carry a summary
      if (this._surfacesEvidence(tx.mode) && !tx.summary) {
        missingSummary++;
        findings.push({
          severity: 'WARNING',
          message: `${txRef}: evidence-surfaced mode '${tx.mode}' missing summary field`,
          details: {
            tokenId: tx.tokenId,
            teamId: tx.teamId,
            note: 'Summary is what the evidence surface displays'
          }
        });
      }

      if (txValid) {
        validNonScoring++;
      }

      const teamId = tx.teamId;
      if (teamId) {
        teamNonScoringCounts.set(teamId, (teamNonScoringCounts.get(teamId) || 0) + 1);
      }
    }

    if (nonZeroPoints > 0) {
      status = 'FAIL';
    } else if (missingSummary > 0) {
      status = 'WARNING';
    }

    findings.push({
      severity: 'INFO',
      message: `Non-scoring modes: ${nonScoringTxs.length} transactions, ${validNonScoring} valid, ${nonZeroPoints} with incorrect points`,
      details: {
        totalNonScoring: nonScoringTxs.length,
        totalScoring: scoringTxs.length,
        modeCounts,
        validNonScoring,
        nonZeroPoints,
        missingSummary
      }
    });

    if (teamNonScoringCounts.size > 0) {
      const teamCounts = {};
      for (const [teamId, count] of teamNonScoringCounts) {
        teamCounts[teamId] = count;
      }
      findings.push({
        severity: 'INFO',
        message: 'Non-scoring transactions per team',
        details: { teamCounts }
      });
    }

    return {
      name: this.name,
      status,
      findings,
      summary: {
        totalTransactions: transactions.length,
        nonScoringCount: nonScoringTxs.length,
        scoringCount: scoringTxs.length,
        modeCounts,
        validNonScoring,
        nonZeroPoints,
        missingSummary,
        teamNonScoringCounts: Object.fromEntries(teamNonScoringCounts)
      }
    };
  }
}

module.exports = NonScoringModeCheck;
