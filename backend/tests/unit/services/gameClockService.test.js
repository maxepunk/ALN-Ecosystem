/**
 * Game Clock Service Unit Tests
 * Tests game clock lifecycle with start/pause/resume/restore
 */

'use strict';

describe('GameClockService', () => {
  let gameClockService;

  beforeEach(() => {
    jest.useFakeTimers();
    // Clear module cache to get fresh singleton
    jest.resetModules();
    gameClockService = require('../../../src/services/gameClockService');
    gameClockService.reset();
  });

  afterEach(() => {
    gameClockService.cleanup();
    jest.useRealTimers();
  });

  describe('start()', () => {
    it('should start the clock and emit gameclock:started', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:started', handler);
      gameClockService.start();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ gameStartTime: expect.any(Number) })
      );
    });

    it('should emit gameclock:tick every second', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:tick', handler);
      gameClockService.start();

      jest.advanceTimersByTime(3000);
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should emit elapsed seconds excluding paused time', () => {
      const ticks = [];
      gameClockService.on('gameclock:tick', (data) => ticks.push(data.elapsed));
      gameClockService.start();

      jest.advanceTimersByTime(3000);
      expect(ticks).toEqual([1, 2, 3]);
    });

    it('should throw if already running', () => {
      gameClockService.start();
      expect(() => gameClockService.start()).toThrow(/already running/i);
    });

    it('should throw when called on a paused clock', () => {
      gameClockService.start();
      gameClockService.pause();
      expect(() => gameClockService.start()).toThrow('paused');
    });
  });

  describe('pause()', () => {
    it('should stop ticking', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:tick', handler);
      gameClockService.start();

      jest.advanceTimersByTime(2000); // 2 ticks
      gameClockService.pause();
      jest.advanceTimersByTime(3000); // should NOT tick

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should emit gameclock:paused with current elapsed', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:paused', handler);
      gameClockService.start();

      jest.advanceTimersByTime(5000);
      gameClockService.pause();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ elapsed: 5 })
      );
    });
  });

  describe('resume()', () => {
    it('should resume ticking from where it paused', () => {
      const ticks = [];
      gameClockService.on('gameclock:tick', (data) => ticks.push(data.elapsed));
      gameClockService.start();

      jest.advanceTimersByTime(3000); // elapsed = 3
      gameClockService.pause();
      jest.advanceTimersByTime(5000); // 5s paused, should not count
      gameClockService.resume();
      jest.advanceTimersByTime(2000); // elapsed should be 4, 5

      expect(ticks).toEqual([1, 2, 3, 4, 5]);
    });

    it('should emit gameclock:resumed', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:resumed', handler);
      gameClockService.start();
      jest.advanceTimersByTime(1000);
      gameClockService.pause();
      gameClockService.resume();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ elapsed: 1 })
      );
    });
  });

  describe('stop()', () => {
    it('should stop the clock and clear state', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:tick', handler);
      gameClockService.start();
      jest.advanceTimersByTime(2000);
      gameClockService.stop();
      jest.advanceTimersByTime(3000);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    // F-SHOW-13: stop() emitted no event, so the GM clock panel kept showing
    // a running clock after session:end until reconnect.
    it('should emit gameclock:stopped with the final elapsed time', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:stopped', handler);
      gameClockService.start();
      jest.advanceTimersByTime(5000);

      gameClockService.stop();

      expect(handler).toHaveBeenCalledWith({ elapsed: 5 });
    });
  });

  describe('getElapsed()', () => {
    it('should return 0 before start', () => {
      expect(gameClockService.getElapsed()).toBe(0);
    });

    it('should return elapsed seconds', () => {
      gameClockService.start();
      jest.advanceTimersByTime(10000);
      expect(gameClockService.getElapsed()).toBe(10);
    });

    it('should exclude paused time', () => {
      gameClockService.start();
      jest.advanceTimersByTime(5000);  // 5s active
      gameClockService.pause();
      jest.advanceTimersByTime(10000); // 10s paused
      gameClockService.resume();
      jest.advanceTimersByTime(3000);  // 3s active

      expect(gameClockService.getElapsed()).toBe(8); // 5 + 3
    });
  });

  describe('getState()', () => {
    it('should return stopped state initially', () => {
      expect(gameClockService.getState()).toEqual({
        status: 'stopped',
        elapsed: 0,
        startTime: null,
        totalPausedMs: 0,
        phase: null
      });
    });

    it('should return running state after start', () => {
      gameClockService.start();
      const state = gameClockService.getState();
      expect(state.status).toBe('running');
      expect(state.startTime).toBeTruthy();
    });
  });

  describe('restore()', () => {
    it('should restore clock state from persisted data', () => {
      const pastStart = Date.now() - 60000; // Started 60s ago
      gameClockService.restore({
        startTime: pastStart,
        pausedAt: null,
        totalPausedMs: 0
      });

      // Elapsed should be ~60s (allow margin for test execution)
      const elapsed = gameClockService.getElapsed();
      expect(elapsed).toBeGreaterThanOrEqual(59);
      expect(elapsed).toBeLessThanOrEqual(61);
    });

    it('should restore paused clock', () => {
      const pastStart = Date.now() - 60000;
      const pausedAt = Date.now() - 30000; // Paused 30s ago
      gameClockService.restore({
        startTime: pastStart,
        pausedAt,
        totalPausedMs: 0
      });

      const state = gameClockService.getState();
      expect(state.status).toBe('paused');
      // Active time was 30s (60s ago start, paused 30s ago)
      expect(gameClockService.getElapsed()).toBe(30);
    });

    // F-SHOW-01: overtime threshold was lost across restarts
    it('toPersistence() includes the overtime threshold', () => {
      gameClockService.setOvertimeThreshold(7200);
      gameClockService.start();

      expect(gameClockService.toPersistence()).toEqual(
        expect.objectContaining({ overtimeThreshold: 7200 })
      );
    });

    it('restore() re-arms a future overtime threshold', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:overtime', handler);

      gameClockService.restore({
        startTime: Date.now() - 60000, // 60s elapsed
        pausedAt: null,
        totalPausedMs: 0,
        overtimeThreshold: 120, // fires at 120s
      });

      jest.advanceTimersByTime(59000); // elapsed ~119s
      expect(handler).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2000); // elapsed ~121s
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('restore() marks an already-passed overtime threshold as fired (mark-don\'t-fire)', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:overtime', handler);

      gameClockService.restore({
        startTime: Date.now() - 200000, // 200s elapsed
        pausedAt: null,
        totalPausedMs: 0,
        overtimeThreshold: 120, // already past
      });

      jest.advanceTimersByTime(5000);
      expect(handler).not.toHaveBeenCalled();
      expect(gameClockService.overtimeFired).toBe(true);
    });
  });

  describe('reset()', () => {
    it('should return to initial state', () => {
      gameClockService.start();
      jest.advanceTimersByTime(5000);
      gameClockService.reset();

      expect(gameClockService.getState().status).toBe('stopped');
      expect(gameClockService.getElapsed()).toBe(0);
    });
  });

  describe('overtime detection', () => {
    it('should emit gameclock:overtime when elapsed exceeds threshold', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:overtime', handler);

      gameClockService.setOvertimeThreshold(120 * 60); // 2 hours in seconds
      gameClockService.start();

      // Advance past 2 hours
      jest.advanceTimersByTime(120 * 60 * 1000 + 1000);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ elapsed: expect.any(Number) })
      );
    });

    it('should only emit overtime once', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:overtime', handler);

      gameClockService.setOvertimeThreshold(10);
      gameClockService.start();
      jest.advanceTimersByTime(15000);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should reset overtime flag on reset()', () => {
      const handler = jest.fn();
      gameClockService.on('gameclock:overtime', handler);

      gameClockService.setOvertimeThreshold(5);
      gameClockService.start();
      jest.advanceTimersByTime(6000);

      expect(handler).toHaveBeenCalledTimes(1);

      gameClockService.reset();
      gameClockService.setOvertimeThreshold(5);
      gameClockService.start();
      jest.advanceTimersByTime(6000);

      expect(handler).toHaveBeenCalledTimes(2); // Should fire again after reset
    });
  });

  // ── Phases (A3 slice 5 — R-5-1: derived "latest satisfied start") ──

  describe('phases (A3 slice 5)', () => {
    const TOY_PHASES = [
      { id: 'casing', label: 'Casing the Joint', start: { at: 0 } },
      { id: 'the-job', label: 'The Job', start: { at: 1800 } },
    ];

    it('is INERT with no declared table — phase stays null forever', () => {
      gameClockService.start();
      jest.advanceTimersByTime(5000);
      expect(gameClockService.getState().phase).toBeNull();
    });

    it('is INERT with a degenerate single-phase table (B11: ALN byte-identical)', () => {
      const handler = jest.fn();
      gameClockService.on('phase:changed', handler);
      gameClockService.setPhases([{ id: 'main', label: 'Game', start: { at: 0 } }]);
      gameClockService.start();
      jest.advanceTimersByTime(10000);
      expect(gameClockService.getState().phase).toBeNull();
      expect(handler).not.toHaveBeenCalled();
    });

    it('seeds the initial phase SILENTLY at start() — no phase:changed', () => {
      const handler = jest.fn();
      gameClockService.on('phase:changed', handler);
      gameClockService.setPhases(TOY_PHASES);
      gameClockService.start();
      expect(gameClockService.getState().phase).toEqual({ id: 'casing', label: 'Casing the Joint' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('a first phase starting later than 0 means NO phase until its boundary', () => {
      const handler = jest.fn();
      gameClockService.on('phase:changed', handler);
      gameClockService.setPhases([
        { id: 'late', label: 'Late', start: { at: 300 } },
        { id: 'later', label: 'Later', start: { at: 600 } },
      ]);
      gameClockService.start();
      expect(gameClockService.getState().phase).toBeNull();
      jest.advanceTimersByTime(300000);
      expect(gameClockService.getState().phase).toEqual({ id: 'late', label: 'Late' });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ phaseId: 'late', previousPhaseId: null, via: 'time' })
      );
    });

    it('crosses a time boundary ONCE with the full payload', () => {
      const handler = jest.fn();
      gameClockService.on('phase:changed', handler);
      gameClockService.setPhases(TOY_PHASES);
      gameClockService.start();
      jest.advanceTimersByTime(1800000);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        phaseId: 'the-job',
        label: 'The Job',
        previousPhaseId: 'casing',
        elapsed: expect.any(Number),
        via: 'time',
      });
      jest.advanceTimersByTime(60000); // well past — never re-fires
      expect(handler).toHaveBeenCalledTimes(1);
      expect(gameClockService.getState().phase).toEqual({ id: 'the-job', label: 'The Job' });
    });

    it('a trigger-started phase advances on its observed event (via trigger)', () => {
      const handler = jest.fn();
      gameClockService.on('phase:changed', handler);
      gameClockService.setPhases([
        { id: 'casing', label: 'Casing the Joint', start: { at: 0 } },
        { id: 'the-getaway', label: 'The Getaway', start: { trigger: 'group:completed' } },
      ]);
      gameClockService.start();
      jest.advanceTimersByTime(10000);
      gameClockService.handlePhaseTrigger('group:completed');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ phaseId: 'the-getaway', previousPhaseId: 'casing', via: 'trigger' })
      );
      // Dedup: the same trigger observed again is a no-op
      gameClockService.handlePhaseTrigger('group:completed');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('trigger observation is GATED on a running clock (paused events are ignored, not deferred)', () => {
      const handler = jest.fn();
      gameClockService.on('phase:changed', handler);
      gameClockService.setPhases([
        { id: 'casing', label: 'Casing the Joint', start: { at: 0 } },
        { id: 'the-getaway', label: 'The Getaway', start: { trigger: 'group:completed' } },
      ]);
      gameClockService.start();
      gameClockService.pause();
      gameClockService.handlePhaseTrigger('group:completed');
      gameClockService.resume();
      expect(handler).not.toHaveBeenCalled();
      expect(gameClockService.getState().phase).toEqual({ id: 'casing', label: 'Casing the Joint' });
      // Observed while running → advances
      gameClockService.handlePhaseTrigger('group:completed');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('unknown events never advance anything', () => {
      gameClockService.setPhases([
        { id: 'casing', label: 'Casing the Joint', start: { at: 0 } },
        { id: 'the-getaway', label: 'The Getaway', start: { trigger: 'group:completed' } },
      ]);
      gameClockService.start();
      gameClockService.handlePhaseTrigger('transaction:accepted');
      expect(gameClockService.getState().phase).toEqual({ id: 'casing', label: 'Casing the Joint' });
    });

    it('SKIP-FORWARD: a trigger landing past un-entered phases emits ONCE for the landing', () => {
      const handler = jest.fn();
      gameClockService.on('phase:changed', handler);
      gameClockService.setPhases([
        { id: 'casing', label: 'Casing the Joint', start: { at: 0 } },
        { id: 'the-job', label: 'The Job', start: { at: 1800 } },
        { id: 'the-getaway', label: 'The Getaway', start: { trigger: 'group:completed' } },
      ]);
      gameClockService.start();
      jest.advanceTimersByTime(10000); // still in casing
      gameClockService.handlePhaseTrigger('group:completed');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ phaseId: 'the-getaway', previousPhaseId: 'casing', via: 'trigger' })
      );
      // the-job's 1800s boundary later must NOT regress or re-fire
      jest.advanceTimersByTime(1800000);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(gameClockService.getState().phase).toEqual({ id: 'the-getaway', label: 'The Getaway' });
    });

    it('toPersistence() carries the current phaseId (null when none)', () => {
      expect(gameClockService.toPersistence().phaseId).toBeNull();
      gameClockService.setPhases(TOY_PHASES);
      gameClockService.start();
      expect(gameClockService.toPersistence().phaseId).toBe('casing');
    });

    it('restore() re-derives a TIME boundary crossed during downtime WITHOUT emitting (E1)', () => {
      const handler = jest.fn();
      gameClockService.on('phase:changed', handler);
      gameClockService.setPhases(TOY_PHASES);
      gameClockService.restore({
        startTime: Date.now() - 2000000, // elapsed ~2000s — past the-job@1800
        pausedAt: null,
        totalPausedMs: 0,
        phaseId: 'casing',
      });
      expect(handler).not.toHaveBeenCalled();
      expect(gameClockService.getState().phase).toEqual({ id: 'the-job', label: 'The Job' });
    });

    it('restore() keeps a persisted TRIGGER phase that time alone cannot re-derive', () => {
      gameClockService.setPhases([
        { id: 'casing', label: 'Casing the Joint', start: { at: 0 } },
        { id: 'the-job', label: 'The Job', start: { at: 1800 } },
        { id: 'the-getaway', label: 'The Getaway', start: { trigger: 'group:completed' } },
      ]);
      gameClockService.restore({
        startTime: Date.now() - 100000, // elapsed ~100s — time says casing
        pausedAt: null,
        totalPausedMs: 0,
        phaseId: 'the-getaway',
      });
      expect(gameClockService.getState().phase).toEqual({ id: 'the-getaway', label: 'The Getaway' });
    });

    it('restore() with a phaseId unknown to the active table warns and recomputes from time', () => {
      gameClockService.setPhases(TOY_PHASES);
      gameClockService.restore({
        startTime: Date.now() - 100000, // elapsed ~100s
        pausedAt: null,
        totalPausedMs: 0,
        phaseId: 'ghost-phase',
      });
      expect(gameClockService.getState().phase).toEqual({ id: 'casing', label: 'Casing the Joint' });
    });

    it('stop() clears the phase BEFORE the stopped push — an ended game\'s phase never leaks into the next session\'s setup (review A)', () => {
      const pushes = [];
      gameClockService.on('gameclock:stopped', () => pushes.push(gameClockService.getState().phase));
      gameClockService.setPhases(TOY_PHASES);
      gameClockService.start();
      expect(gameClockService.getState().phase).toEqual({ id: 'casing', label: 'Casing the Joint' });
      gameClockService.stop();
      // The state carried by the stopped push itself is already phase-null
      expect(pushes).toEqual([null]);
      // ...and it STAYS null through the next session's setup (no setPhases yet)
      expect(gameClockService.getState().phase).toBeNull();
    });

    it('setPhases() resets phase state between games', () => {
      gameClockService.setPhases(TOY_PHASES);
      gameClockService.start();
      expect(gameClockService.getState().phase).toEqual({ id: 'casing', label: 'Casing the Joint' });
      gameClockService.stop();
      gameClockService.setPhases(null);
      expect(gameClockService.getState().phase).toBeNull();
    });
  });

  // ── Health registry reporting ──

  describe('health registry reporting', () => {
    it('should report healthy on construction', () => {
      const registry = require('../../../src/services/serviceHealthRegistry');
      // Constructor reports healthy; reset() also reports healthy (in-process timer).
      // Re-require to get fresh singleton where constructor just ran.
      jest.resetModules();
      const freshService = require('../../../src/services/gameClockService');
      const freshRegistry = require('../../../src/services/serviceHealthRegistry');

      expect(freshRegistry.isHealthy('gameclock')).toBe(true);
      expect(freshRegistry.getStatus('gameclock').message).toBe('In-process timer');

      freshService.cleanup();
    });

    it('should report healthy with stopped message on reset', () => {
      const registry = require('../../../src/services/serviceHealthRegistry');
      // In-process timer is always healthy — reset just changes the message
      expect(registry.isHealthy('gameclock')).toBe(true);
      expect(registry.getStatus('gameclock').message).toBe('Timer stopped');
    });
  });
});
