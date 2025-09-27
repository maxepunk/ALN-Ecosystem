/**
 * Offline Status Middleware
 * Adds offline status information to requests and responses
 *
 * This is a stub implementation for T023
 * Will be fully implemented when offline mode is developed
 */

// Store reference to the service to ensure we use the same instance
let offlineQueueServiceInstance = null;

/**
 * Initialize the middleware with the service instance
 * @param {Object} service - The offline queue service instance
 */
function initializeWithService(service) {
  offlineQueueServiceInstance = service;
}

/**
 * Get the offline queue service instance
 * @returns {Object} The service instance
 */
function getService() {
  if (!offlineQueueServiceInstance) {
    // Fallback to requiring it if not initialized (for backwards compatibility)
    offlineQueueServiceInstance = require('../services/offlineQueueService');
  }
  return offlineQueueServiceInstance;
}

/**
 * Middleware to check and inject offline status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function offlineStatusMiddleware(req, res, next) {
  // ALWAYS use the service as single source of truth
  const offlineQueueService = getService();
  req.isOffline = offlineQueueService.isOffline || false;

  // Add offline status to response locals
  res.locals.offlineMode = req.isOffline;

  next();
}

/**
 * Check if system is currently offline
 * @returns {boolean} - True if system is offline
 */
function isOffline() {
  // Use service as single source of truth
  const offlineQueueService = getService();
  return offlineQueueService.isOffline || false;
}

/**
 * Set offline status
 * @param {boolean} offline - Whether system is offline
 */
function setOfflineStatus(offline) {
  // Update the service
  const offlineQueueService = getService();
  offlineQueueService.setOfflineStatus(offline);
}

module.exports = {
  offlineStatusMiddleware,
  isOffline,
  setOfflineStatus,
  initializeWithService
};