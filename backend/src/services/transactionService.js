/**
 * Transaction Service
 * Manages transaction processing and validation
 */

const EventEmitter = require('events');
const Transaction = require('../models/transaction');
const Token = require('../models/token');
const TeamScore = require('../models/teamScore');
const config = require('../config');
const logger = require('../utils/logger');
const sessionService = require('./sessionService');
const videoQueueService = require('./videoQueueService');
// Pure game rules (engine/game seam) — all scoring/duplicate COMPUTATIONS
// live there; this service does orchestration, state mutation, and events
const scoring = require('../gameRules/scoring');
const duplicatePolicy = require('../gameRules/duplicatePolicy');
const modeSemantics = require('../gameRules/modeSemantics');
// Active pack's game.json (slice 1): mode behavior resolves through the
// modeSemantics seam against this config — never mode-id string equality
const packService = require('./packService');
const { buildScanResponse } = require('../websocket/scanResponse');

const listenerRegistry = require('../websocket/listenerRegistry');

class TransactionService extends EventEmitter {
  constructor() {
    super();
    this.recentTransactions = [];
    this.tokens = new Map();  // Expose for testing
  }

  /**
   * Initialize the service
   * @param {Array} tokens - Available tokens
   */
  async init(tokens = []) {
    // Load tokens into map for quick lookup
    this.tokens.clear();
    tokens.forEach(token => {
      this.tokens.set(token.id, new Token(token));
    });

    logger.info('Transaction service initialized', {
      tokenCount: this.tokens.size
    });

    // Register session listener (moved from constructor to support reset lifecycle)
    this.registerSessionListener();
  }

  /**
   * Register listener for session events
   * Listens to unwrapped domain events from sessionService
   */
  registerSessionListener() {
    // Remove any previously registered listeners to prevent accumulation
    this._removeSessionListeners();

    this._onSessionUpdated = (sessionData) => {
      if (sessionData.status === 'ended') {
        this.recentTransactions = [];
        logger.info('Recent transactions cleared due to session end');
      }
    };

    sessionService.on('session:updated', this._onSessionUpdated);

    logger.info('Session event listener registered');
  }

  /**
   * Remove session listeners from sessionService
   * @private
   */
  _removeSessionListeners() {
    if (this._onSessionUpdated) {
      sessionService.removeListener('session:updated', this._onSessionUpdated);
      this._onSessionUpdated = null;
    }
  }

  /**
   * Get the canonical score store: session.scores (live TeamScore instances).
   * There is NO second store — all score reads and writes go through here.
   * @returns {Array<TeamScore>|null} null when no session exists
   * @private
   */
  _getSessionScores() {
    const session = sessionService.getCurrentSession();
    return session ? session.scores : null;
  }

  /**
   * Find a team's live TeamScore in session.scores
   * @param {string} teamId - Team ID
   * @returns {TeamScore|undefined}
   * @private
   */
  _getTeamScore(teamId) {
    const scores = this._getSessionScores();
    return scores ? scores.find(s => s.teamId === teamId) : undefined;
  }

  /**
   * Adjust team score by delta (for admin interventions)
   * @param {string} teamId - Team ID to adjust
   * @param {number} delta - Amount to adjust (can be positive or negative)
   * @param {string} reason - Reason for adjustment
   * @param {string} gmStation - GM station making the adjustment
   * @returns {TeamScore} Updated team score
   */
  adjustTeamScore(teamId, delta, reason = '', gmStation = 'unknown') {
    const teamScore = this._getTeamScore(teamId);
    if (!teamScore) {
      throw new Error(`Team ${teamId} not found`);
    }

    teamScore.adjustScore(delta, gmStation, reason);

    logger.info('Team score adjusted', {
      teamId,
      delta,
      gmStation,
      reason,
      newScore: teamScore.currentScore,
      adjustmentCount: teamScore.adminAdjustments.length
    });

    // Emit score:adjusted for admin changes (sessionService persists, broadcasts.js broadcasts)
    this.emitAdminScoreChange(teamScore, reason || 'admin adjustment');

    return teamScore;
  }

