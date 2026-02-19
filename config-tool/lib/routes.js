'use strict';
const express = require('express');
const multer = require('multer');
const path = require('path');

function createRouter(configManager) {
  const router = express.Router();

  // -- Config CRUD --

  router.get('/config', (req, res) => {
    try {
      res.json(configManager.readAll());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/config/env', (req, res) => {
    try {
      configManager.writeEnvValues(req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/config/scoring', (req, res) => {
    try {
      configManager.writeScoring(req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/config/cues', (req, res) => {
    try {
      configManager.writeCues(req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/config/routing', (req, res) => {
    try {
      configManager.writeRouting(req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
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

  router.get('/assets/sounds', (req, res) => {
    try {
      const sounds = configManager.listSounds();
      const cues = configManager.readAll().cues;
      const usage = buildAssetUsageMap(cues, 'sound:play', 'file');
      res.json(sounds.map(s => ({ ...s, usedBy: usage[s.name] || [] })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/assets/videos', (req, res) => {
    try {
      const videos = configManager.listVideos();
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
      res.json({ success: true, preset });
    } catch (err) {
      res.status(500).json({ error: err.message });
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
      res.json(data);
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
      const filename = configManager.importPreset(data);
      res.json({ success: true, filename });
    } catch (err) {
      res.status(400).json({ error: err.message });
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
