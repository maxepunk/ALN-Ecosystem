/**
 * Admin Events Handler
 * Handles admin-specific WebSocket events and GM commands
 */

const logger = require('../utils/logger');
const config = require('../config');
const sessionService = require('../services/sessionService');
const transactionService = require('../services/transactionService');
const offlineQueueService = require('../services/offlineQueueService');
const stateService = require('../services/stateService');
const videoQueueService = require('../services/videoQueueService');
const vlcService = require('../services/vlcService');
const displayControlService = require('../services/displayControlService');
const { emitWrapped } = require('./eventWrapper');

// Mutex flag to prevent concurrent system resets
let resetInProgress = false;

/**
 * Handle GM command from authenticated GM station
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Command data
 * @param {Server} io - Socket.io server instance
 */
async function handleGmCommand(socket, data, io) {
  try {
    if (!socket.deviceId || socket.deviceType !== 'gm') {
      emitWrapped(socket, 'error', {
        code: 'AUTH_REQUIRED',
        message: 'Not authorized'
      });
      return;
    }

    // Unwrap envelope (data.data contains actual command data per AsyncAPI contract)
    const commandData = data.data || data;
    const action = commandData.action;
    const payload = commandData.payload || {};

    // Process GM commands
    let resultMessage = '';
    switch (action) {
      case 'session:create':
        // Create new session (service will emit session:created → broadcasts.js wraps as session:update)
        // broadcasts.js will initialize devices into the session (event-driven pattern)
        await sessionService.createSession({
          name: payload.name || 'New Session',
          teams: payload.teams || []
        });

        resultMessage = `Session "${payload.name || 'New Session'}" created successfully`;
        logger.info('Session created by GM', {
          gmStation: socket.deviceId,
          name: payload.name,
          teams: payload.teams
        });
        break;

      case 'session:pause':
        // Service will emit session:updated → broadcasts.js wraps as session:update
        await sessionService.updateSession({ status: 'paused' });
        resultMessage = 'Session paused successfully';
        logger.info('Session paused by GM', { gmStation: socket.deviceId });
        break;

      case 'session:resume':
        // Service will emit session:updated → broadcasts.js wraps as session:update
        await sessionService.updateSession({ status: 'active' });
        resultMessage = 'Session resumed successfully';
        logger.info('Session resumed by GM', { gmStation: socket.deviceId });
        break;

      case 'session:end':
        // Service will emit session:updated → broadcasts.js wraps as session:update
        await sessionService.endSession();
        resultMessage = 'Session ended successfully';
        logger.info('Session ended by GM', { gmStation: socket.deviceId });
        break;

      case 'video:play':
        // Resume/play current video (FR 4.2.2 line 898)
        if (config.features.videoPlayback) {
          await vlcService.resume();
        }
        resultMessage = 'Video playback resumed';
        logger.info('Video playback resumed by GM', { gmStation: socket.deviceId });
        break;

      case 'video:pause':
        // Pause current video (FR 4.2.2 line 899)
        if (config.features.videoPlayback) {
          await vlcService.pause();
        }
        resultMessage = 'Video playback paused';
        logger.info('Video playback paused by GM', { gmStation: socket.deviceId });
        break;

      case 'video:stop':
        // Stop current video (FR 4.2.2 line 900)
        if (config.features.videoPlayback) {
          await vlcService.stop();
        }
        resultMessage = 'Video playback stopped';
        logger.info('Video playback stopped by GM', { gmStation: socket.deviceId });
        break;

      case 'video:skip':
        videoQueueService.skipCurrent();
        emitWrapped(io, 'video:skipped', {
          gmStation: socket.deviceId,
        });
        resultMessage = 'Video skipped successfully';
        logger.info('Video skipped by GM', { gmStation: socket.deviceId });
        break;

      case 'video:queue:add':
        // Add video to queue by filename (FR 4.2.2 line 907)
        const { videoFile } = payload;
        if (!videoFile) {
          throw new Error('videoFile is required for video:queue:add');
        }
        videoQueueService.addVideoByFilename(videoFile, socket.deviceId);
        resultMessage = `Video ${videoFile} added to queue`;
        logger.info('Video added to queue by GM', { gmStation: socket.deviceId, videoFile });
        break;

      case 'video:queue:reorder':
        // Reorder queue (FR 4.2.2 line 908)
        const { fromIndex, toIndex } = payload;
        if (fromIndex === undefined || toIndex === undefined) {
          throw new Error('fromIndex and toIndex are required for video:queue:reorder');
        }
        videoQueueService.reorderQueue(fromIndex, toIndex);
        resultMessage = `Queue reordered: moved position ${fromIndex} to ${toIndex}`;
        logger.info('Queue reordered by GM', { gmStation: socket.deviceId, fromIndex, toIndex });
        break;

      case 'video:queue:clear':
        // Clear entire queue (FR 4.2.2 line 909)
        videoQueueService.clearQueue();
        resultMessage = 'Video queue cleared';
        logger.info('Video queue cleared by GM', { gmStation: socket.deviceId });
        break;

      case 'display:idle-loop': {
        // Switch display to idle loop mode (Phase 4.2)
        const idleResult = await displayControlService.setIdleLoop();
        if (idleResult.success) {
          // Broadcast mode change to all clients
          const eventData = {
            mode: 'IDLE_LOOP',
            changedBy: socket.deviceId
          };
          emitWrapped(socket, 'display:mode', eventData);
          emitWrapped(socket.broadcast, 'display:mode', eventData);
          resultMessage = 'Display switched to idle loop';
        } else {
          throw new Error(idleResult.error || 'Failed to switch to idle loop');
        }
        logger.info('Display set to idle loop by GM', { gmStation: socket.deviceId });
        break;
      }

      case 'display:scoreboard': {
        // Switch display to scoreboard mode (Phase 4.2)
        const scoreboardResult = await displayControlService.setScoreboard();
        if (scoreboardResult.success) {
          // Broadcast mode change to all clients
          const eventData = {
            mode: 'SCOREBOARD',
            changedBy: socket.deviceId
          };

          emitWrapped(socket, 'display:mode', eventData);
          emitWrapped(socket.broadcast, 'display:mode', eventData);
          resultMessage = 'Display switched to scoreboard';
        } else {
          throw new Error(scoreboardResult.error || 'Failed to switch to scoreboard');
        }
        logger.info('Display set to scoreboard by GM', { gmStation: socket.deviceId });
        break;
      }

      case 'display:toggle': {
        // Toggle between idle loop and scoreboard modes (Phase 4.2)
        const toggleResult = await displayControlService.toggleMode();
        if (toggleResult.success) {
          // Broadcast mode change to all clients
          const eventData = {
            mode: toggleResult.mode,
            changedBy: socket.deviceId
          };
          emitWrapped(socket, 'display:mode', eventData);
          emitWrapped(socket.broadcast, 'display:mode', eventData);
          resultMessage = `Display toggled to ${toggleResult.mode.toLowerCase()}`;
        } else {
          throw new Error(toggleResult.error || 'Failed to toggle display mode');
        }
        logger.info('Display toggled by GM', { gmStation: socket.deviceId, newMode: toggleResult.mode });
        break;
      }

      case 'display:status': {
        // Get current display mode status (Phase 4.2)
        const displayStatus = displayControlService.getStatus();
        emitWrapped(socket, 'display:status', displayStatus);
        resultMessage = `Display mode: ${displayStatus.currentMode}`;
        logger.info('Display status requested by GM', { gmStation: socket.deviceId, status: displayStatus });
        break;
      }

      case 'score:adjust':
        // Adjust team score by delta (service will emit score:updated → broadcasts.js wraps it)
        const { teamId, delta, reason } = payload;
        if (!teamId || delta === undefined) {
          throw new Error('teamId and delta are required for score:adjust');
        }
        transactionService.adjustTeamScore(teamId, delta, reason || 'Admin adjustment', socket.deviceId);
        resultMessage = `Team ${teamId} score adjusted by ${delta}`;
        logger.info('Team score adjusted by GM', {
          gmStation: socket.deviceId,
          teamId,
          delta,
          reason
        });
        break;

      case 'score:reset':
        // Reset all team scores (triggers scores:reset event → broadcasts)
        transactionService.resetScores();
        resultMessage = 'All team scores reset to zero';
        logger.info('All team scores reset by GM', {
          gmStation: socket.deviceId,
          sessionId: session?.id
        });
        break;

      case 'transaction:delete': {
        // Delete transaction and recalculate scores (FR 4.2.4 line 949)
        const { transactionId } = payload;
        if (!transactionId) {
          throw new Error('transactionId is required for transaction:delete');
        }
        const deleteSession = sessionService.getCurrentSession();
        if (!deleteSession) {
          throw new Error('No active session');
        }
        const deleteResult = transactionService.deleteTransaction(transactionId, deleteSession);
        resultMessage = `Transaction ${transactionId} deleted, team ${deleteResult.deletedTransaction.teamId} score recalculated`;
        logger.info('Transaction deleted by GM', {
          gmStation: socket.deviceId,
          transactionId,
          affectedTeam: deleteResult.deletedTransaction.teamId,
          newScore: deleteResult.updatedScore.currentScore,
        });
        break;
      }

      case 'transaction:create': {
        // Create manual transaction (FR 4.2.4 line 954)
        const txData = payload;
        if (!txData.tokenId || !txData.teamId || !txData.mode) {
          throw new Error('tokenId, teamId, and mode are required for transaction:create');
        }
        const createSession = sessionService.getCurrentSession();
        if (!createSession) {
          throw new Error('No active session');
        }
        // Add admin's deviceId and deviceType from authenticated socket
        txData.deviceId = socket.deviceId;
        txData.deviceType = socket.deviceType || 'gm';  // Explicit assignment
        const createResult = await transactionService.createManualTransaction(txData, createSession);
        resultMessage = `Manual transaction created for team ${txData.teamId}: ${createResult.points} points`;
        logger.info('Manual transaction created by GM', {
          gmStation: socket.deviceId,
          transactionId: createResult.transactionId,
          tokenId: txData.tokenId,
          teamId: txData.teamId,
          points: createResult.points,
        });
        break;
      }

      case 'system:reset': {
        // System reset - FR 4.2.5 lines 980-985 (full "nuclear option")
        // Uses performSystemReset() for consistent reset behavior
        // MUTEX PROTECTION: Prevent concurrent resets from causing race conditions
        if (resetInProgress) {
          throw new Error('System reset already in progress. Please wait.');
        }

        resetInProgress = true;
        try {
          const { performSystemReset } = require('../services/systemReset');

          logger.info('System reset requested by GM', { gmStation: socket.deviceId });

          await performSystemReset(io, {
            sessionService,
            stateService,
            transactionService,
            videoQueueService,
            offlineQueueService,
            displayControlService,
            vlcService
          });

          resultMessage = 'System reset complete - ready for new session';
          logger.info('System reset by GM complete', { gmStation: socket.deviceId });
        } finally {
          resetInProgress = false;
        }
        break;
      }

      default:
        emitWrapped(socket, 'error', {
          code: 'INVALID_COMMAND',
          message: `Unknown action: ${action}`
        });
        return;
    }

    // Send AsyncAPI-compliant ack (requires action, success, message)
    emitWrapped(socket, 'gm:command:ack', {
      action: action,
      success: true,
      message: resultMessage
    });
  } catch (error) {
    const commandData = data.data || data;
    logger.error('GM command error', { error, action: commandData.action, socketId: socket.id });
    emitWrapped(socket, 'error', {
      code: 'SERVER_ERROR',
      message: 'Command failed',
      details: error.message,
    });
  }
}

