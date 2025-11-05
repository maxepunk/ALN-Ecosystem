/**
 * Server Entry Point
 * Starts the ALN Orchestrator server with WebSocket support
 * Supports HTTPS for Web NFC API compatibility
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const app = require('./app');
const { initializeServices } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const DiscoveryService = require('./services/discoveryService');

// Import WebSocket modules
const { createSocketServer } = require('./websocket/socketServer');
const { handleGmIdentify } = require('./websocket/gmAuth');
const { setupBroadcastListeners } = require('./websocket/broadcasts');
const { handleDisconnect, handleSyncRequest } = require('./websocket/deviceTracking');
const { handleGmCommand, handleTransactionSubmit, handleStateRequest } = require('./websocket/adminEvents');

// Import services for WebSocket events
const sessionService = require('./services/sessionService');
const stateService = require('./services/stateService');
const videoQueueService = require('./services/videoQueueService');
const offlineQueueService = require('./services/offlineQueueService');
const transactionService = require('./services/transactionService');

// PHASE 1.3 (P0.3): Server state machine to enforce initialization order
const ServerState = {
  UNINITIALIZED: 'uninitialized',
  SERVICES_READY: 'services_ready',
  HANDLERS_READY: 'handlers_ready',
  LISTENING: 'listening'
};

// Server instances (created when needed)
let server = null;
let httpRedirectServer = null;
let io = null;
let discoveryService = null;
let isInitialized = false;
let serverState = ServerState.UNINITIALIZED;

// Setup WebSocket handlers (called when server is created)
// PHASE 1.3 (P0.3): Defensive check to enforce initialization order
function setupWebSocketHandlers(ioInstance) {
  // Validate state: services must be ready before setting up handlers
  if (serverState !== ServerState.SERVICES_READY && serverState !== ServerState.HANDLERS_READY) {
    throw new Error(`Cannot setup handlers in state: ${serverState}`);
  }

  ioInstance.on('connection', async (socket) => {
  logger.info('WebSocket connection established', { socketId: socket.id });

  // Check for auth in handshake (Phase 1 fix: prevent undefined device)
  // Extract auth from handshake per AsyncAPI contract (uses deviceId, not stationId)
  const { token, deviceId, deviceType, version } = socket.handshake.auth || {};

  if (token && deviceId && deviceType === 'gm') {
    // Pre-authenticate from handshake to prevent "undefined device"
    try {
      const { verifyToken } = require('./middleware/auth');
      const decoded = verifyToken(token);

      if (decoded && decoded.role === 'admin') {
        // Store auth info immediately
        socket.isAuthenticated = true;
        socket.authRole = decoded.role;
        socket.authUserId = decoded.id;
        socket.deviceId = deviceId;
        socket.deviceType = deviceType;
        socket.version = version;

        logger.info('GM station pre-authenticated from handshake', {
          deviceId: deviceId,
          socketId: socket.id
        });

        // Automatically trigger identification for pre-authenticated connections
        // This replaces the need for the scanner to send gm:identify
        await handleGmIdentify(socket, {
          deviceId: deviceId,  // Per AsyncAPI contract
          version,
          token
        }, ioInstance);
      }
    } catch (error) {
      logger.warn('Handshake auth failed', { error: error.message, socketId: socket.id });
    }
  }

  // State sync request
  socket.on('sync:request', () => {
    handleSyncRequest(socket);
  });
  
  // State request (contract compliant)
  socket.on('state:request', () => {
    handleStateRequest(socket);
  });
  
  // GM-specific events
  socket.on('gm:command', async (data) => {
    await handleGmCommand(socket, data, ioInstance);
  });

  // Transaction submission via WebSocket
  socket.on('transaction:submit', async (data) => {
    await handleTransactionSubmit(socket, data, ioInstance);
  });

  // Disconnection handling
  socket.on('disconnect', async () => {
    await handleDisconnect(socket, ioInstance);
    });
  });

  // PHASE 1.3 (P0.3): Transition state after handlers are set up
  serverState = ServerState.HANDLERS_READY;
  logger.info('WebSocket handlers configured', { state: serverState });
}

// Setup service event listeners (called when server is created)
function setupServiceListeners(ioInstance) {
  setupBroadcastListeners(ioInstance, {
    sessionService,
    stateService,
    videoQueueService,
    offlineQueueService,
    transactionService,
  });

  // Note: transaction:added is already handled by stateService.js which properly
  // manages recentTransactions updates. We don't need a duplicate listener here.
  // Scores are updated via transactionService's score:updated event.
}

// Graceful shutdown handling
async function shutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown`);
  
  try {
    // Stop discovery service
    if (discoveryService) {
      discoveryService.stop();
    }

    // Close WebSocket connections
    io.close(() => {
      logger.info('WebSocket server closed');
    });

    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Cleanup services
    await stateService.cleanup();

    // Save current session state (preserve AS-IS, don't end it)
    // Sessions end via explicit admin commands, not infrastructure events
    const session = sessionService.getCurrentSession();
    if (session) {
      await sessionService.saveCurrentSession();
      logger.info('Session state preserved for restart', {
        sessionId: session.id,
        status: session.status
      });
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

// Register shutdown handlers (only when running as main module)
function registerShutdownHandlers() {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Create server instances
function createServer() {
  if (!server) {
    // Create HTTPS server if enabled, otherwise HTTP
    if (config.ssl.enabled) {
      try {
        // Read SSL certificate files
        const keyPath = path.resolve(process.cwd(), config.ssl.keyPath);
        const certPath = path.resolve(process.cwd(), config.ssl.certPath);

        const sslOptions = {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath)
        };

        server = https.createServer(sslOptions, app);
        logger.info('HTTPS server created', { keyPath, certPath });
      } catch (error) {
        logger.error('Failed to load SSL certificates', { error: error.message });
        logger.warn('Falling back to HTTP server');
        server = http.createServer(app);
      }
    } else {
      server = http.createServer(app);
      logger.info('HTTP server created (HTTPS disabled)');
    }
  }

  // Create HTTP redirect server if HTTPS is enabled
  if (!httpRedirectServer && config.ssl.enabled) {
    httpRedirectServer = http.createServer((req, res) => {
      const host = req.headers.host?.split(':')[0] || 'localhost';
      const redirectUrl = `https://${host}:${config.server.port}${req.url}`;

      res.writeHead(301, { 'Location': redirectUrl });
      res.end();
    });
  }

  if (!io) {
    io = createSocketServer(server);
    // Store io in app.locals for routes to access
    app.locals.io = io;

    // PHASE 1.3 (P0.3): Don't setup handlers here - wait for startServer()
    // setupWebSocketHandlers will be called AFTER setupServiceListeners
  }

  if (!discoveryService && process.env.NODE_ENV !== 'test') {
    discoveryService = new DiscoveryService();
  }

  return { server, httpRedirectServer, io, discoveryService };
}

// Start server
async function startServer() {
  try {
    // Create server instances
    const instances = createServer();

    // PHASE 1.3 (P0.3): Initialize services and set state
    if (!isInitialized) {
      await initializeServices();
      isInitialized = true;
      serverState = ServerState.SERVICES_READY;
      logger.info('Services initialized', { state: serverState });
    }

    // PHASE 1.3 (P0.3): Setup service listeners BEFORE WebSocket handlers
    // Critical order: listeners must be registered before accepting connections
    setupServiceListeners(instances.io);
    logger.info('Service listeners configured');

    // PHASE 1.3 (P0.3): Setup WebSocket handlers (validates state)
    setupWebSocketHandlers(instances.io);

    // Start listening
    const port = config.server.port;
    const host = config.server.host;
    const protocol = config.ssl.enabled ? 'https' : 'http';

    instances.server.listen(port, host, async () => {
      // PHASE 1.3 (P0.3): Transition to LISTENING state
      serverState = ServerState.LISTENING;
      logger.info('Server transition to LISTENING state', { state: serverState });
      logger.info(`ALN Orchestrator server running at ${protocol}://${host}:${port}`);
      logger.info('WebSocket server ready for connections');
      logger.info('Environment:', {
        env: config.server.env,
        https: config.ssl.enabled,
        maxPlayers: config.session.maxPlayers,
        maxGmStations: config.session.maxGmStations,
      });

      // Start HTTP redirect server if HTTPS is enabled
      if (instances.httpRedirectServer) {
        const redirectPort = config.ssl.httpRedirectPort;
        instances.httpRedirectServer.listen(redirectPort, host, () => {
          logger.info(`HTTP redirect server running on port ${redirectPort} → ${protocol}://${host}:${port}`);
        });
      }

      // Start discovery service after server is listening (skip in tests)
      if (instances.discoveryService) {
        await instances.discoveryService.start(port);
      }
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Cleanup function for tests
async function cleanup() {
  if (discoveryService) {
    discoveryService.stop();
    discoveryService = null;
  }

  // PHASE 1.4 (P0.4): Cleanup broadcast listeners BEFORE closing io
  // This prevents listener leaks across startup/cleanup cycles
  const { cleanupBroadcastListeners } = require('./websocket/broadcasts');
  cleanupBroadcastListeners();
  logger.debug('Broadcast listeners cleaned up');

  if (io) {
    // CRITICAL: Disconnect all sockets BEFORE closing server (Socket.io best practice)
    try {
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        socket.disconnect(true);
      }
    } catch (e) {
      logger.warn('Error disconnecting sockets during cleanup', { error: e.message });
    }

    // Now close the Socket.io server with proper callback
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Socket.io close timeout'));
      }, 5000);

      io.close((err) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }).catch((err) => {
      logger.warn('Socket.io close error', { error: err.message });
    });

    io = null;
    // Clear from app.locals
    if (app && app.locals) {
      app.locals.io = null;
    }
  }

  if (server) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('HTTP server close timeout'));
      }, 5000);

      server.close((err) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }).catch((err) => {
      logger.warn('Server close error', { error: err.message });
    });
    server = null;
  }

  if (httpRedirectServer) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('HTTP redirect server close timeout'));
      }, 5000);

      httpRedirectServer.close((err) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }).catch((err) => {
      logger.warn('HTTP redirect server close error', { error: err.message });
    });
    httpRedirectServer = null;
  }

  isInitialized = false;
  // PHASE 1.3 (P0.3): Reset server state
  serverState = ServerState.UNINITIALIZED;
}

// Export for testing
module.exports = {
  createServer,
  startServer,
  cleanup,
  app,
  initializeServices,
  get server() { return server; },
  get io() { return io; },
  // PHASE 1.3 (P0.3): Export state and test helpers
  ServerState,
  getServerState: () => serverState,
  // Test helper: initialize services without starting server
  initializeForTest: async () => {
    if (!isInitialized) {
      await initializeServices();
      isInitialized = true;
      serverState = ServerState.SERVICES_READY;
    }
  },
  // Test helper: setup WebSocket handlers for testing
  setupWebSocketHandlersForTest: (ioInstance) => {
    setupWebSocketHandlers(ioInstance);
  },
  // Test helper: start server for testing (not exported by default)
  startServerForTest: async (options = {}) => {
    const instances = createServer();

    if (!isInitialized) {
      await initializeServices();
      isInitialized = true;
      serverState = ServerState.SERVICES_READY;
    }

    setupServiceListeners(instances.io);

    if (options.setupWebSocketHandlersOverride) {
      options.setupWebSocketHandlersOverride(instances.io);
    } else {
      setupWebSocketHandlers(instances.io);
    }

    return instances;
  }
};

// Only start server if run directly (not imported)
if (require.main === module) {
  registerShutdownHandlers();
  startServer();
}