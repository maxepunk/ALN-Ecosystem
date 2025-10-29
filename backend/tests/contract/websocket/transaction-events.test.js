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

    // Create session for transaction tests
    await sessionService.createSession({
      name: 'Transaction Test Session',
      teams: ['001', '002']
    });

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
          teamId: '001',
          deviceId: 'GM_CONTRACT_TEST',
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
          teamId: '001',
          deviceId: 'GM_CONTRACT_TEST',
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
  });
});
