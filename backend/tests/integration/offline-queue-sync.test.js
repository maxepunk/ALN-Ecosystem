/**
 * Offline Queue Synchronization Integration Tests
 * Tests offline scan queueing → processing → broadcasts
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { resetAllServices, resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const offlineQueueService = require('../../src/services/offlineQueueService');
const transactionService = require('../../src/services/transactionService');
const stateService = require('../../src/services/stateService');
const videoQueueService = require('../../src/services/videoQueueService');

describe('Offline Queue Synchronization Integration', () => {
  let testContext, gmSocket;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Complete reset cycle: cleanup → reset → setup
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      stateService,
      videoQueueService,
      offlineQueueService
    });

    // Clear offline queue state without removing listeners
    offlineQueueService.playerScanQueue = [];
    offlineQueueService.gmTransactionQueue = [];
    offlineQueueService.isOffline = false;
    offlineQueueService.processingQueue = false;

    // Create test session
    await sessionService.createSession({
      name: 'Offline Queue Test',
      teams: ['001', '002']
    });

    // Connect GM scanner
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_OFFLINE_TEST');
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
  });

  it('should process player scan queue (logging only, no scoring)', async () => {
    // Setup: Enqueue player scans (NO teamId, NO mode - just logs)
    offlineQueueService.enqueue({
      tokenId: '534e2b03',
      deviceId: 'PLAYER_OFFLINE_1',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        deviceType: 'gm',  // Required by Phase 3 P0.1
      timestamp: new Date().toISOString()
    });

    offlineQueueService.enqueue({
      tokenId: 'jaw001',
      deviceId: 'PLAYER_OFFLINE_2',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        deviceType: 'gm',  // Required by Phase 3 P0.1
      timestamp: new Date().toISOString()
    });

    // Listen for offline:queue:processed broadcast
    const queueProcessedPromise = waitForEvent(gmSocket, 'offline:queue:processed');

    // Trigger: Process queue
    await offlineQueueService.processQueue();

    // Wait for broadcast
    const queueEvent = await queueProcessedPromise;

    // Validate: offline:queue:processed event
    expect(queueEvent.event).toBe('offline:queue:processed');
    expect(queueEvent.data.queueSize).toBe(2);
    expect(queueEvent.data.results).toBeDefined();
    expect(queueEvent.data.results.length).toBe(2);

    // Validate: Player scans are processed (per AsyncAPI contract)
    const result1 = queueEvent.data.results[0];
    expect(result1.status).toBe('processed'); // AsyncAPI contract: 'processed' | 'failed'
    expect(result1.tokenId).toBe('534e2b03');

    // Validate: Team scores NOT affected (player scans don't score)
    const team001Score = transactionService.teamScores.get('001');
    expect(team001Score.currentScore).toBe(0); // Player scans don't add points
  });

  it('should process GM transaction queue (full scoring)', async () => {
    // Setup: Enqueue GM transactions (WITH teamId and mode)
    offlineQueueService.enqueueGmTransaction({
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'GM_OFFLINE_1',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        deviceType: 'gm',  // Required by Phase 3 P0.1
      mode: 'blackmarket',
      timestamp: new Date().toISOString()
    });

    offlineQueueService.enqueueGmTransaction({
      tokenId: 'jaw001',
      teamId: '002',
      deviceId: 'GM_OFFLINE_2',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        deviceType: 'gm',  // Required by Phase 3 P0.1
      mode: 'blackmarket',
      timestamp: new Date().toISOString()
    });

    // Listen for offline:queue:processed broadcast
    const queueProcessedPromise = waitForEvent(gmSocket, 'offline:queue:processed');

    // Trigger: Process queue
    await offlineQueueService.processQueue();

    // Wait for broadcast
    const queueEvent = await queueProcessedPromise;

    // Validate: offline:queue:processed event
    expect(queueEvent.event).toBe('offline:queue:processed');
    expect(queueEvent.data.queueSize).toBe(2);
    expect(queueEvent.data.results.length).toBe(2);

    // Validate: GM transactions are processed with scoring
    const result1 = queueEvent.data.results.find(r => r.tokenId === '534e2b03');
    expect(result1).toBeDefined();
    expect(result1.status).toBe('processed'); // AsyncAPI contract: 'processed' | 'failed'
    expect(result1.transactionStatus).toBe('accepted'); // Internal: actual transaction status
    expect(result1.points).toBeGreaterThan(0);

    // Validate: Team scores updated
    const team001Score = transactionService.teamScores.get('001');
    const team002Score = transactionService.teamScores.get('002');
    expect(team001Score.currentScore).toBeGreaterThan(0); // GM transaction scored
    expect(team002Score.currentScore).toBeGreaterThan(0);
  });

  it('should emit sync:full after queue processing', async () => {
    // Setup: Enqueue GM transaction (need scoring for sync:full to have data)
    offlineQueueService.enqueueGmTransaction({
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'GM_OFFLINE',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        deviceType: 'gm',  // Required by Phase 3 P0.1
      mode: 'blackmarket',
      timestamp: new Date().toISOString()
    });

    // Listen for BOTH events
    const queuePromise = waitForEvent(gmSocket, 'offline:queue:processed');
    const syncPromise = waitForEvent(gmSocket, 'sync:full');

    // Trigger: Process queue
    await offlineQueueService.processQueue();

    const [queueEvent, syncEvent] = await Promise.all([queuePromise, syncPromise]);

    // Validate: Both events received
    expect(queueEvent.event).toBe('offline:queue:processed');
    expect(syncEvent.event).toBe('sync:full');

    // Validate: sync:full has complete state
    expect(syncEvent.data).toHaveProperty('session');
    expect(syncEvent.data).toHaveProperty('scores');
    expect(syncEvent.data).toHaveProperty('recentTransactions');
    expect(syncEvent.data).toHaveProperty('videoStatus');
    expect(syncEvent.data).toHaveProperty('devices');
  });

  it('should handle empty queue gracefully', async () => {
    // Don't enqueue anything - queue is empty

    // Process empty queue should not crash
    await offlineQueueService.processQueue();

    // Verify: Queue remains empty (check internal arrays)
    expect(offlineQueueService.playerScanQueue.length).toBe(0);
    expect(offlineQueueService.gmTransactionQueue.length).toBe(0);
  });
});
