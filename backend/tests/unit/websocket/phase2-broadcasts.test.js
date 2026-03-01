/**
 * Unit Tests: sync:full Payload - Spotify, Cue Engine, Service Health, Held Items
 *
 * Tests that sync:full payload includes spotify, cueEngine, serviceHealth,
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
  let mockStateService;
  let mockVideoQueueService;
  let mockOfflineQueueService;
  let mockBluetoothService;
  let mockAudioRoutingService;
  let mockLightingService;
  let mockGameClockService;
  let mockCueEngineService;
  let mockSoundService;
  let mockSpotifyService;

  /**
   * Helper: Setup broadcast listeners with all mock services
   */
  const setupBroadcasts = () => {
    setupBroadcastListeners(mockIo, {
      sessionService: mockSessionService,
      transactionService: mockTransactionService,
      stateService: mockStateService,
      videoQueueService: mockVideoQueueService,
      offlineQueueService: mockOfflineQueueService,
      bluetoothService: mockBluetoothService,
      audioRoutingService: mockAudioRoutingService,
      lightingService: mockLightingService,
      gameClockService: mockGameClockService,
      cueEngineService: mockCueEngineService,
      soundService: mockSoundService,
      spotifyService: mockSpotifyService,
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

    mockStateService = new EventEmitter();
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
      routes: {}, defaultSink: 'hdmi', combineSinkActive: false, ducking: {},
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

    // Mock Phase 2 service: Spotify
    mockSpotifyService = new EventEmitter();
    mockSpotifyService.getState = jest.fn().mockReturnValue({
      connected: true,
      state: 'playing',
      volume: 80,
      pausedByGameClock: false,
    });
    mockSpotifyService.connected = true;
    mockSpotifyService.state = 'playing';
    mockSpotifyService.volume = 80;
  });

  afterEach(() => {
    cleanupBroadcastListeners();
  });

  // ================================================================
  // sync:full Payload Expansion
  // ================================================================

  describe('sync:full Payload - Phase 2 Expansion', () => {
    it('should include spotify state in sync:full payload', async () => {
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
        spotifyService: mockSpotifyService,
      };

      const payload = await syncHelpers.buildSyncFullPayload(mockServices);

      expect(payload.spotify).toBeDefined();
      expect(payload.spotify).toEqual({
        connected: true,
        state: 'playing',
        volume: 80,
        pausedByGameClock: false,
      });
    });

    it('should gracefully degrade when spotifyService is unavailable', async () => {
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
        spotifyService: null,
      };

      const payload = await syncHelpers.buildSyncFullPayload(mockServices);

      expect(payload.spotify).toBeDefined();
      expect(payload.spotify).toEqual({
        connected: false,
        state: 'stopped',
        volume: 100,
        pausedByGameClock: false,
      });
    });

    it('should gracefully degrade when spotifyService.getState throws', async () => {
      const brokenSpotify = new EventEmitter();
      brokenSpotify.getState = jest.fn().mockImplementation(() => {
        throw new Error('D-Bus not available');
      });

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
        spotifyService: brokenSpotify,
      };

      const payload = await syncHelpers.buildSyncFullPayload(mockServices);

      expect(payload.spotify).toBeDefined();
      expect(payload.spotify.connected).toBe(false);
    });

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
        spotifyService: mockSpotifyService,
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
        spotifyService: mockSpotifyService,
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
        spotifyService: mockSpotifyService,
      };

      const payload = await syncHelpers.buildSyncFullPayload(mockServices);

      expect(payload.cueEngine.loaded).toBe(false);
    });
  });
});
