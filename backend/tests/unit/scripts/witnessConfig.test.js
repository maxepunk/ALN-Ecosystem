/**
 * CS.1 — the witness-light generator (CONTEXT.md "Witness lights").
 * Generates the rung-1 HA fixture FROM the pack's own needs list, so
 * the fixture cannot drift from pack content: one input_boolean
 * witness per declared lighting role, one scene per role setting its
 * own witness on and every other witness off (one-hot).
 */

const fs = require('fs');
const path = require('path');
const { collectPackNeeds } = require('../../../src/gameRules/packNeeds');
const { generateWitnessConfig } = require('../../../scripts/lib/witnessConfig');

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

describe('generateWitnessConfig (one-hot witness register from pack roles)', () => {
  const alnNeeds = collectPackNeeds(
    loadPack(path.join(REPO_ROOT, 'ALN-TokenData'))
  );
  const yaml = generateWitnessConfig(alnNeeds);

  it('emits one input_boolean witness per declared role', () => {
    // ALN declares 7 roles
    for (const role of [
      'gameplay', 'video-playback', 'blackout', 'police-arrival-1',
      'police-arrival-2', 'police-arrival-3', 'police-glitch',
    ]) {
      expect(yaml).toContain(`witness_${role.replace(/-/g, '_')}:`);
    }
  });

  it('emits a one-hot scene per role: own witness on, all others off', () => {
    // The police-arrival-2 scene block must set its own witness on
    // and (spot-check) another role's witness off.
    const sceneStart = yaml.indexOf('- name: witness_police_arrival_2');
    expect(sceneStart).toBeGreaterThan(-1);
    const nextScene = yaml.indexOf('- name:', sceneStart + 1);
    const block = yaml.slice(
      sceneStart, nextScene === -1 ? undefined : nextScene
    );
    expect(block).toContain('input_boolean.witness_police_arrival_2: "on"');
    expect(block).toContain('input_boolean.witness_gameplay: "off"');
  });

  it('scene entity ids match what the profile will bind (scene.witness_<role>)', () => {
    // bluetoothctl-style contract: the simulation profile binds role
    // -> scene.witness_<role>; HA derives scene entity ids from the
    // scene name, so names must be the exact witness_<role> form.
    expect(yaml).toContain('- name: witness_gameplay');
  });
});
