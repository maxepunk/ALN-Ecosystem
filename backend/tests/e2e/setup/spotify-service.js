/**
 * Spotify Service Helper for E2E Testing
 *
 * Real-first: checks if spotifyd is running on D-Bus, starts it if needed.
 * NO MOCK FALLBACK — either real or unavailable.
 *
 * Returns: { type: 'real' | 'unavailable', reason?: string }
 */

'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('../../../src/utils/logger');

const execFileAsync = promisify(execFile);

/**
 * Check if spotifyd is registered on the session D-Bus
 * @returns {Promise<boolean>}
 */
async function isSpotifydOnDBus() {
  try {
    const { stdout } = await execFileAsync('dbus-send', [
      '--session', '--type=method_call', '--print-reply',
      '--dest=org.freedesktop.DBus', '/org/freedesktop/DBus',
      'org.freedesktop.DBus.ListNames'
    ], { timeout: 3000 });
    return /org\.mpris\.MediaPlayer2\.spotifyd/.test(stdout);
  } catch {
    return false;
  }
}

/**
 * Check if spotifyd binary exists
 * @returns {Promise<boolean>}
 */
async function isSpotifydInstalled() {
  try {
    await execFileAsync('which', ['spotifyd'], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to start spotifyd via systemd user service
 * @returns {Promise<boolean>}
 */
async function startSpotifyd() {
  try {
    await execFileAsync('systemctl', ['--user', 'start', 'spotifyd'], { timeout: 10000 });
    // Wait up to 5s for D-Bus registration (requires active Spotify Connect session)
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await isSpotifydOnDBus()) return true;
    }
    // Daemon started but no D-Bus registration — no active Spotify Connect session
    logger.info('[E2E Spotify] spotifyd running but no MPRIS registration (no active Spotify Connect session)');
    return true; // Still counts as running — backend checkConnection() handles this
  } catch (err) {
    logger.debug('[E2E Spotify] Failed to start spotifyd:', err.message);
    return false;
  }
}

/**
 * Setup Spotify for E2E testing
 * @returns {Promise<{type: string, reason?: string, dbusDest?: string}>}
 */
async function setupSpotify() {
  // 1. Check if already on D-Bus (active Spotify Connect session)
  if (await isSpotifydOnDBus()) {
    logger.info('[E2E Spotify] spotifyd already active on D-Bus');
    return { type: 'real' };
  }

  // 2. Check if binary exists
  if (!await isSpotifydInstalled()) {
    return { type: 'unavailable', reason: 'spotifyd not installed' };
  }

  // 3. Try to start via systemd
  const started = await startSpotifyd();
  if (started) {
    const onDbus = await isSpotifydOnDBus();
    return {
      type: 'real',
      reason: onDbus ? undefined : 'running but no active Spotify Connect session — MPRIS commands will fail until a client connects'
    };
  }

  return { type: 'unavailable', reason: 'spotifyd installed but failed to start' };
}

module.exports = { setupSpotify };
