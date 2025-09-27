/**
 * Event Listener Registry
 * Tracks all event listeners added to services to prevent accumulation during tests
 *
 * This includes both broadcast listeners and cross-service listeners
 */

const logger = require('../utils/logger');

class ListenerRegistry {
  constructor() {
    this.listeners = new Map(); // service -> [{ event, handler, originalHandler }]
    this.enabled = process.env.NODE_ENV === 'test';
  }

  /**
   * Track an event listener on a service
   * @param {EventEmitter} service - The service instance
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   * @param {Function} originalHandler - Original unwrapped handler (optional)
   */
  trackListener(service, event, handler, originalHandler = handler) {
    if (!this.enabled) return;

    const serviceName = service.constructor.name;
    if (!this.listeners.has(service)) {
      this.listeners.set(service, []);
    }

    const entry = { event, handler, originalHandler };
    this.listeners.get(service).push(entry);

    logger.debug('Tracked listener', {
      service: serviceName,
      event,
      totalListeners: this.listeners.get(service).length
    });
  }

  /**
   * Remove all tracked listeners from all services
   */
  cleanup() {
    if (!this.enabled) {
      logger.debug('Listener registry cleanup skipped - not enabled');
      return;
    }

    let totalRemoved = 0;
    const serviceNames = [];

    for (const [service, listeners] of this.listeners) {
      const serviceName = service.constructor.name;
      serviceNames.push(`${serviceName}(${listeners.length})`);

      for (const { event, handler } of listeners) {
        try {
          service.removeListener(event, handler);
          totalRemoved++;
        } catch (error) {
          logger.warn('Failed to remove listener', {
            service: serviceName,
            event,
            error: error.message
          });
        }
      }
      listeners.length = 0; // Clear the array
    }

    logger.info('Listener registry cleanup completed', {
      totalRemoved,
      services: serviceNames.join(', '),
      enabled: this.enabled
    });
    this.listeners.clear();
  }

  /**
   * Get listener counts for debugging
   * @returns {Object} Service name -> listener count
   */
  getListenerCounts() {
    const counts = {};
    for (const [service, listeners] of this.listeners) {
      const serviceName = service.constructor.name;
      counts[serviceName] = listeners.length;
    }
    return counts;
  }

  /**
   * Force enable/disable tracking (for testing)
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Helper function to add and track event listeners
   * @param {EventEmitter} targetService - Service to add listener to
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {string} context - Context for debugging (e.g., 'stateService->transactionService')
   */
  addTrackedListener(targetService, event, handler, context = 'unknown') {
    targetService.on(event, handler);
    this.trackListener(targetService, event, handler);

    if (this.enabled) {
      logger.debug('Added tracked cross-service listener', {
        context,
        targetService: targetService.constructor.name,
        event,
        totalListeners: targetService.listenerCount(event)
      });
    }
  }
}

// Singleton instance
const listenerRegistry = new ListenerRegistry();

module.exports = listenerRegistry;