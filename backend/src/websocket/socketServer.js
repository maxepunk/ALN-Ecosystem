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
      origin: config.server.corsOrigins,
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