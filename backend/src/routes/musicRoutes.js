'use strict';

const express = require('express');

function createMusicRouter({ musicService }) {
  const router = express.Router();

  router.get('/tracks', async (req, res) => {
    try {
      const tracks = await musicService.listAllTracks();
      res.json({ tracks });
    } catch (err) {
      if (/not connected/i.test(err.message)) {
        return res.status(503).json({ error: 'Music service not connected' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/playlists', (req, res) => {
    if (!musicService.hasPlaylistFile()) {
      return res.status(503).json({ error: 'Playlist file not configured' });
    }
    try {
      const raw = musicService.readPlaylistFileRaw();
      res.type('json').send(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.json({ playlists: [] });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/playlists', (req, res) => {
    if (!musicService.hasPlaylistFile()) {
      return res.status(503).json({ error: 'Playlist file not configured' });
    }
    const body = req.body;
    const err = validatePlaylistsBody(body);
    if (err) return res.status(400).json({ error: err });
    try {
      musicService.writePlaylistFile(body);
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
    // MPD's `add` command takes paths relative to music_directory. Reject
    // absolute paths and any `..` segment so we don't pass through requests
    // that could resolve outside the configured music root if MPD's own
    // safety check is ever relaxed or misconfigured.
    for (const t of p.tracks) {
      if (t.startsWith('/') || /(?:^|\/)\.\.(?:\/|$)/.test(t)) {
        return `Playlist ${p.id}: track paths must be relative with no .. segments (got: ${t})`;
      }
    }
    if (seenIds.has(p.id)) return `Duplicate playlist id: ${p.id}`;
    seenIds.add(p.id);
  }
  return null;
}

module.exports = createMusicRouter;
// Re-export from musicService for tests that still import via this path.
module.exports.parseListAllInfo = require('../services/musicService').parseListAllInfo;
