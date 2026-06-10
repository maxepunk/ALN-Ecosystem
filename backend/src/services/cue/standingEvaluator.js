'use strict';

/**
 * Standing Cue Evaluator
 *
 * Handles EVENT_NORMALIZERS registry, CONDITION_OPS, evaluateConditions,
 * parseClockTime, and the evaluate/trigger logic for event-triggered and
 * clock-triggered standing cues.
 *
 * This module is pure evaluation logic — it receives normalized contexts and
 * returns results. Persistence (toPersistence/restore) data shapes are defined
 * here since they are owned by the standing-cue half of the engine.
 *
 * Game-event normalizers (transaction:accepted vocabulary) live in
 * backend/src/gameRules/cueVocabulary.js per the split-seam proposal.
 */

const logger = require('../../utils/logger');
const { GAME_EVENT_NORMALIZERS } = require('../../gameRules/cueVocabulary');

/**
 * Engine-event normalizers.
 * Flattens engine-level events to flat fields for cue condition evaluation.
 * Game-event normalizers are merged in from cueVocabulary.js.
 *
 * @type {Object.<string, function(Object): Object>}
 */
const ENGINE_EVENT_NORMALIZERS = {
  'video:loading': (payload) => ({ tokenId: payload.tokenId }),
  'video:started': (payload) => ({ tokenId: payload.queueItem?.tokenId, duration: payload.duration }),
  'video:completed': (payload) => ({ tokenId: payload.queueItem?.tokenId }),
  'video:paused': (payload) => ({ tokenId: payload?.tokenId }),
  'video:resumed': (payload) => ({ tokenId: payload?.tokenId }),
  'player:scan': (payload) => ({ tokenId: payload.tokenId, deviceId: payload.deviceId, deviceType: payload.deviceType }),
  'session:created': (payload) => ({ sessionId: payload.sessionId }),
  'cue:completed': (payload) => ({ cueId: payload.cueId }),
  'sound:completed': (payload) => ({ file: payload.file }),
  // Music events — musicService emits these via cueEngineWiring
  'music:track:changed': (payload) => ({
    title: payload.track?.title ?? null,
    artist: payload.track?.artist ?? null,
    file: payload.track?.file ?? null,
  }),
  'music:playback:changed': (payload) => ({ state: payload.state }),
  'music:playlist:changed': (payload) => ({
    playlistId: payload.id,
    playlistName: payload.name,
    shuffle: payload.shuffle,
    loop: payload.loop,
  }),
  'gameclock:started': (payload) => ({ gameStartTime: payload.gameStartTime }),
};

/**
 * All event normalizers: engine events + game-rule events merged together.
 * The engine owns the full registry; game vocabulary is a pluggable table.
 * @type {Object.<string, function(Object): Object>}
 */
const EVENT_NORMALIZERS = { ...ENGINE_EVENT_NORMALIZERS, ...GAME_EVENT_NORMALIZERS };

/**
 * Supported condition operators for cue evaluation.
 * All operators return boolean.
 * @type {Object.<string, function(*, *): boolean>}
 */
const CONDITION_OPS = {
  eq:  (actual, expected) => actual === expected,
  neq: (actual, expected) => actual !== expected,
  gt:  (actual, expected) => actual > expected,
  gte: (actual, expected) => actual >= expected,
  lt:  (actual, expected) => actual < expected,
  lte: (actual, expected) => actual <= expected,
  in:  (actual, expected) => Array.isArray(expected) && expected.includes(actual),
};

/**
 * Parse "HH:MM:SS" clock string to total seconds.
 * @param {string} clockStr - Time string in "HH:MM:SS" format
 * @returns {number} Total seconds
 * @throws {Error} If format is invalid
 */
