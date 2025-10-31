/**
 * Session Service
 * Manages game sessions and session lifecycle
 */

const EventEmitter = require('events');
const Session = require('../models/session');
const persistenceService = require('./persistenceService');
const config = require('../config');
const logger = require('../utils/logger');

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
      }
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
      case 'completed':
        this.currentSession.complete();
        this.stopSessionTimeout();
        break;
      case 'archived':
        this.currentSession.archive();
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
   * Start session timeout timer
   * @private
   */
  startSessionTimeout() {
    this.stopSessionTimeout();

    const timeoutMs = config.session.sessionTimeout * 60 * 1000;
    this.sessionTimeoutTimer = setTimeout(async () => {
      logger.warn('Session timeout reached', { sessionId: this.currentSession?.id });
      await this.endSession();
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

    const isNew = this.currentSession.updateDevice(device);
    await this.saveCurrentSession();
    this.emit('device:updated', { device, isNew });
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

    logger.info('Session service reset');
  }
}

// Export singleton instance
module.exports = new SessionService();
