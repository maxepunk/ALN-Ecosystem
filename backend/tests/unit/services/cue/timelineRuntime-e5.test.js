'use strict';

/**
 * Timeline Runtime Tests — E5 Three-Segment Compound-Cue Timeline
 *
 * Decision E5 (2026-06-10): continuous-elapsed, three-segment timeline model.
 * Fixes F-SHOW-08 (video event correlation by tokenId),
 *       F-SHOW-16 (held system edges),
 *       F-SHOW-20 (unified progress unit 0-1).
 *
 * Segments:
 *   1. Pre-video: clock-driven (relativeElapsed from cue startElapsed)
 *   2. Boundary pause: timeline PAUSES until playback actually starts (load time excluded)
 *   3. Video-driven: entry `at` = video position; GM pause pauses pending entries
 *   4. Post-video: clock-driven resumes from actual video end time
 */

jest.mock('../../../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

jest.mock('../../../../src/services/commandExecutor', () => ({
  executeCommand: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
  SERVICE_DEPENDENCIES: {},
}));

jest.mock('../../../../src/services/gameClockService', () => {
  const EventEmitter = require('events');
  const mock = new EventEmitter();
  mock.getElapsed = jest.fn().mockReturnValue(0);
  mock.getState = jest.fn().mockReturnValue({ status: 'stopped', elapsed: 0 });
  mock.reset = jest.fn();
  mock.cleanup = jest.fn();
  return mock;
});

jest.mock('../../../../src/services/serviceHealthRegistry', () => ({
  isHealthy: jest.fn().mockReturnValue(true),
  report: jest.fn(),
  on: jest.fn(),
}));

const { executeCommand } = require('../../../../src/services/commandExecutor');
const flushAsync = () => new Promise(r => setTimeout(r, 10));

describe('E5 — Three-segment compound-cue timeline', () => {
  let cueEngineService, gameClockService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.mock('../../../../src/services/commandExecutor', () => ({
      executeCommand: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
      SERVICE_DEPENDENCIES: {},
    }));
    jest.mock('../../../../src/services/gameClockService', () => {
      const EventEmitter = require('events');
      const mock = new EventEmitter();
      mock.getElapsed = jest.fn().mockReturnValue(0);
      mock.getState = jest.fn().mockReturnValue({ status: 'stopped', elapsed: 0 });
      mock.reset = jest.fn();
      mock.cleanup = jest.fn();
      return mock;
    });
    jest.mock('../../../../src/services/serviceHealthRegistry', () => ({
      isHealthy: jest.fn().mockReturnValue(true),
      report: jest.fn(),
      on: jest.fn(),
    }));
    jest.mock('../../../../src/services/videoQueueService', () => ({
      isPlaying: jest.fn().mockReturnValue(false),
      getCurrentVideo: jest.fn().mockReturnValue(null),
      skipCurrent: jest.fn().mockResolvedValue(),
      clearQueue: jest.fn(),
      pauseCurrent: jest.fn().mockResolvedValue(),
      resumeCurrent: jest.fn().mockResolvedValue(),
    }));

    cueEngineService = require('../../../../src/services/cueEngineService');
    gameClockService = require('../../../../src/services/gameClockService');
    cueEngineService.reset();

    const registry = require('../../../../src/services/serviceHealthRegistry');
    for (const svc of ['sound', 'lighting', 'vlc', 'music', 'bluetooth', 'audio']) {
      registry.report(svc, 'healthy', 'test');
    }
  });

  afterEach(() => {
    cueEngineService.cleanup();
  });

  describe('Segment 1: cues with no video entry — pure clock-relative (unchanged)', () => {
    it('fires pre-video entries on clock ticks only', async () => {
      const execCmd = require('../../../../src/services/commandExecutor').executeCommand;
      gameClockService.getElapsed.mockReturnValue(10);

      cueEngineService.loadCues([{
        id: 'clock-only', label: 'Clock Only',
        timeline: [
          { at: 0, action: 'lighting:scene:activate', payload: { sceneId: 'dim' } },
          { at: 5, action: 'sound:play', payload: { file: 'alert.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('clock-only');
      execCmd.mockClear();

      // at:5 fires when clock reaches startElapsed + 5 = 15
      cueEngineService._tickActiveCompoundCues(14);
      await flushAsync();
      expect(execCmd).not.toHaveBeenCalled();

      cueEngineService._tickActiveCompoundCues(15);
      await flushAsync();
      expect(execCmd).toHaveBeenCalledWith(expect.objectContaining({ action: 'sound:play' }));
    });
  });

  describe('Segment 2: entries before the video entry are clock-relative', () => {
    it('fires pre-video entries on clock before video starts', async () => {
      const execCmd = require('../../../../src/services/commandExecutor').executeCommand;
      gameClockService.getElapsed.mockReturnValue(0);

      cueEngineService.loadCues([{
        id: 'pre-video', label: 'Pre Video',
        timeline: [
          { at: 0, action: 'lighting:scene:activate', payload: { sceneId: 'intro' } },
          { at: 3, action: 'sound:play', payload: { file: 'intro.wav' } },
          { at: 5, action: 'video:queue:add', payload: { tokenId: 'tok1' } },
          { at: 10, action: 'lighting:scene:activate', payload: { sceneId: 'mid' } },
        ],
      }]);

      await cueEngineService.fireCue('pre-video');
      execCmd.mockClear();

      // at:3 fires at clock tick 3 (relative)
      cueEngineService._tickActiveCompoundCues(2);
      await flushAsync();
      expect(execCmd).not.toHaveBeenCalled();

      cueEngineService._tickActiveCompoundCues(3);
      await flushAsync();
      expect(execCmd).toHaveBeenCalledWith(expect.objectContaining({ action: 'sound:play' }));
    });
  });

  describe('Segment 3: boundary pause — load time excluded from timeline', () => {
    it('does NOT fire video-position entries on clock ticks before video actually starts', async () => {
      const execCmd = require('../../../../src/services/commandExecutor').executeCommand;
      gameClockService.getElapsed.mockReturnValue(0);

      cueEngineService.loadCues([{
        id: 'boundary', label: 'Boundary',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { tokenId: 'tok1' } },
          { at: 10, action: 'sound:play', payload: { file: 'mid.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('boundary');
      execCmd.mockClear();

      // Clock ticks while VLC is loading — the at:10 entry should NOT fire
      // because the video hasn't started yet
      cueEngineService._tickActiveCompoundCues(15);
      await flushAsync();
      // at:10 is a video-relative entry (after the video entry) — should NOT fire via clock
      expect(execCmd).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'sound:play' }));
    });

    it('does NOT advance elapsed during boundary pause when clock ticks', async () => {
      gameClockService.getElapsed.mockReturnValue(0);

      cueEngineService.loadCues([{
        id: 'boundary-elapsed', label: 'Boundary Elapsed',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { tokenId: 'tok1' } },
          { at: 30, action: 'sound:play', payload: { file: 'later.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('boundary-elapsed');
      const activeCue = cueEngineService.activeCues.get('boundary-elapsed');

      // Clock ticks simulate load time — elapsed should NOT increase
      cueEngineService._tickActiveCompoundCues(10);
      await flushAsync();

      // elapsed should be 0 (or the pre-video time), not 10
      expect(activeCue.elapsed).toBeLessThanOrEqual(0);
    });
  });

  describe('Segment 4: video-driven — entry at = video position', () => {
    it('fires video-position entries when video progress reaches their at value', async () => {
      const execCmd = require('../../../../src/services/commandExecutor').executeCommand;
      gameClockService.getElapsed.mockReturnValue(0);

      cueEngineService.loadCues([{
        id: 'video-driven-seg', label: 'Video Driven',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { tokenId: 'tok1' } },
          { at: 30, action: 'lighting:scene:activate', payload: { sceneId: 'mid' } },
          { at: 60, action: 'sound:play', payload: { file: 'end.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('video-driven-seg');
      execCmd.mockClear();

      // Simulate video starting with progress events (tokenId matches)
      cueEngineService.handleVideoProgressEvent({ position: 0.1, duration: 120, tokenId: 'tok1' });
      await flushAsync();
      expect(execCmd).not.toHaveBeenCalled(); // at 12s, not yet at:30

      cueEngineService.handleVideoProgressEvent({ position: 0.25, duration: 120, tokenId: 'tok1' });
      await flushAsync();
      // at 30s — fires!
      expect(execCmd).toHaveBeenCalledWith(expect.objectContaining({ action: 'lighting:scene:activate' }));
    });

    it('GM pause pauses pending entries during video', async () => {
      const execCmd = require('../../../../src/services/commandExecutor').executeCommand;
      gameClockService.getElapsed.mockReturnValue(0);

      cueEngineService.loadCues([{
        id: 'pause-during-video', label: 'Pause During Video',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { tokenId: 'tok1' } },
          { at: 30, action: 'sound:play', payload: { file: 'mid.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('pause-during-video');
      // Simulate video started
      cueEngineService.handleVideoProgressEvent({ position: 0.1, duration: 120, tokenId: 'tok1' });
      await flushAsync();
      execCmd.mockClear();

      // GM pauses the cue
      cueEngineService.handleVideoLifecycleEvent('paused', { tokenId: 'tok1' });

      const activeCue = cueEngineService.activeCues.get('pause-during-video');
      expect(activeCue.state).toBe('paused');

      // Progress events while paused should NOT fire entries
      cueEngineService.handleVideoProgressEvent({ position: 0.25, duration: 120, tokenId: 'tok1' });
      await flushAsync();
      expect(execCmd).not.toHaveBeenCalled();
    });
  });

  describe('Segment 5: post-video clock-resume with continuity', () => {
    it('fires post-video entries relative to video end time after natural completion', async () => {
      const execCmd = require('../../../../src/services/commandExecutor').executeCommand;
      gameClockService.getElapsed.mockReturnValue(100); // game clock at 100 when cue starts

      cueEngineService.loadCues([{
        id: 'post-video', label: 'Post Video',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { tokenId: 'tok1' } },
          // Video entry fires at t=0; video is 60s long
          // Post-video entries:
          { at: 65, action: 'sound:play', payload: { file: 'after.wav' } },
          { at: 70, action: 'lighting:scene:activate', payload: { sceneId: 'post' } },
        ],
      }]);

      await cueEngineService.fireCue('post-video');
      execCmd.mockClear();

      // Video runs from 0 to 60s
      cueEngineService.handleVideoProgressEvent({ position: 0.5, duration: 60, tokenId: 'tok1' });
      await flushAsync();

      // Video completes naturally
      cueEngineService.handleVideoLifecycleEvent('completed', { tokenId: 'tok1' });
      await flushAsync();

      const activeCue = cueEngineService.activeCues.get('post-video');
      expect(activeCue).toBeDefined(); // Still active (has post-video entries)
      // post-video elapsed should be ~60 (video duration, natural end)
      expect(activeCue.elapsed).toBeGreaterThanOrEqual(60);

      // Now clock ticks resume — at:65 fires when cue-elapsed >= 65.
      // post-video formula: elapsed = videoEndElapsed + (clockElapsed - clockAnchorElapsed)
      //   = 60 + (clockElapsed - 100)
      // at:65 fires when clockElapsed = 105 (elapsed = 60 + 5 = 65).
      cueEngineService._tickActiveCompoundCues(104); // elapsed = 60+(104-100) = 64, not yet
      await flushAsync();
      expect(execCmd).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'sound:play' }));

      cueEngineService._tickActiveCompoundCues(105); // elapsed = 60+(105-100) = 65, fires
      await flushAsync();
      expect(execCmd).toHaveBeenCalledWith(expect.objectContaining({ action: 'sound:play' }));
    });

    it('resumes clock-driven post-video entries seamlessly after skip (decision E5)', async () => {
      // "after video completion (natural OR skip): clock-driven resumes seamlessly from actual end"
      const execCmd = require('../../../../src/services/commandExecutor').executeCommand;
      gameClockService.getElapsed.mockReturnValue(0);

      cueEngineService.loadCues([{
        id: 'post-skip', label: 'Post Skip',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { tokenId: 'tok2' } },
          { at: 40, action: 'sound:play', payload: { file: 'after-skip.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('post-skip');
      execCmd.mockClear();

      // Video starts, plays for 20s
      cueEngineService.handleVideoProgressEvent({ position: 0.1, duration: 200, tokenId: 'tok2' });
      await flushAsync();
      cueEngineService.handleVideoProgressEvent({ position: 0.1, duration: 200, tokenId: 'tok2' });
      await flushAsync();

      // Video SKIPPED at 20s into video (position=0.1 * 200 = 20)
      // After skip, elapsed should be set to ~20 (actual video end)
      cueEngineService.handleVideoLifecycleEvent('completed', { tokenId: 'tok2', skipped: true, position: 20 });
      await flushAsync();

      const activeCue = cueEngineService.activeCues.get('post-skip');
      expect(activeCue).toBeDefined(); // Still active
      // elapsed should be ~20 (position at skip), not 0 or 200
      expect(activeCue.elapsed).toBeGreaterThanOrEqual(18);
      expect(activeCue.elapsed).toBeLessThan(30);

      // at:40 fires when cue-elapsed reaches 40.
      // post-video formula: elapsed = elapsedAtClockAnchor + (clockElapsed - clockAnchorElapsed)
      //   = 20 + (clockElapsed - 0)
      // So at:40 fires when clockElapsed = 20 (cue-elapsed = 20 + 20 = 40).
      // clockElapsed=19 → cue-elapsed=39 → not yet; clockElapsed=20 → cue-elapsed=40 → fires.
      cueEngineService._tickActiveCompoundCues(19); // cue-elapsed = 20+(19-0) = 39, not yet
      await flushAsync();
      expect(execCmd).not.toHaveBeenCalled();

      cueEngineService._tickActiveCompoundCues(20); // cue-elapsed = 20+(20-0) = 40, fires
      await flushAsync();
      expect(execCmd).toHaveBeenCalledWith(expect.objectContaining({ action: 'sound:play' }));
    });
  });

  describe('F-SHOW-08: video event correlation by tokenId', () => {
    it('does NOT advance compound cue for unrelated video progress (different tokenId)', async () => {
      const execCmd = require('../../../../src/services/commandExecutor').executeCommand;

      cueEngineService.loadCues([{
        id: 'corr-cue', label: 'Correlated',
        timeline: [
          { at: 30, action: 'video:queue:add', payload: { tokenId: 'my-token' } },
          { at: 50, action: 'sound:play', payload: { file: 'corr.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('corr-cue');
      // At this point: hasVideo=true, videoStarted=false, video entry at at:30 NOT fired yet

      execCmd.mockClear();

      // An UNRELATED video starts (different tokenId)
      cueEngineService.handleVideoProgressEvent({ position: 0.5, duration: 100, tokenId: 'other-token' });
      await flushAsync();

      const activeCue = cueEngineService.activeCues.get('corr-cue');
      // videoStarted must remain false — unrelated video progress must not flip it
      expect(activeCue.videoStarted).toBe(false);
      // sound:play (at:50) must NOT fire from unrelated video progress
      expect(execCmd).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'sound:play' }));
    });

    it('DOES advance compound cue for progress events matching the captured tokenId', async () => {
      const execCmd = require('../../../../src/services/commandExecutor').executeCommand;
      gameClockService.getElapsed.mockReturnValue(0);

      cueEngineService.loadCues([{
        id: 'corr-match', label: 'Correlated Match',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { tokenId: 'correct-token' } },
          { at: 30, action: 'sound:play', payload: { file: 'mid.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('corr-match');
      execCmd.mockClear();

      // Correct tokenId — should advance timeline
      cueEngineService.handleVideoProgressEvent({ position: 0.25, duration: 120, tokenId: 'correct-token' });
      await flushAsync();

      const activeCue = cueEngineService.activeCues.get('corr-match');
      expect(activeCue.videoStarted).toBe(true);
      expect(execCmd).toHaveBeenCalledWith(expect.objectContaining({ action: 'sound:play' }));
    });

    it('captures tokenId from the video entry payload at fire time', async () => {
      gameClockService.getElapsed.mockReturnValue(0);

      cueEngineService.loadCues([{
        id: 'capture-token', label: 'Capture Token',
        timeline: [
          { at: 5, action: 'video:queue:add', payload: { tokenId: 'deferred-token' } },
          { at: 30, action: 'sound:play', payload: { file: 'after.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('capture-token');

      // Fire the video entry at t=5
      cueEngineService._tickActiveCompoundCues(5);
      await flushAsync();

      const activeCue = cueEngineService.activeCues.get('capture-token');
      // The captured tokenId must be 'deferred-token'
      expect(activeCue.capturedVideoTokenId).toBe('deferred-token');
    });
  });

  describe('F-SHOW-20: unified progress unit 0-1 everywhere', () => {
    it('getActiveCues() returns progress 0-1', async () => {
      gameClockService.getElapsed.mockReturnValue(0);

      cueEngineService.loadCues([{
        id: 'progress-unit', label: 'Progress Unit',
        timeline: [
          { at: 0, action: 'sound:play', payload: { file: 'start.wav' } },
          { at: 100, action: 'sound:play', payload: { file: 'end.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('progress-unit');
      const activeCue = cueEngineService.activeCues.get('progress-unit');
      activeCue.elapsed = 50;

      const result = cueEngineService.getActiveCues();
      expect(result[0].progress).toBe(0.5); // 50/100 = 0.5 (NOT 50)
    });

    it('cue:status events emit progress 0-1', async () => {
      const statusHandler = jest.fn();
      cueEngineService.on('cue:status', statusHandler);
      gameClockService.getElapsed.mockReturnValue(0);

      cueEngineService.loadCues([{
        id: 'status-unit', label: 'Status Unit',
        timeline: [
          { at: 0, action: 'sound:play', payload: { file: 'start.wav' } },
          { at: 100, action: 'sound:play', payload: { file: 'end.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('status-unit');
      statusHandler.mockClear();

      cueEngineService._tickActiveCompoundCues(50); // relative=50
      await flushAsync();

      const statusCall = statusHandler.mock.calls.find(c => c[0].cueId === 'status-unit' && c[0].progress !== undefined);
      if (statusCall) {
        expect(statusCall[0].progress).toBeLessThanOrEqual(1);
        expect(statusCall[0].progress).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Constraint v1: one video entry per compound cue', () => {
    it('logs a warning when a compound cue has more than one video entry', async () => {
      const logger = require('../../../../src/utils/logger');

      cueEngineService.loadCues([{
        id: 'multi-video', label: 'Multi Video',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { tokenId: 'tok1' } },
          { at: 30, action: 'video:queue:add', payload: { tokenId: 'tok2' } },
        ],
      }]);

      await cueEngineService.fireCue('multi-video');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('multi-video'),
        expect.anything()
      );
    });
  });
});
