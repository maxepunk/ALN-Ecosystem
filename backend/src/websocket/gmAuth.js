/**
 * GM Authentication Handler
 * Handles GM station authentication and identification
 */

const logger = require('../utils/logger');
const DeviceConnection = require('../models/deviceConnection');
const sessionService = require('../services/sessionService');
const stateService = require('../services/stateService');
const transactionService = require('../services/transactionService');
const videoQueueService = require('../services/videoQueueService');
const vlcService = require('../services/vlcService');
const { emitWrapped } = require('./eventWrapper');

/**
 * Handle GM station identification
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Identification data per AsyncAPI contract (deviceId, version, token)
 * @param {Server} io - Socket.io server instance
 */
async function handleGmIdentify(socket, data, io) {
  try {
    // Validate that socket is pre-authenticated from handshake
    if (!socket.isAuthenticated || !socket.deviceId) {
      emitWrapped(socket, 'error', {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required - connection not pre-authenticated',
      });
      socket.disconnect(true);
      return;
    }

    // Use data from handshake
    const identifyData = {
      deviceId: socket.deviceId,
      version: socket.version || '1.0.0',
    };

    logger.info('GM already authenticated from handshake', {
      deviceId: identifyData.deviceId,
      socketId: socket.id,
    });

    // Transform contract data to DeviceConnection format
    const deviceData = {
      deviceId: identifyData.deviceId,
      deviceType: 'gm', // GM stations always have type 'gm'
      name: `GM Station v${identifyData.version}`,
    };

    // Create device connection
    const device = DeviceConnection.fromIdentify(
      deviceData,
      socket.handshake.address
    );

    // Store device info on socket
    socket.deviceId = device.id;
    socket.deviceType = device.type;
    socket.version = identifyData.version;

    // Check if can accept GM station
    if (!sessionService.canAcceptGmStation()) {
      emitWrapped(socket, 'error', {
        message: 'Maximum GM stations reached',
      });
      socket.disconnect(true);
      return;
    }
    socket.join('gm-stations');
    // Note: Removed else block - deviceType is always 'gm' (see line 44)

    // Update session with device ONLY if session exists
    const session = sessionService.getCurrentSession();
    if (session) {
      await sessionService.updateDevice(device.toJSON());
      // Join session room
      socket.join(`session:${session.id}`);
    } else {
      // No session yet - GM is connecting to create one via Admin panel
      logger.info('GM connected without active session - awaiting session creation', {
        deviceId: socket.deviceId,
      });
    }

    // Get current state
    const state = stateService.getCurrentState();

    // Get video queue status
    const videoStatus = {
      status: videoQueueService.currentStatus || 'idle',
      queueLength: (videoQueueService.queue || []).length,
      tokenId: videoQueueService.currentVideo?.tokenId || null,
      duration: videoQueueService.currentVideo?.duration || null,
      progress: videoQueueService.currentVideo?.progress || null,
      expectedEndTime: videoQueueService.currentVideo?.expectedEndTime || null,
      error: videoQueueService.currentVideo?.error || null
    };

    // Get VLC connection status
    const vlcConnected = vlcService?.isConnected ? vlcService.isConnected() : false;

    // Enrich recent transactions with token data (for admin panel display)
    const recentTransactions = (session?.transactions?.slice(-100) || []).map(transaction => {
      const token = transactionService.getToken(transaction.tokenId);
      return {
        id: transaction.id,
        tokenId: transaction.tokenId,
        teamId: transaction.teamId,
        deviceId: transaction.deviceId,
        mode: transaction.mode,
        status: transaction.status,
        points: transaction.points,
        timestamp: transaction.timestamp,
        memoryType: token?.memoryType || 'UNKNOWN',
        valueRating: token?.metadata?.rating || 0
      };
    });

    // Send full state sync per AsyncAPI contract (sync:full event)
    // Per AsyncAPI lines 335-341: requires session, scores, recentTransactions, videoStatus, devices, systemStatus
    emitWrapped(socket, 'sync:full', {
      session: session ? session.toJSON() : null,
      scores: transactionService.getTeamScores(),
      recentTransactions,
      videoStatus: videoStatus,
      devices: (session?.connectedDevices || []).map(device => ({
        deviceId: device.id,
        type: device.type,
        name: device.name,
        connectionTime: device.connectionTime,
        ipAddress: device.ipAddress
      })),
      systemStatus: {
        orchestrator: 'online',
        vlc: vlcConnected ? 'connected' : 'disconnected'
      }
    });

    // Confirm identification with contract-compliant response
    emitWrapped(socket, 'gm:identified', {
      success: true,
      deviceId: device.id,
      sessionId: session?.id,
      state: state?.toJSON(),
    });

    // Device connection broadcast now handled centrally by broadcasts.js
    // via device:updated listener (eliminates duplicate broadcasts)

    logger.logSocketEvent('gm:identify', socket.id, {
      deviceId: device.id,
      deviceType: device.type,
    });
  } catch (error) {
    logger.error('Device identification failed', { error, socketId: socket.id });
    // Pass through the actual validation error message which includes field names
    emitWrapped(socket, 'error', {
      code: 'INVALID_DATA',
      message: error.message || 'Invalid identification data',
      details: error.details || error.message,
    });
  }
}

module.exports = {
  handleGmIdentify,
};
