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
    // The rig IS installed — the role is simply unbound. (Under an
    // uninstalled lighting.instruments the role would be DORMANT before
    // the fallback question arises; T1a D2, pin P2.)
    const bareProfile = {
      orchestrator: true, bindings: {},
      endpoints: { 'lighting.instruments': { installed: true } },
    };
    const { verdicts } = resolve(needs, bareProfile);
    expect(verdicts[0].verdict).toBe('runs');
    expect(verdicts[0].reason).toMatch(/fallback/);
  });

  it('an unbound role with NO fallback is a fault: its commands will refuse', () => {
    // Spec-review adjudication (CS.1 close): NOT dormant — dormant's
    // two doors (CONTEXT.md §4) both require someone to have CHOSEN
    // the absence; a missing binding with no authored fallback is a
    // configuration hole nobody chose, and its cues will refuse
    // mid-show. Alarm integrity cuts both ways: hiding a
    // will-fail-during-show condition behind grey is the
    // miss-a-real-alarm failure. The C1 §2 row says "preflight flag",
    // pointedly not the DORMANT label it uses for endpoints. Per
    // Loop 3 the fault reason carries its verbs.
    const needs = [{
      kind: 'lighting-role', id: 'all-clear',
      fallback: null, sources: [],
    }];
    // Installed rig, unbound role: the hole nobody chose. (T1a D2: with the
    // family uninstalled this same need would be dormant instead.)
    const bareProfile = {
      orchestrator: true, bindings: {},
      endpoints: { 'lighting.instruments': { installed: true } },
    };
    const { verdicts } = resolve(needs, bareProfile);
    expect(verdicts[0].verdict).toBe('fault');
    expect(verdicts[0].reason).toMatch(/will refuse/);
    expect(verdicts[0].reason).toMatch(/bind .*or author a fallback/);
  });

  // Block 2 T1a fix round 1, ruling 24. The two counted families answer
  // the installed question through their OWN field — `stations.count` and
  // `personal.expected` — because the profile schema gives them nothing
  // else (additionalProperties: false, no `installed`). Before the fix
  // resolve() called a fully-equipped four-station venue dormant.
  it('a stations endpoint need resolves runs against the real full-kit (count: 3)', () => {
    const { verdicts, rollup } = resolve(
      [{ kind: 'endpoint', id: 'stations', onAbsent: 'degrade', sources: [] }],
      ALN_PROFILE
    );
    expect(verdicts[0].verdict).toBe('runs');
    expect(rollup.dormantNeeds).toEqual([]);
  });

  it('a stations endpoint need is DORMANT when the venue set none up (count: 0)', () => {
    const noStations = { ...ALN_PROFILE, endpoints: { stations: { count: 0 } } };
    const { verdicts } = resolve(
      [{ kind: 'endpoint', id: 'stations', onAbsent: 'degrade', sources: [] }],
      noStations
    );
    expect(verdicts[0].verdict).toBe('dormant');
  });

  it('a personal endpoint need follows `expected`, not a non-existent `installed`', () => {
    const expected = { ...ALN_PROFILE, endpoints: { personal: { expected: true } } };
    const notExpected = { ...ALN_PROFILE, endpoints: { personal: { expected: false } } };
    const need = [{ kind: 'endpoint', id: 'personal', onAbsent: 'degrade', sources: [] }];
    expect(resolve(need, expected).verdicts[0].verdict).toBe('runs');
    expect(resolve(need, notExpected).verdicts[0].verdict).toBe('dormant');
  });

  it('an endpoint the profile does not declare is DORMANT under onAbsent degrade', () => {
    // The real ALN full-kit profile now DECLARES its endpoints (Block 2
    // T1b, D2) — see "the ALN full-kit profile declares every family"
    // below for that world. The omitted-endpoint row is exercised here
    // on a profile DERIVED from the real one with its endpoints block
    // cleared (C1 §2: absent endpoint => dormant, never red).
    const noEndpoints = { ...ALN_PROFILE, endpoints: {} };
    const { verdicts } = resolve(alnNeeds, noEndpoints);
    const ep = verdicts.find((v) => v.need.kind === 'endpoint');
    expect(ep.need.id).toBe('display.main');
    expect(ep.verdict).toBe('dormant');
    expect(ep.reason).toMatch(/not installed/);
  });

  it('the ALN full-kit profile declares every family — its endpoint needs all resolve runs, nothing dormant', () => {
    // Block 2 T1b (D2): aln-full-kit.json now declares display.main,
    // audio.sinks, and lighting.instruments, all installed.
    const { verdicts, rollup } = resolve(alnNeeds, ALN_PROFILE);
    const endpoints = verdicts.filter((v) => v.need.kind === 'endpoint');
    expect(endpoints).toHaveLength(3);
    for (const ep of endpoints) {
      expect(ep.verdict).toBe('runs');
    }
    expect(rollup.dormantNeeds).toEqual([]);
  });

  it('a declared endpoint resolves runs', () => {
    // `installed: true` is REQUIRED by the pinned endpoints interior
    // (T1b D1) and, since T1a D2, is what "declared" MEANS — a synthetic
    // profile without it is a declared-but-uninstalled family, i.e. dormant.
    const profile = {
      ...ALN_PROFILE,
      endpoints: { 'display.main': { installed: true, output: 'HDMI-1' } },
    };
    const { verdicts } = resolve(alnNeeds, profile);
    const ep = verdicts.find((v) => v.need.kind === 'endpoint');
    expect(ep.verdict).toBe('runs');
  });

  it('an absent endpoint under onAbsent require is NO-GO', () => {
    // Same derived (endpoints-cleared) profile as the DORMANT case above
    // — the real ALN_PROFILE declares display.main now, which would
    // resolve runs and never reach the require branch.
    const needs = [{
      kind: 'endpoint', id: 'display.main',
      onAbsent: 'require', sources: [],
    }];
    const noEndpoints = { ...ALN_PROFILE, endpoints: {} };
    const { verdicts, rollup } = resolve(needs, noEndpoints);
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
      { orchestrator: true, bindings: {}, endpoints: { 'display.main': { installed: true } } }
    );
    expect(goAll.rollup.status).toBe('go');
    const degraded = resolve(
      [{ kind: 'endpoint', id: 'display.main', onAbsent: 'degrade', sources: [] }],
      { orchestrator: true, bindings: {} }
    );
    expect(degraded.rollup.status).toBe('go-degraded');
  });

  it('rollup carries dormantServices and problems (D-C2.1 shape)', () => {
    // The real ALN pack against a profile DERIVED from the real
    // full-kit with its endpoints block cleared: display.main is
    // dormant again (see the two cases above), and a live inventory
    // missing one cue-referenced sound produces a fault whose reason
    // lands in problems. disabledCueIds is deliberately NOT produced
    // here — its true producer is C3's session-start disable walk
    // (CS.2), and a resolve-time guess would duplicate it.
    const noEndpoints = { ...ALN_PROFILE, endpoints: {} };
    const soundIds = alnNeeds
      .filter((n) => n.kind === 'sound').map((n) => n.id);
    const { rollup } = resolve(alnNeeds, noEndpoints, {
      soundFiles: soundIds.filter((id) => id !== 'tension.wav'),
    });
    expect(rollup.dormantNeeds).toContain('display.main');
    expect(rollup.problems).toEqual(
      expect.arrayContaining([expect.stringMatching(/tension\.wav.*missing/)])
    );
    expect(rollup.status).toBe('go-degraded');

    const clean = resolve(alnNeeds, noEndpoints, { soundFiles: soundIds });
    expect(clean.rollup.problems).toEqual([]);
  });

  it('orchestrator:false is tier zero: orchestrator features dormant BY DESIGN, never fault', () => {
    // C1 §2 row: "anything | orchestrator:false | tier zero:
    // standalone-capable elements only; all orchestrator features
    // unavailable (by design)". Even live down-health must not fault —
    // nothing was promised to run. Capabilities and device-class
    // minimums are standalone-capable (scanner-side) and unchanged.
    const tierZero = { orchestrator: false, bindings: {} };
    const { verdicts, rollup } = resolve(alnNeeds, tierZero, {
      serviceHealth: { vlc: 'down', music: 'down' },
    });
    for (const v of verdicts) {
      expect(v.verdict).not.toBe('fault');
      expect(v.verdict).not.toBe('no-go');
      if (!['capability', 'device-class'].includes(v.need.kind)) {
        expect(v.verdict).toBe('dormant');
        expect(v.reason).toMatch(/tier zero|by design/);
      }
    }
    expect(rollup.status).toBe('go-degraded');
  });

  it('the toy pack resolves against its REAL test-rig profile (dual-pack)', () => {
    // Second consumer, real content: toy-test-rig binds BOTH roles —
    // including fallback-less all-clear — so the toy show rolls up go
    // with no dormant services and no problems.
    const TOY_DIR = path.join(
      REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures', 'packs', 'toy-heist'
    );
    const TOY_PROFILE = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures',
        'profiles', 'toy-test-rig.json'),
      'utf8'
    ));
    const toyNeeds = collectPackNeeds(loadPack(TOY_DIR));
    const { verdicts, rollup } = resolve(toyNeeds, TOY_PROFILE);
    const allClear = verdicts.find(
      (v) => v.need.kind === 'lighting-role' && v.need.id === 'all-clear'
    );
    expect(allClear.verdict).toBe('runs');
    // The fixture binds witness scenes since the S5 close fold (the
    // invented scene.toy_* names predated the witness register and no
    // HA served them, leaving the flow's live half file-order-dependent).
    expect(allClear.reason).toBe('bound: scene.witness_all_clear');
    expect(rollup).toEqual(
      { status: 'go', dormantNeeds: [], problems: [], blocking: [] }
    );
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

