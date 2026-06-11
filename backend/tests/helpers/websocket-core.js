/**
 * Shared WebSocket Core Utilities
 * Used by both Integration and E2E tests
 *
 * ARCHITECTURE:
 * - Event caching to prevent race conditions
 * - Promise-based event waiting with timeout
 * - Socket lifecycle management
 */

const io = require('socket.io-client');
const axios = require('axios');
const https = require('https');

// Track all sockets for cleanup
const activeSockets = new Set();

/**
 * Create Socket.io client with JWT authentication
 *
 * @param {string} baseUrl - Server base URL (e.g., 'https://localhost:3000')
 * @param {string} password - Admin password for authentication
 * @param {string} deviceId - Unique device identifier
 * @param {string} deviceType - Device type: 'gm' or 'player' or 'admin'
 * @param {Object} [options] - Additional options
 * @param {number} [options.timeout=10000] - Connection timeout in ms
 * @param {string} [options.version='1.0.0'] - Client version string
 * @returns {Promise<Socket>} Connected and authenticated Socket.io client
 */
async function connectWithAuth(baseUrl, password, deviceId, deviceType, options = {}) {
  const { timeout = 10000, version = '1.0.0' } = options;

  // Step 1: Get JWT token via HTTP
  const authUrl = `${baseUrl}/api/admin/auth`;
  const axiosInstance = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  let authResponse;
  try {
    authResponse = await axiosInstance.post(authUrl, { password });
  } catch (error) {
    throw new Error(`HTTP authentication failed: ${error.message}`);
  }

  const { token } = authResponse.data;
  if (!token) {
    throw new Error('No JWT token returned from authentication endpoint');
  }

  // Step 2: Create Socket.io client
  const socket = io(baseUrl, {
    transports: ['websocket'],
    reconnection: false,
    rejectUnauthorized: false,
    auth: { token, deviceId, deviceType, version }
  });

  // Track for cleanup
  activeSockets.add(socket);

  // Step 3: Setup state mirrors (BEFORE connection completes)
  setupStateMirrors(socket);

  // Step 4: Wait for connection
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.disconnect();
      activeSockets.delete(socket);
      reject(new Error(`WebSocket connection timeout after ${timeout}ms`));
    }, timeout);

    let syncData = null;
    let connectReceived = false;

    // Eagerly register sync:full listener
    socket.once('sync:full', (data) => {
      syncData = data;
      if (connectReceived) {
        clearTimeout(timer);
        socket.initialSync = syncData;  // E2E naming
        socket.lastSyncFull = syncData;  // alias of initialSync (connect-time handshake snapshot; never mutated after)
        resolve(socket);
      }
    });

    socket.once('connect', () => {
      connectReceived = true;
      socket.deviceId = deviceId;
      socket.deviceType = deviceType;
      socket.isAuthenticated = true;

      if (syncData) {
        clearTimeout(timer);
        socket.initialSync = syncData;
        socket.lastSyncFull = syncData;
        resolve(socket);
      }
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      socket.disconnect();
      activeSockets.delete(socket);
      reject(new Error(`WebSocket connection failed: ${error.message}`));
    });
  });
}

/**
 * Setup state mirrors (2.x.3 redesign).
 *
 * The old event CACHE (last ack, last transaction, ...) made waitForEvent
 * resolve from STALE occurrences and needed manual clearEventCache calls at
 * 35 sites — the false system-reset quarantine was its work. Occurrence
 * events are now wait-only: register BEFORE acting (waitForEvent registers
 * its listener synchronously, so `const p = waitForEvent(...); act(); await p`
 * is race-free).
 *
 * Exactly ONE mirror survives, because its semantics are genuinely
 * last-write-wins STATE, not occurrences: service:state carries full
 * domain snapshots (same contract the GM Scanner's StateStore holds).
 * The connect-time sync:full handshake result lives on socket.initialSync.
 *
 * @param {Socket} socket - Socket.io client
 */
function setupStateMirrors(socket) {
  socket.lastServiceState = {};  // domain → latest full snapshot (state, not events)
  socket.on('service:state', (data) => {
    const payload = data.data || data;
    if (payload.domain) socket.lastServiceState[payload.domain] = data;
  });
}

/**
 * Wait for the NEXT matching socket event (listener-from-now), with timeout
 *
 * @param {Socket} socket - Socket.io client
 * @param {string|Array<string>} eventOrEvents - Event name or array of event names
 * @param {Function} [predicate=null] - Optional filter: (data) => boolean
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Event data
 */
async function waitForEvent(socket, eventOrEvents, predicate = null, timeout = 5000) {
  const events = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];

  // Pure listener-from-now (2.x.3): NO cache consultation. The listener is
  // registered synchronously inside the Promise executor, so callers that
  // need to catch an event caused by their own action MUST create this
  // promise BEFORE acting:  const p = waitForEvent(...); act(); await p;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${events.join(' or ')}`));
    }, timeout);

    const handlers = [];

    events.forEach(event => {
      const handler = (data) => {
        if (predicate && !predicate(data)) return; // Keep listening if predicate fails

        clearTimeout(timer);
        handlers.forEach(({ event: e, handler: h }) => socket.off(e, h));
        resolve(data);
      };
      // CRITICAL FIX: Use .on() not .once() when predicate filter exists
      // .once() would consume listener on first event even if predicate fails
      // Cleanup at line 170 ensures listener removed after match
      socket.on(event, handler);
      handlers.push({ event, handler });
    });
  });
}

/**
 * Disconnect socket and remove from tracking
 * @param {Socket} socket - Socket.io client
 */
function disconnectSocket(socket) {
  if (!socket) return;
  if (socket.connected) socket.disconnect();
  activeSockets.delete(socket);
}

/**
 * Cleanup all tracked sockets
 */
function cleanupAllSockets() {
  activeSockets.forEach(socket => {
    if (socket && socket.connected) socket.disconnect();
  });
  activeSockets.clear();
}

/**
 * Get all active sockets (for cache clearing)
 * @returns {Array<Socket>} Array of active sockets
 */
function getAllActiveSockets() {
  return Array.from(activeSockets);
}

/**
 * Get count of active sockets
 * @returns {number} Number of active sockets
 */
function getActiveSocketCount() {
  return activeSockets.size;
}

module.exports = {
  connectWithAuth,
  setupStateMirrors,
  waitForEvent,
  disconnectSocket,
  cleanupAllSockets,
  getAllActiveSockets,
  getActiveSocketCount
};
