/**
 * Pure scoring rules (Phase 2 engine/game seam; modes via flags since
 * Phase 3 A3 slice 1)
 *
 * gameRules/scoring.js is the single home for scoring rule COMPUTATIONS:
 * pure functions over plain data — no I/O, no EventEmitter, no service
 * reads. This is the exact surface that must stay in parity with the GM
 * Scanner's standalone implementation (LocalStorage), so everything here
 * depends only on plain token fields (value, groupId, groupMultiplier),
 * plain transaction fields (teamId, tokenId, status, mode, points), and —
 * since slice 1 — the active pack's gameConfig, resolved through the
 * modeSemantics seam (scoringPolicy/countsTowardGroups, never mode-id
 * string equality).
 *
 * Rule decisions encoded:
 * - A1 (generalized): only counting-mode transactions build group progress
 * - A2/B1 (generalized): non-'standard' scoringPolicy = 0 points
 * - Groups need 2+ member tokens to be completable
 * - Group bonus = (multiplier − 1) × Σ SCORED member contributions (A3
 *   slice 2 §2f: completion counts ANY counting-mode claim; the bonus
 *   BASE sums only members claimed in a standard-scoring mode — an
 *   unscored counting claim contributes presence, not money)
 */

const scoring = require('../../../src/gameRules/scoring');
const modeSemantics = require('../../../src/gameRules/modeSemantics');

const TOKENS = new Map([
  ['t1', { id: 't1', value: 100, groupId: 'g1', groupMultiplier: 3 }],
  ['t2', { id: 't2', value: 250, groupId: 'g1', groupMultiplier: 3 }],
  ['t3', { id: 't3', value: 500, groupId: null, groupMultiplier: 1 }],
  ['solo', { id: 'solo', value: 50, groupId: 'gSolo', groupMultiplier: 5 }],
  ['n1', { id: 'n1', value: 75, groupId: 'gNoBonus', groupMultiplier: 1 }],
  ['n2', { id: 'n2', value: 80, groupId: 'gNoBonus', groupMultiplier: 1 }],
]);

// ALN-shaped gameConfig — the flags that reproduce the pre-slice-1 rules
const ALN_CONFIG = {
  modes: [
    { id: 'blackmarket', label: 'Black Market', scoringPolicy: 'standard', entityRole: 'ledger', countsTowardGroups: true, displayBehavior: { surface: 'scoreboard-rankings' } },
    { id: 'detective', label: 'Detective', scoringPolicy: 'none', entityRole: 'attribution', defaultEntity: 'Nova', countsTowardGroups: false, displayBehavior: { surface: 'scoreboard-evidence' } },
  ],
};

// Toy-shaped gameConfig — ids the engine has never heard of (open vocabulary)
const TOY_CONFIG = {
  modes: [
    { id: 'fence', label: 'Fence', scoringPolicy: 'standard', entityRole: 'ledger', countsTowardGroups: true, displayBehavior: { surface: 'scoreboard-rankings' } },
    { id: 'tipoff', label: 'Tip-Off', scoringPolicy: 'none', entityRole: 'attribution', countsTowardGroups: false, displayBehavior: { surface: 'scoreboard-evidence' } },
    { id: 'appraise', label: 'Appraise', scoringPolicy: 'none', entityRole: 'ledger', countsTowardGroups: false, displayBehavior: { surface: 'none' } },
  ],
};

// Event-only-groups config (§2f): a legal none∧counting mode — claims
// build group progress but score nothing (the flavor-ii refusal this
// combination used to trip was DELETED in slice 2).
const EVENT_CONFIG = {
  modes: [
    { id: 'fence', label: 'Fence', scoringPolicy: 'standard', entityRole: 'ledger', countsTowardGroups: true, displayBehavior: { surface: 'scoreboard-rankings' } },
    { id: 'stash', label: 'Stash', scoringPolicy: 'none', entityRole: 'ledger', countsTowardGroups: true, displayBehavior: { surface: 'none' } },
  ],
};

const tx = (tokenId, teamId = 'Team Alpha', overrides = {}) => ({
  tokenId,
  teamId,
  status: 'accepted',
  mode: 'blackmarket',
  points: TOKENS.get(tokenId)?.value ?? 0,
  timestamp: '2026-06-10T12:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  modeSemantics._resetForTesting();
});

