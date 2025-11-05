/**
 * Scan Routes
 * Handles token scanning endpoints
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { playerScanRequestSchema, validate, ValidationError } = require('../utils/validators');
const sessionService = require('../services/sessionService');
const transactionService = require('../services/transactionService');
const videoQueueService = require('../services/videoQueueService');
const offlineQueueService = require('../services/offlineQueueService');
const { isOffline } = require('../middleware/offlineStatus');

// PHASE 1 (P0.2): Idempotency tracking for batch uploads
// In-memory Map: batchId -> { response, timestamp }
const processedBatches = new Map();

// Cleanup old batches every 5 minutes (prevent memory leak)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [batchId, data] of processedBatches.entries()) {
    if (data.timestamp < oneHourAgo) {
      processedBatches.delete(batchId);
      logger.debug('Cleaned up old batch from cache', { batchId });
    }
  }
}, 5 * 60 * 1000);

/**
 * POST /api/scan
 * Player scanner endpoint - logs scan and triggers video only
 * NO SCORING OR GAME MECHANICS (handled by GM scanner)
 */
router.post('/', async (req, res) => {
  try {
    // Validate request
    const scanRequest = validate(req.body, playerScanRequestSchema);

    // Check if system is offline
    if (isOffline()) {
      // Queue for later processing
      const queuedItem = offlineQueueService.enqueue(scanRequest);
      if (queuedItem) {
        return res.status(202).json({
          status: 'queued',
          queued: true,
          offlineMode: true,
          transactionId: queuedItem.transactionId,
          message: 'Scan queued for processing when system comes online',
        });
      } else {
        // Queue is full
        return res.status(503).json({
          status: 'error',
          offlineMode: true,
          message: 'Offline queue is full, please try again later',
        });
      }
    }

    // Check services are initialized
    if (transactionService.tokens.size === 0) {
      logger.error('Services not initialized - tokens not loaded');
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Server is still initializing, please retry'
      });
    }

    // Check for active session
    const session = sessionService.getCurrentSession();
    if (!session) {
      logger.warn('Scan rejected: no active session');
      return res.status(409).json({
        error: 'SESSION_NOT_FOUND',
        message: 'No active session - admin must create session first'
      });
    }

    // Log the scan for audit purposes
    logger.info('Player scan received', {
      tokenId: scanRequest.tokenId,
      teamId: scanRequest.teamId,
      deviceId: scanRequest.deviceId,
      timestamp: scanRequest.timestamp || new Date().toISOString()
    });

    // Get token directly - no duplicate detection for player scanner
    const token = transactionService.tokens.get(scanRequest.tokenId);

    // Check if token exists
    if (!token) {
      logger.warn('Scan rejected: token not found', { tokenId: scanRequest.tokenId });
      return res.status(404).json({
        error: 'TOKEN_NOT_FOUND',
        message: `Token ${scanRequest.tokenId} not recognized`
      });
    }

    // Emit player:scan WebSocket event for admin monitoring
    const io = req.app.locals.io;
    if (io) {
      const { emitToRoom } = require('../websocket/eventWrapper');
      emitToRoom(io, 'admin-monitors', 'player:scan', {
        tokenId: scanRequest.tokenId,
        deviceId: scanRequest.deviceId,
        teamId: scanRequest.teamId || null,
        videoQueued: token && token.hasVideo(),
        memoryType: token ? token.memoryType : null,  // Use transformed field, not SF_MemoryType
        timestamp: scanRequest.timestamp || new Date().toISOString()
      });
      logger.debug('Broadcasted player:scan event', {
        tokenId: scanRequest.tokenId,
        deviceId: scanRequest.deviceId,
        videoQueued: token && token.hasVideo()
      });
    }

    // Check if token has video
    if (token && token.hasVideo()) {
      // Check if video is already playing
      if (videoQueueService.isPlaying()) {
        // Video already playing - inform scanner
        const waitTime = videoQueueService.getRemainingTime();
        return res.status(409).json({
          status: 'rejected',
          message: 'Video already playing, please wait',
          tokenId: scanRequest.tokenId,
          mediaAssets: token.mediaAssets || {},
          videoQueued: false,
          waitTime: waitTime || 30
        });
      }

      // Add video to queue
      videoQueueService.addToQueue(token, scanRequest.deviceId);

      return res.status(200).json({
        status: 'accepted',
        message: 'Video queued for playback',
        tokenId: scanRequest.tokenId,
        mediaAssets: token.mediaAssets || {},
        videoQueued: true
      });
    } else {
      // No video - just acknowledge scan
      return res.status(200).json({
        status: 'accepted',
        message: 'Scan logged',
        tokenId: scanRequest.tokenId,
        mediaAssets: token ? (token.mediaAssets || {}) : {},
        videoQueued: false
      });
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      // Include field names in message for better test compatibility
      const fieldMessages = error.details?.map(d => d.field).filter(f => f);
      const message = fieldMessages?.length > 0
        ? `Validation failed: ${fieldMessages.join(', ')}`
        : error.message;

      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: message,
        details: error.details,
      });
    } else {
      logger.error('Scan endpoint error', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    }
  }
});

