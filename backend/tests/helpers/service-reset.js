/**
 * Test Helper Utility: Service Reset
 *
 * Centralizes service state cleanup for test isolation.
 * Production services are unaware of testing needs - this helper
 * provides clean separation between production and test code.
 *
 * Anti-Pattern Prevention: Removes test-only methods from production services.
 */

const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const videoQueueService = require('../../src/services/videoQueueService');

/**
 * Resets all services that have internal reset methods.
 * Used in test beforeEach() hooks to ensure clean state between tests.
 *
 * @returns {Promise<void>}
 */
async function resetAllServices() {
  // Reset services that have reset methods
  if (typeof sessionService.reset === 'function') {
    await sessionService.reset();
  }
  if (typeof transactionService.reset === 'function') {
    await transactionService.reset();
  }
  if (typeof videoQueueService.reset === 'function') {
    videoQueueService.reset();
  }
}

module.exports = {
  resetAllServices
};
