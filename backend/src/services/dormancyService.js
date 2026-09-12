/**
 * dormancyService — the ONE place that decides what is dormant tonight
 * (Block 2 T1a, plan §3 pin P6; CONTEXT.md §4 "dormant vs fault").
 *
 * Dormancy has exactly two doors:
 *
 *   profile   the pack needs an equipment family the installation profile
 *             does not install — nobody expected it in this room tonight.
 *             Derived, every boot, from the frozen manifest and the frozen
 *             profile through gameRules/endpointServices.
 *   operator  a human said "this is out of service" mid-run — the TV died,
 *             the rig went back in the van. THIS service owns that set; the
 *             registry entry is its projection. It is deliberately NOT
 *             persisted: a process restart is a fresh look at the room, and
 *             a latch nobody remembers setting is worse than one probe.
 *             (T3 wires the gm:command that sets it.)
 *
 * The feed pushes one decision into the two surfaces that act on it: the
 * health registry (so uninstalled equipment reads GREY, never red — alarm
 * integrity) and the cue engine (so cues that need only absent equipment
 * are silenced before the show, not refused mid-show).
 *
 * Run points (P6): the end of app.js initializeServices (after every
 * service init, before revalidation — this also covers restore after a
 * restart), sessionService.createSession, and systemReset after the cues
 * reload. The profile stays boot-frozen; nothing here re-reads it.
 */

'use strict';

const logger = require('../utils/logger');
const { dormantServicesFor, familyInstalled } = require('../gameRules/endpointServices');
const { doorWording } = require('./dormancyWording');
const registrySingleton = require('./serviceHealthRegistry');

/**
 * The operator latch set: serviceId -> operator-supplied reason.
 * In-memory only, by design (see the file header).
 * @type {Map<string, string>}
 */
const operatorLatches = new Map();

/**
 * Latch a service out of service by the OPERATOR door. Takes effect at the
 * next apply()/recompute().
 * @param {string} serviceId
 * @param {string} reason - the operator's words, stored verbatim
 * @returns {boolean} whether the latch was recorded
 */
function setOutOfService(serviceId, reason) {
  if (!registrySingleton.KNOWN_SERVICES.includes(serviceId)) {
    logger.warn(`[Dormancy] Cannot put unknown service out of service: ${serviceId}`);
    return false;
  }
  operatorLatches.set(serviceId, reason);
  logger.info(`[Dormancy] Operator latched ${serviceId} out of service`, { reason });
  return true;
}

/**
 * Release an operator latch. Takes effect at the next apply()/recompute().
 * @param {string} serviceId
 * @returns {boolean} whether a latch was removed
 */
function putInService(serviceId) {
  const had = operatorLatches.delete(serviceId);
  if (had) logger.info(`[Dormancy] Operator put ${serviceId} back in service`);
  return had;
}

/**
 * @returns {Object<string, string>} a copy of the operator latch set
 */
function getOperatorLatches() {
  return Object.fromEntries(operatorLatches);
}

/**
 * Decide what is dormant. Pure over its arguments — no I/O, no singletons
 * read except the KNOWN_SERVICES list the caller hands in.
 *
 * @param {{manifest: object, profile: object, registry: object}} input
 * @returns {{
 *   profileDormant: Object<string, {reason: string, door: 'profile'}>,
 *   operatorDormant: Object<string, {reason: string, door: 'operator'}>,
 *   dormantServiceIds: string[],
 *   doorOf: Object<string, 'profile'|'operator'>
 * }}
 */
