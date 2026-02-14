// backend/src/services/spotifyService.js
const EventEmitter = require('events');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

const DBUS_DEST = 'org.mpris.MediaPlayer2.spotifyd';
const DBUS_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';

class SpotifyService extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
    this.state = 'stopped';
    this.volume = 100;
    this._pausedByGameClock = false;
    this.cachePath = process.env.SPOTIFY_CACHE_PATH || '/home/maxepunk/.cache/spotifyd';
  }

  async _dbusCall(method, args = []) {
    const cmdArgs = [
      '--session', '--type=method_call', '--print-reply',
      '--dest=' + DBUS_DEST, DBUS_PATH,
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

  async checkConnection() {
    try {
      await execFileAsync('dbus-send', [
        '--session', '--type=method_call', '--print-reply',
        '--dest=' + DBUS_DEST, DBUS_PATH,
        'org.freedesktop.DBus.Peer.Ping'
      ], { timeout: 2000 });
      this.connected = true;
      return true;
    } catch {
      this.connected = false;
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
  }

  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

module.exports = new SpotifyService();
