/**
 * Unit Tests: broadcasts.js - Event Wrapping Logic
 *
 * Tests that broadcasts.js:
 * 1. Listens to service events correctly
 * 2. Uses eventWrapper helpers (emitWrapped, emitToRoom)
 * 3. Creates proper wrapped envelope {event, data, timestamp}
 * 4. Emits to correct rooms (global vs room-specific)
 *
 * TDD Approach: These tests will FAIL initially (broadcasts doesn't use helpers yet)
 */

const EventEmitter = require('events');
const broadcasts = require('../../../src/websocket/broadcasts');
const { setupBroadcastListeners, cleanupBroadcastListeners } = broadcasts;

describe('broadcasts.js - Event Wrapper Integration', () => {
  let mockIo;
  let mockSessionService;
  let mockTransactionService;
  let mockVideoQueueService;
  let mockOfflineQueueService;
  let initializeSessionDevicesSpy;

  beforeEach(() => {
    // Mock Socket.io server with minimal structure needed for wrapper tests
    // Note: session:created event triggers initializeSessionDevices() which needs io.sockets.sockets
    // This is device initialization behavior (tested in integration tests), not wrapper behavior
    // For unit tests, we provide minimal structure to prevent crashes, not to test device logic
    mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(), // Chainable for emitToRoom
      sockets: {
        sockets: new Map(), // Empty map - no devices to initialize (unit test scope)
        adapter: {
          rooms: new Map()
        }
      }
    };

    // Mock services as EventEmitters
    mockSessionService = new EventEmitter();
    mockTransactionService = new EventEmitter();
    mockVideoQueueService = new EventEmitter();
    mockOfflineQueueService = new EventEmitter();

    // Add methods needed by broadcast handlers
    mockVideoQueueService.getQueueItems = jest.fn().mockReturnValue([]);
    mockVideoQueueService.getState = jest.fn().mockReturnValue({
      status: 'idle', currentVideo: null, queue: [], queueLength: 0, connected: false,
    });

    // Mock transactionService.getToken (needed by transaction:added handler)
    mockTransactionService.getToken = jest.fn().mockReturnValue({
      memoryType: 'TEST_TYPE',
      metadata: {
        originalType: 'ORIGINAL_TYPE',
        rating: 5,
        group: 'TEST_GROUP'
      },
      value: 100
    });

    // Mock sessionService.getCurrentSession (needed by transaction:added handler)
    mockSessionService.getCurrentSession = jest.fn().mockReturnValue({
      id: 'session-123'
    });
  });

  afterEach(() => {
    cleanupBroadcastListeners();
  });

  describe('Session Events - Unwrapped → Wrapped Conversion', () => {
    it('should wrap session:created event using emitWrapped helper', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      // Trigger service event
      mockSessionService.emit('session:created', {
        id: 'session-123',
        name: 'Test Session'
      });

      // Assert: io.emit called with wrapped structure
      // Per AsyncAPI contract: session:update event (replaces session:new)
      expect(mockIo.emit).toHaveBeenCalledWith(
        'session:update',
        expect.objectContaining({
          event: 'session:update',
          data: expect.objectContaining({
            id: 'session-123',  // Per Decision #4: use 'id' within resource
            name: 'Test Session'
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should wrap session:updated event using emitWrapped helper', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      // Trigger service event
      mockSessionService.emit('session:updated', {
        id: 'session-123',
        status: 'ended'
      });

      // Assert: io.emit called with wrapped structure
      expect(mockIo.emit).toHaveBeenCalledWith(
        'session:update',
        expect.objectContaining({
          event: 'session:update',
          data: expect.objectContaining({
            id: 'session-123',  // Per Decision #4: use 'id' within resource
            status: 'ended'
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });
  });

  describe('Transaction Events - Manual Wrapping → Helper Usage', () => {
    it('should use emitToRoom for transaction:added (session-specific room)', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      // Trigger service event (broadcasts.js listens on sessionService for transaction:added)
      mockSessionService.emit('transaction:added', {
        id: 'tx-123',
        tokenId: '534e2b03',
        teamId: 'Team Alpha',
        deviceId: 'GM_01',
        mode: 'blackmarket',
        status: 'accepted',
        points: 100,
        timestamp: new Date().toISOString()
      });

      // Assert: io.to called with session room
      expect(mockIo.to).toHaveBeenCalledWith('session:session-123');

      // Assert: emit called with wrapped structure (per AsyncAPI: data.transaction nested)
      expect(mockIo.emit).toHaveBeenCalledWith(
        'transaction:new',
        expect.objectContaining({
          event: 'transaction:new',
          data: expect.objectContaining({
            transaction: expect.objectContaining({
              id: 'tx-123',
              tokenId: '534e2b03',
              teamId: 'Team Alpha',
              deviceId: 'GM_01'
            })
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });
  });

  describe('Score Events', () => {
    it('should stash teamScore from transaction:accepted for transaction:new enrichment', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      const teamScore = {
        teamId: 'Team Alpha',
        currentScore: 100,
        baseScore: 80,
        bonusPoints: 20,
        tokensScanned: 5,
        completedGroups: ['GROUP_A'],
        adminAdjustments: [],
        lastUpdate: new Date().toISOString()
      };

      // Emit transaction:accepted (should stash, NOT broadcast score:updated)
      mockTransactionService.emit('transaction:accepted', {
        transaction: { id: 'tx1', tokenId: 'token1', teamId: 'Team Alpha', status: 'accepted' },
        teamScore,
        deviceTracking: { deviceId: 'gm-1', tokenId: 'token1' }
      });

      // score:updated should NOT be emitted
      const scoreUpdatedCalls = mockIo.emit.mock.calls.filter(c => c[0] === 'score:updated');
      expect(scoreUpdatedCalls).toHaveLength(0);

      // Now emit transaction:added and verify teamScore is carried in transaction:new
      mockSessionService.emit('transaction:added', {
        id: 'tx1',
        tokenId: 'token1',
        teamId: 'Team Alpha',
        deviceId: 'gm-1',
        mode: 'blackmarket',
        status: 'accepted',
        points: 100,
        timestamp: new Date().toISOString()
      });

      // Verify transaction:new carries teamScore
      const txNewCalls = mockIo.emit.mock.calls.filter(c => c[0] === 'transaction:new');
      expect(txNewCalls).toHaveLength(1);
      expect(txNewCalls[0][1].data.teamScore).toEqual(teamScore);
    });

    it('should broadcast score:adjusted to session room (not score:updated)', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      // Admin score adjustment event
      mockTransactionService.emit('score:adjusted', {
        teamScore: {
          teamId: 'Team Beta',
          currentScore: 500,
          baseScore: 500,
          bonusPoints: 0,
          tokensScanned: 0,
          completedGroups: [],
          adminAdjustments: [{ delta: 500, reason: 'bonus' }],
          lastUpdate: new Date().toISOString()
        },
        reason: 'bonus',
        isAdminAction: true
      });

      // score:updated should NOT be emitted
      const scoreUpdatedCalls = mockIo.emit.mock.calls.filter(c => c[0] === 'score:updated');
      expect(scoreUpdatedCalls).toHaveLength(0);

      // score:adjusted should be emitted to session room
      expect(mockIo.to).toHaveBeenCalledWith('session:session-123');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'score:adjusted',
        expect.objectContaining({
          event: 'score:adjusted',
          data: expect.objectContaining({
            teamScore: expect.objectContaining({
              teamId: 'Team Beta',
              currentScore: 500
            })
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should use emitToRoom for group:completed (GM stations only)', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      mockTransactionService.emit('group:completed', {
        teamId: 'Team Alpha',
        groupId: 'GROUP_A',
        bonus: 50,
        multiplier: 1.5
      });

      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'group:completed',
        expect.objectContaining({
          event: 'group:completed',
          data: expect.objectContaining({
            teamId: 'Team Alpha',
            group: 'GROUP_A',           // AsyncAPI contract field name
            bonusPoints: 50,             // AsyncAPI contract field name
            completedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)  // AsyncAPI required field
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });
  });

  describe('scores:reset event', () => {
    it('should broadcast scores:reset and sync:full when transactionService emits scores:reset', async () => {
      // Mock getCurrentSession for scoped broadcast and buildSyncFullPayload
      const mockSession = {
        id: 'test-session',
        name: 'Test Session',
        startTime: new Date().toISOString(),
        endTime: null,
        status: 'active',
        teams: [],
        transactions: [],
        connectedDevices: [],
        playerScans: [],
        metadata: {},
        scores: [],
        toJSON: function() { return { id: this.id, name: this.name, status: this.status, teams: this.teams }; }
      };
      mockSessionService.getCurrentSession = jest.fn().mockReturnValue(mockSession);

      // Mock transactionService.getTeamScores (needed by buildSyncFullPayload)
      mockTransactionService.getTeamScores = jest.fn().mockReturnValue([]);

      // Mock videoQueueService properties (needed by buildSyncFullPayload)
      mockVideoQueueService.currentStatus = 'idle';
      mockVideoQueueService.queue = [];
      mockVideoQueueService.currentVideo = null;

      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      // Emit scores:reset from transactionService
      mockTransactionService.emit('scores:reset', { teamsReset: ['Team Alpha', 'Detectives'] });

      // Wait for async handler to complete (buildSyncFullPayload is async)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify scores:reset broadcast to session-scoped room (prevents cross-session contamination)
      // CRITICAL: Uses session-scoped room like transaction:deleted, NOT 'gm' room
      expect(mockIo.to).toHaveBeenCalledWith('session:test-session');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'scores:reset',
        expect.objectContaining({
          event: 'scores:reset',
          data: { teamsReset: ['Team Alpha', 'Detectives'] },
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );

      // Verify sync:full broadcast is scoped to gm room (not global)
      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'sync:full',
        expect.objectContaining({
          event: 'sync:full',
          data: expect.objectContaining({
            session: expect.objectContaining({ id: 'test-session' }),
            scores: []
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should filter disconnected devices from sync:full payload (connectedOnly)', async () => {
      const mockSession = {
        id: 'test-session',
        name: 'Test Session',
        startTime: new Date().toISOString(),
        endTime: null,
        status: 'active',
        teams: [],
        transactions: [],
        connectedDevices: [
          { id: 'gm-1', type: 'gm', name: 'GM iPad', connectionTime: new Date().toISOString(), connectionStatus: 'connected', ipAddress: '10.0.0.1' },
          { id: 'player-1', type: 'player', name: 'Player Phone', connectionTime: new Date().toISOString(), connectionStatus: 'disconnected', ipAddress: '10.0.0.2' },
          { id: 'scoreboard-1', type: 'scoreboard', name: 'Scoreboard', connectionTime: new Date().toISOString(), connectionStatus: 'connected', ipAddress: '10.0.0.3' },
        ],
        playerScans: [],
        metadata: {},
        scores: [],
        toJSON: function() { return { id: this.id, name: this.name, status: this.status, teams: this.teams }; }
      };
      mockSessionService.getCurrentSession = jest.fn().mockReturnValue(mockSession);
      mockTransactionService.getTeamScores = jest.fn().mockReturnValue([]);
      mockVideoQueueService.currentStatus = 'idle';
      mockVideoQueueService.queue = [];
      mockVideoQueueService.currentVideo = null;

      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      mockTransactionService.emit('scores:reset', { teamsReset: ['Team Alpha'] });
      await new Promise(resolve => setTimeout(resolve, 50));

      // Find the sync:full emit call
      const syncFullCall = mockIo.emit.mock.calls.find(c => c[0] === 'sync:full');
      expect(syncFullCall).toBeDefined();
      const devices = syncFullCall[1].data.devices;

      // Only connected devices should appear (gm-1, scoreboard-1)
      expect(devices).toHaveLength(2);
      expect(devices.map(d => d.deviceId)).toEqual(['gm-1', 'scoreboard-1']);
    });
  });

  describe('Error Events - Unwrapped → Wrapped Conversion', () => {
    it('should wrap service error events using emitWrapped helper', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      const testError = new Error('Test error');
      testError.code = 'TEST_ERROR';
      mockSessionService.emit('error', testError);

      expect(mockIo.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          event: 'error',
          data: expect.objectContaining({
            service: 'session',
            message: 'Test error',
            code: 'TEST_ERROR'
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });
  });

  describe('Wrapped Envelope Structure Validation', () => {
    it('should create consistent wrapped envelope for all events', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      // Trigger various events
      mockSessionService.emit('session:created', { id: 'test', name: 'Test' });

      // All emit calls should have wrapped structure
      mockIo.emit.mock.calls.forEach(call => {
        const [eventName, eventData] = call;

        // Wrapped envelope validation
        expect(eventData).toHaveProperty('event', eventName);
        expect(eventData).toHaveProperty('data');
        expect(eventData).toHaveProperty('timestamp');
        expect(typeof eventData.timestamp).toBe('string');
        expect(eventData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
    });
  });

  describe('Cleanup Function', () => {
    it('should remove all listeners when cleanupBroadcastListeners called', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      // Verify listeners registered (Slice 4: transaction:accepted replaces score:updated)
      expect(mockSessionService.listenerCount('session:created')).toBeGreaterThan(0);
      expect(mockTransactionService.listenerCount('transaction:accepted')).toBeGreaterThan(0);
      expect(mockTransactionService.listenerCount('score:adjusted')).toBeGreaterThan(0);

      // Cleanup
      cleanupBroadcastListeners();

      // Verify listeners removed
      expect(mockSessionService.listenerCount('session:created')).toBe(0);
      expect(mockTransactionService.listenerCount('transaction:accepted')).toBe(0);
      expect(mockTransactionService.listenerCount('score:adjusted')).toBe(0);
    });
  });

  describe('Graceful degradation without environment services', () => {
    it('should work without environment services (backward compatible)', () => {
      // Setup without any environment services - should not throw
      expect(() => {
        setupBroadcastListeners(mockIo, {
          sessionService: mockSessionService,
          transactionService: mockTransactionService,
  
          videoQueueService: mockVideoQueueService,
          offlineQueueService: mockOfflineQueueService
        });
      }).not.toThrow();
    });
  });

  describe('video routing via video:started', () => {
    let mockAudioRoutingService;

    beforeEach(() => {
      mockAudioRoutingService = new EventEmitter();
      mockAudioRoutingService.getRoutingStatus = jest.fn().mockResolvedValue({ availableSinks: [] });
      mockAudioRoutingService.handleDuckingEvent = jest.fn().mockResolvedValue();
      mockAudioRoutingService.applyRouting = jest.fn().mockResolvedValue();
      mockAudioRoutingService.getState = jest.fn().mockReturnValue({
        routes: {}, defaultSink: 'hdmi', ducking: {},
      });

      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        audioRoutingService: mockAudioRoutingService,
      });
    });

    it('should apply video routing on video:started event', () => {
      mockVideoQueueService.emit('video:started', {
        queueItem: { tokenId: 'test-token', videoPath: 'test.mp4' },
        duration: 30,
        expectedEndTime: new Date().toISOString(),
      });

      expect(mockAudioRoutingService.applyRouting).toHaveBeenCalledWith('video');
    });
  });

  describe('Display mode:changed listener', () => {
    let mockDisplayControlService;

    beforeEach(() => {
      mockDisplayControlService = new EventEmitter();

      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        displayControlService: mockDisplayControlService,
      });
    });

    it('should broadcast display:mode on display:mode:changed', () => {
      mockDisplayControlService.emit('display:mode:changed', {
        mode: 'SCOREBOARD',
        previousMode: 'IDLE_LOOP'
      });

      expect(mockIo.emit).toHaveBeenCalledWith(
        'display:mode',
        expect.objectContaining({
          event: 'display:mode',
          data: expect.objectContaining({ mode: 'SCOREBOARD' })
        })
      );
    });
  });

  describe('service:state (unified state architecture)', () => {
    let mockBluetoothService;
    let mockAudioRoutingService;
    let mockLightingService;
    let mockSpotifyService;
    let mockVlcService;

    // service:state pushes are debounced 50ms — use fake timers so unit tests
    // can advance past the debounce without real-time waiting
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.useRealTimers(); });

    beforeEach(() => {
      mockBluetoothService = new EventEmitter();
      mockBluetoothService.getState = jest.fn().mockReturnValue({
        scanning: false, pairedDevices: [], connectedDevices: [],
      });
      mockAudioRoutingService = new EventEmitter();
      mockAudioRoutingService.handleDuckingEvent = jest.fn().mockResolvedValue();
      mockAudioRoutingService.getState = jest.fn().mockReturnValue({
        routes: { video: 'hdmi' }, defaultSink: 'hdmi', ducking: {},
      });
      mockLightingService = new EventEmitter();
      mockLightingService.getState = jest.fn().mockReturnValue({
        connected: true, activeScene: 'scene.test', scenes: [{ id: 'scene.test', name: 'Test' }],
      });
      mockSpotifyService = new EventEmitter();
      mockSpotifyService.getState = jest.fn().mockReturnValue({
        connected: true, state: 'playing', volume: 80, track: { title: 'Test' },
      });
      mockVlcService = new EventEmitter();
      mockVlcService.getState = jest.fn().mockReturnValue({
        connected: true, state: 'playing', volume: 100, track: {},
      });
    });

    function setupWithAllServices() {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        bluetoothService: mockBluetoothService,
        audioRoutingService: mockAudioRoutingService,
        lightingService: mockLightingService,
        spotifyService: mockSpotifyService,
        vlcService: mockVlcService,
      });
    }

    it('should emit service:state with domain bluetooth on device:connected', () => {
      setupWithAllServices();
      mockBluetoothService.emit('device:connected', { address: 'AA:BB', name: 'Speaker' });
      jest.advanceTimersByTime(51); // advance past 50ms debounce

      expect(mockIo.emit).toHaveBeenCalledWith('service:state', expect.objectContaining({
        event: 'service:state',
        data: { domain: 'bluetooth', state: mockBluetoothService.getState() },
      }));
    });

    it('should emit service:state with domain audio on routing:changed', () => {
      setupWithAllServices();
      mockAudioRoutingService.emit('routing:changed', { stream: 'video', sink: 'hdmi' });
      jest.advanceTimersByTime(51); // advance past 50ms debounce

      expect(mockIo.emit).toHaveBeenCalledWith('service:state', expect.objectContaining({
        event: 'service:state',
        data: { domain: 'audio', state: mockAudioRoutingService.getState() },
      }));
    });

    it('should emit service:state with domain lighting on scene:activated', () => {
      setupWithAllServices();
      mockLightingService.emit('scene:activated', { sceneId: 'scene.test' });
      jest.advanceTimersByTime(51); // advance past 50ms debounce

      expect(mockIo.emit).toHaveBeenCalledWith('service:state', expect.objectContaining({
        event: 'service:state',
        data: { domain: 'lighting', state: mockLightingService.getState() },
      }));
    });

    it('should emit service:state with domain spotify on playback:changed', () => {
      setupWithAllServices();
      mockSpotifyService.emit('playback:changed', { state: 'playing' });
      jest.advanceTimersByTime(51); // advance past 50ms debounce

      expect(mockIo.emit).toHaveBeenCalledWith('service:state', expect.objectContaining({
        event: 'service:state',
        data: { domain: 'spotify', state: mockSpotifyService.getState() },
      }));
    });

    it('should emit service:state with domain video on video:loading', () => {
      setupWithAllServices();
      mockVideoQueueService.emit('video:loading', { tokenId: 'test' });
      jest.advanceTimersByTime(51); // advance past 50ms debounce

      expect(mockIo.emit).toHaveBeenCalledWith('service:state', expect.objectContaining({
        event: 'service:state',
        data: { domain: 'video', state: mockVideoQueueService.getState() },
      }));
    });

    it('should emit service:state with domain video on VLC state:changed', () => {
      setupWithAllServices();
      mockVlcService.emit('state:changed', { current: { state: 'Stopped', filename: null }, previous: {} });
      jest.advanceTimersByTime(51); // advance past 50ms debounce

      expect(mockIo.emit).toHaveBeenCalledWith('service:state', expect.objectContaining({
        event: 'service:state',
        data: { domain: 'video', state: mockVideoQueueService.getState() },
      }));
    });

    it('should emit service:state with domain health on health:changed', () => {
      const serviceHealthRegistry = require('../../../src/services/serviceHealthRegistry');
      const originalGetState = serviceHealthRegistry.getState;
      serviceHealthRegistry.getState = jest.fn().mockReturnValue({
        vlc: { status: 'healthy' }, spotify: { status: 'down' },
      });

      setupWithAllServices();
      serviceHealthRegistry.emit('health:changed', { serviceId: 'vlc' });
      jest.advanceTimersByTime(51); // advance past 50ms debounce

      expect(mockIo.emit).toHaveBeenCalledWith('service:state', expect.objectContaining({
        event: 'service:state',
        data: { domain: 'health', state: serviceHealthRegistry.getState() },
      }));

      serviceHealthRegistry.getState = originalGetState;
    });

    it('should emit service:state with domain held on cue:held', () => {
      const mockCueEngineService = new EventEmitter();
      mockCueEngineService.getState = jest.fn().mockReturnValue({ cues: [], activeCues: [] });
      mockCueEngineService.getHeldCues = jest.fn().mockReturnValue([{ id: 'held-1', type: 'cue' }]);
      mockVideoQueueService.getHeldVideos = jest.fn().mockReturnValue([]);

      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,

        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        cueEngineService: mockCueEngineService,
      });

      mockCueEngineService.emit('cue:held', { cueId: 'test-cue' });
      // held domain uses direct emitToRoom (not debounced pushServiceState), no timer advance needed

      expect(mockIo.emit).toHaveBeenCalledWith('service:state', expect.objectContaining({
        event: 'service:state',
        data: { domain: 'held', state: { items: [{ id: 'held-1', type: 'cue' }] } },
      }));
    });
  });
});
