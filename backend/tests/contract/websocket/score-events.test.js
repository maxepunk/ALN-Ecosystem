/**
 * Score Events - Contract Validation Tests
 * Tests score:updated and group:completed events against AsyncAPI schema
 *
 * Layer 3 (Contract): Validates event structure, NOT business logic flow
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent } = require('../../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../../helpers/test-server');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const TeamScore = require('../../../src/models/teamScore');

describe('Score Events - Contract Validation', () => {
  let testContext;
  let socket;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();

    // Create session with teams
    await sessionService.createSession({
      name: 'Score Test Session',
      teams: ['001', '002']
    });

    // Connect GM socket
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_SCORE');
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await sessionService.reset();
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
