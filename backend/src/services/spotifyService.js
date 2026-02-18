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

class SpotifyService extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
    this.state = 'stopped';
    this.volume = 100;
    this._pausedByGameClock = false;
    this._dbusDest = null; // Discovered dynamically (spotifyd appends .instance{PID})
    this.cachePath = process.env.SPOTIFY_CACHE_PATH || path.join(os.homedir(), '.cache', 'spotifyd');
  }

  async _discoverDbusDest() {
    if (this._dbusDest) return this._dbusDest;
    try {
      const { stdout } = await execFileAsync('dbus-send', [
        '--session', '--type=method_call', '--print-reply',
        '--dest=org.freedesktop.DBus', '/org/freedesktop/DBus',
        'org.freedesktop.DBus.ListNames'
      ], { timeout: 3000 });
      const match = stdout.match(/"(org\.mpris\.MediaPlayer2\.spotifyd[^"]*)"/);
      if (match) {
        this._dbusDest = match[1];
        logger.debug(`[Spotify] Discovered D-Bus dest: ${this._dbusDest}`);
        return this._dbusDest;
      }
    } catch (err) {
      logger.debug('[Spotify] D-Bus discovery failed:', err.message);
    }
    return null;
  }

  async _dbusCall(method, args = []) {
    const dest = await this._discoverDbusDest();
    if (!dest) throw new Error('spotifyd not found on D-Bus');
    const cmdArgs = [
      '--session', '--type=method_call', '--print-reply',
      '--dest=' + dest, DBUS_PATH,
      method, ...args
    ];
    return execFileAsync('dbus-send', cmdArgs, { timeout: 5000 });
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

  async next() { await this._dbusCall(`${PLAYER_IFACE}.Next`); }
  async previous() { await this._dbusCall(`${PLAYER_IFACE}.Previous`); }

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
  }

  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

module.exports = new SpotifyService();
