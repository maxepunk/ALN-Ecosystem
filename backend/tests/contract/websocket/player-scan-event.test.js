/**
 * Player Scan Event - Contract Validation Tests
 * Tests player:scan event against AsyncAPI schema
 *
 * Layer 3 (Contract): Validates event structure, NOT business logic flow
 * Pattern: Admin socket monitoring player scanner activity
 *
 * IMPORTANT: player:scan broadcasts ONLY to admin-monitors room, not gm-stations.
 * Must use admin socket to receive this event.
 */

const request = require('supertest');
const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { waitForEvent, createTrackedSocket } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');

describe('Player Scan Event - Contract Validation', () => {
  let testContext;
  let adminSocket;
  let authToken;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();

    // Get admin token for authenticated socket connection
    const authResponse = await request(testContext.url)
      .post('/api/admin/auth')
      .send({
        password: process.env.ADMIN_PASSWORD || 'admin123'
      });

    authToken = authResponse.body.token;
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await resetAllServices();
    const videoQueueService = require('../../../src/services/videoQueueService');
    videoQueueService.reset();  // Reset video queue to clear any playing videos

    // Create session (player scans work with or without session)
    await sessionService.createSession({
      name: 'Player Scan Test Session',
      teams: ['001', '002']
    });

    // Connect admin socket (will receive player:scan events)
    // Admin socket uses handshake.auth with JWT token
    adminSocket = createTrackedSocket(testContext.socketUrl, {
      auth: {
        token: authToken,
        deviceId: 'TEST_ADMIN_MONITOR',
        deviceType: 'admin',
        version: '1.0.0'
      }
    });

    // Wait for connection to establish
    await new Promise((resolve) => {
      if (adminSocket.connected) {
        resolve();
      } else {
        adminSocket.once('connect', resolve);
      }
    });
  });

  afterEach(async () => {
    if (adminSocket && adminSocket.connected) {
      adminSocket.disconnect();
    }
    await resetAllServices();
    const videoQueueService = require('../../../src/services/videoQueueService');
    videoQueueService.reset();  // Clean up video queue after test
  });

  describe('player:scan event', () => {
    it('should match AsyncAPI schema when player scans video token', async () => {
      // Setup: Listen for player:scan BEFORE triggering
      const eventPromise = waitForEvent(adminSocket, 'player:scan');

      // Trigger: Player scanner sends scan via HTTP POST /api/scan
      await request(testContext.url)
        .post('/api/scan')
        .send({
          tokenId: 'jaw001',  // Only video token in ALN-TokenData
          deviceId: 'PLAYER_8a7b9c1d',
          teamId: '001',
          timestamp: new Date().toISOString()
        })
        .expect(200);

      // Wait: For player:scan broadcast to admin
      const event = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'player:scan');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Payload content (per AsyncAPI PlayerScan schema)
      expect(event.data).toHaveProperty('tokenId', 'jaw001');
      expect(event.data).toHaveProperty('deviceId', 'PLAYER_8a7b9c1d');
      expect(event.data).toHaveProperty('teamId', '001');
      expect(event.data).toHaveProperty('videoQueued', true);  // Video token queues video
      expect(event.data).toHaveProperty('memoryType', 'Personal');  // From tokens.json
      expect(event.data).toHaveProperty('timestamp');
      expect(event.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'player:scan');
    });

    it('should match AsyncAPI schema when player scans non-video token', async () => {
      // Setup: Listen for player:scan
      const eventPromise = waitForEvent(adminSocket, 'player:scan');

      // Trigger: Player scanner sends scan for image/audio token (no video)
      await request(testContext.url)
        .post('/api/scan')
        .send({
          tokenId: 'tac001',  // Non-video token (image + audio only)
          deviceId: 'PLAYER_test123',
          timestamp: new Date().toISOString()
        })
        .expect(200);

      // Wait: For player:scan broadcast
      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'player:scan');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: Payload content
      expect(event.data).toHaveProperty('tokenId', 'tac001');
      expect(event.data).toHaveProperty('deviceId', 'PLAYER_test123');
      expect(event.data).toHaveProperty('teamId', null);  // No teamId provided
      expect(event.data).toHaveProperty('videoQueued', false);  // No video in token
      expect(event.data).toHaveProperty('memoryType', 'Business');  // From tokens.json
      expect(event.data).toHaveProperty('timestamp');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'player:scan');
    });

    it('should match AsyncAPI schema with optional teamId', async () => {
      // Setup: Listen for player:scan
      const eventPromise = waitForEvent(adminSocket, 'player:scan');

      // Trigger: Player scan without teamId (optional field)
      await request(testContext.url)
        .post('/api/scan')
        .send({
          tokenId: 'jaw001',  // Only video token in ALN-TokenData
          deviceId: 'PLAYER_scanner_1',
          // teamId omitted (optional per contract)
          timestamp: new Date().toISOString()
        })
        .expect(200);

      // Wait: For player:scan broadcast
      const event = await eventPromise;

      // Validate: Wrapped envelope
      expect(event).toHaveProperty('event', 'player:scan');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');

      // Validate: teamId is null when not provided
      expect(event.data).toHaveProperty('tokenId', 'jaw001');
      expect(event.data).toHaveProperty('teamId', null);
      expect(event.data).toHaveProperty('videoQueued', true);
      expect(event.data).toHaveProperty('memoryType', 'Personal');
      expect(event.data).toHaveProperty('timestamp');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'player:scan');
    });
  });
});
