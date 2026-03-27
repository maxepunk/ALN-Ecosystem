/**
 * State Routes - Debug/Recovery State Query
 * Per Decision #1: Keep only GET /api/state (state synchronization → WebSocket sync:full)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');
const transactionService = require('../services/transactionService');
const videoQueueService = require('../services/videoQueueService');
const bluetoothService = require('../services/bluetoothService');
const audioRoutingService = require('../services/audioRoutingService');
const lightingService = require('../services/lightingService');
const gameClockService = require('../services/gameClockService');
const cueEngineService = require('../services/cueEngineService');
const spotifyService = require('../services/spotifyService');
const soundService = require('../services/soundService');
const { buildSyncFullPayload } = require('../websocket/syncHelpers');

/**
 * GET /api/state
 * Get complete game state for debugging/recovery (one-time fetch)
 * Contract: openapi.yaml /api/state response schema (GameState)
 *
 * CRITICAL: NOT for polling - use WebSocket sync:full for real-time state
 *
 * Delegates to buildSyncFullPayload() so the response shape matches sync:full
 * exactly, eliminating divergence between HTTP and WebSocket state snapshots.
 */
router.get('/', async (req, res) => {
  try {
    const gameState = await buildSyncFullPayload({
      sessionService,
      transactionService,
      videoQueueService,
      bluetoothService,
      audioRoutingService,
      lightingService,
      gameClockService,
      cueEngineService,
      spotifyService,
      soundService,
    });

    // Generate ETag for caching — exclude volatile timestamps (lastChecked)
    // so ETag only changes when meaningful state changes, not on every health report
    const etag = crypto
      .createHash('md5')
      .update(JSON.stringify(gameState, (key, value) =>
        key === 'lastChecked' ? undefined : value
      ))
      .digest('hex');

    // Set cache headers per contract
    res.set({
      'Cache-Control': 'no-cache, must-revalidate',
      'ETag': `"${etag}"`
    });

    // Check If-None-Match for 304 response
    if (req.headers['if-none-match'] === `"${etag}"`) {
      return res.status(304).send();
    }

    res.json(gameState);
  } catch (error) {
    logger.error('Get state endpoint error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
});

module.exports = router;
