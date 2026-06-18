/**
 * Score Ownership Contract (Phase 2 collapse)
 *
 * session.scores is the SINGLE canonical store for team scores, holding live
 * TeamScore instances. transactionService mutates those instances in place —
 * there is no second store (the old transactionService.teamScores Map) and no
 * sync paths (syncTeamFromSession / restoreFromSession / upsertTeamScore).
 *
 * These tests pin the collapse: every score read and write must be observable
 * through session.scores itself, with object identity (not copies kept in
 * sync by listeners).
 */

const transactionService = require('../../../src/services/transactionService');
const sessionService = require('../../../src/services/sessionService');
const Session = require('../../../src/models/session');
const TeamScore = require('../../../src/models/teamScore');
const Token = require('../../../src/models/token');
const { resetAllServices } = require('../../helpers/service-reset');

function makeToken(id, value = 100, groupId = null) {
  return new Token({
    id,
    name: `Token ${id}`,
    value,
    memoryType: 'Technical',
    groupId,
    mediaAssets: { image: null, audio: null, video: null, processingImage: null },
    metadata: { rating: 3 },
  });
}

describe('Score ownership — session.scores is the single canonical store', () => {
  beforeEach(async () => {
    await resetAllServices();
  });

  afterEach(async () => {
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
    transactionService.removeAllListeners();
  });

  describe('Session model hydration', () => {
    it('hydrates scores as live TeamScore instances from JSON', () => {
      const session = Session.fromJSON({
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Restored',
        startTime: new Date().toISOString(),
        status: 'active',
        scores: [TeamScore.createInitial('Team Alpha').toJSON()],
        metadata: { gmStations: 0, playerDevices: 0, totalScans: 0, uniqueTokensScanned: [] },
      });

      expect(session.scores[0]).toBeInstanceOf(TeamScore);
      expect(session.scores[0].teamId).toBe('Team Alpha');
      // Instance methods must work (this is what makes it the live store)
      session.scores[0].addPoints(100);
      expect(session.scores[0].currentScore).toBe(100);
    });

    it('serializes scores back to plain JSON in toJSON()', () => {
      const session = new Session({
        name: 'Round trip',
        status: 'setup',
        scores: [TeamScore.createInitial('Team Alpha')],
      });

      const json = session.toJSON();
      expect(json.scores[0]).not.toBeInstanceOf(TeamScore);
      expect(json.scores[0]).toEqual(
        expect.objectContaining({ teamId: 'Team Alpha', currentScore: 0 })
      );
      expect(json.teams).toEqual(['Team Alpha']);
    });
  });

  describe('single store (no second copy)', () => {
    it('transactionService no longer carries a teamScores Map', () => {
      expect(transactionService.teamScores).toBeUndefined();
    });

    it('getTeamScores() reads directly from session.scores', async () => {
      await sessionService.createSession({ name: 'Test', teams: ['Team Alpha'] });
      await sessionService.startGame();

      // Mutate the canonical store directly — a second store would be stale
      const session = sessionService.getCurrentSession();
      session.scores.find(s => s.teamId === 'Team Alpha').addPoints(12345);

      const scores = transactionService.getTeamScores();
      expect(scores).toHaveLength(1);
      expect(scores[0].currentScore).toBe(12345);
    });

    it('getTeamScores() returns [] when no session exists', () => {
      expect(sessionService.getCurrentSession()).toBeNull();
      expect(transactionService.getTeamScores()).toEqual([]);
    });
  });

  describe('writes land in session.scores (object identity, not synced copies)', () => {
    it('processScan mutates the TeamScore instance inside session.scores', async () => {
      await sessionService.createSession({ name: 'Test', teams: ['Team Alpha'] });
      await sessionService.startGame();
      transactionService.tokens.set('tok1', makeToken('tok1', 100));

      await transactionService.processScan({
        tokenId: 'tok1',
        teamId: 'Team Alpha',
        deviceId: 'GM_TEST',
        deviceType: 'gm',
        mode: 'blackmarket',
      });

      const entry = sessionService.getCurrentSession().scores
        .find(s => s.teamId === 'Team Alpha');
      // The canonical entry IS a live instance with the new score — not a
      // plain-JSON copy upserted by a persistence listener
      expect(entry).toBeInstanceOf(TeamScore);
      expect(entry.currentScore).toBe(100);
      expect(entry.tokensScanned).toBe(1);
    });

    it('adjustTeamScore mutates the session.scores entry and returns the same instance', async () => {
      await sessionService.createSession({ name: 'Test', teams: ['Team Alpha'] });
      await sessionService.startGame();

      const returned = transactionService.adjustTeamScore('Team Alpha', 500, 'test', 'gm-1');

      const entry = sessionService.getCurrentSession().scores
        .find(s => s.teamId === 'Team Alpha');
      expect(entry).toBe(returned);
      expect(entry.currentScore).toBe(500);
      expect(entry.adminAdjustments).toHaveLength(1);
    });

    it('resetScores zeroes the live instances in session.scores in place', async () => {
      await sessionService.createSession({ name: 'Test', teams: ['Team Alpha'] });
      await sessionService.startGame();

      const entry = sessionService.getCurrentSession().scores[0];
      entry.addPoints(300);
      expect(entry.currentScore).toBe(300);

      transactionService.resetScores();

      // Same instance, zeroed — not replaced by a rebuilt JSON copy
      expect(sessionService.getCurrentSession().scores[0]).toBe(entry);
      expect(entry.currentScore).toBe(0);
      expect(entry.tokensScanned).toBe(0);
    });

    it('addTeamToSession makes the team scoreable with no sync step', async () => {
      await sessionService.createSession({ name: 'Test', teams: [] });
      await sessionService.startGame();

      await sessionService.addTeamToSession('Late Team');

      // Scoreable immediately: adjustTeamScore finds it in session.scores
      const returned = transactionService.adjustTeamScore('Late Team', 250, 'test', 'gm-1');
      expect(returned.currentScore).toBe(250);
      expect(transactionService.getTeamScores()[0]).toEqual(
        expect.objectContaining({ teamId: 'Late Team', currentScore: 250 })
      );
    });
  });

  describe('restart restore needs no sync call', () => {
    it('a restored session is immediately scoreable and readable', async () => {
      // Simulate what sessionService.init() does after a restart: hydrate the
      // persisted JSON. No transactionService.restoreFromSession() exists.
      const persisted = {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Mid-game restart',
        startTime: new Date().toISOString(),
        status: 'active',
        scores: [
          { ...TeamScore.createInitial('Team Alpha').toJSON(), currentScore: 700, baseScore: 700, tokensScanned: 3 },
        ],
        transactions: [],
        metadata: { gmStations: 0, playerDevices: 0, totalScans: 3, uniqueTokensScanned: [] },
      };

      sessionService.currentSession = Session.fromJSON(persisted);

      // Reads see the restored scores
      const scores = transactionService.getTeamScores();
      expect(scores[0]).toEqual(
        expect.objectContaining({ teamId: 'Team Alpha', currentScore: 700, tokensScanned: 3 })
      );

      // Writes work on the restored instances
      transactionService.adjustTeamScore('Team Alpha', -200, 'restore check', 'gm-1');
      expect(sessionService.getCurrentSession().scores[0].currentScore).toBe(500);
    });
  });

  describe('rebuild after transaction deletion operates on session.scores', () => {
    it('deleteTransaction recalculates the canonical entries in place', async () => {
      await sessionService.createSession({ name: 'Test', teams: ['Team Alpha'] });
      await sessionService.startGame();
      transactionService.tokens.set('tok1', makeToken('tok1', 100));
      transactionService.tokens.set('tok2', makeToken('tok2', 250));

      const r1 = await transactionService.processScan({
        tokenId: 'tok1', teamId: 'Team Alpha', deviceId: 'GM_TEST', deviceType: 'gm', mode: 'blackmarket',
      });
      await transactionService.processScan({
        tokenId: 'tok2', teamId: 'Team Alpha', deviceId: 'GM_TEST', deviceType: 'gm', mode: 'blackmarket',
      });

      const session = sessionService.getCurrentSession();
      expect(session.scores[0].currentScore).toBe(350);

      transactionService.deleteTransaction(r1.transactionId, session);

      const entry = session.scores.find(s => s.teamId === 'Team Alpha');
      expect(entry).toBeInstanceOf(TeamScore);
      expect(entry.currentScore).toBe(250);
      expect(entry.tokensScanned).toBe(1);
    });

    it('rebuild preserves admin adjustments on the canonical entries', async () => {
      await sessionService.createSession({ name: 'Test', teams: ['Team Alpha'] });
      await sessionService.startGame();
      transactionService.tokens.set('tok1', makeToken('tok1', 100));
      transactionService.tokens.set('tok2', makeToken('tok2', 250));

      const r1 = await transactionService.processScan({
        tokenId: 'tok1', teamId: 'Team Alpha', deviceId: 'GM_TEST', deviceType: 'gm', mode: 'blackmarket',
      });
      await transactionService.processScan({
        tokenId: 'tok2', teamId: 'Team Alpha', deviceId: 'GM_TEST', deviceType: 'gm', mode: 'blackmarket',
      });
      transactionService.adjustTeamScore('Team Alpha', 1000, 'bonus', 'gm-1');

      const session = sessionService.getCurrentSession();
      expect(session.scores[0].currentScore).toBe(1350);

      transactionService.deleteTransaction(r1.transactionId, session);

      const entry = session.scores.find(s => s.teamId === 'Team Alpha');
      expect(entry.currentScore).toBe(1250); // 250 token + 1000 adjustment
      expect(entry.adminAdjustments).toHaveLength(1);
    });
  });
});
