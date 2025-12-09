/**
 * SessionLifecycleCheck - Track session lifecycle events and their impact on game state
 *
 * Surfaces:
 * - Transaction deletions mid-session
 * - Score resets
 * - Session pause/resume events
 * - Manual transaction creations
 * - Correlation between lifecycle events and business logic anomalies
 */

class SessionLifecycleCheck {
  constructor(logParser) {
    this.logParser = logParser;
    this.name = 'Session Lifecycle';
  }

  /**
   * Run the validation check
   * @param {Object} session - Session data
   * @returns {Object} Check result
   */
  async run(session) {
    const findings = [];
    let status = 'PASS';

    const sessionStart = session.startTime;
    const sessionEnd = session.endTime || new Date().toISOString();
    const transactions = session.transactions || [];

    // Build a map of transactions by ID for cross-referencing
    const txMap = new Map();
    for (const tx of transactions) {
      txMap.set(tx.id, tx);
    }

    // ========================================
    // TRANSACTION DELETIONS
    // ========================================
    let deletionResult = { deletions: [], rawLogCount: 0, uniqueCount: 0, duplicationRatio: 0 };
    try {
      deletionResult = await this.logParser.findTransactionDeletions(sessionStart, sessionEnd);
      const deletions = deletionResult.deletions;

      if (deletions.length > 0) {
        status = 'WARNING';

        // Report on log duplication if significant
        if (deletionResult.duplicationRatio > 2) {
          findings.push({
            severity: 'WARNING',
            message: `High log duplication for deletion events (${deletionResult.rawLogCount} raw → ${deletionResult.uniqueCount} unique, ratio: ${deletionResult.duplicationRatio}x)`,
            details: {
              rawLogCount: deletionResult.rawLogCount,
              uniqueCount: deletionResult.uniqueCount,
              duplicationRatio: deletionResult.duplicationRatio,
              note: 'High duplication may indicate logger bug or redundant event handlers'
            }
          });
        }

        for (const del of deletions) {
          const stillExists = del.transactionId && txMap.has(del.transactionId);
          const wasRescanned = transactions.some(tx =>
            tx.tokenId === del.tokenId && tx.id !== del.transactionId
          );

          findings.push({
            severity: stillExists ? 'ERROR' : 'WARNING',
            message: stillExists
              ? `Transaction deletion FAILED - still in session: ${del.tokenId}`
              : `Transaction deleted mid-session: ${del.tokenId}`,
            details: {
              tokenId: del.tokenId,
              teamId: del.teamId,
              transactionId: del.transactionId,
              deletedBy: del.deletedBy,
              timestamp: del.timestamp,
              reason: del.reason,
              wasRescanned,
              stillExistsInSession: stillExists
            }
          });

          if (stillExists) status = 'FAIL';
        }
      }
    } catch (err) {
      findings.push({
        severity: 'WARNING',
        message: `Could not read transaction deletions: ${err.message}`,
        details: { error: err.message }
      });
    }

    // ========================================
    // SCORE RESETS
    // ========================================
    let scoreResets = [];
    try {
      scoreResets = await this.logParser.findScoreResets(sessionStart, sessionEnd);

      if (scoreResets.length > 0) {
        status = status === 'FAIL' ? 'FAIL' : 'WARNING';
        for (const reset of scoreResets) {
          findings.push({
            severity: 'WARNING',
            message: `Score reset during session${reset.teamId !== 'all' ? ` for Team ${reset.teamId}` : ' (ALL TEAMS)'}`,
            details: {
              teamId: reset.teamId,
              resetBy: reset.resetBy,
              timestamp: reset.timestamp,
              reason: reset.reason,
              previousScore: reset.previousScore,
              note: 'Score resets affect final score calculations'
            }
          });
        }
      }
    } catch (err) {
      findings.push({
        severity: 'WARNING',
        message: `Could not read score resets: ${err.message}`,
        details: { error: err.message }
      });
    }

    // ========================================
    // SESSION PAUSE/RESUME
    // ========================================
    let pauseResumeEvents = [];
    try {
      pauseResumeEvents = await this.logParser.findSessionPauseResume(sessionStart, sessionEnd);

      if (pauseResumeEvents.length > 0) {
        // Sort by timestamp
        pauseResumeEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Check for unbalanced pause/resume
        let pauseCount = 0;
        let resumeCount = 0;
        for (const event of pauseResumeEvents) {
          if (event.action === 'paused') pauseCount++;
          if (event.action === 'resumed') resumeCount++;
        }

        findings.push({
          severity: 'INFO',
          message: `Session was paused ${pauseCount} time(s) and resumed ${resumeCount} time(s)`,
          details: {
            events: pauseResumeEvents.map(e => ({
              action: e.action,
              timestamp: e.timestamp,
              triggeredBy: e.triggeredBy
            })),
            pauseCount,
            resumeCount,
            balanced: pauseCount === resumeCount
          }
        });

        // Check for transactions during paused periods
        const transactionsDuringPause = this.findTransactionsDuringPause(
          transactions,
          pauseResumeEvents
        );

        if (transactionsDuringPause.length > 0) {
          status = status === 'FAIL' ? 'FAIL' : 'WARNING';
          findings.push({
            severity: 'WARNING',
            message: `${transactionsDuringPause.length} transaction(s) occurred during paused periods`,
            details: {
              transactions: transactionsDuringPause.map(tx => ({
                tokenId: tx.tokenId,
                teamId: tx.teamId,
                timestamp: tx.timestamp,
                status: tx.status
              })),
              note: 'Transactions during pause may indicate timing issues'
            }
          });
        }
      }
    } catch (err) {
      findings.push({
        severity: 'WARNING',
        message: `Could not read pause/resume events: ${err.message}`,
        details: { error: err.message }
      });
    }

    // ========================================
    // MANUAL TRANSACTION CREATIONS
    // ========================================
    let manualCreations = [];
    try {
      manualCreations = await this.logParser.findManualTransactionCreations(sessionStart, sessionEnd);

      if (manualCreations.length > 0) {
        findings.push({
          severity: 'INFO',
          message: `${manualCreations.length} transaction(s) created manually by GM`,
          details: {
            creations: manualCreations.map(c => ({
              tokenId: c.tokenId,
              teamId: c.teamId,
              transactionId: c.transactionId,
              createdBy: c.createdBy,
              timestamp: c.timestamp,
              points: c.points,
              mode: c.mode
            })),
            note: 'Manual creations may explain unexpected transactions'
          }
        });
      }
    } catch (err) {
      findings.push({
        severity: 'WARNING',
        message: `Could not read manual transaction creations: ${err.message}`,
        details: { error: err.message }
      });
    }

    // ========================================
    // TIMELINE ANOMALIES
    // ========================================
    // Check for transactions before session start or after session end
    const sessionStartTime = new Date(sessionStart);
    const sessionEndTime = new Date(sessionEnd);

    let preSessionTx = 0;
    let postSessionTx = 0;

    for (const tx of transactions) {
      if (!tx.timestamp) continue;
      const txTime = new Date(tx.timestamp);

      if (txTime < sessionStartTime) preSessionTx++;
      if (tx.timestamp && sessionEnd && txTime > sessionEndTime) postSessionTx++;
    }

    if (preSessionTx > 0) {
      status = status === 'FAIL' ? 'FAIL' : 'WARNING';
      findings.push({
        severity: 'WARNING',
        message: `${preSessionTx} transaction(s) have timestamp BEFORE session start`,
        details: {
          count: preSessionTx,
          sessionStart,
          note: 'May indicate clock sync issues or data import'
        }
      });
    }

    if (postSessionTx > 0) {
      findings.push({
        severity: 'INFO',
        message: `${postSessionTx} transaction(s) have timestamp after session end`,
        details: {
          count: postSessionTx,
          sessionEnd,
          note: 'May occur if transactions processed during session end'
        }
      });
    }

    // ========================================
    // SUMMARY
    // ========================================
    const deletions = deletionResult.deletions;
    const summary = {
      deletionCount: deletions.length,
      deletionRawLogCount: deletionResult.rawLogCount,
      deletionDuplicationRatio: deletionResult.duplicationRatio,
      deletedTokens: deletions.map(d => d.tokenId).filter(Boolean),
      scoreResetCount: scoreResets.length,
      pauseResumeCount: pauseResumeEvents.length,
      manualCreationCount: manualCreations.length,
      preSessionTransactions: preSessionTx,
      postSessionTransactions: postSessionTx,
      hasLifecycleEvents: deletions.length > 0 || scoreResets.length > 0 ||
                          pauseResumeEvents.length > 0 || manualCreations.length > 0
    };

    // Add summary info
    if (summary.hasLifecycleEvents) {
      findings.push({
        severity: 'INFO',
        message: `Session had ${summary.deletionCount} deletion(s), ${summary.scoreResetCount} reset(s), ${summary.pauseResumeCount} pause/resume event(s), ${summary.manualCreationCount} manual creation(s)`,
        details: summary
      });
    } else {
      findings.push({
        severity: 'INFO',
        message: 'No significant lifecycle events detected during session',
        details: summary
      });
    }

    return {
      name: this.name,
      status,
      findings,
      summary
    };
  }

