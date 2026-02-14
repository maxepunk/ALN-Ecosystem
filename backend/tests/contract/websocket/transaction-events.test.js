/**
 * Transaction Events - Contract Validation Tests
 * Tests transaction:submit, transaction:result, transaction:new, and score:updated events
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');

describe('Transaction Events - Contract Validation', () => {
  let testContext;
  let socket;

  beforeAll(async () => {
    // Setup HTTP server + WebSocket
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    // Cleanup server
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Reset services to clean state (follow session-events.test.js pattern)
    await resetAllServices();

    // Re-setup broadcast listeners after reset
    const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../../src/websocket/broadcasts');
    const stateService = require('../../../src/services/stateService');
    const videoQueueService = require('../../../src/services/videoQueueService');
    const offlineQueueService = require('../../../src/services/offlineQueueService');
    const transactionService = require('../../../src/services/transactionService');

    cleanupBroadcastListeners();

    // Re-register persistence listeners (Slice 5: cleanupBroadcastListeners clears registry)
    sessionService.setupPersistenceListeners();

    setupBroadcastListeners(testContext.io, {
      sessionService,
      stateService,
      videoQueueService,
      offlineQueueService,
      transactionService
    });

    // Create session for transaction tests
    await sessionService.createSession({
      name: 'Transaction Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();

    // Connect WebSocket (GM Scanner simulation) using helper
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_TRANSACTIONS');
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await resetAllServices();
  });

  describe('transaction:result response', () => {
    it('should match AsyncAPI schema when transaction accepted', async () => {
      // Setup: Listen for transaction:result BEFORE submitting
      const resultPromise = waitForEvent(socket, 'transaction:result');

      // Trigger: Submit transaction (using real token from tokens.json)
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Real token: Technical, rating=3
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',  // P0.1: Required for device-type-specific behavior
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:result response
      const event = await resultPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'transaction:result');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'transaction:result');
    });
  });

  describe('transaction:new broadcast', () => {
    it('should match AsyncAPI schema when broadcasted to GMs', async () => {
      // Setup: Listen for transaction:new BEFORE submitting
      const broadcastPromise = waitForEvent(socket, 'transaction:new');

      // Trigger: Submit transaction
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'tac001',  // Real token: Personal, rating=1
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',  // P0.1: Required for device-type-specific behavior
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:new broadcast
      const event = await broadcastPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'transaction:new');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'transaction:new');
    });

    it('should include summary field when token has summary (detective mode)', async () => {
      // Setup: Listen for transaction:new BEFORE submitting
      const broadcastPromise = waitForEvent(socket, 'transaction:new');

      // Trigger: Submit detective mode transaction for token with summary
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'det001',  // Detective token with summary field
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',
          mode: 'detective'  // Detective mode
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:new broadcast
      const event = await broadcastPromise;

      // Validate: Summary is included
      expect(event.data.transaction).toHaveProperty('summary');
      expect(event.data.transaction.summary).toBe('Security footage from warehouse district - timestamp 23:47');

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'transaction:new');
    });

    it('should handle tokens without summary gracefully', async () => {
      // Setup: Listen for transaction:new BEFORE submitting
      const broadcastPromise = waitForEvent(socket, 'transaction:new');

      // Trigger: Submit transaction for token without summary
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'alr001',  // Token without summary field
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',
          mode: 'detective'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:new broadcast
      const event = await broadcastPromise;

      // Validate: Summary is null or undefined (graceful handling)
      expect(event.data.transaction.summary).toBeNull();

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'transaction:new');
    });

    it('should transmit HTML/special characters in summary without modification', async () => {
      // Setup: Listen for transaction:new BEFORE submitting
      const broadcastPromise = waitForEvent(socket, 'transaction:new');

      // Trigger: Submit transaction for token with HTML/special characters
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'det999',  // Token with HTML/special characters in summary
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',
          mode: 'detective'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:new broadcast
      const event = await broadcastPromise;

      // Validate: Summary contains unescaped HTML (backend does not escape)
      expect(event.data.transaction.summary).toBe('<script>alert("XSS")</script> Test & "special" \'chars\'');

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'transaction:new');
    });
  });
});
