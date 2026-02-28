// backend/src/services/spotifyService.js
const EventEmitter = require('events');
const { execFile } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const registry = require('./serviceHealthRegistry');

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

/** D-Bus destination cache TTL (ms) — re-discover if spotifyd PID changed */
const DBUS_DEST_CACHE_TTL = 300000; // 5 minutes

const DBUS_DEST_PREFIX = 'org.mpris.MediaPlayer2.spotifyd';
const DBUS_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';
const SPOTIFYD_IFACE = 'rs.spotifyd.Controls';
const SPOTIFYD_PATH = '/rs/spotifyd/Controls';

class SpotifyService extends EventEmitter {
  constructor() {
    super();
    this.state = 'stopped';
    this.volume = 100;
    this.track = null;
    this._pausedByGameClock = false;
    this._dbusDest = null; // Discovered dynamically (spotifyd appends .instance{PID})
    this._dbusCacheTime = 0;
    this._spotifydDest = null; // Native rs.spotifyd D-Bus dest (for TransferPlayback)
    this._spotifydCacheTime = 0;
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

  /**
   * Shared discovery helper — check cache TTL, call _findDbusDest, update cache.
   * @param {string} cacheField - Instance field name for cached dest (e.g., '_dbusDest')
   * @param {string} cacheTimeField - Instance field name for cache timestamp
   * @param {string} pattern - Regex pattern for _findDbusDest
   * @param {string} label - Label for debug logging
   * @returns {Promise<string|null>}
   */
  async _discoverDest(cacheField, cacheTimeField, pattern, label) {
    if (this[cacheField] && (Date.now() - this[cacheTimeField]) < DBUS_DEST_CACHE_TTL) {
      return this[cacheField];
    }
    const dest = await this._findDbusDest(pattern);
    if (dest) {
      this[cacheField] = dest;
      this[cacheTimeField] = Date.now();
      logger.debug(`[Spotify] Discovered ${label} dest: ${dest}`);
    } else {
      this[cacheField] = null;
      this[cacheTimeField] = 0;
    }
    return this[cacheField];
  }

  async _discoverDbusDest() {
    return this._discoverDest('_dbusDest', '_dbusCacheTime', 'org\\.mpris\\.MediaPlayer2\\.spotifyd', 'MPRIS');
  }

  /**
   * Discover native spotifyd D-Bus destination (rs.spotifyd.instance{PID}).
   * This interface provides TransferPlayback for Spotify Connect activation.
   * @returns {Promise<string|null>}
   */
  async _discoverSpotifydDest() {
    return this._discoverDest('_spotifydDest', '_spotifydCacheTime', 'rs\\.spotifyd\\.', 'native');
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
        '--dest=' + dest, SPOTIFYD_PATH,
        `${SPOTIFYD_IFACE}.TransferPlayback`
      ], { timeout: 5000 });

      // Wait for MPRIS interface to register after activation
      await this._activationDelay();

      // Clear cached MPRIS dest (may have changed after activation)
      this._dbusDest = null;
      this._dbusCacheTime = 0;

