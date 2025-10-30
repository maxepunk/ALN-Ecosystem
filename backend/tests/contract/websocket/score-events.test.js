/**
 * Score Events - Contract Validation Tests
 * Tests score:updated and group:completed events against AsyncAPI schema
 *
 * Layer 3 (Contract): Validates event structure, NOT business logic flow
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const TeamScore = require('../../../src/models/teamScore');

describe('Score Events - Contract Validation', () => {
  let testContext;
  let socket;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await resetAllServices();

    // Create session with teams
    await sessionService.createSession({
      name: 'Score Test Session',
      teams: ['001', '002']
    });

    // Connect GM socket - but DON'T await yet
    const connectionPromise = connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_SCORE');

    // Fix: WebSocket room join timing race condition
    // Tests were emitting to 'gm-stations' room before socket finished joining.
    // Solution: Wait for sync:full event (sent after room join per AsyncAPI contract).

    // CRITICAL: Wait for connection AND sync:full in parallel
    // Per AsyncAPI contract lines 244-252, sync:full is auto-sent after authentication
    // This guarantees socket has joined 'gm-stations' room and can receive broadcasts
    socket = await connectionPromise;

    // Set up listener immediately after socket is available (but connection may still be completing)
    const syncPromise = waitForEvent(socket, 'sync:full', 10000);

    // Wait for sync:full to confirm room join complete
    await syncPromise;

    // Small delay to ensure room join propagated through Socket.io internals
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await resetAllServices();
  });

  describe('score:updated broadcast', () => {
    it('should match AsyncAPI schema when broadcasted to GMs', async () => {
      // Setup: Listen for score:updated BEFORE triggering
      const scorePromise = waitForEvent(socket, 'score:updated');

      // Trigger: Directly emit score:updated via transactionService
      // (Contract test: validate structure, not business logic)
      const teamScore = TeamScore.createInitial('001');
      teamScore.addPoints(100);
      teamScore.incrementTokensScanned();
      transactionService.emit('score:updated', teamScore);

      // Wait: For score:updated broadcast
      const event = await scorePromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'score:updated');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'score:updated');
    });
  });

  describe('group:completed broadcast', () => {
    it('should match AsyncAPI schema when broadcasted to GMs', async () => {
      // Setup: Listen for group:completed BEFORE triggering
      const groupPromise = waitForEvent(socket, 'group:completed');

      // Trigger: Directly emit group:completed via transactionService
      // (Contract test: validate structure, not business logic)
      // Note: Service emits with these field names, broadcasts.js transforms to contract format
      transactionService.emit('group:completed', {
        teamId: '001',
        groupId: 'jaw_group',  // broadcasts.js maps to 'group'
        bonus: 500             // broadcasts.js maps to 'bonusPoints'
      });

      // Wait: For group:completed broadcast
      const event = await groupPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'group:completed');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'group:completed');
    });
  });
});
