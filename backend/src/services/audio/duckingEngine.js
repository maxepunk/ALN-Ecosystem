/**
 * DuckingEngine — ducking state machine for audio volume automation.
 *
 * Automatically reduces target stream volumes (e.g., music) when source
 * streams (e.g., video, sound) are active. Restores volumes when sources end.
 *
 * Design: Zero pactl/service knowledge. Receives a port object that provides
 * the three volume operations it needs, so the engine is independently
 * testable with a fake port.
 *
 * Port interface:
 *   getVolume(stream)           → Promise<number|null>   live pactl read
 *   setVolumeLive(stream, vol)  → Promise<number>        pactl set, no persist
 *   getUserVolume(stream)       → number|null            persisted user volume
 *
 * Fixes absorbed here:
 *   F-SHOW-05: Empty-array guard — a truthy-but-empty activeSources array no
 *     longer triggers a spurious restore at the 'hardcoded 100' fallback.
 *     Restore target is the CAPTURED pre-duck volume (decision E3); fallback
 *     is getUserVolume() (persisted user intent), never hardcoded 100.
 *
 *   F-SHOW-06: Per-target op serialization — duck/restore pactl writes for the
 *     same target stream are serialized via a per-target promise chain. A short
 *     sound can no longer race its own restore and leave music stuck at duck vol.
 *
 *   F-SHOW-07: Per-instance refcount — overlapping sounds from the same source
 *     class (e.g., two concurrent pw-play processes) are tracked by instance
 *     count, not by boolean presence. The target is only restored when the last
 *     instance of a source ends.
 *
 *   F-SHOW-27: Null capture falls back to persisted user volume (getUserVolume),
 *     not hardcoded 100. A duck arriving before MPD's sink-input exists will
 *     use the persisted volume as the restore target instead of clobbering to 100.
 *
 * Decision E3 semantics (owner override):
 *   - Restore target = captured pre-duck volume (live read at duck-start)
 *   - Fallback to getUserVolume() ONLY when capture is missing (null result
 *     from live read AND no prior capture in _preDuckVolumes)
 *   - Hardcoded-100 fallback is removed
 *   - If GM adjusts volume DURING a duck: the setVolumeLive call at the public
 *     facade (audioRoutingService.setStreamVolume) will persist the new value.
 *     The engine does NOT need to intercept this — E3's "capture refresh"
 *     requirement is satisfied by the facade calling refreshPreDuckCapture()
 *     when a user volume adjustment arrives while that target is actively ducked.
 *
 * B7 note: loadRules() clears active duck state. A future venue hot-reload path
 *   should drain (await all pending ops, restore any active ducks) before
 *   clearing rules — the current clear-and-reset is safe for show-start reloads
 *   but would strand music at duck volume if called mid-show.
 */

const logger = require('../../utils/logger');

class DuckingEngine {
  /**
   * @param {{
   *   getVolume: (stream: string) => Promise<number|null>,
   *   setVolumeLive: (stream: string, volume: number) => Promise<number>,
   *   getUserVolume: (stream: string) => number|null,
   * }} port - Service-layer port providing volume operations
   */
  constructor(port) {
    if (!port
        || typeof port.getVolume !== 'function'
        || typeof port.setVolumeLive !== 'function'
        || typeof port.getUserVolume !== 'function') {
      throw new Error('DuckingEngine requires a port with getVolume, setVolumeLive, getUserVolume');
    }
    this._port = port;

    /** @type {Array<{when: string, duck: string, to: number, fadeMs: number}>} */
    this._rules = [];

    /**
     * Per-target source instance counts.
     * F-SHOW-07: tracks instances (not just presence) so overlapping sounds
     * from the same source class don't un-duck early.
     * Shape: { targetStream: { sourceClass: instanceCount } }
     * @type {Object.<string, Object.<string, number>>}
     */
    this._instanceCounts = {};

    /**
     * Pre-duck volume captures.
     * Shape: { targetStream: volume }
     * @type {Object.<string, number>}
     */
    this._preDuckVolumes = {};

    /**
     * Per-target serialization queues (F-SHOW-06).
     * Each entry is a Promise representing the last queued op for that target.
     * New ops chain onto the tail of this promise.
     * Shape: { targetStream: Promise }
     * @type {Object.<string, Promise>}
     */
    this._opQueues = {};

    /** Event emission callback — set by audioRoutingService after construction */
    this._onDuckingChanged = null;
    this._onDuckingFailed = null;
  }

