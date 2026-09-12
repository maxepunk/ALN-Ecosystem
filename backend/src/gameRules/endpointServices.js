/**
 * gameRules/endpointServices.js — equipment families -> the services
 * that exist only to drive them (Block 2 T1b, plan §3 pin P1;
 * CONTEXT.md §5 "Endpoints vs stack").
 *
 * Pure: no I/O, no requires from services/. The C1 §1 endpoints
 * interior (installation-profile.schema.json, D1) names exactly five
 * physical equipment families. This module is the SOLE map from a
 * family to the service ids a dormant declaration marks dormant —
 * every other surface (resolve(), the preflight, the registry feed)
 * quotes it rather than re-deriving the mapping.
 *
 * Dormancy keys on a family the pack MANIFEST declares as a need
 * (hardware.endpoints.<family>) that the profile omits or declares
 * installed: false (audio.sinks: no entry with installed: true).
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
 * audio.sinks is an array (installed when at least one entry is
 * installed: true); every other family is an object carrying
 * `installed`. An absent declaration is always uninstalled.
 */
function isInstalled(familyId, declared) {
  if (declared === undefined || declared === null) return false;
  if (familyId === 'audio.sinks') {
    return Array.isArray(declared) && declared.some((sink) => sink && sink.installed === true);
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

module.exports = { ENDPOINT_FAMILIES, servicesForFamily, dormantServicesFor };
