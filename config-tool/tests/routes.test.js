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
      baseValues: { 1: 10000, 2: 25000, 3: 50000, 4: 75000, 5: 150000 },
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
    const body = {
      version: '1.0',
      baseValues: { 1: 99999, 2: 25000, 3: 50000, 4: 75000, 5: 150000 },
      typeMultipliers: { Personal: 1, Mention: 3, Business: 3, Party: 5, Technical: 5, UNKNOWN: 0 },
    };
    const res = await request(app).put('/api/config/scoring').send(body).expect(200);
    assert.deepStrictEqual(res.body, { success: true });
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'scoring-config.json'), 'utf8'));
    assert.strictEqual(onDisk.baseValues['1'], 99999);
  });

  describe('schema validation on writers (F-TOOL-04)', () => {
    it('PUT /api/config/scoring rejects an empty object with 400 + details', async () => {
      const res = await request(app).put('/api/config/scoring').send({}).expect(400);
      assert.ok(Array.isArray(res.body.details) && res.body.details.length > 0);
      // file untouched
      const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'scoring-config.json'), 'utf8'));
      assert.strictEqual(onDisk.baseValues['1'], 10000);
    });

    it('PUT /api/config/scoring rejects non-numeric base values', async () => {
      const body = {
        baseValues: { 1: 'lots', 2: 25000, 3: 50000, 4: 75000, 5: 150000 },
        typeMultipliers: { Personal: 1 },
      };
      const res = await request(app).put('/api/config/scoring').send(body).expect(400);
      assert.ok(res.body.details.some(d => /baseValues/.test(d)));
    });

    it('PUT /api/config/scoring rejects missing rating keys', async () => {
      const body = { baseValues: { 1: 10000 }, typeMultipliers: { Personal: 1 } };
      await request(app).put('/api/config/scoring').send(body).expect(400);
    });

    it('PUT /api/config/cues rejects a cue without an id', async () => {
      const body = { cues: [{ label: 'No Id', quickFire: true, commands: [] }] };
      const res = await request(app).put('/api/config/cues').send(body).expect(400);
      assert.ok(res.body.details.some(d => /id/.test(d)));
    });

    it('PUT /api/config/cues rejects a cue with neither quickFire nor trigger', async () => {
      const body = { cues: [{ id: 'orphan', label: 'Orphan', commands: [] }] };
      const res = await request(app).put('/api/config/cues').send(body).expect(400);
      assert.ok(res.body.details.some(d => /orphan/.test(d)));
    });

    it('PUT /api/config/cues rejects duplicate cue ids', async () => {
      const cue = { id: 'dup', label: 'A', quickFire: true, commands: [] };
      await request(app).put('/api/config/cues').send({ cues: [cue, { ...cue }] }).expect(400);
    });

    it('PUT /api/config/cues rejects a non-array non-wrapper body', async () => {
      await request(app).put('/api/config/cues').send({ hello: 'world' }).expect(400);
    });

    it('PUT /api/config/cues accepts a plain array (backend-supported shape)', async () => {
      const body = [{ id: 'c1', label: 'C1', quickFire: true, commands: [] }];
      await request(app).put('/api/config/cues').send(body).expect(200);
    });

    it('PUT /api/config/cues accepts a standing cue with trigger', async () => {
      const body = { cues: [{ id: 's1', label: 'S1', trigger: { event: 'video:paused' }, commands: [] }] };
      await request(app).put('/api/config/cues').send(body).expect(200);
    });

    it('PUT /api/config/routing rejects routes as an array', async () => {
      await request(app).put('/api/config/routing').send({ routes: [], ducking: [] }).expect(400);
    });

    it('PUT /api/config/routing rejects missing ducking', async () => {
      await request(app).put('/api/config/routing').send({ routes: {} }).expect(400);
    });

    it('PUT /api/config/env rejects malformed keys', async () => {
      const res = await request(app).put('/api/config/env').send({ 'BAD KEY': 'x' }).expect(400);
      assert.ok(res.body.details.some(d => /BAD KEY/.test(d)));
    });

    it('PUT /api/config/env rejects values with newlines (injection)', async () => {
      const res = await request(app)
        .put('/api/config/env')
        .send({ HOST: '0.0.0.0\nADMIN_PASSWORD=hacked' })
        .expect(400);
      assert.ok(res.body.details.some(d => /HOST/.test(d)));
      const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
      assert.ok(!content.includes('hacked'));
    });

    it('PUT /api/config/env rejects object values', async () => {
      await request(app).put('/api/config/env').send({ PORT: { nested: true } }).expect(400);
    });
  });

  describe('preset validation (F-TOOL-11/12)', () => {
    it('POST /api/presets/import rejects structurally invalid sections', async () => {
      const bad = {
        name: 'Bad', env: { PORT: '3000' },
        scoringConfig: { baseValues: { 1: 1 }, typeMultipliers: {} },
        cues: 'hello',
        routing: { routes: {}, ducking: [] },
      };
      const res = await request(app)
        .post('/api/presets/import')
        .attach('file', Buffer.from(JSON.stringify(bad)), 'bad.json')
        .expect(400);
      assert.ok(res.body.error);
    });

    it('PUT /api/presets/:filename/load with an invalid preset writes NOTHING (400)', async () => {
      // hand-craft a preset with a broken cues section
      const preset = {
        name: 'Half Bad', created: 'now', description: '',
        env: { PORT: '7777' },
        scoringConfig: {
          baseValues: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
          typeMultipliers: { Personal: 1 },
        },
        cues: { cues: [{ label: 'no id' }] },
        routing: { routes: {}, ducking: [] },
      };
      fs.writeFileSync(path.join(tmpDir, 'presets', 'half-bad.json'), JSON.stringify(preset));
      await request(app).put('/api/presets/half-bad.json/load').expect(400);
      // env was listed FIRST in the preset but must not have been applied
      const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
      assert.ok(content.includes('PORT=3000'));
      assert.ok(!content.includes('PORT=7777'));
    });

    it('preset load succeeds even when an existing config file is corrupt (backup skipped)', async () => {
      // corrupt cues.json — the very scenario preset restore exists for
      fs.writeFileSync(path.join(tmpDir, 'cues.json'), '{"cues": [TRUNCATED');
      const preset = {
        name: 'Recovery', created: 'now', description: '',
        env: { PORT: '3000' },
        scoringConfig: {
          baseValues: { 1: 10000, 2: 25000, 3: 50000, 4: 75000, 5: 150000 },
          typeMultipliers: { Personal: 1 },
        },
        cues: { cues: [] },
        routing: { routes: {}, ducking: [] },
      };
      fs.writeFileSync(path.join(tmpDir, 'presets', 'recovery.json'), JSON.stringify(preset));
      await request(app).put('/api/presets/recovery.json/load').expect(200);
      const cues = JSON.parse(fs.readFileSync(path.join(tmpDir, 'cues.json'), 'utf8'));
      assert.deepStrictEqual(cues, { cues: [] });
    });
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