  /**
   * Process a scan request
   * @param {Object} scanRequest - Scan request data
   * @returns {Promise<Object>} Processing result
   */
  async processScan(scanRequest) {
    // Slice 5: Get session internally (read-only for duplicate checking)
    const session = sessionService.getCurrentSession();
    if (!session || session.status !== 'active') {
      return {
        status: 'rejected',
        reason: 'No active game — session must be started before scanning',
        message: 'No active game — session must be started before scanning'
      };
    }

    try {
      // Create transaction from scan request. Mode defaulting is a
      // pack-aware ingress concern (slice 1): absent mode = the pack's
      // first declared mode ('blackmarket' for ALN — wire behavior
      // unchanged). GM wire submissions always carry mode (schema
      // requires it); this covers manual/defensive callers.
      const transaction = Transaction.fromScanRequest({
        ...scanRequest,
        mode: scanRequest.mode || modeSemantics.defaultModeId(packService.getGameConfig()),
      }, session.id);

      // Validate token exists
      const token = this.tokens.get(transaction.tokenId);

      if (!token) {
        transaction.reject('Invalid token ID');
        logger.warn('Scan rejected: invalid token', { tokenId: transaction.tokenId });
        const response = this.createScanResponse(transaction, token);
        // Permanent rejection (an invalid token never becomes valid): surface as
        // 'rejected' (not transient 'error') so the GM scanner removes the queued
        // entry, unmarks the token for re-scan, and stops retrying it forever.
        // Paused/not-active rejections (handled in adminEvents) stay 'error' =
        // transient and are retried on resume.
        response.status = 'rejected';
        return response;
      }

      // CRITICAL: Enrich transaction with token's default summary if not provided
      // Per AsyncAPI contract line 785: "custom from transaction or default from tokens.json"
      // This ensures transaction object is complete before persistence (source of truth pattern)
      if (!transaction.summary && token.metadata?.summary) {
        transaction.summary = token.metadata.summary;
        logger.debug('Enriched transaction with token default summary', {
          transactionId: transaction.id,
          tokenId: transaction.tokenId,
          summaryLength: transaction.summary.length
        });
      }

      // Check GM duplicate rules (pure policy — gameRules/duplicatePolicy)
      const { isDuplicate, original } = duplicatePolicy.checkDuplicate({
        transaction,
        transactions: session.transactions || [],
        scannedTokensByDevice: session.metadata?.scannedTokensByDevice || {},
      });
      if (isDuplicate) {
        transaction.markAsDuplicate(original?.id || 'unknown');
        logger.info('Duplicate scan detected', {
          tokenId: transaction.tokenId,
          teamId: transaction.teamId,
          originalTeam: original?.teamId,
        });
        // Pass the original claiming team info in extras
        return this.createScanResponse(transaction, token, {
          claimedBy: original?.teamId
        });
      }

      // ATOMIC: Claim token immediately (prevents race condition)
      // Add transaction to session BEFORE accepting to ensure duplicate check sees it
      // Session.addTransaction also increments session metadata (totalScans /
      // uniqueTokensScanned) exactly once per transaction (F-BCORE-01) — the
      // sessionService persistence listener's later addTransaction() call is an
      // idempotent no-op for this already-claimed transaction.
      if (!session.transactions) {
        session.transactions = [];
      }
      session.addTransaction(transaction);

      // GM scanners don't care about video playback - that's player scanner territory
      // Accept the transaction with appropriate points (the mode's
      // scoringPolicy decides — 'standard' pays token value, else 0)
      const gameConfig = packService.getGameConfig();
      const points = scoring.pointsFor(token, transaction.mode, gameConfig);
      transaction.accept(points)

      // Update team score and get result (standard-scoring modes only)
      let scoreResult = null;
      const modeRecord = modeSemantics.resolveMode(gameConfig, transaction.mode);
      if (modeRecord && modeRecord.scoringPolicy === 'standard') {
        scoreResult = this.updateTeamScore(transaction.teamId, token);
      } else {
        logger.info('Non-scoring mode transaction - skipping scoring', {
          transactionId: transaction.id,
          tokenId: transaction.tokenId,
          teamId: transaction.teamId,
          mode: transaction.mode,
          scoringPolicy: modeRecord ? modeRecord.scoringPolicy : 'unknown-mode'
        });
        // §2f (A3 slice 2): a counting-but-unscored claim adds no points
        // and no scanned-count, but it DOES build group progress — and can
        // therefore complete a group (bonus = scored contributions only,
        // possibly $0). When that happens the team score changed (bonus),
        // so the result must carry it for the transaction:new broadcast.
        if (modeRecord && modeRecord.countsTowardGroups === true && token.isGrouped()) {
          const teamScore = this._getTeamScore(transaction.teamId);
          if (teamScore) {
            const groupBonusInfo = this._applyGroupCompletion(transaction.teamId, token, teamScore);
            if (groupBonusInfo) {
              scoreResult = { teamScore, groupBonusInfo };
            }
          }
        }
      }

      // Add to recent transactions
      this.addRecentTransaction(transaction);

      // Emit transaction:accepted with NEW format (Slice 3)
      // This is the SINGLE event for this transaction - sessionService handles persistence
      this.emit('transaction:accepted', {
        transaction: transaction.toJSON(),
        teamScore: scoreResult?.teamScore?.toJSON() || null,
        groupBonus: scoreResult?.groupBonusInfo || null,
        deviceTracking: {
          deviceId: transaction.deviceId,
          tokenId: transaction.tokenId
        }
      });

      logger.info('Scan accepted', {
        transactionId: transaction.id,
        tokenId: transaction.tokenId,
        teamId: transaction.teamId,
        points: transaction.points,
      });

      // Video queueing is handled by player scanner route (/api/scan)
      // GM scanners (WebSocket transactions) should NOT trigger video playback

      return this.createScanResponse(transaction, token);
    } catch (error) {
      logger.error('Failed to process scan', { error, scanRequest });
      throw error;
    }
  }

