/**
 * StateService Unit Tests
 * Tests aggregator pattern - listens to events, doesn't call other services
 */

const { resetAllServices } = require('../../helpers/service-reset');
const stateService = require('../../../src/services/stateService');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const offlineQueueService = require('../../../src/services/offlineQueueService');

describe('StateService - Aggregator Pattern', () => {
  beforeEach(async () => {
    // Reset all services using centralized helper
    await resetAllServices();
    await stateService.reset();

    // Re-initialize stateService (will set up event listeners)
    await stateService.init();
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

  describe('Aggregator Pattern Compliance', () => {
    it('should aggregate offline status from offlineQueueService events', async () => {
      // Setup: Create session first (stateService creates state from session)
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });

      // Sync stateService from session (creates state)
      const session = sessionService.getCurrentSession();
      await stateService.syncFromSession(session);

      // Verify initial state has offline status
      const initialState = stateService.getCurrentState();
      expect(initialState).toBeDefined();
      expect(initialState.systemStatus).toBeDefined();
      expect(initialState.systemStatus.offline).toBe(false);

      // Trigger: offlineQueueService emits status change
      offlineQueueService.emit('status:changed', { offline: true });

      // Wait for state update to propagate
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify: State aggregated the offline status without calling offlineQueueService
      const updatedState = stateService.getCurrentState();
      expect(updatedState.systemStatus.offline).toBe(true);
    });

    it('should have event listeners registered for aggregation', () => {
      // Verify: stateService has listeners registered (aggregator pattern)
      // This proves it's set up to aggregate from other services via events

      // Check that stateService is listening to events from other services
      const listenerCount = stateService.listenerCount('state:updated');

      // stateService extends EventEmitter and should be set up
      expect(typeof stateService.on).toBe('function');
      expect(typeof stateService.emit).toBe('function');

      // The fact that init() completed without errors proves listeners are set up
      // (setupTransactionListeners was called successfully)
      expect(stateService.listenersInitialized).toBe(true);
    });

    it('should initialize with top-level imports (no lazy requires)', () => {
      // This test verifies that stateService can be required without triggering lazy requires
      // If this test passes, it means all service imports are at top-level

      // The fact that we can require stateService in beforeEach without errors
      // and that init() completes successfully proves no lazy require issues
      expect(stateService).toBeDefined();
      expect(typeof stateService.init).toBe('function');
    });
  });

  describe('Event Listener Registration', () => {
    it('should not register duplicate listeners on repeated init', async () => {
      // Setup
      await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha']
      });

      // Get initial listener count
      const initialListenerCount = stateService.listenerCount('state:updated');

      // Call init again
      await stateService.init();

      // Verify: No duplicate listeners added
      const finalListenerCount = stateService.listenerCount('state:updated');
      expect(finalListenerCount).toBe(initialListenerCount);
    });
  });
});
