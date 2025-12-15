/**
 * Session Service
 * Manages game sessions and session lifecycle
 */

const EventEmitter = require('events');
const Session = require('../models/session');
const persistenceService = require('./persistenceService');
const config = require('../config');
const logger = require('../utils/logger');
const listenerRegistry = require('../websocket/listenerRegistry');

class SessionService extends EventEmitter {
  constructor() {
    super();
    this.initState(); // ADD THIS
  }

  // ADD new method after constructor
  initState() {
    this.currentSession = null;
    this.sessionTimeoutTimer = null;
  }

  /**
   * Set up listeners for score events from transactionService
   * SessionService owns session.scores (source of truth), so it must handle score sync
   * Uses listenerRegistry for proper test cleanup
   */
  setupScoreListeners() {
    // Lazy import to avoid circular dependency at module load time
    const transactionService = require('./transactionService');

    // Listen for score:updated to sync transactionService.teamScores → session.scores
    listenerRegistry.addTrackedListener(transactionService, 'score:updated', async (teamScore) => {
      if (!this.currentSession) {
        return;
      }

      try {
        const existingIndex = this.currentSession.scores.findIndex(
          s => s.teamId === teamScore.teamId
        );

        const scoreData = teamScore.toJSON ? teamScore.toJSON() : teamScore;

        if (existingIndex >= 0) {
          this.currentSession.scores[existingIndex] = scoreData;
        } else {
          this.currentSession.scores.push(scoreData);
        }

        await this.saveCurrentSession();
        this.emit('session:updated', this.currentSession);

        logger.debug('Session score synced from transactionService', {
          teamId: teamScore.teamId,
          currentScore: scoreData.currentScore
        });
      } catch (error) {
        logger.error('Failed to sync score to session', { error: error.message, teamId: teamScore.teamId });
      }
    }, 'sessionService->transactionService:score:updated');

    // Listen for scores:reset to reset session.scores to zero
    // Per AsyncAPI contract: teams should still exist after reset with zero scores
    listenerRegistry.addTrackedListener(transactionService, 'scores:reset', async () => {
      if (!this.currentSession) {
        logger.warn('No session during scores:reset');
        return;
      }

      try {
        // Reset each team's score to zero (preserve team membership)
        this.currentSession.scores.forEach(score => {
          score.currentScore = 0;
          score.transactionCount = 0;
          score.lastUpdated = new Date().toISOString();
        });

        await this.saveCurrentSession();
        this.emit('session:updated', this.currentSession);

        logger.info('Session scores reset to zero', {
          sessionId: this.currentSession.id,
          teamsReset: this.currentSession.scores.map(s => s.teamId)
        });
      } catch (error) {
        logger.error('Failed to reset session scores', { error: error.message });
      }
    }, 'sessionService->transactionService:scores:reset');

    logger.debug('SessionService: score listeners bound to transactionService');
  }

