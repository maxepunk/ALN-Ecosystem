/**
 * State Routes - Debug/Recovery State Query
 * Per Decision #1: Keep only GET /api/state (state synchronization → WebSocket sync:full)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');
const stateService = require('../services/stateService');
const sessionService = require('../services/sessionService');
const videoQueueService = require('../services/videoQueueService');
const vlcService = require('../services/vlcService');

/**
 * GET /api/state
 * Get complete game state for debugging/recovery (one-time fetch)
 * Contract: openapi.yaml /api/state response schema (GameState)
 *
 * CRITICAL: NOT for polling - use WebSocket sync:full for real-time state
 */
router.get('/', async (req, res) => {
  try {
    // Get current session (if exists)
    const currentSession = sessionService.getCurrentSession();

    // Build session object per Session schema (or null)
    let session = null;
    if (currentSession) {
      const sessionData = currentSession.toJSON();
      const teams = sessionData.scores
        ? sessionData.scores.map(score => score.teamId)
        : [];

      session = {
        id: sessionData.id,
        name: sessionData.name,
        startTime: sessionData.startTime,
        endTime: sessionData.endTime || null,
        status: sessionData.status,
        teams: teams,
        metadata: sessionData.metadata || {
          gmStations: 0,
          playerDevices: 0,
          totalScans: 0,
          uniqueTokensScanned: []
        }
      };
    }

    // Get scores (from state or session)
    let state = stateService.getCurrentState();
    let scores = [];

    if (state) {
      const stateData = state.toJSON();
      scores = stateData.scores || [];
    } else if (currentSession) {
      const sessionData = currentSession.toJSON();
      scores = sessionData.scores || [];
    }

    // Get recent transactions (last 100)
    const recentTransactions = state
      ? (state.toJSON().recentTransactions || []).slice(-100)
      : [];

    // Get video status (matches video:status WebSocket event per Decision #5)
    const currentVideo = videoQueueService.getCurrentVideo();
    const videoStatus = {
      status: videoQueueService.isPlaying() ? 'playing' : 'idle',
      queueLength: videoQueueService.getQueueItems().length || 0,
      tokenId: currentVideo ? currentVideo.tokenId : null,
      duration: currentVideo ? videoQueueService.getVideoDuration(currentVideo.tokenId) : null,
      progress: null,  // TODO: Calculate from VLC playback position
      expectedEndTime: null,  // TODO: Calculate from start time + duration
      error: null  // TODO: Track VLC errors
    };

    // Get connected devices
    const devices = []; // TODO: Implement device tracking from WebSocket connections

    // Get system status
    const systemStatus = {
      orchestrator: 'online',  // If we're responding, we're online
      vlc: vlcService.isConnected() ? 'connected' : 'disconnected'
    };

    // Build GameState response per OpenAPI contract
    const gameState = {
      session,
      scores,
      recentTransactions,
      videoStatus,
      devices,
      systemStatus
    };

    // Generate ETag for caching
    const etag = crypto
      .createHash('md5')
      .update(JSON.stringify(gameState))
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

    // Return GameState directly (not wrapped)
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
