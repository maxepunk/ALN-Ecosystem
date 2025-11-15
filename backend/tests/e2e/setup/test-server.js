/**
 * E2E Test Server Setup - Orchestrator Lifecycle Management
 *
 * Manages backend orchestrator startup/shutdown for end-to-end tests.
 *
 * CRITICAL DIFFERENCES from integration-test-server.js:
 * 1. Uses child_process.spawn to run real orchestrator server
 * 2. Tests actual HTTP/HTTPS and WebSocket endpoints
 * 3. No mocking - tests complete system integration
 * 4. Handles HTTPS self-signed certificates
 * 5. Manages persistent session data between tests
 *
 * USAGE EXAMPLE:
 * ```javascript
 * const { startOrchestrator, stopOrchestrator } = require('./setup/test-server');
 *
 * beforeAll(async () => {
 *   await startOrchestrator({ https: true });
 * });
 *
 * afterAll(async () => {
 *   await stopOrchestrator();
 * });
 * ```
 *
 * @module tests/e2e/setup/test-server
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const https = require('https');
const logger = require('../../../src/utils/logger');

// Server process reference
let orchestratorProcess = null;
let serverPort = null;
let serverProtocol = 'http';
let cleanupRegistered = false;

// Test environment configuration
const TEST_ENV = {
  NODE_ENV: 'test',
  PORT: process.env.TEST_PORT || '3000',
  HOST: '0.0.0.0',
  VLC_PASSWORD: 'vlc',
  FEATURE_VIDEO_PLAYBACK: 'true',
  ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD || '@LN-c0nn3ct',
  LOG_LEVEL: 'warn', // Reduce noise in test output
  ENABLE_HTTPS: process.env.TEST_HTTPS || 'false',
  SSL_KEY_PATH: './ssl/key.pem',
  SSL_CERT_PATH: './ssl/cert.pem',
  // Disable discovery service in tests (UDP broadcast conflicts)
  DISCOVERY_ENABLED: 'false',
  // Disable idle loop for faster tests
  FEATURE_IDLE_LOOP: 'false',
  // E2E tests default to memory storage for speed and isolation
  // Tests can opt-in to file storage via startOrchestrator({ storageType: 'file' })
  STORAGE_TYPE: process.env.TEST_STORAGE_TYPE || 'memory'
};

/**
 * Start orchestrator server for E2E tests
 *
 * @param {Object} options - Configuration options
 * @param {boolean} [options.https=false] - Enable HTTPS server
 * @param {number} [options.port] - Custom port (default: 3000)
 * @param {number} [options.timeout=30000] - Startup timeout in ms
 * @param {boolean} [options.preserveSession=false] - Keep session data from previous run
 * @param {string} [options.storageType='memory'] - Storage backend ('memory' or 'file')
 * @returns {Promise<Object>} Server info { url, port, protocol, process }
 *
 * @example
 * const server = await startOrchestrator({ https: true, port: 3001 });
 * console.log(`Server running at ${server.url}`);
 */
