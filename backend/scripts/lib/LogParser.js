/**
 * LogParser - Stream-parse Winston JSON logs
 * Extracts events relevant to session validation
 */

const fs = require('fs');
const readline = require('readline');

class LogParser {
  constructor(logFile) {
    this.logFile = logFile;
  }

  /**
   * Parse a single log line
   * Format: "2025-11-30 19:17:06 -08:00: {...json...}"
   */
  parseLine(line) {
    if (!line || !line.trim()) return null;

    try {
      // Find the JSON part after the timestamp prefix
      const jsonStart = line.indexOf('{');
      if (jsonStart === -1) return null;

      const jsonStr = line.substring(jsonStart);
      const entry = JSON.parse(jsonStr);

      return {
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        metadata: entry.metadata?.metadata || entry.metadata || {}
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Stream logs and filter by predicate
   * @param {Function} predicate - Filter function (entry) => boolean
   * @param {Object} options - Options like timeRange
   * @returns {Promise<Array>} Matching log entries
   */
  async filterLogs(predicate, options = {}) {
    const results = [];
    const { startTime, endTime, limit } = options;

    if (!fs.existsSync(this.logFile)) {
      return results;
    }

    const fileStream = fs.createReadStream(this.logFile);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const entry = this.parseLine(line);
      if (!entry) continue;

      // Time filtering
      if (startTime || endTime) {
        const entryTime = new Date(entry.timestamp);
        if (startTime && entryTime < new Date(startTime)) continue;
        if (endTime && entryTime > new Date(endTime)) continue;
      }

      // Apply predicate
      if (predicate(entry)) {
        results.push(entry);
        if (limit && results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Find player scan events
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async findPlayerScans(startTime, endTime) {
    return this.filterLogs(
      entry => {
        const msg = entry.message.toLowerCase();
        return msg.includes('player scan') ||
               msg.includes('scan received') ||
               (msg.includes('scan') && entry.metadata?.deviceType === 'player');
      },
      { startTime, endTime }
    );
  }

  /**
   * Find score update events
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async findScoreUpdates(startTime, endTime) {
    return this.filterLogs(
      entry => {
        const msg = entry.message.toLowerCase();
        return msg.includes('score:updated') ||
               msg.includes('broadcasted score') ||
               msg.includes('score updated');
      },
      { startTime, endTime }
    );
  }

  /**
   * Find transaction events
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async findTransactionEvents(startTime, endTime) {
    return this.filterLogs(
      entry => {
        const msg = entry.message.toLowerCase();
        return msg.includes('transaction:new') ||
               msg.includes('transaction:added') ||
               msg.includes('scan accepted') ||
               msg.includes('transaction processing');
      },
      { startTime, endTime }
    );
  }

  /**
   * Find all events related to a specific token
   * @param {string} tokenId - Token to search for
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async findTokenEvents(tokenId, startTime, endTime) {
    return this.filterLogs(
      entry => {
        const msg = entry.message.toLowerCase();
        const meta = entry.metadata;

        return msg.includes(tokenId.toLowerCase()) ||
               meta?.tokenId === tokenId ||
               meta?.token?.id === tokenId;
      },
      { startTime, endTime }
    );
  }

  /**
   * Find errors during session
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async findErrors(startTime, endTime) {
    return this.filterLogs(
      entry => entry.level === 'error' || entry.level === 'warn',
      { startTime, endTime }
    );
  }

  /**
   * Extract score:updated broadcast events
   * Returns: { teamId, score, bonus } for each broadcast
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async findScoreBroadcasts(startTime, endTime) {
    const broadcasts = await this.filterLogs(
      entry => entry.message === 'Broadcasted score:updated to GM stations',
      { startTime, endTime }
    );

    return broadcasts.map(entry => ({
      timestamp: entry.timestamp,
      teamId: entry.metadata?.teamId,
      score: entry.metadata?.score,
      bonus: entry.metadata?.bonus || 0
    })).filter(b => b.teamId && typeof b.score === 'number');
  }

  /**
   * Get final score broadcast for each team
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async getFinalScoreBroadcasts(startTime, endTime) {
    const broadcasts = await this.findScoreBroadcasts(startTime, endTime);

    // Group by team, keep only the last broadcast per team
    const byTeam = new Map();
    for (const b of broadcasts) {
      byTeam.set(b.teamId, b);
    }

    return Array.from(byTeam.values());
  }

  /**
   * Find group:completed broadcast events
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async findGroupCompletionBroadcasts(startTime, endTime) {
    const broadcasts = await this.filterLogs(
      entry => entry.message === 'Broadcasted group:completed to GM stations',
      { startTime, endTime }
    );

    return broadcasts.map(entry => ({
      timestamp: entry.timestamp,
      teamId: entry.metadata?.teamId,
      groupId: entry.metadata?.groupId || entry.metadata?.group,
      bonus: entry.metadata?.bonus || entry.metadata?.bonusPoints,
      multiplier: entry.metadata?.multiplier
    })).filter(b => b.teamId && b.groupId);
  }

  /**
   * Find video playback events
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async findVideoPlaybackEvents(startTime, endTime) {
    return this.filterLogs(
      entry => {
        const msg = entry.message.toLowerCase();
        return msg.includes('video playback started') ||
               msg.includes('video queued') ||
               msg.includes('video:status');
      },
      { startTime, endTime }
    );
  }

  /**
   * Find device connectivity events
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async findDeviceConnectivityEvents(startTime, endTime) {
    return this.filterLogs(
      entry => {
        const msg = entry.message.toLowerCase();
        return msg.includes('websocket connection') ||
               msg.includes('gm station authenticated') ||
               msg.includes('device:connected') ||
               msg.includes('device:disconnected') ||
               msg.includes('sync:full') ||
               msg.includes('sent full sync');
      },
      { startTime, endTime }
    );
  }

  /**
   * Find detective mode transaction events
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async findDetectiveModeEvents(startTime, endTime) {
    return this.filterLogs(
      entry => {
        const msg = entry.message.toLowerCase();
        return msg.includes('detective mode') ||
               entry.metadata?.mode === 'detective';
      },
      { startTime, endTime }
    );
  }

  /**
   * Get all events in time order for a session
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   */
  async getSessionTimeline(startTime, endTime) {
    const events = await this.filterLogs(
      entry => {
        const msg = entry.message.toLowerCase();
        return msg.includes('score') ||
               msg.includes('transaction') ||
               msg.includes('scan') ||
               msg.includes('session') ||
               msg.includes('group') ||
               entry.level === 'error';
      },
      { startTime, endTime }
    );

    // Sort by timestamp
    return events.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );
  }

  // ========================================
  // DUPLICATE DETECTION METHODS (Phase 5)
  // ========================================

  /**
   * Find all "Duplicate scan detected" log messages
   * Used to detect FALSE POSITIVE duplicates (fresh tokens incorrectly flagged)
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   * @returns {Promise<Array>} Array of { tokenId, deviceId, timestamp, reason, teamId }
   */
  async findDuplicateRejections(startTime, endTime) {
    const entries = await this.filterLogs(
      entry => {
        const msg = entry.message.toLowerCase();
        return msg.includes('duplicate scan detected') ||
               msg.includes('duplicate transaction') ||
               msg.includes('already scanned');
      },
      { startTime, endTime }
    );

    return entries.map(e => ({
      tokenId: e.metadata?.tokenId || e.metadata?.token?.id,
      deviceId: e.metadata?.deviceId,
      teamId: e.metadata?.teamId,
      timestamp: e.timestamp,
      reason: e.metadata?.reason || e.message,
      originalTransactionId: e.metadata?.originalTransactionId
    })).filter(r => r.tokenId);
  }

  /**
   * Find "Transaction submitted" events with status:duplicate
   * Used to identify transactions that were processed as duplicates
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   * @returns {Promise<Array>} Array of duplicate submission events
   */
  async findDuplicateSubmissions(startTime, endTime) {
    const entries = await this.filterLogs(
      entry => {
        const msg = entry.message;
        // Match "Transaction submitted via WebSocket" or similar
        return (msg.includes('Transaction submitted') ||
                msg.includes('transaction:submit')) &&
               entry.metadata?.status === 'duplicate';
      },
      { startTime, endTime }
    );

    return entries.map(e => ({
      tokenId: e.metadata?.tokenId || e.metadata?.transaction?.tokenId,
      teamId: e.metadata?.teamId || e.metadata?.transaction?.teamId,
      transactionId: e.metadata?.transactionId || e.metadata?.transaction?.id,
      deviceId: e.metadata?.deviceId || e.metadata?.transaction?.deviceId,
      timestamp: e.timestamp,
      status: 'duplicate',
      originalTransactionId: e.metadata?.originalTransactionId
    })).filter(s => s.tokenId);
  }

  /**
   * Find transaction:new broadcast events by transaction ID
   * Used to detect GHOST SCORING (duplicates broadcast to scoreboard)
   * @param {string} transactionId - Transaction ID to search for
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   * @returns {Promise<Array>} Array of broadcast events matching this transaction
   */
  async findTransactionBroadcastById(transactionId, startTime, endTime) {
    return this.filterLogs(
      entry => {
        const msg = entry.message;
        const meta = entry.metadata;

        // Match broadcasts containing this transaction ID
        return (msg.includes('transaction:new') ||
                msg.includes('Broadcasted transaction') ||
                msg.includes('transaction:added')) &&
               (meta?.transactionId === transactionId ||
                meta?.transaction?.id === transactionId ||
                meta?.id === transactionId);
      },
      { startTime, endTime }
    );
  }

  /**
   * Find ALL transaction:new broadcasts (for ghost scoring detection)
   * Returns broadcasts with transaction details for correlation
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   * @returns {Promise<Array>} Array of { transactionId, tokenId, teamId, timestamp, status }
   */
  async findAllTransactionBroadcasts(startTime, endTime) {
    const entries = await this.filterLogs(
      entry => {
        const msg = entry.message;
        return msg.includes('Broadcasted transaction:new') ||
               msg === 'Broadcasted transaction:new to session';
      },
      { startTime, endTime }
    );

    return entries.map(e => {
      const tx = e.metadata?.transaction || e.metadata || {};
      return {
        transactionId: tx.id || e.metadata?.transactionId,
        tokenId: tx.tokenId || e.metadata?.tokenId,
        teamId: tx.teamId || e.metadata?.teamId,
        status: tx.status || e.metadata?.status,
        points: tx.points,
        timestamp: e.timestamp
      };
    }).filter(b => b.tokenId);
  }

  /**
   * Find state received events (transaction:added to state)
   * Used to detect if duplicate reached game state
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   * @returns {Promise<Array>} Array of state update events
   */
  async findStateTransactionEvents(startTime, endTime) {
    return this.filterLogs(
      entry => {
        const msg = entry.message;
        return msg.includes('State received transaction:added') ||
               msg.includes('transaction:added event') ||
               msg.includes('Added transaction to session');
      },
      { startTime, endTime }
    );
  }

  // ========================================
  // SESSION LIFECYCLE METHODS
  // ========================================

  /**
   * Find transaction deletion events
   * GM stations can delete transactions mid-session
   *
   * NOTE: Tracks both unique deletions AND raw log count because:
   * - Same deletion event may be logged multiple ways (broadcast, before/after persistence, etc.)
   * - Logger bugs can cause duplicate entries (with/without timestamp prefix)
   * - High duplication ratios may indicate source code bugs
   *
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   * @returns {Promise<Object>} { deletions: Array, rawLogCount: number, uniqueCount: number }
   */
  async findTransactionDeletions(startTime, endTime) {
    const entries = await this.filterLogs(
      entry => {
        const msg = entry.message;
        return msg === 'Transaction deleted' ||
               msg === 'Transaction deleted by GM' ||
               msg.includes('transaction:delete');
      },
      { startTime, endTime }
    );

    const rawDeletions = entries.map(e => {
      const meta = e.metadata?.metadata || e.metadata || {};
      return {
        tokenId: meta.tokenId,
        teamId: meta.teamId,
        transactionId: meta.transactionId,
        deletedBy: meta.gmStation || meta.deletedBy,
        timestamp: e.timestamp,
        reason: meta.reason,
        message: e.message // Include original message for analysis
      };
    }).filter(d => d.tokenId || d.transactionId);

    // Deduplicate by transactionId within 100ms window
    const deduped = [];
    const seen = new Set();

    for (const del of rawDeletions) {
      const timestampMs = new Date(del.timestamp).getTime();
      const roundedTimestamp = Math.floor(timestampMs / 100) * 100;
      const key = `${del.transactionId}|${roundedTimestamp}`;

      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(del);
      }
    }

    return {
      deletions: deduped,
      rawLogCount: rawDeletions.length,
      uniqueCount: deduped.length,
      duplicationRatio: rawDeletions.length > 0 ? (rawDeletions.length / deduped.length).toFixed(1) : 0
    };
  }

  /**
   * Find score reset events
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   * @returns {Promise<Array>} Array of reset events
   */
  async findScoreResets(startTime, endTime) {
    const entries = await this.filterLogs(
      entry => {
        const msg = entry.message;
        return msg === 'Scores reset' ||
               msg === 'Team scores reset' ||
               msg === 'All scores reset' ||
               msg.includes('scores:reset') ||
               msg.includes('score:reset');
      },
      { startTime, endTime }
    );

    return entries.map(e => {
      const meta = e.metadata?.metadata || e.metadata || {};
      return {
        teamId: meta.teamId || 'all',
        resetBy: meta.gmStation || meta.resetBy,
        timestamp: e.timestamp,
        reason: meta.reason,
        previousScore: meta.previousScore
      };
    });
  }

  /**
   * Find session pause/resume events
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   * @returns {Promise<Array>} Array of pause/resume events
   */
  async findSessionPauseResume(startTime, endTime) {
    const entries = await this.filterLogs(
      entry => {
        const msg = entry.message;
        return msg === 'Session paused' ||
               msg === 'Session resumed' ||
               msg === 'Session paused by GM' ||
               msg === 'Session resumed by GM' ||
               msg.includes('session:pause') ||
               msg.includes('session:resume');
      },
      { startTime, endTime }
    );

    return entries.map(e => {
      const meta = e.metadata?.metadata || e.metadata || {};
      const msg = e.message.toLowerCase();
      return {
        action: msg.includes('pause') ? 'paused' : 'resumed',
        triggeredBy: meta.gmStation || meta.triggeredBy,
        timestamp: e.timestamp,
        reason: meta.reason
      };
    });
  }

  /**
   * Find session create/end events (for lifecycle boundaries)
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   * @returns {Promise<Array>} Array of session lifecycle events
   */
  async findSessionBoundaries(startTime, endTime) {
    const entries = await this.filterLogs(
      entry => {
        const msg = entry.message;
        return msg === 'Session created' ||
               msg === 'Session ended' ||
               msg === 'Session created by GM' ||
               msg === 'Session ended by GM' ||
               msg.includes('session:created') ||
               msg.includes('session:ended');
      },
      { startTime, endTime }
    );

    return entries.map(e => {
      const meta = e.metadata?.metadata || e.metadata || {};
      const msg = e.message.toLowerCase();
      return {
        action: msg.includes('created') ? 'created' : 'ended',
        sessionId: meta.sessionId,
        triggeredBy: meta.gmStation || meta.triggeredBy,
        timestamp: e.timestamp
      };
    });
  }

  /**
   * Find transaction creation events (manual GM-created transactions)
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   * @returns {Promise<Array>} Array of manual transaction creation events
   */
  async findManualTransactionCreations(startTime, endTime) {
    const entries = await this.filterLogs(
      entry => {
        const msg = entry.message;
        return msg === 'Transaction created manually' ||
               msg === 'Manual transaction created' ||
               msg.includes('transaction:create') ||
               (msg.includes('Transaction created') && entry.metadata?.manual === true);
      },
      { startTime, endTime }
    );

    return entries.map(e => {
      const meta = e.metadata?.metadata || e.metadata || {};
      return {
        tokenId: meta.tokenId,
        teamId: meta.teamId,
        transactionId: meta.transactionId,
        createdBy: meta.gmStation || meta.createdBy,
        timestamp: e.timestamp,
        points: meta.points,
        mode: meta.mode
      };
    }).filter(c => c.tokenId || c.transactionId);
  }

  /**
   * Find admin score adjustment events
   * GM stations can manually adjust team scores during gameplay
   * These adjustments explain discrepancies between calculated and broadcast scores
   *
   * NOTE: Deduplicates by teamId+delta+reason+timestamp(within 100ms) because
   * the same adjustment can be logged multiple times (broadcast to different listeners)
   *
   * @param {string} startTime - Session start time
   * @param {string} endTime - Session end time
   * @returns {Promise<Array>} Array of { teamId, delta, reason, gmStation, newScore, timestamp }
   */
  async findScoreAdjustments(startTime, endTime) {
    const entries = await this.filterLogs(
      entry => {
        const msg = entry.message;
        return msg === 'Team score adjusted' ||
               msg === 'Team score adjusted by GM' ||
               msg.includes('score adjusted');
      },
      { startTime, endTime }
    );

    const rawAdjustments = entries.map(e => {
      // Handle both nested and flat metadata structures
      const meta = e.metadata?.metadata || e.metadata || {};
      return {
        teamId: meta.teamId,
        delta: meta.delta,
        reason: meta.reason,
        gmStation: meta.gmStation,
        newScore: meta.newScore,
        timestamp: e.timestamp
      };
    }).filter(a => a.teamId && typeof a.delta === 'number');

    // Deduplicate: same team, delta, reason within 100ms is the same adjustment
    // (logged multiple times due to broadcast to different listeners)
    const deduped = [];
    const seen = new Set();

    for (const adj of rawAdjustments) {
      // Create a key that ignores timestamp precision below 100ms
      const timestampMs = new Date(adj.timestamp).getTime();
      const roundedTimestamp = Math.floor(timestampMs / 100) * 100;
      const key = `${adj.teamId}|${adj.delta}|${adj.reason || ''}|${roundedTimestamp}`;

      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(adj);
      }
    }

    return deduped;
  }
}

module.exports = LogParser;
