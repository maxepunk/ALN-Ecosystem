/**
 * Offline Queue Service Unit Tests
 * Tests offline queue processing without circular dependencies
 */

const offlineQueueService = require('../../../src/services/offlineQueueService');

describe('OfflineQueueService - Event-Driven Pattern', () => {
  beforeEach(() => {
    // Reset service state between tests
    offlineQueueService.playerScanQueue = [];
    offlineQueueService.gmTransactionQueue = [];
    offlineQueueService.isOffline = false;
    offlineQueueService.processingQueue = false;
  });

  afterEach(() => {
    offlineQueueService.removeAllListeners();
  });

  describe('processQueue()', () => {
    it('should emit offline:queue:processed event with wrapped envelope', async () => {
      // CRITICAL: Service should emit event, NOT call stateService directly

      // Add items to queue
      offlineQueueService.playerScanQueue = [
        {
          tokenId: 'TEST_001',
          deviceId: 'PLAYER_01',
          timestamp: new Date().toISOString(),
          queueId: 'q1',
          transactionId: 'tx-1'
        }
      ];

      // Listen for the event (what stateService will do)
      const eventPromise = new Promise((resolve) => {
        offlineQueueService.once('offline:queue:processed', resolve);
      });

      // Process queue (no session parameter needed)
      await offlineQueueService.processQueue();

      // Wait for event
      const eventData = await eventPromise;

      // Verify wrapped envelope format
      expect(eventData).toHaveProperty('event', 'offline:queue:processed');
      expect(eventData).toHaveProperty('data');
      expect(eventData).toHaveProperty('timestamp');

      // Verify data structure
      expect(eventData.data).toHaveProperty('queueSize');
      expect(eventData.data).toHaveProperty('results');
      expect(Array.isArray(eventData.data.results)).toBe(true);

      // Verify results content
      expect(eventData.data.results[0]).toHaveProperty('transactionId', 'tx-1');
      expect(eventData.data.results[0]).toHaveProperty('status');
    });

    it('should return early without emitting when queue is empty', async () => {
      // TARGET BEHAVIOR: Don't emit event if there's nothing to process
      // This prevents unnecessary broadcasts

      let eventEmitted = false;
      offlineQueueService.once('offline:queue:processed', () => {
        eventEmitted = true;
      });

      const result = await offlineQueueService.processQueue();

      // Should return empty array without emitting event
      expect(result).toEqual([]);
      expect(eventEmitted).toBe(false);
    });
  });
});
