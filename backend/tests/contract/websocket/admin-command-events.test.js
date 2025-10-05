/**
 * Admin Command Events - Contract Validation Tests
 * Tests gm:command and gm:command:ack events for AsyncAPI compliance
 *
 * EXPECTED: These tests WILL FAIL initially (TDD approach)
 * Known violations in adminEvents.js:
 * 1. Uses data.command instead of data.action
 * 2. Uses pause_session instead of session:pause
 * 3. gm:command:ack missing 'message' field
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const sessionService = require('../../../src/services/sessionService');

describe('Admin Command Events - Contract Validation', () => {
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
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_ADMIN_GM');
  });

  afterEach(async () => {
    if (socket && socket.connected) socket.disconnect();
    await sessionService.reset();
  });

  describe('gm:command event (CLIENT → SERVER)', () => {
    it('should accept session:pause command with correct structure', async () => {
      // Setup: Create session first
      await sessionService.createSession({
        name: 'Test Session for Pause',
        teams: ['001', '002']
      });

      // Setup: Listen for ack
      const ackPromise = waitForEvent(socket, 'gm:command:ack');

      // Trigger: Send gm:command with AsyncAPI-compliant structure
      socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:pause',  // Contract uses 'action' not 'command'
          payload: {}               // Contract requires 'payload' object
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For acknowledgment
      const ack = await ackPromise;

      // Validate: Ack structure matches AsyncAPI
      expect(ack).toHaveProperty('event', 'gm:command:ack');
      expect(ack).toHaveProperty('data');
      expect(ack.data).toHaveProperty('action', 'session:pause'); // Not 'command'
      expect(ack.data).toHaveProperty('success');
      expect(ack.data).toHaveProperty('message'); // REQUIRED by contract

      validateWebSocketEvent(ack, 'gm:command:ack');
    });

    it('should accept session:resume command with correct structure', async () => {
      // Setup: Create and pause session
      await sessionService.createSession({
        name: 'Test Session for Resume',
        teams: ['001', '002']
      });
      await sessionService.updateSession({ status: 'paused' });

      // Setup: Listen for ack
      const ackPromise = waitForEvent(socket, 'gm:command:ack');

      // Trigger: Send gm:command
      socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:resume',  // Contract format: 'session:resume' not 'resume_session'
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For acknowledgment
      const ack = await ackPromise;

      // Validate: Ack structure
      expect(ack.data).toHaveProperty('action', 'session:resume');
      expect(ack.data).toHaveProperty('success', true);
      expect(ack.data).toHaveProperty('message');

      validateWebSocketEvent(ack, 'gm:command:ack');
    });

    it('should accept video:skip command with correct structure', async () => {
      // Setup: Listen for ack
      const ackPromise = waitForEvent(socket, 'gm:command:ack');

      // Trigger: Send gm:command
      socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'video:skip',  // Contract format: 'video:skip' not 'skip_video'
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For acknowledgment
      const ack = await ackPromise;

      // Validate: Ack structure
      expect(ack.data).toHaveProperty('action', 'video:skip');
      expect(ack.data).toHaveProperty('success');
      expect(ack.data).toHaveProperty('message'); // REQUIRED

      validateWebSocketEvent(ack, 'gm:command:ack');
    });
  });

  describe('gm:command:ack event (SERVER → CLIENT)', () => {
    it('should match AsyncAPI schema with all required fields', async () => {
      // Setup: Create session
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002']
      });

      // Setup: Listen for ack
      const ackPromise = waitForEvent(socket, 'gm:command:ack');

      // Trigger: Send command
      socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:pause',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For ack
      const ack = await ackPromise;

      // Validate: Wrapped envelope
      expect(ack).toHaveProperty('event', 'gm:command:ack');
      expect(ack).toHaveProperty('data');
      expect(ack).toHaveProperty('timestamp');
      expect(ack.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Required data fields per AsyncAPI lines 1168-1171
      expect(ack.data).toHaveProperty('action');    // REQUIRED
      expect(ack.data).toHaveProperty('success');   // REQUIRED
      expect(ack.data).toHaveProperty('message');   // REQUIRED

      // Validate: Field types
      expect(typeof ack.data.action).toBe('string');
      expect(typeof ack.data.success).toBe('boolean');
      expect(typeof ack.data.message).toBe('string');

      // Validate: Against AsyncAPI schema
      validateWebSocketEvent(ack, 'gm:command:ack');
    });
  });
});
