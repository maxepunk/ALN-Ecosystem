'use strict';
const express = require('express');
const path = require('path');
const { ConfigManager } = require('./lib/configManager');
const { DraftStore } = require('./lib/draftStore');
const { createRouter } = require('./lib/routes');

const app = express();
const PORT = process.env.CONFIG_PORT || 9000;
// Pre-show tool posture (E7): bind loopback by default. The venue LAN is the
// PLAYER network — the tool has no auth, so exposing it requires an explicit
// opt-in via CONFIG_TOOL_HOST (see README "Security Notes").
const HOST = process.env.CONFIG_TOOL_HOST || '127.0.0.1';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const configManager = new ConfigManager();

// Pack drafts (B0 BS.2, D-B0.1r2): tool-private working copies of the
// live pack. Editing targets drafts; publish is the one landing step,
// gated by the engine's own activation gate (the child-process runner).
const draftStore = new DraftStore({
  rootDir: path.join(__dirname, 'data', 'drafts'),
  store: 'pack',
  sourceDir: path.dirname(configManager.paths.gamePath),
});
const runnerPath = path.resolve(__dirname, '../backend/scripts/validate-pack.js');

// Static file serving for asset preview
app.use('/audio', express.static(configManager.paths.soundsDir));
app.use('/video', express.static(configManager.paths.videosDir));

app.use('/api', createRouter(configManager, { draftStore, runnerPath }));

// SPA fallback — exclude API paths so mistyped API routes get proper 404s
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`ALN Config Tool: http://${HOST}:${PORT}`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    console.warn(
      'WARNING: config tool is exposed beyond localhost (no authentication). ' +
      'This is a pre-show tool — stop it before doors open.'
    );
  }
});
