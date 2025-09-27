/**
 * Unit tests for OfflineQueueService
 * Tests core business logic without HTTP/WebSocket layers
 */

describe('OfflineQueueService', () => {
  let service;

  beforeEach(async () => {
    // Reset modules to get a fresh singleton for each test
    jest.resetModules();
    jest.clearAllMocks();

    // Mock dependencies
    jest.mock('../../../src/utils/logger');
    jest.mock('../../../src/services/persistenceService');
    jest.mock('../../../src/services/transactionService');
    jest.mock('../../../src/services/sessionService');
    jest.mock('../../../src/services/stateService');

    // Get the singleton instance (services export instances, not classes)
    service = require('../../../src/services/offlineQueueService');
    // Clear all event listeners to prevent test interference
    service.removeAllListeners();
    // Just clear the queues and state without breaking event listeners
    service.playerScanQueue = [];
    service.gmTransactionQueue = [];
    service.isOffline = false;
    service.processingQueue = false;
  });

  describe('Queue Management', () => {
    test('queues player scans when offline', () => {
      service.isOffline = true;

      const scanLog = {
        tokenId: 'TEST_001',
        scannerId: 'PLAYER_001',
        timestamp: new Date().toISOString()
      };

      const result = service.enqueue(scanLog);

      expect(result).toBeTruthy();
      expect(result.queueId).toMatch(/^scan_/);
      expect(result.transactionId).toBeDefined();
      expect(service.playerScanQueue).toHaveLength(1);
      expect(service.playerScanQueue[0].tokenId).toBe('TEST_001');
    });

    test('queues GM transactions when offline', () => {
      service.isOffline = true;

      const transaction = {
        tokenId: 'TEST_002',
        teamId: 'TEAM_A',
        scannerId: 'GM_001'
      };

      const result = service.enqueueGmTransaction(transaction);

      expect(result).toBeTruthy();
      expect(result.queueId).toMatch(/^gm_/);
      expect(service.gmTransactionQueue).toHaveLength(1);
      expect(service.gmTransactionQueue[0].tokenId).toBe('TEST_002');
    });

    test('respects max queue size for player scans', () => {
      service.isOffline = true;
      service.maxQueueSize = 2;

      // Fill the queue
      service.enqueue({ tokenId: 'TEST_1' });
      service.enqueue({ tokenId: 'TEST_2' });

      // Try to add beyond limit
      const result = service.enqueue({ tokenId: 'TEST_3' });

      expect(result).toBeNull();
      expect(service.playerScanQueue).toHaveLength(2);
    });

    test('respects max queue size for GM transactions', () => {
      service.isOffline = true;
      service.maxQueueSize = 2;

      // Fill the queue
      service.enqueueGmTransaction({ tokenId: 'TEST_1' });
      service.enqueueGmTransaction({ tokenId: 'TEST_2' });

      // Try to add beyond limit
      const result = service.enqueueGmTransaction({ tokenId: 'TEST_3' });

      expect(result).toBeNull();
      expect(service.gmTransactionQueue).toHaveLength(2);
    });

    test('maintains separate queues for players and GMs', () => {
      service.isOffline = true;

      service.enqueue({ tokenId: 'PLAYER_1' });
      service.enqueue({ tokenId: 'PLAYER_2' });
      service.enqueueGmTransaction({ tokenId: 'GM_1' });
      service.enqueueGmTransaction({ tokenId: 'GM_2' });
      service.enqueueGmTransaction({ tokenId: 'GM_3' });

      expect(service.playerScanQueue).toHaveLength(2);
      expect(service.gmTransactionQueue).toHaveLength(3);
    });

    test('clears queues on reset', async () => {
      service.playerScanQueue = [{ tokenId: 'TEST_1' }];
      service.gmTransactionQueue = [{ tokenId: 'TEST_2' }];
      service.isOffline = true;

      await service.reset();

      expect(service.playerScanQueue).toHaveLength(0);
      expect(service.gmTransactionQueue).toHaveLength(0);
      expect(service.isOffline).toBe(false);
    });
  });

  describe('Status Management', () => {
    test('tracks offline status correctly', () => {
      expect(service.isOffline).toBe(false);

      service.setOfflineStatus(true);
      expect(service.isOffline).toBe(true);

      service.setOfflineStatus(false);
      expect(service.isOffline).toBe(false);
    });

    test('emits status:changed event when status changes', () => {
      const mockHandler = jest.fn();
      service.on('status:changed', mockHandler);

      service.setOfflineStatus(true);

      expect(mockHandler).toHaveBeenCalledWith({ offline: true });
    });

    test('does not emit event when status unchanged', () => {
      // Ensure we start with a known state
      service.isOffline = false;

      // First set to true
      service.setOfflineStatus(true);

      // Now attach handler and set to true again (no change)
      const mockHandler = jest.fn();
      service.on('status:changed', mockHandler);

      service.setOfflineStatus(true);

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Queue Processing', () => {
    test('processes player scan queue when coming online', async () => {
      service.playerScanQueue = [
        { tokenId: 'TEST_1', queueId: 'scan_1' },
        { tokenId: 'TEST_2', queueId: 'scan_2' }
      ];

      const processed = await service.processQueue();

      expect(processed).toHaveLength(2);
      expect(service.playerScanQueue).toHaveLength(0);
    });

    test('processes GM transaction queue when session exists', async () => {
      const sessionService = require('../../../src/services/sessionService');
      const transactionService = require('../../../src/services/transactionService');

      sessionService.getCurrentSession = jest.fn(() => ({ id: 'session-1' }));
      transactionService.processScan = jest.fn(() => ({
        transaction: { id: 'tx-1' },
        status: 'accepted'
      }));
      sessionService.addTransaction = jest.fn();

      service.gmTransactionQueue = [
        { tokenId: 'TEST_1', queueId: 'gm_1', transactionId: 'tx-1' }
      ];

      const processed = await service.processQueue();

      expect(processed).toHaveLength(1);
      expect(transactionService.processScan).toHaveBeenCalled();
      expect(sessionService.addTransaction).toHaveBeenCalled();
      expect(service.gmTransactionQueue).toHaveLength(0);
    });

    test('does not process empty queues', async () => {
      const processed = await service.processQueue();

      expect(processed).toHaveLength(0);
    });

    test('does not process if already processing', async () => {
      service.processingQueue = true;
      service.playerScanQueue = [{ tokenId: 'TEST_1' }];

      const processed = await service.processQueue();

      expect(processed).toHaveLength(0);
      expect(service.playerScanQueue).toHaveLength(1);
    });
  });

  describe('Automatic Processing', () => {
    test('triggers queue processing when coming back online', (done) => {
      service.isOffline = true;
      service.playerScanQueue = [{ tokenId: 'TEST_1' }];

      // Mock processQueue to verify it's called
      service.processQueue = jest.fn(async () => {
        expect(service.processQueue).toHaveBeenCalled();
        done();
        return [];
      });

      service.setOfflineStatus(false);
    });

    test('does not trigger processing when going offline', (done) => {
      service.isOffline = false;
      service.processQueue = jest.fn();

      service.setOfflineStatus(true);

      // Give time for any async operations
      setTimeout(() => {
        expect(service.processQueue).not.toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('Event Emissions', () => {
    test('emits scan:queued when player scan queued', () => {
      const mockHandler = jest.fn();
      service.on('scan:queued', mockHandler);

      const scan = { tokenId: 'TEST_1' };
      service.enqueue(scan);

      expect(mockHandler).toHaveBeenCalled();
      expect(mockHandler.mock.calls[0][0]).toMatchObject({ tokenId: 'TEST_1' });
    });

    test('emits transaction:queued when GM transaction queued', () => {
      const mockHandler = jest.fn();
      service.on('transaction:queued', mockHandler);

      const transaction = { tokenId: 'TEST_1' };
      service.enqueueGmTransaction(transaction);

      expect(mockHandler).toHaveBeenCalled();
      expect(mockHandler.mock.calls[0][0]).toMatchObject({ tokenId: 'TEST_1' });
    });

    test('emits queue:processed after processing', async () => {
      const mockHandler = jest.fn();
      service.on('queue:processed', mockHandler);

      // Add a complete scan object to the queue
      service.playerScanQueue = [{
        tokenId: 'TEST_1',
        queueId: 'scan_1',
        scannerId: 'SCANNER_01',
        teamId: 'TEAM_A',
        timestamp: new Date().toISOString()
      }];
      await service.processQueue();

      expect(mockHandler).toHaveBeenCalled();
      expect(mockHandler.mock.calls[0][0]).toMatchObject({
        processed: expect.any(Array),
        failed: expect.any(Array)
      });
    });
  });
});