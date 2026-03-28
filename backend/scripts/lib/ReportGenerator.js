/**
 * ReportGenerator - Generate markdown validation report
 */

class ReportGenerator {
  /**
   * Generate full validation report
   * @param {Object} session - Session data
   * @param {Array} results - Validator results
   * @returns {string} Markdown report
   */
  static generate(session, results) {
    const lines = [];

    // Header
    lines.push('# ALN Session Validation Report');
    lines.push('');

    // Session Summary
    lines.push('## Session Summary');
    lines.push('');
    lines.push('| Property | Value |');
    lines.push('|----------|-------|');
    lines.push(`| Session ID | ${session.id} |`);
    lines.push(`| Session Name | ${session.name || 'Unnamed'} |`);
    lines.push(`| Status | ${session.status || 'unknown'} |`);
    // CRITICAL FIX: sessions use startTime, not createdAt (createdAt is always undefined)
    lines.push(`| Started | ${this.formatDate(session.startTime)} |`);
    lines.push(`| Ended | ${this.formatDate(session.endTime) || 'In Progress'} |`);
    lines.push(`| Duration | ${this.calculateDuration(session.startTime, session.endTime)} |`);
    lines.push(`| Total Transactions | ${session.transactions?.length || 0} |`);
    lines.push(`| Teams | ${this.getTeamCount(session)} |`);
    lines.push('');

    // Overall Status
    const hasFailures = results.some(r => r.status === 'FAIL');
    const hasWarnings = results.some(r => r.status === 'WARNING');
    const overallStatus = hasFailures ? 'FAIL' : (hasWarnings ? 'WARNING' : 'PASS');
    const statusEmoji = hasFailures ? '❌' : (hasWarnings ? '⚠️' : '✅');

    lines.push(`## Overall Status: ${statusEmoji} ${overallStatus}`);
    lines.push('');

    // Validation Summary Table
    lines.push('## Validation Checks');
    lines.push('');
    lines.push('| Check | Status | Issues |');
    lines.push('|-------|--------|--------|');

    for (const result of results) {
      const emoji = this.getStatusEmoji(result.status);
      const issueCount = result.findings.filter(f =>
        f.severity === 'ERROR' || f.severity === 'WARNING'
      ).length;
      lines.push(`| ${result.name} | ${emoji} ${result.status} | ${issueCount} |`);
    }
    lines.push('');

    // Team Scores (from Scoring Integrity check)
    const scoreCheck = results.find(r => r.name === 'Scoring Integrity');
    if (scoreCheck?.summary?.length > 0) {
      lines.push('## Team Scores (Calculated vs Session)');
      lines.push('');
      lines.push('> Compares independently calculated scores (from transactions + scoring config) against session.scores (final persisted state).');
      lines.push('');
      lines.push('| Team | Calculated | Adj | Total | Session | Base | Bonus | BM | Det | Status |');
      lines.push('|------|------------|-----|-------|---------|------|-------|----|----|--------|');

      for (const row of scoreCheck.summary) {
        const calc = typeof row.calculatedScore === 'number'
          ? `$${row.calculatedScore.toLocaleString()}`
          : row.calculatedScore;
        const adj = typeof row.adminAdjustment === 'number' && row.adminAdjustment !== 0
          ? `${row.adminAdjustment > 0 ? '+' : ''}$${row.adminAdjustment.toLocaleString()}`
          : '—';
        const total = typeof row.adjustedTotal === 'number'
          ? `$${row.adjustedTotal.toLocaleString()}`
          : calc;
        const sessionScore = typeof row.broadcastScore === 'number'
          ? `$${row.broadcastScore.toLocaleString()}`
          : row.broadcastScore;
        const base = typeof row.calculatedBase === 'number'
          ? `$${row.calculatedBase.toLocaleString()}`
          : row.calculatedBase;
        const bonus = typeof row.calculatedBonus === 'number'
          ? `$${row.calculatedBonus.toLocaleString()}`
          : row.calculatedBonus;
        const statusEmoji = row.match === 'MATCH' ? '✅' : (row.match === 'MISMATCH' ? '❌' : '—');

        lines.push(`| ${row.teamId} | ${calc} | ${adj} | ${total} | ${sessionScore} | ${base} | ${bonus} | ${row.blackmarketCount || 0} | ${row.detectiveCount || 0} | ${statusEmoji} |`);
      }
      lines.push('');
    }

    // Detective Mode Summary
    const detectiveCheck = results.find(r => r.name === 'Detective Mode');
    if (detectiveCheck?.summary) {
      const s = detectiveCheck.summary;
      if (s.detectiveCount > 0) {
        lines.push('## Detective Mode Summary');
        lines.push('');
        lines.push(`- **Detective scans**: ${s.detectiveCount}`);
        lines.push(`- **Blackmarket scans**: ${s.blackmarketCount}`);
        lines.push(`- **Valid detective transactions**: ${s.validDetective}`);
        if (s.nonZeroPoints > 0) {
          lines.push(`- **⚠️ Detective with points**: ${s.nonZeroPoints} (should be 0)`);
        }
        if (s.missingSummary > 0) {
          lines.push(`- **Missing summary field**: ${s.missingSummary}`);
        }
        lines.push('');
      }
    }

    // Error Summary
    const errorCheck = results.find(r => r.name === 'Error Analysis');
    if (errorCheck?.summary) {
      const s = errorCheck.summary;
      if (s.totalErrors > 0 || s.totalWarnings > 0) {
        lines.push('## Error Summary');
        lines.push('');
        lines.push(`- **Errors**: ${s.totalErrors}`);
        lines.push(`- **Warnings**: ${s.totalWarnings}`);
        if (s.httpErrors > 0) lines.push(`- HTTP errors: ${s.httpErrors}`);
        if (s.websocketErrors > 0) lines.push(`- WebSocket errors: ${s.websocketErrors}`);
        if (s.vlcErrors > 0) lines.push(`- VLC errors: ${s.vlcErrors}`);
        if (s.unhandledExceptions > 0) lines.push(`- **Unhandled exceptions**: ${s.unhandledExceptions}`);
        lines.push('');
      }
    }

    // Session Lifecycle Events
    const lifecycleCheck = results.find(r => r.name === 'Session Lifecycle');
    if (lifecycleCheck?.summary?.hasLifecycleEvents) {
      const s = lifecycleCheck.summary;
      lines.push('## Session Lifecycle Events');
      lines.push('');
      lines.push('> These events may affect game state and explain anomalies.');
      lines.push('');

      if (s.deletionCount > 0) {
        lines.push(`### 🗑️ Transaction Deletions: ${s.deletionCount}`);
        lines.push('');
        if (s.deletionDuplicationRatio > 2) {
          lines.push(`> ⚠️ **Logger duplication detected**: ${s.deletionRawLogCount} raw log entries → ${s.deletionCount} unique events (${s.deletionDuplicationRatio}x duplication)`);
          lines.push('');
        }
        lines.push('**Deleted tokens:**');
        for (const tokenId of s.deletedTokens || []) {
          lines.push(`- \`${tokenId}\``);
        }
        lines.push('');
        lines.push('> Transaction deletions remove scans from the session. The token may have been rescanned afterward.');
        lines.push('');
      }

      if (s.scoreResetCount > 0) {
        lines.push(`### 🔄 Score Resets: ${s.scoreResetCount}`);
        lines.push('');
        lines.push('> Score resets clear team scores mid-session. This affects final score calculations.');
        lines.push('');
      }

      if (s.pauseResumeCount > 0) {
        lines.push(`### ⏸️ Session Pause/Resume: ${s.pauseResumeCount} event(s)`);
        lines.push('');
        lines.push('> Session was paused and resumed during gameplay.');
        lines.push('');
      }

      if (s.manualCreationCount > 0) {
        lines.push(`### ✏️ Manual Transaction Creations: ${s.manualCreationCount}`);
        lines.push('');
        lines.push('> GM manually created transactions (not from scanner scans).');
        lines.push('');
      }

      if (s.preSessionTransactions > 0) {
        lines.push(`### ⚠️ Pre-Session Transactions: ${s.preSessionTransactions}`);
        lines.push('');
        lines.push('> Transactions with timestamps BEFORE session start. May indicate clock sync issues.');
        lines.push('');
      }
    }

    // Critical Bugs Detected (FALSE POSITIVES and GHOST SCORING)
    const dupCheck = results.find(r => r.name === 'Duplicate Handling');
    if (dupCheck?.summary) {
      const s = dupCheck.summary;
      const hasBugs = s.falsePositiveCount > 0 || s.ghostScoringCount > 0;

      if (hasBugs) {
        lines.push('## 🚨 CRITICAL BUGS DETECTED');
        lines.push('');
        lines.push('> These issues indicate bugs in the duplicate detection system that need fixing.');
        lines.push('');

        if (s.falsePositiveCount > 0) {
          lines.push('### ❌ FALSE POSITIVE DUPLICATES');
          lines.push('');
          lines.push(`**Count:** ${s.falsePositiveCount} token(s) incorrectly flagged as duplicate on FIRST scan`);
          lines.push('');
          lines.push('**Tokens affected:**');
          for (const tokenId of s.falsePositiveTokens || []) {
            lines.push(`- \`${tokenId}\``);
          }
          lines.push('');
          lines.push('**Root Cause:** Unknown - requires investigation of `transactionService.js` duplicate detection logic');
          lines.push('');
        }

        if (s.ghostScoringCount > 0) {
          lines.push('### ⚠️ GHOST SCORING (Duplicates Reached Scoreboard)');
          lines.push('');
          lines.push(`**Count:** ${s.ghostScoringCount} duplicate transaction(s) were broadcast to scoreboard`);
          lines.push('');
          lines.push('**Tokens affected:**');
          for (const tokenId of s.ghostScoringTokens || []) {
            lines.push(`- \`${tokenId}\``);
          }
          lines.push('');
          lines.push('**Root Cause:** Bug in `adminEvents.js:443` - `if (result.transaction)` broadcasts ALL transactions including duplicates');
          lines.push('');
          lines.push('**Fix Required:** Change condition to `if (result.transaction && result.status === "accepted")`');
          lines.push('');
        }
      }

      // Also show cross-mode blocks as INFO
      if (s.crossModeBlocks > 0) {
        lines.push('## Cross-Mode Duplicate Blocking');
        lines.push('');
        lines.push(`**Count:** ${s.crossModeBlocks} cross-mode block(s) detected`);
        lines.push('');
        lines.push('> **This is EXPECTED behavior.** When a token is scanned in Detective mode, it "exposes"');
        lines.push('> the content publicly. This correctly blocks subsequent Blackmarket claims for that token.');
        lines.push('');
      }
    }

    // Detailed Findings
    lines.push('## Detailed Findings');
    lines.push('');

    for (const result of results) {
      lines.push(`### ${result.name}`);
      lines.push('');

      const errors = result.findings.filter(f => f.severity === 'ERROR');
      const warnings = result.findings.filter(f => f.severity === 'WARNING');
      const infos = result.findings.filter(f => f.severity === 'INFO');

      if (errors.length > 0) {
        lines.push('**Errors:**');
        for (const finding of errors) {
          lines.push(`- ❌ ${finding.message}`);
          if (finding.details) {
            lines.push('  ```json');
            lines.push(`  ${JSON.stringify(finding.details, null, 2).split('\n').join('\n  ')}`);
            lines.push('  ```');
          }
        }
        lines.push('');
      }

      if (warnings.length > 0) {
        lines.push('**Warnings:**');
        for (const finding of warnings) {
          lines.push(`- ⚠️ ${finding.message}`);
          if (finding.details) {
            lines.push('  ```json');
            lines.push(`  ${JSON.stringify(finding.details, null, 2).split('\n').join('\n  ')}`);
            lines.push('  ```');
          }
        }
        lines.push('');
      }

      if (infos.length > 0 && (errors.length === 0 && warnings.length === 0)) {
        lines.push('**Info:**');
        for (const finding of infos.slice(0, 5)) { // Limit info items
          lines.push(`- ℹ️ ${finding.message}`);
        }
        if (infos.length > 5) {
          lines.push(`- ... and ${infos.length - 5} more info items`);
        }
        lines.push('');
      }

      // Add summary if available
      if (result.summary && typeof result.summary === 'object' && !Array.isArray(result.summary)) {
        lines.push('**Summary:**');
        lines.push('```json');
        lines.push(JSON.stringify(result.summary, null, 2));
        lines.push('```');
        lines.push('');
      }
    }

    // Footer
    lines.push('---');
    lines.push(`*Report generated: ${new Date().toISOString()}*`);
    lines.push('');

    return lines.join('\n');
  }

  static getStatusEmoji(status) {
    switch (status) {
      case 'PASS': return '✅';
      case 'FAIL': return '❌';
      case 'WARNING': return '⚠️';
      case 'INFO': return 'ℹ️';
      default: return '—';
    }
  }

  static formatDate(dateStr) {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  }

  static calculateDuration(startStr, endStr) {
    if (!startStr) return 'Unknown';

    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : new Date();
    const diffMs = end - start;

    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  static getTeamCount(session) {
    const transactions = session.transactions || [];
    const teams = new Set(transactions.map(tx => tx.teamId).filter(Boolean));
    return teams.size;
  }
}

module.exports = ReportGenerator;
