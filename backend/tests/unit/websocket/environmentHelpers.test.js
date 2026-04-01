/**
 * Unit Tests: environmentHelpers.js
 * Tests the buildEnvironmentState helper used by sync:full payloads.
 */

const { buildEnvironmentState, DEFAULTS } = require('../../../src/websocket/environmentHelpers');

describe('environmentHelpers - buildEnvironmentState', () => {
  describe('with no services provided', () => {
    it('should return default values when called with no arguments', () => {
      const result = buildEnvironmentState();

      expect(result).toEqual({
        bluetooth: DEFAULTS.bluetooth,
        audio: DEFAULTS.audio,
        lighting: DEFAULTS.lighting,
      });
    });

    it('should return default values when called with empty object', () => {
      const result = buildEnvironmentState({});

      expect(result).toEqual({
        bluetooth: DEFAULTS.bluetooth,
        audio: DEFAULTS.audio,
        lighting: DEFAULTS.lighting,
      });
    });
  });

  describe('bluetooth state', () => {
    it('should gather bluetooth state from service', () => {
      const mockBluetooth = {
        getState: jest.fn().mockReturnValue({
          scanning: false,
          pairedDevices: [
            { address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true },
          ],
          connectedDevices: [
            { address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true },
          ],
        }),
      };

      const result = buildEnvironmentState({ bluetoothService: mockBluetooth });

      expect(result.bluetooth).toEqual({
        scanning: false,
        pairedDevices: [{ address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true }],
        connectedDevices: [{ address: 'AA:BB:CC:DD:EE:FF', name: 'Speaker', connected: true }],
      });
    });

    it('should report scanning: true when service reports scanning', () => {
      const mockBluetooth = {
        getState: jest.fn().mockReturnValue({
          scanning: true,
          pairedDevices: [],
          connectedDevices: [],
        }),
      };

      const result = buildEnvironmentState({ bluetoothService: mockBluetooth });

      expect(result.bluetooth.scanning).toBe(true);
    });

    it('should fall back to defaults on bluetooth error', () => {
      const mockBluetooth = {
        getState: jest.fn().mockImplementation(() => {
          throw new Error('bluetoothctl not found');
        }),
      };

      const result = buildEnvironmentState({ bluetoothService: mockBluetooth });

      expect(result.bluetooth).toEqual(DEFAULTS.bluetooth);
    });
  });

  describe('audio state', () => {
    it('should gather audio state from service', () => {
      const mockAudio = {
        getState: jest.fn().mockReturnValue({
          routes: { video: 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink' },
          defaultSink: 'hdmi',
          ducking: {},
          availableSinks: [],
        }),
      };

      const result = buildEnvironmentState({ audioRoutingService: mockAudio });

      expect(result.audio).toEqual({
        routes: { video: 'bluez_sink.AA_BB_CC_DD_EE_FF.a2dp_sink' },
        defaultSink: 'hdmi',
        ducking: {},
        availableSinks: [],
      });
    });

    it('should fall back to defaults on audio error', () => {
      const mockAudio = {
        getState: jest.fn().mockImplementation(() => {
          throw new Error('pactl error');
        }),
      };

      const result = buildEnvironmentState({ audioRoutingService: mockAudio });

      expect(result.audio).toEqual(DEFAULTS.audio);
    });
  });

  describe('lighting state', () => {
    it('should gather lighting state from service', () => {
      const mockLighting = {
        getState: jest.fn().mockReturnValue({
          connected: true,
          scenes: [
            { id: 'scene.dramatic_red', name: 'Dramatic Red' },
            { id: 'scene.cool_blue', name: 'Cool Blue' },
          ],
          activeScene: 'scene.dramatic_red',
        }),
      };

      const result = buildEnvironmentState({ lightingService: mockLighting });

      expect(result.lighting).toEqual({
        connected: true,
        scenes: [
          { id: 'scene.dramatic_red', name: 'Dramatic Red' },
          { id: 'scene.cool_blue', name: 'Cool Blue' },
        ],
        activeScene: 'scene.dramatic_red',
      });
    });

    it('should report disconnected and empty scenes', () => {
      const mockLighting = {
        getState: jest.fn().mockReturnValue({
          connected: false,
          scenes: [],
          activeScene: null,
        }),
      };

      const result = buildEnvironmentState({ lightingService: mockLighting });

      expect(result.lighting).toEqual({
        connected: false,
        scenes: [],
        activeScene: null,
      });
    });

    it('should fall back to defaults on lighting error', () => {
      const mockLighting = {
        getState: jest.fn().mockImplementation(() => {
          throw new Error('HA unreachable');
        }),
      };

      const result = buildEnvironmentState({ lightingService: mockLighting });

      expect(result.lighting).toEqual(DEFAULTS.lighting);
    });
  });

  describe('combined services', () => {
    it('should gather state from all three services together', () => {
      const mockBluetooth = {
        getState: jest.fn().mockReturnValue({
          scanning: false,
          pairedDevices: [],
          connectedDevices: [],
        }),
      };

      const mockAudio = {
        getState: jest.fn().mockReturnValue({
          routes: { video: 'hdmi' },
          defaultSink: 'hdmi',
          ducking: {},
          availableSinks: [],
        }),
      };

      const mockLighting = {
        getState: jest.fn().mockReturnValue({
          connected: false,
          scenes: [],
          activeScene: null,
        }),
      };

      const result = buildEnvironmentState({
        bluetoothService: mockBluetooth,
        audioRoutingService: mockAudio,
        lightingService: mockLighting,
      });

      expect(result).toHaveProperty('bluetooth');
      expect(result).toHaveProperty('audio');
      expect(result).toHaveProperty('lighting');
      expect(result.audio.routes.video).toBe('hdmi');
      expect(result.lighting.connected).toBe(false);
    });

    it('should handle partial service availability', () => {
      const mockBluetooth = {
        getState: jest.fn().mockReturnValue({
          scanning: false,
          pairedDevices: [],
          connectedDevices: [],
        }),
      };

      const result = buildEnvironmentState({
        bluetoothService: mockBluetooth,
      });

      expect(result.bluetooth.scanning).toBe(false);
      expect(result.audio).toEqual(DEFAULTS.audio);
      expect(result.lighting).toEqual(DEFAULTS.lighting);
    });
  });
});
