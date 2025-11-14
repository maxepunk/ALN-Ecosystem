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

  // Step 3: Setup event caching (BEFORE connection completes)
  setupEventCaching(socket);

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
        socket.lastSyncFull = syncData;  // Integration naming (both for compatibility)
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
 * Setup event caching for all broadcast events
 * Prevents race conditions by capturing events before tests register listeners
 *
 * @param {Socket} socket - Socket.io client
 */
function setupEventCaching(socket) {
  // Initialize cache properties
  socket.lastScoreUpdate = null;
  socket.lastTransactionNew = null;
  socket.lastGroupCompletion = null;
  socket.lastSessionUpdate = null;
  socket.lastVideoStatus = null;

  // Persistent listeners
  socket.on('score:updated', (data) => { socket.lastScoreUpdate = data; });
  socket.on('transaction:new', (data) => { socket.lastTransactionNew = data; });
  socket.on('group:completed', (data) => { socket.lastGroupCompletion = data; });
  socket.on('session:update', (data) => { socket.lastSessionUpdate = data; });
  socket.on('video:status', (data) => { socket.lastVideoStatus = data; });
}

/**
 * Wait for socket event with timeout
 * Checks cache first (event may have already fired)
 *
 * @param {Socket} socket - Socket.io client
 * @param {string|Array<string>} eventOrEvents - Event name or array of event names
 * @param {Function} [predicate=null] - Optional filter: (data) => boolean
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Event data
 */
async function waitForEvent(socket, eventOrEvents, predicate = null, timeout = 5000) {
  const events = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];

  // Check cache for already-fired events
  for (const event of events) {
    const cached = getCachedEvent(socket, event);
    if (cached && (!predicate || predicate(cached))) {
      return cached;
    }
  }

  // Not in cache, wait for next event
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${events.join(' or ')}`));
    }, timeout);

    const handlers = [];

    events.forEach(event => {
      const handler = (data) => {
        if (predicate && !predicate(data)) return;

        clearTimeout(timer);
        handlers.forEach(({ event: e, handler: h }) => socket.off(e, h));
        resolve(data);
      };
      socket.once(event, handler);
      handlers.push({ event, handler });
    });
  });
}

/**
 * Get cached event data by event name
 * @param {Socket} socket - Socket.io client
 * @param {string} eventName - Event name
 * @returns {Object|null} Cached event data or null
 */
function getCachedEvent(socket, eventName) {
  const cacheMap = {
    'sync:full': socket.lastSyncFull,
    'score:updated': socket.lastScoreUpdate,
    'transaction:new': socket.lastTransactionNew,
    'group:completed': socket.lastGroupCompletion,
    'session:update': socket.lastSessionUpdate,
    'video:status': socket.lastVideoStatus
  };
  return cacheMap[eventName] || null;
}

/**
 * Clear all cached events on socket
 * @param {Socket} socket - Socket.io client
 */
function clearEventCache(socket) {
  socket.lastSyncFull = null;
  socket.lastScoreUpdate = null;
  socket.lastTransactionNew = null;
  socket.lastGroupCompletion = null;
  socket.lastSessionUpdate = null;
  socket.lastVideoStatus = null;
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
 *
 * CRITICAL: Clears event cache before disconnecting to prevent test pollution.
 * Event cache IS socket state - cleanup must clean ALL state.
 */
function cleanupAllSockets() {
  activeSockets.forEach(socket => {
    // Clear cache first (prevents test pollution)
    clearEventCache(socket);

    // Then disconnect
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
  setupEventCaching,
  waitForEvent,
  clearEventCache,
  disconnectSocket,
  cleanupAllSockets,
  getAllActiveSockets,
  getActiveSocketCount
};
