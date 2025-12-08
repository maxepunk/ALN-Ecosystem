/**
 * GroupBonusCheck - Verify group completion bonuses
 * Ensures all earned bonuses match expected calculations
 */

class GroupBonusCheck {
  constructor(calculator, tokens) {
    this.calculator = calculator;
    this.tokens = tokens;
    this.tokensMap = new Map(tokens.map(t => [t.id, t]));
    this.name = 'Group Bonus';
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
    const storedCompletedGroups = session.completedGroups || {};

    // Get unique teams
    const teams = new Set(
      transactions
        .filter(tx => tx.teamId && tx.status === 'accepted')
        .map(tx => tx.teamId)
    );

    for (const teamId of teams) {
      const result = this.checkTeamGroupBonuses(
        teamId,
        transactions,
        storedCompletedGroups[teamId] || []
      );

      if (result.status === 'FAIL') {
        status = 'FAIL';
      }

      findings.push(...result.findings);
    }

    // Summary
    const allExpected = this.getAllExpectedGroups(transactions);

    return {
      name: this.name,
      status,
      findings,
      summary: {
        teamsChecked: teams.size,
        totalGroupsInGame: this.getUniqueGroups().length,
        groupsWithBonus: this.getUniqueGroups().filter(g => g.multiplier > 1).length,
        expectedCompletions: allExpected
      }
    };
  }

  /**
   * Check group bonuses for a single team
   */
  checkTeamGroupBonuses(teamId, transactions, storedGroups) {
    const findings = [];
    let status = 'PASS';

    // Get team's scanned tokens
    const teamTxs = transactions.filter(tx =>
      tx.teamId === teamId && tx.status === 'accepted'
    );
    const scannedTokenIds = new Set(teamTxs.map(tx => tx.tokenId));

    // Find which groups should be completed
    const expectedGroups = this.calculator.findCompletedGroups(scannedTokenIds);

    // Normalize stored groups
    const storedGroupIds = new Set(
      Array.isArray(storedGroups)
        ? storedGroups.map(g => typeof g === 'string' ? g : g.groupId || g.id)
        : Object.keys(storedGroups)
    );

    // Check for missing bonuses (expected but not stored)
    for (const group of expectedGroups) {
      if (group.multiplier <= 1) continue; // No bonus for 1x groups

      if (!storedGroupIds.has(group.id)) {
        status = 'FAIL';
        const bonus = this.calculator.calculateGroupBonus(group);
        findings.push({
          severity: 'ERROR',
          message: `Missing group bonus for Team ${teamId}`,
          details: {
            teamId,
            groupId: group.id,
            multiplier: group.multiplier,
            expectedBonus: bonus.amount,
            formula: bonus.formula,
            tokensInGroup: group.tokens.map(t => t.id)
          }
        });
      } else {
        const bonus = this.calculator.calculateGroupBonus(group);
        findings.push({
          severity: 'INFO',
          message: `Group bonus verified for Team ${teamId}`,
          details: {
            teamId,
            groupId: group.id,
            multiplier: group.multiplier,
            bonus: bonus.amount,
            tokenCount: group.tokens.length
          }
        });
      }
    }

    // Check for extra bonuses (stored but not expected)
    for (const groupId of storedGroupIds) {
      const expectedGroup = expectedGroups.find(g => g.id === groupId);
      if (!expectedGroup) {
        findings.push({
          severity: 'WARNING',
          message: `Stored group not completed by team`,
          details: {
            teamId,
            groupId,
            note: 'Group marked complete but tokens not all scanned'
          }
        });
      }
    }

    // Check partial progress
    const partialGroups = this.findPartialGroups(scannedTokenIds);
    for (const partial of partialGroups) {
      if (partial.progress > 0.5 && partial.progress < 1) {
        findings.push({
          severity: 'INFO',
          message: `Team ${teamId} has partial group progress`,
          details: {
            groupId: partial.groupId,
            multiplier: partial.multiplier,
            progress: `${partial.scanned}/${partial.total}`,
            missingTokens: partial.missing
          }
        });
      }
    }

    return { status, findings };
  }

  /**
   * Find groups with partial progress
   */
  findPartialGroups(scannedTokenIds) {
    const groups = this.getUniqueGroups();
    const partial = [];

    for (const group of groups) {
      if (group.tokens.length < 2) continue;

      const scanned = group.tokens.filter(t => scannedTokenIds.has(t.id));
      const missing = group.tokens.filter(t => !scannedTokenIds.has(t.id));

      if (scanned.length > 0 && scanned.length < group.tokens.length) {
        partial.push({
          groupId: group.groupId,
          multiplier: group.multiplier,
          scanned: scanned.length,
          total: group.tokens.length,
          progress: scanned.length / group.tokens.length,
          missing: missing.map(t => t.id)
        });
      }
    }

    return partial;
  }

  /**
   * Get all unique groups from token database
   */
  getUniqueGroups() {
    const groups = new Map();

    for (const token of this.tokens) {
      if (!token.groupId) continue;

      if (!groups.has(token.groupId)) {
        groups.set(token.groupId, {
          groupId: token.groupId,
          multiplier: token.groupMultiplier,
          tokens: []
        });
      }

      groups.get(token.groupId).tokens.push(token);
    }

    return Array.from(groups.values());
  }

  /**
   * Get all expected group completions across all teams
   */
  getAllExpectedGroups(transactions) {
    const teamGroups = new Map();

    const teams = new Set(
      transactions
        .filter(tx => tx.teamId && tx.status === 'accepted')
        .map(tx => tx.teamId)
    );

    for (const teamId of teams) {
      const teamTxs = transactions.filter(tx =>
        tx.teamId === teamId && tx.status === 'accepted'
      );
      const scannedTokenIds = new Set(teamTxs.map(tx => tx.tokenId));
      const completed = this.calculator.findCompletedGroups(scannedTokenIds);

      for (const group of completed) {
        if (group.multiplier > 1) {
          if (!teamGroups.has(teamId)) {
            teamGroups.set(teamId, []);
          }
          teamGroups.get(teamId).push(group.id);
        }
      }
    }

    return Object.fromEntries(teamGroups);
  }
}

module.exports = GroupBonusCheck;
