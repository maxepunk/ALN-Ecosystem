/**
 * Unit tests: packService (Phase 3 A2 — the active game pack directory)
 *
 * Covers: PACK_PATH override + loud warn-once, manifest mtime cache,
 * activation snapshot semantics (identity frozen at boot; disk drift
 * loud-warned; pre-pack null stays null), and resolvePackFile whitelist
 * + traversal containment.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('../../../src/utils/logger');
const packService = require('../../../src/services/packService');

const TOY_PACK = path.resolve(__dirname, '../../e2e/fixtures/packs/toy-heist');

// Distinct 64-hex hashes for drift tests
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;

/** Write a minimal manifest and force a DISTINCT mtime (1s granularity on
 * some filesystems would otherwise let the mtime cache serve stale data). */
let mtimeBump = 0;
function writeManifest(dir, manifest) {
  const p = path.join(dir, 'pack-manifest.json');
  fs.writeFileSync(p, JSON.stringify(manifest));
  mtimeBump += 10;
  const t = Math.floor(Date.now() / 1000) + mtimeBump;
  fs.utimesSync(p, t, t);
}

function minimalManifest(overrides = {}) {
  return {
    kind: 'pack-manifest',
    schemaVersion: 1,
    packId: 'unit-pack',
    version: '0.0.1',
    contentHash: HASH_A,
    engine: { minVersion: '3.0.0' },
    files: [{ path: 'tokens.json', role: 'tokens', sha1: '0'.repeat(40), size: 2 }],
    ...overrides,
  };
}

