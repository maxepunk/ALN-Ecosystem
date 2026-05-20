/**
 * Audio Routing Phase 3 Integration Tests
 *
 * Tests end-to-end flows for Phase 3 features:
 * 1. Ducking engine — video/sound lifecycle auto-ducks Spotify volume
 * 2. Per-stream volume control — setStreamVolume/getStreamVolume
 * 3. Routing inheritance — cue-level routing injected at dispatch time
 *
 * External dependencies (pactl) are mocked at the service level.
 * The tests verify internal service coordination, NOT external tools.
 */

'use strict';

const audioRoutingService = require('../../src/services/audioRoutingService');
const cueEngineService = require('../../src/services/cueEngineService');

// Mock commandExecutor at module level so cueEngineService's require picks it up
const mockExecuteCommand = jest.fn().mockResolvedValue({ success: true, broadcasts: [] });
jest.mock('../../src/services/commandExecutor', () => ({
  executeCommand: (...args) => mockExecuteCommand(...args),
  SERVICE_DEPENDENCIES: {
    'video:play': 'vlc',
    'video:queue:add': 'vlc',
    'spotify:play': 'spotify',
    'sound:play': 'sound',
    'sound:stop': 'sound',
    'lighting:scene:activate': 'lighting',
    'audio:route:set': 'audio',
    'audio:volume:set': 'audio',
  },
}));

const registry = require('../../src/services/serviceHealthRegistry');

