/**
 * Device Events - Contract Validation Tests
 * Tests device:disconnected event against AsyncAPI schema
 *
 * Layer 3 (Contract): Validates event structure, NOT business logic flow
 * Pattern: 2-socket pattern (like auth-events.test.js)
 *
 * IMPORTANT: device:disconnected broadcasts to OTHER clients, not self.
 * Must use 2 sockets to test: socket1 receives, socket2 disconnects.
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent, createTrackedSocket } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const sessionService = require('../../../src/services/sessionService');

describe('Device Events - Contract Validation', () => {
  let testContext;
  let socket1;
  let socket2;

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
      name: 'Device Test Session',
      teams: ['001', '002']
    });
  });

  afterEach(async () => {
    if (socket1 && socket1.connected) {
      socket1.disconnect();
    }
    if (socket2 && socket2.connected) {
      socket2.disconnect();
    }
    await sessionService.reset();
  });

  describe('device:disconnected event', () => {
    it('should match AsyncAPI schema when GM disconnects manually', async () => {
      // Setup: Connect first GM socket (will receive broadcast)
      socket1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_1');

      // Setup: Listen for device:disconnected BEFORE triggering
      const eventPromise = waitForEvent(socket1, 'device:disconnected');

      // Trigger: Connect and disconnect second GM socket
      socket2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_2');

      // Disconnect second socket (will broadcast device:disconnected to socket1)
      socket2.disconnect();

      // Wait: For device:disconnected broadcast
      const event = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'device:disconnected');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Payload content
      expect(event.data).toHaveProperty('deviceId', 'TEST_GM_2');
      expect(event.data).toHaveProperty('type', 'gm');
      expect(event.data).toHaveProperty('disconnectionTime');
      expect(event.data.disconnectionTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(event.data).toHaveProperty('reason');
      expect(['manual', 'timeout', 'error']).toContain(event.data.reason);

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'device:disconnected');
    });

    it('should match AsyncAPI schema when different GM disconnects', async () => {
      // Setup: Connect first GM socket (will receive broadcast)
      socket1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_OBSERVER');

      // Setup: Listen for device:disconnected
      const eventPromise = waitForEvent(socket1, 'device:disconnected');

      // Trigger: Connect and disconnect third GM socket
      socket2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_3');
      socket2.disconnect();

      // Wait: For device:disconnected broadcast
      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'device:disconnected');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data).toHaveProperty('deviceId', 'TEST_GM_3');
      expect(event.data).toHaveProperty('type', 'gm');
      expect(event.data).toHaveProperty('disconnectionTime');
      expect(event.data).toHaveProperty('reason');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'device:disconnected');
    });
  });
});
