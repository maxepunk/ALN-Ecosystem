/**
 * Session Service
 * Manages game sessions and session lifecycle
 */

const EventEmitter = require('events');
const Session = require('../models/session');
const persistenceService = require('./persistenceService');
const gameClockService = require('./gameClockService');
const config = require('../config');
const logger = require('../utils/logger');
const listenerRegistry = require('../websocket/listenerRegistry');
// Phase 2 split: persistence-listener bodies and session-content mutations
const persistenceListeners = require('./session/persistenceListeners');
const sessionRegistry = require('./session/sessionRegistry');

class SessionService extends EventEmitter {
  constructor() {
    super();
    this.initState();
  }

  initState() {
    this.currentSession = null;
    // F-BCORE-07: promise-chain write queue — session persistence writes
    // must land in call order (node-persist setItem is not atomic; two
    // overlapping saves could leave the OLDER snapshot on disk)
    this._writeQueue = Promise.resolve();
  }

  /**
   * Set up listeners for score events from transactionService.
   * Listener bodies live in session/persistenceListeners.js (Phase 2 split);
   * this facade method is the re-wiring entry point used by systemReset.js
   * and service-reset.js.
   */
  setupScoreListeners() {
    persistenceListeners.setupScoreListeners(this);
  }

  /**
   * Set up persistence listeners (transaction:accepted, score:adjusted,
   * transaction:deleted) — the SINGLE RESPONSIBILITY owner for session
   * persistence. Bodies live in session/persistenceListeners.js.
   */
  setupPersistenceListeners() {
    persistenceListeners.setupPersistenceListeners(this);
  }

  /**
   * Set up listeners for game clock events
   * Uses listenerRegistry for proper test cleanup
   */
  setupGameClockListeners() {
    // Listen for gameclock:overtime to emit session overtime warning
    listenerRegistry.addTrackedListener(gameClockService, 'gameclock:overtime', (payload) => {
      if (!this.currentSession) {
        logger.warn('No session during gameclock:overtime');
        return;
      }

      logger.warn('Session overtime - exceeded expected duration', {
        sessionId: this.currentSession.id,
        expectedDuration: config.session.sessionTimeout,
        startTime: this.currentSession.startTime,
        elapsed: payload.elapsed
      });

      // Emit warning event for GM notification (does NOT end session)
      this.emit('session:overtime', {
        sessionId: this.currentSession.id,
        sessionName: this.currentSession.name,
        startTime: this.currentSession.startTime,
        expectedDuration: config.session.sessionTimeout,
        overtimeDuration: 0 // Will be calculated by listener
      });
    }, 'sessionService->gameClockService:gameclock:overtime');
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

        // Mark all devices as disconnected — WebSocket connections don't survive restarts
        if (this.currentSession.connectedDevices) {
          const stale = this.currentSession.connectedDevices
            .filter(d => d.connectionStatus === 'connected');
          if (stale.length > 0) {
            for (const device of stale) {
              device.connectionStatus = 'disconnected';
            }
            logger.info('Cleared stale device connections after restart', {
              deviceCount: stale.length
            });
          }
        }

        // Scores need no restore step: Session.fromJSON hydrated session.scores
        // into live TeamScore instances — the single canonical store that
        // transactionService reads and mutates directly.

        // Restore game clock from session data (if session was active/paused)
        if (this.currentSession.gameClock && this.currentSession.status !== 'ended') {
          gameClockService.restore(this.currentSession.gameClock);
          logger.info('Game clock restored from session', {
            sessionId: this.currentSession.id,
            clockStatus: gameClockService.status
          });
        }

        // Restore cue engine runtime state (F-SHOW-01/03, decision E1).
        // restore() marks past clock cues as fired WITHOUT firing them;
        // an active session re-activates standing cue evaluation.
        if (this.currentSession.cueEngine && this.currentSession.status !== 'ended') {
          const cueEngineService = require('./cueEngineService');
          cueEngineService.restore(this.currentSession.cueEngine, gameClockService.getElapsed());
          if (this.currentSession.status === 'active') {
            cueEngineService.activate();
          }
          logger.info('Cue engine restored from session', {
            sessionId: this.currentSession.id,
            cueEngineActive: cueEngineService.active
          });
        }
      }

      // Set up the scores:reset listener (full-restart semantics, decision A3)
      this.setupScoreListeners();

      // Set up new persistence listeners (Slice 2 - single responsibility for persistence)
      this.setupPersistenceListeners();

      // Set up game clock listeners for overtime detection
      this.setupGameClockListeners();
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
      // End current session if exists — regardless of status (F-BCORE-05:
      // the old isActive() guard silently orphaned paused/setup sessions:
      // never complete()d, never backed up, persisted forever as
      // paused/setup). endSession() handles setup/active/paused itself.
      if (this.currentSession) {
        await this.endSession();
      }