  /**
   * Check if transaction is a duplicate (per-device + FCFS, GM only).
   * Thin adapter over the pure policy in gameRules/duplicatePolicy —
   * player/ESP32 scans are never duplicates (content re-viewing).
   * The old non-GM analytics branch (transaction:rescan, never consumed)
   * was removed with the extraction (F-BCORE-12).
   * @param {Transaction} transaction - Transaction to check
   * @param {Object} session - Current session
   * @returns {boolean}
   * @private
   */
  isDuplicate(transaction, session) {
    return duplicatePolicy.checkDuplicate({
      transaction,
      transactions: session.transactions || [],
      scannedTokensByDevice: session.metadata?.scannedTokensByDevice || {},
    }).isDuplicate;
  }

  /**
   * Find original transaction for duplicate (first team's accepted claim).
   * Thin adapter over gameRules/duplicatePolicy.
   * @param {Transaction} transaction - Duplicate transaction
   * @param {Object} session - Current session
   * @returns {Transaction|null}
   * @private
   */
  findOriginalTransaction(transaction, session) {
    return duplicatePolicy.findOriginalTransaction({
      transactions: session.transactions || [],
      tokenId: transaction.tokenId,
      sessionId: session.id,
    });
  }

  /**
   * Update team score (Slice 3: No event emissions - caller handles events)
   * @param {string} teamId - Team ID
   * @param {Token} token - Scanned token
   * @returns {Object} Result with teamScore and optional groupBonus info
   * @private
   */
  updateTeamScore(teamId, token) {
    let teamScore = this._getTeamScore(teamId);

    // Team should already exist via sessionService.addTeamToSession()
    // But handle gracefully if not (auto-create directly in the canonical store)
    if (!teamScore) {
      teamScore = TeamScore.createInitial(teamId);
      const scores = this._getSessionScores();
      if (scores) {
        scores.push(teamScore);
      }
      logger.warn('Team auto-created in updateTeamScore (should use addTeamToSession)', { teamId });
    }

    teamScore.addPoints(token.value);
    teamScore.incrementTokensScanned();

    // Group completion (pure rules — gameRules/scoring, shared with the
    // unscored-counting path in processScan)
    const groupBonusInfo = this._applyGroupCompletion(teamId, token, teamScore);

    // Return result (caller handles event emission)
    return { teamScore, groupBonusInfo };
  }

