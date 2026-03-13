// backend/src/services/spotifyService.js
const { execFile } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const registry = require('./serviceHealthRegistry');
const MprisPlayerBase = require('./mprisPlayerBase');

// Wrap execFile to always return {stdout, stderr} — needed for activate()
// and checkConnection() which bypass _dbusCall() intentionally
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

const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';
const SPOTIFYD_IFACE = 'rs.spotifyd.Controls';
const SPOTIFYD_PATH = '/rs/spotifyd/Controls';

class SpotifyService extends MprisPlayerBase {
  constructor() {
    super({
      destination: null, // Dynamic discovery (spotifyd appends .instance{PID})
      label: 'Spotify',
      healthServiceId: 'spotify',
      signalDebounceMs: 300,
    });
    this._pausedByGameClock = false;
    this._dbusDest = null;
    this._dbusCacheTime = 0;
    this._spotifydDest = null; // Native rs.spotifyd D-Bus dest (for TransferPlayback)
    this._spotifydCacheTime = 0;
    this._recoveringPromise = null; // Shared promise serializes concurrent recovery
    this.cachePath = process.env.SPOTIFY_CACHE_PATH || path.join(os.homedir(), '.cache', 'spotifyd');
  }

  // ── Dynamic D-Bus Destination Discovery ──

  /**
   * Return cached D-Bus destination (set by _discoverDbusDest).
   * Called by base _dbusCall() via _getDestination().
   */
  _getDestination() {
    return this._dbusDest;
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
    const dest = await this._discoverDest('_dbusDest', '_dbusCacheTime', 'org\\.mpris\\.MediaPlayer2\\.spotifyd', 'MPRIS');
    // Resolve unique bus name for signal filtering
    if (dest) await this._resolveOwner();
    return dest;
  }

  /**
   * Discover native spotifyd D-Bus destination (rs.spotifyd.instance{PID}).
   * This interface provides TransferPlayback for Spotify Connect activation.
   */
  async _discoverSpotifydDest() {
    return this._discoverDest('_spotifydDest', '_spotifydCacheTime', 'rs\\.spotifyd\\.', 'native');
  }

  /**
   * Override: re-discover spotifyd destination before resolving owner.
   * spotifyd PID changes on restart → new well-known name + new unique bus name.
   */
  async _refreshOwner() {
    const oldOwner = this._ownerBusName;
    this._dbusDest = null;
    this._dbusCacheTime = 0;
    await this._discoverDbusDest(); // Discovers new dest AND calls _resolveOwner()
    if (!this._ownerBusName && oldOwner) {
      this._ownerBusName = oldOwner;
    }
  }

  // ── D-Bus Call Override (Recovery Logic) ──

  /**
   * Override base _dbusCall to add reactive recovery.
   * On failure: clear caches, activate via TransferPlayback, retry.
   */
  async _dbusCall(method, args = []) {
    const dest = await this._discoverDbusDest();
    if (!dest) throw new Error('spotifyd not found on D-Bus');
    try {
      return await super._dbusCall(method, args);
    } catch (err) {
      // Serialize concurrent recovery via shared promise (command-agnostic)
      if (!this._recoveringPromise) {
        this._recoveringPromise = this._attemptRecovery()
          .finally(() => { this._recoveringPromise = null; });
      }
      try {
        await this._recoveringPromise;
      } catch {
        // Recovery failed — throw our own original error
        throw err;
      }
      // Recovery succeeded — retry OUR command (not the first caller's)
      return await super._dbusCall(method, args);
    }
  }

  /**
   * Attempt to recover spotifyd via TransferPlayback.
   * Command-agnostic — just re-activates the connection.
   * Shared by all concurrent callers via _recoveringPromise.
   * @private
   */
  async _attemptRecovery() {
    logger.warn('[Spotify] D-Bus call failed, attempting recovery');
    this._dbusDest = null;
    this._dbusCacheTime = 0;
    this._spotifydDest = null;
    this._spotifydCacheTime = 0;
    this._ownerBusName = null;
    const activated = await this.activate();
    if (!activated) throw new Error('Spotify recovery failed');
    logger.info('[Spotify] Recovery succeeded, callers will retry');
    const dest = await this._discoverDbusDest();
    if (!dest) throw new Error('MPRIS interface not found after recovery');
  }

  // ── Activation ──

  /**
   * Activate Spotify Connect on this device via TransferPlayback.
   * Uses execFileAsync directly (not _dbusCall) — different D-Bus path/interface.
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
   * Passive check only — does NOT call TransferPlayback.
   * TransferPlayback with no playback context corrupts spotifyd state,
   * causing subsequent Spotify app transfers to fail. The user should
   * start playback on their phone/tablet first, then transfer to ALN-Pi
   * via the Spotify app. Our D-Bus monitor auto-detects the transfer.
   */
  async init() {
    logger.info('[Spotify] Initializing');
    const connected = await this.checkConnection();
    if (connected) {
      logger.info('[Spotify] Initialized via existing MPRIS connection');
    } else {
      logger.info('[Spotify] Waiting for Spotify Connect transfer from user device');
    }
    // Start monitor regardless — it catches external spotifyd start/transfer
    this.startPlaybackMonitor();
  }

