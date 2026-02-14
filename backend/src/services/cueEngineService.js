/**
 * Cue Engine Service
 * Core cue engine for automated environment control.
 * Loads cue definitions, evaluates standing cues (event-triggered and clock-triggered),
 * and fires simple cues via executeCommand().
 *
 * Phase 1 scope: Simple cues only (commands array).
 * Compound cues (timeline) are Phase 2 — validated but rejected at load time.
 */

'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');
const { executeCommand } = require('./commandExecutor');

/**
 * Flatten internal event payloads to flat fields for cue condition evaluation.
 * Cue authors reference flat field names (e.g., "memoryType") rather than
 * nested paths (e.g., "transaction.memoryType").
 *
 * When an unknown event fires (no normalizer defined), the raw payload is
 * passed through unchanged.
 */
const EVENT_NORMALIZERS = {
  'transaction:accepted': (payload) => ({
    tokenId:      payload.transaction.tokenId,
    teamId:       payload.transaction.teamId,
    deviceType:   payload.transaction.deviceType,
    points:       payload.transaction.points,
    memoryType:   payload.transaction.memoryType,
    valueRating:  payload.transaction.valueRating,
    groupId:      payload.transaction.groupId,
    teamScore:    payload.teamScore?.currentScore ?? 0,
    hasGroupBonus: payload.groupBonus !== null,
  }),
  'group:completed': (payload) => ({
    teamId:     payload.teamId,
    groupId:    payload.groupId,
    multiplier: payload.multiplier,
    bonus:      payload.bonus,
  }),
  'video:loading':   (payload) => ({ tokenId: payload.tokenId }),
  'video:started':   (payload) => ({ tokenId: payload.queueItem?.tokenId, duration: payload.duration }),
  'video:completed': (payload) => ({ tokenId: payload.queueItem?.tokenId }),
  'video:paused':    (payload) => ({ tokenId: payload?.tokenId }),
  'video:resumed':   (payload) => ({ tokenId: payload?.tokenId }),
  'player:scan':     (payload) => ({ tokenId: payload.tokenId, deviceId: payload.deviceId, deviceType: payload.deviceType }),
  'session:created': (payload) => ({ sessionId: payload.sessionId }),
  'cue:completed':   (payload) => ({ cueId: payload.cueId }),
  'sound:completed': (payload) => ({ file: payload.file }),
  'spotify:track:changed': (payload) => ({ title: payload.title, artist: payload.artist }),
  'gameclock:started':     (payload) => ({ gameStartTime: payload.gameStartTime }),
};

/**
 * Supported condition operators for cue evaluation.
 * All operators return boolean.
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
 */
