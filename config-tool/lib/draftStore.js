'use strict';
/**
 * Draft store (B0 BS.2, design r2 D-B0.1r2).
 *
 * A draft is a COMPLETE working copy of a pack, copied from the live
 * source into a tool-private directory and stamped with its base
 * identity. Editing always targets a draft; the live pack changes only
 * through publish (publish.js). One store instance per <store> kind —
 * 'pack' today; the profile store (C4) is the same mechanism over
 * installation-profile documents.
 *
 * Layout: <rootDir>/<store>/<draftId>/draft.json (the stamp) beside
 * <draftId>/pack/ (the working copy). The stamp lives OUTSIDE the copy
 * because the manifest builder globs a pack dir — a stamp inside would
 * enter the rebuilt inventory and poison the contentHash.
 *
 * Copy rule (shared with publish): ONLY manifest-inventoried regular
 * files travel, plus pack-manifest.json itself. Symlinks and inventory
 * paths that escape the pack dir REFUSE the whole operation — never
 * skipped silently, never followed.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { build } = require('../../backend/scripts/build-pack-manifest');

/**
 * Resolve a manifest-inventoried relative path against a pack dir,
 * refusing traversal. The builder never emits '..' or absolute paths,
 * but the manifest is a file on disk — treat it as input.
 */
function resolveInventoryPath(packDir, relPath) {
  const abs = path.resolve(packDir, relPath);
  if (!abs.startsWith(path.resolve(packDir) + path.sep)) {
    throw new Error(`manifest inventory path escapes the pack directory: ${relPath}`);
  }
  return abs;
}

/**
 * Copy one inventoried file, refusing symlinks at BOTH ends' source.
 * lstat (not stat): a symlink must be seen as itself, never followed.
 */
