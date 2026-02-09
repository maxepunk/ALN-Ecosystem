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
  let mockStateService;
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
    mockStateService = new EventEmitter();
    mockVideoQueueService = new EventEmitter();
    mockOfflineQueueService = new EventEmitter();

    // Add methods needed by broadcast handlers
    mockVideoQueueService.getQueueItems = jest.fn().mockReturnValue([]);

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
        stateService: mockStateService,
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
        stateService: mockStateService,
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
        stateService: mockStateService,
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

  describe('State Events - Unwrapped → Wrapped Conversion', () => {
    it('should wrap state:sync event using emitWrapped helper', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      const mockState = { session: {}, scores: [] };
      mockStateService.emit('state:sync', mockState);

      // Assert: io.emit called with wrapped structure
      expect(mockIo.emit).toHaveBeenCalledWith(
        'state:sync',
        expect.objectContaining({
          event: 'state:sync',
          data: mockState,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should use emitToRoom for state:updated (GM stations only)', () => {
      // Mock GM stations room
      mockIo.sockets.adapter.rooms.set('gm', new Set(['socket-1', 'socket-2']));

      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      const delta = { scores: { '001': 100 } };
      mockStateService.emit('state:updated', delta);

      // Assert: io.to called with gm room
      expect(mockIo.to).toHaveBeenCalledWith('gm');

      // Assert: emit called with wrapped structure
      expect(mockIo.emit).toHaveBeenCalledWith(
        'state:update',
        expect.objectContaining({
          event: 'state:update',
          data: delta,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });
  });

  describe('Video Events - Manual Wrapping → Helper Usage', () => {
    it('should use emitToRoom for video:loading (GM stations only)', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      mockVideoQueueService.emit('video:loading', { tokenId: '534e2b03' });

      // Assert: io.to called with gm room
      expect(mockIo.to).toHaveBeenCalledWith('gm');

      // Assert: emit called with wrapped structure
      expect(mockIo.emit).toHaveBeenCalledWith(
        'video:status',
        expect.objectContaining({
          event: 'video:status',
          data: expect.objectContaining({
            status: 'loading',
            tokenId: '534e2b03'
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should use emitToRoom for video:started (GM stations only)', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      mockVideoQueueService.emit('video:started', {
        queueItem: { tokenId: '534e2b03' },
        duration: 120,
        expectedEndTime: new Date().toISOString()
      });

      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'video:status',
        expect.objectContaining({
          event: 'video:status',
          data: expect.objectContaining({
            status: 'playing',
            tokenId: '534e2b03',
            duration: 120
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });
  });

  describe('Score Events - Manual Wrapping → Helper Usage', () => {
    it('should broadcast score:updated from transaction:accepted (Slice 4)', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      // New event format from Slice 3: transaction:accepted with teamScore
      mockTransactionService.emit('transaction:accepted', {
        transaction: { id: 'tx1', tokenId: 'token1', teamId: 'Team Alpha', status: 'accepted' },
        teamScore: {
          teamId: 'Team Alpha',
          currentScore: 100,
          baseScore: 80,
          bonusPoints: 20,
          tokensScanned: 5,
          completedGroups: ['GROUP_A'],
          adminAdjustments: [],
          lastUpdate: new Date().toISOString()
        },
        deviceTracking: { deviceId: 'gm-1', tokenId: 'token1' }
      });

      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'score:updated',
        expect.objectContaining({
          event: 'score:updated',
          data: expect.objectContaining({
            teamId: 'Team Alpha',
            currentScore: 100,
            baseScore: 80,
            bonusPoints: 20
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should broadcast score:updated from score:adjusted (Slice 4)', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
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

      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'score:updated',
        expect.objectContaining({
          event: 'score:updated',
          data: expect.objectContaining({
            teamId: 'Team Beta',
            currentScore: 500
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });

    it('should use emitToRoom for group:completed (GM stations only)', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
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
    it('should broadcast scores:reset and sync:full when transactionService emits scores:reset', () => {
      // Mock getCurrentSession for sync:full emission
      mockSessionService.getCurrentSession = jest.fn().mockReturnValue({
        id: 'test-session',
        toJSON: () => ({ id: 'test-session', status: 'active' })
      });

      // Mock getCurrentState for sync:full emission
      mockStateService.getCurrentState = jest.fn().mockReturnValue({
        session: { id: 'test-session', status: 'active' },
        scores: [],
        recentTransactions: []
      });

      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      // Emit scores:reset from transactionService
      mockTransactionService.emit('scores:reset', { teamsReset: ['Team Alpha', 'Detectives'] });

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

      // Verify sync:full broadcast
      expect(mockIo.emit).toHaveBeenCalledWith(
        'sync:full',
        expect.objectContaining({
          event: 'sync:full',
          data: expect.objectContaining({
            scores: []
          }),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
      );
    });
  });

  describe('Error Events - Unwrapped → Wrapped Conversion', () => {
    it('should wrap service error events using emitWrapped helper', () => {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
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
        stateService: mockStateService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService
      });

      // Trigger various events
      mockSessionService.emit('session:created', { id: 'test', name: 'Test' });
      mockStateService.emit('state:sync', { test: 'data' });

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
        stateService: mockStateService,
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

  // ============================================================
  // ENVIRONMENT CONTROL BROADCASTS (Phase 0)
  // ============================================================

  describe('Environment Control Broadcasts (Phase 0)', () => {
    let mockBluetoothService;
    let mockAudioRoutingService;
    let mockLightingService;

    beforeEach(() => {
      mockBluetoothService = new EventEmitter();
      mockAudioRoutingService = new EventEmitter();
      mockLightingService = new EventEmitter();
    });

    /**
     * Helper to setup broadcast listeners with environment services included
     */
    function setupWithEnvServices() {
      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        bluetoothService: mockBluetoothService,
        audioRoutingService: mockAudioRoutingService,
        lightingService: mockLightingService
      });
    }

    describe('Bluetooth Events', () => {
      it('should broadcast bluetooth:device with type connected on device:connected', () => {
        setupWithEnvServices();

        const device = { address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', profile: 'a2dp_sink' };
        mockBluetoothService.emit('device:connected', device);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'bluetooth:device',
          expect.objectContaining({
            event: 'bluetooth:device',
            data: expect.objectContaining({
              type: 'connected',
              device
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });

      it('should broadcast bluetooth:device with type disconnected on device:disconnected', () => {
        setupWithEnvServices();

        const device = { address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker' };
        mockBluetoothService.emit('device:disconnected', device);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'bluetooth:device',
          expect.objectContaining({
            event: 'bluetooth:device',
            data: expect.objectContaining({
              type: 'disconnected',
              device
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });

      it('should broadcast bluetooth:device with type paired on device:paired', () => {
        setupWithEnvServices();

        const device = { address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker' };
        mockBluetoothService.emit('device:paired', device);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'bluetooth:device',
          expect.objectContaining({
            event: 'bluetooth:device',
            data: expect.objectContaining({
              type: 'paired',
              device
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });

      it('should broadcast bluetooth:device with type unpaired on device:unpaired', () => {
        setupWithEnvServices();

        const device = { address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker' };
        mockBluetoothService.emit('device:unpaired', device);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'bluetooth:device',
          expect.objectContaining({
            event: 'bluetooth:device',
            data: expect.objectContaining({
              type: 'unpaired',
              device
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });

      it('should broadcast bluetooth:device with type discovered on device:discovered', () => {
        setupWithEnvServices();

        const device = { address: '11:22:33:44:55:66', name: 'New Speaker', rssi: -45 };
        mockBluetoothService.emit('device:discovered', device);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'bluetooth:device',
          expect.objectContaining({
            event: 'bluetooth:device',
            data: expect.objectContaining({
              type: 'discovered',
              device
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });

      it('should broadcast bluetooth:scan with scanning true on scan:started', () => {
        setupWithEnvServices();

        const data = { duration: 30000 };
        mockBluetoothService.emit('scan:started', data);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'bluetooth:scan',
          expect.objectContaining({
            event: 'bluetooth:scan',
            data: expect.objectContaining({
              scanning: true,
              duration: 30000
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });

      it('should broadcast bluetooth:scan with scanning false on scan:stopped', () => {
        setupWithEnvServices();

        const data = { reason: 'timeout' };
        mockBluetoothService.emit('scan:stopped', data);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'bluetooth:scan',
          expect.objectContaining({
            event: 'bluetooth:scan',
            data: expect.objectContaining({
              scanning: false,
              reason: 'timeout'
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });
    });

    describe('Audio Routing Events', () => {
      it('should broadcast audio:routing on routing:changed', () => {
        setupWithEnvServices();

        const data = { zone: 'main', sink: 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink', previous: 'default' };
        mockAudioRoutingService.emit('routing:changed', data);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'audio:routing',
          expect.objectContaining({
            event: 'audio:routing',
            data: expect.objectContaining({
              zone: 'main',
              sink: 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink',
              previous: 'default'
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });

      it('should broadcast audio:routing on routing:applied', () => {
        setupWithEnvServices();

        const data = { zone: 'main', sink: 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink', success: true };
        mockAudioRoutingService.emit('routing:applied', data);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'audio:routing',
          expect.objectContaining({
            event: 'audio:routing',
            data: expect.objectContaining({
              zone: 'main',
              sink: 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink',
              success: true
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });

      it('should broadcast audio:routing:fallback on routing:fallback', () => {
        setupWithEnvServices();

        const data = { zone: 'main', originalSink: 'bluetooth', fallbackSink: 'default', reason: 'device_disconnected' };
        mockAudioRoutingService.emit('routing:fallback', data);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'audio:routing:fallback',
          expect.objectContaining({
            event: 'audio:routing:fallback',
            data: expect.objectContaining({
              zone: 'main',
              originalSink: 'bluetooth',
              fallbackSink: 'default',
              reason: 'device_disconnected'
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });
    });

    describe('Lighting Events', () => {
      it('should broadcast lighting:scene on scene:activated', () => {
        setupWithEnvServices();

        const data = { sceneId: 'scene-001', sceneName: 'Dramatic Red', entityId: 'light.stage' };
        mockLightingService.emit('scene:activated', data);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'lighting:scene',
          expect.objectContaining({
            event: 'lighting:scene',
            data: expect.objectContaining({
              sceneId: 'scene-001',
              sceneName: 'Dramatic Red',
              entityId: 'light.stage'
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });

      it('should broadcast lighting:status on connection:changed', () => {
        setupWithEnvServices();

        const data = { connected: true, url: 'http://homeassistant.local:8123' };
        mockLightingService.emit('connection:changed', data);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'lighting:status',
          expect.objectContaining({
            event: 'lighting:status',
            data: expect.objectContaining({
              connected: true,
              url: 'http://homeassistant.local:8123'
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });

      it('should broadcast lighting:status with type refreshed on scenes:refreshed', () => {
        setupWithEnvServices();

        const data = { scenes: ['scene.dramatic_red', 'scene.cool_blue'], count: 2 };
        mockLightingService.emit('scenes:refreshed', data);

        expect(mockIo.to).toHaveBeenCalledWith('gm');
        expect(mockIo.emit).toHaveBeenCalledWith(
          'lighting:status',
          expect.objectContaining({
            event: 'lighting:status',
            data: expect.objectContaining({
              type: 'refreshed',
              scenes: ['scene.dramatic_red', 'scene.cool_blue'],
              count: 2
            }),
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
          })
        );
      });
    });

    describe('Graceful degradation without environment services', () => {
      it('should work without environment services (backward compatible)', () => {
        // Setup without any environment services - should not throw
        expect(() => {
          setupBroadcastListeners(mockIo, {
            sessionService: mockSessionService,
            transactionService: mockTransactionService,
            stateService: mockStateService,
            videoQueueService: mockVideoQueueService,
            offlineQueueService: mockOfflineQueueService
          });
        }).not.toThrow();
      });
    });

    describe('Cleanup includes environment service listeners', () => {
      it('should remove all environment service listeners on cleanup', () => {
        setupWithEnvServices();

        // Verify listeners registered
        expect(mockBluetoothService.listenerCount('device:connected')).toBeGreaterThan(0);
        expect(mockBluetoothService.listenerCount('device:disconnected')).toBeGreaterThan(0);
        expect(mockBluetoothService.listenerCount('scan:started')).toBeGreaterThan(0);
        expect(mockAudioRoutingService.listenerCount('routing:changed')).toBeGreaterThan(0);
        expect(mockAudioRoutingService.listenerCount('routing:applied')).toBeGreaterThan(0);
        expect(mockAudioRoutingService.listenerCount('routing:fallback')).toBeGreaterThan(0);
        expect(mockLightingService.listenerCount('scene:activated')).toBeGreaterThan(0);
        expect(mockLightingService.listenerCount('connection:changed')).toBeGreaterThan(0);
        expect(mockLightingService.listenerCount('scenes:refreshed')).toBeGreaterThan(0);

        // Cleanup
        cleanupBroadcastListeners();

        // Verify all removed
        expect(mockBluetoothService.listenerCount('device:connected')).toBe(0);
        expect(mockBluetoothService.listenerCount('device:disconnected')).toBe(0);
        expect(mockBluetoothService.listenerCount('scan:started')).toBe(0);
        expect(mockAudioRoutingService.listenerCount('routing:changed')).toBe(0);
        expect(mockAudioRoutingService.listenerCount('routing:applied')).toBe(0);
        expect(mockAudioRoutingService.listenerCount('routing:fallback')).toBe(0);
        expect(mockLightingService.listenerCount('scene:activated')).toBe(0);
        expect(mockLightingService.listenerCount('connection:changed')).toBe(0);
        expect(mockLightingService.listenerCount('scenes:refreshed')).toBe(0);
      });
    });
  });
});
