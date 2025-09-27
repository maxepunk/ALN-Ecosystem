/**
 * State Routes
 * Handles game state endpoints
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const crypto = require('crypto');
const logger = require('../utils/logger');
const stateService = require('../services/stateService');
const config = require('../config');

/**
 * GET /api/state
 * Get current game state
 */
// Reject non-GET methods
router.all('/', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).set('Allow', 'GET, HEAD').json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed'
    });
  }
  next();
});

router.get('/', async (req, res) => {
  try {
    let state = stateService.getCurrentState();

    // If no state but session exists, create state from session
    if (!state) {
      const sessionService = require('../services/sessionService');
      const currentSession = sessionService.getCurrentSession();

      if (currentSession) {
        // Create state from current session
        state = stateService.createStateFromSession(currentSession);
        stateService.setCurrentState(state);
        await stateService.saveState();
      } else {
        // No session and no state - return empty/default state
        state = stateService.createDefaultState();
      }
    }

    // Ensure offline status is current
    const offlineQueueService = require('../services/offlineQueueService');
    const stateJSON = state.toJSON();

    // Update offline status to current value
    if (stateJSON.systemStatus) {
      stateJSON.systemStatus.offline = offlineQueueService.isOffline;
    }

    // Generate ETag based on state content
    const etag = crypto
      .createHash('md5')
      .update(JSON.stringify(stateJSON))
      .digest('hex');

    // Set cache headers
    res.set({
      'Cache-Control': 'no-cache, must-revalidate',
      'ETag': `"${etag}"`
    });

    // Check if client has matching ETag
    if (req.headers['if-none-match'] === `"${etag}"`) {
      return res.status(304).send();
    }

    // Return GameState directly, not wrapped
    res.json(stateJSON);
  } catch (error) {
    logger.error('Get state endpoint error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
});

/**
 * GET /api/status
 * Get orchestrator status and network information
 */
router.get('/status', (req, res) => {
  try {
    // Get offline status from offlineQueueService
    const { isOffline } = require('../middleware/offlineStatus');

    const interfaces = os.networkInterfaces();
    const addresses = Object.values(interfaces)
      .flat()
      .filter(i => !i.internal && i.family === 'IPv4')
      .map(i => i.address);

    const status = {
      status: 'online',
      version: '1.0.0',
      networkInterfaces: addresses,
      port: config.server.port,
      features: config.features || {
        videoPlayback: true,
        webSocketSync: true,
        offlineQueue: true,
        networkDiscovery: true
      },
      environment: config.server.env,
      uptime: process.uptime(),
      offline: isOffline(),
      timestamp: new Date().toISOString()
    };

    res.json(status);
  } catch (error) {
    logger.error('Get status endpoint error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve status information'
    });
  }
});

module.exports = router;