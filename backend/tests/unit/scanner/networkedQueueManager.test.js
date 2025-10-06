/**
 * NetworkedQueueManager Unit Tests
 *
 * Tests offline transaction queueing per Functional Requirements 2.4, 3.5
 * Validates AsyncAPI transaction:submit event structure
 */

// Load browser mocks first
require('../../helpers/browser-mocks');

const NetworkedQueueManager = require('../../../../ALNScanner/js/network/networkedQueueManager');

describe('NetworkedQueueManager - Offline Queue', () => {
  let queueManager;
  let mockConnection;

  beforeEach(() => {
    // Clear localStorage before each test
    global.localStorage.clear();

    // Create mock connection
    mockConnection = {
      socket: {
        connected: false,
        emit: jest.fn(),
        once: jest.fn()
      }
    };

    // Create queue manager
    queueManager = new NetworkedQueueManager(mockConnection);
  });

  describe('Initialization', () => {
    it('should initialize with empty queue', () => {
      expect(queueManager.tempQueue).toEqual([]);
      expect(queueManager.syncing).toBe(false);
    });

    it('should load persisted queue from localStorage on init', () => {
      // Pre-populate localStorage
      const savedQueue = [
        { tokenId: 'abc123', teamId: '001', deviceId: 'GM_TEST' }
      ];
      localStorage.setItem('networkedTempQueue', JSON.stringify(savedQueue));

      // Create new manager (should load queue)
      const newManager = new NetworkedQueueManager(mockConnection);

      expect(newManager.tempQueue).toEqual(savedQueue);
    });

    it('should handle corrupted queue data gracefully', () => {
      localStorage.setItem('networkedTempQueue', 'invalid json{]');

      const newManager = new NetworkedQueueManager(mockConnection);

      expect(newManager.tempQueue).toEqual([]);
    });
  });

  describe('Queue Transactions (Offline)', () => {
    it('should queue transaction when not connected', () => {
      const transaction = {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_TEST',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      };

      mockConnection.socket.connected = false;

      queueManager.queueTransaction(transaction);

      expect(queueManager.tempQueue).toHaveLength(1);
      expect(queueManager.tempQueue[0]).toEqual(transaction);
    });

    it('should persist queue to localStorage when offline', () => {
      const transaction = {
        tokenId: 'rat001',
        teamId: '002',
        deviceId: 'GM_TEST',
        mode: 'detective',
        timestamp: new Date().toISOString()
      };

      mockConnection.socket.connected = false;

      queueManager.queueTransaction(transaction);

      const saved = JSON.parse(localStorage.getItem('networkedTempQueue'));
      expect(saved).toEqual([transaction]);
    });

    it('should send transaction immediately when connected', () => {
      const transaction = {
        tokenId: 'hos001',
        teamId: '001',
        deviceId: 'GM_TEST',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      };

      mockConnection.socket.connected = true;

      queueManager.queueTransaction(transaction);

      // Should emit wrapped event per AsyncAPI contract
      expect(mockConnection.socket.emit).toHaveBeenCalledWith(
        'transaction:submit',
        expect.objectContaining({
          event: 'transaction:submit',
          data: transaction,
          timestamp: expect.any(String)
        })
      );

      // Should NOT queue
      expect(queueManager.tempQueue).toHaveLength(0);
    });

    it('should queue multiple transactions while offline', () => {
      mockConnection.socket.connected = false;

      const transactions = [
        { tokenId: 'abc1', teamId: '001', deviceId: 'GM_TEST', mode: 'blackmarket' },
        { tokenId: 'abc2', teamId: '001', deviceId: 'GM_TEST', mode: 'blackmarket' },
        { tokenId: 'abc3', teamId: '002', deviceId: 'GM_TEST', mode: 'detective' }
      ];

      transactions.forEach(tx => queueManager.queueTransaction(tx));

      expect(queueManager.tempQueue).toHaveLength(3);
    });
  });

  describe('Queue Synchronization', () => {
    it('should sync all queued transactions when connection restored', async () => {
      // Queue transactions while offline
      mockConnection.socket.connected = false;

      const transactions = [
        { tokenId: 'abc1', teamId: '001', mode: 'blackmarket' },
        { tokenId: 'abc2', teamId: '002', mode: 'detective' }
      ];

      transactions.forEach(tx => queueManager.queueTransaction(tx));

      // Restore connection
      mockConnection.socket.connected = true;

      // Sync queue
      await queueManager.syncQueue();

      // Should emit both transactions
      expect(mockConnection.socket.emit).toHaveBeenCalledTimes(2);
      expect(mockConnection.socket.emit).toHaveBeenCalledWith(
        'transaction:submit',
        expect.objectContaining({
          event: 'transaction:submit',
          data: transactions[0]
        })
      );
      expect(mockConnection.socket.emit).toHaveBeenCalledWith(
        'transaction:submit',
        expect.objectContaining({
          event: 'transaction:submit',
          data: transactions[1]
        })
      );
    });

    it('should clear queue after successful sync', async () => {
      mockConnection.socket.connected = false;

      queueManager.queueTransaction({ tokenId: 'test1', teamId: '001' });
      queueManager.queueTransaction({ tokenId: 'test2', teamId: '002' });

      expect(queueManager.tempQueue).toHaveLength(2);

      // Restore connection and sync
      mockConnection.socket.connected = true;
      await queueManager.syncQueue();

      expect(queueManager.tempQueue).toHaveLength(0);
      expect(localStorage.getItem('networkedTempQueue')).toBeNull();
    });

    it('should not sync when still offline', async () => {
      mockConnection.socket.connected = false;

      queueManager.queueTransaction({ tokenId: 'test', teamId: '001' });

      await queueManager.syncQueue();

      // Should not emit anything
      expect(mockConnection.socket.emit).not.toHaveBeenCalled();

      // Queue should remain
      expect(queueManager.tempQueue).toHaveLength(1);
    });

    it('should prevent concurrent sync operations', async () => {
      // Queue while offline
      mockConnection.socket.connected = false;
      queueManager.queueTransaction({ tokenId: 'test1', teamId: '001' });

      // Restore connection
      mockConnection.socket.connected = true;

      // Set syncing flag to simulate sync in progress
      queueManager.syncing = true;

      await queueManager.syncQueue();

      // Should not sync (already syncing)
      expect(mockConnection.socket.emit).not.toHaveBeenCalled();
    });

    it('should handle empty queue gracefully', async () => {
      mockConnection.socket.connected = true;

      await queueManager.syncQueue();

      expect(mockConnection.socket.emit).not.toHaveBeenCalled();
    });
  });

  describe('AsyncAPI Contract Compliance', () => {
    it('should wrap transaction in AsyncAPI envelope structure', () => {
      const transaction = {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_TEST',
        mode: 'blackmarket',
        timestamp: '2025-10-06T12:00:00.000Z'
      };

      mockConnection.socket.connected = true;

      queueManager.queueTransaction(transaction);

      expect(mockConnection.socket.emit).toHaveBeenCalledWith(
        'transaction:submit',
        {
          event: 'transaction:submit',
          data: transaction,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        }
      );
    });

    it('should include all required transaction fields per AsyncAPI', () => {
      const transaction = {
        tokenId: 'rat001',
        teamId: '002',
        deviceId: 'GM_STATION_1',
        mode: 'detective',
        timestamp: new Date().toISOString()
      };

      mockConnection.socket.connected = true;

      queueManager.queueTransaction(transaction);

      const emittedData = mockConnection.socket.emit.mock.calls[0][1].data;

      expect(emittedData).toHaveProperty('tokenId');
      expect(emittedData).toHaveProperty('teamId');
      expect(emittedData).toHaveProperty('deviceId');
      expect(emittedData).toHaveProperty('mode');
      expect(emittedData).toHaveProperty('timestamp');
    });
  });

  describe('Storage Error Handling', () => {
    it('should handle QuotaExceededError when localStorage full', () => {
      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = localStorage.setItem;
      const mockAlert = jest.spyOn(global, 'alert').mockImplementation();

      localStorage.setItem = jest.fn(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      mockConnection.socket.connected = false;

      queueManager.queueTransaction({ tokenId: 'test', teamId: '001' });

      // Should alert user
      expect(mockAlert).toHaveBeenCalledWith(
        expect.stringContaining('Storage full')
      );

      // Restore
      localStorage.setItem = originalSetItem;
      mockAlert.mockRestore();
    });
  });

  describe('Orphaned Transaction Merging', () => {
    it('should merge transactions from fallback queue on init', () => {
      // Simulate orphaned transactions in fallback queue
      const orphaned = [
        { tokenId: 'orphan1', teamId: '001', mode: 'blackmarket' },
        { tokenId: 'orphan2', teamId: '002', mode: 'detective' }
      ];

      localStorage.setItem('pendingNetworkedTransactions', JSON.stringify(orphaned));

      // Create new manager (should merge orphaned)
      const newManager = new NetworkedQueueManager(mockConnection);

      expect(newManager.tempQueue).toEqual(orphaned);
      expect(localStorage.getItem('pendingNetworkedTransactions')).toBeNull();
    });

    it('should combine orphaned and existing queue', () => {
      const existing = [
        { tokenId: 'existing1', teamId: '001' }
      ];

      const orphaned = [
        { tokenId: 'orphan1', teamId: '002' }
      ];

      localStorage.setItem('networkedTempQueue', JSON.stringify(existing));
      localStorage.setItem('pendingNetworkedTransactions', JSON.stringify(orphaned));

      const newManager = new NetworkedQueueManager(mockConnection);

      expect(newManager.tempQueue).toHaveLength(2);
      expect(newManager.tempQueue).toContainEqual(existing[0]);
      expect(newManager.tempQueue).toContainEqual(orphaned[0]);
    });
  });

  describe('Queue Status', () => {
    it('should report queue status correctly', () => {
      mockConnection.socket.connected = false;

      queueManager.queueTransaction({ tokenId: 'test1', teamId: '001' });
      queueManager.queueTransaction({ tokenId: 'test2', teamId: '002' });

      const status = queueManager.getStatus();

      expect(status.queuedCount).toBe(2);
      expect(status.syncing).toBe(false);
    });

    it('should report syncing status', () => {
      queueManager.syncing = true;

      const status = queueManager.getStatus();

      expect(status.syncing).toBe(true);
    });
  });

  describe('Queue Clearing', () => {
    it('should clear queue and localStorage', () => {
      mockConnection.socket.connected = false;

      queueManager.queueTransaction({ tokenId: 'test', teamId: '001' });

      expect(queueManager.tempQueue).toHaveLength(1);
      expect(localStorage.getItem('networkedTempQueue')).not.toBeNull();

      queueManager.clearQueue();

      expect(queueManager.tempQueue).toHaveLength(0);
      expect(localStorage.getItem('networkedTempQueue')).toBeNull();
    });
  });
});
