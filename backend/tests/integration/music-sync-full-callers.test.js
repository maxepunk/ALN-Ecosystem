/**
 * Static-analysis guard for the "sync:full caller missing a service" bug class.
 *
 * Per backend/CLAUDE.md: `buildSyncFullPayload` callers have forgotten a
 * service argument FOUR times historically (scores:reset, offline:queue:
 * processed, integration-test-server.js, soundService omission). When a
 * caller is missing a service, that path silently delivers a sync:full
 * with the field undefined — clients reset the corresponding domain to
 * defaults.
 *
 * This test scans every buildSyncFullPayload({ ... }) invocation across
 * src/ and tests/helpers/ and asserts that musicService appears in the
 * argument object. It's a guard, not an end-to-end test — runtime
 * end-to-end coverage for the gmAuth caller lives in
 * state-synchronization.test.js, and additional callers are exercised by
 * other integration suites.
 *
 * If you intentionally add a new buildSyncFullPayload caller, update this
 * file or extend the regex.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE_DIRS = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'tests/helpers'),
];

/**
 * Walk a directory tree and return absolute paths of every .js file.
 */
function walkJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/**
 * Find every `buildSyncFullPayload({ ... })` invocation in a file and
 * return an array of { lineNumber, body } for each. The body is the
 * substring between the outer braces.
 */
function findCallSites(source) {
  const calls = [];
  const re = /buildSyncFullPayload\(\s*\{/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const start = match.index + match[0].length;
    // Walk forward, balanced-brace counting, to find the matching `}`.
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    if (depth !== 0) continue;
    const body = source.slice(start, i - 1);
    const lineNumber = source.slice(0, match.index).split('\n').length;
    calls.push({ lineNumber, body });
  }
  return calls;
}

describe('sync:full caller audit — every site passes musicService', () => {
  const allFiles = SOURCE_DIRS.flatMap(walkJsFiles);
  const allCallSites = [];

  for (const file of allFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const site of findCallSites(source)) {
      allCallSites.push({
        file: path.relative(ROOT, file),
        line: site.lineNumber,
        body: site.body,
      });
    }
  }

  it('finds at least 7 buildSyncFullPayload call sites', () => {
    // gmAuth, broadcasts (×3), stateRoutes, server, integration-test-server
    expect(allCallSites.length).toBeGreaterThanOrEqual(7);
  });

  it('every call site mentions musicService', () => {
    const missing = allCallSites.filter(({ body }) => !/\bmusicService\b/.test(body));
    if (missing.length > 0) {
      const lines = missing.map(m => `  ${m.file}:${m.line}`).join('\n');
      throw new Error(
        `buildSyncFullPayload call sites missing musicService:\n${lines}\n\n` +
        `This recurring bug class drops the music domain on the floor — see backend/CLAUDE.md.`
      );
    }
  });

  it.each([
    'src/websocket/gmAuth.js',
    'src/websocket/broadcasts.js',
    'src/routes/stateRoutes.js',
    'src/server.js',
    'tests/helpers/integration-test-server.js',
  ])('%s contains at least one buildSyncFullPayload call', (relativePath) => {
    const sites = allCallSites.filter(s => s.file === relativePath);
    expect(sites.length).toBeGreaterThanOrEqual(1);
  });

  // Sanity check on the check logic itself: a synthetic source that omits
  // musicService should be detected by findCallSites + the regex.
  describe('detector self-test', () => {
    it('flags a synthetic call site that omits musicService', () => {
      const fakeSource = `
        await buildSyncFullPayload({
          sessionService,
          transactionService,
          spotifyService,
          soundService,
        });
      `;
      const sites = findCallSites(fakeSource);
      expect(sites).toHaveLength(1);
      expect(/\bmusicService\b/.test(sites[0].body)).toBe(false);
    });

    it('accepts a synthetic call site that includes musicService', () => {
      const fakeSource = `
        buildSyncFullPayload({
          sessionService,
          musicService,
          soundService,
        })
      `;
      const sites = findCallSites(fakeSource);
      expect(sites).toHaveLength(1);
      expect(/\bmusicService\b/.test(sites[0].body)).toBe(true);
    });

    it('handles nested braces in the call body', () => {
      const fakeSource = `
        buildSyncFullPayload({
          musicService,
          deviceFilter: { connectedOnly: true },
        })
      `;
      const sites = findCallSites(fakeSource);
      expect(sites).toHaveLength(1);
      expect(/\bmusicService\b/.test(sites[0].body)).toBe(true);
    });
  });
});
