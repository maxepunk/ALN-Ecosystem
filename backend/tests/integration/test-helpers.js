/**
 * Integration Test Helpers
 * Provides utilities for safer async testing patterns
 */

const io = require('socket.io-client');

/**
 * Create a socket with automatic cleanup tracking
 * @param {string} url - Socket URL
 * @param {Object} options - Socket options
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
 * @param {string} event - Event name
 * @param {number} timeout - Timeout in ms
 * @returns {Promise} Resolves with event data or rejects on timeout
 */
function waitForEvent(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Connect and identify a socket with timeout
 * @param {string} url - Socket URL
 * @param {string} stationId - Station ID
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Socket>} Connected and identified socket
 */
async function connectAndIdentify(url, stationId, timeout = 5000) {
  const socket = createTrackedSocket(url);

  try {
    // Wait for connection
    await waitForEvent(socket, 'connect', timeout);

    // Send identification
    socket.emit('gm:identify', {
      stationId,
      version: '1.0.0',
    });

    // Wait for identification confirmation
    await waitForEvent(socket, 'gm:identified', timeout);

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

module.exports = {
  createTrackedSocket,
  waitForEvent,
  connectAndIdentify,
  waitForMultipleEvents,
  cleanupSockets,
  testDelay,
};