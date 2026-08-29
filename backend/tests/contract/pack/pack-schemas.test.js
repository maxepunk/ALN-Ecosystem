/**
 * Game Pack Schema Contract (Phase 3, Track A slice 1)
 *
 * Enforces the A1 pack schemas against BOTH packs in the repo — ALN
 * (ALN-TokenData, the production pack) and the toy second game
 * (tests/e2e/fixtures/packs/toy-heist), per the Phase 3 methodology rule:
 * every pack artifact must be exercised by a second consumer from day one.
 *
 * Design docs: docs/plans/2026-06-13-phase3-1-pack-schemas.md (ratified
 * 2026-07-09), docs/plans/2026-07-09-phase3-1-standalone-pack-loading.md.
 *
 * Monorepo-relative paths (same pattern as tokens-schema.test.js).
 */

const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { buildFiles, contentHash } = require('../../../scripts/build-pack-manifest');

const TOKEN_DATA_DIR = path.resolve(__dirname, '../../../../ALN-TokenData');
const TOY_PACK_DIR = path.resolve(__dirname, '../../e2e/fixtures/packs/toy-heist');

const PACKS = [
  { name: 'about-last-night (production)', dir: TOKEN_DATA_DIR },
  { name: 'midnight-heist (toy)', dir: TOY_PACK_DIR },
];

const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));

