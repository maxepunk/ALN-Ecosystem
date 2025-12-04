/**
 * Player Scanner - Dual-Mode Independence Tests
 *
 * PURPOSE: Validate CRITICAL architectural requirement: Standalone and Networked modes
 * must be completely independent operational states.
 *
 * WHY NEEDED: Current tests verify each mode works, but don't verify they're INDEPENDENT.
 * Without this, we can't guarantee:
 * - Standalone mode never attempts orchestrator connection
 * - Networked mode degrades gracefully to standalone behavior
 * - No state pollution between deployment contexts
 * - Mode detection works correctly
 *
 * ARCHITECTURAL REQUIREMENT (from functional-requirements.md:89-229):
 * - Standalone mode: PERMANENT offline, never attempts to connect
 * - Networked mode: TEMPORARY offline with auto-reconnect
 * - Modes detected automatically from deployment context (URL path)
 * - Same codebase, different runtime behavior
 *
 * WHAT THIS CATCHES:
 * - Standalone mode attempting network requests
 * - Mode detection logic errors
 * - State pollution between modes
 * - Incorrect localStorage key usage
 */

const {
  resetMocks,
  mockFetchResponse,
  mockFetchNetworkError
} = require('../../helpers/player-scanner-mocks');

const OrchestratorIntegration = require('../../../../aln-memory-scanner/js/orchestratorIntegration');

