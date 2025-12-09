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
        teams: ['Team Alpha', 'Detectives']
      });

      // Manually create some team scores
      const TeamScore = require('../../src/models/teamScore');
      transactionService.teamScores.set('Team Alpha', TeamScore.createInitial('Team Alpha'));
      transactionService.teamScores.set('Detectives', TeamScore.createInitial('Detectives'));

      // Add points
      transactionService.teamScores.get('Team Alpha').currentScore = 100;
      transactionService.teamScores.get('Detectives').currentScore = 50;

      // Verify scores exist
      const scoresBefore = transactionService.getTeamScores();
      expect(scoresBefore.find(s => s.teamId === 'Team Alpha').currentScore).toBe(100);
      expect(scoresBefore.find(s => s.teamId === 'Detectives').currentScore).toBe(50);

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
        teams: ['Team Alpha', 'Detectives', 'Blue Squad']
      });

      // Give event time to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify: Scores initialized for all teams
      const scoresAfter = transactionService.getTeamScores();
      expect(scoresAfter.length).toBe(3);
      expect(scoresAfter.find(s => s.teamId === 'Team Alpha')).toBeDefined();
      expect(scoresAfter.find(s => s.teamId === 'Detectives')).toBeDefined();
      expect(scoresAfter.find(s => s.teamId === 'Blue Squad')).toBeDefined();
    });
  });
});
