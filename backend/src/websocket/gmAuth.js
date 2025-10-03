/**
 * GM Authentication Handler
 * Handles GM station authentication and identification
 */

const logger = require('../utils/logger');
const DeviceConnection = require('../models/deviceConnection');
const sessionService = require('../services/sessionService');
const stateService = require('../services/stateService');
const { emitWrapped } = require('./eventWrapper');

/**
 * Handle GM station identification
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Identification data per contract (stationId, version, token)
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

    logger.info('GM already authenticated from handshake', {
      deviceId: socket.deviceId,
      socketId: socket.id,
    });

    // Use data from handshake
    const identifyData = {
      stationId: socket.deviceId,
      version: socket.version || data.version || '1.0.0',
    };

    // Transform contract data to DeviceConnection format
    const deviceData = {
      deviceId: identifyData.stationId,
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

    // Send current state
    if (state) {
      emitWrapped(socket, 'state:sync', state.toJSON());
    }

    // Confirm identification with contract-compliant response
    emitWrapped(socket, 'gm:identified', {
      success: true,
      sessionId: session?.id,
      state: state?.toJSON(),
    });

    // Broadcast device connection to OTHER clients only
    // Fixed: Send flat structure that admin panel expects
    emitWrapped(socket.broadcast, 'device:connected', {
      deviceId: device.id,
      type: device.type,
      name: device.name,
      ipAddress: socket.handshake.address,

    });

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

/**
 * Handle heartbeat from GM station
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Heartbeat data containing stationId
 */
async function handleHeartbeat(socket, data) {
  try {
    // Validate heartbeat data
    const { wsHeartbeatSchema, validate: validateHeartbeat } = require('../utils/validators');
    const heartbeatData = validateHeartbeat(data, wsHeartbeatSchema);

    // Verify the stationId matches the socket's deviceId
    if (!socket.deviceId || socket.deviceId !== heartbeatData.stationId) {
      emitWrapped(socket, 'error', {
        code: 'AUTH_REQUIRED',
        message: 'Station not identified or ID mismatch',
      });
      return;
    }

    // Update device heartbeat
    const session = sessionService.getCurrentSession();
    if (session) {
      const device = session.connectedDevices.find(d => d.id === socket.deviceId);
      if (device) {
        device.lastHeartbeat = new Date().toISOString();
        await sessionService.updateDevice(device);
      }
    }

    emitWrapped(socket, 'heartbeat:ack', {

    });
  } catch (error) {
    logger.error('Heartbeat error', { error, socketId: socket.id });
  }
}

module.exports = {
  handleGmIdentify,
  handleHeartbeat,
};
