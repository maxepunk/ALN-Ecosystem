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
 * ACTIVATION: initializeServices() calls activatePack() at the moment the
 * engine loads its token data. From then on the manifest — the advertised
 * identity AND the files/ serving whitelist — is that boot-time snapshot:
 * a pack edited on disk mid-run is neither advertised nor served (a
 * session's rules are frozen; packs activate at process start). Disk
 * drift is loud-warned so the operator knows a restart is needed.
 * Before activation (selective-init test harnesses, bare route usage)
 * reads fall through to live disk state.
 *
 * Function exports, no class (same style as tokenService).
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { parseMoneyFormat } = require('../gameRules/formatting');
const { normalizedClaimedLabel, normalizedIcon, normalizedEntityLabel } = require('../gameRules/modeSemantics');
const { validateCuesBlock } = require('../gameRules/cueValidation');

const DEFAULT_PACK_DIR = path.join(__dirname, '../../../ALN-TokenData');

// ── Capability gate constants (Phase 3 A3 slice 0) ─────────────────────
// ENGINE_VERSION is the PACK-INTERFACE version (what pack-manifest
// `engine.minVersion` compares against), deliberately decoupled from the
// npm package version: it bumps when the engine's pack-consuming
// capabilities change, nothing else. Phase 3 = 3.x.
const ENGINE_VERSION = '3.0.0';
// game.json / pack-manifest schemaVersion this engine reads. EXACT match
// when declared — a pack authored against a future schema must refuse
// loudly, never half-parse. v2 = the tokens-v2 cutover (A3 slice 2b):
// pure SF_Group names + pack `groups` block. The bump is load-bearing
// BOTH ways: a v1 engine suffix-parses v2 pure names into silent 1x
// multipliers, and this engine reads v1 suffixed names as verbatim
// (undeclared) group names.
const PACK_SCHEMA_VERSION = 2;
// Capability ids this engine implements. A pack's `requires` array (in
// game.json) must be a subset or activation refuses. The v1 baseline
// names what the engine actually runs today; slices 1/2 grow it as
// modes/rules become pack-driven. Unknown id = the pack needs something
// this engine cannot do = LOUD refusal (audit F2: headroom must never be
// silently absorbed).
const ENGINE_CAPABILITIES = new Set([
  'scoring.tabular',      // baseValues × typeMultipliers tables
  'groupRules.all',       // all-of-group completion
  'duplicatePolicy.once', // FCFS session-scoped claims
  'cues.standing',        // event/clock-triggered standing cues (slice 4)
  'cues.timeline',        // compound cue timelines, three-segment clock (slice 4)
  'lighting.roles',       // role-addressed lighting, profile-bound (slice 4)
  'surfaces.select',      // select/parameterize the built-in display surfaces (slice 6)
]);

// Per-mode flag VALUES this engine can drive (A3 slice 1 — mode
// drivability). The game.schema.json flag fields are OPEN strings
// (openness property 2: values gated by engine capability, not closed
// schema enums) — a pack may declare `scoringPolicy: 'graph'` and be
// schema-VALID; THIS engine refuses to activate it here, and a future
// engine that implements graph scoring accepts it with zero schema
// change. These sets grow only when the engine module that drives the
// new value ships (the F2 principle at mode level).
const ENGINE_MODE_CAPS = Object.freeze({
  scoringPolicy: new Set(['standard', 'none']),
  entityRole: new Set(['ledger', 'attribution']),
  surface: new Set(['scoreboard-rankings', 'scoreboard-evidence', 'none']),
  claims: new Set(['consuming', 'non-consuming']), // D3s2: both policies driven
});

// Manifest cache, invalidated on file mtime change (same pattern as the
// asset manifest in resourceRoutes — the manifest is rewritten wholesale
// by build-pack-manifest.js, never edited in place).
let manifestCache = null;
let manifestCacheMtime = null;
let warnedPackPath = false;

// Activation snapshot (see header). activeManifest may legitimately be
// null after activation: a pre-pack checkout stays identity-null for the
// whole process lifetime even if a manifest appears on disk later.
let activated = false;
let activeManifest = null;
let activeGameConfig = null;
let activeStrings = null;
let activeCues = null;
let warnedDriftHash = false;
let warnedLegacyScoring = false;

// Mirrors ALN-TokenData/game.json `scoring` tables — the pre-pack ALN
// game, baked (A3 slice 2, ledger L1 retirement: scoring-config.json is
// gone; a pack without a usable scoring block runs THIS table with a loud
// warn — the same shim doctrine as the L6 mode tables, and a unit drift
// tripwire pins it equal to the real ALN game.json).
const LEGACY_ALN_SCORING = Object.freeze({
  baseValues: Object.freeze({ 1: 10000, 2: 25000, 3: 50000, 4: 75000, 5: 150000 }),
  typeMultipliers: Object.freeze({ Personal: 1, Mention: 3, Business: 3, Party: 5, Technical: 5, UNKNOWN: 0 }),
  semantics: Object.freeze({ allowNegative: true }),
  // R-3b-1 shim twin: the packless engine formats money like ALN, same
  // as its tables (drift-mirrored against the real game.json in tests).
  display: Object.freeze({ unit: 'currency-usd', format: '$#,###' }),
});

/** A usable scoring block has NON-EMPTY value and multiplier tables —
 *  the same guard the scanner's applyPackScoring enforces (an empty
 *  table must never silently zero every token). */
function _isUsableScoring(scoring) {
  return !!scoring
    && scoring.baseValues && Object.keys(scoring.baseValues).length > 0
    && scoring.typeMultipliers && Object.keys(scoring.typeMultipliers).length > 0;
}

/** Normalize a scoring block for engine consumption: numeric rating keys,
 *  EXACT-CASE pack-declared type keys (D2b — tokenService matches
 *  verbatim), always an `UNKNOWN` entry (the null/unrecognized bucket). */
function _normalizeScoring(scoring) {
  return {
    baseValues: Object.fromEntries(
      Object.entries(scoring.baseValues).map(([k, v]) => [parseInt(k, 10), v])
    ),
    // EXACT-CASE keys (A3 slice 2b, D2b): types are pack-declared ids —
    // the backend's old lowercase normalization diverged from the
    // scanner's exact-case lookup (a lowercased vocabulary silently
    // scored 0× standalone-only, the worst divergence class). The
    // scanner's behavior is the canon; the type-coverage gate makes a
    // case-mismatched token REFUSE at boot instead of silently zeroing.
    // UNKNOWN (schema-required) is the null/unrecognized bucket.
    typeMultipliers: {
      UNKNOWN: 0,
      ...scoring.typeMultipliers,
    },
    // D2s2: pack-conditional score floor. Strict === true so a pack that
    // declares scoring but omits semantics gets the conservative floor;
    // the packless shim mirrors ALN (true) like every other shim value.
    allowNegative: !!(scoring.semantics && scoring.semantics.allowNegative === true),
    // R-3b-1: the declared money display spec rides the rules snapshot
    // (the old normalizer DROPPED it — zero readers existed). Kept only
    // when the format is drivable; the activation gate refuses declared
    // undrivable formats, so null here means "nothing declared" and
    // consumers fall back to the baked ALN spec.
    display: (scoring.display && parseMoneyFormat(scoring.display.format))
      ? { unit: scoring.display.unit, format: scoring.display.format }
      : null,
  };
}

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
 * Live disk read of the pack manifest (mtime-cached), independent of
 * activation. Null when missing/unreadable.
 * @returns {Object|null}
 */
function _readDiskManifest() {
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
 * Live disk read of the pack's game.json (rules file). Null when the pack
 * ships none (pre-pack checkouts, tokens-only fixtures) — every consumer
 * must tolerate null; the rules getters (getScoringRules, getClockRules,
 * modeSemantics) fall back to their loud baked legacy shims.
 * @returns {Object|null}
 */
function _readDiskGameConfig() {
  const gamePath = path.join(getPackDir(), 'game.json');
  try {
    return JSON.parse(fs.readFileSync(gamePath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn(`game.json unreadable at ${gamePath}: ${err.message}`);
    }
    return null;
  }
}

/**
 * The pack's TEMPORARY concrete-id fallback for one lighting role
 * (ledger L7 — retires at C4). Null when undeclared. Keeps pack-shape
 * knowledge here, behind a normalized accessor (the getScoringRules
 * idiom); Object.hasOwn so prototype-chain names never resolve (C11).
 * @param {string} role
 * @returns {string|null}
 */
function getLightingRoleFallback(role) {
  const gameConfig = getGameConfig();
  const fallbacks = gameConfig && gameConfig.lightingRoleFallbacks;
  if (!fallbacks || typeof fallbacks !== 'object') return null;
  if (typeof role !== 'string' || !Object.hasOwn(fallbacks, role)) return null;
  const sceneId = fallbacks[role];
  return (typeof sceneId === 'string' && sceneId.length > 0) ? sceneId : null;
}

/**
 * Read the pack's tokens.json, or null when absent/unreadable (the
 * token loader refuses separately). Shared by every gate block that
 * resolves against the token database — one read shape, three readers.
 * @returns {Object|null}
 */
function _readPackTokens() {
  try {
    return JSON.parse(fs.readFileSync(path.join(getPackDir(), 'tokens.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Load and shape-check the declared show-cues sidecar (A3 slice 4 S2).
 * Mirrors _loadDeclaredStrings: declared means present, canonical, and
 * the header form {kind: 'cues', schemaVersion, cues: [...]}. Returns
 * the cues ARRAY on success; rule validation happens in
 * gameRules/cueValidation (the dep-free seam the config-tool shares).
 * @param {Object} gameConfig
 * @returns {{value: Array<Object>|null, problems: string[]}}
 */
function _loadDeclaredCues(gameConfig) {
  const declared = gameConfig && gameConfig.cues;
  if (!declared) return { value: null, problems: [] };

  // Canonical filename is the CONTRACT (game.schema.json const): the
  // manifest role and the engine's pack-file resolution are keyed to
  // 'cues.json'. Hand-authored PACK_PATH packs bypass the schema, so
  // the gate enforces it too.
  if (declared !== 'cues.json') {
    return {
      value: null,
      problems: [`game.json declares cues '${declared}' — the sidecar must be named 'cues.json' (canonical filename contract; manifest role + engine loader are keyed to it)`],
    };
  }

  const cuesPath = path.join(getPackDir(), declared);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  } catch (err) {
    return {
      value: null,
      problems: [`game.json declares cues '${declared}' but ${declared} is unreadable (${err.message})`],
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      value: null,
      problems: [`game.json declares cues '${declared}' but ${declared} is not the header form (a JSON object {kind, schemaVersion, cues: [...]})`],
    };
  }

  const problems = [];
  if (parsed.schemaVersion !== undefined && parsed.schemaVersion !== PACK_SCHEMA_VERSION) {
    problems.push(`${declared} schemaVersion ${parsed.schemaVersion} (engine reads ${PACK_SCHEMA_VERSION})`);
  }
  if (parsed.kind !== undefined && parsed.kind !== 'cues') {
    problems.push(`${declared} kind '${parsed.kind}' (expected 'cues')`);
  }
  if (!Array.isArray(parsed.cues)) {
    problems.push(`${declared} — 'cues' must be an array`);
    return { value: null, problems };
  }
  return { value: problems.length === 0 ? parsed.cues : null, problems };
}

// Slice-6 channel-name shape: lowercase-dash, forbids paths/filenames by
// construction (a dot or slash cannot match), mirroring lightingRoles.
const SURFACE_CHANNEL_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Validate the pack's `surfaces` block (A3 slice 6). PURE, gate-internal
 * (G1/R2): no service reads, no venue-resource checks — the profile
 * binding + VLC resolution happen at fire time (S6.3), never here. The
 * gate cannot assume schema validation ran (hand-authored / PACK_PATH
 * packs), so it re-checks shape. A pack DECLARING `surfaces` must also
 * declare the `surfaces.select` capability in `requires` (the
 * cues.standing / lighting.roles authoring-lint precedent) — otherwise a
 * capability-blind engine would silently ignore the block and run the
 * game's display wrong.
 * @param {Object|null} gameConfig
 * @returns {string[]} problems
 */
function _validateSurfacesBlock(gameConfig) {
  const surfaces = gameConfig && gameConfig.surfaces;
  if (surfaces === undefined) return [];
  const problems = [];
  if (surfaces === null || typeof surfaces !== 'object' || Array.isArray(surfaces)) {
    return [`surfaces must be an object; self-contradictory`];
  }
  // Unknown-key rejection (S6.4 review): the schema is additionalProperties:
  // false, and this gate's contract is "cannot assume schema ran". Refuse
  // typo'd keys (e.g. 'evidenceCyleMs') instead of silently no-opping to
  // the default — a hand-authored/PACK_PATH footgun. Stricter than the
  // legacy blocks by design.
  for (const key of Object.keys(surfaces)) {
    if (key !== 'idleLoop' && key !== 'scoreboard') {
      problems.push(`surfaces has an unknown key '${key}' (allowed: idleLoop, scoreboard); a typo silently no-ops to the default; self-contradictory`);
    }
  }
  const requires = Array.isArray(gameConfig.requires) ? gameConfig.requires : [];
  if (!requires.includes('surfaces.select')) {
    problems.push(
      `surfaces is declared but 'surfaces.select' is missing from requires; ` +
      `an engine without it would activate this pack with its display selection silently ignored; self-contradictory`
    );
  }
  // idleLoop: absent | null (opt-out) | a channel NAME (never a path/filename).
  if (Object.hasOwn(surfaces, 'idleLoop') && surfaces.idleLoop !== null) {
    if (typeof surfaces.idleLoop !== 'string' || !SURFACE_CHANNEL_PATTERN.test(surfaces.idleLoop)) {
      problems.push(
        `surfaces.idleLoop must be a venue-channel NAME (lowercase letters, digits, dashes) or null (opt-out); ` +
        `got ${JSON.stringify(surfaces.idleLoop)} — a filename/path belongs in the installation profile binding, not the pack; self-contradictory`
      );
    }
  }
  // scoreboard: absent | { enabled?, evidenceCycleMs? }.
  if (Object.hasOwn(surfaces, 'scoreboard')) {
    const sb = surfaces.scoreboard;
    if (sb === null || typeof sb !== 'object' || Array.isArray(sb)) {
      problems.push(`surfaces.scoreboard must be an object; self-contradictory`);
    } else {
      for (const key of Object.keys(sb)) {
        if (key !== 'enabled' && key !== 'evidenceCycleMs') {
          problems.push(`surfaces.scoreboard has an unknown key '${key}' (allowed: enabled, evidenceCycleMs); self-contradictory`);
        }
      }
      if (Object.hasOwn(sb, 'enabled') && typeof sb.enabled !== 'boolean') {
        problems.push(`surfaces.scoreboard.enabled must be a boolean; self-contradictory`);
      }
      if (Object.hasOwn(sb, 'evidenceCycleMs')) {
        const ms = sb.evidenceCycleMs;
        if (typeof ms !== 'number' || !Number.isInteger(ms) || ms < 1000) {
          problems.push(
            `surfaces.scoreboard.evidenceCycleMs must be an integer >= 1000 (ms); got ${JSON.stringify(ms)}; self-contradictory`
          );
        }
      }
      // Opt-out coherence (Q6-1): a pack that suppresses the scoreboard
      // surface cannot also declare a mode that renders TO it.
      if (sb.enabled === false && Array.isArray(gameConfig.modes)) {
        const scoreboardModes = gameConfig.modes.filter((m) => {
          const surface = (m && m.displayBehavior && m.displayBehavior.surface) || 'none';
          return typeof surface === 'string' && surface.startsWith('scoreboard');
        });
        if (scoreboardModes.length > 0) {
          const ids = scoreboardModes.map((m) => (m && m.id) || '?').join(', ');
          problems.push(
            `surfaces.scoreboard.enabled is false but mode(s) [${ids}] declare a scoreboard MODE display surface; ` +
            `a suppressed scoreboard has nowhere to render them; self-contradictory`
          );
        }
      }
    }
  }
  return problems;
}

/**
 * Load the pack's DECLARED strings sidecar (A3 slice 3a). Posture:
 * an UNDECLARED file gates nothing (missing strings are benign wording —
 * consumers keep their baked defaults, the opposite class from silent
 * wrong scoring); a DECLARED file must load and validate or activation
 * REFUSES (declared ⇒ must load, the PACK_PATH rule's shape).
 * @param {Object|null} gameConfig
 * @returns {{value: Object|null, problems: string[]}}
 */
function _loadDeclaredStrings(gameConfig) {
  const declared = gameConfig && gameConfig.strings;
  if (!declared) return { value: null, problems: [] };

  // Canonical filename is the CONTRACT (review D, game.schema.json const):
  // manifest role assignment and the scanner's staged-refresh rules set
  // are keyed to 'strings.json' — a divergent pointer would rebrand the
  // backend while the GM scanner silently stayed baked. Hand-authored
  // PACK_PATH packs bypass the schema, so the gate enforces it too.
  if (declared !== 'strings.json') {
    return {
      value: null,
      problems: [`game.json declares strings '${declared}' — the sidecar must be named 'strings.json' (canonical filename contract; manifest role + scanner loader are keyed to it)`],
    };
  }

  const stringsPath = path.join(getPackDir(), declared);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(stringsPath, 'utf8'));
  } catch (err) {
    return {
      value: null,
      problems: [`game.json declares strings '${declared}' but ${declared} is unreadable (${err.message})`],
    };
  }

  // Top-level type guard (the scanner mirror has the same one): JSON
  // null/primitives/arrays parse fine but are not a sidecar — without
  // this, null CRASHED the gate and primitives destructured to an empty
  // sections object and passed silently (declared-but-broken must
  // refuse loudly, never slip through as baked wording).
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      value: null,
      problems: [`game.json declares strings '${declared}' but ${declared} is not a JSON object (sidecar must be {kind, schemaVersion, ...sections})`],
    };
  }

  const problems = [];
  if (parsed.schemaVersion !== undefined && parsed.schemaVersion !== PACK_SCHEMA_VERSION) {
    problems.push(`${declared} schemaVersion ${parsed.schemaVersion} (engine reads ${PACK_SCHEMA_VERSION})`);
  }
  if (parsed.kind !== undefined && parsed.kind !== 'strings') {
    problems.push(`${declared} kind '${parsed.kind}' (expected 'strings')`);
  }
  // Every leaf must be a non-empty string; sections nest arbitrarily.
  const walk = (node, trail) => {
    for (const [key, val] of Object.entries(node)) {
      const here = trail ? `${trail}.${key}` : key;
      if (val && typeof val === 'object' && !Array.isArray(val)) walk(val, here);
      else if (typeof val !== 'string' || val.length === 0) {
        problems.push(`${declared} leaf '${here}' is not a non-empty string (a blank or non-string label is an authoring error)`);
      }
    }
  };
  const { kind, schemaVersion, ...sections } = parsed;
  walk(sections, '');

  return { value: problems.length === 0 ? sections : null, problems };
}

/** Numeric 3-part semver compare: negative when a < b. Pre-release tags
 *  are out of scope for pack versioning (generator never emits them). */
function _compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Capability gate (A3 slice 0, audit F2 + adversarial R6): refuse LOUDLY
 * — by throwing out of activation, which fails the boot — any pack this
 * engine cannot faithfully run. Declared constraints are enforced; the
 * old "declares nothing gates nothing" posture survives ONLY where the
 * silent reading is safe (e.g. capabilities, modes). Since the tokens-v2
 * cutover (slice 2b) two checks are UNCONDITIONAL over any pack with a
 * game.json: groups coverage (an absent block refuses grouped tokens —
 * the silent reading was 1x multipliers) and type coverage when scoring
 * is usable. A game.json-less checkout (pre-pack legacy) still rides the
 * loud shims.
 * @throws {Error} when the pack requires what this engine lacks
 */
function _gateCheck(manifest, gameConfig, cuesLoad, stringsLoad) {
  const problems = [];

  if (manifest) {
    if (manifest.schemaVersion !== undefined && manifest.schemaVersion !== PACK_SCHEMA_VERSION) {
      problems.push(`pack-manifest schemaVersion ${manifest.schemaVersion} (engine reads ${PACK_SCHEMA_VERSION})`);
    }
    const minVersion = manifest.engine && manifest.engine.minVersion;
    if (minVersion && _compareVersions(ENGINE_VERSION, minVersion) < 0) {
      problems.push(`pack requires engine >= ${minVersion} (this engine is ${ENGINE_VERSION})`);
    }
  }

  if (gameConfig) {
    if (gameConfig.schemaVersion !== undefined && gameConfig.schemaVersion !== PACK_SCHEMA_VERSION) {
      problems.push(`game.json schemaVersion ${gameConfig.schemaVersion} (engine reads ${PACK_SCHEMA_VERSION})`);
    }
    if (Array.isArray(gameConfig.requires)) {
      const missing = gameConfig.requires.filter((cap) => !ENGINE_CAPABILITIES.has(cap));
      if (missing.length > 0) {
        problems.push(`pack requires unsupported engine capabilities: ${missing.join(', ')}`);
      }
    }
    // Rules-block drivability (A3 slice 2 §2i/§2j): the engine implements
    // exactly the table both real packs declare — anything else is refused
    // with a named message, never silently ignored. A future variant
    // arrives WITH its enforcement (schema + gate + engine in one change).
    const dp = gameConfig.duplicatePolicy;
    if (dp) {
      if (dp.claim !== undefined && dp.claim !== 'once') {
        problems.push(
          `duplicatePolicy.claim '${dp.claim}' — this engine implements 'once' only ` +
          `(gameRules/duplicatePolicy.js; per-MODE non-consuming claims landed as the ` +
          `modes[].claims flag in D3s2 — pack-LEVEL variants like 'per-entity' still ` +
          `arrive WITH their enforcement, never schema-dead)`
        );
      }
      if (dp.view !== undefined && dp.view !== 'unlimited') {
        problems.push(
          `duplicatePolicy.view '${dp.view}' — this engine implements 'unlimited' only (design §2i)`
        );
      }
    }
    const gr = gameConfig.groupRules;
    if (gr) {
      if (gr.type !== undefined && gr.type !== 'all') {
        problems.push(`groupRules.type '${gr.type}' — slice 2 implements the declared table only ('all')`);
      }
      if (gr.minSize !== undefined && gr.minSize !== 2) {
        problems.push(`groupRules.minSize ${gr.minSize} — slice 2 implements the declared table only (2)`);
      }
      const bf = gr.completion && gr.completion.bonusFormula;
      if (bf !== undefined && bf !== 'multiplier-minus-one-times-base') {
        problems.push(
          `groupRules.completion.bonusFormula '${bf}' — slice 2 implements the declared table only ('multiplier-minus-one-times-base')`
        );
      }
    }
    // Phases coherence + drivability (A3 slice 5 — the D1s2 refusal retired
    // on schedule: the engine now DRIVES multi-phase and trigger-started
    // clocks via gameClockService's derived "latest satisfied start" rule).
    // Residual refusals: (i) structural incoherence — duplicate ids, a
    // time-started phase no later than an earlier-declared one (unreachable
    // under declared-order phasing), malformed entries — worded
    // "self-contradictory"; (ii) drivability — a start.trigger outside the
    // engine's cue trigger vocabulary (the matrix-2.22 authoring contract;
    // phase:changed itself is excluded — a phase cannot start on phase
    // machinery's own event). Absent/empty phases declare nothing and pass.
    const phases = gameConfig.gameClock && gameConfig.gameClock.phases;
    if (Array.isArray(phases) && phases.length > 0) {
      // A declared phases table needs a usable duration or getClockRules'
      // legacy branch silently discards it (review C: gate-validated phases
      // running phase-less would be exactly the silently-absorbed class).
      // Schema already requires duration whenever gameClock exists — only
      // hand-authored PACK_PATH packs can reach this.
      const declaredDuration = gameConfig.gameClock.duration;
      if (!(typeof declaredDuration === 'number' && declaredDuration > 0)) {
        problems.push(
          'gameClock.phases declared without a usable gameClock.duration — the clock cannot serve a ' +
          'phase table it will never run (schema requires duration); self-contradictory'
        );
      }
      // Lazy require: standingEvaluator is a pure evaluation table (logger +
      // gameRules/cueVocabulary only) — acyclic; lazy keeps load order moot.
      // eslint-disable-next-line global-require
      const { EVENT_NORMALIZERS } = require('./cue/standingEvaluator');
      // Excluded from the phase-trigger vocabulary (review B):
      // - phase:changed: phase machinery cannot start on its own event
      // - session:created: its ONLY emission happens while the clock is
      //   stopped (createSession precedes startGame), and handlePhaseTrigger
      //   gates on a running clock — a phase declared on it is silently dead,
      //   the exact class this gate exists to refuse
      const PHASE_TRIGGER_EXCLUDED = new Set(['phase:changed', 'session:created']);
      const triggerVocabulary = new Set(
        Object.keys(EVENT_NORMALIZERS).filter(name => !PHASE_TRIGGER_EXCLUDED.has(name))
      );
      const seenIds = new Set();
      let latestAt = null;
      phases.forEach((p, i) => {
        // Null/malformed entries refuse with a named message, never a raw
        // TypeError (carried over from the D1s2 gate — review finding).
        // Non-EMPTY id/label enforced here for schema-bypassing packs
        // (review E: an id '' persists as phaseId '' which restore's
        // truthiness check reads as absent — the E1 re-seat silently fails)
        if (!p || typeof p !== 'object'
            || typeof p.id !== 'string' || p.id.length === 0
            || typeof p.label !== 'string' || p.label.length === 0
            || !p.start || typeof p.start !== 'object') {
          problems.push(
            `gameClock.phases[${i}] — malformed phase entry (non-empty id, non-empty label, and start are required); self-contradictory`
          );
          return;
        }
        if (seenIds.has(p.id)) {
          problems.push(
            `gameClock.phases — duplicate phase id '${p.id}' is self-contradictory (phases must be uniquely identifiable)`
          );
        }
        seenIds.add(p.id);
        const { at, trigger } = p.start;
        if (typeof at === 'number' && trigger === undefined) {
          // Finite non-negative only (review F): schema says integer >= 0,
          // but hand-authored packs can carry -300 (satisfied before the
          // game starts, reordering the initial phase) or 1e999 → Infinity
          // (a phase the engine can literally never enter)
          if (!Number.isFinite(at) || at < 0) {
            problems.push(
              `gameClock.phases['${p.id}'] — start.at ${at} is not a finite non-negative number of seconds; self-contradictory`
            );
            return;
          }
          if (latestAt !== null && at <= latestAt) {
            problems.push(
              `gameClock.phases['${p.id}'] — start.at ${at} is not after the previous time-started phase (${latestAt}); ` +
              'a later-declared phase starting no later is unreachable under declared-order phasing — self-contradictory'
            );
          }
          latestAt = latestAt === null ? at : Math.max(latestAt, at);
        } else if (typeof trigger === 'string' && trigger.length > 0 && at === undefined) {
          if (!triggerVocabulary.has(trigger)) {
            problems.push(
              `gameClock.phases['${p.id}'] — start.trigger '${trigger}' is not an event this engine emits ` +
              'while the clock runs ' +
              `(phase-trigger vocabulary: ${[...triggerVocabulary].sort().join(', ')}); ` +
              'not driveable by this engine yet'
            );
          }
        } else {
          problems.push(
            `gameClock.phases['${p.id}'] — start must be exactly one of {at: seconds} or {trigger: event}; self-contradictory`
          );
        }
      });
    }
    // Type coverage (A3 slice 2b, D2b): with exact-case lookup, a token
    // whose SF_MemoryType is absent from the pack's own typeMultipliers
    // would silently score 0× — refuse it at boot instead. null types
    // are LEGAL (the UNKNOWN bucket, 3 in ALN production data); packs
    // without a usable scoring block gate nothing (shim path).
    if (_isUsableScoring(gameConfig.scoring)) {
      const tokensForTypes = _readPackTokens();
      if (tokensForTypes) {
        const uncovered = new Set();
        for (const token of Object.values(tokensForTypes)) {
          const t = token.SF_MemoryType;
          // Object.hasOwn (not `in`): a type named 'constructor' would
          // pass an `in` check via the prototype chain, then score NaN
          // downstream (round-2 review C10)
          if (t !== null && t !== undefined && !Object.hasOwn(gameConfig.scoring.typeMultipliers, t)) {
            uncovered.add(t);
          }
        }
        for (const t of uncovered) {
          problems.push(
            `tokens use memory type '${t}' which is not a key of scoring.typeMultipliers — ` +
            'types match EXACT-CASE (D2b); declare the type or fix the tokens'
          );
        }
      }
    }
    // Groups coverage (A3 slice 2b, D1b — UNCONDITIONAL since the v2
    // cutover): every group a token names must be DECLARED in game.json
    // `groups`, the sole multiplier source. An ABSENT block is an empty
    // declaration set, so ANY grouped token refuses — the pre-cutover
    // "declares nothing gates nothing" tolerance retired with the bump
    // to PACK_SCHEMA_VERSION 2 (this engine has no suffix parser; an
    // undeclared name would silently read 1x, the exact silent-drift
    // class D1b exists to kill). v2: SF_Group IS the pure name
    // (tokens.schema.json makes a "(xN)" suffix illegal; the sync is the
    // sole parser of the authoring shorthand — D3b).
    {
      const tokensObj = _readPackTokens();
      if (tokensObj) {
        const declaredGroups = (gameConfig.groups && typeof gameConfig.groups === 'object')
          ? gameConfig.groups
          : {};
        // Declared entries must be USABLE: an integer multiplier >= 1
        // (schema-required, but the gate cannot assume schema validation
        // ran — a malformed entry would flow NaN into every bonus)
        for (const [gname, entry] of Object.entries(declaredGroups)) {
          if (!entry || !Number.isInteger(entry.multiplier) || entry.multiplier < 1) {
            problems.push(
              `game.json groups['${gname}'] has no usable multiplier ` +
              `(integer >= 1 required; got ${JSON.stringify(entry && entry.multiplier)})`
            );
          }
        }
        const undeclared = new Set();
        for (const token of Object.values(tokensObj)) {
          const name = (token.SF_Group || '').trim();
          // Object.hasOwn (not truthy-index): a group named 'constructor'
          // would resolve via the prototype chain (round-2 review C11)
          if (name && !Object.hasOwn(declaredGroups, name)) undeclared.add(name);
        }
        for (const name of undeclared) {
          problems.push(
            `tokens name group '${name}' which is not declared in game.json groups — ` +
            'group multipliers are pack rules (D1b); declare the group or fix the token'
          );
        }
      }
    }
    // Money display drivability (A3 slice 3b, R-3b-1 — the gate twin of
    // the game.schema.json format pattern): a declared format the engine
    // cannot parse must refuse loudly, never half-render. Absent
    // display/format gates nothing (baked ALN spec).
    if (gameConfig.scoring && gameConfig.scoring.display
        && gameConfig.scoring.display.format !== undefined
        && !parseMoneyFormat(gameConfig.scoring.display.format)) {
      problems.push(
        `scoring.display.format ${JSON.stringify(gameConfig.scoring.display.format)} is not drivable — `
        + `the engine renders exactly one '#,###' number token wrapped by literal affixes `
        + `(e.g. "$#,###", "#,### cr")`
      );
    }
    // Strings sidecar (A3 slice 3a): declared ⇒ must load + validate.
    // Use the SINGLE hoisted read (S6 review, F1-sec) so the gate
    // validates the exact bytes activatePack freezes; a caller that
    // passed nothing falls back to a fresh read (backward-compat).
    const stringsCheck = stringsLoad || _loadDeclaredStrings(gameConfig);
    for (const prob of stringsCheck.problems) {
      problems.push(prob);
    }
    // Show-cues gate (A3 slice 4 S2 — D-4.3). Pack-internal PURE reads
    // only: activation is the FIRST act of initializeServices, every
    // service is health-seeded down, and referenced venue files may
    // exist only on the venue machine — so nothing here touches a
    // service or checks a venue resource (that stays at preflight,
    // C1 §3 item 5). Rules 1-7 live in gameRules/cueValidation, the
    // dep-free seam the config-tool imports directly at S4 (the
    // writeScoring precedent). Runs even with NO cues file: rule 5
    // (fallbacks ⊆ roles) and the rule-6 requires lint are file-less.
    {
      // The SINGLE hoisted cues read (S6 review, F1-sec): the gate MUST
      // validate the exact array activatePack freezes and the engine
      // runs. Reading here AND again at freeze let a cues.json swapped
      // between the two reads pass the gate but execute unvalidated
      // (a FIFO/rename primitive an Opus refuter demonstrated reaching
      // session:end / score:adjust / transaction:delete).
      const cuesCheck = cuesLoad || _loadDeclaredCues(gameConfig);
      problems.push(...cuesCheck.problems);
      // Absent tokens.json: the token loader refuses separately; rule 3
      // then has nothing to resolve against.
      problems.push(...validateCuesBlock(cuesCheck.value, gameConfig, _readPackTokens() || {}));
    }
    // Display-surfaces gate (A3 slice 6 — pure, gate-internal): shape +
    // the surfaces.select requires-lint. Runs file-less (surfaces lives
    // in game.json, no sidecar).
    problems.push(..._validateSurfacesBlock(gameConfig));
    // Mode drivability (slice 1): every declared mode's flag VALUES must
    // be in the engine's implemented sets — schema-open, gate-enforced.
    if (Array.isArray(gameConfig.modes)) {
      for (const mode of gameConfig.modes) {
        const undrivable = [];
        if (!ENGINE_MODE_CAPS.scoringPolicy.has(mode.scoringPolicy)) {
          undrivable.push(`scoringPolicy '${mode.scoringPolicy}'`);
        }
        if (!ENGINE_MODE_CAPS.entityRole.has(mode.entityRole)) {
          undrivable.push(`entityRole '${mode.entityRole}'`);
        }
        const surface = (mode.displayBehavior && mode.displayBehavior.surface) || 'none';
        if (!ENGINE_MODE_CAPS.surface.has(surface)) {
          undrivable.push(`displayBehavior.surface '${surface}'`);
        }
        // claims is OPTIONAL (absent normalizes to 'consuming' — the
        // legacy behavior), so only a DECLARED unknown value is undrivable
        const claims = mode.claims === undefined ? 'consuming' : mode.claims;
        if (!ENGINE_MODE_CAPS.claims.has(claims)) {
          undrivable.push(`claims '${claims}'`);
        }
        // Presentation fields (R-Q2 #5, the strings-class refusal twins):
        // ABSENT gates nothing (engine-generic fallback), but a DECLARED
        // value the resolver would decline must refuse loudly here — the
        // scanner mirrors with a DECLINE-not-fail, since it never passes
        // this gate.
        if (mode.claimedLabel !== undefined && normalizedClaimedLabel(mode.claimedLabel) === null) {
          undrivable.push(
            `claimedLabel ${JSON.stringify(mode.claimedLabel)} (a template with exactly one {entity} and no other braces required)`
          );
        }
        if (mode.icon !== undefined && normalizedIcon(mode.icon) === null) {
          undrivable.push(
            `icon ${JSON.stringify(mode.icon)} (1-4 plain text glyphs, no markup characters — icons render as content, never as class keys)`
          );
        }
        if (undrivable.length > 0) {
          problems.push(`mode '${mode.id}' is not driveable by this engine: ${undrivable.join(', ')} not implemented`);
        }
      }
    }
    // Entity label (Q1, same refusal-twin posture): absent gates nothing
    // (baked Team/Teams); a declared-but-unusable label refuses.
    if (gameConfig.entities && gameConfig.entities.label !== undefined
        && normalizedEntityLabel(gameConfig.entities.label) === null) {
      problems.push(
        `entities.label ${JSON.stringify(gameConfig.entities.label)} is not usable — ` +
        'non-empty singular AND plural strings required'
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `CAPABILITY GATE: refusing to activate pack ` +
      `${manifest ? `${manifest.packId} v${manifest.version}` : `at ${getPackDir()}`} — ` +
      problems.join('; ') +
      '. The engine will NOT silently run a pack it cannot drive; upgrade the engine or fix the pack.'
    );
  }
}

/**
 * Coherence validator (A3 slice 1, adversarial R9 refined 2026-07-18 by
 * the owner's two-flavor ratification — design doc §4). Runs at
 * activation beside the gate; both flavors hard-refuse (D3), but they
 * have different LIFETIMES and deliberately different language:
 *
 * Flavor (i) — SELF-CONTRADICTIONS (timeless; these rules never retire):
 *   empty declared modes array · duplicate mode ids · defaultEntity on an
 *   entityRole:'ledger' mode (prefilling a wallet name is cross-wired
 *   semantics).
 *
 * Flavor (ii) — DRIVABILITY LIMITATIONS (gate family; each carries a
 *   NAMED retirement and must NEVER be called incoherent). The founding
 *   member — scoringPolicy:'none' ∧ countsTowardGroups — RETIRED ON
 *   SCHEDULE in slice 2: gameRules/scoring's §2f scored-only contribution
 *   semantics landed (completion counts any counting claim; the bonus
 *   base sums only scored contributions), so unscored claims can no
 *   longer mint catalog-priced bonuses and event-only groups are legal.
 *   CURRENT member (D3s2 v1 constraint): claims:'non-consuming' ∧
 *   countsTowardGroups — a non-consumed claim never registers with the
 *   duplicate rules, so what "presence in a group" means for a
 *   repeatable action (count once? every scan? survives deletion how?)
 *   needs its own contribution-semantics design before the engine can
 *   drive it. RETIREMENT: that design, when a pack wants the combination.
 *
 * Deliberately LEGAL (documented so nobody "fixes" them):
 *   entityRole:'attribution' ∧ scoringPolicy:'standard' (future
 *   scored-attributed modes) · displayBehavior.surface:'none' with any
 *   scoringPolicy (silent modes are a real design tool) ·
 *   scoringPolicy:'none' ∧ entityRole:'ledger' (D2 consuming-appraise) ·
 *   scoringPolicy:'none' ∧ countsTowardGroups (event-only groups, since
 *   the §2f retirement).
 *
 * An ABSENT modes block is tolerated (nothing declared gates nothing —
 * the modeSemantics L6 shim covers it); a DECLARED-but-empty one is a
 * contradiction.
 * @throws {Error} on any flavor-(i) contradiction or flavor-(ii) limitation
 */
function _coherenceCheck(gameConfig) {
  if (!gameConfig) return;

  // DECLARED-but-unusable scoring is a contradiction (same doctrine as
  // declared-but-empty modes): a pack that ships a scoring block with
  // missing/empty tables would silently run the baked ALN economy behind
  // one scrolling warn — refuse at boot instead (review finding). An
  // ABSENT scoring block stays legal: packless checkouts and rules-only
  // fixtures ride the loud shim by design.
  if (gameConfig.scoring !== undefined && !_isUsableScoring(gameConfig.scoring)) {
    throw new Error(
      `COHERENCE CHECK: refusing to activate pack at ${getPackDir()} — ` +
      'self-contradictory pack: the scoring block is DECLARED but has missing/empty ' +
      'baseValues or typeMultipliers; a declared economy must be usable (omit the ' +
      'block entirely to run the legacy shim).'
    );
  }

  if (!Array.isArray(gameConfig.modes)) return;

  // Two problem channels, deliberately separate (the ratified language
  // rule): contradictions say "self-contradictory"; limitations use
  // gate-family wording with a NAMED retirement and NEVER "incoherent".
  const contradictions = [];
  const limitations = [];

  if (gameConfig.modes.length === 0) {
    contradictions.push('the modes array is EMPTY — a pack that declares modes must declare at least one');
  }

  const seen = new Set();
  for (const mode of gameConfig.modes) {
    if (seen.has(mode.id)) {
      contradictions.push(`duplicate mode id '${mode.id}'`);
    }
    seen.add(mode.id);

    if (mode.defaultEntity && mode.entityRole === 'ledger') {
      contradictions.push(
        `mode '${mode.id}' sets defaultEntity with entityRole 'ledger' — prefilling a wallet name is cross-wired semantics`
      );
    }

    // (The none∧countsTowardGroups flavor-(ii) refusal that lived here
    // was DELETED in slice 2 — see the header. Event-only groups are
    // legal now that the bonus base sums only scored contributions.)

    // Flavor (ii), D3s2 v1 constraint: a non-consuming claim never
    // registers, so group presence for a repeatable action has no
    // defined contribution semantics yet (see header for the named
    // retirement). Legal design, undrivable engine — say so honestly.
    if (mode.claims === 'non-consuming' && mode.countsTowardGroups === true) {
      limitations.push(
        `mode '${mode.id}' combines claims 'non-consuming' with countsTowardGroups — ` +
        'not driveable by this engine yet (non-consumed presence in group completion ' +
        "needs its own contribution-semantics design); declare countsTowardGroups: false " +
        "or claims: 'consuming'"
      );
    }
  }

  if (contradictions.length > 0) {
    throw new Error(
      `COHERENCE CHECK: refusing to activate pack at ${getPackDir()} — ` +
      `self-contradictory pack: ${contradictions.join('; ')}.`
    );
  }
  if (limitations.length > 0) {
    throw new Error(
      `COHERENCE CHECK: refusing to activate pack at ${getPackDir()} — ` +
      `${limitations.join('; ')}.`
    );
  }
}

/**
 * Freeze the pack the engine is RUNNING. Called by initializeServices()
 * at the same moment tokenService loads token data, so the advertised
 * identity always describes the loaded pack — never a directory that
 * changed after boot (the F-TOOL-05 class, inverted).
 * @returns {{packId: string, version: string, contentHash: string}|null}
 */
function activatePack() {
  const manifest = _readDiskManifest();
  const gameConfig = _readDiskGameConfig();
  // Read the declared sidecars ONCE (S6 review, F1-sec) and reuse the
  // SAME parsed objects for both the gate and the freeze — the gate's
  // guarantee is meaningless if it validates a different read than the
  // one the engine runs (a disk swap between two reads, or a sync
  // landing mid-boot, would otherwise execute unvalidated cues).
  const cuesLoad = _loadDeclaredCues(gameConfig);
  const stringsLoad = _loadDeclaredStrings(gameConfig);
  _gateCheck(manifest, gameConfig, cuesLoad, stringsLoad); // throws = boot fails, by design
  _coherenceCheck(gameConfig);      // throws = boot fails, by design (D3)
  activeManifest = manifest;
  activeGameConfig = gameConfig;
  activeStrings = stringsLoad.value;
  activeCues = cuesLoad.value;
  activated = true;
  warnedDriftHash = false;
  _cachedScoringRules = null;
  if (activeManifest) {
    logger.info(`Pack ACTIVATED: ${activeManifest.packId} v${activeManifest.version} (${activeManifest.contentHash})`);
  } else {
    logger.warn('Pack activation: no readable pack-manifest.json in the active pack directory — pack identity is null (pre-pack checkout)');
  }
  return getActivePackInfo();
}

/**
 * The ACTIVE pack's manifest: the activation snapshot once activated
 * (with a loud drift warn when the directory has moved on underneath the
 * running engine), else the live disk state. Null when the pack has no
 * manifest.
 * @returns {Object|null}
 */
function getManifest() {
  if (!activated) return _readDiskManifest();
  const disk = _readDiskManifest();
  const diskHash = disk ? disk.contentHash : null;
  const activeHash = activeManifest ? activeManifest.contentHash : null;
  if (diskHash === activeHash) {
    warnedDriftHash = false;
  } else if (!warnedDriftHash) {
    warnedDriftHash = true;
    logger.warn(
      `Pack on disk (${diskHash || 'none'}) differs from the ACTIVE pack (${activeHash || 'none'}) — ` +
      'the running engine keeps its loaded pack; restart the orchestrator to activate the new one.'
    );
  }
  return activeManifest;
}

/**
 * The ACTIVE pack's game.json: the activation snapshot once activated
 * (rules are frozen for the process lifetime, same as the manifest —
 * disk drift is surfaced by getManifest()'s warn), else the live disk
 * state. Null when the pack ships no game.json. Consumers: the slice-0
 * capability gate today; the slice-2 rules migration + the one-auth
 * grant computation next (audit F4 — one accessor serves all three).
 * @returns {Object|null}
 */
function getGameConfig() {
  if (!activated) return _readDiskGameConfig();
  return activeGameConfig;
}

/**
 * The ACTIVE pack's declared display strings (A3 slice 3a): the
 * activation snapshot once activated (session wording freezes with the
 * rules), else a live disk read. NULL when the pack declares no strings
 * file — every consumer keeps its baked default wording.
 * @returns {Object|null} sections object (kind/schemaVersion stripped)
 */
function getStrings() {
  if (!activated) return _loadDeclaredStrings(_readDiskGameConfig()).value;
  return activeStrings;
}

/**
 * The ACTIVE pack's show cues (A3 slice 4 S4): the parsed cues array,
 * frozen at activation like every other pack read — a cues file edited
 * on disk mid-run is ignored until restart. Null when the pack declares
 * no cues (benign emptiness: the engine loads an empty cue set) or the
 * declared file is broken (the gate refused activation in that case, so
 * post-activation null means undeclared). Before activation, reads fall
 * through to live disk for selective-init harnesses.
 * @returns {Array<Object>|null}
 */
function getCues() {
  if (!activated) return _loadDeclaredCues(getGameConfig()).value;
  return activeCues;
}

/**
 * The ACTIVE pack's scoring tables, normalized for the engine (A3 slice 2
 * — the backend's rules read; retires ledger L1's scoring-config.json).
 * Snapshot semantics ride getGameConfig(): frozen at activation, live
 * pre-activation. A pack without a USABLE scoring block (absent game.json,
 * missing/empty tables) runs the baked legacy ALN tables with a LOUD
 * once-per-process warn — never a silent zero.
 * @returns {{baseValues: Object, typeMultipliers: Object, allowNegative: boolean}}
 */
let _cachedScoringRules = null;

function getScoringRules() {
  // Activation-frozen memo: post-activation the snapshot cannot change,
  // so normalize once (calculateTokenValue calls this per token during
  // the full token load). Pre-activation reads stay live (uncached).
  if (activated && _cachedScoringRules) {
    return _cachedScoringRules;
  }
  const gameConfig = getGameConfig();
  const scoring = gameConfig && gameConfig.scoring;
  if (_isUsableScoring(scoring)) {
    const rules = _normalizeScoring(scoring);
    if (activated) _cachedScoringRules = rules;
    return rules;
  }
  if (!warnedLegacyScoring) {
    warnedLegacyScoring = true;
    logger.warn(
      'LEGACY SCORING TABLES ACTIVE (debt ledger L1 shim): the active pack ships no usable ' +
      'game.json scoring block — token values are running on the baked ALN tables. ' +
      'Fine for pre-pack checkouts; a real pack should declare its scoring.'
    );
  }
  const rules = _normalizeScoring(LEGACY_ALN_SCORING);
  if (activated) _cachedScoringRules = rules;
  return rules;
}

let warnedLegacyClock = false;

/**
 * The ACTIVE pack's game-clock parameters in SECONDS (A3 slice 2 —
 * consumes gameClock.duration/overtimeAt, deleting the masking contract
 * pin; audit F2's "toy pack already diverges silently" ends here).
 * Snapshot semantics ride getGameConfig(). A pack without a usable
 * gameClock block falls back to config.session.sessionTimeout (minutes,
 * env-tunable) for BOTH values — the pre-pack behavior, where overtime
 * fires exactly at expected duration — with a LOUD once-per-process warn.
 * A3 slice 5 (B11): also serves the DECLARED phases table verbatim
 * (defensive copy), or null when the pack declares none / the legacy
 * fallback is active — the degenerate-inert rule lives clock-side
 * (gameClockService.setPhases), not here.
 * @returns {{durationSeconds: number, overtimeAtSeconds: number,
 *   phases: Array<{id: string, label: string, start: Object}>|null}}
 */
let warnedIgnoredSessionTimeout = false;

function getClockRules() {
  const gameConfig = getGameConfig();
  const clock = gameConfig && gameConfig.gameClock;
  if (clock && typeof clock.duration === 'number' && clock.duration > 0) {
    // The pack clock is authoritative — but SESSION_TIMEOUT was the
    // operator's knob for years, and silently ignoring a set-and-
    // differing value would burn a real event (review finding: overtime
    // firing 30 min late with zero log output). Loud, once.
    if (!warnedIgnoredSessionTimeout) {
      // eslint-disable-next-line global-require
      const config = require('../config');
      const envSeconds = config.session.sessionTimeout * 60;
      if (envSeconds !== clock.duration) {
        warnedIgnoredSessionTimeout = true;
        logger.warn(
          `SESSION_TIMEOUT (${config.session.sessionTimeout} min) is IGNORED: the active pack declares ` +
          `gameClock.duration=${clock.duration}s, which is authoritative since A3 slice 2. ` +
          'Edit the pack\'s game.json to change game duration.'
        );
      }
    }
    return {
      durationSeconds: clock.duration,
      overtimeAtSeconds: (typeof clock.overtimeAt === 'number' && clock.overtimeAt > 0)
        ? clock.overtimeAt
        : clock.duration,
      phases: Array.isArray(clock.phases) && clock.phases.length > 0
        ? clock.phases.map(p => ({ id: p.id, label: p.label, start: { ...(p.start || {}) } }))
        : null,
    };
  }
  if (!warnedLegacyClock) {
    warnedLegacyClock = true;
    logger.warn(
      'LEGACY CLOCK CONFIG ACTIVE: the active pack ships no usable game.json gameClock block — ' +
      'game duration/overtime are running on SESSION_TIMEOUT. Fine for pre-pack checkouts; ' +
      'a real pack should declare its clock.'
    );
  }
  // Lazy require: config never imports packService, so this stays acyclic;
  // lazy keeps module-load order irrelevant.
  const config = require('../config');
  const fallbackSeconds = config.session.sessionTimeout * 60;
  return { durationSeconds: fallbackSeconds, overtimeAtSeconds: fallbackSeconds, phases: null };
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
 * Test-only: drop the manifest cache, the activation snapshot, and the
 * warn latches.
 */
function _resetForTesting() {
  manifestCache = null;
  manifestCacheMtime = null;
  warnedPackPath = false;
  activated = false;
  activeManifest = null;
  activeGameConfig = null;
  activeStrings = null;
  activeCues = null;
  warnedDriftHash = false;
  warnedLegacyScoring = false;
  warnedLegacyClock = false;
  warnedIgnoredSessionTimeout = false;
  _cachedScoringRules = null;
}

module.exports = { getPackDir, getManifest, getGameConfig, getStrings, getCues, getScoringRules, getClockRules, getLightingRoleFallback, getActivePackInfo, resolvePackFile, activatePack, ENGINE_VERSION, PACK_SCHEMA_VERSION, ENGINE_CAPABILITIES, ENGINE_MODE_CAPS, LEGACY_ALN_SCORING, _resetForTesting };
