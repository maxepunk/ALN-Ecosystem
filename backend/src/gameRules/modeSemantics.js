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
    verbNoun: 'Sale',
    verb: 'Sell',
    scoringPolicy: 'standard',
    entityRole: 'ledger',
    countsTowardGroups: true,
    displayBehavior: Object.freeze({ surface: 'scoreboard-rankings', when: 'immediate' }),
    claimedLabel: 'SOLD to {entity}',
    icon: '💰',
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
    claimedLabel: 'EXPOSED by {entity}',
    icon: '🔍',
  }),
]);

// C0 controls + DEL + bidi controls: stripped from presentation fields
// before validation (R-Q2) — a control char must never reach a display
// or defeat the {entity} template check. Mirrors the scanner resolver.
const CONTROL_AND_BIDI = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/**
 * Normalize a declared claimedLabel value (R-Q2 #1): a TEMPLATE with
 * exactly one `{entity}` token and no other braces. Returns the cleaned
 * template, or null when the value is not usable. Value-level and SILENT
 * — the activation gate is the loud voice for declared-but-broken packs
 * (the scanner mirror DECLINEs with a warn, since it never sees a gate).
 * @param {*} value
 * @returns {string|null}
 */
function normalizedClaimedLabel(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(CONTROL_AND_BIDI, '');
  const parts = cleaned.split('{entity}');
  if (parts.length !== 2 || parts.some((p) => /[{}]/.test(p))) return null;
  return cleaned;
}

/**
 * Normalize a declared verbNoun value (slice 7): the NOUN form of the
 * mode's action ('Sale', 'Fence'), rendered as the session report's
 * Scoring Timeline Type cell. Refuses table-breakers — a pipe or brace
 * must never split a markdown table row (the generator sanitizes too;
 * this is the value-level twin of the schema pattern). Returns the
 * cleaned noun, or null when not usable. Silent (see above).
 * @param {*} value
 * @returns {string|null}
 */
function normalizedVerbNoun(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(CONTROL_AND_BIDI, '');
  if (cleaned.length === 0 || cleaned.length > 24 || /[|{}]/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Normalize a declared icon value (R-Q2 #1): a 1-4 code-point TEXT GLYPH,
 * markup-free — rendered as content only, NEVER a class/attribute key.
 * Returns the cleaned glyph, or null when not usable. Silent (see above).
 * @param {*} value
 * @returns {string|null}
 */
function normalizedIcon(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(CONTROL_AND_BIDI, '');
  if (cleaned.length === 0 || [...cleaned].length > 4 || /[<>&"'{}]/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Normalize a declared entities.label block (Q1): non-empty singular AND
 * plural strings. Returns {singular, plural} or null. The backend has no
 * entity-noun display surface today (reports are Q4-OUT; the scanner owns
 * the screens) — this exists for the activation gate's refusal twin.
 * @param {*} label - gameConfig.entities.label
 * @returns {{singular: string, plural: string}|null}
 */
function normalizedEntityLabel(label) {
  const singular = typeof (label && label.singular) === 'string'
    ? label.singular.replace(CONTROL_AND_BIDI, '').trim() : '';
  const plural = typeof (label && label.plural) === 'string'
    ? label.plural.replace(CONTROL_AND_BIDI, '').trim() : '';
  return (singular && plural) ? { singular, plural } : null;
}

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
    // Presentation fields (R-Q2): normalized to null when absent or not
    // usable. Backend consumer-less today — pre-wiring for report/
    // scoreboard surfaces; the parity claim requires both mirrors to
    // normalize identically.
    claimedLabel: mode.claimedLabel === undefined ? null : normalizedClaimedLabel(mode.claimedLabel),
    icon: mode.icon === undefined ? null : normalizedIcon(mode.icon),
    verbNoun: mode.verbNoun === undefined ? null : normalizedVerbNoun(mode.verbNoun),
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
  normalizedClaimedLabel,
  normalizedIcon,
  normalizedVerbNoun,
  normalizedEntityLabel,
  LEGACY_ALN_MODES,
  _resetForTesting,
};
