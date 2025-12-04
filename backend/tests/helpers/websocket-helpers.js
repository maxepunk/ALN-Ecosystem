/**
 * Integration Test Helpers
 * Provides utilities for safer async testing patterns
 */

const io = require('socket.io-client');
const { generateAdminToken } = require('../../src/middleware/auth');

// Import shared WebSocket core for event caching and auth
const {
  connectWithAuth: coreConnectWithAuth,
  setupEventCaching,
  waitForEvent: coreWaitForEvent,
  clearEventCache
} = require('./websocket-core');

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
 * Supports optional predicate for condition-based waiting (avoids testing anti-patterns)
 *
 * @param {Socket} socket - Socket instance
 * @param {string|Array<string>} eventOrEvents - Event name or array of event names
 * @param {Function|number} [predicateOrTimeout] - Optional predicate function OR timeout (backward compat)
 * @param {number} [timeout=5000] - Timeout in ms (only if 3rd arg is predicate)
 * @returns {Promise} Resolves with event data or rejects on timeout
 *
 * @example
 * // Simple wait (backward compatible)
 * await waitForEvent(socket, 'transaction:new');
 * await waitForEvent(socket, 'transaction:new', 3000);
 *
 * // Condition-based wait (avoids cache returning stale data)
 * const isTeam002 = (data) => data?.data?.transaction?.teamId === '002';
 * await waitForEvent(socket, 'transaction:new', isTeam002);
 * await waitForEvent(socket, 'transaction:new', isTeam002, 5000);
 */
