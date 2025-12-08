/**
 * GroupCompletionCheck - Verify group bonuses calculated correctly
 *
 * Group completion business logic:
 * - Groups must have 2+ tokens to be completable
 * - Multiplier must be > 1x for bonus points
 * - Team must scan ALL tokens in group
 * - Only BLACKMARKET mode transactions count toward groups
 * - Bonus formula: (multiplier - 1) × totalGroupBaseScore
 */

class GroupCompletionCheck {
  constructor(calculator, tokens, logParser) {
    this.calculator = calculator;
    this.tokens = tokens;
    this.tokensMap = new Map(tokens.map(t => [t.id, t]));
    this.logParser = logParser;
    this.name = 'Group Completion';
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

    // Get group completion broadcasts from logs
    let groupBroadcasts = [];
    if (this.logParser) {
      try {
        groupBroadcasts = await this.logParser.findGroupCompletionBroadcasts(sessionStart, sessionEnd);
      } catch (err) {
        findings.push({
          severity: 'WARNING',
          message: `Could not read group completion logs: ${err.message}`,
          details: { error: err.message }
        });
      }
    }

    // Get unique teams (only from blackmarket transactions)
    const teams = new Set(
      transactions
        .filter(tx => tx.teamId && tx.status === 'accepted' && tx.mode !== 'detective')
        .map(tx => tx.teamId)
    );

    // Check each team
    for (const teamId of teams) {
      const result = this.checkTeamGroupBonuses(teamId, transactions, groupBroadcasts);

      if (result.status === 'FAIL') {
        status = 'FAIL';
      } else if (result.status === 'WARNING' && status !== 'FAIL') {
        status = 'WARNING';
      }

      findings.push(...result.findings);
    }

    // Summary
    const uniqueGroups = this.getUniqueGroups();
    const bonusGroups = uniqueGroups.filter(g => g.multiplier > 1);

    return {
      name: this.name,
      status,
      findings,
      summary: {
        teamsChecked: teams.size,
        totalGroupsInGame: uniqueGroups.length,
        groupsWithBonus: bonusGroups.length,
        groupBroadcastsInLogs: groupBroadcasts.length
      }
    };
  }

  /**
   * Check group bonuses for a single team
   */
  checkTeamGroupBonuses(teamId, transactions, groupBroadcasts) {
    const findings = [];
    let status = 'PASS';

    // Get team's blackmarket scanned tokens (detective mode doesn't count)
    const teamTxs = transactions.filter(tx =>
      tx.teamId === teamId &&
      tx.status === 'accepted' &&
      tx.mode !== 'detective'
    );
    const scannedTokenIds = new Set(teamTxs.map(tx => tx.tokenId));

    // Find which groups should be completed
    const expectedGroups = this.calculator.findCompletedGroups(scannedTokenIds);

    // Get broadcasts for this team
    const teamBroadcasts = groupBroadcasts.filter(b => b.teamId === teamId);
    const broadcastedGroupIds = new Set(teamBroadcasts.map(b => b.groupId));

    // Check expected groups
    for (const group of expectedGroups) {
      if (group.multiplier <= 1) continue; // No bonus for 1x groups

      const bonus = this.calculator.calculateGroupBonus(group);
      const wasBroadcast = broadcastedGroupIds.has(group.id);

      if (wasBroadcast) {
        // Find the matching broadcast to compare bonus values
        const broadcast = teamBroadcasts.find(b => b.groupId === group.id);
        if (broadcast && broadcast.bonus !== undefined && broadcast.bonus !== bonus.amount) {
          status = 'FAIL';
          findings.push({
            severity: 'ERROR',
            message: `Group bonus mismatch for Team ${teamId}`,
            details: {
              teamId,
              groupId: group.id,
              multiplier: group.multiplier,
              calculatedBonus: bonus.amount,
              broadcastBonus: broadcast.bonus,
              difference: bonus.amount - broadcast.bonus
            }
          });
        } else {
          findings.push({
            severity: 'INFO',
            message: `Group completion verified for Team ${teamId}`,
            details: {
              teamId,
              groupId: group.id,
              multiplier: group.multiplier,
              bonus: bonus.amount,
              tokenCount: group.tokens.length
            }
          });
        }
      } else {
        // Expected but not broadcast - this could be a missed bonus
        findings.push({
          severity: 'WARNING',
          message: `Group completion expected but not found in broadcasts`,
          details: {
            teamId,
            groupId: group.id,
            multiplier: group.multiplier,
            expectedBonus: bonus.amount,
            formula: bonus.formula,
            tokensInGroup: group.tokens.map(t => t.id),
            note: 'May be missing from logs or never broadcast'
          }
        });
        if (status === 'PASS') status = 'WARNING';
      }
    }

    // Check for broadcasts that don't match expected groups
    for (const broadcast of teamBroadcasts) {
      const expectedGroup = expectedGroups.find(g => g.id === broadcast.groupId);
      if (!expectedGroup) {
        findings.push({
          severity: 'WARNING',
          message: `Unexpected group completion broadcast`,
          details: {
            teamId,
            groupId: broadcast.groupId,
            broadcastBonus: broadcast.bonus,
            note: 'Broadcast found but group not fully scanned according to transactions'
          }
        });
        if (status === 'PASS') status = 'WARNING';
      }
    }

    // Report partial progress
    const partialGroups = this.findPartialGroups(scannedTokenIds);
    for (const partial of partialGroups) {
      if (partial.progress >= 0.5 && partial.progress < 1) {
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
      if (group.multiplier <= 1) continue;

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
          multiplier: token.groupMultiplier || 1,
          tokens: []
        });
      }

      groups.get(token.groupId).tokens.push(token);
    }

    return Array.from(groups.values());
  }
}

module.exports = GroupCompletionCheck;
