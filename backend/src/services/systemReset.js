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
    offlineQueueService,
    displayControlService, // Optional (may be undefined in some contexts)
    vlcService,           // Optional
    bluetoothService,     // Optional (Phase 0 environment control)
    audioRoutingService,  // Optional (Phase 0 environment control)
    lightingService,      // Optional (Phase 0 environment control)
    gameClockService,     // Optional (Phase 1)
    cueEngineService,     // Optional (Phase 1)
    soundService,         // Optional (Phase 1)
    spotifyService        // Optional (Phase 2)
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
  videoQueueService.reset();
  await offlineQueueService.reset();

  if (displayControlService) {
    displayControlService.reset();
  }

  // Reset environment control services (Phase 0)
  if (bluetoothService) {
    bluetoothService.reset();
  }
  if (audioRoutingService) {
    audioRoutingService.reset();
  }
  if (lightingService) {
    lightingService.reset();
  }

  // Reset Phase 1 services
  if (gameClockService) {
    gameClockService.reset();
  }
  if (cueEngineService) {
    cueEngineService.reset();
  }
  if (soundService) {
    soundService.reset();
  }

  // Reset Phase 2 services
  if (spotifyService) {
    spotifyService.reset();
  }

  logger.debug('All services reset');

  // Step 5: Re-initialize infrastructure
  // Broadcast listeners must be re-registered after service reset
  setupBroadcastListeners(io, {
    sessionService,
    stateService,
    videoQueueService,
    offlineQueueService,
    transactionService,
    bluetoothService,
    audioRoutingService,
    lightingService,
    gameClockService,
    cueEngineService,
    soundService,
    spotifyService,
  });
  logger.debug('Broadcast listeners re-initialized');

  // Re-initialize display control service (needs to re-attach listeners)
  if (displayControlService && vlcService) {
    displayControlService.init({
      vlcService,
      videoQueueService
    });
    logger.debug('Display control service re-initialized');
  }

  // Re-initialize cross-service listeners
  // Services need to re-register listeners on sessionService (cleared by reset)
  stateService.setupTransactionListeners();
  transactionService.registerSessionListener();

  // Slice 2: Re-register sessionService persistence listeners
  // These listeners are ON transactionService and were cleared by transactionService.reset()
  // They handle transaction:accepted → persist → emit transaction:added → broadcast transaction:new
  sessionService.setupPersistenceListeners();

  // Phase 1: Re-register cue engine event forwarding
  // These listeners forward game events (transaction:accepted, group:completed, etc.) to cueEngineService
  // They were registered in app.js during startup and cleared by listenerRegistry.cleanup()
  if (cueEngineService && gameClockService) {
    const { setupCueEngineForwarding } = require('./cueEngineWiring');
    setupCueEngineForwarding({
      listenerRegistry,
      transactionService,
      sessionService,
      videoQueueService,
      gameClockService,
      cueEngineService,
      soundService,
      spotifyService
    });
  }

  // Re-load ducking rules from routing config (cleared by audioRoutingService.reset())
  if (audioRoutingService) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const routingPath = path.join(__dirname, '../../config/environment/routing.json');
      const routingData = await fs.readFile(routingPath, 'utf8');
      const routingConfig = JSON.parse(routingData);
      if (routingConfig.ducking && Array.isArray(routingConfig.ducking)) {
        audioRoutingService.loadDuckingRules(routingConfig.ducking);
        logger.debug('Ducking rules re-loaded after system reset', { count: routingConfig.ducking.length });
      }
    } catch (err) {
      logger.warn('Failed to re-load ducking rules after system reset', { error: err.message });
    }
  }

  logger.debug('Cross-service listeners re-initialized');

  logger.info('System reset complete - ready for new session');
}

module.exports = {
  performSystemReset
};