function parseClockTime(clockStr) {
  const parts = clockStr.split(':').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid clock time format: "${clockStr}" (expected HH:MM:SS)`);
  }
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Normalize an event payload using the registered normalizer.
 * Falls through to raw payload when no normalizer is defined.
 *
 * @param {string} eventName
 * @param {Object} payload
 * @returns {Object} Flat context for condition evaluation
 */
function normalizeEvent(eventName, payload) {
  const normalizer = EVENT_NORMALIZERS[eventName];
  return normalizer ? normalizer(payload) : payload;
}

/**
 * Evaluate conditions against a normalized context.
 * All conditions must match (implicit AND).
 *
 * @param {Array<{field: string, op: string, value: *}>} conditions
 * @param {Object} context - Flat key/value context
 * @returns {boolean}
 */
function evaluateConditions(conditions, context) {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every(({ field, op, value }) => {
    const actual = context[field];
    const opFn = CONDITION_OPS[op];
    if (!opFn) {
      logger.warn(`[StandingEvaluator] Unknown condition operator: "${op}"`);
      return false;
    }
    return opFn(actual, value);
  });
}

/**
 * Find all standing cues that match a given event + payload.
 *
 * @param {Map<string, Object>} cues - All loaded cue definitions
 * @param {Set<string>} disabledCues - Disabled cue IDs
 * @param {string} eventName
 * @param {Object} rawPayload
 * @returns {Array<Object>} Matching cue definitions
 */
function findMatchingEventCues(cues, disabledCues, eventName, rawPayload) {
  const context = normalizeEvent(eventName, rawPayload);
  const results = [];

  for (const cue of cues.values()) {
    if (!cue.trigger?.event) continue;
    if (cue.trigger.event !== eventName) continue;
    if (disabledCues.has(cue.id)) continue;
    if (evaluateConditions(cue.conditions, context)) {
      results.push(cue);
    }
  }
  return results;
}

/**
 * Find all clock-triggered cues whose threshold has been reached.
 *
 * @param {Map<string, Object>} cues - All loaded cue definitions
 * @param {Set<string>} disabledCues - Disabled cue IDs
 * @param {Set<string>} firedClockCues - Already-fired clock cue IDs
 * @param {number} elapsedSeconds - Current game clock elapsed time
 * @returns {Array<Object>} Cues that should fire now
 */
function findMatchingClockCues(cues, disabledCues, firedClockCues, elapsedSeconds) {
  const results = [];

  for (const cue of cues.values()) {
    if (!cue.trigger?.clock) continue;
    if (disabledCues.has(cue.id)) continue;
    if (firedClockCues.has(cue.id)) continue;

    const threshold = parseClockTime(cue.trigger.clock);
    if (elapsedSeconds >= threshold) {
      results.push(cue);
    }
  }
  return results;
}

/**
 * Build persistence snapshot for standing cue state.
 * Stored beside gameClock in session.cueEngine.
 *
 * @param {Set<string>} firedClockCues
 * @param {Set<string>} disabledCues
 * @param {boolean} active
 * @returns {Object}
 */
function toPersistence(firedClockCues, disabledCues, active) {
  return {
    firedClockCues: Array.from(firedClockCues),
    disabledCues: Array.from(disabledCues),
    active,
  };
}

/**
 * Restore standing cue state from a persistence snapshot.
 * Returns the sets/flag; does NOT fire any cues (E1: mark-without-firing policy).
 *
 * @param {Object} snapshot - Previously persisted state
 * @returns {{ firedClockCues: Set<string>, disabledCues: Set<string>, active: boolean }}
 */
function fromPersistence(snapshot) {
  if (!snapshot) {
    return { firedClockCues: new Set(), disabledCues: new Set(), active: false };
  }
  return {
    firedClockCues: new Set(snapshot.firedClockCues || []),
    disabledCues: new Set(snapshot.disabledCues || []),
    active: snapshot.active || false,
  };
}

module.exports = {
  EVENT_NORMALIZERS,
  ENGINE_EVENT_NORMALIZERS,
  CONDITION_OPS,
  parseClockTime,
  normalizeEvent,
  evaluateConditions,
  findMatchingEventCues,
  findMatchingClockCues,
  toPersistence,
  fromPersistence,
};
