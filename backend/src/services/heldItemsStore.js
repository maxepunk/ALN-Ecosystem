'use strict';

/**
 * HeldItemsStore
 *
 * Unified held-item store replacing the near-duplicate hold implementations
 * in cueEngineService._heldCues and videoQueueService._heldVideos.
 *
 * Fixes F-SHOW-16:
 *   - held:release-all midway-abort: releaseAll() tries ALL items and returns
 *     per-item results rather than aborting on first failure.
 *   - video-cue releases re-holding each other: callers own the re-fire logic;
 *     the store only tracks status.
 *   - conflictTimers keyed by heldId (not cueId): prevents collision when the
 *     same cue is held twice (two distinct heldIds, two distinct timers).
 *
 * Usage:
 *   The store is a class (not a singleton) so callers can own their instance.
 *   cueEngineService and videoQueueService each hold their own instance, but
 *   commandExecutor can delegate to a shared view via buildHeldItemsState().
 *   The id counter IS shared (module-level) so cue and video IDs never collide.
 */

const logger = require('../utils/logger');

/** @type {number} Module-level counter for globally unique held IDs */
let _globalHeldIdCounter = 0;

/**
 * Reset the global ID counter (for tests that need deterministic IDs).
 * @internal
 */
function _resetCounterForTests() {
  _globalHeldIdCounter = 0;
}

class HeldItemsStore {
  constructor() {
    /** @type {Array<Object>} All currently held items */
    this._items = [];
    /**
     * Auto-discard timers keyed by heldId (NOT cueId).
     * Using heldId prevents collision when same cue is held twice.
     * @type {Map<string, NodeJS.Timeout>}
     */
    this._autoDiscardTimers = new Map();
  }

  /**
   * Add a new held item to the store.
   *
   * @param {Object} params
   * @param {'cue'|'video'} params.type - Item type
   * @param {string} [params.cueId] - Cue ID (for type='cue')
   * @param {string} [params.trigger] - Trigger provenance (for type='cue')
   * @param {Set|null} [params.parentChain] - Parent chain (for type='cue')
   * @param {string[]} [params.blockedBy] - Services that are down
   * @param {string} [params.reason='service_down'] - Why the item is held
   * @param {string} [params.tokenId] - Token ID (for type='video')
   * @param {string} [params.videoFile] - Video file path (for type='video')
   * @param {string} [params.requestedBy] - Who requested (for type='video')
   * @param {string} [params.queueItemId] - Queue item ID (for type='video')
   * @returns {Object} The held item record
   */
  holdItem({
    type,
    cueId,
    trigger,
    parentChain,
    blockedBy = [],
    reason = 'service_down',
    tokenId,
    videoFile,
    requestedBy,
    queueItemId,
    ...extras
  }) {
    const held = {
      id: `held-${++_globalHeldIdCounter}`,
      type,
      heldAt: new Date().toISOString(),
      reason,
      status: 'held',
      blockedBy,
    };

    if (type === 'cue') {
      held.cueId = cueId;
      held.trigger = trigger || null;
      held.parentChain = parentChain || null;
    } else if (type === 'video') {
      held.tokenId = tokenId;
      held.videoFile = videoFile;
      held.requestedBy = requestedBy;
      held.queueItemId = queueItemId;
    }

    // Merge any extra properties (e.g., currentVideo for video_busy cues)
    Object.assign(held, extras);

    this._items.push(held);
    logger.info('[HeldItemsStore] Item held', { heldId: held.id, type, reason });
    return held;
  }

  /**
   * Get all currently held items (copy).
   * @returns {Array<Object>}
   */
  getAll() {
    return [...this._items];
  }

  /**
   * Get held items filtered by type.
   * @param {'cue'|'video'} type
   * @returns {Array<Object>}
   */
  getByType(type) {
    return this._items.filter(i => i.type === type);
  }

