/**
 * Contract Tests: Admin Routes (POST /api/admin/auth, GET /api/admin/logs)
 * Validates admin endpoints match OpenAPI specification
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

describe('POST /api/admin/auth', () => {
  // Initialize services ONCE for all tests
  beforeAll(async () => {
    await initializeServices();
  });

  beforeEach(async () => {
    // Full reset of all services
    await resetAllServices();
    videoQueueService.reset();

    // CRITICAL: Re-load tokens after reset
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);
  });

  it('should match OpenAPI contract for successful auth', async () => {
    const response = await request(app.app)
      .post('/api/admin/auth')
      .send({
        password: process.env.ADMIN_PASSWORD || 'admin123'
      })
      .expect(200);

    validateHTTPResponse(response, '/api/admin/auth', 'post', 200);
  });

  it('should return required fields on success', async () => {
    const response = await request(app.app)
      .post('/api/admin/auth')
      .send({
        password: process.env.ADMIN_PASSWORD || 'admin123'
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('expiresIn');
    expect(typeof response.body.token).toBe('string');
    expect(typeof response.body.expiresIn).toBe('number');
  });

  it('should match OpenAPI contract for auth failure', async () => {
    const response = await request(app.app)
      .post('/api/admin/auth')
      .send({
        password: 'wrong-password'
      })
      .expect(401);

    validateHTTPResponse(response, '/api/admin/auth', 'post', 401);
  });

  it('should match OpenAPI contract for validation error', async () => {
    const response = await request(app.app)
      .post('/api/admin/auth')
      .send({})
      .expect(400);

    validateHTTPResponse(response, '/api/admin/auth', 'post', 400);
  });
});

describe('GET /api/admin/logs', () => {
  let authToken;

  beforeAll(async () => {
    // Get admin token for authenticated requests
    const authResponse = await request(app.app)
      .post('/api/admin/auth')
      .send({
        password: process.env.ADMIN_PASSWORD || 'admin123'
      });

    authToken = authResponse.body.token;
  });

  it('should match OpenAPI contract', async () => {
    const response = await request(app.app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    validateHTTPResponse(response, '/api/admin/logs', 'get', 200);
  });

  it('should return logs with required structure', async () => {
    const response = await request(app.app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('logs');
    expect(response.body).toHaveProperty('count');
    expect(response.body).toHaveProperty('timestamp');
    expect(Array.isArray(response.body.logs)).toBe(true);
    expect(typeof response.body.count).toBe('number');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('should support query parameters (lines, level)', async () => {
    const response = await request(app.app)
      .get('/api/admin/logs')
      .query({ level: 'info', lines: 50 })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('logs');
    expect(response.body).toHaveProperty('count');
    expect(Array.isArray(response.body.logs)).toBe(true);
  });

  it('should require authentication', async () => {
    const response = await request(app.app)
      .get('/api/admin/logs')
      .expect(401);

    // Verify error response structure
    expect(response.body).toHaveProperty('error');
  });
});
