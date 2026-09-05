/**
 * Resource Routes - Static resources
 * Provides token database, scoreboard HTML, and wireless asset sync endpoints.
 *
 * Asset sync (images + audio) is consumed by the ESP32 CYD scanner at boot.
 * See root CLAUDE.md "ESP32 Asset Sync Issues" debug section.
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
    } else if (!err && res.statusCode === 304) {
      logger.debug('asset image 304', { file });
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
    } else if (!err && res.statusCode === 304) {
      logger.debug('asset audio 304', { file });
    }
  });
});

/**
 * Render scoreboard.html with the window marker injected (A3 slice 3a
 * pre-fix 1): the %%WINDOW_MARKER%% placeholder in the page <title>
 * becomes config.display.scoreboardWindowMarker — the SAME value
 * displayDriver's xdotool search uses to find the kiosk window. Served
 * fresh per request (page loads are rare; no cache needed).
 * @returns {string} rendered HTML
 */
// JSON.stringify does NOT escape '<' — a value containing '</script>'
// would close the served page's inline script block and inject markup
// (the pack strings are semi-trusted pack data; doctrine treats them
// defensively). < (and the JS-line-separator pair) are equivalent
// inside a JSON string literal, so the parsed content is unchanged.
function jsonForScript(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

/**
 * GET /api/vocabulary — the engine's cue-authoring vocabulary
 * (B0 BS.1; program Track B "backend-served trigger/action
 * vocabulary"). Served from the SAME exported tables the activation
 * gate validates cues against — one source, zero drift; the
 * config-tool's editors re-source from here instead of hand-mirroring.
 * Read-only engine metadata, no auth (the /api/tokens posture).
 */
router.get('/vocabulary', (req, res) => {
  const cueValidation = require('../gameRules/cueValidation');
  res.json({
    triggerEvents: cueValidation.CUE_TRIGGER_EVENTS,
    conditionOperators: cueValidation.CONDITION_OP_NAMES,
    actions: cueValidation.CUE_ACTIONS,
    tokenDerivedTriggerEvents: cueValidation.TOKEN_DERIVED_TRIGGER_EVENTS,
  });
});

function renderScoreboardHtml() {
  const config = require('../config');
  const packService = require('../services/packService');
  const html = fs.readFileSync(path.join(__dirname, '../../public/scoreboard.html'), 'utf8');
  // ONE pass, FUNCTION replacements — both halves are load-bearing.
  // Function form guards GetSubstitution ($$, $&, $' and $` are active
  // patterns in string replacements — a password like p@$$w0rd was
  // served mangled and $' splices the rest of the file). The single
  // pass guards ORDERING (theme-unit close review SEC-1): replaced
  // output is never rescanned, so pack-controlled text can never
  // become a substitution pattern for a later placeholder — chained
  // replaceAll passes let a gate-legal strings leaf carrying the
  // literal '%%PACK_THEME%%' get theme JSON injected INSIDE it,
  // breaking the page script's parse at serve time.
  return html.replace(
    /%%WINDOW_MARKER%%|'%%OBSERVE_TOKEN%%'|'%%PACK_STRINGS%%'|'%%PACK_THEME%%'/g,
    (m) => {
      switch (m) {
        // Shared xdotool window marker (slice 3a pre-fix 1).
        case '%%WINDOW_MARKER%%':
          return config.display.scoreboardWindowMarker;
        // Per-serve OBSERVE token (B0 BS.1 slice 5 — replaces the
        // injected ADMIN_PASSWORD): device/display class, functions
        // exactly ['observe'], its own store — every HTTP gate refuses
        // it and the WS accepts it read-only. A live credential leaves
        // every venue TV's page source.
        case "'%%OBSERVE_TOKEN%%'":
          return jsonForScript(require('../middleware/auth').generateObserveToken('SCOREBOARD'));
        // Pack-declared display strings (A3 slice 3a): the activation
        // snapshot (or null — page falls back to baked wording per key).
        case "'%%PACK_STRINGS%%'":
          return jsonForScript(packService.getStrings());
        // Pack-declared visual identity (theme unit ST.3): the
        // activation snapshot (or null — baked palette stands).
        default:
          return jsonForScript(packService.getTheme());
      }
    });
}

/**
 * GET /scoreboard - Scoreboard display
 * TV-optimized scoreboard display for Black Market mode
 */
// BOTH paths: the express.static('public') mount would otherwise serve
// the RAW file (placeholders unreplaced — no credential, no window
// marker) at /scoreboard.html. Routes mount before static in app.js.
router.get(['/scoreboard', '/scoreboard.html'], (req, res) => {
  res.type('html').send(renderScoreboardHtml());
});

module.exports = router;
module.exports.renderScoreboardHtml = renderScoreboardHtml;
