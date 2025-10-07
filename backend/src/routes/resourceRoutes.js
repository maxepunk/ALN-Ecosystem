/**
 * Resource Routes - Static resources (tokens, health)
 * Per Decision #1: Consolidate GET /api/tokens + GET /health
 */

const express = require('express');
const router = express.Router();
const tokenService = require('../services/tokenService');
const { success } = require('../utils/responseBuilder');
const packageJson = require('../../package.json');

/**
 * GET /api/tokens - Token database
 * Returns raw tokens.json for scanner caching (original format)
 * Contract: openapi.yaml /api/tokens response schema
 */
router.get('/tokens', (req, res) => {
  try {
    const rawTokens = tokenService.loadRawTokens();

    success(res, {
      tokens: rawTokens,
      count: Object.keys(rawTokens).length,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /health - Health check
 * Basic health check endpoint for connection validation
 * Contract: openapi.yaml /health response schema
 */
router.get('/health', (req, res) => {
  success(res, {
    status: 'online',
    version: packageJson.version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /scoreboard - Scoreboard display
 * TV-optimized scoreboard display for Black Market mode
 */
router.get('/scoreboard', (req, res) => {
  res.sendFile('scoreboard.html', { root: './public' });
});

module.exports = router;
