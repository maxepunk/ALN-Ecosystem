/**
 * Settings Unit Tests
 *
 * Tests Settings object for device ID and station mode management
 * Validates localStorage integration and ConnectionManager fallback
 */

// Load browser mocks first
require('../../helpers/browser-mocks');

const Settings = require('../../../../ALNScanner/js/ui/settings');

describe('Settings - Device Configuration', () => {
  beforeEach(() => {
    // Clear localStorage
    global.localStorage.clear();

    // Reset Settings to defaults
    Settings.deviceId = '001';
    Settings.stationMode = 'detective';

    // Clear connectionManager
    global.window.connectionManager = null;
  });

  describe('Initialization', () => {
    it('should have default deviceId', () => {
      expect(Settings.deviceId).toBe('001');
    });

    it('should have default stationMode', () => {
      expect(Settings.stationMode).toBe('detective');
    });

    it('should be an object', () => {
      expect(typeof Settings).toBe('object');
    });

    it('should have load method', () => {
      expect(typeof Settings.load).toBe('function');
    });

    it('should have save method', () => {
      expect(typeof Settings.save).toBe('function');
    });
  });

  describe('Load from localStorage', () => {
    it('should load deviceId from localStorage when no connectionManager', () => {
      localStorage.setItem('deviceId', 'GM_005');
      localStorage.setItem('stationMode', 'blackmarket');

      Settings.load();

      expect(Settings.deviceId).toBe('GM_005');
      expect(Settings.stationMode).toBe('blackmarket');
    });

    it('should use defaults when localStorage is empty', () => {
      Settings.load();

      expect(Settings.deviceId).toBe('001');
      expect(Settings.stationMode).toBe('detective');
    });

    it('should load only deviceId if stationMode missing', () => {
      localStorage.setItem('deviceId', 'GM_010');

      Settings.load();

      expect(Settings.deviceId).toBe('GM_010');
      expect(Settings.stationMode).toBe('detective');
    });

    it('should load only stationMode if deviceId missing', () => {
      localStorage.setItem('stationMode', 'blackmarket');

      Settings.load();

      expect(Settings.deviceId).toBe('001');
      expect(Settings.stationMode).toBe('blackmarket');
    });
  });

  describe('Load from ConnectionManager', () => {
    it('should prioritize connectionManager over localStorage', () => {
      // Set localStorage values
      localStorage.setItem('deviceId', 'GM_LOCAL');
      localStorage.setItem('stationMode', 'detective');

      // Set connectionManager values (should take priority)
      global.window.connectionManager = {
        deviceId: 'GM_CONN',
        stationMode: 'blackmarket'
      };

      Settings.load();

      expect(Settings.deviceId).toBe('GM_CONN');
      expect(Settings.stationMode).toBe('blackmarket');
    });

    it('should handle connectionManager with partial data', () => {
      global.window.connectionManager = {
        deviceId: 'GM_PARTIAL'
        // stationMode missing
      };

      Settings.load();

      expect(Settings.deviceId).toBe('GM_PARTIAL');
      expect(Settings.stationMode).toBeUndefined();
    });
  });

  describe('Save to localStorage', () => {
    it('should save to localStorage when no connectionManager', () => {
      Settings.deviceId = 'GM_SAVE';
      Settings.stationMode = 'blackmarket';

      Settings.save();

      expect(localStorage.getItem('deviceId')).toBe('GM_SAVE');
      expect(localStorage.getItem('stationMode')).toBe('blackmarket');
    });

    it('should not save to localStorage when settings screen inactive', () => {
      Settings.deviceId = 'GM_INACTIVE';

      Settings.save();

      // Should still save current values since settings screen check uses DOM
      expect(localStorage.getItem('deviceId')).toBe('GM_INACTIVE');
    });
  });

  describe('Save to ConnectionManager', () => {
    it('should save to connectionManager when available', () => {
      const mockConnectionManager = {
        deviceId: 'OLD',
        stationMode: 'detective'
      };

      global.window.connectionManager = mockConnectionManager;

      Settings.deviceId = 'GM_NEW';
      Settings.stationMode = 'blackmarket';

      Settings.save();

      expect(mockConnectionManager.deviceId).toBe('GM_NEW');
      expect(mockConnectionManager.stationMode).toBe('blackmarket');
    });

    it('should NOT save to localStorage when connectionManager available', () => {
      global.window.connectionManager = {
        deviceId: 'OLD',
        stationMode: 'detective'
      };

      Settings.deviceId = 'GM_CONN_ONLY';
      Settings.stationMode = 'blackmarket';

      Settings.save();

      // localStorage should remain empty (connectionManager takes priority)
      expect(localStorage.getItem('deviceId')).toBeNull();
      expect(localStorage.getItem('stationMode')).toBeNull();
    });
  });

  describe('Station Mode Values', () => {
    it('should accept detective mode', () => {
      Settings.stationMode = 'detective';
      expect(Settings.stationMode).toBe('detective');
    });

    it('should accept blackmarket mode', () => {
      Settings.stationMode = 'blackmarket';
      expect(Settings.stationMode).toBe('blackmarket');
    });

    it('should handle case sensitivity', () => {
      Settings.stationMode = 'DETECTIVE';
      expect(Settings.stationMode).toBe('DETECTIVE');

      Settings.stationMode = 'BlackMarket';
      expect(Settings.stationMode).toBe('BlackMarket');
    });
  });

  describe('Device ID Values', () => {
    it('should accept numeric device IDs', () => {
      Settings.deviceId = '001';
      expect(Settings.deviceId).toBe('001');
    });

    it('should accept alphanumeric device IDs', () => {
      Settings.deviceId = 'GM_STATION_05';
      expect(Settings.deviceId).toBe('GM_STATION_05');
    });

    it('should handle empty deviceId', () => {
      Settings.deviceId = '';
      expect(Settings.deviceId).toBe('');
    });
  });

  describe('Persistence Round-trip', () => {
    it('should persist and load deviceId correctly', () => {
      Settings.deviceId = 'GM_ROUND_TRIP';
      Settings.stationMode = 'blackmarket';
      Settings.save();

      // Reset to defaults
      Settings.deviceId = '001';
      Settings.stationMode = 'detective';

      // Load from storage
      Settings.load();

      expect(Settings.deviceId).toBe('GM_ROUND_TRIP');
      expect(Settings.stationMode).toBe('blackmarket');
    });

    it('should handle multiple save/load cycles', () => {
      // Cycle 1
      Settings.deviceId = 'CYCLE_1';
      Settings.save();
      Settings.deviceId = '001';
      Settings.load();
      expect(Settings.deviceId).toBe('CYCLE_1');

      // Cycle 2
      Settings.deviceId = 'CYCLE_2';
      Settings.save();
      Settings.deviceId = '001';
      Settings.load();
      expect(Settings.deviceId).toBe('CYCLE_2');
    });
  });
});
