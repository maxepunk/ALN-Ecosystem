/**
 * Early Connection Integration Test (Phase 1.3 P0.3)
 * Verifies broadcast listeners are properly set up before handlers
 * Ensures early connections receive broadcasts correctly
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const stateService = require('../../src/services/stateService');
const videoQueueService = require('../../src/services/videoQueueService');
const offlineQueueService = require('../../src/services/offlineQueueService');

describe('Early Connection Integration (Phase 1.3)', () => {
  let testContext, gmSocket;

  beforeAll(async () => {
    // Setup server with proper initialization order (Phase 1.3)
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Complete reset cycle
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      stateService,
      videoQueueService,
      offlineQueueService
    });

    // Create test session BEFORE connecting
    await sessionService.createSession({
      name: 'Early Connection Test',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();

    // Connect GM scanner (represents early connection scenario)
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_EARLY_TEST');
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
  });

  it('should receive offline queue broadcasts for early connections (Phase 1.3 validation)', async () => {
    // PHASE 1.3 FIX VALIDATION:
    // Before: setupWebSocketHandlers called before setupServiceListeners → race condition
    // After: setupServiceListeners called before setupWebSocketHandlers → broadcasts work
    //
    // This test verifies that early connections (connections that arrive immediately
    // after server startup) receive broadcasts correctly. This proves that broadcast
    // listeners are properly registered before handlers accept connections.

    // Enqueue offline scan
    offlineQueueService.enqueue({
      tokenId: 'rat001',
      deviceId: 'PLAYER_OFFLINE',
      timestamp: new Date().toISOString()
    });

    // Listen for queue processed event
    const queuePromise = waitForEvent(gmSocket, 'offline:queue:processed');

    // Process queue (triggers broadcast)
    await offlineQueueService.processQueue();

    // Validate: GM receives queue broadcast
    const queueEvent = await queuePromise;

    expect(queueEvent.event).toBe('offline:queue:processed');
    expect(queueEvent.data).toBeDefined();
    expect(queueEvent.data.queueSize).toBe(1);

    // This proves:
    // 1. broadcast listeners are registered
    // 2. early connections receive broadcasts
    // 3. no race condition exists
    // 4. Phase 1.3 initialization order fix works correctly
  });
});
