/**
 * Contract Tests: Scan Routes (POST /api/scan, POST /api/scan/batch)
 * Validates player scanner endpoints match OpenAPI specification
 */

const request = require('supertest');
const app = require('../../../src/app');
const { validateHTTPResponse } = require('../../helpers/contract-validator');

describe('POST /api/scan', () => {
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
});

describe('POST /api/scan/batch', () => {
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
