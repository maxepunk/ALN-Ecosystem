/**
 * Session Events - Contract Validation Tests
 * Tests session-related WebSocket events for wrapped envelope compliance
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent, createTrackedSocket } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');
const { generateAdminToken } = require('../../../src/middleware/auth');

describe('Session Events - Contract Validation', () => {
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
    // Reset services to clean state
    await resetAllServices();

    // Re-setup broadcast listeners after reset
    const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../../src/websocket/broadcasts');
    const stateService = require('../../../src/services/stateService');
    const videoQueueService = require('../../../src/services/videoQueueService');
    const offlineQueueService = require('../../../src/services/offlineQueueService');
    const transactionService = require('../../../src/services/transactionService');

    cleanupBroadcastListeners();
    setupBroadcastListeners(testContext.io, {
      sessionService,
      stateService,
      videoQueueService,
      offlineQueueService,
      transactionService
    });

    // Connect real WebSocket (GM Scanner simulation)
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_PHASE3');
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await resetAllServices();
  });

  describe('session:update event', () => {
    it('should emit with wrapped envelope matching AsyncAPI schema for new session', async () => {
      // Setup: Listen for event BEFORE triggering
      const eventPromise = waitForEvent(socket, 'session:update');

      // Trigger: Create session (emits session:update with status='active')
      const session = await sessionService.createSession({
        name: 'Wrap Test Session',
        teams: ['Team Alpha', 'Detectives']
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
      expect(eventData.data.teams).toEqual(['Team Alpha', 'Detectives']); // 3-digit zero-padded

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(eventData, 'session:update');
    });
  });

  describe('sync:full event', () => {
    it('should match AsyncAPI schema with complete payload including all required fields', async () => {
      // Setup: Create session with teams for complete state
      await sessionService.createSession({
        name: 'Sync Full Test Session',
        teams: ['Team Alpha', 'Detectives', 'Blue Squad']
      });

      // Setup: Disconnect existing socket
      if (socket && socket.connected) {
        socket.disconnect();
      }

      // Setup: Create socket with handshake auth (production flow)
      // sync:full is sent automatically after successful handshake auth
      // Per AsyncAPI contract: handshake.auth uses deviceId, not stationId
      // IMPORTANT: Use autoConnect: false to set up listener BEFORE connecting
      const token = generateAdminToken('test-admin');
      socket = createTrackedSocket(testContext.socketUrl, {
        autoConnect: false,
        auth: {
          token: token,
          deviceId: 'TEST_GM_SYNC',
          deviceType: 'gm',
          version: '1.0.0'
        }
      });

      // Setup listener BEFORE connecting to avoid race condition
      const eventPromise = waitForEvent(socket, 'sync:full');

      // Now connect
      socket.connect();

      // Wait: For sync:full (auto-sent after handshake auth per contract)
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
