'use strict';
/**
 * Shared pack-filesystem helpers (B0 BS.2 review fold — the copy rule
 * and atomic-write pattern were implemented twice across draftStore.js
 * and publish.js, and a third time as configManager._writeJson; three
 * security/atomicity-critical helpers drift-prone in one lib/ deserve
 * one home).
 *
 * The copy rule, everywhere a pack travels: ONLY manifest-inventoried
 * REGULAR files move; symlinks and specials refuse loudly (never
 * skipped, never followed), and inventory paths that escape the pack
 * dir refuse the whole operation.
 */

const fs = require('fs');
const path = require('path');

/**
 * Resolve a manifest-inventoried relative path against a pack dir,
 * refusing traversal. The builder never emits '..' or absolute paths,
 * but the manifest is a file on disk — treat it as input.
 */
function resolveInside(baseDir, relPath) {
  const abs = path.resolve(baseDir, relPath);
  if (!abs.startsWith(path.resolve(baseDir) + path.sep)) {
    throw new Error(`inventory path escapes the pack directory: ${relPath}`);
  }
  return abs;
}

/**
 * Copy one inventoried file between pack dirs. lstat (not stat): a
 * symlink must be seen as itself, never followed.
 */
function copyRegular(srcDir, destDir, relPath) {
  const src = resolveInside(srcDir, relPath);
  const dest = resolveInside(destDir, relPath);
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

/**
 * Atomic JSON write: tmp + rename so a crash mid-write can never leave
 * a truncated file (F-TOOL-10).
 */
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

module.exports = { resolveInside, copyRegular, readManifest, writeJsonAtomic };