describe('packService', () => {
  let tmpDir;
  const originalPackPath = process.env.PACK_PATH;

  beforeEach(() => {
    packService._resetForTesting();
    jest.clearAllMocks();
    delete process.env.PACK_PATH;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-packsvc-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalPackPath === undefined) {
      delete process.env.PACK_PATH;
    } else {
      process.env.PACK_PATH = originalPackPath;
    }
    packService._resetForTesting();
  });

  describe('getPackDir', () => {
    it('defaults to the ALN-TokenData submodule', () => {
      expect(packService.getPackDir()).toBe(
        path.resolve(__dirname, '../../../../ALN-TokenData')
      );
    });

    it('PACK_PATH overrides the default and warns LOUDLY exactly once', () => {
      process.env.PACK_PATH = tmpDir;
      expect(packService.getPackDir()).toBe(path.resolve(tmpDir));
      expect(packService.getPackDir()).toBe(path.resolve(tmpDir));
      const overrideWarns = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('PACK_PATH override ACTIVE')
      );
      expect(overrideWarns).toHaveLength(1);
    });
  });

  describe('getManifest (pre-activation: live disk reads)', () => {
    it('parses the toy pack manifest', () => {
      process.env.PACK_PATH = TOY_PACK;
      expect(packService.getManifest().packId).toBe('midnight-heist');
    });

    it('returns null when the directory has no manifest', () => {
      process.env.PACK_PATH = tmpDir;
      expect(packService.getManifest()).toBeNull();
    });

    it('returns null and warns on unparseable JSON', () => {
      process.env.PACK_PATH = tmpDir;
      fs.writeFileSync(path.join(tmpDir, 'pack-manifest.json'), '{nope');
      expect(packService.getManifest()).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Pack manifest unreadable')
      );
    });

    it('serves the mtime cache on unchanged files and re-reads on change', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest({ version: '1.0.0' }));
      const first = packService.getManifest();
      expect(packService.getManifest()).toBe(first); // same object: cached

      writeManifest(tmpDir, minimalManifest({ version: '2.0.0', contentHash: HASH_B }));
      expect(packService.getManifest().version).toBe('2.0.0');
    });
  });

  describe('activatePack (boot-time snapshot semantics)', () => {
    it('freezes identity at activation; later disk edits are not advertised', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
      const info = packService.activatePack();
      expect(info).toEqual({ packId: 'unit-pack', version: '0.0.1', contentHash: HASH_A });

      writeManifest(tmpDir, minimalManifest({ version: '9.9.9', contentHash: HASH_B }));
      expect(packService.getActivePackInfo()).toEqual(info);
      expect(packService.getManifest().contentHash).toBe(HASH_A);
    });

    it('loud-warns drift exactly once per distinct disk state', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
      packService.activatePack();

      writeManifest(tmpDir, minimalManifest({ contentHash: HASH_B }));
      packService.getManifest();
      packService.getManifest();
      const driftWarns = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('differs from the ACTIVE pack')
      );
      expect(driftWarns).toHaveLength(1);
      expect(driftWarns[0][0]).toContain(HASH_B);
      expect(driftWarns[0][0]).toContain(HASH_A);
    });

    it('a pre-pack checkout stays identity-null even if a manifest appears later', () => {
      process.env.PACK_PATH = tmpDir;
      expect(packService.activatePack()).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('pack identity is null')
      );

      writeManifest(tmpDir, minimalManifest());
      expect(packService.getActivePackInfo()).toBeNull();
      const driftWarns = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('differs from the ACTIVE pack')
      );
      expect(driftWarns).toHaveLength(1);
    });
  });

  describe('getActivePackInfo', () => {
    it('reports the toy pack identity fields', () => {
      process.env.PACK_PATH = TOY_PACK;
      const info = packService.getActivePackInfo();
      expect(info.packId).toBe('midnight-heist');
      expect(info.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(Object.keys(info).sort()).toEqual(['contentHash', 'packId', 'version']);
    });

    it('is null without a manifest', () => {
      process.env.PACK_PATH = tmpDir;
      expect(packService.getActivePackInfo()).toBeNull();
    });
  });

  describe('resolvePackFile (whitelist + containment)', () => {
    it('resolves inventoried paths to absolute paths inside the pack dir', () => {
      process.env.PACK_PATH = TOY_PACK;
      const abs = packService.resolvePackFile('tokens.json');
      expect(abs).toBe(path.join(TOY_PACK, 'tokens.json'));
      expect(packService.resolvePackFile('game.json')).toBe(path.join(TOY_PACK, 'game.json'));
    });

    it('returns null for non-inventoried paths and with no manifest', () => {
      process.env.PACK_PATH = TOY_PACK;
      expect(packService.resolvePackFile('pack-manifest.json')).toBeNull();
      expect(packService.resolvePackFile('nope.json')).toBeNull();

      process.env.PACK_PATH = tmpDir;
      packService._resetForTesting();
      expect(packService.resolvePackFile('tokens.json')).toBeNull();
    });

    it('refuses traversal even when the manifest inventory itself is hostile', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest({
        files: [{ path: '../outside.txt', role: 'other', sha1: '0'.repeat(40), size: 1 }],
      }));
      // resolvePackFile never touches the target file — containment is
      // decided purely on the resolved path prefix.
      expect(packService.resolvePackFile('../outside.txt')).toBeNull();
    });
  });

  describe('getGameConfig (A3 slice 0 — audit F4)', () => {
    function writeGame(dir, game) {
      fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(game));
    }

    it('reads the toy pack game.json pre-activation (live disk)', () => {
      process.env.PACK_PATH = TOY_PACK;
      const game = packService.getGameConfig();
      expect(game.id).toBe('midnight-heist');
      expect(Array.isArray(game.modes)).toBe(true);
    });

    it('is null when the pack ships no game.json (parity fixtures, pre-pack checkouts)', () => {
      process.env.PACK_PATH = tmpDir;
      expect(packService.getGameConfig()).toBeNull();
    });

    it('activation SNAPSHOTS game.json — later disk edits are invisible (rules frozen)', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
      writeGame(tmpDir, { kind: 'game', schemaVersion: 1, id: 'unit-game' });
      packService.activatePack();

      writeGame(tmpDir, { kind: 'game', schemaVersion: 1, id: 'EDITED' });

      expect(packService.getGameConfig().id).toBe('unit-game');
    });

    it('a pack activated without game.json stays null for the process lifetime', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
      packService.activatePack();

      writeGame(tmpDir, { kind: 'game', schemaVersion: 1, id: 'late' });

      expect(packService.getGameConfig()).toBeNull();
    });
  });

  describe('capability gate (A3 slice 0 — audit F2 + adversarial R6)', () => {
    function writeGame(dir, game) {
      fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(game));
    }

    it('activates the REAL packs unchanged (ALN default dir + toy pack declare only what the engine has)', () => {
      process.env.PACK_PATH = TOY_PACK;
      expect(() => packService.activatePack()).not.toThrow();
    });

    it('refuses a pack requiring a NEWER engine (manifest engine.minVersion)', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest({ engine: { minVersion: '99.0.0' } }));
      expect(() => packService.activatePack()).toThrow(/CAPABILITY GATE.*engine >= 99\.0\.0/);
    });

    it('refuses a manifest authored against a future schemaVersion', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest({ schemaVersion: 2 }));
      expect(() => packService.activatePack()).toThrow(/CAPABILITY GATE.*schemaVersion 2/);
    });

    it('refuses a game.json authored against a future schemaVersion', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
      writeGame(tmpDir, { kind: 'game', schemaVersion: 2, id: 'future' });
      expect(() => packService.activatePack()).toThrow(/CAPABILITY GATE.*game\.json schemaVersion 2/);
    });

    it('refuses unknown required capabilities — headroom is never silently absorbed', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
      writeGame(tmpDir, {
        kind: 'game', schemaVersion: 1, id: 'constellation',
        requires: ['scoring.tabular', 'scoring.graph', 'contagion'],
      });
      expect(() => packService.activatePack()).toThrow(/CAPABILITY GATE.*scoring\.graph, contagion/);
    });

    it('accepts a requires array the engine fully implements', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
      writeGame(tmpDir, {
        kind: 'game', schemaVersion: 1, id: 'subset',
        requires: ['scoring.tabular', 'groupRules.all'],
      });
      expect(() => packService.activatePack()).not.toThrow();
      expect(packService.getGameConfig().id).toBe('subset');
    });

    it('a pack that declares NOTHING gates nothing (pre-pack + v1 behavior preserved)', () => {
      process.env.PACK_PATH = tmpDir; // empty dir: no manifest, no game.json
      expect(() => packService.activatePack()).not.toThrow();
      expect(packService.getActivePackInfo()).toBeNull();
    });

    it('the refusal FAILS activation — nothing is snapshotted', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest({ engine: { minVersion: '99.0.0' } }));
      expect(() => packService.activatePack()).toThrow(/CAPABILITY GATE/);
      // Not activated: reads stay live-disk (pre-activation semantics).
      writeManifest(tmpDir, minimalManifest({ engine: { minVersion: '1.0.0' }, contentHash: HASH_B }));
      expect(packService.getManifest().contentHash).toBe(HASH_B);
    });
  });

  describe('mode drivability (A3 slice 1 — flag values gated, schema stays open)', () => {
    function writeGame(dir, game) {
      fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(game));
    }
    const mode = (overrides = {}) => ({
      id: 'm1', label: 'M1', scoringPolicy: 'standard', entityRole: 'ledger',
      countsTowardGroups: true, displayBehavior: { surface: 'scoreboard-rankings' },
      ...overrides,
    });
    const gameWith = (...modes) => ({ kind: 'game', schemaVersion: 1, id: 'drv', modes });

    beforeEach(() => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
    });

    it('refuses a scoringPolicy this engine does not implement, naming the mode', () => {
      writeGame(tmpDir, gameWith(mode({ id: 'constellation', scoringPolicy: 'graph' })));
      expect(() => packService.activatePack())
        .toThrow(/CAPABILITY GATE.*mode 'constellation' is not driveable.*scoringPolicy 'graph'/);
    });

    it('refuses an unimplemented entityRole', () => {
      writeGame(tmpDir, gameWith(mode({ entityRole: 'faction' })));
      expect(() => packService.activatePack())
        .toThrow(/not driveable.*entityRole 'faction'/);
    });

    it('refuses an unimplemented display surface', () => {
      writeGame(tmpDir, gameWith(mode({ displayBehavior: { surface: 'constellation-map' } })));
      expect(() => packService.activatePack())
        .toThrow(/not driveable.*displayBehavior\.surface 'constellation-map'/);
    });

    it('accepts modes the engine has never heard of when every flag value is implemented (open vocabulary)', () => {
      writeGame(tmpDir, gameWith(
        mode({ id: 'fence' }),
        mode({ id: 'tipoff', scoringPolicy: 'none', entityRole: 'attribution', defaultEntity: 'D', countsTowardGroups: false, displayBehavior: { surface: 'scoreboard-evidence' } })
      ));
      expect(() => packService.activatePack()).not.toThrow();
    });

    it('an absent displayBehavior is drivable (normalizes to surface none)', () => {
      writeGame(tmpDir, gameWith(mode({ displayBehavior: undefined })));
      expect(() => packService.activatePack()).not.toThrow();
    });

    it('lists EVERY undrivable flag of every undrivable mode in one refusal', () => {
      writeGame(tmpDir, gameWith(
        mode({ id: 'bad1', scoringPolicy: 'graph', entityRole: 'faction' }),
        mode({ id: 'ok' }),
        mode({ id: 'bad2', displayBehavior: { surface: 'holo' } })
      ));
      let err = null;
      try { packService.activatePack(); } catch (e) { err = e; }
      expect(err).not.toBeNull();
      expect(err.message).toMatch(/bad1.*scoringPolicy 'graph', entityRole 'faction'/);
      expect(err.message).toMatch(/bad2.*displayBehavior\.surface 'holo'/);
      expect(err.message).not.toMatch(/mode 'ok'/);
    });

    it('refuses an unimplemented claims value; drives both implemented policies (D3s2)', () => {
      writeGame(tmpDir, gameWith(mode({ id: 'weird', claims: 'per-actor' })));
      expect(() => packService.activatePack())
        .toThrow(/mode 'weird' is not driveable.*claims 'per-actor'/);

      packService._resetForTesting();
      writeGame(tmpDir, gameWith(
        mode({ id: 'sell', claims: 'consuming' }),
        mode({ id: 'appraise', scoringPolicy: 'none', countsTowardGroups: false, claims: 'non-consuming' })
      ));
      expect(() => packService.activatePack()).not.toThrow();
    });
  });

  describe('rules-block drivability (A3 slice 2 — §2i/§2j: the engine implements the declared table only)', () => {
    function writeGame(dir, game) {
      fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(game));
    }
    const base = () => ({ kind: 'game', schemaVersion: 1, id: 'rules' });

    beforeEach(() => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
    });

    it("refuses duplicatePolicy.claim other than 'once' (non-consuming claims arrive WITH their enforcement)", () => {
      writeGame(tmpDir, { ...base(), duplicatePolicy: { claim: 'unlimited', view: 'unlimited' } });
      expect(() => packService.activatePack())
        .toThrow(/CAPABILITY GATE.*duplicatePolicy\.claim 'unlimited'/);
    });

    it("refuses duplicatePolicy.view other than 'unlimited'", () => {
      writeGame(tmpDir, { ...base(), duplicatePolicy: { claim: 'once', view: 'once' } });
      expect(() => packService.activatePack())
        .toThrow(/CAPABILITY GATE.*duplicatePolicy\.view 'once'/);
    });

    it('accepts the declared table (once / unlimited) — the policy the engine implements', () => {
      writeGame(tmpDir, { ...base(), duplicatePolicy: { claim: 'once', view: 'unlimited' } });
      expect(() => packService.activatePack()).not.toThrow();
    });

    it("refuses groupRules.type other than 'all' with the named slice-2 message", () => {
      writeGame(tmpDir, { ...base(), groupRules: { type: 'any', minSize: 2 } });
      expect(() => packService.activatePack())
        .toThrow(/CAPABILITY GATE.*groupRules\.type 'any'.*declared table only/);
    });

    it('refuses groupRules.minSize other than 2', () => {
      writeGame(tmpDir, { ...base(), groupRules: { type: 'all', minSize: 3 } });
      expect(() => packService.activatePack())
        .toThrow(/groupRules\.minSize 3/);
    });

    it("refuses an unimplemented completion.bonusFormula", () => {
      writeGame(tmpDir, { ...base(), groupRules: { type: 'all', minSize: 2, completion: { bonusFormula: 'flat-thousand' } } });
      expect(() => packService.activatePack())
        .toThrow(/bonusFormula 'flat-thousand'/);
    });

    it('accepts the full declared ALN/toy table and an ABSENT block alike', () => {
      writeGame(tmpDir, {
        ...base(),
        groupRules: { type: 'all', minSize: 2, completion: { bonusFormula: 'multiplier-minus-one-times-base' } },
        duplicatePolicy: { claim: 'once', view: 'unlimited' },
      });
      expect(() => packService.activatePack()).not.toThrow();
      packService._resetForTesting();
      writeGame(tmpDir, base()); // nothing declared gates nothing
      expect(() => packService.activatePack()).not.toThrow();
    });
  });

  describe('phases gate (A3 slice 2 — D1s2: multi-phase clocks refuse until slice 5)', () => {
    function writeGame(dir, game) {
      fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(game));
    }
    const base = () => ({ kind: 'game', schemaVersion: 1, id: 'phases' });

    beforeEach(() => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
    });

    it('refuses a multi-phase clock with the named slice-5 retirement', () => {
      writeGame(tmpDir, {
        ...base(),
        gameClock: {
          duration: 3600,
          phases: [
            { id: 'casing', label: 'Casing the Joint', start: { at: 0 } },
            { id: 'the-job', label: 'The Job', start: { at: 1800 } },
          ],
        },
      });
      expect(() => packService.activatePack())
        .toThrow(/CAPABILITY GATE.*gameClock\.phases.*not driveable by this engine yet \(see slice 5\)/);
    });

    it('refuses a single phase that does not start at 0', () => {
      writeGame(tmpDir, {
        ...base(),
        gameClock: { phases: [{ id: 'late', label: 'Late', start: { at: 600 } }] },
      });
      expect(() => packService.activatePack())
        .toThrow(/gameClock\.phases.*not driveable by this engine yet \(see slice 5\)/);
    });

    it('refuses a trigger-started phase (trigger-starts are slice 5 too)', () => {
      writeGame(tmpDir, {
        ...base(),
        gameClock: { phases: [{ id: 'main', label: 'Game', start: { trigger: 'cue:fired' } }] },
      });
      expect(() => packService.activatePack())
        .toThrow(/gameClock\.phases.*not driveable by this engine yet \(see slice 5\)/);
    });

    it('is a drivability LIMITATION, never a contradiction (language rule pinned)', () => {
      writeGame(tmpDir, {
        ...base(),
        gameClock: { phases: [{ id: 'a', start: { at: 0 } }, { id: 'b', start: { at: 10 } }] },
      });
      let message = '';
      try {
        packService.activatePack();
      } catch (err) {
        message = err.message;
      }
      expect(message).toMatch(/not driveable by this engine yet \(see slice 5\)/);
      expect(message).not.toMatch(/incoherent/i);
      expect(message).not.toMatch(/self-contradictory/i);
    });

    it('a NULL/malformed phase entry refuses with the NAMED message, never a raw TypeError (review pin)', () => {
      writeGame(tmpDir, { ...base(), gameClock: { phases: [null] } });
      expect(() => packService.activatePack())
        .toThrow(/gameClock\.phases.*not driveable by this engine yet \(see slice 5\)/);

      packService._resetForTesting();
      writeGame(tmpDir, { ...base(), gameClock: { phases: [{ id: 'x', start: null }] } });
      expect(() => packService.activatePack())
        .toThrow(/not driveable by this engine yet \(see slice 5\)/);
    });

    it('accepts the degenerate single-phase-at-0 (the ALN shape)', () => {
      writeGame(tmpDir, {
        ...base(),
        gameClock: {
          duration: 7200,
          overtimeAt: 7200,
          phases: [{ id: 'main', label: 'Game', start: { at: 0 } }],
        },
      });
      expect(() => packService.activatePack()).not.toThrow();
    });

    it('accepts absent gameClock, absent phases, and an empty phases array (nothing declared gates nothing)', () => {
      writeGame(tmpDir, base());
      expect(() => packService.activatePack()).not.toThrow();
      packService._resetForTesting();
      writeGame(tmpDir, { ...base(), gameClock: { duration: 3600 } });
      expect(() => packService.activatePack()).not.toThrow();
      packService._resetForTesting();
      writeGame(tmpDir, { ...base(), gameClock: { duration: 3600, phases: [] } });
      expect(() => packService.activatePack()).not.toThrow();
    });
  });

  describe('groups coverage gate (A3 slice 2b — D1b: tokens must name declared groups)', () => {
    function writePack(dir, { groups, tokens }) {
      fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({
        kind: 'game', schemaVersion: 1, id: 'gc', ...(groups ? { groups } : {}),
      }));
      fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(tokens));
    }

    beforeEach(() => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
    });

    it('refuses a declaring pack whose tokens name an UNDECLARED group', () => {
      writePack(tmpDir, {
        groups: { 'Server Logs': { multiplier: 5 } },
        tokens: {
          t1: { SF_RFID: 't1', SF_Group: 'Server Logs' },
          t2: { SF_RFID: 't2', SF_Group: 'Rogue Set' },
        },
      });
      expect(() => packService.activatePack())
        .toThrow(/CAPABILITY GATE.*'Rogue Set'.*not declared in game\.json groups/);
    });

    it('matches names VERBATIM (v2 cutover: a lingering "(xN)" suffix is a DIFFERENT name and is refused)', () => {
      // The v1-compat strip died with the suffix parsers (D3b) — a
      // suffixed SF_Group no longer resolves to its declared pure name.
      writePack(tmpDir, {
        groups: { 'Server Logs': { multiplier: 5 } },
        tokens: {
          t1: { SF_RFID: 't1', SF_Group: 'Server Logs (x5)' }, // v1 leftover
        },
      });
      expect(() => packService.activatePack())
        .toThrow(/CAPABILITY GATE.*'Server Logs \(x5\)'.*not declared/);
    });

    it('accepts full coverage — pure names resolve; ungrouped tokens gate nothing', () => {
      writePack(tmpDir, {
        groups: { 'Server Logs': { multiplier: 5 } },
        tokens: {
          t1: { SF_RFID: 't1', SF_Group: 'Server Logs' },
          t2: { SF_RFID: 't2', SF_Group: '' }, // ungrouped
        },
      });
      expect(() => packService.activatePack()).not.toThrow();
    });

    it('TYPE coverage (D2b): refuses a token whose memory type is not a typeMultipliers key, EXACT-CASE', () => {
      fs.writeFileSync(path.join(tmpDir, 'game.json'), JSON.stringify({
        kind: 'game', schemaVersion: 1, id: 'tc',
        scoring: { baseValues: { 1: 100 }, typeMultipliers: { Personal: 1, UNKNOWN: 0 } },
      }));
      fs.writeFileSync(path.join(tmpDir, 'tokens.json'), JSON.stringify({
        t1: { SF_RFID: 't1', SF_ValueRating: 1, SF_MemoryType: 'personal' }, // case mismatch
        t2: { SF_RFID: 't2', SF_ValueRating: 1, SF_MemoryType: 'Personal' },
        t3: { SF_RFID: 't3', SF_ValueRating: 1, SF_MemoryType: null },       // legal UNKNOWN bucket
      }));
      expect(() => packService.activatePack())
        .toThrow(/CAPABILITY GATE.*'personal'.*EXACT-CASE/);
    });

    it('TYPE coverage: full-coverage tokens (incl. null types) activate cleanly', () => {
      fs.writeFileSync(path.join(tmpDir, 'game.json'), JSON.stringify({
        kind: 'game', schemaVersion: 1, id: 'tc',
        scoring: { baseValues: { 1: 100 }, typeMultipliers: { Personal: 1, UNKNOWN: 0 } },
      }));
      fs.writeFileSync(path.join(tmpDir, 'tokens.json'), JSON.stringify({
        t1: { SF_RFID: 't1', SF_ValueRating: 1, SF_MemoryType: 'Personal' },
        t2: { SF_RFID: 't2', SF_ValueRating: 1, SF_MemoryType: null },
      }));
      expect(() => packService.activatePack()).not.toThrow();
    });

    it('a pack WITHOUT a groups block gates nothing (pre-groups packs stay legal until the v2 cutover)', () => {
      writePack(tmpDir, {
        groups: null,
        tokens: { t1: { SF_RFID: 't1', SF_Group: 'Anything (x9)' } },
      });
      expect(() => packService.activatePack()).not.toThrow();
    });
  });

  describe('activation-frozen rules memo + operator warns (review fixes)', () => {
    function writeGame(dir, game) {
      fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(game));
    }

    beforeEach(() => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
    });

    it('caches the LEGACY shim tables after activating a scoring-absent pack', () => {
      writeGame(tmpDir, { kind: 'game', schemaVersion: 1, id: 'memo' }); // absent scoring = legal
      packService.activatePack();
      const first = packService.getScoringRules();
      expect(first.baseValues[5]).toBe(150000); // baked ALN shim
      expect(packService.getScoringRules()).toBe(first); // memoized reference
    });

    it('caches the pack tables after activation (per-token loads reuse the snapshot)', () => {
      writeGame(tmpDir, {
        kind: 'game', schemaVersion: 1, id: 'memo',
        scoring: { baseValues: { 1: 5 }, typeMultipliers: { A: 2 } },
      });
      packService.activatePack();
      const first = packService.getScoringRules();
      expect(packService.getScoringRules()).toBe(first);
    });

    it('warns ONCE that SESSION_TIMEOUT is ignored when the pack clock differs (review finding)', () => {
      const logger = require('../../../src/utils/logger');
      writeGame(tmpDir, {
        kind: 'game', schemaVersion: 1, id: 'clock',
        gameClock: { duration: 3600, overtimeAt: 3300 },
      });
      logger.warn.mockClear();
      packService.getClockRules();
      packService.getClockRules();
      const warns = logger.warn.mock.calls.filter(c => /SESSION_TIMEOUT.*IGNORED/.test(c[0]));
      expect(warns).toHaveLength(1); // loud, once — config default 120min != 3600s
    });
  });

  describe('coherence check (A3 slice 1 — R9, two flavors per the 2026-07-18 ratification)', () => {
    function writeGame(dir, game) {
      fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(game));
    }
    const mode = (overrides = {}) => ({
      id: 'm1', label: 'M1', scoringPolicy: 'standard', entityRole: 'ledger',
      countsTowardGroups: true, displayBehavior: { surface: 'scoreboard-rankings' },
      ...overrides,
    });
    const gameWith = (...modes) => ({ kind: 'game', schemaVersion: 1, id: 'coh', modes });

    beforeEach(() => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
    });

    describe('flavor (i) — timeless self-contradictions', () => {
      it('refuses a DECLARED-but-unusable scoring block (empty tables must not ride the shim)', () => {
        // Review finding: pre-fix, scoring:{baseValues:{},...} activated
        // cleanly and silently ran the baked ALN economy behind one warn.
        writeGame(tmpDir, { kind: 'game', schemaVersion: 1, id: 'coh', scoring: { baseValues: {}, typeMultipliers: { A: 1 } } });
        expect(() => packService.activatePack())
          .toThrow(/self-contradictory.*scoring block is DECLARED.*missing\/empty/);
      });

      it('tolerates an ABSENT scoring block (packless checkouts ride the loud shim by design)', () => {
        writeGame(tmpDir, { kind: 'game', schemaVersion: 1, id: 'coh' });
        expect(() => packService.activatePack()).not.toThrow();
      });

      it('refuses a DECLARED-but-empty modes array', () => {
        writeGame(tmpDir, { kind: 'game', schemaVersion: 1, id: 'coh', modes: [] });
        expect(() => packService.activatePack())
          .toThrow(/COHERENCE CHECK.*self-contradictory.*EMPTY/);
      });

      it('tolerates an ABSENT modes block (nothing declared gates nothing — L6 shim covers it)', () => {
        writeGame(tmpDir, { kind: 'game', schemaVersion: 1, id: 'coh' });
        expect(() => packService.activatePack()).not.toThrow();
      });

      it('refuses duplicate mode ids', () => {
        writeGame(tmpDir, gameWith(mode({ id: 'dupe' }), mode({ id: 'dupe' })));
        expect(() => packService.activatePack())
          .toThrow(/self-contradictory.*duplicate mode id 'dupe'/);
      });

      it("refuses defaultEntity on an entityRole 'ledger' mode (cross-wired semantics)", () => {
        writeGame(tmpDir, gameWith(mode({ id: 'wallet', defaultEntity: 'The House' })));
        expect(() => packService.activatePack())
          .toThrow(/self-contradictory.*'wallet'.*defaultEntity.*ledger/);
      });
    });

    // The flavor-(ii) FOUNDING member (scoringPolicy 'none' ∧
    // countsTowardGroups) was RETIRED ON SCHEDULE in slice 2: scored-only
    // contribution semantics landed in gameRules/scoring (§2f — completion
    // counts any counting claim, the bonus base sums only scored
    // contributions), so unscored claims can no longer mint catalog-priced
    // bonuses and the combination is legal. Its legality is pinned below.

    describe('flavor (ii) — drivability limitations (named retirement, honest language)', () => {
      it("refuses non-consuming ∧ countsTowardGroups (D3s2 v1 constraint) with the limitation wording", () => {
        writeGame(tmpDir, gameWith(mode({
          id: 'sample', scoringPolicy: 'none', countsTowardGroups: true, claims: 'non-consuming',
        })));
        expect(() => packService.activatePack())
          .toThrow(/COHERENCE CHECK.*'sample'.*non-consuming.*not driveable by this engine yet.*contribution-semantics design/);
      });

      it('the limitation is NEVER called incoherent or self-contradictory (language rule pinned)', () => {
        writeGame(tmpDir, gameWith(mode({
          id: 'sample', scoringPolicy: 'none', countsTowardGroups: true, claims: 'non-consuming',
        })));
        let message = '';
        try { packService.activatePack(); } catch (err) { message = err.message; }
        expect(message).toMatch(/not driveable by this engine yet/);
        expect(message).not.toMatch(/incoherent/i);
        expect(message).not.toMatch(/self-contradictory/i);
      });
    });

    describe('deliberately LEGAL combinations (documented so nobody "fixes" them)', () => {
      it("accepts none ∧ countsTowardGroups — event-only groups (§2f semantics landed, flavor-ii retired)", () => {
        writeGame(tmpDir, gameWith(mode({
          id: 'ritual', scoringPolicy: 'none', entityRole: 'attribution',
          countsTowardGroups: true, displayBehavior: { surface: 'none' },
        })));
        expect(() => packService.activatePack()).not.toThrow();
      });

      it("accepts attribution ∧ standard (future scored-attributed modes)", () => {
        writeGame(tmpDir, gameWith(mode({ id: 'bounty', entityRole: 'attribution', defaultEntity: 'Nova' })));
        expect(() => packService.activatePack()).not.toThrow();
      });

      it("accepts surface 'none' with any scoringPolicy (silent modes are a design tool)", () => {
        writeGame(tmpDir, gameWith(mode({ id: 'silent', displayBehavior: { surface: 'none' } })));
        expect(() => packService.activatePack()).not.toThrow();
      });

      it("accepts none ∧ ledger — D2 consuming-appraise (claims FCFS for $0)", () => {
        writeGame(tmpDir, gameWith(mode({
          id: 'appraise', scoringPolicy: 'none', countsTowardGroups: false,
          displayBehavior: { surface: 'none' },
        })));
        expect(() => packService.activatePack()).not.toThrow();
      });

      it("accepts non-consuming with countsTowardGroups FALSE — the drivable half of D3s2", () => {
        writeGame(tmpDir, gameWith(mode({
          id: 'inspect', scoringPolicy: 'none', countsTowardGroups: false,
          claims: 'non-consuming', displayBehavior: { surface: 'none' },
        })));
        expect(() => packService.activatePack()).not.toThrow();
      });
    });

    it('a coherence refusal FAILS activation — nothing is snapshotted', () => {
      writeGame(tmpDir, gameWith(mode({ id: 'dupe' }), mode({ id: 'dupe' })));
      expect(() => packService.activatePack()).toThrow(/COHERENCE CHECK/);
      writeManifest(tmpDir, minimalManifest({ contentHash: HASH_B }));
      expect(packService.getManifest().contentHash).toBe(HASH_B);
    });

    it('BOTH real packs pass gate + coherence (ALN default dir and toy-heist)', () => {
      delete process.env.PACK_PATH; // ALN submodule
      expect(() => packService.activatePack()).not.toThrow();
      packService._resetForTesting();
      process.env.PACK_PATH = TOY_PACK;
      expect(() => packService.activatePack()).not.toThrow();
    });
  });

  describe('getScoringRules (A3 slice 2 — the rules read that retires ledger L1)', () => {
    function writeGame(dir, game) {
      fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(game));
    }

    it('serves the TOY pack tables normalized (numeric ratings, lowercase types, unknown present)', () => {
      process.env.PACK_PATH = TOY_PACK;
      const rules = packService.getScoringRules();
      expect(rules.baseValues[4]).toBe(1300);
      expect(rules.typeMultipliers.Personal).toBe(2);
      expect(rules.typeMultipliers.Technical).toBe(6);
      expect(rules.typeMultipliers.UNKNOWN).toBe(0);
    });

    it('serves the ALN pack tables from the default dir', () => {
      delete process.env.PACK_PATH;
      const rules = packService.getScoringRules();
      expect(rules.baseValues[5]).toBe(150000);
      expect(rules.typeMultipliers.Party).toBe(5);
    });

    it('carries allowNegative (D2s2): ALN true, toy false, shim mirrors ALN (true)', () => {
      delete process.env.PACK_PATH;
      expect(packService.getScoringRules().allowNegative).toBe(true);

      packService._resetForTesting();
      process.env.PACK_PATH = TOY_PACK;
      expect(packService.getScoringRules().allowNegative).toBe(false);

      packService._resetForTesting();
      process.env.PACK_PATH = tmpDir; // empty dir → baked legacy shim
      expect(packService.getScoringRules().allowNegative).toBe(true);
    });

    it('declared scoring WITHOUT a semantics block gets the conservative floor (allowNegative false)', () => {
      process.env.PACK_PATH = tmpDir;
      writeGame(tmpDir, {
        kind: 'game', schemaVersion: 1, id: 'nosem',
        scoring: { baseValues: { 1: 7 }, typeMultipliers: { Personal: 3 } },
      });
      expect(packService.getScoringRules().allowNegative).toBe(false);
    });

    it('snapshot semantics: activation freezes the tables; later disk edits are invisible', () => {
      process.env.PACK_PATH = tmpDir;
      writeManifest(tmpDir, minimalManifest());
      writeGame(tmpDir, {
        kind: 'game', schemaVersion: 1, id: 'rules',
        scoring: { baseValues: { 1: 7 }, typeMultipliers: { Personal: 3 } },
      });
      packService.activatePack();

      writeGame(tmpDir, {
        kind: 'game', schemaVersion: 1, id: 'rules',
        scoring: { baseValues: { 1: 999 }, typeMultipliers: { Personal: 999 } },
      });

      expect(packService.getScoringRules().baseValues[1]).toBe(7);
    });

    it('a pack with NO usable scoring block rides the baked legacy shim with a LOUD warn (once)', () => {
      process.env.PACK_PATH = tmpDir; // empty dir: no game.json at all
      const rules = packService.getScoringRules();
      packService.getScoringRules();

      expect(rules.baseValues[5]).toBe(150000);
      expect(rules.typeMultipliers.Mention).toBe(3);
      const shimWarns = logger.warn.mock.calls.filter(([m]) =>
        m.includes('LEGACY SCORING TABLES ACTIVE')
      );
      expect(shimWarns).toHaveLength(1);
    });

    it('EMPTY-but-present tables ride the shim too (an empty table must never silently zero every token)', () => {
      process.env.PACK_PATH = tmpDir;
      writeGame(tmpDir, {
        kind: 'game', schemaVersion: 1, id: 'empty',
        scoring: { baseValues: {}, typeMultipliers: { Personal: 1 } },
      });
      const rules = packService.getScoringRules();
      expect(rules.baseValues[1]).toBe(10000); // legacy, not undefined
      expect(logger.warn.mock.calls.some(([m]) => m.includes('LEGACY SCORING TABLES ACTIVE'))).toBe(true);
    });

    it('getClockRules serves the pack clock in seconds (toy: 3600 duration, 3300 overtime)', () => {
      process.env.PACK_PATH = TOY_PACK;
      expect(packService.getClockRules()).toEqual({ durationSeconds: 3600, overtimeAtSeconds: 3300 });
    });

    it('getClockRules: ALN declares overtime == duration (7200/7200)', () => {
      delete process.env.PACK_PATH;
      expect(packService.getClockRules()).toEqual({ durationSeconds: 7200, overtimeAtSeconds: 7200 });
    });

    it('getClockRules: absent overtimeAt defaults to the declared duration', () => {
      process.env.PACK_PATH = tmpDir;
      writeGame(tmpDir, { kind: 'game', schemaVersion: 1, id: 'clk', gameClock: { duration: 500 } });
      expect(packService.getClockRules()).toEqual({ durationSeconds: 500, overtimeAtSeconds: 500 });
    });

    it('getClockRules: a PACKLESS checkout falls back to SESSION_TIMEOUT with a LOUD warn (once)', () => {
      process.env.PACK_PATH = tmpDir; // empty dir
      const rules = packService.getClockRules();
      packService.getClockRules();
      const config = require('../../../src/config');
      expect(rules.durationSeconds).toBe(config.session.sessionTimeout * 60);
      expect(rules.overtimeAtSeconds).toBe(rules.durationSeconds);
      const warns = logger.warn.mock.calls.filter(([m]) => m.includes('LEGACY CLOCK CONFIG ACTIVE'));
      expect(warns).toHaveLength(1);
    });

    it('DRIFT TRIPWIRE: the baked legacy tables mirror the real ALN game.json scoring block', () => {
      const gamePath = path.resolve(__dirname, '../../../../ALN-TokenData/game.json');
      const real = JSON.parse(fs.readFileSync(gamePath, 'utf8')).scoring;
      expect(JSON.parse(JSON.stringify(packService.LEGACY_ALN_SCORING.baseValues)))
        .toEqual(Object.fromEntries(Object.entries(real.baseValues).map(([k, v]) => [k, v])));
      expect(JSON.parse(JSON.stringify(packService.LEGACY_ALN_SCORING.typeMultipliers)))
        .toEqual(real.typeMultipliers);
      expect(JSON.parse(JSON.stringify(packService.LEGACY_ALN_SCORING.semantics)))
        .toEqual(real.semantics);
    });
  });
});
