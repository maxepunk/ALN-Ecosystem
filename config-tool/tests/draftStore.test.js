// B0 BS.2 s1 — the draft store (design r2 D-B0.1r2).
//
// A draft is a COMPLETE working copy of a pack, copied from the live
// source into a tool-private directory and stamped {draftId, packId,
// sourcePath, base: {contentHash}, created, lastEdited}. Editing always
// targets a draft; the live pack changes only through publish. The pack
// copy lives in <draftDir>/pack/ with the stamp BESIDE it in draft.json
// — the manifest builder globs a pack dir, so a stamp inside the copy
// would pollute the rebuilt inventory.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { build } = require('../../backend/scripts/build-pack-manifest');
const { DraftStore } = require('../lib/draftStore');

// A minimal source pack with a REAL manifest (the real builder, so
// base.contentHash is genuine). Not gate-valid — s1 never runs the gate.
function makeSourcePack(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({
    kind: 'game', schemaVersion: 2, id: 'test-pack', title: 'Test Pack',
  }) + '\n');
  fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify({
    tok001: { SF_RFID: 'tok001', SF_ValueRating: 3, SF_MemoryType: 'Personal' },
  }) + '\n');
  fs.writeFileSync(path.join(dir, 'strings.json'), JSON.stringify({
    kind: 'strings', schemaVersion: 1, strings: {},
  }) + '\n');
  const { manifest, manifestPath } = build(dir);
  manifest.packId = 'test-pack';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

describe('draftStore', () => {
  let tmpDir, sourceDir, store, sourceManifest;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-draft-test-'));
    sourceDir = path.join(tmpDir, 'live-pack');
    sourceManifest = makeSourcePack(sourceDir);
    store = new DraftStore({
      rootDir: path.join(tmpDir, 'drafts'),
      store: 'pack',
      sourceDir,
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('createDraft', () => {
    it('stamps {draftId, packId, sourcePath, base.contentHash, created, lastEdited}', () => {
      const stamp = store.createDraft();
      assert.ok(typeof stamp.draftId === 'string' && stamp.draftId.length > 0);
      assert.strictEqual(stamp.packId, 'test-pack');
      assert.strictEqual(stamp.sourcePath, sourceDir);
      assert.strictEqual(stamp.base.contentHash, sourceManifest.contentHash);
      assert.ok(!Number.isNaN(Date.parse(stamp.created)));
      assert.ok(!Number.isNaN(Date.parse(stamp.lastEdited)));
    });

    it('copies every manifest-inventoried file plus the manifest into <draftId>/pack/', () => {
      const stamp = store.createDraft();
      const packDir = store.packDir(stamp.draftId);
      for (const f of sourceManifest.files) {
        assert.ok(fs.existsSync(path.join(packDir, f.path)), `missing ${f.path}`);
      }
      assert.ok(fs.existsSync(path.join(packDir, 'pack-manifest.json')));
      // The stamp lives BESIDE the copy, never inside it (builder globs).
      assert.ok(!fs.existsSync(path.join(packDir, 'draft.json')));
      assert.ok(fs.existsSync(path.join(packDir, '..', 'draft.json')));
    });

    it('never copies strays — a file the manifest does not inventory stays behind', () => {
      fs.writeFileSync(path.join(sourceDir, 'notes.txt'), 'stray\n');
      const stamp = store.createDraft();
      assert.ok(!fs.existsSync(path.join(store.packDir(stamp.draftId), 'notes.txt')));
    });

    it('REFUSES when an inventoried path is a symlink on disk (never follows)', () => {
      fs.writeFileSync(path.join(tmpDir, 'outside.json'), '{}\n');
      fs.rmSync(path.join(sourceDir, 'strings.json'));
      fs.symlinkSync(path.join(tmpDir, 'outside.json'), path.join(sourceDir, 'strings.json'));
      assert.throws(() => store.createDraft(), /strings\.json.*symlink|symlink.*strings\.json/i);
    });

    it('REFUSES a manifest-less source — no base identity to stamp', () => {
      fs.rmSync(path.join(sourceDir, 'pack-manifest.json'));
      assert.throws(() => store.createDraft(), /pack-manifest\.json/);
    });

    it('REFUSES an inventoried path whose DIRECTORY component is a symlink (B0 close review)', () => {
      fs.mkdirSync(path.join(tmpDir, 'outside-dir'));
      fs.writeFileSync(path.join(tmpDir, 'outside-dir', 'leak.json'), '{}\n');
      fs.symlinkSync(path.join(tmpDir, 'outside-dir'), path.join(sourceDir, 'assets'));
      const manifestPath = path.join(sourceDir, 'pack-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.files.push({ path: 'assets/leak.json', role: 'other', sha1: '0'.repeat(40), size: 3 });
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      assert.throws(() => store.createDraft(), /directory component.*symlink|symlink/i);
    });

    it('REFUSES a manifest inventory path that escapes the pack dir', () => {
      const manifestPath = path.join(sourceDir, 'pack-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.files.push({ path: '../evil.json', role: 'other', sha1: '0'.repeat(40), size: 3 });
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      assert.throws(() => store.createDraft(), /\.\.\/evil\.json/);
    });
  });

  describe('list / get / touch / delete', () => {
    it('listDrafts returns stamps for every draft, oldest first', () => {
      const a = store.createDraft();
      const b = store.createDraft();
      const listed = store.listDrafts();
      assert.strictEqual(listed.length, 2);
      assert.deepStrictEqual(listed.map((d) => d.draftId).sort(),
        [a.draftId, b.draftId].sort());
    });

    it('getDraft returns the stamp; null for an unknown id', () => {
      const stamp = store.createDraft();
      assert.deepStrictEqual(store.getDraft(stamp.draftId), stamp);
      assert.strictEqual(store.getDraft('no-such-draft'), null);
    });

    it('touch bumps lastEdited and persists it', async () => {
      const stamp = store.createDraft();
      await new Promise((r) => setTimeout(r, 5));
      const touched = store.touch(stamp.draftId);
      assert.ok(Date.parse(touched.lastEdited) > Date.parse(stamp.lastEdited));
      assert.strictEqual(store.getDraft(stamp.draftId).lastEdited, touched.lastEdited);
    });

    it('deleteDraft removes the draft dir; unknown id throws', () => {
      const stamp = store.createDraft();
      store.deleteDraft(stamp.draftId);
      assert.strictEqual(store.getDraft(stamp.draftId), null);
      assert.throws(() => store.deleteDraft(stamp.draftId), /no-such|not found|unknown/i);
    });
  });
});