      // Create new session in setup state (transitions to active via startGame)
      this.currentSession = new Session({
        name: sessionData.name,
        status: 'setup',
        scores: this.initializeTeamScores(sessionData.teams),
      });

      // Save to persistence (both specific ID and 'current' reference),
      // serialized through the write queue (F-BCORE-07) behind any pending
      // writes from the just-ended previous session
      const sessionJSON = this.currentSession.toJSON();
      await this._enqueueWrite(async () => {
        await persistenceService.saveSession(sessionJSON);
        await persistenceService.save('session:current', sessionJSON);
      });

      // NOTE: Session timeout and game clock are NOT started until startGame()

      // Emit domain event for internal coordination
      // broadcasts.js will wrap this for WebSocket broadcast
      this.emit('session:created', {
        id: this.currentSession.id,
        name: this.currentSession.name,
        startTime: this.currentSession.startTime,
        endTime: this.currentSession.endTime,
        status: 'setup',
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
   * Start the game — transitions session from setup to active
   * Starts the game clock and session timeout
   * @returns {Promise<Session>}
   */
  async startGame() {
    if (!this.currentSession) {
      throw new Error('No session to start');
    }

    if (this.currentSession.status !== 'setup') {
      throw new Error(`Cannot start game: session is in "${this.currentSession.status}" state (expected "setup")`);
    }

    // Transition session to active
    this.currentSession.start();

    // Record game start time on the session
    this.currentSession.gameStartTime = new Date().toISOString();

    // Set overtime threshold before starting the clock
    const overtimeThresholdSeconds = config.session.sessionTimeout * 60; // Convert minutes to seconds
    gameClockService.setOvertimeThreshold(overtimeThresholdSeconds);

    // Start the game clock
    gameClockService.start();

    // Activate cue engine for standing cue evaluation
    const cueEngineService = require('./cueEngineService');
    cueEngineService.activate();

    // Persist game clock state on session
    this.currentSession.gameClock = gameClockService.toPersistence();

    // Save to persistence
    await this.saveCurrentSession();

    // Emit session:started event for broadcasts
    this.emit('session:started', {
      id: this.currentSession.id,
      name: this.currentSession.name,
      status: 'active',
      gameStartTime: this.currentSession.gameStartTime,
      gameClock: gameClockService.getState()
    });

    // Also emit session:updated for general listeners
    this.emit('session:updated', this.currentSession);

    logger.info('Game started', {
      sessionId: this.currentSession.id,
      name: this.currentSession.name,
      gameStartTime: this.currentSession.gameStartTime
    });

    return this.currentSession;
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
        // Hydrate into live TeamScore instances (session.scores is the
        // canonical store and must hold instances, not plain JSON)
        const TeamScore = require('../models/teamScore');
        this.currentSession.scores = updates.scores.map(s =>
          s instanceof TeamScore ? s : TeamScore.fromJSON(s)
        );
      }

      if (updates.transactions !== undefined) {
        this.currentSession.transactions = updates.transactions;
      }

      // Save to persistence via the write queue (F-BCORE-07) — snapshots the
      // live session at write time like every other queued save
      await this.saveCurrentSession();

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
   * Cascades pause/resume to game clock, cue engine, and music.
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

    // Lazy-require to avoid circular dependency at module load time
    const cueEngineService = require('./cueEngineService');
    const musicService = require('./musicService');

    switch (status) {
      case 'paused':
        this.currentSession.pause();
        gameClockService.pause();
        cueEngineService.suspend();
        musicService.pauseForGameClock().catch(err =>
          logger.warn('Failed to pause music during session pause', { error: err.message })
        );
        this.currentSession.gameClock = gameClockService.toPersistence();
        break;
      case 'active':
        // F-BCORE-06: resuming from setup would activate the session without
        // startGame()'s cascade (game clock, cue engine, overtime threshold,
        // gameStartTime) yet start accepting transactions. Mirror startGame()'s
        // state guard: setup → active is ONLY valid via startGame().
        if (oldStatus === 'setup') {
          throw new Error('Cannot resume: session is in "setup" state — use session:start to begin the game');
        }
        this.currentSession.start();
        if (oldStatus === 'paused') {
          gameClockService.resume();
          cueEngineService.activate();
          musicService.resumeFromGameClock().catch(err =>
            logger.warn('Failed to resume music during session resume', { error: err.message })
          );
        }
        this.currentSession.gameClock = gameClockService.toPersistence();
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
      if (session.status === 'setup' || session.isActive() || session.isPaused()) {
        session.complete();
      }

      // Stop the game clock
      gameClockService.stop();

      // Suspend the cue engine (F-SHOW-13, decision E4): event-triggered
      // standing cues must not keep firing during post-game cleanup. The GM
      // can re-enable via cue engine controls if needed.
      require('./cueEngineService').suspend();

      // Save final state (both specific ID and 'current' reference) through
      // the write queue (F-BCORE-07): the snapshot is captured NOW — before
      // currentSession is nulled below — and lands AFTER any in-flight queued
      // writes, so an older snapshot can never overwrite the ended status
      // (which would resurrect the session as active on restart). The backup
      // rides the same queued task so it is ordered after the final write.
      const sessionData = session.toJSON();
      await this._enqueueWrite(async () => {
        await persistenceService.saveSession(sessionData);
        await persistenceService.save('session:current', sessionData);
        await persistenceService.backupSession(sessionData);
      });

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
    // Live instances — session.scores is the canonical store
    return teams.map(teamId => TeamScore.createInitial(teamId));
  }

  // ── Session content registry ─────────────────────────────────────────
  // Team / device / scan mutations live in session/sessionRegistry.js
  // (Phase 2 split) — these facade methods delegate.

  /**
   * Add a new team to the current session mid-game (single source of truth
   * for team creation — any non-empty string is a valid team name).
   * @param {string} teamId - The team identifier
   * @returns {Promise<Object>} The created TeamScore instance
   */
  addTeamToSession(teamId) {
    return sessionRegistry.addTeamToSession(this, teamId);
  }

  /**
   * Add transaction to current session
   * @param {Object} transaction - Transaction to add
   * @returns {Promise<Object>} The added transaction
   */
  addTransaction(transaction) {
    return sessionRegistry.addTransaction(this, transaction);
  }

  /**
   * Add a player scan to current session (token discoveries, no scoring)
   * @param {Object} scanData - Player scan data
   * @returns {Promise<Object>} The created player scan record
   */
  addPlayerScan(scanData) {
    return sessionRegistry.addPlayerScan(this, scanData);
  }

  /**
   * Update device in current session
   * @param {Object} device - Device to update
   * @returns {Promise<void>}
   */
  updateDevice(device) {
    return sessionRegistry.updateDevice(this, device);
  }

  /**
   * Remove device from current session
   * @param {string} deviceId - Device ID to remove
   * @returns {Promise<void>}
   */
  removeDevice(deviceId) {
    return sessionRegistry.removeDevice(this, deviceId);
  }

  /**
   * Save current session to persistence
   * Serialized through a promise-chain write queue (F-BCORE-07): concurrent
   * callers' writes land in call order, and each write snapshots the LIVE
   * session at write time (latest state wins, never an older snapshot).
   * @returns {Promise<void>}
   * @private
   */
  saveCurrentSession() {
    return this._enqueueWrite(() => this._persistCurrentSession());
  }

  /**
   * Serialize a persistence write through the queue (F-BCORE-07). ALL
   * session persistence must flow through here — a direct write racing a
   * queued one can land an older snapshot last (e.g., an in-flight
   * transaction persist overwriting an ended-status write, resurrecting an
   * ended session on restart).
   * @param {Function} writeFn async function performing the write
   * @returns {Promise<void>}
   * @private
   */
  _enqueueWrite(writeFn) {
    const task = this._writeQueue.then(writeFn);
    // Keep the chain alive even if a write fails (the caller still sees the
    // rejection via the returned task)
    this._writeQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  /**
   * Perform the actual persistence write (only ever invoked via the queue)
   * @returns {Promise<void>}
   * @private
   */
  async _persistCurrentSession() {
    if (this.currentSession) {
      // Persist game clock state on session
      if (gameClockService.status !== 'stopped') {
        this.currentSession.gameClock = gameClockService.toPersistence();
      }
      // Persist cue engine runtime state beside gameClock (F-SHOW-01/03)
      // Lazy require: circular dependency (cueEngineService → commandExecutor → sessionService)
      this.currentSession.cueEngine = require('./cueEngineService').toPersistence();
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
    // Stop game clock
    gameClockService.reset();

    // Remove all listeners registered ON this service (observers)
    // This clears the observer list for this EventEmitter subject
    // Infrastructure listeners will be re-registered by setupBroadcastListeners()
    this.removeAllListeners();

    // Reinitialize state
    this.initState();

    // Clear persistence
    await persistenceService.delete('session:current');
    await persistenceService.delete('gameState:current');

    // Cross-service listeners (setupScoreListeners, setupPersistenceListeners,
    // setupGameClockListeners) are NOT registered here. They are registered
    // centrally in systemReset.js and service-reset.js AFTER all services
    // have been reset — preventing the ordering bug where
    // transactionService.reset() would destroy listeners registered here.

    logger.info('Session service reset');
  }
}

// Export singleton instance
module.exports = new SessionService();