function parseClockTime(clockStr) {
  const parts = clockStr.split(':').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid clock time format: "${clockStr}" (expected HH:MM:SS)`);
  }
  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

class CueEngineService extends EventEmitter {
  constructor() {
    super();
    this._reset();
  }

  _reset() {
    /** @type {Map<string, Object>} All loaded cues indexed by ID */
    this.cues = new Map();
    /** @type {Set<string>} IDs of disabled cues */
    this.disabledCues = new Set();
    /** @type {boolean} Whether the engine is actively evaluating standing cues */
    this.active = false;
    /** @type {Set<string>} Clock cue IDs that have already fired (prevents re-fire) */
    this.firedClockCues = new Set();
  }

  /**
   * Load cue definitions from an array.
   * Validates each cue and indexes by ID.
   *
   * @param {Array<Object>} cuesArray - Array of cue definition objects
   * @throws {Error} If a cue has both commands and timeline (mutually exclusive)
   */
  loadCues(cuesArray) {
    const newCues = new Map();

    for (const cue of cuesArray) {
      // Validate mutual exclusivity of commands and timeline
      if (cue.commands && cue.timeline) {
        throw new Error(`Cue "${cue.id}": commands and timeline are mutually exclusive`);
      }

      // Phase 1: timeline cues are recognized but cannot be fired
      // (they load successfully for future Phase 2 support)

      newCues.set(cue.id, {
        ...cue,
        commands: cue.commands || [],
        conditions: cue.conditions || [],
        once: cue.once || false,
        quickFire: cue.quickFire || false,
        icon: cue.icon || null,
      });
    }

    this.cues = newCues;
    logger.info(`[CueEngine] Loaded ${newCues.size} cues (${this.getStandingCues().length} standing)`);
  }

  /**
   * Get all loaded cue definitions.
   * @returns {Array<Object>} Array of cue objects
   */
  getCues() {
    return Array.from(this.cues.values());
  }

  /**
   * Get standing cues (cues with a trigger field).
   * @returns {Array<Object>} Array of standing cue objects
   */
  getStandingCues() {
    return this.getCues().filter(cue => cue.trigger);
  }

  /**
   * Get IDs of all disabled cues.
   * @returns {Array<string>} Array of disabled cue IDs
   */
  getDisabledCues() {
    return Array.from(this.disabledCues);
  }

  /**
   * Get cue summaries for sync:full payload and GM UI.
   * Returns metadata without commands/timeline arrays.
   * @returns {Array<Object>} Array of cue summary objects
   */
  getCueSummaries() {
    return this.getCues().map(cue => {
      let triggerType = null;
      if (cue.trigger) {
        triggerType = cue.trigger.event ? 'event' : cue.trigger.clock ? 'clock' : null;
      }

      return {
        id: cue.id,
        label: cue.label,
        icon: cue.icon,
        quickFire: cue.quickFire,
        once: cue.once,
        triggerType,
        enabled: !this.disabledCues.has(cue.id),
      };
    });
  }

  /**
   * Fire a cue by ID. Executes all commands in sequence via executeCommand().
   * Skips if cue is disabled. Auto-disables after fire if once=true.
   *
   * @param {string} cueId - The cue ID to fire
   * @param {string} [trigger] - Optional provenance string for logging
   * @throws {Error} If cue ID is not found
   */
  async fireCue(cueId, trigger) {
    const cue = this.cues.get(cueId);
    if (!cue) {
      throw new Error(`Cue "${cueId}" not found`);
    }

    // Skip disabled cues silently
    if (this.disabledCues.has(cueId)) {
      logger.info(`[CueEngine] Skipping disabled cue: ${cueId}`);
      return;
    }

    // Phase 1: Only simple cues (commands array) are supported
    if (cue.timeline) {
      logger.warn(`[CueEngine] Compound cue "${cueId}" not yet supported (Phase 2)`);
      this.emit('cue:error', {
        cueId,
        action: null,
        position: null,
        error: 'Compound cues (timeline) are not yet implemented (Phase 2)',
      });
      return;
    }

    logger.info(`[CueEngine] Firing cue: ${cueId}${trigger ? ` (trigger: ${trigger})` : ''}`);

    // Emit cue:fired event
    this.emit('cue:fired', {
      cueId,
      trigger: trigger || null,
      source: 'cue',
    });

    // Execute all commands in sequence
    for (const cmd of cue.commands) {
      try {
        await executeCommand({
          action: cmd.action,
          payload: cmd.payload || {},
          source: 'cue',
          trigger: `cue:${cueId}`,
        });
      } catch (err) {
        logger.error(`[CueEngine] Command failed in cue "${cueId}": ${cmd.action}`, err.message);
        this.emit('cue:error', {
          cueId,
          action: cmd.action,
          position: null,
          error: err.message,
        });
      }
    }

    // Emit cue:completed
    this.emit('cue:completed', { cueId });

    // Auto-disable if once flag is set
    if (cue.once) {
      this.disableCue(cueId);
      logger.info(`[CueEngine] Auto-disabled once cue: ${cueId}`);
    }
  }

  /**
   * Enable a cue by ID.
   * @param {string} cueId - The cue ID to enable
   */
  enableCue(cueId) {
    this.disabledCues.delete(cueId);
    logger.info(`[CueEngine] Enabled cue: ${cueId}`);
  }

  /**
   * Disable a cue by ID.
   * @param {string} cueId - The cue ID to disable
   */
  disableCue(cueId) {
    this.disabledCues.add(cueId);
    logger.info(`[CueEngine] Disabled cue: ${cueId}`);
  }

  /**
   * Activate the cue engine — start evaluating standing cues.
   * Called when session transitions to active state.
   */
  activate() {
    this.active = true;
    logger.info('[CueEngine] Activated');
  }

  /**
   * Suspend the cue engine — stop evaluating standing cues.
   * Called when session pauses.
   */
  suspend() {
    this.active = false;
    logger.info('[CueEngine] Suspended');
  }

  /**
   * Handle a game event for standing cue evaluation.
   * Normalizes the event payload and evaluates all matching event-triggered standing cues.
   *
   * Re-entrancy guard (D4): This method is only called from game event listeners,
   * never from executeCommand output. Commands dispatched by cues (source:'cue')
   * do NOT trigger standing cue evaluation.
   *
   * @param {string} eventName - The internal event name (e.g., 'transaction:accepted')
   * @param {Object} payload - The raw event payload
   */
  handleGameEvent(eventName, payload) {
    if (!this.active) return;

    // Normalize the payload to flat fields for condition evaluation
    const normalizer = EVENT_NORMALIZERS[eventName];
    const context = normalizer ? normalizer(payload) : payload;

    // Find all event-triggered standing cues that match this event
    const matchingCues = this.getStandingCues().filter(cue => {
      if (!cue.trigger.event) return false;
      if (cue.trigger.event !== eventName) return false;
      if (this.disabledCues.has(cue.id)) return false;
      return this.evaluateConditions(cue.conditions, context);
    });

    // Fire all matching cues (in definition order — Map preserves insertion order)
    for (const cue of matchingCues) {
      this.fireCue(cue.id, `event:${eventName}`).catch(err => {
        logger.error(`[CueEngine] Failed to fire cue "${cue.id}" from event "${eventName}":`, err.message);
      });
    }
  }

  /**
   * Handle a game clock tick for clock-triggered standing cues.
   * Clock cues fire once when the elapsed time reaches or passes their threshold.
   *
   * @param {number} elapsedSeconds - Current game clock elapsed time in seconds
   */
  handleClockTick(elapsedSeconds) {
    if (!this.active) return;

    const clockCues = this.getStandingCues().filter(cue => {
      if (!cue.trigger.clock) return false;
      if (this.disabledCues.has(cue.id)) return false;
      if (this.firedClockCues.has(cue.id)) return false;
      return true;
    });

    for (const cue of clockCues) {
      const thresholdSeconds = parseClockTime(cue.trigger.clock);
      if (elapsedSeconds >= thresholdSeconds) {
        // Mark as fired BEFORE firing to prevent double-fire on next tick
        this.firedClockCues.add(cue.id);
        this.fireCue(cue.id, `clock:${cue.trigger.clock}`).catch(err => {
          logger.error(`[CueEngine] Failed to fire clock cue "${cue.id}":`, err.message);
        });
      }
    }
  }

  /**
   * Evaluate conditions against a normalized context.
   * All conditions must match (implicit AND).
   *
   * @param {Array<Object>} conditions - Array of {field, op, value} objects
   * @param {Object} context - Flat key/value context from event normalization
   * @returns {boolean} True if all conditions match (or no conditions)
   */
  evaluateConditions(conditions, context) {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every(({ field, op, value }) => {
      const actual = context[field];
      const opFn = CONDITION_OPS[op];
      if (!opFn) {
        logger.warn(`[CueEngine] Unknown condition operator: "${op}"`);
        return false;
      }
      return opFn(actual, value);
    });
  }

  /**
   * Reset the cue engine to initial state.
   * Clears all cues, disabled set, and fired clock cues.
   */
  reset() {
    this._reset();
  }

  /**
   * Cleanup the cue engine. Resets state and removes all listeners.
   */
  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

// Export parseClockTime for testing
CueEngineService.parseClockTime = parseClockTime;

module.exports = new CueEngineService();
