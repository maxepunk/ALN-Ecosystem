/**
 * Admin Routes - Authentication and Logging
 * Per Decision #1: Keep only auth + logs (admin intervention → WebSocket)
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const config = require('../config');
const { generateAdminToken, requireAdmin } = require('../middleware/auth');

/**
 * POST /api/admin/auth
 * Authenticate as admin and receive JWT token
 * Contract: openapi.yaml /api/admin/auth response schema
 */
router.post('/auth', async (req, res) => {
  try {
    const { password } = req.body;

    // Validate password is a non-empty string
    if (!password || typeof password !== 'string' || password === '') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'password is required',
      });
    }

    // Verify password against configured admin password
    if (password !== config.security.adminPassword) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Authentication failed',
      });
    }

    // Generate JWT token for WebSocket authentication
    const token = generateAdminToken('admin');

    res.json({
      token: token,
      expiresIn: 86400  // 24 hours in seconds
    });
  } catch (error) {
    logger.error('Admin auth endpoint error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
});

/**
 * GET /api/admin/logs
 * Get system logs for troubleshooting
 * Contract: openapi.yaml /api/admin/logs response schema
 */
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const {
      lines = 100,  // Default 100 lines (per OpenAPI contract)
      level = 'error'  // Default error level (per OpenAPI contract)
    } = req.query;

    // Validate lines parameter
    const linesInt = parseInt(lines);
    if (isNaN(linesInt) || linesInt < 1 || linesInt > 500) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'lines must be between 1 and 500'
      });
    }

    // Validate level parameter
    if (!['error', 'warn', 'info'].includes(level)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'level must be one of: error, warn, info'
      });
    }

    // Get logs from logger (in-memory recent logs)
    const recentLogs = logger.getRecentLogs ?
      logger.getRecentLogs(linesInt, 0, level) :
      [];

    // Format logs as array of strings (per OpenAPI contract)
    const formattedLogs = recentLogs.map(log => {
      // Convert log object to string format: "timestamp [LEVEL] message"
      const timestamp = log.timestamp || new Date().toISOString();
      const logLevel = (log.level || 'info').toUpperCase();
      const message = log.message || '';
      return `${timestamp} [${logLevel}] ${message}`;
    });

    // Response per OpenAPI contract
    res.json({
      logs: formattedLogs,
      count: formattedLogs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get logs', { error });
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve logs'
    });
  }
});

module.exports = router;
