/**
 * gameRules/endpointServices.js — equipment families -> the services
 * that exist only to drive them (Block 2 T1b, plan §3 pin P1;
 * CONTEXT.md §5 "Endpoints vs stack").
 *
 * Pure: no I/O, and nothing here imports a service. The C1 §1 endpoints
 * interior (installation-profile.schema.json, D1) names exactly five
 * physical equipment families. This module is the SOLE map from a
 * family to the service ids a dormant declaration marks dormant —
 * every other surface (resolve(), the preflight, the registry feed)
 * quotes it rather than re-deriving the mapping.
 *
 * Dormancy keys on a family the pack MANIFEST declares as a need
 * (hardware.endpoints.<family>) that the profile omits or declares
 * uninstalled — see isInstalled() for the per-family rule, which is
 * NOT one shared `installed` flag (ruling 24).
 * `audio` is additionally dormant only when NO sink is installed AND
 * display.main is also uninstalled — an installed display implies the
 * HDMI sink is present for it. The Bluetooth service is the adapter,
 * a capability, and never appears here (never profile-dormant).
 * `stations` and `personal` map to no service.
 *
 * `hardware.stack.<svc>.onAbsent` (a down STACK service, not an
 * endpoint) is a fault-severity concern read elsewhere; this module
 * only ever computes dormancy from ENDPOINT families.
 */

const ENDPOINT_FAMILIES = Object.freeze([
  'display.main',
  'audio.sinks',
  'lighting.instruments',
  'stations',
  'personal',
]);

const FAMILY_SERVICES = Object.freeze({
  'display.main': Object.freeze(['vlc', 'display']),
  'lighting.instruments': Object.freeze(['lighting']),
  'audio.sinks': Object.freeze(['sound', 'music']),
  stations: Object.freeze([]),
  personal: Object.freeze([]),
});

/**
 * @param {string} familyId - one of ENDPOINT_FAMILIES
 * @returns {string[]} the service ids this family exists only to drive
 * @throws {Error} if familyId is not one of the five known families
 */
function servicesForFamily(familyId) {
  if (!Object.prototype.hasOwnProperty.call(FAMILY_SERVICES, familyId)) {
    throw new Error(`unknown equipment family '${familyId}'`);
  }
  return FAMILY_SERVICES[familyId];
}

/**
 * Is this family INSTALLED per the profile's C1 §1 endpoints interior?
 * The public face of `isInstalled` (Block 2 T1a D3, pin P2): resolve()
 * asks the SAME question about a family that dormancy does, rather than
 * re-deriving "installed" its own way and drifting.
 * @param {object|null|undefined} profile - an installation profile
 * @param {string} familyId - one of ENDPOINT_FAMILIES
 * @returns {boolean}
 */
function familyInstalled(profile, familyId) {
  const declared = (profile && profile.endpoints) || {};
  return isInstalled(familyId, declared[familyId]);
}

/**
 * Is this family INSTALLED per the profile's C1 §1 endpoints interior?
 *
 * Each family answers through the field the SCHEMA actually gives it —
 * there is no single `installed` flag across the five, and asking for one
 * is how this predicate was wrong (Block 2 T1a fix round 1, ruling 24):
 *
 *   display.main, lighting.instruments  `installed: true`
 *   audio.sinks (an array)              SOME entry `installed: true`
 *   stations                            `count >= 1`
 *   personal                            `expected === true`
 *
 * `stations` and `personal` carry NO `installed` key — the profile schema
 * declares them `{count}` and `{expected}` with additionalProperties:
 * false, so writing `installed` there is illegal. Reading one anyway
 * answered false for every profile that has ever existed, which made a
 * pack declaring `hardware.endpoints.stations` resolve DORMANT against a
 * venue with its stations set up, and (under `onAbsent: require`) a
 * permanent NO-GO that only `startAnyway` could pass.
 *
 * An absent or null declaration is always uninstalled.
 */
function isInstalled(familyId, declared) {
  if (declared === undefined || declared === null) return false;
  if (familyId === 'audio.sinks') {
    return Array.isArray(declared) && declared.some((sink) => sink && sink.installed === true);
  }
  if (familyId === 'stations') {
    return Number.isFinite(declared.count) && declared.count >= 1;
  }
  if (familyId === 'personal') {
    return declared.expected === true;
  }
  return declared.installed === true;
}

/**
 * dormantServicesFor(manifest, profile) -> { [serviceId]: { reason } }
 *
 * @param {object} manifest - the pack manifest (reads hardware.endpoints)
 * @param {object} profile - an installation profile (reads endpoints)
 * @returns {Object<string, {reason: string}>}
 * @throws {Error} if the manifest names a family outside ENDPOINT_FAMILIES
 *   (the schema also refuses this; failing loudly here keeps the map honest)
 */
function dormantServicesFor(manifest, profile) {
  const endpoints = (manifest && manifest.hardware && manifest.hardware.endpoints) || {};
  const declaredEndpoints = (profile && profile.endpoints) || {};
  const dormant = {};

  const markFamilyDormant = (familyId) => {
    const reason = `'${familyId}' not installed tonight`;
    for (const serviceId of servicesForFamily(familyId)) {
      dormant[serviceId] = { reason };
    }
  };

  for (const familyId of Object.keys(endpoints)) {
    if (!ENDPOINT_FAMILIES.includes(familyId)) {
      throw new Error(`unknown equipment family '${familyId}'`);
    }
    if (!isInstalled(familyId, declaredEndpoints[familyId])) {
      markFamilyDormant(familyId);
    }
  }

  if (Object.prototype.hasOwnProperty.call(endpoints, 'audio.sinks')) {
    const sinksInstalled = isInstalled('audio.sinks', declaredEndpoints['audio.sinks']);
    const displayInstalled = isInstalled('display.main', declaredEndpoints['display.main']);
    if (!sinksInstalled && !displayInstalled) {
      dormant.audio = { reason: 'no audio sink installed tonight and no display' };
    }
  }

  return dormant;
}

module.exports = { ENDPOINT_FAMILIES, servicesForFamily, dormantServicesFor, familyInstalled };
