/**
 * DetectiveModeCheck - Verify detective mode transactions handled correctly
 *
 * Detective mode business logic:
 * - All detective transactions MUST have points: 0 (no scoring)
 * - All detective transactions SHOULD have summary field for Evidence Board display
 * - Detective transactions are excluded from scoreboard rankings
 * - Detective scans appear on Evidence Board (hero card + feed)
 */

class DetectiveModeCheck {
  constructor(tokensMap) {
    this.tokensMap = tokensMap;
    this.name = 'Detective Mode';
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
    const detectiveTxs = transactions.filter(tx => tx.mode === 'detective');
    const blackmarketTxs = transactions.filter(tx => tx.mode === 'blackmarket');

    // Stats
    let nonZeroPoints = 0;
    let missingSummary = 0;
    let validDetective = 0;
    const teamDetectiveCounts = new Map();

    // Check each detective transaction
    for (const tx of detectiveTxs) {
      const txRef = `Transaction ${tx.id || tx.tokenId}`;
      let txValid = true;

      // CRITICAL: Detective mode MUST have 0 points
      if (tx.points && tx.points !== 0) {
        nonZeroPoints++;
        txValid = false;
        findings.push({
          severity: 'ERROR',
          message: `${txRef}: Detective mode transaction has non-zero points`,
          details: {
            tokenId: tx.tokenId,
            teamId: tx.teamId,
            points: tx.points,
            expected: 0
          }
        });
      }

      // Detective transactions SHOULD have summary for Evidence Board
      if (!tx.summary) {
        missingSummary++;
        findings.push({
          severity: 'WARNING',
          message: `${txRef}: Detective mode transaction missing summary field`,
          details: {
            tokenId: tx.tokenId,
            teamId: tx.teamId,
            note: 'Summary is displayed on Evidence Board'
          }
        });
      }

      if (txValid) {
        validDetective++;
      }

      // Count per team for evidence board stats
      const teamId = tx.teamId;
      if (teamId) {
        teamDetectiveCounts.set(teamId, (teamDetectiveCounts.get(teamId) || 0) + 1);
      }
    }

    // Determine overall status
    if (nonZeroPoints > 0) {
      status = 'FAIL';
    } else if (missingSummary > 0) {
      status = 'WARNING';
    }

    // Add summary findings
    findings.push({
      severity: 'INFO',
      message: `Detective mode: ${detectiveTxs.length} transactions, ${validDetective} valid, ${nonZeroPoints} with incorrect points`,
      details: {
        totalDetective: detectiveTxs.length,
        totalBlackmarket: blackmarketTxs.length,
        validDetective,
        nonZeroPoints,
        missingSummary
      }
    });

    // Per-team evidence counts (useful for Evidence Board verification)
    if (teamDetectiveCounts.size > 0) {
      const teamCounts = {};
      for (const [teamId, count] of teamDetectiveCounts) {
        teamCounts[teamId] = count;
      }
      findings.push({
        severity: 'INFO',
        message: 'Detective scans per team (Evidence Board entries)',
        details: { teamCounts }
      });
    }

    // Check for mixed-mode sessions (both detective and blackmarket)
    if (detectiveTxs.length > 0 && blackmarketTxs.length > 0) {
      findings.push({
        severity: 'INFO',
        message: 'Session has both detective and blackmarket transactions',
        details: {
          detectiveCount: detectiveTxs.length,
          blackmarketCount: blackmarketTxs.length,
          note: 'This is valid but unusual'
        }
      });
    }

    return {
      name: this.name,
      status,
      findings,
      summary: {
        totalTransactions: transactions.length,
        detectiveCount: detectiveTxs.length,
        blackmarketCount: blackmarketTxs.length,
        validDetective,
        nonZeroPoints,
        missingSummary,
        teamDetectiveCounts: Object.fromEntries(teamDetectiveCounts)
      }
    };
  }
}

module.exports = DetectiveModeCheck;