      // Verify MPRIS is now available
      return await this.checkConnection();
    } catch (err) {
      logger.error('[Spotify] Activation failed:', err.message);
      this._setConnected(false);
      return false;
    }
  }

  /**
   * Delay after TransferPlayback to allow MPRIS interface to register.
   * Extracted for test mockability (avoids 1.5s real delay per test).
   */
  _activationDelay() {
    return new Promise(resolve => setTimeout(resolve, 1500));
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

  _buildDbusArgs(dest, method, args = []) {
    return [
      '--session', '--type=method_call', '--print-reply',
      '--dest=' + dest, DBUS_PATH,
      method, ...args
    ];
  }

  async _dbusCall(method, args = []) {
    const dest = await this._discoverDbusDest();
    if (!dest) throw new Error('spotifyd not found on D-Bus');
    const cmdArgs = this._buildDbusArgs(dest, method, args);
    try {
      return await execFileAsync('dbus-send', cmdArgs, { timeout: 5000 });
    } catch (err) {
      // Reactive recovery: if not already recovering, try to re-activate
      if (!this._recovering) {
        this._recovering = true;
        logger.warn(`[Spotify] D-Bus call failed, attempting recovery: ${err.message}`);
        // Clear caches so discovery starts fresh
        this._dbusDest = null;
        this._dbusCacheTime = 0;
        this._spotifydDest = null;
        this._spotifydCacheTime = 0;
        try {
          const activated = await this.activate();
          if (activated) {
            logger.info('[Spotify] Recovery succeeded, retrying command');
            const retryDest = await this._discoverDbusDest();
            if (!retryDest) throw new Error('MPRIS interface not found after TransferPlayback recovery');
            const retryCmdArgs = this._buildDbusArgs(retryDest, method, args);
            return await execFileAsync('dbus-send', retryCmdArgs, { timeout: 5000 });
          }
        } finally {
          this._recovering = false;
        }
      }
      throw err;
    }
  }

  async _dbusGetProperty(iface, property) {
    return this._dbusCall('org.freedesktop.DBus.Properties.Get', [
      `string:${iface}`, `string:${property}`
    ]);
  }

  async _dbusSetProperty(iface, property, type, value) {
    return this._dbusCall('org.freedesktop.DBus.Properties.Set', [
      `string:${iface}`, `string:${property}`, `variant:${type}:${value}`
    ]);
  }

  /**
   * Parse D-Bus Metadata dict for xesam:title and xesam:artist.
   * @param {string} stdout - Raw dbus-send output
   * @returns {{ title: string, artist: string } | null}
   */
  _parseMetadata(stdout) {
    if (!stdout) return null;
    const titleMatch = stdout.match(/xesam:title[\s\S]*?variant\s+string\s+"([^"]*)"/);
    const artistMatch = stdout.match(/xesam:artist[\s\S]*?string\s+"([^"]*)"/);
    const title = titleMatch ? titleMatch[1] : null;
    const artist = artistMatch ? artistMatch[1] : null;
    if (!title) return null;
    return { title, artist: artist || 'Unknown Artist' };
  }

  /**
   * Refresh track metadata from D-Bus.
   * @returns {Promise<boolean>} true if track changed
   */
  async _refreshMetadata() {
    try {
      const { stdout } = await this._dbusGetProperty(PLAYER_IFACE, 'Metadata');
      const newTrack = this._parseMetadata(stdout);
      // Don't overwrite valid track with null during transitions
      if (!newTrack) return false;
      const changed = JSON.stringify(newTrack) !== JSON.stringify(this.track);
      this.track = newTrack;
      if (changed) {
        this.emit('track:changed', { track: newTrack });
      }
      return changed;
    } catch (err) {
      logger.debug('[Spotify] Metadata refresh failed:', err.message);
      return false;
    }
  }

  /**
   * Shared transport helper — consolidates play/pause/stop/next/previous.
   * @param {string} method - MPRIS method name (e.g., 'Play')
   * @param {string} newState - New playback state
   * @param {Object} [opts]
   * @param {boolean} [opts.clearPausedFlag=false] - Reset _pausedByGameClock
   * @param {boolean} [opts.refreshMetadata=false] - Refresh track metadata after transport
   */
  async _transport(method, newState, { clearPausedFlag = false, refreshMetadata = false } = {}) {
    await this._ensureConnection();
    await this._dbusCall(`${PLAYER_IFACE}.${method}`);
    this.state = newState;
    if (clearPausedFlag) this._pausedByGameClock = false;
    this.emit('playback:changed', { state: newState });
    if (refreshMetadata) {
      await this._refreshMetadata();
    }
  }

  async play() { await this._transport('Play', 'playing', { clearPausedFlag: true, refreshMetadata: true }); }
  async pause() { await this._transport('Pause', 'paused'); }
  async stop() { await this._transport('Stop', 'stopped', { clearPausedFlag: true }); }
  async next() { await this._transport('Next', 'playing', { refreshMetadata: true }); }
  async previous() { await this._transport('Previous', 'playing', { refreshMetadata: true }); }

  async setPlaylist(uri) {
    await this._dbusCall(`${PLAYER_IFACE}.OpenUri`, [`string:${uri}`]);
    this.emit('playlist:changed', { uri });
    await this._refreshMetadata();
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
   * Update connected state via service health registry.
   * @param {boolean} newConnected - The new connection state
   */
  _setConnected(newConnected) {
    registry.report('spotify', newConnected ? 'healthy' : 'down',
      newConnected ? 'D-Bus connected' : 'D-Bus unreachable');
  }

  /**
   * Pre-command validation — verifies Spotify is reachable before transport.
   * If not connected, runs checkConnection() to probe. Throws if still unreachable.
   * @throws {Error} If Spotify is not connected after probing
   */
  async _ensureConnection() {
    if (registry.isHealthy('spotify')) return;
    const ok = await this.checkConnection();
    if (!ok) throw new Error('Spotify not connected');
  }

  async checkConnection() {
    try {
      const dest = await this._discoverDbusDest();
      if (!dest) {
        this._setConnected(false);
        return false;
      }
      // Use Properties.Get instead of Peer.Ping (spotifyd doesn't implement Peer)
      const cmdArgs = this._buildDbusArgs(dest, 'org.freedesktop.DBus.Properties.Get', [
        `string:${PLAYER_IFACE}`, 'string:PlaybackStatus'
      ]);
      const { stdout } = await execFileAsync('dbus-send', cmdArgs, { timeout: 2000 });
      this._setConnected(true);
      // Sync state from actual D-Bus status
      let newState;
      if (stdout.includes('"Playing"')) newState = 'playing';
      else if (stdout.includes('"Paused"')) newState = 'paused';
      else newState = 'stopped';

      if (newState !== this.state) {
        this.state = newState;
        this.emit('playback:changed', { state: newState });
      }
      // Await metadata so getState().track is populated before sync:full
      await this._refreshMetadata();
      return true;
    } catch {
      this._setConnected(false);
      return false;
    }
  }

  async verifyCacheStatus() {
    try {
      const files = await fs.readdir(this.cachePath);
      if (files.length === 0) {
        return { status: 'missing', message: 'Cache is empty' };
      }
      return { status: 'verified', trackCount: files.length };
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { status: 'missing', message: 'Cache directory not found' };
      }
      throw err;
    }
  }

  getState() {
    return {
      connected: registry.isHealthy('spotify'),
      state: this.state,
      volume: this.volume,
      pausedByGameClock: this._pausedByGameClock,
      track: this.track,
    };
  }

  reset() {
    registry.report('spotify', 'down', 'Reset');
    this.state = 'stopped';
    this.volume = 100;
    this.track = null;
    this._pausedByGameClock = false;
    this._dbusDest = null; // Re-discover on next call (PID may change after restart)
    this._dbusCacheTime = 0;
    this._spotifydDest = null;
    this._spotifydCacheTime = 0;
    this._recovering = false;
  }

  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

module.exports = new SpotifyService();
