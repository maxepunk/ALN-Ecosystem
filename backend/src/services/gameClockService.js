/**
 * Game Clock Service
 * Master time authority - single setInterval(1000) tick source
 * Emits gameclock:tick internally for cue engine and overtime detection
 */

'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');
const registry = require('./serviceHealthRegistry');

class GameClockService extends EventEmitter {
  constructor() {
    super();
    this._reset();
    registry.report('gameclock', 'healthy', 'In-process timer');
  }

  _reset() {
    this.gameStartTime = null;
    this.pauseStartTime = null;
    this.totalPausedMs = 0;
    this.interval = null;
    this.status = 'stopped'; // stopped | running | paused
    this.overtimeThreshold = null;
    this.overtimeFired = false;
    this.phases = null; // declared pack phase table (>= 2 entries) or null (inert)
    this.currentPhaseIndex = -1; // index into this.phases; -1 = no phase
    this._phaseTriggerFired = new Set(); // ids of trigger-started phases whose event was observed
  }

  start() {
    if (this.status === 'running') {
      throw new Error('Game clock is already running');
    }
    if (this.status === 'paused') {
      throw new Error('Game clock is paused — call resume() instead of start()');
    }
    this.gameStartTime = Date.now();
    this.totalPausedMs = 0;
    this.pauseStartTime = null;
    this.status = 'running';
    // Seed the initial phase SILENTLY (R-5-1: entering the state the game
    // starts in is not a transition — no phase:changed; possibly none when
    // no start is satisfied at elapsed 0)
    this._phaseTriggerFired.clear();
    this.currentPhaseIndex = this._latestSatisfiedIndex(0);
    this._startInterval();
    this.emit('gameclock:started', { gameStartTime: this.gameStartTime });
    logger.info('[GameClock] Started');
  }

  pause() {
    if (this.status !== 'running') return;
    this.pauseStartTime = Date.now();
    this._stopInterval();
    this.status = 'paused';
    const elapsed = this.getElapsed();
    this.emit('gameclock:paused', { elapsed });
    logger.info(`[GameClock] Paused at ${elapsed}s`);
  }

  resume() {
    if (this.status !== 'paused') return;
    this.totalPausedMs += Date.now() - this.pauseStartTime;
    this.pauseStartTime = null;
    this.status = 'running';
    this._startInterval();
    const elapsed = this.getElapsed();
    this.emit('gameclock:resumed', { elapsed });
    logger.info(`[GameClock] Resumed at ${elapsed}s`);
  }

  stop() {
    this._stopInterval();
    // Capture elapsed BEFORE flipping status (getElapsed reads pauseStartTime
    // while paused; after 'stopped' it counts wall-clock again)
    const elapsed = this.getElapsed();
    this.status = 'stopped';
    // A3 slice 5 (review A): clear phase state BEFORE the stopped push —
    // otherwise the ended game's phase rides this push and every sync:full
    // through the NEXT session's whole setup period (the contract says
    // phase is null when the clock has not started)
    this.currentPhaseIndex = -1;
    this._phaseTriggerFired.clear();
    // F-SHOW-13: without an event, no gameclock service:state push happens at
    // session end and the GM panel keeps showing a running clock
    this.emit('gameclock:stopped', { elapsed });
    logger.info('[GameClock] Stopped');
  }

  getElapsed() {
    if (!this.gameStartTime) return 0;
    const now = this.status === 'paused' ? this.pauseStartTime : Date.now();
    return Math.floor((now - this.gameStartTime - this.totalPausedMs) / 1000);
  }

  getState() {
    return {
      status: this.status,
      elapsed: this.getElapsed(),
      startTime: this.gameStartTime,
      totalPausedMs: this.totalPausedMs,
      phase: this.getCurrentPhase()
    };
  }

  /**
   * Set the pack-declared phase table (A3 slice 5 / B11).
   * Injected by sessionService from packService.getClockRules().phases, beside
   * setOvertimeThreshold. INERT RULE (R-5-1): null or fewer than 2 declared
   * phases means "no phase structure" (B11's degenerate case) — the current
   * phase stays null and phase:changed never fires, keeping ALN byte-identical.
   * @param {Array<{id: string, label: string, start: Object}>|null} phases
   */
  setPhases(phases) {
    if (!Array.isArray(phases) || phases.length < 2) {
      this.phases = null;
    } else {
      this.phases = phases.map(p => ({
        id: p.id,
        label: p.label,
        start: { ...(p.start || {}) }
      }));
    }
    this.currentPhaseIndex = -1;
    this._phaseTriggerFired.clear();
  }

  /** @returns {{id: string, label: string}|null} current phase, null when none */
  getCurrentPhase() {
    if (!this.phases || this.currentPhaseIndex < 0) return null;
    const p = this.phases[this.currentPhaseIndex];
    return { id: p.id, label: p.label };
  }

  /**
   * Observe a game/engine event as a potential phase-start trigger (wired via
   * cueEngineWiring's dispatcher). Gated on a RUNNING clock (R-5-1: a paused
   * game does not advance phases; events while stopped/paused are ignored).
   * @param {string} eventName
   */
  handlePhaseTrigger(eventName) {
    if (!this.phases || this.status !== 'running') return;
    let observed = false;
    for (const p of this.phases) {
      if (p.start.trigger === eventName && !this._phaseTriggerFired.has(p.id)) {
        this._phaseTriggerFired.add(p.id);
        observed = true;
      }
    }
    if (observed) this._recomputePhase('trigger');
  }

