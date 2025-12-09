/**
 * ScoreParityCheck - Compare calculated scores vs stored scores
 * This is the MOST CRITICAL check - detects scoring discrepancies
 */

class ScoreParityCheck {
  constructor(calculator) {
    this.calculator = calculator;
    this.name = 'Score Parity';
  }

  /**
   * Run the validation check
   * @param {Object} session - Session data
   * @returns {Object} Check result
   */
  async run(session) {
    const findings = [];
    let status = 'PASS';

    // Get stored scores from session
    const storedScores = this.normalizeStoredScores(session.scores || []);

    // Calculate expected scores
    const calculatedScores = this.calculator.calculateAllTeamScores(session);

    // Compare each team
    for (const [teamId, calculated] of calculatedScores) {
      const stored = storedScores.get(teamId);

      if (!stored) {
        findings.push({
          severity: 'WARNING',
          message: `Team ${teamId} has transactions but no stored score`,
          details: {
            teamId,
            calculatedTotal: calculated.totalScore,
            tokenCount: calculated.tokenCount
          }
        });
        continue;
      }

      // Compare totals
      const storedTotal = stored.score || stored.total || 0;
      const difference = calculated.totalScore - storedTotal;

      if (difference !== 0) {
        status = 'FAIL';
        findings.push({
          severity: 'ERROR',
          message: `Score mismatch for Team ${teamId}`,
          details: {
            teamId,
            storedScore: storedTotal,
            calculatedScore: calculated.totalScore,
            difference,
            breakdown: {
              baseScore: calculated.baseScore,
              bonusScore: calculated.bonusScore,
              tokenCount: calculated.tokenCount,
              completedGroups: calculated.completedGroups.map(g => g.id)
            }
          }
        });
      } else {
        findings.push({
          severity: 'INFO',
          message: `Team ${teamId} score verified`,
          details: {
            teamId,
            score: storedTotal,
            tokenCount: calculated.tokenCount,
            completedGroups: calculated.completedGroups.length
          }
        });
      }
    }

    // Check for stored scores without transactions
    for (const [teamId, stored] of storedScores) {
      if (!calculatedScores.has(teamId)) {
        const storedTotal = stored.score || stored.total || 0;
        if (storedTotal > 0) {
          findings.push({
            severity: 'WARNING',
            message: `Team ${teamId} has stored score but no transactions`,
            details: {
              teamId,
              storedScore: storedTotal
            }
          });
        }
      }
    }

    return {
      name: this.name,
      status,
      findings,
      summary: this.generateSummary(calculatedScores, storedScores)
    };
  }

  /**
   * Normalize stored scores to a Map
   */
  normalizeStoredScores(scores) {
    const map = new Map();

    if (Array.isArray(scores)) {
      for (const score of scores) {
        const teamId = score.teamId || score.team;
        if (teamId) {
          map.set(teamId, score);
        }
      }
    } else if (typeof scores === 'object') {
      for (const [teamId, score] of Object.entries(scores)) {
        map.set(teamId, typeof score === 'number' ? { score } : score);
      }
    }

    return map;
  }

  /**
   * Generate summary table
   */
  generateSummary(calculated, stored) {
    const rows = [];

    const allTeams = new Set([...calculated.keys(), ...stored.keys()]);

    for (const teamId of Array.from(allTeams).sort()) {
      const calc = calculated.get(teamId);
      const store = stored.get(teamId);

      rows.push({
        teamId,
        storedScore: store ? (store.score || store.total || 0) : 'N/A',
        calculatedScore: calc ? calc.totalScore : 'N/A',
        baseScore: calc ? calc.baseScore : 'N/A',
        bonusScore: calc ? calc.bonusScore : 'N/A',
        tokenCount: calc ? calc.tokenCount : 0,
        match: calc && store ?
          (calc.totalScore === (store.score || store.total || 0) ? 'MATCH' : 'MISMATCH') :
          'N/A'
      });
    }

    return rows;
  }
}

module.exports = ScoreParityCheck;
