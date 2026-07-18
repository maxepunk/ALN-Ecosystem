/**
 * Shared scoring config loader for validator scripts.
 * Loads the scoring block from ALN-TokenData/game.json (the pack rules
 * file — sole shared scoring source since A3 slice 2 retired the legacy
 * scoring-config.json) and transforms keys to match the backend's
 * runtime format.
 *
 * Scope note (owner decision D4s2 pending): validators always read the
 * PRODUCTION pack checkout, same as before the migration. Deeper
 * pack-awareness (validating a session against whichever pack it ran
 * under) is a separate decision — this loader only fixes the retirement
 * break. An unreadable game.json throws: a validator must never fall
 * back to baked constants and silently validate against wrong values.
 */

const path = require('path');

let _cached = null;

function loadScoringConstants() {
  if (_cached) return _cached;

  const { scoring } = require(path.join(__dirname, '../../../ALN-TokenData/game.json'));
  if (!scoring?.baseValues || !scoring?.typeMultipliers) {
    throw new Error('ALN-TokenData/game.json has no usable scoring block — cannot validate scores');
  }

  _cached = {
    BASE_VALUES: Object.fromEntries(
      Object.entries(scoring.baseValues).map(([k, v]) => [parseInt(k), v])
    ),
    TYPE_MULTIPLIERS: Object.fromEntries(
      Object.entries(scoring.typeMultipliers).map(([k, v]) => [k.toLowerCase(), v])
    ),
  };

  return _cached;
}

module.exports = { loadScoringConstants };
