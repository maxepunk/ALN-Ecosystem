/**
 * Token Routes
 * Provides token data to scanners for offline caching
 */

const express = require('express');
const router = express.Router();
const tokenService = require('../services/tokenService');
const logger = require('../utils/logger');

/**
 * GET /api/tokens
 * Returns all available token data for scanners to cache
 */
router.get('/api/tokens', (req, res) => {
  try {
    // Load tokens from tokenService
    const tokens = tokenService.loadTokens();

    logger.info('Token data requested', {
      tokenCount: tokens.length,
      source: req.ip
    });

    res.json({
      tokens: tokens,
      count: tokens.length,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to load tokens', error);

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to load token data'
    });
  }
});

module.exports = router;