  /**
   * Apply group completion if this claim completes the token's group
   * (§2f, A3 slice 2): runs for EVERY counting-mode claim — scored or
   * not — because completion counts any counting claim, while the bonus
   * base (groupBonusAmount) sums only scored contributions. An
   * all-unscored completion pays $0 but still fires group:completed
   * (the event feeds the cue engine — for event-only groups it IS the
   * payload).
   * @param {string} teamId
   * @param {Token} token - The token just claimed
   * @param {TeamScore} teamScore - The team's live score instance
   * @returns {Object|null} groupBonusInfo when a completion fired
   * @private
   */
  _applyGroupCompletion(teamId, token, teamScore) {
    if (!token.isGrouped() || teamScore.hasCompletedGroup(token.groupId)) {
      return null;
    }
    // CRITICAL: Pass current token ID so the rule includes the transaction
    // being processed even if it isn't in session.transactions yet
    if (!this.isGroupComplete(teamId, token.groupId, token.id)) {
      return null;
    }

    teamScore.completeGroup(token.groupId);

    const multiplier = scoring.groupMultiplier(this.tokens, token.groupId);
    if (multiplier === 0) {
      return null; // x1 groups: tracked, never evented (unchanged behavior)
    }

    const session = sessionService.getCurrentSession();
    const totalGroupBonus = scoring.groupBonusAmount({
      tokens: this.tokens,
      groupId: token.groupId,
      transactions: session?.transactions || [],
      teamId,
      gameConfig: packService.getGameConfig(),
    });
    teamScore.addBonus(totalGroupBonus);

    const groupBonusInfo = {
      teamId,
      groupId: token.groupId,
      bonus: totalGroupBonus,
      multiplier
    };

    logger.info('Group completed', groupBonusInfo);

    // Emit group:completed for broadcasts (still needed for WebSocket broadcast)
    this.emit('group:completed', groupBonusInfo);
    return groupBonusInfo;
  }

  /**
   * Check if group is complete for team — Decision A1 generalized by
   * slice 1: only transactions in a countsTowardGroups mode count. Thin
   * adapter over gameRules/scoring (the pure rule shared in intent with
   * the standalone scanner — F-SCAN-06 parity).
   * @param {string} teamId - Team ID
   * @param {string} groupId - Group ID
   * @param {string} currentTokenId - Optional token ID being processed (not yet in session)
   * @returns {boolean}
   * @private
   */
  isGroupComplete(teamId, groupId, currentTokenId = null) {
    const session = sessionService.getCurrentSession();
    if (!session) return false;

    return scoring.isGroupComplete({
      tokens: this.tokens,
      transactions: session.transactions || [],
      teamId,
      groupId,
      currentTokenId,
      gameConfig: packService.getGameConfig(),
    });
  }

  /**
   * Group completion multiplier (0 when the group pays no bonus).
   * Thin adapter over gameRules/scoring.
   * @param {string} groupId - Group ID
   * @returns {number} Group multiplier value
   * @private
   */
  calculateGroupBonus(groupId) {
    return scoring.groupMultiplier(this.tokens, groupId);
  }

  /**
   * Add to recent transactions
   * @param {Transaction} transaction - Transaction to add
   * @private
   */
  addRecentTransaction(transaction) {
    this.recentTransactions.unshift(transaction);

    // Keep only recent transactions
    const limit = config.game.recentTransactionsCount;
    if (this.recentTransactions.length > limit) {
      this.recentTransactions = this.recentTransactions.slice(0, limit);
    }
  }