  /**
   * Register event callbacks (used by audioRoutingService to forward events).
   * @param {function({stream, ducked, volume, activeSources, restoredVolume}): void} onChanged
   * @param {function({target, volume, context, error}): void} onFailed
   */
  setCallbacks(onChanged, onFailed) {
    this._onDuckingChanged = onChanged;
    this._onDuckingFailed = onFailed;
  }

  /**
   * Load ducking rules from config. Replaces any existing rules and clears active state.
   *
   * B7 note: clears active duck state. A future venue hot-reload path should
   * drain active ducks before clearing — current clear is safe for show-start
   * reloads but would leave music ducked if called mid-show.
   *
   * @param {Array<{when: string, duck: string, to: number, fadeMs: number}>} rules
   */
  loadRules(rules) {
    this._rules = [...rules];
    this._instanceCounts = {};
    this._preDuckVolumes = {};
    this._opQueues = {};
    logger.info('DuckingEngine: rules loaded', { ruleCount: rules.length });
  }

  /**
   * Handle a ducking lifecycle event from a source stream.
   * Returns a promise so callers can await completion when ordering matters.
   *
   * @param {string} source - Source stream name (e.g., 'video', 'sound')
   * @param {'started'|'completed'|'paused'|'resumed'} lifecycle
   * @returns {Promise<void>}
   */
  async handleEvent(source, lifecycle) {
    if (!this._rules || this._rules.length === 0) return;

    const matchingRules = this._rules.filter(r => r.when === source);
    if (matchingRules.length === 0) return;

    switch (lifecycle) {
      case 'started':
      case 'resumed':
        await this._handleStart(source, matchingRules);
        break;
      case 'completed':
      case 'paused':
        await this._handleStop(source, matchingRules);
        break;
      default:
        logger.warn('DuckingEngine: unknown lifecycle event', { source, lifecycle });
    }
  }

  /**
   * Refresh the pre-duck capture for a target stream that is currently ducked.
   * Called by audioRoutingService when the GM adjusts a stream's volume mid-duck,
   * implementing the E3 requirement: "GM volume adjustment DURING a duck refreshes
   * the restore target."
   *
   * No-op if the target is not currently ducked.
   *
   * @param {string} target - Target stream name
   * @param {number} newVolume - The new volume the GM just set
   */
  refreshPreDuckCapture(target, newVolume) {
    if (!this._isTargetDucked(target)) return;
    this._preDuckVolumes[target] = newVolume;
    logger.debug('DuckingEngine: pre-duck capture refreshed (mid-duck GM adjust)', {
      target, newVolume,
    });
  }

