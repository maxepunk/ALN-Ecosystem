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
        totalPausedMs: 0
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
});