  /**
   * Create scan response — wire-format shaping lives in
   * websocket/scanResponse.js (Phase 2 extraction); this adapter injects
   * the live video status.
   * @param {Transaction} transaction - Processed transaction
   * @param {Token} token - Associated token
   * @param {Object} extras - Extra response fields
   * @returns {Object} Scan response
   * @private
   */
  createScanResponse(transaction, token, extras = {}) {
    const videoPlaying = videoQueueService.isPlaying();
    return buildScanResponse({
      transaction,
      token,
      videoPlaying,
      waitTime: videoPlaying ? videoQueueService.getRemainingTime() : undefined,
      extras,
    });
  }

  /**
   * Emit score:adjusted event for admin-only score changes (Slice 3)
   * Used by adjustTeamScore() and other admin interventions
   * sessionService persistence listener handles persisting these changes
   * @param {TeamScore} teamScore - Team score to broadcast
   * @param {string} reason - Reason for adjustment
   * @private
   */
  emitAdminScoreChange(teamScore, reason = 'admin adjustment') {
    // Emit score:adjusted for admin-only changes
    // This triggers sessionService persistence and broadcasts.js WebSocket broadcast
    this.emit('score:adjusted', {
      teamScore: teamScore.toJSON ? teamScore.toJSON() : teamScore,
      reason,
      isAdminAction: true
    });
  }

  /**
   * Get recent transactions
   * @param {number} count - Number of transactions to return
   * @returns {Array<Transaction>}
   */
  getRecentTransactions(count = 10) {
    return this.recentTransactions.slice(0, count);
  }

  /**
   * Get team scores (read from session.scores, the canonical store)
   * @returns {Array} Team scores as JSON, sorted by currentScore descending
   */
  getTeamScores() {
    const scores = this._getSessionScores() || [];
    return scores
      .map(score => (score.toJSON ? score.toJSON() : score))
      .sort((a, b) => b.currentScore - a.currentScore);
  }

  /**
   * Reset scores - resets all team scores to zero while preserving team membership
   * Per AsyncAPI contract: teams should still exist after reset with zero scores
   * Mutates the live TeamScore instances in session.scores in place;
   * sessionService's scores:reset listener clears transactions and persists.
   */
  resetScores() {
    const scores = this._getSessionScores() || [];

    // Capture team IDs for broadcast
    const teams = scores.map(s => s.teamId);

    // Reset each team's score to zero using TeamScore.reset() method
    // This preserves team membership (and adminAdjustments audit trail) but
    // clears: currentScore, baseScore, tokensScanned, bonusPoints, completedGroups
    for (const teamScore of scores) {
      teamScore.reset();
    }

    // Clear recent transactions (these are historical, not team membership)
    this.recentTransactions = [];

    // Emit with team list for broadcast handler
    this.emit('scores:reset', { teamsReset: teams });

    logger.info('Scores reset to zero', { teamsReset: teams.length });
  }

  /**
   * Load tokens
   * @param {Array} tokens - Tokens to load
   */
  loadTokens(tokens) {
    this.tokens.clear();
    tokens.forEach(token => {
      this.tokens.set(token.id, new Token(token));
    });
    logger.info('Tokens loaded', { count: this.tokens.size });
  }

  /**
   * Get token by ID
   * @param {string} tokenId - Token ID
   * @returns {Token|null}
   */
  getToken(tokenId) {
    return this.tokens.get(tokenId) || null;
  }

  /**
   * Get all tokens
   * @returns {Array<Token>}
   */
  getAllTokens() {
    return Array.from(this.tokens.values());
  }

  /**
   * Reset entire transaction service state
   * Used primarily for testing to ensure clean state between tests
   * NOTE: Contract tests should NOT call reset() - follow auth-events.test.js pattern
   * NOTE: Scores live in session.scores (sessionService owns their lifecycle)
   */
  reset() {
    // Remove listeners on sessionService to prevent accumulation
    this._removeSessionListeners();

    // Remove listeners on this service's own emitter
    this.removeAllListeners();

    // Clear all transaction history
    this.recentTransactions = [];

    logger.info('Transaction service reset');
  }

