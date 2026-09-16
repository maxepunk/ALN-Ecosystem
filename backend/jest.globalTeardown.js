/**
 * Jest Global Teardown
 * Runs ONCE after ALL test files complete (across all workers)
 * Safe for process-isolated cleanup like HTTP agents
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = async () => {
  // Remove the per-run ProcessMonitor PID-file directory allocated in
  // jest.config.base.js. Guarded to a temp-dir path with our own prefix so a
  // caller-supplied ALN_PIDFILE_DIR (or the /tmp default) is never deleted.
  const pidDir = process.env.ALN_PIDFILE_DIR;
  if (pidDir && path.dirname(pidDir) === os.tmpdir() && path.basename(pidDir).startsWith('aln-jest-')) {
    try {
      fs.rmSync(pidDir, { recursive: true, force: true });
    } catch {
      // Best effort — it is a temp dir either way.
    }
  }

  // Destroy HTTP agents to close keep-alive connections
  // This is safe in global teardown because:
  // 1. All tests are finished (no more requests)
  // 2. Each worker has its own agent instance (process-isolated)
  // 3. Prevents force exit warnings from supertest keep-alive sockets
  http.globalAgent.destroy();
  https.globalAgent.destroy();

  console.log('Global teardown: HTTP agents destroyed');
};