  /**
   * Set up persistence listeners for the new event architecture
   * These listeners handle persistence for transaction:accepted, score:adjusted, and transaction:deleted
   * This is the SINGLE RESPONSIBILITY owner for session persistence
   * Uses listenerRegistry for proper test cleanup
   */
  setupPersistenceListeners() {
    // Lazy import to avoid circular dependency at module load time
    const transactionService = require('./transactionService');

    // Listen for transaction:accepted (single event per transaction, includes teamScore)
    // This replaces the old flow where processScan + caller both modified session
    listenerRegistry.addTrackedListener(transactionService, 'transaction:accepted',
      async (payload) => {
        // Handle both old format (Transaction object) and new format (payload with teamScore)
        // OLD: transaction object directly
        // NEW: { transaction, teamScore, deviceTracking, groupBonus }
        const transaction = payload.transaction || payload;
        const teamScore = payload.teamScore;
        const deviceTracking = payload.deviceTracking;

        if (!this.currentSession) {
          logger.warn('No session during transaction:accepted - cannot persist', {
            transactionId: transaction.id
          });
          return;
        }

        try {
          // Only add transaction if this is new format (callers no longer add directly)
          // The new format includes teamScore, old format doesn't
          if (payload.teamScore !== undefined) {
            // NEW FORMAT: Full event-driven persistence
            // Add transaction to session (idempotent - Session.addTransaction checks for duplicates)
            const txData = transaction.toJSON ? transaction.toJSON() : transaction;
            this.currentSession.addTransaction(txData);

            // Update device tracking for duplicate detection
            if (deviceTracking) {
              this.currentSession.addDeviceScannedToken(deviceTracking.deviceId, deviceTracking.tokenId);
            }

            // Update team score in session.scores (source of truth)
            if (teamScore) {
              this.upsertTeamScore(teamScore);
            }

            await this.saveCurrentSession();
            this.emit('session:updated', this.currentSession);

            logger.debug('Persisted transaction via new event flow', {
              transactionId: transaction.id,
              teamId: transaction.teamId,
              hasTeamScore: !!teamScore
            });
          }
          // OLD FORMAT: transaction object only - callers still handle persistence
          // Don't duplicate the save, just log for debugging
        } catch (error) {
          logger.error('Failed to persist transaction', {
            error: error.message,
            transactionId: transaction.id
          });
        }
      }, 'sessionService->transactionService:transaction:accepted');

    // Listen for score:adjusted (admin-only score changes)
    // This handles adjustTeamScore() and other admin interventions
    listenerRegistry.addTrackedListener(transactionService, 'score:adjusted',
      async (payload) => {
        if (!this.currentSession) {
          logger.warn('No session during score:adjusted');
          return;
        }

        const { teamScore, reason, isAdminAction } = payload;
        if (!teamScore) {
          logger.warn('score:adjusted received without teamScore');
          return;
        }

        try {
          this.upsertTeamScore(teamScore);
          await this.saveCurrentSession();
          this.emit('session:updated', this.currentSession);

          logger.info('Persisted admin score adjustment', {
            teamId: teamScore.teamId,
            reason,
            isAdminAction
          });
        } catch (error) {
          logger.error('Failed to persist score adjustment', {
            error: error.message,
            teamId: teamScore?.teamId
          });
        }
      }, 'sessionService->transactionService:score:adjusted');

    // Listen for transaction:deleted (includes updatedTeamScore)
    // This is moved from stateService to sessionService (single responsibility for persistence)
    listenerRegistry.addTrackedListener(transactionService, 'transaction:deleted',
      async (payload) => {
        if (!this.currentSession) {
          logger.warn('No session during transaction:deleted');
          return;
        }

        const { transactionId, tokenId, teamId, updatedTeamScore } = payload;

        try {
          // Transaction already removed from session by deleteTransaction()
          // Update team score if provided
          if (updatedTeamScore) {
            this.upsertTeamScore(updatedTeamScore);
          }

          await this.saveCurrentSession();
          this.emit('session:updated', this.currentSession);

          logger.info('Persisted transaction deletion', {
            transactionId,
            tokenId,
            teamId,
            hasUpdatedScore: !!updatedTeamScore
          });
        } catch (error) {
          logger.error('Failed to persist transaction deletion', {
            error: error.message,
            transactionId
          });
        }
      }, 'sessionService->transactionService:transaction:deleted');

    logger.debug('SessionService: persistence listeners bound to transactionService');
  }

  /**
   * Upsert a team score in session.scores
   * Updates existing team or adds new team
   * @param {Object} teamScore - TeamScore data (JSON or TeamScore instance)
   * @private
   */
  upsertTeamScore(teamScore) {
    if (!this.currentSession) return;

    const scoreData = teamScore.toJSON ? teamScore.toJSON() : teamScore;
    const idx = this.currentSession.scores.findIndex(s => s.teamId === scoreData.teamId);

    if (idx >= 0) {
      this.currentSession.scores[idx] = scoreData;
    } else {
      this.currentSession.scores.push(scoreData);
    }
  }

