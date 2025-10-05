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

      // Verify scanner connected
      expect(scanner.socket).toBeDefined();
      expect(scanner.socket.connected).toBe(true);
      expect(scanner.isConnected).toBe(true);
      expect(scanner.token).toBeDefined();
    });

    it('should receive and process sync:full after connection', async () => {
      scanner = await createAuthenticatedScanner(testContext.url, 'GM_SYNC_TEST');

      // Verify scanner received and processed sync:full by checking populated state
      // Per AsyncAPI contract: server auto-sends sync:full on connection
      // Per orchestratorClient.js:274: scanner stores connectedDevices from sync:full
      expect(scanner.connectedDevices).toBeDefined();
      expect(Array.isArray(scanner.connectedDevices)).toBe(true);

      // Scanner should have session ID from sync:full (if session exists)
      expect(scanner.sessionId).toBeDefined();
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
  });

  describe('Player Scanner (OrchestratorIntegration)', () => {
    let playerScanner;

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
