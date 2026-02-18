/**
 * Cue Engine Service
 * Core cue engine for automated environment control.
 * Loads cue definitions, evaluates standing cues (event-triggered and clock-triggered),
 * fires simple cues (commands array) and compound cues (timeline) via executeCommand().
 *
 * Phase 1: Simple cues (commands array).
 * Phase 2: Compound cues (timeline) with nesting, cascading stop, video sync.
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
    tokenId: payload.transaction.tokenId,
    teamId: payload.transaction.teamId,
    deviceType: payload.transaction.deviceType,
    points: payload.transaction.points,
    memoryType: payload.transaction.memoryType,
    valueRating: payload.transaction.valueRating,
    groupId: payload.transaction.groupId,
    teamScore: payload.teamScore?.currentScore ?? 0,
    hasGroupBonus: payload.groupBonus !== null,
  }),
  'group:completed': (payload) => ({
    teamId: payload.teamId,
    groupId: payload.groupId,
    multiplier: payload.multiplier,
    bonus: payload.bonus,
  }),
  'video:loading': (payload) => ({ tokenId: payload.tokenId }),
  'video:started': (payload) => ({ tokenId: payload.queueItem?.tokenId, duration: payload.duration }),
  'video:completed': (payload) => ({ tokenId: payload.queueItem?.tokenId }),
  'video:paused': (payload) => ({ tokenId: payload?.tokenId }),
  'video:resumed': (payload) => ({ tokenId: payload?.tokenId }),
  'player:scan': (payload) => ({ tokenId: payload.tokenId, deviceId: payload.deviceId, deviceType: payload.deviceType }),
  'session:created': (payload) => ({ sessionId: payload.sessionId }),
  'cue:completed': (payload) => ({ cueId: payload.cueId }),
  'sound:completed': (payload) => ({ file: payload.file }),
  'spotify:track:changed': (payload) => ({ title: payload.title, artist: payload.artist }),
  'gameclock:started': (payload) => ({ gameStartTime: payload.gameStartTime }),
};

/**
 * Supported condition operators for cue evaluation.
 * All operators return boolean.
 */
