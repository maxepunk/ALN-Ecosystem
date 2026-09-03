/**
 * B9 session-bundle schema contract (Phase 3, A3 slice 7 — S7.1).
 *
 * The bundle is an ENGINE contract artifact (engine-versioned, never pack
 * data): the canonical structured record of one game session, of which the
 * markdown report is a themed rendering. No Phase-3 emitter exists by
 * design ("no Phase-3 consumer" — program §13.4 amendment 4a); these
 * contract tests are the sole enforcement until Phase-4 D intake writes
 * bundles.
 *
 * What is pinned here, per design r2 (docs/plans/
 * 2026-09-03-phase3-a3-slice7-report-wording.md D-7.1 + §4a):
 * - the schema compiles under the house Ajv2020 strict profile;
 * - integer schemaVersion const (house convention, not semver);
 * - only kind + schemaVersion + engine are required — the ALN-shaped data
 *   sections are optional so a non-ALN game (BILL: graph + epidemic
 *   state) emits engine + gameState without fabricating empty
 *   transaction lists (BILL scoping :71-73);
 * - gameState is GENUINELY reserved: pack-id-patterned keys only;
 * - intake reserves NAMES only (schema `true` members — Phase-4 D
 *   designs the shapes);
 * - input coverage: the bundle names all FOUR census input classes the
 *   report render depends on (generate() payload, tokenDatabase
 *   projection, scoring rules, mode records) — §4a lens-1 OBJ-3.
 */

const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const SCHEMA_PATH = path.resolve(__dirname, '../../contracts/session-bundle.schema.json');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/**
 * A full ALN-shaped bundle: every optional data section populated, SHAPED
 * like the golden-master fixtures (one scoring-mode claim, one
 * evidence-mode claim, an adjustment with reason + station, player scans,
 * the owner projection, and the resolved rules snapshots). The values are
 * invented but internally consistent: jaw001's points equal the
 * star-cell-derivable baseValues[5] x Technical multiplier.
 */
const FULL_BUNDLE = {
  kind: 'session-bundle',
  schemaVersion: 1,
  engine: {
    engineVersion: '3.0.0',
    packId: 'about-last-night',
    packVersion: '1.0.0',
    contentHash: 'sha256:' + 'a'.repeat(64),
  },
  session: {
    name: 'Contract Fixture Night',
    startTime: '2026-09-03T01:00:00.000Z',
    endTime: '2026-09-03T03:05:00.000Z',
    teams: ['001', '002'],
  },
  scores: [
    {
      teamId: '001',
      score: 135000,
      adminAdjustments: [
        { delta: -15000, timestamp: '2026-09-03T02:10:00.000Z', reason: 'penalty', gmStation: 'GM_STATION_1' },
      ],
    },
    { teamId: '002', score: 0, adminAdjustments: [] },
  ],
  transactions: [
    {
      status: 'accepted', mode: 'blackmarket', tokenId: 'jaw001', teamId: '001',
      timestamp: '2026-09-03T01:20:00.000Z', points: 750000, summary: null,
      valueRating: 5, memoryType: 'Technical',
    },
    {
      status: 'accepted', mode: 'detective', tokenId: 'asm001', teamId: '002',
      timestamp: '2026-09-03T01:25:00.000Z', points: 0,
      summary: 'A ledger page naming the buyer.', valueRating: 3, memoryType: 'Business',
    },
  ],
  playerScans: [
    { tokenId: 'jaw001', deviceId: 'PLAYER_SCANNER_01', timestamp: '2026-09-03T01:05:00.000Z' },
  ],
  tokens: {
    jaw001: { owner: 'James Whitman' },
    asm001: { owner: null },
  },
  rules: {
    scoring: {
      baseValues: { 1: 10000, 2: 25000, 3: 50000, 4: 75000, 5: 150000 },
      typeMultipliers: { Personal: 1, Business: 3, Technical: 5, UNKNOWN: 0 },
      display: { format: '$#,###' },
    },
    modes: [
      {
        id: 'blackmarket', label: 'Black Market', verbNoun: 'Sale',
        scoringPolicy: 'standard', displayBehavior: { surface: 'scoreboard-rankings' },
      },
      {
        id: 'detective', label: 'Detective',
        scoringPolicy: 'none', displayBehavior: { surface: 'scoreboard-evidence' },
      },
    ],
  },
  intake: {},
  gameState: {},
};

/**
 * The minimal non-ALN bundle: identity + per-game state ONLY. This
 * validating green is the proof that the schema does not assume ALN's
 * shapes (BILL scoping :72 — "a graph + epidemic state, not a
 * transaction list").
 */
