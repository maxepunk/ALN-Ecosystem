const { EventEmitter } = require('events');

/**
 * Create a mock videoQueueService matching the real service's public API.
 * Returns an EventEmitter with jest.fn() stubs for all public methods.
 *
 * IMPORTANT: Method names must match backend/src/services/videoQueueService.js exactly.
 * If the real service API changes, update this factory.
 *
 * @param {Object} overrides - Override any default mock return values
 * @returns {EventEmitter} Mock videoQueueService
 */
function createMockVideoQueueService(overrides = {}) {
  const mock = new EventEmitter();

  // Exposed state (used by tests and sync:full builders)
  mock.queue = [];
  mock.currentItem = null;

  // Queue operations
  mock.addToQueue = jest.fn();
  mock.addVideoByFilename = jest.fn();
  mock.processQueue = jest.fn().mockResolvedValue(undefined);
  mock.reorderQueue = jest.fn();
  mock.clearQueue = jest.fn();
  mock.clearPending = jest.fn().mockReturnValue(0);
  mock.clearCompleted = jest.fn().mockReturnValue(0);

  // Playback control
  mock.skipCurrent = jest.fn().mockResolvedValue(false);
  mock.pauseCurrent = jest.fn().mockResolvedValue(false);
  mock.resumeCurrent = jest.fn().mockResolvedValue(false);

  // State queries
  mock.getState = jest.fn().mockReturnValue({
    status: 'idle', currentVideo: null, queue: [], queueLength: 0, connected: false,
  });
  mock.getQueueStatus = jest.fn().mockReturnValue({
    currentItem: null, queueLength: 0, pendingCount: 0, completedCount: 0, failedCount: 0,
  });
  mock.getQueueItems = jest.fn().mockReturnValue([]);
  mock.isPlaying = jest.fn().mockReturnValue(false);
  mock.getCurrentVideo = jest.fn().mockReturnValue(null);
  mock.getWaitTime = jest.fn().mockReturnValue(0);
  mock.getRemainingTime = jest.fn().mockReturnValue(0);
  mock.canAcceptVideo = jest.fn().mockReturnValue({ available: true });
  mock.videoFileExists = jest.fn().mockReturnValue(true);

  // Held video management
  mock.getHeldVideos = jest.fn().mockReturnValue([]);
  mock.releaseHeld = jest.fn();
  mock.discardHeld = jest.fn();

  // Hooks
  mock.registerPrePlayHook = jest.fn();

  // Session restore
  mock.updateFromSession = jest.fn();

  // Lifecycle
  mock.reset = jest.fn();

  // Apply overrides
  Object.assign(mock, overrides);

  return mock;
}

module.exports = { createMockVideoQueueService };