  /**
   * Initialize the service
   * @returns {Promise<void>}
   */
  async init() {
    try {
      // Load current session from storage if exists
      // Use 'session:current' key instead of gameState (architectural change)
      const sessionData = await persistenceService.load('session:current');
      if (sessionData) {
        this.currentSession = Session.fromJSON(sessionData);
        logger.info('Session restored from storage', { sessionId: this.currentSession.id });

        // CRITICAL: Sync teams to transactionService on session restoration
        // This ensures transactionService.teamScores Map matches session.scores after restart
        const transactionService = require('./transactionService');
        transactionService.restoreFromSession(this.currentSession);
      }

      // Set up cross-service event listeners for score sync (legacy - will be removed in Slice 6)
      this.setupScoreListeners();

      // Set up new persistence listeners (Slice 2 - single responsibility for persistence)
      this.setupPersistenceListeners();
    } catch (error) {
      logger.error('Failed to initialize session service', error);
    }
  }

  /**
   * Create a new session
   * @param {Object} sessionData - Session creation data
   * @returns {Promise<Session>}
   */
  async createSession(sessionData) {
    try {
      // End current session if exists
      if (this.currentSession && this.currentSession.isActive()) {
        await this.endSession();
      }

      // Create new session
      this.currentSession = new Session({
        name: sessionData.name,
        status: 'active',
        scores: this.initializeTeamScores(sessionData.teams),
      });

      // Save to persistence (both specific ID and 'current' reference)
      const sessionJSON = this.currentSession.toJSON();
      await persistenceService.saveSession(sessionJSON);
      await persistenceService.save('session:current', sessionJSON);

      // Start session timeout timer
      this.startSessionTimeout();

      // Emit domain event for internal coordination
      // broadcasts.js will wrap this for WebSocket broadcast
      this.emit('session:created', {
        id: this.currentSession.id,
        name: this.currentSession.name,
        startTime: this.currentSession.startTime,
        endTime: this.currentSession.endTime,
        status: 'active',
        teams: this.currentSession.scores ? this.currentSession.scores.map(s => s.teamId) : [],
        metadata: this.currentSession.metadata || {}
      });

      logger.info('Session created', {
        sessionId: this.currentSession.id,
        name: this.currentSession.name,
      });

      return this.currentSession;
    } catch (error) {
      logger.error('Failed to create session', error);
      throw error;
    }
  }

  /**
   * Get current session
   * @returns {Session|null}
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Session|null>}
   */
  async getSession(sessionId) {
    if (this.currentSession && this.currentSession.id === sessionId) {
      return this.currentSession;
    }

    const sessionData = await persistenceService.loadSession(sessionId);
    if (sessionData) {
      return Session.fromJSON(sessionData);
    }

    return null;
  }

