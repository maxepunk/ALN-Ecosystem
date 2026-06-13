'use strict';
const express = require('express');
const multer = require('multer');
const path = require('path');
const { ValidationError } = require('./validators');
const { maskSecrets } = require('./secrets');

// Map errors to HTTP: schema violations are the client's fault (400 with
// details, F-TOOL-04); everything else stays a 500.
function sendError(res, err) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, details: err.details });
  }
  res.status(500).json({ error: err.message });
}

function createRouter(configManager) {
  const router = express.Router();

  // -- Config CRUD --

  router.get('/config', (req, res) => {
    try {
      const config = configManager.readAll();
      // Never serve secret values to the browser (E7). Writes accept new
      // values; the sentinel round-trips as "unchanged".
      res.json({ ...config, env: maskSecrets(config.env) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/config/env', (req, res) => {
    try {
      configManager.writeEnvValues(req.body);
      res.json({ success: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.put('/config/scoring', (req, res) => {
    try {
      configManager.writeScoring(req.body);
      res.json({ success: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.put('/config/cues', (req, res) => {
    try {
      configManager.writeCues(req.body);
      res.json({ success: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.put('/config/routing', (req, res) => {
    try {
      configManager.writeRouting(req.body);
      res.json({ success: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  // -- Tokens (read-only) --

  router.get('/tokens', (req, res) => {
    try {
      res.json(configManager.readTokens());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -- Assets --

  router.get('/assets/sounds', async (req, res) => {
    try {
      const sounds = await configManager.listSounds();
      const cues = configManager.readAll().cues;
      const usage = buildAssetUsageMap(cues, 'sound:play', 'file');
      res.json(sounds.map(s => ({ ...s, usedBy: usage[s.name] || [] })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/assets/videos', async (req, res) => {
    try {
      const videos = await configManager.listVideos();
      const cues = configManager.readAll().cues;
      const usage = buildAssetUsageMap(cues, 'video:queue:add', 'videoFile');
      res.json(videos.map(v => ({ ...v, usedBy: usage[v.name] || [] })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // File upload helper
  function createUpload(type, extensions, maxSize) {
    return multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, configManager.getAssetUploadDir(type)),
        filename: (req, file, cb) => cb(null, path.basename(file.originalname)),
      }),
      fileFilter: (req, file, cb) => {
        cb(null, extensions.includes(path.extname(file.originalname).toLowerCase()));
      },
      limits: { fileSize: maxSize },
    });
  }

  const soundUpload = createUpload('sounds', ['.wav', '.mp3'], 50 * 1024 * 1024);
  const videoUpload = createUpload('videos', ['.mp4'], 2 * 1024 * 1024 * 1024);

  router.post('/assets/sounds', soundUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Invalid file type. Accepted: .wav, .mp3' });
    res.json({ success: true, filename: req.file.filename });
  });

  router.post('/assets/videos', videoUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Invalid file type. Accepted: .mp4' });
    res.json({ success: true, filename: req.file.filename });
  });

  router.delete('/assets/:type/:filename', (req, res) => {
    const { type, filename } = req.params;
    if (type !== 'sounds' && type !== 'videos') {
      return res.status(400).json({ error: 'type must be "sounds" or "videos"' });
    }
    try {
      configManager.deleteAsset(type, filename);
      res.json({ success: true });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  // -- Lighting Scenes (from Home Assistant) --

  router.get('/scenes', async (req, res) => {
    try {
      const env = configManager.readAll().env;
      const url = env.HOME_ASSISTANT_URL;
      const token = env.HOME_ASSISTANT_TOKEN;
      if (!url || !token) {
        return res.json([]);
      }
      const response = await fetch(`${url}/api/states`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return res.json([]);
      const states = await response.json();
      const scenes = states
        .filter(e => e.entity_id.startsWith('scene.'))
        .map(e => ({ id: e.entity_id, name: e.attributes.friendly_name }));
      res.json(scenes);
    } catch {
      res.json([]); // HA unreachable — return empty, frontend falls back to text input
    }
  });

  // -- Presets --

  router.get('/presets', (req, res) => {
    try {
      res.json(configManager.listPresets());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/presets', (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      const filename = configManager.savePreset(name, description || '');
      res.json({ success: true, filename });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/presets/:filename/load', (req, res) => {
    try {
      const preset = configManager.loadPreset(req.params.filename);
      // The SPA ignores this body and re-fetches GET /api/config (masked);
      // mask here too so the load path can't hand out raw secrets (E7).
      res.json({ success: true, preset: { ...preset, env: maskSecrets(preset.env || {}) } });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete('/presets/:filename', (req, res) => {
    try {
      configManager.deletePreset(req.params.filename);
      res.json({ success: true });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  router.get('/presets/:filename/export', (req, res) => {
    try {
      const data = configManager.exportPreset(req.params.filename);
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
      // Exported files leave the server — mask secrets exactly like
      // GET /api/config (E7). On-disk presets stay raw (needed for restore).
      // Re-importing a masked export is safe: writeEnvValues skips
      // MASK_SENTINEL values on load, so stored secrets survive the
      // masked-export → import → load round-trip unchanged.
      res.json({ ...data, env: maskSecrets(data.env || {}) });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  const presetImportUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });
  router.post('/presets/import', presetImportUpload.single('file'), (req, res) => {
    try {
      const data = JSON.parse(req.file.buffer.toString('utf8'));
      if (!data.name || !data.env || !data.scoringConfig || !data.cues || !data.routing) {
        return res.status(400).json({ error: 'Invalid preset format. Required: name, env, scoringConfig, cues, routing' });
      }
      // Deep section validation happens in importPreset (same validators as
      // direct writes); ValidationError surfaces here as 400 with details.
      const filename = configManager.importPreset(data);
      res.json({ success: true, filename });
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message, details: err.details });
      }
      res.status(400).json({ error: err.message });
    }
  });

  // -- Music (proxy to orchestrator) --
  // The orchestrator owns the MPD socket and the canonical playlist file.
  // This proxy exists so the SPA can stay on its own origin (port 9000) and
  // not depend on CORS at the orchestrator.
  const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3000';

  router.get('/music/tracks', async (req, res) => {
    try {
      const r = await fetch(`${ORCHESTRATOR_URL}/api/music/tracks`, {
        signal: AbortSignal.timeout(5000),
      });
      const text = await r.text();
      res.status(r.status).type('json').send(text);
    } catch (err) {
      res.status(502).json({ error: `Orchestrator unreachable: ${err.message}` });
    }
  });

  router.get('/music/playlists', async (req, res) => {
    try {
      const r = await fetch(`${ORCHESTRATOR_URL}/api/music/playlists`, {
        signal: AbortSignal.timeout(5000),
      });
      const text = await r.text();
      res.status(r.status).type('json').send(text);
    } catch (err) {
      res.status(502).json({ error: `Orchestrator unreachable: ${err.message}` });
    }
  });

  router.put('/music/playlists', async (req, res) => {
    try {
      const r = await fetch(`${ORCHESTRATOR_URL}/api/music/playlists`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(5000),
      });
      const text = await r.text();
      res.status(r.status).type('json').send(text);
    } catch (err) {
      res.status(502).json({ error: `Orchestrator unreachable: ${err.message}` });
    }
  });

  return router;
}

// -- Helpers --

function buildAssetUsageMap(cuesData, action, payloadKey) {
  const usage = {};
  for (const cue of cuesData.cues || []) {
    for (const cmd of cue.commands || cue.timeline || []) {
      const file = cmd.action === action && cmd.payload?.[payloadKey];
      if (file) {
        if (!usage[file]) usage[file] = [];
        usage[file].push(cue.label || cue.id);
      }
    }
  }
  return usage;
}

module.exports = { createRouter };
