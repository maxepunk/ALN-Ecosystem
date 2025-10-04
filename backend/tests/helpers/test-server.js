/**
 * Test Server Setup Utility
 * Creates HTTP server + Socket.IO for WebSocket contract tests
 */

const http = require('http');
const app = require('../../src/app');
const { initializeServices } = require('../../src/app');
const { createSocketServer } = require('../../src/websocket/socketServer');
const logger = require('../../src/utils/logger');

// Import WebSocket setup from server.js pattern
const { handleGmIdentify } = require('../../src/websocket/gmAuth');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../src/websocket/broadcasts');
const { handleDisconnect, handleSyncRequest } = require('../../src/websocket/deviceTracking');
const { handleGmCommand, handleTransactionSubmit } = require('../../src/websocket/adminEvents');

/**
 * Setup test server with WebSocket support
 * @returns {Promise<Object>} Server context { server, io, port, url }
 */
async function setupTestServer() {
  // Initialize services
  await initializeServices();

  // Create HTTP server
  const server = http.createServer(app.app);

  // Create Socket.IO server
  const io = createSocketServer(server);

  // Setup WebSocket handlers (minimal for tests)
  io.on('connection', async (socket) => {
    logger.info('Test WebSocket connection', { socketId: socket.id });

    // GM identification
    socket.on('gm:identify', async (data) => {
      await handleGmIdentify(socket, data, io);
    });

    // Sync request
    socket.on('sync:request', async () => {
      await handleSyncRequest(socket, io);
    });

    // Transaction submit
    socket.on('transaction:submit', async (data) => {
      await handleTransactionSubmit(socket, data, io);
    });

    // GM command
    socket.on('gm:command', async (data) => {
      await handleGmCommand(socket, data, io);
    });

    // Disconnect
    socket.on('disconnect', () => {
      handleDisconnect(socket, io);
    });
  });

  // Setup broadcast listeners (service events → WebSocket broadcasts)
  const sessionService = require('../../src/services/sessionService');
  const transactionService = require('../../src/services/transactionService');
  const stateService = require('../../src/services/stateService');
  const videoQueueService = require('../../src/services/videoQueueService');
  const offlineQueueService = require('../../src/services/offlineQueueService');

  setupBroadcastListeners(io, {
    sessionService,
    stateService,
    videoQueueService,
    offlineQueueService,
    transactionService
  });

  // Start server on random available port
  const port = await new Promise((resolve) => {
    const svr = server.listen(0, () => {
      resolve(svr.address().port);
    });
  });

  const url = `http://localhost:${port}`;

  logger.info('Test server started', { port, url });

  return {
    server,
    io,
    port,
    url,
    socketUrl: url // For connectAndIdentify helper
  };
}

/**
 * Cleanup test server
 * @param {Object} context - Server context from setupTestServer
 */
async function cleanupTestServer(context) {
  if (!context) return;

  const { server, io } = context;

  // CRITICAL: Clean up broadcast listeners FIRST to prevent memory leaks
  // This was the root cause of force exit warnings in test suite
  cleanupBroadcastListeners();
  logger.debug('Broadcast listeners cleaned up');

  // Close all socket connections
  if (io) {
    const sockets = await io.fetchSockets();
    sockets.forEach(socket => socket.disconnect(true));

    // Close Socket.IO server
    io.close();
  }

  // Close HTTP server
  if (server) {
    await new Promise((resolve) => {
      server.close(() => {
        logger.info('Test server closed');
        resolve();
      });
    });
  }

  // Reset services (CRITICAL: include ALL services to prevent leaks)
  const sessionService = require('../../src/services/sessionService');
  const transactionService = require('../../src/services/transactionService');
  const stateService = require('../../src/services/stateService');
  const videoQueueService = require('../../src/services/videoQueueService');
  const offlineQueueService = require('../../src/services/offlineQueueService');

  await sessionService.reset();
  await transactionService.reset();
  await stateService.reset();
  videoQueueService.reset(); // Clears playback timers
  offlineQueueService.reset(); // Clears queue state

  // Remove all event listeners to prevent memory leaks
  sessionService.removeAllListeners();
  transactionService.removeAllListeners();
  stateService.removeAllListeners();
  videoQueueService.removeAllListeners();
  offlineQueueService.removeAllListeners();
}

module.exports = {
  setupTestServer,
  cleanupTestServer
};
