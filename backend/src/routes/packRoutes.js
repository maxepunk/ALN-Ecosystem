/**
 * Pack Routes — the pack channel (Phase 3 A2)
 *
 * GET /api/pack/manifest      — the active pack's pack-manifest.json
 * GET /api/pack/files/<path>  — a single inventoried pack file
 *
 * Contract: openapi.yaml /api/pack/manifest, /api/pack/files/{filePath}.
 * Serving is whitelist-only: files/<path> serves ONLY paths present in the
 * manifest inventory (clients verify each download against the manifest
 * sha1 during staged refresh — see the standalone-pack-loading design §3).
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { errors } = require('../utils/responseBuilder');
const packService = require('../services/packService');

router.get('/pack/manifest', (req, res) => {
  try {
    const manifest = packService.getManifest();
    if (!manifest) {
      return errors.notFound(res,
        'No pack manifest in the active pack directory (pre-pack checkout).');
    }
    res.json(manifest);
  } catch (err) {
    logger.error('Failed to serve pack manifest', err);
    errors.internal(res, err.message);
  }
});

// Express 4 wildcard: req.params[0] carries the full remainder including '/'
router.get('/pack/files/*', (req, res) => {
  try {
    const relPath = req.params[0];
    const abs = packService.resolvePackFile(relPath);
    if (!abs) {
      return errors.notFound(res, `Not in the active pack inventory: ${relPath}`);
    }
    res.sendFile(abs);
  } catch (err) {
    logger.error('Failed to serve pack file', err);
    errors.internal(res, err.message);
  }
});

module.exports = router;
