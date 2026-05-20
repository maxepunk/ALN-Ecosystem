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
}

const singleton = new MusicService();
singleton.MusicService = MusicService;
module.exports = singleton;