function compute({ manifest, profile, registry = registrySingleton } = {}) {
  const known = registry.KNOWN_SERVICES || [];

  const profileDormant = {};
  for (const [serviceId, entry] of Object.entries(dormantServicesFor(manifest, profile))) {
    if (!known.includes(serviceId)) continue;   // the map can only name real services
    profileDormant[serviceId] = { reason: entry.reason, door: 'profile' };
  }

  const operatorDormant = {};
  for (const [serviceId, reason] of operatorLatches) {
    if (!known.includes(serviceId)) continue;
    operatorDormant[serviceId] = { reason, door: 'operator' };
  }

  // The operator door WINS when both apply: a human pulling the plug is the
  // newer, more specific fact, and "out of service" is what the GM should
  // read on the dashboard.
  const doorOf = {};
  for (const id of Object.keys(profileDormant)) doorOf[id] = 'profile';
  for (const id of Object.keys(operatorDormant)) doorOf[id] = 'operator';

  return {
    profileDormant,
    operatorDormant,
    dormantServiceIds: Object.keys(doorOf).sort(),
    // Two additions to the pinned three keys, both so the pinned signatures
    // elsewhere can stay as pinned: cueEngineService.applyDormancy takes
    // {dormantServiceIds, doorOf}, and apply(result) takes ONE argument, so
    // the binding-warn facts have to ride the result rather than be
    // re-derived from a profile apply() would otherwise have to re-read.
    doorOf,
    ignoredBindings: ignoredBindingsFor(manifest, profile),
  };
}

/**
 * A profile that still binds names for equipment it does not install is not
 * an error — a venue keeps its lighting bindings between shows — but it IS
 * the shape of a mistake (someone meant to set installed: true). The
 * endpoint wins either way; resolve() already ignores the bindings. This
 * records what to say about it.
 * @returns {Array<{familyId: string, count: number}>}
 * @private
 */
function ignoredBindingsFor(manifest, profile) {
  if (!manifest || !profile) return [];
  const declared = (manifest.hardware && manifest.hardware.endpoints) || {};
  const PAIRS = [
    ['lighting.instruments', 'lighting'],
    ['display.main', 'surfaces'],
  ];
  const out = [];
  for (const [familyId, bindingKey] of PAIRS) {
    if (!Object.prototype.hasOwnProperty.call(declared, familyId)) continue;
    if (familyInstalled(profile, familyId)) continue;
    const count = Object.keys((profile.bindings || {})[bindingKey] || {}).length;
    if (count > 0) out.push({ familyId, count });
  }
  return out;
}

/**
 * Push a computed decision into the registry and the cue engine.
 * @param {ReturnType<compute>} result
 * @param {{registry?: object}} [ctx]
 */
function apply(result, { registry = registrySingleton } = {}) {
  const { dormantServiceIds = [], doorOf = {}, ignoredBindings = [] } = result || {};

  for (const serviceId of dormantServiceIds) {
    const door = doorOf[serviceId];
    registry.markDormant(serviceId, door, `${serviceId} is ${doorWording(door)}`);
  }
  for (const serviceId of registry.KNOWN_SERVICES || []) {
    if (dormantServiceIds.includes(serviceId)) continue;
    if (registry.isDormant(serviceId)) registry.clearDormant(serviceId);
  }

  // The cue engine recomputes its dormancy-disabled set from the same
  // decision — one source, two projections.
  require('./cueEngineService').applyDormancy(result);

  // One warn per family, loud enough to notice at boot, quiet enough not
  // to nag every 15 seconds.
  for (const { familyId, count } of ignoredBindings) {
    logger.warn(
      `profile binds ${count} ${familyId} names but the family is not ` +
      'installed tonight — bindings ignored'
    );
  }
}

/**
 * compute() over the ACTIVE pack manifest and the boot-frozen profile, then
 * apply(). The entry point every run point calls.
 * @returns {ReturnType<compute>}
 */
function recompute() {
  const manifest = require('./packService').getManifest();
  const profile = require('./profileService').getProfile();
  const result = compute({ manifest, profile, registry: registrySingleton });
  apply(result, { registry: registrySingleton });
  return result;
}

/** Test-only: drop the operator latch set. */
function _resetForTesting() {
  operatorLatches.clear();
}

module.exports = {
  compute,
  apply,
  recompute,
  setOutOfService,
  putInService,
  getOperatorLatches,
  _resetForTesting,
};
