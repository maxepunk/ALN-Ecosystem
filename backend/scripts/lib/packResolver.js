/**
 * packResolver — resolve WHICH pack a session should be validated against
 * (A3 slice 2, owner ruling D4s2: validators resolve the session's
 * STAMPED pack identity instead of blindly assuming the production
 * checkout).
 *
 * Sessions since A2 are stamped at creation: `metadata.pack =
 * {packId, version, contentHash} | null` (sessionService.createSession ←
 * packService.getActivePackInfo). SessionLoader reads raw node-persist
 * JSON and bypasses Session.fromJSON's undefined→null migration, so this
 * resolver normalizes the stamp itself.
 *
 * There is NO on-disk archive of historical packs — only the live
 * checkout (and test fixtures). A stamped pack that is not on disk can
 * therefore only be DETECTED (contentHash mismatch), never loaded; the
 * posture mirrors the engine's session-restore precedent
 * (sessionService.init): LOUD note, proceed against the resolved dir.
 * PACK_PATH points the validator at an alternate pack copy when one
 * exists (same env seam as the engine, same loud note).
 *
 * Deliberately logger-free: validate-session writes its report to
 * stdout while LogParser reads backend/logs/combined.log — requiring the
 * winston-backed packService here would make validation pollute its own
 * evidence. Notes are RETURNED for the report, never printed here.
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_PACK_DIR } = require('./scoringConfigLoader');

function _readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {Object|null} session - SessionLoader-shaped session (raw metadata)
 * @param {Object} [opts]
 * @param {string} [opts.packDir] - explicit override (wins over PACK_PATH)
 * @returns {{packDir: string, gameConfig: Object|null, stamp: Object|null,
 *   verdict: 'match'|'mismatch'|'unstamped'|'no-manifest', notes: string[]}}
 */
function resolveSessionPack(session, opts = {}) {
  const notes = [];

  // Raw-JSON normalization: legacy files carry undefined (or no metadata
  // at all); an A2+ packless boot stamps explicit null. Both → null here.
  const stamp = (session && session.metadata && session.metadata.pack) || null;

  let packDir = DEFAULT_PACK_DIR;
  if (opts.packDir) {
    packDir = path.resolve(opts.packDir);
    notes.push(`pack dir override (option): ${packDir}`);
  } else if (process.env.PACK_PATH) {
    packDir = path.resolve(process.env.PACK_PATH);
    notes.push(`pack dir override (PACK_PATH): ${packDir}`);
  }

  const manifest = _readJson(path.join(packDir, 'pack-manifest.json'));
  const gameConfig = _readJson(path.join(packDir, 'game.json'));
  if (!gameConfig) {
    notes.push(
      `NO game.json in ${packDir} — mode semantics fall back to the baked legacy ALN table`
    );
  }

  let verdict;
  if (!manifest) {
    verdict = 'no-manifest';
    notes.push(
      `NO pack-manifest.json in ${packDir} — pack identity cannot be verified against the session stamp`
    );
  } else if (!stamp) {
    verdict = 'unstamped';
    notes.push(
      'session carries NO pack stamp (pre-A2 session or packless boot) — ' +
      `validating against ${manifest.packId} v${manifest.version} on disk; ` +
      'results are only as good as that guess'
    );
  } else if (!stamp.contentHash) {
    // A stamp without a hash cannot be verified — never report 'match'
    // on undefined === undefined (review finding). Treat like unstamped.
    verdict = 'unstamped';
    notes.push(
      'session pack stamp carries NO contentHash (malformed stamp) — identity cannot be ' +
      `verified; validating against ${manifest.packId} v${manifest.version} on disk`
    );
  } else if (stamp.contentHash === manifest.contentHash) {
    verdict = 'match';
  } else {
    verdict = 'mismatch';
    notes.push(
      `PACK MISMATCH: session was played on ${stamp.packId} v${stamp.version} ` +
      `(${String(stamp.contentHash).slice(0, 18)}…) but the resolved dir holds ` +
      `${manifest.packId} v${manifest.version} (${String(manifest.contentHash).slice(0, 18)}…). ` +
      'No pack archive exists — proceeding against the on-disk pack; expect ' +
      'false discrepancies if rules changed. Point PACK_PATH at a matching copy to fix.'
    );
  }

  return { packDir, gameConfig, stamp, verdict, notes };
}

module.exports = { resolveSessionPack, DEFAULT_PACK_DIR };