  /**
   * Find transactions that occurred during paused periods
   * @param {Array} transactions - All transactions
   * @param {Array} pauseResumeEvents - Pause/resume events sorted by time
   * @returns {Array} Transactions that occurred during pause
   */
  findTransactionsDuringPause(transactions, pauseResumeEvents) {
    if (!pauseResumeEvents || pauseResumeEvents.length === 0) return [];

    // Build pause windows
    const pauseWindows = [];
    let currentPauseStart = null;

    for (const event of pauseResumeEvents) {
      if (event.action === 'paused' && !currentPauseStart) {
        currentPauseStart = new Date(event.timestamp);
      } else if (event.action === 'resumed' && currentPauseStart) {
        pauseWindows.push({
          start: currentPauseStart,
          end: new Date(event.timestamp)
        });
        currentPauseStart = null;
      }
    }

    // If still paused, window extends to now
    if (currentPauseStart) {
      pauseWindows.push({
        start: currentPauseStart,
        end: new Date()
      });
    }

    // Find transactions in pause windows
    const results = [];
    for (const tx of transactions) {
      if (!tx.timestamp) continue;
      const txTime = new Date(tx.timestamp);

      for (const window of pauseWindows) {
        if (txTime >= window.start && txTime <= window.end) {
          results.push(tx);
          break;
        }
      }
    }

    return results;
  }
}

module.exports = SessionLifecycleCheck;
