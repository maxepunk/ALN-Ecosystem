/**
 * VLC Service Helper for E2E Testing
 *
 * Provides smart VLC integration for E2E tests with automatic fallback
 * to mock VLC server when real VLC is unavailable.
 *
 * KEY DESIGN PRINCIPLES:
 * - testing-anti-patterns: Use real VLC when available, graceful fallback to mock
 * - webapp-testing: Test with actual hardware when possible
 * - No arbitrary timeouts: Condition-based waiting
 *
 * REAL VLC SETUP:
 * - VLC HTTP interface: http://localhost:8080
 * - Password: 'vlc' (from .env.example)
 * - Commands via: /requests/status.json?command=...
 * - Duration in SECONDS (not milliseconds!)
 *
 * MOCK VLC FALLBACK:
 * - Uses MockVlcServer from tests/helpers/mock-vlc-server.js
 * - Simulates VLC HTTP API behavior
 * - Enables testing without VLC installation
 */

const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../../../src/utils/logger');
const MockVlcServer = require('../../helpers/mock-vlc-server');

// VLC configuration constants
const VLC_HOST = 'localhost';
const VLC_PORT = 8080;
const VLC_PASSWORD = 'vlc';
const VLC_STATUS_URL = `http://${VLC_HOST}:${VLC_PORT}/requests/status.json`;
const VLC_MAX_WAIT_MS = 10000; // 10s to wait for VLC startup
const VLC_HEALTH_CHECK_INTERVAL_MS = 500; // Check every 500ms

// Singleton state
let vlcProcess = null;
let mockVlcServer = null;
let vlcMode = null; // 'real' | 'mock' | null

/**
 * Check if VLC is available and responding
 * @returns {Promise<boolean>} true if VLC is running and accessible
 */
async function isVLCAvailable() {
  try {
    const response = await axios.get(VLC_STATUS_URL, {
      auth: {
        username: '',
        password: VLC_PASSWORD
      },
      timeout: 2000
    });

    // VLC should return status with 'state' property
    if (response.status === 200 && response.data && 'state' in response.data) {
      logger.debug('VLC is available', { state: response.data.state });
      return true;
    }

    return false;
  } catch (error) {
    // Connection refused, timeout, or other errors mean VLC not available
    logger.debug('VLC not available', { error: error.message });
    return false;
  }
}

/**
 * Start VLC if not already running
 * Uses npm run vlc:headless (no GUI, suitable for tests)
 *
 * @returns {Promise<boolean>} true if VLC started successfully or already running
 */
async function startVLCIfNeeded() {
  // Check if already running
  if (await isVLCAvailable()) {
    logger.info('VLC already running - skipping startup');
    return true;
  }

  logger.info('Starting VLC in headless mode for E2E tests...');

  try {
    // Use the VLC headless script from backend/scripts
    const scriptPath = path.join(__dirname, '../../../scripts/vlc-headless.sh');

    // Spawn VLC process
    vlcProcess = spawn('bash', [scriptPath], {
      detached: true, // Allow process to continue after parent exits
      stdio: 'ignore' // Suppress output (VLC logs to stderr)
    });

    // Don't wait for the process (it runs in background)
    vlcProcess.unref();

    logger.debug('VLC process spawned', { pid: vlcProcess.pid });

    // Wait for VLC to become ready
    const ready = await waitForVLCReady(VLC_MAX_WAIT_MS);

    if (ready) {
      logger.info('VLC started successfully for E2E tests');
      return true;
    } else {
      logger.warn('VLC failed to become ready within timeout');
      vlcProcess = null;
      return false;
    }
  } catch (error) {
    logger.error('Failed to start VLC', { error: error.message });
    vlcProcess = null;
    return false;
  }
}

/**
 * Stop VLC process if started by this helper
 * Note: Does not stop VLC that was already running before tests
 *
 * @returns {Promise<void>}
 */
async function stopVLC() {
  if (!vlcProcess) {
    logger.debug('No VLC process to stop (not started by helper)');
    return;
  }

  logger.info('Stopping VLC process...');

  try {
    // Kill the process group (VLC spawns multiple processes)
    process.kill(-vlcProcess.pid, 'SIGTERM');

    // Wait briefly for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));

    vlcProcess = null;
    logger.info('VLC process stopped');
  } catch (error) {
    logger.warn('Error stopping VLC process', { error: error.message });
    vlcProcess = null;
  }
}

/**
 * Get current VLC status
 * Works with both real VLC and mock VLC
 *
 * @returns {Promise<Object>} VLC status object
 */
async function getVLCStatus() {
  const baseUrl = vlcMode === 'mock' && mockVlcServer
    ? `http://localhost:${mockVlcServer.port}`
    : `http://${VLC_HOST}:${VLC_PORT}`;

  try {
    const response = await axios.get(`${baseUrl}/requests/status.json`, {
      auth: {
        username: '',
        password: VLC_PASSWORD
      },
      timeout: 2000
    });

    return response.data;
  } catch (error) {
    logger.error('Failed to get VLC status', { error: error.message });
    throw error;
  }
}