  /**
   * Update current session
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Session>}
   */
  async updateSession(updates) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    try {
      // Apply updates
      if (updates.name !== undefined) {
        this.currentSession.name = updates.name;
      }

      if (updates.status !== undefined) {
        this.updateSessionStatus(updates.status);
      }

      if (updates.scores !== undefined) {
        this.currentSession.scores = updates.scores;
      }

      if (updates.transactions !== undefined) {
        this.currentSession.transactions = updates.transactions;
      }

      // Save to persistence (both specific ID and 'current' reference)
      const sessionData = this.currentSession.toJSON();
      await persistenceService.saveSession(sessionData);
      await persistenceService.save('session:current', sessionData);

      // Emit event
      this.emit('session:updated', this.currentSession);

      return this.currentSession;
    } catch (error) {
      logger.error('Failed to update session', error);
      throw error;
    }
  }

  /**
   * Update session status
   * @param {string} status - New status
   * @private
   */
  updateSessionStatus(status) {
    const oldStatus = this.currentSession.status;

    // If already in the target status, return early
    if (oldStatus === status) {
      logger.debug('Session already in target status', {
        sessionId: this.currentSession.id,
        status,
      });
      return;
    }

    switch (status) {
      case 'active':
        this.currentSession.start();
        this.startSessionTimeout();
        break;
      case 'paused':
        this.currentSession.pause();
        this.stopSessionTimeout();
        break;
      default:
        throw new Error(`Invalid session status: ${status}`);
    }

    logger.info('Session status changed', {
      sessionId: this.currentSession.id,
      oldStatus,
      newStatus: status,
    });
  }

  /**
   * End current session
   * @returns {Promise<void>}
   */
  async endSession() {
    // Capture session reference to avoid race conditions
    const session = this.currentSession;
    if (!session) {
      return;
    }

    try {
      // Complete the session
      if (session.isActive() || session.isPaused()) {
        session.complete();
      }

      // Save final state (both specific ID and 'current' reference)
      const sessionData = session.toJSON();
      await persistenceService.saveSession(sessionData);
      await persistenceService.save('session:current', sessionData);

      // Create backup
      await persistenceService.backupSession(session.toJSON());

      // Stop timeout timer
      this.stopSessionTimeout();

      // Emit domain event for internal coordination
      // broadcasts.js will wrap this for WebSocket broadcast
      this.emit('session:updated', {
        id: session.id,
        name: session.name,
        startTime: session.startTime,
        endTime: session.endTime || new Date().toISOString(),
        status: session.status,
        teams: session.scores ? session.scores.map(s => s.teamId) : [],
        metadata: session.metadata || {}
      });

      logger.info('Session ended', { sessionId: session.id });

      // Clear current session only if it's still the same session
      if (this.currentSession === session) {
        this.currentSession = null;
      }
    } catch (error) {
      logger.error('Failed to end session', error);
      throw error;
    }
  }

  /**
   * Archive old sessions
   * @returns {Promise<number>} Number of sessions archived
   */
  async archiveOldSessions() {
    try {
      const sessions = await persistenceService.getAllSessions();
      const archiveAfterMs = config.storage.archiveAfter * 60 * 60 * 1000;
      const now = Date.now();
      let archived = 0;

      for (const sessionData of sessions) {
        const session = Session.fromJSON(sessionData);
        if (session.isCompleted() && session.endTime) {
          const endTime = new Date(session.endTime).getTime();
          if (now - endTime > archiveAfterMs) {
            await persistenceService.archiveSession(session.toJSON());
            archived++;
          }
        }
      }

      if (archived > 0) {
        logger.info('Sessions archived', { count: archived });
      }

      return archived;
    } catch (error) {
      logger.error('Failed to archive old sessions', error);
      throw error;
    }
  }

  /**
   * Get all sessions
   * @returns {Promise<Array<Session>>}
   */
  async getAllSessions() {
    const sessionData = await persistenceService.getAllSessions();
    return sessionData.map(data => Session.fromJSON(data));
  }

  /**
   * Get active sessions
   * @returns {Promise<Array<Session>>}
   */
  async getActiveSessions() {
    const sessions = await this.getAllSessions();
    return sessions.filter(s => s.isActive());
  }

  /**
   * Initialize team scores
   * @param {Array<string>} teams - Team IDs (can be empty)
   * @returns {Array} Team scores
   * @private
   */
  initializeTeamScores(teams = []) {
    if (!teams || teams.length === 0) {
      return []; // Return empty array if no teams provided
    }
    const TeamScore = require('../models/teamScore');
    return teams.map(teamId => TeamScore.createInitial(teamId).toJSON());
  }

  /**
   * Add a new team to the current session mid-game
   * Single source of truth for team creation - all teams MUST be created through this method
   * @param {string} teamId - The team identifier (alphanumeric, 1-30 chars)
   * @returns {Promise<Object>} The created TeamScore object
   */
  async addTeamToSession(teamId) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    // Trim and normalize team ID
    const normalizedTeamId = teamId.trim();

    // Check for duplicate team
    const existingTeam = this.currentSession.scores.find(s => s.teamId === normalizedTeamId);
    if (existingTeam) {
      throw new Error(`Team "${teamId}" already exists in session`);
    }

    // Create new team score using the TeamScore model
    const TeamScore = require('../models/teamScore');
    const newTeamScore = TeamScore.createInitial(normalizedTeamId);

    // Add to session (source of truth)
    this.currentSession.scores.push(newTeamScore.toJSON());

    // CRITICAL: Sync to transactionService immediately
    // This ensures transactionService.teamScores Map stays in sync with session.scores
    // Single path for team creation - sessionService owns it, transactionService syncs from it
    const transactionService = require('./transactionService');
    transactionService.syncTeamFromSession(newTeamScore);

    // Persist and broadcast
    await this.saveCurrentSession();
    this.emit('session:updated', this.getCurrentSession());

    logger.info('Team added to session', {
      teamId: normalizedTeamId,
      sessionId: this.currentSession.id
    });

    return newTeamScore;
  }

  /**
   * Start session timeout timer
   * Emits a warning when session exceeds expected duration (does NOT auto-end)
   * @private
   */
  startSessionTimeout() {
    this.stopSessionTimeout();

    const timeoutMs = config.session.sessionTimeout * 60 * 1000;
    this.sessionTimeoutTimer = setTimeout(() => {
      logger.warn('Session overtime - exceeded expected duration', {
        sessionId: this.currentSession?.id,
        expectedDuration: config.session.sessionTimeout,
        startTime: this.currentSession?.startTime
      });

      // Emit warning event for GM notification (does NOT end session)
      this.emit('session:overtime', {
        sessionId: this.currentSession?.id,
        sessionName: this.currentSession?.name,
        startTime: this.currentSession?.startTime,
        expectedDuration: config.session.sessionTimeout,
        overtimeDuration: 0 // Will be calculated by listener
      });
    }, timeoutMs);
  }

  /**
   * Stop session timeout timer
   * @private
   */
  stopSessionTimeout() {
    if (this.sessionTimeoutTimer) {
      clearTimeout(this.sessionTimeoutTimer);
      this.sessionTimeoutTimer = null;
    }
  }

  /**
   * Add transaction to current session
   * @param {Object} transaction - Transaction to add
   * @returns {Promise<Object>} The added transaction
   */
  async addTransaction(transaction) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentSession.addTransaction(transaction);
    await this.saveCurrentSession();
    this.emit('transaction:added', transaction);
    return transaction;
  }

  /**
   * Update device in current session
   * @param {Object} device - Device to update
   * @returns {Promise<void>}
   */
  async updateDevice(device) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const { isNew, isReconnection } = this.currentSession.updateDevice(device);
    await this.saveCurrentSession();
    this.emit('device:updated', { device, isNew, isReconnection });
  }

  /**
   * Remove device from current session
   * @param {string} deviceId - Device ID to remove
   * @returns {Promise<void>}
   */
  async removeDevice(deviceId) {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.removeDevice(deviceId);
    await this.saveCurrentSession();
    this.emit('device:removed', deviceId);
  }

  /**
   * Save current session to persistence
   * @returns {Promise<void>}
   * @private
   */
  async saveCurrentSession() {
    if (this.currentSession) {
      const sessionData = this.currentSession.toJSON();
      await persistenceService.saveSession(sessionData);
      await persistenceService.save('session:current', sessionData);
    }
  }

  /**
   * Check if can accept more GM stations
   * @returns {boolean}
   */
  canAcceptGmStation() {
    // If no session exists, allow GM to connect
    // They'll create one properly via the Admin tab
    if (!this.currentSession) {
      return true; // Changed from auto-creating session
    }

    // If session exists, check capacity
    return this.currentSession.canAcceptGmStation(config.session.maxGmStations);
  }

  /**
   * Reset service state (for testing)
   * @returns {Promise<void>}
   */
  async reset() {
    // Stop timers FIRST
    this.stopSessionTimeout();

    // Remove all listeners registered ON this service (observers)
    // This clears the observer list for this EventEmitter subject
    // Infrastructure listeners will be re-registered by setupBroadcastListeners()
    this.removeAllListeners();

    // Reinitialize state
    this.initState();

    // Clear persistence
    await persistenceService.delete('session:current');
    await persistenceService.delete('gameState:current');

    // Re-setup cross-service listeners (listenerRegistry handles cleanup via cleanup())
    this.setupScoreListeners();
    this.setupPersistenceListeners();

    logger.info('Session service reset');
  }
}

// Export singleton instance
module.exports = new SessionService();