  /**
   * Find a held item by ID.
   * @param {string} heldId
   * @returns {Object|undefined}
   */
  find(heldId) {
    return this._items.find(i => i.id === heldId);
  }

  /**
   * Remove and return a held item, marking it as released.
   * @param {string} heldId
   * @returns {Object} The released item
   * @throws {Error} If not found
   */
  release(heldId) {
    const idx = this._items.findIndex(i => i.id === heldId);
    if (idx === -1) throw new Error(`Held item not found: ${heldId}`);

    const held = this._items.splice(idx, 1)[0];
    held.status = 'released';
    this._clearTimer(heldId);
    logger.info('[HeldItemsStore] Item released', { heldId, type: held.type });
    return held;
  }

  /**
   * Remove and return a held item, marking it as discarded.
   * @param {string} heldId
   * @returns {Object} The discarded item
   * @throws {Error} If not found
   */
  discard(heldId) {
    const idx = this._items.findIndex(i => i.id === heldId);
    if (idx === -1) throw new Error(`Held item not found: ${heldId}`);

    const held = this._items.splice(idx, 1)[0];
    held.status = 'discarded';
    this._clearTimer(heldId);
    logger.info('[HeldItemsStore] Item discarded', { heldId, type: held.type });
    return held;
  }

  /**
   * Attempt to release ALL held items.
   * F-SHOW-16 fix: does NOT abort on first failure.
   * Each item is attempted independently; per-item results are returned.
   *
   * @param {function(Object): Promise<void>} releaseFn
   *   Called with each held item. Should perform the actual release action.
   *   If it throws, that item is left held and reported as failed.
   * @returns {Promise<Array<{id: string, success: boolean, error?: string}>>}
   */
  async releaseAll(releaseFn) {
    const snapshot = [...this._items]; // work from snapshot
    const results = [];

    for (const item of snapshot) {
      try {
        await releaseFn(item);
        // Release from store (may already be gone if releaseFn called release())
        if (this._items.some(i => i.id === item.id)) {
          this.release(item.id);
        }
        results.push({ id: item.id, success: true });
      } catch (err) {
        logger.warn('[HeldItemsStore] releaseAll: item failed', { heldId: item.id, error: err.message });
        results.push({ id: item.id, success: false, error: err.message });
      }
    }

    return results;
  }

  /**
   * Discard all held items.
   */
  discardAll() {
    const ids = this._items.map(i => i.id);
    for (const id of ids) {
      this.discard(id);
    }
  }

  /**
   * Clear all held items without status change (for reset).
   */
  clear() {
    for (const id of this._autoDiscardTimers.keys()) {
      clearTimeout(this._autoDiscardTimers.get(id));
    }
    this._autoDiscardTimers.clear();
    this._items = [];
  }

  /**
   * Register an auto-discard timer for a held item.
   * Keyed by heldId (not cueId) to prevent collision on double-hold.
   *
   * @param {string} heldId
   * @param {function} discardFn - Called when the timer fires
   * @param {number} delayMs
   * @returns {NodeJS.Timeout} The timer
   */
  setAutoDiscard(heldId, discardFn, delayMs) {
    // Clear any existing timer for this heldId
    this._clearTimer(heldId);

    const timer = setTimeout(() => {
      this._autoDiscardTimers.delete(heldId);
      discardFn();
    }, delayMs);

    this._autoDiscardTimers.set(heldId, timer);
    return timer;
  }

  /**
   * Clear the auto-discard timer for a held item.
   * @param {string} heldId
   */
  _clearTimer(heldId) {
    if (this._autoDiscardTimers.has(heldId)) {
      clearTimeout(this._autoDiscardTimers.get(heldId));
      this._autoDiscardTimers.delete(heldId);
    }
  }

  /**
   * Reset store to empty state (for system reset).
   */
  reset() {
    this.clear();
  }
}

module.exports = HeldItemsStore;
module.exports._resetCounterForTests = _resetCounterForTests;
