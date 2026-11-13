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
const net = require('net');
const axios = require('axios');
const https = require('https');
const logger = require('../../../src/utils/logger');

/**
 * Find an available port for the test server
 * Uses Node's net module to bind to port 0 (OS assigns free port)
 *
 * @param {number} [preferredPort] - Preferred port to try first
 * @returns {Promise<number>} Available port number
 */
async function findAvailablePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && preferredPort) {
        // Preferred port in use, find any available port
        logger.debug(`Port ${preferredPort} in use, finding alternative`);
        server.listen(0, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    server.listen(preferredPort || 0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => {
        logger.debug(`Found available port: ${port}`);
        resolve(port);
      });
    });
  });
}

/**
 * This worker's PRIVATE data and log directories (P21).
 *
 * Three Playwright workers used to share backend/data/, so one worker's clean
 * start deleted another worker's live session file (the red leg on CI run
 * 299). The slot is TEST_PARALLEL_INDEX — the same key the worker's private
 * session bus is named for (session-env.js) — so a restart inside one worker
 * always comes back to the same two directories. Read from the environment on
 * every call, never cached: the slot is fixed for a worker process, and the
 * unit test is the only caller that ever changes it.
 *
 * @returns {{dataDir: string, logsDir: string}} absolute paths
 */
function workerEnvDirs() {
  const slot = process.env.TEST_PARALLEL_INDEX || '0';
  const root = path.join('/tmp/aln-e2e-env', `w${slot}`);
  return {
    dataDir: path.join(root, 'data'),
    logsDir: path.join(root, 'logs'),
  };
}

// Server process reference
let orchestratorProcess = null;
let serverPort = null;
let serverProtocol = 'http';
let serverPackPath = null;
let serverProfilePath = null;
let cleanupRegistered = false;

// Test environment configuration
const TEST_ENV = {
  NODE_ENV: 'test',
  PORT: process.env.TEST_PORT || '3000',
  HOST: '0.0.0.0',
  ENABLE_VIDEO_PLAYBACK: 'true',
  // The HARNESS supervises VLC (vlc-service.js spawns it as the
  // dedicated non-root user — root orchestrators cannot host VLC).
  // Without this, every orchestrator's own VLC dies-and-respawns on a
  // 3s loop and each exit resets the engine's MPRIS state — wiping
  // "playing" while the harness's player is healthy (S5 §8.1).
  VLC_SELF_SPAWN: 'false',
  ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD || '@LN-c0nn3ct',
  LOG_LEVEL: 'warn', // Reduce noise in test output
  ENABLE_HTTPS: process.env.TEST_HTTPS || 'false',
  SSL_KEY_PATH: './ssl/key.pem',
  SSL_CERT_PATH: './ssl/cert.pem',
  // Discovery is disabled by hardcoded NODE_ENV !== 'test' check in server.js
  // Disable idle loop for faster tests
  FEATURE_IDLE_LOOP: 'false',
  // E2E tests default to memory storage for speed and isolation
  // Tests can opt-in to file storage via startOrchestrator({ storageType: 'file' })
  STORAGE_TYPE: process.env.TEST_STORAGE_TYPE || 'memory',
  // Use dynamic port for HTTP→HTTPS redirect to avoid conflicts with parallel workers
  // Without this, multiple orchestrators all try to bind to port 8000
  HTTP_REDIRECT_PORT: '0'
};

/**
 * Start orchestrator server for E2E tests
 *
 * @param {Object} options - Configuration options
 * @param {boolean} [options.https=false] - Enable HTTPS server
 * @param {number|string} [options.port=0] - Port number, 0 or 'auto' for dynamic assignment
 * @param {number} [options.timeout=30000] - Startup timeout in ms
 * @param {boolean} [options.preserveSession=false] - Keep session data from previous run
 * @param {string} [options.storageType='memory'] - Storage backend ('memory' or 'file')
 * @returns {Promise<Object>} Server info { url, port, protocol, process }
 *
 * @example
 * // Dynamic port (recommended for parallel tests)
 * const server = await startOrchestrator({ https: true });
 *
 * // Specific port (may conflict in parallel execution)
 * const server = await startOrchestrator({ https: true, port: 3001 });
 * @param {string} [options.packPath] - Fixture pack directory (PACK_PATH);
 *   defaults from E2E_PACK_PATH, explicit caller value WINS (dual-pack gate).
 * @param {string} [options.profilePath] - Installation profile file
 *   (PROFILE_PATH); defaults from E2E_PROFILE_PATH, caller wins — always
 *   pin per-call beside packPath (slice 4 S5, Rm7).
 */
