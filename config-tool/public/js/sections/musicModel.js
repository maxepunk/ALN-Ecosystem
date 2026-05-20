/**
 * MusicModel — Pure playlist state management for the config-tool Music section.
 *
 * No DOM, no fetch. Wraps an array of playlists with CRUD semantics so the
 * rendering layer stays thin and this logic is testable under node:test.
 *
 * Shape mirrors backend/config/music-playlists.json:
 *   { id, name, shuffle, loop, crossfadeMs, tracks: [filename, ...] }
 */

const CROSSFADE_MIN = 0;
const CROSSFADE_MAX = 5000;
const ID_MAX_LEN = 40;

function _slug(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ID_MAX_LEN)
    .replace(/-+$/, '');  // re-trim in case slice() left a trailing dash
}

export class MusicModel {
  constructor() {
    this._playlists = [];
    this._tracks = [];
  }

  setPlaylists(arr) {
    this._playlists = JSON.parse(JSON.stringify(arr || []));
  }

  setTracks(arr) {
    this._tracks = JSON.parse(JSON.stringify(arr || []));
  }

  getPlaylists() {
    return JSON.parse(JSON.stringify(this._playlists));
  }

  getTracks() {
    return JSON.parse(JSON.stringify(this._tracks));
  }

  getPlaylist(id) {
    const pl = this._playlists.find(p => p.id === id);
    return pl ? JSON.parse(JSON.stringify(pl)) : null;
  }

  createPlaylist(name) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('Playlist name is required');
    }
    const id = _slug(name);
    if (!id) throw new Error('Playlist name produces empty id');
    if (this._playlists.some(p => p.id === id)) {
      throw new Error(`Playlist id already exists: ${id}`);
    }
    const playlist = {
      id,
      name: name.trim(),
      shuffle: false,
      loop: true,
      crossfadeMs: 2000,
      tracks: [],
    };
    this._playlists.push(playlist);
    return JSON.parse(JSON.stringify(playlist));
  }

  deletePlaylist(id) {
    const i = this._playlists.findIndex(p => p.id === id);
    if (i === -1) return false;
    this._playlists.splice(i, 1);
    return true;
  }

  addTrack(playlistId, filename) {
    const pl = this._playlists.find(p => p.id === playlistId);
    if (!pl) throw new Error(`Unknown playlist: ${playlistId}`);
    pl.tracks.push(filename);
  }

  removeTrack(playlistId, index) {
    const pl = this._playlists.find(p => p.id === playlistId);
    if (!pl) throw new Error(`Unknown playlist: ${playlistId}`);
    if (index < 0 || index >= pl.tracks.length) return;
    pl.tracks.splice(index, 1);
  }

  moveTrack(playlistId, fromIndex, toIndex) {
    const pl = this._playlists.find(p => p.id === playlistId);
    if (!pl) throw new Error(`Unknown playlist: ${playlistId}`);
    if (fromIndex < 0 || fromIndex >= pl.tracks.length) return;
    const [item] = pl.tracks.splice(fromIndex, 1);
    const target = Math.max(0, Math.min(toIndex, pl.tracks.length));
    pl.tracks.splice(target, 0, item);
  }

  setShuffle(playlistId, enabled) {
    const pl = this._playlists.find(p => p.id === playlistId);
    if (pl) pl.shuffle = !!enabled;
  }

  setLoop(playlistId, enabled) {
    const pl = this._playlists.find(p => p.id === playlistId);
    if (pl) pl.loop = !!enabled;
  }

  setCrossfadeMs(playlistId, ms) {
    const pl = this._playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const v = Number(ms);
    pl.crossfadeMs = Math.max(CROSSFADE_MIN, Math.min(CROSSFADE_MAX, Number.isFinite(v) ? v : 0));
  }

  toJSON() {
    return { playlists: JSON.parse(JSON.stringify(this._playlists)) };
  }
}

export default MusicModel;
