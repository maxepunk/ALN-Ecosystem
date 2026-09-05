/**
 * CS.1 — the simulation-profile generator. The rung-1 environment's
 * installation profile, GENERATED from the pack needs list: every
 * declared lighting role binds to its witness scene
 * (scene.witness_<role>), and the endpoints the harness actually
 * provides are declared (display.main via VLC's dummy output).
 * CONTEXT.md: "Environment ladder / rung", "Witness lights".
 */

const fs = require('fs');
const path = require('path');
const { collectPackNeeds } = require('../../../src/gameRules/packNeeds');
const { resolve } = require('../../../src/gameRules/resolution');
const {
  generateSimulationProfile,
} = require('../../../scripts/lib/simulationProfile');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');

function loadPack(dir) {
  const read = (f) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return {
    game: read('game.json'),
    cues: read('cues.json'),
    manifest: read('pack-manifest.json'),
  };
}

describe('generateSimulationProfile', () => {
  const alnNeeds = collectPackNeeds(
    loadPack(path.join(REPO_ROOT, 'ALN-TokenData'))
  );
  const profile = generateSimulationProfile(alnNeeds, 'about-last-night');

  it('binds every declared lighting role to its witness scene', () => {
    const lighting = profile.bindings.lighting;
    expect(Object.keys(lighting).sort()).toEqual([
      'blackout', 'gameplay', 'police-arrival-1', 'police-arrival-2',
      'police-arrival-3', 'police-glitch', 'video-playback',
    ]);
    expect(lighting['police-arrival-2'].ha)
      .toBe('scene.witness_police_arrival_2');
  });

  it('declares the endpoints the harness provides', () => {
    expect(profile.endpoints['display.main']).toBeDefined();
  });

  it('the generated profile resolves the ALN pack with NO no-go and NO dormant', () => {
    // The whole point of the simulation profile: on rung 1 the full
    // show logic runs — nothing the pack needs is missing.
    const { verdicts, rollup } = resolve(alnNeeds, profile);
    expect(rollup.status).not.toBe('no-go');
    const dormant = verdicts.filter((v) => v.verdict === 'dormant');
    expect(dormant).toEqual([]);
  });
});
