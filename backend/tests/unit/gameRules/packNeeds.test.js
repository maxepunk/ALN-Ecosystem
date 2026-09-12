/**
 * CS.1 — collectPackNeeds: the aggregator the census showed nobody
 * has (C2+C3 design §8, ratified 2026-09-04). Pure over a pack
 * snapshot {game, cues, manifest}; the caller loads files.
 *
 * Tests run against the REAL packs (production ALN + toy-heist) so
 * expectations are authored from actual pack content, not invented
 * fixtures — the dual-pack rule this repo builds under.
 */

const fs = require('fs');
const path = require('path');
const { collectPackNeeds } = require('../../../src/gameRules/packNeeds');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');
const ALN_DIR = path.join(REPO_ROOT, 'ALN-TokenData');
const TOY_DIR = path.join(
  REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures', 'packs', 'toy-heist'
);

function loadPack(dir) {
  const read = (f) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return {
    game: read('game.json'),
    cues: read('cues.json'),
    manifest: read('pack-manifest.json'),
  };
}

describe('collectPackNeeds (pure aggregator, both real packs)', () => {
  describe('ALN production pack', () => {
    const needs = collectPackNeeds(loadPack(ALN_DIR));

    it('collects every hardware.stack service with its authored onAbsent', () => {
      const services = needs.filter((n) => n.kind === 'service');
      const byId = Object.fromEntries(services.map((n) => [n.id, n]));
      // Authored in ALN-TokenData/pack-manifest.json hardware.stack
      expect(Object.keys(byId).sort()).toEqual(
        ['lighting', 'music', 'sound', 'vlc']
      );
      for (const id of ['vlc', 'music', 'sound', 'lighting']) {
        expect(byId[id].onAbsent).toBe('degrade');
      }
    });

    it('collects hardware.endpoints with authored onAbsent (C1 §1 physical keys)', () => {
      const endpoints = needs.filter((n) => n.kind === 'endpoint');
      // ALN authors exactly display.main (degrade) today
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].id).toBe('display.main');
      expect(endpoints[0].onAbsent).toBe('degrade');
    });

    it('collects device-class minimums (min > 0 only — a min of 0 asks nothing)', () => {
      const classes = needs.filter((n) => n.kind === 'device-class');
      // ALN authors staffed min 1; station and personal have min 0
      expect(classes).toHaveLength(1);
      expect(classes[0]).toMatchObject({ id: 'staffed', min: 1 });
    });

    it('collects every declared lighting role, carrying its pack fallback', () => {
      const roles = needs.filter((n) => n.kind === 'lighting-role');
      expect(roles.map((r) => r.id).sort()).toEqual([
        'blackout', 'gameplay', 'police-arrival-1', 'police-arrival-2',
        'police-arrival-3', 'police-glitch', 'video-playback',
      ]);
      // ALN authors a fallback for every role (game.json)
      for (const r of roles) {
        expect(typeof r.fallback).toBe('string');
      }
    });

    it('collects distinct sound files from cue commands AND timeline steps', () => {
      const sounds = needs.filter((n) => n.kind === 'sound');
      // Authored across ALN cues.json (timeline cues included)
      expect(sounds.map((s) => s.id).sort()).toEqual([
        '15min.wav', '30min.wav', '60min.wav', '90min.wav',
        'attention.wav', 'tension.wav',
      ]);
    });

    it('records which lighting roles the cues actually reference', () => {
      const refs = needs.filter((n) => n.kind === 'lighting-role-ref');
      expect(refs.map((r) => r.id).sort()).toEqual(
        ['gameplay', 'video-playback']
      );
    });

    it('collects the idle-loop surface channel', () => {
      const surfaces = needs.filter((n) => n.kind === 'surface-channel');
      expect(surfaces).toHaveLength(1);
      expect(surfaces[0].id).toBe('aln-idle');
    });

    it('collects declared capability requirements', () => {
      const caps = needs.filter((n) => n.kind === 'capability');
      expect(caps.map((c) => c.id)).toContain('lighting.roles');
      expect(caps).toHaveLength(8);
    });
  });

  describe('toy-heist pack', () => {
    const needs = collectPackNeeds(loadPack(TOY_DIR));

    it('a role without a pack fallback carries fallback: null (all-clear)', () => {
      const roles = needs.filter((n) => n.kind === 'lighting-role');
      const byId = Object.fromEntries(roles.map((r) => [r.id, r]));
      expect(Object.keys(byId).sort()).toEqual(['all-clear', 'vault-alarm']);
      expect(byId['vault-alarm'].fallback).toBe('scene.toy_vault_alarm');
      expect(byId['all-clear'].fallback).toBeNull();
    });
  });
});
