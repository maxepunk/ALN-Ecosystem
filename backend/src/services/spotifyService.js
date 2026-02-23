// backend/src/services/spotifyService.js
const EventEmitter = require('events');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');

// Wrap execFile to always return {stdout, stderr} (Node's custom promisify
// is lost when jest.mock('child_process') auto-mocks the module)
function execFileAsync(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

const DBUS_DEST_PREFIX = 'org.mpris.MediaPlayer2.spotifyd';
const DBUS_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';
const SPOTIFYD_IFACE = 'rs.spotifyd.Controls';

class SpotifyService extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
    this.state = 'stopped';
    this.volume = 100;
    this._pausedByGameClock = false;
    this._dbusDest = null; // Discovered dynamically (spotifyd appends .instance{PID})
    this._spotifydDest = null; // Native rs.spotifyd D-Bus dest (for TransferPlayback)
    this._recovering = false; // Prevents infinite recursion in reactive recovery
    this.cachePath = process.env.SPOTIFY_CACHE_PATH || path.join(os.homedir(), '.cache', 'spotifyd');
  }

  /**
   * Find a D-Bus destination name matching the given regex pattern.
   * Shared helper used by both MPRIS and native spotifyd discovery.
   * @param {string} pattern - Regex pattern to match against D-Bus names
   * @returns {Promise<string|null>} Matching D-Bus name or null
   */
  async _findDbusDest(pattern) {
    try {
      const { stdout } = await execFileAsync('dbus-send', [
        '--session', '--type=method_call', '--print-reply',
        '--dest=org.freedesktop.DBus', '/org/freedesktop/DBus',
        'org.freedesktop.DBus.ListNames'
      ], { timeout: 3000 });
      const re = new RegExp(`"(${pattern}[^"]*)"`);
      const match = stdout.match(re);
      return match ? match[1] : null;
    } catch (err) {
      logger.debug(`[Spotify] D-Bus discovery failed for pattern ${pattern}:`, err.message);
      return null;
    }
  }

  async _discoverDbusDest() {
    if (this._dbusDest) return this._dbusDest;
    const dest = await this._findDbusDest('org\\.mpris\\.MediaPlayer2\\.spotifyd');
    if (dest) {
      this._dbusDest = dest;
      logger.debug(`[Spotify] Discovered MPRIS dest: ${this._dbusDest}`);
    }
    return this._dbusDest;
  }

  /**
   * Discover native spotifyd D-Bus destination (rs.spotifyd.instance{PID}).
   * This interface provides TransferPlayback for Spotify Connect activation.
   * @returns {Promise<string|null>}
   */
  async _discoverSpotifydDest() {
    if (this._spotifydDest) return this._spotifydDest;
    const dest = await this._findDbusDest('rs\\.spotifyd\\.');
    if (dest) {
      this._spotifydDest = dest;
      logger.debug(`[Spotify] Discovered native dest: ${this._spotifydDest}`);
    }
    return this._spotifydDest;
  }

  /**
   * Activate Spotify Connect on this device via TransferPlayback.
   * Calls the native rs.spotifyd.Controls interface, then waits for MPRIS
   * to register and verifies connection.
   * @returns {Promise<boolean>} true if activation succeeded and MPRIS is available
   */
  async activate() {
    try {
      const dest = await this._discoverSpotifydDest();
      if (!dest) {
        logger.warn('[Spotify] Cannot activate — spotifyd not found on D-Bus');
        this._setConnected(false);
        return false;
      }

      logger.info('[Spotify] Activating via TransferPlayback');
      await execFileAsync('dbus-send', [
        '--session', '--type=method_call', '--print-reply',
        '--dest=' + dest, '/',
        `${SPOTIFYD_IFACE}.TransferPlayback`
      ], { timeout: 5000 });

      // Wait for MPRIS interface to register after activation
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Clear cached MPRIS dest (may have changed after activation)
      this._dbusDest = null;

      // Verify MPRIS is now available
      return await this.checkConnection();
    } catch (err) {
      logger.error('[Spotify] Activation failed:', err.message);
      this._setConnected(false);
      return false;
    }
  }

  /**
   * Initialize Spotify service at server startup.
   * Attempts activation first (TransferPlayback), falls back to passive check.
   * Non-blocking: logs warnings on failure, never throws.
   */
  async init() {
    logger.info('[Spotify] Initializing');
    const activated = await this.activate();
    if (activated) {
      logger.info('[Spotify] Initialized via TransferPlayback activation');
      return;
    }
    // Activation failed (no native interface), try passive MPRIS check
    const connected = await this.checkConnection();
    if (connected) {
      logger.info('[Spotify] Initialized via existing MPRIS connection');
    } else {
      logger.warn('[Spotify] Not available at startup (will retry on reconnect command)');
    }
  }

  async _dbusCall(method, args = []) {
    const dest = await this._discoverDbusDest();
    if (!dest) throw new Error('spotifyd not found on D-Bus');
    const cmdArgs = [
      '--session', '--type=method_call', '--print-reply',
      '--dest=' + dest, DBUS_PATH,
      method, ...args
    ];
    try {
      return await execFileAsync('dbus-send', cmdArgs, { timeout: 5000 });
    } catch (err) {
      // Reactive recovery: if not already recovering, try to re-activate
      if (!this._recovering) {
        this._recovering = true;
        logger.warn(`[Spotify] D-Bus call failed, attempting recovery: ${err.message}`);
        // Clear caches so discovery starts fresh
        this._dbusDest = null;
        this._spotifydDest = null;
        try {
          const activated = await this.activate();
          if (activated) {
            logger.info('[Spotify] Recovery succeeded, retrying command');
            const retryDest = await this._discoverDbusDest();
            if (!retryDest) throw new Error('spotifyd MPRIS not available after recovery');
            const retryCmdArgs = [
              '--session', '--type=method_call', '--print-reply',
              '--dest=' + retryDest, DBUS_PATH,
              method, ...args
            ];
            return await execFileAsync('dbus-send', retryCmdArgs, { timeout: 5000 });
          }
        } finally {
          this._recovering = false;
        }
      }
      throw err;
    }
  }

  async _dbusSetProperty(iface, property, type, value) {
    return this._dbusCall('org.freedesktop.DBus.Properties.Set', [
      `string:${iface}`, `string:${property}`, `variant:${type}:${value}`
    ]);
  }

  async play() {
    await this._dbusCall(`${PLAYER_IFACE}.Play`);
    this.state = 'playing';
    this._pausedByGameClock = false;
    this.emit('playback:changed', { state: 'playing' });
  }

  async pause() {
    await this._dbusCall(`${PLAYER_IFACE}.Pause`);
    this.state = 'paused';
    this.emit('playback:changed', { state: 'paused' });
  }

  async stop() {
    await this._dbusCall(`${PLAYER_IFACE}.Stop`);
    this.state = 'stopped';
    this._pausedByGameClock = false;
    this.emit('playback:changed', { state: 'stopped' });
  }

  async next() {
    await this._dbusCall(`${PLAYER_IFACE}.Next`);
    this.state = 'playing';
    this.emit('playback:changed', { state: 'playing' });
  }

  async previous() {
    await this._dbusCall(`${PLAYER_IFACE}.Previous`);
    this.state = 'playing';
    this.emit('playback:changed', { state: 'playing' });
  }

  async setPlaylist(uri) {
    await this._dbusCall(`${PLAYER_IFACE}.OpenUri`, [`string:${uri}`]);
    this.emit('playlist:changed', { uri });
  }

  async setVolume(vol) {
    const clamped = Math.max(0, Math.min(100, vol));
    const normalized = clamped / 100;
    await this._dbusSetProperty(PLAYER_IFACE, 'Volume', 'double', normalized);
    this.volume = clamped;
    this.emit('volume:changed', { volume: clamped });
  }

  async pauseForGameClock() {
    if (this.state === 'playing') {
      await this.pause();
      this._pausedByGameClock = true;
    }
  }

  async resumeFromGameClock() {
    if (this._pausedByGameClock) {
      await this.play();
      this._pausedByGameClock = false;
    }
  }

  isPausedByGameClock() { return this._pausedByGameClock; }

  /**
   * Update connected state and emit connection:changed if it actually changed.
   * @param {boolean} newConnected - The new connection state
   */
  _setConnected(newConnected) {
    const changed = this.connected !== newConnected;
    this.connected = newConnected;
    if (changed) {
      this.emit('connection:changed', { connected: newConnected });
    }
  }

  async checkConnection() {
    try {
      const dest = await this._discoverDbusDest();
      if (!dest) {
        this._setConnected(false);
        return false;
      }
      // Use Properties.Get instead of Peer.Ping (spotifyd doesn't implement Peer)
      const { stdout } = await execFileAsync('dbus-send', [
        '--session', '--type=method_call', '--print-reply',
        '--dest=' + dest, DBUS_PATH,
        'org.freedesktop.DBus.Properties.Get',
        `string:${PLAYER_IFACE}`, 'string:PlaybackStatus'
      ], { timeout: 2000 });
      this._setConnected(true);
      // Sync state from actual D-Bus status
      if (stdout.includes('"Playing"')) this.state = 'playing';
      else if (stdout.includes('"Paused"')) this.state = 'paused';
      else this.state = 'stopped';
      return true;
    } catch {
      this._setConnected(false);
      return false;
    }
  }

  async verifyCacheStatus() {
    if (!fs.existsSync(this.cachePath)) {
      return { status: 'missing', message: 'Cache directory not found' };
    }
    const files = fs.readdirSync(this.cachePath);
    if (files.length === 0) {
      return { status: 'missing', message: 'Cache is empty' };
    }
    return { status: 'verified', trackCount: files.length };
  }

  getState() {
    return {
      connected: this.connected,
      state: this.state,
      volume: this.volume,
      pausedByGameClock: this._pausedByGameClock,
    };
  }

  reset() {
    this.connected = false;
    this.state = 'stopped';
    this.volume = 100;
    this._pausedByGameClock = false;
    this._dbusDest = null; // Re-discover on next call (PID may change after restart)
    this._spotifydDest = null;
    this._recovering = false;
  }

  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

module.exports = new SpotifyService();
