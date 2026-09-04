/**
 * CS.1 — resolve(): the C1 §2 table as one pure function (C2+C3
 * design §8, ratified 2026-09-04; CONTEXT.md "One truth, three
 * loops"). Inputs: the needs list from collectPackNeeds, a profile,
 * and an optional inventory of live facts gathered by the caller.
 * Output: per-need verdicts + a rollup. Verdicts carry the depth
 * they reached: 'paper' (against declared inventory) or 'live'
 * (against supplied reality) — CONTEXT.md "Paper vs live checks".
 *
 * Expectations authored from the REAL packs and profiles.
 */

const fs = require('fs');
const path = require('path');
const { collectPackNeeds } = require('../../../src/gameRules/packNeeds');
const { resolve } = require('../../../src/gameRules/resolution');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');
const ALN_DIR = path.join(REPO_ROOT, 'ALN-TokenData');
const ALN_PROFILE = JSON.parse(fs.readFileSync(
  path.join(REPO_ROOT, 'backend', 'config', 'profiles', 'aln-full-kit.json'),
  'utf8'
));

function loadPack(dir) {
  const read = (f) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return {
    game: read('game.json'),
    cues: read('cues.json'),
    manifest: read('pack-manifest.json'),
  };
}

const alnNeeds = collectPackNeeds(loadPack(ALN_DIR));

