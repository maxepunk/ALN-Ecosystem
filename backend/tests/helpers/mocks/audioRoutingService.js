const { EventEmitter } = require('events');

/**
 * Create a mock audioRoutingService matching the real service's public API.
 * Returns an EventEmitter with jest.fn() stubs for all public methods.
 *
 * IMPORTANT: Method names must match backend/src/services/audioRoutingService.js exactly.
 * If the real service API changes, update this factory.
 *
 * @param {Object} overrides - Override any default mock return values
 * @returns {EventEmitter} Mock audioRoutingService
 */
function createMockAudioRoutingService(overrides = {}) {
  const mock = new EventEmitter();

  // Initialization and health
  mock.init = jest.fn().mockResolvedValue(undefined);
  mock.checkHealth = jest.fn().mockResolvedValue(true);

  // Sink discovery
  mock.getAvailableSinks = jest.fn().mockResolvedValue([]);
  mock.sinkExists = jest.fn().mockReturnValue(false);
  mock.classifySink = jest.fn().mockReturnValue('other');
  mock.getBluetoothSinks = jest.fn().mockResolvedValue([]);
  mock.getHdmiSink = jest.fn().mockResolvedValue(null);

  // Routing table
  mock.setStreamRoute = jest.fn().mockResolvedValue(undefined);
  mock.getStreamRoute = jest.fn().mockReturnValue('hdmi');

  // State
  mock.getState = jest.fn().mockReturnValue({
    routes: {}, defaultSink: 'hdmi', ducking: {}, availableSinks: [],
  });
  mock.getRoutingStatus = jest.fn().mockResolvedValue({
    routes: {}, defaultSink: 'hdmi', availableSinks: [],
  });

  // Stream routing
  mock.applyRouting = jest.fn().mockResolvedValue(undefined);
  mock.applyRoutingWithFallback = jest.fn().mockResolvedValue(undefined);
  mock.findSinkInput = jest.fn().mockResolvedValue(null);
  mock.moveStreamToSink = jest.fn().mockResolvedValue(undefined);

  // Validation
  mock.isValidStream = jest.fn().mockReturnValue(true);

  // Volume control
  mock.setStreamVolume = jest.fn().mockResolvedValue(undefined);
  mock.getStreamVolume = jest.fn().mockResolvedValue(100);

  // Ducking
  mock.loadDuckingRules = jest.fn();
  mock.handleDuckingEvent = jest.fn().mockResolvedValue(undefined);

  // Monitor
  mock.startSinkMonitor = jest.fn();

  // Lifecycle
  mock.cleanup = jest.fn();
  mock.reset = jest.fn();

  // Apply overrides
  Object.assign(mock, overrides);

  return mock;
}

module.exports = { createMockAudioRoutingService };
