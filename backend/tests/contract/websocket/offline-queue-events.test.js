/**
 * Offline Queue Events - Contract Validation Tests
 * Tests offline:queue:processed event against AsyncAPI schema
 *
 * Layer 3 (Contract): Validates event structure, NOT business logic flow
 * Pattern B: Direct service emission (like score-events.test.js)
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const sessionService = require('../../../src/services/sessionService');
const offlineQueueService = require('../../../src/services/offlineQueueService');

describe('Offline Queue Events - Contract Validation', () => {
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
      name: 'Offline Queue Test Session',
      teams: ['001', '002']
    });

    // Connect GM socket
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_OFFLINE');
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await sessionService.reset();
  });

  describe('offline:queue:processed event', () => {
    it('should match AsyncAPI schema when queue processing completes', async () => {
      // Setup: Listen for offline:queue:processed BEFORE triggering
      const eventPromise = waitForEvent(socket, 'offline:queue:processed');

      // Trigger: Directly emit offline:queue:processed event (Pattern B - no business logic)
      // This simulates offlineQueueService completing queue processing
      // Note: Service emits wrapped envelope per AsyncAPI contract
      offlineQueueService.emit('offline:queue:processed', {
        event: 'offline:queue:processed',
        data: {
          queueSize: 2,
          results: [
            { transactionId: '7b8b1d85-b234-4be9-bde5-4c8522a1f15e', status: 'processed', tokenId: '534e2b03' },
            { transactionId: '8c9c2e96-c345-5cf0-cef6-5d9633b2f26f', status: 'processed', tokenId: 'tac001' }
          ]
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For offline:queue:processed broadcast
      const event = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'offline:queue:processed');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Payload content
      expect(event.data).toHaveProperty('queueSize', 2);
      expect(event.data).toHaveProperty('results');
      expect(Array.isArray(event.data.results)).toBe(true);
      expect(event.data.results.length).toBe(2);
      expect(event.data.results[0]).toHaveProperty('transactionId', '7b8b1d85-b234-4be9-bde5-4c8522a1f15e');
      expect(event.data.results[0]).toHaveProperty('status', 'processed');
      expect(event.data.results[1]).toHaveProperty('transactionId', '8c9c2e96-c345-5cf0-cef6-5d9633b2f26f');
      expect(event.data.results[1]).toHaveProperty('status', 'processed');

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'offline:queue:processed');
    });

    it('should match AsyncAPI schema when some transactions fail', async () => {
      const eventPromise = waitForEvent(socket, 'offline:queue:processed');

      // Trigger: Emit with some failures (wrapped envelope)
      offlineQueueService.emit('offline:queue:processed', {
        event: 'offline:queue:processed',
        data: {
          queueSize: 3,
          results: [
            { transactionId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef', status: 'processed', tokenId: '534e2b03' },
            { transactionId: 'b2c3d4e5-f678-9012-3456-7890abcdef01', status: 'failed', error: 'Token not found' },
            { transactionId: 'c3d4e5f6-7890-1234-5678-90abcdef0123', status: 'failed', error: 'Validation failed' }
          ]
        },
        timestamp: new Date().toISOString()
      });

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'offline:queue:processed');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data.queueSize).toBe(3);
      expect(event.data.results.length).toBe(3);
      expect(event.data.results[0]).toHaveProperty('transactionId', 'a1b2c3d4-e5f6-7890-1234-567890abcdef');
      expect(event.data.results[0]).toHaveProperty('status', 'processed');
      expect(event.data.results[1]).toHaveProperty('transactionId', 'b2c3d4e5-f678-9012-3456-7890abcdef01');
      expect(event.data.results[1]).toHaveProperty('status', 'failed');
      expect(event.data.results[1]).toHaveProperty('error', 'Token not found');
      expect(event.data.results[2]).toHaveProperty('transactionId', 'c3d4e5f6-7890-1234-5678-90abcdef0123');
      expect(event.data.results[2]).toHaveProperty('status', 'failed');
      expect(event.data.results[2]).toHaveProperty('error', 'Validation failed');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'offline:queue:processed');
    });

    it('should match AsyncAPI schema when queue is empty', async () => {
      const eventPromise = waitForEvent(socket, 'offline:queue:processed');

      // Trigger: Emit with empty results (wrapped envelope)
      offlineQueueService.emit('offline:queue:processed', {
        event: 'offline:queue:processed',
        data: {
          queueSize: 0,
          results: []
        },
        timestamp: new Date().toISOString()
      });

      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'offline:queue:processed');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data.queueSize).toBe(0);
      expect(event.data.results.length).toBe(0);
      expect(Array.isArray(event.data.results)).toBe(true);

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'offline:queue:processed');
    });
  });
});
