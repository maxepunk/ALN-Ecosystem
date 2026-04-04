/**
 * Display Driver Utility
 * Handles system-level display control for kiosk browser
 *
 * Manages a persistent Chromium process for scoreboard display on HDMI output.
 * Chromium is launched ONCE and shown/hidden via window management (xdotool + wmctrl).
 * The process is never killed during normal operation — only on server shutdown.
 *
 * Key design decisions (verified on Pi 2026-03-26):
 * - xdotool search --name "Case File" finds the content window by HTML <title>
 *   (--class chromium returns ALL windows including zygote/GPU; --pid doesn't work for Chromium)
 * - Window ID looked up fresh per show/hide operation — never cached (eliminates stale-ID bugs)
 * - windowminimize to hide + windowactivate + wmctrl -b add,fullscreen to show — VERIFIED 0,0 1920x1080
 * - execFile (not exec) for all xdotool/wmctrl calls — no shell injection
 *
 * Used by displayControlService to switch between VLC and browser modes.
 */

const { spawn, execFile, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const logger = require('./logger');

// Module-level state (persistent across calls within a process lifetime)
let browserProcess = null;
let visible = false;
let launchPromise = null;  // Guard against concurrent spawns

// PID file for orphan recovery (matches ProcessMonitor pattern)
const PID_FILE = '/tmp/aln-pm-scoreboard-chromium.pid';

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
 * Find the scoreboard Chromium window by its page title.
 * Searches fresh every time — no caching, no stale IDs.
 * Uses --name to match the HTML <title>, which distinguishes the content
 * window from Chromium's internal windows (zygote, GPU, crashpad).
 * @returns {Promise<string|null>} X11 window ID or null if not found
 */
async function _findScoreboardWindow() {
  try {
    const ids = await run('xdotool', ['search', '--name', 'Case File']);
    if (ids) {
      const idList = ids.split('\n').filter(Boolean);
      if (idList.length > 0) {
        return idList[0];
      }
    }
  } catch {
    // Window not found
  }
  return null;
}

/**
 * Spawn Chromium in kiosk mode.
 * Only called from ensureBrowserRunning() when no process is alive.
 * @returns {Promise<boolean>} True if Chromium process started
 */
async function _doLaunch() {
  // Kill orphaned Chromium from previous server crash via PID file.
  // PID-scoped (not system-wide pkill) so concurrent orchestrators don't interfere.
  let killedOrphan = false;
  try {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    if (!isNaN(oldPid)) {
      // Verify it's actually a chromium process before killing
      const cmdline = fs.readFileSync(`/proc/${oldPid}/cmdline`, 'utf8').replace(/\0/g, ' ');
      if (cmdline.includes('chromium')) {
        process.kill(oldPid, 'SIGTERM');
        killedOrphan = true;
        logger.info('[DisplayDriver] Killed orphaned Chromium', { pid: oldPid });
      }
    }
  } catch {
    // PID file doesn't exist, process already gone, or not chromium — clean state
  }

  if (killedOrphan) {
    // Wait for Chromium to fully exit (releases single-instance lock)
    await new Promise(r => setTimeout(r, 2000));
  }

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
    visible = false;
  });

  browserProcess.on('exit', (code, signal) => {
    logger.warn('[DisplayDriver] Browser process exited', { code, signal });
    browserProcess = null;
    visible = false;
  });

  // Write PID file for orphan recovery on next server start
  if (browserProcess?.pid) {
    try {
      fs.writeFileSync(PID_FILE, String(browserProcess.pid));
    } catch (err) {
      logger.debug('[DisplayDriver] Failed to write PID file', { error: err.message });
    }
  }

  logger.info('[DisplayDriver] Chromium process started', {
    pid: browserProcess?.pid
  });
  return true;
}

/**
 * Ensure Chromium is running. If already running, return immediately.
 * Guards against concurrent spawns with a shared launchPromise.
 * @returns {Promise<boolean>} True if Chromium process is alive
 */
async function ensureBrowserRunning() {
  if (browserProcess && !browserProcess.killed) {
    return true;
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
 * Looks up the window by title fresh each time — no cached window IDs.
 * Verified on Pi: windowactivate + wmctrl -b add,fullscreen → 0,0 1920x1080
 * @returns {Promise<boolean>} True on success
 */
async function showScoreboard() {
  const running = await ensureBrowserRunning();
  if (!running) return false;

  const wid = await _findScoreboardWindow();
  if (!wid) {
    logger.error('[DisplayDriver] Scoreboard window not found (title match failed)');
    return false;
  }

  try {
    await run('xdotool', ['windowactivate', '--sync', wid]);
    await run('wmctrl', ['-i', '-r', wid, '-b', 'add,fullscreen']);
    visible = true;
    logger.info('[DisplayDriver] Scoreboard shown (fullscreen)', { windowId: wid });
    return true;
  } catch (error) {
    logger.error('[DisplayDriver] Failed to show scoreboard', { error: error.message });
    visible = false;
    return false;
  }
}

/**
 * Hide the scoreboard by minimizing the window.
 * Does NOT kill the process — Chromium stays alive for fast re-show.
 * Looks up the window by title fresh each time — catches orphaned windows too.
 * Minimizing (not windowunmap) preserves fullscreen state for next windowactivate.
 * Non-fatal: VLC renders underneath even if minimize fails.
 * @returns {Promise<boolean>} Always true (non-fatal hide)
 */
async function hideScoreboard() {
  const wid = await _findScoreboardWindow();
  if (!wid) {
    visible = false;
    return true;
  }

  try {
    await run('xdotool', ['windowminimize', wid]);
    visible = false;
    logger.info('[DisplayDriver] Scoreboard minimized', { windowId: wid });
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
  return visible;
}

/**
 * Get current display driver status.
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
  visible = false;

  // Remove PID file (clean shutdown — no orphan to recover)
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // Already removed or never written
  }
}

module.exports = {
  ensureBrowserRunning,
  showScoreboard,
  hideScoreboard,
  isScoreboardVisible,
  getStatus,
  cleanup
};
