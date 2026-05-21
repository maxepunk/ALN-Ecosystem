'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

/**
 * MPD's `status` command returns raw protocol strings (`play`/`pause`/`stop`).
 * The rest of the system uses canonical `playing`/`paused`/`stopped` everywhere
 * (pauseForGameClock guard, position-polling trigger, frontend MusicRenderer).
 * Normalizing in one place prevents the bug class where E2E real-MPD output
 * silently fails canonical-name comparisons.
 */
const MPD_STATE_MAP = Object.freeze({ play: 'playing', pause: 'paused', stop: 'stopped' });

/**
 * Parse MPD's `listallinfo` multi-record output. Each track starts with a
 * `file:` key; subsequent metadata keys belong to that track until the next
 * `file:` line. Exported so HTTP routes can use it without reaching into
 * musicService internals.
 */
function parseListAllInfo(stdout) {
  const tracks = [];
  let current = null;
  for (const line of String(stdout).split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key === 'file') {
      if (current) tracks.push(current);
      current = { file: val, title: val, artist: '', album: '', duration: 0 };
    } else if (current) {
      if (key === 'Title') current.title = val;
      else if (key === 'Artist') current.artist = val;
      else if (key === 'Album') current.album = val;
      else if (key === 'Time') current.duration = parseInt(val, 10) || 0;
    }
  }
  if (current) tracks.push(current);
  return tracks;
}

class MusicService extends EventEmitter {
  constructor({
    socketPath = '/tmp/aln-mpd.sock',
    configFile = '/tmp/aln-mpd.conf',
    musicDir = null,
    dataDir = '/tmp',
    playlistFile = null,
  } = {}) {
    super();
    this._socketPath = socketPath;
    this._configFile = configFile;
    this._musicDir = musicDir;
    this._dataDir = dataDir;
    this._playlistFile = playlistFile;
    this._playlists = new Map();
    this._procMon = null;

    this.connected = false;
    this.state = 'stopped';
    this.volume = 70;
    this.track = null;
    this.playlist = null;
    this._pausedByGameClock = false;
    this._stopped = false;  // set by cleanup() to short-circuit racing handlers
    this._reconnecting = false;  // guards concurrent checkConnection() reconnects
    this._eventsWired = false;   // tracks per-mpd-client listener registration
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
    this._stopped = false;
    this._loadPlaylistsFromDisk();
    this._startPlaylistWatcher();
    try {
      this._mpd = await mpd2.connect({ path: this._socketPath });
      this._eventsWired = false;  // fresh client; events not yet wired
      this._wireMpdEvents();
      this.connected = true;
      registry.report('music', 'healthy', 'MPD connected');
    } catch (err) {
      this.connected = false;
      registry.report('music', 'down', `MPD connect failed: ${err.message}`);
    }
  }

  async cleanup() {
    // Set _stopped BEFORE tearing down so in-flight async handlers
    // (e.g., _handlePlayerEvent mid-await) bail out before mutating state.
    this._stopped = true;
    this._stopPlaylistWatcher();
    if (this._mpd) {
      try { await this._mpd.disconnect(); } catch (_) { /* ignore */ }
      this._mpd = null;
    }
    this._eventsWired = false;
    this.connected = false;
  }

