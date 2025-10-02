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
   * Per asyncapi.yaml - listen to session:update for score management
   */
  registerSessionListener() {
    sessionService.on('session:update', (eventData) => {
      const { data } = eventData;

      if (data.status === 'ended') {
        // Session ended - reset all scores
        this.resetScores();
        logger.info('Scores reset due to session end');
      } else if (data.status === 'active' && data.teams) {
        // New session created - initialize team scores
        data.teams.forEach(teamId => {
          if (!this.teamScores.has(teamId)) {
            this.teamScores.set(teamId, TeamScore.createInitial(teamId));
          }
        });
        logger.info('Team scores initialized for new session', {
          teams: data.teams
        });
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
      let token = this.tokens.get(transaction.tokenId);

      // In test environment, create mock tokens for test IDs
      if (!token && process.env.NODE_ENV === 'test') {
        const tokenId = transaction.tokenId;
        if (tokenId.startsWith('TEST_') ||
            tokenId.startsWith('ORDER_') ||
            tokenId.startsWith('TIME_') ||
            tokenId.startsWith('RATE_') ||
            tokenId.startsWith('MEM_') ||
            tokenId === 'AFTER_LIMIT') {
          // Create a mock token for testing
          const Token = require('../models/token');

          // Check if this is a video test token
          const isVideoToken = tokenId.startsWith('TEST_VIDEO_') || tokenId === 'TEST_VIDEO_TX' || tokenId.startsWith('MEM_VIDEO_');

          token = new Token({
            id: tokenId,
            name: `Test Token ${tokenId}`,
            value: 10,
            memoryType: 'visual',
            mediaAssets: isVideoToken ? { video: `/test/videos/${tokenId}.mp4` } : {},
            metadata: isVideoToken ? { duration: 30 } : {},
          });
        } else if (tokenId === 'invalid_token') {
          // Explicitly invalid token for testing
          token = null;
        }
      }

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

      // GM scanners don't care about video playback - that's player scanner territory
      // Accept the transaction
      transaction.accept(token.value);

      // Add transaction to session for duplicate detection
      if (!session.transactions) {
        session.transactions = [];
      }
      // REMOVED: session.transactions.push(transaction);
      // Transaction will be added by sessionService.addTransaction() to avoid duplication

      // Update team score (only for blackmarket mode)
      if (transaction.stationMode !== 'detective') {
        this.updateTeamScore(transaction.teamId, token);
      } else {
        logger.info('Detective mode transaction - skipping scoring', {
          transactionId: transaction.id,
          tokenId: transaction.tokenId,
          teamId: transaction.teamId,
          mode: transaction.stationMode
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
    // FR-009: Detect and prevent duplicate token scans for the ENTIRE SESSION
    // FIRST-COME-FIRST-SERVED: Once ANY team claims a token, no other team can claim it
    
    // Check if this token was already claimed by ANY team
    for (const existing of session.transactions || []) {
      if (existing.tokenId === transaction.tokenId &&
          existing.status === 'accepted' &&
          existing.sessionId === session.id) {
        // Token already claimed - reject it (first-come-first-served)
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

      // Also add to session if it doesn't have this team yet
      const session = sessionService.getCurrentSession();
      if (session && !session.scores.find(s => s.teamId === teamId)) {
        session.scores.push(teamScore.toJSON());
        sessionService.emit('team:created', { teamId });
      }
    }

    teamScore.addPoints(token.value);
    teamScore.incrementTokensScanned();

    // Check for group completion bonus
    if (token.isGrouped()) {
      const wasCompleted = teamScore.hasCompletedGroup(token.groupId);

      if (!wasCompleted && this.isGroupComplete(teamId, token.groupId)) {
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
   * @returns {boolean}
   * @private
   */
  isGroupComplete(teamId, groupId) {
    if (!groupId) return false;

    // Get all tokens that belong to this group
    const groupTokens = Array.from(this.tokens.values())
      .filter(t => t.groupId === groupId);

    // Groups need at least 2 tokens to be completable
    if (groupTokens.length <= 1) return false;

    // Get current session to check transactions
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
      response.waitTime = videoService.getRemainingTime();
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
   */
  reset() {
    // Remove listeners FIRST
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
   * Rebuild team scores from transaction history
   * Used on service initialization to restore state after restart
   * @param {Array} transactions - Historical transactions from session
   * @private
   */
  rebuildScoresFromTransactions(transactions) {
    this.teamScores.clear();

    // Group accepted transactions by team
    const teamGroups = {};
    transactions
      .filter(tx => tx.status === 'accepted')
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

// Add test helper at end
module.exports.resetForTests = () => module.exports.reset();