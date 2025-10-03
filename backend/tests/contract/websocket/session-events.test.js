/**
 * Session Events - Contract Validation Tests
 * Tests session-related WebSocket events for wrapped envelope compliance
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent } = require('../../helpers/websocket-helpers');
const sessionService = require('../../../src/services/sessionService');
const app = require('../../../src/app');

describe('Session Events - Contract Validation', () => {
  let socket;

  beforeAll(async () => {
    // Initialize app
    await app.initializeServices();
  });

  beforeEach(async () => {
    // Reset services to clean state
    await sessionService.reset();

    // Connect real WebSocket (GM Scanner simulation)
    socket = await connectAndIdentify('TEST_GM_PHASE3', 'test-token');
  });

  afterEach(async () => {
    if (socket) {
      socket.close();
    }
    await sessionService.reset();
  });

  describe('session:new event', () => {
    it('should emit with wrapped envelope matching AsyncAPI schema', async () => {
      // Setup: Listen for event BEFORE triggering
      const eventPromise = waitForEvent(socket, 'session:new');

      // Trigger: Create session (emits session:created → broadcasts session:new)
      const session = await sessionService.createSession({
        name: 'Wrap Test Session',
        teams: ['TEAM_A', 'TEAM_B']
      });

      // Assert: Wait for WebSocket event
      const eventData = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(eventData).toHaveProperty('event', 'session:new');
      expect(eventData).toHaveProperty('data');
      expect(eventData).toHaveProperty('timestamp');
      expect(eventData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601

      // Validate: Payload content
      expect(eventData.data).toHaveProperty('sessionId', session.id);
      expect(eventData.data).toHaveProperty('name', 'Wrap Test Session');

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(eventData, 'session:new');
    });
  });
});
