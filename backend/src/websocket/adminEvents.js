/**
 * Admin Events Handler
 * Handles admin-specific WebSocket events and GM commands
 */

const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');
const videoQueueService = require('../services/videoQueueService');
const { emitWrapped } = require('./eventWrapper');

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
    
    // Process GM commands
    switch (data.command) {
      case 'pause_session':
        await sessionService.updateSession({ status: 'paused' });
        emitWrapped(io, 'session:paused', {
          gmStation: socket.deviceId,
        });
        logger.info('Session paused by GM', { gmStation: socket.deviceId });
        break;
        
      case 'resume_session':
        await sessionService.updateSession({ status: 'active' });
        emitWrapped(io, 'session:resumed', {
          gmStation: socket.deviceId,
        });
        logger.info('Session resumed by GM', { gmStation: socket.deviceId });
        break;
        
      case 'end_session':
        await sessionService.endSession();
        emitWrapped(io, 'session:ended', {
          gmStation: socket.deviceId,
        });
        logger.info('Session ended by GM', { gmStation: socket.deviceId });
        break;
        
      case 'skip_video':
        videoQueueService.skipCurrent();
        emitWrapped(io, 'video:skipped', {
          gmStation: socket.deviceId,
        });
        logger.info('Video skipped by GM', { gmStation: socket.deviceId });
        break;
        
      case 'clear_scores':
        // Reset scores through transaction service
        const transactionService = require('../services/transactionService');
        transactionService.resetScores();
        emitWrapped(io, 'scores:reset', {
          gmStation: socket.deviceId,
        });
        logger.info('Scores reset by GM', { gmStation: socket.deviceId });
        break;
        
      default:
        emitWrapped(socket, 'error', {
          code: 'INVALID_COMMAND',
          message: `Unknown command: ${data.command}`
        });
        return;
    }

    emitWrapped(socket, 'gm:command:ack', {
      command: data.command,
      success: true,
    });
  } catch (error) {
    logger.error('GM command error', { error, command: data.command, socketId: socket.id });
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
 * @param {Server} io - Socket.io server instance
 */
async function handleTransactionSubmit(socket, data, io) {
  try {
    if (!socket.deviceId) {
      emitWrapped(socket, 'error', {
        code: 'AUTH_REQUIRED',
        message: 'Not identified'
      });
      return;
    }

    const { scanRequestSchema, validate } = require('../utils/validators');
    const scanRequest = validate(data, scanRequestSchema);

    // Check if system is offline - use service directly for consistency
    const offlineQueueService = require('../services/offlineQueueService');

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

    const transactionService = require('../services/transactionService');
    const result = await transactionService.processScan(scanRequest, session);

    // Add the existing transaction to session (don't create duplicate)
    if (result.transaction) {
      await sessionService.addTransaction(result.transaction);
    }

    // Send result back to submitter
    emitWrapped(socket, 'transaction:result', result);

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
      code: 'INVALID_DATA',
      message: 'Failed to process transaction',
      details: error.message,
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

    const stateService = require('../services/stateService');
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