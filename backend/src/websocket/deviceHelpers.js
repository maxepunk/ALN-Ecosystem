/**
 * Device Helpers
 * Shared utilities for device lifecycle management
 * Used by deviceTracking.js (WebSocket disconnects) and heartbeatMonitorService (HTTP timeouts)
 */

const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');
const { emitWrapped } = require('./eventWrapper');

/**
 * Handle device disconnection - shared logic for both WebSocket and HTTP devices
 * Updates device status in session and broadcasts device:disconnected event
 *
 * @param {Server} io - Socket.io server instance
 * @param {Object} device - Device object from session.connectedDevices
 * @param {string} reason - Disconnect reason ('manual', 'heartbeat_timeout', etc.)
 * @returns {Promise<void>}
 */
async function disconnectDevice(io, device, reason = 'manual') {
  if (!device || !device.id) {
    logger.warn('disconnectDevice called with invalid device', { device });
    return;
  }

  try {
    // Update device status
    device.connectionStatus = 'disconnected';
    await sessionService.updateDevice(device);

    // Broadcast disconnection to all clients
    emitWrapped(io, 'device:disconnected', {
      deviceId: device.id,
      type: device.type,
      disconnectionTime: new Date().toISOString(),
      reason
    });

    logger.info('Device disconnected', {
      deviceId: device.id,
      type: device.type,
      reason
    });
  } catch (error) {
    logger.error('Failed to disconnect device', {
      deviceId: device.id,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  disconnectDevice
};
