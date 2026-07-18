#!/usr/bin/env node
/**
 * build-pack-manifest.js — (re)generate a pack's pack-manifest.json
 *
 * Usage: node scripts/build-pack-manifest.js <packDir>
 *
 * Machine-maintains the INVENTORY half of the manifest (files[] with
 * sha1+size, and contentHash over the sorted "path:sha1" lines) while
 * PRESERVING the hand-authored half (packId, version, engine, hardware,
 * createdAt) from an existing manifest. A pack with no manifest yet gets a
 * skeleton with TODO hardware that fails schema validation until authored —
 * intentional: the hardware section is a design statement, never derivable.
 *
 * File roles are inferred from path conventions; unknown files get 'other'.
 * The manifest itself and non-pack repo files (schemas, docs, dotfiles) are
 * excluded from the inventory.
 *
 * Deterministic: same tree in = byte-identical files[]/contentHash out
 * (the freshness contract test relies on this).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXCLUDE = new Set([
  'pack-manifest.json',
  'game.schema.json',
  'pack-manifest.schema.json',
  'tokens.schema.json',
  'CLAUDE.md',
  'README.md',
]);

function roleFor(relPath) {
  if (relPath === 'game.json') return 'game';
  if (relPath === 'tokens.json') return 'tokens';
  if (relPath === 'strings.json') return 'strings';
  if (relPath === 'theme.json') return 'theme';
  if (relPath === 'cues.json') return 'cues';
  if (relPath.startsWith('templates/')) return 'template';
  if (/^assets\/images\//.test(relPath)) return 'asset-image';
  if (/^assets\/audio\//.test(relPath)) return 'asset-audio';
  if (/\.mp4$/.test(relPath)) return 'asset-video';
  return 'other';
}

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'shared') continue;
      walk(full, base, out);
    } else if (entry.isFile()) {
      if (EXCLUDE.has(rel)) continue;
      // Non-pack top-level extras (HTML utilities etc.) are inventoried as
      // 'other' only when clearly content; skip known repo tooling
      if (/\.(html)$/.test(rel)) continue;
      out.push(rel);
    }
  }
  return out;
}

function buildFiles(packDir) {
  return walk(packDir)
    .sort()
    .map((rel) => {
      const buf = fs.readFileSync(path.join(packDir, rel));
      return {
        path: rel,
        role: roleFor(rel),
        sha1: crypto.createHash('sha1').update(buf).digest('hex'),
        size: buf.length,
      };
    });
}

function contentHash(files) {
  const lines = files.map((f) => `${f.path}:${f.sha1}`).sort().join('\n');
  return `sha256:${crypto.createHash('sha256').update(lines).digest('hex')}`;
}

function build(packDir) {
  const manifestPath = path.join(packDir, 'pack-manifest.json');
  const existing = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {};

  const files = buildFiles(packDir);
  const manifest = {
    kind: 'pack-manifest',
    schemaVersion: 1,
    packId: existing.packId || path.basename(packDir),
    version: existing.version || '0.1.0',
    contentHash: contentHash(files),
    ...(existing.createdAt ? { createdAt: existing.createdAt } : {}),
    engine: existing.engine || { minVersion: '3.0.0' },
    files,
    hardware: existing.hardware || {
      deviceClasses: [{ class: 'staffed', min: 1, rationale: 'TODO: author the hardware section' }],
    },
  };
  return { manifest, manifestPath };
}

if (require.main === module) {
  const packDir = process.argv[2];
  if (!packDir || !fs.existsSync(packDir)) {
    console.error('Usage: node scripts/build-pack-manifest.js <packDir>');
    process.exit(1);
  }
  const { manifest, manifestPath } = build(path.resolve(packDir));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${manifestPath}: ${manifest.files.length} files, ${manifest.contentHash.slice(0, 23)}…`);
}

module.exports = { build, buildFiles, contentHash };
