/**
 * Pure scoring rules (Phase 2 engine/game seam)
 *
 * gameRules/scoring.js is the single home for ALN's scoring rule
 * COMPUTATIONS: pure functions over plain data — no I/O, no EventEmitter,
 * no service reads. This is the exact surface that must stay in parity with
 * the GM Scanner's standalone implementation (LocalStorage), so everything
 * here depends only on plain token fields (value, groupId, groupMultiplier)
 * and plain transaction fields (teamId, tokenId, status, mode, points).
 *
 * Rule decisions encoded:
 * - A1: only blackmarket transactions count toward group completion
 * - A2/B1: detective mode = evidence only (0 points)
 * - Groups need 2+ member tokens to be completable
 * - Group bonus = (multiplier − 1) × Σ member token values
 */

const scoring = require('../../../src/gameRules/scoring');

const TOKENS = new Map([
  ['t1', { id: 't1', value: 100, groupId: 'g1', groupMultiplier: 3 }],
  ['t2', { id: 't2', value: 250, groupId: 'g1', groupMultiplier: 3 }],
  ['t3', { id: 't3', value: 500, groupId: null, groupMultiplier: 1 }],
  ['solo', { id: 'solo', value: 50, groupId: 'gSolo', groupMultiplier: 5 }],
  ['n1', { id: 'n1', value: 75, groupId: 'gNoBonus', groupMultiplier: 1 }],
  ['n2', { id: 'n2', value: 80, groupId: 'gNoBonus', groupMultiplier: 1 }],
]);

const tx = (tokenId, teamId = 'Team Alpha', overrides = {}) => ({
  tokenId,
  teamId,
  status: 'accepted',
  mode: 'blackmarket',
  points: TOKENS.get(tokenId)?.value ?? 0,
  timestamp: '2026-06-10T12:00:00.000Z',
  ...overrides,
});

describe('gameRules/scoring (pure)', () => {
  describe('pointsFor', () => {
    it('returns token value for blackmarket mode', () => {
      expect(scoring.pointsFor(TOKENS.get('t3'), 'blackmarket')).toBe(500);
    });

    it('returns 0 for detective mode (evidence only, decision A2)', () => {
      expect(scoring.pointsFor(TOKENS.get('t3'), 'detective')).toBe(0);
    });
  });

  describe('teamBankedTokenIds (decision A1)', () => {
    it('includes accepted blackmarket transactions for the team', () => {
      const ids = scoring.teamBankedTokenIds([tx('t1'), tx('t2')], 'Team Alpha');
      expect(ids.has('t1')).toBe(true);
      expect(ids.has('t2')).toBe(true);
    });

    it('excludes detective, non-accepted, and other-team transactions', () => {
      const ids = scoring.teamBankedTokenIds([
        tx('t1', 'Team Alpha', { mode: 'detective' }),
        tx('t2', 'Team Alpha', { status: 'duplicate' }),
        tx('t3', 'Team Beta'),
      ], 'Team Alpha');
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
      })).toBe(false);
    });

    it('is true when the team has banked every member token', () => {
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [tx('t1'), tx('t2')],
        teamId: 'Team Alpha',
        groupId: 'g1',
      })).toBe(true);
    });

    it('counts the in-flight token via currentTokenId (not yet in transactions)', () => {
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [tx('t1')],
        teamId: 'Team Alpha',
        groupId: 'g1',
        currentTokenId: 't2',
      })).toBe(true);
    });

    it('detective transactions never count toward completion (decision A1)', () => {
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [tx('t1', 'Team Alpha', { mode: 'detective', points: 0 }), tx('t2')],
        teamId: 'Team Alpha',
        groupId: 'g1',
      })).toBe(false);
    });

    it('single-token groups are never completable', () => {
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [tx('solo')],
        teamId: 'Team Alpha',
        groupId: 'gSolo',
      })).toBe(false);
    });

    it('is false for null groupId', () => {
      expect(scoring.isGroupComplete({
        tokens: TOKENS,
        transactions: [],
        teamId: 'Team Alpha',
        groupId: null,
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

    it('bonus = (multiplier − 1) × sum of all member values', () => {
      // g1: (3-1) × (100+250) = 700
      expect(scoring.groupBonusAmount(TOKENS, 'g1')).toBe(700);
    });

    it('bonus is 0 when the group pays no multiplier', () => {
      expect(scoring.groupBonusAmount(TOKENS, 'gNoBonus')).toBe(0);
      expect(scoring.groupBonusAmount(TOKENS, null)).toBe(0);
    });
  });

  describe('computeTeamScores (rebuild path)', () => {
    it('recomputes base, bonus, counters, and completed groups per team', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [tx('t1'), tx('t2'), tx('t3', 'Team Beta')],
        teamIds: ['Team Alpha', 'Team Beta', 'Team Idle'],
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

    it('skips detective and non-accepted transactions (parity with live path)', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [
          tx('t1', 'Team Alpha', { mode: 'detective', points: 0 }),
          tx('t2', 'Team Alpha', { status: 'duplicate' }),
        ],
        teamIds: ['Team Alpha'],
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
      });
      expect(result[0].baseScore).toBe(123);
    });

    it('includes teams found only in transactions (defensive)', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [tx('t3', 'Ghost Team')],
        teamIds: [],
      });
      expect(result.find(r => r.teamId === 'Ghost Team')).toBeDefined();
    });

    it('records lastTokenTime from the team transactions', () => {
      const result = scoring.computeTeamScores({
        tokens: TOKENS,
        transactions: [tx('t3', 'Team Alpha', { timestamp: '2026-06-10T13:30:00.000Z' })],
        teamIds: ['Team Alpha'],
      });
      expect(result[0].lastTokenTime).toBe('2026-06-10T13:30:00.000Z');
    });
  });
});