describe('Audio Routing Phase 3 Integration', () => {

  beforeEach(() => {
    // Set all services healthy (Phase 3: fireCue checks service health)
    for (const svc of ['sound', 'lighting', 'vlc', 'spotify', 'audio']) {
      registry.report(svc, 'healthy', 'test default');
    }
    // Reset ducking state
    audioRoutingService.loadDuckingRules([]);
    // Reset stream volumes
    // NOTE: audioRoutingService doesn't actually have a _streamVolumes
    // cache — pre-duck volumes come from pactl via getStreamVolume() with
    // a 100 fallback. Reset the real state instead.
    audioRoutingService._preDuckVolumes = {};
    audioRoutingService._activeDuckingSources = {};
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ══════════════════════════════════════════════════════════════
  // Ducking Engine
  // ══════════════════════════════════════════════════════════════

  describe('Ducking Engine', () => {
    beforeEach(() => {
      // Load production ducking rules
      audioRoutingService.loadDuckingRules([
        { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
        { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 },
      ]);

      // Mock setStreamVolume to avoid pactl calls
      jest.spyOn(audioRoutingService, 'setStreamVolume').mockResolvedValue();
    });

    it('should duck Spotify when video starts', async () => {
      await audioRoutingService.handleDuckingEvent('video', 'started');

      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 20);
    });

    it('should restore Spotify volume when video completes', async () => {
      await audioRoutingService.handleDuckingEvent('video', 'started');
      audioRoutingService.setStreamVolume.mockClear();

      await audioRoutingService.handleDuckingEvent('video', 'completed');

      // Restore to pre-duck volume (100)
      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 100);
    });

    it('should keep lowest volume when multiple sources duck simultaneously', async () => {
      await audioRoutingService.handleDuckingEvent('video', 'started');  // Duck to 20
      audioRoutingService.setStreamVolume.mockClear();

      await audioRoutingService.handleDuckingEvent('sound', 'started');  // Also duck to 40
      // Video (20) is lower than sound (40), so Spotify stays at 20
      expect(audioRoutingService.setStreamVolume).not.toHaveBeenCalledWith('spotify', 40);
    });

    it('should NOT restore when one source completes but another is still ducking', async () => {
      await audioRoutingService.handleDuckingEvent('video', 'started');  // Duck to 20
      await audioRoutingService.handleDuckingEvent('sound', 'started');  // Also active
      audioRoutingService.setStreamVolume.mockClear();

      await audioRoutingService.handleDuckingEvent('sound', 'completed');  // Sound done

      // Video is still ducking — should NOT restore to 100
      expect(audioRoutingService.setStreamVolume).not.toHaveBeenCalledWith('spotify', 100);
    });

    it('should restore when ALL ducking sources complete', async () => {
      await audioRoutingService.handleDuckingEvent('video', 'started');
      await audioRoutingService.handleDuckingEvent('sound', 'started');
      audioRoutingService.setStreamVolume.mockClear();

      await audioRoutingService.handleDuckingEvent('video', 'completed');
      await audioRoutingService.handleDuckingEvent('sound', 'completed');

      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 100);
    });

    it('should emit ducking:changed event', async () => {
      const duckingHandler = jest.fn();
      audioRoutingService.on('ducking:changed', duckingHandler);

      await audioRoutingService.handleDuckingEvent('video', 'started');

      expect(duckingHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: 'spotify',
          ducked: true,
          volume: 20,
          activeSources: ['video'],
        })
      );

      audioRoutingService.removeListener('ducking:changed', duckingHandler);
    });

    it('should handle duck-on-pause and restore-on-resume', async () => {
      await audioRoutingService.handleDuckingEvent('video', 'started');  // Duck
      audioRoutingService.setStreamVolume.mockClear();

      await audioRoutingService.handleDuckingEvent('video', 'paused');
      // Pause should restore
      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 100);

      audioRoutingService.setStreamVolume.mockClear();

      await audioRoutingService.handleDuckingEvent('video', 'resumed');
      // Resume should re-duck
      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 20);
    });

    it('should no-op when no ducking rules loaded', async () => {
      audioRoutingService.loadDuckingRules([]);
      audioRoutingService.setStreamVolume.mockClear();

      await audioRoutingService.handleDuckingEvent('video', 'started');
      expect(audioRoutingService.setStreamVolume).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Ducking — music stream (alongside spotify)
  // Verifies music is a duck TARGET (not source), with parallel rules
  // matching the production routing.json after Phase 4.2.
  // ══════════════════════════════════════════════════════════════

  describe('Ducking Engine — music stream', () => {
    beforeEach(() => {
      // Production-shape rules (matches routing.json after the music PR):
      // Both spotify AND music are ducked when video/sound plays.
      audioRoutingService.loadDuckingRules([
        { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
        { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 },
        { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
        { when: 'sound', duck: 'music', to: 40, fadeMs: 200 },
      ]);
      jest.spyOn(audioRoutingService, 'setStreamVolume').mockResolvedValue();
    });

    it('ducks BOTH spotify and music when video starts', async () => {
      await audioRoutingService.handleDuckingEvent('video', 'started');

      // Order is not guaranteed; verify both calls happened with correct levels.
      const calls = audioRoutingService.setStreamVolume.mock.calls;
      const spotifyCall = calls.find(c => c[0] === 'spotify');
      const musicCall = calls.find(c => c[0] === 'music');
      expect(spotifyCall).toEqual(['spotify', 20]);
      expect(musicCall).toEqual(['music', 20]);
    });

    it('restores BOTH spotify and music when video completes', async () => {
      await audioRoutingService.handleDuckingEvent('video', 'started');
      audioRoutingService.setStreamVolume.mockClear();

      await audioRoutingService.handleDuckingEvent('video', 'completed');

      const calls = audioRoutingService.setStreamVolume.mock.calls;
      // _capturePreDuckVolume() calls getStreamVolume → pactl, falling back to
      // 100 when pactl returns null. In integration tests with no real MPD
      // sink, both spotify and music fall back to 100.
      expect(calls).toContainEqual(['spotify', 100]);
      expect(calls).toContainEqual(['music', 100]);
    });

    it('captures live pre-duck music volume (not a hardcoded default)', async () => {
      // Simulate pactl reporting a real volume of 55 for music's sink-input.
      // _capturePreDuckVolume should capture and use this value on restore.
      jest.spyOn(audioRoutingService, 'getStreamVolume')
        .mockImplementation(async (stream) => (stream === 'music' ? 55 : 100));

      await audioRoutingService.handleDuckingEvent('video', 'started');
      audioRoutingService.setStreamVolume.mockClear();

      await audioRoutingService.handleDuckingEvent('video', 'completed');

      const calls = audioRoutingService.setStreamVolume.mock.calls;
      expect(calls).toContainEqual(['music', 55]);
    });

    it('keeps lowest volume when video+sound both active for music', async () => {
      await audioRoutingService.handleDuckingEvent('video', 'started');  // music → 20
      audioRoutingService.setStreamVolume.mockClear();
      await audioRoutingService.handleDuckingEvent('sound', 'started');  // music would-be 40

      // Positive assertion: ANY music call must be to 20 (the lower of the
      // two ducks). A regression to 25, 30, or any other value would slip
      // past the original `not.toHaveBeenCalledWith(...,40)` check.
      const musicCalls = audioRoutingService.setStreamVolume.mock.calls
        .filter(c => c[0] === 'music');
      // Engine may re-affirm the existing value (call with 20) or be a no-op
      // (call count 0). Both are acceptable. What's NOT acceptable is any
      // call with a value other than 20.
      for (const call of musicCalls) {
        expect(call[1]).toBe(20);
      }
    });

    it('restores music only when ALL ducking sources complete', async () => {
      await audioRoutingService.handleDuckingEvent('video', 'started');
      await audioRoutingService.handleDuckingEvent('sound', 'started');
      audioRoutingService.setStreamVolume.mockClear();

      await audioRoutingService.handleDuckingEvent('sound', 'completed');
      // Video still active → music NOT restored
      const musicRestoreCalls1 = audioRoutingService.setStreamVolume.mock.calls
        .filter(c => c[0] === 'music' && c[1] !== 20 && c[1] !== 40);
      expect(musicRestoreCalls1).toEqual([]);

      await audioRoutingService.handleDuckingEvent('video', 'completed');
      // Now ALL sources done → music restored (to pactl fallback 100)
      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('music', 100);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Per-Stream Volume Control
  // ══════════════════════════════════════════════════════════════

  describe('Per-Stream Volume', () => {
    beforeEach(() => {
      // Mock external pactl calls so setStreamVolume/getStreamVolume work
      jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: '42' });
      jest.spyOn(audioRoutingService, '_execFile').mockResolvedValue('');
    });

    it('should set stream volume via pactl', async () => {
      await audioRoutingService.setStreamVolume('spotify', 50);

      expect(audioRoutingService._execFile).toHaveBeenCalledWith(
        'pactl',
        expect.arrayContaining(['set-sink-input-volume', '42'])
      );
    });

    it('should reject invalid stream names', async () => {
      await expect(audioRoutingService.setStreamVolume('invalid', 50))
        .rejects.toThrow();
    });

    it('should clamp volume to 0-100 range', async () => {
      await audioRoutingService.setStreamVolume('video', 150);

      // Should clamp to 100% (not 150%)
      expect(audioRoutingService._execFile).toHaveBeenCalledWith(
        'pactl',
        ['set-sink-input-volume', '42', '100%']
      );
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Routing Inheritance in Cue Engine
  // ══════════════════════════════════════════════════════════════

  describe('Routing Inheritance', () => {
    beforeEach(() => {
      mockExecuteCommand.mockClear();
    });

    it('should inject cue-level routing into dispatched commands', async () => {
      cueEngineService.loadCues([{
        id: 'routed-cue',
        label: 'Routed',
        routing: { sound: 'bt-right' },
        timeline: [
          { at: 0, action: 'sound:play', payload: { file: 'door.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('routed-cue');
      await new Promise(r => setImmediate(r));

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sound:play',
          payload: expect.objectContaining({ target: 'bt-right' }),
        })
      );
    });

    it('should prefer command-level target over cue-level routing', async () => {
      cueEngineService.loadCues([{
        id: 'override-cue',
        label: 'Override',
        routing: { sound: 'bt-right' },
        timeline: [
          { at: 0, action: 'sound:play', payload: { file: 'alert.wav', target: 'bt-left' } },
        ],
      }]);

      await cueEngineService.fireCue('override-cue');
      await new Promise(r => setImmediate(r));

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ target: 'bt-left' }),
        })
      );
    });

    it('should not inject target when no routing defined', async () => {
      cueEngineService.loadCues([{
        id: 'no-routing-cue',
        label: 'No Routing',
        timeline: [
          { at: 0, action: 'sound:play', payload: { file: 'plain.wav' } },
        ],
      }]);

      await cueEngineService.fireCue('no-routing-cue');
      await new Promise(r => setImmediate(r));

      expect(mockExecuteCommand).toHaveBeenCalled();
      const call = mockExecuteCommand.mock.calls[0][0];
      expect(call.payload.target).toBeUndefined();
    });
  });
});
