'use strict';
/**
 * Publish pipeline (B0 BS.2, design r2 D-B0.1r2 + the §7 BS.1 review
 * pins). Publish is the ONE step that changes a live pack:
 *
 *   1. conflict check — Q11(a): REFUSE when the live target's
 *      contentHash no longer equals the draft's base (both hashes
 *      named; re-drafting is the recovery)
 *   2. freeze the draft to a staging snapshot (manifest-inventoried
 *      regular files only — the draftStore copy rule)
 *   3. rebuild the manifest IN staging (content-hash = publish identity)
 *   4. run the ENGINE'S OWN gate via the child-process runner,
 *      execFile/argv-array ONLY (§7 pin) — refuse on any problem, and
 *      refuse a null identity (the packless posture)
 *   5. land: stage each file as a sibling tmp in the live dir, then
 *      ordered rename with pack-manifest.json LAST; files the old live
 *      manifest inventoried that the new one does not are removed after
 *      the manifest lands (the manifest is the authority)
 *   6. re-verify the landed tree against the published contentHash
 *   7. append the publish log; re-stamp the draft's base to the landed
 *      hash so an unchanged draft can publish again without a false
 *      conflict
 *
 * ONE tool-side mutex serializes publishes (module-level — the tool is
 * a single process).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { build, contentHash: hashOfFiles } = require('../../backend/scripts/build-pack-manifest');

let publishInProgress = false;

/**
 * The rename order for landing: every inventoried file first (sorted,
 * deterministic), pack-manifest.json LAST — a reader that sees the new
 * manifest sees the files it describes already in place.
 * @param {Array<{path: string}>} files - staged manifest inventory
 * @returns {string[]} relative paths in landing order
 */
function landingPlan(files) {
  return files.map((f) => f.path).sort().concat('pack-manifest.json');
}

function readManifest(packDir) {
  const p = path.join(packDir, 'pack-manifest.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function resolveInside(baseDir, relPath) {
  const abs = path.resolve(baseDir, relPath);
  if (!abs.startsWith(path.resolve(baseDir) + path.sep)) {
    throw new Error(`inventory path escapes the pack directory: ${relPath}`);
  }
  return abs;
}

/** Copy one inventoried regular file; symlinks/specials refuse loudly. */
function copyRegular(srcDir, destDir, relPath) {
  const src = resolveInside(srcDir, relPath);
  const dest = resolveInside(destDir, relPath);
  const st = fs.lstatSync(src);
  if (!st.isFile()) {
    throw new Error(
      `refusing to publish ${relPath}: not a regular file (symlinks and specials never travel)`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/** Run the engine's activation gate against a directory (§7 pin: execFile/argv only). */
function runGate(runnerPath, packDir) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [runnerPath, packDir],
      { timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        // Exit 1 = gate refused (verdict still on stdout); exit 2 / spawn
        // failure = runner misuse or breakage.
        let verdict = null;
        try { verdict = JSON.parse(String(stdout).trim()); } catch { /* fall through */ }
        if (verdict) return resolve(verdict);
        reject(new Error(`pack gate runner failed: ${err ? err.message : 'no verdict on stdout'}`));
      });
  });
}

/**
 * @param {import('./draftStore').DraftStore} store
 * @param {string} draftId
 * @param {{runnerPath: string}} opts
 * @returns {Promise<{when: string, draftId: string, packId: string|null, contentHash: string, base: string}>}
 */
