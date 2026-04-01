const { EventEmitter } = require('events');

/**
 * Create a mock offlineQueueService matching the real service's public API.
 * Returns an EventEmitter with jest.fn() stubs for all public methods.
 *
 * IMPORTANT: Method names must match backend/src/services/offlineQueueService.js exactly.
 * If the real service API changes, update this factory.
 *
 * @param {Object} overrides - Override any default mock return values
 * @returns {EventEmitter} Mock offlineQueueService
 */
function createMockOfflineQueueService(overrides = {}) {
  const mock = new EventEmitter();

  // Exposed state
  mock.playerScanQueue = [];
  mock.gmTransactionQueue = [];
  mock.isOffline = false;
  mock.processingQueue = false;

  // Initialization
  mock.init = jest.fn().mockResolvedValue(undefined);

  // Queue operations
  mock.enqueue = jest.fn().mockReturnValue({ queueId: 'scan_mock', transactionId: 'tx-mock' });
  mock.enqueueGmTransaction = jest.fn().mockReturnValue({ queueId: 'gm_mock', transactionId: 'tx-gm-mock' });
  mock.processQueue = jest.fn().mockResolvedValue([]);
  mock.clearQueue = jest.fn().mockResolvedValue(undefined);

  // Status
  mock.getQueueSize = jest.fn().mockReturnValue(0);
  mock.getStatus = jest.fn().mockReturnValue({
    isOffline: false, playerQueueSize: 0, gmQueueSize: 0,
    maxQueueSize: 100, processingQueue: false, instanceId: 1,
  });
  mock.setOfflineStatus = jest.fn();

  // Persistence
  mock.persistQueue = jest.fn().mockResolvedValue(undefined);

  // Lifecycle
  mock.reset = jest.fn().mockResolvedValue(undefined);

  // Apply overrides
  Object.assign(mock, overrides);

  return mock;
}

module.exports = { createMockOfflineQueueService };