/**
 * Wait for VLC HTTP interface to be ready
 * Uses condition-based polling (no arbitrary timeouts)
 *
 * @param {number} timeoutMs - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} true if VLC became ready, false if timeout
 */
async function waitForVLCReady(timeoutMs = VLC_MAX_WAIT_MS) {
  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;

    if (await isVLCAvailable()) {
      logger.debug('VLC ready', { attempts, elapsedMs: Date.now() - startTime });
      return true;
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, VLC_HEALTH_CHECK_INTERVAL_MS));
  }

  logger.warn('VLC readiness timeout', { attempts, elapsedMs: Date.now() - startTime });
  return false;
}

/**
 * Start mock VLC server (fallback when real VLC unavailable)
 * Uses MockVlcServer from tests/helpers/mock-vlc-server.js
 *
 * @returns {Promise<number>} Port number mock server is listening on
 */
async function mockVLCService() {
  if (mockVlcServer) {
    logger.warn('Mock VLC server already running');
    return mockVlcServer.port;
  }

  logger.info('Starting mock VLC server for E2E tests...');

  try {
    mockVlcServer = new MockVlcServer();
    const port = await mockVlcServer.start();

    logger.info('Mock VLC server started', { port });
    return port;
  } catch (error) {
    logger.error('Failed to start mock VLC server', { error: error.message });
    throw error;
  }
}

/**
 * Stop mock VLC server
 * @returns {Promise<void>}
 */
async function stopMockVLC() {
  if (!mockVlcServer) {
    logger.debug('No mock VLC server to stop');
    return;
  }

  logger.info('Stopping mock VLC server...');

  try {
    await mockVlcServer.stop();
    mockVlcServer = null;
    logger.info('Mock VLC server stopped');
  } catch (error) {
    logger.warn('Error stopping mock VLC server', { error: error.message });
    mockVlcServer = null;
  }
}

/**
 * Smart VLC setup: Try real VLC, fallback to mock
 * This is the main entry point for E2E tests
 *
 * @returns {Promise<Object>} VLC service info
 *   - type: 'real' | 'mock'
 *   - url: Base URL for VLC HTTP interface
 *   - port: Port number
 *   - password: Password for authentication
 */
async function setupVLC() {
  logger.info('Setting up VLC for E2E tests...');

  // Strategy 1: Try to use real VLC
  if (await isVLCAvailable()) {
    logger.info('Using existing VLC instance');
    vlcMode = 'real';
    return {
      type: 'real',
      url: `http://${VLC_HOST}:${VLC_PORT}`,
      port: VLC_PORT,
      password: VLC_PASSWORD
    };
  }

  // Strategy 2: Try to start VLC
  if (await startVLCIfNeeded()) {
    logger.info('Using newly started VLC instance');
    vlcMode = 'real';
    return {
      type: 'real',
      url: `http://${VLC_HOST}:${VLC_PORT}`,
      port: VLC_PORT,
      password: VLC_PASSWORD
    };
  }

  // Strategy 3: Fallback to mock VLC
  logger.warn('VLC not available - using mock VLC server');
  const port = await mockVLCService();
  vlcMode = 'mock';

  return {
    type: 'mock',
    url: `http://localhost:${port}`,
    port: port,
    password: VLC_PASSWORD
  };
}

/**
 * Cleanup VLC resources
 * Stops both real and mock VLC if started by this helper
 *
 * @returns {Promise<void>}
 */
async function cleanup() {
  logger.info('Cleaning up VLC resources...');

  // Stop VLC process if we started it
  await stopVLC();

  // Stop mock VLC server if we started it
  await stopMockVLC();

  vlcMode = null;
  logger.info('VLC cleanup complete');
}

/**
 * Get mock VLC server instance (for test assertions)
 * Only available when using mock mode
 *
 * @returns {MockVlcServer|null} Mock server instance or null
 */
function getMockVLCServer() {
  return mockVlcServer;
}

/**
 * Get current VLC mode
 * @returns {'real'|'mock'|null} Current VLC mode
 */
function getVLCMode() {
  return vlcMode;
}

/**
 * Reset VLC service state (for test isolation)
 * @returns {Promise<void>}
 */
async function reset() {
  await cleanup();

  // Reset mock server state if it exists
  if (mockVlcServer) {
    mockVlcServer.reset();
  }
}

module.exports = {
  // Core functions
  isVLCAvailable,
  startVLCIfNeeded,
  stopVLC,
  getVLCStatus,
  waitForVLCReady,

  // Mock VLC functions
  mockVLCService,
  stopMockVLC,
  getMockVLCServer,

  // High-level setup
  setupVLC,
  cleanup,
  reset,

  // State inspection
  getVLCMode,

  // Constants (for test configuration)
  VLC_HOST,
  VLC_PORT,
  VLC_PASSWORD,
  VLC_STATUS_URL
};
