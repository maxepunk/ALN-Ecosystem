/**
 * Socket Server Setup
 * Initializes and configures Socket.io server
 */

const { Server } = require('socket.io');
const config = require('../config');
const logger = require('../utils/logger');
const { verifyToken } = require('../middleware/auth');

/**
 * Create and configure Socket.io server
 * @param {http.Server} httpServer - HTTP server instance
 * @returns {Server} Configured Socket.io server
 */
function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow no-origin requests
        if (!origin) return callback(null, true);

        // Check configured origins
        if (config.server.corsOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Allow all local network ranges (RFC1918)
        const localNetwork = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;
        if (localNetwork.test(origin)) {
          return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
    pingTimeout: config.websocket.pingTimeout,
    pingInterval: config.websocket.pingInterval,
    maxHttpBufferSize: config.websocket.maxPayloadSize,
  });

  // PHASE 2.1 (P1.3): Socket.io middleware for GM authentication
  // Validates JWT tokens at handshake level BEFORE connection is established
  io.use((socket, next) => {
    const { token, deviceId, deviceType, version } = socket.handshake.auth || {};

    // Only GM stations require JWT authentication
    if (deviceType === 'gm') {
      // Validate required fields
      if (!token) {
        logger.warn('GM connection rejected: missing token', { socketId: socket.id });
        return next(new Error('AUTH_REQUIRED: Token required for GM stations'));
      }

      if (!deviceId) {
        logger.warn('GM connection rejected: missing deviceId', { socketId: socket.id });
        return next(new Error('AUTH_REQUIRED: deviceId required'));
      }

      // Verify JWT token
      const decoded = verifyToken(token);
      if (!decoded || decoded.role !== 'admin') {
        logger.warn('GM connection rejected: invalid token', {
          socketId: socket.id,
          deviceId
        });
        return next(new Error('AUTH_INVALID: Invalid or expired token'));
      }

      // Check for device ID collision (only check CONNECTED devices, allow reconnection)
      const sessionService = require('../services/sessionService');
      const currentSession = sessionService.getCurrentSession();
      if (currentSession) {
        const connectedDevices = (currentSession.toJSON().connectedDevices || [])
          .filter(d => d.connectionStatus === 'connected');

        const existingDevice = connectedDevices.find(d =>
          d.id === deviceId && d.type === 'gm'
        );

        if (existingDevice) {
          logger.warn('GM connection rejected: device ID already in use', {
            socketId: socket.id,
            deviceId,
            existingIp: existingDevice.ipAddress
          });
          return next(new Error('DEVICE_ID_COLLISION: This device ID is already connected from another location'));
        }
      }

      // Pre-authenticate socket - store auth data for connection handler
      socket.isAuthenticated = true;
      socket.authRole = decoded.role;
      socket.authUserId = decoded.id;
      socket.deviceId = deviceId;
      socket.deviceType = deviceType;
      socket.version = version || '1.0.0';

      logger.info('GM station authenticated at handshake', {
        deviceId,
        socketId: socket.id,
        version: socket.version
      });
    }

    // Allow connection
    next();
  });

  logger.info('Socket.io server created with configuration', {
    pingTimeout: config.websocket.pingTimeout,
    pingInterval: config.websocket.pingInterval,
    maxPayloadSize: config.websocket.maxPayloadSize,
  });

  return io;
}

module.exports = { createSocketServer };