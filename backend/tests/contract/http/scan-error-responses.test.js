/**
 * Scan Error Response Schema Validation (F-SCAN-12)
 *
 * Validates that /api/scan and /api/scan/batch ERROR responses conform to
 * the OpenAPI response schemas. Uses AJV compilation against the actual
 * openapi.yaml spec (validateHTTPResponse) — catches contract drift like
 * the undocumented 404, the two competing 409 shapes, and the stale 503
 * shape. Modeled on tests/contract/scanner/request-schema-validation.test.js
 * (request side).
 *
 * Real error paths exercised:
 * - 400 VALIDATION_ERROR  (Joi schema rejection)
 * - 404 TOKEN_NOT_FOUND   (unknown tokenId)
 * - 409 SESSION_NOT_FOUND (no current session — scan NOT persisted)
 * - 409 status:rejected   (video rejected: vlc_down has NO waitTime,
 *                          video_busy HAS waitTime — scan IS persisted)
 * - 503 SERVICE_UNAVAILABLE (tokens not loaded)
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

describe('Scan Error Response Schema Validation (F-SCAN-12)', () => {
  beforeAll(async () => {
    await initializeServices();
  });

  beforeEach(async () => {
    await resetAllServices();
    videoQueueService.reset();

    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    await sessionService.createSession({
      name: 'Error Contract Test Session',
      teams: ['Team Alpha']
    });
    await sessionService.startGame();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await resetAllServices();
    videoQueueService.reset();
  });

  describe('POST /api/scan error responses', () => {
    it('400 validation error matches OpenAPI schema', async () => {
      const response = await request(app.app)
        .post('/api/scan')
        .send({ deviceId: 'PLAYER_01' })  // missing tokenId + deviceType
        .expect(400);

      validateHTTPResponse(response, '/api/scan', 'post', 400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('404 TOKEN_NOT_FOUND matches OpenAPI schema', async () => {
      const response = await request(app.app)
        .post('/api/scan')
        .send({
          tokenId: 'NO_SUCH_TOKEN_XYZ',
          deviceId: 'PLAYER_01',
          deviceType: 'player',
          timestamp: new Date().toISOString()
        })
        .expect(404);

      validateHTTPResponse(response, '/api/scan', 'post', 404);
      expect(response.body.error).toBe('TOKEN_NOT_FOUND');
    });

    it('409 SESSION_NOT_FOUND (no session — scan NOT persisted) matches OpenAPI schema', async () => {
      await sessionService.endSession();

      const response = await request(app.app)
        .post('/api/scan')
        .send({
          tokenId: 'fli001',
          deviceId: 'PLAYER_01',
          deviceType: 'player',
          timestamp: new Date().toISOString()
        })
        .expect(409);

      validateHTTPResponse(response, '/api/scan', 'post', 409);
      expect(response.body.error).toBe('SESSION_NOT_FOUND');
    });

    it('409 video rejection (vlc_down, NO waitTime — scan persisted) matches OpenAPI schema', async () => {
      jest.spyOn(videoQueueService, 'canAcceptVideo').mockReturnValue({
        available: false,
        reason: 'vlc_down'
      });

      const response = await request(app.app)
        .post('/api/scan')
        .send({
          tokenId: 'rem001',  // video token
          deviceId: 'PLAYER_01',
          deviceType: 'player',
          timestamp: new Date().toISOString()
        })
        .expect(409);

      validateHTTPResponse(response, '/api/scan', 'post', 409);
      expect(response.body.status).toBe('rejected');
      expect(response.body.videoQueued).toBe(false);
      expect(response.body).not.toHaveProperty('waitTime');  // optional, vlc_down omits it

      // Scan persisted despite the video rejection
      expect(sessionService.getCurrentSession().playerScans).toHaveLength(1);
    });

    it('409 video rejection (video_busy, WITH waitTime) matches OpenAPI schema', async () => {
      jest.spyOn(videoQueueService, 'canAcceptVideo').mockReturnValue({
        available: false,
        reason: 'video_busy',
        waitTime: 42
      });

      const response = await request(app.app)
        .post('/api/scan')
        .send({
          tokenId: 'rem001',  // video token
          deviceId: 'PLAYER_01',
          deviceType: 'player',
          timestamp: new Date().toISOString()
        })
        .expect(409);

      validateHTTPResponse(response, '/api/scan', 'post', 409);
      expect(response.body.status).toBe('rejected');
      expect(response.body.waitTime).toBe(42);
    });

    it('503 SERVICE_UNAVAILABLE (tokens not loaded) matches OpenAPI schema', async () => {
      const savedTokens = transactionService.tokens;
      transactionService.tokens = new Map();

      try {
        const response = await request(app.app)
          .post('/api/scan')
          .send({
            tokenId: 'fli001',
            deviceId: 'PLAYER_01',
            deviceType: 'player',
            timestamp: new Date().toISOString()
          })
          .expect(503);

        validateHTTPResponse(response, '/api/scan', 'post', 503);
        expect(response.body.error).toBe('SERVICE_UNAVAILABLE');
      } finally {
        transactionService.tokens = savedTokens;
      }
    });
  });

  describe('POST /api/scan/batch error responses', () => {
    it('400 missing batchId matches OpenAPI schema', async () => {
      const response = await request(app.app)
        .post('/api/scan/batch')
        .send({ transactions: [] })
        .expect(400);

      validateHTTPResponse(response, '/api/scan/batch', 'post', 400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('400 non-array transactions matches OpenAPI schema', async () => {
      const response = await request(app.app)
        .post('/api/scan/batch')
        .send({ batchId: `b-${Date.now()}`, transactions: 'nope' })
        .expect(400);

      validateHTTPResponse(response, '/api/scan/batch', 'post', 400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('503 SERVICE_UNAVAILABLE (tokens not loaded) matches OpenAPI schema', async () => {
      const savedTokens = transactionService.tokens;
      transactionService.tokens = new Map();

      try {
        const response = await request(app.app)
          .post('/api/scan/batch')
          .send({
            batchId: `b-503-${Date.now()}`,
            transactions: [
              { tokenId: 'fli001', deviceId: 'PLAYER_01', deviceType: 'player' }
            ]
          })
          .expect(503);

        validateHTTPResponse(response, '/api/scan/batch', 'post', 503);
        expect(response.body.error).toBe('SERVICE_UNAVAILABLE');
      } finally {
        transactionService.tokens = savedTokens;
      }
    });

    it('200 with failed entries (unknown token) matches OpenAPI schema', async () => {
      const response = await request(app.app)
        .post('/api/scan/batch')
        .send({
          batchId: `b-failed-${Date.now()}`,
          transactions: [
            { tokenId: 'NO_SUCH_TOKEN_XYZ', deviceId: 'PLAYER_01', deviceType: 'player' }
          ]
        })
        .expect(200);

      validateHTTPResponse(response, '/api/scan/batch', 'post', 200);
      expect(response.body.failedCount).toBe(1);
      expect(response.body.results[0].status).toBe('failed');
    });
  });
});
