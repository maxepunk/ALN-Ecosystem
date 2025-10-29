/**
 * Session Management Helpers for E2E Tests
 *
 * Provides reusable session creation utilities for tests that need
 * active sessions but don't have WebSocket connections (e.g., Player Scanner HTTP tests).
 *
 * @file backend/tests/e2e/setup/session-helpers.js
 */

const { connectWithAuth } = require('./websocket-client');

/**
 * Create a session via temporary WebSocket connection.
 * Useful for HTTP-only tests (like Player Scanner) that need active sessions.
 *
 * @param {string} orchestratorUrl - Orchestrator base URL (e.g., 'https://localhost:3000')
 * @param {Object} options - Session configuration
 * @param {string} options.sessionName - Session name (default: 'E2E Test Session')
 * @param {string} options.mode - Session mode (default: 'test')
 * @param {string} options.password - Admin password (default: 'test-admin-password')
 * @param {number} options.timeout - Timeout in ms (default: 5000)
 * @returns {Promise<Object>} Session data from backend
 * @throws {Error} If session creation fails or times out
 *
 * @example
 * // In test beforeAll()
 * const session = await createSessionViaWebSocket(orchestratorInfo.url);
 * console.log(`Session created: ${session.name}`);
 */
async function createSessionViaWebSocket(orchestratorUrl, options = {}) {
  const {
    sessionName = 'E2E Test Session',
    mode = 'test',
    password = process.env.ADMIN_PASSWORD || 'admin',  // Use env or fallback to default
    timeout = 5000
  } = options;

  let adminSocket = null;

  try {
    // Connect as admin via WebSocket
    adminSocket = await connectWithAuth(
      orchestratorUrl,
      password,
      `SESSION_HELPER_${Date.now()}`,
      'gm'
    );

    // Create session via WebSocket command (per AsyncAPI contract)
    const sessionAck = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Session creation timeout after ${timeout}ms`));
      }, timeout);

      // Listen for acknowledgment
      const ackHandler = (ack) => {
        if (ack.data?.action === 'session:create') {
          clearTimeout(timeoutId);
          adminSocket.off('gm:command:ack', ackHandler);

          if (ack.data?.error) {
            reject(new Error(`Session creation failed: ${ack.data.error}`));
          } else {
            resolve(ack);
          }
        }
      };
      adminSocket.on('gm:command:ack', ackHandler);

      // Send command per AsyncAPI contract format
      adminSocket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:create',
          payload: {
            name: sessionName,
            mode: mode
          }
        },
        timestamp: new Date().toISOString()
      });
    });

    // Verify session was created successfully
    if (!sessionAck.data?.success) {
      throw new Error(`Session creation failed: ${sessionAck.data?.message || 'Unknown error'}`);
    }

    // Session data is broadcast via session:update event, not in ack
    // For HTTP-only tests, we just need to know session exists (backend will accept scans)
    // Return a minimal session object with the name we used
    return {
      name: sessionName,
      mode: mode,
      created: true
    };

  } finally {
    // Always close the temporary admin socket
    if (adminSocket) {
      adminSocket.close();
    }
  }
}

/**
 * Create a session and return both session data and the admin socket.
 * Use when you need to keep the WebSocket connection open for further operations.
 *
 * @param {string} orchestratorUrl - Orchestrator base URL
 * @param {Object} options - Session configuration (same as createSessionViaWebSocket)
 * @returns {Promise<{session: Object, socket: Socket}>} Session data and admin socket
 *
 * @example
 * // Keep socket open for multiple operations
 * const { session, socket } = await createSessionWithSocket(orchestratorInfo.url);
 * // ... do other WebSocket operations ...
 * socket.close(); // Remember to close when done!
 */
async function createSessionWithSocket(orchestratorUrl, options = {}) {
  const {
    sessionName = 'E2E Test Session',
    mode = 'test',
    password = 'test-admin-password',
    timeout = 5000
  } = options;

  // Connect as admin via WebSocket
  const adminSocket = await connectWithAuth(
    orchestratorUrl,
    password,
    `SESSION_HELPER_${Date.now()}`,
    'gm'
  );

  try {
    // Create session via WebSocket command (per AsyncAPI contract)
    const sessionAck = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Session creation timeout after ${timeout}ms`));
      }, timeout);

      // Listen for acknowledgment
      const ackHandler = (ack) => {
        if (ack.data?.action === 'session:create') {
          clearTimeout(timeoutId);
          adminSocket.off('gm:command:ack', ackHandler);

          if (ack.data?.error) {
            reject(new Error(`Session creation failed: ${ack.data.error}`));
          } else {
            resolve(ack);
          }
        }
      };
      adminSocket.on('gm:command:ack', ackHandler);

      // Send command per AsyncAPI contract format
      adminSocket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:create',
          payload: {
            name: sessionName,
            mode: mode
          }
        },
        timestamp: new Date().toISOString()
      });
    });

    // Verify session was created successfully
    if (!sessionAck.data?.success) {
      throw new Error(`Session creation failed: ${sessionAck.data?.message || 'Unknown error'}`);
    }

    // Return minimal session object and keep socket open for caller
    return {
      session: {
        name: sessionName,
        mode: mode,
        created: true
      },
      socket: adminSocket
    };

  } catch (error) {
    // On error, close socket and rethrow
    adminSocket.close();
    throw error;
  }
}

module.exports = {
  createSessionViaWebSocket,
  createSessionWithSocket
};
