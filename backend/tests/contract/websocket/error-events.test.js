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
const { resetAllServices } = require('../../helpers/service-reset');
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
    await resetAllServices();

    // Re-setup broadcast listeners after reset
    const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../../src/websocket/broadcasts');
    const videoQueueService = require('../../../src/services/videoQueueService');
    const offlineQueueService = require('../../../src/services/offlineQueueService');
    const transactionService = require('../../../src/services/transactionService');

    cleanupBroadcastListeners();
    setupBroadcastListeners(testContext.io, {
      sessionService,
      videoQueueService,
      offlineQueueService,
      transactionService
    });

    // Create session
    await sessionService.createSession({
      name: 'Error Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();

    // Connect GM socket
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_ERROR');
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await resetAllServices();
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

    it('echoes the submitted clientTxId on an error from a failed transaction:submit', async () => {
      // Drives the REAL handleTransactionSubmit catch path: an invalid mode makes
      // validate() throw -> emit 'error' with VALIDATION_ERROR. The scanner's
      // replayTransaction fast-fail matcher correlates by clientTxId, so the error
      // MUST echo it (else a rejected replay hangs the full 30s timeout). TQ-2/CC-4.
      const eventPromise = waitForEvent(socket, 'error');
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: 'Team Alpha',
          deviceId: 'TEST_GM_ERROR',
          deviceType: 'gm',
          mode: 'not-a-valid-mode',  // fails gmTransactionSchema -> validate() throws
          clientTxId: 'ctx-err-9'
        },
        timestamp: new Date().toISOString()
      });

      const event = await eventPromise;
      expect(event.data.code).toBe('VALIDATION_ERROR');
      expect(event.data.clientTxId).toBe('ctx-err-9');
      validateWebSocketEvent(event, 'error');
    });

    it('should match AsyncAPI schema with QUEUE_FULL code (offline queue overflow)', async () => {
      const eventPromise = waitForEvent(socket, 'error');

      // Trigger: QUEUE_FULL emitted from adminEvents when offline queue is at capacity
      const testError = new Error('Offline queue is full. Please try again later.');
      testError.code = 'QUEUE_FULL';
      sessionService.emit('error', testError);

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'error');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Payload content
      expect(event.data.code).toBe('QUEUE_FULL');
      expect(event.data.message).toBe('Offline queue is full. Please try again later.');

      // Validate: Against AsyncAPI contract schema
      validateWebSocketEvent(event, 'error');
    });

    it('should match AsyncAPI schema with INVALID_DATA code (identify payload malformed)', async () => {
      const eventPromise = waitForEvent(socket, 'error');

      // Trigger: INVALID_DATA emitted from gmAuth handleGmIdentify when identify payload is malformed
      const testError = new Error('Invalid identify payload: missing required fields');
      testError.code = 'INVALID_DATA';
      sessionService.emit('error', testError);

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'error');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Payload content
      expect(event.data.code).toBe('INVALID_DATA');
      expect(event.data.message).toBe('Invalid identify payload: missing required fields');

      // Validate: Against AsyncAPI contract schema
      validateWebSocketEvent(event, 'error');
    });
  });
});
