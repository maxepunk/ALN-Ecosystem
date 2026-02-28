/**
 * State Service
 * Manages game state synchronization and updates.
 *
 * GameState is a COMPUTED VIEW derived from the current session + live system status.
 * It is never stored or persisted directly. This eliminates sync bugs on restart.
 */

const EventEmitter = require('events');
const GameState = require('../models/gameState');
const persistenceService = require('./persistenceService');
const logger = require('../utils/logger');
const listenerRegistry = require('../websocket/listenerRegistry');

const sessionService = require('./sessionService');
const transactionService = require('./transactionService');
const videoQueueService = require('./videoQueueService');
const offlineQueueService = require('./offlineQueueService');

class StateService extends EventEmitter {
  constructor() {
    super();
    this.listenersInitialized = false;

    // Cache offline status from events (aggregator pattern)
    this.cachedOfflineStatus = false;

    // Debouncing for state updates
    this.pendingStateUpdate = null;
    this.debounceTimer = null;
    this.debounceDelay = 100; // 100ms debounce
  }

  /**
   * Initialize the service
   * @returns {Promise<void>}
   */
  async init() {
    this.setupTransactionListeners();
  }

  /**
   * Set up listeners for session and transaction events
   * @private
   */
  setupTransactionListeners() {
    // CRITICAL: Prevent duplicate listener registration
    if (this.listenersInitialized) {
      logger.debug('Event listeners already initialized, skipping');
      return;
    }
    this.listenersInitialized = true;
    logger.info('Initializing event listeners');

    // Listen for new session creation to trigger state update broadcasts
    listenerRegistry.addTrackedListener(sessionService, 'session:created', async (sessionData) => {
      try {
        logger.info('Session created event received', { sessionId: sessionData.id });

        const currentState = this.getCurrentState();
        if (currentState) {
          this.emit('state:updated', currentState.toJSON());
          logger.info('State updated after session creation', { sessionId: sessionData.id });
        } else {
          logger.warn('Could not derive GameState after session creation', { sessionId: sessionData.id });
        }
      } catch (error) {
        logger.error('Failed to emit state update after session:created', {
          error: error.message,
          stack: error.stack,
          sessionId: sessionData.id
        });
      }
    });

    // Listen for offline status changes to update state AND cache
    listenerRegistry.addTrackedListener(offlineQueueService, 'status:changed', async ({ offline }) => {
      // Cache offline status (aggregator pattern)
      this.cachedOfflineStatus = offline;

      // Emit state update if session exists
      const currentState = this.getCurrentState();
      if (currentState) {
        await this.updateState({ systemStatus: { offline } }, { immediate: true });
        logger.info('Updated state offline status', { offline });
      }
    });

    // Listen for accepted transactions to update scores
    listenerRegistry.addTrackedListener(transactionService, 'transaction:accepted', async (transaction) => {
      const currentState = this.getCurrentState();
      if (!currentState) {
        logger.warn('No session when transaction accepted - cannot update state', { transactionId: transaction.id });
        return;
      }

      try {
        const scores = [];
        for (const [, teamScore] of transactionService.teamScores) {
          scores.push(teamScore.toJSON());
        }

        logger.debug('Updating state with scores after transaction', {
          transactionId: transaction.id,
          teamId: transaction.teamId,
          points: transaction.points,
          scoresCount: scores.length
        });

        await this.updateState({ scores });

        logger.debug('State updated after transaction', {
          transactionId: transaction.id,
          teamId: transaction.teamId,
          points: transaction.points
        });
      } catch (error) {
        logger.error('Failed to update state after transaction', { error });
      }
    });

    // NOTE: scores:reset handling moved to sessionService.setupScoreListeners()
    // sessionService owns session.scores (Single Responsibility Principle)

    // NOTE (Slice 6): transaction:deleted persistence moved to sessionService.setupPersistenceListeners()
    // sessionService owns ALL persistence (Single Responsibility Principle)

    // Listen for transaction additions to update recent transactions
    listenerRegistry.addTrackedListener(sessionService, 'transaction:added', async (transaction) => {
      const currentState = this.getCurrentState();
      logger.info('State received transaction:added event', {
        transactionId: transaction.id,
        tokenId: transaction.tokenId,
        hasSession: !!currentState
      });
      if (!currentState) return;

      try {
        const recentTransactions = currentState.recentTransactions || [];
        const updatedTransactions = [...recentTransactions];

        updatedTransactions.push({
          id: transaction.id,
          tokenId: transaction.tokenId,
          teamId: transaction.teamId,
          deviceId: transaction.deviceId,
          timestamp: transaction.timestamp,
          sessionId: transaction.sessionId,
          status: transaction.status,
          rejectionReason: transaction.rejectionReason || null,
          points: transaction.points
        });

        // Keep ALL transactions for complete state restoration
        // CRITICAL: Frontend needs full transaction history for team details after refresh

        logger.info('Updating state with transactions', {
          transactionCount: updatedTransactions.length,
          // Log only last 3 tokenIds to avoid log spam with 500+ transactions
          latestTokens: updatedTransactions.slice(-3).map(t => t.tokenId)
        });

        await this.updateState({ recentTransactions: updatedTransactions });
      } catch (error) {
        logger.error('Failed to update recent transactions', { error });
      }
    });

    // Listen for video events to update currentVideo
    listenerRegistry.addTrackedListener(videoQueueService, 'video:started', async (data) => {
      const currentState = this.getCurrentState();
      if (!currentState) return;

      try {
        const currentVideoInfo = videoQueueService.getCurrentVideo();
        if (currentVideoInfo) {
          await this.setCurrentVideo(currentVideoInfo);
        } else {
          // Fallback if getCurrentVideo() doesn't return data
          await this.setCurrentVideo({
            tokenId: data.queueItem.tokenId,
            requestedBy: data.queueItem.requestedBy,
            startTime: data.queueItem.playbackStart || new Date().toISOString(),
            expectedEndTime: data.expectedEndTime || new Date(Date.now() + (data.duration || 30) * 1000).toISOString()
          });
        }

        logger.debug('State updated with current video', {
          tokenId: data.queueItem.tokenId
        });
      } catch (error) {
        logger.error('Failed to update video state', { error });
      }
    });

    listenerRegistry.addTrackedListener(videoQueueService, 'video:completed', async () => {
      const currentState = this.getCurrentState();
      if (!currentState) return;

      try {
        await this.clearCurrentVideo();
        logger.debug('Current video cleared from state');
      } catch (error) {
        logger.error('Failed to clear video state', { error });
      }
    });

    listenerRegistry.addTrackedListener(videoQueueService, 'video:failed', async () => {
      const currentState = this.getCurrentState();
      if (!currentState) return;

      try {
        await this.clearCurrentVideo();
        logger.debug('Current video cleared after failure');
      } catch (error) {
        logger.error('Failed to clear video state after failure', { error });
      }
    });

    // Listen for video:idle event (emitted when queue is cleared or no videos)
    listenerRegistry.addTrackedListener(videoQueueService, 'video:idle', async () => {
      const currentState = this.getCurrentState();
      if (!currentState) return;

      try {
        await this.clearCurrentVideo();
        logger.debug('Current video cleared - system idle');
      } catch (error) {
        logger.error('Failed to clear video state on idle', { error });
      }
    });

    // Listen for queue:reset event (emitted when entire queue is cleared)
    listenerRegistry.addTrackedListener(videoQueueService, 'queue:reset', async () => {
      const currentState = this.getCurrentState();
      if (!currentState) return;

      try {
        await this.clearCurrentVideo();
        logger.debug('Current video cleared - queue reset');
      } catch (error) {
        logger.error('Failed to clear video state on queue reset', { error });
      }
    });
  }

