/**
 * Server Entry Point
 * Starts the ALN Orchestrator server with WebSocket support
 */

const http = require('http');
const app = require('./app');
const { initializeServices } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const DiscoveryService = require('./services/discoveryService');

// Import WebSocket modules
const { createSocketServer } = require('./websocket/socketServer');
const { handleGmIdentify, handleHeartbeat } = require('./websocket/gmAuth');
const { setupBroadcastListeners } = require('./websocket/broadcasts');
const { handleDisconnect, handleSyncRequest } = require('./websocket/deviceTracking');
const { handleGmCommand, handleTransactionSubmit, handleStateRequest } = require('./websocket/adminEvents');

// Import services for WebSocket events
const sessionService = require('./services/sessionService');
const stateService = require('./services/stateService');
const videoQueueService = require('./services/videoQueueService');

// Server instances (created when needed)
let server = null;
let io = null;
let discoveryService = null;
let healthMonitorInterval = null;
let isInitialized = false;

// Setup WebSocket handlers (called when server is created)
function setupWebSocketHandlers(ioInstance) {
  ioInstance.on('connection', (socket) => {
  logger.info('WebSocket connection established', { socketId: socket.id });
  
  // Device identification
  socket.on('gm:identify', async (data) => {
    await handleGmIdentify(socket, data, io);
  });
  
  // Heartbeat handling
  socket.on('heartbeat', async (data) => {
    await handleHeartbeat(socket, data);
  });
  
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
    await handleGmCommand(socket, data, io);
  });
  
  // Transaction submission via WebSocket
  socket.on('transaction:submit', async (data) => {
    await handleTransactionSubmit(socket, data, io);
  });
  
  // Disconnection handling
  socket.on('disconnect', async () => {
    await handleDisconnect(socket, io);
    });
  });
}

// Setup service event listeners (called when server is created)
function setupServiceListeners(ioInstance) {
  setupBroadcastListeners(ioInstance, {
    sessionService,
    stateService,
    videoQueueService,
  });

  // Connect transaction events to state updates
  // This ensures state:update events are triggered when transactions are added
  sessionService.on('transaction:added', async (transaction) => {
  const session = sessionService.getCurrentSession();
  if (session) {
    // Update game state with new transaction data
    // This triggers state:updated event which broadcasts state:update
    await stateService.updateState({
      scores: JSON.parse(JSON.stringify(session.scores || [])), // Deep copy to ensure delta detection
      recentTransactions: session.getRecentTransactions(10),
      });
    }
  });
}

// Setup periodic device health monitoring
const { monitorDeviceHealth } = require('./websocket/deviceTracking');

function startHealthMonitoring(ioInstance) {
  if (process.env.NODE_ENV !== 'test' && !healthMonitorInterval) {
    healthMonitorInterval = setInterval(() => {
      monitorDeviceHealth(ioInstance, 60000); // 60 second stale threshold
    }, 30000); // Check every 30 seconds
  }
}

function stopHealthMonitoring() {
  if (healthMonitorInterval) {
    clearInterval(healthMonitorInterval);
    healthMonitorInterval = null;
  }
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
    
    // Save final state
    const session = sessionService.getCurrentSession();
    if (session) {
      await sessionService.endSession();
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
    server = http.createServer(app);
  }

  if (!io) {
    io = createSocketServer(server);
    // Make io globally accessible for admin routes
    // (In production, use dependency injection instead)
    global.io = io;

    // Setup WebSocket handlers
    setupWebSocketHandlers(io);
  }

  if (!discoveryService && process.env.NODE_ENV !== 'test') {
    discoveryService = new DiscoveryService();
  }

  return { server, io, discoveryService };
}

// Start server
async function startServer() {
  try {
    // Create server instances
    const instances = createServer();

    // Initialize all services
    if (!isInitialized) {
      await initializeServices();
      isInitialized = true;
    }

    // Setup service listeners
    setupServiceListeners(instances.io);

    // Start health monitoring
    startHealthMonitoring(instances.io);
    
    // Start listening
    const port = config.server.port;
    const host = config.server.host;
    
    instances.server.listen(port, host, async () => {
      logger.info(`ALN Orchestrator server running at http://${host}:${port}`);
      logger.info('WebSocket server ready for connections');
      logger.info('Environment:', {
        env: config.server.env,
        maxPlayers: config.session.maxPlayers,
        maxGmStations: config.session.maxGmStations,
      });

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
  stopHealthMonitoring();

  if (discoveryService) {
    discoveryService.stop();
    discoveryService = null;
  }

  if (io) {
    await new Promise((resolve) => {
      io.close(() => resolve());
    });
    io = null;
    global.io = null;
  }

  if (server) {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
    server = null;
  }

  isInitialized = false;
}

// Export for testing
module.exports = {
  createServer,
  startServer,
  cleanup,
  app,
  initializeServices,
  get server() { return server; },
  get io() { return io; }
};

// Only start server if run directly (not imported)
if (require.main === module) {
  registerShutdownHandlers();
  startServer();
}