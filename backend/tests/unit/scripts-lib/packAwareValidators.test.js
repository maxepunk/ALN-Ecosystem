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
  kind: 'game', schemaVersion: 1, id: 'validator-pack',
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
};

const TOKENS_JSON = {
  g1: { SF_RFID: 'g1', SF_ValueRating: 1, SF_MemoryType: 'Personal', SF_Group: 'Duo (x3)' },
  g2: { SF_RFID: 'g2', SF_ValueRating: 2, SF_MemoryType: 'Personal', SF_Group: 'Duo (x3)' },
  solo: { SF_RFID: 'solo', SF_ValueRating: 3, SF_MemoryType: 'Technical', SF_Group: '' },
};

function writePack(dir, { contentHash = HASH_A } = {}) {
  fs.writeFileSync(path.join(dir, 'pack-manifest.json'), JSON.stringify({
    kind: 'pack-manifest', schemaVersion: 1, packId: 'validator-pack', version: '0.0.1',
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