  /**
   * Delete a transaction and recalculate scores (FR 4.2.4 line 949)
   * @param {string} transactionId - Transaction ID to delete
   * @param {Object} session - Current session
   * @returns {Object} Deleted transaction and updated team score
   */
  deleteTransaction(transactionId, session) {
    if (!session) {
      throw new Error('No active session');
    }

    // Find transaction
    const txIndex = session.transactions.findIndex(tx => tx.id === transactionId);
    if (txIndex === -1) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const deletedTx = session.transactions[txIndex];
    const affectedTeamId = deletedTx.teamId;

    // CRITICAL: Remove from duplicate detection registry to allow re-scanning
    const deviceId = deletedTx.deviceId;
    const tokenId = deletedTx.tokenId;

    // DEBUG: Log state BEFORE removal
    const deviceTokensBefore = session.metadata.scannedTokensByDevice?.[deviceId] || [];
    logger.info('🔍 BEFORE removing from duplicate detection', {
      deviceId,
      tokenId,
      tokensForDevice: deviceTokensBefore.length,
      tokenExists: deviceTokensBefore.includes(tokenId)
    });

    // Remove from device-specific tracking (source of truth for duplicate detection)
    if (session.metadata.scannedTokensByDevice && session.metadata.scannedTokensByDevice[deviceId]) {
      const index = session.metadata.scannedTokensByDevice[deviceId].indexOf(tokenId);
      if (index > -1) {
        session.metadata.scannedTokensByDevice[deviceId].splice(index, 1);

        // DEBUG: Log state AFTER removal
        logger.info('✅ AFTER removing from duplicate detection', {
          deviceId,
          tokenId,
          tokensForDevice: session.metadata.scannedTokensByDevice[deviceId].length,
          removedFromIndex: index,
          canRescan: true
        });
      } else {
        logger.warn('⚠️ Token not found in device registry (already removed?)', {
          deviceId,
          tokenId,
          tokensForDevice: session.metadata.scannedTokensByDevice[deviceId].length
        });
      }
    } else {
      logger.warn('⚠️ No scannedTokensByDevice registry for device', { deviceId, tokenId });
    }

    // Remove from session
    session.transactions.splice(txIndex, 1);

    // Rebuild scores from remaining transactions (mutates session.scores in place)
    this.rebuildScoresFromTransactions(session.transactions);

    // Get updated team score from the canonical store
    const updatedScore = this._getTeamScore(affectedTeamId) || TeamScore.createInitial(affectedTeamId);

    // Emit transaction deleted event with updated score
    // sessionService listens and persists, broadcasts.js broadcasts to clients
    // allTeamScores: the rebuild touches EVERY team (snapshot for broadcast)
    this.emit('transaction:deleted', {
      transactionId,
      teamId: affectedTeamId,
      tokenId: deletedTx.tokenId,
      updatedTeamScore: updatedScore.toJSON(),
      allTeamScores: (this._getSessionScores() || []).map(ts => ts.toJSON())
    });

    logger.info('Transaction deleted', {
      transactionId,
      teamId: affectedTeamId,
      tokenId: deletedTx.tokenId,
      newScore: updatedScore.currentScore,
    });

    return {
      deletedTransaction: deletedTx,
      updatedScore: updatedScore.toJSON(),
    };
  }