async function publishDraft(store, draftId, { runnerPath }) {
  if (publishInProgress) {
    throw new Error('publish refused: another publish is in progress — retry when it completes');
  }
  publishInProgress = true;
  const stagingDir = path.join(store.storeDir, '.staging',
    `${draftId}-${crypto.randomBytes(3).toString('hex')}`);
  try {
    const stamp = store.getDraft(draftId);
    if (!stamp) throw new Error(`unknown draft: ${draftId}`);

    const target = stamp.sourcePath;
    const liveManifest = readManifest(target);
    if (!liveManifest) {
      throw new Error(`publish refused: ${target} has no pack-manifest.json — not a pack`);
    }

    // (1) Q11(a): conflict = REFUSE loudly; re-drafting is the recovery.
    if (liveManifest.contentHash !== stamp.base.contentHash) {
      throw new Error(
        'publish refused: the live pack has changed since this draft was taken ' +
        `(live contentHash ${liveManifest.contentHash}, draft base ${stamp.base.contentHash}). ` +
        'Create a fresh draft from the live pack and re-apply your edits.');
    }

    // (2) Freeze: manifest-inventoried regular files only.
    const draftPack = store.packDir(draftId);
    const draftManifest = readManifest(draftPack);
    if (!draftManifest) throw new Error(`draft ${draftId} has no pack-manifest.json`);
    fs.mkdirSync(stagingDir, { recursive: true });
    for (const f of draftManifest.files || []) {
      copyRegular(draftPack, stagingDir, f.path);
    }
    copyRegular(draftPack, stagingDir, 'pack-manifest.json');

    // (3) Rebuild the manifest IN staging — the publish identity.
    const { manifest: stagedManifest, manifestPath: stagedManifestPath } = build(stagingDir);
    fs.writeFileSync(stagedManifestPath, JSON.stringify(stagedManifest, null, 2) + '\n');

    // (4) The engine's own gate, in its own process.
    const verdict = await runGate(runnerPath, stagingDir);
    if (!verdict.ok) {
      throw new Error(
        `publish refused: the engine's activation gate refused the pack:\n${(verdict.problems || []).join('\n')}`);
    }
    if (!verdict.contentHash) {
      throw new Error(
        'publish refused: the gate passed with null pack identity (packless posture) — nothing to publish');
    }
    if (verdict.contentHash !== stagedManifest.contentHash) {
      throw new Error(
        `publish refused: gate saw contentHash ${verdict.contentHash} but staging holds ${stagedManifest.contentHash}`);
    }

    // Narrow the write-window TOCTOU: the live target must STILL match
    // the base right before landing (an external edit mid-pipeline).
    const liveNow = readManifest(target);
    if (!liveNow || liveNow.contentHash !== stamp.base.contentHash) {
      throw new Error(
        'publish refused: the live pack changed while publishing ' +
        `(live contentHash ${liveNow ? liveNow.contentHash : 'missing'}, draft base ${stamp.base.contentHash}). ` +
        'Create a fresh draft from the live pack and re-apply your edits.');
    }

    // (5) Land: sibling-stage every file, then ordered rename, manifest
    // LAST. Renames are atomic per file on the same filesystem.
    const plan = landingPlan(stagedManifest.files);
    const tmpSuffix = `.publish-${crypto.randomBytes(3).toString('hex')}`;
    for (const rel of plan) {
      const dest = resolveInside(target, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(stagingDir, rel), dest + tmpSuffix);
    }
    for (const rel of plan) {
      const dest = resolveInside(target, rel);
      fs.renameSync(dest + tmpSuffix, dest);
    }

    // Draft-deleted files: inventoried by the OLD live manifest, absent
    // from the new one — removed AFTER the manifest lands (the manifest
    // is the authority; a leftover stray would fork the next rebuild).
    const stagedPaths = new Set(stagedManifest.files.map((f) => f.path));
    for (const f of liveManifest.files || []) {
      if (!stagedPaths.has(f.path)) {
        fs.rmSync(resolveInside(target, f.path), { force: true });
      }
    }

    // (6) Re-verify the LANDED tree: hash the inventoried files as they
    // landed and compare to the published identity.
    const landedFiles = stagedManifest.files.map((f) => {
      const buf = fs.readFileSync(resolveInside(target, f.path));
      return { path: f.path, sha1: crypto.createHash('sha1').update(buf).digest('hex') };
    });
    const landedHash = hashOfFiles(landedFiles);
    if (landedHash !== stagedManifest.contentHash) {
      throw new Error(
        `PUBLISH LANDED INCONSISTENT: landed tree hashes ${landedHash}, expected ${stagedManifest.contentHash} — ` +
        'the live pack may be mid-edit by another writer; re-draft and re-publish');
    }

    // (7) Publish log + base re-stamp.
    const entry = {
      when: new Date().toISOString(),
      draftId,
      packId: stagedManifest.packId || null,
      contentHash: stagedManifest.contentHash,
      base: stamp.base.contentHash,
    };
    fs.appendFileSync(path.join(store.storeDir, 'publish-log.jsonl'),
      JSON.stringify(entry) + '\n');
    stamp.base = { contentHash: stagedManifest.contentHash };
    stamp.lastEdited = entry.when;
    fs.writeFileSync(path.join(store.storeDir, draftId, 'draft.json'),
      JSON.stringify(stamp, null, 2) + '\n');

    return entry;
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    publishInProgress = false;
  }
}

module.exports = { publishDraft, landingPlan };
