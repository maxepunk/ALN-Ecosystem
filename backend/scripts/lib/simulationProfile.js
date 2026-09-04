/**
 * generateSimulationProfile — the rung-1 environment's installation
 * profile, GENERATED from the pack needs list (CS.1; CONTEXT.md
 * "Environment ladder / rung").
 *
 * The simulation environment provides everything the pack needs, in
 * software: every lighting role binds to its witness scene, every
 * surface channel binds to a placeholder file, and the endpoints the
 * harness actually provides are declared (display.main = VLC's dummy
 * output). On rung 1 the full show logic runs — resolve() must find
 * nothing dormant and nothing no-go.
 *
 * @param {Array<object>} needs - from collectPackNeeds
 * @param {string} packId
 * @returns {object} an installation profile
 */
function generateSimulationProfile(needs, packId) {
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
      endpoints[n.id] = { provider: 'rung1-harness' };
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
