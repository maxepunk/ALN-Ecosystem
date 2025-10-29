/**
 * E2E Test Wait Conditions
 *
 * Event-driven wait conditions for E2E tests.
 * Follows testing-anti-patterns skill: NO arbitrary timeouts, use actual state changes.
 */

/**
 * Wait for WebSocket event
 * @param {Socket} socket - Socket.io client
 * @param {string} eventName - Event to wait for
 * @param {Function} [predicate] - Optional filter function (data) => boolean
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Event data
 */
async function waitForEvent(socket, eventName, predicate = null, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    const handler = (data) => {
      // If predicate provided, check if it matches
      if (predicate && !predicate(data)) {
        return; // Keep waiting
      }

      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(data);
    };

    socket.on(eventName, handler);
  });
}

/**
 * Wait for element to appear
 * @param {Page} page - Playwright page
 * @param {string} selector - CSS selector
 * @param {number} [timeout=10000] - Timeout in ms
 * @returns {Promise<ElementHandle>} Element handle
 */
async function waitForElement(page, selector, timeout = 10000) {
  return await page.waitForSelector(selector, {
    state: 'visible',
    timeout
  });
}

/**
 * Wait for connection status to change
 * @param {Page} page - Playwright page
 * @param {string} status - 'connected' | 'disconnected'
 * @param {number} [timeout=10000] - Timeout in ms
 * @returns {Promise<void>}
 */
async function waitForConnectionStatus(page, status, timeout = 10000) {
  const selector = status === 'connected'
    ? '#connectionStatus.connected'
    : '#connectionStatus:not(.connected)';

  await page.waitForSelector(selector, {
    state: 'visible',
    timeout
  });
}

/**
 * Wait for score update for specific team
 * @param {Socket} socket - Socket.io client
 * @param {string} teamId - Team to watch
 * @param {number} [timeout=10000] - Timeout in ms
 * @returns {Promise<Object>} Score update data
 */
async function waitForScoreUpdate(socket, teamId, timeout = 10000) {
  return await waitForEvent(
    socket,
    'score:updated',
    (data) => data.teamId === teamId,
    timeout
  );
}

/**
 * Wait for video state change
 * @param {Socket} socket - Socket.io client
 * @param {string} expectedState - 'playing' | 'paused' | 'stopped' | 'idle' | 'loading' | 'completed' | 'error'
 * @param {number} [timeout=30000] - Timeout in ms (longer for video operations)
 * @returns {Promise<Object>} Video status data
 */
async function waitForVideoState(socket, expectedState, timeout = 30000) {
  return await waitForEvent(
    socket,
    'video:status',
    (data) => data.status === expectedState,
    timeout
  );
}

/**
 * Wait for transaction broadcast
 * @param {Socket} socket - Socket.io client
 * @param {string} tokenId - Token ID to match
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Transaction data
 */
async function waitForTransactionBroadcast(socket, tokenId, timeout = 5000) {
  return await waitForEvent(
    socket,
    'transaction:new',
    (data) => data.transaction && data.transaction.tokenId === tokenId,
    timeout
  );
}

/**
 * Wait for session update event
 * @param {Socket} socket - Socket.io client
 * @param {string} [expectedStatus] - Optional status to wait for ('active' | 'paused' | 'ended')
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Session data
 */
async function waitForSessionUpdate(socket, expectedStatus = null, timeout = 5000) {
  return await waitForEvent(
    socket,
    'session:update',
    expectedStatus ? (data) => data.status === expectedStatus : null,
    timeout
  );
}

/**
 * Wait for sync:full event (initial state synchronization)
 * @param {Socket} socket - Socket.io client
 * @param {number} [timeout=10000] - Timeout in ms
 * @returns {Promise<Object>} Full state data
 */
async function waitForSyncFull(socket, timeout = 10000) {
  return await waitForEvent(socket, 'sync:full', null, timeout);
}

/**
 * Wait for device connection broadcast
 * @param {Socket} socket - Socket.io client
 * @param {string} deviceId - Device ID to wait for
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Device connection data
 */
async function waitForDeviceConnected(socket, deviceId, timeout = 5000) {
  return await waitForEvent(
    socket,
    'device:connected',
    (data) => data.deviceId === deviceId,
    timeout
  );
}