async function startOrchestrator(options = {}) {
  // Extract options FIRST to validate against running instance
  const {
    https: enableHttps = false,
    port = TEST_ENV.PORT,
    timeout = 30000,
    preserveSession = false,
    storageType = 'memory'
  } = options;

  // Prevent multiple server instances - but verify options match
  if (orchestratorProcess) {
    const requestedProtocol = enableHttps ? 'https' : 'http';
    const optionsMismatch =
      (requestedProtocol !== serverProtocol) ||
      (port !== serverPort);

    if (optionsMismatch) {
      logger.warn('Orchestrator already running with different options - stopping and restarting', {
        current: { protocol: serverProtocol, port: serverPort },
        requested: { protocol: requestedProtocol, port }
      });
      await stopOrchestrator();
      // Continue to start new instance below
    } else if (!preserveSession) {
      // CRITICAL FIX: Force restart to clear in-memory state
      // Even though options match, we need fresh orchestrator to clear MemoryStorage
      // Without this, MemoryStorage.data Map persists session state between tests
      logger.debug('Orchestrator running but preserveSession=false - forcing restart to clear memory state');
      await stopOrchestrator();
      // Continue to start new instance below
    } else {
      logger.debug('Orchestrator already running with matching options - reusing', {
        protocol: serverProtocol,
        port: serverPort,
        preserveSession
      });
      return {
        url: getOrchestratorUrl(),
        port: serverPort,
        protocol: serverProtocol,
        process: orchestratorProcess
      };
    }
  }

  // Clear session data unless preserveSession is true
  if (!preserveSession) {
    await clearSessionData();
  }

  // Update test environment
  const env = {
    ...process.env,
    ...TEST_ENV,
    PORT: String(port),
    ENABLE_HTTPS: String(enableHttps),
    STORAGE_TYPE: storageType,  // Use parameter instead of TEST_ENV default
    ADMIN_PASSWORD: TEST_ENV.ADMIN_PASSWORD  // Explicitly override to prevent .env contamination
  };

  // Path to server entry point
  const serverPath = path.join(__dirname, '../../../src/server.js');

  // Set protocol BEFORE logging
  serverPort = port;
  serverProtocol = enableHttps ? 'https' : 'http';

  logger.info('Starting orchestrator for E2E tests', {
    protocol: serverProtocol,
    port: serverPort,
    preserveSession,
    enableHttps  // Debug: Show what was requested
  });

  // Spawn orchestrator process
  orchestratorProcess = spawn('node', [serverPath], {
    env,
    cwd: path.join(__dirname, '../../../'),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Collect output for debugging
  const outputBuffer = [];
  const errorBuffer = [];

  orchestratorProcess.stdout.on('data', (data) => {
    const output = data.toString();
    outputBuffer.push(output);
    if (process.env.TEST_DEBUG === 'true') {
      process.stdout.write(`[orchestrator] ${output}`);
    }
  });

  orchestratorProcess.stderr.on('data', (data) => {
    const output = data.toString();
    errorBuffer.push(output);
    if (process.env.TEST_DEBUG === 'true') {
      process.stderr.write(`[orchestrator:err] ${output}`);
    }
  });

  // Handle process exit
  orchestratorProcess.on('exit', (code, signal) => {
    logger.debug('Orchestrator process exited', { code, signal });
    orchestratorProcess = null;
  });

  // Handle process errors
  orchestratorProcess.on('error', (error) => {
    logger.error('Orchestrator process error', { error: error.message });
    throw new Error(`Failed to start orchestrator: ${error.message}`);
  });

  // Wait for server to be ready
  try {
    await waitForHealthy(timeout);

    logger.info('Orchestrator started successfully', {
      url: getOrchestratorUrl(),
      pid: orchestratorProcess.pid
    });

    // Register cleanup handler on first startup
    if (!cleanupRegistered) {
      registerCleanupHandler();
      cleanupRegistered = true;
    }

    return {
      url: getOrchestratorUrl(),
      port: serverPort,
      protocol: serverProtocol,
      process: orchestratorProcess
    };
  } catch (error) {
    // Include output in error for debugging
    const combinedOutput = [
      '=== STDOUT ===',
      ...outputBuffer,
      '=== STDERR ===',
      ...errorBuffer
    ].join('\n');

    // Kill process on startup failure
    if (orchestratorProcess) {
      orchestratorProcess.kill('SIGTERM');
      orchestratorProcess = null;
    }

    throw new Error(`Orchestrator startup failed: ${error.message}\n\nServer output:\n${combinedOutput}`);
  }
}

/**
 * Stop orchestrator server gracefully
 *
 * Sends SIGTERM for graceful shutdown, waits up to 5s, then forces SIGKILL
 *
 * @param {Object} options - Stop options
 * @param {number} [options.timeout=5000] - Shutdown timeout before SIGKILL
 * @returns {Promise<void>}
 *
 * @example
 * await stopOrchestrator({ timeout: 10000 });
 */
async function stopOrchestrator(options = {}) {
  if (!orchestratorProcess) {
    logger.debug('No orchestrator process to stop');
    return;
  }

  const { timeout = 5000 } = options;

  logger.info('Stopping orchestrator', { pid: orchestratorProcess.pid });

  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      logger.warn('Orchestrator did not stop gracefully, forcing SIGKILL');
      orchestratorProcess.kill('SIGKILL');
    }, timeout);

    orchestratorProcess.on('exit', (code, signal) => {
      clearTimeout(timeoutHandle);
      logger.debug('Orchestrator stopped', { code, signal });
      orchestratorProcess = null;
      serverPort = null;
      resolve();
    });

    // Send graceful shutdown signal
    orchestratorProcess.kill('SIGTERM');
  });
}

/**
 * Restart orchestrator server
 *
 * Used to test persistence and recovery scenarios
 *
 * @param {Object} options - Restart options
 * @param {boolean} [options.preserveSession=true] - Keep session data across restart
 * @param {number} [options.timeout=30000] - Startup timeout
 * @param {string} [options.storageType='file'] - Storage backend (defaults to 'file' for restart tests)
 * @returns {Promise<Object>} New server info
 *
 * @example
 * // Test session recovery after crash
 * await restartOrchestrator({ preserveSession: true });
 */
async function restartOrchestrator(options = {}) {
  const {
    preserveSession = true,
    timeout = 30000,
    storageType = 'file'  // Default to file for restart tests
  } = options;

  logger.info('Restarting orchestrator', { preserveSession });

  // Capture current config
  const currentProtocol = serverProtocol;
  const currentPort = serverPort;

  // Stop current instance
  await stopOrchestrator();

  // Wait a moment for port to be released
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Start new instance
  return await startOrchestrator({
    https: currentProtocol === 'https',
    port: currentPort,
    timeout,
    preserveSession,
    storageType  // Pass through storage type
  });
}

