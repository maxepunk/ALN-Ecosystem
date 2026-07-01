/**
 * Unit Tests: sync:full Payload - Cue Engine, Service Health, Held Items
 *
 * Tests that sync:full payload includes cueEngine, serviceHealth,
 * and heldItems state from their respective services.
 */

'use strict';

const EventEmitter = require('events');
const broadcasts = require('../../../src/websocket/broadcasts');
const { setupBroadcastListeners, cleanupBroadcastListeners } = broadcasts;
const syncHelpers = require('../../../src/websocket/syncHelpers');

describe('Phase 2 Broadcasts', () => {
  let mockIo;
  let mockSessionService;
  let mockTransactionService;
  let mockVideoQueueService;
  let mockOfflineQueueService;
  let mockBluetoothService;
  let mockAudioRoutingService;
  let mockLightingService;
  let mockGameClockService;
  let mockCueEngineService;
  let mockSoundService;

  /**
   * Helper: Setup broadcast listeners with all mock services
   */
  const setupBroadcasts = () => {
    setupBroadcastListeners(mockIo, {
      sessionService: mockSessionService,
      transactionService: mockTransactionService,
      videoQueueService: mockVideoQueueService,
      offlineQueueService: mockOfflineQueueService,
      bluetoothService: mockBluetoothService,
      audioRoutingService: mockAudioRoutingService,
      lightingService: mockLightingService,
      gameClockService: mockGameClockService,
      cueEngineService: mockCueEngineService,
      soundService: mockSoundService,
    });
  };

  beforeEach(() => {
    // Mock Socket.io server
    mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      sockets: {
        sockets: new Map(),
        adapter: {
          rooms: new Map()
        }
      }
    };

    // Mock core services (required by setupBroadcastListeners)
    mockSessionService = new EventEmitter();
    mockSessionService.getCurrentSession = jest.fn().mockReturnValue({
      id: 'session-123',
      transactions: [],
      playerScans: [],
      connectedDevices: [],
      toJSON: function() {
        return {
          id: this.id,
          transactions: this.transactions,
          playerScans: this.playerScans,
          connectedDevices: this.connectedDevices
        };
      }
    });

    mockTransactionService = new EventEmitter();
    mockTransactionService.getToken = jest.fn().mockReturnValue({
      memoryType: 'TEST_TYPE',
      metadata: { rating: 5, group: 'TEST_GROUP' }
    });
    mockTransactionService.getTeamScores = jest.fn().mockReturnValue([]);

    mockVideoQueueService = new EventEmitter();
    mockVideoQueueService.getQueueItems = jest.fn().mockReturnValue([]);
    mockVideoQueueService.getState = jest.fn().mockReturnValue({
      status: 'idle', currentVideo: null, queue: [], queueLength: 0, connected: false,
    });
    mockOfflineQueueService = new EventEmitter();

    // Mock environment services (Phase 0)
    mockBluetoothService = new EventEmitter();
    mockBluetoothService.getState = jest.fn().mockReturnValue({
      scanning: false, pairedDevices: [], connectedDevices: [],
    });
    mockAudioRoutingService = new EventEmitter();
    mockAudioRoutingService.handleDuckingEvent = jest.fn();
    mockAudioRoutingService.getState = jest.fn().mockReturnValue({
      routes: {}, defaultSink: 'hdmi', ducking: {},
    });
    mockLightingService = new EventEmitter();
    mockLightingService.getState = jest.fn().mockReturnValue({
      connected: false, activeScene: null, scenes: [],
    });

    // Mock Phase 1 services
    mockGameClockService = new EventEmitter();
    mockGameClockService.getState = jest.fn().mockReturnValue({
      status: 'stopped',
      elapsed: 0,
      startTime: null,
      totalPausedMs: 0
    });

    mockCueEngineService = new EventEmitter();
    mockCueEngineService.getCueSummaries = jest.fn().mockReturnValue([
      { id: 'cue-1', label: 'Test Cue', quickFire: false }
    ]);
    mockCueEngineService.getDisabledCues = jest.fn().mockReturnValue([]);
    mockCueEngineService.getActiveCues = jest.fn().mockReturnValue([]);
    mockCueEngineService.getCues = jest.fn().mockReturnValue([
      { id: 'cue-1', label: 'Test Cue', quickFire: false }
    ]);
    mockCueEngineService.getState = jest.fn().mockReturnValue({
      cues: [{ id: 'cue-1', label: 'Test Cue', quickFire: false }], activeCues: [], disabledCues: [],
    });

    mockSoundService = new EventEmitter();
    mockSoundService.getPlaying = jest.fn().mockReturnValue([]);
    mockSoundService.getState = jest.fn().mockReturnValue({ playing: [] });
  });

  afterEach(() => {
    cleanupBroadcastListeners();
  });

  // ================================================================
  // sync:full Payload Expansion
  // ================================================================

  describe('sync:full Payload - Phase 2 Expansion', () => {
    it('should include activeCues from cueEngineService in sync:full payload', async () => {
      // Configure mock to return active cues
      mockCueEngineService.getActiveCues.mockReturnValue([
        { cueId: 'compound-1', state: 'running', progress: 30, duration: 120 },
        { cueId: 'compound-2', state: 'paused', progress: 10, duration: 60 },
      ]);

      const mockServices = {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        bluetoothService: mockBluetoothService,
        audioRoutingService: mockAudioRoutingService,
        lightingService: mockLightingService,
        gameClockService: mockGameClockService,
        cueEngineService: mockCueEngineService,
        soundService: mockSoundService,
      };

      const payload = await syncHelpers.buildSyncFullPayload(mockServices);

      expect(payload.cueEngine).toBeDefined();
      expect(payload.cueEngine.activeCues).toEqual([
        { cueId: 'compound-1', state: 'running', progress: 30, duration: 120 },
        { cueId: 'compound-2', state: 'paused', progress: 10, duration: 60 },
      ]);
    });

    it('should use getCues().length for loaded flag', async () => {
      // When cueEngineService has cues loaded
      mockCueEngineService.getCues = jest.fn().mockReturnValue([
        { id: 'cue-1' }, { id: 'cue-2' }
      ]);

      const mockServices = {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        bluetoothService: mockBluetoothService,
        audioRoutingService: mockAudioRoutingService,
        lightingService: mockLightingService,
        gameClockService: mockGameClockService,
        cueEngineService: mockCueEngineService,
        soundService: mockSoundService,
      };

      const payload = await syncHelpers.buildSyncFullPayload(mockServices);

      expect(payload.cueEngine.loaded).toBe(true);
    });

    it('should set loaded=false when no cues loaded', async () => {
      mockCueEngineService.getCues = jest.fn().mockReturnValue([]);

      const mockServices = {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        bluetoothService: mockBluetoothService,
        audioRoutingService: mockAudioRoutingService,
        lightingService: mockLightingService,
        gameClockService: mockGameClockService,
        cueEngineService: mockCueEngineService,
        soundService: mockSoundService,
      };

      const payload = await syncHelpers.buildSyncFullPayload(mockServices);

      expect(payload.cueEngine.loaded).toBe(false);
    });
  });

  describe('Sound → ducking wiring (underflow guard)', () => {
    let prevAudioWires;
    beforeEach(() => {
      prevAudioWires = process.env.ENABLE_AUDIO_WIRES;
      process.env.ENABLE_AUDIO_WIRES = 'true'; // the sound→ducking wires are env-gated
      // The wiring does handleDuckingEvent(...).catch(...) — it must return a promise.
      mockAudioRoutingService.handleDuckingEvent = jest.fn().mockResolvedValue();
    });
    afterEach(() => {
      if (prevAudioWires === undefined) delete process.env.ENABLE_AUDIO_WIRES;
      else process.env.ENABLE_AUDIO_WIRES = prevAudioWires;
    });

    it('does NOT forward sound:error to a duck-stop (a never-started sound never ducked)', () => {
      setupBroadcasts();
      // A bad-file / path-escape / spawn-ENOENT sound emits sound:error WITHOUT ever
      // emitting sound:started (which is pid-gated), so it never ducked music.
      // Forwarding it as ('sound','completed') would decrement the shared 'sound'
      // duck count and restore music mid-playback of a concurrent LIVE sound.
      mockSoundService.emit('sound:error', { file: 'missing.wav', error: 'File not found' });
      expect(mockAudioRoutingService.handleDuckingEvent).not.toHaveBeenCalledWith('sound', 'completed');
    });

    it('still forwards sound:stopped as a duck-stop (post-start failures DO un-duck)', () => {
      setupBroadcasts();
      // A sound that started and was killed/failed exits via close → sound:stopped;
      // this MUST still release the duck so music does not stay ducked forever.
      mockSoundService.emit('sound:stopped', { file: 'a.wav', pid: 123, reason: 'killed' });
      expect(mockAudioRoutingService.handleDuckingEvent).toHaveBeenCalledWith('sound', 'completed');
    });
  });
});
