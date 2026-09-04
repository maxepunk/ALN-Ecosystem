'use strict';
const express = require('express');
const multer = require('multer');
const path = require('path');
const { ValidationError } = require('./validators');
const { maskSecrets } = require('./secrets');
const { ConfigManager } = require('./configManager');
const { publishDraft } = require('./publish');
// The engine's cue vocabulary — dependency-free by design (the
// configManager import precedent, D-4.7c).
const cueValidation = require('../../backend/src/gameRules/cueValidation');

// Map errors to HTTP: schema violations are the client's fault (400 with
// details, F-TOOL-04); everything else stays a 500.
function sendError(res, err) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, details: err.details });
  }
  res.status(500).json({ error: err.message });
}

function createRouter(configManager, { draftStore, runnerPath, getOrchestratorToken } = {}) {
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

  // PACK content is draft-edited now (B0 BS.2, D-B0.1r2): the live-pack
  // write routes REFUSE with guidance. The ConfigManager writers survive
  // for draft-bound instances (below) and preset load (presets stay
  // untouched by ruling — C1 replaces them).
  const DRAFT_REFUSAL =
    'pack content is edited through drafts now: POST /api/drafts, edit the ' +
    'draft, then POST /api/drafts/:id/publish';

  router.put('/config/scoring', (req, res) => {
    res.status(409).json({ error: DRAFT_REFUSAL });
  });

  router.put('/config/cues', (req, res) => {
    res.status(409).json({ error: DRAFT_REFUSAL });
  });

  router.put('/config/routing', (req, res) => {
    try {
      configManager.writeRouting(req.body);
      res.json({ success: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  // -- Drafts (B0 BS.2, D-B0.1r2) --
  // Editing always targets a draft; publish is the one landing step.
  // Mounted only when the server wires a DraftStore.

  if (draftStore) {
    // A ConfigManager bound INTO a draft's working copy: the same
    // validated pack writers (scoring merge, cues gate), re-pointed.
    // Venue paths (env/routing/assets) stay on the live instance and
    // are never reachable through the draft surface.
    const draftCM = (draftId) => new ConfigManager({
      ...configManager.paths,
      gamePath: path.join(draftStore.packDir(draftId), 'game.json'),
      cuesPath: path.join(draftStore.packDir(draftId), 'cues.json'),
      tokensPath: path.join(draftStore.packDir(draftId), 'tokens.json'),
    });

    const withDraft = (req, res, fn) => {
      const draft = draftStore.getDraft(req.params.id);
      if (!draft) return res.status(404).json({ error: `unknown draft: ${req.params.id}` });
      return fn(draft);
    };

    router.get('/drafts', (req, res) => {
      try {
        res.json(draftStore.listDrafts());
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    router.post('/drafts', (req, res) => {
      try {
        res.json({ success: true, draft: draftStore.createDraft() });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    router.get('/drafts/:id', (req, res) => {
      withDraft(req, res, (draft) => res.json(draft));
    });

    router.delete('/drafts/:id', (req, res) => {
      withDraft(req, res, () => {
        draftStore.deleteDraft(req.params.id);
        res.json({ success: true });
      });
    });

    router.get('/drafts/:id/config', (req, res) => {
      withDraft(req, res, () => {
        try {
          res.json(draftCM(req.params.id).readPackContent());
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });
    });

    router.put('/drafts/:id/scoring', (req, res) => {
      withDraft(req, res, () => {
        try {
          draftCM(req.params.id).writeScoring(req.body);
          draftStore.touch(req.params.id);
          res.json({ success: true });
        } catch (err) {
          sendError(res, err);
        }
      });
    });

    router.put('/drafts/:id/cues', (req, res) => {
      withDraft(req, res, () => {
        try {
          draftCM(req.params.id).writeCues(req.body);
          draftStore.touch(req.params.id);
          res.json({ success: true });
        } catch (err) {
          sendError(res, err);
        }
      });
    });

    // strings.json / theme.json: the store is their FIRST writer
    // (D-B0.4 — no live writer exists; the pages build the editors).
    router.get('/drafts/:id/files/:name', (req, res) => {
      withDraft(req, res, () => {
        try {
          res.json(draftStore.readDraftFile(req.params.id, req.params.name));
        } catch (err) {
          res.status(400).json({ error: err.message });
        }
      });
    });

    router.put('/drafts/:id/files/:name', (req, res) => {
      withDraft(req, res, () => {
        try {
          draftStore.writeDraftFile(req.params.id, req.params.name, req.body);
          res.json({ success: true });
        } catch (err) {
          res.status(400).json({ error: err.message });
        }
      });
    });

    router.post('/drafts/:id/publish', (req, res) => {
      withDraft(req, res, async () => {
        try {
          const entry = await publishDraft(draftStore, req.params.id, { runnerPath });
          res.json({ success: true, publish: entry });
        } catch (err) {
          // Q11(a) conflicts, gate refusals, and the mutex all REFUSE —
          // conflict semantics on the wire, mapped by TYPE (err.refused),
          // never by matching message prose.
          res.status(err.refused ? 409 : 500).json({ error: err.message });
        }
      });
    });
  }

  // -- Vocabulary (B0 BS.3, D1) --
  // The engine's cue-authoring vocabulary, from the SAME dependency-free
  // module the activation gate validates against (the cueValidation
  // import precedent above) — one source, zero drift, and authoring
  // works with the orchestrator down. The backend serves the identical
  // payload at its own /api/vocabulary (BS.1).

  router.get('/vocabulary', (req, res) => {
    res.json({
      triggerEvents: cueValidation.CUE_TRIGGER_EVENTS,
      conditionOperators: cueValidation.CONDITION_OP_NAMES,
      actions: cueValidation.CUE_ACTIONS,
      tokenDerivedTriggerEvents: cueValidation.TOKEN_DERIVED_TRIGGER_EVENTS,
    });
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
      // Cues are pack content, not preset state (A3 slice 4, D-4.7c) — no
      // longer required here. An older export that still carries a `cues`
      // key is accepted (and ignored — see configManager.loadPreset).
      if (!data.name || !data.env || !data.scoringConfig || !data.routing) {
        return res.status(400).json({ error: 'Invalid preset format. Required: name, env, scoringConfig, routing' });
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
      // The backend PUT is show-control gated (B0 BS.3 enforcement
      // flip): attach the SERVER-HELD orchestrator token from login —
      // the browser never carries it. Without one (orchestrator was
      // down at login) the backend's 401 surfaces to the SPA.
      const orchToken = getOrchestratorToken ? getOrchestratorToken() : null;
      const r = await fetch(`${ORCHESTRATOR_URL}/api/music/playlists`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(orchToken ? { Authorization: `Bearer ${orchToken}` } : {}),
        },
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
  // Object.create(null): the file name is pack-authored and keys the map,
  // so a cue naming a file '__proto__' / 'constructor' would resolve
  // usage[file] to Object.prototype (truthy) and then throw on .push
  // (S6 review, F7-sec — a null-prototype map has no such members).
  const usage = Object.create(null);
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
