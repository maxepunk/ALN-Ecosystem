/**
 * Consolidated getState() Tests
 *
 * Verifies that every service with a getState() method returns the expected
 * shape and reflects state changes after operations.
 */

// ── bluetoothService ──
jest.mock('../../../src/utils/execHelper', () => ({
  execFileAsync: jest.fn().mockResolvedValue(''),
}));

const registry = require('../../../src/services/serviceHealthRegistry');

describe('Service getState() Methods', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('bluetoothService.getState()', () => {
    let bluetoothService;

    beforeEach(() => {
      jest.isolateModules(() => {
        bluetoothService = require('../../../src/services/bluetoothService');
      });
      bluetoothService.reset();
    });

    afterEach(() => {
      bluetoothService.reset();
    });

    it('should return expected shape with empty state', () => {
      const state = bluetoothService.getState();
      expect(state).toEqual({
        scanning: false,
        pairedDevices: [],
        connectedDevices: [],
      });
    });

    it('should reflect cached device state', () => {
      // Pre-seed the cache (simulates device discovery)
      bluetoothService._cachedDeviceStates.set('AA:BB:CC:DD:EE:FF', {
        connected: true,
        paired: true,
        name: 'Speaker 1',
      });
      bluetoothService._cachedDeviceStates.set('11:22:33:44:55:66', {
        connected: false,
        paired: true,
        name: 'Speaker 2',
      });

      const state = bluetoothService.getState();
      expect(state.pairedDevices).toHaveLength(2);
      expect(state.connectedDevices).toHaveLength(1);
      expect(state.connectedDevices[0].address).toBe('AA:BB:CC:DD:EE:FF');
      expect(state.connectedDevices[0].name).toBe('Speaker 1');
    });
  });

  describe('audioRoutingService.getState()', () => {
    let audioRoutingService;

    beforeEach(() => {
      jest.isolateModules(() => {
        audioRoutingService = require('../../../src/services/audioRoutingService');
      });
      audioRoutingService.reset();
    });

    afterEach(() => {
      audioRoutingService.reset();
    });

    it('should return expected shape', () => {
      const state = audioRoutingService.getState();
      expect(state).toHaveProperty('routes');
      expect(state).toHaveProperty('defaultSink');
      expect(state).toHaveProperty('combineSinkActive', false);
      expect(state).toHaveProperty('ducking');
      expect(typeof state.routes).toBe('object');
    });

    it('should reflect route changes', () => {
      audioRoutingService.setStreamRoute('video', 'bluetooth');
      const state = audioRoutingService.getState();
      expect(state.routes.video).toBe('bluetooth');
    });
  });

  describe('lightingService.getState()', () => {
    let lightingService;

    beforeEach(() => {
      jest.isolateModules(() => {
        lightingService = require('../../../src/services/lightingService');
      });
      lightingService.reset();
    });

    afterEach(() => {
      lightingService.reset();
    });

    it('should return expected shape', () => {
      const state = lightingService.getState();
      expect(state).toEqual({
        connected: false,
        activeScene: null,
        scenes: [],
      });
    });

    it('should reflect scene cache', () => {
      lightingService._scenes = [{ id: 'scene.game', name: 'Game' }];
      lightingService._activeScene = 'scene.game';
      const state = lightingService.getState();
      expect(state.scenes).toHaveLength(1);
      expect(state.activeScene).toBe('scene.game');
    });
  });

  describe('soundService.getState()', () => {
    let soundService;

    beforeEach(() => {
      jest.isolateModules(() => {
        soundService = require('../../../src/services/soundService');
      });
      soundService.reset();
    });

    afterEach(() => {
      soundService.reset();
    });

    it('should return expected shape with nothing playing', () => {
      const state = soundService.getState();
      expect(state).toEqual({ playing: [] });
    });

    it('should reflect playing sounds', () => {
      // Simulate a playing sound by directly adding to processes map
      const mockProc = { kill: jest.fn(), on: jest.fn() };
      soundService.processes.set(12345, {
        file: 'test.wav',
        target: 'hdmi',
        volume: 80,
        pid: 12345,
        process: mockProc,
      });
      const state = soundService.getState();
      expect(state.playing).toHaveLength(1);
      expect(state.playing[0].file).toBe('test.wav');
    });
  });

  describe('cueEngineService.getState()', () => {
    let cueEngineService;

    beforeEach(() => {
      jest.isolateModules(() => {
        cueEngineService = require('../../../src/services/cueEngineService');
      });
      cueEngineService.reset();
    });

    afterEach(() => {
      cueEngineService.reset();
    });

    it('should return expected shape with no cues loaded', () => {
      const state = cueEngineService.getState();
      expect(state).toEqual({
        cues: [],
        activeCues: [],
        disabledCues: [],
      });
    });

    it('should reflect loaded cues', () => {
      cueEngineService.loadCues([
        { id: 'cue-1', label: 'Test Cue', commands: [{ action: 'sound:play' }] },
      ]);
      const state = cueEngineService.getState();
      expect(state.cues).toHaveLength(1);
      expect(state.cues[0].id).toBe('cue-1');
    });

    it('should reflect disabled cues', () => {
      cueEngineService.loadCues([
        { id: 'cue-1', label: 'Test', trigger: { event: 'test' }, commands: [] },
      ]);
      cueEngineService.disableCue('cue-1');
      const state = cueEngineService.getState();
      expect(state.disabledCues).toContain('cue-1');
    });
  });

  describe('serviceHealthRegistry.getState()', () => {
    it('should return same result as getSnapshot()', () => {
      const state = registry.getState();
      const snapshot = registry.getSnapshot();
      expect(state).toEqual(snapshot);
    });

    it('should reflect reported health', () => {
      registry.report('vlc', 'healthy', 'test');
      const state = registry.getState();
      expect(state.vlc.status).toBe('healthy');
    });
  });

  describe('videoQueueService.getState()', () => {
    let videoQueueService;

    beforeEach(() => {
      jest.isolateModules(() => {
        videoQueueService = require('../../../src/services/videoQueueService');
      });
      videoQueueService.reset();
    });

    afterEach(() => {
      videoQueueService.reset();
    });

    it('should return expected shape when idle', () => {
      const state = videoQueueService.getState();
      expect(state).toEqual({
        status: 'idle',
        currentVideo: null,
        queue: [],
        queueLength: 0,
        connected: expect.any(Boolean),
      });
    });

    it('should include connected state from vlcService', () => {
      const state = videoQueueService.getState();
      expect(typeof state.connected).toBe('boolean');
    });
  });

  describe('gameClockService.getState()', () => {
    let gameClockService;

    beforeEach(() => {
      jest.isolateModules(() => {
        gameClockService = require('../../../src/services/gameClockService');
      });
      gameClockService.reset();
    });

    afterEach(() => {
      gameClockService.reset();
    });

    it('should return expected shape', () => {
      const state = gameClockService.getState();
      expect(state).toHaveProperty('status', 'stopped');
      expect(state).toHaveProperty('elapsed', 0);
    });

    it('should reflect running state', () => {
      gameClockService.start();
      const state = gameClockService.getState();
      expect(state.status).toBe('running');
      gameClockService.reset();
    });
  });

  describe('spotifyService.getState()', () => {
    let spotifyService;

    beforeEach(() => {
      jest.isolateModules(() => {
        spotifyService = require('../../../src/services/spotifyService');
      });
    });

    it('should return expected shape', () => {
      const state = spotifyService.getState();
      expect(state).toHaveProperty('connected');
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('volume');
      expect(state).toHaveProperty('track');
      expect(state).toHaveProperty('pausedByGameClock');
    });
  });

  describe('vlcMprisService.getState()', () => {
    let vlcService;

    beforeEach(() => {
      jest.isolateModules(() => {
        vlcService = require('../../../src/services/vlcMprisService');
      });
    });

    it('should return expected shape (inherited from MprisPlayerBase)', () => {
      const state = vlcService.getState();
      expect(state).toHaveProperty('connected');
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('volume');
      expect(state).toHaveProperty('track');
    });
  });
});