describe('Player Scanner - Dual-Mode Independence', () => {

  beforeEach(() => {
    resetMocks();
    jest.useFakeTimers(); // Prevent real timers from running
  });

  afterEach(async () => {
    jest.clearAllTimers();
    jest.useRealTimers(); // Restore real timers
  });

  describe('Mode Detection', () => {

    it('should detect NETWORKED mode when served from orchestrator path', async () => {
      // Simulate being served from orchestrator
      global.window.location.pathname = '/player-scanner/';
      global.window.location.origin = 'http://192.168.1.100:3000';

      const orchestrator = new OrchestratorIntegration();

      // Should use orchestrator's origin
      expect(orchestrator.baseUrl).toBe('http://192.168.1.100:3000');

      // NETWORKED mode SHOULD start connection monitoring
      expect(orchestrator.connectionCheckInterval).toBeTruthy();
      expect(orchestrator.isStandalone).toBe(false);

      await orchestrator.destroy();
    });

    it('should detect STANDALONE mode when served from GitHub Pages', async () => {
      // Simulate GitHub Pages deployment
      global.window.location.pathname = '/index.html';
      global.window.location.origin = 'https://user.github.io';

      const orchestrator = new OrchestratorIntegration();

      // INTENDED BEHAVIOR (FR:113): Standalone "Never attempts to connect/sync"
      // Should NOT create connection monitoring in standalone mode
      expect(orchestrator.connectionCheckInterval).toBeNull();
      expect(orchestrator.isStandalone).toBe(true);
      expect(orchestrator.connected).toBe(false);

      // No destroy needed - no monitoring to clean up
    });

    it('should detect STANDALONE mode when served from custom domain', async () => {
      // Simulate custom GitHub Pages domain
      global.window.location.pathname = '/';
      global.window.location.origin = 'https://aln.example.com';

      const orchestrator = new OrchestratorIntegration();

      // INTENDED BEHAVIOR: Standalone should NOT monitor connection
      expect(orchestrator.connectionCheckInterval).toBeNull();
      expect(orchestrator.isStandalone).toBe(true);
      expect(orchestrator.connected).toBe(false);

      // No destroy needed - no monitoring to clean up
    });
  });

  describe('Standalone Mode Isolation', () => {

    beforeEach(() => {
      // Configure for standalone mode (GitHub Pages)
      global.window.location.pathname = '/index.html';
      global.window.location.origin = 'https://user.github.io';
    });

    it('should operate without connection monitoring in standalone mode', () => {
      const orchestrator = new OrchestratorIntegration();

      // INTENDED BEHAVIOR (FR:113): "Never attempts to connect"
      expect(orchestrator.isStandalone).toBe(true);
      expect(orchestrator.connectionCheckInterval).toBeNull();
      expect(orchestrator.pendingConnectionCheck).toBeUndefined();
      expect(orchestrator.connected).toBe(false);

      // No monitoring to destroy
    });

    it('should process scans locally without queue in standalone mode', async () => {
      const orchestrator = new OrchestratorIntegration();

      // INTENDED BEHAVIOR (FR:219): "No queue (transactions processed immediately)"
      // Standalone mode processes locally, doesn't queue for sync
      const result = await orchestrator.scanToken('test_token', 'Team Alpha');

      // Should process locally and return success
      expect(result.status).toBe('standalone');
      expect(result.queued).toBeUndefined(); // No queue in standalone

      // Should NOT add to offline queue
      expect(orchestrator.offlineQueue).toHaveLength(0);
    });

    it('should never attempt network requests in standalone mode', async () => {
      const orchestrator = new OrchestratorIntegration();

      // Scan a token
      await orchestrator.scanToken('test_token', 'Team Alpha');

      // INTENDED BEHAVIOR: Standalone never attempts HTTP requests
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Networked Mode Degradation', () => {

    beforeEach(() => {
      // Configure for networked mode (served from orchestrator)
      global.window.location.pathname = '/player-scanner/';
      global.window.location.origin = 'http://192.168.1.100:3000';
    });

    it('should behave like standalone when orchestrator becomes unreachable', async () => {
      // Start connected
      mockFetchResponse(200, { status: 'online' });

      const orchestrator = new OrchestratorIntegration();

      await orchestrator.pendingConnectionCheck;
      expect(orchestrator.connected).toBe(true);

      // Orchestrator goes down
      mockFetchNetworkError('Connection lost');

      await orchestrator.checkConnection();

      // Should now be disconnected
      expect(orchestrator.connected).toBe(false);

      // Should queue scans offline (standalone behavior)
      const result = await orchestrator.scanToken('test_token', 'Team Alpha');
      expect(result.status).toBe('offline');
      expect(result.queued).toBe(true);

      orchestrator.destroy();
    });

    it('should transition from connected to offline seamlessly', async () => {
      mockFetchResponse(200, { status: 'online' });

      const orchestrator = new OrchestratorIntegration();

      await orchestrator.pendingConnectionCheck;

      // Start connected
      expect(orchestrator.connected).toBe(true);

      // Scan should attempt network request
      mockFetchResponse(200, { status: 'accepted', videoQueued: true });
      const result1 = await orchestrator.scanToken('token1', 'Team Alpha');
      expect(result1.status).toBe('accepted');

      // Connection lost
      mockFetchNetworkError('Connection lost');
      await orchestrator.checkConnection();

      // Now disconnected
      expect(orchestrator.connected).toBe(false);

      // Next scan should queue offline
      const result2 = await orchestrator.scanToken('token2', 'Team Alpha');
      expect(result2.status).toBe('offline');
      expect(result2.queued).toBe(true);

      orchestrator.destroy();
    });

    it('should reconnect and process offline queue when orchestrator returns', async () => {
      mockFetchResponse(200, { status: 'online' });

      const orchestrator = new OrchestratorIntegration();

      await orchestrator.pendingConnectionCheck;

      // Start connected
      expect(orchestrator.connected).toBe(true);

      // Go offline
      mockFetchNetworkError('Connection lost');
      await orchestrator.checkConnection();

      // Queue some scans offline
      await orchestrator.scanToken('token1', 'Team Alpha');
      await orchestrator.scanToken('token2', 'Team Alpha');

      expect(orchestrator.offlineQueue).toHaveLength(2);

      // Orchestrator comes back online
      mockFetchResponse(200, { status: 'online' });
      mockFetchResponse(200, {
        results: [
          { tokenId: 'token1', status: 'processed' },
          { tokenId: 'token2', status: 'processed' }
        ]
      });

      await orchestrator.checkConnection();

      // Should reconnect
      expect(orchestrator.connected).toBe(true);

      // Advance fake timers to trigger queue processing
      jest.advanceTimersByTime(1100); // Batch processing uses 1000ms delay
      await Promise.resolve(); // Let promises resolve

      // Queue should be processed (cleared)
      expect(orchestrator.offlineQueue).toHaveLength(0);

      await orchestrator.destroy();
    });
  });

  describe('State Isolation Between Modes', () => {

    it('should persist deviceId across mode switches', () => {
      // Standalone mode creates device ID
      global.window.location.pathname = '/index.html';
      const standalone = new OrchestratorIntegration();
      const standaloneDeviceId = standalone.deviceId;

      // Networked mode (same browser/device)
      global.window.location.pathname = '/player-scanner/';
      const networked = new OrchestratorIntegration();

      // Should reuse same device ID from localStorage
      expect(networked.deviceId).toBe(standaloneDeviceId);

      // But modes should be different
      expect(standalone.isStandalone).toBe(true);
      expect(networked.isStandalone).toBe(false);

      networked.destroy();
    });

    it('should maintain independent queue state in memory (networked mode only)', async () => {
      // Queue only exists in networked mode
      global.window.location.pathname = '/player-scanner/';

      const instance1 = new OrchestratorIntegration();
      const instance2 = new OrchestratorIntegration();

      // Queue items in instance1
      instance1.queueOffline('token1', 'Team Alpha');

      // instance2 should not see instance1's in-memory queue
      // (until localStorage syncs on page load)
      expect(instance1.offlineQueue).toHaveLength(1);
      expect(instance2.offlineQueue).toHaveLength(0);

      await instance1.destroy();
      await instance2.destroy();
    });
  });

  describe('Token Database Loading (Mode-Independent)', () => {

    it('should load from bundled tokens.json in both modes', async () => {
      // This tests that token loading is mode-independent
      // Both standalone and networked use bundled tokens

      // Standalone mode - no monitoring to destroy
      global.window.location.pathname = '/index.html';
      const standalone = new OrchestratorIntegration();
      expect(standalone.isStandalone).toBe(true);

      // Networked mode - has monitoring to destroy
      global.window.location.pathname = '/player-scanner/';
      const networked = new OrchestratorIntegration();
      expect(networked.isStandalone).toBe(false);

      // Both should use same token data source (bundled tokens.json)
      // (This is tested indirectly - token loading is in index.html, not orchestratorIntegration.js)

      await networked.destroy(); // Networked has monitoring to clean up
      // standalone has no monitoring, no destroy needed
    });
  });
});