  /**
   * Latest phase (by DECLARED ORDER) whose start is satisfied: a time start
   * when elapsed >= at; a trigger start when its event has been observed this
   * run. -1 when nothing is satisfied. Uniform rule for live advance AND
   * restore (R-5-1 "latest satisfied start").
   */
  _latestSatisfiedIndex(elapsed, { timeOnly = false } = {}) {
    if (!this.phases) return -1;
    let latest = -1;
    for (let i = 0; i < this.phases.length; i++) {
      const s = this.phases[i].start;
      const satisfied = typeof s.at === 'number'
        ? elapsed >= s.at
        : (!timeOnly && this._phaseTriggerFired.has(this.phases[i].id));
      if (satisfied) latest = i;
    }
    return latest;
  }

  /**
   * Re-derive the current phase; emit phase:changed on a change. One emission
   * per LANDING — a start that lands past not-yet-entered intermediate phases
   * skips them silently (declared-order skip-forward, same rule restore uses).
   */
  _recomputePhase(via) {
    if (!this.phases) return;
    const elapsed = this.getElapsed();
    const latest = this._latestSatisfiedIndex(elapsed);
    if (latest <= this.currentPhaseIndex) return;
    const prev = this.currentPhaseIndex >= 0 ? this.phases[this.currentPhaseIndex] : null;
    this.currentPhaseIndex = latest;
    const p = this.phases[latest];
    this.emit('phase:changed', {
      phaseId: p.id,
      label: p.label,
      previousPhaseId: prev ? prev.id : null,
      elapsed,
      via
    });
    logger.info(`[GameClock] Phase changed: ${prev ? prev.id : '(none)'} -> ${p.id} at ${elapsed}s (${via})`);
  }

  /**
   * Set overtime threshold in seconds.
   * When elapsed time exceeds this threshold, gameclock:overtime event is emitted once.
   * @param {number} seconds - Threshold in seconds
   */
  setOvertimeThreshold(seconds) {
    if (typeof seconds !== 'number' || seconds <= 0) {
      throw new Error(`Invalid overtime threshold: ${seconds} (must be positive number)`);
    }
    this.overtimeThreshold = seconds;
    this.overtimeFired = false;
  }

  /** Restore clock state from persisted session data (backend restart recovery). */
  restore(clockData) {
    if (!clockData || !clockData.startTime) return;
    this.gameStartTime = clockData.startTime;
    this.totalPausedMs = clockData.totalPausedMs || 0;

    if (clockData.pausedAt) {
      this.pauseStartTime = clockData.pausedAt;
      this.status = 'paused';
    } else {
      this.pauseStartTime = null;
      this.status = 'running';
      this._startInterval();
    }

    // Re-arm overtime detection (F-SHOW-01: threshold was lost across restarts).
    // Mark-don't-fire (E1): if the threshold already passed before the restart,
    // mark it fired so the warning is not re-emitted after restore.
    if (typeof clockData.overtimeThreshold === 'number' && clockData.overtimeThreshold > 0) {
      this.overtimeThreshold = clockData.overtimeThreshold;
      this.overtimeFired = this.getElapsed() >= clockData.overtimeThreshold;
    }

    // Phase restore (A3 slice 5, E1 mark-don't-fire): re-seat the persisted
    // phase, then advance through any TIME starts the downtime crossed —
    // WITHOUT emitting phase:changed for the skipped boundaries. Triggers
    // that fired during downtime are lost by definition (events during
    // downtime don't exist — matches cue-restore semantics). Requires
    // setPhases() to have been injected BEFORE restore() (sessionService
    // does both in init()).
    if (this.phases) {
      let persistedIdx = -1;
      if (clockData.phaseId) {
        persistedIdx = this.phases.findIndex(p => p.id === clockData.phaseId);
        if (persistedIdx === -1) {
          logger.warn(
            `[GameClock] Persisted phaseId '${clockData.phaseId}' not in the active pack's phase table — recomputing from time starts`
          );
        }
      }
      const timeIdx = this._latestSatisfiedIndex(this.getElapsed(), { timeOnly: true });
      this.currentPhaseIndex = Math.max(persistedIdx, timeIdx);
    }

    logger.info(`[GameClock] Restored: status=${this.status}, elapsed=${this.getElapsed()}s`);
  }

  /** Returns data suitable for session model persistence. */
  toPersistence() {
    const current = this.getCurrentPhase();
    return {
      startTime: this.gameStartTime,
      pausedAt: this.pauseStartTime,
      totalPausedMs: this.totalPausedMs,
      overtimeThreshold: this.overtimeThreshold,
      phaseId: current ? current.id : null
    };
  }

  reset() {
    this._stopInterval();
    this._reset();
    registry.report('gameclock', 'healthy', 'Timer stopped');
  }

  cleanup() {
    this.reset();
    this.removeAllListeners();
  }

  _startInterval() {
    this._stopInterval();
    this.interval = setInterval(() => this._tick(), 1000);
  }

  _stopInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  _tick() {
    const elapsed = this.getElapsed();
    this.emit('gameclock:tick', { elapsed });

    // Check for overtime
    if (this.overtimeThreshold !== null && !this.overtimeFired && elapsed >= this.overtimeThreshold) {
      this.overtimeFired = true;
      this.emit('gameclock:overtime', { elapsed });
      logger.warn(`[GameClock] Overtime threshold exceeded at ${elapsed}s`);
    }

    // Phase boundary check (A3 slice 5 — overtime generalized: derived from
    // elapsed against the declared table; no-op when phases are inert)
    this._recomputePhase('time');
  }
}

module.exports = new GameClockService();