describe('gameRules/scoring (pure)', () => {
  describe('pointsFor', () => {
    it('returns token value for a standard-scoring mode (ALN blackmarket)', () => {
      expect(scoring.pointsFor(TOKENS.get('t3'), 'blackmarket', ALN_CONFIG)).toBe(500);
    });

    it('returns 0 for a none-scoring mode (ALN detective, decision A2)', () => {
      expect(scoring.pointsFor(TOKENS.get('t3'), 'detective', ALN_CONFIG)).toBe(0);
    });

    it('returns 0 for a mode the config does not declare (never invents money)', () => {
      // Legacy code scored ANY non-'detective' string at full value — the
      // flags migration ends that class. Unreachable live (wire ingress
      // rejects unknown modes); this pins the safe history reading.
      expect(scoring.pointsFor(TOKENS.get('t3'), 'fence', ALN_CONFIG)).toBe(0);
      expect(scoring.pointsFor(TOKENS.get('t3'), undefined, ALN_CONFIG)).toBe(0);
    });
  });

  describe('teamBankedTokenIds (decision A1)', () => {
    it('includes accepted counting-mode transactions for the team', () => {
      const ids = scoring.teamBankedTokenIds([tx('t1'), tx('t2')], 'Team Alpha', ALN_CONFIG);
      expect(ids.has('t1')).toBe(true);
      expect(ids.has('t2')).toBe(true);
    });

    it('excludes non-counting-mode, non-accepted, and other-team transactions', () => {
      const ids = scoring.teamBankedTokenIds([
        tx('t1', 'Team Alpha', { mode: 'detective' }),
        tx('t2', 'Team Alpha', { status: 'duplicate' }),
        tx('t3', 'Team Beta'),
      ], 'Team Alpha', ALN_CONFIG);
      expect(ids.size).toBe(0);
    });
  });

  describe('isGroupComplete', () => {
    it('is false when the team has banked only part of the group', () => {
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [tx('t1')],
        teamId: 'Team Alpha',
        groupId: 'g1',
        gameConfig: ALN_CONFIG,
      })).toBe(false);
    });

    it('is true when the team has banked every member token', () => {
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [tx('t1'), tx('t2')],
        teamId: 'Team Alpha',
        groupId: 'g1',
        gameConfig: ALN_CONFIG,
      })).toBe(true);
    });

    it('counts the in-flight token via currentTokenId (not yet in transactions)', () => {
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [tx('t1')],
        teamId: 'Team Alpha',
        groupId: 'g1',
        currentTokenId: 't2',
        gameConfig: ALN_CONFIG,
      })).toBe(true);
    });

    it('non-counting-mode transactions never build completion (decision A1)', () => {
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [tx('t1', 'Team Alpha', { mode: 'detective', points: 0 }), tx('t2')],
        teamId: 'Team Alpha',
        groupId: 'g1',
        gameConfig: ALN_CONFIG,
      })).toBe(false);
    });

    it('single-token groups are never completable', () => {
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [tx('solo')],
        teamId: 'Team Alpha',
        groupId: 'gSolo',
        gameConfig: ALN_CONFIG,
      })).toBe(false);
    });

    it('is false for null groupId', () => {
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [],
        teamId: 'Team Alpha',
        groupId: null,
        gameConfig: ALN_CONFIG,
      })).toBe(false);
    });
  });

  describe('groupMultiplier / groupBonusAmount', () => {
    it('returns the multiplier from any member token', () => {
      expect(scoring.groupMultiplier(TOKENS, 'g1')).toBe(3);
    });

    it('returns 0 for unknown or null groups and for multiplier <= 1', () => {
      expect(scoring.groupMultiplier(TOKENS, null)).toBe(0);
      expect(scoring.groupMultiplier(TOKENS, 'nope')).toBe(0);
      expect(scoring.groupMultiplier(TOKENS, 'gNoBonus')).toBe(0);
    });

    it('bonus = (multiplier − 1) × sum of member values when every claim scored', () => {
      // g1: (3-1) × (100+250) = 700
      expect(scoring.groupBonusAmount({
        tokens: TOKENS, groupId: 'g1',
        transactions: [tx('t1'), tx('t2')],
        teamId: 'Team Alpha', gameConfig: ALN_CONFIG,
      })).toBe(700);
    });

    it('bonus is 0 when the group pays no multiplier', () => {
      const args = { tokens: TOKENS, transactions: [tx('n1'), tx('n2')], teamId: 'Team Alpha', gameConfig: ALN_CONFIG };
      expect(scoring.groupBonusAmount({ ...args, groupId: 'gNoBonus' })).toBe(0);
      expect(scoring.groupBonusAmount({ ...args, groupId: null })).toBe(0);
    });

    it('§2f: an unscored counting claim contributes presence but $0 to the base', () => {
      // t1 claimed via fence (scored), t2 via stash (none∧counting):
      // bonus base = t1 only → (3-1) × 100 = 200
      expect(scoring.groupBonusAmount({
        tokens: TOKENS, groupId: 'g1',
        transactions: [
          tx('t1', 'Crew', { mode: 'fence' }),
          tx('t2', 'Crew', { mode: 'stash', points: 0 }),
        ],
        teamId: 'Crew', gameConfig: EVENT_CONFIG,
      })).toBe(200);
    });

    it('§2f: an all-unscored completion pays a $0 bonus (event-only groups)', () => {
      expect(scoring.groupBonusAmount({
        tokens: TOKENS, groupId: 'g1',
        transactions: [
          tx('t1', 'Crew', { mode: 'stash', points: 0 }),
          tx('t2', 'Crew', { mode: 'stash', points: 0 }),
        ],
        teamId: 'Crew', gameConfig: EVENT_CONFIG,
      })).toBe(0);
    });

    it('rides the legacy ALN shim when no gameConfig is passed (default arg, ledger L6)', () => {
      // Omit gameConfig AND currentTokenId entirely: resolveMode falls back
      // to the baked ALN table, where 'blackmarket' is standard∧counting.
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [tx('t1'), tx('t2')],
        teamId: 'Team Alpha',
        groupId: 'g1',
      })).toBe(true);
      expect(scoring.groupBonusAmount({
        tokens: TOKENS, groupId: 'g1',
        transactions: [tx('t1'), tx('t2')],
        teamId: 'Team Alpha',
      })).toBe(700);
    });

    it('§2f: another team\'s scored claims never feed this team\'s bonus base', () => {
      expect(scoring.groupBonusAmount({
        tokens: TOKENS, groupId: 'g1',
        transactions: [
          tx('t1', 'Crew', { mode: 'stash', points: 0 }),
          tx('t2', 'Crew', { mode: 'stash', points: 0 }),
          tx('t1', 'Rivals', { mode: 'fence' }),
        ],
        teamId: 'Crew', gameConfig: EVENT_CONFIG,
      })).toBe(0);
    });
  });

  describe('computeTeamScores (rebuild path)', () => {
    it('recomputes base, bonus, counters, and completed groups per team', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [tx('t1'), tx('t2'), tx('t3', 'Team Beta')],
        teamIds: ['Team Alpha', 'Team Beta', 'Team Idle'],
        gameConfig: ALN_CONFIG,
      });

      const alpha = result.find(r => r.teamId === 'Team Alpha');
      expect(alpha.baseScore).toBe(350);
      expect(alpha.bonusPoints).toBe(700);
      expect(alpha.currentScore).toBe(1050);
      expect(alpha.tokensScanned).toBe(2);
      expect(alpha.completedGroups).toEqual(['g1']);

      const beta = result.find(r => r.teamId === 'Team Beta');
      expect(beta.currentScore).toBe(500);
      expect(beta.completedGroups).toEqual([]);

      // Teams with no transactions still get a zero row (membership preserved)
      const idle = result.find(r => r.teamId === 'Team Idle');
      expect(idle).toEqual(expect.objectContaining({
        baseScore: 0, bonusPoints: 0, currentScore: 0, tokensScanned: 0,
        completedGroups: [], lastTokenTime: null,
      }));
    });

    it('skips none-scoring-mode and non-accepted transactions (parity with live path)', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [
          tx('t1', 'Team Alpha', { mode: 'detective', points: 0 }),
          tx('t2', 'Team Alpha', { status: 'duplicate' }),
        ],
        teamIds: ['Team Alpha'],
        gameConfig: ALN_CONFIG,
      });
      expect(result[0].currentScore).toBe(0);
      expect(result[0].tokensScanned).toBe(0);
    });

    it('uses transaction points (history is authoritative for base score)', () => {
      // A token whose configured value later changed: rebuild honors the
      // recorded points, matching the current rebuildScoresFromTransactions
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [tx('t3', 'Team Alpha', { points: 123 })],
        teamIds: ['Team Alpha'],
        gameConfig: ALN_CONFIG,
      });
      expect(result[0].baseScore).toBe(123);
    });

    it('includes teams found only in transactions (defensive)', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [tx('t3', 'Ghost Team')],
        teamIds: [],
        gameConfig: ALN_CONFIG,
      });
      expect(result.find(r => r.teamId === 'Ghost Team')).toBeDefined();
    });

    it('records lastTokenTime from the team transactions', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [tx('t3', 'Team Alpha', { timestamp: '2026-06-10T13:30:00.000Z' })],
        teamIds: ['Team Alpha'],
        gameConfig: ALN_CONFIG,
      });
      expect(result[0].lastTokenTime).toBe('2026-06-10T13:30:00.000Z');
    });

    it('§2f: unscored counting claims complete groups in the rebuild (event-only)', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [
          tx('t1', 'Crew', { mode: 'stash', points: 0 }),
          tx('t2', 'Crew', { mode: 'stash', points: 0 }),
        ],
        teamIds: ['Crew'],
        gameConfig: EVENT_CONFIG,
      });
      expect(result[0].completedGroups).toEqual(['g1']);
      expect(result[0].baseScore).toBe(0);
      expect(result[0].bonusPoints).toBe(0); // no scored contributions → $0 bonus
      expect(result[0].tokensScanned).toBe(0); // parity: live path counts scored claims only
    });

    it('§2f: a team present ONLY via counting claims still gets its completion row (defensive symmetry)', () => {
      // 'Ghost Crew' is absent from teamIds and has no scoring transactions
      // — only stash claims. The rebuild must still record the completion.
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [
          tx('t1', 'Ghost Crew', { mode: 'stash', points: 0 }),
          tx('t2', 'Ghost Crew', { mode: 'stash', points: 0 }),
        ],
        teamIds: [],
        gameConfig: EVENT_CONFIG,
      });
      const ghost = result.find(r => r.teamId === 'Ghost Crew');
      expect(ghost).toBeDefined();
      expect(ghost.completedGroups).toEqual(['g1']);
      expect(ghost.currentScore).toBe(0);
    });

    it('§2f: mixed scored/unscored completion pays the bonus from scored contributions only', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [
          tx('t1', 'Crew', { mode: 'fence' }),               // scored: 100
          tx('t2', 'Crew', { mode: 'stash', points: 0 }),    // presence only
        ],
        teamIds: ['Crew'],
        gameConfig: EVENT_CONFIG,
      });
      expect(result[0].baseScore).toBe(100);
      expect(result[0].completedGroups).toEqual(['g1']);
      expect(result[0].bonusPoints).toBe(200); // (3-1) × 100, NOT × 350
      expect(result[0].currentScore).toBe(300);
    });
  });

  describe('open mode vocabulary (slice 1) — flags drive behavior, not ids', () => {
    it('scores and groups toy-pack modes the engine has never heard of', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [
          tx('t1', 'Crew', { mode: 'fence' }),
          tx('t2', 'Crew', { mode: 'fence' }),
        ],
        teamIds: ['Crew'],
        gameConfig: TOY_CONFIG,
      });
      expect(result[0].baseScore).toBe(350);
      expect(result[0].completedGroups).toEqual(['g1']);
      expect(result[0].bonusPoints).toBe(700);
    });

    it('a none/non-counting mode (tipoff) is evidence, not progress', () => {
      expect(scoring.pointsFor(TOKENS.get('t1'), 'tipoff', TOY_CONFIG)).toBe(0);
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [tx('t1', 'Crew', { mode: 'tipoff', points: 0 }), tx('t2', 'Crew', { mode: 'fence' })],
        teamId: 'Crew',
        groupId: 'g1',
        gameConfig: TOY_CONFIG,
      })).toBe(false);
    });

    it('appraise (none + ledger + surface none) claims for $0 — D2 consuming-appraise', () => {
      expect(scoring.pointsFor(TOKENS.get('t3'), 'appraise', TOY_CONFIG)).toBe(0);
    });

    it('mode ids from the WRONG pack score nothing and count toward nothing', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [tx('t1', 'Crew', { mode: 'blackmarket' })],
        teamIds: ['Crew'],
        gameConfig: TOY_CONFIG,
      });
      expect(result[0].currentScore).toBe(0);
      expect(result[0].tokensScanned).toBe(0);
    });
  });

  describe('legacy shim path (null gameConfig, ledger L6)', () => {
    it('reproduces ALN rules exactly with no config (pre-pack checkouts)', () => {
      expect(scoring.pointsFor(TOKENS.get('t3'), 'blackmarket', null)).toBe(500);
      expect(scoring.pointsFor(TOKENS.get('t3'), 'detective', null)).toBe(0);
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [tx('t1'), tx('t2')],
        teamIds: ['Team Alpha'],
        // gameConfig deliberately omitted
      });
      expect(result[0].currentScore).toBe(1050);
    });
  });
});
