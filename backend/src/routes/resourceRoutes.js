/**
 * Resource Routes - Static resources
 * Provides token database, scoreboard HTML, and wireless asset sync endpoints.
 *
 * Asset sync (images + audio) is consumed by the ESP32 CYD scanner at boot.
 * See docs: root CLAUDE.md "deviceType Duplicate Detection" / plan
 * `/root/.claude/plans/let-s-think-about-this-flickering-bubble.md`.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const tokenService = require('../services/tokenService');
const logger = require('../utils/logger');
const { success, errors } = require('../utils/responseBuilder');

// Canonical asset roots live in the aln-memory-scanner submodule so backend
// and PWA share a single source of truth. Resolved once at module load.
const ASSET_ROOT = path.resolve(__dirname, '../../../aln-memory-scanner/assets');
const IMAGES_DIR = path.join(ASSET_ROOT, 'images');
const AUDIO_DIR = path.join(ASSET_ROOT, 'audio');
const MANIFEST_PATH = path.join(ASSET_ROOT, 'manifest.json');

// Sanitize against path traversal. Manifest uses the same character class.
const TOKEN_ID_PATTERN = /^[a-z0-9_]+$/;

// Small cache so we don't re-read the manifest file per request. Invalidated
// when the file mtime changes (the Notion sync rewrites it wholesale).
let manifestCache = null;
let manifestCacheMtime = 0;

function readManifest() {
  let stat;
  try {
    stat = fs.statSync(MANIFEST_PATH);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  const mtime = stat.mtimeMs;
  if (manifestCache && mtime === manifestCacheMtime) return manifestCache;
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  manifestCache = JSON.parse(raw);
  manifestCacheMtime = mtime;
  return manifestCache;
}

/**
 * GET /api/tokens - Token database
 * Returns raw tokens.json for scanner caching (original format)
 * Contract: openapi.yaml /api/tokens response schema
 */
router.get('/tokens', (req, res) => {
  try {
    const rawTokens = tokenService.loadRawTokens();

    success(res, {
      tokens: rawTokens,
      count: Object.keys(rawTokens).length,
      lastUpdate: new Date().toISOString()
    });
  } catch (err) {
    errors.internal(res, err.message);
  }
});

/**
 * GET /api/assets/manifest - Asset sync manifest
 * Contract: openapi.yaml /api/assets/manifest response schema
 */
router.get('/assets/manifest', (req, res) => {
  try {
    const manifest = readManifest();
    if (!manifest) {
      return errors.notFound(res,
        'Asset manifest not generated yet. Run scripts/sync_notion_to_tokens.py.');
    }
    res.json(manifest);
  } catch (err) {
    logger.error('Failed to serve asset manifest', err);
    errors.internal(res, err.message);
  }
});

/**
 * GET /api/assets/images/:file - Individual BMP
 * Contract: openapi.yaml /api/assets/images/{tokenId}.bmp
 */
router.get('/assets/images/:file', (req, res) => {
  const { file } = req.params;
  const match = /^([a-z0-9_]+)\.bmp$/i.exec(file);
  if (!match || !TOKEN_ID_PATTERN.test(match[1])) {
    return errors.validation(res,
      'Expected <tokenId>.bmp where tokenId matches [a-z0-9_]+');
  }
  const abs = path.join(IMAGES_DIR, `${match[1]}.bmp`);
  // Express sendFile handles ETag + Last-Modified + If-None-Match automatically.
  res.sendFile(abs, { headers: { 'Content-Type': 'image/bmp' } }, (err) => {
    if (err && !res.headersSent) {
      if (err.code === 'ENOENT') {
        errors.notFound(res, 'Image not found');
      } else {
        logger.error('sendFile image failed', { file, err: err.message });
        errors.internal(res, err.message);
      }
    }
  });
});

/**
 * GET /api/assets/audio/:file - Individual audio file (wav or mp3)
 * Contract: openapi.yaml /api/assets/audio/{tokenId}.{ext}
 */
router.get('/assets/audio/:file', (req, res) => {
  const { file } = req.params;
  const match = /^([a-z0-9_]+)\.(wav|mp3)$/i.exec(file);
  if (!match || !TOKEN_ID_PATTERN.test(match[1])) {
    return errors.validation(res,
      'Expected <tokenId>.(wav|mp3) where tokenId matches [a-z0-9_]+');
  }
  const ext = match[2].toLowerCase();
  const abs = path.join(AUDIO_DIR, `${match[1]}.${ext}`);
  const contentType = ext === 'wav' ? 'audio/wav' : 'audio/mpeg';
  res.sendFile(abs, { headers: { 'Content-Type': contentType } }, (err) => {
    if (err && !res.headersSent) {
      if (err.code === 'ENOENT') {
        errors.notFound(res, 'Audio not found');
      } else {
        logger.error('sendFile audio failed', { file, err: err.message });
        errors.internal(res, err.message);
      }
    }
  });
});

/**
 * GET /scoreboard - Scoreboard display
 * TV-optimized scoreboard display for Black Market mode
 */
router.get('/scoreboard', (req, res) => {
  res.sendFile('scoreboard.html', { root: './public' });
});

module.exports = router;