// ── Block 2 T1a D2 ────────────────────────────────────────────────────
// Dormancy is a first-class verdict here, not a special case bolted onto
// "absent": installed:false is the SAME fact as omitted; a service the
// registry has latched dormant resolves dormant (never fault, so the
// dashboard never goes red for equipment nobody installed); and the needs
// that exist only to drive a dormant family follow it (P2).
describe('resolve — dormancy (T1a D2, pins P2/P5, ruling R16/R18)', () => {
  const TOY_DIR = path.join(
    REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures', 'packs', 'toy-heist'
  );
  const readProfile = (name) => JSON.parse(fs.readFileSync(
    path.join(REPO_ROOT, 'backend', 'tests', 'e2e', 'fixtures', 'profiles', name),
    'utf8'
  ));
  const TOY_RIG = readProfile('toy-test-rig.json');
  const TOY_DORMANT = readProfile('toy-dormant-lighting.json');
  const toyNeeds = collectPackNeeds(loadPack(TOY_DIR));

  describe('installed:false is the same fact as omitted', () => {
    const need = (onAbsent) => [{
      kind: 'endpoint', id: 'display.main', onAbsent, sources: [],
    }];

    it('degrade: declared installed:false resolves dormant, exactly like absent', () => {
      const declaredOff = resolve(need('degrade'),
        { orchestrator: true, bindings: {}, endpoints: { 'display.main': { installed: false } } });
      const omitted = resolve(need('degrade'),
        { orchestrator: true, bindings: {}, endpoints: {} });
      expect(declaredOff.verdicts[0].verdict).toBe('dormant');
      expect(declaredOff.verdicts[0].reason).toBe(omitted.verdicts[0].reason);
      expect(declaredOff.verdicts[0].reason).toBe("'display.main' not installed tonight");
    });

    it('require: declared installed:false is NO-GO, exactly like absent', () => {
      const declaredOff = resolve(need('require'),
        { orchestrator: true, bindings: {}, endpoints: { 'display.main': { installed: false } } });
      const omitted = resolve(need('require'),
        { orchestrator: true, bindings: {}, endpoints: {} });
      expect(declaredOff.verdicts[0].verdict).toBe('no-go');
      expect(declaredOff.verdicts[0].reason).toBe(omitted.verdicts[0].reason);
      expect(declaredOff.rollup.blocking).toEqual([
        "required endpoint 'display.main' not installed at this venue",
      ]);
    });

    it('an audio.sinks array with every entry installed:false is dormant', () => {
      const { verdicts } = resolve(
        [{ kind: 'endpoint', id: 'audio.sinks', onAbsent: 'degrade', sources: [] }],
        { orchestrator: true, bindings: {}, endpoints: { 'audio.sinks': [{ id: 'x', installed: false }] } }
      );
      expect(verdicts[0].verdict).toBe('dormant');
    });
  });

  describe('a dormant SERVICE resolves dormant, not fault (R16 both inventory shapes)', () => {
    const needs = [{ kind: 'service', id: 'vlc', onAbsent: 'degrade', sources: [] }];

    it('registry-entry shape, profile door', () => {
      const { verdicts, rollup } = resolve(needs, ALN_PROFILE, {
        serviceHealth: { vlc: { status: 'dormant', message: 'x', door: 'profile' } },
      });
      expect(verdicts[0]).toMatchObject({ verdict: 'dormant', depth: 'live' });
      expect(verdicts[0].reason).toBe("'vlc' is not installed tonight");
      expect(rollup.dormantNeeds).toEqual(['vlc']);
      expect(rollup.problems).toEqual([]);
    });

    it('registry-entry shape, operator door', () => {
      const { verdicts } = resolve(needs, ALN_PROFILE, {
        serviceHealth: { vlc: { status: 'dormant', message: 'x', door: 'operator' } },
      });
      expect(verdicts[0].reason).toBe("'vlc' is out of service");
    });

    it('bare string shape stays supported: dormant with no door wording', () => {
      const { verdicts } = resolve(needs, ALN_PROFILE, {
        serviceHealth: { vlc: 'dormant' },
      });
      expect(verdicts[0]).toMatchObject({ verdict: 'dormant', depth: 'live' });
      expect(verdicts[0].reason).toBe("'vlc' is dormant");
    });

    it('the entry shape still reads healthy and down the old way', () => {
      const healthy = resolve(needs, ALN_PROFILE, {
        serviceHealth: { vlc: { status: 'healthy', message: 'up' } },
      });
      expect(healthy.verdicts[0]).toMatchObject({ verdict: 'runs', depth: 'live' });
      const down = resolve(needs, ALN_PROFILE, {
        serviceHealth: { vlc: { status: 'down', message: 'refused' } },
      });
      expect(down.verdicts[0]).toMatchObject({ verdict: 'fault', depth: 'live' });
      expect(down.verdicts[0].reason).toBe("stack service 'vlc' is down");
    });
  });

  describe('dependent needs follow their family (P2)', () => {
    it('both toy lighting roles resolve DORMANT under toy-dormant-lighting — not fault', () => {
      const { verdicts, rollup } = resolve(toyNeeds, TOY_DORMANT);
      const roleish = verdicts.filter(
        (v) => v.need.kind === 'lighting-role' || v.need.kind === 'lighting-role-ref'
      );
      expect(roleish.length).toBeGreaterThan(0);
      for (const v of roleish) {
        expect({ id: v.need.id, kind: v.need.kind, verdict: v.verdict, depth: v.depth })
          .toEqual({ id: v.need.id, kind: v.need.kind, verdict: 'dormant', depth: 'paper' });
        expect(v.reason).toBe('lighting not installed tonight');
      }
      expect(rollup.dormantNeeds).toContain('lighting.instruments');
      expect(rollup.problems).toEqual([]);
      expect(rollup.blocking).toEqual([]);
    });

    it('the SAME needs resolve runs against toy-test-rig (the family is installed)', () => {
      const { verdicts, rollup } = resolve(toyNeeds, TOY_RIG);
      const roleish = verdicts.filter(
        (v) => v.need.kind === 'lighting-role' || v.need.kind === 'lighting-role-ref'
      );
      for (const v of roleish) {
        expect({ id: v.need.id, verdict: v.verdict }).toEqual({ id: v.need.id, verdict: 'runs' });
      }
      expect(rollup.status).toBe('go');
    });

    it('an UNBOUND role under an INSTALLED family is still a FAULT (the hole nobody chose)', () => {
      const needs = [{ kind: 'lighting-role', id: 'all-clear', fallback: null, sources: [] }];
      const installedButUnbound = {
        orchestrator: true,
        bindings: {},
        endpoints: { 'lighting.instruments': { installed: true } },
      };
      const { verdicts } = resolve(needs, installedButUnbound);
      expect(verdicts[0].verdict).toBe('fault');
      expect(verdicts[0].reason).toMatch(/will refuse/);
    });

    it('a role-ref under a dormant family is dormant too (it mirrors the role)', () => {
      const needs = [{ kind: 'lighting-role-ref', id: 'vault-alarm', sources: [] }];
      const { verdicts } = resolve(needs, {
        orchestrator: true, bindings: { lighting: { 'vault-alarm': { ha: 'scene.x' } } },
        endpoints: { 'lighting.instruments': { installed: false } },
      });
      // the endpoint wins over the binding — the rig is not in the room
      expect(verdicts[0].verdict).toBe('dormant');
      expect(verdicts[0].reason).toBe('lighting not installed tonight');
    });

    it('surface-channel is dormant under a dormant display.main, even when bound', () => {
      const needs = [{ kind: 'surface-channel', id: 'aln-idle', sources: [] }];
      const bound = { surfaces: { 'aln-idle': { file: 'idle-loop.mp4' } } };
      const dormantDisplay = resolve(needs, {
        orchestrator: true, bindings: bound,
        endpoints: { 'display.main': { installed: false } },
      });
      expect(dormantDisplay.verdicts[0]).toMatchObject({ verdict: 'dormant', depth: 'paper' });
      expect(dormantDisplay.verdicts[0].reason).toBe('display not installed tonight');

      const installedDisplay = resolve(needs, {
        orchestrator: true, bindings: bound,
        endpoints: { 'display.main': { installed: true } },
      });
      expect(installedDisplay.verdicts[0].verdict).toBe('runs');
    });

    it('an unbound channel under an INSTALLED display keeps its old dormant wording', () => {
      const needs = [{ kind: 'surface-channel', id: 'aln-idle', sources: [] }];
      const { verdicts } = resolve(needs, {
        orchestrator: true, bindings: {},
        endpoints: { 'display.main': { installed: true } },
      });
      expect(verdicts[0].verdict).toBe('dormant');
      expect(verdicts[0].reason).toBe("channel 'aln-idle' not installed tonight");
    });
  });

  describe('rollUp shape (R18)', () => {
    it('blocking holds ONLY no-go reasons, and is [] when only faults are present', () => {
      const { rollup } = resolve(
        [{ kind: 'sound', id: 'missing.wav', sources: [] }],
        ALN_PROFILE,
        { soundFiles: [] }
      );
      expect(rollup.status).toBe('go-degraded');
      expect(rollup.problems).toEqual(["sound file 'missing.wav' missing"]);
      expect(rollup.blocking).toEqual([]);
    });

    it('blocking is the no-go subset of problems when both are present', () => {
      const { rollup } = resolve(
        [
          { kind: 'sound', id: 'missing.wav', sources: [] },
          { kind: 'endpoint', id: 'display.main', onAbsent: 'require', sources: [] },
        ],
        { orchestrator: true, bindings: {}, endpoints: {} },
        { soundFiles: [] }
      );
      expect(rollup.status).toBe('no-go');
      expect(rollup.blocking).toEqual([
        "required endpoint 'display.main' not installed at this venue",
      ]);
      expect(rollup.problems).toEqual(expect.arrayContaining(rollup.blocking));
      expect(rollup.problems).toHaveLength(2);
    });

    it('the rollup key is dormantNeeds — dormantServices is gone', () => {
      const { rollup } = resolve(toyNeeds, TOY_DORMANT);
      expect(Object.keys(rollup).sort())
        .toEqual(['blocking', 'dormantNeeds', 'problems', 'status']);
      expect(rollup.dormantServices).toBeUndefined();
    });
  });
});
