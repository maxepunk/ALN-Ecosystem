'use strict';

const express = require('express');
const fs = require('fs');

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

function createMusicRouter({ musicService }) {
  const router = express.Router();

  router.get('/tracks', async (req, res) => {
    if (!musicService._mpd) {
      return res.status(503).json({ error: 'Music service not connected' });
    }
    try {
      const stdout = await musicService._mpd.sendCommand('listallinfo');
      res.json({ tracks: parseListAllInfo(stdout) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/playlists', (req, res) => {
    if (!musicService._playlistFile) {
      return res.status(503).json({ error: 'Playlist file not configured' });
    }
    try {
      const raw = fs.readFileSync(musicService._playlistFile, 'utf8');
      res.type('json').send(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.json({ playlists: [] });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/playlists', (req, res) => {
    if (!musicService._playlistFile) {
      return res.status(503).json({ error: 'Playlist file not configured' });
    }
    const body = req.body;
    const err = validatePlaylistsBody(body);
    if (err) return res.status(400).json({ error: err });
    try {
      const target = musicService._playlistFile;
      const tmp = `${target}.tmp.${process.pid}`;
      fs.writeFileSync(tmp, JSON.stringify(body, null, 2));
      fs.renameSync(tmp, target);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

function validatePlaylistsBody(body) {
  if (!body || !Array.isArray(body.playlists)) return 'Expected { playlists: [...] }';
  const seenIds = new Set();
  for (const p of body.playlists) {
    if (typeof p.id !== 'string' || !p.id) return 'Each playlist needs a non-empty id';
    if (typeof p.name !== 'string') return `Playlist ${p.id}: name must be a string`;
    if (typeof p.shuffle !== 'boolean') return `Playlist ${p.id}: shuffle must be boolean`;
    if (typeof p.loop !== 'boolean') return `Playlist ${p.id}: loop must be boolean`;
    if (typeof p.crossfadeMs !== 'number' || p.crossfadeMs < 0 || p.crossfadeMs > 5000) {
      return `Playlist ${p.id}: crossfadeMs must be 0-5000`;
    }
    if (!Array.isArray(p.tracks) || p.tracks.some(t => typeof t !== 'string')) {
      return `Playlist ${p.id}: tracks must be an array of strings`;
    }
    if (seenIds.has(p.id)) return `Duplicate playlist id: ${p.id}`;
    seenIds.add(p.id);
  }
  return null;
}

module.exports = createMusicRouter;
module.exports.parseListAllInfo = parseListAllInfo;
