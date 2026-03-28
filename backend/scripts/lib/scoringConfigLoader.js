/**
 * Shared scoring config loader for validator scripts.
 * Loads ALN-TokenData/scoring-config.json and transforms keys
 * to match the backend's runtime format.
 */

const path = require('path');

let _cached = null;

function loadScoringConstants() {
  if (_cached) return _cached;

  const scoringConfig = require(path.join(__dirname, '../../../ALN-TokenData/scoring-config.json'));

  _cached = {
    BASE_VALUES: Object.fromEntries(
      Object.entries(scoringConfig.baseValues).map(([k, v]) => [parseInt(k), v])
    ),
    TYPE_MULTIPLIERS: Object.fromEntries(
      Object.entries(scoringConfig.typeMultipliers).map(([k, v]) => [k.toLowerCase(), v])
    ),
  };

  return _cached;
}

module.exports = { loadScoringConstants };
