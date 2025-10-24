/**
 * Health Routes with Device Heartbeat Tracking
 * Provides health check endpoint with optional device tracking
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');
const DeviceConnection = require('../models/deviceConnection');

/**
 * GET /health
 * Health check endpoint with optional device heartbeat tracking
 *
 * Query Parameters:
 *   - deviceId: (optional) Device identifier for heartbeat tracking
 *   - type: (optional) Device type ('player' or 'gm')
 *
 * When deviceId and type are provided, registers/updates device in current session
 * This provides a natural heartbeat mechanism for HTTP-only devices (like player scanner)
 */
router.get('/health', async (req, res) => {
  try {
    // Basic health check response
    const health = {
      status: 'online',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    // Optional device tracking via query params
    const { deviceId, type } = req.query;

    if (deviceId) {
      // Default to 'player' if type not provided (ESP32 devices, web-based player scanner)
      // Only GM scanners use WebSocket authentication, so HTTP /health without type = player
      const deviceType = type || 'player';

      // Validate device type
      if (deviceType !== 'player' && deviceType !== 'gm') {
        logger.warn('Invalid device type in health check', { deviceId, type: deviceType });
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Device type must be "player" or "gm"'
        });
      }

      // Track device heartbeat
      const deviceData = {
        id: deviceId,
        type: deviceType,
        name: deviceType === 'player' ? 'Player Scanner' : 'Device',
        ipAddress: req.ip,
        connectionTime: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        connectionStatus: 'connected'
      };

      const device = new DeviceConnection(deviceData);

      // Update device in current session (if session exists)
      const session = sessionService.getCurrentSession();
      if (session) {
        await sessionService.updateDevice(device.toJSON());

        logger.debug('Device heartbeat tracked', {
          deviceId,
          type: deviceType,
          sessionId: session.id
        });
      } else {
        // No session - device will be registered when session is created
        logger.debug('Device heartbeat received (no session)', {
          deviceId,
          type: deviceType
        });
      }
    }

    res.json(health);
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

module.exports = router;
