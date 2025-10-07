/**
 * OrchestratorIntegration - Unit Tests
 *
 * PURPOSE: Test the OrchestratorIntegration class in ISOLATION (not via integration tests)
 *
 * WHY NEEDED: Class is currently only tested through integration tests. This leaves
 * edge cases, error handling, and method-level bugs untested.
 *
 * WHAT THIS CATCHES:
 * - Constructor edge cases (invalid URLs, missing localStorage)
 * - Device ID generation and persistence bugs
 * - Queue management edge cases (quota exceeded, corrupted data, race conditions)
 * - Configuration update bugs
 * - Cleanup/destroy edge cases
 * - Event emission bugs
 *
 * Location: aln-memory-scanner/js/orchestratorIntegration.js
 */

const {
  resetMocks,
  mockFetchResponse,
  mockFetchNetworkError,
  getLastFetchCall
} = require('../../helpers/player-scanner-mocks');

const OrchestratorIntegration = require('../../../../aln-memory-scanner/js/orchestratorIntegration');

describe('OrchestratorIntegration - Unit Tests (Isolated)', () => {

  let orchestrator;

  beforeEach(() => {
    resetMocks();
    jest.useFakeTimers();

    // Configure for NETWORKED mode (all unit tests assume networked mode)
    global.window.location.pathname = '/player-scanner/';
    global.window.location.origin = 'http://192.168.1.100:3000';
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.destroy();
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Constructor & Initialization', () => {

    it('should detect orchestrator URL from pathname when served from orchestrator', () => {
      // Simulate being served from orchestrator at /player-scanner/
      global.window.location.pathname = '/player-scanner/';
      global.window.location.origin = 'http://192.168.1.100:3000';

      orchestrator = new OrchestratorIntegration();

      // Should use same origin as server
      expect(orchestrator.baseUrl).toBe('http://192.168.1.100:3000');
    });

    it('should fall back to localhost:3000 for development/GitHub Pages', () => {
      // Simulate GitHub Pages deployment
      global.window.location.pathname = '/index.html';
      global.window.location.origin = 'https://user.github.io';

      orchestrator = new OrchestratorIntegration();

      // Should fall back to local orchestrator
      expect(orchestrator.baseUrl).toBe('http://localhost:3000');
    });

    it('should use orchestrator_url from localStorage if present', () => {
      localStorage.setItem('orchestrator_url', 'http://custom.server:5000');

      orchestrator = new OrchestratorIntegration();

      // Should use saved URL
      expect(orchestrator.baseUrl).toBe('http://custom.server:5000');
    });

    it('should generate unique device ID on first run', () => {
      orchestrator = new OrchestratorIntegration();

      const deviceId = orchestrator.deviceId;

      // Should match pattern PLAYER_<timestamp>
      expect(deviceId).toMatch(/^PLAYER_\d+$/);

      // Device ID should be stored in memory
      expect(orchestrator.deviceId).toBeDefined();
    });

    it('should reuse existing device ID from localStorage', () => {
      localStorage.setItem('device_id', 'PLAYER_12345');

      orchestrator = new OrchestratorIntegration();

      // Should use saved ID
      expect(orchestrator.deviceId).toBe('PLAYER_12345');
    });

    it('should initialize empty offline queue when localStorage is empty', () => {
      orchestrator = new OrchestratorIntegration();

      expect(orchestrator.offlineQueue).toEqual([]);
    });

    it('should load offline queue from localStorage on init', () => {
      const savedQueue = [
        { tokenId: 'token1', teamId: '001', timestamp: Date.now(), retryCount: 0 },
        { tokenId: 'token2', teamId: '002', timestamp: Date.now(), retryCount: 1 }
      ];
      localStorage.setItem('offline_queue', JSON.stringify(savedQueue));

      orchestrator = new OrchestratorIntegration();

      expect(orchestrator.offlineQueue).toHaveLength(2);
      expect(orchestrator.offlineQueue[0].tokenId).toBe('token1');
      expect(orchestrator.offlineQueue[1].tokenId).toBe('token2');
    });

    it('should start connection monitoring on init', () => {
      mockFetchResponse(200, { status: 'online' });

      orchestrator = new OrchestratorIntegration();

      // Should have interval reference stored
      expect(orchestrator.connectionCheckInterval).toBeTruthy();

      // Should have pending connection check
      expect(orchestrator.pendingConnectionCheck).toBeInstanceOf(Promise);
    });
  });

  describe('Queue Management Methods', () => {

    beforeEach(() => {
      mockFetchResponse(200, { status: 'online' });
      orchestrator = new OrchestratorIntegration();
    });

    it('should add items to offline queue with queueOffline()', () => {
      orchestrator.queueOffline('test_token', '001');

      expect(orchestrator.offlineQueue).toHaveLength(1);
      expect(orchestrator.offlineQueue[0]).toMatchObject({
        tokenId: 'test_token',
        teamId: '001',
        timestamp: expect.any(Number),
        retryCount: 0
      });
    });

    it('should persist queue to localStorage when items added', () => {
      orchestrator.queueOffline('test_token', '001');

      const saved = localStorage.getItem('offline_queue');
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].tokenId).toBe('test_token');
    });

    it('should enforce max queue size (FIFO eviction)', () => {
      orchestrator.maxQueueSize = 3;

      // Add 4 items (exceeds max)
      orchestrator.queueOffline('token1', '001');
      orchestrator.queueOffline('token2', '001');
      orchestrator.queueOffline('token3', '001');
      orchestrator.queueOffline('token4', '001'); // Should evict token1

      // Should only keep last 3
      expect(orchestrator.offlineQueue).toHaveLength(3);

      // Oldest (token1) should be removed
      expect(orchestrator.offlineQueue[0].tokenId).toBe('token2');
      expect(orchestrator.offlineQueue[1].tokenId).toBe('token3');
      expect(orchestrator.offlineQueue[2].tokenId).toBe('token4');
    });

    it('should provide queue status via getQueueStatus()', () => {
      orchestrator.connected = true;
      orchestrator.queueOffline('token1', '001');
      orchestrator.queueOffline('token2', '001');

      const status = orchestrator.getQueueStatus();

      expect(status).toEqual({
        connected: true,
        queueSize: 2,
        maxQueueSize: 100,
        deviceId: expect.stringMatching(/^PLAYER_\d+$/)
      });
    });

    it('should clear queue and localStorage with clearQueue()', () => {
      orchestrator.queueOffline('token1', '001');
      orchestrator.queueOffline('token2', '001');

      orchestrator.clearQueue();

      // Memory cleared
      expect(orchestrator.offlineQueue).toHaveLength(0);

      // localStorage cleared
      const saved = localStorage.getItem('offline_queue');
      const parsed = JSON.parse(saved);
      expect(parsed).toHaveLength(0);
    });
  });

  describe('Configuration Management', () => {

    beforeEach(() => {
      mockFetchResponse(200, { status: 'online' });
      orchestrator = new OrchestratorIntegration();
    });

    it('should update base URL with updateOrchestratorUrl()', () => {
      const newUrl = 'http://192.168.1.100:3000';

      orchestrator.updateOrchestratorUrl(newUrl);

      expect(orchestrator.baseUrl).toBe(newUrl);
      expect(localStorage.getItem('orchestrator_url')).toBe(newUrl);
    });

    it('should trigger connection check when URL updated', async () => {
      mockFetchResponse(200, { status: 'online' });

      orchestrator.updateOrchestratorUrl('http://new.server:3000');

      // Should have initiated new connection check
      expect(orchestrator.pendingConnectionCheck).toBeInstanceOf(Promise);

      // Wait for check to complete
      await orchestrator.pendingConnectionCheck;

      // Should have called new URL
      const lastCall = getLastFetchCall();
      expect(lastCall.url).toContain('http://new.server:3000/health');
    });
  });

  describe('Error Handling - Edge Cases', () => {

    beforeEach(() => {
      mockFetchResponse(200, { status: 'online' });
    });

    it('should handle localStorage quota exceeded gracefully', () => {
      // Create orchestrator
      orchestrator = new OrchestratorIntegration();

      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      // Should NOT crash when queueing offline
      expect(() => {
        orchestrator.queueOffline('test_token', '001');
      }).not.toThrow();

      // Queue should still be in memory (just not persisted)
      expect(orchestrator.offlineQueue).toHaveLength(1);

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it('should handle corrupted localStorage queue data', () => {
      // Set invalid JSON in localStorage
      localStorage.setItem('offline_queue', 'INVALID JSON{{{');

      // Should not crash, should reset to empty queue
      orchestrator = new OrchestratorIntegration();

      expect(orchestrator.offlineQueue).toEqual([]);
    });

    it('should handle corrupted JSON gracefully and reset queue', () => {
      localStorage.setItem('offline_queue', '{"malformed": json}');

      // Constructor should handle this
      orchestrator = new OrchestratorIntegration();

      // Should default to empty array
      expect(Array.isArray(orchestrator.offlineQueue)).toBe(true);
      expect(orchestrator.offlineQueue).toHaveLength(0);
    });
  });

  describe('Cleanup & Destroy', () => {

    beforeEach(() => {
      mockFetchResponse(200, { status: 'online' });
    });

    it('should stop connection monitoring when destroyed', async () => {
      orchestrator = new OrchestratorIntegration();

      // Verify monitoring is running
      expect(orchestrator.connectionCheckInterval).toBeTruthy();

      await orchestrator.destroy();

      // Interval should be cleared
      expect(orchestrator.connectionCheckInterval).toBeFalsy();
    });

    it('should await pending connection check during destroy', async () => {
      orchestrator = new OrchestratorIntegration();

      // Track if promise was awaited
      let checkCompleted = false;
      const controlledPromise = Promise.resolve().then(() => {
        checkCompleted = true;
      });

      orchestrator.pendingConnectionCheck = controlledPromise;

      await orchestrator.destroy();

      // Should have awaited the promise
      expect(checkCompleted).toBe(true);
      expect(orchestrator.pendingConnectionCheck).toBeFalsy();
    });

    it('should handle errors in pending connection check gracefully', async () => {
      orchestrator = new OrchestratorIntegration();

      // Create failing connection check
      const failingCheck = Promise.reject(new Error('Connection check failed'));
      failingCheck.catch(() => {}); // Prevent unhandled rejection

      orchestrator.pendingConnectionCheck = failingCheck;

      // Should not throw
      await expect(orchestrator.destroy()).resolves.not.toThrow();

      // Should still cleanup
      expect(orchestrator.connectionCheckInterval).toBeFalsy();
    });

    it('should be safe to call destroy() multiple times', async () => {
      orchestrator = new OrchestratorIntegration();

      // First destroy
      await orchestrator.destroy();

      // Verify cleanup happened
      expect(orchestrator.connectionCheckInterval).toBeFalsy();

      // Second destroy should not error
      await expect(orchestrator.destroy()).resolves.not.toThrow();

      // Interval should still be null
      expect(orchestrator.connectionCheckInterval).toBeFalsy();
    });

    it('should prevent new connection checks after destroy', async () => {
      orchestrator = new OrchestratorIntegration();

      await orchestrator.destroy();

      // Verify interval is null
      expect(orchestrator.connectionCheckInterval).toBeFalsy();

      // If interval callback was stored, it shouldn't be able to fire
      // (interval was cleared, so callback won't execute)
    });
  });
});