  _loadPlaylistsFromDisk() {
    if (!this._playlistFile) return;
    try {
      const raw = fs.readFileSync(this._playlistFile, 'utf8');
      const parsed = JSON.parse(raw);
      const logger = require('../utils/logger');
      // Filter to structurally valid playlists so a single bad entry
      // doesn't poison the entire Map. Each is re-validated at loadPlaylist().
      const validPlaylists = [];
      for (const p of (parsed.playlists || [])) {
        if (!p || typeof p.id !== 'string' || !Array.isArray(p.tracks)) {
          logger.warn(`[Music] skipping invalid playlist: ${p?.id || '(no id)'}`);
          continue;
        }
        validPlaylists.push([p.id, p]);
      }
      this._playlists = new Map(validPlaylists);
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
    // Concurrency guard: serviceHealthRegistry serializes revalidation but
    // an in-flight reconnect could race with a direct caller. Without this
    // guard, two concurrent reconnects would orphan a client with active
    // listeners pointing at `this._mpd` (now the second client) and cause
    // idle events to dispatch commands on the wrong connection.
    if (this._reconnecting) return this.connected;
    // Reactive reconnect: if init() failed (e.g., MPD wasn't ready when app
    // initialized), the 15s health revalidation gives us a recovery path
    // without restarting the orchestrator.
    if (!this._mpd) {
      if (this._stopped) return false;
      this._reconnecting = true;
      try {
        const mpd2 = require('mpd2');
        this._mpd = await mpd2.connect({ path: this._socketPath });
        this._eventsWired = false;  // fresh client; events not yet wired
        this._wireMpdEvents();
        this.connected = true;
        const registry = require('./serviceHealthRegistry');
        registry.report('music', 'healthy', 'MPD reconnected');
        return true;
      } catch (_) {
        return false;
      } finally {
        this._reconnecting = false;
      }
    }
    try {
      await this._mpd.sendCommand('ping');
      return true;
    } catch (_) {
      // Connection went stale — drop the client so next checkConnection
      // attempts a fresh connect. Report 'down' so the commandExecutor
      // SERVICE_DEPENDENCIES gate rejects music:* cleanly with a service
      // error instead of letting the handler throw "not connected" mid-flight.
      try { await this._mpd.disconnect(); } catch (__) { /* ignore */ }
      this._mpd = null;
      this._eventsWired = false;
      this.connected = false;
      require('./serviceHealthRegistry').report('music', 'down', 'MPD ping failed');
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
    const str = String(s);
    // MPD's protocol is line-delimited; newlines/null bytes in a filename
    // would corrupt the command stream. There is no escape for these
    // inside a quoted string — reject at the boundary.
    if (/[\n\r\x00]/.test(str)) {
      throw new Error(`Invalid character in MPD argument: ${JSON.stringify(str)}`);
    }
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  async loadPlaylist(playlistId) {
    this._assertConnected();
    const playlist = this._playlists.get(playlistId);
    if (!playlist) throw new Error(`Unknown playlist: ${playlistId}`);

    // Defensive validation — _playlists may have been populated by a
    // hand-edited or partially-written JSON file. The PUT route validates
    // at write time but the fs.watch reload window allows briefly
    // inconsistent state to land here.
    if (!Array.isArray(playlist.tracks)) {
      throw new Error(`Playlist ${playlistId} has no tracks array`);
    }
    if (playlist.tracks.some(t => typeof t !== 'string')) {
      throw new Error(`Playlist ${playlistId} contains non-string tracks`);
    }

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

  // ── Accessors for HTTP routes (keep _mpd / _playlistFile encapsulated) ──

  /** Fetches the MPD library and returns parsed track metadata. */
  async listAllTracks() {
    this._assertConnected();
    const stdout = await this._mpd.sendCommand('listallinfo');
    return parseListAllInfo(stdout);
  }

  /**
   * Read the raw playlist file content. Throws ENOENT if the file doesn't
   * exist (caller decides how to surface that).
   */
  readPlaylistFileRaw() {
    if (!this._playlistFile) throw new Error('Playlist file not configured');
    return fs.readFileSync(this._playlistFile, 'utf8');
  }

  /** Atomically write the playlist set to disk. Body is serialized as JSON. */
  writePlaylistFile(body) {
    if (!this._playlistFile) throw new Error('Playlist file not configured');
    const tmp = `${this._playlistFile}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(body, null, 2));
    fs.renameSync(tmp, this._playlistFile);
  }

  /** True if a playlist file path is configured (regardless of file presence). */
  hasPlaylistFile() {
    return Boolean(this._playlistFile);
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
    // Idempotent per mpd2 client. Callers must reset _eventsWired = false
    // when assigning a fresh _mpd (init, reconnect). Without this guard,
    // a second call would double-register listeners and double-fire idle
    // event handlers.
    //
    // We skip MPD's `system-playlist` subsystem (fires on queue contents
    // changes — clear/add/reorder). Queue contents are mutated only by our
    // own loadPlaylist() which updates this.playlist directly, and the
    // playlist queue position (song index) is read off the player event's
    // status snapshot — no extra round-trip needed.
    if (this._eventsWired) return;
    this._mpd.on('system-player', () => { this._handlePlayerEvent().catch(this._logErr.bind(this)); });
    this._mpd.on('system-mixer',  () => { this._handleMixerEvent().catch(this._logErr.bind(this)); });
    this._eventsWired = true;
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
    if (!this._mpd || this._stopped) return;
    // mpd2 serializes commands on a single _promiseQueue (Promise.all would
    // not actually parallelize). sendCommands sends both in one command_list
    // batch = one socket round-trip, atomic.
    const [statusRaw, songRaw] = await this._mpd.sendCommands(['status', 'currentsong']);
    // Re-check after await — cleanup() may have run during the I/O window
    if (this._stopped || !this._mpd) return;
    const status = this._parseKV(statusRaw);
    const song = this._parseKV(songRaw);

    // MPD's status returns raw protocol strings (`play`/`pause`/`stop`).
    // Normalize to the canonical names that the rest of the system uses
    // (pauseForGameClock guard, frontend renderer all check === 'playing' /
    // 'paused' / 'stopped'). Falls through unchanged for any unknown value
    // so test mocks supplying canonical names directly also work.
    const newState = MPD_STATE_MAP[status.state] || status.state || 'stopped';
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

    // Track queue position from the same status snapshot — avoids a separate
    // round-trip on the system-playlist event (which we no longer subscribe to).
    if (this.playlist) {
      const queuePos = parseInt(status.song, 10);
      if (Number.isFinite(queuePos)) this.playlist.position = queuePos;
    }
  }

  async _handleMixerEvent() {
    if (!this._mpd || this._stopped) return;
    const raw = await this._mpd.sendCommand('status');
    if (this._stopped) return;
    const status = this._parseKV(raw);
    const v = parseInt(status.volume, 10);
    if (Number.isFinite(v) && v !== this.volume) {
      this.volume = v;
      this.emit('volume:changed', { volume: v });
    }
  }

  reset() {
    this.state = 'stopped';
    this.volume = 70;
    this.track = null;
    this.playlist = null;
    this._pausedByGameClock = false;
  }

  /**
   * Generate MPD config and start the supervised MPD process.
   * Returns once the ProcessMonitor has been started.
   */
  async spawnMpd() {
    if (!this._musicDir) throw new Error('musicDir not configured');
    const { buildMpdConfig } = require('./mpdConfigBuilder');
    const ProcessMonitor = require('../utils/processMonitor');
    const logger = require('../utils/logger');

    const playlistDir = path.join(this._dataDir, 'aln-mpd-playlists');
    fs.mkdirSync(playlistDir, { recursive: true });

    const cfg = buildMpdConfig({
      musicDir: this._musicDir,
      socketPath: this._socketPath,
      dbFile: path.join(this._dataDir, 'aln-mpd.db'),
      logFile: path.join(this._dataDir, 'aln-mpd.log'),
      stateFile: path.join(this._dataDir, 'aln-mpd.state'),
      pidFile: path.join(this._dataDir, 'aln-mpd-internal.pid'),
      playlistDir,
    });
    fs.writeFileSync(this._configFile, cfg);

    this._procMon = new ProcessMonitor({
      command: 'mpd',
      args: ['--no-daemon', this._configFile],
      label: 'mpd',
      pidFile: '/tmp/aln-pm-mpd.pid',
    });
    this._procMon.on('exited', ({ code, signal }) => {
      logger.warn(`[Music] MPD exited code=${code} signal=${signal}`);
      this.connected = false;
      // Drop the stale mpd2 client so the next checkConnection reconnects
      // cleanly to the respawned MPD instance.
      this._mpd = null;
      // CRITICAL: also flip the health registry — without this, the
      // commandExecutor SERVICE_DEPENDENCIES gate keeps thinking music
      // is healthy and dispatches commands to a dead service.
      require('./serviceHealthRegistry').report('music', 'down', `MPD exited code=${code} signal=${signal}`);
    });
    this._procMon.start();
  }

  /**
   * Stop the supervised MPD process. Safe to call when not spawned.
   */
  stopMpd() {
    if (this._procMon) {
      this._procMon.stop();
      this._procMon = null;
    }
  }
}

const singleton = new MusicService();
singleton.MusicService = MusicService;
singleton.parseListAllInfo = parseListAllInfo;
module.exports = singleton;
