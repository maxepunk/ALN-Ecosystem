/**
 * DuplicateHandlingCheck - Verify duplicate detection worked correctly
 *
 * Duplicate handling business logic:
 * - Every duplicate transaction MUST have originalTransactionId
 * - Original transaction MUST exist and be 'accepted'
 * - Duplicate MUST have points: 0 (no scoring for duplicates)
 *
 * ENHANCED (Phase 5 - December 2025):
 * - FALSE POSITIVE detection: Fresh tokens incorrectly flagged as duplicate on FIRST scan
 * - GHOST SCORING detection: Duplicates broadcast to scoreboard BEFORE being marked duplicate
 * - Cross-mode context: Detective mode "exposes" content, blocking blackmarket claims (CORRECT)
 */

class DuplicateHandlingCheck {
  constructor(logParser = null) {
    this.logParser = logParser;
    this.name = 'Duplicate Handling';
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

    // Build map of all transaction IDs
    const txMap = new Map(transactions.map(tx => [tx.id, tx]));

    // Build map of accepted transactions by tokenId for false positive detection
    const acceptedByToken = new Map();
    for (const tx of transactions) {
      if (tx.status === 'accepted') {
        if (!acceptedByToken.has(tx.tokenId)) {
          acceptedByToken.set(tx.tokenId, []);
        }
        acceptedByToken.get(tx.tokenId).push(tx);
      }
    }

    // Find all duplicates in session
    const duplicates = transactions.filter(tx => tx.status === 'duplicate');

    let validDuplicates = 0;
    let orphanedDuplicates = 0;
    let duplicatesWithPoints = 0;
    let crossModeBlocks = 0;
    let falsePositives = [];
    let ghostScoring = [];

    // ========================================
    // STRUCTURAL INTEGRITY CHECKS (Existing)
    // ========================================

    for (const dup of duplicates) {
      const txRef = `Duplicate ${dup.id || dup.tokenId}`;

      // Check for non-zero points (duplicates should NEVER have points)
      if (dup.points && dup.points !== 0) {
        duplicatesWithPoints++;
        status = 'FAIL';
        findings.push({
          severity: 'ERROR',
          message: `${txRef}: Duplicate has non-zero points`,
          details: {
            duplicateId: dup.id,
            tokenId: dup.tokenId,
            teamId: dup.teamId,
            points: dup.points,
            expected: 0
          }
        });
      }

      const originalId = dup.originalTransactionId;

      if (!originalId) {
        orphanedDuplicates++;
        status = 'FAIL';
        findings.push({
          severity: 'ERROR',
          message: `${txRef}: Missing originalTransactionId`,
          details: {
            duplicateId: dup.id,
            tokenId: dup.tokenId,
            teamId: dup.teamId,
            timestamp: dup.timestamp
          }
        });
        continue;
      }

      const original = txMap.get(originalId);

      if (!original) {
        orphanedDuplicates++;
        status = 'FAIL';
        findings.push({
          severity: 'ERROR',
          message: `${txRef}: References non-existent original`,
          details: {
            duplicateId: dup.id,
            originalTransactionId: originalId,
            tokenId: dup.tokenId,
            teamId: dup.teamId
          }
        });
        continue;
      }

      if (original.status !== 'accepted') {
        findings.push({
          severity: 'WARNING',
          message: `${txRef}: Original not accepted`,
          details: {
            duplicateId: dup.id,
            originalTransactionId: originalId,
            originalStatus: original.status,
            tokenId: dup.tokenId
          }
        });
        if (status === 'PASS') status = 'WARNING';
        continue;
      }

      // Valid duplicate - calculate time delta
      validDuplicates++;
      const dupTime = new Date(dup.timestamp);
      const origTime = new Date(original.timestamp);
      const deltaMs = dupTime - origTime;
      const deltaMinutes = Math.round(deltaMs / 60000);

      // ========================================
      // FALSE POSITIVE CHECK (CRITICAL)
      // ========================================
      // If duplicate timestamp is BEFORE original timestamp, this is IMPOSSIBLE
      // and indicates a FALSE POSITIVE - the token was incorrectly flagged as duplicate
      if (deltaMs < 0) {
        falsePositives.push({
          tokenId: dup.tokenId,
          duplicateId: dup.id,
          duplicateTimestamp: dup.timestamp,
          originalId: original.id,
          originalTimestamp: original.timestamp,
          timeDifferenceMs: Math.abs(deltaMs),
          timeDifferenceSeconds: Math.round(Math.abs(deltaMs) / 1000),
          note: 'IMPOSSIBLE: Duplicate recorded before original transaction'
        });
        status = 'FAIL';
        findings.push({
          severity: 'ERROR',
          message: `FALSE POSITIVE: "${dup.tokenId}" duplicate timestamp is ${Math.round(Math.abs(deltaMs) / 1000)}s BEFORE original`,
          details: {
            tokenId: dup.tokenId,
            duplicateId: dup.id,
            duplicateTimestamp: dup.timestamp,
            originalId: original.id,
            originalTimestamp: original.timestamp,
            timeDifferenceSeconds: Math.round(Math.abs(deltaMs) / 1000),
            explanation: 'This token was incorrectly flagged as duplicate on what appears to be the FIRST scan. The "original" transaction was actually recorded AFTER this duplicate.'
          }
        });
        // Still count as "valid" structurally, but flag the issue
      }

      // Check if duplicate is from same team (expected) or different team (cross-team duplicate)
      const sameTeam = dup.teamId === original.teamId;
      const crossMode = dup.mode !== original.mode;

      // Cross-mode blocking (detective → blackmarket) is CORRECT behavior
      if (crossMode) {
        crossModeBlocks++;
        findings.push({
          severity: 'INFO',
          message: `Cross-mode duplicate (expected behavior): ${dup.tokenId}`,
          details: {
            tokenId: dup.tokenId,
            originalMode: original.mode,
            duplicateMode: dup.mode,
            originalTeam: original.teamId,
            duplicateTeam: dup.teamId,
            explanation: original.mode === 'detective'
              ? 'Detective mode "exposed" this token publicly - correctly blocked from blackmarket claim'
              : 'Token already claimed in blackmarket - correctly blocked from detective exposure'
          }
        });
      } else {
        findings.push({
          severity: 'INFO',
          message: `Valid duplicate: ${dup.tokenId}`,
          details: {
            tokenId: dup.tokenId,
            duplicateTeam: dup.teamId,
            originalTeam: original.teamId,
            timeDeltaMinutes: deltaMinutes,
            crossTeam: !sameTeam,
            mode: dup.mode
          }
        });
      }
    }

    // ========================================
    // FALSE POSITIVE DETECTION (NEW)
    // ========================================
    // Check logs for duplicate rejections where NO accepted transaction exists

    if (this.logParser) {
      const logFalsePositives = await this.detectFalsePositives(
        sessionStart, sessionEnd, acceptedByToken
      );

      for (const fp of logFalsePositives) {
        falsePositives.push(fp);
        status = 'FAIL';
        findings.push({
          severity: 'ERROR',
          message: `FALSE POSITIVE: Fresh token "${fp.tokenId}" flagged as duplicate on FIRST scan`,
          details: {
            tokenId: fp.tokenId,
            teamId: fp.teamId,
            deviceId: fp.deviceId,
            timestamp: fp.timestamp,
            reason: fp.reason,
            hasAcceptedTransaction: fp.hasAcceptedTransaction,
            note: 'Token was rejected as duplicate but NO prior accepted scan exists - THIS IS A BUG'
          }
        });
      }

      // ========================================
      // GHOST SCORING DETECTION (NEW)
      // ========================================
      // Find duplicates that were broadcast to scoreboard BEFORE being marked duplicate

      const ghostScoringEvents = await this.detectGhostScoring(
        sessionStart, sessionEnd, duplicates
      );

      for (const ghost of ghostScoringEvents) {
        ghostScoring.push(ghost);
        status = 'FAIL';
        findings.push({
          severity: 'ERROR',
          message: `GHOST SCORING: Token "${ghost.tokenId}" broadcast BEFORE being marked duplicate`,
          details: {
            tokenId: ghost.tokenId,
            transactionId: ghost.transactionId,
            broadcastTimestamp: ghost.broadcastTimestamp,
            duplicateTimestamp: ghost.duplicateTimestamp,
            deltaMs: ghost.deltaMs,
            teamId: ghost.teamId,
            note: 'Transaction was broadcast to scoreboard BEFORE being flagged as duplicate - BUG in adminEvents.js:443'
          }
        });
      }
    } else {
      findings.push({
        severity: 'INFO',
        message: 'Log analysis skipped (no LogParser provided)',
        details: {
          note: 'False positive and ghost scoring detection requires LogParser',
          recommendation: 'Pass LogParser to DuplicateHandlingCheck constructor for full analysis'
        }
      });
    }

    // ========================================
    // SUMMARY
    // ========================================

    if (duplicates.length === 0 && falsePositives.length === 0) {
      findings.push({
        severity: 'INFO',
        message: 'No duplicate transactions in session',
        details: { totalTransactions: transactions.length }
      });
    } else {
      findings.push({
        severity: duplicatesWithPoints > 0 || falsePositives.length > 0 || ghostScoring.length > 0 ? 'WARNING' : 'INFO',
        message: `Duplicate summary: ${duplicates.length} in session, ${validDuplicates} valid, ${orphanedDuplicates} orphaned`,
        details: {
          total: duplicates.length,
          valid: validDuplicates,
          orphaned: orphanedDuplicates,
          withPoints: duplicatesWithPoints,
          crossModeBlocks,
          falsePositives: falsePositives.length,
          ghostScoring: ghostScoring.length
        }
      });
    }

    return {
      name: this.name,
      status,
      findings,
      summary: {
        totalTransactions: transactions.length,
        duplicateCount: duplicates.length,
        validDuplicates,
        orphanedDuplicates,
        duplicatesWithPoints,
        crossModeBlocks,
        falsePositiveCount: falsePositives.length,
        ghostScoringCount: ghostScoring.length,
        duplicateTokens: [...new Set(duplicates.map(d => d.tokenId))],
        falsePositiveTokens: falsePositives.map(fp => fp.tokenId),
        ghostScoringTokens: ghostScoring.map(gs => gs.tokenId)
      }
    };
  }

