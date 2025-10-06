/**
 * Integration Test Helpers
 * Provides utilities for safer async testing patterns
 */

const io = require('socket.io-client');

/**
 * Create a socket with automatic cleanup tracking
 * @param {string} url - Socket URL
 * @param {Object} options - Socket options (can include auth for handshake)
 * @returns {Socket} Socket instance
 */
function createTrackedSocket(url, options = {}) {
  const socket = io(url, {
    transports: ['websocket'],
    reconnection: false,
    ...options,
  });

  // Track for cleanup
  if (global.trackSocket) {
    global.trackSocket(socket);
  }

  return socket;
}

/**
 * Wait for a socket event with timeout
 * @param {Socket} socket - Socket instance
 * @param {string|Array<string>} eventOrEvents - Event name or array of event names
 * @param {number} timeout - Timeout in ms
 * @returns {Promise} Resolves with event data or rejects on timeout
 */
function waitForEvent(socket, eventOrEvents, timeout = 5000) {
  const events = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${events.join(' or ')}`));
    }, timeout);

    const handlers = [];

    // Register handler for each event
    events.forEach(event => {
      const handler = (data) => {
        clearTimeout(timer);
        // Clean up all handlers
        handlers.forEach(({ event: e, handler: h }) => {
          socket.off(e, h);
        });
        // Resolve with the data and which event triggered
        resolve(data);
      };
      socket.once(event, handler);
      handlers.push({ event, handler });
    });
  });
}

/**
 * Connect and identify a socket with timeout
 * @param {Socket|string} socketOrUrl - Socket instance or URL
 * @param {string} deviceType - Device type ('gm' or 'scanner')
 * @param {string} deviceId - Device ID
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Socket>} Connected and identified socket
 */
async function connectAndIdentify(socketOrUrl, deviceType, deviceId, timeout = 5000) {
  // If URL provided, create socket with handshake auth (production flow)
  // Per AsyncAPI contract: handshake.auth uses deviceId, not stationId
  const socket = typeof socketOrUrl === 'string'
    ? createTrackedSocket(socketOrUrl, {
        auth: {
          token: 'test-jwt-token',
          deviceId: deviceId,
          deviceType: deviceType,
          version: '1.0.0'
        }
      })
    : socketOrUrl;

  try {
    // Wait for connection (handshake auth + device registration happens automatically)
    if (!socket.connected) {
      await waitForEvent(socket, 'connect', timeout);
    }

    // Store device info for debugging
    socket.deviceType = deviceType;
    socket.deviceId = deviceId;

    return socket;
  } catch (error) {
    socket.disconnect();
    throw error;
  }
}

/**
 * Wait for multiple events with timeout
 * @param {Socket} socket - Socket instance
 * @param {string} event - Event name
 * @param {Function} predicate - Function to check if all events received
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Array>} Array of received events
 */
function waitForMultipleEvents(socket, event, predicate, timeout = 5000) {
  const events = [];

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      // Resolve with what we got even if not all
      resolve(events);
    }, timeout);

    const handler = (data) => {
      events.push(data);
      if (predicate(events)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(events);
      }
    };

    socket.on(event, handler);
  });
}

/**
 * Cleanup multiple sockets safely
 * @param {Array<Socket>} sockets - Array of sockets
 */
function cleanupSockets(sockets) {
  if (!Array.isArray(sockets)) {
    sockets = [sockets];
  }

  sockets.forEach(socket => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
  });
}

/**
 * Wait with shorter delay for tests
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise}
 */
function testDelay(ms) {
  // Reduce delays in test environment
  const reducedMs = process.env.NODE_ENV === 'test' ? Math.min(ms, 200) : ms;
  return new Promise(resolve => setTimeout(resolve, reducedMs));
}

/**
 * Create authenticated GM Scanner using REAL scanner code with FULL initialization
 * NOTE: Requires browser-mocks.js to be loaded first
 *
 * Initializes ALL required components:
 * - OrchestratorClient (WebSocket connection)
 * - SessionModeManager (networked mode coordination)
 * - NetworkedQueueManager (transaction queueing)
 * - Settings (deviceId, stationMode)
 * - All global window objects scanner expects
 *
 * @param {string} url - Server URL
 * @param {string} deviceId - Scanner device ID
 * @param {string} mode - Station mode ('detective' | 'blackmarket')
 * @param {string} password - Admin password
 * @returns {Promise<Object>} Fully initialized scanner with App API exposed
 */
async function createAuthenticatedScanner(url, deviceId, mode = 'blackmarket', password = 'test-admin-password') {
  // 1. Import ALL required scanner modules
  const OrchestratorClient = require('../../../ALNScanner/js/network/orchestratorClient');
  const NetworkedQueueManager = require('../../../ALNScanner/js/network/networkedQueueManager');
  const SessionModeManager = require('../../../ALNScanner/js/app/sessionModeManager');
  const Settings = require('../../../ALNScanner/js/ui/settings');
  const App = require('../../../ALNScanner/js/app/app');

  // 2. Authenticate via HTTP
  const fetch = require('node-fetch');
  const authResponse = await fetch(`${url}/api/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });

  if (!authResponse.ok) {
    throw new Error(`Auth failed: ${authResponse.status}`);
  }

  const { token } = await authResponse.json();

  // 3. Create and configure OrchestratorClient
  const client = new OrchestratorClient({
    url,
    deviceId,
    version: '1.0.0'
  });
  client.token = token;

  // 4. Connect WebSocket and wait for connection
  client.connect();

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    client.socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });

    client.socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket connection failed: ${error.message}`));
    });
  });

  // 5. Load RAW tokens directly from ALN-TokenData (same as production scanner does)
  // Scanner expects raw format (SF_Group, SF_MemoryType, SF_ValueRating)
  // Server uses transformed format (group, memoryType, valueRating)
  // Production: Scanner fetches raw tokens.json, Server transforms separately
  const fs = require('fs');
  const path = require('path');
  const rawTokensPath = path.join(__dirname, '../../../ALN-TokenData/tokens.json');
  const rawTokens = JSON.parse(fs.readFileSync(rawTokensPath, 'utf8'));

  global.TokenManager.database = rawTokens;  // Raw format, matches production

  // Build group inventory for bonus calculations (scanner does this on load)
  global.TokenManager.groupInventory = global.TokenManager.buildGroupInventory();

  // 6. Initialize SessionModeManager (CRITICAL - scanner checks this)
  global.window.sessionModeManager = new SessionModeManager();
  global.window.sessionModeManager.mode = 'networked';
  global.window.sessionModeManager.locked = true;

  // 7. Configure Settings (CRITICAL - used in recordTransaction)
  Settings.deviceId = deviceId;
  Settings.stationMode = mode;

  // Make Settings globally available (App module expects it)
  global.Settings = Settings;

  // 8. Create NetworkedQueueManager (CRITICAL - recordTransaction calls this)
  global.window.queueManager = new NetworkedQueueManager(client);

  // 9. Set ConnectionManager reference (scanner checks this at line 503)
  global.window.connectionManager = {
    client: client,
    isConnected: true,
    deviceId: deviceId,
    stationMode: mode
  };

  // 10. Return fully wired scanner with App API exposed
  return {
    client,                       // OrchestratorClient instance
    socket: client.socket,        // Direct socket access (for event listeners)
    App,                          // REAL scanner App module (call App.recordTransaction)
    Settings,                     // Settings reference (for assertions)
    sessionModeManager: global.window.sessionModeManager,
    queueManager: global.window.queueManager
  };
}

/**
 * Create Player Scanner client using REAL player scanner code
 * NOTE: Requires browser-mocks.js to be loaded first
 * @param {string} url - Server URL
 * @param {string} deviceId - Scanner device ID (optional, auto-generated if not provided)
 * @returns {OrchestratorIntegration} Player Scanner instance
 */
function createPlayerScanner(url, deviceId) {
  // Import real Player Scanner module (requires browser mocks to be loaded first)
  const OrchestratorIntegration = require('../../../aln-memory-scanner/js/orchestratorIntegration');

  const client = new OrchestratorIntegration();
  client.baseUrl = url;

  if (deviceId) {
    client.deviceId = deviceId;
  }

  return client;
}

module.exports = {
  createTrackedSocket,
  waitForEvent,
  connectAndIdentify,
  waitForMultipleEvents,
  cleanupSockets,
  testDelay,
  createAuthenticatedScanner, // GM Scanner - uses real scanner code
  createPlayerScanner,        // Player Scanner - uses real scanner code
};