/**
 * Device Tracking Handler
 * Manages device connections and disconnections
 */

const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');
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

    const stateService = require('../services/stateService');
    const state = stateService.getCurrentState();
    const session = sessionService.getCurrentSession();

    if (state || session) {
      emitWrapped(socket, 'sync:full', {
        session: session?.toJSON(),
        state: state?.toJSON(),
        devices: session?.connectedDevices || [],
        transactions: session?.transactions?.slice(-100) || [],
      });

      logger.info('Sent full sync to device', { deviceId: socket.deviceId });
    }
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
 * Monitor device health and remove stale connections
 * @param {Server} io - Socket.io server instance
 * @param {number} staleThresholdMs - Threshold in milliseconds for stale connections
 */
async function monitorDeviceHealth(io, staleThresholdMs = 60000) {
  const session = sessionService.getCurrentSession();
  if (!session) return;

  const now = Date.now();
  const staleDevices = [];

  for (const device of session.connectedDevices) {
    if (device.connectionStatus === 'connected' && device.lastHeartbeat) {
      const lastHeartbeat = new Date(device.lastHeartbeat).getTime();
      if (now - lastHeartbeat > staleThresholdMs) {
        staleDevices.push(device);
      }
    }
  }

  // Mark stale devices as disconnected
  for (const device of staleDevices) {
    device.connectionStatus = 'disconnected';
    await sessionService.updateDevice(device);
    
    // Broadcast disconnection
    emitWrapped(io, 'device:disconnected', {
      deviceId: device.id,
      reason: 'timeout',
    });
    
    logger.warn('Device marked as disconnected due to timeout', { 
      deviceId: device.id,
      lastHeartbeat: device.lastHeartbeat,
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
  monitorDeviceHealth,
  getDeviceStats,
};