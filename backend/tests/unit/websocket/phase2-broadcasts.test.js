/**
 * Unit Tests: Phase 2 Broadcasts - Compound Cue Lifecycle + Spotify Status
 *
 * Tests that Phase 2 cue engine events (cue:started, cue:paused, cue:conflict)
 * and Spotify service events (playback:changed, volume:changed) are correctly
 * wired into the broadcast layer.
 *
 * Also tests sync:full payload expansion with spotify state and activeCues.
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
    mockOfflineQueueService = new EventEmitter();

    // Mock environment services (Phase 0)
    mockBluetoothService = new EventEmitter();
    mockAudioRoutingService = new EventEmitter();
    mockLightingService = new EventEmitter();

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

    mockSoundService = new EventEmitter();
    mockSoundService.getPlaying = jest.fn().mockReturnValue([]);

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
  // Phase 2 Compound Cue Lifecycle Broadcasts
  // ================================================================

  describe('Compound Cue Lifecycle Broadcasts', () => {
    it('should broadcast cue:status with state=running on cue:started', () => {
      setupBroadcasts();

      const data = { cueId: 'compound-1', hasVideo: true, duration: 120 };
      mockCueEngineService.emit('cue:started', data);

      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'cue:status',
        expect.objectContaining({
          event: 'cue:status',
          data: expect.objectContaining({
            cueId: 'compound-1',
            hasVideo: true,
            duration: 120,
            state: 'running',
            progress: 0,
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should broadcast cue:status on cue:status event', () => {
      setupBroadcasts();

      const data = { cueId: 'compound-1', state: 'paused' };
      mockCueEngineService.emit('cue:status', data);

      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'cue:status',
        expect.objectContaining({
          event: 'cue:status',
          data: expect.objectContaining({
            cueId: 'compound-1',
            state: 'paused',
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should broadcast cue:conflict on cue:conflict', () => {
      setupBroadcasts();

      const data = {
        cueId: 'compound-2',
        reason: 'Video conflict',
        currentVideo: { tokenId: 'token-1' },
        autoCancel: true,
        autoCancelMs: 10000,
      };
      mockCueEngineService.emit('cue:conflict', data);

      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'cue:conflict',
        expect.objectContaining({
          event: 'cue:conflict',
          data: expect.objectContaining({
            cueId: 'compound-2',
            reason: 'Video conflict',
            autoCancel: true,
            autoCancelMs: 10000,
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });
  });

  // ================================================================
  // Spotify Broadcasts
  // ================================================================

  describe('Spotify Broadcasts', () => {
    it('should broadcast spotify:status on playback:changed', () => {
      setupBroadcasts();

      mockSpotifyService.emit('playback:changed', { state: 'playing' });

      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'spotify:status',
        expect.objectContaining({
          event: 'spotify:status',
          data: expect.objectContaining({
            connected: true,
            state: 'playing',
            volume: 80,
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should broadcast spotify:status on volume:changed', () => {
      setupBroadcasts();

      // Update mock state to reflect volume change
      mockSpotifyService.getState.mockReturnValue({
        connected: true,
        state: 'playing',
        volume: 50,
        pausedByGameClock: false,
      });

      mockSpotifyService.emit('volume:changed', { volume: 50 });

      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'spotify:status',
        expect.objectContaining({
          event: 'spotify:status',
          data: expect.objectContaining({
            connected: true,
            state: 'playing',
            volume: 50,
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should not fail if spotifyService is not provided', () => {
      // Setup without spotify service
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
        // spotifyService omitted
      });

      // Should not throw
      expect(() => {
        // Verify setup completed without error by emitting other events
        mockGameClockService.emit('gameclock:started', {});
      }).not.toThrow();
    });
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
