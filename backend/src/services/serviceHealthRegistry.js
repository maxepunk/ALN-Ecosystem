/**
 * Service Health Registry
 * Centralized health tracking for all services. Services push state in,
 * consumers read it out. Not a god object — it's a bulletin board.
 *
 * Emits: 'health:changed' { serviceId, status, message, previousStatus }
 */

'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');

const KNOWN_SERVICES = ['vlc', 'spotify', 'sound', 'bluetooth', 'audio', 'lighting', 'gameclock', 'cueengine'];

class ServiceHealthRegistry extends EventEmitter {
  constructor() {
    super();
    this._services = new Map();

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
   * Check if a service is healthy. Returns false for unknown services.
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
   * Reset all services to 'down' (used in system reset and testing).
   */
  reset() {
    for (const id of KNOWN_SERVICES) {
      const current = this._services.get(id);
      if (current.status !== 'down') {
        this._services.set(id, {
          status: 'down',
          message: 'Reset',
          lastChecked: new Date()
        });
        this.emit('health:changed', {
          serviceId: id,
          status: 'down',
          message: 'Reset',
          previousStatus: current.status
        });
      }
    }
  }
}

module.exports = new ServiceHealthRegistry();
