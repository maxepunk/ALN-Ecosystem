/**
 * Pack-conditional score floor (A3 slice 2 — owner ruling D2s2)
 *
 * scoring.semantics.allowNegative was declared by both real packs (ALN
 * true, toy false) and read by NOTHING — this suite pins its enforcement:
 *
 * - allowNegative TRUE  → admin adjustments may take a team negative, the
 *   negative persists, and session restore accepts it (the old Joi min(0)
 *   construction floor made restore THROW on persisted negatives — a
 *   latent crash, fixed here).
 * - allowNegative FALSE → an adjustment that would cross zero is REJECTED
 *   (never silently clamped: the adjustment ledger stays additive for the
 *   post-session validators, and no audit entry is recorded for a refused
 *   adjustment). The deletion-rebuild path — the one reachable negative
 *   under a no-negatives pack — floors at 0 with a loud warn.
 */

const path = require('path');

const transactionService = require('../../../src/services/transactionService');
const sessionService = require('../../../src/services/sessionService');
const packService = require('../../../src/services/packService');
const TeamScore = require('../../../src/models/teamScore');
const logger = require('../../../src/utils/logger');
const { resetAllServices } = require('../../helpers/service-reset');

const TOY_PACK = path.resolve(__dirname, '../../e2e/fixtures/packs/toy-heist');

describe('pack-conditional score floor (D2s2)', () => {
  const originalPackPath = process.env.PACK_PATH;

  beforeEach(async () => {
    await resetAllServices();
    packService._resetForTesting();
    delete process.env.PACK_PATH; // default: the ALN pack (allowNegative true)
  });

  afterEach(async () => {
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
    transactionService.removeAllListeners();
    if (originalPackPath === undefined) {
      delete process.env.PACK_PATH;
    } else {
      process.env.PACK_PATH = originalPackPath;
    }
    packService._resetForTesting();
  });

  async function startSessionWithTeam() {
    await sessionService.createSession({ name: 'Floor test', teams: ['Team Alpha'] });
    await sessionService.startGame();
    return sessionService.getCurrentSession().scores.find(s => s.teamId === 'Team Alpha');
  }

  describe('allowNegative TRUE (ALN pack)', () => {
    it('an adjustment may take a team below zero and the negative sticks', async () => {
      const teamScore = await startSessionWithTeam();
      const events = [];
      transactionService.on('score:adjusted', (e) => events.push(e));

      const returned = transactionService.adjustTeamScore('Team Alpha', -500, 'penalty', 'gm-1');

      expect(returned.currentScore).toBe(-500);
      expect(teamScore.currentScore).toBe(-500);
      expect(teamScore.adminAdjustments).toHaveLength(1);
      expect(events).toHaveLength(1);
    });

    it('a persisted negative score RESTORES (the latent Joi min(0) crash is dead)', () => {
      const restored = TeamScore.fromJSON({
        teamId: 'Team Alpha',
        currentScore: -500,
        baseScore: -500,
        bonusPoints: 0,
        tokensScanned: 0,
        completedGroups: [],
        adminAdjustments: [{ delta: -500, gmStation: 'gm-1', reason: 'penalty', timestamp: new Date().toISOString() }],
        lastUpdate: new Date().toISOString(),
      });
      expect(restored.currentScore).toBe(-500);
    });

    it('the deletion rebuild keeps a negative (no floor under an allowNegative pack)', async () => {
      const teamScore = await startSessionWithTeam();
      teamScore.adminAdjustments.push({ delta: -800, gmStation: 'gm-1', reason: 'penalty', timestamp: new Date().toISOString() });

      transactionService.rebuildScoresFromTransactions([]);

      expect(teamScore.currentScore).toBe(-800);
    });
  });

  describe('allowNegative FALSE (toy pack)', () => {
    beforeEach(() => {
      process.env.PACK_PATH = TOY_PACK;
    });

    it('rejects a zero-crossing adjustment with a named error; no mutation, no audit entry, no event', async () => {
      const teamScore = await startSessionWithTeam();
      const events = [];
      transactionService.on('score:adjusted', (e) => events.push(e));

      expect(() => transactionService.adjustTeamScore('Team Alpha', -500, 'penalty', 'gm-1'))
        .toThrow(/score:adjust refused.*would take Team Alpha to -500.*does not allow negative scores/);

      expect(teamScore.currentScore).toBe(0);
      expect(teamScore.adminAdjustments).toHaveLength(0);
      expect(events).toHaveLength(0);
    });

    it('accepts a negative delta that stays at or above zero', async () => {
      const teamScore = await startSessionWithTeam();
      teamScore.addPoints(1000);

      transactionService.adjustTeamScore('Team Alpha', -1000, 'exact drain', 'gm-1');

      expect(teamScore.currentScore).toBe(0);
      expect(teamScore.adminAdjustments).toHaveLength(1);
    });

    it('the deletion rebuild floors at 0 with a LOUD warn (the one reachable negative)', async () => {
      const teamScore = await startSessionWithTeam();
      // History: an adjustment accepted against a base that a deletion
      // later removed — replaying it alone would go negative.
      teamScore.adminAdjustments.push({ delta: -800, gmStation: 'gm-1', reason: 'penalty', timestamp: new Date().toISOString() });
      const warnSpy = jest.spyOn(logger, 'warn');

      transactionService.rebuildScoresFromTransactions([]);

      expect(teamScore.currentScore).toBe(0);
      expect(teamScore.baseScore + teamScore.bonusPoints).toBe(teamScore.currentScore);
      expect(warnSpy.mock.calls.some(([m]) => m.includes('Score floored at 0 during rebuild'))).toBe(true);
      warnSpy.mockRestore();
    });
  });
});
