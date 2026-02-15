/**
 * Unit Tests: environmentHelpers.js
 * Tests the buildEnvironmentState helper used by sync:full payloads.
 */

const { buildEnvironmentState, DEFAULTS } = require('../../../src/websocket/environmentHelpers');

describe('environmentHelpers - buildEnvironmentState', () => {
  describe('with no services provided', () => {
    it('should return default values when called with no arguments', async () => {
      const result = await buildEnvironmentState();

      expect(result).toEqual({
        bluetooth: DEFAULTS.bluetooth,
        audio: DEFAULTS.audio,
        lighting: DEFAULTS.lighting,
      });
    });

    it('should return default values when called with empty object', async () => {
      const result = await buildEnvironmentState({});

      expect(result).toEqual({
        bluetooth: DEFAULTS.bluetooth,
        audio: DEFAULTS.audio,
        lighting: DEFAULTS.lighting,
      });
    });
  });

  describe('bluetooth state', () => {
    it('should gather bluetooth state from service', async () => {
      const mockBluetooth = {
        isAvailable: jest.fn().mockResolvedValue(true),
        getPairedDevices: jest.fn().mockResolvedValue([
          { address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true },
        ]),
        getConnectedDevices: jest.fn().mockResolvedValue([
          { address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true },
        ]),
        isScanning: jest.fn().mockReturnValue(false),
      };

      const result = await buildEnvironmentState({ bluetoothService: mockBluetooth });

      expect(result.bluetooth).toEqual({
        available: true,
        scanning: false,
        pairedDevices: [{ address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true }],
        connectedDevices: [{ address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true }],
      });
    });

    it('should report scanning: true when isScanning() returns true', async () => {
      const mockBluetooth = {
        isAvailable: jest.fn().mockResolvedValue(true),
        getPairedDevices: jest.fn().mockResolvedValue([]),
        getConnectedDevices: jest.fn().mockResolvedValue([]),
        isScanning: jest.fn().mockReturnValue(true),
      };

      const result = await buildEnvironmentState({ bluetoothService: mockBluetooth });

      expect(result.bluetooth.scanning).toBe(true);
    });

    it('should fall back to defaults on bluetooth error', async () => {
      const mockBluetooth = {
        isAvailable: jest.fn().mockRejectedValue(new Error('bluetoothctl not found')),
        getPairedDevices: jest.fn().mockRejectedValue(new Error('bluetoothctl not found')),
        getConnectedDevices: jest.fn().mockRejectedValue(new Error('bluetoothctl not found')),
        isScanning: jest.fn().mockReturnValue(false),
      };

      const result = await buildEnvironmentState({ bluetoothService: mockBluetooth });

      expect(result.bluetooth).toEqual(DEFAULTS.bluetooth);
    });
  });

  describe('audio state', () => {
    it('should gather audio state from service', async () => {
      const mockAudio = {
        getRoutingStatus: jest.fn().mockResolvedValue({
          routes: { video: { sink: 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink' } },
          defaultSink: 'hdmi',
          availableSinks: [],
        }),
      };

      const result = await buildEnvironmentState({ audioRoutingService: mockAudio });

      expect(result.audio).toEqual({
        routes: { video: { sink: 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink' } },
        defaultSink: 'hdmi',
        availableSinks: [],
      });
    });

    it('should fall back to defaults on audio error', async () => {
      const mockAudio = {
        getRoutingStatus: jest.fn().mockImplementation(() => {
          throw new Error('pactl error');
        }),
      };

      const result = await buildEnvironmentState({ audioRoutingService: mockAudio });

      expect(result.audio).toEqual(DEFAULTS.audio);
    });
  });

  describe('lighting state', () => {
    it('should gather lighting state from service', async () => {
      const mockLighting = {
        isConnected: jest.fn().mockReturnValue(true),
        getCachedScenes: jest.fn().mockReturnValue([
          { id: 'scene.dramatic_red', name: 'Dramatic Red' },
          { id: 'scene.cool_blue', name: 'Cool Blue' },
        ]),
        getActiveScene: jest.fn().mockReturnValue('scene.dramatic_red'),
      };

      const result = await buildEnvironmentState({ lightingService: mockLighting });

      expect(result.lighting).toEqual({
        connected: true,
        scenes: [
          { id: 'scene.dramatic_red', name: 'Dramatic Red' },
          { id: 'scene.cool_blue', name: 'Cool Blue' },
        ],
        activeScene: 'scene.dramatic_red',
      });
    });

    it('should report disconnected and empty scenes', async () => {
      const mockLighting = {
        isConnected: jest.fn().mockReturnValue(false),
        getCachedScenes: jest.fn().mockReturnValue([]),
        getActiveScene: jest.fn().mockReturnValue(null),
      };

      const result = await buildEnvironmentState({ lightingService: mockLighting });

      expect(result.lighting).toEqual({
        connected: false,
        scenes: [],
        activeScene: null,
      });
    });

    it('should fall back to defaults on lighting error', async () => {
      const mockLighting = {
        isConnected: jest.fn().mockImplementation(() => {
          throw new Error('HA unreachable');
        }),
        getCachedScenes: jest.fn().mockReturnValue([]),
        getActiveScene: jest.fn().mockReturnValue(null),
      };

      const result = await buildEnvironmentState({ lightingService: mockLighting });

      expect(result.lighting).toEqual(DEFAULTS.lighting);
    });
  });

  describe('combined services', () => {
    it('should gather state from all three services together', async () => {
      const mockBluetooth = {
        isAvailable: jest.fn().mockResolvedValue(true),
        getPairedDevices: jest.fn().mockResolvedValue([]),
        getConnectedDevices: jest.fn().mockResolvedValue([]),
        isScanning: jest.fn().mockReturnValue(false),
      };

      const mockAudio = {
        getRoutingStatus: jest.fn().mockResolvedValue({
          routes: { video: { sink: 'hdmi' } },
          defaultSink: 'hdmi',
          availableSinks: [],
        }),
      };

      const mockLighting = {
        isConnected: jest.fn().mockReturnValue(false),
        getCachedScenes: jest.fn().mockReturnValue([]),
        getActiveScene: jest.fn().mockReturnValue(null),
      };

      const result = await buildEnvironmentState({
        bluetoothService: mockBluetooth,
        audioRoutingService: mockAudio,
        lightingService: mockLighting,
      });

      expect(result).toHaveProperty('bluetooth');
      expect(result).toHaveProperty('audio');
      expect(result).toHaveProperty('lighting');
      expect(result.bluetooth.available).toBe(true);
      expect(result.audio.routes.video.sink).toBe('hdmi');
      expect(result.lighting.connected).toBe(false);
    });

    it('should handle partial service availability', async () => {
      // Only bluetooth provided, others missing
      const mockBluetooth = {
        isAvailable: jest.fn().mockResolvedValue(false),
        getPairedDevices: jest.fn().mockResolvedValue([]),
        getConnectedDevices: jest.fn().mockResolvedValue([]),
        isScanning: jest.fn().mockReturnValue(false),
      };

      const result = await buildEnvironmentState({
        bluetoothService: mockBluetooth,
        // audioRoutingService: undefined
        // lightingService: undefined
      });

      expect(result.bluetooth.available).toBe(false);
      expect(result.audio).toEqual(DEFAULTS.audio);
      expect(result.lighting).toEqual(DEFAULTS.lighting);
    });
  });
});
