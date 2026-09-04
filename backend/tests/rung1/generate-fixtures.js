#!/usr/bin/env node
/**
 * Regenerates the rung-1 fixtures from a pack (CS.1): the HA witness
 * register and the simulation profile. One truth: pack roles change,
 * fixtures follow — nothing hand-edited.
 *
 * Usage: node generate-fixtures.js <packDir> <rung1Dir>
 */
const fs = require('fs');
const path = require('path');
const { collectPackNeeds } = require('../../src/gameRules/packNeeds');
const { generateWitnessConfig } = require('../../scripts/lib/witnessConfig');
const {
  generateSimulationProfile,
} = require('../../scripts/lib/simulationProfile');

const [packDir, rung1Dir] = process.argv.slice(2);
if (!packDir || !rung1Dir) {
  console.error('usage: generate-fixtures.js <packDir> <rung1Dir>');
  process.exit(2);
}
const read = (f) =>
  JSON.parse(fs.readFileSync(path.join(packDir, f), 'utf8'));
const pack = {
  game: read('game.json'),
  cues: read('cues.json'),
  manifest: read('pack-manifest.json'),
};
const needs = collectPackNeeds(pack);

fs.mkdirSync(path.join(rung1Dir, 'ha-config'), { recursive: true });
fs.writeFileSync(
  path.join(rung1Dir, 'ha-config', 'configuration.yaml'),
  generateWitnessConfig(needs)
);
fs.writeFileSync(
  path.join(rung1Dir, 'simulation-profile.json'),
  JSON.stringify(
    generateSimulationProfile(needs, pack.manifest.packId), null, 2
  ) + '\n'
);
console.log(
  `fixtures written for ${pack.manifest.packId}: ` +
  `${needs.filter((n) => n.kind === 'lighting-role').length} witness roles`
);
