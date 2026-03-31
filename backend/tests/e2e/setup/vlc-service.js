/**
 * VLC Service Helper for E2E Testing
 *
 * Ensures VLC media player is running for E2E tests.
 * VLC is controlled via D-Bus MPRIS (not HTTP).
 *
 * KEY DESIGN PRINCIPLES:
 * - Use real VLC when available, graceful degradation when unavailable
 * - D-Bus MPRIS is the sole control interface (no HTTP fallback)
 * - No mock fallback — E2E tests require real VLC or skip video tests
 *
 * REAL VLC SETUP:
 * - VLC must be running with D-Bus MPRIS interface
 * - D-Bus destination: org.mpris.MediaPlayer2.vlc
 * - Control via dbus-send CLI commands
 */

const { execFileSync, spawn } = require('child_process');
const logger = require('../../../src/utils/logger');

const VLC_DBUS_DEST = 'org.mpris.MediaPlayer2.vlc';
const VLC_MAX_WAIT_MS = 10000; // 10s to wait for VLC startup
const VLC_HEALTH_CHECK_INTERVAL_MS = 500; // Check every 500ms

// Singleton state
let vlcProcess = null;
let vlcMode = null; // 'real' | 'unavailable' | null

/**
 * Check if VLC is available via D-Bus MPRIS
 * @returns {Promise<boolean>} true if VLC is running and responds to D-Bus
 */
async function isVLCAvailable() {
  try {
    execFileSync('dbus-send', [
      '--session',
      `--dest=${VLC_DBUS_DEST}`,
      '--print-reply',
      '/org/mpris/MediaPlayer2',
      'org.freedesktop.DBus.Peer.Ping'
    ], { timeout: 2000, stdio: 'pipe' });

    logger.debug('VLC is available (D-Bus responsive)');
    return true;
  } catch {
    logger.debug('VLC not available (D-Bus check failed)');
    return false;
  }
}

/**
 * Start VLC if not already running
 * @returns {Promise<boolean>} true if VLC started or already running
 */
async function startVLCIfNeeded() {
  if (await isVLCAvailable()) {
    logger.info('VLC already running - skipping startup');
    return true;
  }

  logger.info('Starting VLC for E2E tests...');

  try {
    vlcProcess = spawn('cvlc', [
      '--intf', 'dummy',
      '--no-video-title-show',
      '--quiet'
    ], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
    });
    vlcProcess.unref();

    logger.debug('VLC process spawned', { pid: vlcProcess.pid });

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
 * @returns {Promise<void>}
 */
async function stopVLC() {
  if (!vlcProcess) {
    logger.debug('No VLC process to stop (not started by helper)');
    return;
  }

  logger.info('Stopping VLC process...');

  try {
    process.kill(-vlcProcess.pid, 'SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
    vlcProcess = null;
    logger.info('VLC process stopped');
  } catch (error) {
    logger.warn('Error stopping VLC process', { error: error.message });
    vlcProcess = null;
  }
}

/**
 * Wait for VLC D-Bus interface to be ready
 * Uses condition-based polling
 *
 * @param {number} timeoutMs - Maximum time to wait
 * @returns {Promise<boolean>} true if VLC became ready
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

    await new Promise(resolve => setTimeout(resolve, VLC_HEALTH_CHECK_INTERVAL_MS));
  }

  logger.warn('VLC readiness timeout', { attempts, elapsedMs: Date.now() - startTime });
  return false;
}

/**
 * Smart VLC setup: Check D-Bus, try to start, report availability
 * This is the main entry point for E2E tests.
 *
 * @returns {Promise<Object>} VLC service info
 *   - type: 'real' | 'unavailable'
 */
async function setupVLC() {
  logger.info('Setting up VLC for E2E tests (D-Bus MPRIS)...');

  // Strategy 1: Check if VLC is already running
  if (await isVLCAvailable()) {
    logger.info('Using existing VLC instance (D-Bus)');
    vlcMode = 'real';
    return { type: 'real' };
  }

  // Strategy 2: Try to start VLC
  if (await startVLCIfNeeded()) {
    logger.info('Using newly started VLC instance');
    vlcMode = 'real';
    return { type: 'real' };
  }

  // No fallback — E2E video tests require real VLC
  logger.warn('VLC not available for E2E tests — video-dependent tests may fail');
  vlcMode = 'unavailable';
  return { type: 'unavailable' };
}

/**
 * Cleanup VLC resources
 * @returns {Promise<void>}
 */
async function cleanup() {
  logger.info('Cleaning up VLC resources...');
  await stopVLC();
  vlcMode = null;
  logger.info('VLC cleanup complete');
}

/**
 * Get current VLC mode
 * @returns {'real'|'unavailable'|null}
 */
function getVLCMode() {
  return vlcMode;
}

module.exports = {
  // Core functions
  isVLCAvailable,
  startVLCIfNeeded,
  stopVLC,
  waitForVLCReady,

  // High-level setup
  setupVLC,
  cleanup,
  reset: cleanup,

  // State inspection
  getVLCMode,
};
