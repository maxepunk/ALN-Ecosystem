/**
 * Session Events - Contract Validation Tests
 * Tests session-related WebSocket events for wrapped envelope compliance
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent } = require('../../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../../helpers/test-server');
const sessionService = require('../../../src/services/sessionService');

describe('Session Events - Contract Validation', () => {
  let testContext;
  let socket;

  beforeAll(async () => {
    // Setup HTTP server + WebSocket
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    // Cleanup server
    await cleanupTestServer(testContext);
  });

  beforeEach(async () => {
    // Reset services to clean state
    await sessionService.reset();

    // Connect real WebSocket (GM Scanner simulation)
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_PHASE3');
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await sessionService.reset();
  });

  describe('session:update event', () => {
    it('should emit with wrapped envelope matching AsyncAPI schema for new session', async () => {
      // Setup: Listen for event BEFORE triggering
      const eventPromise = waitForEvent(socket, 'session:update');

      // Trigger: Create session (emits session:update with status='active')
      const session = await sessionService.createSession({
        name: 'Wrap Test Session',
        teams: ['001', '002']
      });

      // Assert: Wait for WebSocket event
      const eventData = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(eventData).toHaveProperty('event', 'session:update');
      expect(eventData).toHaveProperty('data');
      expect(eventData).toHaveProperty('timestamp');
      expect(eventData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601

      // Validate: Payload content (full session resource per Decision #7)
      expect(eventData.data).toHaveProperty('id', session.id);
      expect(eventData.data).toHaveProperty('name', 'Wrap Test Session');
      expect(eventData.data).toHaveProperty('status', 'active'); // New session = active
      expect(eventData.data).toHaveProperty('teams');
      expect(eventData.data.teams).toEqual(['001', '002']); // 3-digit zero-padded

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(eventData, 'session:update');
    });
  });

  describe('sync:full event', () => {
    it('should match AsyncAPI schema with complete payload including all required fields', async () => {
      // Setup: Create session with teams for complete state
      await sessionService.createSession({
        name: 'Sync Full Test Session',
        teams: ['001', '002', '003']
      });

      // Setup: Disconnect existing socket
      if (socket && socket.connected) {
        socket.disconnect();
      }

      // Setup: Listen for sync:full BEFORE connecting
      // Note: sync:full is sent automatically after gm:identified
      const io = require('socket.io-client');
      socket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false
      });

      const eventPromise = waitForEvent(socket, 'sync:full');

      // Trigger: Identify to trigger sync:full (sent after gm:identified)
      socket.emit('gm:identify', {
        deviceId: 'TEST_GM_SYNC',
        name: 'Test GM',
        version: '1.0.0'
      });

      // Wait: For sync:full broadcast
      const event = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'sync:full');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: All required top-level fields exist
      expect(event.data).toHaveProperty('session');
      expect(event.data).toHaveProperty('scores');
      expect(event.data).toHaveProperty('recentTransactions');
      expect(event.data).toHaveProperty('videoStatus');
      expect(event.data).toHaveProperty('devices');
      expect(event.data).toHaveProperty('systemStatus');

      // Validate: session field (Session object or null)
      if (event.data.session !== null) {
        expect(event.data.session).toHaveProperty('id');
        expect(event.data.session).toHaveProperty('name');
        expect(event.data.session).toHaveProperty('status');
        expect(event.data.session).toHaveProperty('teams');
        expect(Array.isArray(event.data.session.teams)).toBe(true);
      }

      // Validate: scores field (array of TeamScore objects)
      expect(Array.isArray(event.data.scores)).toBe(true);
      if (event.data.scores.length > 0) {
        const score = event.data.scores[0];
        expect(score).toHaveProperty('teamId');
        expect(score).toHaveProperty('currentScore');
        expect(score).toHaveProperty('baseScore');
        expect(score).toHaveProperty('bonusPoints');
        expect(score).toHaveProperty('tokensScanned');
        expect(score).toHaveProperty('completedGroups');
        expect(score).toHaveProperty('lastUpdate');
      }

      // Validate: recentTransactions field (array)
      expect(Array.isArray(event.data.recentTransactions)).toBe(true);

      // Validate: videoStatus field (object with required fields)
      expect(event.data.videoStatus).toHaveProperty('status');
      expect(event.data.videoStatus).toHaveProperty('queueLength');
      expect(['idle', 'loading', 'playing', 'paused', 'completed', 'error']).toContain(event.data.videoStatus.status);
      expect(typeof event.data.videoStatus.queueLength).toBe('number');

      // Validate: devices field (array)
      expect(Array.isArray(event.data.devices)).toBe(true);

      // Validate: systemStatus field (object with orchestrator and vlc)
      expect(event.data.systemStatus).toHaveProperty('orchestrator');
      expect(event.data.systemStatus).toHaveProperty('vlc');
      expect(['online', 'offline']).toContain(event.data.systemStatus.orchestrator);
      expect(['connected', 'disconnected', 'error']).toContain(event.data.systemStatus.vlc);

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'sync:full');
    });
  });
});