describe('game pack schema contract (A1)', () => {
  let ajv;
  let validateGame;
  let validateManifest;
  let validateTokens;

  beforeAll(() => {
    ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    validateGame = ajv.compile(readJson(TOKEN_DATA_DIR, 'game.schema.json'));
    validateManifest = ajv.compile(readJson(TOKEN_DATA_DIR, 'pack-manifest.schema.json'));
    validateTokens = ajv.compile(readJson(TOKEN_DATA_DIR, 'tokens.schema.json'));
  });

  const explain = (validate) => validate.errors
    .map(e => `${e.instancePath || '(root)'}: ${e.message}`)
    .join('\n  ');

  describe.each(PACKS)('$name', ({ dir }) => {
    it('game.json validates against game.schema.json', () => {
      const game = readJson(dir, 'game.json');
      if (!validateGame(game)) throw new Error(`game.json violations:\n  ${explain(validateGame)}`);
    });

    it('tokens.json validates against tokens.schema.json', () => {
      const tokens = readJson(dir, 'tokens.json');
      if (!validateTokens(tokens)) throw new Error(`tokens.json violations:\n  ${explain(validateTokens)}`);
    });

    it('pack-manifest.json validates against pack-manifest.schema.json', () => {
      const manifest = readJson(dir, 'pack-manifest.json');
      if (!validateManifest(manifest)) throw new Error(`manifest violations:\n  ${explain(validateManifest)}`);
    });

    it('manifest inventory is FRESH (sha1s/contentHash match the actual tree)', () => {
      // The generator is deterministic; a drifted pack file without a
      // regenerated manifest fails here. Regenerate with:
      //   node scripts/build-pack-manifest.js <packDir>
      const manifest = readJson(dir, 'pack-manifest.json');
      const files = buildFiles(dir);
      expect(manifest.files).toEqual(files);
      expect(manifest.contentHash).toBe(contentHash(files));
    });

    it('mode ids are unique and game id matches manifest packId', () => {
      const game = readJson(dir, 'game.json');
      const manifest = readJson(dir, 'pack-manifest.json');
      const ids = game.modes.map(m => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(manifest.packId).toBe(game.id);
    });

    it('typeMultipliers cover every SF_MemoryType used by the token database', () => {
      const game = readJson(dir, 'game.json');
      const tokens = readJson(dir, 'tokens.json');
      const known = new Set(Object.keys(game.scoring.typeMultipliers));
      const uncovered = Object.entries(tokens)
        .filter(([, t]) => t.SF_MemoryType !== null && !known.has(t.SF_MemoryType))
        .map(([k, t]) => `${k}: '${t.SF_MemoryType}'`);
      expect(uncovered).toEqual([]);
    });

    it('transact.modes reference declared mode ids only', () => {
      const game = readJson(dir, 'game.json');
      const declared = new Set(game.modes.map(m => m.id));
      for (const m of game.functions.transact.modes || []) {
        expect(declared).toContain(m);
      }
    });

    it('defaultEntity appears only on attribution-role modes', () => {
      const game = readJson(dir, 'game.json');
      for (const mode of game.modes) {
        if (mode.defaultEntity !== undefined) {
          expect(mode.entityRole).toBe('attribution');
        }
      }
    });
  });

  describe('auth floor is structurally enforced (owner decision 2026-07-09)', () => {
    it.each(['session-lifecycle', 'show-control', 'score-intervention'])(
      'a pack assigning %s below staffed is REJECTED by the schema',
      (fn) => {
        const game = readJson(TOKEN_DATA_DIR, 'game.json');
        const mutated = JSON.parse(JSON.stringify(game));
        mutated.functions[fn].classes = ['personal'];
        expect(validateGame(mutated)).toBe(false);

        mutated.functions[fn].classes = ['staffed', 'station'];
        expect(validateGame(mutated)).toBe(false);
      }
    );

    it('floor functions accept exactly ["staffed"]', () => {
      const game = readJson(TOKEN_DATA_DIR, 'game.json');
      expect(validateGame(game)).toBe(true);
    });
  });

  describe('ALN pack ↔ legacy config parity (migration guard)', () => {
    // The game.json scoring == scoring-config.json parity pin was DELETED
    // here by design (A3 slice 2, ledger L1 retirement): scoring-config.json
    // no longer exists — the backend reads scoring from the active pack's
    // game.json via packService.getScoringRules(), and the GM Scanner
    // vendored its baked L2 shim. game.json's scoring block is now the
    // sole shared source, guarded by the packService ALN drift tripwire.

    // The gameClock.duration == SESSION_TIMEOUT masking pin was DELETED
    // here by design (A3 slice 2): the engine now CONSUMES the pack's
    // gameClock.duration/overtimeAt via packService.getClockRules(), so
    // the pack may legitimately diverge from the env default (the toy
    // pack always did — 3600/3300 — and the dual-pack gate now exercises
    // that divergence for real).
  });

  describe('scoring.display.format grammar (A3 slice 3b, R-3b-1)', () => {
    // Exactly one '#,###' number token wrapped by literal affixes — the
    // schema pattern is the authoring-time twin of the activation gate's
    // drivability check (schema-open elsewhere, gate-enforced).
    it.each([
      ['$#,###', true],       // ALN
      ['#,### cr', true],     // toy-heist (suffix unit)
      ['€ #,###', true],
      ['#,###', true],        // bare token
      ['dollars', false],     // no token
      ['$#,###-#,###', false], // two tokens
      ['##,###', false],      // malformed token
      ['$#,##', false],
      ['', false],
    ])('format %j is %s under the schema pattern', (format, valid) => {
      const game = readJson(TOKEN_DATA_DIR, 'game.json');
      const mutated = JSON.parse(JSON.stringify(game));
      mutated.scoring.display = { unit: 'x', format };
      expect(validateGame(mutated)).toBe(valid);
    });

    it('both real packs declare a drivable format (the grammar has two live consumers)', () => {
      for (const { dir } of PACKS) {
        const game = readJson(dir, 'game.json');
        expect(game.scoring.display.format).toMatch(/^[^#]*#,###[^#]*$/);
      }
    });
  });

  describe('declared strings sidecars validate against strings.schema.json (A3 slice 3a)', () => {
    // Every pack whose game.json declares `strings` must ship a sidecar
    // that satisfies the schema — the engine gate walks leaves at
    // activation; this is the authoring-time contract twin.
    const stringsSchema = readJson(TOKEN_DATA_DIR, 'strings.schema.json');
    const packsDir = path.resolve(__dirname, '../../e2e/fixtures/packs');
    const declaring = [
      { name: 'about-last-night', dir: TOKEN_DATA_DIR },
      ...fs.readdirSync(packsDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => ({ name: e.name, dir: path.join(packsDir, e.name) })),
    ].filter(({ dir }) => {
      try { return !!readJson(dir, 'game.json').strings; } catch { return false; }
    });

    it('at least one pack declares a strings sidecar (the contract has a consumer)', () => {
      expect(declaring.length).toBeGreaterThan(0);
    });

    it('a NON-CANONICAL sidecar filename is schema-ILLEGAL (review D — filename contract)', () => {
      // Manifest role assignment + the scanner's staged-refresh rules
      // set are keyed to the literal 'strings.json'; a divergent pointer
      // rebranded the backend while the scanner silently stayed baked.
      const game = readJson(TOKEN_DATA_DIR, 'game.json');
      const mutated = JSON.parse(JSON.stringify(game));
      mutated.strings = 'wording.json';
      expect(validateGame(mutated)).toBe(false);
    });

    it.each(declaring.map(d => [d.name, d.dir]))('%s strings.json validates', (name, dir) => {
      const validate = ajv.compile(stringsSchema);
      const strings = readJson(dir, readJson(dir, 'game.json').strings);
      if (!validate(strings)) {
        throw new Error(`${name} strings violations:\n  ${explain(validate)}`);
      }
    });
  });

  describe('EVERY bootable fixture pack has a FRESH manifest (round-2 review C6)', () => {
    // The full-schema contract runs on the two real packs above; fixture
    // packs may carry PARTIAL game.json overlays (parity-pack does), but
    // any pack the PACK_PATH seam can boot still needs a fresh manifest —
    // slice 2b edited parity-pack twice relying on manual regen alone.
    const packsDir = path.resolve(__dirname, '../../e2e/fixtures/packs');
    const fixturePacks = fs.readdirSync(packsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);

    it.each(fixturePacks)('%s manifest sha1s/contentHash match the tree', (pack) => {
      const dir = path.join(packsDir, pack);
      const manifest = readJson(dir, 'pack-manifest.json');
      const files = buildFiles(dir);
      expect(manifest.files).toEqual(files);
      expect(manifest.contentHash).toBe(contentHash(files));
    });
  });

  describe('cues pointer + lightingRoleFallbacks (slice 4 S1, D-4.2/D-4.5)', () => {
    const mutated = (fn) => {
      const game = readJson(TOKEN_DATA_DIR, 'game.json');
      const copy = JSON.parse(JSON.stringify(game));
      fn(copy);
      return validateGame(copy);
    };

    it('the cues pointer is const-pinned to the canonical filename (3a strings precedent)', () => {
      // Both manifest builders and the loader key on the literal
      // 'cues.json'; a free-form pointer rebrands one consumer while the
      // others stay keyed to the canonical name.
      expect(mutated(g => { g.cues = 'cues.json'; })).toBe(true);
      expect(mutated(g => { g.cues = 'show.json'; })).toBe(false);
    });

    it('lightingRoleFallbacks maps role names to concrete scene ids (ledger L7 — temporary)', () => {
      expect(mutated(g => {
        g.lightingRoles = ['gameplay', 'blackout'];
        g.lightingRoleFallbacks = { gameplay: 'scene.game', blackout: 'scene.off' };
      })).toBe(true);
      // non-string scene id refused
      expect(mutated(g => {
        g.lightingRoleFallbacks = { gameplay: 7 };
      })).toBe(false);
      // a key outside the role-name convention refused
      expect(mutated(g => {
        g.lightingRoleFallbacks = { 'Scene.Game': 'scene.game' };
      })).toBe(false);
    });
  });

  describe('declared cues sidecars validate against cues.schema.json (slice 4 S1)', () => {
    // Authoring-time twin of the S2 activation gate. No pack declares
    // cues until the S4 cutover — the walk is forward-wired now; S4 adds
    // the at-least-one-declarer assertion (strings-block precedent).
    const cuesSchema = readJson(TOKEN_DATA_DIR, 'cues.schema.json');
    const packsDir = path.resolve(__dirname, '../../e2e/fixtures/packs');
    const declaring = [
      { name: 'about-last-night', dir: TOKEN_DATA_DIR },
      ...fs.readdirSync(packsDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => ({ name: e.name, dir: path.join(packsDir, e.name) })),
    ].filter(({ dir }) => {
      try { return !!readJson(dir, 'game.json').cues; } catch { return false; }
    });

    it('every pack declaring a cues pointer ships a schema-valid sidecar', () => {
      const validate = ajv.compile(cuesSchema);
      for (const { name, dir } of declaring) {
        const cues = readJson(dir, readJson(dir, 'game.json').cues);
        if (!validate(cues)) {
          throw new Error(`${name} cues violations:\n  ${explain(validate)}`);
        }
      }
    });
  });

  describe('schema files never enter pack inventory (slice 4 S1, red-team Gm1)', () => {
    // The EXCLUDE sets used to enumerate schema filenames literally, so
    // every NEW schema (cues.schema.json here; slice 6/7 schemas next)
    // silently entered inventory, got served, and moved contentHash —
    // strings.schema.json had already slipped through when this landed.
    // Both builders now exclude by the `.schema.json` suffix.
    const packsDir = path.resolve(__dirname, '../../e2e/fixtures/packs');
    const allPacks = [
      ...PACKS,
      ...fs.readdirSync(packsDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => ({ name: `${e.name} (fixture)`, dir: path.join(packsDir, e.name) })),
    ];

    it.each(allPacks.map(p => [p.name, p.dir]))(
      '%s: no committed or rebuilt inventory path ends .schema.json',
      (name, dir) => {
        const manifest = readJson(dir, 'pack-manifest.json');
        const offenders = manifest.files
          .map(f => f.path)
          .filter(p => p.endsWith('.schema.json'));
        expect(offenders).toEqual([]);
        const rebuilt = buildFiles(dir)
          .map(f => f.path)
          .filter(p => p.endsWith('.schema.json'));
        expect(rebuilt).toEqual([]);
      }
    );

    it('the suffix rule covers schemas the literal EXCLUDE set never named', () => {
      const os = require('os');
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-suffix-'));
      try {
        fs.writeFileSync(path.join(tmp, 'tokens.json'), '{}');
        fs.writeFileSync(path.join(tmp, 'cues.schema.json'), '{}');
        fs.writeFileSync(path.join(tmp, 'theme.schema.json'), '{}');
        expect(buildFiles(tmp).map(f => f.path)).toEqual(['tokens.json']);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  describe('toy pack is genuinely a SECOND game (methodology guard)', () => {
    it('differs from ALN in id, modes, scoring values, and entity labels', () => {
      const aln = readJson(TOKEN_DATA_DIR, 'game.json');
      const toy = readJson(TOY_PACK_DIR, 'game.json');
      expect(toy.id).not.toBe(aln.id);
      expect(toy.modes.length).not.toBe(aln.modes.length);
      expect(toy.scoring.baseValues).not.toEqual(aln.scoring.baseValues);
      expect(toy.entities.label.singular).not.toBe(aln.entities.label.singular);
    });

    it('toy tokens include a completable group (>= minSize members, declared multiplier > 1)', () => {
      // v2 (D1b): SF_Group is the pure name; the multiplier is DECLARED
      // in game.json `groups` — the "(xN)" suffix is schema-illegal now.
      const toy = readJson(TOY_PACK_DIR, 'game.json');
      const tokens = readJson(TOY_PACK_DIR, 'tokens.json');
      const groups = {};
      for (const t of Object.values(tokens)) {
        if (t.SF_Group) (groups[t.SF_Group] = groups[t.SF_Group] || []).push(t);
      }
      const completable = Object.entries(groups).filter(([name, members]) =>
        members.length >= toy.groupRules.minSize
        && (toy.groups?.[name]?.multiplier ?? 1) > 1);
      expect(completable.length).toBeGreaterThan(0);
    });
  });
});
