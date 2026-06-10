/**
 * Offline Queue Service Unit Tests
 * Tests offline GM-transaction queue processing without circular dependencies
 *
 * Scope note (D2, 2026-06-09): the player-scan queue and the HTTP 202
 * offline-acceptance path were deleted (the drain never persisted player
 * scans — F-SCAN-04). Only the GM-transaction queue remains.
 */

const offlineQueueService = require('../../../src/services/offlineQueueService');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');

describe('OfflineQueueService - Event-Driven Pattern', () => {
  beforeEach(() => {
    // Reset service state between tests
    offlineQueueService.gmTransactionQueue = [];
    offlineQueueService.isOffline = false;
    offlineQueueService.processingQueue = false;
  });

  afterEach(() => {
    offlineQueueService.removeAllListeners();
    jest.restoreAllMocks();
  });

  describe('processQueue()', () => {
    it('should emit offline:queue:processed event with wrapped envelope', async () => {
      // CRITICAL: Service should emit event, NOT call stateService directly
      jest.spyOn(sessionService, 'getCurrentSession').mockReturnValue({ id: 'test-session' });
      jest.spyOn(transactionService, 'processScan').mockResolvedValue({
        status: 'accepted',
        transactionId: 'tx-1',
        tokenId: 'TEST_001',
        points: 100
      });

      offlineQueueService.gmTransactionQueue = [
        {
          tokenId: 'TEST_001',
          teamId: 'Team Alpha',
          deviceId: 'GM_01',
          deviceType: 'gm',
          mode: 'blackmarket',
          timestamp: new Date().toISOString(),
          queueId: 'gm_q1',
          transactionId: 'tx-1'
        }
      ];

      // Listen for the event
      const eventPromise = new Promise((resolve) => {
        offlineQueueService.once('offline:queue:processed', resolve);
      });

      await offlineQueueService.processQueue();

      const eventData = await eventPromise;

      // Verify wrapped envelope format
      expect(eventData).toHaveProperty('event', 'offline:queue:processed');
      expect(eventData).toHaveProperty('data');
      expect(eventData).toHaveProperty('timestamp');

      // Verify data structure
      expect(eventData.data).toHaveProperty('queueSize', 1);
      expect(eventData.data).toHaveProperty('results');
      expect(Array.isArray(eventData.data.results)).toBe(true);

      // Verify results content
      expect(eventData.data.results[0]).toHaveProperty('transactionId', 'tx-1');
      expect(eventData.data.results[0]).toHaveProperty('status', 'processed');
      expect(eventData.data.results[0]).toHaveProperty('transactionStatus', 'accepted');
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

    it('should keep GM transactions queued when no session exists', async () => {
      jest.spyOn(sessionService, 'getCurrentSession').mockReturnValue(null);
      const processScanSpy = jest.spyOn(transactionService, 'processScan');

      offlineQueueService.gmTransactionQueue = [
        { tokenId: 'TEST_001', teamId: 'Team Alpha', queueId: 'gm_q1', transactionId: 'tx-1' }
      ];

      const result = await offlineQueueService.processQueue();

      expect(result).toEqual([]);
      expect(processScanSpy).not.toHaveBeenCalled();
      expect(offlineQueueService.gmTransactionQueue).toHaveLength(1);
    });
  });

  describe('D2: deleted player-scan acceptance surface', () => {
    it('no longer exposes enqueue() (player-scan queue deleted)', () => {
      expect(offlineQueueService.enqueue).toBeUndefined();
      expect(offlineQueueService.playerScanQueue).toBeUndefined();
    });

    it('no longer exposes the broken getQueueSize() (F-SCAN-16)', () => {
      expect(offlineQueueService.getQueueSize).toBeUndefined();
    });
  });
});
