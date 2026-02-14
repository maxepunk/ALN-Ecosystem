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
 */
function setupCueEngineForwarding({
  listenerRegistry,
  transactionService,
  sessionService,
  videoQueueService,
  gameClockService,
  cueEngineService,
  soundService
}) {
  // Game clock tick → cue engine clock trigger evaluation
  listenerRegistry.addTrackedListener(gameClockService, 'gameclock:tick', (data) => {
    cueEngineService.handleClockTick(data.elapsed);
  }, 'gameClockService->cueEngineService');

  // Transaction events
  listenerRegistry.addTrackedListener(transactionService, 'transaction:accepted', (payload) => {
    cueEngineService.handleGameEvent('transaction:accepted', payload);
  }, 'transactionService->cueEngineService');

  listenerRegistry.addTrackedListener(transactionService, 'group:completed', (data) => {
    cueEngineService.handleGameEvent('group:completed', data);
  }, 'transactionService->cueEngineService');

  // Video events
  listenerRegistry.addTrackedListener(videoQueueService, 'video:loading', (data) => {
    cueEngineService.handleGameEvent('video:loading', data);
  }, 'videoQueueService->cueEngineService');

  listenerRegistry.addTrackedListener(videoQueueService, 'video:started', (data) => {
    cueEngineService.handleGameEvent('video:started', data);
  }, 'videoQueueService->cueEngineService');

  listenerRegistry.addTrackedListener(videoQueueService, 'video:completed', (data) => {
    cueEngineService.handleGameEvent('video:completed', data);
  }, 'videoQueueService->cueEngineService');

  listenerRegistry.addTrackedListener(videoQueueService, 'video:paused', (data) => {
    cueEngineService.handleGameEvent('video:paused', data);
  }, 'videoQueueService->cueEngineService');

  listenerRegistry.addTrackedListener(videoQueueService, 'video:resumed', (data) => {
    cueEngineService.handleGameEvent('video:resumed', data);
  }, 'videoQueueService->cueEngineService');

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

  logger.debug('Cue engine event forwarding registered');
}

module.exports = { setupCueEngineForwarding };
