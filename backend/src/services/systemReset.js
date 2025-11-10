/**
 * System Reset Orchestration
 *
 * Provides coordinated system reset functionality used by both:
 * - Production: system:reset admin command
 * - Tests: resetAllServicesForTesting helper
 *
 * Architecture:
 * 1. Archive session (preserve history)
 * 2. End current session lifecycle
 * 3. Cleanup infrastructure listeners
 * 4. Reset all service state
 * 5. Re-initialize infrastructure
 *
 * This ensures consistent reset behavior across production and test environments.
 */

const logger = require('../utils/logger');
const persistenceService = require('./persistenceService');
const listenerRegistry = require('../websocket/listenerRegistry');
const { cleanupBroadcastListeners, setupBroadcastListeners } = require('../websocket/broadcasts');

/**
 * Perform complete system reset
 *
 * @param {Server} io - Socket.io server instance
 * @param {Object} services - Service instances
 * @param {Object} services.sessionService - Session management service
 * @param {Object} services.stateService - State aggregation service
 * @param {Object} services.transactionService - Transaction processing service
 * @param {Object} services.videoQueueService - Video queue management service
 * @param {Object} services.offlineQueueService - Offline queue management service
 * @returns {Promise<void>}
 */
async function performSystemReset(io, services) {
  const {
    sessionService,
    stateService,
    transactionService,
    videoQueueService,
    offlineQueueService
  } = services;

  logger.info('Starting system reset');

  // Step 1: Archive ended session (preserve game history)
  const currentSession = sessionService.getCurrentSession();
  if (currentSession) {
    if (currentSession.status === 'ended') {
      await persistenceService.archiveSession(currentSession.toJSON());
      logger.info('Ended session archived before system reset', {
        sessionId: currentSession.id
      });
    } else {
      logger.warn('Active session being reset', {
        sessionId: currentSession.id,
        status: currentSession.status
      });
    }
  }

  // Step 2: End current session lifecycle
  await sessionService.endSession();
  logger.debug('Session ended during system reset');

  // Step 3: Cleanup infrastructure listeners
  // Order matters: cleanup BEFORE service reset to prevent stale references
  cleanupBroadcastListeners();
  listenerRegistry.cleanup();
  logger.debug('Infrastructure listeners cleaned up');

  // Step 4: Reset all service state
  // Services will call removeAllListeners() to clear their observer lists
  await sessionService.reset();
  await stateService.reset();
  transactionService.reset();
  videoQueueService.clearQueue();
  await offlineQueueService.reset();
  logger.debug('All services reset');

  // Step 5: Re-initialize infrastructure
  // Broadcast listeners must be re-registered after service reset
  setupBroadcastListeners(io, {
    sessionService,
    stateService,
    videoQueueService,
    offlineQueueService,
    transactionService
  });
  logger.debug('Broadcast listeners re-initialized');

  // Re-initialize cross-service listeners
  // Services need to re-register listeners on sessionService (cleared by reset)
  stateService.setupTransactionListeners();
  transactionService.registerSessionListener();
  logger.debug('Cross-service listeners re-initialized');

  logger.info('System reset complete - ready for new session');
}

module.exports = {
  performSystemReset
};