async function startOrchestrator(options = {}) {
  // Extract options FIRST to validate against running instance
  const {
    https: enableHttps = false,
    port: requestedPort = 0,  // Default to dynamic port assignment
    timeout = 30000,
    preserveSession = false,
    storageType = 'memory',
    // Injection seam (2.x.4, generalized in Phase 3 A2): run the system on
    // a fixture PACK DIRECTORY instead of production ALN-TokenData (backend
    // + /api/tokens + /api/pack/* + the scanners' relative token paths all
    // see the same injected pack).
    //
    // Dual-pack Tier L gate (A3 slice 0): flows that don't pin a pack
    // inherit E2E_PACK_PATH, so one env var re-runs the whole suite
    // against another pack (npm run test:e2e:toy-pack). An explicit
    // caller packPath always WINS — a test that pins a fixture pack
    // (e.g. 07c's parity-pack) is testing THAT pack deliberately.
    packPath = process.env.E2E_PACK_PATH || null,
    // Slice 4 S5 (D-4.8): the INSTALLATION-PROFILE seam, the exact
    // analog of packPath — pinned per-call in the SAME startOrchestrator
    // call, never as an independent global (red-team Rm7: an unpinned
    // profile silently mixes with an injected pack).
    profilePath = process.env.E2E_PROFILE_PATH || null
  } = options;

  // Resolve dynamic port if requested (port=0 or port='auto')
  const useDynamicPort = requestedPort === 0 || requestedPort === 'auto';
  const port = useDynamicPort
    ? await findAvailablePort()  // Full dynamic assignment for parallel test execution
    : requestedPort;

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

  // The rung-1 environment (fix-vehicle S5 §8.1): ONE shared
  // provisioning module with the rig, gated by the run's PROFILE — a
  // run pinned to a real profile provisions nothing; an unpinned run
  // boots the generated per-pack SIMULATION profile and gets the full
  // stand-in stack (bus, display, pipewire, witness Home Assistant,
  // mocked Bluetooth), exported into process.env for the spawn below.
  // Each arm degrades to loud skips on hosts that cannot run it.
  const { provisionForRun } = require('./session-env');
  const prov = await provisionForRun({ packPath, profilePath });
  const ha = prov.ha;

  // This worker's private directories, created before the child needs them.
  const { dataDir, logsDir } = workerEnvDirs();
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });

  // Update test environment
  const env = {
    ...process.env,
    ...TEST_ENV,
    // One data/logs directory per worker (P21) — parallel workers must never
    // share backend/data/, where one worker's clearSessionData() deleted
    // another's live session file. The child's cwd stays backend/; only these
    // two seams (config/index.js) move.
    DATA_DIR: dataDir,
    LOGS_DIR: logsDir,
    PORT: String(port),
    ENABLE_HTTPS: String(enableHttps),
    STORAGE_TYPE: storageType,  // Use parameter instead of TEST_ENV default
    ADMIN_PASSWORD: TEST_ENV.ADMIN_PASSWORD,  // Explicitly override to prevent .env contamination
    ...(packPath ? { PACK_PATH: packPath } : {}),
    // The engine boots with the SAME profile the harness provisioned
    // against (an explicit caller pin passes through unchanged; an
    // unpinned run gets the simulation profile — never the full-kit
    // default, whose venue scene bindings the witness HA cannot serve).
    ...(prov.profilePath ? { PROFILE_PATH: prov.profilePath } : {}),
    ...(ha ? {
      HOME_ASSISTANT_URL: ha.url,
      HOME_ASSISTANT_TOKEN: ha.token,
      LIGHTING_ENABLED: 'true',
      // 25+ per-flow orchestrators share ONE machine-level HA container;
      // none of them may manage its docker lifecycle.
      HA_DOCKER_MANAGE: 'false',
    } : {})
  };

  // Path to server entry point
  const serverPath = path.join(__dirname, '../../../src/server.js');

  // Set protocol BEFORE logging
  serverPort = port;
  serverProtocol = enableHttps ? 'https' : 'http';
  // Captured for restartOrchestrator (train-review P9b-1): a restart
  // used to silently DROP an explicitly pinned packPath/profilePath,
  // so a restart-flow test that pinned a fixture pack came back up on
  // the default pack and asserted against the wrong rules.
  serverPackPath = packPath;
  // The RESOLVED profile (explicit pin passed through, or the generated
  // simulation profile) — so a restart re-pins exactly what this run
  // booted with, not the pre-resolution null.
  serverProfilePath = prov.profilePath;

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

    // CRITICAL: Set ORCHESTRATOR_URL so browser contexts use correct baseURL
    // This enables relative URLs like '/gm-scanner/' to work with dynamic ports
    process.env.ORCHESTRATOR_URL = getOrchestratorUrl();

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

  // Start new instance — carrying the pinned pack/profile through
  // (P9b-1: dropping them restarted onto the default pack)
  return await startOrchestrator({
    https: currentProtocol === 'https',
    port: currentPort,
    timeout,
    preserveSession,
    storageType,  // Pass through storage type
    ...(serverPackPath ? { packPath: serverPackPath } : {}),
    ...(serverProfilePath ? { profilePath: serverProfilePath } : {})
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
 * Clear this worker's session data between tests
 *
 * Removes the persisted session files in THIS worker's data directory
 * (P21). No other worker's directory is reachable from here, so a clean start
 * can no longer delete a session another worker is still using.
 *
 * In-process state needs no clearing: every startOrchestrator SPAWNS a fresh
 * orchestrator, and the respawn is the isolation. (The former `memory` branch
 * reset a persistenceService singleton inside the HARNESS process — a
 * different process from every orchestrator, which therefore read nothing it
 * cleared.)
 *
 * @returns {Promise<void>}
 *
 * @example
 * beforeEach(async () => {
 *   await clearSessionData();
 * });
 */
async function clearSessionData() {
  const { dataDir } = workerEnvDirs();

  try {
    await fs.access(dataDir);

    // Direct file deletion, not node-persist's async API, which could race a
    // still-completing write from the orchestrator we just stopped.
    // Only files are cleared (entry.isFile()) — a live session record is
    // exactly that, a flat file node-persist writes directly under this
    // directory. MPD's own working files live under its runtime dir (/tmp by
    // default, see musicService._mpdRuntimeDir), never under DATA_DIR, so
    // nothing here is ever a subdirectory in practice; the filter is a
    // defensive backstop, not a real case.
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    await Promise.all(
      entries
        .filter(entry => entry.isFile())
        .map(entry => fs.unlink(path.join(dataDir, entry.name)).catch(err => {
          // Ignore file not found (a concurrent stop may have removed it)
          if (err.code !== 'ENOENT') throw err;
        }))
    );

    logger.debug('Session data cleared', { dataDir });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn('Failed to clear session data', { dataDir, error: error.message });
    }
    // Directory doesn't exist yet - nothing to clear
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
  // Read-only: the closed-output-pipe reproduction
  // (tests/integration/logger-epipe-guard.test.js) boots its orchestrator with
  // the SAME environment the harness uses, so the storm it reproduces is the
  // harness's storm and not a lookalike.
  TEST_ENV,
  workerEnvDirs,
  startOrchestrator,
  stopOrchestrator,
  restartOrchestrator,
  getOrchestratorUrl,
  clearSessionData,
  waitForHealthy,
  getServerStatus
};
