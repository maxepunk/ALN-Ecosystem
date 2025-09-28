/**
 * GM Authentication Handler
 * Handles GM station authentication and identification
 */

const logger = require('../utils/logger');
const { gmIdentifySchema, validate } = require('../utils/validators');
const DeviceConnection = require('../models/deviceConnection');
const sessionService = require('../services/sessionService');
const stateService = require('../services/stateService');

/**
 * Handle GM station identification
 * @param {Socket} socket - Socket.io socket instance
 * @param {Object} data - Identification data per contract (stationId, version, token)
 * @param {Server} io - Socket.io server instance
 */
async function handleGmIdentify(socket, data, io) {
  try {
    // Extract token from data (not part of schema validation)
    const { token, ...identifyDataToValidate } = data;

    // Require authentication token
    if (!token) {
      socket.emit('error', {
        code: 'AUTH_REQUIRED',
        message: 'Authentication token required for GM station'
      });
      socket.disconnect(true);
      return;
    }

    // Validate token
    const { verifyToken } = require('../middleware/auth');
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== 'admin') {
      socket.emit('error', {
        code: 'AUTH_INVALID',
        message: 'Invalid or expired authentication token'
      });
      socket.disconnect(true);
      return;
    }

    // Store authenticated status
    socket.isAuthenticated = true;
    socket.authRole = decoded.role;
    socket.authUserId = decoded.id;

    // Validate against contract schema (without token)
    const identifyData = validate(identifyDataToValidate, gmIdentifySchema);

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
    
    // Join appropriate room
    if (device.type === 'gm') {
      // Check if can accept GM station
      if (!sessionService.canAcceptGmStation()) {
        socket.emit('error', {
          message: 'Maximum GM stations reached',
        });
        socket.disconnect(true);
        return;
      }
      socket.join('gm-stations');
    } else {
      // Check if can accept player
      if (!sessionService.canAcceptPlayer()) {
        socket.emit('error', {
          message: 'Maximum players reached',
        });
        socket.disconnect(true);
        return;
      }
      socket.join('players');
    }
    
    // Update session with device
    const session = sessionService.getCurrentSession();
    if (session) {
      await sessionService.updateDevice(device.toJSON());
      // Join session room
      socket.join(`session:${session.id}`);
    }
    
    // Get current state
    const state = stateService.getCurrentState();
    
    // Send current state
    if (state) {
      socket.emit('state:sync', state.toJSON());
    }
    
    // Confirm identification with contract-compliant response
    socket.emit('gm:identified', {
      success: true,
      sessionId: session?.id,
      state: state?.toJSON(),
    });
    
    // Broadcast device connection to OTHER clients only (contract-compliant format)
    socket.broadcast.emit('device:connected', {
      event: 'device:connected',
      data: {
        deviceId: device.id,
        type: device.type,
        name: device.name,
        ipAddress: socket.handshake.address,
      },
      timestamp: new Date().toISOString()
    });
    
    logger.logSocketEvent('gm:identify', socket.id, {
      deviceId: device.id,
      deviceType: device.type,
    });
  } catch (error) {
    logger.error('Device identification failed', { error, socketId: socket.id });
    // Pass through the actual validation error message which includes field names
    socket.emit('error', {
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
      socket.emit('error', {
        code: 'AUTH_REQUIRED',
        message: 'Station not identified or ID mismatch'
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

    socket.emit('heartbeat:ack', {
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Heartbeat error', { error, socketId: socket.id });
  }
}

module.exports = {
  handleGmIdentify,
  handleHeartbeat,
};