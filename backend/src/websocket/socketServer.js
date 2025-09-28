/**
 * Socket Server Setup
 * Initializes and configures Socket.io server
 */

const { Server } = require('socket.io');
const config = require('../config');
const logger = require('../utils/logger');

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

  logger.info('Socket.io server created with configuration', {
    pingTimeout: config.websocket.pingTimeout,
    pingInterval: config.websocket.pingInterval,
    maxPayloadSize: config.websocket.maxPayloadSize,
  });

  return io;
}

module.exports = { createSocketServer };