/**
 * POST /api/scan/batch
 * Process multiple scan requests from player scanner offline queue
 * NO SCORING OR GAME MECHANICS (handled by GM scanner)
 *
 * PHASE 1 (P0.2): Added batchId for idempotency and batch:ack emission
 */
router.post('/batch', async (req, res) => {
  const { batchId, transactions } = req.body;

  // PHASE 1 (P0.2): Validate batchId (REQUIRED)
  if (!batchId) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'batchId required'
    });
  }

  if (!Array.isArray(transactions)) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Transactions must be an array'
    });
  }

  // PHASE 1 (P0.2): Check for duplicate batch (idempotency)
  if (processedBatches.has(batchId)) {
    const cached = processedBatches.get(batchId);
    logger.info('Duplicate batch detected, returning cached result', { batchId });
    return res.json(cached.response);
  }

  // Check services are initialized
  if (transactionService.tokens.size === 0) {
    logger.error('Services not initialized - tokens not loaded');
    return res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Server is still initializing, please retry'
    });
  }

  logger.info('Processing batch upload', {
    batchId,
    transactionCount: transactions.length
  });

  const results = [];

  for (const scanRequest of transactions) {
    try {
      // Log the scan
      logger.debug('Batch scan processing', {
        batchId,
        tokenId: scanRequest.tokenId,
        teamId: scanRequest.teamId,
        deviceId: scanRequest.deviceId,
        timestamp: scanRequest.timestamp || new Date().toISOString()
      });

      // Check if token exists
      const token = scanRequest.tokenId ? transactionService.tokens.get(scanRequest.tokenId) : null;

      if (!token) {
        logger.warn('Batch scan: token not found', { batchId, tokenId: scanRequest.tokenId });
        results.push({
          ...scanRequest,
          status: 'failed',
          error: 'Token not recognized'
        });
        continue;
      }

      // Process video if applicable
      if (token && token.hasVideo()) {
        if (!videoQueueService.isPlaying()) {
          videoQueueService.addToQueue(token, scanRequest.deviceId);
          results.push({
            ...scanRequest,
            status: 'processed',
            videoQueued: true
          });
        } else {
          results.push({
            ...scanRequest,
            status: 'processed',
            videoQueued: false,
            message: 'Video already playing'
          });
        }
      } else {
        results.push({
          ...scanRequest,
          status: 'processed',
          videoQueued: false
        });
      }
    } catch (error) {
      results.push({
        ...scanRequest,
        status: 'failed',
        error: error.message
      });
    }
  }

  // PHASE 1 (P0.2): Build response with batch metadata
  const response = {
    batchId,
    processedCount: results.filter(r => r.status === 'processed').length,
    totalCount: transactions.length,
    results
  };

  // PHASE 1 (P0.2): Cache result for idempotency
  processedBatches.set(batchId, {
    response,
    timestamp: Date.now()
  });

  logger.info('Batch processed successfully', {
    batchId,
    processedCount: response.processedCount,
    totalCount: response.totalCount
  });

  // PHASE 1 (P0.2): Emit batch:ack WebSocket event to device
  const io = req.app.locals.io;
  if (io && transactions.length > 0) {
    const deviceId = transactions[0].deviceId;
    if (deviceId) {
      const { emitToRoom } = require('../websocket/eventWrapper');
      emitToRoom(io, `device:${deviceId}`, 'batch:ack', {
        batchId,
        processedCount: response.processedCount,
        totalCount: response.totalCount,
        timestamp: new Date().toISOString()
      });
      logger.info('Emitted batch:ack to device', { batchId, deviceId });
    }
  }

  res.json(response);
});

module.exports = router;