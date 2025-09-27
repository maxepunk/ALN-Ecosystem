/**
 * Admin Routes
 * Handles admin authentication and control endpoints
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const config = require('../config');
const { generateAdminToken } = require('../middleware/auth');

/**
 * POST /api/admin/auth
 * Authenticate as admin
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

    // Simple password check (in production, use proper authentication)
    if (password !== config.security.adminPassword) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Authentication failed',
      });
    }
    
    // Generate JWT token
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
 * POST /api/admin/reset-scores
 * Reset all team scores (requires admin auth)
 */
router.post('/reset-scores', async (req, res) => {
  try {
    // Verify admin token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Authentication required',
      });
    }

    const authMiddleware = require('../middleware/auth');
    const token = authHeader.substring(7);
    const decoded = authMiddleware.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Invalid or expired token',
      });
    }

    // Reset scores through transaction service
    const transactionService = require('../services/transactionService');
    transactionService.resetScores();

    // Update state
    const sessionService = require('../services/sessionService');
    const session = sessionService.getCurrentSession();
    if (session) {
      session.scores = [];
      await sessionService.updateSession({ scores: [] });
    }

    logger.info('Scores reset by admin', { admin: decoded.sub });

    res.json({
      success: true,
      message: 'Scores reset successfully',
    });
  } catch (error) {
    logger.error('Reset scores endpoint error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to reset scores',
    });
  }
});

/**
 * POST /api/admin/clear-transactions
 * Clear transaction history (requires admin auth)
 */
router.post('/clear-transactions', async (req, res) => {
  try {
    // Verify admin token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Authentication required',
      });
    }

    const authMiddleware = require('../middleware/auth');
    const token = authHeader.substring(7);
    const decoded = authMiddleware.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Invalid or expired token',
      });
    }

    // Clear transactions
    const sessionService = require('../services/sessionService');
    const session = sessionService.getCurrentSession();
    if (session) {
      session.transactions = [];
      await sessionService.updateSession({ transactions: [] });
    }

    logger.info('Transactions cleared by admin', { admin: decoded.sub });

    res.json({
      success: true,
      message: 'Transactions cleared successfully',
    });
  } catch (error) {
    logger.error('Clear transactions endpoint error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to clear transactions',
    });
  }
});

/**
 * POST /api/admin/stop-all-videos
 * Stop all video playback (requires admin auth)
 */
router.post('/stop-all-videos', async (req, res) => {
  try {
    // Verify admin token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Authentication required',
      });
    }

    const authMiddleware = require('../middleware/auth');
    const token = authHeader.substring(7);
    const decoded = authMiddleware.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Invalid or expired token',
      });
    }

    // Stop all videos
    const videoQueueService = require('../services/videoQueueService');
    const vlcService = require('../services/vlcService');

    // Skip current video if playing
    if (videoQueueService.currentItem) {
      await videoQueueService.skipCurrent();
    }

    // Clear queue
    videoQueueService.clearQueue();

    // Stop VLC directly
    try {
      await vlcService.stop();
    } catch (vlcError) {
      logger.warn('VLC stop failed', { error: vlcError });
    }

    logger.info('All videos stopped by admin', { admin: decoded.sub });

    res.json({
      success: true,
      message: 'All videos stopped',
    });
  } catch (error) {
    logger.error('Stop all videos endpoint error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to stop videos',
    });
  }
});

/**
 * POST /api/admin/offline-mode
 * Toggle offline mode (requires admin auth)
 */
router.post('/offline-mode', async (req, res) => {
  try {
    // Verify admin token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Authentication required',
      });
    }

    const authMiddleware = require('../middleware/auth');
    const token = authHeader.substring(7);
    const decoded = authMiddleware.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Invalid or expired token',
      });
    }

    const { enabled } = req.body;
    const offlineQueueService = require('../services/offlineQueueService');

    if (enabled) {
      offlineQueueService.enableOfflineMode();
    } else {
      offlineQueueService.disableOfflineMode();
      // Process any queued items
      await offlineQueueService.processQueue();
    }

    logger.info('Offline mode toggled by admin', {
      admin: decoded.sub,
      enabled: !!enabled
    });

    res.json({
      success: true,
      message: `Offline mode ${enabled ? 'enabled' : 'disabled'}`,
      offlineMode: offlineQueueService.isOffline,
    });
  } catch (error) {
    logger.error('Offline mode endpoint error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to toggle offline mode',
    });
  }
});

/**
 * Handle unsupported methods
 */
router.all('/auth', (req, res) => {
  res.status(405).json({
    error: 'METHOD_NOT_ALLOWED',
    message: 'Method not allowed',
  });
});

module.exports = router;