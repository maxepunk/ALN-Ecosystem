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
    this.initState();  // ADD THIS
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
      const savedState = await persistenceService.loadGameState();
      if (savedState && savedState.sessionId) {
        const sessionData = await persistenceService.loadSession(savedState.sessionId);
        if (sessionData) {
          this.currentSession = Session.fromJSON(sessionData);
          logger.info('Session restored from storage', { sessionId: this.currentSession.id });
        }
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

      // Save to persistence
      await persistenceService.saveSession(this.currentSession.toJSON());

      // Start session timeout timer
      this.startSessionTimeout();

      // Emit event
      this.emit('session:created', this.currentSession);

      logger.info('Session created', { 
        sessionId: this.currentSession.id,
        name: this.currentSession.name 
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

      // Save to persistence
      await persistenceService.saveSession(this.currentSession.toJSON());

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

      // Save final state
      await persistenceService.saveSession(session.toJSON());

      // Create backup
      await persistenceService.backupSession(session.toJSON());

      // Stop timeout timer
      this.stopSessionTimeout();

      // Emit event
      this.emit('session:ended', session);

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
   * @param {Array<string>} teams - Team IDs
   * @returns {Array} Team scores
   * @private
   */
  initializeTeamScores(teams = ['TEAM_A', 'TEAM_B']) {
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

    this.currentSession.updateDevice(device);
    await this.saveCurrentSession();
    this.emit('device:updated', device);
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
      await persistenceService.saveSession(this.currentSession.toJSON());
    }
  }

  /**
   * Check if can accept more players
   * @returns {boolean}
   */
  canAcceptPlayer() {
    if (!this.currentSession) {
      return false;
    }
    return this.currentSession.canAcceptPlayer(config.session.maxPlayers);
  }

  /**
   * Check if can accept more GM stations
   * @returns {boolean}
   */
  canAcceptGmStation() {
    if (!this.currentSession) {
      // If no session exists, create one to accept the GM station
      this.createSession({
        name: `Session_${Date.now()}`,
        maxPlayers: config.session.maxPlayers,
        maxGmStations: config.session.maxGmStations
      });
    }
    return this.currentSession.canAcceptGmStation(config.session.maxGmStations);
  }

  /**
   * Reset service state (for testing)
   * @returns {Promise<void>}
   */
  async reset() {
    // Stop timers FIRST
    this.stopSessionTimeout();

    // Remove listeners BEFORE reinit
    this.removeAllListeners();

    // Reinitialize state
    this.initState();

    // Clear persistence if in test mode
    if (process.env.NODE_ENV === 'test') {
      await persistenceService.delete('session:current');
      await persistenceService.delete('gameState:current');
    }

    logger.info('Session service reset');
  }
}

// Export singleton instance
module.exports = new SessionService();

// Add test helper at end of file
module.exports.resetForTests = () => module.exports.reset();