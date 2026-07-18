/**
 * Post-session validators — pack-aware behavior (A3 slice 2, owner
 * ruling D4s2: FULL sweep)
 *
 * Pins the three D4s2 dimensions:
 * (a) packResolver resolves the session's STAMPED pack (match / mismatch
 *     / unstamped verdicts, PACK_PATH override, raw-metadata normalization);
 * (b) mode behavior resolves through the semantics seam — the old
 *     `mode === 'detective'` literals paid unknown modes full value and
 *     mis-set every non-ALN pack;
 * (c) ScoringCalculator adopts the engine's §2f group math (completion
 *     counts any counting claim; bonus base sums scored∧counting only).
 *
 * scripts/lib had ZERO test coverage before this suite (census finding).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { resolveSessionPack } = require('../../../scripts/lib/packResolver');
const ScoringCalculator = require('../../../scripts/lib/ScoringCalculator');
const NonScoringModeCheck = require('../../../scripts/lib/validators/NonScoringModeCheck');
const TransactionFlowCheck = require('../../../scripts/lib/validators/TransactionFlowCheck');

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;

// A toy-shaped pack: one scored+counting mode, one unscored+counting
// mode (event-only groups, §2f), one unscored non-counting mode.
const GAME_CONFIG = {
  kind: 'game', schemaVersion: 2, id: 'validator-pack',
  modes: [
    {
      id: 'fence', label: 'Fence', scoringPolicy: 'standard', entityRole: 'ledger',
      countsTowardGroups: true, displayBehavior: { surface: 'scoreboard-rankings' },
    },
    {
      id: 'stash', label: 'Stash', scoringPolicy: 'none', entityRole: 'ledger',
      countsTowardGroups: true, displayBehavior: { surface: 'none' },
    },
    {
      id: 'tipoff', label: 'Tipoff', scoringPolicy: 'none', entityRole: 'attribution',
      countsTowardGroups: false, displayBehavior: { surface: 'scoreboard-evidence', fields: ['summary'] },
    },
  ],
  scoring: {
    baseValues: { 1: 100, 2: 200, 3: 300, 4: 400, 5: 500 },
    typeMultipliers: { Personal: 1, Technical: 2, UNKNOWN: 0 },
  },
  // v2 (D1b): multipliers live HERE — tokens carry the pure group name
  groups: { Duo: { multiplier: 3 } },
};

const TOKENS_JSON = {
  g1: { SF_RFID: 'g1', SF_ValueRating: 1, SF_MemoryType: 'Personal', SF_Group: 'Duo' },
  g2: { SF_RFID: 'g2', SF_ValueRating: 2, SF_MemoryType: 'Personal', SF_Group: 'Duo' },
  solo: { SF_RFID: 'solo', SF_ValueRating: 3, SF_MemoryType: 'Technical', SF_Group: '' },
};

function writePack(dir, { contentHash = HASH_A } = {}) {
  fs.writeFileSync(path.join(dir, 'pack-manifest.json'), JSON.stringify({
    kind: 'pack-manifest', schemaVersion: 2, packId: 'validator-pack', version: '0.0.1',
    contentHash, engine: { minVersion: '3.0.0' },
    files: [{ path: 'tokens.json', role: 'tokens', sha1: '0'.repeat(40), size: 2 }],
  }));
  fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(GAME_CONFIG));
  fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(TOKENS_JSON));
}

const tx = (tokenId, mode, points, overrides = {}) => ({
  id: `tx-${tokenId}-${mode}`,
  tokenId, mode, points,
  teamId: 'Team Alpha',
  status: 'accepted',
  timestamp: '2026-07-18T12:00:00Z',
  ...overrides,
});

describe('post-session validators — pack-aware (D4s2)', () => {
  let tmpDir;
  const originalPackPath = process.env.PACK_PATH;

  beforeEach(() => {
    delete process.env.PACK_PATH;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-valpack-'));
    writePack(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalPackPath === undefined) {
      delete process.env.PACK_PATH;
    } else {
      process.env.PACK_PATH = originalPackPath;
    }
  });

  function loadCalculator() {
    const TokenLoader = require('../../../scripts/lib/TokenLoader');
    const tokens = new TokenLoader(tmpDir).loadTokens();
    return new ScoringCalculator(tokens, { gameConfig: GAME_CONFIG, packDir: tmpDir });
  }

  describe('packResolver.resolveSessionPack', () => {
    it('MATCH: stamped hash equals the resolved pack', () => {
      const session = { metadata: { pack: { packId: 'validator-pack', version: '0.0.1', contentHash: HASH_A } } };
      const res = resolveSessionPack(session, { packDir: tmpDir });
      expect(res.verdict).toBe('match');
      expect(res.gameConfig.id).toBe('validator-pack');
    });

    it('MISMATCH: stamped hash differs — LOUD note, proceeds against the on-disk pack', () => {
      const session = { metadata: { pack: { packId: 'other-pack', version: '9.9.9', contentHash: HASH_B } } };
      const res = resolveSessionPack(session, { packDir: tmpDir });
      expect(res.verdict).toBe('mismatch');
      expect(res.notes.some(n => n.includes('PACK MISMATCH'))).toBe(true);
      expect(res.gameConfig).not.toBeNull();
    });

    it('UNSTAMPED: raw-metadata normalization (undefined AND missing metadata both → null stamp)', () => {
      expect(resolveSessionPack({ metadata: {} }, { packDir: tmpDir }).verdict).toBe('unstamped');
      expect(resolveSessionPack({}, { packDir: tmpDir }).verdict).toBe('unstamped');
      expect(resolveSessionPack({ metadata: { pack: null } }, { packDir: tmpDir }).verdict).toBe('unstamped');
    });

    it('PACK_PATH override wins over the default dir, with a note', () => {
      process.env.PACK_PATH = tmpDir;
      const res = resolveSessionPack({});
      expect(res.packDir).toBe(path.resolve(tmpDir));
      expect(res.notes.some(n => n.includes('PACK_PATH'))).toBe(true);
    });
  });

  describe('ScoringCalculator — mode behavior via the seam (never literals)', () => {
    it('an UNKNOWN mode expects 0 points (the old literal test paid it full catalog value)', () => {
      const calc = loadCalculator();
      expect(calc.calculateExpectedPoints({ tokenId: 'solo', mode: 'no-such-mode' })).toBe(0);
    });

    it('a non-scoring mode expects 0; a standard mode expects catalog value', () => {
      const calc = loadCalculator();
      expect(calc.calculateExpectedPoints({ tokenId: 'solo', mode: 'stash' })).toBe(0);
      // solo: rating 3 (300) × Technical (2) = 600
      expect(calc.calculateExpectedPoints({ tokenId: 'solo', mode: 'fence' })).toBe(600);
    });

    it('§2f: an unscored COUNTING claim completes the group; bonus base sums SCORED claims only', () => {
      const calc = loadCalculator();
      // g1 scored via fence (100×1=100); g2 banked via stash (unscored, $0)
      const transactions = [
        tx('g1', 'fence', 100),
        tx('g2', 'stash', 0),
      ];
      const result = calc.calculateTeamScore(transactions, 'Team Alpha');

      expect(result.completedGroups.map(g => g.id)).toEqual(['Duo']);
      // bonus = (3-1) × 100 (g1 only — g2's presence contributes $0)
      expect(result.bonusScore).toBe(200);
      expect(result.baseScore).toBe(100);
      expect(result.scoredCount).toBe(1);
      expect(result.unscoredCount).toBe(1);
    });

    it('a NON-COUNTING claim does not complete the group (the old set was mode-blind beyond detective)', () => {
      const calc = loadCalculator();
      const transactions = [
        tx('g1', 'fence', 100),
        tx('g2', 'tipoff', 0), // unscored AND non-counting
      ];
      const result = calc.calculateTeamScore(transactions, 'Team Alpha');
      expect(result.completedGroups).toEqual([]);
      expect(result.bonusScore).toBe(0);
    });
  });

  describe('NonScoringModeCheck (was DetectiveModeCheck)', () => {
    it('FAILS a non-scoring transaction with points, in ANY non-scoring mode', async () => {
      const calc = loadCalculator();
      const check = new NonScoringModeCheck(new Map(), calc);
      const result = await check.run({ transactions: [tx('solo', 'stash', 500)] });
      expect(result.status).toBe('FAIL');
      expect(result.summary.nonZeroPoints).toBe(1);
    });

    it('WARNS on a missing summary only for EVIDENCE-surfaced modes', async () => {
      const calc = loadCalculator();
      const check = new NonScoringModeCheck(new Map(), calc);

      const evidence = await check.run({ transactions: [tx('solo', 'tipoff', 0)] });
      expect(evidence.status).toBe('WARNING');
      expect(evidence.summary.missingSummary).toBe(1);

      const silent = await check.run({ transactions: [tx('solo', 'stash', 0)] });
      expect(silent.status).toBe('PASS');
      expect(silent.summary.missingSummary).toBe(0);
    });
  });

  describe('loader hard edges (review pins)', () => {
    it('TokenLoader with an EXPLICIT packDir throws on missing tokens.json — never a silent fallback', () => {
      const TokenLoader = require('../../../scripts/lib/TokenLoader');
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-empty-'));
      try {
        expect(() => new TokenLoader(emptyDir).loadRawTokens())
          .toThrow(/Resolved pack has no readable tokens\.json/);
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it('scoringConfigLoader throws LOUDLY on an unusable scoring block and caches PER DIRECTORY', () => {
      const { loadScoringConstants } = require('../../../scripts/lib/scoringConfigLoader');
      const badDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-bad-'));
      try {
        fs.writeFileSync(path.join(badDir, 'game.json'), JSON.stringify({
          scoring: { baseValues: {}, typeMultipliers: { A: 1 } },
        }));
        expect(() => loadScoringConstants(badDir)).toThrow(/no usable scoring block/);

        // Per-dir cache: this tmp pack must not be served the memo of
        // another dir (the old single-slot memo would have)
        const a = loadScoringConstants(tmpDir);
        expect(a.BASE_VALUES[1]).toBe(100);
        const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-second-'));
        try {
          fs.writeFileSync(path.join(secondDir, 'game.json'), JSON.stringify({
            scoring: { baseValues: { 1: 777 }, typeMultipliers: { Personal: 1 } },
          }));
          expect(loadScoringConstants(secondDir).BASE_VALUES[1]).toBe(777);
          expect(loadScoringConstants(tmpDir).BASE_VALUES[1]).toBe(100);
        } finally {
          fs.rmSync(secondDir, { recursive: true, force: true });
        }
      } finally {
        fs.rmSync(badDir, { recursive: true, force: true });
      }
    });

    it("packResolver never reports 'match' on a hash-less stamp (undefined === undefined guard)", () => {
      const session = { metadata: { pack: { packId: 'validator-pack', version: '0.0.1' } } };
      const res = resolveSessionPack(session, { packDir: tmpDir });
      expect(res.verdict).toBe('unstamped');
      expect(res.notes.some(n => n.includes('NO contentHash'))).toBe(true);
    });
  });

  describe('ReportGenerator — Pack Resolution section (review pin)', () => {
    it('renders the stamp, resolved dir, verdict, and resolver notes', () => {
      const ReportGenerator = require('../../../scripts/lib/ReportGenerator');
      const pack = resolveSessionPack(
        { metadata: { pack: { packId: 'other', version: '9.9.9', contentHash: HASH_B } } },
        { packDir: tmpDir }
      );
      const report = ReportGenerator.generate(
        { id: 's1', name: 'pin', transactions: [] }, [], pack
      );
      expect(report).toContain('## Pack Resolution');
      expect(report).toContain('| Verdict | mismatch |');
      expect(report).toContain('PACK MISMATCH');
    });
  });

  describe('ScoringIntegrityCheck — models the D2s2 rebuild floor (review fix pin)', () => {
    function stubLogParser({ finalScores, adjustments }) {
      return {
        getFinalScores: async () => finalScores,
        findScoreAdjustments: async () => adjustments,
      };
    }

    it('a floored session (stored 0, recompute negative) PASSES under a no-negatives pack', async () => {
      const ScoringIntegrityCheck = require('../../../scripts/lib/validators/ScoringIntegrityCheck');
      const calc = loadCalculator(); // GAME_CONFIG declares no semantics → floor applies
      const check = new ScoringIntegrityCheck(calc, stubLogParser({
        finalScores: [{ teamId: 'Team Alpha', score: 0, bonus: 0 }],
        // Accepted while the base supported it; the base was then deleted
        adjustments: [{ teamId: 'Team Alpha', delta: -800, reason: 'penalty', gmStation: 'gm-1', timestamp: '2026-07-18T11:00:00Z' }],
      }));

      const result = await check.run({
        startTime: '2026-07-18T10:00:00Z', endTime: '2026-07-18T12:00:00Z',
        // One surviving scored tx (base 100); the -800 adjustment leaned
        // on a deleted base → engine rebuild floored the stored score to
        // 0. Recompute WITHOUT the floor would be -700 → false FAIL.
        transactions: [tx('g1', 'fence', 100)],
        scores: [],
      });

      const mismatch = result.findings.find(f => f.message.includes('Score mismatch'));
      expect(mismatch).toBeUndefined();
      expect(result.status).not.toBe('FAIL');
      expect(result.findings.some(f => f.message.includes('Score verified'))).toBe(true);
    });

    it('calculator.allowNegative: declared-true pack true; declared-scoring-no-semantics false; packless true', () => {
      const TokenLoader = require('../../../scripts/lib/TokenLoader');
      const tokens = new TokenLoader(tmpDir).loadTokens();
      expect(new ScoringCalculator(tokens, { gameConfig: GAME_CONFIG, packDir: tmpDir }).allowNegative).toBe(false);
      const withSem = { ...GAME_CONFIG, scoring: { ...GAME_CONFIG.scoring, semantics: { allowNegative: true } } };
      expect(new ScoringCalculator(tokens, { gameConfig: withSem, packDir: tmpDir }).allowNegative).toBe(true);
      expect(new ScoringCalculator(tokens, { gameConfig: null, packDir: tmpDir }).allowNegative).toBe(true);
    });
  });

  describe('TransactionFlowCheck — pack-declared mode vocabulary', () => {
    it("accepts the pack's own mode ids and warns only on undeclared ones", async () => {
      const check = new TransactionFlowCheck(new Map([['solo', {}]]), { gameConfig: GAME_CONFIG });
      expect(check.validModes).toEqual(['fence', 'stash', 'tipoff']);

      const result = await check.run({
        transactions: [
          tx('solo', 'fence', 600, { deviceId: 'GM_A' }),
          tx('solo', 'zzz-mode', 0, { id: 'tx-bad', deviceId: 'GM_A' }),
        ],
      });
      const invalidModeFindings = result.findings.filter(f => f.message.includes('Invalid mode'));
      expect(invalidModeFindings).toHaveLength(1);
      expect(invalidModeFindings[0].message).toContain('zzz-mode');
    });
  });
});
