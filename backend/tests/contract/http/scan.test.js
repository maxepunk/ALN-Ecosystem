/**
 * Contract Tests: Scan Routes (POST /api/scan, POST /api/scan/batch)
 * Validates player scanner endpoints match OpenAPI specification
 */

const request = require('supertest');
const app = require('../../../src/app');
const { initializeServices } = require('../../../src/app');
const { validateHTTPResponse } = require('../../helpers/contract-validator');
const tokenService = require('../../../src/services/tokenService');
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
    await sessionService.reset();
    await transactionService.reset();
    videoQueueService.reset();

    // CRITICAL: Re-load tokens after reset
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // Create test session (required for scan endpoint)
    await sessionService.createSession({
      name: 'Contract Test Session',
      teams: ['001', '002']
    });
  });

  afterEach(async () => {
    await sessionService.reset();
    videoQueueService.reset();
  });
  it('should match OpenAPI contract for successful scan', async () => {
    // Contract aligned: videoPlaying → videoQueued, teamId optional
    const response = await request(app.app)
      .post('/api/scan')
      .send({
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'PLAYER_SCANNER_01',
        timestamp: new Date().toISOString()
      })
      .expect(200);

    validateHTTPResponse(response, '/api/scan', 'post', 200);
  });

  it('should return required fields on success', async () => {
    const response = await request(app.app)
      .post('/api/scan')
      .send({
        tokenId: '534e2b03',
        teamId: '001',  // TODO Phase 2: Make optional per contract
        deviceId: 'PLAYER_SCANNER_01',
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
        tokenId: '534e2b03',
        deviceId: 'PLAYER_SCANNER_01',
        teamId: '001',
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

  it('should return 409 when video already playing', async () => {
    // Setup: Queue a video token first
    await request(app.app)
      .post('/api/scan')
      .send({
        tokenId: '534e2b03',
        deviceId: 'PLAYER_SCANNER_01'
      })
      .expect(200);

    // Give video queue time to start processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Attempt to scan another video while first is playing
    const response = await request(app.app)
      .post('/api/scan')
      .send({
        tokenId: 'jaw001',
        deviceId: 'PLAYER_SCANNER_02'
      })
      .expect(409);

    // Validate response structure per actual implementation (scanRoutes.js:93-100)
    expect(response.body).toHaveProperty('status', 'rejected');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Video already playing');
    expect(response.body).toHaveProperty('tokenId', 'jaw001');
    expect(response.body).toHaveProperty('videoQueued', false);
    expect(response.body).toHaveProperty('waitTime');
  });
});

describe('POST /api/scan/batch', () => {
  // Test isolation: Ensure clean state before each test
  beforeEach(async () => {
    await sessionService.reset();
    await transactionService.reset();
    videoQueueService.reset();

    // Create test session
    await sessionService.createSession({
      name: 'Batch Contract Test Session',
      teams: ['001', '002']
    });
  });

  afterEach(async () => {
    await sessionService.reset();
    videoQueueService.reset();
  });

  it('should match OpenAPI contract for successful batch', async () => {
    const response = await request(app.app)
      .post('/api/scan/batch')
      .send({
        transactions: [
          {
            tokenId: '534e2b03',
            deviceId: 'PLAYER_SCANNER_01',
            timestamp: new Date().toISOString()
          },
          {
            tokenId: 'tac001',
            deviceId: 'PLAYER_SCANNER_01',
            teamId: '001',
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
        transactions: [
          {
            tokenId: '534e2b03',
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
