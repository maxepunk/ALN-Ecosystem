const { EventEmitter } = require('events');

/**
 * Create a mock bluetoothService matching the real service's public API.
 * Returns an EventEmitter with jest.fn() stubs for all public methods.
 *
 * IMPORTANT: Method names must match backend/src/services/bluetoothService.js exactly.
 * If the real service API changes, update this factory.
 *
 * @param {Object} overrides - Override any default mock return values
 * @returns {EventEmitter} Mock bluetoothService
 */
function createMockBluetoothService(overrides = {}) {
  const mock = new EventEmitter();

  // Initialization and health
  mock.init = jest.fn().mockResolvedValue(undefined);
  mock.checkHealth = jest.fn().mockResolvedValue(true);
  mock.isAvailable = jest.fn().mockResolvedValue(true);
  mock.getAdapterStatus = jest.fn().mockResolvedValue({
    address: 'AA:BB:CC:DD:EE:FF', powered: true, discoverable: false, discovering: false,
  });

  // Scanning
  mock.startScan = jest.fn();
  mock.stopScan = jest.fn().mockResolvedValue(undefined);
  mock.isScanning = jest.fn().mockReturnValue(false);

  // Device queries
  mock.getPairedDevices = jest.fn().mockResolvedValue([]);
  mock.getConnectedDevices = jest.fn().mockResolvedValue([]);
  mock.isAudioDevice = jest.fn().mockResolvedValue(true);

  // Device management
  mock.pairDevice = jest.fn().mockResolvedValue(undefined);
  mock.connectDevice = jest.fn().mockResolvedValue(undefined);
  mock.disconnectDevice = jest.fn().mockResolvedValue(undefined);
  mock.unpairDevice = jest.fn().mockResolvedValue(undefined);

  // State
  mock.getState = jest.fn().mockReturnValue({
    available: true, scanning: false, pairedDevices: [], connectedDevices: [],
  });

  // Monitor
  mock.startDeviceMonitor = jest.fn();
  mock.stopDeviceMonitor = jest.fn();

  // Lifecycle
  mock.cleanup = jest.fn();
  mock.reset = jest.fn();

  // Apply overrides
  Object.assign(mock, overrides);

  return mock;
}

module.exports = { createMockBluetoothService };
