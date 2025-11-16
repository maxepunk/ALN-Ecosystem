/**
 * Device Tracking Handler
 * Manages device connections and disconnections
 */

const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');
const transactionService = require('../services/transactionService');
const videoQueueService = require('../services/videoQueueService');
const vlcService = require('../services/vlcService');
const { emitWrapped } = require('./eventWrapper');

/**
 * Handle device disconnection
 * @param {Socket} socket - Socket.io socket instance
 * @param {Server} io - Socket.io server instance
 */
async function handleDisconnect(socket, io) {
  try {
    // Check if this was an identified device
    if (socket.deviceId) {
      // Identified device - full handling
      const session = sessionService.getCurrentSession();
      if (session) {
        const device = session.connectedDevices.find(d => d.id === socket.deviceId);
        if (device) {
          device.connectionStatus = 'disconnected';
          await sessionService.updateDevice(device);

          // Broadcast disconnection to other clients
          emitWrapped(io, 'device:disconnected', {
            deviceId: socket.deviceId,
            type: socket.deviceType,
            disconnectionTime: new Date().toISOString(),
            reason: 'manual',
          });
        }
      }

      // Full logging for identified devices
      logger.logSocketEvent('disconnect', socket.id, {
        deviceId: socket.deviceId,
        deviceType: socket.deviceType,
      });
    } else {
      // Pre-auth disconnect - minimal debug logging only
      // This happens when socket connects but disconnects before gm:identify
      logger.debug('Pre-auth socket disconnected', {
        socketId: socket.id
        // No deviceId to log - this is expected behavior
      });
    }
  } catch (error) {
    logger.error('Disconnect handler error', { error, socketId: socket.id });
  }
}

/**
 * Handle sync request from client
 * @param {Socket} socket - Socket.io socket instance
 */
function handleSyncRequest(socket) {
  try {
    if (!socket.deviceId) {
      emitWrapped(socket, 'error', {
        code: 'AUTH_REQUIRED',
        message: 'Not identified'
      });
      return;
    }

    const session = sessionService.getCurrentSession();

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

    // Enrich ALL transactions with token data (for full state restoration)
    // CRITICAL: Send ALL transactions, not just recent 100, to support team details screen
    // after page refresh. Frontend DataManager needs complete transaction history.
    const recentTransactions = (session?.transactions || []).map(transaction => {
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
        valueRating: token?.metadata?.rating || 0,
        summary: transaction.summary || null  // Summary from transaction (complete persisted record)
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

    logger.info('Sent full sync to device', { deviceId: socket.deviceId });
  } catch (error) {
    logger.error('Sync request error', { error, socketId: socket.id });
    emitWrapped(socket, 'error', {
      code: 'SERVER_ERROR',
      message: 'Failed to sync state',
      details: error.message,
    });
  }
}

/**
 * Get connected device statistics
 * @returns {Object} Device statistics
 */
function getDeviceStats() {
  const session = sessionService.getCurrentSession();
  if (!session) {
    return {
      total: 0,
      connected: 0,
      gmStations: 0,
      players: 0,
    };
  }

  const devices = session.connectedDevices || [];
  const connected = devices.filter(d => d.connectionStatus === 'connected');
  const gmStations = connected.filter(d => d.type === 'gm');
  const players = connected.filter(d => d.type === 'player');

  return {
    total: devices.length,
    connected: connected.length,
    gmStations: gmStations.length,
    players: players.length,
  };
}

module.exports = {
  handleDisconnect,
  handleSyncRequest,
  getDeviceStats,
};