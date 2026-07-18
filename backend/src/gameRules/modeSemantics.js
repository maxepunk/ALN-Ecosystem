/**
 * Mode semantics — the modes seam (Phase 3 A3 slice 1)
 *
 * The engine asks "what does this mode DO" (per-mode semantics flags from
 * the pack's game.json `modes` block), never "which of the two known modes
 * is this" (string equality on 'blackmarket'/'detective'). Every backend
 * mode-behavior branch point resolves through this module; the GM Scanner
 * carries the mirror seam (src/core/modeSemantics.js) — together they are
 * the mode half of the parity surface.
 *
 * Pure module (gameRules tier-zero discipline): no I/O, no EventEmitter,
 * no service reads. Callers fetch the active gameConfig themselves
 * (packService.getGameConfig()) and pass it in. The legacy-shim warning
 * goes through an injectable hook (console.warn by default; app wiring may
 * point it at the winston logger) so the module stays environment-agnostic.
 *
 * LEGACY SHIM (debt ledger L6): a null/absent gameConfig — packs without
 * game.json, pre-pack checkouts, tokens-only fixtures — resolves against
 * the baked ALN mode table below, with a LOUD once-per-process warning.
 * Retires when every pack in play ships game.json. The table mirrors
 * ALN-TokenData/game.json's modes block exactly; a drift between them is
 * a bug (the parity-pack fixture keeps the seam path exercised so the
 * shim never becomes the silently-load-bearing path).
 *
 * Unknown-mode semantics: resolveMode() returns null for a mode id the
 * config does not declare. Wire ingress rejects unknown modes up front
 * (validators.js checks wireModeIds()), so a null here can only arise
 * from history — e.g. a session restored under a different pack, which
 * session restore already loud-warns about. Callers treat null as
 * "scores nothing, counts toward nothing": the safe reading (the legacy
 * code would have SCORED any non-'detective' string — inventing money
 * from unknown modes is exactly what the flags migration ends).
 */

// Mirrors ALN-TokenData/game.json `modes` — the pre-pack ALN game, baked.
const LEGACY_ALN_MODES = Object.freeze([
  Object.freeze({
    id: 'blackmarket',
    label: 'Black Market',
    verb: 'Sell',
    scoringPolicy: 'standard',
    entityRole: 'ledger',
    countsTowardGroups: true,
    displayBehavior: Object.freeze({ surface: 'scoreboard-rankings', when: 'immediate' }),
  }),
  Object.freeze({
    id: 'detective',
    label: 'Detective',
    verb: 'Expose',
    scoringPolicy: 'none',
    entityRole: 'attribution',
    defaultEntity: 'Nova',
    countsTowardGroups: false,
    displayBehavior: Object.freeze({ surface: 'scoreboard-evidence', fields: Object.freeze(['summary', 'owner']), when: 'immediate' }),
  }),
]);

let legacyWarnHook = (msg) => console.warn(msg);
let warnedLegacy = false;

/**
 * The mode list the given config declares, or the legacy ALN table (loud,
 * once per process) when the config carries none.
 * @param {Object|null|undefined} gameConfig
 * @returns {Array<Object>}
 */
function _modesFrom(gameConfig) {
  if (gameConfig && Array.isArray(gameConfig.modes) && gameConfig.modes.length > 0) {
    return gameConfig.modes;
  }
  if (!warnedLegacy) {
    warnedLegacy = true;
    legacyWarnHook(
      'LEGACY MODE TABLE ACTIVE (debt ledger L6): the active pack ships no ' +
      'game.json modes block — mode behavior is running on the baked ALN ' +
      'table. Fine for pre-pack checkouts; a real pack should declare its modes.'
    );
  }
  return LEGACY_ALN_MODES;
}

/**
 * Resolve a mode id to its normalized semantics record, or null when the
 * config does not declare it. The record always carries every flag:
 * absent displayBehavior normalizes to {surface:'none'} (a mode that
 * declares no display surfaces nothing), absent fields to [], absent
 * `when` to 'immediate', absent claims to 'consuming' (D3s2: every
 * pre-claims mode consumed its token — the default IS the legacy
 * behavior, which is why neither real pack needs an edit).
 * @param {Object|null} gameConfig - The active pack's game.json (packService.getGameConfig())
 * @param {string} modeId
 * @returns {{id: string, label: string, verb: string|null,
 *   scoringPolicy: string, entityRole: string, defaultEntity: string|null,
 *   countsTowardGroups: boolean, claims: string,
 *   displayBehavior: {surface: string, fields: string[], when: string}}|null}
 */
function resolveMode(gameConfig, modeId) {
  const mode = _modesFrom(gameConfig).find((m) => m.id === modeId);
  if (!mode) return null;

  const db = mode.displayBehavior || {};
  return {
    id: mode.id,
    label: mode.label,
    verb: mode.verb || null,
    scoringPolicy: mode.scoringPolicy,
    entityRole: mode.entityRole,
    defaultEntity: mode.defaultEntity || null,
    countsTowardGroups: mode.countsTowardGroups === true,
    claims: mode.claims === undefined ? 'consuming' : mode.claims,
    displayBehavior: {
      surface: db.surface || 'none',
      fields: Array.isArray(db.fields) ? [...db.fields] : [],
      when: db.when || 'immediate',
    },
  };
}

/**
 * The valid wire `mode` values: the declared mode ids, in declaration
 * order. Wire validation (validators.js) checks membership here — the
 * closed Joi enum retired with slice 1.
 * @param {Object|null} gameConfig
 * @returns {string[]}
 */
function wireModeIds(gameConfig) {
  return _modesFrom(gameConfig).map((m) => m.id);
}

/**
 * The default mode when a caller supplies none: the pack's FIRST declared
 * mode (declaration order is the pack author's priority order; for ALN
 * that is 'blackmarket', preserving the pre-slice-1 wire default).
 * @param {Object|null} gameConfig
 * @returns {string}
 */
function defaultModeId(gameConfig) {
  return _modesFrom(gameConfig)[0].id;
}

/**
 * Route the legacy-shim warning somewhere other than console (app wiring
 * points this at the winston logger). Pure-module escape hatch — never
 * required for correctness.
 * @param {Function} fn - (message: string) => void
 */
function setLegacyWarnHook(fn) {
  legacyWarnHook = fn;
}

/** Test-only: re-arm the once-per-process legacy warning latch. */
function _resetForTesting() {
  warnedLegacy = false;
  legacyWarnHook = (msg) => console.warn(msg);
}

module.exports = {
  resolveMode,
  wireModeIds,
  defaultModeId,
  setLegacyWarnHook,
  LEGACY_ALN_MODES,
  _resetForTesting,
};