/**
 * Wait for device disconnection broadcast
 * @param {Socket} socket - Socket.io client
 * @param {string} deviceId - Device ID to wait for
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Device disconnection data
 */
async function waitForDeviceDisconnected(socket, deviceId, timeout = 5000) {
  return await waitForEvent(
    socket,
    'device:disconnected',
    (data) => data.deviceId === deviceId,
    timeout
  );
}

/**
 * Wait for group completion event
 * @param {Socket} socket - Socket.io client
 * @param {string} teamId - Team ID
 * @param {string} groupName - Group name to wait for
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Group completion data
 */
async function waitForGroupCompletion(socket, teamId, groupName, timeout = 5000) {
  return await waitForEvent(
    socket,
    'group:completed',
    (data) => data.teamId === teamId && data.group === groupName,
    timeout
  );
}

/**
 * Wait for transaction result (sent to submitter only)
 * @param {Socket} socket - Socket.io client
 * @param {string} tokenId - Token ID
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Transaction result data
 */
async function waitForTransactionResult(socket, tokenId, timeout = 5000) {
  return await waitForEvent(
    socket,
    'transaction:result',
    (data) => data.tokenId === tokenId,
    timeout
  );
}

/**
 * Wait for admin command acknowledgment
 * @param {Socket} socket - Socket.io client
 * @param {string} action - Command action to wait for
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Command ack data
 */
async function waitForCommandAck(socket, action, timeout = 5000) {
  return await waitForEvent(
    socket,
    'gm:command:ack',
    (data) => data.action === action,
    timeout
  );
}

/**
 * Wait for offline queue processed event
 * @param {Socket} socket - Socket.io client
 * @param {number} [timeout=10000] - Timeout in ms
 * @returns {Promise<Object>} Queue processing results
 */
async function waitForOfflineQueueProcessed(socket, timeout = 10000) {
  return await waitForEvent(socket, 'offline:queue:processed', null, timeout);
}

/**
 * Wait for error event
 * @param {Socket} socket - Socket.io client
 * @param {string} [expectedCode] - Optional error code to wait for
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<Object>} Error data
 */
async function waitForError(socket, expectedCode = null, timeout = 5000) {
  return await waitForEvent(
    socket,
    'error',
    expectedCode ? (data) => data.code === expectedCode : null,
    timeout
  );
}

/**
 * Wait for text content to appear in element
 * @param {Page} page - Playwright page
 * @param {string} selector - CSS selector
 * @param {string} text - Text to wait for
 * @param {number} [timeout=10000] - Timeout in ms
 * @returns {Promise<void>}
 */
async function waitForText(page, selector, text, timeout = 10000) {
  await page.waitForFunction(
    ({ selector, text }) => {
      const element = document.querySelector(selector);
      return element && element.textContent.includes(text);
    },
    { selector, text },
    { timeout }
  );
}

/**
 * Wait for element attribute value
 * @param {Page} page - Playwright page
 * @param {string} selector - CSS selector
 * @param {string} attribute - Attribute name
 * @param {string} value - Expected value
 * @param {number} [timeout=10000] - Timeout in ms
 * @returns {Promise<void>}
 */
async function waitForAttribute(page, selector, attribute, value, timeout = 10000) {
  await page.waitForFunction(
    ({ selector, attribute, value }) => {
      const element = document.querySelector(selector);
      return element && element.getAttribute(attribute) === value;
    },
    { selector, attribute, value },
    { timeout }
  );
}

module.exports = {
  // Core wait functions
  waitForEvent,
  waitForElement,
  waitForText,
  waitForAttribute,

  // Connection
  waitForConnectionStatus,
  waitForDeviceConnected,
  waitForDeviceDisconnected,

  // State sync
  waitForSyncFull,
  waitForSessionUpdate,

  // Transactions & Scoring
  waitForTransactionBroadcast,
  waitForTransactionResult,
  waitForScoreUpdate,
  waitForGroupCompletion,

  // Video
  waitForVideoState,

  // Admin
  waitForCommandAck,

  // Offline queue
  waitForOfflineQueueProcessed,

  // Errors
  waitForError,
};