function waitForEvent(socket, eventOrEvents, predicateOrTimeout, timeout = 5000) {
  // Detect if 3rd arg is predicate (function) or timeout (number) for backward compatibility
  let predicate = null;
  let actualTimeout = timeout;

  if (typeof predicateOrTimeout === 'function') {
    predicate = predicateOrTimeout;
    // timeout uses 4th arg or default
  } else if (typeof predicateOrTimeout === 'number') {
    actualTimeout = predicateOrTimeout;
    // predicate stays null (backward compat: 3rd arg was timeout)
  }
  // else: predicateOrTimeout is undefined, use defaults

  // Delegate to shared core implementation (checks cache first, respects predicate)
  return coreWaitForEvent(socket, eventOrEvents, predicate, actualTimeout);
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

  // Generate valid JWT token for GM stations (middleware validates tokens)
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
    // Setup event caching using shared core (prevents race conditions)
    setupEventCaching(socket);

    // For GM devices, use condition-based waiting for BOTH connect AND sync:full
    // This mirrors the reliable pattern from connectWithAuth() in websocket-core.js
    if (deviceType === 'gm') {
      // Create promise that resolves when BOTH connect and sync:full received
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Timeout waiting for sync:full event after GM connection'));
        }, timeout);

        let syncData = null;
        let connectReceived = socket.connected;

        const checkComplete = () => {
          if (connectReceived && syncData) {
            clearTimeout(timer);
            socket.lastSyncFull = syncData;
            resolve();
          }
        };

        // Register sync:full listener BEFORE connection completes
        socket.once('sync:full', (data) => {
          syncData = data;
          checkComplete();
        });

        if (!socket.connected) {
          socket.once('connect', () => {
            connectReceived = true;
            checkComplete();
          });
        } else {
          // Already connected, check if sync:full already cached
          if (socket.lastSyncFull) {
            clearTimeout(timer);
            resolve();
          }
        }

        socket.once('connect_error', (error) => {
          clearTimeout(timer);
          reject(new Error(`Connection failed: ${error.message}`));
        });
      });
    } else {
      // Non-GM devices: just wait for connection
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
// Track how many scanners have been created (for debugging multi-scanner tests)
let scannerCreationCount = 0;

async function createAuthenticatedScanner(url, deviceId, mode = 'blackmarket', password = process.env.ADMIN_PASSWORD || 'admin') {
  scannerCreationCount++;
  console.log(`\n========== CREATING SCANNER #${scannerCreationCount}: ${deviceId} ==========`);

  // 1. Import ALL required scanner modules
  const { OrchestratorClient } = require('../../../ALNScanner/src/network/orchestratorClient');
  const { NetworkedQueueManager } = require('../../../ALNScanner/src/network/networkedQueueManager');
  const { SessionModeManager } = require('../../../ALNScanner/src/app/sessionModeManager');
  const Settings = require('../../../ALNScanner/src/ui/settings').default;

  // CRITICAL: Import App CLASS (not default singleton) to inject dependencies
  // This allows us to inject our mock DataManager without module mocking hacks
  const { App: AppClass } = require('../../../ALNScanner/src/app/app');

  // 2. Initialize browser mocks (if not already done)
  // (No explicit browser mock initialization code here, assuming it's done elsewhere or not needed for this specific change)

  // 3. Create App instance with INJECTED dependencies
  // We inject the global.DataManager mock which has the required test methods
  const App = new AppClass({
    dataManager: global.DataManager,
    // Inject other globals to ensure consistency
    settings: Settings,
    uiManager: global.UIManager,
    // CRITICAL: Inject StandaloneDataManager (App.init expects it to exist)
    standaloneDataManager: new global.StandaloneDataManager(),
    // CRITICAL: Inject TokenManager (we populated global.TokenManager.database)
    tokenManager: global.TokenManager,
    // CRITICAL: Inject showConnectionWizard (App expects it for fallback)
    showConnectionWizard: global.showConnectionWizard || (() => console.log('Mock Wizard Shown')),
    // CRITICAL: Inject InitializationSteps to use mock (Phase 4.1)
    // This allows validateAndDetermineInitialScreen to skip HTTP validation in tests
    initializationSteps: global.InitializationSteps
  });

  // 4. Authenticate via HTTP FIRST (to get valid token for App auto-connect)
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

  // Spy on console.error to catch swallowed errors
  const originalConsoleError = console.error;
  console.error = (...args) => {
    process.stdout.write(`[CONSOLE ERROR] ${args.join(' ')}\n`);
    originalConsoleError(...args);
  };

  // Set token in localStorage so App finds it
  global.localStorage.setItem('aln_auth_token', token);
  // ... (remove throw)

  // 5. Initialize Settings
  // CRITICAL: Set deviceId in localStorage BEFORE Settings.load()
  // Settings.load() reads from localStorage.getItem('deviceId') and App.init()
  // calls loadSettings() which calls Settings.load() again.
  // If we only set Settings.deviceId after load(), App.init() will overwrite it.
  global.localStorage.setItem('deviceId', deviceId);
  global.localStorage.setItem('mode', mode);

  Settings.load();  // Now reads our unique deviceId from localStorage

  console.log(`DEBUG: Settings after load - deviceId: ${Settings.deviceId}, mode: ${Settings.mode}`);

  // CRITICAL: Set session mode to 'networked' so App auto-connects
  // This aligns with SessionModeManager.restoreMode() logic
  global.localStorage.setItem('gameSessionMode', 'networked');

  // CRITICAL: Set orchestrator URL for Phase 4.1 state validation
  // validateAndDetermineInitialScreen() uses this to validate connectivity
  global.localStorage.setItem('aln_orchestrator_url', url);

  // 6. Load RAW tokens directly from ALN-TokenData (same as production scanner does)
  // CRITICAL: Must be loaded BEFORE App.init() because App.init() calls loadTokenDatabase
  // Scanner expects raw format (SF_Group, SF_MemoryType, SF_ValueRating)
  const fs = require('fs');
  const path = require('path');
  const rawTokensPath = path.join(__dirname, '../../../ALN-TokenData/tokens.json');
  const rawTokens = JSON.parse(fs.readFileSync(rawTokensPath, 'utf8'));

  global.TokenManager.database = rawTokens;  // Raw format, matches production

  // Build group inventory for bonus calculations (scanner does this on load)
  global.TokenManager.groupInventory = global.TokenManager.buildGroupInventory();

  // CRITICAL: Mock loadDatabase to prevent overwriting our pre-loaded data
  // The real loadDatabase tries to fetch() which fails in Node environment
  // We already loaded the data above, so we just return true
  global.TokenManager.loadDatabase = async () => {
    console.log('DEBUG: Mock loadDatabase called - returning true (data pre-loaded)');
    return true;
  };

  // 7. Initialize App (CRITICAL: Creates SessionModeManager and verifies TokenManager)
  // App.init() calls loadTokenDatabase, which will now use our mock
  // App.init() -> initializationSteps -> applyInitialScreenDecision -> _initializeNetworkedMode
  // This sequence creates App.networkedSession and connects the socket
  console.log('DEBUG: About to call App.init()');
  console.log('DEBUG: App.initializationSteps is:', App.initializationSteps === global.InitializationSteps ? 'MOCK' : 'REAL');
  console.log('DEBUG: localStorage gameSessionMode:', global.localStorage.getItem('gameSessionMode'));
  console.log('DEBUG: localStorage aln_orchestrator_url:', global.localStorage.getItem('aln_orchestrator_url'));
  console.log('DEBUG: localStorage aln_auth_token:', global.localStorage.getItem('aln_auth_token') ? 'SET' : 'NOT SET');
  await App.init();
  console.log('DEBUG: After App.init(), networkedSession:', App.networkedSession ? 'CREATED' : 'NULL');

  // 8. Extract Client from App
  if (!App.networkedSession) {
    // If App didn't connect, maybe verify why.
    // For now, assume it worked or throw.
    throw new Error('App.networkedSession not initialized. Auto-connect failed?');
  }

  const client = App.networkedSession.getService('client');

  // Wait for client to be connected (App.init awaits _initializeNetworkedMode which awaits connection)
  if (!client.socket || !client.socket.connected) {
    // It might be connecting. Wait for it?
    // _initializeNetworkedMode awaits networkedSession.initialize() which awaits connectionManager.connect()
    // So it should be connected.
  }

  // 10. Make Settings globally available (App module expects it)
  // Note: Settings.deviceId and Settings.mode are now set before App.init()
  global.Settings = Settings;

  // 11. Get connectionManager for tests to access token
  const connectionManager = App.networkedSession.getService('connectionManager');

  // 12. Return fully wired scanner with App API exposed + cleanup
  return {
    client,                       // REAL OrchestratorClient used by App
    connectionManager,            // ConnectionManager (has token property)
    socket: client.socket,        // REAL socket used by App
    App,                          // REAL scanner App module
    Settings,                     // Settings reference
    sessionModeManager: App.sessionModeManager, // Get from App
    queueManager: App.networkedSession.getService('queueManager'), // Get from Session
    DataManager: global.DataManager,

    cleanup: async () => {
      // Destroy App session (cleans up services, disconnects socket)
      if (App.networkedSession) {
        await App.networkedSession.destroy();
      }
      // Clean up globals
      if (global.window.queueManager) global.window.queueManager = null; // Just in case
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

/**
 * Send a gm:command event using wrapped envelope pattern (AsyncAPI Decision #2)
 * @param {Socket} socket - Socket instance
 * @param {string} action - Command action (e.g., 'display:idle-loop', 'session:create')
 * @param {Object} payload - Command payload
 */
function sendGmCommand(socket, action, payload = {}) {
  socket.emit('gm:command', {
    event: 'gm:command',
    data: {
      action,
      payload
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  createTrackedSocket,
  waitForEvent,
  connectAndIdentify,
  waitForMultipleEvents,
  cleanupSockets,
  disconnectAndWait,
  testDelay,
  sendGmCommand,              // Send gm:command with wrapped envelope
  createAuthenticatedScanner, // GM Scanner - uses real scanner code
  createPlayerScanner,        // Player Scanner - uses real scanner code
};