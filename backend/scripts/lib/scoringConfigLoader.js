/**
 * Shared scoring config loader for validator scripts.
 * Loads the scoring block from a pack directory's game.json (the pack
 * rules file — sole shared scoring source since A3 slice 2 retired the
 * legacy scoring-config.json) and transforms keys to match the backend's
 * runtime format.
 *
 * Pack-aware since D4s2: callers pass the RESOLVED pack directory
 * (packResolver.resolveSessionPack — the session's stamped pack, or the
 * production checkout for unstamped sessions). The default keeps the
 * production checkout so ad-hoc uses stay working. An unreadable
 * game.json throws: a validator must never fall back to baked constants
 * and silently validate against wrong values.
 */

const path = require('path');

const DEFAULT_PACK_DIR = path.join(__dirname, '../../../ALN-TokenData');

// Cache keyed by resolved dir — a pack-repoint must never serve another
// pack's memoized tables (the old single-slot memo would have).
const _cache = new Map();

function loadScoringConstants(packDir = DEFAULT_PACK_DIR) {
  const dir = path.resolve(packDir);
  if (_cache.has(dir)) return _cache.get(dir);

  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { scoring } = require(path.join(dir, 'game.json'));
  // NON-EMPTY required (same guard as packService._isUsableScoring):
  // empty-but-present tables would pass a truthiness check and make the
  // validator recompute NaN scores instead of throwing (review finding).
  if (!scoring?.baseValues || Object.keys(scoring.baseValues).length === 0
      || !scoring?.typeMultipliers || Object.keys(scoring.typeMultipliers).length === 0) {
    throw new Error(`${dir}/game.json has no usable scoring block — cannot validate scores`);
  }

  const constants = {
    BASE_VALUES: Object.fromEntries(
      Object.entries(scoring.baseValues).map(([k, v]) => [parseInt(k), v])
    ),
    // EXACT-CASE keys + UNKNOWN always present, mirroring
    // packService._normalizeScoring (D2b): types are pack-declared ids
    // matched verbatim; the engine scores unmatched types at 0x and
    // validators must agree
    TYPE_MULTIPLIERS: {
      UNKNOWN: 0,
      ...scoring.typeMultipliers,
    },
  };

  _cache.set(dir, constants);
  return constants;
}

module.exports = { loadScoringConstants, DEFAULT_PACK_DIR };
