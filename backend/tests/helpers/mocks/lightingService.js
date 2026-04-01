const { EventEmitter } = require('events');

/**
 * Create a mock lightingService matching the real service's public API.
 * Returns an EventEmitter with jest.fn() stubs for all public methods.
 *
 * IMPORTANT: Method names must match backend/src/services/lightingService.js exactly.
 * If the real service API changes, update this factory.
 *
 * @param {Object} overrides - Override any default mock return values
 * @returns {EventEmitter} Mock lightingService
 */
function createMockLightingService(overrides = {}) {
  const mock = new EventEmitter();

  // Initialization and connection
  mock.init = jest.fn().mockResolvedValue(undefined);
  mock.isConnected = jest.fn().mockReturnValue(false);
  mock.checkConnection = jest.fn().mockResolvedValue(undefined);

  // Scene management
  mock.getScenes = jest.fn().mockResolvedValue([]);
  mock.getCachedScenes = jest.fn().mockReturnValue([]);
  mock.sceneExists = jest.fn().mockReturnValue(false);
  mock.refreshScenes = jest.fn().mockResolvedValue(undefined);
  mock.activateScene = jest.fn().mockResolvedValue(undefined);
  mock.getActiveScene = jest.fn().mockReturnValue(null);

  // State
  mock.getState = jest.fn().mockReturnValue({
    connected: false, activeScene: null, scenes: [],
  });

  // Lifecycle
  mock.cleanup = jest.fn().mockResolvedValue(undefined);
  mock.reset = jest.fn();

  // Apply overrides
  Object.assign(mock, overrides);

  return mock;
}

module.exports = { createMockLightingService };
