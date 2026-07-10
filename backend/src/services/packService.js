/**
 * Pack Service — the active game pack directory (Phase 3 A2)
 *
 * The engine serves game content from ONE active pack directory: the
 * PACK_PATH env override (the 2.x.4 TOKENS_PATH injection seam, generalized
 * from a tokens.json file to a whole pack directory), else the ALN-TokenData
 * submodule. The pack's identity is its manifest's contentHash — the
 * staleness token every client compares against (sync:full, /health,
 * C1 preflight). Design: docs/plans/2026-07-09-phase3-1-standalone-pack-loading.md.
 *
 * Function exports, no class (same style as tokenService).
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DEFAULT_PACK_DIR = path.join(__dirname, '../../../ALN-TokenData');

// Manifest cache, invalidated on file mtime change (same pattern as the
// asset manifest in resourceRoutes — the manifest is rewritten wholesale
// by build-pack-manifest.js, never edited in place).
let manifestCache = null;
let manifestCacheMtime = null;
let warnedPackPath = false;

/**
 * Absolute path of the ACTIVE pack directory.
 * @returns {string}
 */
function getPackDir() {
  if (process.env.PACK_PATH) {
    if (!warnedPackPath) {
      // LOUD by design (same rationale as the old TOKENS_PATH warn): a
      // production process accidentally started with PACK_PATH set would
      // silently run the game on a non-production pack.
      logger.warn(`PACK_PATH override ACTIVE — game pack injected from: ${process.env.PACK_PATH}`);
      warnedPackPath = true;
    }
    return path.resolve(process.env.PACK_PATH);
  }
  return DEFAULT_PACK_DIR;
}

/**
 * The active pack's manifest, or null when the pack directory has no
 * pack-manifest.json (pre-pack checkout) or it is unreadable.
 * @returns {Object|null}
 */
function getManifest() {
  const manifestPath = path.join(getPackDir(), 'pack-manifest.json');
  let stat;
  try {
    stat = fs.statSync(manifestPath);
  } catch {
    return null;
  }
  if (manifestCache && stat.mtimeMs === manifestCacheMtime) return manifestCache;
  try {
    manifestCache = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifestCacheMtime = stat.mtimeMs;
    return manifestCache;
  } catch (err) {
    logger.warn(`Pack manifest unreadable at ${manifestPath}: ${err.message}`);
    return null;
  }
}

/**
 * The active pack's identity for staleness comparison (sync:full, /health).
 * @returns {{packId: string, version: string, contentHash: string}|null}
 */
function getActivePackInfo() {
  const manifest = getManifest();
  if (!manifest) return null;
  return {
    packId: manifest.packId,
    version: manifest.version,
    contentHash: manifest.contentHash,
  };
}

/**
 * Resolve a manifest-relative file path to an absolute path — ONLY if the
 * path is present in the active manifest's inventory (whitelist semantics:
 * traversal attempts and non-inventoried files both resolve to null, so the
 * route can 404 without distinguishing them).
 * @param {string} relPath - e.g. "tokens.json", "assets/images/kaa001.bmp"
 * @returns {string|null}
 */
function resolvePackFile(relPath) {
  const manifest = getManifest();
  if (!manifest || !Array.isArray(manifest.files)) return null;
  if (!manifest.files.some((f) => f.path === relPath)) return null;
  // Inventory paths are generated (no leading slash, no '..'), but never
  // trust that at the serving boundary: the resolved path must stay inside
  // the pack directory.
  const abs = path.resolve(getPackDir(), relPath);
  if (!abs.startsWith(getPackDir() + path.sep)) return null;
  return abs;
}

/**
 * Test-only: drop the manifest cache and the PACK_PATH warn latch.
 */
function _resetForTesting() {
  manifestCache = null;
  manifestCacheMtime = null;
  warnedPackPath = false;
}

module.exports = { getPackDir, getManifest, getActivePackInfo, resolvePackFile, _resetForTesting };
