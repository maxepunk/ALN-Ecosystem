/**
 * Contract Tests: Resource Routes (GET /api/tokens, GET /health)
 * Validates resource endpoints match OpenAPI specification
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

describe('GET /api/tokens', () => {
  // Initialize services ONCE for all tests (needed for /api/tokens endpoint)
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

describe('GET /api/assets/manifest', () => {
  it('should match OpenAPI contract when manifest exists', async () => {
    const response = await request(app.app).get('/api/assets/manifest');
    // Manifest is committed to the repo for tests; always present.
    expect(response.status).toBe(200);
    validateHTTPResponse(response, '/api/assets/manifest', 'get', 200);
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('images');
    expect(response.body).toHaveProperty('audio');
  });

  it('each image entry carries sha1 and size', async () => {
    const response = await request(app.app).get('/api/assets/manifest').expect(200);
    const entries = Object.values(response.body.images);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries.slice(0, 5)) {
      expect(entry.sha1).toMatch(/^[0-9a-f]{40}$/);
      expect(typeof entry.size).toBe('number');
    }
  });
});

describe('GET /api/assets/images/:file', () => {
  it('returns 200 with image/bmp for a known token', async () => {
    // Pick a tokenId that actually exists in the manifest.
    const manifest = (await request(app.app).get('/api/assets/manifest')).body;
    const tokenId = Object.keys(manifest.images)[0];
    const response = await request(app.app).get(`/api/assets/images/${tokenId}.bmp`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/image\/bmp/);
    expect(response.headers['etag']).toBeDefined();
    expect(response.body.length).toBe(manifest.images[tokenId].size);
  });

  it('returns 304 on If-None-Match match', async () => {
    const manifest = (await request(app.app).get('/api/assets/manifest')).body;
    const tokenId = Object.keys(manifest.images)[0];
    const first = await request(app.app).get(`/api/assets/images/${tokenId}.bmp`);
    const etag = first.headers['etag'];
    const second = await request(app.app)
      .get(`/api/assets/images/${tokenId}.bmp`)
      .set('If-None-Match', etag);
    expect(second.status).toBe(304);
  });

  it('rejects path traversal with 400', async () => {
    const response = await request(app.app).get('/api/assets/images/..%2F..%2Fetc%2Fpasswd.bmp');
    // Express decodes %2F; regex rejects anything outside [a-z0-9_]+.
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_TOKEN_ID');
  });

  it('returns 400 on uppercase/invalid characters', async () => {
    const response = await request(app.app).get('/api/assets/images/KAA-001.bmp');
    expect(response.status).toBe(400);
  });

  it('returns 404 for unknown token', async () => {
    const response = await request(app.app).get('/api/assets/images/zzz_nonexistent_999.bmp');
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NOT_FOUND');
  });
});

describe('GET /api/assets/audio/:file', () => {
  it('returns 200 with correct content-type for wav', async () => {
    const manifest = (await request(app.app).get('/api/assets/manifest')).body;
    const wavId = Object.entries(manifest.audio).find(([, m]) => m.ext === 'wav')?.[0];
    if (!wavId) return; // Skip if no wav assets committed
    const response = await request(app.app).get(`/api/assets/audio/${wavId}.wav`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/audio\/wav/);
  });

  it('rejects invalid extension with 400', async () => {
    const response = await request(app.app).get('/api/assets/audio/kaa001.ogg');
    expect(response.status).toBe(400);
  });

  it('rejects path traversal with 400', async () => {
    const response = await request(app.app).get('/api/assets/audio/..%2Fetc%2Fpasswd.wav');
    expect(response.status).toBe(400);
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
