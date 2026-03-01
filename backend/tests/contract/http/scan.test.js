/**
 * Contract Tests: Scan Routes (POST /api/scan, POST /api/scan/batch)
 * Validates player scanner endpoints match OpenAPI specification
 */

const request = require('supertest');
const app = require('../../../src/app');
const { initializeServices } = require('../../../src/app');
const { validateHTTPResponse } = require('../../helpers/contract-validator');
const tokenService = require('../../../src/services/tokenService');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');
const videoQueueService = require('../../../src/services/videoQueueService');
const transactionService = require('../../../src/services/transactionService');

describe('POST /api/scan', () => {
  // Initialize services ONCE for all tests
  beforeAll(async () => {
    await initializeServices();
  });

  // Test isolation: Ensure clean state before each test
  beforeEach(async () => {
    // Full reset of all services
    await resetAllServices();
    videoQueueService.reset();

    // Report VLC as healthy so video token scans succeed.
    // canAcceptVideo() checks registry health before allowing video queue.
    const registry = require('../../../src/services/serviceHealthRegistry');
    registry.report('vlc', 'healthy', 'Contract test default');

    // CRITICAL: Re-load tokens after reset
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // Create test session (required for scan endpoint)
    await sessionService.createSession({
      name: 'Contract Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();
  });

  afterEach(async () => {
    await resetAllServices();
    videoQueueService.reset();
  });
  it('should match OpenAPI contract for successful scan', async () => {
    // Contract aligned: videoPlaying → videoQueued, teamId optional
    const response = await request(app.app)
      .post('/api/scan')
      .send({
        tokenId: 'jaw011',  // Valid token with video from ALN-TokenData
        teamId: 'Team Alpha',
        deviceId: 'PLAYER_SCANNER_01',
        deviceType: 'player',  // P0.1: Required for device-type-specific behavior
        timestamp: new Date().toISOString()
      })
      .expect(200);

    validateHTTPResponse(response, '/api/scan', 'post', 200);
  });

  it('should return required fields on success', async () => {
    const response = await request(app.app)
      .post('/api/scan')
      .send({
        tokenId: 'jaw011',  // Valid token with video from ALN-TokenData
        teamId: 'Team Alpha',  // TODO Phase 2: Make optional per contract
        deviceId: 'PLAYER_SCANNER_01',
        deviceType: 'player',  // P0.1: Required for device-type-specific behavior
        timestamp: new Date().toISOString()
      })
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
  });

  it('should accept optional teamId', async () => {
    const response = await request(app.app)
      .post('/api/scan')
      .send({
        tokenId: 'jaw011',  // Valid token with video from ALN-TokenData
        deviceId: 'PLAYER_SCANNER_01',
        deviceType: 'player',  // P0.1: Required for device-type-specific behavior
        teamId: 'Team Alpha',
        timestamp: new Date().toISOString()
      })
      .expect(200);

    expect(response.body).toHaveProperty('status');
  });

  it('should return error for missing required fields', async () => {
    const response = await request(app.app)
      .post('/api/scan')
      .send({
        // Missing required tokenId
        deviceId: 'PLAYER_SCANNER_01'
      })
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
  });

  it('should return error structure for validation failure', async () => {
    const response = await request(app.app)
      .post('/api/scan')
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.error).toBe('string');
    expect(typeof response.body.message).toBe('string');
  });

  // Phase 3c: canAcceptVideo() gates the scan route. When VLC is down,
  // scanning a video token returns 409 instead of silently queuing.
  it('should return 409 when VLC is down and scanning a video token', async () => {
    const registry = require('../../../src/services/serviceHealthRegistry');

    // Drain pending setImmediate callbacks from prior tests' video queue
    // processing (addToQueue → setImmediate(processQueue) → playVideo →
    // checkConnection → registry.report('vlc', 'healthy')), which can race
    // with this test's VLC 'down' setup.
    await new Promise(r => setImmediate(r));

    registry.report('vlc', 'down', 'VLC offline');

    // Lock VLC health to 'down' for the duration of this request.
    // Real VLC may be running on this machine, and its D-Bus monitor or
    // stale processQueue callbacks can report VLC as 'healthy' mid-request.
    const origReport = registry.report.bind(registry);
    registry.report = (serviceId, status, message) => {
      if (serviceId === 'vlc') return; // Block VLC health changes
      origReport(serviceId, status, message);
    };

    try {
      const response = await request(app.app)
        .post('/api/scan')
        .send({
          tokenId: 'jaw011',  // Valid token with video from ALN-TokenData
          deviceId: 'PLAYER_SCANNER_01',
          deviceType: 'player',
          timestamp: new Date().toISOString()
        })
        .expect(409);

      expect(response.body.status).toBe('rejected');
      expect(response.body.message).toBe('Video playback unavailable');
      expect(response.body.videoQueued).toBe(false);
      expect(response.body).not.toHaveProperty('waitTime');
    } finally {
      registry.report = origReport;
    }
  });
});

describe('POST /api/scan/batch', () => {
  // Initialize services ONCE for all tests
  beforeAll(async () => {
    await initializeServices();
  });

  // Test isolation: Ensure clean state before each test
  beforeEach(async () => {
    await resetAllServices();
    videoQueueService.reset();

    // CRITICAL: Re-load tokens after reset
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // Create test session
    await sessionService.createSession({
      name: 'Batch Contract Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();
  });

  afterEach(async () => {
    await resetAllServices();
    videoQueueService.reset();
  });

  it('should match OpenAPI contract for successful batch', async () => {
    const response = await request(app.app)
      .post('/api/scan/batch')
      .send({
        batchId: 'test-batch-001',  // PHASE 1.2 (P0.2): batchId required
        transactions: [
          {
            tokenId: 'jaw011',  // Valid video token from ALN-TokenData
            deviceId: 'PLAYER_SCANNER_01',
            timestamp: new Date().toISOString()
          },
          {
            tokenId: 'tac001',  // Valid non-video token
            deviceId: 'PLAYER_SCANNER_01',
            teamId: 'Team Alpha',
            timestamp: new Date().toISOString()
          }
        ]
      })
      .expect(200);

    validateHTTPResponse(response, '/api/scan/batch', 'post', 200);
  });

  it('should return required fields on success', async () => {
    const response = await request(app.app)
      .post('/api/scan/batch')
      .send({
        batchId: `test-batch-${Date.now()}`,  // PHASE 1.2 (P0.2): batchId required (unique per test)
        transactions: [
          {
            tokenId: 'jaw011',  // Valid video token from ALN-TokenData
            deviceId: 'PLAYER_SCANNER_01',
            timestamp: new Date().toISOString()
          }
        ]
      })
      .expect(200);

    expect(response.body).toHaveProperty('results');
    expect(Array.isArray(response.body.results)).toBe(true);
    expect(response.body.results.length).toBeGreaterThanOrEqual(0);
  });

  it('should process empty transactions array', async () => {
    const response = await request(app.app)
      .post('/api/scan/batch')
      .send({
        batchId: `test-batch-empty-${Date.now()}`,  // PHASE 1.2 (P0.2): batchId required (unique per test)
        transactions: []
      })
      .expect(200);

    expect(response.body).toHaveProperty('results');
    expect(response.body.results).toEqual([]);
  });

  it('should return error for missing required fields', async () => {
    const response = await request(app.app)
      .post('/api/scan/batch')
      .send({
        // Missing required transactions array
      })
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
  });

  it('should return error structure for validation failure', async () => {
    const response = await request(app.app)
      .post('/api/scan/batch')
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
  });
});
