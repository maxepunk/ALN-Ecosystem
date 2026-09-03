/**
 * Send one gm:command over a temporary authenticated WebSocket and
 * return its ack. Extracted from three verbatim flow-local copies
 * (07d-03, 07d-04, toy-pack-lighting-roles — slice 4 S5 review).
 */

'use strict';

const { connectWithAuth, waitForEvent, disconnectSocket } = require('../../helpers/websocket-core');
const { ADMIN_PASSWORD } = require('./test-config');

/**
 * @param {string} orchestratorUrl - Backend URL
 * @param {string} action - Command action (e.g., 'cue:fire')
 * @param {Object} [payload] - Action-specific payload
 * @returns {Promise<Object>} The gm:command:ack envelope
 */
async function sendGMCommand(orchestratorUrl, action, payload = {}) {
  const deviceId = `CMD_HELPER_${Date.now()}`;
  const socket = await connectWithAuth(orchestratorUrl, ADMIN_PASSWORD, deviceId, 'gm');
  try {
    const ackPromise = waitForEvent(socket, 'gm:command:ack',
      (ack) => ack?.data?.action === action, 10000);
    socket.emit('gm:command', {
      event: 'gm:command',
      data: { action, payload },
      timestamp: new Date().toISOString()
    });
    return await ackPromise;
  } finally {
    disconnectSocket(socket);
  }
}

module.exports = { sendGMCommand };
