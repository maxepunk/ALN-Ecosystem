/**
 * Contract Tests: Resource Routes (GET /api/tokens, GET /health)
 * Validates resource endpoints match OpenAPI specification
 */

const request = require('supertest');
const app = require('../../../src/app');
const { initializeServices } = require('../../../src/app');
const { validateHTTPResponse } = require('../../helpers/contract-validator');
const tokenService = require('../../../src/services/tokenService');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const videoQueueService = require('../../../src/services/videoQueueService');

describe('GET /api/tokens', () => {
  // Initialize services ONCE for all tests (needed for /api/tokens endpoint)
  beforeAll(async () => {
    await initializeServices();
  });

  beforeEach(async () => {
    // Full reset of all services
    await sessionService.reset();
    await transactionService.reset();
    videoQueueService.reset();

    // CRITICAL: Re-load tokens after reset
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);
  });

  it('should match OpenAPI contract', async () => {
    const response = await request(app.app)
      .get('/api/tokens')
      .expect(200);

    validateHTTPResponse(response, '/api/tokens', 'get', 200);
  });

  it('should return tokens as object with required fields', async () => {
    const response = await request(app.app)
      .get('/api/tokens')
      .expect(200);

    expect(response.body).toHaveProperty('tokens');
    expect(response.body).toHaveProperty('count');
    expect(response.body).toHaveProperty('lastUpdate');
    expect(typeof response.body.tokens).toBe('object');
    expect(typeof response.body.count).toBe('number');
    expect(typeof response.body.lastUpdate).toBe('string');
  });
});

describe('GET /health', () => {
  it('should match OpenAPI contract', async () => {
    const response = await request(app.app)
      .get('/health')
      .expect(200);

    validateHTTPResponse(response, '/health', 'get', 200);
  });

  it('should return required health fields', async () => {
    const response = await request(app.app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body.status).toBe('online');
    expect(typeof response.body.version).toBe('string');
    expect(typeof response.body.uptime).toBe('number');
    expect(typeof response.body.timestamp).toBe('string');
  });
});
