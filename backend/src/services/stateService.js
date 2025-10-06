/**
 * State Service
 * Manages game state synchronization and updates
 */

const EventEmitter = require('events');
const GameState = require('../models/gameState');
const persistenceService = require('./persistenceService');
const config = require('../config');
const logger = require('../utils/logger');
const listenerRegistry = require('../websocket/listenerRegistry');

// TOP-LEVEL IMPORTS (removed lazy requires - Phase 1.1.4)
const sessionService = require('./sessionService');
const transactionService = require('./transactionService');
const videoQueueService = require('./videoQueueService');
const offlineQueueService = require('./offlineQueueService');

class StateService extends EventEmitter {
  constructor() {
    super();
    this.currentState = null;
    this.previousState = null;
    this.syncInterval = null;
    this.vlcConnected = false;
    this.videoDisplayReady = false;
    this.listenersInitialized = false;

    // Cache offline status from events (Phase 1.1.4 - aggregator pattern)
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
    try {
      // Load saved state
      const savedState = await persistenceService.loadGameState();
      if (savedState) {
        try {
          this.currentState = GameState.fromJSON(savedState);
          logger.info('Game state restored from storage');
        } catch (validationError) {
          // If saved state is invalid (e.g., from older version), clear it and start fresh
          logger.warn('Saved state validation failed, clearing corrupted data', {
            error: validationError.message,
            details: validationError.details
          });
          await persistenceService.delete('gameState:current');
          this.currentState = null;
        }
      }

      // If no state but session exists, create state from session
      if (!this.currentState) {
        const session = sessionService.getCurrentSession();
        if (session) {
          this.currentState = this.createStateFromSession(session);
          await this.saveState();
          logger.info('Game state created from current session');
        }
      }

      // Set up event listeners for transactions
      this.setupTransactionListeners();

      // Start sync interval
      this.startSyncInterval();
    } catch (error) {
      logger.error('Failed to initialize state service', error);
      // Still set up listeners even if loading failed
      this.setupTransactionListeners();
    }
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

    // Listen for new session creation to create game state
    listenerRegistry.addTrackedListener(sessionService, 'session:created', async (sessionData) => {
      try {
        logger.info('Session created, creating game state', { sessionId: sessionData.id });

        // Get full session object
        const session = sessionService.getCurrentSession();
        if (session) {
          this.currentState = this.createStateFromSession(session);
          await this.saveState();
          logger.info('Game state created from new session', { sessionId: session.id });

          // Emit state update
          this.emit('state:updated', this.currentState.toJSON());
        } else {
          logger.error('session:created event fired but getCurrentSession() returned null');
        }
      } catch (error) {
        logger.error('Failed to create game state from session:created event', {
          error: error.message,
          stack: error.stack,
          sessionId: sessionData.id
        });
      }
    });

    // Listen for offline status changes to update state AND cache
    listenerRegistry.addTrackedListener(offlineQueueService, 'status:changed', async ({ offline }) => {
      // Cache offline status (Phase 1.1.4 - aggregator pattern)
      this.cachedOfflineStatus = offline;

      if (this.currentState) {
        await this.updateState({ systemStatus: { offline } }, { immediate: true });
        logger.info('Updated state offline status', { offline });
      }
    });

    // Listen for accepted transactions to update scores
    listenerRegistry.addTrackedListener(transactionService, 'transaction:accepted', async (transaction) => {
      if (!this.currentState) {
        logger.warn('No current state when transaction accepted', { transactionId: transaction.id });
        return;
      }

      try {
        // Get updated scores from transactionService
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

        // Update state with new scores
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

    // Listen for transaction additions to update recent transactions
    listenerRegistry.addTrackedListener(sessionService, 'transaction:added', async (transaction) => {
      logger.info('State received transaction:added event', {
        transactionId: transaction.id,
        tokenId: transaction.tokenId,
        hasCurrentState: !!this.currentState
      });
      if (!this.currentState) return;

      try {
        // Add FULL transaction to recent transactions in state (per data model)
        const recentTransactions = this.currentState.recentTransactions || [];
        recentTransactions.push({
          id: transaction.id,
          tokenId: transaction.tokenId,
          teamId: transaction.teamId,
          deviceId: transaction.deviceId,  // Required field per data model
          timestamp: transaction.timestamp,
          sessionId: transaction.sessionId,   // Required field per data model
          status: transaction.status,
          rejectionReason: transaction.rejectionReason || null,
          points: transaction.points
        });

        // Keep only last 10 transactions
        const trimmed = recentTransactions.slice(-10);

        logger.info('Updating state with recent transactions', {
          transactionCount: trimmed.length,
          tokenIds: trimmed.map(t => t.tokenId)
        });

        // Update state (debounced for rapid transaction additions)
        await this.updateState({ recentTransactions: trimmed });
      } catch (error) {
        logger.error('Failed to update recent transactions', { error });
      }
    });

    // Listen for video events to update currentVideo
    listenerRegistry.addTrackedListener(videoQueueService, 'video:started', async (data) => {
      if (!this.currentState) return;

      try {
        // Get proper current video info from videoQueueService
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
      if (!this.currentState) return;

      try {
        await this.clearCurrentVideo();
        logger.debug('Current video cleared from state');
      } catch (error) {
        logger.error('Failed to clear video state', { error });
      }
    });

    listenerRegistry.addTrackedListener(videoQueueService, 'video:failed', async () => {
      if (!this.currentState) return;

      try {
        await this.clearCurrentVideo();
        logger.debug('Current video cleared after failure');
      } catch (error) {
        logger.error('Failed to clear video state after failure', { error });
      }
    });

    // Listen for video:idle event (emitted when queue is cleared or no videos)
    listenerRegistry.addTrackedListener(videoQueueService, 'video:idle', async () => {
      if (!this.currentState) return;

      try {
        await this.clearCurrentVideo();
        logger.debug('Current video cleared - system idle');
      } catch (error) {
        logger.error('Failed to clear video state on idle', { error });
      }
    });

    // Listen for queue:reset event (emitted when entire queue is cleared)
    listenerRegistry.addTrackedListener(videoQueueService, 'queue:reset', async () => {
      if (!this.currentState) return;

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
      // Emit immediately for critical updates
      this.emit('state:updated', state);
      logger.debug('Emitted immediate state update', {
        stateKeys: Object.keys(state)
      });
      return;
    }

    // Store latest state for debouncing (replaces previous pending)
    this.pendingStateUpdate = state;

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      if (this.pendingStateUpdate) {
        // Emit the latest full state
        this.emit('state:updated', this.pendingStateUpdate);
        logger.debug('Emitted debounced state update', {
          stateKeys: Object.keys(this.pendingStateUpdate)
        });
        this.pendingStateUpdate = null;
      }
    }, this.debounceDelay);
  }

  /**
   * Get current game state
   * @returns {GameState|null}
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Set current game state
   * @param {GameState} state - The state to set
   */
  setCurrentState(state) {
    this.currentState = state;
  }

  /**
   * Create default/empty game state
   * @returns {GameState}
   */
  createDefaultState() {
    const { v4: uuidv4 } = require('uuid');
    const defaultState = new GameState({
      sessionId: uuidv4(), // Generate a default session ID
      lastUpdate: new Date().toISOString(),
      currentVideo: null,
      scores: [
        // Default team scores
        {
          teamId: 'TEAM_A',
          currentScore: 0,
          tokensScanned: 0,
          bonusPoints: 0,
          completedGroups: [],
          lastUpdate: new Date().toISOString()
        },
        {
          teamId: 'TEAM_B',
          currentScore: 0,
          tokensScanned: 0,
          bonusPoints: 0,
          completedGroups: [],
          lastUpdate: new Date().toISOString()
        }
      ],
      recentTransactions: [],
      systemStatus: {
        orchestratorOnline: true,
        vlcConnected: this.vlcConnected,
        videoDisplayReady: this.videoDisplayReady,
        offline: this.cachedOfflineStatus,  // Use cached value (Phase 1.1.4)
      }
    });

    this.currentState = defaultState;
    return defaultState;
  }

  /**
   * Create state from session
   * @param {Object} session - Session object
   * @returns {GameState}
   */
  createStateFromSession(session) {
    // Use cached offline status (Phase 1.1.4 - aggregator pattern)
    const systemStatus = {
      orchestratorOnline: true,
      vlcConnected: this.vlcConnected,
      videoDisplayReady: this.videoDisplayReady,
      offline: this.cachedOfflineStatus,
    };

    this.previousState = this.currentState;
    this.currentState = GameState.fromSession(session, systemStatus);

    // Re-setup transaction listeners after creating state
    // (needed because reset() removes all listeners)
    this.setupTransactionListeners();

    return this.currentState;
  }

  /**
   * Update game state
   * @param {Object} updates - Partial state updates
   * @param {Object} options - Update options
   * @param {boolean} options.immediate - If true, emit update immediately without debouncing
   * @returns {Promise<GameState>}
   */
  async updateState(updates, options = {}) {
    if (!this.currentState) {
      throw new Error('No current game state');
    }

    try {
      this.previousState = this.currentState.toJSON();

      // Track if any actual changes were made
      let hasChanges = false;

      // Apply updates
      if (updates.currentVideo !== undefined) {
        this.currentState.setCurrentVideo(updates.currentVideo);
        hasChanges = true;
      }

      if (updates.scores !== undefined) {
        this.currentState.updateScores(updates.scores);
        hasChanges = true;
      }

      if (updates.recentTransactions !== undefined) {
        this.currentState.updateRecentTransactions(updates.recentTransactions);
        hasChanges = true;
      }

      if (updates.systemStatus !== undefined) {
        this.currentState.updateSystemStatus(updates.systemStatus);
        hasChanges = true;
      }

      // Only touch if actual changes were made
      if (hasChanges) {
        this.currentState.touch();
      }

      // Save to persistence
      await this.saveState();

      // Check if there were actual changes
      const delta = this.createStateDelta();
      logger.debug('State delta created', {
        deltaKeys: Object.keys(delta),
        hasChanges: Object.keys(delta).length > 0,
        updateKeys: Object.keys(updates)
      });

      if (Object.keys(delta).length > 0) {
        // Emit full state per contract (not delta)
        const fullState = this.currentState.toJSON();

        // Video and system status updates are immediate, scores can be debounced
        const isImmediate = options.immediate ||
          updates.currentVideo !== undefined ||
          updates.systemStatus !== undefined;
        logger.debug('Emitting state update', { isImmediate, stateKeys: Object.keys(fullState) });
        this.emitStateUpdate(fullState, isImmediate);
      } else {
        logger.debug('No changes to emit - state unchanged');
      }

      return this.currentState;
    } catch (error) {
      logger.error('Failed to update game state', error);
      throw error;
    }
  }

  /**
   * Update system status
   * @param {Object} status - System status updates
   * @returns {Promise<void>}
   */
  async updateSystemStatus(status) {
    if (status.vlcConnected !== undefined) {
      this.vlcConnected = status.vlcConnected;
    }

    if (status.videoDisplayReady !== undefined) {
      this.videoDisplayReady = status.videoDisplayReady;
    }

    if (this.currentState) {
      await this.updateState({ systemStatus: status });
    }
  }

  /**
   * Set current video
   * @param {Object} videoInfo - Video information
   * @returns {Promise<void>}
   */
  async setCurrentVideo(videoInfo) {
    if (!this.currentState) {
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
    if (!this.currentState) {
      return;
    }

    await this.updateState({ currentVideo: null });
    logger.info('Current video cleared');
  }

  /**
   * Update scores
   * @param {Array} scores - Updated scores
   * @returns {Promise<void>}
   */
  async updateScores(scores) {
    if (!this.currentState) {
      return;
    }

    await this.updateState({ scores });
  }

  /**
   * Update recent transactions
   * @param {Array} transactions - Recent transactions
   * @returns {Promise<void>}
   */
  async updateRecentTransactions(transactions) {
    if (!this.currentState) {
      return;
    }

    await this.updateState({ recentTransactions: transactions });
  }

  /**
   * Sync state from session
   * @param {Object} session - Session object
   * @returns {Promise<GameState>}
   */
  async syncFromSession(session) {
    if (!session) {
      this.currentState = null;
      await persistenceService.delete('gameState:current');
      return null;
    }

    // Store previous state before creating new one
    this.previousState = this.currentState ? this.currentState.toJSON() : null;

    const state = this.createStateFromSession(session);
    await this.saveState();

    // Emit both sync and update events for compatibility
    this.emit('state:sync', state.toJSON());

    // Always emit state:updated when syncing from session changes
    // This ensures session status changes trigger state updates
    this.emit('state:updated', state.toJSON());

    return state;
  }

  /**
   * Create state delta
   * @returns {Object} Delta object
   * @private
   */
  createStateDelta() {
    if (!this.currentState || !this.previousState) {
      return this.currentState ? this.currentState.toJSON() : {};
    }

    // Pass the previous state JSON directly - createDelta now handles both GameState and plain JSON
    return this.currentState.createDelta(this.previousState);
  }

  /**
   * Save current state to persistence
   * @returns {Promise<void>}
   * @private
   */
  async saveState() {
    if (this.currentState) {
      await persistenceService.saveGameState(this.currentState.toJSON());
    }
  }

  /**
   * Start sync interval
   * @private
   */
  startSyncInterval() {
    this.stopSyncInterval();
    
    // Periodic save to persistence
    this.syncInterval = setInterval(async () => {
      if (this.currentState) {
        await this.saveState();
      }
    }, 30000); // Save every 30 seconds
  }

  /**
   * Stop sync interval
   * @private
   */
  stopSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Check if video is playing
   * @returns {boolean}
   */
  isVideoPlaying() {
    return this.currentState?.isVideoPlaying() || false;
  }

  /**
   * Get remaining video time
   * @returns {number} Seconds remaining
   */
  getRemainingVideoTime() {
    return this.currentState?.getRemainingVideoTime() || 0;
  }

  /**
   * Get team score
   * @param {string} teamId - Team ID
   * @returns {Object|null}
   */
  getTeamScore(teamId) {
    return this.currentState?.getTeamScore(teamId) || null;
  }

  /**
   * Get winning team
   * @returns {Object|null}
   */
  getWinningTeam() {
    return this.currentState?.getWinningTeam() || null;
  }

  /**
   * Check if system is operational
   * @returns {boolean}
   */
  isSystemOperational() {
    return this.currentState?.isSystemOperational() || false;
  }

  /**
   * Reset state
   * @returns {Promise<void>}
   */
  async reset() {
    // Clear timers FIRST
    this.stopSyncInterval();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Remove listeners BEFORE resetting flag
    this.removeAllListeners();
    this.listenersInitialized = false;  // ADD THIS

    // Reset state
    this.currentState = null;
    this.previousState = null;
    this.pendingStateUpdate = null;

    await persistenceService.delete('gameState:current');
    this.emit('state:reset');

    logger.info('Game state reset');
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup() {
    this.stopSyncInterval();
    if (this.currentState) {
      await this.saveState();
    }
  }
}

// Export singleton instance
module.exports = new StateService();