function copyInventoryFile(srcDir, destDir, relPath) {
  const src = resolveInventoryPath(srcDir, relPath);
  const dest = resolveInventoryPath(destDir, relPath);
  const st = fs.lstatSync(src);
  if (!st.isFile()) {
    throw new Error(
      `refusing to copy ${relPath}: not a regular file (symlinks and specials never travel)`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/** Read + parse a pack's manifest; null when absent. */
function readManifest(packDir) {
  const manifestPath = path.join(packDir, 'pack-manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

/** Atomic JSON write (the configManager tmp+rename pattern). */
function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* best-effort cleanup */ }
    throw err;
  }
}

// The files whose FIRST writer is the store (no live writer exists by
// design — D-B0.4). game/cues have dedicated validated writers; the
// manifest is derived, never hand-written.
const DRAFT_FILE_WHITELIST = ['strings.json', 'theme.json'];

class DraftStore {
  /**
   * @param {Object} opts
   * @param {string} opts.rootDir - drafts root (tool-private)
   * @param {string} [opts.store] - store kind ('pack')
   * @param {string} opts.sourceDir - the live source this store drafts from
   */
  constructor({ rootDir, store = 'pack', sourceDir }) {
    this.storeDir = path.join(rootDir, store);
    this.sourceDir = path.resolve(sourceDir);
  }

  _draftDir(draftId) {
    // draftIds are store-minted, but they key filesystem paths — refuse
    // anything that is not a single plain path segment.
    if (!/^[a-z0-9-]+$/.test(draftId)) {
      throw new Error(`invalid draftId: ${draftId}`);
    }
    return path.join(this.storeDir, draftId);
  }

  _stampPath(draftId) {
    return path.join(this._draftDir(draftId), 'draft.json');
  }

  /** Absolute path of a draft's pack working copy. */
  packDir(draftId) {
    return path.join(this._draftDir(draftId), 'pack');
  }

  /**
   * Create a draft from the live source: complete copy + stamp.
   * Refuses a manifest-less source — without a manifest there is no
   * base contentHash to stamp, and publish could never detect conflict.
   */
  createDraft() {
    const manifest = readManifest(this.sourceDir);
    if (!manifest) {
      throw new Error(
        `cannot draft ${this.sourceDir}: no pack-manifest.json — ` +
        'a draft needs the base contentHash for conflict detection at publish');
    }

    let draftId, draftDir;
    // Uniqueness by exclusive mkdir; retry on the (unlikely) collision.
    for (let attempt = 0; ; attempt++) {
      draftId = `d${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
      draftDir = this._draftDir(draftId);
      try {
        fs.mkdirSync(draftDir, { recursive: true });
        break;
      } catch (err) {
        if (err.code !== 'EEXIST' || attempt >= 5) throw err;
      }
    }

    try {
      const packCopy = path.join(draftDir, 'pack');
      fs.mkdirSync(packCopy);
      for (const f of manifest.files || []) {
        copyInventoryFile(this.sourceDir, packCopy, f.path);
      }
      fs.copyFileSync(
        path.join(this.sourceDir, 'pack-manifest.json'),
        path.join(packCopy, 'pack-manifest.json'));

      const now = new Date().toISOString();
      const stamp = {
        draftId,
        packId: manifest.packId || null,
        sourcePath: this.sourceDir,
        base: { contentHash: manifest.contentHash || null },
        created: now,
        lastEdited: now,
      };
      writeJsonAtomic(this._stampPath(draftId), stamp);
      return stamp;
    } catch (err) {
      // Never leave a half-copied draft behind.
      fs.rmSync(draftDir, { recursive: true, force: true });
      throw err;
    }
  }

  /** All stamps, oldest first. */
  listDrafts() {
    if (!fs.existsSync(this.storeDir)) return [];
    return fs.readdirSync(this.storeDir)
      .map((id) => this.getDraft(id))
      .filter(Boolean)
      .sort((a, b) => Date.parse(a.created) - Date.parse(b.created));
  }

  /** The stamp, or null for an unknown/unreadable draft. */
  getDraft(draftId) {
    try {
      return JSON.parse(fs.readFileSync(this._stampPath(draftId), 'utf8'));
    } catch {
      return null;
    }
  }

  /** Bump lastEdited (the writers call this after a successful edit). */
  touch(draftId) {
    const stamp = this.getDraft(draftId);
    if (!stamp) throw new Error(`unknown draft: ${draftId}`);
    stamp.lastEdited = new Date().toISOString();
    writeJsonAtomic(this._stampPath(draftId), stamp);
    return stamp;
  }

  deleteDraft(draftId) {
    if (!this.getDraft(draftId)) throw new Error(`unknown draft: ${draftId}`);
    fs.rmSync(this._draftDir(draftId), { recursive: true, force: true });
  }

  /**
   * Read one whitelisted pack file from a draft's working copy.
   * strings.json / theme.json: the files whose FIRST writer is the
   * store (no live writer exists by design — D-B0.4). game/cues go
   * through their dedicated validated writers; the manifest is derived.
   */
  readDraftFile(draftId, name) {
    if (!DRAFT_FILE_WHITELIST.includes(name)) {
      throw new Error(`draft file access is limited to: ${DRAFT_FILE_WHITELIST.join(', ')}`);
    }
    if (!this.getDraft(draftId)) throw new Error(`unknown draft: ${draftId}`);
    return JSON.parse(fs.readFileSync(path.join(this.packDir(draftId), name), 'utf8'));
  }

  /**
   * Write one whitelisted pack file into a draft, keeping the draft's
   * manifest coherent (every pack-file edit pairs with a manifest
   * rebuild — the configManager PAIR ATOMICITY rule: restore the
   * previous file when the rebuild fails).
   */
  writeDraftFile(draftId, name, data) {
    if (!DRAFT_FILE_WHITELIST.includes(name)) {
      throw new Error(`draft file writes are limited to: ${DRAFT_FILE_WHITELIST.join(', ')}`);
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`${name} must be a JSON object`);
    }
    if (!this.getDraft(draftId)) throw new Error(`unknown draft: ${draftId}`);
    const packDir = this.packDir(draftId);
    const filePath = path.join(packDir, name);
    const hadFile = fs.existsSync(filePath);
    const previous = hadFile ? fs.readFileSync(filePath, 'utf8') : null;
    writeJsonAtomic(filePath, data);
    try {
      const { manifest, manifestPath } = build(packDir);
      writeJsonAtomic(manifestPath, manifest);
    } catch (err) {
      if (hadFile) fs.writeFileSync(filePath, previous, 'utf8');
      else fs.rmSync(filePath, { force: true });
      throw new Error(
        `${name} write rolled back: draft manifest rebuild failed (${err.message})`);
    }
    return this.touch(draftId);
  }
}

module.exports = { DraftStore };
