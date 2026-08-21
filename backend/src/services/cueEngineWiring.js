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
 * @param {Object} [deps.musicService]   - Music service (optional)
 */
function setupCueEngineForwarding({
  listenerRegistry,
  transactionService,
  sessionService,
  videoQueueService,
  gameClockService,
  cueEngineService,
  soundService,
  musicService
}) {
  // A3 slice 5: every standing-cue trigger event is ALSO a potential
  // phase-start trigger — the activation gate validates gameClock.phases
  // start.trigger against the SAME EVENT_NORMALIZERS vocabulary, so one
  // dispatcher keeps the two consumers from drifting. Phase advance runs
  // FIRST: a cue evaluated for this event that also fires on phase:changed
  // sees the phase context already updated. phase:changed itself is
  // cue-only (a phase cannot start on phase machinery's own event —
  // gate-refused).
  const forwardGameEvent = (eventName, payload) => {
    gameClockService.handlePhaseTrigger(eventName);
    cueEngineService.handleGameEvent(eventName, payload);
  };

  // Game clock tick → cue engine clock trigger evaluation + compound cue advancement
  listenerRegistry.addTrackedListener(gameClockService, 'gameclock:tick', (data) => {
    cueEngineService.handleClockTick(data.elapsed);
    cueEngineService._tickActiveCompoundCues(data.elapsed); // Advance clock-driven compound cues
  }, 'gameClockService->cueEngineService');

  // Phase transitions → standing cue trigger event (A3 slice 5 / B11:
  // "phase:changed becomes a cue trigger event")
  listenerRegistry.addTrackedListener(gameClockService, 'phase:changed', (data) => {
    cueEngineService.handleGameEvent('phase:changed', data);
  }, 'gameClockService->phase:changed->cueEngineService');

  // Transaction events
  listenerRegistry.addTrackedListener(transactionService, 'transaction:accepted', (payload) => {
    forwardGameEvent('transaction:accepted', payload);
  }, 'transactionService->cueEngineService');

  listenerRegistry.addTrackedListener(transactionService, 'group:completed', (data) => {
    forwardGameEvent('group:completed', data);
  }, 'transactionService->cueEngineService');

  // Pre-play hook: fire video:loading cues BEFORE video starts (blocking)
  // video:loading is NOT in the EventEmitter forwarding list below — it's handled via hook
  videoQueueService.registerPrePlayHook(data => {
    gameClockService.handlePhaseTrigger('video:loading');
    return cueEngineService.fireEventCuesAndWait('video:loading', data);
  });

  // Video events (for standing cue evaluation)
  // video:paused and video:resumed ALSO route to the explicit lifecycle
  // registrations below (compound-cue timeline control) — standing-cue
  // evaluation and timeline control are independent consumers (F-TOOL-09/E6)
  for (const event of ['video:started', 'video:completed', 'video:paused', 'video:resumed']) {
    listenerRegistry.addTrackedListener(videoQueueService, event, (data) => {
      forwardGameEvent(event, data);
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
    forwardGameEvent('session:created', { sessionId: session.id });
  }, 'sessionService->cueEngineService');

  listenerRegistry.addTrackedListener(sessionService, 'player-scan:added', (data) => {
    forwardGameEvent('player:scan', data);
  }, 'sessionService->cueEngineService');

  // Sound events (for cue chaining)
  if (soundService) {
    listenerRegistry.addTrackedListener(soundService, 'sound:completed', (data) => {
      forwardGameEvent('sound:completed', data);
    }, 'soundService->cueEngineService');
  }

  // Cue events (for cue chaining)
  listenerRegistry.addTrackedListener(cueEngineService, 'cue:completed', (data) => {
    forwardGameEvent('cue:completed', data);
  }, 'cueEngineService->cueEngineService');

  // Game clock events
  listenerRegistry.addTrackedListener(gameClockService, 'gameclock:started', (data) => {
    forwardGameEvent('gameclock:started', data);
  }, 'gameClockService->cueEngineService');

  // Music events — enables standing cues that trigger on music state/track/playlist changes
  if (musicService) {
    for (const ev of ['track:changed', 'playback:changed', 'playlist:changed']) {
      listenerRegistry.addTrackedListener(musicService, ev, (data) => {
        forwardGameEvent(`music:${ev}`, data);
      }, `musicService->${ev}->cueEngineService`);
    }
  }

  logger.info('Cue engine event forwarding registered');
}

module.exports = { setupCueEngineForwarding };
