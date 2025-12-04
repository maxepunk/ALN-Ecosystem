/**
 * Display Driver Utility
 * Handles system-level display control for kiosk browser
 *
 * Manages Chromium process for scoreboard display on HDMI output.
 * Used by displayControlService to switch between VLC and browser modes.
 */

const { spawn, exec } = require('child_process');
const os = require('os');
const logger = require('./logger');

// Browser process reference
let browserProcess = null;

// Configuration
const DISPLAY = process.env.DISPLAY || ':0';

/**
 * Get the first non-internal IPv4 address
 * Falls back to localhost if no network interface found
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Use actual IP to ensure CDN resources load correctly
const LOCAL_IP = getLocalIP();
const SCOREBOARD_URL = `https://${LOCAL_IP}:${process.env.PORT || 3000}/scoreboard`;

/**
 * Launch scoreboard in kiosk browser
 * @returns {Promise<boolean>} Success status
 */
async function showScoreboard() {
  // Kill any existing browser first
  await hideScoreboard();

  try {
    logger.info('[DisplayDriver] Launching scoreboard kiosk', { url: SCOREBOARD_URL });

    // Launch Chromium in kiosk mode
    // Key flags:
    // --password-store=basic: Prevents keyring dialog from blocking launch
    // --ignore-certificate-errors: Allow self-signed HTTPS cert
    // --kiosk: Fullscreen without browser chrome
    browserProcess = spawn('chromium-browser', [
      '--kiosk',
      '--noerrdialogs',
      '--disable-infobars',
      '--disable-session-crashed-bubble',
      '--ignore-certificate-errors',
      '--password-store=basic',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-features=TranslateUI',
      '--check-for-update-interval=31536000',
      '--no-first-run',
      '--disable-default-apps',
      '--autoplay-policy=no-user-gesture-required',
      SCOREBOARD_URL
    ], {
      env: { ...process.env, DISPLAY },
      detached: false,
      stdio: 'ignore'
    });

    browserProcess.on('error', (error) => {
      logger.error('[DisplayDriver] Browser process error', { error: error.message });
      browserProcess = null;
    });

    browserProcess.on('exit', (code, signal) => {
      logger.info('[DisplayDriver] Browser process exited', { code, signal });
      browserProcess = null;
    });

    // Give browser time to start
    await new Promise(resolve => setTimeout(resolve, 500));

    logger.info('[DisplayDriver] Scoreboard kiosk launched', { pid: browserProcess?.pid });
    return true;
  } catch (error) {
    logger.error('[DisplayDriver] Failed to launch scoreboard', { error: error.message });
    return false;
  }
}

/**
 * Close scoreboard browser
 * @returns {Promise<boolean>} Success status
 */
async function hideScoreboard() {
  try {
    if (browserProcess) {
      logger.info('[DisplayDriver] Killing browser process', { pid: browserProcess.pid });
      browserProcess.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force kill if still running
      if (browserProcess && !browserProcess.killed) {
        browserProcess.kill('SIGKILL');
      }

      browserProcess = null;
    }

    // Also kill any orphaned chromium processes showing scoreboard
    // This handles cases where the process reference was lost
    await new Promise((resolve) => {
      exec(`pkill -f "chromium.*scoreboard"`, { env: { ...process.env, DISPLAY } }, () => {
        // Ignore errors - process may not exist
        resolve();
      });
    });

    logger.info('[DisplayDriver] Scoreboard hidden');
    return true;
  } catch (error) {
    logger.error('[DisplayDriver] Failed to hide scoreboard', { error: error.message });
    return false;
  }
}

/**
 * Check if scoreboard browser is running
 * @returns {boolean} Running status
 */
function isScoreboardVisible() {
  return browserProcess !== null && !browserProcess.killed;
}

/**
 * Get current display driver status
 * @returns {Object} Status object
 */
function getStatus() {
  return {
    scoreboardVisible: isScoreboardVisible(),
    browserPid: browserProcess?.pid || null,
    display: DISPLAY,
    scoreboardUrl: SCOREBOARD_URL
  };
}

/**
 * Cleanup on shutdown
 */
async function cleanup() {
  await hideScoreboard();
}

module.exports = {
  showScoreboard,
  hideScoreboard,
  isScoreboardVisible,
  getStatus,
  cleanup
};