/**
 * Handle transaction submission from GM scanner
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Transaction data
 * @param {Server} _io - Socket.io server instance (unused, broadcasts handled by services)
 */
async function handleTransactionSubmit(socket, data, _io) {
  try {
    if (!socket.deviceId) {
      emitWrapped(socket, 'error', {
        code: 'AUTH_REQUIRED',
        message: 'Not identified'
      });
      return;
    }

    // Unwrap envelope (data.data contains actual transaction data per AsyncAPI contract)
    // STRICT: Require wrapped envelope per AsyncAPI contract
    if (!data.data) {
      emitWrapped(socket, 'error', {
        code: 'VALIDATION_ERROR',
        message: 'Event must be wrapped in envelope: {event, data, timestamp}'
      });
      return;
    }
    const transactionData = data.data;

    const { gmTransactionSchema, validate } = require('../utils/validators');

    // Inject deviceId and deviceType from authenticated socket
    // (GM scanners are pre-authenticated, so deviceId/deviceType are on the socket)
    const enrichedData = {
      ...transactionData,
      deviceId: socket.deviceId,
      deviceType: socket.deviceType || 'gm'
    };

    const scanRequest = validate(enrichedData, gmTransactionSchema);

    // Check if system is offline - use service directly for consistency
    logger.info('Transaction handler checking offline status', {
      isOffline: offlineQueueService.isOffline,
      instanceId: offlineQueueService.instanceId
    });

    if (offlineQueueService.isOffline) {
      // Queue GM transaction for later processing
      const queuedItem = offlineQueueService.enqueueGmTransaction(scanRequest);
      if (queuedItem) {
        emitWrapped(socket, 'transaction:result', {
          status: 'queued',
          queued: true,
          transactionId: queuedItem.transactionId,
          message: 'Transaction queued for processing when system comes online'
        });

        logger.info('GM transaction queued while offline', {
          transactionId: queuedItem.transactionId,
          deviceId: socket.deviceId
        });
        return;
      } else {
        emitWrapped(socket, 'error', {
          code: 'QUEUE_FULL',
          message: 'Offline queue is full'
        });
        return;
      }
    }

    const session = sessionService.getCurrentSession();
    if (!session) {
      emitWrapped(socket, 'error', {
        code: 'SESSION_NOT_FOUND',
        message: 'No active session',
      });
      return;
    }

    // Check if session is paused (FR 1.2: transactions rejected when paused)
    if (session.status === 'paused') {
      emitWrapped(socket, 'transaction:result', {
        status: 'error',
        transactionId: null,
        tokenId: scanRequest.tokenId,
        teamId: scanRequest.teamId,
        points: 0,
        message: 'Session is paused',
        error: 'SESSION_PAUSED'
      });
      logger.info('Transaction blocked (session paused)', {
        deviceId: socket.deviceId,
        tokenId: scanRequest.tokenId
      });
      return;
    }

    const result = await transactionService.processScan(scanRequest, session);

    // Add the existing transaction to session (don't create duplicate)
    if (result.transaction) {
      await sessionService.addTransaction(result.transaction);
    }

    // Transform result to match AsyncAPI contract for transaction:result
    const contractResult = {
      status: result.status,
      transactionId: result.transactionId || result.transaction?.id,
      tokenId: result.transaction?.tokenId || scanRequest.tokenId,
      teamId: result.transaction?.teamId || scanRequest.teamId,
      points: result.points || 0,
      message: result.message,
      error: result.error || null
    };

    // Add duplicate-specific fields if present (from createScanResponse)
    if (result.originalTransactionId) {
      contractResult.originalTransactionId = result.originalTransactionId;
    }
    if (result.claimedBy) {
      contractResult.claimedBy = result.claimedBy;
    }

    // Send contract-compliant result back to submitter
    emitWrapped(socket, 'transaction:result', contractResult);

    // Transaction broadcasting is handled by the sessionService event listeners
    // in broadcasts.js which will emit the properly formatted event to all clients
    // The service will trigger 'transaction:added' event that broadcasts.js listens to

    logger.info('Transaction submitted via WebSocket', {
      transactionId: result.transactionId,
      status: result.status,
      deviceId: socket.deviceId,
    });
  } catch (error) {
    logger.error('Transaction submit error', { error, socketId: socket.id });

    // Send error response
    emitWrapped(socket, 'error', {
      code: 'VALIDATION_ERROR',  // AsyncAPI contract enum value
      message: 'Failed to process transaction',
      details: (error.details && !Array.isArray(error.details))
        ? error.details
        : { error: error.message, validationErrors: error.details },  // Must be object per contract
    });
  }
}

/**
 * Handle state request from client
 * @param {Socket} socket - Socket.io socket instance
 */
function handleStateRequest(socket) {
  try {
    if (!socket.deviceId) {
      emitWrapped(socket, 'error', {
        code: 'AUTH_REQUIRED',
        message: 'Not identified'
      });
      return;
    }

    const state = stateService.getCurrentState();

    if (state) {
      emitWrapped(socket, 'state:sync', state.toJSON());
      logger.debug('State sent to client', { deviceId: socket.deviceId });
    } else {
      emitWrapped(socket, 'error', {
        code: 'SESSION_NOT_FOUND',
        message: 'No active game state',
      });
    }
  } catch (error) {
    logger.error('State request error', { error, socketId: socket.id });
    emitWrapped(socket, 'error', {
      code: 'SERVER_ERROR',
      message: 'Failed to retrieve state',
      details: error.message,
    });
  }
}

module.exports = {
  handleGmCommand,
  handleTransactionSubmit,
  handleStateRequest,
};