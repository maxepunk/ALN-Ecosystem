/**
 * Profile Service — the active installation profile (A3 slice 4 S3)
 *
 * The installation profile is the venue document (C1, ratified
 * 2026-08-22): what is installed for one event and how the pack's
 * abstract names bind to physical things. This service loads ONE
 * profile at boot and freezes it (the packService template): the
 * PROFILE_PATH env override, else the in-repo ALN full-kit profile
 * (owner answer OQ6). Before activation, reads fall through to live
 * disk for selective-init test harnesses.
 *
 * v1 reads kind, schemaVersion, profileId, forPack, and
 * bindings.lighting — nothing else. Every other section passes through
 * unread (no duplication of routing.json; C2/C3 consume the rest as
 * they build).
 *
 * The profile is VENUE config, never pack content. A missing or broken
 * profile is the degrade class: it warns loudly and every role resolves
 * unbound — it never kills the orchestrator. The preflight (C2) is the
 * go/no-go instrument for unbound roles; at fire time an unbound role
 * falls to the pack's lightingRoleFallbacks, then fails on the
 * cue:error channel (D-4.4).
 *
 * Function exports, no class (packService/tokenService style).
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DEFAULT_PROFILE_PATH = path.join(__dirname, '../../config/profiles/aln-full-kit.json');

/** The profile schemaVersion this engine reads (exact match). */
const PROFILE_SCHEMA_VERSION = 1;

let warnedProfilePath = false;
let activated = false;
let activeProfile = null;
let activeProfileMtime = null;
let warnedProfileDrift = false;

/**
 * The active profile file path: PROFILE_PATH override (loud warn once)
 * or the in-repo default.
 * @returns {string}
 */
function getProfilePath() {
  const override = process.env.PROFILE_PATH;
  if (override) {
    if (!warnedProfilePath) {
      warnedProfilePath = true;
      logger.warn(
        `PROFILE_PATH override ACTIVE: serving installation profile from ${path.resolve(override)} ` +
        '(not the in-repo default) — fine for tests/preview, wrong for production'
      );
    }
    return path.resolve(override);
  }
  return DEFAULT_PROFILE_PATH;
}

/**
 * Read and shape-check the profile from disk. Returns null (with a loud
 * warn) on any problem — the degrade class, never a boot failure.
 * @returns {Object|null}
 */
function _readProfile() {
  const profilePath = getProfilePath();
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  } catch (err) {
    logger.warn(
      `Installation profile unreadable at ${profilePath}: ${err.message} — ` +
      'every lighting role resolves UNBOUND (falls to pack lightingRoleFallbacks, then cue:error)'
    );
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    logger.warn(`Installation profile at ${profilePath} is not a JSON object — treating as absent`);
    return null;
  }
  if (parsed.kind !== 'installation-profile') {
    logger.warn(
      `Installation profile at ${profilePath} has kind '${parsed.kind}' ` +
      "(expected 'installation-profile') — treating as absent"
    );
    return null;
  }
  if (parsed.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    logger.warn(
      `Installation profile at ${profilePath} has schemaVersion ${parsed.schemaVersion} ` +
      `(engine reads ${PROFILE_SCHEMA_VERSION}) — treating as absent`
    );
    return null;
  }
  return parsed;
}

/**
 * Adopt the profile for the life of the process (called beside
 * activatePack at boot). Never throws: a broken venue profile degrades,
 * it does not kill the orchestrator.
 */
function activateProfile() {
  activeProfile = _readProfile();
  activated = true;
  warnedProfileDrift = false; // re-arm the drift warn for the new snapshot (mirrors packService.activatePack)
  try {
    activeProfileMtime = fs.statSync(getProfilePath()).mtimeMs;
  } catch {
    activeProfileMtime = null;
  }
  if (activeProfile) {
    const bound = Object.keys((activeProfile.bindings && activeProfile.bindings.lighting) || {}).length;
    logger.info(
      `Installation profile ACTIVE: ${activeProfile.profileId} ` +
      `(${bound} lighting binding${bound === 1 ? '' : 's'}, frozen for process lifetime)`
    );
  }
  return getProfileInfo();
}

