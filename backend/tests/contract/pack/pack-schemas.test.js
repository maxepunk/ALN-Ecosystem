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
    it('game.json scoring equals scoring-config.json (until the legacy file retires)', () => {
      // Both files exist during the migration window; they MUST agree or
      // networked (reads legacy at boot today) and future pack consumers
      // would score differently. Retire scoring-config.json -> delete this.
      const game = readJson(TOKEN_DATA_DIR, 'game.json');
      const legacy = readJson(TOKEN_DATA_DIR, 'scoring-config.json');
      // legacy keys are strings already; compare as plain objects
      expect(game.scoring.baseValues).toEqual(legacy.baseValues);
      expect(game.scoring.typeMultipliers).toEqual(legacy.typeMultipliers);
    });

    it('game.json gameClock.duration equals the backend default SESSION_TIMEOUT', () => {
      // config/index.js: sessionTimeout default 120 minutes. When B11
      // extraction lands, the env default retires and this pin moves with it.
      expect(readJson(TOKEN_DATA_DIR, 'game.json').gameClock.duration).toBe(120 * 60);
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

    it('toy tokens include a completable group (>= minSize members, multiplier > 1)', () => {
      const toy = readJson(TOY_PACK_DIR, 'game.json');
      const tokens = readJson(TOY_PACK_DIR, 'tokens.json');
      const groups = {};
      for (const t of Object.values(tokens)) {
        if (t.SF_Group) (groups[t.SF_Group] = groups[t.SF_Group] || []).push(t);
      }
      const completable = Object.entries(groups).filter(([name, members]) =>
        members.length >= toy.groupRules.minSize && /\(x([2-9]|[1-9][0-9]+)\)$/.test(name));
      expect(completable.length).toBeGreaterThan(0);
    });
  });
});
