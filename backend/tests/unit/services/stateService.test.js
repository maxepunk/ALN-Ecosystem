/**
 * StateService Unit Tests
 * Tests computed state view (getCurrentState) and reset behavior.
 *
 * NOTE: Event listener tests (setupTransactionListeners, state:updated emission,
 * debouncing, video state updates) were removed — those methods were dead code
 * with zero consumers and have been deleted from the service.
 */

const { resetAllServices } = require('../../helpers/service-reset');
const stateService = require('../../../src/services/stateService');
const sessionService = require('../../../src/services/sessionService');

describe('StateService - Computed State View', () => {
  beforeEach(async () => {
    await resetAllServices();
  });

  afterEach(async () => {
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
    stateService.removeAllListeners();
  });

  describe('getCurrentState()', () => {
    it('should return null when no session exists', () => {
      const state = stateService.getCurrentState();
      expect(state).toBeNull();
    });

    it('should return a GameState when a session exists', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });

      const state = stateService.getCurrentState();
      expect(state).toBeDefined();
      expect(state.systemStatus).toBeDefined();
      expect(state.systemStatus.offline).toBe(false);
    });

    it('should reflect cachedOfflineStatus in computed state', async () => {
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });

      stateService.cachedOfflineStatus = true;

      const state = stateService.getCurrentState();
      expect(state.systemStatus.offline).toBe(true);
    });
  });

  describe('reset()', () => {
    it('should clear cachedOfflineStatus on reset', async () => {
      stateService.cachedOfflineStatus = true;

      await stateService.reset();

      expect(stateService.cachedOfflineStatus).toBe(false);
    });

    it('should return null from getCurrentState after reset (no session)', async () => {
      await stateService.reset();

      const state = stateService.getCurrentState();
      expect(state).toBeNull();
    });
  });
});
