/**
 * State Service
 * Manages game state synchronization and updates.
 *
 * GameState is a COMPUTED VIEW derived from the current session + live system status.
 * It is never stored or persisted directly. This eliminates sync bugs on restart.
 *
 * NOTE: Event listeners (setupTransactionListeners, init, emitStateUpdate, updateState,
 * setCurrentVideo, clearCurrentVideo) were removed — they computed GameState and emitted
 * state:updated, but zero consumers existed for that event. Only getCurrentState() remains
 * as a computed view accessor.
 */

const EventEmitter = require('events');
const GameState = require('../models/gameState');
const persistenceService = require('./persistenceService');
const logger = require('../utils/logger');

const sessionService = require('./sessionService');

class StateService extends EventEmitter {
  constructor() {
    super();

    // Cache offline status from events (aggregator pattern)
    this.cachedOfflineStatus = false;
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
   * Reset state
   * @returns {Promise<void>}
   */
  async reset() {
    this.removeAllListeners();
    this.cachedOfflineStatus = false;

    // Clear any legacy persisted state
    await persistenceService.delete('gameState:current');

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
