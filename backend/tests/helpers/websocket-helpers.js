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
  const socket = typeof socketOrUrl === 'string'
    ? createTrackedSocket(socketOrUrl)
    : socketOrUrl;

  try {
    // Wait for connection if not already connected
    if (!socket.connected) {
      await waitForEvent(socket, 'connect', timeout);
    }

    // Send identification based on device type
    if (deviceType === 'gm') {
      socket.emit('gm:identify', {
        deviceId: deviceId,
        version: '1.0.0',
      });
      await waitForEvent(socket, 'gm:identified', timeout);
    } else if (deviceType === 'scanner') {
      socket.emit('scanner:identify', {
        deviceId: deviceId,
        version: '1.0.0',
      });
      await waitForEvent(socket, 'scanner:identified', timeout);
    } else {
      throw new Error(`Unknown device type: ${deviceType}`);
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

module.exports = {
  createTrackedSocket,
  waitForEvent,
  connectAndIdentify,
  waitForMultipleEvents,
  cleanupSockets,
  testDelay,
};