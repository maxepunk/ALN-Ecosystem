/**
 * Device-Type Specific Duplicate Detection - Integration Tests
 *
 * PURPOSE: Validate device-type-specific duplicate behavior in REAL integration scenarios
 *
 * CRITICAL BUSINESS RULES:
 * - GM Scanners: REJECT duplicate scans (per-device, per-session)
 * - Player Scanners: ALLOW duplicate scans (content re-viewing)
 * - ESP32 Scanners: ALLOW duplicate scans (content re-viewing)
 *
 * INTEGRATION LEVEL: Tests with real WebSocket connections + HTTP requests
 *
 * Reference: P0.1 Duplicate Detection Behavior
 * @see backend/tests/unit/services/transactionService-deviceType.test.js (unit-level tests)
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { resetAllServices, resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const stateService = require('../../src/services/stateService');
const videoQueueService = require('../../src/services/videoQueueService');
const offlineQueueService = require('../../src/services/offlineQueueService');
const TestTokens = require('../fixtures/test-tokens');
const axios = require('axios');

describe('Device-Type Specific Duplicate Detection - Integration', () => {
  let testContext, gmSocket;
  let httpClient;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();

    // Configure HTTP client for Player/ESP32 scanner simulation
    httpClient = axios.create({
      baseURL: testContext.url,  // FIX: Use testContext.url (not httpUrl)
      timeout: 5000,
      validateStatus: () => true  // Don't throw on non-2xx responses
    });
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Complete reset cycle
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      stateService,
      videoQueueService,
      offlineQueueService
    });

    // Initialize with test tokens
    const testTokens = TestTokens.getAllAsArray();
    await transactionService.init(testTokens);

    // Create test session
    await sessionService.createSession({
      name: 'Device Type Test Session',
      teams: ['001', '002']
    });

    // Connect GM scanner via WebSocket
    gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DEVICE_TYPE_TEST');
  });

  afterEach(async () => {
    if (gmSocket?.connected) gmSocket.disconnect();
  });

  // ====================================================================
  // CRITICAL TEST #1: Player Scanner Allows Duplicates (HTTP Integration)
  // ====================================================================

  describe('Player Scanner Duplicate Behavior', () => {
    it('should ALLOW Player Scanner to scan same token multiple times', async () => {
      const scanRequest = {
        tokenId: 'rat001',
        teamId: '001',
        deviceId: 'PLAYER_INTEGRATION_TEST',
          deviceType: 'player',
        timestamp: new Date().toISOString()
      };

      // Scan 1: First scan
      const response1 = await httpClient.post('/api/scan', scanRequest);

      expect(response1.status).toBe(200);
      expect(response1.data.status).toBe('accepted');
      expect(response1.data.tokenId).toBe('rat001');

      // Scan 2: Same token, same device (should be ALLOWED for player)
      const response2 = await httpClient.post('/api/scan', {
        ...scanRequest,
        timestamp: new Date().toISOString()  // New timestamp
      });

      // CRITICAL: Player Scanner MUST allow duplicates (all scans accepted)
      expect(response2.status).toBe(200);
      expect(response2.data.status).toBe('accepted');
      expect(response2.data.tokenId).toBe('rat001');

      // Scan 3: Third time (verify still allowed)
      const response3 = await httpClient.post('/api/scan', {
        ...scanRequest,
        timestamp: new Date().toISOString()
      });

      expect(response3.status).toBe(200);
      expect(response3.data.status).toBe('accepted');
      expect(response3.data.tokenId).toBe('rat001');

      // Verify all 3 scans were accepted (proves duplicates allowed)
    });
  });

  // ====================================================================
  // CRITICAL TEST #2: ESP32 Scanner Allows Duplicates (HTTP Integration)
  // ====================================================================

  describe('ESP32 Scanner Duplicate Behavior', () => {
    it('should ALLOW ESP32 Scanner to scan same token multiple times', async () => {
      const scanRequest = {
        tokenId: 'rat001',
        teamId: '001',
        deviceId: 'ESP32_INTEGRATION_TEST',
          deviceType: 'esp32',
        timestamp: new Date().toISOString()
      };

      // Scan 1: First scan
      const response1 = await httpClient.post('/api/scan', scanRequest);

      expect(response1.status).toBe(200);
      expect(response1.data.status).toBe('accepted');
      expect(response1.data.tokenId).toBe('rat001');

      // Scan 2: Same token, same device (should be ALLOWED for esp32)
      const response2 = await httpClient.post('/api/scan', {
        ...scanRequest,
        timestamp: new Date().toISOString()
      });

      // CRITICAL: ESP32 Scanner MUST allow duplicates (all scans accepted)
      expect(response2.status).toBe(200);
      expect(response2.data.status).toBe('accepted');
      expect(response2.data.tokenId).toBe('rat001');
    });

    it('should allow ESP32 batch upload with duplicate tokens', async () => {
      const batchRequest = {
        batchId: `batch-${Date.now()}`,
        transactions: [
          {
            tokenId: 'rat001',
            teamId: '001',
            deviceId: 'ESP32_BATCH_TEST',
            deviceType: 'esp32',
            timestamp: new Date().toISOString()
          },
          {
            tokenId: 'rat001',  // DUPLICATE token in batch
            teamId: '001',
            deviceId: 'ESP32_BATCH_TEST',
            deviceType: 'esp32',
            timestamp: new Date().toISOString()
          }
        ]
      };

      const response = await httpClient.post('/api/scan/batch', batchRequest);

      expect(response.status).toBe(200);
      expect(response.data.processedCount).toBe(2);  // Both should be accepted
      expect(response.data.failedCount).toBe(0);
    });
  });

  // ====================================================================
  // CRITICAL TEST #3: Mixed Device Type Session
  // ====================================================================

  describe('Mixed Device Type Session', () => {
    it('should handle all 3 device types in same session with correct duplicate behavior', async () => {
      const TOKEN_ID = 'rat001';

      // Step 1: GM Scanner scans token A → accepted
      const gmScanPromise = waitForEvent(gmSocket, 'transaction:result');
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: TOKEN_ID,
          teamId: '001',
          deviceId: 'GM_MIXED_TEST',
          deviceType: 'gm',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const gmResult1 = await gmScanPromise;
      expect(gmResult1.data.status).toBe('accepted');
      expect(gmResult1.data.points).toBeGreaterThan(0);

      // Step 2: Player Scanner scans token A → ALLOWED (not rejected)
      const playerResponse = await httpClient.post('/api/scan', {
        tokenId: TOKEN_ID,
        teamId: '002',
        deviceId: 'PLAYER_MIXED_TEST',
          deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(playerResponse.status).toBe(200);
      expect(playerResponse.data.status).toBe('accepted');  // ALLOWED

      // Step 3: ESP32 Scanner scans token A → ALLOWED (not rejected)
      const esp32Response = await httpClient.post('/api/scan', {
        tokenId: TOKEN_ID,
        teamId: '002',
        deviceId: 'ESP32_MIXED_TEST',
          deviceType: 'esp32',
        timestamp: new Date().toISOString()
      });

      expect(esp32Response.status).toBe(200);
      expect(esp32Response.data.status).toBe('accepted');  // ALLOWED

      // Step 4: GM Scanner scans token A again → REJECTED (duplicate)
      const gmScan2Promise = waitForEvent(gmSocket, 'transaction:result');
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: TOKEN_ID,
          teamId: '001',
          deviceId: 'GM_MIXED_TEST',
          deviceType: 'gm',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const gmResult2 = await gmScan2Promise;
      expect(gmResult2.data.status).toBe('duplicate');  // Status is 'duplicate' not 'rejected'
      expect(gmResult2.data.points).toBe(0);
    });

    it('should allow Player and ESP32 to re-scan tokens claimed by GM', async () => {
      const TOKEN_ID = 'hos001';

      // GM Scanner claims token
      const gmScanPromise = waitForEvent(gmSocket, 'transaction:result');
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: TOKEN_ID,
          teamId: '001',
          deviceId: 'GM_CLAIM_TEST',
          deviceType: 'gm',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      await gmScanPromise;

      // Player Scanner scans same token (different team) → ALLOWED
      const playerResponse = await httpClient.post('/api/scan', {
        tokenId: TOKEN_ID,
        teamId: '002',
        deviceId: 'PLAYER_CLAIM_TEST',
          deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(playerResponse.status).toBe(200);
      expect(playerResponse.data.status).toBe('accepted');

      // Player Scanner scans AGAIN → STILL ALLOWED
      const playerResponse2 = await httpClient.post('/api/scan', {
        tokenId: TOKEN_ID,
        teamId: '002',
        deviceId: 'PLAYER_CLAIM_TEST',
          deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(playerResponse2.status).toBe(200);
      expect(playerResponse2.data.status).toBe('accepted');
    });
  });

  // ====================================================================
  // CRITICAL TEST #4: Offline Queue Replay with Device Types
  // ====================================================================

  describe('Offline Queue Replay with Mixed Device Types', () => {
    it('should apply device-type-specific duplicate detection during queue replay', async () => {
      const TOKEN_ID = 'rat001';

      // Queue offline scans from all 3 device types
      offlineQueueService.enqueue({
        tokenId: TOKEN_ID,
        deviceId: 'PLAYER_OFFLINE_1',
          deviceType: 'player',
        teamId: '001',
        timestamp: new Date().toISOString()
      });

      offlineQueueService.enqueue({
        tokenId: TOKEN_ID,  // DUPLICATE for player (should be allowed)
        deviceId: 'PLAYER_OFFLINE_1',
          deviceType: 'player',
        teamId: '001',
        timestamp: new Date().toISOString()
      });

      offlineQueueService.enqueueGmTransaction({
        tokenId: TOKEN_ID,
        deviceId: 'GM_OFFLINE_1',
          deviceType: 'gm',
        teamId: '002',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      });

      offlineQueueService.enqueueGmTransaction({
        tokenId: TOKEN_ID,  // DUPLICATE for GM (should be rejected)
        deviceId: 'GM_OFFLINE_1',
          deviceType: 'gm',
        teamId: '002',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      });

      // Process queue
      const queueProcessedPromise = waitForEvent(gmSocket, 'offline:queue:processed');
      await offlineQueueService.processQueue();
      const queueEvent = await queueProcessedPromise;

      // Verify results
      const results = queueEvent.data.results;
      expect(results.length).toBe(4); // 2 player + 2 GM

      // All results should be processed (status: 'processed')
      expect(results.every(r => r.status === 'processed')).toBe(true);

      // Find GM results (they have transactionStatus field)
      const gmResults = results.filter(r => r.transactionStatus);
      expect(gmResults.length).toBe(2);

      // First GM scan should be accepted
      expect(gmResults[0].transactionStatus).toBe('accepted');
      expect(gmResults[0].points).toBeGreaterThan(0);

      // Second GM scan should be duplicate (same token, same device)
      expect(gmResults[1].transactionStatus).toBe('duplicate');
      expect(gmResults[1].points).toBe(0);

      // Player scans should all be processed (no transactionStatus field for player scans)
      const playerResults = results.filter(r => !r.transactionStatus);
      expect(playerResults.length).toBe(2);
      expect(playerResults.every(r => r.tokenId === TOKEN_ID)).toBe(true);
    });
  });

  // ====================================================================
  // VALIDATION TEST: Missing deviceType
  // ====================================================================

  describe('deviceType Validation', () => {
    it('should reject scans without deviceType field', async () => {
      const response = await httpClient.post('/api/scan', {
        tokenId: 'rat001',
        teamId: '001',
        deviceId: 'NO_TYPE_DEVICE',
        // deviceType missing!
        timestamp: new Date().toISOString()
      });

      expect(response.status).toBe(400);
      expect(response.data.message).toMatch(/deviceType/i);
    });

    it('should reject scans with invalid deviceType', async () => {
      const response = await httpClient.post('/api/scan', {
        tokenId: 'rat001',
        teamId: '001',
        deviceId: 'INVALID_TYPE_DEVICE',
          deviceType: 'invalid',  // Not 'gm', 'player', or 'esp32'
        timestamp: new Date().toISOString()
      });

      expect(response.status).toBe(400);
      expect(response.data.message).toMatch(/deviceType/i);
    });
  });
});
