/**
 * Player Scan Event - Contract Validation Tests
 * Tests player:scan event against AsyncAPI schema
 *
 * Layer 3 (Contract): Validates event structure, NOT business logic flow
 * Pattern: GM scanner receiving player scan events for Game Activity tracking
 *
 * IMPORTANT: player:scan broadcasts to gm room (GM scanners ARE the admin panels).
 * Must use gm socket to receive this event.
 * Player scans are now PERSISTED to session and include scanId + tokenData.
 */

const request = require('supertest');
const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { waitForEvent, createTrackedSocket } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');

describe('Player Scan Event - Contract Validation', () => {
  let testContext;
  let gmSocket;
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

    // Report VLC as healthy so video token scans succeed (canAcceptVideo checks registry)
    const registry = require('../../../src/services/serviceHealthRegistry');
    registry.report('vlc', 'healthy', 'Contract test default');

    // Create session (player scans require active session for persistence)
    await sessionService.createSession({
      name: 'Player Scan Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();

    // Connect GM socket (will receive player:scan events in gm room)
    // GM scanner uses handshake.auth with JWT token
    gmSocket = createTrackedSocket(testContext.socketUrl, {
      auth: {
        token: authToken,
        deviceId: 'TEST_GM_SCANNER',
        deviceType: 'gm',
        version: '1.0.0'
      }
    });

    // Wait for connection to establish
    await new Promise((resolve) => {
      if (gmSocket.connected) {
        resolve();
      } else {
        gmSocket.once('connect', resolve);
      }
    });
  });

  afterEach(async () => {
    if (gmSocket && gmSocket.connected) {
      gmSocket.disconnect();
    }
    await resetAllServices();
    const videoQueueService = require('../../../src/services/videoQueueService');
    videoQueueService.reset();  // Clean up video queue after test
  });

  describe('player:scan event', () => {
    it('should match AsyncAPI schema when player scans video token', async () => {
      // Setup: Listen for player:scan BEFORE triggering
      const eventPromise = waitForEvent(gmSocket, 'player:scan');

      // Trigger: Player scanner sends scan via HTTP POST /api/scan
      await request(testContext.url)
        .post('/api/scan')
        .send({
          tokenId: 'jaw001',  // Only video token in ALN-TokenData
          deviceId: 'PLAYER_8a7b9c1d',
          deviceType: 'player',
          timestamp: new Date().toISOString()
        })
        .expect(200);

      // Wait: For player:scan broadcast to gm room
      const event = await eventPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'player:scan');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Payload content (per AsyncAPI PlayerScan schema)
      expect(event.data).toHaveProperty('scanId');  // UUID of persisted record
      expect(event.data.scanId).toMatch(/^[0-9a-f-]{36}$/);
      expect(event.data).toHaveProperty('tokenId', 'jaw001');
      expect(event.data).toHaveProperty('deviceId', 'PLAYER_8a7b9c1d');
      expect(event.data).toHaveProperty('videoQueued', true);  // Video token queues video
      expect(event.data).toHaveProperty('memoryType', 'Personal');  // From tokens.json
      expect(event.data).toHaveProperty('timestamp');
      expect(event.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(event.data).toHaveProperty('tokenData');  // Token metadata
      expect(event.data.tokenData).toHaveProperty('SF_MemoryType', 'Personal');

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'player:scan');
    });

    it('should match AsyncAPI schema when player scans non-video token', async () => {
      // Setup: Listen for player:scan
      const eventPromise = waitForEvent(gmSocket, 'player:scan');

      // Trigger: Player scanner sends scan for image/audio token (no video)
      await request(testContext.url)
        .post('/api/scan')
        .send({
          tokenId: 'tac001',  // Non-video token (image + audio only)
          deviceId: 'PLAYER_test123',
          deviceType: 'player',
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
      expect(event.data).toHaveProperty('scanId');  // UUID of persisted record
      expect(event.data).toHaveProperty('tokenId', 'tac001');
      expect(event.data).toHaveProperty('deviceId', 'PLAYER_test123');
      expect(event.data).toHaveProperty('videoQueued', false);  // No video in token
      expect(event.data).toHaveProperty('memoryType', 'Business');  // From tokens.json
      expect(event.data).toHaveProperty('timestamp');
      expect(event.data).toHaveProperty('tokenData');  // Token metadata

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'player:scan');
    });

    // F-RT-01: the broadcast used to claim videoQueued:true whenever the token
    // HAD a video, even when the video was rejected (VLC down / video busy)
    // and the HTTP response was 409 with videoQueued:false. The broadcast must
    // report what actually happened.
    it('should broadcast videoQueued:false when video was rejected (VLC down)', async () => {
      const registry = require('../../../src/services/serviceHealthRegistry');
      registry.report('vlc', 'down', 'F-RT-01 test');

      const eventPromise = waitForEvent(gmSocket, 'player:scan');

      const response = await request(testContext.url)
        .post('/api/scan')
        .send({
          tokenId: 'jaw001',  // Video token
          deviceId: 'PLAYER_rt01',
          deviceType: 'player',
          timestamp: new Date().toISOString()
        })
        .expect(409);

      // Scan persists despite video rejection; response is honest
      expect(response.body.videoQueued).toBe(false);

      // Broadcast must be honest too (no phantom "video queued" in Game Activity)
      const event = await eventPromise;
      expect(event.data).toHaveProperty('tokenId', 'jaw001');
      expect(event.data).toHaveProperty('videoQueued', false);

      validateWebSocketEvent(event, 'player:scan');
    });

    it('should persist player scan to session', async () => {
      // Setup: Listen for player:scan
      const eventPromise = waitForEvent(gmSocket, 'player:scan');

      // Trigger: Player scan
      await request(testContext.url)
        .post('/api/scan')
        .send({
          tokenId: 'jaw001',
          deviceId: 'PLAYER_scanner_1',
          deviceType: 'player',
          timestamp: new Date().toISOString()
        })
        .expect(200);

      // Wait: For player:scan broadcast
      const event = await eventPromise;

      // Validate: scanId is returned
      expect(event.data).toHaveProperty('scanId');
      expect(event.data.scanId).toMatch(/^[0-9a-f-]{36}$/);

      // Validate: Scan was persisted to session
      const session = sessionService.getCurrentSession();
      expect(session.playerScans).toHaveLength(1);
      expect(session.playerScans[0].id).toBe(event.data.scanId);
      expect(session.playerScans[0].tokenId).toBe('jaw001');
      expect(session.playerScans[0].deviceId).toBe('PLAYER_scanner_1');

      // Validate: Against AsyncAPI contract
      validateWebSocketEvent(event, 'player:scan');
    });
  });
});