  /**
   * Detect FALSE POSITIVE duplicates
   * These are tokens that were flagged as duplicate but have NO prior accepted scan
   * @param {string} sessionStart - Session start time
   * @param {string} sessionEnd - Session end time
   * @param {Map} acceptedByToken - Map of tokenId → accepted transactions
   * @returns {Promise<Array>} Array of false positive events
   */
  async detectFalsePositives(sessionStart, sessionEnd, acceptedByToken) {
    const falsePositives = [];

    if (!this.logParser) return falsePositives;

    try {
      // Get all duplicate rejections from logs
      const duplicateRejections = await this.logParser.findDuplicateRejections(
        sessionStart, sessionEnd
      );

      // Also get duplicate submissions (transactions marked as duplicate)
      const duplicateSubmissions = await this.logParser.findDuplicateSubmissions(
        sessionStart, sessionEnd
      );

      // Combine both sources
      const allDuplicateEvents = [...duplicateRejections, ...duplicateSubmissions];

      for (const event of allDuplicateEvents) {
        const tokenId = event.tokenId;
        if (!tokenId) continue;

        // Check if this token has ANY accepted transaction in the session
        const acceptedTxs = acceptedByToken.get(tokenId) || [];

        if (acceptedTxs.length === 0) {
          // FALSE POSITIVE: Token was flagged as duplicate but has NO accepted transaction!
          falsePositives.push({
            tokenId,
            teamId: event.teamId,
            deviceId: event.deviceId,
            timestamp: event.timestamp,
            reason: event.reason || 'unknown',
            hasAcceptedTransaction: false
          });
        } else {
          // Check if the duplicate event happened BEFORE any accepted transaction
          const eventTime = new Date(event.timestamp);
          const earliestAccepted = acceptedTxs.reduce((earliest, tx) => {
            const txTime = new Date(tx.timestamp);
            return txTime < earliest ? txTime : earliest;
          }, new Date());

          if (eventTime < earliestAccepted) {
            // FALSE POSITIVE: Duplicate flagged BEFORE first accepted scan
            falsePositives.push({
              tokenId,
              teamId: event.teamId,
              deviceId: event.deviceId,
              timestamp: event.timestamp,
              reason: 'Duplicate flagged before any accepted transaction',
              hasAcceptedTransaction: true,
              firstAcceptedAt: earliestAccepted.toISOString()
            });
          }
        }
      }
    } catch (err) {
      // Log parsing error - don't fail the whole check
      console.error('Error detecting false positives:', err.message);
    }

    return falsePositives;
  }