/**
 * Get orchestrator base URL
 *
 * @returns {string} Base URL (e.g., "https://localhost:3000")
 *
 * @example
 * const url = getOrchestratorUrl();
 * const response = await fetch(`${url}/health`);
 */
function getOrchestratorUrl() {
  if (!serverPort) {
    throw new Error('Orchestrator not started');
  }
  return `${serverProtocol}://localhost:${serverPort}`;
}

/**
 * Clear session data between tests
 *
 * Removes persisted session files to ensure clean test state
 * Uses node-persist API to properly clear storage (handles MD5 hashing)
 *
 * @returns {Promise<void>}
 *
 * @example
 * beforeEach(async () => {
 *   await clearSessionData();
 * });
 */
async function clearSessionData() {
  // CRITICAL: Handle both file storage AND memory storage
  // Tests use STORAGE_TYPE=memory, but this function only clears files
  // Result: In-memory state (teamScores Map, etc) persists across tests

  if (process.env.STORAGE_TYPE === 'memory') {
    // Clear in-memory storage via persistenceService
    try {
      const persistenceService = require('../../../src/services/persistenceService');
      await persistenceService.resetMemoryStorage();
      logger.debug('Memory storage cleared for testing');
    } catch (error) {
      logger.warn('Failed to clear memory storage', { error: error.message });
    }
  } else {
    // Clear file storage (original logic)
    const dataDir = path.join(__dirname, '../../../data');

    try {
      await fs.access(dataDir);

      // Direct file deletion to avoid race conditions with parallel workers
      // When workers run in parallel, node-persist's async API can conflict:
      // - Worker 1 stops orchestrator → writes session asynchronously
      // - Worker 2 clears data → may run before Worker 1's write completes
      // - Result: Worker 2 restores stale session from Worker 1
      //
      // Direct file deletion eliminates the async timing dependency
      const files = await fs.readdir(dataDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(dataDir, file)).catch(err => {
          // Ignore file not found (may have been deleted by another worker)
          if (err.code !== 'ENOENT') throw err;
        }))
      );

      logger.debug('Session data cleared via direct file deletion');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to clear session data', { error: error.message });
      }
      // Directory doesn't exist - nothing to clear
    }
  }
}

/**
 * Wait for orchestrator to be healthy and ready
 *
 * Polls /health endpoint until successful response or timeout
 *
 * @param {number} [timeout=30000] - Maximum wait time in ms
 * @returns {Promise<void>}
 * @throws {Error} If server doesn't become healthy within timeout
 *
 * @example
 * await waitForHealthy(10000); // Wait up to 10 seconds
 */
async function waitForHealthy(timeout = 30000) {
  const url = getOrchestratorUrl();
  const healthUrl = `${url}/health`;
  const startTime = Date.now();
  const pollInterval = 500; // Check every 500ms

  logger.debug('Waiting for orchestrator health check', { url: healthUrl, timeout });

  // Create axios instance that accepts self-signed certs
  const axiosInstance = axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false // Accept self-signed certificates
    }),
    timeout: 2000 // 2s timeout per request
  });

  while (Date.now() - startTime < timeout) {
    try {
      const response = await axiosInstance.get(healthUrl);

      if (response.status === 200 && response.data.status === 'online') {
        logger.debug('Orchestrator health check passed', {
          uptime: response.data.uptime,
          version: response.data.version
        });
        return;
      }
    } catch (error) {
      // Expected during startup - server not ready yet
      logger.debug('Health check failed, retrying...', {
        error: error.message,
        elapsed: Date.now() - startTime
      });
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Orchestrator did not become healthy within ${timeout}ms`);
}

/**
 * Register process cleanup handler
 *
 * Ensures orchestrator is stopped when test process exits
 *
 * @private
 */
function registerCleanupHandler() {
  const cleanup = async () => {
    if (orchestratorProcess) {
      logger.info('Cleaning up orchestrator on process exit');
      await stopOrchestrator({ timeout: 2000 });
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception', { error: error.message });
    await cleanup();
    process.exit(1);
  });
}

/**
 * Get current server status
 *
 * @returns {Object|null} Status object or null if not running
 *
 * @example
 * const status = getServerStatus();
 * if (status) {
 *   console.log(`Server running on port ${status.port}`);
 * }
 */
function getServerStatus() {
  if (!orchestratorProcess) {
    return null;
  }

  return {
    running: true,
    pid: orchestratorProcess.pid,
    port: serverPort,
    protocol: serverProtocol,
    url: getOrchestratorUrl()
  };
}

module.exports = {
  startOrchestrator,
  stopOrchestrator,
  restartOrchestrator,
  getOrchestratorUrl,
  clearSessionData,
  waitForHealthy,
  getServerStatus
};
