'use strict';

// Mock logger to suppress output
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock executeCommand before requiring cueEngineService
jest.mock('../../../src/services/commandExecutor', () => ({
  executeCommand: jest.fn().mockResolvedValue({ success: true, message: 'ok' })
}));

// Mock gameClockService
jest.mock('../../../src/services/gameClockService', () => {
  const EventEmitter = require('events');
  const mock = new EventEmitter();
  mock.getElapsed = jest.fn().mockReturnValue(0);
  mock.getState = jest.fn().mockReturnValue({ status: 'stopped', elapsed: 0 });
  mock.reset = jest.fn();
  mock.cleanup = jest.fn();
  return mock;
});

const { executeCommand } = require('../../../src/services/commandExecutor');

describe('CueEngineService', () => {
  let cueEngineService, gameClockService, executeCommand;

  // Helper to flush async event loops
  const flushAsync = () => new Promise(r => setTimeout(r, 10));

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-require after mocks
    jest.mock('../../../src/services/commandExecutor', () => ({
      executeCommand: jest.fn().mockResolvedValue({ success: true, message: 'ok' })
    }));

    cueEngineService = require('../../../src/services/cueEngineService');
    gameClockService = require('../../../src/services/gameClockService');
    executeCommand = require('../../../src/services/commandExecutor').executeCommand;
    cueEngineService.reset();
  });

  afterEach(() => {
    cueEngineService.cleanup();
  });

  describe('loadCues()', () => {
    it('should load cue definitions from array', () => {
      cueEngineService.loadCues([
        { id: 'test-cue', label: 'Test', commands: [{ action: 'sound:play', payload: { file: 'test.wav' } }] }
      ]);
      expect(cueEngineService.getCues()).toHaveLength(1);
    });

    it('should reject cue with both commands and timeline', () => {
      expect(() => {
        cueEngineService.loadCues([{
          id: 'bad-cue',
          label: 'Bad',
          commands: [{ action: 'sound:play' }],
          timeline: [{ at: 0, action: 'sound:play' }]
        }]);
      }).toThrow(/bad-cue.*mutually exclusive/i);
    });

    it('should identify standing cues (have trigger)', () => {
      cueEngineService.loadCues([
        { id: 'standing', label: 'Standing', trigger: { event: 'transaction:accepted' }, commands: [{ action: 'sound:play', payload: { file: 'a.wav' } }] },
        { id: 'manual', label: 'Manual', commands: [{ action: 'sound:play', payload: { file: 'b.wav' } }] }
      ]);
      expect(cueEngineService.getStandingCues()).toHaveLength(1);
    });
  });

  describe('fireCue() — simple cue', () => {
    it('should execute all commands in a simple cue', async () => {
      cueEngineService.loadCues([{
        id: 'multi-cmd',
        label: 'Multi',
        commands: [
          { action: 'sound:play', payload: { file: 'a.wav' } },
          { action: 'lighting:scene:activate', payload: { sceneId: 'scene.dim' } }
        ]
      }]);

      await cueEngineService.fireCue('multi-cmd');

      expect(executeCommand).toHaveBeenCalledTimes(2);
      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
        action: 'sound:play',
        source: 'cue'
      }));
      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
        action: 'lighting:scene:activate',
        source: 'cue'
      }));
    });

    it('should emit cue:fired event', async () => {
      const handler = jest.fn();
      cueEngineService.on('cue:fired', handler);
      cueEngineService.loadCues([{
        id: 'test', label: 'Test',
        commands: [{ action: 'sound:play', payload: { file: 'a.wav' } }]
      }]);

      await cueEngineService.fireCue('test');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ cueId: 'test' }));
    });

    it('should throw for unknown cue ID', async () => {
      await expect(cueEngineService.fireCue('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('should skip disabled cue', async () => {
      cueEngineService.loadCues([{
        id: 'test', label: 'Test',
        commands: [{ action: 'sound:play', payload: { file: 'a.wav' } }]
      }]);
      cueEngineService.disableCue('test');

      await cueEngineService.fireCue('test');
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('once flag', () => {
    it('should auto-disable after first fire when once=true', async () => {
      cueEngineService.loadCues([{
        id: 'one-shot', label: 'One Shot', once: true,
        commands: [{ action: 'sound:play', payload: { file: 'a.wav' } }]
      }]);

      await cueEngineService.fireCue('one-shot');
      // Second fire should be skipped
      executeCommand.mockClear();
      await cueEngineService.fireCue('one-shot');
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('enable/disable', () => {
    it('should disable and re-enable a cue', () => {
      cueEngineService.loadCues([{ id: 'test', label: 'Test', commands: [] }]);
      cueEngineService.disableCue('test');
      expect(cueEngineService.getDisabledCues()).toContain('test');
      cueEngineService.enableCue('test');
      expect(cueEngineService.getDisabledCues()).not.toContain('test');
    });
  });

  describe('event-triggered standing cues', () => {
    it('should fire matching cue when event occurs', async () => {
      cueEngineService.loadCues([{
        id: 'on-scan',
        label: 'On Scan',
        trigger: { event: 'transaction:accepted' },
        commands: [{ action: 'sound:play', payload: { file: 'cha-ching.wav' } }]
      }]);

      cueEngineService.activate(); // Start listening

      // Simulate the event
      cueEngineService.handleGameEvent('transaction:accepted', {
        transaction: { tokenId: 'T1', teamId: 'A', deviceType: 'gm', points: 50000, memoryType: 'Business', valueRating: 3, groupId: null },
        teamScore: { currentScore: 50000 },
        groupBonus: null
      });

      // Allow async fire to complete
      await flushAsync();
      expect(executeCommand).toHaveBeenCalled();
    });

    it('should NOT fire when conditions do not match', async () => {
      cueEngineService.loadCues([{
        id: 'business-only',
        label: 'Business Only',
        trigger: { event: 'transaction:accepted' },
        conditions: [{ field: 'memoryType', op: 'eq', value: 'Business' }],
        commands: [{ action: 'sound:play', payload: { file: 'b.wav' } }]
      }]);

      cueEngineService.activate();

      cueEngineService.handleGameEvent('transaction:accepted', {
        transaction: { tokenId: 'T1', teamId: 'A', deviceType: 'gm', points: 10000, memoryType: 'Personal', valueRating: 1, groupId: null },
        teamScore: { currentScore: 10000 },
        groupBonus: null
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executeCommand).not.toHaveBeenCalled();
    });

    it('should fire when all conditions match', async () => {
      cueEngineService.loadCues([{
        id: 'big-business',
        label: 'Big Business',
        trigger: { event: 'transaction:accepted' },
        conditions: [
          { field: 'memoryType', op: 'eq', value: 'Business' },
          { field: 'teamScore', op: 'gte', value: 100000 }
        ],
        commands: [{ action: 'sound:play', payload: { file: 'big.wav' } }]
      }]);

      cueEngineService.activate();

      cueEngineService.handleGameEvent('transaction:accepted', {
        transaction: { tokenId: 'T1', teamId: 'A', deviceType: 'gm', points: 150000, memoryType: 'Business', valueRating: 3, groupId: null },
        teamScore: { currentScore: 200000 },
        groupBonus: null
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executeCommand).toHaveBeenCalled();
    });
  });

  describe('condition operators', () => {
    const makeEngine = (conditions) => {
      cueEngineService.loadCues([{
        id: 'cond-test', label: 'Test',
        trigger: { event: 'transaction:accepted' },
        conditions,
        commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }]
      }]);
      cueEngineService.activate();
    };

    const fireEvent = (overrides = {}) => {
      cueEngineService.handleGameEvent('transaction:accepted', {
        transaction: { tokenId: 'T1', teamId: 'A', deviceType: 'gm', points: 50000, memoryType: 'Business', valueRating: 3, groupId: null, ...overrides },
        teamScore: { currentScore: overrides.teamScore || 50000 },
        groupBonus: null
      });
    };

    it('should support neq operator', async () => {
      makeEngine([{ field: 'memoryType', op: 'neq', value: 'Personal' }]);
      fireEvent({ memoryType: 'Business' });
      await flushAsync();
      expect(executeCommand).toHaveBeenCalled();
    });

    it('should support in operator', async () => {
      makeEngine([{ field: 'memoryType', op: 'in', value: ['Business', 'Technical'] }]);
      fireEvent({ memoryType: 'Technical' });
      await flushAsync();
      expect(executeCommand).toHaveBeenCalled();
    });

    it('should support gt operator', async () => {
      makeEngine([{ field: 'points', op: 'gt', value: 40000 }]);
      fireEvent({ points: 50000 });
      await flushAsync();
      expect(executeCommand).toHaveBeenCalled();
    });

    it('should support lt operator', async () => {
      makeEngine([{ field: 'valueRating', op: 'lt', value: 4 }]);
      fireEvent({ valueRating: 3 });
      await flushAsync();
      expect(executeCommand).toHaveBeenCalled();
    });
  });

  describe('clock-triggered standing cues', () => {
    it('should fire when game clock reaches threshold', async () => {
      cueEngineService.loadCues([{
        id: 'midgame',
        label: 'Midgame',
        once: true,
        trigger: { clock: '01:00:00' },
        commands: [{ action: 'lighting:scene:activate', payload: { sceneId: 'scene.tension' } }]
      }]);

      cueEngineService.activate();

      // Simulate clock tick at 3600 seconds (01:00:00)
      cueEngineService.handleClockTick(3600);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executeCommand).toHaveBeenCalled();
    });

    it('should NOT fire before threshold', async () => {
      cueEngineService.loadCues([{
        id: 'midgame', label: 'Midgame', once: true,
        trigger: { clock: '01:00:00' },
        commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }]
      }]);

      cueEngineService.activate();
      cueEngineService.handleClockTick(3599); // 59:59 — not yet

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(executeCommand).not.toHaveBeenCalled();
    });

    it('should fire only once for a given clock cue', async () => {
      cueEngineService.loadCues([{
        id: 'midgame', label: 'Midgame',
        trigger: { clock: '01:00:00' },
        commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }]
      }]);

      cueEngineService.activate();
      cueEngineService.handleClockTick(3600);
      await flushAsync();
      executeCommand.mockClear();

      cueEngineService.handleClockTick(3601);
      await flushAsync();
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('re-entrancy guard (D4)', () => {
    it.todo('should not evaluate standing cues for commands dispatched by cues');
  });

  describe('suspend/reactivate', () => {
    it('should not fire standing cues while suspended', async () => {
      cueEngineService.loadCues([{
        id: 'test', label: 'Test',
        trigger: { event: 'transaction:accepted' },
        commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }]
      }]);

      cueEngineService.activate();
      cueEngineService.suspend();

      cueEngineService.handleGameEvent('transaction:accepted', {
        transaction: { tokenId: 'T1', teamId: 'A', deviceType: 'gm', points: 10000, memoryType: 'Personal', valueRating: 1, groupId: null },
        teamScore: { currentScore: 10000 },
        groupBonus: null
      });

      await flushAsync();
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('getCueSummaries()', () => {
    it('should return summary without commands/timeline arrays', () => {
      cueEngineService.loadCues([{
        id: 'test', label: 'Test', icon: 'sound', quickFire: true, once: false,
        trigger: { event: 'transaction:accepted' },
        commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }]
      }]);

      const summaries = cueEngineService.getCueSummaries();
      expect(summaries[0]).toEqual({
        id: 'test',
        label: 'Test',
        icon: 'sound',
        quickFire: true,
        once: false,
        triggerType: 'event',
        enabled: true
      });
      expect(summaries[0].commands).toBeUndefined();
    });
  });

  describe('compound cue execution', () => {
    it('should execute timeline entries at correct elapsed positions', async () => {
      cueEngineService.loadCues([{
        id: 'compound-1', label: 'Test Compound',
        timeline: [
          { at: 0, action: 'lighting:scene:activate', payload: { sceneId: 'scene.dim' } },
          { at: 5, action: 'sound:play', payload: { file: 'hit.wav' } },
          { at: 10, action: 'lighting:scene:activate', payload: { sceneId: 'scene.bright' } },
        ]
      }]);

      await cueEngineService.fireCue('compound-1');
      expect(executeCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'lighting:scene:activate', source: 'cue' })
      );

      // Simulate 5 clock ticks
      for (let i = 1; i <= 5; i++) {
        cueEngineService._tickActiveCompoundCues(i);
      }
      await flushAsync();

      expect(executeCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'sound:play' })
      );
    });

    it('should emit cue:started for compound cues', async () => {
      const handler = jest.fn();
      cueEngineService.on('cue:started', handler);

      cueEngineService.loadCues([{
        id: 'compound-2', label: 'Test',
        timeline: [{ at: 0, action: 'sound:play', payload: { file: 'a.wav' } }]
      }]);

      await cueEngineService.fireCue('compound-2');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        cueId: 'compound-2', hasVideo: false
      }));
    });

    it('should emit cue:completed when timeline finishes', async () => {
      const handler = jest.fn();
      cueEngineService.on('cue:completed', handler);

      cueEngineService.loadCues([{
        id: 'compound-3', label: 'Short',
        timeline: [{ at: 0, action: 'sound:play', payload: { file: 'a.wav' } }]
      }]);

      await cueEngineService.fireCue('compound-3');
      // Tick past the last entry
      cueEngineService._tickActiveCompoundCues(1);
      await flushAsync();

      expect(handler).toHaveBeenCalledWith({ cueId: 'compound-3' });
    });

    it('should track active compound cues', async () => {
      cueEngineService.loadCues([{
        id: 'compound-active', label: 'Active',
        timeline: [
          { at: 0, action: 'sound:play', payload: { file: 'a.wav' } },
          { at: 60, action: 'sound:play', payload: { file: 'b.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('compound-active');
      const active = cueEngineService.getActiveCues();
      expect(active).toHaveLength(1);
      expect(active[0].cueId).toBe('compound-active');
      expect(active[0].state).toBe('running');
    });
  });

  describe('compound cue stop/pause/resume', () => {
    it('should stop an active compound cue', async () => {
      cueEngineService.loadCues([{
        id: 'stoppable', label: 'Stoppable',
        timeline: [{ at: 0, action: 'sound:play', payload: {} }, { at: 60, action: 'sound:play', payload: {} }]
      }]);

      await cueEngineService.fireCue('stoppable');
      expect(cueEngineService.getActiveCues()).toHaveLength(1);

      await cueEngineService.stopCue('stoppable');
      expect(cueEngineService.getActiveCues()).toHaveLength(0);
    });

    it('should pause and resume a compound cue', async () => {
      cueEngineService.loadCues([{
        id: 'pausable', label: 'Pausable',
        timeline: [{ at: 0, action: 'sound:play', payload: {} }, { at: 60, action: 'sound:play', payload: {} }]
      }]);

      await cueEngineService.fireCue('pausable');
      await cueEngineService.pauseCue('pausable');
      expect(cueEngineService.getActiveCues()[0].state).toBe('paused');

      await cueEngineService.resumeCue('pausable');
      expect(cueEngineService.getActiveCues()[0].state).toBe('running');
    });
  });

  describe('compound cue nesting', () => {
    it('should fire nested cue via cue:fire in timeline', async () => {
      cueEngineService.loadCues([
        { id: 'child', label: 'Child', commands: [{ action: 'sound:play', payload: { file: 'child.wav' } }] },
        { id: 'parent', label: 'Parent', timeline: [
          { at: 0, action: 'cue:fire', payload: { cueId: 'child' } }
        ]}
      ]);

      await cueEngineService.fireCue('parent');
      await flushAsync();

      expect(executeCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cue:fire', payload: { cueId: 'child' } })
      );
    });

    it('should detect and prevent cycles', async () => {
      const errorHandler = jest.fn();
      cueEngineService.on('cue:error', errorHandler);

      cueEngineService.loadCues([
        { id: 'cycle-a', label: 'A', timeline: [{ at: 0, action: 'cue:fire', payload: { cueId: 'cycle-b' } }] },
        { id: 'cycle-b', label: 'B', timeline: [{ at: 0, action: 'cue:fire', payload: { cueId: 'cycle-a' } }] },
      ]);

      // This should not infinite loop — cycle detection stops it
      await cueEngineService.fireCue('cycle-a');
      await flushAsync();
      // Cycle-b tries to fire cycle-a but it's in the visited set
    });

    it('should cascade stop to children', async () => {
      cueEngineService.loadCues([
        { id: 'child-cue', label: 'Child',
          timeline: [{ at: 0, action: 'sound:play', payload: {} }, { at: 120, action: 'sound:play', payload: {} }] },
        { id: 'parent-cue', label: 'Parent',
          timeline: [{ at: 0, action: 'cue:fire', payload: { cueId: 'child-cue' } }, { at: 120, action: 'sound:play', payload: {} }] },
      ]);

      await cueEngineService.fireCue('parent-cue');
      await flushAsync();

      // Both parent and child should be active
      expect(cueEngineService.getActiveCues().length).toBeGreaterThanOrEqual(1);

      // Stop parent — child should also stop
      await cueEngineService.stopCue('parent-cue');
      expect(cueEngineService.getActiveCues()).toHaveLength(0);
    });
  });

  describe('video-driven compound cues', () => {
    it('should sync timeline to video:progress events', async () => {
      cueEngineService.loadCues([{
        id: 'video-cue', label: 'Video Cue',
        timeline: [
          { at: 0, action: 'video:play', payload: { file: 'test.mp4' } },
          { at: 30, action: 'lighting:scene:activate', payload: { sceneId: 'scene.dim' } },
        ]
      }]);

      await cueEngineService.fireCue('video-cue');
      await flushAsync();

      // Simulate video progress at 30 seconds
      cueEngineService.handleVideoProgress('video-cue', 30);
      await flushAsync();

      expect(executeCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'lighting:scene:activate' })
      );
    });

    it('should pause compound cue when video pauses', async () => {
      cueEngineService.loadCues([{
        id: 'video-pause-cue', label: 'VP',
        timeline: [
          { at: 0, action: 'video:play', payload: { file: 'test.mp4' } },
          { at: 60, action: 'sound:play', payload: { file: 'end.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('video-pause-cue');
      cueEngineService.handleVideoPaused('video-pause-cue');
      expect(cueEngineService.getActiveCues()[0].state).toBe('paused');
    });
  });

  describe('timeline error handling (D36)', () => {
    it('should continue timeline when a command fails', async () => {
      const errorHandler = jest.fn();
      cueEngineService.on('cue:error', errorHandler);

      executeCommand.mockRejectedValueOnce(new Error('lighting failed'));
      executeCommand.mockResolvedValue({ success: true });

      cueEngineService.loadCues([{
        id: 'error-cue', label: 'Error Test',
        timeline: [
          { at: 0, action: 'lighting:scene:activate', payload: { sceneId: 'bad' } },
          { at: 0, action: 'sound:play', payload: { file: 'good.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('error-cue');
      await flushAsync();

      // Error emitted for first command
      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        cueId: 'error-cue', action: 'lighting:scene:activate'
      }));
      // Second command still executed
      expect(executeCommand).toHaveBeenCalledTimes(2);
    });
  });

  describe('video conflict detection (D13, D37)', () => {
    let videoQueueService;

    beforeEach(() => {
      // Mock videoQueueService
      jest.mock('../../../src/services/videoQueueService', () => ({
        isPlaying: jest.fn().mockReturnValue(false),
        getCurrentVideo: jest.fn().mockReturnValue(null),
      }));
      videoQueueService = require('../../../src/services/videoQueueService');
    });

    it('should emit cue:conflict when video is already playing', async () => {
      const conflictHandler = jest.fn();
      cueEngineService.on('cue:conflict', conflictHandler);

      // Mock videoQueueService.isPlaying() to return true
      videoQueueService.isPlaying.mockReturnValue(true);
      videoQueueService.getCurrentVideo.mockReturnValue({ tokenId: 'current.mp4' });

      cueEngineService.loadCues([{
        id: 'conflict-cue', label: 'Conflict',
        timeline: [
          { at: 0, action: 'video:play', payload: { file: 'new.mp4' } },
          { at: 30, action: 'sound:play', payload: { file: 'hit.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('conflict-cue');

      expect(conflictHandler).toHaveBeenCalledWith(expect.objectContaining({
        cueId: 'conflict-cue',
        reason: 'Video conflict',
        currentVideo: expect.any(Object),
        autoCancel: true,
        autoCancelMs: 10000,
      }));
    });

    it('should start compound cue immediately when no video conflict', async () => {
      videoQueueService.isPlaying.mockReturnValue(false);

      cueEngineService.loadCues([{
        id: 'no-conflict', label: 'No Conflict',
        timeline: [
          { at: 0, action: 'video:play', payload: { file: 'new.mp4' } },
        ]
      }]);

      await cueEngineService.fireCue('no-conflict');
      await flushAsync();

      expect(executeCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'video:play' })
      );
    });

    it('should auto-cancel conflict after 10 seconds timeout', async () => {
      jest.useFakeTimers();
      videoQueueService.isPlaying.mockReturnValue(true);
      videoQueueService.getCurrentVideo.mockReturnValue({ tokenId: 'current.mp4' });

      cueEngineService.loadCues([{
        id: 'timeout-cue', label: 'Timeout',
        timeline: [{ at: 0, action: 'video:play', payload: { file: 'new.mp4' } }]
      }]);

      await cueEngineService.fireCue('timeout-cue');

      // Advance 10 seconds — should auto-cancel
      jest.advanceTimersByTime(10000);
      expect(cueEngineService.getActiveCues()).toHaveLength(0);

      jest.useRealTimers();
    });

    it('should not check conflict for non-video compound cues', async () => {
      const conflictHandler = jest.fn();
      cueEngineService.on('cue:conflict', conflictHandler);

      videoQueueService.isPlaying.mockReturnValue(true);

      cueEngineService.loadCues([{
        id: 'no-video-cue', label: 'No Video',
        timeline: [
          { at: 0, action: 'sound:play', payload: { file: 'hit.wav' } },
          { at: 30, action: 'lighting:scene:activate', payload: { sceneId: 'scene.dim' } },
        ]
      }]);

      await cueEngineService.fireCue('no-video-cue');

      expect(conflictHandler).not.toHaveBeenCalled();
      expect(executeCommand).toHaveBeenCalled();
    });
  });

  describe('reset() — compound cue state cleanup', () => {
    it('should clear activeCues map on reset', () => {
      // Manually add an active cue entry
      cueEngineService.activeCues.set('test-cue', {
        cueId: 'test-cue',
        state: 'running',
        startTime: Date.now(),
        elapsed: 0,
        timeline: [],
        maxAt: 60,
        firedEntries: new Set(),
        children: new Set(),
        hasVideo: false,
      });

      expect(cueEngineService.activeCues.size).toBe(1);

      cueEngineService.reset();

      expect(cueEngineService.activeCues.size).toBe(0);
    });

    it('should clear conflictTimers and cancel timeouts on reset', () => {
      jest.useFakeTimers();

      // Manually add a conflict timer
      const callback = jest.fn();
      const timer = setTimeout(callback, 10000);
      cueEngineService.conflictTimers.set('conflict-cue', timer);

      expect(cueEngineService.conflictTimers.size).toBe(1);

      cueEngineService.reset();

      expect(cueEngineService.conflictTimers.size).toBe(0);

      // Advance time past the timer — callback should NOT fire (was cleared)
      jest.advanceTimersByTime(15000);
      expect(callback).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should clear firedClockCues on reset', () => {
      cueEngineService.firedClockCues.add('clock-cue-1');
      cueEngineService.firedClockCues.add('clock-cue-2');

      cueEngineService.reset();

      expect(cueEngineService.firedClockCues.size).toBe(0);
    });

    it('should deactivate engine on reset', () => {
      cueEngineService.activate();
      expect(cueEngineService.active).toBe(true);

      cueEngineService.reset();

      expect(cueEngineService.active).toBe(false);
    });
  });

  describe('clock-driven compound cue at non-zero game clock (C1)', () => {
    it('should use relative elapsed time when cue starts mid-game', async () => {
      // Set game clock to 100s before firing cue
      gameClockService.getElapsed.mockReturnValue(100);

      cueEngineService.loadCues([{
        id: 'late-start',
        timeline: [
          { at: 0, action: 'lighting:scene:activate', payload: { sceneId: 'dim' } },
          { at: 5, action: 'sound:play', payload: { file: 'alert.wav' } },
        ],
      }]);

      // Fire cue — startElapsed captured as 100
      await cueEngineService.fireCue('late-start');
      executeCommand.mockClear();

      // Tick at 101s (relative=1) — at:0 already fired, nothing at at:1
      cueEngineService._tickActiveCompoundCues(101);
      await flushAsync();
      expect(executeCommand).not.toHaveBeenCalled();

      // Tick at 105s (relative=5) — at:5 entry should fire
      cueEngineService._tickActiveCompoundCues(105);
      await flushAsync();
      expect(executeCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'sound:play' })
      );
    });

    it('should not fire entries prematurely with absolute clock time', async () => {
      // Set game clock to 50s before firing cue
      gameClockService.getElapsed.mockReturnValue(50);

      cueEngineService.loadCues([{
        id: 'late-start-2',
        timeline: [
          { at: 0, action: 'lighting:scene:activate', payload: { sceneId: 'dim' } },
          { at: 30, action: 'sound:play', payload: { file: 'late.wav' } },
        ],
      }]);

      // Fire cue — startElapsed captured as 50
      await cueEngineService.fireCue('late-start-2');
      executeCommand.mockClear();

      // Tick at 51s (relative=1) — at:30 should NOT fire yet
      cueEngineService._tickActiveCompoundCues(51);
      await flushAsync();
      expect(executeCommand).not.toHaveBeenCalled();

      // Tick at 80s (relative=30) — at:30 should fire
      cueEngineService._tickActiveCompoundCues(80);
      await flushAsync();
      expect(executeCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'sound:play' })
      );
    });
  });

  describe('loadCues() with active cues (M4)', () => {
    it('should stop active compound cues when loadCues is called', async () => {
      cueEngineService.loadCues([{
        id: 'running-cue',
        timeline: [
          { at: 0, action: 'lighting:scene:activate', payload: { sceneId: 'dim' } },
          { at: 60, action: 'sound:play', payload: { file: 'end.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('running-cue');
      expect(cueEngineService.getActiveCues()).toHaveLength(1);

      // Reload cues — should stop the active cue first
      cueEngineService.loadCues([{
        id: 'new-cue',
        commands: [{ action: 'sound:play', payload: { file: 'new.wav' } }]
      }]);
      expect(cueEngineService.getActiveCues()).toHaveLength(0);
    });
  });
});
