/**
 * Unit Tests: Phase 1 Broadcasts - Game Clock, Cue Engine, Sound Service
 *
 * Tests that new Phase 1 services are correctly wired into the broadcast layer.
 * Follows the same pattern as broadcasts.test.js for consistency.
 */

'use strict';

const EventEmitter = require('events');
const broadcasts = require('../../../src/websocket/broadcasts');
const { setupBroadcastListeners, cleanupBroadcastListeners } = broadcasts;
const syncHelpers = require('../../../src/websocket/syncHelpers');

describe('Phase 1 Broadcasts', () => {
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
    mockAudioRoutingService.handleDuckingEvent = jest.fn();
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
      { id: 'cue-1', name: 'Test Cue', type: 'simple' }
    ]);
    mockCueEngineService.getDisabledCues = jest.fn().mockReturnValue([]);
    mockCueEngineService.getCues = jest.fn().mockReturnValue([
      { id: 'cue-1', name: 'Test Cue', type: 'simple' }
    ]);
    mockCueEngineService.getActiveCues = jest.fn().mockReturnValue([]);

    mockSoundService = new EventEmitter();
    mockSoundService.getPlaying = jest.fn().mockReturnValue([]);
  });

  afterEach(() => {
    cleanupBroadcastListeners();
  });

  describe('Game Clock Broadcasts', () => {
    it('should broadcast gameclock:status on gameclock:started', () => {
      setupBroadcasts();

      // Trigger gameclock:started event
      mockGameClockService.emit('gameclock:started', { gameStartTime: 1234567890 });

      // Assert: emitToRoom called for GM room with gameclock:status event
      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'gameclock:status',
        expect.objectContaining({
          event: 'gameclock:status',
          data: expect.objectContaining({
            state: 'running',
            elapsed: 0
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should broadcast gameclock:status on gameclock:paused', () => {
      setupBroadcasts();

      // Trigger gameclock:paused event
      mockGameClockService.emit('gameclock:paused', { elapsed: 300 });

      // Assert: emitToRoom called for GM room with gameclock:status event
      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'gameclock:status',
        expect.objectContaining({
          event: 'gameclock:status',
          data: expect.objectContaining({
            state: 'paused',
            elapsed: 300
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should broadcast gameclock:status on gameclock:resumed', () => {
      setupBroadcasts();

      // Trigger gameclock:resumed event
      mockGameClockService.emit('gameclock:resumed', { elapsed: 450 });

      // Assert: emitToRoom called for GM room with gameclock:status event
      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'gameclock:status',
        expect.objectContaining({
          event: 'gameclock:status',
          data: expect.objectContaining({
            state: 'running',
            elapsed: 450
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });
  });

  describe('Cue Engine Broadcasts', () => {
    it('should broadcast cue:fired on cueEngineService cue:fired', () => {
      setupBroadcasts();

      const cueData = { cueId: 'cue-1', name: 'Test Cue', commands: [] };
      mockCueEngineService.emit('cue:fired', cueData);

      // Assert: emitToRoom called for GM room with cue:fired event
      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'cue:fired',
        expect.objectContaining({
          event: 'cue:fired',
          data: cueData,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should broadcast cue:completed on cueEngineService cue:completed', () => {
      setupBroadcasts();

      const cueData = { cueId: 'cue-1' };
      mockCueEngineService.emit('cue:completed', cueData);

      // Assert: emitToRoom called for GM room with cue:completed event
      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'cue:completed',
        expect.objectContaining({
          event: 'cue:completed',
          data: cueData,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should broadcast cue:error on cueEngineService cue:error', () => {
      setupBroadcasts();

      const errorData = { cueId: 'cue-1', error: 'Test error' };
      mockCueEngineService.emit('cue:error', errorData);

      // Assert: emitToRoom called for GM room with cue:error event
      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'cue:error',
        expect.objectContaining({
          event: 'cue:error',
          data: errorData,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });
  });

  describe('Sound Service Broadcasts', () => {
    it('should broadcast sound:status on soundService sound:started', () => {
      setupBroadcasts();

      // Configure getPlaying to return current playing list
      const playingList = [{ file: 'test.wav', target: 'default', volume: 100, pid: 1234 }];
      mockSoundService.getPlaying.mockReturnValue(playingList);

      mockSoundService.emit('sound:started', { file: 'test.wav' });

      // Assert: emitToRoom called for GM room with sound:status event
      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'sound:status',
        expect.objectContaining({
          event: 'sound:status',
          data: { playing: playingList },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should broadcast sound:status on soundService sound:completed', () => {
      setupBroadcasts();

      // After completion, getPlaying returns empty list
      mockSoundService.getPlaying.mockReturnValue([]);

      mockSoundService.emit('sound:completed', { file: 'test.wav' });

      // Assert: emitToRoom called for GM room with sound:status event
      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'sound:status',
        expect.objectContaining({
          event: 'sound:status',
          data: { playing: [] },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should broadcast sound:status on soundService sound:stopped', () => {
      setupBroadcasts();

      mockSoundService.getPlaying.mockReturnValue([]);

      mockSoundService.emit('sound:stopped', { file: 'test.wav', reason: 'killed' });

      // Assert: emitToRoom called for GM room with sound:status event
      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'sound:status',
        expect.objectContaining({
          event: 'sound:status',
          data: { playing: [] },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });
  });

  describe('sync:full Payload', () => {
    it('should include cueEngine and gameClock in sync:full payload', async () => {
      // Mock services for buildSyncFullPayload
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
      };

      // Configure mocks for sync:full
      mockGameClockService.getState.mockReturnValue({
        status: 'running',
        elapsed: 600,
        startTime: 1234567890,
        totalPausedMs: 0
      });

      mockCueEngineService.getCueSummaries.mockReturnValue([
        { id: 'cue-1', name: 'Test Cue', type: 'simple' }
      ]);

      mockCueEngineService.getDisabledCues.mockReturnValue(['cue-disabled']);

      // Call buildSyncFullPayload
      const payload = await syncHelpers.buildSyncFullPayload(mockServices);

      // Assert: payload includes cueEngine state
      expect(payload.cueEngine).toBeDefined();
      expect(payload.cueEngine.loaded).toBe(true);
      expect(payload.cueEngine.cues).toEqual([
        { id: 'cue-1', name: 'Test Cue', type: 'simple' }
      ]);
      expect(payload.cueEngine.activeCues).toEqual([]);
      expect(payload.cueEngine.disabledCues).toEqual(['cue-disabled']);

      // Assert: payload includes gameClock state
      expect(payload.gameClock).toBeDefined();
      expect(payload.gameClock.status).toBe('running');
      expect(payload.gameClock.elapsed).toBe(600);
      expect(payload.gameClock.expectedDuration).toBe(7200); // Default 2 hours
    });

    it('should gracefully degrade when cueEngine is unavailable', async () => {
      const mockServices = {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        bluetoothService: mockBluetoothService,
        audioRoutingService: mockAudioRoutingService,
        lightingService: mockLightingService,
        gameClockService: mockGameClockService,
        cueEngineService: null, // Service unavailable
      };

      const payload = await syncHelpers.buildSyncFullPayload(mockServices);

      // Assert: payload includes safe defaults for cueEngine
      expect(payload.cueEngine).toBeDefined();
      expect(payload.cueEngine.loaded).toBe(false);
      expect(payload.cueEngine.cues).toEqual([]);
      expect(payload.cueEngine.activeCues).toEqual([]);
      expect(payload.cueEngine.disabledCues).toEqual([]);
    });

    it('should gracefully degrade when gameClockService is unavailable', async () => {
      const mockServices = {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        bluetoothService: mockBluetoothService,
        audioRoutingService: mockAudioRoutingService,
        lightingService: mockLightingService,
        gameClockService: null, // Service unavailable
        cueEngineService: mockCueEngineService,
      };

      const payload = await syncHelpers.buildSyncFullPayload(mockServices);

      // Assert: payload includes safe defaults for gameClock
      expect(payload.gameClock).toBeDefined();
      expect(payload.gameClock.status).toBe('stopped');
      expect(payload.gameClock.elapsed).toBe(0);
      expect(payload.gameClock.expectedDuration).toBe(7200);
    });
  });
});