  // ── Transport Override ──

  /**
   * Override base _transport to support clearPausedFlag option.
   */
  async _transport(method, { clearPausedFlag = false } = {}) {
    await this._ensureConnection();
    await this._dbusCall(`${PLAYER_IFACE}.${method}`);
    // Internal flags only — D-Bus monitor is sole authority for state/events
    if (clearPausedFlag) this._pausedByGameClock = false;
  }

  async play() { await this._transport('Play', { clearPausedFlag: true }); }
  async pause() { await this._transport('Pause'); }
  async stop() { await this._transport('Stop', { clearPausedFlag: true }); }
  async next() { await this._transport('Next'); }
  async previous() { await this._transport('Previous'); }

  async setPlaylist(uri) {
    await this._dbusCall(`${PLAYER_IFACE}.OpenUri`, [`string:${uri}`]);
    // D-Bus monitor will detect the resulting track/playback changes
  }

  async setVolume(vol) {
    const clamped = Math.max(0, Math.min(100, vol));
    const normalized = clamped / 100;
    await this._dbusSetProperty(PLAYER_IFACE, 'Volume', 'double', normalized);
    // D-Bus monitor will detect the volume change and emit
  }

  async pauseForGameClock() {
    if (this.state === 'playing') {
      this._pausedByGameClock = true;
      try {
        await this.pause();
      } catch (err) {
        this._pausedByGameClock = false;
        throw err;
      }
    }
  }

  async resumeFromGameClock() {
    if (this._pausedByGameClock) {
      await this.play();
      this._pausedByGameClock = false;
    }
  }

  isPausedByGameClock() { return this._pausedByGameClock; }

  // ── Connection & State Overrides ──

  /**
   * Override base checkConnection — adds discovery + metadata refresh.
   * Uses execFileAsync directly (bypasses _dbusCall recovery logic intentionally).
   */
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

  // ── Metadata ──

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

  // ── State Change Processing (Sole Authority) ──

  /**
   * Process debounced MPRIS property changes — sole authority for state and events.
   * Commands send D-Bus calls but do NOT update state or emit; this method does both.
   */
  _processStateChange(signal) {
    const properties = signal.properties || {};

    // Auto-recover health: receiving an MPRIS signal means spotifyd is alive
    if (!registry.isHealthy('spotify')) {
      this._dbusDest = null;
      this._dbusCacheTime = 0;
      this._spotifydDest = null;
      this._spotifydCacheTime = 0;
      registry.report('spotify', 'healthy', 'MPRIS signal received');
      this._refreshOwner(); // Fire-and-forget: re-resolve after restart (preserves old owner on failure)
    }

    // PlaybackStatus: string → compare with this.state
    if ('PlaybackStatus' in properties) {
      const newState = properties.PlaybackStatus.toLowerCase();
      if (newState !== this.state) {
        const oldState = this.state;
        this.state = newState;
        this.emit('playback:changed', { state: newState });
        logger.info('[Spotify] Playback state changed', { from: oldState, to: newState });
      }
    }

    // Volume: double 0.0-1.0 → convert to 0-100
    if ('Volume' in properties) {
      const newVolume = Math.round(properties.Volume * 100);
      if (newVolume !== this.volume) {
        this.volume = newVolume;
        this.emit('volume:changed', { volume: newVolume });
        logger.info('[Spotify] Volume changed', { volume: newVolume });
      }
    }

    // Metadata: complex dict → parse from raw signal body via _parseMetadata
    if (signal.raw && signal.raw.includes('xesam:title')) {
      const newTrack = this._parseMetadata(signal.raw);
      if (newTrack && JSON.stringify(newTrack) !== JSON.stringify(this.track)) {
        this.track = newTrack;
        this.emit('track:changed', { track: newTrack });
        logger.info('[Spotify] Track changed', { track: newTrack });
      }
    }
  }

  // ── State & Cache ──

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

  /**
   * Override base getState to add pausedByGameClock.
   */
  getState() {
    return {
      ...super.getState(),
      pausedByGameClock: this._pausedByGameClock,
    };
  }

  /**
   * Override base reset to clear Spotify-specific state.
   */
  reset() {
    super.reset();
    this._pausedByGameClock = false;
    this._dbusDest = null;
    this._dbusCacheTime = 0;
    this._spotifydDest = null;
    this._spotifydCacheTime = 0;
    this._recoveringPromise = null;
  }
}

module.exports = new SpotifyService();
