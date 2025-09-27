/**
 * Admin panel routes for system management
 */
const express = require('express');
const sessionService = require('../services/sessionService');
const stateService = require('../services/stateService');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
// Socket server instance will be passed from app.js
const config = require('../config');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

/**
 * GET /api/admin/sessions - List all sessions
 */
router.get('/sessions', auth.requireAdmin, async (req, res) => {
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
router.delete('/session/:id', auth.requireAdmin, async (req, res) => {
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
router.get('/devices', auth.requireAdmin, async (req, res) => {
  try {
    // Get io instance from app.locals (cleaner than global)
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
router.post('/reset', auth.requireAdmin, async (req, res) => {
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
    // Get io instance from app.locals (cleaner than global)
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
router.get('/logs', auth.requireAdmin, async (req, res) => {
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
router.post('/config', auth.requireAdmin, async (req, res) => {
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

module.exports = router;