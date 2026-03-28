/**
 * Display Driver Utility
 * Handles system-level display control for kiosk browser
 *
 * Manages a persistent Chromium process for scoreboard display on HDMI output.
 * Chromium is launched ONCE and shown/hidden via window management (xdotool + wmctrl).
 * The process is never killed during normal operation — only on server shutdown.
 *
 * Key design decisions (verified on Pi 2026-03-26):
 * - xdotool search --pid does NOT work for Chromium (window belongs to forked child)
 * - xdotool search --class chromium DOES work
 * - windowunmap/windowmap does NOT preserve fullscreen (comes back 1024x704) — NOT USED
 * - windowminimize to hide + windowactivate + wmctrl -b add,fullscreen to show — VERIFIED 0,0 1920x1080
 * - execFile (not exec) for all xdotool/wmctrl calls — no shell injection
 *
 * Used by displayControlService to switch between VLC and browser modes.
 */

const { spawn, execFile } = require('child_process');
const os = require('os');
const logger = require('./logger');

// Module-level state (persistent across calls within a process lifetime)
let browserProcess = null;
let windowId = null;  // X11 window ID string (e.g. '12345678')
let visible = false;
let launchPromise = null;  // Guard against concurrent spawns

// Configuration
const DISPLAY = process.env.DISPLAY || ':0';
const ENV = { ...process.env, DISPLAY };

/**
 * Get the first non-internal IPv4 address.
 * Falls back to localhost if no network interface found.
 * @returns {string} IP address
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Use actual IP to ensure CDN resources load correctly
const SCOREBOARD_URL = `https://${getLocalIP()}:${process.env.PORT || 3000}/scoreboard?kiosk=true&deviceId=SCOREBOARD_HDMI`;

/**
 * Run an external command via execFile (no shell injection).
 * Rejects on non-zero exit or error.
 * @param {string} cmd - Command name
 * @param {string[]} args - Command arguments
 * @returns {Promise<string>} Trimmed stdout
 */
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { env: ENV, timeout: 5000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

/**
 * Find the Chromium window ID via xdotool search --class.
 * Chromium forks — the window belongs to a child process, not the spawned parent.
 * Must search by class, not PID.
 * Retries with delay to allow Chromium time to create its window.
 * @param {number} retries - Number of attempts
 * @param {number} delayMs - Milliseconds between attempts
 * @returns {Promise<string|null>} X11 window ID or null if not found
 */
async function findWindowId(retries = 10, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const ids = await run('xdotool', ['search', '--class', 'chromium']);
      if (ids) {
        const idList = ids.split('\n').filter(Boolean);
        if (idList.length > 0) {
          // Return the last ID — typically the main content window
          return idList[idList.length - 1];
        }
      }
    } catch {
      // Window not ready yet — keep retrying
    }
    if (i < retries - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return null;
}

/**
 * Spawn Chromium and wait for its window to appear.
 * Only called from ensureBrowserRunning() when no process is alive.
 * @returns {Promise<boolean>} True if Chromium launched and window ID found
 */
async function _doLaunch() {
  logger.info('[DisplayDriver] Launching persistent scoreboard kiosk', { url: SCOREBOARD_URL });

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
    env: ENV,
    detached: false,
    stdio: 'ignore'
  });

  browserProcess.on('error', (error) => {
    logger.error('[DisplayDriver] Browser process error', { error: error.message });
    browserProcess = null;
    windowId = null;
    visible = false;
  });

  browserProcess.on('exit', (code, signal) => {
    logger.warn('[DisplayDriver] Browser process exited', { code, signal });
    browserProcess = null;
    windowId = null;
    visible = false;
  });

  windowId = await findWindowId();
  if (!windowId) {
    logger.error('[DisplayDriver] Could not find Chromium window after launch');
    return false;
  }

  logger.info('[DisplayDriver] Scoreboard window found', {
    pid: browserProcess?.pid,
    windowId
  });
  return true;
}

