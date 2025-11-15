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
    // NOTE: currentState removed - GameState is now computed on-demand from session
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
      // NOTE: GameState is now COMPUTED from session, not stored
      // Legacy state persistence removed - GameState derives from session on-demand
      // Clear any old persisted state (cleanup from previous architecture)
      const savedState = await persistenceService.loadGameState();
      if (savedState) {
        logger.info('Found legacy persisted GameState - clearing (now computed from session)');
        await persistenceService.delete('gameState:current');
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

    // Listen for new session creation to trigger state update broadcasts
    listenerRegistry.addTrackedListener(sessionService, 'session:created', async (sessionData) => {
      try {
        logger.info('Session created event received', { sessionId: sessionData.id });

        // GameState is now computed on-demand, not stored
        // Just emit state:updated to trigger broadcasts
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
      // Cache offline status (Phase 1.1.4 - aggregator pattern)
      this.cachedOfflineStatus = offline;

      // Emit state update if session exists (GameState is computed from session)
      const currentState = this.getCurrentState();
      if (currentState) {
        await this.updateState({ systemStatus: { offline } }, { immediate: true });
        logger.info('Updated state offline status', { offline });
      }
    });

    // Listen for accepted transactions to update scores
    listenerRegistry.addTrackedListener(transactionService, 'transaction:accepted', async (transaction) => {
      // Check if we have a session (GameState is computed from session)
      const currentState = this.getCurrentState();
      if (!currentState) {
        logger.warn('No session when transaction accepted - cannot update state', { transactionId: transaction.id });
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

    // Listen for score resets to update session.scores
    listenerRegistry.addTrackedListener(transactionService, 'scores:reset', async (data) => {
      const session = sessionService.getCurrentSession();
      if (!session) {
        logger.warn('No session during scores:reset');
        return;
      }

      try {
        // Clear session.scores array (reset to empty)
        session.scores = [];

        // Persist updated session
        const sessionJSON = session.toJSON();
        await persistenceService.saveSession(sessionJSON);
        await persistenceService.save('session:current', sessionJSON);

        logger.info('Session scores cleared after reset', {
          sessionId: session.id,
          teamsReset: data?.teamsReset?.length || 0
        });
      } catch (error) {
        logger.error('Failed to update session after scores reset', { error });
      }
    });

    // Listen for transaction deletions to persist session changes
    listenerRegistry.addTrackedListener(transactionService, 'transaction:deleted', async (data) => {
      const session = sessionService.getCurrentSession();
      if (!session) {
        logger.warn('No session during transaction:deleted');
        return;
      }

      try {
        // DEBUG: Log session state BEFORE persistence
        const deviceKeys = Object.keys(session.metadata?.scannedTokensByDevice || {});
        const scannedByDevice = {};
        deviceKeys.forEach(deviceId => {
          scannedByDevice[deviceId] = session.metadata.scannedTokensByDevice[deviceId].length;
        });

        logger.info('🔍 BEFORE persistence (transaction:deleted)', {
          sessionId: session.id,
          transactionId: data.transactionId,
          tokenId: data.tokenId,
          teamId: data.teamId,
          totalTransactions: session.transactions.length,
          devicesTracked: deviceKeys.length,
          scannedTokensByDevice: scannedByDevice
        });

        // Session already modified by transactionService.deleteTransaction()
        // Just persist the changes (scannedTokensByDevice + transactions array)
        const sessionJSON = session.toJSON();
        await persistenceService.saveSession(sessionJSON);
        await persistenceService.save('session:current', sessionJSON);

        // DEBUG: Log AFTER persistence
        logger.info('✅ AFTER persistence (transaction:deleted)', {
          sessionId: session.id,
          transactionId: data.transactionId,
          persisted: true,
          totalTransactions: session.transactions.length
        });
      } catch (error) {
        logger.error('❌ Failed to persist session after transaction deletion', {
          error: error.message,
          stack: error.stack,
          transactionId: data.transactionId
        });
      }
    });

    // Listen for transaction additions to update recent transactions
    listenerRegistry.addTrackedListener(sessionService, 'transaction:added', async (transaction) => {
      // Check if we have a session (GameState is computed from session)
      const currentState = this.getCurrentState();
      logger.info('State received transaction:added event', {
        transactionId: transaction.id,
        tokenId: transaction.tokenId,
        hasSession: !!currentState
      });
      if (!currentState) return;

      try {
        // GameState is computed from session - recent transactions are in state
        // Get current recent transactions from computed state
        const recentTransactions = currentState.recentTransactions || [];
        const updatedTransactions = [...recentTransactions];

        updatedTransactions.push({
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
        const trimmed = updatedTransactions.slice(-10);

        logger.info('Updating state with recent transactions', {
          transactionCount: trimmed.length,
          tokenIds: trimmed.map(t => t.tokenId)
        });

        // Update state (debounced for rapid transaction additions)
        // NOTE: This will trigger re-computation and broadcast
        await this.updateState({ recentTransactions: trimmed });
      } catch (error) {
        logger.error('Failed to update recent transactions', { error });
      }
    });

    // Listen for video events to update currentVideo
    listenerRegistry.addTrackedListener(videoQueueService, 'video:started', async (data) => {
      // Check if we have a session (GameState is computed from session)
      const currentState = this.getCurrentState();
      if (!currentState) return;

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
      // Check if we have a session (GameState is computed from session)
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
      // Check if we have a session (GameState is computed from session)
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
      // Check if we have a session (GameState is computed from session)
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
      // Check if we have a session (GameState is computed from session)
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

    // Always derive fresh from session + current system status
    return GameState.fromSession(session, {
      vlcConnected: this.vlcConnected || false,
      videoDisplayReady: this.videoDisplayReady || false,
      offline: this.cachedOfflineStatus || false
    });
  }

  /**
   * Set current game state
   * @deprecated GameState is now computed on-demand, not stored
   * @param {GameState} state - The state to set (ignored)
   */
  setCurrentState(state) {
    // NO-OP: GameState is now computed from session, not stored
    logger.warn('setCurrentState() called but GameState is now computed (no-op)', {
      stateSessionId: state?.sessionId
    });
  }

  /**
   * Create default/empty game state
   * @deprecated GameState should be derived from session, not created standalone
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

    // NOTE: Not storing - GameState is now computed from session
    logger.warn('createDefaultState() called - prefer creating session and deriving state');
    return defaultState;
  }

  /**
   * Create state from session
   * @deprecated Use getCurrentState() instead (computes on-demand)
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

    // NOTE: Not storing state anymore - just return computed GameState
    const state = GameState.fromSession(session, systemStatus);

    // Re-setup transaction listeners after creating state
    // (needed because reset() removes all listeners)
    this.setupTransactionListeners();

    logger.warn('createStateFromSession() called - prefer getCurrentState() for computed view');
    return state;
  }

  /**
   * Update game state
   * @deprecated GameState is now computed - updates should modify session instead
   * @param {Object} updates - Partial state updates
   * @param {Object} options - Update options
   * @param {boolean} options.immediate - If true, emit update immediately without debouncing
   * @returns {Promise<GameState>}
   */
  async updateState(updates, options = {}) {
    // GameState is computed from session - we can't mutate it directly

    // System status updates are handled separately to avoid circular calls
    if (updates.systemStatus !== undefined) {
      logger.warn('updateState called with systemStatus - use updateSystemStatus() directly instead');
      // Don't process here - caller should use updateSystemStatus()
      delete updates.systemStatus;
    }

    // For other updates, we should be modifying the session instead
    // But for backwards compatibility during transition, we'll just emit current state
    const currentState = this.getCurrentState();
    if (!currentState) {
      logger.warn('updateState() called but no session exists - cannot derive GameState');
      return null;
    }

    try {
      // Emit full state per contract
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

    // Emit state update if session exists (GameState is computed from session)
    const currentState = this.getCurrentState();
    if (currentState) {
      // Emit directly without calling updateState (which would call us back)
      const fullState = currentState.toJSON();
      this.emitStateUpdate(fullState, true); // immediate emit for system status
      logger.debug('System status updated', { status });
    }
  }

  /**
   * Set current video
   * @param {Object} videoInfo - Video information
   * @returns {Promise<void>}
   */
  async setCurrentVideo(videoInfo) {
    // Check if we have a session (GameState is computed from session)
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
    // Check if we have a session (GameState is computed from session)
    const currentState = this.getCurrentState();
    if (!currentState) {
      logger.debug('clearCurrentVideo called but no session exists');
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
    // Check if we have a session (GameState is computed from session)
    const currentState = this.getCurrentState();
    if (!currentState) {
      logger.debug('updateScores called but no session exists');
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
    // Check if we have a session (GameState is computed from session)
    const currentState = this.getCurrentState();
    if (!currentState) {
      logger.debug('updateRecentTransactions called but no session exists');
      return;
    }

    await this.updateState({ recentTransactions: transactions });
  }

  /**
   * Sync state from session
   * @deprecated GameState is now computed on-demand - just use getCurrentState()
   * @param {Object} session - Session object
   * @returns {Promise<GameState>}
   */
  async syncFromSession(session) {
    if (!session) {
      logger.info('syncFromSession called with no session - state will be null');
      return null;
    }

    // GameState is now computed from session - no need to create/store
    const state = this.getCurrentState();

    if (state) {
      // Emit both sync and update events for compatibility
      this.emit('state:sync', state.toJSON());

      // Always emit state:updated when syncing from session changes
      // This ensures session status changes trigger state updates
      this.emit('state:updated', state.toJSON());

      logger.info('State synced from session (computed)', { sessionId: session.id });
    } else {
      logger.warn('syncFromSession: Session exists but could not derive GameState', {
        sessionId: session.id
      });
    }

    return state;
  }

  /**
   * Create state delta
   * @deprecated GameState is computed on-demand - delta tracking no longer needed
   * @returns {Object} Delta object
   * @private
   */
  createStateDelta() {
    // GameState is computed from session - delta tracking is no longer meaningful
    const currentState = this.getCurrentState();
    if (!currentState || !this.previousState) {
      return currentState ? currentState.toJSON() : {};
    }

    // Pass the previous state JSON directly - createDelta now handles both GameState and plain JSON
    return currentState.createDelta(this.previousState);
  }

  /**
   * Save current state to persistence
   * @deprecated GameState is now computed from session, not persisted
   * @returns {Promise<void>}
   * @private
   */
  async saveState() {
    // NO-OP: GameState is now computed from session, not persisted
    logger.debug('saveState() called but GameState is no longer persisted (derived from session)');
  }

  /**
   * Start sync interval
   * @deprecated GameState is no longer persisted (computed from session)
   * @private
   */
  startSyncInterval() {
    this.stopSyncInterval();

    // GameState is no longer persisted - this interval is no longer needed
    // Session is persisted separately by sessionService
    logger.debug('startSyncInterval called but GameState persistence disabled (computed from session)');
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
    return this.getCurrentState()?.isVideoPlaying() || false;
  }

  /**
   * Get remaining video time
   * @returns {number} Seconds remaining
   */
  getRemainingVideoTime() {
    return this.getCurrentState()?.getRemainingVideoTime() || 0;
  }

  /**
   * Get team score
   * @param {string} teamId - Team ID
   * @returns {Object|null}
   */
  getTeamScore(teamId) {
    return this.getCurrentState()?.getTeamScore(teamId) || null;
  }

  /**
   * Get winning team
   * @returns {Object|null}
   */
  getWinningTeam() {
    return this.getCurrentState()?.getWinningTeam() || null;
  }

  /**
   * Check if system is operational
   * @returns {boolean}
   */
  isSystemOperational() {
    return this.getCurrentState()?.isSystemOperational() || false;
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
    this.listenersInitialized = false;

    // Reset ephemeral tracking (GameState is computed from session, not stored)
    this.previousState = null;
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
    this.stopSyncInterval();
    // GameState is no longer persisted (computed from session)
    logger.info('StateService cleanup complete (GameState derived from session)');
  }
}

// Export singleton instance
module.exports = new StateService();