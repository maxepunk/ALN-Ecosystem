/**
 * Contract Tests: State Routes (GET /api/state)
 * Validates state endpoint matches OpenAPI specification
 */

const request = require('supertest');
const app = require('../../../src/app');
const { initializeServices } = require('../../../src/app');
const { validateHTTPResponse } = require('../../helpers/contract-validator');
const tokenService = require('../../../src/services/tokenService');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const videoQueueService = require('../../../src/services/videoQueueService');

describe('GET /api/state', () => {
  let createdSession;

  beforeAll(async () => {
    // Initialize services ONCE for all tests
    await initializeServices();
  });

  beforeEach(async () => {
    // Full reset of all services
    await resetAllServices();
    videoQueueService.reset();

    // CRITICAL: Re-load tokens after reset
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // Create a test session for state tests
    createdSession = await sessionService.createSession({
      name: 'Test Session for State Validation'
    });
  });

  afterEach(async () => {
    // Clean up test session
    if (createdSession) {
      await sessionService.endSession();
    }
  });

  it('should match OpenAPI contract', async () => {
    const response = await request(app.app)
      .get('/api/state')
      .expect(200);

    validateHTTPResponse(response, '/api/state', 'get', 200);
  });

  it('should return required GameState fields', async () => {
    const response = await request(app.app)
      .get('/api/state')
      .expect(200);

    // Required fields per OpenAPI GameState schema
    expect(response.body).toHaveProperty('session');
    expect(response.body).toHaveProperty('scores');
    expect(response.body).toHaveProperty('recentTransactions');
    expect(response.body).toHaveProperty('videoStatus');
    expect(response.body).toHaveProperty('devices');  // Per OpenAPI contract
    expect(response.body).toHaveProperty('systemStatus');

    // Type validation
    expect(typeof response.body.session).toBe('object');
    expect(Array.isArray(response.body.scores)).toBe(true);
    expect(Array.isArray(response.body.recentTransactions)).toBe(true);
    expect(typeof response.body.videoStatus).toBe('object');
    expect(Array.isArray(response.body.devices)).toBe(true);
    expect(typeof response.body.systemStatus).toBe('object');
  });

  it('should support ETag caching with If-None-Match', async () => {
    // First request - get ETag
    const firstResponse = await request(app.app)
      .get('/api/state')
      .expect(200);

    expect(firstResponse.headers).toHaveProperty('etag');
    expect(firstResponse.headers).toHaveProperty('cache-control');
    expect(firstResponse.headers['cache-control']).toContain('no-cache');

    const etag = firstResponse.headers.etag;

    // Second request with matching ETag - should get 304
    const secondResponse = await request(app.app)
      .get('/api/state')
      .set('If-None-Match', etag)
      .expect(304);

    // 304 should have empty body
    expect(secondResponse.body).toEqual({});
  });

  it('should return fresh state when ETag does not match', async () => {
    const response = await request(app.app)
      .get('/api/state')
      .set('If-None-Match', '"invalid-etag"')
      .expect(200);

    // Should return full state
    expect(response.body).toHaveProperty('session');
    expect(response.body).toHaveProperty('scores');
  });

  it('should return state even when no session exists', async () => {
    // End session temporarily
    await sessionService.endSession();

    const response = await request(app.app)
      .get('/api/state')
      .expect(200);

    // Should still return valid GameState structure
    expect(response.body).toHaveProperty('session');
    expect(response.body).toHaveProperty('scores');
    expect(response.body).toHaveProperty('systemStatus');

    // Session should be null when no active session
    expect(response.body.session).toBe(null);

    // Recreate session for other tests
    createdSession = await sessionService.createSession({
      name: 'Test Session for State Validation'
    });
  });
});
