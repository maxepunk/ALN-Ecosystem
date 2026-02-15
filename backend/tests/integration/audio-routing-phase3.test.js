/**
 * Audio Routing Phase 3 Integration Tests
 *
 * Tests end-to-end flows for Phase 3 features:
 * 1. Ducking engine — video/sound lifecycle auto-ducks Spotify volume
 * 2. Combine-sink management — virtual combine-bt sink for dual BT speakers
 * 3. Per-stream volume control — setStreamVolume/getStreamVolume
 * 4. Routing inheritance — cue-level routing injected at dispatch time
 *
 * External dependencies (pactl, pw-loopback) are mocked at the service level.
 * The tests verify internal service coordination, NOT external tools.
 */

'use strict';

const audioRoutingService = require('../../src/services/audioRoutingService');
const cueEngineService = require('../../src/services/cueEngineService');

// Mock commandExecutor at module level so cueEngineService's require picks it up
const mockExecuteCommand = jest.fn().mockResolvedValue({ success: true, broadcasts: [] });
jest.mock('../../src/services/commandExecutor', () => ({
  executeCommand: (...args) => mockExecuteCommand(...args),
}));

describe('Audio Routing Phase 3 Integration', () => {

  beforeEach(() => {
    // Reset ducking state
    audioRoutingService.loadDuckingRules([]);
    // Reset stream volumes
    audioRoutingService._streamVolumes = { video: 100, spotify: 100, sound: 100 };
    // Reset combine-sink state
    audioRoutingService._combineSinkActive = false;
    audioRoutingService._combineSinkPids = [];
    audioRoutingService._combineSinkProcs = [];
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

    it('should duck Spotify when video starts', () => {
      audioRoutingService.handleDuckingEvent('video', 'started');

      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 20);
    });

    it('should restore Spotify volume when video completes', () => {
      audioRoutingService.handleDuckingEvent('video', 'started');
      audioRoutingService.setStreamVolume.mockClear();

      audioRoutingService.handleDuckingEvent('video', 'completed');

      // Restore to pre-duck volume (100)
      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 100);
    });

    it('should keep lowest volume when multiple sources duck simultaneously', () => {
      audioRoutingService.handleDuckingEvent('video', 'started');  // Duck to 20
      audioRoutingService.setStreamVolume.mockClear();

      audioRoutingService.handleDuckingEvent('sound', 'started');  // Also duck to 40
      // Video (20) is lower than sound (40), so Spotify stays at 20
      expect(audioRoutingService.setStreamVolume).not.toHaveBeenCalledWith('spotify', 40);
    });

    it('should NOT restore when one source completes but another is still ducking', () => {
      audioRoutingService.handleDuckingEvent('video', 'started');  // Duck to 20
      audioRoutingService.handleDuckingEvent('sound', 'started');  // Also active
      audioRoutingService.setStreamVolume.mockClear();

      audioRoutingService.handleDuckingEvent('sound', 'completed');  // Sound done

      // Video is still ducking — should NOT restore to 100
      expect(audioRoutingService.setStreamVolume).not.toHaveBeenCalledWith('spotify', 100);
    });

    it('should restore when ALL ducking sources complete', () => {
      audioRoutingService.handleDuckingEvent('video', 'started');
      audioRoutingService.handleDuckingEvent('sound', 'started');
      audioRoutingService.setStreamVolume.mockClear();

      audioRoutingService.handleDuckingEvent('video', 'completed');
      audioRoutingService.handleDuckingEvent('sound', 'completed');

      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 100);
    });

    it('should emit ducking:changed event', () => {
      const duckingHandler = jest.fn();
      audioRoutingService.on('ducking:changed', duckingHandler);

      audioRoutingService.handleDuckingEvent('video', 'started');

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

    it('should handle duck-on-pause and restore-on-resume', () => {
      audioRoutingService.handleDuckingEvent('video', 'started');  // Duck
      audioRoutingService.setStreamVolume.mockClear();

      audioRoutingService.handleDuckingEvent('video', 'paused');
      // Pause should restore
      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 100);

      audioRoutingService.setStreamVolume.mockClear();

      audioRoutingService.handleDuckingEvent('video', 'resumed');
      // Resume should re-duck
      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 20);
    });

    it('should no-op when no ducking rules loaded', () => {
      audioRoutingService.loadDuckingRules([]);
      audioRoutingService.setStreamVolume.mockClear();

      audioRoutingService.handleDuckingEvent('video', 'started');
      expect(audioRoutingService.setStreamVolume).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Combine-Sink Management
  // ══════════════════════════════════════════════════════════════

  describe('Combine-Sink Management', () => {
    it('should create combine-sink when 2 BT speakers available', async () => {
      jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
        { name: 'bluez_output.AA.a2dp', type: 'bluetooth' },
        { name: 'bluez_output.BB.a2dp', type: 'bluetooth' },
      ]);
      // Mock spawn to prevent real pw-loopback
      const mockProc = { pid: 1234, on: jest.fn(), kill: jest.fn() };
      jest.spyOn(require('child_process'), 'spawn').mockReturnValue(mockProc);

      await audioRoutingService.createCombineSink();

      expect(audioRoutingService._combineSinkActive).toBe(true);
    });

    it('should reject combine-sink with fewer than 2 BT speakers', async () => {
      jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
        { name: 'bluez_output.AA.a2dp', type: 'bluetooth' },
      ]);

      await expect(audioRoutingService.createCombineSink()).rejects.toThrow(/Need at least 2/);
      expect(audioRoutingService._combineSinkActive).toBe(false);
    });

    it('should include virtual combine-bt sink when active', async () => {
      audioRoutingService._combineSinkActive = true;
      jest.spyOn(audioRoutingService, 'getAvailableSinks').mockResolvedValue([
        { name: 'hdmi', type: 'hdmi' },
      ]);

      const sinks = await audioRoutingService.getAvailableSinksWithCombine();
      const combineSink = sinks.find(s => s.name === 'combine-bt');

      expect(combineSink).toBeDefined();
      expect(combineSink.virtual).toBe(true);
    });

    it('should NOT include combine-bt when inactive', async () => {
      audioRoutingService._combineSinkActive = false;
      jest.spyOn(audioRoutingService, 'getAvailableSinks').mockResolvedValue([
        { name: 'hdmi', type: 'hdmi' },
      ]);

      const sinks = await audioRoutingService.getAvailableSinksWithCombine();
      expect(sinks.find(s => s.name === 'combine-bt')).toBeUndefined();
    });

    it('should clean up combine-sink on destroy', async () => {
      const mockProc = { pid: 999, kill: jest.fn(), on: jest.fn() };
      audioRoutingService._combineSinkActive = true;
      audioRoutingService._combineSinkPids = [999];
      audioRoutingService._combineSinkProcs = [mockProc];

      await audioRoutingService.destroyCombineSink();

      expect(audioRoutingService._combineSinkActive).toBe(false);
      expect(audioRoutingService._combineSinkPids).toHaveLength(0);
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
