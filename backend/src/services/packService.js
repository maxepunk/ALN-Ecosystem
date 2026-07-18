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

const DEFAULT_PACK_DIR = path.join(__dirname, '../../../ALN-TokenData');

// ── Capability gate constants (Phase 3 A3 slice 0) ─────────────────────
// ENGINE_VERSION is the PACK-INTERFACE version (what pack-manifest
// `engine.minVersion` compares against), deliberately decoupled from the
// npm package version: it bumps when the engine's pack-consuming
// capabilities change, nothing else. Phase 3 = 3.x.
const ENGINE_VERSION = '3.0.0';
// game.json / pack-manifest schemaVersion this engine reads. EXACT match
// when declared — a pack authored against a future schema must refuse
// loudly, never half-parse.
const PACK_SCHEMA_VERSION = 1;
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
 *  LOWERCASED type keys (tokenService lowercases lookups), always an
 *  `unknown` entry. */
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
 * engine cannot faithfully run. Nothing is checked for a pack that
 * declares nothing (pre-pack checkouts and v1 packs activate exactly as
 * before); every declared constraint is enforced.
 * @throws {Error} when the pack requires what this engine lacks
 */
function _gateCheck(manifest, gameConfig) {
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
    // Phases drivability (A3 slice 2 §2g, owner ruling D1s2): the engine
    // reads gameClock.duration/overtimeAt but drives NO phase machinery —
    // anything beyond the degenerate single-phase-at-0 is declared
    // headroom the doctrine refuses. Flavor-ii family: a NAMED retirement
    // ("see slice 5" — program §3: phases + trigger-starts land there),
    // never "incoherent". Absent/empty phases declare nothing and pass.
    const phases = gameConfig.gameClock && gameConfig.gameClock.phases;
    if (Array.isArray(phases) && phases.length > 0) {
      // Null/malformed entries are NOT degenerate (they refuse with the
      // named message below, never a raw TypeError — review finding)
      const p = phases[0];
      const degenerate =
        phases.length === 1 &&
        !!p && !!p.start && p.start.at === 0 &&
        p.start.trigger === undefined;
      if (!degenerate) {
        problems.push(
          `gameClock.phases (${phases.length} phase${phases.length === 1 ? '' : 's'}) — ` +
          'multi-phase and trigger-started clocks are not driveable by this engine yet (see slice 5); ' +
          'the engine drives only the degenerate single-phase-at-0'
        );
      }
    }
    // Type coverage (A3 slice 2b, D2b): with exact-case lookup, a token
    // whose SF_MemoryType is absent from the pack's own typeMultipliers
    // would silently score 0× — refuse it at boot instead. null types
    // are LEGAL (the UNKNOWN bucket, 3 in ALN production data); packs
    // without a usable scoring block gate nothing (shim path).
    if (_isUsableScoring(gameConfig.scoring)) {
      let tokensForTypes = null;
      try {
        tokensForTypes = JSON.parse(fs.readFileSync(path.join(getPackDir(), 'tokens.json'), 'utf8'));
      } catch { /* no tokens.json — the loader refuses separately */ }
      if (tokensForTypes) {
        const uncovered = new Set();
        for (const token of Object.values(tokensForTypes)) {
          const t = token.SF_MemoryType;
          if (t !== null && t !== undefined && !(t in gameConfig.scoring.typeMultipliers)) {
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
    // Groups coverage (A3 slice 2b, D1b): a pack that DECLARES a groups
    // block must declare every group its tokens name — an undeclared
    // name would silently read a 1x multiplier, exactly the split-source
    // drift the block exists to kill. v2: SF_Group IS the pure name
    // (tokens.schema.json makes a "(xN)" suffix illegal; the sync is the
    // sole parser of the authoring shorthand — D3b).
    if (gameConfig.groups && typeof gameConfig.groups === 'object') {
      let tokensObj = null;
      try {
        tokensObj = JSON.parse(fs.readFileSync(path.join(getPackDir(), 'tokens.json'), 'utf8'));
      } catch { /* no tokens.json — the loader refuses separately */ }
      if (tokensObj) {
        const undeclared = new Set();
        for (const token of Object.values(tokensObj)) {
          const name = (token.SF_Group || '').trim();
          if (name && !gameConfig.groups[name]) undeclared.add(name);
        }
        for (const name of undeclared) {
          problems.push(
            `tokens name group '${name}' which is not declared in game.json groups — ` +
            'group multipliers are pack rules (D1b); declare the group or fix the token'
          );
        }
      }
    }
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
        if (undrivable.length > 0) {
          problems.push(`mode '${mode.id}' is not driveable by this engine: ${undrivable.join(', ')} not implemented`);
        }
      }
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
  _gateCheck(manifest, gameConfig); // throws = boot fails, by design
  _coherenceCheck(gameConfig);      // throws = boot fails, by design (D3)
  activeManifest = manifest;
  activeGameConfig = gameConfig;
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
 * @returns {{durationSeconds: number, overtimeAtSeconds: number}}
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
  return { durationSeconds: fallbackSeconds, overtimeAtSeconds: fallbackSeconds };
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
  warnedDriftHash = false;
  warnedLegacyScoring = false;
  warnedLegacyClock = false;
  warnedIgnoredSessionTimeout = false;
  _cachedScoringRules = null;
}

module.exports = { getPackDir, getManifest, getGameConfig, getScoringRules, getClockRules, getActivePackInfo, resolvePackFile, activatePack, ENGINE_VERSION, PACK_SCHEMA_VERSION, ENGINE_CAPABILITIES, ENGINE_MODE_CAPS, LEGACY_ALN_SCORING, _resetForTesting };