  /**
   * Get the current list of active source names for a target stream.
   * Used by audioRoutingService.getState() for the ducking snapshot.
   *
   * @param {string} target - Target stream name
   * @returns {string[]} Active source names (may include duplicates for multi-instance)
   */
  getActiveSources(target) {
    const counts = this._instanceCounts[target];
    if (!counts) return [];
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([src]) => src);
  }

  /**
   * Get a snapshot of all active ducking state for all targets.
   * Returns the same shape as the old _activeDuckingSources.
   * @returns {Object.<string, string[]>}
   */
  getActiveState() {
    return Object.keys(this._instanceCounts).reduce((state, target) => {
      const sources = this.getActiveSources(target);
      if (sources.length > 0) {
        return { ...state, [target]: sources };
      }
      return state;
    }, {});
  }

  /**
   * Reset all state (called by audioRoutingService.reset()).
   */
  reset() {
    this._rules = [];
    this._instanceCounts = {};
    this._preDuckVolumes = {};
    this._opQueues = {};
  }

  // ── Private ──

  /**
   * Returns true if the target is currently being ducked (has at least one active source).
   * @param {string} target
   * @returns {boolean}
   * @private
   */
  _isTargetDucked(target) {
    return this.getActiveSources(target).length > 0;
  }

  /**
   * Return total instance count across all sources for a target.
   * @param {string} target
   * @returns {number}
   * @private
   */
  _totalInstances(target) {
    const counts = this._instanceCounts[target];
    if (!counts) return 0;
    return Object.values(counts).reduce((sum, n) => sum + n, 0);
  }

  /**
   * Handle ducking start (source started or resumed).
   * Serializes the duck-apply pactl write via per-target op queue (F-SHOW-06).
   * Awaits pre-duck capture before applying (race-condition fix, Batch 1).
   *
   * @param {string} source
   * @param {Array} matchingRules
   * @private
   */
  async _handleStart(source, matchingRules) {
    const targets = [...new Set(matchingRules.map(r => r.duck))];

    // Process targets sequentially (each capture must complete before the next)
    // eslint-disable-next-line no-restricted-syntax
    for (const target of targets) {
      // Initialize instance count map for this target if needed
      if (!this._instanceCounts[target]) {
        this._instanceCounts[target] = {};
      }

      // Increment instance count for this source (F-SHOW-07)
      const prevCount = this._instanceCounts[target][source] || 0;
      this._instanceCounts[target][source] = prevCount + 1;

      const wasFirstInstance = prevCount === 0;

      // Capture pre-duck volume before the first instance of any ducking
      // (total instances == 1 means this is the FIRST duck overall for this target).
      // Sequential await is intentional: each capture must complete before we
      // enqueue the volume operation for that target.
      if (this._totalInstances(target) === 1) {
        // eslint-disable-next-line no-await-in-loop
        await this._capturePreDuckVolume(target); // intentional sequential await
      }

      // Guard: rules may have been cleared (loadRules called) while we awaited capture
      if (this._instanceCounts[target]) {
        if (wasFirstInstance) {
          // New source type added — recalculate effective volume
          const effectiveVolume = this._calculateEffectiveVolume(target);
          this._enqueueVolumeOp(target, effectiveVolume, 'apply');

          this._emitChanged(target, true, effectiveVolume);
          logger.info('DuckingEngine: ducking applied', {
            source,
            target,
            volume: effectiveVolume,
            instanceCounts: this._instanceCounts[target],
          });
        }
        // else: additional instance of same source type — volume already at correct level
      } else {
        logger.debug('DuckingEngine: duck-start aborted — rules reset during capture', {
          source, target,
        });
      }
    }
  }

  /**
   * Handle ducking stop (source completed or paused).
   * Decrements instance count; restores only when the last instance of ALL
   * source types for a target have ended (F-SHOW-07).
   * Serializes the restore pactl write via per-target op queue (F-SHOW-06).
   *
   * F-SHOW-05 fix: Empty-array guard — checks _totalInstances instead of
   * the truthy-but-empty-array check. Restore falls back to getUserVolume(),
   * never hardcoded 100.
   *
   * @param {string} source
   * @param {Array} matchingRules
   * @private
   */
  async _handleStop(source, matchingRules) {
    const targets = [...new Set(matchingRules.map(r => r.duck))];

    // eslint-disable-next-line no-restricted-syntax
    for (const target of targets) {
      // F-SHOW-05: check _totalInstances > 0, not presence of array
      if (this._instanceCounts[target] && this._totalInstances(target) > 0) {
        // Decrement instance count for this source
        const currentCount = this._instanceCounts[target][source] || 0;
        if (currentCount > 0) {
          this._instanceCounts[target][source] = currentCount - 1;
        }
        // If count was already 0 (e.g., duplicate completion), leave it at 0

        const remainingTotal = this._totalInstances(target);

        if (remainingTotal === 0) {
          // No more active instances across ALL source types — restore
          const restoreVolume = this._getRestoreVolume(target);

          this._enqueueVolumeOp(target, restoreVolume, 'restore');

          this._emitChanged(target, false, restoreVolume, []);

          // Clean up state for this target
          delete this._preDuckVolumes[target];
          delete this._instanceCounts[target];
          // Keep _opQueues[target] in place — may still have an in-flight op.
          // It will resolve harmlessly after the restore.

          logger.info('DuckingEngine: ducking restored', { source, target, volume: restoreVolume });
        } else {
          // Other instances still active — re-evaluate to new effective level
          const effectiveVolume = this._calculateEffectiveVolume(target);

          this._enqueueVolumeOp(target, effectiveVolume, 're-evaluate');

          const activeSources = this.getActiveSources(target);
          this._emitChanged(target, true, effectiveVolume, activeSources);

          logger.info('DuckingEngine: ducking re-evaluated', {
            source,
            target,
            volume: effectiveVolume,
            remainingTotal,
          });
        }
      }
      // Not ducked for this target — nothing to do
    }
  }

  /**
   * Enqueue a volume operation for a target stream.
   * Operations for the same target are serialized (F-SHOW-06): each new op
   * waits for the previous one to complete before executing its pactl call.
   *
   * @param {string} target
   * @param {number} volume
   * @param {string} context - for logging
   * @private
   */
  _enqueueVolumeOp(target, volume, context) {
    const prev = this._opQueues[target] || Promise.resolve();

    this._opQueues[target] = prev.then(() => this._port.setVolumeLive(target, volume)
      .catch(err => {
        if (err.message && err.message.includes('No active sink-input')) {
          logger.warn(`DuckingEngine: ${context} skipped — sink-input not available`, {
            target, volume,
          });
        } else {
          logger.error(`DuckingEngine: failed to ${context} ducked volume`, {
            target, volume, error: err.message,
          });
          if (this._onDuckingFailed) {
            this._onDuckingFailed({ target, volume, context, error: err.message });
          }
        }
      }));
    // Do NOT await here — callers chain via handleEvent's awaited _handleStart/_handleStop
  }

  /**
   * Capture the pre-duck volume for a target stream.
   * E3 semantics: use live read; fallback to getUserVolume() (not hardcoded 100).
   * Only stores if not already captured (race-condition guard).
   *
   * F-SHOW-27 fix: null live read falls back to persisted user volume via getUserVolume(),
   * not hardcoded 100. This means a duck arriving before MPD's sink-input registers
   * uses the known user volume as the restore target.
   *
   * @param {string} target
   * @private
   */
  async _capturePreDuckVolume(target) {
    try {
      const liveVolume = await this._port.getVolume(target);
      // Only store if not already captured (guard against concurrent captures)
      if (this._preDuckVolumes[target] === undefined) {
        if (liveVolume !== null) {
          // Happy path: live read succeeded (E3 primary: captured pre-duck volume)
          this._preDuckVolumes[target] = liveVolume;
        } else {
          // F-SHOW-27: sink-input doesn't exist yet — fall back to persisted user volume
          // (never hardcoded 100)
          const userVolume = this._port.getUserVolume(target);
          this._preDuckVolumes[target] = userVolume !== null ? userVolume : 100;
          if (userVolume === null) {
            logger.warn('DuckingEngine: no live or persisted volume available, using 100', {
              target,
            });
          } else {
            logger.debug('DuckingEngine: sink-input absent, using persisted user volume', {
              target, volume: userVolume,
            });
          }
        }
      }
    } catch (err) {
      // getVolume threw — fall back to persisted user volume (not hardcoded 100)
      if (this._preDuckVolumes[target] === undefined) {
        const userVolume = this._port.getUserVolume(target);
        this._preDuckVolumes[target] = userVolume !== null ? userVolume : 100;
        logger.warn('DuckingEngine: failed to capture pre-duck volume, using user/default', {
          target, fallback: this._preDuckVolumes[target], error: err.message,
        });
      }
    }
  }

  /**
   * Calculate the effective ducked volume for a target stream.
   * Uses the lowest 'to' value among all active source TYPES (not instances).
   *
   * @param {string} target
   * @returns {number}
   * @private
   */
  _calculateEffectiveVolume(target) {
    const activeSources = this.getActiveSources(target);

    const matchingVolumes = this._rules
      .filter(rule => rule.duck === target && activeSources.includes(rule.when))
      .map(rule => rule.to);

    return matchingVolumes.length === 0 ? 100 : Math.min(...matchingVolumes);
  }

  /**
   * Get the restore volume for a target.
   * E3 semantics: return captured pre-duck volume; fallback to getUserVolume().
   * Hardcoded 100 is the last resort when BOTH are unavailable.
   *
   * @param {string} target
   * @returns {number}
   * @private
   */
  _getRestoreVolume(target) {
    if (this._preDuckVolumes[target] !== undefined) {
      return this._preDuckVolumes[target];
    }
    // F-SHOW-05/27: fall back to persisted user volume, not hardcoded 100
    const userVolume = this._port.getUserVolume(target);
    if (userVolume !== null) {
      return userVolume;
    }
    // Last resort: no live capture, no persisted volume
    logger.warn('DuckingEngine: no pre-duck or user volume available, restoring to 100', {
      target,
    });
    return 100;
  }

  /**
   * Emit the ducking:changed event via the registered callback.
   * @private
   */
  _emitChanged(target, ducked, volume, activeSources) {
    if (!this._onDuckingChanged) return;

    const sources = activeSources !== undefined
      ? activeSources
      : this.getActiveSources(target);

    let restoredVolume = volume;
    if (ducked) {
      if (this._preDuckVolumes[target] !== undefined) {
        restoredVolume = this._preDuckVolumes[target];
      } else {
        restoredVolume = this._port.getUserVolume(target) ?? 100;
      }
    }

    this._onDuckingChanged({
      stream: target,
      ducked,
      volume,
      activeSources: sources,
      restoredVolume,
    });
  }
}

module.exports = DuckingEngine;
