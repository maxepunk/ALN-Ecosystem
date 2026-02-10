/**
 * Broadcasts Environment State Tests (Phase 0)
 * Tests that sync:full in offline:queue:processed includes environment state.
 *
 * Strategy: Mock buildEnvironmentState to control what environment state
 * is returned, then verify broadcasts.js includes it in the sync:full payload
 * that follows offline:queue:processed.
 */

const EventEmitter = require('events');

// Mock buildEnvironmentState before requiring broadcasts
jest.mock('../../../src/websocket/environmentHelpers', () => ({
  buildEnvironmentState: jest.fn(),
}));

const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../../src/websocket/broadcasts');
const { buildEnvironmentState } = require('../../../src/websocket/environmentHelpers');

describe('broadcasts.js - Environment in offline:queue:processed sync:full (Phase 0)', () => {
  let mockIo;
  let mockSessionService;
  let mockTransactionService;
  let mockStateService;
  let mockVideoQueueService;
  let mockOfflineQueueService;
  let mockBluetoothService;
  let mockAudioRoutingService;
  let mockLightingService;

  const mockEnvironmentState = {
    bluetooth: {
      available: true,
      scanning: false,
      pairedDevices: [{ address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true }],
      connectedDevices: [{ address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true }],
    },
    audio: {
      routes: { video: { sink: 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink' } },
      defaultSink: 'hdmi',
    },
    lighting: {
      connected: true,
      scenes: [{ id: 'scene.dramatic_red', name: 'Dramatic Red' }],
      activeScene: 'scene.dramatic_red',
    },
  };

  beforeEach(() => {
    // Configure mock
    buildEnvironmentState.mockResolvedValue(mockEnvironmentState);

    mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      sockets: {
        sockets: new Map(),
        adapter: { rooms: new Map() },
      },
    };

    mockSessionService = new EventEmitter();
    mockTransactionService = new EventEmitter();
    mockStateService = new EventEmitter();
    mockVideoQueueService = new EventEmitter();
    mockOfflineQueueService = new EventEmitter();
    mockBluetoothService = new EventEmitter();
    mockAudioRoutingService = new EventEmitter();
    mockLightingService = new EventEmitter();

    // Methods needed by broadcast handlers
    mockVideoQueueService.getQueueItems = jest.fn().mockReturnValue([]);
    mockTransactionService.getToken = jest.fn().mockReturnValue(null);
    mockTransactionService.getTeamScores = jest.fn().mockReturnValue([]);
    mockSessionService.getCurrentSession = jest.fn().mockReturnValue({
      id: 'session-123',
      toJSON: () => ({ id: 'session-123', status: 'active' }),
      transactions: [],
      connectedDevices: [],
      playerScans: [],
    });
  });

  afterEach(() => {
    cleanupBroadcastListeners();
  });

  it('should include environment in sync:full after offline:queue:processed', async () => {
    setupBroadcastListeners(mockIo, {
      sessionService: mockSessionService,
      transactionService: mockTransactionService,
      stateService: mockStateService,
      videoQueueService: mockVideoQueueService,
      offlineQueueService: mockOfflineQueueService,
      bluetoothService: mockBluetoothService,
      audioRoutingService: mockAudioRoutingService,
      lightingService: mockLightingService,
    });

    // Trigger offline:queue:processed event
    mockOfflineQueueService.emit('offline:queue:processed', {
      data: { queueSize: 0, results: [] },
    });

    // Wait for async handler to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Find the sync:full emit (second emission after offline:queue:processed)
    const syncFullCall = mockIo.emit.mock.calls.find(
      (call) => call[0] === 'sync:full'
    );

    expect(syncFullCall).toBeDefined();
    const syncFullPayload = syncFullCall[1];

    // Verify environment is in the wrapped payload
    expect(syncFullPayload.data).toHaveProperty('environment');
    expect(syncFullPayload.data.environment).toEqual(mockEnvironmentState);
  });

  it('should include all three environment sub-objects', async () => {
    setupBroadcastListeners(mockIo, {
      sessionService: mockSessionService,
      transactionService: mockTransactionService,
      stateService: mockStateService,
      videoQueueService: mockVideoQueueService,
      offlineQueueService: mockOfflineQueueService,
      bluetoothService: mockBluetoothService,
      audioRoutingService: mockAudioRoutingService,
      lightingService: mockLightingService,
    });

    mockOfflineQueueService.emit('offline:queue:processed', {
      data: { queueSize: 0, results: [] },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const syncFullCall = mockIo.emit.mock.calls.find(
      (call) => call[0] === 'sync:full'
    );

    const environment = syncFullCall[1].data.environment;

    expect(environment.bluetooth).toBeDefined();
    expect(environment.bluetooth.available).toBe(true);
    expect(environment.audio).toBeDefined();
    expect(environment.audio.defaultSink).toBe('hdmi');
    expect(environment.lighting).toBeDefined();
    expect(environment.lighting.connected).toBe(true);
  });

  it('should call buildEnvironmentState with environment services', async () => {
    setupBroadcastListeners(mockIo, {
      sessionService: mockSessionService,
      transactionService: mockTransactionService,
      stateService: mockStateService,
      videoQueueService: mockVideoQueueService,
      offlineQueueService: mockOfflineQueueService,
      bluetoothService: mockBluetoothService,
      audioRoutingService: mockAudioRoutingService,
      lightingService: mockLightingService,
    });

    mockOfflineQueueService.emit('offline:queue:processed', {
      data: { queueSize: 0, results: [] },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(buildEnvironmentState).toHaveBeenCalledWith({
      bluetoothService: mockBluetoothService,
      audioRoutingService: mockAudioRoutingService,
      lightingService: mockLightingService,
    });
  });
});
