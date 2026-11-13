/**
 * Service Health Registry
 * Centralized health tracking for all services. Services push state in,
 * consumers read it out. Not a god object — it's a bulletin board.
 *
 * The vocabulary is exactly THREE words (Block 2 T1a, plan §3 pin P5):
 *   healthy — probed and answering
 *   down    — expected to run and not running: a FAULT, red, act now
 *   dormant — nobody expected it tonight (the profile did not install its
 *             equipment family) or a human latched it out. Latched: never
 *             red, never probed, and `report()` from the service itself is
 *             IGNORED while the latch holds — a lighting service that keeps
 *             reporting "Home Assistant unreachable" for a venue with no
 *             lighting rig must not repaint the dashboard red every 15s
 *             (CONTEXT.md §4, alarm integrity).
 *
 * A dormant entry carries `door` — which of the two doors latched it —
 * and that is the ONLY status that carries it. `dormancyWording.doorWording`
 * turns the door into the sentence every surface says.
 *
 * Emits: 'health:changed' { serviceId, status, message, previousStatus }
 */

'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');

// `display` is the NINTH service (plan §3 pin P16): the scoreboard kiosk,
// owned by utils/displayDriver.js. It has no HEALTH_CHECKS entry — the
// driver reports its own transitions; nothing probes it on a timer.
const KNOWN_SERVICES = ['vlc', 'music', 'sound', 'bluetooth', 'audio', 'lighting', 'gameclock', 'cueengine', 'display'];

/** The whole health vocabulary. The contracts quote this list (D11). */
const HEALTH_STATUSES = Object.freeze(['healthy', 'down', 'dormant']);

/** The two doors a service can be dormant behind. */
const DOORS = Object.freeze(['profile', 'operator']);

class ServiceHealthRegistry extends EventEmitter {
  constructor() {
    super();
    this._services = new Map();
    this._revalidationTimer = null;

    // Initialize all known services as down
    for (const id of KNOWN_SERVICES) {
      this._services.set(id, {
        status: 'down',
        message: 'Not yet checked',
        lastChecked: null
      });
    }
  }

  /**
   * Called by services when their health changes.
   * Only emits 'health:changed' when status actually changes.
   *
   * Services report `healthy` or `down` and nothing else — `dormant` is not
   * a service's to claim, it is latched from outside via markDormant(). A
   * report that arrives while the entry is dormant is IGNORED (the latch
   * wins; see the file header).
   */
  report(serviceId, status, message = '') {
    if (!KNOWN_SERVICES.includes(serviceId)) {
      logger.warn(`Unknown service reported health: ${serviceId}`);
      return;
    }

    if (status !== 'healthy' && status !== 'down') {
      logger.warn(`Invalid health status for ${serviceId}: ${status}`);
      return;
    }

    const current = this._services.get(serviceId);

    // The sticky latch (P5). Debug, not warn: out-of-band reports from a
    // dormant service's own retry loop are EXPECTED and constant — lighting
    // alone has three independent report sites.
    if (current.status === 'dormant') {
      logger.debug(
        `Ignoring health report for dormant service ${serviceId}: ` +
        `${status} (latched by the ${current.door} door)`
      );
      return;
    }

    const previousStatus = current.status;

    this._services.set(serviceId, {
      status,
      message,
      lastChecked: new Date()
    });

    if (previousStatus !== status) {
      logger.info(`Service health changed: ${serviceId} ${previousStatus} → ${status}`, { message });
      this.emit('health:changed', {
        serviceId,
        status,
        message,
        previousStatus
      });
    }
  }

  /**
   * Latch a service DORMANT behind one of the two doors (P5).
   * Idempotent: re-marking with the same door is silent; changing the door
   * (profile → operator, or back) emits.
   * @param {string} serviceId
   * @param {'profile'|'operator'} door
   * @param {string} reason - the stored message (build it from doorWording)
   */
  markDormant(serviceId, door, reason = '') {
    if (!KNOWN_SERVICES.includes(serviceId)) {
      logger.warn(`Cannot mark unknown service dormant: ${serviceId}`);
      return;
    }
    if (!DOORS.includes(door)) {
      logger.warn(`Cannot mark ${serviceId} dormant behind unknown door: ${door}`);
      return;
    }

    const current = this._services.get(serviceId);
    const previousStatus = current.status;
    const previousDoor = current.door;

    this._services.set(serviceId, {
      status: 'dormant',
      message: reason,
      lastChecked: new Date(),
      door,
    });

    if (previousStatus !== 'dormant' || previousDoor !== door) {
      logger.info(
        `Service health changed: ${serviceId} ${previousStatus} → dormant (${door} door)`,
        { message: reason }
      );
      this.emit('health:changed', {
        serviceId,
        status: 'dormant',
        message: reason,
        previousStatus,
      });
    }
  }

