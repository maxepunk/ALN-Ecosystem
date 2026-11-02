/**
 * Session Management Helpers for E2E Tests
 *
 * Provides reusable session creation utilities for tests that need
 * active sessions but don't have WebSocket connections (e.g., Player Scanner HTTP tests).
 *
 * @file backend/tests/e2e/setup/session-helpers.js
 */

const { connectWithAuth } = require('./websocket-client');
const { ADMIN_PASSWORD } = require('../helpers/test-config');

/**
 * Send `session:start` on an already-authenticated admin socket and return the ack.
 *
 * Block 2 T1a D12 (ruling R15): the require leg. Both session-creation helpers
 * below start the game, and so does `GMScannerPage.startGame()` — three seams,
 * one rule. On the `toy-heist-require` pack the preflight legitimately REFUSES
 * the start (the pack marks `lighting.instruments` `onAbsent: require` and the
 * pinned profile does not install it), so on that leg — and only there — this
 * helper types a reason and starts anyway, exactly as a GM would. ANYWHERE
 * ELSE a NO-GO is a real failure and must fail the test: a helper that
 * silently overrode every gate would make the gate untestable.
 *
 * @param {Object} adminSocket - Connected, authenticated admin socket
 * @param {number} timeout - Per-attempt ack timeout in ms
 * @returns {Promise<Object>} The final `gm:command:ack` envelope
 */
async function startGameOnSocket(adminSocket, timeout) {
  const sendStart = (payload) => new Promise((resolve, reject) => {
    const ackHandler = (ack) => {
      if (ack.data?.action === 'session:start') {
        clearTimeout(timeoutId);
        adminSocket.off('gm:command:ack', ackHandler);

        if (ack.data?.error) {
          reject(new Error(`Session start failed: ${ack.data.error}`));
        } else {
          resolve(ack);
        }
      }
    };
    const timeoutId = setTimeout(() => {
      adminSocket.off('gm:command:ack', ackHandler);
      reject(new Error(`Session start timeout after ${timeout}ms`));
    }, timeout);

    adminSocket.on('gm:command:ack', ackHandler);

    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:start',
        payload
      },
      timestamp: new Date().toISOString()
    });
  });

  let startAck = await sendStart({});

  if (!startAck.data?.success
      && typeof startAck.data?.message === 'string'
      && startAck.data.message.startsWith('NO-GO: ')
      && (process.env.E2E_PACK_PATH || '').endsWith('toy-heist-require')) {
    startAck = await sendStart({ startAnyway: true, reason: 'e2e: require leg' });
  }

  if (!startAck.data?.success) {
    throw new Error(`Session start failed: ${startAck.data?.message || 'Unknown error'}`);
  }

  return startAck;
}

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
    password = ADMIN_PASSWORD,  // Use centralized config (supports .env override)
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

    // Start the game (transition session from setup to active); R15 override lives in the helper
    await startGameOnSocket(adminSocket, timeout);

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

    // Start the game (transition session from setup to active); R15 override lives in the helper
    await startGameOnSocket(adminSocket, timeout);

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
  createSessionWithSocket,
  startGameOnSocket
};
