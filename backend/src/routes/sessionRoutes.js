/**
 * Session Routes - Current Session Query
 * Per Decision #1: Keep only GET /api/session (session management → WebSocket)
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');

/**
 * GET /api/session
 * Get current active session (one-time fetch before WebSocket connection)
 * Contract: openapi.yaml /api/session response schema
 */
router.get('/', async (req, res) => {
  try {
    const session = sessionService.getCurrentSession();

    if (!session) {
      return res.status(404).json({
        error: 'SESSION_NOT_FOUND',  // Per OpenAPI Error enum
        message: 'No active session',
      });
    }

    // Build response per OpenAPI Session schema
    const sessionData = session.toJSON();

    // Derive teams array from scores (per OpenAPI contract requirement)
    const teams = sessionData.scores
      ? sessionData.scores.map(score => score.teamId)
      : [];

    // Response structure per OpenAPI Session schema
    res.json({
      id: sessionData.id,
      name: sessionData.name,
      startTime: sessionData.startTime,
      endTime: sessionData.endTime || null,
      status: sessionData.status,
      teams: teams,  // Required field per OpenAPI contract
      metadata: sessionData.metadata || {
        gmStations: 0,
        playerDevices: 0,
        totalScans: 0,
        uniqueTokensScanned: []
      }
    });
  } catch (error) {
    logger.error('Get current session error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
});

module.exports = router;
