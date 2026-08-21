/**
 * Contract Tests: Pack Channel (GET /api/pack/manifest, GET /api/pack/files/*)
 *
 * Validates the Phase 3 A2 pack endpoints against the OpenAPI spec, for
 * BOTH the production ALN pack and the toy pack (PACK_PATH injection) —
 * the latter is the A2 exit criterion: the whole backend serving a second
 * game pack with zero engine changes.
 *
 * No initializeServices(): the pack routes are init-free by design
 * (pre-activation reads fall through to live disk state — see packService).
 */

const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const app = require('../../../src/app');
const { validateHTTPResponse } = require('../../helpers/contract-validator');
const packService = require('../../../src/services/packService');

const TOY_PACK = path.resolve(__dirname, '../../e2e/fixtures/packs/toy-heist');

describe('Pack channel contract', () => {
  const originalPackPath = process.env.PACK_PATH;
  let emptyDir;

  beforeAll(() => {
    emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-nopack-'));
  });

  afterAll(() => {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    delete process.env.PACK_PATH;
    packService._resetForTesting();
  });

  afterEach(() => {
    if (originalPackPath === undefined) {
      delete process.env.PACK_PATH;
    } else {
      process.env.PACK_PATH = originalPackPath;
    }
    packService._resetForTesting();
  });

  describe('GET /api/pack/manifest', () => {
    it('serves the production ALN pack manifest per contract', async () => {
      const response = await request(app.app).get('/api/pack/manifest').expect(200);
      validateHTTPResponse(response, '/api/pack/manifest', 'get', 200);
      expect(response.body.packId).toBe('about-last-night');
      expect(response.body.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      const paths = response.body.files.map((f) => f.path);
      expect(paths).toContain('tokens.json');
      expect(paths).toContain('game.json');
    });

    it('A2 exit: serves the toy pack via PACK_PATH with zero engine changes', async () => {
      process.env.PACK_PATH = TOY_PACK;
      const response = await request(app.app).get('/api/pack/manifest').expect(200);
      validateHTTPResponse(response, '/api/pack/manifest', 'get', 200);
      expect(response.body.packId).toBe('midnight-heist');
    });

    it('404s per contract on a pre-pack directory (no manifest)', async () => {
      process.env.PACK_PATH = emptyDir;
      const response = await request(app.app).get('/api/pack/manifest').expect(404);
      validateHTTPResponse(response, '/api/pack/manifest', 'get', 404);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/pack/files/{filePath}', () => {
    it('serves an inventoried JSON file from the ALN pack', async () => {
      const response = await request(app.app).get('/api/pack/files/tokens.json').expect(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(Object.keys(response.body).length).toBeGreaterThan(0);
    });

    it('serves game.json (the rules artifact) from the ALN pack', async () => {
      const response = await request(app.app).get('/api/pack/files/game.json').expect(200);
      expect(response.body.id).toBe('about-last-night');
      expect(Array.isArray(response.body.modes)).toBe(true);
    });

    it('serves the toy pack tokens under PACK_PATH', async () => {
      process.env.PACK_PATH = TOY_PACK;
      const response = await request(app.app).get('/api/pack/files/tokens.json').expect(200);
      expect(response.body.vault01).toBeDefined();
    });

    it('404s per contract for non-inventoried files (whitelist semantics)', async () => {
      // pack-manifest.json is real on disk but NOT in its own inventory —
      // the whitelist, not existence, decides.
      const response = await request(app.app)
        .get('/api/pack/files/pack-manifest.json')
        .expect(404);
      validateHTTPResponse(response, '/api/pack/files/{filePath}', 'get', 404);
      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('404s on path traversal attempts', async () => {
      const encoded = await request(app.app)
        .get('/api/pack/files/..%2F..%2Fbackend%2Fpackage.json');
      expect(encoded.status).toBe(404);

      const plain = await request(app.app)
        .get('/api/pack/files/../backend/package.json');
      // Express normalizes plain ../ before routing; either the route
      // whitelist 404s it or normalization takes it off the route entirely.
      expect([404]).toContain(plain.status);
    });
  });
});
