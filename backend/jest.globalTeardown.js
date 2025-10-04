/**
 * Jest Global Teardown
 * Runs ONCE after ALL test files complete (across all workers)
 * Safe for process-isolated cleanup like HTTP agents
 */

const http = require('http');
const https = require('https');

module.exports = async () => {
  // Destroy HTTP agents to close keep-alive connections
  // This is safe in global teardown because:
  // 1. All tests are finished (no more requests)
  // 2. Each worker has its own agent instance (process-isolated)
  // 3. Prevents force exit warnings from supertest keep-alive sockets
  http.globalAgent.destroy();
  https.globalAgent.destroy();

  console.log('Global teardown: HTTP agents destroyed');
};
