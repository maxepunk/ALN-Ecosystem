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

/**
 * POST /api/scan
 * Player scanner endpoint - logs scan and triggers video only
 * NO SCORING OR GAME MECHANICS (handled by GM scanner)
 */
router.post('/', async (req, res) => {
  try {
    // Validate request
    const scanRequest = validate(req.body, playerScanRequestSchema);

    // NOTE (D2, 2026-06-09): the backend "offline mode" acceptance path
    // (202 "queued for processing") was deleted. Scanners own offline
    // queueing client-side and replay via POST /api/scan/batch.

    // Check services are initialized
    if (transactionService.tokens.size === 0) {
      logger.error('Services not initialized - tokens not loaded');
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Server is still initializing, please retry'
      });
    }

    // Check that a session EXISTS — deliberately NOT that it is active.
    // Decision A6 (2026-06-09): player scans during setup/paused sessions
    // are INTENTIONAL (GMs flow-test scanners during the setup phase).
    // Any session status (setup/active/paused) accepts player scans; only
    // GM transactions are active-only (enforced in transactionService).
    // Ended sessions reject with 409 because endSession() nulls the session.
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

    // Persist player scan to session BEFORE broadcasting
    // This ensures scan data survives restarts and is included in sync:full
    // Token fields come from tokenService transformation (see loadTokens() in tokenService.js)
    const tokenData = {
      SF_MemoryType: token.memoryType,
      SF_ValueRating: token.metadata.rating,
      SF_Group: token.metadata.group || null,
      summary: token.metadata.summary || null
    };

    const playerScan = await sessionService.addPlayerScan({
      tokenId: scanRequest.tokenId,
      deviceId: scanRequest.deviceId,
      deviceType: scanRequest.deviceType || 'player',
      timestamp: scanRequest.timestamp || new Date().toISOString(),
      tokenData
    });

    // Decide video queueing BEFORE broadcasting so videoQueued is truthful
    // (F-RT-01: the broadcast used to claim videoQueued:true for scans whose
    // video was actually rejected by the canAcceptVideo() check below).
    let videoQueued = false;
    let videoRejection = null;
    if (token.hasVideo()) {
      // Check if system can accept a new video (VLC health + queue state)
      const videoCheck = videoQueueService.canAcceptVideo();
      if (videoCheck.available) {
        videoQueueService.addToQueue(token, scanRequest.deviceId);
        videoQueued = true;
      } else {
        videoRejection = videoCheck;
      }
    }

    // Emit player:scan WebSocket event to gm room (not admin-monitors)
    // GM scanners ARE the admin panels - they need to see player activity
    const io = req.app.locals.io;
    if (io) {
      const { emitToRoom } = require('../websocket/eventWrapper');
      emitToRoom(io, 'gm', 'player:scan', {
        scanId: playerScan.id,
        tokenId: scanRequest.tokenId,
        deviceId: scanRequest.deviceId,
        videoQueued,
        memoryType: token.memoryType,
        timestamp: playerScan.timestamp,
        tokenData
      });
      logger.debug('Broadcasted player:scan event to gm room', {
        scanId: playerScan.id,
        tokenId: scanRequest.tokenId,
        deviceId: scanRequest.deviceId,
        videoQueued
      });
    }

    if (videoRejection) {
      // Scan was persisted above; only the video trigger is rejected.
      // Decision A5: the scanner must NOT requeue this scan — rescan to retry.
      return res.status(409).json({
        status: 'rejected',
        message: videoRejection.reason === 'vlc_down'
          ? 'Video playback unavailable'
          : 'Video already playing, please wait',
        tokenId: scanRequest.tokenId,
        mediaAssets: token.mediaAssets || {},
        videoQueued: false,
        ...(videoRejection.reason === 'video_busy' && { waitTime: videoRejection.waitTime || 30 })
      });
    }

    return res.status(200).json({
      status: 'accepted',
      message: videoQueued ? 'Video queued for playback' : 'Scan logged',
      tokenId: scanRequest.tokenId,
      mediaAssets: token.mediaAssets || {},
      videoQueued
    });
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

// F-SCAN-14: timestamps earlier than this are treated as un-synced device
// clocks (ESP32 pre-NTP scans are stamped 1970 + uptime) and rejected.
const MIN_VALID_SCAN_TIME_MS = Date.parse('2020-01-01T00:00:00Z');

// PHASE 1.2 (P0.2): Track processed batches for idempotency
// In-memory cache with automatic cleanup after 1 hour
const processedBatches = new Map();

// Cleanup old batches every 5 minutes
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [batchId, data] of processedBatches.entries()) {
    if (data.timestamp < oneHourAgo) {
      processedBatches.delete(batchId);
      logger.debug('Cleaned up old batch', { batchId });
    }
  }
}, 5 * 60 * 1000);