  /**
   * Create manual transaction (FR 4.2.4 line 954)
   * @param {Object} data - Transaction data {tokenId, teamId, mode, deviceId, deviceType}
   * @returns {Object} Created transaction and scan response
   */
  async createManualTransaction(data) {
    const { tokenId, teamId, mode, deviceId, deviceType } = data;

    if (!tokenId || !teamId || !mode) {
      throw new Error('tokenId, teamId, and mode are required');
    }

    // Slice 5: Session retrieved internally by processScan
    const session = sessionService.getCurrentSession();
    if (!session || session.status !== 'active') {
      throw new Error('No active game — session must be started before creating transactions');
    }

    // Get token
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token not found: ${tokenId}`);
    }

    // Validate deviceType provided (warn if missing)
    if (!deviceType) {
      logger.warn('Manual transaction missing deviceType, defaulting to gm', {
        tokenId,
        deviceId: deviceId || 'ADMIN_MANUAL',
        source: 'admin_command'
      });
    }

    // Process as normal scan (session now retrieved internally by processScan)
    const result = await this.processScan({
      tokenId,
      teamId,
      deviceId: deviceId || 'ADMIN_MANUAL',
      deviceType: deviceType || 'gm',  // Default to 'gm' for admin-created transactions
      mode,
    });

    logger.info('Manual transaction created', {
      transactionId: result.transactionId,
      tokenId,
      teamId,
      mode,
      points: result.points,
    });

    return result;
  }

  /**
   * Rebuild team scores from transaction history.
   * The COMPUTATION is the pure gameRules/scoring.computeTeamScores (same
   * rules as the live path — A1 counting-modes-only groups, recorded
   * points authoritative); this method only applies the result onto the live
   * TeamScore instances in session.scores (the canonical store) and
   * re-applies admin adjustments on top (F-BCORE-03: the audit trail
   * survives in place — wiping it silently reverted every score:adjust).
   * @param {Array} transactions - Historical transactions from session
   * @private
   */
  rebuildScoresFromTransactions(transactions) {
    const scores = this._getSessionScores();
    if (!scores) {
      logger.warn('rebuildScoresFromTransactions called with no session — nothing to rebuild');
      return;
    }

    const rows = scoring.computeTeamScores({
      tokens: this.tokens,
      transactions: transactions || [],
      teamIds: scores.map(s => s.teamId),
      gameConfig: packService.getGameConfig(),
    });
    const rowByTeam = new Map(rows.map(r => [r.teamId, r]));

    // Apply rows onto the live instances in place. TeamScore.reset()
    // preserves teamId and the adminAdjustments audit trail.
    let teamsWithReplayedAdjustments = 0;
    const applyRow = (teamScore, row) => {
      teamScore.reset();
      teamScore.baseScore = row.baseScore;
      teamScore.bonusPoints = row.bonusPoints;
      teamScore.tokensScanned = row.tokensScanned;
      teamScore.completedGroups = row.completedGroups;
      teamScore.lastTokenTime = row.lastTokenTime;

      // Re-apply admin adjustment deltas on top of the rebuilt score
      const adjustments = teamScore.adminAdjustments || [];
      const totalDelta = adjustments.reduce((sum, adj) => sum + (adj.delta || 0), 0);
      teamScore.baseScore += totalDelta;
      teamScore.currentScore = teamScore.baseScore + teamScore.bonusPoints;

      if (adjustments.length > 0) {
        teamsWithReplayedAdjustments++;
        logger.info('Replayed admin adjustments after rebuild', {
          teamId: teamScore.teamId,
          adjustmentCount: adjustments.length,
          totalDelta,
          newScore: teamScore.currentScore
        });
      }
    };

    for (const teamScore of scores) {
      applyRow(teamScore, rowByTeam.get(teamScore.teamId));
      rowByTeam.delete(teamScore.teamId);
    }

    // Defensive: teams found only in transactions (shouldn't happen, but
    // don't drop their points)
    for (const row of rowByTeam.values()) {
      const teamScore = TeamScore.createInitial(row.teamId);
      applyRow(teamScore, row);
      scores.push(teamScore);
      logger.warn('Team created during rebuild (should exist in session)', { teamId: row.teamId });
    }

    logger.info('Score rebuild complete', {
      teamsInSession: scores.length,
      teamsWithTransactions: rows.filter(r => r.tokensScanned > 0).length,
      teamsWithReplayedAdjustments
    });
  }
}

// Export singleton instance
module.exports = new TransactionService();