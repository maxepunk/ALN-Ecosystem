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

class TransactionService extends EventEmitter {
  constructor() {
    super();
    this.recentTransactions = [];
    this.tokens = new Map();  // Expose for testing
    this.teamScores = new Map();
    this.sessionListenerRegistered = false;

    // Register session event listener immediately
    this.registerSessionListener();
    this.sessionListenerRegistered = true;
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
  }

  /**
   * Register listener for session events
   * Listens to unwrapped domain events from sessionService
   */
  registerSessionListener() {
    // Listen for new session (initialize team scores)
    sessionService.on('session:created', (sessionData) => {
      if (sessionData.teams) {
        // New session created - initialize team scores
        sessionData.teams.forEach(teamId => {
          if (!this.teamScores.has(teamId)) {
            this.teamScores.set(teamId, TeamScore.createInitial(teamId));
          }
        });
        logger.info('Team scores initialized for new session', {
          teams: sessionData.teams
        });
      }
    });

    // Listen for session updates (handle session end)
    sessionService.on('session:updated', (sessionData) => {
      if (sessionData.status === 'ended') {
        // Session ended - reset all scores
        this.resetScores();
        logger.info('Scores reset due to session end');
      }
    });

    logger.info('Session event listener registered');
  }

  /**
   * Process a scan request
   * @param {Object} scanRequest - Scan request data
   * @param {Object} session - Current session
   * @returns {Promise<Object>} Processing result
   */
  async processScan(scanRequest, session) {
    if (!session) {
      throw new Error('No active session');
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
      if (!session.transactions) {
        session.transactions = [];
      }
      session.transactions.push(transaction);

      // GM scanners don't care about video playback - that's player scanner territory
      // Accept the transaction with appropriate points (detective mode = 0 points)
      const points = (transaction.mode === 'detective') ? 0 : token.value;
      transaction.accept(points)

      // PHASE 1.1 (P0.1): Track scanned token for this device (server-side duplicate detection)
      session.addDeviceScannedToken(transaction.deviceId, transaction.tokenId);

      // Update team score (only for blackmarket mode)
      if (transaction.mode !== 'detective') {
        this.updateTeamScore(transaction.teamId, token);
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

      // Emit event
      this.emit('transaction:accepted', transaction);

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
      logger.debug('Duplicate check skipped for non-GM device', {
        deviceType: transaction.deviceType,
        deviceId: transaction.deviceId,
        tokenId: transaction.tokenId
      });
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
   * Update team score
   * @param {string} teamId - Team ID
   * @param {Token} token - Scanned token
   * @private
   */
  updateTeamScore(teamId, token) {
    let teamScore = this.teamScores.get(teamId);

    if (!teamScore) {
      teamScore = TeamScore.createInitial(teamId);
      this.teamScores.set(teamId, teamScore);

      // Emit score:updated for new team (sessionService will listen and update its own scores)
      this.emitScoreUpdate(teamScore);
    }

    teamScore.addPoints(token.value);
    teamScore.incrementTokensScanned();

    // Emit score:updated after points added
    this.emitScoreUpdate(teamScore);

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

          logger.info('Group completed', {
            teamId,
            groupId: token.groupId,
            multiplier,
            totalBonus: totalGroupBonus,
          });

          this.emit('group:completed', {
            teamId,
            groupId: token.groupId,
            bonus: totalGroupBonus,
            multiplier
          });
        }
      }
    }

    this.emit('score:updated', teamScore);
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
   * Emit score:updated event (Decision #3: emit unwrapped domain event)
   * @param {TeamScore} teamScore - Team score to broadcast
   * @private
   */
  emitScoreUpdate(teamScore) {
    // Emit UNWRAPPED teamScore object per Decision #3
    // broadcasts.js will wrap it with eventWrapper for WebSocket
    this.emit('score:updated', teamScore);
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
   * Reset scores
   */
  resetScores() {
    this.teamScores.clear();
    this.recentTransactions = [];
    this.emit('scores:reset');
    logger.info('Scores reset');
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

    // Emit unwrapped domain event (broadcasts.js will wrap it)
    this.emitScoreUpdate(teamScore);

    return teamScore;
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
   */
  reset() {
    // Remove listeners to prevent accumulation
    this.removeAllListeners();

    // Clear all transaction history
    this.recentTransactions = [];

    // Clear team scores completely
    this.teamScores.clear();

    // Reset listener flag so it can be re-registered
    this.sessionListenerRegistered = false;

    // Note: We don't clear tokens as they're loaded from config
    // and should persist across resets

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

    // Remove from session
    session.transactions.splice(txIndex, 1);

    // Rebuild scores from remaining transactions
    this.rebuildScoresFromTransactions(session.transactions);

    // Get updated team score
    const updatedScore = this.teamScores.get(affectedTeamId) || TeamScore.createInitial(affectedTeamId);

    // Emit score update
    this.emitScoreUpdate(updatedScore);

    // Emit transaction deleted event for all scanners to update their local state
    this.emit('transaction:deleted', {
      transactionId,
      teamId: affectedTeamId,
      tokenId: deletedTx.tokenId
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
   * @param {Object} session - Current session
   * @returns {Object} Created transaction and scan response
   */
  async createManualTransaction(data, session) {
    const { tokenId, teamId, mode, deviceId, deviceType } = data;

    if (!tokenId || !teamId || !mode) {
      throw new Error('tokenId, teamId, and mode are required');
    }

    if (!session) {
      throw new Error('No active session');
    }

    // Get token
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token not found: ${tokenId}`);
    }

    // Process as normal scan
    const result = await this.processScan({
      tokenId,
      teamId,
      deviceId: deviceId || 'ADMIN_MANUAL',
      deviceType: deviceType || 'gm',  // Default to 'gm' for admin-created transactions
      mode,
    }, session);

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
   * Used on service initialization to restore state after restart
   * @param {Array} transactions - Historical transactions from session
   * @private
   */
  rebuildScoresFromTransactions(transactions) {
    this.teamScores.clear();

    // Group accepted transactions by team (skip detective mode)
    const teamGroups = {};
    transactions
      .filter(tx => tx.status === 'accepted' && tx.mode !== 'detective')
      .forEach(tx => {
        if (!teamGroups[tx.teamId]) {
          teamGroups[tx.teamId] = [];
        }
        teamGroups[tx.teamId].push(tx);
      });

    // Rebuild each team's score
    Object.entries(teamGroups).forEach(([teamId, txs]) => {
      const teamScore = TeamScore.createInitial(teamId);

      // Add up all points from transactions
      txs.forEach(tx => {
        teamScore.addPoints(tx.points || 0);
        teamScore.incrementTokensScanned();
        teamScore.lastTokenTime = tx.timestamp;
      });

      // Check for completed groups
      // Group tokens by groupId to detect completions
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
        // Get all tokens in this group
        const groupTokens = Array.from(this.tokens.values())
          .filter(t => t.groupId === groupId);

        // If all tokens in group were scanned, mark as complete
        if (groupTokens.length > 1 &&
            groupTokens.every(token => scannedTokens.has(token.id))) {
          teamScore.completedGroups.push(groupId);

          // Calculate and add bonus
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

      this.teamScores.set(teamId, teamScore);
      logger.info('Rebuilt team score from history', {
        teamId,
        score: teamScore.currentScore,
        bonus: teamScore.bonusPoints,
        transactions: txs.length,
        completedGroups: teamScore.completedGroups
      });
    });
  }
}

// Export singleton instance
module.exports = new TransactionService();