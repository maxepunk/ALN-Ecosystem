/**
 * Scanner Helper Verification Tests
 *
 * PURPOSE: Verify real scanner modules can connect and communicate with test server
 * BEFORE transforming all integration tests to use them.
 *
 * This test file starts with underscore to run first alphabetically.
 * If these tests fail, we've discovered bugs in:
 * - Scanner module compatibility with Node.js
 * - Scanner auth/connection flow
 * - Server's ability to handle real scanner clients
 */

// CRITICAL: Load browser mocks FIRST before any scanner code
require('../helpers/browser-mocks');

const { createAuthenticatedScanner, createPlayerScanner, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const sessionService = require('../../src/services/sessionService');

describe('Scanner Helper Verification', () => {
  let testContext;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await sessionService.createSession({
      name: 'Helper Test Session',
      teams: ['001', '002']
    });
  });

  describe('GM Scanner (OrchestratorClient)', () => {
    let scanner;

    afterEach(() => {
      if (scanner?.socket?.connected) {
        scanner.socket.disconnect();
      }
    });

    it('should create GM Scanner instance', () => {
      // Just loading the module would have thrown if browser-mocks insufficient
      expect(createAuthenticatedScanner).toBeDefined();
      expect(typeof createAuthenticatedScanner).toBe('function');
    });

    it('should connect and authenticate GM Scanner via HTTP + WebSocket', async () => {
      // This tests the REAL auth flow the deployed GM Scanner uses
      scanner = await createAuthenticatedScanner(testContext.url, 'GM_HELPER_TEST');

      // Verify scanner connected (now returns wrapper object)
      expect(scanner.socket).toBeDefined();
      expect(scanner.socket.connected).toBe(true);
      expect(scanner.client.isConnected).toBe(true);
      expect(scanner.client.token).toBeDefined();
    });

    it('should receive and process sync:full after connection', async () => {
      scanner = await createAuthenticatedScanner(testContext.url, 'GM_SYNC_TEST');

      // Verify scanner received and processed sync:full by checking populated state
      // Per AsyncAPI contract: server auto-sends sync:full on connection
      // Per orchestratorClient.js:274: scanner stores connectedDevices from sync:full
      expect(scanner.client.connectedDevices).toBeDefined();
      expect(Array.isArray(scanner.client.connectedDevices)).toBe(true);

      // Scanner should have session ID from sync:full (if session exists)
      expect(scanner.client.sessionId).toBeDefined();
    });

    it('should send and receive transaction events', async () => {
      scanner = await createAuthenticatedScanner(testContext.url, 'GM_TX_TEST');

      // Listen for EITHER transaction:result OR error
      const resultPromise = waitForEvent(scanner.socket, ['transaction:result', 'error']);

      // Submit transaction using REAL scanner socket
      scanner.socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '001',
          deviceId: 'GM_TX_TEST',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result = await resultPromise;

      // Debug: Show error details if we got error instead of result
      if (result.event === 'error') {
        throw new Error(`Transaction failed with error: ${JSON.stringify(result.data, null, 2)}`);
      }

      expect(result.event).toBe('transaction:result');
      expect(result.data.status).toBe('accepted');
      expect(result.data.tokenId).toBe('534e2b03');
    });

    it('should fully initialize GM Scanner with all required components', async () => {
      scanner = await createAuthenticatedScanner(testContext.url, 'GM_FULL_TEST', 'blackmarket');

      // 1. Verify returned object structure
      expect(scanner.client).toBeDefined();
      expect(scanner.socket).toBeDefined();
      expect(scanner.App).toBeDefined();
      expect(scanner.Settings).toBeDefined();
      expect(scanner.sessionModeManager).toBeDefined();
      expect(scanner.queueManager).toBeDefined();

      // 2. Verify Settings configured correctly
      expect(scanner.Settings.deviceId).toBe('GM_FULL_TEST');
      expect(scanner.Settings.stationMode).toBe('blackmarket');

      // 3. Verify SessionModeManager configured
      expect(scanner.sessionModeManager.mode).toBe('networked');
      expect(scanner.sessionModeManager.locked).toBe(true);

      // 4. Verify global window objects exist (scanner code expects these)
      expect(global.window.sessionModeManager).toBeDefined();
      expect(global.window.queueManager).toBeDefined();
      expect(global.window.connectionManager).toBeDefined();

      // 5. CRITICAL: Verify App.recordTransaction can be called without crashing
      // This proves all dependencies are initialized correctly
      // Verify recordTransaction correctly adds to DataManager and queues for submission
      const TestTokens = require('../fixtures/test-tokens');
      const token = TestTokens.STANDALONE_TOKENS[0]; // 534e2b02

      scanner.App.currentTeamId = '001';
      scanner.Settings.stationMode = 'blackmarket';

      // Spy on queueManager to verify transaction queued for orchestrator
      const queueSpy = jest.spyOn(scanner.queueManager, 'queueTransaction');
      const dataManagerSpy = jest.spyOn(scanner.DataManager, 'addTransaction');

      // Execute
      scanner.App.recordTransaction(token, token.id, false);

      // VERIFY: In networked mode, transaction is queued (NOT added to DataManager immediately)
      // DataManager.addTransaction is only called after orchestrator confirms via event
      expect(queueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenId: token.id,
          teamId: '001',
          mode: 'blackmarket'
        })
      );

      // VERIFY: DataManager.addTransaction NOT called immediately in networked mode
      // (It will be called later when orchestrator sends transaction:new event)
      expect(dataManagerSpy).not.toHaveBeenCalled();
    });
  });

  describe('Player Scanner (OrchestratorIntegration)', () => {
    let playerScanner;

    afterEach(async () => {
      if (playerScanner) {
        await playerScanner.destroy();  // Stop connection monitor + wait for pending check
        playerScanner = null;
      }
    });

    it('should create Player Scanner instance', () => {
      playerScanner = createPlayerScanner(testContext.url, 'PLAYER_HELPER_TEST');

      expect(playerScanner).toBeDefined();
      expect(playerScanner.baseUrl).toBe(testContext.url);
      expect(playerScanner.deviceId).toBe('PLAYER_HELPER_TEST');
    });

    it('should POST /api/scan via real Player Scanner code', async () => {
      playerScanner = createPlayerScanner(testContext.url, 'PLAYER_SCAN_TEST');

      // Manually set connected flag (Player Scanner checks connection)
      playerScanner.connected = true;

      // Use REAL Player Scanner scanToken method
      const result = await playerScanner.scanToken('534e2b03', '001');

      expect(result).toBeDefined();
      // Result shape depends on server response
      // Just verify it didn't throw and returned something
    });

    it('should queue scans when offline', async () => {
      playerScanner = createPlayerScanner(testContext.url, 'PLAYER_OFFLINE_TEST');

      // Mark as offline
      playerScanner.connected = false;

      // Scan should queue instead of sending
      const result = await playerScanner.scanToken('hos001', '002');

      expect(result.status).toBe('offline');
      expect(result.queued).toBe(true);
      expect(playerScanner.offlineQueue.length).toBeGreaterThan(0);
    });
  });
});