const MINIMAL_NON_ALN_BUNDLE = {
  kind: 'session-bundle',
  schemaVersion: 1,
  engine: {
    engineVersion: '3.0.0',
    packId: 'bills-in-the-walls',
    packVersion: '0.1.0',
    contentHash: 'sha256:' + 'b'.repeat(64),
  },
  gameState: {
    'bills-in-the-walls': {
      graph: { nodes: 12, edges: [[1, 2], [2, 3]] },
      epidemic: { r0: 2.4, infected: ['n4', 'n9'] },
    },
  },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

describe('B9 session-bundle schema contract (slice 7 S7.1)', () => {
  let schema;
  let validate;

  beforeAll(() => {
    schema = readJson(SCHEMA_PATH);
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    validate = ajv.compile(schema);
  });

  describe('versioning and required set', () => {
    it('pins the house version + kind convention: bare consts, like every sibling schema', () => {
      expect(schema.properties.schemaVersion).toEqual({ const: 1 });
      expect(schema.properties.kind).toEqual({ const: 'session-bundle' });
    });

    it('requires only the identity trio (kind/schemaVersion/engine) — every data section is optional', () => {
      expect([...schema.required].sort()).toEqual(['engine', 'kind', 'schemaVersion']);
    });

    it('refuses a future schemaVersion (exact-match, both directions)', () => {
      const bundle = clone(MINIMAL_NON_ALN_BUNDLE);
      bundle.schemaVersion = 2;
      expect(validate(bundle)).toBe(false);
    });

    it('refuses an unknown top-level key (strict contract surface)', () => {
      const bundle = clone(MINIMAL_NON_ALN_BUNDLE);
      bundle.surprise = true;
      expect(validate(bundle)).toBe(false);
    });
  });

  describe('the engine provenance stamp', () => {
    it.each(['engineVersion', 'packId', 'packVersion', 'contentHash'])(
      'refuses an engine block missing %s',
      (field) => {
        const bundle = clone(MINIMAL_NON_ALN_BUNDLE);
        delete bundle.engine[field];
        expect(validate(bundle)).toBe(false);
      },
    );
  });

  describe('fixtures', () => {
    it('validates the full ALN-shaped bundle', () => {
      const ok = validate(clone(FULL_BUNDLE));
      expect(validate.errors).toBeNull();
      expect(ok).toBe(true);
    });

    it('validates the minimal non-ALN bundle (engine + gameState only) — the BILL:71 proof', () => {
      const ok = validate(clone(MINIMAL_NON_ALN_BUNDLE));
      expect(validate.errors).toBeNull();
      expect(ok).toBe(true);
    });
  });

  describe('reserved namespaces are genuinely reserved', () => {
    it('gameState accepts only pack-id-patterned keys', () => {
      const bundle = clone(MINIMAL_NON_ALN_BUNDLE);
      bundle.gameState = { 'NOT A PACK ID!': {} };
      expect(validate(bundle)).toBe(false);
    });

    it('gameState values are unconstrained (engine never interprets them)', () => {
      const bundle = clone(MINIMAL_NON_ALN_BUNDLE);
      bundle.gameState = { 'any-pack': { arbitrarily: ['nested', { data: 1 }] } };
      expect(validate(bundle)).toBe(true);
    });

    it('intake reserves exactly the five Phase-4 D names, each as schema true (name-only reservation)', () => {
      expect(schema.properties.intake.properties).toEqual({
        roster: true,
        directorNotes: true,
        photos: true,
        accusation: true,
        whiteboard: true,
      });
      expect(schema.properties.intake.additionalProperties).toBe(false);
    });

    it('intake members accept any type today — Phase-4 D owns the shapes', () => {
      const bundle = clone(MINIMAL_NON_ALN_BUNDLE);
      bundle.intake = { roster: 'three teams of five', photos: 42, accusation: { by: '001' } };
      expect(validate(bundle)).toBe(true);
    });

    it('intake refuses a key outside the five reserved names (exercised through validate)', () => {
      const bundle = clone(MINIMAL_NON_ALN_BUNDLE);
      bundle.intake = { surprise: 'not reserved' };
      expect(validate(bundle)).toBe(false);
    });
  });

  describe('input coverage — the four census input classes (§4a lens-1 OBJ-3)', () => {
    it('names the generate() payload sections', () => {
      for (const section of ['session', 'scores', 'transactions', 'playerScans']) {
        expect(schema.properties).toHaveProperty(section);
      }
    });

    it('carries every transaction field the report dereferences (census: 9 fields)', () => {
      const txProps = Object.keys(schema.properties.transactions.items.properties).sort();
      expect(txProps).toEqual([
        'memoryType', 'mode', 'points', 'status', 'summary',
        'teamId', 'timestamp', 'tokenId', 'valueRating',
      ]);
    });

    it('carries the tokenDatabase projection the report reads (owner only)', () => {
      const tokenEntry = schema.properties.tokens.additionalProperties;
      expect(Object.keys(tokenEntry.properties)).toEqual(['owner']);
    });

    it('carries the resolved scoring rules the ★ Detail cell needs', () => {
      const scoring = schema.properties.rules.properties.scoring;
      for (const key of ['baseValues', 'typeMultipliers', 'display']) {
        expect(scoring.properties).toHaveProperty(key);
      }
    });

    it('carries the resolved mode records section membership and verbNoun need', () => {
      const modeProps = schema.properties.rules.properties.modes.items.properties;
      for (const key of ['id', 'label', 'verbNoun', 'scoringPolicy', 'displayBehavior']) {
        expect(modeProps).toHaveProperty(key);
      }
    });

    it('REQUIRES the two membership-driving fields on every mode record — the section exists to carry them', () => {
      const bundle = clone(FULL_BUNDLE);
      delete bundle.rules.modes[0].scoringPolicy;
      expect(validate(bundle)).toBe(false);

      const bundle2 = clone(FULL_BUNDLE);
      delete bundle2.rules.modes[1].displayBehavior;
      expect(validate(bundle2)).toBe(false);
    });

    it('refuses empty-string identifiers (minLength on the id shape)', () => {
      const bundle = clone(FULL_BUNDLE);
      bundle.transactions[0].tokenId = '';
      expect(validate(bundle)).toBe(false);
    });
  });
});
