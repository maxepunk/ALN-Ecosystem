#!/usr/bin/env node
/**
 * Regenerates the rung-1 fixtures from pack content (CS.1; multi-pack
 * since fix-vehicle S5 §8.1): the HA witness register and the
 * simulation profiles. One truth: pack roles change, fixtures follow —
 * nothing hand-edited.
 *
 * Usage: node generate-fixtures.js <rung1Dir> <packDir> [packDir...]
 *
 * Multi-pack semantics: ONE witness Home Assistant serves every pack
 * the machine tests (the dual-pack E2E legs share it), so
 * configuration.yaml is generated from the UNION of all packs' needs.
 * Each pack gets its own simulation profile,
 * simulation-profile-<packId>.json; the FIRST pack's profile is also
 * written to simulation-profile.json (the rig's engine env pins that
 * name). Media placeholders are seeded for every pack.
 */
const fs = require('fs');
const path = require('path');
const { collectPackNeeds } = require('../../src/gameRules/packNeeds');
const { generateWitnessConfig } = require('../../scripts/lib/witnessConfig');
const {
  generateSimulationProfile,
} = require('../../scripts/lib/simulationProfile');
const { unionNeeds } = require('./provision');

const [rung1Dir, ...packDirs] = process.argv.slice(2);
if (!rung1Dir || packDirs.length === 0) {
  console.error('usage: generate-fixtures.js <rung1Dir> <packDir> [packDir...]');
  process.exit(2);
}
const BACKEND = path.resolve(__dirname, '../..');

/**
 * Minimal valid WAV (8kHz mono 16-bit silence) — MPD-indexable content.
 * 30s, not a blip: MPD's pulse MIXER attaches only while the output is
 * open, so volume ops need a track long enough to still be playing
 * (audit finding: setvol while stopped → "All outputs are disabled").
 */
function silenceWav(seconds = 30) {
  const samples = Math.round(8000 * seconds);
  const data = Buffer.alloc(samples * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(8000, 24); // sample rate
  header.writeUInt32LE(16000, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function loadPack(packDir) {
  const read = f => JSON.parse(fs.readFileSync(path.join(packDir, f), 'utf8'));
  const pack = {
    game: read('game.json'),
    cues: read('cues.json'),
    manifest: read('pack-manifest.json'),
  };
  return { pack, tokens: read('tokens.json'), needs: collectPackNeeds(pack) };
}

const loaded = packDirs.map(loadPack);

// --- witness HA register: the UNION of every pack's needs ----------
const union = unionNeeds(loaded.map(l => l.needs));
fs.mkdirSync(path.join(rung1Dir, 'ha-config'), { recursive: true });
fs.writeFileSync(
  path.join(rung1Dir, 'ha-config', 'configuration.yaml'),
  generateWitnessConfig(union)
);

// --- per-pack simulation profiles ----------------------------------
for (const [i, { pack, needs }] of loaded.entries()) {
  const profile = generateSimulationProfile(needs, pack.manifest.packId);
  const body = `${JSON.stringify(profile, null, 2)}\n`;
  fs.writeFileSync(
    path.join(rung1Dir, `simulation-profile-${pack.manifest.packId}.json`),
    body
  );
  if (i === 0) {
    fs.writeFileSync(path.join(rung1Dir, 'simulation-profile.json'), body);
  }
}

// --- media placeholders (fake physics: pixels/samples are simulated,
// the engine's real file-resolution paths are not) -------------------
for (const { pack, tokens, needs } of loaded) {
  // Idle-loop surface: the simulation profile binds `<id>-sim.mp4`; the
  // engine resolves that against public/videos. Seed it from the
  // committed E2E fixture so videoQueueService finds a REAL mp4.
  const idleNeed = needs.find(n => n.kind === 'surface-channel');
  if (idleNeed) {
    const src = path.join(BACKEND, 'tests/e2e/fixtures/test-videos/idle_loop_test.mp4');
    const dst = path.join(BACKEND, 'public/videos', `${idleNeed.id}-sim.mp4`);
    if (!fs.existsSync(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      console.log(`idle-loop placeholder: ${path.basename(dst)}`);
    }
  }
  // Token-declared videos (player-scan trigger path): real filenames the
  // pack expects, placeholder pixels — fake physics, real resolution.
  const tokenVideos = [...new Set(
    Object.values(tokens).map(t => t.video).filter(Boolean)
  )];
  const seeded = [];
  for (const v of tokenVideos) {
    const dst = path.join(BACKEND, 'public/videos', v);
    if (!fs.existsSync(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(path.join(BACKEND, 'tests/e2e/fixtures/test-videos/test_10sec.mp4'), dst);
      seeded.push(v);
    }
  }
  if (seeded.length) {
    console.log(`token-video placeholders (${pack.manifest.packId}): ${
      seeded.join(', ')}`);
  }
  // Cue-referenced sound files are REAL show content (public/audio is in
  // git) — a missing one is a genuine fault the show would have, so
  // report it loudly and do NOT fabricate a placeholder.
  for (const n of needs.filter(x => x.kind === 'sound')) {
    if (!fs.existsSync(path.join(BACKEND, 'public/audio', n.id))) {
      console.warn(`WARN: cue-referenced sound MISSING: public/audio/${n.id}`);
    }
  }
}

// Music dir: musicService requires public/music to exist for its MPD
// child; give MPD one indexable track.
const musicDir = path.join(BACKEND, 'public/music');
fs.mkdirSync(musicDir, { recursive: true });
const silencePath = path.join(musicDir, 'rung1-silence.wav');
if (!fs.existsSync(silencePath)) fs.writeFileSync(silencePath, silenceWav());

console.log(
  `fixtures written for [${loaded.map(l => l.pack.manifest.packId).join(', ')}]: `
  + `${union.filter(n => n.kind === 'lighting-role').length} witness roles (union)`
);
