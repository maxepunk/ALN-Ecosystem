/**
 * Contract Tests: Session Routes (GET /api/session)
 * Validates session endpoint matches OpenAPI specification
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

describe('GET /api/session', () => {
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

    // Create a test session for GET tests
    createdSession = await sessionService.createSession({
      name: 'Test Session for Contract Validation'
    });
    await sessionService.startGame();
  });

  afterEach(async () => {
    // Clean up test session
    if (createdSession) {
      await sessionService.endSession();
    }
  });

  it('should match OpenAPI contract when session exists', async () => {
    const response = await request(app.app)
      .get('/api/session')
      .expect(200);

    validateHTTPResponse(response, '/api/session', 'get', 200);
  });

  it('should return required Session fields', async () => {
    const response = await request(app.app)
      .get('/api/session')
      .expect(200);

    // Required fields per OpenAPI schema
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('name');
    expect(response.body).toHaveProperty('startTime');
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('teams');
    expect(response.body).toHaveProperty('metadata');

    // Type validation
    expect(typeof response.body.id).toBe('string');
    expect(typeof response.body.name).toBe('string');
    expect(typeof response.body.startTime).toBe('string');
    expect(response.body.status).toMatch(/^(active|paused|ended)$/);
    expect(Array.isArray(response.body.teams)).toBe(true);
    expect(typeof response.body.metadata).toBe('object');
  });

  it('should return 404 when no active session', async () => {
    // End the session temporarily
    await sessionService.endSession();

    const response = await request(app.app)
      .get('/api/session')
      .expect(404);

    validateHTTPResponse(response, '/api/session', 'get', 404);

    // Recreate session for other tests
    createdSession = await sessionService.createSession({
      name: 'Test Session for Contract Validation'
    });
    await sessionService.startGame();
  });

  it('should return error structure on 404', async () => {
    // End the session temporarily
    await sessionService.endSession();

    const response = await request(app.app)
      .get('/api/session')
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');

    // Recreate session for other tests
    createdSession = await sessionService.createSession({
      name: 'Test Session for Contract Validation'
    });
    await sessionService.startGame();
  });
});
