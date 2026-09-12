const { ENDPOINT_FAMILIES } = require('../../src/gameRules/endpointServices');

/**
 * The equipment family's harness stand-in, in the PINNED C1 §1
 * interior (installation-profile.schema.json, D1) — a `provider`
 * field on `display.main` is schema-illegal, so the harness declares
 * itself via marker VALUES instead (Block 2 T1b, plan §9 ruling 2):
 * `display.main.output` beginning `rung1-`, sink ids beginning
 * `rung1_` — `provision.js` `harnessProvides()` recognizes exactly
 * these markers.
 *
 * @param {string} familyId - one of ENDPOINT_FAMILIES
 * @param {object} hardware - the pack manifest's hardware block
 *   (deviceClasses), consulted only for `stations`
 * @returns {object|Array<object>} the endpoints[familyId] value
 * @throws {Error} if familyId is not one of the five known families
 */
function endpointStandIn(familyId, hardware) {
  switch (familyId) {
    case 'display.main':
      return { installed: true, output: 'rung1-xvfb' };
    case 'audio.sinks':
      return [
        { id: 'rung1_hdmi', installed: true },
        { id: 'rung1_bt', installed: true },
      ];
    case 'lighting.instruments':
      return { installed: true, provider: 'home-assistant' };
    case 'stations': {
      const deviceClasses = (hardware && hardware.deviceClasses) || [];
      const station = deviceClasses.find((d) => d.class === 'station') || {};
      const count = station.recommended !== undefined
        ? station.recommended
        : (station.min !== undefined ? station.min : 0);
      return { count };
    }
    case 'personal':
      return { expected: false };
    default:
      throw new Error(`unknown equipment family '${familyId}'`);
  }
}

/**
 * generateSimulationProfile — the rung-1 environment's installation
 * profile, GENERATED from the pack needs list (CS.1; CONTEXT.md
 * "Environment ladder / rung").
 *
 * The simulation environment provides everything the pack needs, in
 * software: every lighting role binds to its witness scene, every
 * surface channel binds to a placeholder file, and every equipment
 * family the pack names gets the pinned C1 §1 interior with a harness
 * stand-in VALUE (Block 2 T1b, D7) — never a `provider` field on
 * `display.main` (schema-illegal since D1). On rung 1 the full show
 * logic runs — resolve() must find nothing dormant and nothing no-go,
 * and dormantServicesFor() must return {}.
 *
 * @param {Array<object>} needs - from collectPackNeeds
 * @param {string} packId
 * @param {object} [hardware] - the pack manifest's hardware block;
 *   only consulted for the `stations` family's count. Optional —
 *   existing call sites that never emit a `stations` need keep working
 *   without passing it.
 * @returns {object} an installation profile
 */
function generateSimulationProfile(needs, packId, hardware = {}) {
  const witnessSceneOf = (role) =>
    `scene.witness_${role.replace(/-/g, '_')}`;

  const lighting = {};
  for (const n of needs) {
    if (n.kind === 'lighting-role') {
      lighting[n.id] = { ha: witnessSceneOf(n.id) };
    }
  }

  const surfaces = {};
  for (const n of needs) {
    if (n.kind === 'surface-channel') {
      surfaces[n.id] = { file: `${n.id}-sim.mp4` };
    }
  }

  const endpoints = {};
  for (const n of needs) {
    if (n.kind === 'endpoint') {
      if (!ENDPOINT_FAMILIES.includes(n.id)) {
        throw new Error(`unknown equipment family '${n.id}'`);
      }
      endpoints[n.id] = endpointStandIn(n.id, hardware);
    }
  }

  return {
    kind: 'installation-profile',
    schemaVersion: 1,
    profileId: 'rung1-simulation',
    label: 'Rung 1 — simulation harness',
    version: 1,
    forPack: packId,
    orchestrator: true,
    endpoints,
    bindings: { lighting, surfaces },
  };
}

module.exports = { generateSimulationProfile };
