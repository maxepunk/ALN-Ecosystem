// B0 BS.2 s2 — the publish pipeline (design r2 D-B0.1r2 + §7 pins).
//
// Publish is the ONE landing step: conflict check (Q11(a) — REFUSE on
// base-contentHash mismatch), freeze to staging, manifest rebuild in
// staging, the ENGINE'S OWN gate via the child-process runner
// (execFile/argv only — §7 pin), sibling-staged ordered rename with
// pack-manifest.json LAST, landed re-verify, publish log. One tool-side
// mutex. Fixture: the toy-heist pack (gate-passing by construction).

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { build } = require('../../backend/scripts/build-pack-manifest');
const { DraftStore } = require('../lib/draftStore');
const { publishDraft, landingPlan } = require('../lib/publish');

const TOY_PACK = path.resolve(__dirname, '../../backend/tests/e2e/fixtures/packs/toy-heist');
const RUNNER = path.resolve(__dirname, '../../backend/scripts/validate-pack.js');

function copyPack(srcDir, destDir) {
  fs.cpSync(srcDir, destDir, { recursive: true });
}

function rebuildManifest(packDir) {
  const { manifest, manifestPath } = build(packDir);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

describe('publishDraft', () => {
  let tmpDir, liveDir, store, opts;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-publish-test-'));
    liveDir = path.join(tmpDir, 'live-pack');
    copyPack(TOY_PACK, liveDir);
    store = new DraftStore({
      rootDir: path.join(tmpDir, 'drafts'),
      store: 'pack',
      sourceDir: liveDir,
    });
    opts = { runnerPath: RUNNER };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Q11(a): REFUSES when the live pack changed under the draft — names BOTH hashes, re-draft is the recovery', async () => {
    const stamp = store.createDraft();

    // The live pack moves on (another editor, a git pull): edit + rebuild.
    const liveGamePath = path.join(liveDir, 'game.json');
    const game = readJson(liveGamePath);
    game.title = 'Midnight Heist (edited elsewhere)';
    fs.writeFileSync(liveGamePath, JSON.stringify(game, null, 2) + '\n');
    const movedManifest = rebuildManifest(liveDir);
    const liveBytes = fs.readFileSync(liveGamePath, 'utf8');

    await assert.rejects(
      publishDraft(store, stamp.draftId, opts),
      (err) => {
        assert.match(err.message, /refus/i);
        assert.ok(err.message.includes(stamp.base.contentHash),
          'refusal must name the draft base hash');
        assert.ok(err.message.includes(movedManifest.contentHash),
          'refusal must name the live hash');
        assert.match(err.message, /fresh draft|re-draft/i,
          'refusal must say re-drafting is the recovery');
        return true;
      });

    // The live tree is untouched by a refused publish.
    assert.strictEqual(fs.readFileSync(liveGamePath, 'utf8'), liveBytes);
  });

  it('REFUSES when the engine gate refuses the draft, carrying the engine\'s own problems', async () => {
    const stamp = store.createDraft();
    const draftPack = store.packDir(stamp.draftId);

    // Break the draft in a way the ACTIVATION GATE refuses: token names
    // a group game.json does not declare (slice 2b rule).
    const tokensPath = path.join(draftPack, 'tokens.json');
    const tokens = readJson(tokensPath);
    const firstToken = Object.keys(tokens)[0];
    tokens[firstToken].SF_Group = 'Undeclared Group';
    fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2) + '\n');
    rebuildManifest(draftPack);

    const liveHashBefore = readJson(path.join(liveDir, 'pack-manifest.json')).contentHash;

    await assert.rejects(
      publishDraft(store, stamp.draftId, opts),
      (err) => {
        assert.match(err.message, /gate|refus/i);
        assert.match(err.message, /Undeclared Group/,
          'the engine\'s own problem text must surface');
        return true;
      });

    assert.strictEqual(
      readJson(path.join(liveDir, 'pack-manifest.json')).contentHash,
      liveHashBefore, 'a gate-refused publish must not touch the live pack');
  });

  it('lands an edited draft: files + manifest, landed re-verify, publish log, base re-stamped', async () => {
    const stamp = store.createDraft();
    const draftPack = store.packDir(stamp.draftId);

    const stringsPath = path.join(draftPack, 'strings.json');
    const strings = readJson(stringsPath);
    strings.strings = { ...strings.strings, 'test.publish': 'landed' };
    fs.writeFileSync(stringsPath, JSON.stringify(strings, null, 2) + '\n');
    rebuildManifest(draftPack);

    const result = await publishDraft(store, stamp.draftId, opts);

    // The edit landed and the live manifest matches the landed tree.
    const liveStrings = readJson(path.join(liveDir, 'strings.json'));
    assert.strictEqual(liveStrings.strings['test.publish'], 'landed');
    const liveManifest = readJson(path.join(liveDir, 'pack-manifest.json'));
    assert.strictEqual(liveManifest.contentHash, result.contentHash);
    const reRebuilt = build(liveDir).manifest;
    assert.strictEqual(reRebuilt.contentHash, liveManifest.contentHash,
      'landed tree must re-verify: manifest hash equals the tree it describes');

    // Publish log: one line {when, draftId, contentHash, base}.
    const logPath = path.join(tmpDir, 'drafts', 'pack', 'publish-log.jsonl');
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.strictEqual(entry.draftId, stamp.draftId);
    assert.strictEqual(entry.contentHash, result.contentHash);
    assert.strictEqual(entry.base, stamp.base.contentHash);
    assert.ok(!Number.isNaN(Date.parse(entry.when)));

    // The draft's base is re-stamped to what it just published, so an
    // unchanged draft can publish again without a false conflict.
    assert.strictEqual(store.getDraft(stamp.draftId).base.contentHash, result.contentHash);

    // Staging never leaks.
    const staging = path.join(tmpDir, 'drafts', 'pack', '.staging');
    assert.ok(!fs.existsSync(staging) || fs.readdirSync(staging).length === 0);
  });

  it('publishing an UNEDITED draft is a content no-op (contentHash unchanged)', async () => {
    const before = readJson(path.join(liveDir, 'pack-manifest.json')).contentHash;
    const stamp = store.createDraft();
    const result = await publishDraft(store, stamp.draftId, opts);
    assert.strictEqual(result.contentHash, before);
    assert.strictEqual(
      readJson(path.join(liveDir, 'pack-manifest.json')).contentHash, before);
  });

  it('strays in the draft working copy never travel (only manifest-inventoried files land)', async () => {
    const stamp = store.createDraft();
    // Dropped WITHOUT a manifest rebuild — not inventoried, must not land.
    fs.writeFileSync(path.join(store.packDir(stamp.draftId), 'stray.txt'), 'x\n');
    await publishDraft(store, stamp.draftId, opts);
    assert.ok(!fs.existsSync(path.join(liveDir, 'stray.txt')));
  });

  it('one publish at a time: a concurrent publish REFUSES (tool-side mutex)', async () => {
    const a = store.createDraft();
    const b = store.createDraft();
    const [r1, r2] = await Promise.allSettled([
      publishDraft(store, a.draftId, opts),
      publishDraft(store, b.draftId, opts),
    ]);
    const outcomes = [r1, r2];
    assert.strictEqual(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
    const refused = outcomes.find((r) => r.status === 'rejected');
    assert.match(refused.reason.message, /in progress/i);
  });

  it('landingPlan orders pack-manifest.json LAST', () => {
    const plan = landingPlan([
      { path: 'game.json' }, { path: 'tokens.json' }, { path: 'strings.json' },
    ]);
    assert.strictEqual(plan[plan.length - 1], 'pack-manifest.json');
    assert.deepStrictEqual(
      plan.slice(0, -1).sort(),
      ['game.json', 'strings.json', 'tokens.json']);
  });
});
