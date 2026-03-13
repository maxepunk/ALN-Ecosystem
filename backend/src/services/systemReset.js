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

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const persistenceService = require('./persistenceService');
const serviceHealthRegistry = require('./serviceHealthRegistry');
const listenerRegistry = require('../websocket/listenerRegistry');
const { cleanupBroadcastListeners, setupBroadcastListeners } = require('../websocket/broadcasts');

/**
 * Perform complete system reset
 *
 * @param {Server} io - Socket.io server instance
 * @param {Object} services - Service instances
 * @param {Object} services.sessionService - Session management service
 * @param {Object} services.transactionService - Transaction processing service
 * @param {Object} services.videoQueueService - Video queue management service
 * @param {Object} services.offlineQueueService - Offline queue management service
 * @returns {Promise<void>}
 */
async function performSystemReset(io, services) {
  const {
    sessionService,
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

  // Reset VLC state (preserves VLC process — reset() doesn't touch it)
  if (vlcService) {
    vlcService.reset();
  }

  // Reset Phase 2 services
  if (spotifyService) {
    spotifyService.reset();
  }

  // Reset health registry (clears stale health state from previous session)
  serviceHealthRegistry.reset();

  logger.debug('All services reset');

  // Step 5: Re-initialize infrastructure
  // Broadcast listeners must be re-registered after service reset
  setupBroadcastListeners(io, {
    sessionService,
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
    vlcService,
    displayControlService,
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

  // ── Centralized cross-service listener wiring ──
  // ALL cross-service listeners registered here, AFTER all services have been reset.
  // sessionService.reset() is tear-down only — it does NOT register these.
  // This prevents the ordering bug where transactionService.reset() destroys
  // listeners that were registered on it by sessionService.reset().
  transactionService.registerSessionListener();
  sessionService.setupScoreListeners();
  sessionService.setupPersistenceListeners();
  sessionService.setupGameClockListeners();

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

  // Step 6: Re-initialize service availability
  // serviceHealthRegistry.reset() cleared all health status. Re-probe services
  // so the registry reflects actual system state. Each wrapped in try/catch to
  // prevent one service failure from blocking others.

  // GameClock: in-process timer, always available (its own reset reports healthy
  // but serviceHealthRegistry.reset() wipes it immediately after)
  if (gameClockService) {
    serviceHealthRegistry.report('gameclock', 'healthy', 'In-process timer');
  }

  // Sound: re-probe pw-play availability
  if (soundService) {
    try { await soundService.checkHealth(); } catch (err) {
      logger.warn('Sound health re-probe failed after reset:', err.message);
    }
  }

  // Cue engine: reload definitions from config (also reports healthy when loaded)
  if (cueEngineService) {
    try {
      const cuesPath = path.join(__dirname, '../../config/environment/cues.json');
      const cuesData = JSON.parse(await fs.readFile(cuesPath, 'utf8'));
      const cuesArray = Array.isArray(cuesData) ? cuesData : cuesData.cues || [];
      cueEngineService.loadCues(cuesArray);
    } catch (err) {
      logger.warn('Failed to reload cues after system reset:', err.message);
    }
  }

  // Bluetooth: re-discover adapter, restart D-Bus device monitor
  if (bluetoothService) {
    try { await bluetoothService.init(); } catch (err) {
      logger.warn('Bluetooth re-init failed after reset:', err.message);
    }
  }

  // Audio: re-discover sinks, restart pactl monitor, load persisted routes
  if (audioRoutingService) {
    try { await audioRoutingService.init(); } catch (err) {
      logger.warn('Audio routing re-init failed after reset:', err.message);
    }
  }

  // Lighting: re-connect to HA, re-fetch scenes, restart WebSocket monitor
  if (lightingService) {
    try { await lightingService.init(); } catch (err) {
      logger.warn('Lighting re-init failed after reset:', err.message);
    }
  }

  // VLC: re-check connection and restart D-Bus monitor (stopped by reset)
  if (vlcService) {
    try { await vlcService.checkConnection(); } catch (err) {
      logger.debug('VLC health re-check failed after reset:', err.message);
    }
    vlcService.startPlaybackMonitor();
    // Re-resolve D-Bus owner for sender filtering (prevents cross-contamination with Spotify)
    vlcService._resolveOwner().catch(err => {
      logger.debug('VLC owner re-resolution failed after reset:', err.message);
    });
  }

  // Spotify: re-check connection and restart D-Bus monitor (stopped by reset)
  if (spotifyService) {
    if (typeof spotifyService.checkConnection === 'function') {
      try { await spotifyService.checkConnection(); } catch (err) {
        logger.debug('Spotify health re-check failed after reset:', err.message);
      }
    }
    if (typeof spotifyService.startPlaybackMonitor === 'function') {
      spotifyService.startPlaybackMonitor();
    }
    // Re-resolve D-Bus owner for sender filtering (prevents cross-contamination with VLC)
    if (typeof spotifyService._resolveOwner === 'function') {
      spotifyService._resolveOwner().catch(err => {
        logger.debug('Spotify owner re-resolution failed after reset:', err.message);
      });
    }
  }

  logger.debug('Service health re-initialized');

  logger.info('System reset complete - ready for new session');
}

module.exports = {
  performSystemReset
};
