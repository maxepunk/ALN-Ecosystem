/**
 * E2E WebSocket Client Helper
 *
 * Provides WebSocket client utilities for E2E testing with Socket.io and JWT authentication.
 *
 * CRITICAL PATTERNS:
 * 1. Authentication Flow: HTTP auth → JWT token → WebSocket handshake.auth
 * 2. Envelope Pattern: All events use { event, data, timestamp }
 * 3. HTTPS Support: Handle self-signed certificates with rejectUnauthorized: false
 * 4. Event Waiting: Promise-based event listeners with timeout
 * 5. Cleanup Tracking: Disconnect all sockets created during test run
 *
 * USAGE EXAMPLE:
 * ```javascript
 * const { connectWithAuth, waitForEvent, cleanupAllSockets } = require('./setup/websocket-client');
 *
 * // Connect with authentication
 * const socket = await connectWithAuth(
 *   'https://localhost:3000',
 *   'admin-password',
 *   'GM_Station_1',
 *   'gm'
 * );
 *
 * // Wait for event
 * const event = await waitForEvent(socket, 'sync:full', null, 5000);
 *
 * // Validate envelope
 * validateEventEnvelope(event, 'sync:full');
 *
 * // Cleanup
 * cleanupAllSockets();
 * ```
 *
 * @module tests/e2e/setup/websocket-client
 */

const io = require('socket.io-client');
const axios = require('axios');
const https = require('https');

// Track all sockets for cleanup
const activeSockets = new Set();

/**
 * Connect to WebSocket with JWT authentication
 *
 * Complete authentication flow:
 * 1. HTTP POST /api/admin/auth → Get JWT token
 * 2. Socket.io connect with token in handshake.auth
 * 3. Server validates JWT in middleware
 * 4. Server sends sync:full event on successful connection
 * 5. Promise resolves AFTER both 'connect' AND 'sync:full' received
 *
 * IMPORTANT: This function waits for the initial sync:full event before resolving.
 * The sync data is stored in socket.initialSync for immediate test access.
 * This prevents race conditions where tests try to wait for an already-fired event.
 *
 * @param {string} baseUrl - Server base URL (e.g., 'https://localhost:3000')
 * @param {string} password - Admin password for authentication
 * @param {string} deviceId - Unique device identifier
 * @param {string} deviceType - Device type: 'gm' or 'admin'
 * @param {Object} [options] - Additional options
 * @param {number} [options.timeout=10000] - Connection timeout in ms
 * @param {string} [options.version='1.0.0'] - Client version string
 * @returns {Promise<Socket>} Connected and authenticated Socket.io client with socket.initialSync property
 * @throws {Error} If authentication fails or connection times out
 *
 * @example
 * const socket = await connectWithAuth(
 *   'https://localhost:3000',
 *   'admin-password',
 *   'GM_Station_1',
 *   'gm'
 * );
 */
async function connectWithAuth(baseUrl, password, deviceId, deviceType, options = {}) {
  const {
    timeout = 10000,
    version = '1.0.0'
  } = options;

  // Step 1: Authenticate via HTTP and get JWT token
  const authUrl = `${baseUrl}/api/admin/auth`;

  // Create axios instance with HTTPS agent that accepts self-signed certs
  const axiosInstance = axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false // Allow self-signed certificates
    })
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

  // Step 2: Connect WebSocket with JWT token in handshake.auth
  // Per AsyncAPI contract (lines 22-45): handshake.auth requires token, deviceId, deviceType
  const socket = io(baseUrl, {
    transports: ['websocket'],
    reconnection: false, // Disable auto-reconnect for predictable test behavior
    rejectUnauthorized: false, // Accept self-signed certificates
    auth: {
      token: token,
      deviceId: deviceId,
      deviceType: deviceType,
      version: version
    }
  });

  // Track for cleanup
  activeSockets.add(socket);

  // Step 3: Wait for connection AND initial sync:full event
  // FIX: Eagerly register sync:full listener to avoid race condition
  // Server emits sync:full during connection handler, so we must listen BEFORE connect completes
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.disconnect();
      activeSockets.delete(socket);
      reject(new Error(`WebSocket connection timeout after ${timeout}ms`));
    }, timeout);

    let syncData = null;
    let connectReceived = false;

    // Eagerly register sync:full listener BEFORE connect event
    // Captures the sync data for test validation
    socket.once('sync:full', (data) => {
      syncData = data;
      // Resolve if both connect and sync:full received
      if (connectReceived) {
        clearTimeout(timer);
        // Return object with socket AND sync data for test validation
        socket.initialSync = syncData;
        resolve(socket);
      }
    });

    // Handle successful connection
    socket.once('connect', () => {
      connectReceived = true;

      // Store device info for debugging
      socket.deviceId = deviceId;
      socket.deviceType = deviceType;
      socket.isAuthenticated = true;

      // Resolve if both connect and sync:full received
      if (syncData) {
        clearTimeout(timer);
        // Return object with socket AND sync data for test validation
        socket.initialSync = syncData;
        resolve(socket);
      }
    });

    // Handle connection errors (authentication failures occur here)
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      socket.disconnect();
      activeSockets.delete(socket);
      reject(new Error(`WebSocket connection failed: ${error.message}`));
    });
  });
}

