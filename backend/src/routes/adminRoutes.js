/**
 * Admin Routes
 * Handles admin authentication and control endpoints
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const config = require('../config');
const { generateAdminToken, requireAdmin, verifyToken } = require('../middleware/auth');
const sessionService = require('../services/sessionService');
const stateService = require('../services/stateService');
const fs = require('fs').promises;
const path = require('path');

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
router.post('/reset-scores', requireAdmin, async (req, res) => {
  try {

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

    logger.info('Scores reset by admin', { admin: req.admin?.id });

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
router.post('/clear-transactions', requireAdmin, async (req, res) => {
  try {

    // Clear transactions
    const sessionService = require('../services/sessionService');
    const session = sessionService.getCurrentSession();
    if (session) {
      session.transactions = [];
      await sessionService.updateSession({ transactions: [] });
    }

    logger.info('Transactions cleared by admin', { admin: req.admin?.id });

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
router.post('/stop-all-videos', requireAdmin, async (req, res) => {
  try {

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

    logger.info('All videos stopped by admin', { admin: req.admin?.id });

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
router.post('/offline-mode', requireAdmin, async (req, res) => {
  try {

    const { enabled } = req.body;
    const offlineQueueService = require('../services/offlineQueueService');

    if (enabled) {
      offlineQueueService.setOfflineStatus(true);
    } else {
      offlineQueueService.setOfflineStatus(false);
      // Process any queued items
      await offlineQueueService.processQueue();
    }

    logger.info('Offline mode toggled by admin', {
      admin: req.admin?.id,
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
 * GET /api/admin/sessions - List all sessions
 */
router.get('/sessions', requireAdmin, async (req, res) => {
  try {
    const sessions = await sessionService.getAllSessions();
    res.json({
      status: 'success',
      data: sessions
    });
  } catch (error) {
    logger.error('Failed to list sessions', { error });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/session/:id - Delete a session
 */
router.delete('/session/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const session = await sessionService.getSession(id);

    if (!session) {
      return res.status(404).json({
        status: 'error',
        error: 'Session not found'
      });
    }

    // End session properly
    if (session.active) {
      await sessionService.endSession(id);
    }

    // Remove from persistence
    await sessionService.deleteSession(id);

    res.json({
      status: 'success',
      data: { message: 'Session deleted' }
    });
  } catch (error) {
    logger.error('Failed to delete session', { error, sessionId: req.params.id });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/devices - List connected devices
 */
router.get('/devices', requireAdmin, async (req, res) => {
  try {
    // Get io instance from app.locals
    const io = req.app.locals.io || null;
    if (!io) {
      return res.json({
        status: 'success',
        data: []
      });
    }

    const sockets = await io.fetchSockets();
    const devices = sockets.map(socket => ({
      id: socket.id,
      deviceType: socket.data?.deviceType || 'unknown',
      deviceName: socket.data?.deviceName || 'Unknown Device',
      roomId: socket.data?.roomId || null,
      connected: true,
      connectedAt: socket.data?.connectedAt || null
    }));

    res.json({
      status: 'success',
      data: devices
    });
  } catch (error) {
    logger.error('Failed to list devices', { error });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/reset - Reset system
 */
router.post('/reset', requireAdmin, async (req, res) => {
  try {
    logger.info('Admin initiated system reset');

    // End all active sessions
    const sessions = await sessionService.getAllSessions();
    for (const session of sessions) {
      if (session.active) {
        await sessionService.endSession(session.id);
      }
    }

    // Clear all sessions
    await sessionService.clearAllSessions();

    // Reset state service
    stateService.resetState();

    // Disconnect all WebSocket clients
    const io = req.app.locals.io || null;
    if (io) {
      io.disconnectSockets(true);
    }

    // Clear logs if requested
    if (req.body.clearLogs) {
      const logsDir = path.join(process.cwd(), 'logs');
      try {
        const files = await fs.readdir(logsDir);
        await Promise.all(
          files.map(file => fs.unlink(path.join(logsDir, file)))
        );
      } catch (error) {
        logger.warn('Failed to clear logs', { error });
      }
    }

    res.json({
      status: 'success',
      data: { message: 'System reset complete' }
    });
  } catch (error) {
    logger.error('Failed to reset system', { error });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/logs - Get system logs
 */
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const { level = 'info', limit = 100, offset = 0 } = req.query;

    // In production, this would read from actual log files
    // For now, return recent logs from memory
    const logs = logger.getRecentLogs ?
      logger.getRecentLogs(parseInt(limit), parseInt(offset), level) :
      [];

    res.json({
      status: 'success',
      data: {
        logs,
        total: logs.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Failed to get logs', { error });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/config - Update configuration
 */
router.post('/config', requireAdmin, async (req, res) => {
  try {
    const updates = req.body;

    // Validate configuration updates
    const allowedKeys = [
      'vlcHost',
      'vlcPort',
      'vlcPassword',
      'maxSessions',
      'sessionTimeout',
      'heartbeatInterval',
      'syncInterval',
      'logLevel'
    ];

    const invalidKeys = Object.keys(updates).filter(
      key => !allowedKeys.includes(key)
    );

    if (invalidKeys.length > 0) {
      return res.status(400).json({
        status: 'error',
        error: `Invalid configuration keys: ${invalidKeys.join(', ')}`
      });
    }

    // Apply configuration updates
    Object.keys(updates).forEach(key => {
      if (config[key] !== undefined) {
        config[key] = updates[key];
        logger.info('Configuration updated', { key, value: updates[key] });
      }
    });

    // Save configuration to file if needed
    if (config.persistConfig) {
      const configPath = path.join(process.cwd(), 'config.json');
      await fs.writeFile(
        configPath,
        JSON.stringify(config, null, 2)
      );
    }

    res.json({
      status: 'success',
      data: { message: 'Configuration updated', updates }
    });
  } catch (error) {
    logger.error('Failed to update configuration', { error });
    res.status(500).json({
      status: 'error',
      error: error.message
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