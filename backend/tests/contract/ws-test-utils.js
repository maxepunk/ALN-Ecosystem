/**
 * Shared utilities for WebSocket contract tests
 * Handles dynamic port allocation to avoid conflicts
 */

const io = require('socket.io-client');

/**
 * Setup a test server with dynamic port allocation
 * @returns {Promise<{server, ioServer, app, port, socketUrl}>}
 */
async function setupTestServer() {
  // Clean environment
  process.env.NODE_ENV = 'test';
  // Video services should work in test mode (without actual VLC)

  // Reset modules to get fresh instances
  jest.resetModules();

  // Import the REAL server setup
  const serverModule = require('../../src/server');

  // Create server instances (without starting)
  const { server, io: ioServer } = serverModule.createServer();
  const app = serverModule.app;

  // Initialize services
  await serverModule.initializeServices();

  // Create a test session and GameState
  const sessionService = require('../../src/services/sessionService');
  const session = await sessionService.createSession({ name: 'Test Session' });

  // Create GameState from session
  const stateService = require('../../src/services/stateService');
  stateService.createStateFromSession(session);

  // Start listening on a dynamic port (0 = let OS assign)
  const port = await new Promise((resolve, reject) => {
    server.listen(0, (err) => {
      if (err) {
        reject(err);
      } else {
        const assignedPort = server.address().port;
        resolve(assignedPort);
      }
    });
  });

  const socketUrl = `http://localhost:${port}`;

  return {
    server,
    ioServer,
    app,
    port,
    socketUrl,
  };
}

/**
 * Cleanup test server and all connections
 * @param {Object} testContext - The context returned from setupTestServer
 * @param {Socket} clientSocket - Optional client socket to disconnect
 */
async function cleanupTestServer(testContext, clientSocket) {
  const { server, ioServer } = testContext;

  // CRITICAL: Clean up broadcast listeners FIRST to prevent accumulation
  const { cleanupBroadcastListeners } = require('../../src/websocket/broadcasts');
  cleanupBroadcastListeners();

  // Import all services for comprehensive cleanup
  const sessionService = require('../../src/services/sessionService');
  const stateService = require('../../src/services/stateService');
  const transactionService = require('../../src/services/transactionService');
  const videoQueueService = require('../../src/services/videoQueueService');
  const offlineQueueService = require('../../src/services/offlineQueueService');
  const persistenceService = require('../../src/services/persistenceService');
  const vlcService = require('../../src/services/vlcService');

  // Clean up test session
  if (sessionService.getCurrentSession()) {
    await sessionService.endSession();
  }

  // Reset all service states for test isolation
  await sessionService.reset();
  await stateService.reset();
  if (transactionService.reset) {
    transactionService.reset();
  }
  if (videoQueueService.reset) {
    videoQueueService.reset();
  }
  if (offlineQueueService.reset) {
    await offlineQueueService.reset();
  }
  if (vlcService.reset) {
    vlcService.reset();
  }

  // CRITICAL: Reset offline mode to prevent test contamination
  offlineQueueService.setOfflineStatus(false);
  offlineQueueService.queue = [];
  offlineQueueService.processingQueue = false;

  // Clear persistence storage to avoid cross-test contamination
  await persistenceService.delete('gameState:current');
  await persistenceService.delete('offlineQueue');

  // CRITICAL: Cleanup persistence service to stop node-persist intervals
  if (persistenceService.cleanup) {
    await persistenceService.cleanup();
  }

  // Close client socket if provided
  if (clientSocket) {
    if (Array.isArray(clientSocket)) {
      clientSocket.forEach(s => s && s.connected && s.disconnect());
    } else if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  }

  // Disconnect all server sockets
  if (ioServer) {
    const sockets = await ioServer.fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    // Close Socket.io server
    await new Promise((resolve) => {
      ioServer.close(() => resolve());
    });
  }

  // Close HTTP server
  if (server) {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  // Call server cleanup to properly clean all resources
  const serverModule = require('../../src/server');
  if (serverModule.cleanup) {
    await serverModule.cleanup();
  }

  // CRITICAL: Clear server and app modules from cache to ensure fresh state for next test file
  delete require.cache[require.resolve('../../src/server')];
  delete require.cache[require.resolve('../../src/app')];

  // Environment cleanup handled by jest

  // Clean up any remaining timers
  jest.clearAllTimers();

  // Force garbage collection if available (helps with memory leaks in tests)
  if (global.gc) {
    global.gc();
  }
}

/**
 * Create a client socket that connects and identifies as GM
 * @param {string} socketUrl - The socket URL to connect to
 * @param {string} stationId - The GM station ID
 * @returns {Promise<Socket>} Connected and identified socket
 */
async function createGMClient(socketUrl, stationId = 'GM_TEST') {
  const clientSocket = io(socketUrl, {
    transports: ['websocket'],
    reconnection: false,
  });

  await new Promise((resolve) => {
    clientSocket.on('connect', () => {
      clientSocket.emit('gm:identify', {
        stationId,
        version: '1.0.0',
      });
    });

    clientSocket.on('gm:identified', () => resolve());
  });

  return clientSocket;
}

module.exports = {
  setupTestServer,
  cleanupTestServer,
  createGMClient,
};