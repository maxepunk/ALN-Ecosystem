// B0 BS.2 s3 — the draft HTTP surface (design r2 D-B0.1r2).
//
// Editing always targets a draft: the two pack writers (scoring, cues)
// are re-pointed at draft-bound ConfigManager instances, strings/theme
// gain their FIRST writer (the whitelisted draft file PUT), and publish
// is the one landing step. The live-pack write routes refuse with
// guidance (draftRefusal tests live in routes.test.js).
//
// Fixture: toy-heist (gate-passing), copied per test into tmp.

'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');
const request = require('supertest');

const { build } = require('../../backend/scripts/build-pack-manifest');
const { ConfigManager } = require('../lib/configManager');
const { DraftStore } = require('../lib/draftStore');
const { createRouter } = require('../lib/routes');

const TOY_PACK = path.resolve(__dirname, '../../backend/tests/e2e/fixtures/packs/toy-heist');
const RUNNER = path.resolve(__dirname, '../../backend/scripts/validate-pack.js');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

describe('draft routes (HTTP layer)', () => {
  let tmpDir, liveDir, app, draftStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-draftroutes-test-'));
    liveDir = path.join(tmpDir, 'live-pack');
    fs.cpSync(TOY_PACK, liveDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.env'), 'PORT=3000\n');
    fs.writeFileSync(path.join(tmpDir, 'routing.json'), JSON.stringify({
      routes: { video: { sink: 'hdmi', fallback: 'hdmi' } }, ducking: [],
    }));

    const configManager = new ConfigManager({
      envPath: path.join(tmpDir, '.env'),
      gamePath: path.join(liveDir, 'game.json'),
      cuesPath: path.join(liveDir, 'cues.json'),
      routingPath: path.join(tmpDir, 'routing.json'),
      tokensPath: path.join(liveDir, 'tokens.json'),
      soundsDir: path.join(tmpDir, 'sounds'),
      videosDir: path.join(tmpDir, 'videos'),
      presetsDir: path.join(tmpDir, 'presets'),
    });
    draftStore = new DraftStore({
      rootDir: path.join(tmpDir, 'drafts'),
      store: 'pack',
      sourceDir: liveDir,
    });

    app = express();
    app.use(express.json());
    app.use('/api', createRouter(configManager, { draftStore, runnerPath: RUNNER }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function createDraft() {
    const res = await request(app).post('/api/drafts').expect(200);
    return res.body.draft;
  }

  describe('draft CRUD', () => {
    it('POST /api/drafts creates a draft stamped with the live base', async () => {
      const draft = await createDraft();
      const liveHash = readJson(path.join(liveDir, 'pack-manifest.json')).contentHash;
      assert.strictEqual(draft.base.contentHash, liveHash);
      assert.strictEqual(draft.packId, 'midnight-heist');
    });

    it('GET /api/drafts lists stamps; GET /api/drafts/:id returns one; 404 unknown', async () => {
      const draft = await createDraft();
      const list = await request(app).get('/api/drafts').expect(200);
      assert.deepStrictEqual(list.body.map((d) => d.draftId), [draft.draftId]);
      const one = await request(app).get(`/api/drafts/${draft.draftId}`).expect(200);
      assert.deepStrictEqual(one.body, draft);
      await request(app).get('/api/drafts/no-such-draft').expect(404);
    });

    it('DELETE /api/drafts/:id removes the draft; 404 unknown', async () => {
      const draft = await createDraft();
      await request(app).delete(`/api/drafts/${draft.draftId}`).expect(200);
      await request(app).get(`/api/drafts/${draft.draftId}`).expect(404);
      await request(app).delete(`/api/drafts/${draft.draftId}`).expect(404);
    });
  });

  describe('draft pack content', () => {
    it('GET /api/drafts/:id/config reads scoring/cues/pack from the DRAFT copy', async () => {
      const draft = await createDraft();
      const res = await request(app).get(`/api/drafts/${draft.draftId}/config`).expect(200);
      assert.strictEqual(res.body.pack.id, 'midnight-heist');
      assert.ok(res.body.scoring.baseValues);
      assert.ok(Array.isArray(res.body.cues.cues));
      // Venue config never rides the pack draft surface.
      assert.strictEqual(res.body.env, undefined);
      assert.strictEqual(res.body.routing, undefined);
    });

    it('PUT /api/drafts/:id/scoring writes the DRAFT, rebuilds its manifest, leaves live untouched', async () => {
      const draft = await createDraft();
      const draftPack = draftStore.packDir(draft.draftId);
      const scoring = readJson(path.join(draftPack, 'game.json')).scoring;
      const body = { ...scoring, baseValues: { ...scoring.baseValues, 1: 11111 } };

      await request(app).put(`/api/drafts/${draft.draftId}/scoring`).send(body).expect(200);

      assert.strictEqual(readJson(path.join(draftPack, 'game.json')).scoring.baseValues['1'], 11111);
      const draftManifest = readJson(path.join(draftPack, 'pack-manifest.json'));
      assert.strictEqual(draftManifest.contentHash, build(draftPack).manifest.contentHash,
        'draft manifest must be rebuilt to match the edited tree');
      assert.notStrictEqual(
        readJson(path.join(liveDir, 'game.json')).scoring.baseValues['1'], 11111,
        'the LIVE pack must not change on a draft edit');
      // The edit bumps the stamp.
      const after = await request(app).get(`/api/drafts/${draft.draftId}`).expect(200);
      assert.ok(Date.parse(after.body.lastEdited) >= Date.parse(draft.lastEdited));
    });

    it('PUT /api/drafts/:id/scoring maps ValidationError to 400 + details', async () => {
      const draft = await createDraft();
      const res = await request(app).put(`/api/drafts/${draft.draftId}/scoring`).send({}).expect(400);
      assert.ok(Array.isArray(res.body.details) && res.body.details.length > 0);
    });

    it('PUT /api/drafts/:id/cues writes the DRAFT cues through the pack-internal gate', async () => {
      const draft = await createDraft();
      const draftPack = draftStore.packDir(draft.draftId);
      const cues = readJson(path.join(draftPack, 'cues.json'));
      await request(app).put(`/api/drafts/${draft.draftId}/cues`).send(cues).expect(200);

      const bad = { kind: 'cues', schemaVersion: 2, cues: [{ label: 'no id', commands: [] }] };
      const res = await request(app).put(`/api/drafts/${draft.draftId}/cues`).send(bad).expect(400);
      assert.ok(res.body.details.some((d) => /id/.test(d)));
    });

    it('PUT /api/drafts/:id/files/strings.json is the FIRST strings writer (draft-only)', async () => {
      const draft = await createDraft();
      const draftPack = draftStore.packDir(draft.draftId);
      const strings = readJson(path.join(draftPack, 'strings.json'));
      strings.strings = { ...strings.strings, 'route.test': 'written' };

      await request(app)
        .put(`/api/drafts/${draft.draftId}/files/strings.json`).send(strings).expect(200);

      assert.strictEqual(
        readJson(path.join(draftPack, 'strings.json')).strings['route.test'], 'written');
      assert.strictEqual(
        readJson(path.join(draftPack, 'pack-manifest.json')).contentHash,
        build(draftPack).manifest.contentHash,
        'file PUT must rebuild the draft manifest');

      const got = await request(app)
        .get(`/api/drafts/${draft.draftId}/files/strings.json`).expect(200);
      assert.strictEqual(got.body.strings['route.test'], 'written');
    });

    it('files/:name whitelists strings.json and theme.json only', async () => {
      const draft = await createDraft();
      await request(app)
        .put(`/api/drafts/${draft.draftId}/files/game.json`).send({}).expect(400);
      await request(app)
        .put(`/api/drafts/${draft.draftId}/files/pack-manifest.json`).send({}).expect(400);
      await request(app)
        .put(`/api/drafts/${draft.draftId}/files/..%2Fdraft.json`).send({}).expect(400);
    });
  });

  describe('publish', () => {
    it('POST /api/drafts/:id/publish lands the draft and returns the log entry', async () => {
      const draft = await createDraft();
      const res = await request(app)
        .post(`/api/drafts/${draft.draftId}/publish`).expect(200);
      assert.strictEqual(res.body.publish.draftId, draft.draftId);
      assert.strictEqual(
        res.body.publish.contentHash,
        readJson(path.join(liveDir, 'pack-manifest.json')).contentHash);
    });

    it('POST publish on a conflicted draft maps the Q11(a) refusal to 409', async () => {
      const draft = await createDraft();
      // Live moves on.
      const gamePath = path.join(liveDir, 'game.json');
      const game = readJson(gamePath);
      game.title = 'moved';
      fs.writeFileSync(gamePath, JSON.stringify(game, null, 2) + '\n');
      const { manifest, manifestPath } = build(liveDir);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

      const res = await request(app)
        .post(`/api/drafts/${draft.draftId}/publish`).expect(409);
      assert.match(res.body.error, /fresh draft/i);
      assert.ok(res.body.error.includes(draft.base.contentHash));
    });

    it('POST publish on an unknown draft is 404', async () => {
      await request(app).post('/api/drafts/no-such-draft/publish').expect(404);
    });
  });
});
