/**
 * Admin Events Handler
 * Handles admin-specific WebSocket events and GM commands
 */

const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');
const transactionService = require('../services/transactionService');
const offlineQueueService = require('../services/offlineQueueService');
const stateService = require('../services/stateService');
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
    
    // Unwrap envelope (data.data contains actual command data per AsyncAPI contract)
    const commandData = data.data || data;
    const action = commandData.action;
    const payload = commandData.payload || {};

    // Process GM commands
    let resultMessage = '';
    switch (action) {
      case 'session:create':
        // Create new session (service will emit session:created → broadcasts.js wraps as session:update)
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

      case 'video:skip':
        videoQueueService.skipCurrent();
        emitWrapped(io, 'video:skipped', {
          gmStation: socket.deviceId,
        });
        resultMessage = 'Video skipped successfully';
        logger.info('Video skipped by GM', { gmStation: socket.deviceId });
        break;

      case 'score:adjust':
        // Adjust team score by delta (service will emit score:updated → broadcasts.js wraps it)
        const { teamId, delta, reason } = payload;
        if (!teamId || delta === undefined) {
          throw new Error('teamId and delta are required for score:adjust');
        }
        transactionService.adjustTeamScore(teamId, delta, reason || 'Admin adjustment');
        resultMessage = `Team ${teamId} score adjusted by ${delta}`;
        logger.info('Team score adjusted by GM', {
          gmStation: socket.deviceId,
          teamId,
          delta,
          reason
        });
        break;

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

    // Unwrap envelope (data.data contains actual transaction data per AsyncAPI contract)
    const transactionData = data.data || data;

    const { scanRequestSchema, validate } = require('../utils/validators');
    const scanRequest = validate(transactionData, scanRequestSchema);

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