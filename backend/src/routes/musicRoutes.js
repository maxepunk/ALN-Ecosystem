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

  return router;
}

module.exports = createMusicRouter;
module.exports.parseListAllInfo = parseListAllInfo;