  /**
   * Emit state update with optional debouncing
   * @param {Object} state - Full state to emit (per contract)
   * @param {boolean} immediate - If true, emit immediately without debouncing
   * @private
   */
  emitStateUpdate(state, immediate = false) {
    if (immediate) {
      this.emit('state:updated', state);
      logger.debug('Emitted immediate state update', {
        stateKeys: Object.keys(state)
      });
      return;
    }

    // Store latest state for debouncing (replaces previous pending)
    this.pendingStateUpdate = state;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      if (this.pendingStateUpdate) {
        this.emit('state:updated', this.pendingStateUpdate);
        logger.debug('Emitted debounced state update', {
          stateKeys: Object.keys(this.pendingStateUpdate)
        });
        this.pendingStateUpdate = null;
      }
    }, this.debounceDelay);
  }

  /**
   * Get current game state - COMPUTED from session + live system status
   *
   * ARCHITECTURAL NOTE: GameState is a COMPUTED VIEW, not a stored entity.
   * It's always derived fresh from the current session + live system status.
   * This eliminates sync bugs on orchestrator restart and ensures state
   * always matches session (single source of truth pattern).
   *
   * @returns {GameState|null}
   */
  getCurrentState() {
    const session = sessionService.getCurrentSession();
    if (!session) return null;

    return GameState.fromSession(session, {
      offline: this.cachedOfflineStatus || false
    });
  }

  /**
   * Compute and emit a state update broadcast.
   *
   * The `updates` parameter is NOT applied to stored state (there is none).
   * It controls emit behavior: video-related updates emit immediately,
   * others are debounced. System status updates are stripped (cached separately).
   *
   * @param {Object} updates - Describes what changed (used for urgency + logging)
   * @param {Object} options - Update options
   * @param {boolean} options.immediate - If true, emit update immediately without debouncing
   * @returns {Promise<GameState|null>}
   */
  async updateState(updates, options = {}) {
    // System status updates are cached separately via aggregator pattern
    if (updates.systemStatus !== undefined) {
      delete updates.systemStatus;
    }

    const currentState = this.getCurrentState();
    if (!currentState) {
      logger.warn('updateState() called but no session exists - cannot derive GameState');
      return null;
    }

    try {
      const fullState = currentState.toJSON();

      // Video updates are immediate, scores can be debounced
      const isImmediate = options.immediate ||
        updates.currentVideo !== undefined;

      logger.debug('Emitting state update (computed from session)', {
        isImmediate,
        stateKeys: Object.keys(fullState),
        updateKeys: Object.keys(updates)
      });

      this.emitStateUpdate(fullState, isImmediate);

      return currentState;
    } catch (error) {
      logger.error('Failed to update game state', error);
      throw error;
    }
  }

  /**
   * Set current video
   * @param {Object} videoInfo - Video information
   * @returns {Promise<void>}
   */
  async setCurrentVideo(videoInfo) {
    const currentState = this.getCurrentState();
    if (!currentState) {
      logger.debug('setCurrentVideo called but no session exists');
      return;
    }

    await this.updateState({ currentVideo: videoInfo });
    logger.info('Current video set', { tokenId: videoInfo?.tokenId });
  }

  /**
   * Clear current video
   * @returns {Promise<void>}
   */
  async clearCurrentVideo() {
    const currentState = this.getCurrentState();
    if (!currentState) {
      logger.debug('clearCurrentVideo called but no session exists');
      return;
    }

    await this.updateState({ currentVideo: null });
    logger.info('Current video cleared');
  }

  /**
   * Reset state
   * @returns {Promise<void>}
   */
  async reset() {
    // Clear timers FIRST
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Remove listeners BEFORE resetting flag
    this.removeAllListeners();
    this.listenersInitialized = false;

    // Reset ephemeral tracking
    this.pendingStateUpdate = null;

    // Clear any legacy persisted state
    await persistenceService.delete('gameState:current');
    this.emit('state:reset');

    logger.info('Game state reset (GameState is computed from session)');
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup() {
    logger.info('StateService cleanup complete (GameState derived from session)');
  }
}

// Export singleton instance
module.exports = new StateService();
