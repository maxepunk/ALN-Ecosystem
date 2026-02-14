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
const displayControlService = require('../services/displayControlService');
const vlcService = require('../services/vlcService');
const bluetoothService = require('../services/bluetoothService');
const audioRoutingService = require('../services/audioRoutingService');
const lightingService = require('../services/lightingService');
const { emitWrapped } = require('./eventWrapper');
const { executeCommand } = require('../services/commandExecutor');

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

    // Handle system:reset separately (requires io and mutex)
    if (action === 'system:reset') {
      // MUTEX PROTECTION: Prevent concurrent resets from causing race conditions
      if (resetInProgress) {
        throw new Error('System reset already in progress. Please wait.');
      }

      resetInProgress = true;
      try {
        const { performSystemReset } = require('../services/systemReset');
        const gameClockService = require('../services/gameClockService');
        const cueEngineService = require('../services/cueEngineService');
        const soundService = require('../services/soundService');

        logger.info('System reset requested by GM', { gmStation: socket.deviceId });

        await performSystemReset(io, {
          sessionService,
          stateService,
          transactionService,
          offlineQueueService,
          videoQueueService,
          displayControlService,
          vlcService,
          bluetoothService,
          audioRoutingService,
          lightingService,
          gameClockService,
          cueEngineService,
          soundService,
        });

        const resultMessage = 'System reset complete - ready for new session';
        logger.info('System reset by GM complete', { gmStation: socket.deviceId });

        // Send success ack
        emitWrapped(socket, 'gm:command:ack', {
          action: action,
          success: true,
          message: resultMessage
        });
      } finally {
        resetInProgress = false;
      }
      return;
    }

    // Execute command via shared commandExecutor
    const result = await executeCommand({
      action,
      payload,
      source: 'gm',
      deviceId: socket.deviceId,
      deviceType: socket.deviceType
    });

    // Handle broadcasts (if any)
    if (result.broadcasts && result.broadcasts.length > 0) {
      for (const broadcast of result.broadcasts) {
        if (broadcast.target === 'all') {
          // Broadcast to sender and all other clients
          emitWrapped(socket, broadcast.event, broadcast.data);
          emitWrapped(socket.broadcast, broadcast.event, broadcast.data);
        } else if (broadcast.target === 'socket') {
          // Send only to requesting socket
          emitWrapped(socket, broadcast.event, broadcast.data);
        }
      }
    }

    // Send AsyncAPI-compliant ack
    emitWrapped(socket, 'gm:command:ack', {
      action: action,
      success: result.success,
      message: result.message
    });
  } catch (error) {
    const commandData = data.data || data;
    const action = commandData.action;
    // Log with serializable error properties (Error objects don't serialize by default)
    logger.error('GM command error', {
      errorMessage: error.message,
      errorStack: error.stack,
      action,
      socketId: socket.id,
      payload: commandData.payload
    });

    // Send failure ack so client doesn't timeout waiting
    emitWrapped(socket, 'gm:command:ack', {
      action: action,
      success: false,
      message: error.message || 'Command failed'
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

    // Check if session is not active (FR 1.2: transactions rejected when paused or in setup)
    if (session.status !== 'active') {
      const errorCode = session.status === 'paused' ? 'SESSION_PAUSED' : 'SESSION_NOT_ACTIVE';
      const errorMsg = session.status === 'paused' ? 'Session is paused' : 'Game has not started yet';
      emitWrapped(socket, 'transaction:result', {
        status: 'error',
        transactionId: null,
        tokenId: scanRequest.tokenId,
        teamId: scanRequest.teamId,
        points: 0,
        message: errorMsg,
        error: errorCode
      });
      logger.info(`Transaction blocked (session ${session.status})`, {
        deviceId: socket.deviceId,
        tokenId: scanRequest.tokenId
      });
      return;
    }

    // Slice 5: Session param removed - processScan gets session internally
    // Event-driven persistence handles transaction storage via transaction:accepted
    const result = await transactionService.processScan(scanRequest);

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