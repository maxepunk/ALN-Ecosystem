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
 * must tolerate null through the L1 transitional window (backend rules
 * still come from scoring-config.json until slice 2).
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
 *   NAMED retirement and must NEVER be called incoherent):
 *   scoringPolicy:'none' ∧ countsTowardGroups — a legitimate
 *   event-only-groups design (group:completed already feeds the cue
 *   engine), blocked ONLY because groupBonusAmount computes from token
 *   CATALOG values, so unscored claims completing a group would mint a
 *   full catalog-priced bonus. RETIRES in slice 2: scored-only
 *   contribution semantics land, then this refusal is DELETED.
 *
 * Deliberately LEGAL (documented so nobody "fixes" them):
 *   entityRole:'attribution' ∧ scoringPolicy:'standard' (future
 *   scored-attributed modes) · displayBehavior.surface:'none' with any
 *   scoringPolicy (silent modes are a real design tool) ·
 *   scoringPolicy:'none' ∧ entityRole:'ledger' (D2 consuming-appraise).
 *
 * An ABSENT modes block is tolerated (nothing declared gates nothing —
 * the modeSemantics L6 shim covers it); a DECLARED-but-empty one is a
 * contradiction.
 * @throws {Error} on any flavor-(i) contradiction or flavor-(ii) limitation
 */
function _coherenceCheck(gameConfig) {
  if (!gameConfig || !Array.isArray(gameConfig.modes)) return;

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

    if (mode.scoringPolicy === 'none' && mode.countsTowardGroups === true) {
      limitations.push(
        `mode '${mode.id}' combines scoringPolicy 'none' with countsTowardGroups — ` +
        'not driveable by this engine yet (see slice 2): group bonuses compute from token catalog values, ' +
        'so unscored claims completing a group would mint money; slice 2 defines scored-only contribution ' +
        'semantics and deletes this refusal'
      );
    }
  }

  const problems = [];
  if (contradictions.length > 0) {
    problems.push(`self-contradictory pack: ${contradictions.join('; ')}`);
  }
  if (limitations.length > 0) {
    problems.push(`engine drivability limitation: ${limitations.join('; ')}`);
  }
  if (problems.length > 0) {
    throw new Error(
      `COHERENCE CHECK: refusing to activate pack at ${getPackDir()} — ${problems.join(' — ')}.`
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
}

module.exports = { getPackDir, getManifest, getGameConfig, getActivePackInfo, resolvePackFile, activatePack, ENGINE_VERSION, PACK_SCHEMA_VERSION, ENGINE_CAPABILITIES, ENGINE_MODE_CAPS, _resetForTesting };
