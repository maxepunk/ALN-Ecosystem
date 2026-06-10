/**
 * HTTP-layer tests for lib/routes.js (Phase 0 guardrail harness).
 *
 * These tests pin CURRENT behavior — they are characterization tests, not a
 * spec. Known quirks are pinned deliberately (marked "documented-bug pin")
 * so that later fixes flip the assertions on purpose, not by accident.
 *
 * Isolation: ConfigManager paths are constructor-injected to a temp dir
 * (same pattern as configManager.test.js) — no real backend config touched.
 */
'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');
const request = require('supertest');

const { ConfigManager } = require('../lib/configManager');
const { createRouter } = require('../lib/routes');

describe('routes (HTTP layer)', () => {
  let tmpDir;
  let app;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-routes-test-'));

    fs.writeFileSync(path.join(tmpDir, '.env'), 'PORT=3000\nHOST=0.0.0.0\n');
    fs.writeFileSync(path.join(tmpDir, 'scoring-config.json'), JSON.stringify({
      version: '1.0',
      baseValues: { 1: 10000, 2: 25000 },
      typeMultipliers: { Personal: 1, Mention: 3, Business: 3, Party: 5, Technical: 5, UNKNOWN: 0 },
    }));
    fs.writeFileSync(path.join(tmpDir, 'cues.json'), JSON.stringify({ cues: [] }));
    fs.writeFileSync(path.join(tmpDir, 'routing.json'), JSON.stringify({
      routes: { video: { sink: 'hdmi', fallback: 'hdmi' } },
      ducking: [],
    }));
    fs.writeFileSync(path.join(tmpDir, 'tokens.json'), JSON.stringify({
      tok001: { SF_RFID: 'tok001', SF_ValueRating: 3, SF_MemoryType: 'Personal' },
    }));
    fs.mkdirSync(path.join(tmpDir, 'sounds'));
    fs.mkdirSync(path.join(tmpDir, 'videos'));
    fs.mkdirSync(path.join(tmpDir, 'presets'));

    const configManager = new ConfigManager({
      envPath: path.join(tmpDir, '.env'),
      scoringPath: path.join(tmpDir, 'scoring-config.json'),
      cuesPath: path.join(tmpDir, 'cues.json'),
      routingPath: path.join(tmpDir, 'routing.json'),
      tokensPath: path.join(tmpDir, 'tokens.json'),
      soundsDir: path.join(tmpDir, 'sounds'),
      videosDir: path.join(tmpDir, 'videos'),
      presetsDir: path.join(tmpDir, 'presets'),
    });

    // Mirror server.js wiring (json body parsing + /api mount)
    app = express();
    app.use(express.json());
    app.use('/api', createRouter(configManager));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /api/config returns env, scoring, cues, and routing', async () => {
    const res = await request(app).get('/api/config').expect(200);
    assert.deepStrictEqual(
      Object.keys(res.body).sort(),
      ['cues', 'env', 'routing', 'scoring']
    );
    assert.strictEqual(res.body.env.PORT, '3000');
    assert.strictEqual(res.body.scoring.baseValues['1'], 10000);
    assert.deepStrictEqual(res.body.cues, { cues: [] });
  });

  it('PUT /api/config/scoring with valid body writes the scoring file', async () => {
    const body = { version: '1.0', baseValues: { 1: 99999 }, typeMultipliers: {} };
    const res = await request(app).put('/api/config/scoring').send(body).expect(200);
    assert.deepStrictEqual(res.body, { success: true });
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'scoring-config.json'), 'utf8'));
    assert.strictEqual(onDisk.baseValues['1'], 99999);
  });

  it('GET /api/presets returns an array; POST creates a preset', async () => {
    const empty = await request(app).get('/api/presets').expect(200);
    assert.ok(Array.isArray(empty.body));
    assert.strictEqual(empty.body.length, 0);

    const created = await request(app)
      .post('/api/presets')
      .send({ name: 'Test Venue', description: 'desc' })
      .expect(200);
    assert.deepStrictEqual(created.body, { success: true, filename: 'test-venue.json' });

    const list = await request(app).get('/api/presets').expect(200);
    assert.strictEqual(list.body.length, 1);
    assert.strictEqual(list.body[0].name, 'Test Venue');
  });

  it('POST /api/presets without a name returns 400', async () => {
    const res = await request(app).post('/api/presets').send({ description: 'no name' }).expect(400);
    assert.deepStrictEqual(res.body, { error: 'name is required' });
  });

  it('GET /api/tokens returns token data (read-only)', async () => {
    const res = await request(app).get('/api/tokens').expect(200);
    assert.strictEqual(res.body.tok001.SF_ValueRating, 3);
  });

  it('DELETE /api/assets/:type rejects unknown asset types with 400', async () => {
    const res = await request(app).delete('/api/assets/images/foo.bmp').expect(400);
    assert.deepStrictEqual(res.body, { error: 'type must be "sounds" or "videos"' });
  });

  it('PUT /api/presets/:filename/load for a missing preset returns 500 (documented-bug pin)', async () => {
    // Documented-bug pin (F-TOOL cluster): a nonexistent preset surfaces as a
    // raw 500 with the fs error message, not a 404. When the routes layer
    // gains proper not-found handling, flip this assertion deliberately.
    const res = await request(app).put('/api/presets/does-not-exist.json/load').expect(500);
    assert.match(res.body.error, /ENOENT/);
  });

  it('PUT /api/config/env writes values and preserves existing keys', async () => {
    await request(app).put('/api/config/env').send({ PORT: '4000', NEW_KEY: 'v' }).expect(200);
    const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
    assert.ok(content.includes('PORT=4000'));
    assert.ok(content.includes('HOST=0.0.0.0'));
    assert.ok(content.includes('NEW_KEY=v'));
  });
});