/**
 * Setup event listener on socket
 *
 * Simple wrapper around socket.on() for consistency with other helpers.
 * Use this for listeners that should persist for the test duration.
 *
 * @param {Socket} socket - Socket.io client
 * @param {string} eventName - Event name to listen for
 * @param {Function} handler - Event handler function (data) => void
 * @returns {void}
 *
 * @example
 * setupEventListener(socket, 'transaction:new', (event) => {
 *   console.log('Transaction:', event.data.transaction.tokenId);
 * });
 */
function setupEventListener(socket, eventName, handler) {
  socket.on(eventName, handler);
}

/**
 * Wait for specific WebSocket event with optional predicate
 *
 * Promise-based event waiting with timeout. Similar to integration test helper
 * but adapted for E2E testing with Playwright.
 *
 * @param {Socket} socket - Socket.io client
 * @param {string} eventName - Event name to wait for
 * @param {Function|null} [predicate=null] - Optional filter: (eventData) => boolean
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Event data (includes envelope: {event, data, timestamp})
 * @throws {Error} If timeout reached before matching event received
 *
 * @example
 * // Wait for any sync:full event
 * const event = await waitForEvent(socket, 'sync:full');
 *
 * // Wait for specific team score update
 * const scoreEvent = await waitForEvent(
 *   socket,
 *   'score:updated',
 *   (data) => data.teamId === '001',
 *   5000
 * );
 */
async function waitForEvent(socket, eventName, predicate = null, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    const handler = (data) => {
      // If predicate provided, check if event matches
      if (predicate && !predicate(data)) {
        return; // Keep waiting for matching event
      }

      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(data);
    };

    socket.on(eventName, handler);
  });
}

/**
 * Validate event follows envelope pattern per AsyncAPI contract
 *
 * Per contract: ALL events MUST have { event, data, timestamp } structure.
 * Timestamp MUST be ISO 8601 UTC format.
 *
 * @param {Object} event - Event object to validate
 * @param {string} expectedEventType - Expected value of event.event field
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails with details
 *
 * @example
 * const event = await waitForEvent(socket, 'transaction:result');
 * validateEventEnvelope(event, 'transaction:result');
 * // Throws if event doesn't match envelope pattern
 */
function validateEventEnvelope(event, expectedEventType) {
  // Check envelope structure
  if (!event || typeof event !== 'object') {
    throw new Error('Event is not an object');
  }

  if (!event.event) {
    throw new Error('Event missing "event" field in envelope');
  }

  if (!event.data) {
    throw new Error('Event missing "data" field in envelope');
  }

  if (!event.timestamp) {
    throw new Error('Event missing "timestamp" field in envelope');
  }

  // Validate event type matches expected
  if (event.event !== expectedEventType) {
    throw new Error(
      `Event type mismatch: expected "${expectedEventType}", got "${event.event}"`
    );
  }

  // Validate timestamp is ISO 8601 format
  const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  if (!timestampRegex.test(event.timestamp)) {
    throw new Error(
      `Invalid timestamp format: "${event.timestamp}" (expected ISO 8601 UTC)`
    );
  }

  return true;
}

/**
 * Disconnect socket gracefully
 *
 * Removes socket from active tracking and disconnects.
 * Idempotent - safe to call multiple times.
 *
 * @param {Socket} socket - Socket.io client to disconnect
 * @returns {void}
 *
 * @example
 * const socket = await connectWithAuth(...);
 * // ... use socket ...
 * disconnectSocket(socket);
 */
function disconnectSocket(socket) {
  if (!socket) {
    return;
  }

  if (socket.connected) {
    socket.disconnect();
  }

  activeSockets.delete(socket);
}

/**
 * Cleanup all tracked sockets
 *
 * Disconnects all sockets created during test run.
 * Call in afterAll() to ensure clean shutdown.
 *
 * @returns {void}
 *
 * @example
 * afterAll(() => {
 *   cleanupAllSockets();
 * });
 */
function cleanupAllSockets() {
  activeSockets.forEach(socket => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
  });
  activeSockets.clear();
}

/**
 * Get count of active sockets (for debugging)
 *
 * @returns {number} Number of active sockets
 *
 * @example
 * console.log(`Active sockets: ${getActiveSocketCount()}`);
 */
function getActiveSocketCount() {
  return activeSockets.size;
}

module.exports = {
  // Connection with authentication
  connectWithAuth,

  // Event listeners
  setupEventListener,
  waitForEvent,

  // Validation
  validateEventEnvelope,

  // Cleanup
  disconnectSocket,
  cleanupAllSockets,
  getActiveSocketCount
};
