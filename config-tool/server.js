'use strict';
const express = require('express');
const path = require('path');
const { ConfigManager } = require('./lib/configManager');
const { createRouter } = require('./lib/routes');

const app = express();
const PORT = process.env.CONFIG_PORT || 9000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const configManager = new ConfigManager();

// Static file serving for asset preview
app.use('/audio', express.static(configManager.paths.soundsDir));
app.use('/video', express.static(configManager.paths.videosDir));

app.use('/api', createRouter(configManager));

// SPA fallback — exclude API paths so mistyped API routes get proper 404s
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ALN Config Tool: http://localhost:${PORT}`);
});