/**
 * The frozen profile (or a live read before activation). Null when
 * absent or broken.
 * @returns {Object|null}
 */
function getProfile() {
  if (activated) {
    // Drift parity with packService (S6 review, F2-state): an operator
    // who edits the profile mid-run gets ONE loud warn that the running
    // system keeps its boot snapshot — never a silent no-op. The warn
    // must RE-ARM when disk returns to the boot snapshot, exactly as
    // packService.getManifest re-arms warnedDriftHash; before this fix
    // the latch was one-way, so a second real edit after a revert went
    // silent — the opposite of what the "parity" comment claimed.
    let currentMtime = null;
    try {
      currentMtime = fs.statSync(getProfilePath()).mtimeMs;
    } catch { /* deleted counts as drift too */ }
    if (currentMtime === activeProfileMtime) {
      warnedProfileDrift = false; // disk matches the boot snapshot again — re-arm
    } else if (!warnedProfileDrift) {
      warnedProfileDrift = true;
      logger.warn(
        `Installation profile at ${getProfilePath()} changed on disk after activation — ` +
        'the running system keeps the boot snapshot; restart the orchestrator to adopt the edit'
      );
    }
    return activeProfile;
  }
  return _readProfile();
}

/**
 * Resolve a lighting role to its bound concrete scene id, or null when
 * the role is unbound. v1 drives the `ha` provider only — a binding
 * declaring another provider resolves null (D-4.5 skip clause).
 * Object.hasOwn: a role named 'constructor' must not resolve off the
 * prototype chain (C11 class).
 * @param {string} role
 * @returns {string|null}
 */
function getLightingBinding(role) {
  const profile = getProfile();
  const lighting = profile && profile.bindings && profile.bindings.lighting;
  if (!lighting || typeof lighting !== 'object') return null;
  if (typeof role !== 'string' || !Object.hasOwn(lighting, role)) return null;
  const binding = lighting[role];
  if (!binding || typeof binding.ha !== 'string' || binding.ha.length === 0) return null;
  return binding.ha;
}

/**
 * Resolve a display-surface CHANNEL name (A3 slice 6, Q6-2) to its bound
 * concrete media file, or null when unbound. The lighting-role resolver's
 * twin: pack names a channel (`surfaces.idleLoop`), the profile binds it
 * to a file. Object.hasOwn: a channel named 'constructor' must not
 * resolve off the prototype chain (C11 class).
 * @param {string} channel
 * @returns {string|null}
 */
function getSurfaceChannelFile(channel) {
  const profile = getProfile();
  const surfaces = profile && profile.bindings && profile.bindings.surfaces;
  if (!surfaces || typeof surfaces !== 'object') return null;
  if (typeof channel !== 'string' || !Object.hasOwn(surfaces, channel)) return null;
  const binding = surfaces[channel];
  if (!binding || typeof binding.file !== 'string' || binding.file.length === 0) return null;
  return binding.file;
}

/**
 * The v1-read identity fields, for health/status reporting.
 * @returns {{profileId: string, forPack: (string|undefined)}|null}
 */
function getProfileInfo() {
  const profile = getProfile();
  if (!profile) return null;
  return { profileId: profile.profileId, forPack: profile.forPack };
}

/** Test-only: drop the frozen snapshot and warn latches. */
function _resetForTesting() {
  warnedProfilePath = false;
  activated = false;
  activeProfile = null;
  activeProfileMtime = null;
  warnedProfileDrift = false;
}

module.exports = {
  getProfilePath,
  activateProfile,
  getProfile,
  getLightingBinding,
  getSurfaceChannelFile,
  getProfileInfo,
  _resetForTesting,
};
