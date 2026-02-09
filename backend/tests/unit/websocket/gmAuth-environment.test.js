/**
 * GM Auth Environment State Tests (Phase 0)
 * Tests that sync:full includes environment state for bluetooth/audio/lighting
 *
 * Strategy: Mock buildEnvironmentState directly to control what environment
 * state is returned, then verify gmAuth includes it in sync:full.
 * The actual environment state building is tested in environmentHelpers.test.js.
 */

const sessionService = require('../../../src/services/sessionService');
const { resetAllServices } = require('../../helpers/service-reset');

// Mock the environment helpers module — define fn in factory, configure in beforeEach
jest.mock('../../../src/websocket/environmentHelpers', () => ({
  buildEnvironmentState: jest.fn(),
}));

const { handleGmIdentify } = require('../../../src/websocket/gmAuth');
const { buildEnvironmentState } = require('../../../src/websocket/environmentHelpers');

describe('GM Auth - Environment State in sync:full (Phase 0)', () => {
  let mockSocket, mockIo;

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

  beforeEach(async () => {
    await resetAllServices();

    // Configure mock return value fresh each test
    buildEnvironmentState.mockResolvedValue(mockEnvironmentState);

    mockSocket = {
      id: 'test-socket-id',
      isAuthenticated: true,
      deviceId: 'GM_001',
      deviceType: 'gm',
      version: '2.1.0',
      handshake: {
        address: '192.168.1.100',
        auth: {
          token: 'valid-token',
          deviceId: 'GM_001',
          deviceType: 'gm',
        },
      },
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      rooms: new Set(['test-socket-id']),
    };

    mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };

    // Create session
    await sessionService.createSession({
      name: 'Environment Test Session',
      teams: ['Team Alpha'],
    });
  });

  /** Helper to get sync:full payload from mock socket emissions */
  function getSyncFullEnvironment() {
    const syncFullCall = mockSocket.emit.mock.calls.find(
      (call) => call[0] === 'sync:full'
    );
    expect(syncFullCall).toBeDefined();
    return syncFullCall[1].data.environment;
  }

  it('should include environment object in sync:full payload', async () => {
    await handleGmIdentify(mockSocket, { deviceId: 'GM_001', version: '2.1.0' }, mockIo);

    const syncFullCall = mockSocket.emit.mock.calls.find(
      (call) => call[0] === 'sync:full'
    );
    expect(syncFullCall).toBeDefined();
    expect(syncFullCall[1].data).toHaveProperty('environment');
  });

  it('should include bluetooth state in environment', async () => {
    await handleGmIdentify(mockSocket, { deviceId: 'GM_001', version: '2.1.0' }, mockIo);

    const environment = getSyncFullEnvironment();

    expect(environment.bluetooth).toBeDefined();
    expect(environment.bluetooth.available).toBe(true);
    expect(environment.bluetooth.scanning).toBe(false);
    expect(environment.bluetooth.pairedDevices).toEqual([
      { address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true },
    ]);
    expect(environment.bluetooth.connectedDevices).toEqual([
      { address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true },
    ]);
  });

  it('should include audio state in environment', async () => {
    await handleGmIdentify(mockSocket, { deviceId: 'GM_001', version: '2.1.0' }, mockIo);

    const environment = getSyncFullEnvironment();

    expect(environment.audio).toBeDefined();
    expect(environment.audio.routes).toEqual({
      video: { sink: 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink' },
    });
    expect(environment.audio.defaultSink).toBe('hdmi');
  });

  it('should include lighting state in environment', async () => {
    await handleGmIdentify(mockSocket, { deviceId: 'GM_001', version: '2.1.0' }, mockIo);

    const environment = getSyncFullEnvironment();

    expect(environment.lighting).toBeDefined();
    expect(environment.lighting.connected).toBe(true);
    expect(environment.lighting.scenes).toEqual([
      { id: 'scene.dramatic_red', name: 'Dramatic Red' },
    ]);
    expect(environment.lighting.activeScene).toBe('scene.dramatic_red');
  });

  it('should be JSON-serializable', async () => {
    await handleGmIdentify(mockSocket, { deviceId: 'GM_001', version: '2.1.0' }, mockIo);

    const environment = getSyncFullEnvironment();

    expect(() => JSON.stringify(environment)).not.toThrow();
  });

  it('should call buildEnvironmentState with the three services', async () => {
    await handleGmIdentify(mockSocket, { deviceId: 'GM_001', version: '2.1.0' }, mockIo);

    expect(buildEnvironmentState).toHaveBeenCalledWith({
      bluetoothService: expect.anything(),
      audioRoutingService: expect.anything(),
      lightingService: expect.anything(),
    });
  });
});
