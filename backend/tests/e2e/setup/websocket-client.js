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

// Delegate to shared WebSocket core module
const {
  connectWithAuth: coreConnectWithAuth,
  waitForEvent: coreWaitForEvent,
  disconnectSocket: coreDisconnectSocket,
  cleanupAllSockets: coreCleanupAllSockets,
  getAllActiveSockets: coreGetAllActiveSockets,
  getActiveSocketCount: coreGetActiveSocketCount,
  clearEventCache
} = require('../../helpers/websocket-core');

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
  // Delegate to shared core implementation
  return await coreConnectWithAuth(baseUrl, password, deviceId, deviceType, options);
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
 *   (data) => data.teamId === 'Team Alpha',
 *   5000
 * );
 */
async function waitForEvent(socket, eventName, predicate = null, timeout = 5000) {
  // Delegate to shared core implementation (which checks cache first)
  return await coreWaitForEvent(socket, eventName, predicate, timeout);
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
  // Delegate to shared core implementation
  return coreDisconnectSocket(socket);
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
  // Delegate to core (handles cache clearing + disconnect + tracking)
  return coreCleanupAllSockets();
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
  // Delegate to shared core implementation
  return coreGetActiveSocketCount();
}

/**
 * Get all active sockets (for cache clearing)
 *
 * @returns {Array<Socket>} Array of active sockets
 *
 * @example
 * const sockets = getAllActiveSockets();
 * sockets.forEach(socket => clearEventCache(socket));
 */
function getAllActiveSockets() {
  // Delegate to shared core implementation
  return coreGetAllActiveSockets();
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
  getAllActiveSockets,
  getActiveSocketCount,

  // Event cache management
  clearEventCache
};
