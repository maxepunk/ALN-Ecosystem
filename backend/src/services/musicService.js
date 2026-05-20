'use strict';

const fs = require('fs');
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
    this._loadPlaylistsFromDisk();
    this._startPlaylistWatcher();
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
    this._stopPositionPolling();
    this._stopPlaylistWatcher();
    if (this._mpd) {
      try { await this._mpd.disconnect(); } catch (_) { /* ignore */ }
      this._mpd = null;
    }
    this.connected = false;
  }

  _loadPlaylistsFromDisk() {
    if (!this._playlistFile) return;
    try {
      const raw = fs.readFileSync(this._playlistFile, 'utf8');
      const parsed = JSON.parse(raw);
      this._playlists = new Map((parsed.playlists || []).map(p => [p.id, p]));
    } catch (err) {
      require('../utils/logger').warn(`[Music] failed to load playlists: ${err.message}`);
      this._playlists = new Map();
    }
  }

  _startPlaylistWatcher() {
    if (!this._playlistFile || this._playlistWatcher) return;
    if (!fs.existsSync(this._playlistFile)) return;
    let debounce;
    this._playlistWatcher = fs.watch(this._playlistFile, () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        this._loadPlaylistsFromDisk();
        this.emit('playlists:reloaded');
      }, 100);
    });
  }

  _stopPlaylistWatcher() {
    if (this._playlistWatcher) {
      this._playlistWatcher.close();
      this._playlistWatcher = null;
    }
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

  _assertConnected() {
    if (!this._mpd || !this.connected) {
      throw new Error('Music service not connected');
    }
  }

  async play()     { this._assertConnected(); await this._mpd.sendCommand('play'); }
  async pause()    { this._assertConnected(); await this._mpd.sendCommand('pause 1'); }
  async stop()     { this._assertConnected(); await this._mpd.sendCommand('stop'); }
  async next()     { this._assertConnected(); await this._mpd.sendCommand('next'); }
  async previous() { this._assertConnected(); await this._mpd.sendCommand('previous'); }

  async setVolume(v) {
    this._assertConnected();
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`Invalid volume: ${v}`);
    }
    if (v < 0 || v > 100) {
      throw new Error(`Volume out of range: ${v}`);
    }
    await this._mpd.sendCommand(`setvol ${Math.round(v)}`);
  }

  async setShuffle(enabled) {
    this._assertConnected();
    await this._mpd.sendCommand(`random ${enabled ? 1 : 0}`);
  }

  async setLoop(enabled) {
    this._assertConnected();
    await this._mpd.sendCommand(`repeat ${enabled ? 1 : 0}`);
  }

  _quoteMpdArg(s) {
    return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  async loadPlaylist(playlistId) {
    this._assertConnected();
    const playlist = this._playlists.get(playlistId);
    if (!playlist) throw new Error(`Unknown playlist: ${playlistId}`);

    const crossfadeSec = Math.round((playlist.crossfadeMs ?? 0) / 1000);
    const cmds = [
      `crossfade ${crossfadeSec}`,
      `random ${playlist.shuffle ? 1 : 0}`,
      `repeat ${playlist.loop ? 1 : 0}`,
      'clear',
      ...playlist.tracks.map(t => `add ${this._quoteMpdArg(t)}`),
      'play',
    ];
    await this._mpd.sendCommands(cmds);

    this.playlist = {
      id: playlist.id,
      name: playlist.name,
      position: 0,
      total: playlist.tracks.length,
      shuffle: playlist.shuffle,
      loop: playlist.loop,
      crossfadeMs: playlist.crossfadeMs,
    };
    this.emit('playlist:changed', { ...this.playlist });
  }

  getPlaylists() {
    return [...this._playlists.values()];
  }

  getPlaylist(id) {
    return this._playlists.get(id) || null;
  }

  async pauseForGameClock() {
    if (this.state !== 'playing') return;
    this._assertConnected();
    await this._mpd.sendCommand('pause 1');
    this._pausedByGameClock = true;
  }

  async resumeFromGameClock() {
    if (!this._pausedByGameClock) return;
    this._assertConnected();
    await this._mpd.sendCommand('play');
    this._pausedByGameClock = false;
  }

  _wireMpdEvents() {
    this._mpd.on('system-player', () => { this._handlePlayerEvent().catch(this._logErr.bind(this)); });
    this._mpd.on('system-mixer',  () => { this._handleMixerEvent().catch(this._logErr.bind(this)); });
    this._mpd.on('system-playlist', () => { this._handlePlaylistEvent().catch(this._logErr.bind(this)); });
  }

  _logErr(err) {
    require('../utils/logger').warn(`[Music] idle handler error: ${err.message}`);
  }

  _parseKV(stdout) {
    const obj = {};
    for (const line of String(stdout).split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      obj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return obj;
  }

  async _handlePlayerEvent() {
    if (!this._mpd) return;
    const [statusRaw, songRaw] = await Promise.all([
      this._mpd.sendCommand('status'),
      this._mpd.sendCommand('currentsong'),
    ]);
    const status = this._parseKV(statusRaw);
    const song = this._parseKV(songRaw);

    const newState = status.state || 'stopped';
    if (newState !== this.state) {
      this.state = newState;
      this.emit('playback:changed', { state: this.state });
    }

    if (song.file) {
      const newTrack = {
        file: song.file,
        title: song.Title || song.file,
        artist: song.Artist || '',
        album: song.Album || '',
        position: parseFloat(status.elapsed) || 0,
        duration: parseFloat(status.duration) || 0,
      };
      const changed = !this.track || this.track.file !== newTrack.file
        || this.track.title !== newTrack.title;
      this.track = newTrack;
      if (changed) this.emit('track:changed', { track: { ...newTrack } });
    } else if (this.track) {
      this.track = null;
      this.emit('track:changed', { track: null });
    }

    if (newState === 'playing') this._startPositionPolling();
    else this._stopPositionPolling();
  }

  async _handleMixerEvent() {
    if (!this._mpd) return;
    const raw = await this._mpd.sendCommand('status');
    const status = this._parseKV(raw);
    const v = parseInt(status.volume, 10);
    if (Number.isFinite(v) && v !== this.volume) {
      this.volume = v;
      this.emit('volume:changed', { volume: v });
    }
  }

  async _handlePlaylistEvent() {
    if (!this._mpd) return;
    const raw = await this._mpd.sendCommand('status');
    const status = this._parseKV(raw);
    if (this.playlist) {
      this.playlist.position = parseInt(status.song, 10) || 0;
    }
  }

  _startPositionPolling() {
    if (this._positionTimer) return;
    this._positionTimer = setInterval(() => {
      this._pollPosition().catch(this._logErr.bind(this));
    }, 1000);
  }

  _stopPositionPolling() {
    if (this._positionTimer) {
      clearInterval(this._positionTimer);
      this._positionTimer = null;
    }
  }

  async _pollPosition() {
    if (!this._mpd || !this.connected || !this.track) return;
    const raw = await this._mpd.sendCommand('status');
    const status = this._parseKV(raw);
    const pos = parseFloat(status.elapsed);
    if (Number.isFinite(pos)) {
      this.track.position = pos;
    }
  }

  reset() {
    this._stopPositionPolling();
    this.state = 'stopped';
    this.volume = 70;
    this.track = null;
    this.playlist = null;
    this._pausedByGameClock = false;
  }
}

const singleton = new MusicService();
singleton.MusicService = MusicService;
module.exports = singleton;
