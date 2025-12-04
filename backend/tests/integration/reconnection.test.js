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
      const syncEvent = await waitForEvent(gm1, 'sync:full', 3000);

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
      await waitForEvent(gm1, 'sync:full', 3000);

      // Step 4: Try to scan same token (should be rejected as duplicate)
      const result2 = await submitTransaction(gm1, {
        tokenId: 'jaw001',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      });

      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.points).toBe(0);
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
      const syncEvent = await waitForEvent(gm1, 'sync:full', 3000);

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

      // First connection
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      const firstSync = await waitForEvent(gm1, 'sync:full', 3000);

      // Reconnection flag should be false or undefined for first connection
      expect(firstSync.data.reconnection === false || firstSync.data.reconnection === undefined).toBe(true);

      // Disconnect and reconnect
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      const reconnectSync = await waitForEvent(gm1, 'sync:full', 3000);

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

      // Connect without scanning
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');

      // Disconnect and reconnect
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));

      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      const syncEvent = await waitForEvent(gm1, 'sync:full', 3000);

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
      let syncEvent = await waitForEvent(gm1, 'sync:full', 3000);
      expect(syncEvent.data.deviceScannedTokens).toContain('jaw001');

      // Second reconnection
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      syncEvent = await waitForEvent(gm1, 'sync:full', 3000);
      expect(syncEvent.data.deviceScannedTokens).toContain('jaw001');

      // Third reconnection
      gm1.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
      gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_001');
      syncEvent = await waitForEvent(gm1, 'sync:full', 3000);
      expect(syncEvent.data.deviceScannedTokens).toContain('jaw001');

      // State should persist
      expect(syncEvent.data.deviceScannedTokens).toHaveLength(1);
    });
  });
});
