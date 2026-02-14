/**
 * Game Clock Service
 * Master time authority - single setInterval(1000) tick source
 * Emits gameclock:tick internally for cue engine and overtime detection
 */

'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');

class GameClockService extends EventEmitter {
  constructor() {
    super();
    this._reset();
  }

  _reset() {
    this.gameStartTime = null;
    this.pauseStartTime = null;
    this.totalPausedMs = 0;
    this.interval = null;
    this.status = 'stopped'; // stopped | running | paused
  }

  start() {
    if (this.status === 'running') {
      throw new Error('Game clock is already running');
    }
    this.gameStartTime = Date.now();
    this.totalPausedMs = 0;
    this.pauseStartTime = null;
    this.status = 'running';
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
    this.status = 'stopped';
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
      totalPausedMs: this.totalPausedMs
    };
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
    logger.info(`[GameClock] Restored: status=${this.status}, elapsed=${this.getElapsed()}s`);
  }

  /** Returns data suitable for session model persistence. */
  toPersistence() {
    return {
      startTime: this.gameStartTime,
      pausedAt: this.pauseStartTime,
      totalPausedMs: this.totalPausedMs
    };
  }

  reset() {
    this._stopInterval();
    this._reset();
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
  }
}

module.exports = new GameClockService();
