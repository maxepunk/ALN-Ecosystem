#!/usr/bin/env node
/**
 * validate-pack.js <packDir> — run the ENGINE'S OWN activation gate
 * against an arbitrary pack directory (B0 BS.1, design r2 D-B0.1r2).
 *
 * The child-process seam: callers (the config-tool's publish step, a
 * curious human) spawn this instead of importing packService — the gate
 * runs with the engine's real module graph in an isolated process, so
 * validation is parity-by-construction with boot (it IS activatePack),
 * and packService's module state, logger side effects, and dotenv
 * loading never leak into the calling tool (red-team A1).
 *
 * stdout: one JSON verdict {ok, packId, version, contentHash, problems}.
 * exit 0 = gate passed (a manifest-less dir passes with null identity —
 * the engine's packless posture; publish callers must refuse null).
 * exit 1 = the gate REFUSED (problems carries the engine's own text).
 * exit 2 = runner misuse (missing/nonexistent directory).
 */

const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  process.stderr.write(JSON.stringify({ error: 'usage: validate-pack.js <packDir> (directory must exist)' }) + '\n');
  process.exit(2);
}

// The gate resolves its directory through the same PACK_PATH seam the
// harness uses — set BEFORE the service loads. Logger noise must stay
// off stdout: the verdict JSON is this process's ONLY stdout line
// (winston's console transport would otherwise interleave with it).
process.env.PACK_PATH = path.resolve(dir);
process.env.LOG_LEVEL = 'error';

const packService = require('../src/services/packService');

let verdict;
try {
  packService.activatePack();
  const info = packService.getActivePackInfo();
  verdict = {
    ok: true,
    packId: info ? info.packId : null,
    version: info ? info.version : null,
    contentHash: info ? info.contentHash : null,
    problems: [],
  };
} catch (err) {
  // activatePack throws ONE error whose message carries the gate's
  // problem list — split it back into lines for machine consumption,
  // preserving the engine's own wording verbatim.
  const lines = String(err.message).split('\n').map((l) => l.trim()).filter(Boolean);
  verdict = { ok: false, packId: null, version: null, contentHash: null, problems: lines };
}

process.stdout.write(JSON.stringify(verdict) + '\n');
process.exit(verdict.ok ? 0 : 1);
