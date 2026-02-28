/**
 * Device Tracking Handler
 * Manages device connections and disconnections
 */

const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');
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

module.exports = {
  handleDisconnect,
};