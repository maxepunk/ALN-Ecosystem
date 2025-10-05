/**
 * Error Events - Contract Validation Tests
 * Tests error event against AsyncAPI schema
 *
 * Layer 3 (Contract): Validates event structure, NOT business logic flow
 * Pattern B: Direct service emission (like score-events.test.js)
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const sessionService = require('../../../src/services/sessionService');

describe('Error Events - Contract Validation', () => {
  let testContext;
  let socket;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();

    // Create session
    await sessionService.createSession({
      name: 'Error Test Session',
      teams: ['001', '002']
    });

    // Connect GM socket
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_ERROR');
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await sessionService.reset();
  });

  describe('error event', () => {
    it('should match AsyncAPI schema when service emits error', async () => {
      // Setup: Listen for error BEFORE triggering
      const eventPromise = waitForEvent(socket, 'error');

      // Trigger: Directly emit error from service (Pattern B - no business logic)
      const testError = new Error('Test error message');
      testError.code = 'TOKEN_NOT_FOUND';
      sessionService.emit('error', testError);

      // Wait: For error broadcast
      const event = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'error');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Payload content
      expect(event.data).toHaveProperty('code', 'TOKEN_NOT_FOUND');
      expect(event.data).toHaveProperty('message', 'Test error message');
      expect(typeof event.data.code).toBe('string');
      expect(typeof event.data.message).toBe('string');

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'error');
    });

    it('should match AsyncAPI schema with INTERNAL_ERROR code', async () => {
      const eventPromise = waitForEvent(socket, 'error');

      // Trigger: Error without explicit code (should default to INTERNAL_ERROR)
      const testError = new Error('Internal system error');
      testError.code = 'INTERNAL_ERROR';
      sessionService.emit('error', testError);

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'error');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data.code).toBe('INTERNAL_ERROR');
      expect(event.data.message).toBe('Internal system error');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'error');
    });

    it('should match AsyncAPI schema with validation error', async () => {
      const eventPromise = waitForEvent(socket, 'error');

      // Trigger: Validation error
      const testError = new Error('Invalid request payload');
      testError.code = 'VALIDATION_ERROR';
      sessionService.emit('error', testError);

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'error');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data.code).toBe('VALIDATION_ERROR');
      expect(event.data.message).toBe('Invalid request payload');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'error');
    });
  });
});
