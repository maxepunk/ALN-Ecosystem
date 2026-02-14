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
const videoQueueService = require('./videoQueueService');  // Phase 1.1.6: moved from lazy require

const listenerRegistry = require('../websocket/listenerRegistry');

class TransactionService extends EventEmitter {
  constructor() {
    super();
    this.recentTransactions = [];
    this.tokens = new Map();  // Expose for testing
    this.teamScores = new Map();
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
      tokenCount: this.tokens.size,
      teamCount: this.teamScores.size
    });

    // Register session listener (moved from constructor to support reset lifecycle)
    this.registerSessionListener();
  }

  /**
   * Register listener for session events
   * Listens to unwrapped domain events from sessionService
   */
  registerSessionListener() {
    // Listen for new session (initialize team scores)
    sessionService.on('session:created', (sessionData) => {
      // CRITICAL: Clear map FIRST to prevent state leakage from previous sessions
      // Prevents race condition where session:updated(ended) listener might execute
      // after teams are added, clearing them immediately
      this.teamScores.clear();

      if (sessionData.teams) {
        // New session created - initialize team scores
        sessionData.teams.forEach(teamId => {
          this.teamScores.set(teamId, TeamScore.createInitial(teamId));
        });
        logger.info('Team scores initialized for new session', {
          teams: sessionData.teams,
          count: this.teamScores.size
        });
      }
    });

    // Listen for session updates (handle session end)
    sessionService.on('session:updated', (sessionData) => {
      if (sessionData.status === 'ended') {
        // Session ended - clear all team scores (no session = no teams)
        // NOTE: resetScores() preserves team membership; clear() removes everything
        this.teamScores.clear();
        this.recentTransactions = [];
        logger.info('Scores cleared due to session end');
      }
    });

    logger.info('Session event listener registered');
  }

  // ... (skip to adjustTeamScore)

  /**
   * Adjust team score by delta (for admin interventions)
   * @param {string} teamId - Team ID to adjust
   * @param {number} delta - Amount to adjust (can be positive or negative)
   * @param {string} reason - Reason for adjustment
   * @param {string} gmStation - GM station making the adjustment
   * @returns {TeamScore} Updated team score
   */
  adjustTeamScore(teamId, delta, reason = '', gmStation = 'unknown') {
    const teamScore = this.teamScores.get(teamId);
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
      // Create transaction from scan request
      const transaction = Transaction.fromScanRequest(scanRequest, session.id);

      // Validate token exists
      const token = this.tokens.get(transaction.tokenId);

      if (!token) {
        transaction.reject('Invalid token ID');
        logger.warn('Scan rejected: invalid token', { tokenId: transaction.tokenId });
        return this.createScanResponse(transaction, token);
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

      // Check for duplicates
      if (this.isDuplicate(transaction, session)) {
        const original = this.findOriginalTransaction(transaction, session);
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
      // NOTE: sessionService persistence listener will also add via addTransaction() (idempotent)
      if (!session.transactions) {
        session.transactions = [];
      }
      session.transactions.push(transaction);

      // GM scanners don't care about video playback - that's player scanner territory
      // Accept the transaction with appropriate points (detective mode = 0 points)
      const points = (transaction.mode === 'detective') ? 0 : token.value;
      transaction.accept(points)

      // Update team score and get result (only for blackmarket mode)
      let scoreResult = null;
      if (transaction.mode !== 'detective') {
        scoreResult = this.updateTeamScore(transaction.teamId, token);
      } else {
        logger.info('Detective mode transaction - skipping scoring', {
          transactionId: transaction.id,
          tokenId: transaction.tokenId,
          teamId: transaction.teamId,
          mode: transaction.mode
        });
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
   * Check if transaction is a duplicate
   * @param {Transaction} transaction - Transaction to check
   * @param {Object} session - Current session
   * @returns {boolean}
   * @private
   */
  isDuplicate(transaction, session) {
    // P0.1 CORRECTION: Device-type-specific duplicate detection
    // CRITICAL: Only GM scanners reject duplicates
    // Player and ESP32 scanners MUST be allowed to re-scan tokens (content re-viewing)

    if (transaction.deviceType !== 'gm') {
      // Players and ESP32 devices: ALWAYS allow duplicates

      // Check if this is a re-scan (for analytics)
      const isRescan = session.hasDeviceScannedToken(transaction.deviceId, transaction.tokenId);

      if (isRescan) {
        logger.debug('Player re-scan tracked for analytics', {
          deviceType: transaction.deviceType,
          deviceId: transaction.deviceId,
          tokenId: transaction.tokenId
        });

        // Emit analytics event for dashboards/reporting
        this.emit('transaction:rescan', {
          deviceId: transaction.deviceId,
          deviceType: transaction.deviceType,
          tokenId: transaction.tokenId,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.debug('Duplicate check skipped for non-GM device', {
          deviceType: transaction.deviceType,
          deviceId: transaction.deviceId,
          tokenId: transaction.tokenId
        });
      }

      return false;  // NOT a duplicate for player/ESP32
    }

    // GM Scanner duplicate detection below

    // PHASE 1.1 (P0.1): Server-side per-device duplicate detection
    // Check if THIS GM DEVICE has already scanned this token
    if (session.hasDeviceScannedToken(transaction.deviceId, transaction.tokenId)) {
      logger.info('Duplicate scan detected (per-device, GM only)', {
        tokenId: transaction.tokenId,
        deviceId: transaction.deviceId,
        deviceType: transaction.deviceType
      });
      return true;
    }

    // FR-009: Detect and prevent duplicate token scans for the ENTIRE SESSION
    // FIRST-COME-FIRST-SERVED: Once ANY team claims a token, no other team can claim it

    // Check if this token was already claimed by ANY team (GM scanners only)
    for (const existing of session.transactions || []) {
      if (existing.tokenId === transaction.tokenId &&
        existing.status === 'accepted' &&
        existing.sessionId === session.id) {
        // Token already claimed - reject it (first-come-first-served)
        logger.info('Duplicate scan detected (first-come-first-served)', {
          tokenId: transaction.tokenId,
          claimedBy: existing.teamId,
          attemptedBy: transaction.teamId
        });
        return true;
      }
    }

    return false; // Token not yet claimed
  }

  /**
   * Find original transaction for duplicate
   * @param {Transaction} transaction - Duplicate transaction
   * @param {Object} session - Current session
   * @returns {Transaction|null}
   * @private
   */
  findOriginalTransaction(transaction, session) {
    // First-come-first-served - find which team claimed this token first
    for (const existing of session.transactions || []) {
      if (existing.tokenId === transaction.tokenId &&
        existing.status === 'accepted' &&
        existing.sessionId === session.id) {
        return existing; // Return the first team's claim
      }
    }

    return null;
  }

  /**
   * Update team score (Slice 3: No event emissions - caller handles events)
   * @param {string} teamId - Team ID
   * @param {Token} token - Scanned token
   * @returns {Object} Result with teamScore and optional groupBonus info
   * @private
   */
  updateTeamScore(teamId, token) {
    let teamScore = this.teamScores.get(teamId);
    let groupBonusInfo = null;

    // Team should already exist via sessionService.addTeamToSession() -> syncTeamFromSession()
    // But handle gracefully if not (backwards compatibility during migration)
    if (!teamScore) {
      teamScore = TeamScore.createInitial(teamId);
      this.teamScores.set(teamId, teamScore);
      logger.warn('Team auto-created in updateTeamScore (should use addTeamToSession)', { teamId });
    }

    teamScore.addPoints(token.value);
    teamScore.incrementTokensScanned();

    // Check for group completion bonus
    if (token.isGrouped()) {
      const wasCompleted = teamScore.hasCompletedGroup(token.groupId);

      // CRITICAL: Pass current token ID to isGroupComplete so it includes the transaction
      // being processed (which hasn't been added to session.transactions yet)
      if (!wasCompleted && this.isGroupComplete(teamId, token.groupId, token.id)) {
        teamScore.completeGroup(token.groupId);

        // Calculate total bonus for the entire group
        const multiplier = this.calculateGroupBonus(token.groupId);
        if (multiplier > 1) {
          // Get all tokens in this group
          const groupTokens = Array.from(this.tokens.values())
            .filter(t => t.groupId === token.groupId);

          // Calculate total bonus: (multiplier - 1) × sum of all token values
          let totalGroupBonus = 0;
          for (const groupToken of groupTokens) {
            // Bonus formula: (multiplier - 1) × tokenValue
            totalGroupBonus += groupToken.value * (multiplier - 1);
          }

          teamScore.addBonus(totalGroupBonus);

          groupBonusInfo = {
            teamId,
            groupId: token.groupId,
            bonus: totalGroupBonus,
            multiplier
          };

          logger.info('Group completed', groupBonusInfo);

          // Emit group:completed for broadcasts (still needed for WebSocket broadcast)
          this.emit('group:completed', groupBonusInfo);
        }
      }
    }

    // Return result (caller handles event emission)
    return { teamScore, groupBonusInfo };
  }

  /**
   * Check if group is complete for team
   * @param {string} teamId - Team ID
   * @param {string} groupId - Group ID
   * @param {string} currentTokenId - Optional token ID being processed (not yet in session)
   * @returns {boolean}
   * @private
   */
  isGroupComplete(teamId, groupId, currentTokenId = null) {
    if (!groupId) return false;

    // Get all tokens that belong to this group
    const groupTokens = Array.from(this.tokens.values())
      .filter(t => t.groupId === groupId);

    // Groups need at least 2 tokens to be completable
    if (groupTokens.length <= 1) return false;

    // Get current session to check transactions (Phase 1.1.6: uses top-level import)
    const session = sessionService.getCurrentSession();
    if (!session) return false;

    // Get all token IDs this team has successfully scanned (using Set for performance)
    const transactions = session.transactions || [];
    const teamScannedTokenIds = new Set(
      transactions
        .filter(tx =>
          tx.teamId === teamId &&
          tx.status === 'accepted'
        )
        .map(tx => tx.tokenId)
    );

    // CRITICAL: Include current token being processed (not yet in session.transactions)
    if (currentTokenId) {
      teamScannedTokenIds.add(currentTokenId);
    }

    // Check if team has scanned ALL tokens in the group
    const allScanned = groupTokens.every(token =>
      teamScannedTokenIds.has(token.id)
    );

    return allScanned;
  }

  /**
   * Calculate group completion bonus
   * @param {string} groupId - Group ID
   * @returns {number} Group multiplier value
   * @private
   */
  calculateGroupBonus(groupId) {
    if (!groupId) return 0;

    // Find any token in this group to get the multiplier
    const groupToken = Array.from(this.tokens.values())
      .find(t => t.groupId === groupId);

    if (!groupToken) return 0;

    const multiplier = groupToken.getGroupMultiplier();

    // Only groups with multiplier > 1 give bonuses
    if (multiplier <= 1) return 0;

    // Return the multiplier for use in score calculation
    return multiplier;
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
   * Create scan response
   * @param {Transaction} transaction - Processed transaction
   * @param {Token} token - Associated token
   * @param {Object} extras - Extra response fields
   * @returns {Object} Scan response
   * @private
   */
  createScanResponse(transaction, token, extras = {}) {
    // Phase 1.1.6: uses top-level import
    const isVideoPlaying = videoQueueService.isPlaying();

    const response = {
      status: transaction.status,
      message: this.getResponseMessage(transaction, extras.claimedBy),
      transactionId: transaction.id,
      transaction: transaction, // Include the transaction object
      token: token, // Include the token for reference
    };

    // Add points if accepted
    if (transaction.isAccepted()) {
      response.points = transaction.points;
    }

    // Add original transaction ID if this is a duplicate
    if (transaction.isDuplicate()) {
      response.originalTransactionId = transaction.originalTransactionId;
      // Include which team claimed the token first
      if (extras.claimedBy) {
        response.claimedBy = extras.claimedBy;
      }
    }

    // Add video status
    if (isVideoPlaying) {
      response.videoPlaying = true;
      response.waitTime = videoQueueService.getRemainingTime();
    } else {
      response.videoPlaying = false;
    }

    // Add any extras
    Object.assign(response, extras);

    return response;
  }

  /**
   * Get response message for transaction
   * @param {Transaction} transaction - Transaction
   * @returns {string} Response message
   * @private
   */
  getResponseMessage(transaction, claimedBy) {
    if (transaction.isAccepted()) {
      return `Token scanned successfully. ${transaction.points} points awarded.`;
    } else if (transaction.isDuplicate()) {
      if (claimedBy) {
        return `Token already claimed by ${claimedBy}`;
      }
      return 'Token already claimed';
    } else if (transaction.isRejected()) {
      return transaction.rejectionReason || 'Scan rejected.';
    }
    return 'Scan processed.';
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
   * Get team scores
   * @returns {Array} Team scores array
   */
  getTeamScores() {
    return Array.from(this.teamScores.values())
      .map(score => score.toJSON())
      .sort((a, b) => b.currentScore - a.currentScore);
  }

  /**
   * Reset scores - resets all team scores to zero while preserving team membership
   * Per AsyncAPI contract: teams should still exist after reset with zero scores
   */
  resetScores() {
    // Capture team IDs for broadcast
    const teams = Array.from(this.teamScores.keys());

    // Reset each team's score to zero using TeamScore.reset() method
    // This preserves team membership but clears: currentScore, tokensScanned, bonusPoints, completedGroups
    for (const teamScore of this.teamScores.values()) {
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
   * Sync a team from sessionService to the local teamScores Map
   * This ensures transactionService.teamScores stays in sync with sessionService.currentSession.scores
   * Called by sessionService.addTeamToSession() for single source of truth on team creation
   * @param {Object|TeamScore} teamScoreData - Team score data (JSON or TeamScore instance)
   */
  syncTeamFromSession(teamScoreData) {
    // Handle null/undefined gracefully
    if (!teamScoreData) {
      logger.warn('syncTeamFromSession called with null/undefined data');
      return;
    }

    // Handle both JSON objects and TeamScore instances
    const teamId = teamScoreData.teamId;
    if (!teamId) {
      logger.warn('syncTeamFromSession called with invalid data (missing teamId)', { teamScoreData });
      return;
    }

    // Only add if not already present (idempotent)
    if (!this.teamScores.has(teamId)) {
      // Convert to TeamScore if needed
      const teamScore = teamScoreData instanceof TeamScore
        ? teamScoreData
        : TeamScore.fromJSON(teamScoreData);
      this.teamScores.set(teamId, teamScore);
      logger.info('Team synced from sessionService', { teamId });
    }
  }

  /**
   * Restore team scores from a session (for session restoration on startup)
   * @param {Object} session - Session object with scores array
   */
  restoreFromSession(session) {
    if (!session || !session.scores) {
      return;
    }

    // Sync all teams from session.scores to teamScores Map
    for (const scoreData of session.scores) {
      if (scoreData.teamId && !this.teamScores.has(scoreData.teamId)) {
        this.teamScores.set(scoreData.teamId, TeamScore.fromJSON(scoreData));
        logger.debug('Team restored from session', { teamId: scoreData.teamId });
      }
    }

    logger.info('Teams restored from session', {
      teamCount: this.teamScores.size,
      teams: Array.from(this.teamScores.keys())
    });
  }

  /**
   * Reset entire transaction service state
   * Used primarily for testing to ensure clean state between tests
   * NOTE: Contract tests should NOT call reset() - follow auth-events.test.js pattern
   */
  reset() {
    // Remove listeners to prevent accumulation
    this.removeAllListeners();

    // Clear all transaction history
    this.recentTransactions = [];

    // Clear team scores completely
    this.teamScores.clear();

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

    // Rebuild scores from remaining transactions
    this.rebuildScoresFromTransactions(session.transactions);

    // Get updated team score
    const updatedScore = this.teamScores.get(affectedTeamId) || TeamScore.createInitial(affectedTeamId);

    // Emit transaction deleted event with updated score
    // sessionService listens and persists, broadcasts.js broadcasts to clients
    this.emit('transaction:deleted', {
      transactionId,
      teamId: affectedTeamId,
      tokenId: deletedTx.tokenId,
      updatedTeamScore: updatedScore.toJSON()
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
   * Rebuild team scores from transaction history
   * CRITICAL: Preserves team membership from sessionService (source of truth)
   * Uses clear-and-rebuild pattern for simplicity (KISS)
   * @param {Array} transactions - Historical transactions from session
   * @private
   */
  rebuildScoresFromTransactions(transactions) {
    // Step 1: Get team membership from session (source of truth)
    const session = sessionService.getCurrentSession();
    const sessionTeamIds = new Set(
      (session?.scores || []).map(s => s.teamId)
    );

    // Step 2: Clear and rebuild fresh (simpler than in-place mutation)
    this.teamScores.clear();

    // Step 3: Initialize all teams from session with fresh zero-score instances
    // This preserves teams that have no black market transactions
    for (const teamId of sessionTeamIds) {
      this.teamScores.set(teamId, TeamScore.createInitial(teamId));
    }

    // Step 4: Group accepted transactions by team (skip detective mode for scoring)
    const teamGroups = {};
    transactions
      .filter(tx => tx.status === 'accepted' && tx.mode !== 'detective')
      .forEach(tx => {
        if (!teamGroups[tx.teamId]) {
          teamGroups[tx.teamId] = [];
        }
        teamGroups[tx.teamId].push(tx);
      });

    // Step 5: Rebuild scores for teams that have transactions
    Object.entries(teamGroups).forEach(([teamId, txs]) => {
      // Get or create team score (should already exist from session sync above)
      let teamScore = this.teamScores.get(teamId);
      if (!teamScore) {
        teamScore = TeamScore.createInitial(teamId);
        this.teamScores.set(teamId, teamScore);
        logger.warn('Team created during rebuild (should exist in session)', { teamId });
      }

      // Add up all points from transactions
      txs.forEach(tx => {
        teamScore.addPoints(tx.points || 0);
        teamScore.incrementTokensScanned();
        teamScore.lastTokenTime = tx.timestamp;
      });

      // Check for completed groups
      const tokenGroups = {};
      txs.forEach(tx => {
        const token = this.tokens.get(tx.tokenId);
        if (token && token.groupId) {
          if (!tokenGroups[token.groupId]) {
            tokenGroups[token.groupId] = new Set();
          }
          tokenGroups[token.groupId].add(tx.tokenId);
        }
      });

      // Check each group for completion
      Object.entries(tokenGroups).forEach(([groupId, scannedTokens]) => {
        const groupTokens = Array.from(this.tokens.values())
          .filter(t => t.groupId === groupId);

        if (groupTokens.length > 1 &&
          groupTokens.every(token => scannedTokens.has(token.id))) {
          teamScore.completedGroups.push(groupId);

          const multiplier = groupTokens[0].getGroupMultiplier();
          if (multiplier > 1) {
            let groupBonus = 0;
            groupTokens.forEach(token => {
              groupBonus += token.value * (multiplier - 1);
            });
            teamScore.addBonus(groupBonus);
          }
        }
      });

      logger.info('Rebuilt team score from history', {
        teamId,
        score: teamScore.currentScore,
        bonus: teamScore.bonusPoints,
        transactions: txs.length,
        completedGroups: teamScore.completedGroups
      });
    });

    logger.info('Score rebuild complete', {
      teamsInSession: sessionTeamIds.size,
      teamsWithScores: this.teamScores.size,
      teamsWithTransactions: Object.keys(teamGroups).length
    });
  }
}

// Export singleton instance
module.exports = new TransactionService();