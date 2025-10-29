/**
 * Service Event Communication Integration Tests
 * Tests inter-service event-based communication per asyncapi.yaml
 */

const { resetAllServices } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const stateService = require('../../src/services/stateService');

describe('Service Event Communication', () => {
  beforeEach(async () => {
    // Reset all services to clean state
    await resetAllServices();await stateService.reset();

    // Ensure listener is registered after reset
    if (!transactionService.sessionListenerRegistered) {
      transactionService.registerSessionListener();
      transactionService.sessionListenerRegistered = true;
    }
  });

  afterEach(async () => {
    // Cleanup
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
    transactionService.removeAllListeners();
    stateService.removeAllListeners();
  });

  describe('transactionService listens to session domain events', () => {
    it('should reset scores when session ends', async () => {
      // Setup: Create session
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002']
      });

      // Manually create some team scores
      const TeamScore = require('../../src/models/teamScore');
      transactionService.teamScores.set('001', TeamScore.createInitial('001'));
      transactionService.teamScores.set('002', TeamScore.createInitial('002'));

      // Add points
      transactionService.teamScores.get('001').currentScore = 100;
      transactionService.teamScores.get('002').currentScore = 50;

      // Verify scores exist
      const scoresBefore = transactionService.getTeamScores();
      expect(scoresBefore.find(s => s.teamId === '001').currentScore).toBe(100);
      expect(scoresBefore.find(s => s.teamId === '002').currentScore).toBe(50);

      // Trigger: End session (emits session:updated with status='ended')
      await sessionService.endSession();

      // Give event time to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify: Scores should be reset (Map cleared)
      const scoresAfter = transactionService.getTeamScores();
      expect(scoresAfter.length).toBe(0);
    });

    it('should initialize team scores when session created', async () => {
      // Verify scores are empty initially
      const scoresBefore = transactionService.getTeamScores();
      expect(scoresBefore.length).toBe(0);

      // Create session with teams (should trigger score initialization)
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['001', '002', '003']
      });

      // Give event time to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify: Scores initialized for all teams
      const scoresAfter = transactionService.getTeamScores();
      expect(scoresAfter.length).toBe(3);
      expect(scoresAfter.find(s => s.teamId === '001')).toBeDefined();
      expect(scoresAfter.find(s => s.teamId === '002')).toBeDefined();
      expect(scoresAfter.find(s => s.teamId === '003')).toBeDefined();
    });
  });
});
