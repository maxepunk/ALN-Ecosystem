const { EventEmitter } = require('events');

/**
 * Create a mock sessionService matching the real service's public API.
 * Returns an EventEmitter with jest.fn() stubs for all public methods.
 *
 * IMPORTANT: Method names must match backend/src/services/sessionService.js exactly.
 * If the real service API changes, update this factory.
 *
 * @param {Object} overrides - Override any default mock return values
 * @returns {EventEmitter} Mock sessionService
 */
function createMockSessionService(overrides = {}) {
  const mock = new EventEmitter();

  // State initialization
  mock.initState = jest.fn();

  // Session lifecycle
  mock.getCurrentSession = jest.fn().mockReturnValue(null);
  mock.createSession = jest.fn().mockResolvedValue({
    id: 'test-session', name: 'Test', status: 'setup', teams: [], scores: [],
  });
  mock.startGame = jest.fn().mockResolvedValue(undefined);
  mock.getSession = jest.fn().mockResolvedValue(null);
  mock.updateSession = jest.fn().mockResolvedValue(undefined);
  mock.endSession = jest.fn().mockResolvedValue(undefined);
  mock.archiveOldSessions = jest.fn().mockResolvedValue(0);
  mock.getAllSessions = jest.fn().mockResolvedValue([]);
  mock.getActiveSessions = jest.fn().mockResolvedValue([]);

  // Session status
  mock.canAcceptGmStation = jest.fn().mockReturnValue(true);

  // Team management
  mock.addTeamToSession = jest.fn().mockResolvedValue(undefined);
  mock.initializeTeamScores = jest.fn().mockReturnValue([]);

  // Data operations
  mock.addTransaction = jest.fn().mockResolvedValue(undefined);
  mock.addPlayerScan = jest.fn().mockResolvedValue(undefined);
  mock.updateDevice = jest.fn().mockResolvedValue(undefined);
  mock.removeDevice = jest.fn().mockResolvedValue(undefined);
  mock.saveCurrentSession = jest.fn().mockResolvedValue(undefined);

  // Listener registration
  mock.setupScoreListeners = jest.fn();
  mock.setupPersistenceListeners = jest.fn();
  mock.setupGameClockListeners = jest.fn();

  // Lifecycle
  mock.init = jest.fn().mockResolvedValue(undefined);
  mock.reset = jest.fn().mockResolvedValue(undefined);

  // Apply overrides
  Object.assign(mock, overrides);

  return mock;
}

module.exports = { createMockSessionService };
