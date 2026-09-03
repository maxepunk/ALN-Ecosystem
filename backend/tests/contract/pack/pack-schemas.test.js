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
const os = require('os');
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

const FIXTURE_PACKS_DIR = path.resolve(__dirname, '../../e2e/fixtures/packs');

// Every fixture pack directory as {name, dir}.
const fixturePacks = () => fs.readdirSync(FIXTURE_PACKS_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => ({ name: e.name, dir: path.join(FIXTURE_PACKS_DIR, e.name) }));

// All packs (production + fixtures) whose game.json declares the given
// sidecar pointer (e.g. 'strings', 'cues').
const declaringPacks = (pointerKey) => [
  { name: 'about-last-night', dir: TOKEN_DATA_DIR },
  ...fixturePacks(),
].filter(({ dir }) => {
  try { return !!readJson(dir, 'game.json')[pointerKey]; } catch { return false; }
});

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
    const declaring = declaringPacks('strings');

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
    it.each(fixturePacks().map(p => [p.name, p.dir]))('%s manifest sha1s/contentHash match the tree', (name, dir) => {
      const manifest = readJson(dir, 'pack-manifest.json');
      const files = buildFiles(dir);
      expect(manifest.files).toEqual(files);
      expect(manifest.contentHash).toBe(contentHash(files));
    });
  });

  describe('cues pointer + lightingRoleFallbacks (slice 4 S1, D-4.2/D-4.5)', () => {
    // Apply one mutation to the committed ALN game.json and return validity.
    const validateMutated = (fn) => {
      const game = readJson(TOKEN_DATA_DIR, 'game.json');
      const copy = JSON.parse(JSON.stringify(game));
      fn(copy);
      return validateGame(copy);
    };

    it('the cues pointer is const-pinned to the canonical filename (3a strings precedent)', () => {
      // Both manifest builders and the loader key on the literal
      // 'cues.json'; a free-form pointer rebrands one consumer while the
      // others stay keyed to the canonical name.
      expect(validateMutated(g => { g.cues = 'cues.json'; })).toBe(true);
      expect(validateMutated(g => { g.cues = 'show.json'; })).toBe(false);
    });

    it('lightingRoleFallbacks maps role names to concrete scene ids (ledger L7 — temporary)', () => {
      expect(validateMutated(g => {
        g.lightingRoles = ['gameplay', 'blackout'];
        g.lightingRoleFallbacks = { gameplay: 'scene.game', blackout: 'scene.off' };
      })).toBe(true);
      // non-string scene id refused
      expect(validateMutated(g => {
        g.lightingRoleFallbacks = { gameplay: 7 };
      })).toBe(false);
      // a key outside the role-name convention refused
      expect(validateMutated(g => {
        g.lightingRoleFallbacks = { 'Scene.Game': 'scene.game' };
      })).toBe(false);
    });
  });

  describe('declared cues sidecars validate against cues.schema.json (slice 4 S1)', () => {
    // Authoring-time twin of the S2 activation gate.
    const cuesSchema = readJson(TOKEN_DATA_DIR, 'cues.schema.json');
    const declaring = declaringPacks('cues');

    it('at least one pack declares a cues sidecar (the contract has a consumer — S4 cutover)', () => {
      expect(declaring.length).toBeGreaterThan(0);
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

  describe('surfaces block schema (A3 slice 6 — authoring twin of the activation gate)', () => {
    let validateSurfaces;
    beforeAll(() => {
      const gameSchema = readJson(TOKEN_DATA_DIR, 'game.schema.json');
      validateSurfaces = new Ajv2020({ allErrors: true, strict: true }).compile({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        ...gameSchema.properties.surfaces,
      });
    });

    it('accepts a channel-name idleLoop plus scoreboard params', () => {
      expect(validateSurfaces({ idleLoop: 'house-idle', scoreboard: { enabled: true, evidenceCycleMs: 18000 } })).toBe(true);
    });

    it('accepts the opt-out shapes (null idleLoop, enabled:false)', () => {
      expect(validateSurfaces({ idleLoop: null, scoreboard: { enabled: false } })).toBe(true);
    });

    it('accepts an empty surfaces object', () => {
      expect(validateSurfaces({})).toBe(true);
    });

    it('rejects a path/filename-shaped idleLoop (channel NAME only)', () => {
      expect(validateSurfaces({ idleLoop: 'idle-loop.mp4' })).toBe(false);
      expect(validateSurfaces({ idleLoop: 'videos/house.mp4' })).toBe(false);
    });

    it('rejects an unknown surfaces key and an unknown scoreboard key (additionalProperties false)', () => {
      expect(validateSurfaces({ nope: 1 })).toBe(false);
      expect(validateSurfaces({ scoreboard: { bogus: true } })).toBe(false);
    });

    it('rejects a sub-1000 or non-integer evidenceCycleMs', () => {
      expect(validateSurfaces({ scoreboard: { evidenceCycleMs: 500 } })).toBe(false);
      expect(validateSurfaces({ scoreboard: { evidenceCycleMs: 12.5 } })).toBe(false);
    });
  });

  describe('schema files never enter pack inventory (slice 4 S1, red-team Gm1)', () => {
    // The EXCLUDE sets used to enumerate schema filenames literally, so
    // every NEW schema (cues.schema.json here; slice 6/7 schemas next)
    // silently entered inventory, got served, and moved contentHash —
    // strings.schema.json had already slipped through when this landed.
    // Both builders now exclude by the `.schema.json` suffix.
    const allPacks = [
      ...PACKS,
      ...fixturePacks().map(p => ({ name: `${p.name} (fixture)`, dir: p.dir })),
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
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-suffix-'));
      try {
        fs.writeFileSync(path.join(tmp, 'tokens.json'), '{}');
        fs.writeFileSync(path.join(tmp, 'cues.schema.json'), '{}');
        fs.writeFileSync(path.join(tmp, 'theme.schema.json'), '{}');
        // S5: a stray runtime logs/ dir (winston mkdirs relative to cwd)
        // must never enter served inventory either
        fs.mkdirSync(path.join(tmp, 'logs'));
        fs.writeFileSync(path.join(tmp, 'logs', 'combined.log'), '');
        expect(buildFiles(tmp).map(f => f.path)).toEqual(['tokens.json']);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it('the scoring-config.json tombstone stays excluded (S6 review — Node-side twin of the Python test)', () => {
      // The Python builder pins this directly (test_excludes_schemas_
      // legacy_and_tooling); the Node side asserted the exclusion only
      // via the "byte-parity-pinned" comment, which binds only if a real
      // pack still carries the retired file — none does. Plant it here so
      // deleting the tombstone from the Node EXCLUDE fails a Node test.
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-tombstone-'));
      try {
        fs.writeFileSync(path.join(tmp, 'tokens.json'), '{}');
        fs.writeFileSync(path.join(tmp, 'game.json'), '{}');
        fs.writeFileSync(path.join(tmp, 'scoring-config.json'), '{}');
        expect(buildFiles(tmp).map(f => f.path)).toEqual(['game.json', 'tokens.json']);
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

describe('slice-7 S7.2: modes verbNoun + the report-template tombstone', () => {
  const cloneJson = (o) => JSON.parse(JSON.stringify(o));
  let validateGame7;
  let gameSchema7;
  let alnGame7;

  beforeAll(() => {
    const ajv7 = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv7);
    gameSchema7 = readJson(TOKEN_DATA_DIR, 'game.schema.json');
    validateGame7 = ajv7.compile(gameSchema7);
    alnGame7 = readJson(TOKEN_DATA_DIR, 'game.json');
  });

  it('a mode may declare verbNoun — the report Type-cell noun (program §13.4)', () => {
    const game = cloneJson(alnGame7);
    game.modes[0].verbNoun = 'Sale';
    const ok = validateGame7(game);
    expect(validateGame7.errors).toBeNull();
    expect(ok).toBe(true);
  });

  it.each([
    ['a table-breaking pipe', 'Sa|le'],
    ['a newline', 'Sa\nle'],
    ['an empty string', ''],
  ])('refuses a verbNoun carrying %s', (_label, bad) => {
    const game = cloneJson(alnGame7);
    game.modes[0].verbNoun = bad;
    expect(validateGame7(game)).toBe(false);
  });

  it('TOMBSTONE: the report.template mechanism is gone from the schema (no template language, §13.4)', () => {
    expect(gameSchema7.properties).not.toHaveProperty('report');
  });
});

describe('slice-7 S7.2: the template role is retired (no template language, §13.4)', () => {
  it("a templates/ path is inventoried as plain 'other' — the engine has no template mechanism", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-tmpl-'));
    fs.mkdirSync(path.join(tmp, 'templates'));
    fs.writeFileSync(path.join(tmp, 'templates', 'session-report.md.hbs'), 'dead mechanism');
    fs.writeFileSync(path.join(tmp, 'tokens.json'), '{}');
    const entry = buildFiles(tmp).find((f) => f.path === 'templates/session-report.md.hbs');
    expect(entry.role).toBe('other');
  });
});
