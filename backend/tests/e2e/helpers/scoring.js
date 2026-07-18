/**
 * Scoring Helper - Expected Score Calculation for E2E Tests
 *
 * SINGLE ORACLE (ledger L5 retired, A3 slice 2): the ACTIVE pack's
 * game.json scoring block, fetched from the RUNNING orchestrator's pack
 * channel. The backend, the standalone scanner, and these expectations
 * all read the same tables now — the former two-oracle split (backend on
 * the legacy scoring-config, scanner on the pack) died with ledger L1.
 * Every flow loads the oracle once in beforeAll via loadPackScoring()
 * and threads it into the calculators; a calculator called without it
 * throws instead of silently scoring from a second source.
 *
 * Group parsing (parseGroupMultiplier) still comes from production
 * tokenService — the "(xN)" group format is pack-universal string
 * parsing, not a scoring table.
 */

const https = require('https');
const { parseGroupMultiplier } = require('../../../src/services/tokenService');

/**
 * Fetch the ACTIVE pack's game.json scoring block from the orchestrator's
 * pack channel. Returns null when the pack ships no game.json (404) or on
 * any fetch problem — the calculators below THROW on a null oracle, so a
 * misconfigured harness (packless orchestrator asserting on scores) fails
 * loudly at first use instead of validating against wrong values.
 *
 * @param {string} orchestratorUrl
 * @returns {Promise<Object|null>} game.json `scoring` block or null
 */
function loadPackScoring(orchestratorUrl) {
  return _fetchGameJsonField(orchestratorUrl, 'scoring');
}

/** Fetch one top-level field of the ACTIVE pack's game.json from the
 *  running orchestrator's pack channel. Null on 404/parse/network
 *  failure — the calculators throw on a null oracle, so failures stay
 *  loud at the assertion site. One fetcher for every field (scoring,
 *  modes, and whatever slice 3a/3b need next). */
function _fetchGameJsonField(orchestratorUrl, field) {
  return new Promise((resolve) => {
    const url = `${orchestratorUrl}/api/pack/files/game.json`;
    https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(null);
        try {
          resolve(JSON.parse(data)[field] || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Fetch the ACTIVE pack's declared modes (slice 1). Null when the pack
 * ships no game.json — callers fall back to the ALN literals, mirroring
 * the engine's L6 shim.
 * @param {string} orchestratorUrl
 * @returns {Promise<Array|null>} game.json `modes` array or null
 */
function loadPackModes(orchestratorUrl) {
  return _fetchGameJsonField(orchestratorUrl, 'modes');
}

/**
 * Pack-derived UI labels for mode assertions (lowercase, as the pill
 * renders them minus the ' Mode' suffix). Tests written against ALN's
 * "black market"/"detective" literals use these so the same assertion
 * holds on every pack (dual-pack Tier L discipline).
 * @param {Array|null} modes - loadPackModes() result
 * @returns {{scoring: string, evidence: string}}
 */
function expectedModeLabels(modes) {
  if (!modes) return { scoring: 'black market', evidence: 'detective' };
  const scoring = modes.find((m) => m.scoringPolicy === 'standard');
  const evidence = modes.find((m) => m.displayBehavior && m.displayBehavior.surface === 'scoreboard-evidence');
  return {
    scoring: (scoring ? scoring.label : 'Black Market').toLowerCase(),
    evidence: (evidence ? evidence.label : 'Detective').toLowerCase(),
  };
}

/** Score a token against a pack scoring block, mirroring the ENGINE's
 *  normalization (packService._normalizeScoring: LOWERCASED type keys,
 *  `unknown` always present at 0) — the oracle must match what the
 *  backend actually computes. EXACT-CASE since D2b (ruled 2026-07-18):
 *  types are pack-declared ids matched verbatim — the scanner's
 *  always-exact-case lookup became the canon and the backend dropped
 *  its lowercase normalization; the activation gate refuses tokens
 *  whose type is absent from the pack's own typeMultipliers. */
function packTokenValue(packScoring, rating, memoryType) {
  const base = packScoring.baseValues[String(rating)] ?? packScoring.baseValues[rating] ?? 0;
  const mult = packScoring.typeMultipliers[memoryType]
    ?? packScoring.typeMultipliers.UNKNOWN ?? 0;
  return base * mult;
}

/** The pack oracle is REQUIRED (ledger L5 retired) — see file header. */
function _requireOracle(packScoring, fn) {
  if (!packScoring?.baseValues || !packScoring?.typeMultipliers) {
    throw new Error(
      `${fn}: no pack scoring oracle — load it in beforeAll with ` +
      `loadPackScoring(orchestratorInfo.url) and thread it through. ` +
      `(The in-process legacy oracle retired with ledger L5/A3 slice 2.)`
    );
  }
}

/**
 * Calculate expected score for a single token against the pack oracle
 * @param {Object} token - Token object with SF_ValueRating and SF_MemoryType
 * @param {Object} packScoring - loadPackScoring() result (REQUIRED)
 * @returns {number} Expected score (base value × type multiplier)
 */
function calculateExpectedScore(token, packScoring) {
  _requireOracle(packScoring, 'calculateExpectedScore');
  return packTokenValue(packScoring, token.SF_ValueRating, token.SF_MemoryType);
}

/**
 * Calculate expected group completion bonus against the pack oracle
 * @param {Array<Object>} tokens - Array of tokens in the same group
 * @param {Object} packScoring - loadPackScoring() result (REQUIRED)
 * @returns {number} Expected bonus score (0 if no valid group)
 */
function calculateExpectedGroupBonus(tokens, packScoring) {
  _requireOracle(packScoring, 'calculateExpectedGroupBonus');
  if (!tokens || tokens.length === 0) {
    return 0;
  }

  // Extract group info from first token
  const firstToken = tokens[0];
  if (!firstToken.SF_Group || firstToken.SF_Group.trim() === '') {
    return 0;
  }

  // Use the production parser for the "(xN)" group multiplier
  const multiplier = parseGroupMultiplier(firstToken.SF_Group);

  // Group bonus only applies if multiplier > 1x
  if (multiplier <= 1) {
    return 0;
  }

  // Calculate base score for all tokens in group
  const baseScore = tokens.reduce((sum, token) => {
    return sum + calculateExpectedScore(token, packScoring);
  }, 0);

  // Bonus formula: (multiplier - 1) × baseScore
  // Example: x3 group with $10k base = (3-1) × $10k = $20k bonus
  return (multiplier - 1) * baseScore;
}

// calculateExpectedTotalScore was DELETED with the L5 convergence: it had
// zero call sites (flows sum per-token expectations inline), and dead
// oracle surface is exactly what the single-oracle doctrine forbids.

module.exports = {
  loadPackScoring,
  loadPackModes,
  expectedModeLabels,
  calculateExpectedScore,
  calculateExpectedGroupBonus
};
