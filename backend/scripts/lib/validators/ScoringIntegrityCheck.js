/**
 * ScoringIntegrityCheck - Verify blackmarket scores calculated correctly
 *
 * ARCHITECTURE:
 * - session.scores contains team score objects with baseScore, currentScore, adminAdjustments
 * - Scores are delivered to clients via transaction:new (teamScore payload) — not separately logged
 * - This validator compares independently calculated scores against session.scores
 * - Also cross-references "Team score adjusted" log entries for admin adjustments
 * - Scoring config loaded from shared ALN-TokenData/scoring-config.json (single source of truth)
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

    // Get final scores from session data (authoritative persisted state)
    let sessionScores = [];
    try {
      sessionScores = await this.logParser.getFinalScores(sessionStart, sessionEnd, session);
    } catch (err) {
      findings.push({
        severity: 'WARNING',
        message: `Could not read session scores: ${err.message}`,
        details: { error: err.message }
      });
    }

    const sessionScoreMap = new Map(sessionScores.map(b => [b.teamId, b]));

    // Admin adjustments from logs (cross-reference)
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

    // Compare calculated vs session scores for each team
    const comparisonRows = [];
    for (const [teamId, calculated] of calculatedScores) {
      const storedScore = sessionScoreMap.get(teamId);
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
        broadcastScore: storedScore?.score ?? 'N/A',
        broadcastBonus: storedScore?.bonus ?? 'N/A',
        tokenCount: calculated.tokenCount,
        blackmarketCount: calculated.blackmarketCount,
        detectiveCount: calculated.detectiveCount,
        match: 'N/A'
      };

      if (storedScore) {
        const storedTotal = storedScore.score;

        if (adjustedCalculated === storedTotal) {
          row.match = 'MATCH';
          const hasAdjustment = adjustmentTotal !== 0;
          findings.push({
            severity: 'INFO',
            message: `Team ${teamId}: Score verified ($${storedTotal.toLocaleString()})${hasAdjustment ? ` [includes $${adjustmentTotal.toLocaleString()} admin adjustment]` : ''}`,
            details: {
              teamId,
              calculated: calculated.totalScore,
              adminAdjustment: adjustmentTotal,
              adjustedTotal: adjustedCalculated,
              sessionScore: storedTotal,
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
            message: `Team ${teamId}: Score mismatch (calculated vs session)`,
            details: {
              teamId,
              calculated: calculated.totalScore,
              adminAdjustment: adjustmentTotal,
              adjustedTotal: adjustedCalculated,
              sessionScore: storedTotal,
              difference: adjustedCalculated - storedTotal,
              breakdown: {
                base: calculated.baseScore,
                bonus: calculated.bonusScore,
                completedGroups: calculated.completedGroups.map(g => g.id)
              },
              adjustmentDetails: adjustment?.entries || [],
            }
          });
        }
      } else {
        if (calculated.totalScore > 0) {
          findings.push({
            severity: 'WARNING',
            message: `Team ${teamId}: Has transactions but no score in session data`,
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

    // Check for session scores without calculated scores
    for (const [teamId, storedScore] of sessionScoreMap) {
      if (!calculatedScores.has(teamId)) {
        findings.push({
          severity: 'WARNING',
          message: `Team ${teamId}: Has session score ($${storedScore.score.toLocaleString()}) but no transactions`,
          details: { teamId, score: storedScore.score }
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