/**
 * Ensure Chromium is running. If already running, return immediately.
 * If the process is alive but windowId was lost (e.g. after a failed showScoreboard),
 * re-search for the window rather than spawning a new process.
 * Guards against concurrent spawns with a shared launchPromise.
 * @returns {Promise<boolean>} True if Chromium is running and window ID is known
 */
async function ensureBrowserRunning() {
  if (browserProcess && !browserProcess.killed) {
    if (windowId) return true;
    // Process alive but window ID lost — re-search before declaring failure
    windowId = await findWindowId(3, 300);
    return windowId !== null;
  }

  if (launchPromise) return launchPromise;
  launchPromise = _doLaunch();
  try {
    return await launchPromise;
  } finally {
    launchPromise = null;
  }
}

/**
 * Show the scoreboard on HDMI display.
 * Launches Chromium if not already running (first call only).
 * On subsequent calls, activates the existing window and forces fullscreen via wmctrl.
 * Verified on Pi: windowactivate + wmctrl -b add,fullscreen → 0,0 1920x1080
 * @returns {Promise<boolean>} True on success
 */
async function showScoreboard() {
  const running = await ensureBrowserRunning();
  if (!running) return false;

  try {
    // Activate window (brings it to front / un-minimizes)
    await run('xdotool', ['windowactivate', '--sync', windowId]);
    // Force fullscreen via wmctrl (verified: preserves 1920x1080 on Pi)
    await run('wmctrl', ['-i', '-r', windowId, '-b', 'add,fullscreen']);
    visible = true;
    logger.info('[DisplayDriver] Scoreboard shown (fullscreen)', { windowId });
    return true;
  } catch (error) {
    logger.error('[DisplayDriver] Failed to show scoreboard', { error: error.message });
    // Stale window ID — clear it so ensureBrowserRunning() will re-search on next call.
    // Do NOT null browserProcess: the process may still be alive; re-search will find
    // the new window ID without killing and re-spawning.
    windowId = null;
    visible = false;
    return false;
  }
}

/**
 * Hide the scoreboard by minimizing the window.
 * Does NOT kill the process — Chromium stays alive for fast re-show.
 * Minimizing (not windowunmap) preserves fullscreen state for next windowactivate.
 * Non-fatal: VLC renders underneath even if minimize fails.
 * @returns {Promise<boolean>} Always true (non-fatal hide)
 */
async function hideScoreboard() {
  if (!windowId) {
    visible = false;
    return true;
  }

  try {
    await run('xdotool', ['windowminimize', windowId]);
    visible = false;
    logger.info('[DisplayDriver] Scoreboard minimized', { windowId });
    return true;
  } catch (error) {
    logger.error('[DisplayDriver] Failed to hide scoreboard', { error: error.message });
    visible = false;
    return true; // Non-fatal — VLC renders underneath
  }
}

/**
 * Check if scoreboard is currently visible (shown and not minimized).
 * @returns {boolean} True if scoreboard window is visible
 */
function isScoreboardVisible() {
  return visible && windowId !== null;
}

/**
 * Get current display driver status.
 * @returns {Object} Status object
 */
function getStatus() {
  return {
    scoreboardVisible: isScoreboardVisible(),
    browserPid: browserProcess?.pid || null,
    windowId,
    display: DISPLAY,
    scoreboardUrl: SCOREBOARD_URL
  };
}

/**
 * Kill the browser process on server shutdown.
 * This is the ONLY place Chromium is killed. Normal show/hide uses window management.
 * @returns {Promise<void>}
 */
async function cleanup() {
  if (browserProcess && !browserProcess.killed) {
    logger.info('[DisplayDriver] Killing browser process on shutdown', {
      pid: browserProcess.pid
    });
    browserProcess.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 1000));
    if (browserProcess && !browserProcess.killed) {
      browserProcess.kill('SIGKILL');
    }
  }
  browserProcess = null;
  windowId = null;
  visible = false;
}

module.exports = {
  showScoreboard,
  hideScoreboard,
  isScoreboardVisible,
  getStatus,
  cleanup
};