/**
 * POST /api/scan/batch
 * Process multiple scan requests from player scanner offline queue
 * NO SCORING OR GAME MECHANICS (handled by GM scanner)
 * PHASE 1.2 (P0.2): Now supports idempotency via batchId and emits batch:ack
 */
router.post('/batch', async (req, res) => {
  const { batchId, transactions } = req.body;

  // PHASE 1.2 (P0.2): Validate batchId (required for idempotency)
  if (!batchId) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'batchId is required'
    });
  }

  if (!Array.isArray(transactions)) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Transactions must be an array'
    });
  }

  // PHASE 1.2 (P0.2): Check for duplicate batch (idempotency)
  if (processedBatches.has(batchId)) {
    const cachedResult = processedBatches.get(batchId);
    logger.info('Duplicate batch detected, returning cached result', {
      batchId,
      processedCount: cachedResult.processedCount
    });
    return res.json(cachedResult.response);
  }

  // Check services are initialized
  if (transactionService.tokens.size === 0) {
    logger.error('Services not initialized - tokens not loaded');
    return res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Server is still initializing, please retry'
    });
  }

  const results = [];

  for (const rawScan of transactions) {
    // F-SCAN-14: validate each entry against the same schema as POST
    // /api/scan (playerScanRequestSchema). Invalid entries become failed
    // results (the rest of the batch still processes) and are NOT
    // persisted to the session.
    let scanRequest;
    try {
      scanRequest = validate(rawScan, playerScanRequestSchema);
    } catch (validationError) {
      const echo = (rawScan && typeof rawScan === 'object') ? rawScan : {};
      logger.warn('Batch scan: entry failed validation', {
        tokenId: echo.tokenId,
        deviceId: echo.deviceId,
        error: validationError.message
      });
      results.push({
        ...echo,
        tokenId: echo.tokenId ?? null,
        status: 'failed',
        videoQueued: false,
        error: validationError.message
      });
      continue;
    }

    // F-SCAN-14: ESP32 scans taken before SNTP sync are stamped
    // 1970-01-01 + uptime (Application.h generateTimestamp pre-sync
    // branch). Persisting epoch-era times corrupts session timelines,
    // the EventTimeline validator, and the GenAI pipeline — reject them
    // as failed results. Floor is generous (2020): anything earlier can
    // only be an unset device clock, never a real scan.
    if (scanRequest.timestamp && Date.parse(scanRequest.timestamp) < MIN_VALID_SCAN_TIME_MS) {
      logger.warn('Batch scan: pre-sync timestamp rejected', {
        tokenId: scanRequest.tokenId,
        deviceId: scanRequest.deviceId,
        timestamp: scanRequest.timestamp
      });
      results.push({
        ...scanRequest,
        status: 'failed',
        videoQueued: false,
        error: 'Pre-sync timestamp (device clock not set at scan time)'
      });
      continue;
    }

    try {
      // Log the scan
      logger.info('Batch scan received', {
        tokenId: scanRequest.tokenId,
        teamId: scanRequest.teamId,
        deviceId: scanRequest.deviceId,
        timestamp: scanRequest.timestamp || new Date().toISOString()
      });

      // Check if token exists
      const token = transactionService.tokens.get(scanRequest.tokenId);

      if (!token) {
        logger.warn('Batch scan: token not found', { tokenId: scanRequest.tokenId });
        results.push({
          ...scanRequest,
          status: 'failed',
          videoQueued: false,
          error: 'Token not recognized'
        });
        continue;
      }

      // Persist valid entries to session.playerScans so offline-drained
      // scans are visible to post-session analysis (session:validate).
      // Decision D1 (2026-06-09): each persisted scan is broadcast to the
      // GM room as player:scan with replayed:true so Game Activity reflects
      // drained offline queues without waiting for a GM reconnect.
      // If no session is active, log and skip persistence (batch shape
      // is still acknowledged).
      const session = sessionService.getCurrentSession();
      if (session) {
        const tokenData = {
          SF_MemoryType: token.memoryType,
          SF_ValueRating: token.metadata.rating,
          SF_Group: token.metadata.group || null,
          summary: token.metadata.summary || null
        };
        const playerScan = await sessionService.addPlayerScan({
          tokenId: scanRequest.tokenId,
          deviceId: scanRequest.deviceId,
          deviceType: scanRequest.deviceType || 'player',
          timestamp: scanRequest.timestamp || new Date().toISOString(),
          tokenData
        });

        const io = req.app.locals.io;
        if (io) {
          const { emitToRoom } = require('../websocket/eventWrapper');
          emitToRoom(io, 'gm', 'player:scan', {
            scanId: playerScan.id,
            tokenId: scanRequest.tokenId,
            deviceId: scanRequest.deviceId,
            videoQueued: false,  // A4: replayed scans never trigger video
            memoryType: token.memoryType,
            timestamp: playerScan.timestamp,
            tokenData,
            replayed: true
          });
        }
      } else {
        logger.warn('Batch scan: no active session — entry not persisted', {
          tokenId: scanRequest.tokenId,
          deviceId: scanRequest.deviceId
        });
      }

      // Decision A4 (2026-06-09): replayed scans NEVER trigger video playback.
      // Batches represent past activity — if a video couldn't play at scan
      // time, the player was alerted then; draining an offline queue must not
      // start playback at upload time (F-SCAN-05). videoQueued is always false.
      results.push({
        ...scanRequest,
        status: 'processed',
        videoQueued: false
      });
    } catch (error) {
      results.push({
        ...scanRequest,
        status: 'failed',
        videoQueued: false,
        error: error.message
      });
    }
  }

  // PHASE 1.2 (P0.2): Build response with batch metadata
  const processedCount = results.filter(r => r.status === 'processed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const response = {
    batchId,
    processedCount,
    totalCount: transactions.length,
    failedCount,
    results
  };

  // PHASE 1.2 (P0.2): Cache result for idempotency
  processedBatches.set(batchId, {
    response,
    timestamp: Date.now(),
    processedCount
  });

  // PHASE 1.2 (P0.2): Emit batch:ack WebSocket event
  const io = req.app.locals.io;
  if (io) {
    const { emitWrapped } = require('../websocket/eventWrapper');
    const deviceId = transactions[0]?.deviceId;

    // Emit to specific device room if deviceId present
    if (deviceId) {
      emitWrapped(io.to(`device:${deviceId}`), 'batch:ack', {
        batchId,
        processedCount,
        totalCount: transactions.length,
        failedCount,
        failures: results.filter(r => r.status === 'failed').map((r, index) => ({
          index,
          tokenId: r.tokenId,
          error: r.error
        }))
      });

      logger.info('Emitted batch:ack event', {
        batchId,
        deviceId,
        processedCount,
        failedCount
      });
    }
  }

  res.json(response);
});

module.exports = router;