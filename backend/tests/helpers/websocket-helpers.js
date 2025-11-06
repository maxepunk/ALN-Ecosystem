/**
 * Integration Test Helpers
 * Provides utilities for safer async testing patterns
 */

const io = require('socket.io-client');
const { generateAdminToken } = require('../../src/middleware/auth');

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

  // CRITICAL FIX: Check if this is a sync:full request and we have cached data
  // (from connectAndIdentify for GM devices)
  if (events.includes('sync:full') && socket.lastSyncFull) {
    // Return cached data immediately
    return Promise.resolve(socket.lastSyncFull);
  }

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

  // PHASE 2.1 (P1.3): Generate valid JWT token for GM stations
  // Middleware now validates tokens, so tests need real tokens
  const token = deviceType === 'gm' ? generateAdminToken('test-admin') : undefined;

  const socket = typeof socketOrUrl === 'string'
    ? createTrackedSocket(socketOrUrl, {
        auth: {
          token,
          deviceId: deviceId,
          deviceType: deviceType,
          version: '1.0.0'
        }
      })
    : socketOrUrl;

  try {
    // CRITICAL FIX: For GM devices, register sync:full listener BEFORE connecting
    // The server emits sync:full immediately after connection (same millisecond),
    // so we must register the listener before the connection completes to avoid race condition
    //
    // We also store the sync:full data on the socket for tests that need it later,
    // and set up a persistent listener to capture future sync:full events
    if (deviceType === 'gm') {
      // Store initial sync:full data on socket (for immediate access)
      socket.lastSyncFull = null;

      // Persistent listener to always capture sync:full events
      socket.on('sync:full', (data) => {
        socket.lastSyncFull = data;
      });

      // Wait for first sync:full (emitted during connection)
      await Promise.race([
        waitForEvent(socket, 'connect', timeout),
        new Promise(resolve => setTimeout(resolve, timeout + 1000))
      ]);

      // Give sync:full a moment to arrive after connect
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!socket.lastSyncFull) {
        throw new Error('Failed to receive sync:full event after GM connection');
      }
    } else {
      // Wait for connection (handshake auth + device registration happens automatically)
      if (!socket.connected) {
        await waitForEvent(socket, 'connect', timeout);
      }
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
 * Supports both count-based and predicate-based waiting
 * @param {Socket} socket - Socket instance
 * @param {string} event - Event name
 * @param {number|Function} countOrPredicate - Number of events to wait for, or predicate function
 * @param {number} timeout - Timeout in ms (default 5000)
 * @returns {Promise<Array>} Array of received events
 */
function waitForMultipleEvents(socket, event, countOrPredicate, timeout = 5000) {
  const events = [];
  let handler;

  // Convert count to predicate function for uniform handling
  const predicate = typeof countOrPredicate === 'number'
    ? (events) => events.length >= countOrPredicate
    : countOrPredicate;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);  // FIX: Always cleanup listener on timeout
      reject(new Error(`Timeout waiting for ${event} events (received ${events.length})`));
    }, timeout);

    handler = (data) => {
      events.push(data);
      if (predicate(events)) {
        clearTimeout(timer);
        socket.off(event, handler);  // Cleanup on success
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
 * Disconnect socket and wait for disconnection to complete
 * Uses condition-based waiting instead of guessing at timing
 *
 * @param {Socket} socket - Socket to disconnect
 * @param {number} timeout - Timeout in ms (default 2000)
 * @returns {Promise<void>}
 */
async function disconnectAndWait(socket, timeout = 2000) {
  if (!socket) return;

  // Already disconnected - nothing to do
  if (!socket.connected) return;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for socket disconnection'));
    }, timeout);

    // Wait for disconnect event
    socket.once('disconnect', () => {
      clearTimeout(timer);
      resolve();
    });

    // Initiate disconnect
    socket.disconnect();
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
 * - Settings (deviceId, mode)
 * - All global window objects scanner expects
 *
 * @param {string} url - Server URL
 * @param {string} deviceId - Scanner device ID
 * @param {string} mode - Station mode ('detective' | 'blackmarket')
 * @param {string} password - Admin password
 * @returns {Promise<Object>} Fully initialized scanner with App API exposed
 */
async function createAuthenticatedScanner(url, deviceId, mode = 'blackmarket', password = process.env.ADMIN_PASSWORD || 'admin') {
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
  Settings.mode = mode;

  // Make Settings globally available (App module expects it)
  global.Settings = Settings;

  // 8. Create NetworkedQueueManager (CRITICAL - recordTransaction calls this)
  global.window.queueManager = new NetworkedQueueManager(client);

  // 9. Set ConnectionManager reference (scanner checks this at line 503)
  global.window.connectionManager = {
    client: client,
    isConnected: true,
    deviceId: deviceId,
    mode: mode
  };

  // 10. Return fully wired scanner with App API exposed + cleanup
  return {
    client,                       // OrchestratorClient instance
    socket: client.socket,        // Direct socket access (for event listeners)
    App,                          // REAL scanner App module (call App.recordTransaction)
    Settings,                     // Settings reference (for assertions)
    sessionModeManager: global.window.sessionModeManager,
    queueManager: global.window.queueManager,
    DataManager: global.DataManager,  // For test spies (App.recordTransaction uses DataManager)

    // CRITICAL: Provide cleanup for resources we created
    // Following first principles: creator provides lifecycle management
    cleanup: async () => {
      // Disconnect client (calls socket.disconnect() + clears timers + clears token)
      if (client) {
        client.disconnect();
      }

      // Clean up global state we modified
      if (global.window.queueManager) {
        global.window.queueManager = null;
      }
      if (global.window.sessionModeManager) {
        global.window.sessionModeManager = null;
      }
      if (global.window.connectionManager) {
        global.window.connectionManager = null;
      }
    }
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
  // Configure for NETWORKED mode (enables connection monitoring + offline queue)
  // Per Bug #6 fix: Player Scanner detects mode via window.location.pathname
  global.window.location.pathname = '/player-scanner/';
  global.window.location.origin = url;

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
  disconnectAndWait,
  testDelay,
  createAuthenticatedScanner, // GM Scanner - uses real scanner code
  createPlayerScanner,        // Player Scanner - uses real scanner code
};