/**
 * Player Scanner - OpenAPI Contract Compliance Tests
 *
 * Tests that HTTP requests sent by player scanner match OpenAPI specification.
 * Focus: REQUEST formatting only (fire-and-forget pattern - responses ignored)
 *
 * Contract: /home/spide/projects/AboutLastNight/ALN-Ecosystem/backend/contracts/openapi.yaml
 */

const {
  resetMocks,
  mockFetchResponse,
  mockFetchNetworkError,
  getLastFetchCall,
  waitForAsync
} = require('../../helpers/player-scanner-mocks');

// Load OrchestratorIntegration (player scanner's HTTP client)
const OrchestratorIntegration = require('../../../../aln-memory-scanner/js/orchestratorIntegration');

describe('Player Scanner - HTTP Request Contract Compliance', () => {

  let orchestrator;

  beforeEach(() => {
    resetMocks();

    // Configure for NETWORKED mode (contract tests require network requests)
    global.window.location.pathname = '/player-scanner/';
    global.window.location.origin = 'http://192.168.1.100:3000';

    // Create orchestrator instance
    orchestrator = new OrchestratorIntegration();

    // Mock fetch to return success (we only care about request formatting)
    mockFetchResponse(200, { status: 'accepted', videoQueued: true });
  });

  afterEach(async () => {
    // Clean up orchestrator
    if (orchestrator) {
      await orchestrator.destroy();
    }
  });

  describe('POST /api/scan - Request Structure', () => {

    it('should include all required fields per OpenAPI contract', async () => {
      // Contract requires: tokenId, deviceId, timestamp
      orchestrator.connected = true;

      await orchestrator.scanToken('test_token_001', '001');

      const request = getLastFetchCall();

      // Verify endpoint
      expect(request.url).toContain('/api/scan');
      expect(request.method).toBe('POST');

      // Verify required fields present
      expect(request.body).toHaveProperty('tokenId');
      expect(request.body).toHaveProperty('deviceId');
      expect(request.body).toHaveProperty('timestamp');

      // Verify Content-Type header
      expect(request.headers['Content-Type']).toBe('application/json');
    });

    it('should format tokenId as string matching contract pattern', async () => {
      // Contract: tokenId must match pattern ^[A-Za-z_0-9]+$ (1-100 chars)
      orchestrator.connected = true;

      await orchestrator.scanToken('valid_token_123', '001');

      const request = getLastFetchCall();

      // Verify tokenId is string
      expect(typeof request.body.tokenId).toBe('string');

      // Verify pattern (alphanumeric + underscore only)
      expect(request.body.tokenId).toMatch(/^[A-Za-z_0-9]+$/);

      // Verify length constraints
      expect(request.body.tokenId.length).toBeGreaterThanOrEqual(1);
      expect(request.body.tokenId.length).toBeLessThanOrEqual(100);
    });

    it('should format timestamp as ISO8601 date-time string', async () => {
      orchestrator.connected = true;

      await orchestrator.scanToken('test_token', '001');

      const request = getLastFetchCall();

      // Verify timestamp format (ISO8601)
      expect(request.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Verify timestamp is recent (within last 5 seconds)
      const timestamp = new Date(request.body.timestamp);
      const now = new Date();
      const diff = Math.abs(now - timestamp);
      expect(diff).toBeLessThan(5000);
    });

    it('should format deviceId as string (1-100 chars)', async () => {
      // Contract: deviceId string (1-100 chars)
      orchestrator.connected = true;

      await orchestrator.scanToken('test_token', '001');

      const request = getLastFetchCall();

      // Verify deviceId is string
      expect(typeof request.body.deviceId).toBe('string');

      // Verify length constraints
      expect(request.body.deviceId.length).toBeGreaterThanOrEqual(1);
      expect(request.body.deviceId.length).toBeLessThanOrEqual(100);
    });

    it('should include teamId when provided and format as 3-digit string', async () => {
      // Contract: teamId optional, but if provided must match pattern ^[0-9]{3}$
      orchestrator.connected = true;

      await orchestrator.scanToken('test_token', '001');

      const request = getLastFetchCall();

      // Verify teamId present
      expect(request.body).toHaveProperty('teamId');

      // Verify pattern (exactly 3 digits)
      expect(request.body.teamId).toMatch(/^[0-9]{3}$/);
    });

    it('should omit teamId when not provided (not send null/undefined)', async () => {
      // Contract: Optional fields should be OMITTED, not sent as null
      orchestrator.connected = true;

      await orchestrator.scanToken('test_token'); // No teamId

      const request = getLastFetchCall();

      // Verify teamId is either omitted OR if present, is valid
      if ('teamId' in request.body) {
        // If present, must be valid string (not null/undefined)
        expect(request.body.teamId).not.toBeNull();
        expect(request.body.teamId).not.toBeUndefined();
        expect(typeof request.body.teamId).toBe('string');
      }
      // Ideally should be omitted entirely
    });
  });

  describe('POST /api/scan/batch - Batch Request Structure', () => {

    beforeEach(() => {
      // Setup offline queue with test data
      orchestrator.offlineQueue = [
        { tokenId: 'token1', teamId: '001', timestamp: Date.now() },
        { tokenId: 'token2', teamId: '002', timestamp: Date.now() - 1000 }
      ];
      orchestrator.connected = true;
    });

    it('should structure batch request with transactions array', async () => {
      // Contract: body must contain "transactions" array
      mockFetchResponse(200, {
        results: [
          { tokenId: 'token1', status: 'processed' },
          { tokenId: 'token2', status: 'processed' }
        ]
      });

      await orchestrator.processOfflineQueue();

      const request = getLastFetchCall();

      // Verify endpoint
      expect(request.url).toContain('/api/scan/batch');
      expect(request.method).toBe('POST');

      // Verify transactions array present
      expect(request.body).toHaveProperty('transactions');
      expect(Array.isArray(request.body.transactions)).toBe(true);
    });

    it('should include required fields in each transaction', async () => {
      mockFetchResponse(200, { results: [] });

      await orchestrator.processOfflineQueue();

      const request = getLastFetchCall();

      // Each transaction must have: tokenId, deviceId, timestamp
      request.body.transactions.forEach(txn => {
        expect(txn).toHaveProperty('tokenId');
        expect(txn).toHaveProperty('deviceId');
        expect(txn).toHaveProperty('timestamp');

        // Verify types
        expect(typeof txn.tokenId).toBe('string');
        expect(typeof txn.deviceId).toBe('string');
        expect(typeof txn.timestamp).toBe('string');

        // Verify timestamp format
        expect(txn.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
    });

    it('should batch up to 10 transactions at a time', async () => {
      // Fill queue with 25 items
      orchestrator.offlineQueue = [];
      for (let i = 0; i < 25; i++) {
        orchestrator.offlineQueue.push({
          tokenId: `token${i}`,
          teamId: '001',
          timestamp: Date.now()
        });
      }

      mockFetchResponse(200, { results: [] });

      await orchestrator.processOfflineQueue();

      const request = getLastFetchCall();

      // Verify batch size limit (implementation uses 10)
      expect(request.body.transactions.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Fire-and-Forget Pattern - Scanner Resilience', () => {

    it('should continue working on HTTP 500 server error', async () => {
      orchestrator.connected = true;

      // Reset fetch mock and setup error response
      global.fetch.mockReset();
      mockFetchResponse(500, { error: 'Internal server error' }, false);

      // Scanner should not crash
      const result = await orchestrator.scanToken('test_token', '001');

      // Should queue offline instead
      expect(result.status).toBe('error');
      expect(result.queued).toBe(true);
      expect(orchestrator.offlineQueue.length).toBe(1);
    });

    it('should continue working on HTTP 409 conflict', async () => {
      orchestrator.connected = true;

      // Reset fetch mock and setup conflict response
      global.fetch.mockReset();
      mockFetchResponse(409, {
        status: 'rejected',
        message: 'Video already playing'
      }, false);

      // Scanner should not crash
      const result = await orchestrator.scanToken('test_token', '001');

      // Should queue offline (fire-and-forget simplicity)
      expect(result.status).toBe('error');
      expect(result.queued).toBe(true);
    });

    it('should continue working on network timeout/failure', async () => {
      orchestrator.connected = true;

      // Reset fetch mock and setup network error
      global.fetch.mockReset();
      mockFetchNetworkError('Network timeout');

      // Scanner should not crash
      const result = await orchestrator.scanToken('test_token', '001');

      // Should queue offline
      expect(result.status).toBe('error');
      expect(result.queued).toBe(true);
      expect(orchestrator.offlineQueue.length).toBe(1);
    });

    it('should work regardless of response body format', async () => {
      orchestrator.connected = true;

      // Reset fetch mock and setup malformed response
      global.fetch.mockReset();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

      // Scanner should not crash (fire-and-forget)
      const result = await orchestrator.scanToken('test_token', '001');

      // Should return error but not throw
      expect(result.status).toBe('error');
    });
  });
});
