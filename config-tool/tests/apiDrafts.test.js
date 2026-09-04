// B0 BS.3 — the api layer's auth attach + draft-aware pack writers.
//
// The two pack writers (putScoring/putCues) route through DRAFTS: the
// api layer ensures a draft exists (resuming the newest server-side
// draft before creating), PUTs into it, and publish is an explicit
// separate call. The auth session token rides every request as a
// Bearer header; a 401 surfaces as err.status for the login flow.
//
// fetch is stubbed globally; the module is browser ESM (dynamic import).

'use strict';
const { before, describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

let api, resetAppStore, appStore;

before(async () => {
  ({ resetAppStore } = await import('../public/js/store.js'));
  api = await import('../public/js/utils/api.js');
});

// A recording fetch stub: routes[method + ' ' + path] → {status, body}
// (or a function of (path, opts)). Records every call.
function stubFetch(routes) {
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const key = `${method} ${url}`;
    calls.push({ key, url, opts });
    const route = routes[key];
    if (!route) throw new Error(`unstubbed fetch: ${key}`);
    const { status = 200, body = {} } = typeof route === 'function' ? route(url, opts) : route;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
  return calls;
}

const STAMP = {
  draftId: 'dtest-1', packId: 'p', sourcePath: '/live',
  base: { contentHash: 'sha256:aaa' }, created: '2026-09-04T00:00:00Z',
  lastEdited: '2026-09-04T00:00:00Z',
};

describe('api — auth attach + draft routing', () => {
  // appStore is a LIVE ESM binding — resetAppStore() reassigns it and
  // the api module follows; no injection seam needed.
  beforeEach(() => {
    appStore = resetAppStore();
  });

  it('login stores the session token; later requests carry it as a Bearer header', async () => {
    const calls = stubFetch({
      'POST /api/auth/login': { body: { token: 'tool-token', expiresIn: 86400 } },
      'GET /api/config': { body: { env: {} } },
    });
    await api.login('venue-pass');
    assert.strictEqual(appStore.get().token, 'tool-token');
    await api.getConfig();
    const configCall = calls.find((c) => c.key === 'GET /api/config');
    assert.strictEqual(configCall.opts.headers.Authorization, 'Bearer tool-token');
  });

  it('a 401 surfaces as err.status 401 (the login-flow hook)', async () => {
    stubFetch({
      'PUT /api/config/env': { status: 401, body: { error: 'AUTH_REQUIRED' } },
    });
    await assert.rejects(api.putEnv({ PORT: '1' }), (err) => {
      assert.strictEqual(err.status, 401);
      return true;
    });
  });

  it('putScoring with no draft creates one, then PUTs into the draft', async () => {
    const calls = stubFetch({
      'GET /api/drafts': { body: [] },
      'POST /api/drafts': { body: { success: true, draft: STAMP } },
      'PUT /api/drafts/dtest-1/scoring': { body: { success: true } },
    });
    await api.putScoring({ baseValues: {} });
    assert.deepStrictEqual(calls.map((c) => c.key), [
      'GET /api/drafts', 'POST /api/drafts', 'PUT /api/drafts/dtest-1/scoring',
    ]);
    assert.strictEqual(appStore.get().draft.draftId, 'dtest-1');
  });

  it('putCues reuses the draft already in the store (no second create)', async () => {
    appStore.update({ draft: STAMP });
    const calls = stubFetch({
      'PUT /api/drafts/dtest-1/cues': { body: { success: true } },
    });
    await api.putCues({ kind: 'cues', schemaVersion: 2, cues: [] });
    assert.deepStrictEqual(calls.map((c) => c.key), ['PUT /api/drafts/dtest-1/cues']);
  });

  it('ensureDraft resumes the NEWEST existing server draft before creating', async () => {
    const older = { ...STAMP, draftId: 'dold', lastEdited: '2026-09-01T00:00:00Z' };
    const newer = { ...STAMP, draftId: 'dnew', lastEdited: '2026-09-03T00:00:00Z' };
    stubFetch({
      'GET /api/drafts': { body: [older, newer] },
      'PUT /api/drafts/dnew/scoring': { body: { success: true } },
    });
    await api.putScoring({ baseValues: {} });
    assert.strictEqual(appStore.get().draft.draftId, 'dnew');
  });

  it('resumeDraft adopts the newest existing draft at boot but never creates one', async () => {
    const calls = stubFetch({ 'GET /api/drafts': { body: [] } });
    await api.resumeDraft();
    assert.strictEqual(appStore.get().draft, null);
    assert.deepStrictEqual(calls.map((c) => c.key), ['GET /api/drafts']);

    stubFetch({ 'GET /api/drafts': { body: [STAMP] } });
    await api.resumeDraft();
    assert.strictEqual(appStore.get().draft.draftId, 'dtest-1');
  });

  it('publishCurrentDraft publishes and clears the draft from the store', async () => {
    appStore.update({ draft: STAMP });
    stubFetch({
      'POST /api/drafts/dtest-1/publish': {
        body: { success: true, publish: { contentHash: 'sha256:new' } },
      },
    });
    const entry = await api.publishCurrentDraft();
    assert.strictEqual(entry.contentHash, 'sha256:new');
    assert.strictEqual(appStore.get().draft, null);
  });

  it('getEffectiveConfig overlays the draft pack content over the live config', async () => {
    appStore.update({ draft: STAMP });
    stubFetch({
      'GET /api/config': {
        body: {
          env: { PORT: '3000' }, routing: { routes: {} },
          scoring: { baseValues: { 1: 10000 } }, cues: { cues: [] },
          pack: { id: 'live-pack' },
        },
      },
      'GET /api/drafts/dtest-1/config': {
        body: {
          scoring: { baseValues: { 1: 99999 } },
          cues: { cues: [{ id: 'c1' }] },
          pack: { id: 'draft-pack' },
        },
      },
    });
    const config = await api.getEffectiveConfig();
    assert.strictEqual(config.scoring.baseValues['1'], 99999);
    assert.strictEqual(config.cues.cues.length, 1);
    assert.strictEqual(config.pack.id, 'draft-pack');
    assert.strictEqual(config.env.PORT, '3000');
  });
});