const CONDITION_OPS = {
  eq: (actual, expected) => actual === expected,
  neq: (actual, expected) => actual !== expected,
  gt: (actual, expected) => actual > expected,
  gte: (actual, expected) => actual >= expected,
  lt: (actual, expected) => actual < expected,
  lte: (actual, expected) => actual <= expected,
  in: (actual, expected) => Array.isArray(expected) && expected.includes(actual),
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

    // Clear conflict timers before replacing the Map (prevent leaked timeouts)
    if (this.conflictTimers) {
      for (const timer of this.conflictTimers.values()) {
        clearTimeout(timer);
      }
    }

    // Clear pending conflicts
    if (this.pendingConflicts) {
      this.pendingConflicts.clear();
    }

    /** @type {Map<string, Object>} Running compound cues indexed by cue ID */
    this.activeCues = new Map();
    /** @type {Map<string, NodeJS.Timeout>} Auto-cancel timers for conflicted cues */
    this.conflictTimers = new Map();
    /** @type {Map<string, Object>} Stashed cue/trigger/parentChain for conflicted cues */
    this.pendingConflicts = new Map();
  }

  /**
   * Load cue definitions from an array.
   * Validates each cue and indexes by ID.
   *
   * @param {Array<Object>} cuesArray - Array of cue definition objects
   * @throws {Error} If a cue has both commands and timeline (mutually exclusive)
   */
  loadCues(cuesArray) {
    // Stop any active compound cues before replacing definitions
    if (this.activeCues && this.activeCues.size > 0) {
      logger.warn(`[CueEngine] Stopping ${this.activeCues.size} active compound cue(s) before reloading`);
      for (const cueId of [...this.activeCues.keys()]) {
        this.stopCue(cueId);
      }
    }

    const newCues = new Map();

    for (const cue of cuesArray) {
      // Validate mutual exclusivity of commands and timeline
      if (cue.commands && cue.timeline) {
        throw new Error(`Cue "${cue.id}": commands and timeline are mutually exclusive`);
      }

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
        if (cue.trigger.event) triggerType = 'event';
        else if (cue.trigger.clock) triggerType = 'clock';
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
   * Maximum nesting depth for compound cue chains (prevents runaway recursion).
   */
  static MAX_NESTING_DEPTH = 5;

  /**
   * Fire a cue by ID. For simple cues (commands array), executes all commands
   * in sequence. For compound cues (timeline), starts timeline execution.
   * Skips if cue is disabled. Auto-disables after fire if once=true.
   *
   * @param {string} cueId - The cue ID to fire
   * @param {string} [trigger] - Optional provenance string for logging
   * @param {Set<string>} [parentChain] - Chain of parent cue IDs for cycle detection
   * @throws {Error} If cue ID is not found
   */
  async fireCue(cueId, trigger, parentChain) {
    const cue = this.cues.get(cueId);
    if (!cue) {
      throw new Error(`Cue "${cueId}" not found`);
    }

    // Skip disabled cues silently
    if (this.disabledCues.has(cueId)) {
      logger.info(`[CueEngine] Skipping disabled cue: ${cueId}`);
      return;
    }

    // Cycle detection: check parent chain (when called with nesting context)
    if (parentChain && parentChain.has(cueId)) {
      logger.warn(`[CueEngine] Cycle detected: "${cueId}" is already in chain [${[...parentChain].join(' → ')}]`);
      this.emit('cue:error', {
        cueId,
        action: null,
        position: null,
        error: `Cycle detected: "${cueId}" already in parent chain`,
      });
      return;
    }

    // Secondary cycle guard: compound cue already running (production safety)
    if (cue.timeline && this.activeCues.has(cueId)) {
      logger.warn(`[CueEngine] Compound cue "${cueId}" already running, skipping re-fire`);
      this.emit('cue:error', {
        cueId,
        action: null,
        position: null,
        error: `Compound cue "${cueId}" is already running`,
      });
      return;
    }

    // Max depth check
    if (parentChain && parentChain.size >= CueEngineService.MAX_NESTING_DEPTH) {
      logger.warn(`[CueEngine] Max nesting depth (${CueEngineService.MAX_NESTING_DEPTH}) reached for "${cueId}"`);
      this.emit('cue:error', {
        cueId,
        action: null,
        position: null,
        error: `Max nesting depth (${CueEngineService.MAX_NESTING_DEPTH}) exceeded`,
      });
      return;
    }

    logger.info(`[CueEngine] Firing cue: ${cueId}${trigger ? ` (trigger: ${trigger})` : ''}`);

    // Compound cue (timeline) — start timeline execution
    if (cue.timeline) {
      await this._startCompoundCue(cue, trigger, parentChain);
      return;
    }

    // Simple cue (commands array)

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

  // ============================================================
  // Compound Cue Timeline Engine (Phase 2)
  // ============================================================

  /**
   * Start a compound cue timeline.
   * Creates an active cue entry, fires at:0 entries immediately,
   * and tracks for future clock tick or video progress advancement.
   *
   * @param {Object} cue - The cue definition
   * @param {string} [trigger] - Provenance string
   * @param {Set<string>} [parentChain] - Parent cue chain for cycle detection
   */
  async _startCompoundCue(cue, trigger, parentChain) {
    const { id: cueId, timeline } = cue;

    // Determine if this is a video-driven cue (has a video:play entry)
    const hasVideo = timeline.some(entry =>
      entry.action === 'video:play' || entry.action === 'video:queue:add'
    );

    // Video conflict detection (D13, D37): Check if a video is already playing
    if (hasVideo) {
      const videoQueueService = require('./videoQueueService');
      if (videoQueueService.isPlaying()) {
        const currentVideo = videoQueueService.getCurrentVideo();
        logger.warn(`[CueEngine] Video conflict for cue "${cueId}": video already playing`);

        // Emit conflict event
        this.emit('cue:conflict', {
          cueId,
          reason: 'Video conflict',
          currentVideo,
          autoCancel: true,
          autoCancelMs: 10000,
        });

        // Set auto-cancel timer (10 seconds)
        const autoCancelTimer = setTimeout(() => {
          logger.info(`[CueEngine] Auto-canceled conflicted cue: ${cueId}`);
          // Clear the timer reference
          if (this.conflictTimers && this.conflictTimers.has(cueId)) {
            this.conflictTimers.delete(cueId);
          }
          // Clear the pending conflict context
          if (this.pendingConflicts) {
            this.pendingConflicts.delete(cueId);
          }
        }, 10000);

        // Store timer reference and conflict context for GM resolution
        this.conflictTimers.set(cueId, autoCancelTimer);
        this.pendingConflicts.set(cueId, { cue, trigger, parentChain });

        // Do NOT start the compound cue yet - wait for GM override or auto-cancel
        return;
      }
    }

    // Compute max timeline position (duration)
    const maxAt = Math.max(...timeline.map(e => e.at), 0);

    // Build parent chain for children
    const chain = new Set(parentChain || []);
    chain.add(cueId);

    // Find the parent that spawned this cue (if nested)
    let spawnedBy = null;
    if (parentChain && parentChain.size > 0) {
      const chainArr = [...parentChain];
      spawnedBy = chainArr[chainArr.length - 1];
    }

    // Capture game clock elapsed at cue start for relative time calculation
    const gameClockService = require('./gameClockService');
    const startElapsed = gameClockService.getElapsed();

    // Create active cue entry
    const activeCue = {
      cueId,
      state: 'running',
      startTime: Date.now(),
      elapsed: 0,
      startElapsed, // Game clock time at cue start (for relative time calculation)
      timeline,
      maxAt,
      firedEntries: new Set(),
      spawnedBy,
      children: new Set(),
      hasVideo,
      parentChain: chain,
    };

    this.activeCues.set(cueId, activeCue);

    // Register as child of parent (if nested)
    if (spawnedBy && this.activeCues.has(spawnedBy)) {
      this.activeCues.get(spawnedBy).children.add(cueId);
    }

    // Emit cue:fired event
    this.emit('cue:fired', {
      cueId,
      trigger: trigger || null,
      source: 'cue',
    });

    // Emit cue:started event
    this.emit('cue:started', {
      cueId,
      hasVideo,
      duration: maxAt,
    });

    logger.info(`[CueEngine] Started compound cue: ${cueId} (${timeline.length} entries, duration: ${maxAt}s, video: ${hasVideo})`);

    // Fire all at:0 entries immediately
    await this._fireTimelineEntries(cueId, 0);

    // Check if already complete (all entries at 0, maxAt is 0)
    this._checkCompoundCueCompletion(cueId);

    // Auto-disable if once flag is set
    if (cue.once) {
      this.disableCue(cueId);
      logger.info(`[CueEngine] Auto-disabled once cue: ${cueId}`);
    }
  }

  /**
   * Fire all timeline entries at or before the given elapsed time that haven't been fired yet.
   *
   * @param {string} cueId - The compound cue ID
   * @param {number} elapsed - Current elapsed time in seconds
   */
  async _fireTimelineEntries(cueId, elapsed) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'running') return;

    const { timeline, firedEntries, parentChain } = activeCue;

    // Look up cue definition for routing resolution
    const cueDef = this.cues.get(cueId);

    for (let i = 0; i < timeline.length; i++) {
      const entry = timeline[i];
      if (entry.at > elapsed) continue;
      if (firedEntries.has(i)) continue;

      // Mark as fired BEFORE executing (prevents double-fire)
      firedEntries.add(i);

      // Resolve 3-tier routing: command-level > cue-level > global (service default)
      const resolvedPayload = this._resolveRouting(entry.action, entry.payload || {}, cueDef);

      try {
        await executeCommand({
          action: entry.action,
          payload: resolvedPayload,
          source: 'cue',
          trigger: `cue:${cueId}`,
        });
      } catch (err) {
        // D36: Emit error but CONTINUE the timeline
        logger.error(`[CueEngine] Timeline command failed in cue "${cueId}" at ${entry.at}s: ${entry.action}`, err.message);
        this.emit('cue:error', {
          cueId,
          action: entry.action,
          position: entry.at,
          error: err.message,
        });
      }
    }
  }

  /**
   * Resolve 3-tier routing for a timeline command payload.
   * Priority: command-level target > cue-level routing > global (no injection).
   *
   * Stream type is derived from the action prefix (e.g., 'sound:play' → 'sound').
   *
   * @param {string} action - The command action (e.g., 'sound:play', 'video:play')
   * @param {Object} payload - The original command payload
   * @param {Object} [cueDef] - The cue definition (may have routing object)
   * @returns {Object} Payload with target resolved (or unchanged)
   */
  _resolveRouting(action, payload, cueDef) {
    // If command already has a target, use it (command-level override wins)
    if (payload.target) {
      return payload;
    }

    // Check for cue-level routing
    if (cueDef && cueDef.routing) {
      // Derive stream type from action prefix (e.g., 'sound:play' → 'sound')
      const streamType = action.split(':')[0];
      const cueTarget = cueDef.routing[streamType];
      if (cueTarget) {
        return { ...payload, target: cueTarget };
      }
    }

    // No routing to inject — global routing resolves at service level
    return payload;
  }

  /**
   * Check if a compound cue has completed (all entries fired and elapsed >= maxAt).
   * If complete, emit cue:completed and remove from activeCues.
   *
   * @param {string} cueId - The compound cue ID
   */
  _checkCompoundCueCompletion(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'running') return;

    const { timeline, firedEntries, maxAt, elapsed } = activeCue;

    // All entries must be fired AND elapsed must be >= max(at)
    if (firedEntries.size >= timeline.length && elapsed >= maxAt) {
      logger.info(`[CueEngine] Compound cue completed: ${cueId}`);
      this.activeCues.delete(cueId);
      this.emit('cue:completed', { cueId });
    }
  }

  /**
   * Advance clock-driven compound cues. Called from game clock tick handler.
   * Fires timeline entries whose `at` position has been reached.
   *
   * @param {number} elapsed - Current game clock elapsed time in seconds
   */
  _tickActiveCompoundCues(elapsed) {
    for (const [cueId, activeCue] of this.activeCues) {
      if (activeCue.state !== 'running') continue;
      if (activeCue.hasVideo) continue; // Video-driven cues use handleVideoProgress

      const relativeElapsed = elapsed - activeCue.startElapsed;
      activeCue.elapsed = relativeElapsed;

      // Emit progress update for UI
      const progress = activeCue.maxAt > 0 ? Math.min(100, (relativeElapsed / activeCue.maxAt) * 100) : 100;
      this.emit('cue:status', {
        cueId,
        state: activeCue.state,
        progress,
        duration: activeCue.maxAt,
      });

      // Fire entries that should have fired by now
      this._fireTimelineEntries(cueId, relativeElapsed).catch(err => {
        logger.error(`[CueEngine] Error ticking compound cue "${cueId}":`, err.message);
      });

      // Check for completion
      this._checkCompoundCueCompletion(cueId);
    }
  }

  /**
   * Handle video progress for video-driven compound cues.
   * Advances the timeline based on video playback position.
   *
   * @param {string} cueId - The compound cue ID
   * @param {number} position - Video position in seconds
   */
  handleVideoProgress(cueId, position) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue) return;
    if (activeCue.state !== 'running') return;

    activeCue.elapsed = position;

    this._fireTimelineEntries(cueId, position).catch(err => {
      logger.error(`[CueEngine] Error advancing video-driven cue "${cueId}":`, err.message);
    });

    this._checkCompoundCueCompletion(cueId);
  }

  /**
   * Handle video paused for video-driven compound cues.
   * Pauses the compound cue timeline.
   *
   * @param {string} cueId - The compound cue ID
   */
  handleVideoPaused(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'running') return;

    activeCue.state = 'paused';
    logger.info(`[CueEngine] Video-driven cue paused: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'paused' });
  }

  /**
   * Handle video resumed for video-driven compound cues.
   * Resumes the compound cue timeline.
   *
   * @param {string} cueId - The compound cue ID
   */
  handleVideoResumed(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'paused') return;

    activeCue.state = 'running';
    logger.info(`[CueEngine] Video-driven cue resumed: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'running' });
  }

  /**
   * Handle video progress event from videoQueueService.
   * Forwards progress to all active video-driven compound cues.
   *
   * Note: forwards to ALL active video-driven cues. Safe because only one
   * video can play at a time (enforced by video conflict detection in _startCompoundCue).
   *
   * @param {Object} data - Video progress event data
   * @param {number} data.position - Video position in seconds
   */
  handleVideoProgressEvent(data) {
    const { position, duration } = data;
    if (position === undefined) return;

    // Convert VLC position (0.0-1.0 ratio) to seconds using duration
    const positionSeconds = (duration && duration > 0) ? position * duration : position;

    // Forward to all active video-driven cues
    for (const [cueId, activeCue] of this.activeCues) {
      if (activeCue.hasVideo && activeCue.state === 'running') {
        this.handleVideoProgress(cueId, positionSeconds);
      }
    }
  }

  /**
   * Handle video lifecycle events (paused, resumed, completed).
   * Forwards to all active video-driven compound cues.
   *
   * @param {string} eventType - Type of lifecycle event ('paused', 'resumed', 'completed')
   * @param {Object} data - Event data
   */
  handleVideoLifecycleEvent(eventType, data) {
    // Forward to all active video-driven cues
    for (const [cueId, activeCue] of this.activeCues) {
      if (!activeCue.hasVideo) continue;

      if (eventType === 'paused') {
        this.handleVideoPaused(cueId);
      } else if (eventType === 'resumed') {
        this.handleVideoResumed(cueId);
      } else if (eventType === 'completed') {
        // Video completed - cue should complete naturally via _checkCompoundCueCompletion
        // Just ensure the cue advances to the end position
        const maxAt = activeCue.maxAt || 0;
        this.handleVideoProgress(cueId, maxAt);
      }
    }
  }

  /**
   * Stop a compound cue and cascade stop to all children.
   *
   * @param {string} cueId - The compound cue ID to stop
   */
  async stopCue(cueId) {
    // Clear conflict timer if exists
    if (this.conflictTimers && this.conflictTimers.has(cueId)) {
      clearTimeout(this.conflictTimers.get(cueId));
      this.conflictTimers.delete(cueId);
      logger.info(`[CueEngine] Cleared conflict timer for: ${cueId}`);
    }

    const activeCue = this.activeCues.get(cueId);
    if (!activeCue) {
      logger.info(`[CueEngine] stopCue: "${cueId}" not active, ignoring`);
      return;
    }

    // Cascade stop to children first (depth-first)
    for (const childId of activeCue.children) {
      await this.stopCue(childId);
    }

    logger.info(`[CueEngine] Stopping compound cue: ${cueId}`);
    activeCue.state = 'stopped';
    this.activeCues.delete(cueId);
    this.emit('cue:status', { cueId, state: 'stopped' });
  }

  /**
   * Pause a compound cue.
   *
   * @param {string} cueId - The compound cue ID to pause
   */
  async pauseCue(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'running') {
      logger.info(`[CueEngine] pauseCue: "${cueId}" not running, ignoring`);
      return;
    }

    activeCue.state = 'paused';
    logger.info(`[CueEngine] Paused compound cue: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'paused' });

    // Cascade pause to children (same pattern as stopCue)
    for (const childId of activeCue.children) {
      const childCue = this.activeCues.get(childId);
      if (childCue && childCue.state === 'running') {
        childCue.state = 'paused';
        logger.info(`[CueEngine] Cascade-paused child cue: ${childId}`);
        this.emit('cue:status', { cueId: childId, state: 'paused' });
      }
    }
  }

  /**
   * Resume a paused compound cue.
   *
   * @param {string} cueId - The compound cue ID to resume
   */
  async resumeCue(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'paused') {
      logger.info(`[CueEngine] resumeCue: "${cueId}" not paused, ignoring`);
      return;
    }

    activeCue.state = 'running';
    logger.info(`[CueEngine] Resumed compound cue: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'running' });

    // Cascade resume to children
    for (const childId of activeCue.children) {
      const childCue = this.activeCues.get(childId);
      if (childCue && childCue.state === 'paused') {
        childCue.state = 'running';
        logger.info(`[CueEngine] Cascade-resumed child cue: ${childId}`);
        this.emit('cue:status', { cueId: childId, state: 'running' });
      }
    }
  }

  /**
   * Resolve a video conflict for a pending compound cue.
   * GM can either override (stop current video, start the cue) or cancel.
   *
   * @param {string} cueId - The conflicted cue ID
   * @param {string} decision - 'override' (stop video, start cue) or 'cancel' (discard cue)
   * @throws {Error} If cueId has no pending conflict or decision is invalid
   */
  async resolveConflict(cueId, decision) {
    const pending = this.pendingConflicts.get(cueId);
    if (!pending) {
      throw new Error(`No pending conflict for cue "${cueId}"`);
    }

    // Clear auto-cancel timer (same pattern as stopCue lines 770-773)
    if (this.conflictTimers.has(cueId)) {
      clearTimeout(this.conflictTimers.get(cueId));
      this.conflictTimers.delete(cueId);
    }
    this.pendingConflicts.delete(cueId);

    if (decision === 'override') {
      // Stop current video, then start the conflicted cue
      const videoQueueService = require('./videoQueueService');
      await videoQueueService.stopCurrent();
      await this._startCompoundCue(pending.cue, pending.trigger, pending.parentChain);
      logger.info(`[CueEngine] Conflict resolved (override): ${cueId}`);
    } else if (decision === 'cancel') {
      logger.info(`[CueEngine] Conflict resolved (cancel): ${cueId}`);
    } else {
      throw new Error(`Invalid conflict decision: "${decision}" (expected "override" or "cancel")`);
    }
  }

  /**
   * Get all active compound cues with progress info.
   *
   * @returns {Array<Object>} Array of { cueId, state, progress, duration }
   */
  getActiveCues() {
    const result = [];
    for (const [cueId, activeCue] of this.activeCues) {
      result.push({
        cueId,
        state: activeCue.state,
        progress: activeCue.elapsed,
        duration: activeCue.maxAt,
      });
    }
    return result;
  }

  // ============================================================
  // Condition Evaluation
  // ============================================================

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
