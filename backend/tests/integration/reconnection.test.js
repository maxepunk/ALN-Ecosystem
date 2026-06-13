/**
 * Reconnection Integration Tests (Phase 2.1 P1.1)
 * Tests end-to-end reconnection with state restoration
 */

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { resetAllServices } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Reconnection State Restoration (Phase 2.1 P1.1)', () => {
  let testContext;
  let gm1;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await resetAllServices();
  });

  afterEach(async () => {
    if (gm1 && gm1.connected) gm1.disconnect();
  });

  describe('Device Scanned Tokens Restoration', () => {
    it('should restore scanned tokens after reconnection', async () => {
      // PHASE 2.1 P1.1: Main reconnection test

      // Step 1: Create session
      await sessionService.createSession({
        name: 'Reconnection Test',
        teams: ['Team Alpha']
      });
    await sessionService.startGame();

      // Step 2: Connect GM
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      // Step 3: Scan tokens via WebSocket (GM scanners use WebSocket, not HTTP)
      // Helper to submit transaction and wait for result
      const submitTransaction = (socket, data) => {
        return new Promise((resolve) => {
          socket.once('transaction:result', resolve);
          // Wrap data in envelope per AsyncAPI contract
          socket.emit('transaction:submit', {
            event: 'transaction:submit',
            data: data,
            timestamp: new Date().toISOString()
          });
        });
      };

      await submitTransaction(gm1, {
        tokenId: 'jaw001',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      });

      await submitTransaction(gm1, {
        tokenId: 'tac001',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      });

      // Step 4: Disconnect
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 5: Reconnect
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      // Step 6: Wait for sync:full with restored state
      const syncEvent = gm1.initialSync; // connect handshake snapshot (2.x.3)

      // Step 7: Verify deviceScannedTokens included
      expect(syncEvent.data).toHaveProperty('deviceScannedTokens');
      expect(Array.isArray(syncEvent.data.deviceScannedTokens)).toBe(true);
      expect(syncEvent.data.deviceScannedTokens).toContain('jaw001');
      expect(syncEvent.data.deviceScannedTokens).toContain('tac001');
      expect(syncEvent.data.deviceScannedTokens).toHaveLength(2);
    });

    it('should prevent duplicate scans after reconnection', async () => {
      // PHASE 2.1 P1.1: Reconnected device should not be able to scan same token

      // Helper to submit transaction
      const submitTransaction = (socket, data) => {
        return new Promise((resolve) => {
          socket.once('transaction:result', resolve);
          socket.emit('transaction:submit', {
            event: 'transaction:submit',
            data: data,
            timestamp: new Date().toISOString()
          });
        });
      };

      // Step 1: Create session
      await sessionService.createSession({
        name: 'Duplicate Prevention Test',
        teams: ['Team Alpha']
      });
    await sessionService.startGame();

      // Step 2: Connect and scan via WebSocket
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      const result1 = await submitTransaction(gm1, {
        tokenId: 'jaw001',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      });

      expect(result1.data.status).toBe('accepted');
      expect(result1.data.points).toBeGreaterThan(0);

      // Step 3: Disconnect and reconnect
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      // connect handshake (incl. initial sync:full) already awaited by connectAndIdentify

      // Step 4: Try to scan same token (should be rejected as duplicate)
      const result2 = await submitTransaction(gm1, {
        tokenId: 'jaw001',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      });

      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.points).toBe(0);
    });

    it('CD-1: should include deviceScannedTokens in sync:full triggered by sync:request', async () => {
      // Task CD-1: sync:request handler must include deviceScannedTokens (gmAuth parity)
      // The scanner reconciles offline queue against server-recorded scans only when
      // deviceScannedTokens is an array — so a sync:request-triggered flush must also
      // carry the field to preserve the reconcile-before-flush ordering.

      const submitTransaction = (socket, data) => {
        return new Promise((resolve) => {
          socket.once('transaction:result', resolve);
          socket.emit('transaction:submit', {
            event: 'transaction:submit',
            data: data,
            timestamp: new Date().toISOString()
          });
        });
      };

      // Step 1: Create and start session
      await sessionService.createSession({
        name: 'CD-1 sync:request deviceScannedTokens Test',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();

      // Step 2: Connect GM and scan a token
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      // Initial gmAuth sync:full is consumed by the connect handshake inside
      // connectAndIdentify, so waitForEvent below catches only the
      // sync:request-triggered one.

      await submitTransaction(gm1, {
        tokenId: 'jaw001',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      });

      // Step 3: Emit sync:request and capture the resulting sync:full.
      // waitForEvent is listener-from-now (2.x.3) — registered BEFORE the
      // emit, so it can only resolve with THIS request's sync:full (the
      // connect-time handshake snapshot lives on socket.initialSync).
      const syncPromise = waitForEvent(gm1, 'sync:full', 5000);
      gm1.emit('sync:request');
      const syncEvent = await syncPromise;

      // Step 4: deviceScannedTokens must be present and contain the scanned token
      expect(syncEvent.data).toHaveProperty('deviceScannedTokens');
      expect(Array.isArray(syncEvent.data.deviceScannedTokens)).toBe(true);
      expect(syncEvent.data.deviceScannedTokens).toContain('jaw001');
    });

    it('should only restore tokens for the specific device', async () => {
      // PHASE 2.1 P1.1: GM_001 should not see GM_002's tokens

      const submitTransaction = (socket, data) => {
        return new Promise((resolve) => {
          socket.once('transaction:result', resolve);
          socket.emit('transaction:submit', {
            event: 'transaction:submit',
            data: data,
            timestamp: new Date().toISOString()
          });
        });
      };

      // Step 1: Create session
      await sessionService.createSession({
        name: 'Multi-Device Test',
        teams: ['Team Alpha']
      });
    await sessionService.startGame();

      // Step 2: GM_001 scans jaw011
      let gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      await submitTransaction(gm1, {
        tokenId: 'jaw001',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      });

      // Step 3: GM_002 scans kaa001
      const gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_002');

      await submitTransaction(gm2, {
        tokenId: 'tac001',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      });

      // Step 4: GM_001 reconnects
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      const syncEvent = gm1.initialSync; // connect handshake snapshot (2.x.3)

      // Step 5: GM_001 should only see jaw011 (not kaa001)
      expect(syncEvent.data.deviceScannedTokens).toContain('jaw001');
      expect(syncEvent.data.deviceScannedTokens).not.toContain('tac001');
      expect(syncEvent.data.deviceScannedTokens).toHaveLength(1);

      gm2.disconnect();
    });
  });

  describe('Reconnection Flag', () => {
    it('should set reconnection flag appropriately', async () => {
      // PHASE 2.1 P1.1: First connection vs reconnection

      await sessionService.createSession({
        name: 'Reconnection Flag Test',
        teams: ['Team Alpha']
      });
    await sessionService.startGame();

      // First connection
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      const firstSync = gm1.initialSync; // connect handshake snapshot (2.x.3)

      // Reconnection flag should be false or undefined for first connection
      expect(firstSync.data.reconnection === false || firstSync.data.reconnection === undefined).toBe(true);

      // Disconnect and reconnect
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      const reconnectSync = gm1.initialSync; // connect handshake snapshot (2.x.3)

      // Should include reconnection indicator
      expect(reconnectSync.data).toHaveProperty('reconnection');
    });
  });

  describe('Empty State Restoration', () => {
    it('should include empty deviceScannedTokens when device has not scanned', async () => {
      // PHASE 2.1 P1.1: Fresh device reconnecting

      await sessionService.createSession({
        name: 'Empty State Test',
        teams: ['Team Alpha']
      });
    await sessionService.startGame();

      // Connect without scanning
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      // Disconnect and reconnect
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      const syncEvent = gm1.initialSync; // connect handshake snapshot (2.x.3)

      // Should have empty array
      expect(syncEvent.data.deviceScannedTokens).toEqual([]);
    });
  });

  describe('Multiple Reconnections', () => {
    it('should maintain state across multiple reconnections', async () => {
      // PHASE 2.1 P1.1: State persistence across multiple disconnects

      const submitTransaction = (socket, data) => {
        return new Promise((resolve) => {
          socket.once('transaction:result', resolve);
          socket.emit('transaction:submit', {
            event: 'transaction:submit',
            data: data,
            timestamp: new Date().toISOString()
          });
        });
      };

      await sessionService.createSession({
        name: 'Multiple Reconnection Test',
        teams: ['Team Alpha']
      });
    await sessionService.startGame();

      // Initial connection and scan
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      await submitTransaction(gm1, {
        tokenId: 'jaw001',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      });

      // First reconnection
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      let syncEvent = gm1.initialSync; // connect handshake snapshot (2.x.3)
      expect(syncEvent.data.deviceScannedTokens).toContain('jaw001');

      // Second reconnection
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      syncEvent = gm1.initialSync; // connect handshake snapshot (2.x.3)
      expect(syncEvent.data.deviceScannedTokens).toContain('jaw001');

      // Third reconnection
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      syncEvent = gm1.initialSync; // connect handshake snapshot (2.x.3)
      expect(syncEvent.data.deviceScannedTokens).toContain('jaw001');

      // State should persist
      expect(syncEvent.data.deviceScannedTokens).toHaveLength(1);
    });
  });
});