describe('resolve (pure, C1 §2 table)', () => {
  it('a lighting role bound in the profile resolves runs (paper)', () => {
    const { verdicts } = resolve(alnNeeds, ALN_PROFILE);
    const roles = verdicts.filter(
      (v) => v.need.kind === 'lighting-role'
    );
    // aln-full-kit binds all 7 declared roles
    expect(roles).toHaveLength(7);
    for (const v of roles) {
      expect(v.verdict).toBe('runs');
      expect(v.depth).toBe('paper');
    }
  });

  it('an unbound role WITH a pack fallback runs via the fallback (L7 loud path)', () => {
    const needs = [{
      kind: 'lighting-role', id: 'gameplay',
      fallback: 'scene.game', sources: [],
    }];
    const bareProfile = { orchestrator: true, bindings: {} };
    const { verdicts } = resolve(needs, bareProfile);
    expect(verdicts[0].verdict).toBe('runs');
    expect(verdicts[0].reason).toMatch(/fallback/);
  });

  it('an unbound role with NO fallback is a fault: its commands will refuse', () => {
    const needs = [{
      kind: 'lighting-role', id: 'all-clear',
      fallback: null, sources: [],
    }];
    const bareProfile = { orchestrator: true, bindings: {} };
    const { verdicts } = resolve(needs, bareProfile);
    expect(verdicts[0].verdict).toBe('fault');
    expect(verdicts[0].reason).toMatch(/unbound/);
  });

  it('an endpoint the profile does not declare is DORMANT under onAbsent degrade', () => {
    // Honest current truth: aln-full-kit has no endpoints block yet,
    // so display.main resolves "not installed tonight" until CS.1
    // adds the block (C1 §2: absent endpoint => dormant, never red).
    const { verdicts } = resolve(alnNeeds, ALN_PROFILE);
    const ep = verdicts.find((v) => v.need.kind === 'endpoint');
    expect(ep.need.id).toBe('display.main');
    expect(ep.verdict).toBe('dormant');
    expect(ep.reason).toMatch(/not installed/);
  });

  it('a declared endpoint resolves runs', () => {
    const profile = {
      ...ALN_PROFILE,
      endpoints: { 'display.main': { output: 'HDMI-1' } },
    };
    const { verdicts } = resolve(alnNeeds, profile);
    const ep = verdicts.find((v) => v.need.kind === 'endpoint');
    expect(ep.verdict).toBe('runs');
  });

  it('an absent endpoint under onAbsent require is NO-GO', () => {
    const needs = [{
      kind: 'endpoint', id: 'display.main',
      onAbsent: 'require', sources: [],
    }];
    const { verdicts, rollup } = resolve(needs, ALN_PROFILE);
    expect(verdicts[0].verdict).toBe('no-go');
    expect(rollup.status).toBe('no-go');
  });

  it('a device-class minimum resolves LIVE against supplied counts, both ways', () => {
    const needs = [{ kind: 'device-class', id: 'staffed', min: 1, sources: [] }];
    const met = resolve(needs, ALN_PROFILE, { deviceCounts: { staffed: 1 } });
    expect(met.verdicts[0]).toMatchObject({ verdict: 'runs', depth: 'live' });
    const unmet = resolve(needs, ALN_PROFILE, { deviceCounts: { staffed: 0 } });
    expect(unmet.verdicts[0].verdict).toBe('no-go');
    expect(unmet.rollup.status).toBe('no-go');
  });

  it('a device-class minimum with NO counts supplied stays paper — unknown never faults', () => {
    const needs = [{ kind: 'device-class', id: 'staffed', min: 1, sources: [] }];
    const { verdicts } = resolve(needs, ALN_PROFILE);
    expect(verdicts[0]).toMatchObject({ verdict: 'runs', depth: 'paper' });
    expect(verdicts[0].reason).toMatch(/unverified/);
  });

  it('the idle-loop channel resolves against the profile surface bindings', () => {
    const { verdicts } = resolve(alnNeeds, ALN_PROFILE);
    const surf = verdicts.find((v) => v.need.kind === 'surface-channel');
    // aln-full-kit binds aln-idle -> idle-loop.mp4
    expect(surf).toMatchObject({ verdict: 'runs', depth: 'paper' });
    const bare = resolve(alnNeeds, { orchestrator: true, bindings: {} });
    const surfBare = bare.verdicts.find((v) => v.need.kind === 'surface-channel');
    expect(surfBare.verdict).toBe('dormant');
  });

  it('rollup grades go / go-degraded / no-go', () => {
    const goAll = resolve(
      [{ kind: 'endpoint', id: 'display.main', onAbsent: 'degrade', sources: [] }],
      { orchestrator: true, bindings: {}, endpoints: { 'display.main': {} } }
    );
    expect(goAll.rollup.status).toBe('go');
    const degraded = resolve(
      [{ kind: 'endpoint', id: 'display.main', onAbsent: 'degrade', sources: [] }],
      { orchestrator: true, bindings: {} }
    );
    expect(degraded.rollup.status).toBe('go-degraded');
  });

  it('sound files resolve live against a supplied file listing, paper without one', () => {
    const needs = [{ kind: 'sound', id: 'attention.wav', sources: [] }];
    const present = resolve(needs, ALN_PROFILE, { soundFiles: ['attention.wav'] });
    expect(present.verdicts[0]).toMatchObject({ verdict: 'runs', depth: 'live' });
    const missing = resolve(needs, ALN_PROFILE, { soundFiles: [] });
    expect(missing.verdicts[0]).toMatchObject({ verdict: 'fault', depth: 'live' });
    const unknown = resolve(needs, ALN_PROFILE);
    expect(unknown.verdicts[0]).toMatchObject({ verdict: 'runs', depth: 'paper' });
  });

  it('stack services are expected under orchestrator:true; live health deepens the verdict', () => {
    const needs = [{ kind: 'service', id: 'vlc', onAbsent: 'degrade', sources: [] }];
    const paper = resolve(needs, ALN_PROFILE);
    expect(paper.verdicts[0]).toMatchObject({ verdict: 'runs', depth: 'paper' });
    const healthy = resolve(needs, ALN_PROFILE, { serviceHealth: { vlc: 'healthy' } });
    expect(healthy.verdicts[0]).toMatchObject({ verdict: 'runs', depth: 'live' });
    const down = resolve(needs, ALN_PROFILE, { serviceHealth: { vlc: 'down' } });
    // C1 §2: orchestrator present => a stack service that is not
    // running is a FAULT, never dormant.
    expect(down.verdicts[0]).toMatchObject({ verdict: 'fault', depth: 'live' });
  });

  it('capabilities are activation-gated: resolve records them as runs', () => {
    const { verdicts } = resolve(alnNeeds, ALN_PROFILE);
    const caps = verdicts.filter((v) => v.need.kind === 'capability');
    expect(caps).toHaveLength(8);
    for (const c of caps) {
      expect(c.verdict).toBe('runs');
      expect(c.reason).toMatch(/activation/);
    }
  });

  it('cue role references mirror their role binding state', () => {
    const { verdicts } = resolve(alnNeeds, ALN_PROFILE);
    const refs = verdicts.filter((v) => v.need.kind === 'lighting-role-ref');
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) {
      expect(r.verdict).toBe('runs');
    }
  });
});
