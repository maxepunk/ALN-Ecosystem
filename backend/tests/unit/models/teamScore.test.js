const TeamScore = require('../../../src/models/teamScore');

describe('TeamScore', () => {
  describe('constructor', () => {
    test('creates with default values', () => {
      const score = new TeamScore({ teamId: 'team1' });
      expect(score.teamId).toBe('team1');
      expect(score.currentScore).toBe(0);
      expect(score.baseScore).toBe(0);
      expect(score.tokensScanned).toBe(0);
      expect(score.bonusPoints).toBe(0);
      expect(score.completedGroups).toEqual([]);
    });

    test('creates from existing data', () => {
      const score = new TeamScore({ teamId: 'team1', currentScore: 100, bonusPoints: 20 });
      expect(score.currentScore).toBe(100);
      expect(score.bonusPoints).toBe(20);
    });
  });

  describe('scoring operations', () => {
    let score;
    beforeEach(() => { score = new TeamScore({ teamId: 'team1' }); });

    test('addPoints increments baseScore and currentScore', () => {
      score.addPoints(50000);
      expect(score.baseScore).toBe(50000);
      expect(score.currentScore).toBe(50000);
    });

    test('addBonus increments bonusPoints and currentScore', () => {
      score.addPoints(10000);
      score.addBonus(5000);
      expect(score.bonusPoints).toBe(5000);
      expect(score.currentScore).toBe(15000);
    });

    test('adjustScore modifies both currentScore and baseScore', () => {
      score.addPoints(100);
      score.adjustScore(-30, 'gm-001', 'Penalty');
      expect(score.currentScore).toBe(70);
      expect(score.baseScore).toBe(70);
      expect(score.adminAdjustments).toHaveLength(1);
      expect(score.adminAdjustments[0].delta).toBe(-30);
    });

    test('incrementTokensScanned tracks count', () => {
      score.incrementTokensScanned();
      score.incrementTokensScanned();
      expect(score.tokensScanned).toBe(2);
    });

    test('getBaseScore returns currentScore minus bonusPoints', () => {
      score.addPoints(100);
      score.addBonus(30);
      expect(score.getBaseScore()).toBe(100);
    });

    test('getAveragePointsPerToken returns 0 for no tokens', () => {
      expect(score.getAveragePointsPerToken()).toBe(0);
    });

    test('getAveragePointsPerToken computes correctly', () => {
      score.addPoints(300);
      score.tokensScanned = 3;
      expect(score.getAveragePointsPerToken()).toBe(100);
    });
  });

  describe('group completion', () => {
    let score;
    beforeEach(() => { score = new TeamScore({ teamId: 'team1' }); });

    test('completeGroup returns true for new group', () => {
      expect(score.completeGroup('Server Logs')).toBe(true);
      expect(score.completedGroups).toContain('Server Logs');
    });

    test('completeGroup returns false for already completed group', () => {
      score.completeGroup('Server Logs');
      expect(score.completeGroup('Server Logs')).toBe(false);
    });

    test('hasCompletedGroup checks membership', () => {
      score.completeGroup('Server Logs');
      expect(score.hasCompletedGroup('Server Logs')).toBe(true);
      expect(score.hasCompletedGroup('Chat Logs')).toBe(false);
    });
  });

  describe('comparison', () => {
    test('compare returns positive when this > other', () => {
      const a = new TeamScore({ teamId: 'a', currentScore: 100 });
      const b = new TeamScore({ teamId: 'b', currentScore: 50 });
      expect(a.compare(b)).toBe(50);
    });

    test('isWinning returns true when ahead', () => {
      const a = new TeamScore({ teamId: 'a', currentScore: 100 });
      const b = new TeamScore({ teamId: 'b', currentScore: 50 });
      expect(a.isWinning(b)).toBe(true);
    });
  });

  describe('reset', () => {
    test('resets all values to zero', () => {
      const score = new TeamScore({ teamId: 'team1', currentScore: 100, tokensScanned: 5 });
      score.completeGroup('group1');
      score.reset();
      expect(score.currentScore).toBe(0);
      expect(score.tokensScanned).toBe(0);
      expect(score.completedGroups).toEqual([]);
    });
  });

  describe('serialization', () => {
    test('toJSON round-trips via fromJSON', () => {
      const original = new TeamScore({ teamId: 'team1' });
      original.addPoints(50000);
      original.completeGroup('Server Logs');
      const json = original.toJSON();
      const restored = TeamScore.fromJSON(json);
      expect(restored.currentScore).toBe(50000);
      expect(restored.completedGroups).toContain('Server Logs');
    });

    test('createInitial sets all zeros', () => {
      const score = TeamScore.createInitial('team1');
      expect(score.teamId).toBe('team1');
      expect(score.currentScore).toBe(0);
    });
  });
});
