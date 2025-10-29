/**
 * Integration Test Server Setup Utility
 * CRITICAL DIFFERENCES from contract test-server.js:
 * 1. Properly cleans up broadcast listeners (prevents leaks)
 * 2. Preserves state between test steps (stateful flows)
 * 3. Uses full service initialization with real token data
 */

const http = require('http');
const app = require('../../src/app');
const { initializeServices } = require('../../src/app');
const { createSocketServer } = require('../../src/websocket/socketServer');
const logger = require('../../src/utils/logger');

// Import WebSocket setup
const { handleGmIdentify } = require('../../src/websocket/gmAuth');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../src/websocket/broadcasts');
const { handleDisconnect, handleSyncRequest } = require('../../src/websocket/deviceTracking');
const { handleGmCommand, handleTransactionSubmit } = require('../../src/websocket/adminEvents');

/**
 * Setup integration test server with full WebSocket support
 * @returns {Promise<Object>} Server context { server, io, port, url, socketUrl }
 */
async function setupIntegrationTestServer() {
  // Initialize ALL services with real token data
  await initializeServices();

  // Load all services (needed for verification + broadcast listeners)
  const sessionService = require('../../src/services/sessionService');
  const transactionService = require('../../src/services/transactionService');
  const stateService = require('../../src/services/stateService');
  const videoQueueService = require('../../src/services/videoQueueService');
  const offlineQueueService = require('../../src/services/offlineQueueService');

  // VERIFY services initialized correctly
  if (transactionService.tokens.size === 0) {
    throw new Error('Service initialization failed: tokens not loaded');
  }

  // Create HTTP server
  const server = http.createServer(app);

  // Create Socket.IO server
  const io = createSocketServer(server);

  // CRITICAL: Attach io to app.locals so scanRoutes can emit player:scan events
  app.locals.io = io;

  // Setup WebSocket handlers (match production src/server.js lines 36-103)
  io.on('connection', async (socket) => {
    logger.debug('Integration test WebSocket connection', { socketId: socket.id });

    // PRE-AUTHENTICATE from handshake (match production server.js lines 39-73)
    // Per AsyncAPI contract: handshake.auth uses deviceId, not stationId
    const { token, deviceId, deviceType, version } = socket.handshake.auth || {};

    if (token && deviceId && (deviceType === 'gm' || deviceType === 'admin')) {
      // Pre-authenticate (simulates successful HTTP JWT validation)
      socket.isAuthenticated = true;
      socket.authRole = 'admin';
      socket.authUserId = 'test-admin';
      socket.deviceId = deviceId;
      socket.deviceType = deviceType;
      socket.version = version || '1.0.0';

      logger.debug('Socket pre-authenticated from handshake', {
        deviceId: socket.deviceId,
        deviceType: socket.deviceType,
        socketId: socket.id
      });

      // Join appropriate room based on device type
      if (deviceType === 'admin') {
        socket.join('admin-monitors');
        logger.debug('Admin socket joined admin-monitors room', { socketId: socket.id });
      } else if (deviceType === 'gm') {
        // AUTO-CALL handleGmIdentify like production does (server.js line 64)
        // This registers device and triggers device:connected + sync:full
        await handleGmIdentify(socket, {
          deviceId: socket.deviceId,  // Per AsyncAPI contract
          version: socket.version,
          token: token
        }, io);
      }
    }

    // Sync request
    socket.on('sync:request', async () => {
      await handleSyncRequest(socket, io);
    });

    // Transaction submit
    socket.on('transaction:submit', async (data) => {
      logger.info('===== TRANSACTION SUBMIT DEBUG =====', {
        socketId: socket.id,
        deviceId: socket.deviceId,
        isAuthenticated: socket.isAuthenticated,
        deviceType: socket.deviceType,
        hasDeviceId: !!socket.deviceId
      });
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

  logger.info('Integration test server started', { port, url });

  return {
    server,
    io,
    port,
    url,
    socketUrl: url // For connectAndIdentify helper
  };
}

/**
 * Cleanup integration test server
 * CRITICAL: Properly cleans up broadcast listeners to prevent leaks
 * @param {Object} context - Server context from setupIntegrationTestServer
 */
async function cleanupIntegrationTestServer(context) {
  if (!context) return;

  const { server, io } = context;

  // CRITICAL: Clean up broadcast listeners FIRST (prevents leak)
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
        logger.debug('Integration test server closed');
        resolve();
      });
    });
  }

  // Reset services (clear state for next test)
  const sessionService = require('../../src/services/sessionService');
  const transactionService = require('../../src/services/transactionService');
  const stateService = require('../../src/services/stateService');
  const videoQueueService = require('../../src/services/videoQueueService');

  await sessionService.reset();
  await transactionService.reset();
  await stateService.reset();
  await videoQueueService.reset();

  // Remove remaining event listeners
  sessionService.removeAllListeners();
  transactionService.removeAllListeners();
  stateService.removeAllListeners();
  videoQueueService.removeAllListeners();

  logger.debug('Integration test server cleanup complete');
}

module.exports = {
  setupIntegrationTestServer,
  cleanupIntegrationTestServer
};
