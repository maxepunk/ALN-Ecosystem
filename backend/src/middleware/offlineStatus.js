/**
 * Offline Status Middleware
 * Adds offline status information to requests and responses
 * 
 * This is a stub implementation for T023
 * Will be fully implemented when offline mode is developed
 */

/**
 * Middleware to check and inject offline status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function offlineStatusMiddleware(req, res, next) {
  // Check if global.offlineMode was set directly by tests
  // If so, sync it with the service
  const offlineQueueService = require('../services/offlineQueueService');
  if (global.offlineMode !== undefined && global.offlineMode !== offlineQueueService.isOffline) {
    offlineQueueService.setOfflineStatus(global.offlineMode);
  }

  // Use the service as source of truth
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
  // Stub implementation
  return global.offlineMode || false;
}

/**
 * Set offline status
 * @param {boolean} offline - Whether system is offline
 */
function setOfflineStatus(offline) {
  // Set global flag
  global.offlineMode = offline;

  // CRITICAL: Also update the offline queue service
  // This connects the test infrastructure to the actual offline functionality
  const offlineQueueService = require('../services/offlineQueueService');
  offlineQueueService.setOfflineStatus(offline);
}

module.exports = {
  offlineStatusMiddleware,
  isOffline,
  setOfflineStatus
};