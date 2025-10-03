/**
 * Response Builder Utility
 * Standardizes HTTP response construction across all routes
 * Eliminates 74 manual response constructions (Finding #3)
 */

/**
 * Build success response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 */
function success(res, data, statusCode = 200) {
  return res.status(statusCode).json(data);
}

/**
 * Build error response
 * @param {Object} res - Express response object
 * @param {string} errorCode - Error code (e.g., 'VALIDATION_ERROR', 'AUTH_REQUIRED')
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {Object} additionalData - Additional data to include in response
 */
function error(res, errorCode, message, statusCode = 500, additionalData = {}) {
  return res.status(statusCode).json({
    error: errorCode,
    message,
    ...additionalData
  });
}

/**
 * Common error response builders
 */
const errors = {
  /**
   * 400 Validation Error
   */
  validation: (res, message, details = null) => {
    const response = {
      error: 'VALIDATION_ERROR',
      message
    };
    if (details) {
      response.details = details;
    }
    return res.status(400).json(response);
  },

  /**
   * 401 Authentication Required
   */
  authRequired: (res, message = 'Authentication required') => {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message
    });
  },

  /**
   * 403 Permission Denied
   */
  permissionDenied: (res, message = 'Permission denied') => {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message
    });
  },

  /**
   * 404 Not Found
   */
  notFound: (res, message = 'Resource not found') => {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message
    });
  },

  /**
   * 409 Conflict
   */
  conflict: (res, message, data = {}) => {
    return res.status(409).json({
      status: 'rejected',
      message,
      ...data
    });
  },

  /**
   * 500 Internal Server Error
   */
  internal: (res, message = 'Internal server error') => {
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message
    });
  },

  /**
   * 503 Service Unavailable
   */
  serviceUnavailable: (res, message, data = {}) => {
    return res.status(503).json({
      status: 'error',
      message,
      ...data
    });
  }
};

module.exports = {
  success,
  error,
  errors
};
