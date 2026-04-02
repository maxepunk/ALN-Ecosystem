/**
 * Scan API Edge Cases — Integration Tests
 *
 * Tests scan behavior under non-happy-path conditions:
 * no session, validation boundaries, unknown tokens, batch edge cases.
 *
 * IMPORTANT: Player scan route (scanRoutes.js) does NOT check session status —
 * any existing session (setup/active/paused) allows player scans. This is by design:
 * player scanners are "intel gathering" devices. Ended sessions return 409 because
 * endSession() nulls the session object. Only GM transactions enforce session state
 * via transactionService.processScan().
 */

// CRITICAL: Load browser mocks FIRST before any scanner code
require('../helpers/browser-mocks');

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const videoQueueService = require('../../src/services/videoQueueService');
const offlineQueueService = require('../../src/services/offlineQueueService');
const TestTokens = require('../fixtures/test-tokens');

describe('Scan API Edge Cases', () => {
  let testContext;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      videoQueueService,
      offlineQueueService
    });

    // Re-initialize tokens after reset
    const testTokens = TestTokens.getAllAsArray();
    await transactionService.init(testTokens);
  });

  // Helper: POST to scan endpoint
  async function postScan(body) {
    const res = await fetch(`${testContext.url}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, body: data };
  }

  // Helper: POST to batch endpoint
  async function postBatch(body) {
    const res = await fetch(`${testContext.url}/api/scan/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, body: data };
  }

  // ─── No Session ─────────────────────────────────────────────────────

  describe('no session', () => {
    test('returns 409 SESSION_NOT_FOUND when no session exists', async () => {
      const res = await postScan({
        tokenId: 'rat001',
        deviceId: 'TEST_DEVICE',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('SESSION_NOT_FOUND');
    });
  });

  // ─── Session State (Player scanners accept all states) ──────────────

  describe('session state acceptance', () => {
    test('accepts scan during setup state (player = intel gathering)', async () => {
      await sessionService.createSession({ name: 'Test' });

      const res = await postScan({
        tokenId: 'rat001',
        deviceId: 'TEST_DEVICE',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(res.status).toBe(200);
    });

    test('accepts scan during active session (real production token)', async () => {
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();

      // Use real production token from ALN-TokenData (loaded by Task 9b)
      const res = await postScan({
        tokenId: 'ale001',
        deviceId: 'TEST_DEVICE',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(res.status).toBe(200);
    });

    test('accepts scan during paused session', async () => {
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
      await sessionService.updateSessionStatus('paused');

      const res = await postScan({
        tokenId: 'rat001',
        deviceId: 'TEST_DEVICE',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(res.status).toBe(200);
    });

    test('rejects scan after session ended (session nulled)', async () => {
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
      await sessionService.endSession();

      // endSession() nulls currentSession, so getCurrentSession() returns null
      // Route sees no session and returns 409 — same as "no session" case
      const res = await postScan({
        tokenId: 'rat001',
        deviceId: 'TEST_DEVICE',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('SESSION_NOT_FOUND');
    });
  });

  // ─── Request Validation (Joi) ───────────────────────────────────────

  describe('request validation', () => {
    beforeEach(async () => {
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
    });

    test('rejects empty body (400)', async () => {
      const res = await postScan({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    test('rejects missing tokenId (400)', async () => {
      const res = await postScan({
        deviceId: 'dev',
        deviceType: 'player'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    test('rejects missing deviceType (400)', async () => {
      const res = await postScan({
        tokenId: 'rat001',
        deviceId: 'dev'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid deviceType enum value (400)', async () => {
      const res = await postScan({
        tokenId: 'rat001',
        deviceId: 'dev',
        deviceType: 'gm'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    test('rejects missing deviceId (400)', async () => {
      const res = await postScan({
        tokenId: 'rat001',
        deviceType: 'player'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    test('returns 404 for unknown token', async () => {
      const res = await postScan({
        tokenId: 'nonexistent_token_xyz',
        deviceId: 'dev',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('TOKEN_NOT_FOUND');
    });

    test('accepts esp32 deviceType', async () => {
      const res = await postScan({
        tokenId: 'rat001',
        deviceId: 'esp32-001',
        deviceType: 'esp32',
        timestamp: new Date().toISOString()
      });
      expect(res.status).toBe(200);
    });

    test('accepts scan without optional timestamp', async () => {
      const res = await postScan({
        tokenId: 'rat001',
        deviceId: 'dev',
        deviceType: 'player'
      });
      expect(res.status).toBe(200);
    });

    test('accepts scan without optional teamId', async () => {
      const res = await postScan({
        tokenId: 'rat001',
        deviceId: 'dev',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      });
      expect(res.status).toBe(200);
    });
  });

  // ─── Batch Edge Cases ───────────────────────────────────────────────

  describe('batch edge cases', () => {
    beforeEach(async () => {
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
    });

    test('rejects missing batchId (400)', async () => {
      const res = await postBatch({
        transactions: [{ tokenId: 'rat001', deviceId: 'dev', deviceType: 'player' }]
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    test('rejects non-array transactions (400)', async () => {
      const res = await postBatch({
        batchId: 'batch_1',
        transactions: 'not-an-array'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    test('handles batch with mix of known and unknown tokens', async () => {
      const res = await postBatch({
        batchId: `batch_mixed_${Date.now()}`,
        transactions: [
          { tokenId: 'rat001', deviceId: 'dev', deviceType: 'player', timestamp: new Date().toISOString() },
          { tokenId: 'nonexistent_xyz', deviceId: 'dev', deviceType: 'player', timestamp: new Date().toISOString() }
        ]
      });

      // Batch returns 200 with per-transaction results
      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(2);

      // First result should be processed (known token)
      expect(res.body.results[0].status).toBe('processed');
      // Second result should be failed (unknown token)
      expect(res.body.results[1].status).toBe('failed');
    });

    test('handles duplicate batchId (idempotency)', async () => {
      const batchId = `idempotent_${Date.now()}`;
      const batch = {
        batchId,
        transactions: [
          { tokenId: 'rat001', deviceId: 'dev', deviceType: 'esp32', timestamp: new Date().toISOString() }
        ]
      };

      const res1 = await postBatch(batch);
      expect(res1.status).toBe(200);

      // Second request with same batchId returns cached result
      const res2 = await postBatch(batch);
      expect(res2.status).toBe(200);
      expect(res2.body.batchId).toBe(batchId);
      expect(res2.body.processedCount).toBe(res1.body.processedCount);
    });

    test('handles empty transactions array', async () => {
      const res = await postBatch({
        batchId: `batch_empty_${Date.now()}`,
        transactions: []
      });

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(0);
      expect(res.body.processedCount).toBe(0);
    });

    test('batch does not require active session (no session check)', async () => {
      // Reset to clear the session created by beforeEach
      await resetAllServicesForTesting(testContext.io, {
        sessionService,
        transactionService,
        videoQueueService,
        offlineQueueService
      });
      const testTokens = TestTokens.getAllAsArray();
      await transactionService.init(testTokens);

      // No session created — batch should still work (it only checks token initialization)
      const res = await postBatch({
        batchId: `batch_no_session_${Date.now()}`,
        transactions: [
          { tokenId: 'rat001', deviceId: 'dev', deviceType: 'player', timestamp: new Date().toISOString() }
        ]
      });

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
    });
  });

  // ─── Player Scan Repeated Scans ─────────────────────────────────────

  describe('player duplicate behavior', () => {
    beforeEach(async () => {
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
    });

    test('allows same player to scan same token multiple times', async () => {
      const scanData = {
        tokenId: 'rat001',
        deviceId: 'TEST_DEVICE',
        deviceType: 'player',
        timestamp: new Date().toISOString()
      };

      const res1 = await postScan(scanData);
      expect(res1.status).toBe(200);

      // Same device, same token — should still succeed (players re-view memories)
      const res2 = await postScan({
        ...scanData,
        timestamp: new Date().toISOString()
      });
      expect(res2.status).toBe(200);
    });
  });
});
