const { EventEmitter } = require('events');

/**
 * Create a mock transactionService matching the real service's public API.
 * Returns an EventEmitter with jest.fn() stubs for all public methods.
 *
 * IMPORTANT: Method names must match backend/src/services/transactionService.js exactly.
 * If the real service API changes, update this factory.
 *
 * @param {Object} overrides - Override any default mock return values
 * @returns {EventEmitter} Mock transactionService
 */
function createMockTransactionService(overrides = {}) {
  const mock = new EventEmitter();

  // Exposed state (used by tests and other services)
  mock.tokens = new Map();
  mock.teamScores = new Map();
  mock.recentTransactions = [];

  // Initialization
  mock.init = jest.fn().mockResolvedValue(undefined);
  mock.registerSessionListener = jest.fn();

  // Scan processing
  mock.processScan = jest.fn().mockResolvedValue({
    status: 'accepted', transactionId: 'tx-mock', points: 100,
  });
  mock.createManualTransaction = jest.fn().mockResolvedValue({
    status: 'accepted', transactionId: 'tx-manual-mock', points: 100,
  });

  // Token operations
  mock.loadTokens = jest.fn();
  mock.getToken = jest.fn().mockReturnValue(null);
  mock.getAllTokens = jest.fn().mockReturnValue([]);

  // Score operations
  mock.getTeamScores = jest.fn().mockReturnValue([]);
  mock.adjustTeamScore = jest.fn();
  mock.resetScores = jest.fn();
  mock.getRecentTransactions = jest.fn().mockReturnValue([]);

  // Team sync
  mock.syncTeamFromSession = jest.fn();
  mock.restoreFromSession = jest.fn();

  // Transaction management
  mock.deleteTransaction = jest.fn().mockReturnValue({
    deletedTransaction: {}, updatedScore: {},
  });

  // Lifecycle
  mock.reset = jest.fn();

  // Apply overrides
  Object.assign(mock, overrides);

  return mock;
}

module.exports = { createMockTransactionService };
