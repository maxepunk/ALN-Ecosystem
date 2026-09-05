/**
 * Issuance-time grant computation (one-auth §1, v1 subset — B0 BS.1).
 *
 * granted = packAssignment(class) ∩ tierCeiling(tier) − (FLOOR if tier ≠ operator)
 *
 * PURE module (the gameRules seam rule): tables and set algebra only —
 * no I/O, no service reads, no requires. v1 ships ALN's
 * behavior-identical degenerate table: no pack declares function
 * assignments yet (the pack-declared block is Phase-4 E4 headroom), so
 * packAssignment is the engine's class table below. The FLOOR trio is
 * never minted below operator and is re-checked at execution time
 * (commandExecutor) — the one-auth §4 blast-radius cap.
 */

const FLOOR_FUNCTIONS = Object.freeze([
  'session-lifecycle',
  'show-control',
  'score-intervention',
]);

// v1 engine defaults per device class (pack-declared assignments are
// E4 headroom; the pack validator will refuse floor-below-staffed when
// that block exists).
const CLASS_ASSIGNMENTS = Object.freeze({
  staffed: Object.freeze(['view-content', 'observe', ...FLOOR_FUNCTIONS]),
  station: Object.freeze(['view-content']),
  personal: Object.freeze(['view-content']),
  display: Object.freeze(['observe']),
});

// Tier ceilings (one-auth §2): operator ⊇ everything; device caps at
// read/view; session is the Phase-4 player substrate.
const TIER_CEILINGS = Object.freeze({
  operator: Object.freeze(['view-content', 'observe', ...FLOOR_FUNCTIONS]),
  device: Object.freeze(['view-content', 'observe']),
  session: Object.freeze(['view-content']),
});

/**
 * Compute the functions minted into a token at issuance.
 * Unknown tier or class computes to ZERO grants — deny by default,
 * never a throw (issuance must fail closed, not crash).
 * @param {{tier?: string, deviceClass?: string}} identity
 * @returns {string[]} granted function ids
 */
function computeGrants({ tier, deviceClass } = {}) {
  const assignment = CLASS_ASSIGNMENTS[deviceClass];
  const ceiling = TIER_CEILINGS[tier];
  if (!assignment || !ceiling) return [];
  let granted = assignment.filter((f) => ceiling.includes(f));
  if (tier !== 'operator') {
    granted = granted.filter((f) => !FLOOR_FUNCTIONS.includes(f));
  }
  return granted;
}

// The execution-time re-check vocabulary: which gm:command families sit
// behind which FLOOR function. Prefix-mapped; transaction:submit (the
// GM's ordinary scan path) is deliberately NOT floor — finer non-floor
// taxonomy is E4.
const FLOOR_ACTION_PREFIXES = Object.freeze([
  ['session:', 'session-lifecycle'],
  ['system:reset', 'session-lifecycle'],
  ['cue:', 'show-control'],
  ['sound:', 'show-control'],
  ['music:', 'show-control'],
  ['video:', 'show-control'],
  ['display:', 'show-control'],
  ['audio:', 'show-control'],
  ['bluetooth:', 'show-control'],
  ['lighting:', 'show-control'],
  ['held:', 'show-control'],
  ['scoreboard:page', 'show-control'],
  // Health probes drive the registry that gates operator commands and
  // mints held items — show-ops tooling, never display-drivable (B0
  // close review: this was the ONE gm:command family outside the map,
  // reachable by an observe socket).
  ['service:', 'show-control'],
  ['score:', 'score-intervention'],
  ['transaction:create', 'score-intervention'],
  ['transaction:delete', 'score-intervention'],
]);

/**
 * The FLOOR function a gm:command action requires, or null when the
 * action is not floor-protected (v1 leaves non-floor actions to the
 * operator ceiling).
 * @param {string} action
 * @returns {string|null}
 */
function requiredFloorFunction(action) {
  if (typeof action !== 'string') return null;
  for (const [prefix, fn] of FLOOR_ACTION_PREFIXES) {
    if (action.startsWith(prefix)) return fn;
  }
  return null;
}

module.exports = {
  FLOOR_FUNCTIONS,
  CLASS_ASSIGNMENTS,
  TIER_CEILINGS,
  computeGrants,
  requiredFloorFunction,
};
