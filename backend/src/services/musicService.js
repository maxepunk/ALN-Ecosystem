'use strict';

const EventEmitter = require('events');

class MusicService extends EventEmitter {
  constructor({ socketPath = '/tmp/aln-mpd.sock', playlistFile = null } = {}) {
    super();
    this._socketPath = socketPath;
    this._playlistFile = playlistFile;
    this._playlists = new Map();

    this.connected = false;
    this.state = 'stopped';
    this.volume = 70;
    this.track = null;
    this.playlist = null;
    this._pausedByGameClock = false;
  }

  getState() {
    return {
      connected: this.connected,
      state: this.state,
      volume: this.volume,
      track: this.track ? { ...this.track } : null,
      playlist: this.playlist ? { ...this.playlist } : null,
      pausedByGameClock: this._pausedByGameClock,
    };
  }

  async init() {
    const mpd2 = require('mpd2');
    const registry = require('./serviceHealthRegistry');
    try {
      this._mpd = await mpd2.connect({ path: this._socketPath });
      this._wireMpdEvents();
      this.connected = true;
      registry.report('music', 'healthy', 'MPD connected');
    } catch (err) {
      this.connected = false;
      registry.report('music', 'down', `MPD connect failed: ${err.message}`);
    }
  }

  async cleanup() {
    if (this._mpd) {
      try { await this._mpd.disconnect(); } catch (_) { /* ignore */ }
      this._mpd = null;
    }
    this.connected = false;
  }

  async checkConnection() {
    if (!this._mpd) return false;
    try {
      await this._mpd.sendCommand('ping');
      return true;
    } catch (_) {
      return false;
    }
  }

  _wireMpdEvents() {
    // Filled in later tasks (idle event handlers)
  }
}

const singleton = new MusicService();
singleton.MusicService = MusicService;
module.exports = singleton;
