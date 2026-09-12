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

    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      'PORT=3000\nHOST=0.0.0.0\nADMIN_PASSWORD=super-secret\nJWT_SECRET=jwt-secret-value\nHOME_ASSISTANT_TOKEN=ha-token-value\nEMPTY_TOKEN=\nNOTION_API_KEY=notion-key-value\nMPD_PASS=mpd-pass-value\nSSL_KEY_PATH=/etc/ssl/server.key\n'
    );
    fs.writeFileSync(path.join(tmpDir, 'game.json'), JSON.stringify({
      kind: 'game', schemaVersion: 2, id: 'test-pack',
      scoring: {
        baseValues: { 1: 10000, 2: 25000, 3: 50000, 4: 75000, 5: 150000 },
        typeMultipliers: { Personal: 1, Mention: 3, Business: 3, Party: 5, Technical: 5, UNKNOWN: 0 },
      },
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
      gamePath: path.join(tmpDir, 'game.json'),
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
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'game.json'), 'utf8'));
    assert.strictEqual(onDisk.scoring.baseValues['1'], 99999);
  });

  describe('schema validation on writers (F-TOOL-04)', () => {
    it('PUT /api/config/scoring rejects an empty object with 400 + details', async () => {
      const res = await request(app).put('/api/config/scoring').send({}).expect(400);
      assert.ok(Array.isArray(res.body.details) && res.body.details.length > 0);
      // file untouched
      const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'game.json'), 'utf8'));
      assert.strictEqual(onDisk.scoring.baseValues['1'], 10000);
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

  describe('secret masking in GET /api/config (F-TOOL-02 / E7)', () => {
    const { MASK_SENTINEL } = require('../lib/secrets');

    it('masks *_PASSWORD/*_TOKEN/*_SECRET values; leaves the rest readable', async () => {
      const res = await request(app).get('/api/config').expect(200);
      assert.strictEqual(res.body.env.ADMIN_PASSWORD, MASK_SENTINEL);
      assert.strictEqual(res.body.env.JWT_SECRET, MASK_SENTINEL);
      assert.strictEqual(res.body.env.HOME_ASSISTANT_TOKEN, MASK_SENTINEL);
      assert.strictEqual(res.body.env.PORT, '3000');
      // raw secret values never appear anywhere in the response
      assert.ok(!JSON.stringify(res.body).includes('super-secret'));
      assert.ok(!JSON.stringify(res.body).includes('jwt-secret-value'));
    });

    it('does not mask empty secret values (field shows as unset)', async () => {
      const res = await request(app).get('/api/config').expect(200);
      assert.strictEqual(res.body.env.EMPTY_TOKEN, '');
    });

    it('PUT /api/config/env with the mask sentinel leaves the stored secret unchanged', async () => {
      // UI save flows echo back unmodified (masked) values — must be a no-op
      await request(app)
        .put('/api/config/env')
        .send({ ADMIN_PASSWORD: MASK_SENTINEL, PORT: '4001' })
        .expect(200);
      const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
      assert.ok(content.includes('ADMIN_PASSWORD=super-secret'));
      assert.ok(content.includes('PORT=4001'));
    });

    it('PUT /api/config/env with a NEW secret value writes it', async () => {
      await request(app).put('/api/config/env').send({ ADMIN_PASSWORD: 'rotated' }).expect(200);
      const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
      assert.ok(content.includes('ADMIN_PASSWORD=rotated'));
      assert.ok(!content.includes('super-secret'));
    });

    it('masks _KEY/_PASS/_APIKEY/API_KEY suffixes; _PATH keys stay readable (CT-F4)', async () => {
      const { isSecretKey } = require('../lib/secrets');
      const res = await request(app).get('/api/config').expect(200);
      assert.strictEqual(res.body.env.NOTION_API_KEY, MASK_SENTINEL);
      assert.strictEqual(res.body.env.MPD_PASS, MASK_SENTINEL);
      // Suffix-anchored: SSL_KEY_PATH ends in _PATH, not _KEY — not a secret
      assert.strictEqual(res.body.env.SSL_KEY_PATH, '/etc/ssl/server.key');
      assert.ok(!JSON.stringify(res.body).includes('notion-key-value'));
      assert.ok(!JSON.stringify(res.body).includes('mpd-pass-value'));
      assert.strictEqual(isSecretKey('X_APIKEY'), true);
      assert.strictEqual(isSecretKey('API_KEY'), true);
      assert.strictEqual(isSecretKey('SSL_KEY_PATH'), false);
    });
  });

  describe('preset endpoints never serve raw secrets (CT-1)', () => {
    const { MASK_SENTINEL } = require('../lib/secrets');

    it('GET /api/presets/:filename/export masks env; on-disk preset stays raw', async () => {
      await request(app).post('/api/presets').send({ name: 'Venue A' }).expect(200);

      // On disk: raw (required so Load can restore real secrets)
      const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'presets', 'venue-a.json'), 'utf8'));
      assert.strictEqual(onDisk.env.ADMIN_PASSWORD, 'super-secret');
      assert.strictEqual(onDisk.env.JWT_SECRET, 'jwt-secret-value');

      // Over the wire: masked, non-secrets readable
      const res = await request(app).get('/api/presets/venue-a.json/export').expect(200);
      assert.strictEqual(res.body.env.ADMIN_PASSWORD, MASK_SENTINEL);
      assert.strictEqual(res.body.env.PORT, '3000');
      assert.ok(!JSON.stringify(res.body).includes('super-secret'));
      assert.ok(!JSON.stringify(res.body).includes('jwt-secret-value'));
      assert.ok(!JSON.stringify(res.body).includes('ha-token-value'));
    });

    it('PUT /api/presets/:filename/load masks env in the response', async () => {
      await request(app).post('/api/presets').send({ name: 'Venue B' }).expect(200);
      const res = await request(app).put('/api/presets/venue-b.json/load').expect(200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.preset.env.ADMIN_PASSWORD, MASK_SENTINEL);
      assert.ok(!JSON.stringify(res.body).includes('super-secret'));
      assert.ok(!JSON.stringify(res.body).includes('jwt-secret-value'));
    });

    it('GET /api/presets list and POST /api/presets/import responses carry no env contents', async () => {
      await request(app).post('/api/presets').send({ name: 'Venue C' }).expect(200);
      const list = await request(app).get('/api/presets').expect(200);
      assert.ok(!('env' in list.body[0]));
      assert.ok(!JSON.stringify(list.body).includes('super-secret'));

      const exported = await request(app).get('/api/presets/venue-c.json/export').expect(200);
      const imp = await request(app)
        .post('/api/presets/import')
        .attach('file', Buffer.from(JSON.stringify({ ...exported.body, name: 'Venue C2' })), 'venue-c2.json')
        .expect(200);
      assert.deepStrictEqual(imp.body, { success: true, filename: 'venue-c2.json' });
    });

    it('masked-export → import → load round-trip preserves stored secrets', async () => {
      // 1. Save current config as a preset; export it (env masked in flight)
      await request(app).post('/api/presets').send({ name: 'Round Trip' }).expect(200);
      const exported = await request(app).get('/api/presets/round-trip.json/export').expect(200);
      assert.strictEqual(exported.body.env.ADMIN_PASSWORD, MASK_SENTINEL);

      // 2. Re-import the masked export (with a non-secret tweak so the load
      //    visibly applies something)
      const reimport = { ...exported.body, name: 'Round Trip 2' };
      reimport.env = { ...reimport.env, PORT: '5555' };
      await request(app)
        .post('/api/presets/import')
        .attach('file', Buffer.from(JSON.stringify(reimport)), 'rt2.json')
        .expect(200);

      // 3. Load the reimported preset (its env carries mask sentinels)
      await request(app).put('/api/presets/round-trip-2.json/load').expect(200);

      // 4. Real secrets untouched (sentinel skipped on write); tweak applied;
      //    no literal bullets ever written to .env
      const content = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
      assert.ok(content.includes('ADMIN_PASSWORD=super-secret'));
      assert.ok(content.includes('JWT_SECRET=jwt-secret-value'));
      assert.ok(content.includes('PORT=5555'));
      assert.ok(!content.includes(MASK_SENTINEL));
    });
  });
});
