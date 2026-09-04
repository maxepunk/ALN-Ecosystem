'use strict';
const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { ConfigManager } = require('./lib/configManager');
const { DraftStore } = require('./lib/draftStore');
const { ToolAuth } = require('./lib/toolAuth');
const { createRouter } = require('./lib/routes');
const { readEnv } = require('./lib/envParser');

const app = express();
const PORT = process.env.CONFIG_PORT || 9000;
// Pre-show tool posture (E7): bind loopback by default; exposing beyond
// requires an explicit opt-in via CONFIG_TOOL_HOST (see README
// "Security Notes"). Since BS.3 the tool HAS auth — beyond loopback,
// EVERY route requires it (see the enforce mount below).
const HOST = process.env.CONFIG_TOOL_HOST || '127.0.0.1';
const boundBeyondLoopback = HOST !== '127.0.0.1' && HOST !== 'localhost';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Test-harness path seams (B0 BS.3, the backend PACK_PATH precedent —
// distinct names so the D-4.7c "this tool never sees PACK_PATH" ruling
// stays exact): the Playwright smokes run the REAL server against a
// fixture tree instead of the checked-in pack. Unset in production.
const HARNESS_PACK_DIR = process.env.CONFIG_TOOL_PACK_DIR || null;
const HARNESS_DATA_DIR = process.env.CONFIG_TOOL_DATA_DIR || null;
const configManager = new ConfigManager({
  ...(process.env.CONFIG_TOOL_ENV_PATH ? { envPath: process.env.CONFIG_TOOL_ENV_PATH } : {}),
  ...(HARNESS_PACK_DIR ? {
    gamePath: path.join(HARNESS_PACK_DIR, 'game.json'),
    cuesPath: path.join(HARNESS_PACK_DIR, 'cues.json'),
    tokensPath: path.join(HARNESS_PACK_DIR, 'tokens.json'),
  } : {}),
});

// Pack drafts (B0 BS.2, D-B0.1r2): tool-private working copies of the
// live pack. Editing targets drafts; publish is the one landing step,
// gated by the engine's own activation gate (the child-process runner).
const draftStore = new DraftStore({
  rootDir: path.join(HARNESS_DATA_DIR || path.join(__dirname, 'data'), 'drafts'),
  store: 'pack',
  sourceDir: path.dirname(configManager.paths.gamePath),
});
const runnerPath = path.resolve(__dirname, '../backend/scripts/validate-pack.js');

// Tool auth (B0 BS.3, D-B0.3r2): password → operator token
// (aud 'config-tool'), from the SAME backend/.env the backend reads.
// Login stays open; mutating routes require the token ALWAYS, reads
// too when bound beyond loopback.
const toolAuth = new ToolAuth({
  envPath: configManager.paths.envPath,
  // Login also obtains the ORCHESTRATOR-aud half of the pair (for the
  // gated music-playlist proxy) — same URL source as the proxy itself.
  orchestratorUrl: process.env.ORCHESTRATOR_URL || 'http://localhost:3000',
});

// Static file serving for asset preview
app.use('/audio', express.static(configManager.paths.soundsDir));
app.use('/video', express.static(configManager.paths.videosDir));

app.post('/api/auth/login', toolAuth.loginHandler());
app.use('/api', toolAuth.enforce({ requireAllRoutes: boundBeyondLoopback }));
app.use('/api', createRouter(configManager, {
  draftStore,
  runnerPath,
  getOrchestratorToken: () => toolAuth.getOrchestratorToken(),
}));

// SPA fallback — exclude API paths so mistyped API routes get proper 404s
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * HTTPS (B0 BS.3, D-B0.2r2 — "the tool serves HTTPS, the backend
 * pattern"): reuse the orchestrator's self-signed pair, resolved from
 * the same backend/.env (SSL_*_PATH are backend-relative there). A
 * missing pair falls back to HTTP with a loud warning rather than
 * refusing to serve — the tool must still work on a box that never
 * generated certs.
 */
function loadSslPair() {
  try {
    const env = readEnv(configManager.paths.envPath).values;
    const backendDir = path.dirname(configManager.paths.envPath);
    const keyPath = path.resolve(backendDir, env.SSL_KEY_PATH || './ssl/key.pem');
    const certPath = path.resolve(backendDir, env.SSL_CERT_PATH || './ssl/cert.pem');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    }
  } catch { /* fall through to HTTP */ }
  return null;
}

const ssl = loadSslPair();
const server = ssl ? https.createServer(ssl, app) : app;
const scheme = ssl ? 'https' : 'http';

server.listen(PORT, HOST, () => {
  console.log(`ALN Config Tool: ${scheme}://${HOST}:${PORT}`);
  if (!ssl) {
    console.warn(
      'WARNING: no SSL certificate found (backend ssl/key.pem + cert.pem) — ' +
      'serving plain HTTP. Generate the backend certs to serve HTTPS.'
    );
  }
  if (boundBeyondLoopback) {
    console.warn(
      'Config tool is exposed beyond localhost — ALL routes require login.'
    );
  }
});