  /**
   * Release a dormancy latch. The service does NOT become healthy — a probe
   * decides that. It becomes `down / awaiting first check`, which is the
   * honest state: expected to run again, not yet seen running.
   * @param {string} serviceId
   */
  clearDormant(serviceId) {
    if (!KNOWN_SERVICES.includes(serviceId)) {
      logger.warn(`Cannot clear dormancy for unknown service: ${serviceId}`);
      return;
    }
    const current = this._services.get(serviceId);
    if (current.status !== 'dormant') return;

    this._services.set(serviceId, {
      status: 'down',
      message: 'awaiting first check',
      lastChecked: new Date(),
    });
    logger.info(`Service health changed: ${serviceId} dormant → down`, {
      message: 'awaiting first check',
    });
    this.emit('health:changed', {
      serviceId,
      status: 'down',
      message: 'awaiting first check',
      previousStatus: 'dormant',
    });
  }

  /**
   * Is this service latched dormant? False for unknown services.
   */
  isDormant(serviceId) {
    const entry = this._services.get(serviceId);
    return entry ? entry.status === 'dormant' : false;
  }

  /**
   * Check if a service is healthy. Returns false for unknown services,
   * and false for a dormant one (dormant is not healthy — it is absent).
   */
  isHealthy(serviceId) {
    const entry = this._services.get(serviceId);
    return entry ? entry.status === 'healthy' : false;
  }

  /**
   * Get full status for a service.
   */
  getStatus(serviceId) {
    return this._services.get(serviceId) || null;
  }

  /**
   * Get current health state snapshot. Alias for getSnapshot().
   * @returns {Object} Health state keyed by service ID
   */
  getState() {
    return this.getSnapshot();
  }

  /**
   * Get snapshot of all service health for sync:full payloads.
   * Returns a plain object (not Map) for JSON serialization.
   */
  getSnapshot() {
    const snapshot = {};
    for (const [id, entry] of this._services) {
      snapshot[id] = { ...entry };
    }
    return snapshot;
  }

  /**
   * Start periodic health revalidation.
   * Calls each service's health check method on an interval.
   * Catches errors per-service so one failure doesn't block others.
   *
   * @param {Object} services - Map of service references
   * @param {number} [intervalMs=15000] - Revalidation interval in ms
   */
  startRevalidation(services, intervalMs = 15000) {
    this.stopRevalidation();

    const HEALTH_CHECKS = {
      vlc: () => services.vlc?.checkConnection(),
      music: () => services.music?.checkConnection(),
      sound: () => services.sound?.checkHealth(),
      bluetooth: () => services.bluetooth?.checkHealth(),
      audio: () => services.audio?.checkHealth(),
      lighting: () => services.lighting?.checkConnection(),
      // gameclock + cueengine are always healthy (in-process) — skip
    };

    this._revalidationTimer = setInterval(async () => {
      await Promise.allSettled(
        Object.entries(HEALTH_CHECKS).map(async ([id, check]) => {
          // Never probe a dormant service (P5): the probe is noise for
          // equipment nobody installed, and its answer would fight the latch.
          if (this.isDormant(id)) return;
          try {
            await check();
          } catch (err) {
            logger.warn(`Health revalidation failed for ${id}`, { error: err.message });
          }
        })
      );
    }, intervalMs);

    logger.info(`Health revalidation started (${intervalMs}ms interval)`);
  }

  /**
   * Stop periodic health revalidation.
   */
  stopRevalidation() {
    if (this._revalidationTimer) {
      clearInterval(this._revalidationTimer);
      this._revalidationTimer = null;
    }
  }

  /**
   * Reset all NON-DORMANT services to 'down' (used in system reset and testing).
   *
   * Dormancy survives a system reset (Sm-4 / DoD i): the TV did not come
   * back to life because a GM pressed Reset, and the profile still does not
   * install the lighting rig. Both doors' latches are preserved unchanged.
   */
  reset() {
    this.stopRevalidation();
    // Route through report() so each transition is LOGGED (a silent reset hid
    // the music outage in 0523game) as well as emitted. report() no-ops any
    // service already 'down', preserving the prior "only emit on change" semantics.
    // report() also no-ops a dormant entry, but skipping explicitly keeps the
    // intent visible and the debug log quiet.
    for (const id of KNOWN_SERVICES) {
      if (this.isDormant(id)) continue;
      this.report(id, 'down', 'Reset');
    }
  }
}

const registry = new ServiceHealthRegistry();
registry.KNOWN_SERVICES = KNOWN_SERVICES;
registry.HEALTH_STATUSES = HEALTH_STATUSES;
registry.DOORS = DOORS;

module.exports = registry;
