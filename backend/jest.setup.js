const fs = require('fs').promises;
const path = require('path');

// Track active resources for cleanup
const activeServers = new Set();
const activeSockets = new Set();

// Enhanced beforeEach: Clear data, reset globals
global.beforeEach(async () => {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.rm(dataDir, { recursive: true, force: true });
  } catch (e) {
    // Directory might not exist
  }
  await fs.mkdir(dataDir, { recursive: true });

  // Reset global variables
  global.offlineMode = false;
  global.io = null;

  // Clear module cache for ALL application code (not node_modules)
  // This ensures fresh modules for each test file
  Object.keys(require.cache).forEach(key => {
    // Clear all /src/ modules except node_modules
    if (key.includes('/src/') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
    // Also clear the backend root modules (app.js, server.js, etc)
    if (key.includes('/backend/') && !key.includes('/backend/node_modules') && !key.includes('/backend/tests')) {
      const relativePath = key.substring(key.indexOf('/backend/') + 9);
      // Only clear root level js files and src directory
      if (relativePath.match(/^[^/]+\.js$/) || relativePath.startsWith('src/')) {
        delete require.cache[key];
      }
    }
  });
});

// Critical afterEach: Clean listeners, reset services, close servers
global.afterEach(async () => {
  try {
    // Clean up broadcast listeners FIRST to prevent accumulation
    try {
      const { cleanupBroadcastListeners } = require('./src/websocket/broadcasts');
      cleanupBroadcastListeners();
    } catch (e) {
      // Module might not be loaded yet
    }

    // Reset all services if they exist
    try {
      const sessionService = require('./src/services/sessionService');
      const stateService = require('./src/services/stateService');
      const transactionService = require('./src/services/transactionService');
      const videoQueueService = require('./src/services/videoQueueService');
      const offlineQueueService = require('./src/services/offlineQueueService');
      const vlcService = require('./src/services/vlcService');
      const { stopTokenCleanup } = require('./src/middleware/auth');

      // Stop module-level intervals
      stopTokenCleanup();

      // Reset all services
      if (sessionService && sessionService.reset) {
        await sessionService.reset();
      }
      if (stateService && stateService.reset) {
        await stateService.reset();
      }
      if (transactionService && transactionService.reset) {
        transactionService.reset();
      }
      if (videoQueueService && videoQueueService.reset) {
        videoQueueService.reset();
      }
      if (offlineQueueService && offlineQueueService.reset) {
        await offlineQueueService.reset();
      }
      if (vlcService && vlcService.reset) {
        vlcService.reset();
      }
    } catch (e) {
      // Services might not be loaded
    }

    // Clean up server module if loaded
    try {
      const serverModule = require('./src/server');
      if (serverModule.cleanup) {
        await serverModule.cleanup();
      }
    } catch (e) {
      // Server module might not be loaded
    }

    // Close all tracked servers
    for (const server of activeServers) {
      try {
        if (server && server.close) {
          await new Promise((resolve) => {
            server.close(() => resolve());
          });
        }
      } catch (e) {
        // Server already closed
      }
    }
    activeServers.clear();

    // Disconnect all tracked sockets
    for (const socket of activeSockets) {
      try {
        if (socket && socket.disconnect) {
          socket.disconnect();
        }
      } catch (e) {
        // Socket already disconnected
      }
    }
    activeSockets.clear();

    // Clear timers
    jest.clearAllTimers();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    console.warn('Error in afterEach cleanup:', error.message);
  }
});

// Ensure cleanup after all tests
global.afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Export resource tracking for test utilities
global.trackServer = (server) => activeServers.add(server);
global.trackSocket = (socket) => activeSockets.add(socket);