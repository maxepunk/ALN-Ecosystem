/**
 * ScoringIntegrityCheck - Verify blackmarket scores calculated correctly
 *
 * CRITICAL ARCHITECTURE NOTE:
 * - session.scores is ALWAYS ZEROS (initialized but never updated)
 * - Live scores exist only in transactionService.teamScores Map (in-memory, not persisted)
 * - This validator compares calculated scores against LOG BROADCASTS (what scoreboard displayed)
 * - DO NOT compare against session.scores - that is fundamentally broken
 *
 * ADMIN ADJUSTMENTS:
 * - GM stations can manually adjust team scores during gameplay (score:adjust command)
 * - These adjustments are logged as "Team score adjusted" with delta and reason
 * - Calculated scores + adjustments should equal broadcast scores
 */

class ScoringIntegrityCheck {
  constructor(calculator, logParser) {
    this.calculator = calculator;
    this.logParser = logParser;
    this.name = 'Scoring Integrity';
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
    // CRITICAL FIX: sessions use startTime, not createdAt (createdAt is always undefined)
    const sessionStart = session.startTime;
    const sessionEnd = session.endTime || new Date().toISOString();

    // Calculate expected scores from transactions
    const calculatedScores = this.calculator.calculateAllTeamScores(session);

    // Get final broadcast values from logs (what scoreboard actually displayed)
    let broadcastScores = [];
    try {
      broadcastScores = await this.logParser.getFinalScoreBroadcasts(sessionStart, sessionEnd);
    } catch (err) {
      findings.push({
        severity: 'WARNING',
        message: `Could not read log broadcasts: ${err.message}`,
        details: { error: err.message }
      });
    }

    const broadcastMap = new Map(broadcastScores.map(b => [b.teamId, b]));

    // ========================================
    // ADMIN SCORE ADJUSTMENTS
    // ========================================
    // GM stations can manually adjust team scores - must account for these!
    let adminAdjustments = [];
    const adjustmentsByTeam = new Map();

    try {
      adminAdjustments = await this.logParser.findScoreAdjustments(sessionStart, sessionEnd);

      for (const adj of adminAdjustments) {
        const current = adjustmentsByTeam.get(adj.teamId) || { total: 0, entries: [] };
        current.total += adj.delta;
        current.entries.push(adj);
        adjustmentsByTeam.set(adj.teamId, current);
      }

      // Report adjustments found
      if (adminAdjustments.length > 0) {
        findings.push({
          severity: 'INFO',
          message: `Found ${adminAdjustments.length} admin score adjustment(s)`,
          details: {
            adjustments: adminAdjustments.map(a => ({
              teamId: a.teamId,
              delta: a.delta,
              reason: a.reason,
              gmStation: a.gmStation,
              timestamp: a.timestamp
            }))
          }
        });
      }
    } catch (err) {
      findings.push({
        severity: 'WARNING',
        message: `Could not read admin adjustments: ${err.message}`,
        details: { error: err.message }
      });
    }

    // Document that session.scores is always zeros (for education)
    const sessionScores = session.scores || [];
    if (sessionScores.length > 0) {
      const allZeros = sessionScores.every(s =>
        (s.currentScore || s.score || 0) === 0
      );
      if (allZeros) {
        findings.push({
          severity: 'INFO',
          message: 'session.scores is all zeros (expected - never updated during gameplay)',
          details: { note: 'Comparing against log broadcasts instead' }
        });
      }
    }

    // Compare calculated vs broadcast for each team
    const comparisonRows = [];
    for (const [teamId, calculated] of calculatedScores) {
      const broadcast = broadcastMap.get(teamId);
      const adjustment = adjustmentsByTeam.get(teamId);
      const adjustmentTotal = adjustment?.total || 0;
      const adjustedCalculated = calculated.totalScore + adjustmentTotal;

      const row = {
        teamId,
        calculatedScore: calculated.totalScore,
        calculatedBase: calculated.baseScore,
        calculatedBonus: calculated.bonusScore,
        adminAdjustment: adjustmentTotal,
        adjustedTotal: adjustedCalculated,
        broadcastScore: broadcast?.score ?? 'N/A',
        broadcastBonus: broadcast?.bonus ?? 'N/A',
        tokenCount: calculated.tokenCount,
        blackmarketCount: calculated.blackmarketCount,
        detectiveCount: calculated.detectiveCount,
        match: 'N/A'
      };

      if (broadcast) {
        const broadcastTotal = broadcast.score;

        // Compare ADJUSTED calculated (with admin adjustments) vs broadcast
        if (adjustedCalculated === broadcastTotal) {
          row.match = 'MATCH';
          const hasAdjustment = adjustmentTotal !== 0;
          findings.push({
            severity: 'INFO',
            message: `Team ${teamId}: Score verified ($${broadcastTotal.toLocaleString()})${hasAdjustment ? ` [includes $${adjustmentTotal.toLocaleString()} admin adjustment]` : ''}`,
            details: {
              teamId,
              calculated: calculated.totalScore,
              adminAdjustment: adjustmentTotal,
              adjustedTotal: adjustedCalculated,
              broadcast: broadcastTotal,
              base: calculated.baseScore,
              bonus: calculated.bonusScore,
              adjustmentDetails: adjustment?.entries || []
            }
          });
        } else {
          row.match = 'MISMATCH';
          status = 'FAIL';
          findings.push({
            severity: 'ERROR',
            message: `Team ${teamId}: Score mismatch (even after admin adjustments)`,
            details: {
              teamId,
              calculated: calculated.totalScore,
              adminAdjustment: adjustmentTotal,
              adjustedTotal: adjustedCalculated,
              broadcast: broadcastTotal,
              difference: adjustedCalculated - broadcastTotal,
              breakdown: {
                base: calculated.baseScore,
                bonus: calculated.bonusScore,
                completedGroups: calculated.completedGroups.map(g => g.id)
              },
              adjustmentDetails: adjustment?.entries || [],
              note: adjustmentTotal !== 0
                ? 'Admin adjustments were found but still mismatch'
                : 'No admin adjustments found - possible missing adjustment or bug'
            }
          });
        }
      } else {
        // No broadcast found - might be a problem
        if (calculated.totalScore > 0) {
          findings.push({
            severity: 'WARNING',
            message: `Team ${teamId}: Has transactions but no broadcast found in logs`,
            details: {
              teamId,
              calculated: calculated.totalScore,
              adminAdjustment: adjustmentTotal,
              blackmarketCount: calculated.blackmarketCount,
              detectiveCount: calculated.detectiveCount
            }
          });
          if (status === 'PASS') status = 'WARNING';
        }
      }

      comparisonRows.push(row);
    }

    // Check for broadcasts without calculated scores
    for (const [teamId, broadcast] of broadcastMap) {
      if (!calculatedScores.has(teamId)) {
        findings.push({
          severity: 'WARNING',
          message: `Team ${teamId}: Has broadcast (${broadcast.score}) but no transactions`,
          details: { teamId, broadcast }
        });
        if (status === 'PASS') status = 'WARNING';
      }
    }

    // Verify individual transaction points
    const pointsMismatches = [];
    for (const tx of transactions) {
      if (tx.status !== 'accepted' || tx.mode === 'detective') continue;

      const expectedPoints = this.calculator.calculateExpectedPoints(tx);
      const actualPoints = tx.points || 0;

      if (expectedPoints !== actualPoints) {
        pointsMismatches.push({
          tokenId: tx.tokenId,
          teamId: tx.teamId,
          expected: expectedPoints,
          actual: actualPoints,
          difference: actualPoints - expectedPoints
        });
      }
    }

    if (pointsMismatches.length > 0) {
      status = 'FAIL';
      findings.push({
        severity: 'ERROR',
        message: `${pointsMismatches.length} transactions have incorrect points values`,
        details: { mismatches: pointsMismatches.slice(0, 10) } // Limit to first 10
      });
    }

    return {
      name: this.name,
      status,
      findings,
      summary: comparisonRows
    };
  }
}

module.exports = ScoringIntegrityCheck;
