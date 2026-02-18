/**
 * Cue Engine Event Forwarding
 *
 * Wires game events from various services to cueEngineService.handleGameEvent().
 * Used by both app.js (startup) and systemReset.js (re-initialization after reset).
 */

'use strict';

const logger = require('../utils/logger');

/**
 * Register event forwarding from game services to cue engine.
 *
 * @param {Object} deps
 * @param {Object} deps.listenerRegistry - Listener registry for tracking
 * @param {Object} deps.transactionService - Transaction service
 * @param {Object} deps.sessionService - Session service
 * @param {Object} deps.videoQueueService - Video queue service
 * @param {Object} deps.gameClockService - Game clock service
 * @param {Object} deps.cueEngineService - Cue engine service
 * @param {Object} [deps.soundService] - Sound service (optional)
 * @param {Object} [deps.spotifyService] - Spotify service (optional, Phase 2)
 */
function setupCueEngineForwarding({
  listenerRegistry,
  transactionService,
  sessionService,
  videoQueueService,
  gameClockService,
  cueEngineService,
  soundService,
  spotifyService
}) {
  // Game clock tick → cue engine clock trigger evaluation + compound cue advancement
  listenerRegistry.addTrackedListener(gameClockService, 'gameclock:tick', (data) => {
    cueEngineService.handleClockTick(data.elapsed);
    cueEngineService._tickActiveCompoundCues(data.elapsed); // Advance clock-driven compound cues
  }, 'gameClockService->cueEngineService');

  // Transaction events
  listenerRegistry.addTrackedListener(transactionService, 'transaction:accepted', (payload) => {
    cueEngineService.handleGameEvent('transaction:accepted', payload);
  }, 'transactionService->cueEngineService');

  listenerRegistry.addTrackedListener(transactionService, 'group:completed', (data) => {
    cueEngineService.handleGameEvent('group:completed', data);
  }, 'transactionService->cueEngineService');

  // Video events (for standing cue evaluation)
  for (const event of ['video:loading', 'video:started', 'video:completed', 'video:paused', 'video:resumed']) {
    listenerRegistry.addTrackedListener(videoQueueService, event, (data) => {
      cueEngineService.handleGameEvent(event, data);
    }, `videoQueueService->${event}->cueEngineService`);
  }

  // Video progress → compound cue timeline advancement
  listenerRegistry.addTrackedListener(
    videoQueueService, 'video:progress',
    (data) => {
      cueEngineService.handleVideoProgressEvent(data);
    },
    'videoQueue->video:progress->cueEngine'
  );

  // Video lifecycle events → compound cue timeline control
  listenerRegistry.addTrackedListener(
    videoQueueService, 'video:paused',
    (data) => cueEngineService.handleVideoLifecycleEvent('paused', data),
    'videoQueue->video:paused->cueEngine:lifecycle'
  );

  listenerRegistry.addTrackedListener(
    videoQueueService, 'video:resumed',
    (data) => cueEngineService.handleVideoLifecycleEvent('resumed', data),
    'videoQueue->video:resumed->cueEngine:lifecycle'
  );

  listenerRegistry.addTrackedListener(
    videoQueueService, 'video:completed',
    (data) => cueEngineService.handleVideoLifecycleEvent('completed', data),
    'videoQueue->video:completed->cueEngine:lifecycle'
  );

  // Session events
  listenerRegistry.addTrackedListener(sessionService, 'session:created', (session) => {
    cueEngineService.handleGameEvent('session:created', { sessionId: session.id });
  }, 'sessionService->cueEngineService');

  listenerRegistry.addTrackedListener(sessionService, 'player-scan:added', (data) => {
    cueEngineService.handleGameEvent('player:scan', data);
  }, 'sessionService->cueEngineService');

  // Sound events (for cue chaining)
  if (soundService) {
    listenerRegistry.addTrackedListener(soundService, 'sound:completed', (data) => {
      cueEngineService.handleGameEvent('sound:completed', data);
    }, 'soundService->cueEngineService');
  }

  // Cue events (for cue chaining)
  listenerRegistry.addTrackedListener(cueEngineService, 'cue:completed', (data) => {
    cueEngineService.handleGameEvent('cue:completed', data);
  }, 'cueEngineService->cueEngineService');

  // Game clock events
  listenerRegistry.addTrackedListener(gameClockService, 'gameclock:started', (data) => {
    cueEngineService.handleGameEvent('gameclock:started', data);
  }, 'gameClockService->cueEngineService');

  // Spotify events (Phase 2) — enables standing cues that trigger on track changes
  if (spotifyService) {
    listenerRegistry.addTrackedListener(spotifyService, 'track:changed', (data) => {
      cueEngineService.handleGameEvent('spotify:track:changed', data);
    }, 'spotifyService->cueEngineService');
  }

  logger.info('Cue engine event forwarding registered');
}

module.exports = { setupCueEngineForwarding };