  /**
   * Detect GHOST SCORING events
   * These are duplicate transactions that were broadcast to scoreboard BEFORE being marked duplicate
   * Root cause: adminEvents.js line 443 - `if (result.transaction)` broadcasts ALL transactions
   *
   * IMPORTANT: Broadcast logs only contain transactionId, NOT tokenId.
   * So we match by transactionId directly - if a duplicate's transaction ID
   * appears in the broadcast logs, it was ghost scored.
   *
   * @param {string} sessionStart - Session start time
   * @param {string} sessionEnd - Session end time
   * @param {Array} duplicates - Array of duplicate transactions from session
   * @returns {Promise<Array>} Array of ghost scoring events
   */
  async detectGhostScoring(sessionStart, sessionEnd, duplicates) {
    const ghostScoring = [];

    if (!this.logParser) return ghostScoring;

    try {
      // Get ALL transaction broadcasts from logs (matching by transactionId, not tokenId)
      // Broadcast metadata format: { sessionId, transactionId } - no tokenId!
      const allBroadcasts = await this.logParser.filterLogs(
        e => e.message.includes('Broadcasted transaction:new'),
        { startTime: sessionStart, endTime: sessionEnd }
      );

      // Build set of broadcast transaction IDs
      const broadcastIds = new Set(
        allBroadcasts
          .map(b => b.metadata?.transactionId || b.metadata?.metadata?.transactionId)
          .filter(Boolean)
      );

      // Check if any duplicate was broadcast
      for (const dup of duplicates) {
        if (broadcastIds.has(dup.id)) {
          // Find the matching broadcast for timestamp info
          const broadcast = allBroadcasts.find(b =>
            (b.metadata?.transactionId || b.metadata?.metadata?.transactionId) === dup.id
          );

          ghostScoring.push({
            tokenId: dup.tokenId,
            teamId: dup.teamId,
            transactionId: dup.id,
            broadcastTimestamp: broadcast?.timestamp,
            duplicateTimestamp: dup.timestamp,
            note: 'Duplicate transaction was broadcast to scoreboard - this is a bug in adminEvents.js'
          });
        }
      }
    } catch (err) {
      // Log parsing error - don't fail the whole check
      console.error('Error detecting ghost scoring:', err.message);
    }

    return ghostScoring;
  }
}

module.exports = DuplicateHandlingCheck;
