/**
 * Device Tracking Handler
 * Manages device connections and disconnections
 */

const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');
const transactionService = require('../services/transactionService');
const videoQueueService = require('../services/videoQueueService');
const bluetoothService = require('../services/bluetoothService');
const audioRoutingService = require('../services/audioRoutingService');
const lightingService = require('../services/lightingService');
const gameClockService = require('../services/gameClockService');
const cueEngineService = require('../services/cueEngineService');
const spotifyService = require('../services/spotifyService');
const { emitWrapped } = require('./eventWrapper');
const { buildSyncFullPayload } = require('./syncHelpers');
const { disconnectDevice } = require('./deviceHelpers');

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
          await disconnectDevice(io, device, 'manual');
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
async function handleSyncRequest(socket) {
  try {
    if (!socket.deviceId) {
      emitWrapped(socket, 'error', {
        code: 'AUTH_REQUIRED',
        message: 'Not identified'
      });
      return;
    }

    const syncPayload = await buildSyncFullPayload({
      sessionService,
      transactionService,
      videoQueueService,
      bluetoothService,
      audioRoutingService,
      lightingService,
      gameClockService,
      cueEngineService,
      spotifyService,
      deviceFilter: { connectedOnly: true },
    });

    emitWrapped(socket, 'sync:full', syncPayload);

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

module.exports = {
  handleDisconnect,
  handleSyncRequest,
};