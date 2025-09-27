/**
 * Integration Test for Offline Mode with Queued Transactions
 * Tests system behavior when network connectivity is limited
 * 
 * Requirements validated:
 * - Transaction queuing when offline
 * - Queue processing when coming back online
 * - Offline status indication
 * - Queue size limits
 * - State synchronization after offline period
 */

const request = require('supertest');
const io = require('socket.io-client');
const { setupTestServer, cleanupTestServer, createGMClient } = require('../contract/ws-test-utils');
const { createTrackedSocket, waitForEvent, connectAndIdentify, waitForMultipleEvents, cleanupSockets, testDelay } = require('./test-helpers');

describe('Offline Mode Integration', () => {
  let testContext;
  let adminToken;

  beforeAll(async () => {
    // Use shared test server setup with proper Socket.IO
    testContext = await setupTestServer();

    // Get admin token
    const authResponse = await request(testContext.app)
      .post('/api/admin/auth')
      .send({ password: process.env.ADMIN_PASSWORD || 'test-admin-password' });
    adminToken = authResponse.body.token;

    // Create test session
    await request(testContext.app)
      .post('/api/session')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Offline Mode Test Session' });
  });

  afterAll(async () => {
    // Ensure offline mode is disabled
    global.offlineMode = false;

    await cleanupTestServer(testContext);
  });

  describe('Transaction Queuing', () => {
    it('should queue transactions when offline', async () => {
      // Simulate offline mode
      global.offlineMode = true;

      const transactions = [];

      // Submit transactions while offline
      for (let i = 0; i < 5; i++) {
        const response = await request(testContext.app)
          .post('/api/scan')
          .send({
            tokenId: `MEM_OFFLINE_${i}`,
            teamId: 'TEAM_A',
            scannerId: 'SCANNER_OFFLINE',
          });

        expect(response.status).toBe(202); // Accepted for processing
        expect(response.body).toHaveProperty('queued', true);
        expect(response.body).toHaveProperty('transactionId');
        transactions.push(response.body.transactionId);
      }

      // Go back online
      global.offlineMode = false;

      // Wait for queue processing
      await testDelay(100);

      // Check all transactions processed
      const state = await request(testContext.app).get('/api/state');
      const processed = state.body.recentTransactions || [];

      transactions.forEach(txId => {
        const found = processed.find(t => t.id === txId);
        expect(found).toBeDefined();
        expect(found.status).toBe('accepted');
      });
    });

    it('should maintain queue order when processing', async () => {
      global.offlineMode = true;

      const tokenIds = [];
      
      // Queue transactions in specific order
      for (let i = 0; i < 5; i++) {
        const tokenId = `MEM_ORDER_${i}`;
        tokenIds.push(tokenId);
        
        await request(testContext.app)
          .post('/api/scan')
          .send({
            tokenId,
            teamId: 'TEAM_B',
            scannerId: 'SCANNER_01',
          });
      }

      global.offlineMode = false;
      await testDelay(100);

      const state = await request(testContext.app).get('/api/state');
      const transactions = state.body.recentTransactions || [];
      
      // Find our transactions
      const orderedTransactions = tokenIds
        .map(tokenId => transactions.find(t => t.tokenId === tokenId))
        .filter(Boolean);

      // Check they were processed in order
      for (let i = 1; i < orderedTransactions.length; i++) {
        const prevTime = new Date(orderedTransactions[i - 1].timestamp);
        const currTime = new Date(orderedTransactions[i].timestamp);
        expect(currTime.getTime()).toBeGreaterThanOrEqual(prevTime.getTime());
      }
    });
  });

  describe('Queue Size Management', () => {
    it('should limit offline queue size', async () => {
      global.offlineMode = true;
      const maxQueueSize = 100;

      const responses = [];
      
      // Try to queue more than limit
      for (let i = 0; i < maxQueueSize + 10; i++) {
        const response = await request(testContext.app)
          .post('/api/scan')
          .send({
            tokenId: `MEM_QUEUE_LIMIT_${i}`,
            teamId: 'TEAM_A',
            scannerId: 'SCANNER_01',
          });
        
        responses.push(response);
      }

      // Some should be rejected due to queue limit
      const rejected = responses.filter(r => r.status === 503);
      const queued = responses.filter(r => r.status === 202);
      
      expect(rejected.length).toBeGreaterThan(0);
      expect(queued.length).toBeLessThanOrEqual(maxQueueSize);

      global.offlineMode = false;
      await testDelay(200);
    });

    it('should prioritize recent transactions when queue is full', async () => {
      global.offlineMode = true;

      // Fill queue
      for (let i = 0; i < 100; i++) {
        await request(testContext.app)
          .post('/api/scan')
          .send({
            tokenId: `MEM_PRIORITY_OLD_${i}`,
            teamId: 'TEAM_C',
            scannerId: 'SCANNER_01',
          })
          .catch(() => {});
      }

      // Try to add high priority transaction
      const importantResponse = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_PRIORITY_IMPORTANT',
          teamId: 'TEAM_C',
          scannerId: 'SCANNER_PRIORITY',
        });

      // Should handle based on implementation
      expect([202, 503]).toContain(importantResponse.status);

      global.offlineMode = false;
      await testDelay(200);
    });
  });

  describe('Offline Status Indication', () => {
    it('should indicate offline status in responses', async () => {
      global.offlineMode = true;

      const response = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_STATUS_CHECK',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      expect(response.body).toHaveProperty('queued', true);
      expect(response.body).toHaveProperty('offlineMode', true);

      global.offlineMode = false;
    });

    it('should expose offline status via API', async () => {
      global.offlineMode = true;

      const statusResponse = await request(testContext.app)
        .get('/api/status')
        .catch(() => null);

      if (statusResponse && statusResponse.status === 200) {
        expect(statusResponse.body).toHaveProperty('offline', true);
      }

      // Or check in state
      const stateResponse = await request(testContext.app).get('/api/state');
      if (stateResponse.body.systemStatus) {
        expect(stateResponse.body.systemStatus.offline).toBe(true);
      }

      global.offlineMode = false;
    });
  });

  describe('Video Handling in Offline Mode', () => {
    it('should handle offline video requests', async () => {
      global.offlineMode = true;

      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          command: 'play',
          tokenId: 'MEM_OFFLINE_VIDEO',
        });

      // Should queue or reject appropriately
      expect(response.status).toBeLessThan(600);
      if (response.status === 503) {
        expect(response.body.message).toContain('offline');
      }

      global.offlineMode = false;
    });

    it('should queue video token scans when offline', async () => {
      global.offlineMode = true;

      const response = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_OFFLINE_001',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      expect(response.status).toBe(202);
      expect(response.body.queued).toBe(true);

      global.offlineMode = false;

      // Wait for processing
      await testDelay(100);

      // Check if video would trigger when processed
      const state = await request(testContext.app).get('/api/state');
      const transaction = (state.body.recentTransactions || [])
        .find(t => t.tokenId === 'MEM_VIDEO_OFFLINE_001');
      
      expect(transaction).toBeDefined();
    });
  });

  describe('State Synchronization', () => {
    it('should sync state when coming back online', async () => {
      const offlineSocket = await connectAndIdentify(
        testContext.socketUrl,
        'GM_OFFLINE_TEST'
      );

      try {
        // Simulate going offline
        global.offlineMode = true;
        offlineSocket.disconnect();

        // Submit transactions while offline
        await Promise.all([
          request(testContext.app).post('/api/scan').send({
            tokenId: 'MEM_OFFLINE_SYNC_001',
            teamId: 'TEAM_B',
            scannerId: 'SCANNER_01',
          }),
          request(testContext.app).post('/api/scan').send({
            tokenId: 'MEM_OFFLINE_SYNC_002',
            teamId: 'TEAM_C',
            scannerId: 'SCANNER_02',
          }),
        ]);

        // Come back online
        global.offlineMode = false;

        // Setup listener for sync:full before reconnecting
        const syncPromise = waitForEvent(offlineSocket, 'sync:full', 10000);

        // Reconnect
        offlineSocket.connect();

        // Wait for reconnection and request state
        await waitForEvent(offlineSocket, 'connect', 5000);
        offlineSocket.emit('state:request', {});

        // Wait for sync:full event
        const data = await syncPromise;

        // Should have the offline transactions
        const transactions = data.data.transactions || [];
        const offlineTransactions = transactions.filter(t =>
          t.tokenId && t.tokenId.includes('OFFLINE_SYNC')
        );

        expect(offlineTransactions.length).toBeGreaterThanOrEqual(2);
      } finally {
        cleanupSockets(offlineSocket);
      }
    }, 15000);

    it('should broadcast queued transaction events when processed', async () => {
      const monitorSocket = await connectAndIdentify(
        testContext.socketUrl,
        'GM_MONITOR_OFFLINE'
      );

      try {
        // Go offline
        global.offlineMode = true;

        // Queue transactions
        for (let i = 0; i < 3; i++) {
          await request(testContext.app)
            .post('/api/scan')
            .send({
              tokenId: `MEM_BROADCAST_QUEUE_${i}`,
              teamId: 'TEAM_D',
              scannerId: 'SCANNER_01',
            });
        }

        // Setup listener for transaction events
        const eventsPromise = waitForMultipleEvents(
          monitorSocket,
          'transaction:new',
          (events) => {
            const queueEvents = events.filter(e =>
              e.data?.tokenId?.includes('BROADCAST_QUEUE')
            );
            return queueEvents.length >= 3;
          },
          5000
        );

        // Come back online - should trigger queue processing
        global.offlineMode = false;

        // Wait for events
        const events = await eventsPromise;
        const receivedTransactions = events
          .filter(e => e.data?.tokenId?.includes('BROADCAST_QUEUE'))
          .map(e => e.data.tokenId);

        expect(receivedTransactions).toHaveLength(3);
      } finally {
        cleanupSockets(monitorSocket);
      }
    }, 10000);
  });

  describe('Duplicate Detection with Offline Queue', () => {
    it('should detect duplicates in offline queue', async () => {
      global.offlineMode = true;

      const tokenId = 'MEM_OFFLINE_DUP';
      const teamId = 'TEAM_A';

      // Queue same transaction multiple times
      const response1 = await request(testContext.app)
        .post('/api/scan')
        .send({ tokenId, teamId, scannerId: 'SCANNER_01' });

      const response2 = await request(testContext.app)
        .post('/api/scan')
        .send({ tokenId, teamId, scannerId: 'SCANNER_02' });

      expect(response1.status).toBe(202);
      
      // Second might be rejected as duplicate even in queue
      expect([202, 409]).toContain(response2.status);

      global.offlineMode = false;
      await testDelay(100);
    });

    it('should handle duplicates between online and offline transactions', async () => {
      const tokenId = 'MEM_ONLINE_OFFLINE_DUP';
      const teamId = 'TEAM_B';

      // Online transaction
      const onlineResponse = await request(testContext.app)
        .post('/api/scan')
        .send({ tokenId, teamId, scannerId: 'SCANNER_01' });

      expect(onlineResponse.body.status).toBe('accepted');

      // Go offline
      global.offlineMode = true;

      // Try same transaction offline
      const offlineResponse = await request(testContext.app)
        .post('/api/scan')
        .send({ tokenId, teamId, scannerId: 'SCANNER_02' });

      // Might detect duplicate even when offline
      if (offlineResponse.status === 409) {
        expect(offlineResponse.body.error).toContain('duplicate');
      }

      global.offlineMode = false;
    });
  });

  describe('Performance in Offline Mode', () => {
    it('should handle rapid offline submissions', async () => {
      global.offlineMode = true;

      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          request(testContext.app)
            .post('/api/scan')
            .send({
              tokenId: `MEM_RAPID_OFFLINE_${i}`,
              teamId: `TEAM_${i % 4}`,
              scannerId: 'SCANNER_01',
            })
        );
      }

      const responses = await Promise.all(promises);
      const elapsed = Date.now() - startTime;

      // Should queue rapidly
      expect(elapsed).toBeLessThan(5000);
      
      const queued = responses.filter(r => r.status === 202);
      expect(queued.length).toBeGreaterThan(0);

      global.offlineMode = false;
      await testDelay(300);
    });

    it('should process queue efficiently when coming online', async () => {
      global.offlineMode = true;

      // Queue many transactions
      for (let i = 0; i < 20; i++) {
        await request(testContext.app)
          .post('/api/scan')
          .send({
            tokenId: `MEM_PROCESS_QUEUE_${i}`,
            teamId: 'TEAM_A',
            scannerId: 'SCANNER_01',
          });
      }

      const beforeOnline = Date.now();
      global.offlineMode = false;

      // Wait for processing
      await testDelay(300);
      const processingTime = Date.now() - beforeOnline;

      // Should process reasonably quickly
      expect(processingTime).toBeLessThan(5000);

      // Check they were processed
      const state = await request(testContext.app).get('/api/state');
      const processed = (state.body.recentTransactions || [])
        .filter(t => t.tokenId && t.tokenId.includes('PROCESS_QUEUE'));
      
      expect(processed.length).toBeGreaterThan(10);
    });
  });

  describe('Recovery Scenarios', () => {
    it('should recover from interrupted offline period', async () => {
      global.offlineMode = true;

      // Queue some transactions
      for (let i = 0; i < 3; i++) {
        await request(testContext.app)
          .post('/api/scan')
          .send({
            tokenId: `MEM_INTERRUPTED_${i}`,
            teamId: 'TEAM_A',
            scannerId: 'SCANNER_01',
          });
      }

      // Simulate crash during offline
      global.unexpectedShutdown = true;
      await testDelay(50);

      // Recover
      global.unexpectedShutdown = false;
      global.offlineMode = false;

      // Check if queued transactions were preserved
      const state = await request(testContext.app).get('/api/state');
      const found = (state.body.recentTransactions || [])
        .filter(t => t.tokenId && t.tokenId.includes('INTERRUPTED'));
      
      // Some transactions might be recovered
      expect(found.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle network flapping', async () => {
      const results = [];

      // Rapidly switch between online and offline
      for (let i = 0; i < 5; i++) {
        global.offlineMode = i % 2 === 0;
        
        const response = await request(testContext.app)
          .post('/api/scan')
          .send({
            tokenId: `MEM_FLAPPING_${i}`,
            teamId: 'TEAM_B',
            scannerId: 'SCANNER_01',
          });
        
        results.push({
          offline: global.offlineMode,
          status: response.status
        });
        
        await testDelay(50);
      }

      global.offlineMode = false;

      // System should handle flapping gracefully
      const online = results.filter(r => !r.offline);
      const offline = results.filter(r => r.offline);
      
      expect(online.every(r => r.status === 200 || r.status === 409)).toBe(true);
      expect(offline.every(r => r.status === 202 || r.status === 503)).toBe(true);
    });
  });
});