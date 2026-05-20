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
 * Strip JavaScript line and block comments from a source string. Used to
 * avoid false negatives where a comment like `// TODO: add musicService`
 * makes the regex think the service IS being passed.
 *
 * Note: this is a deliberately simple stripper — it does NOT handle
 * comments inside strings (which would be valid identifiers). Good enough
 * for call-body bodies which rarely contain string literals.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

/**
 * Find every `buildSyncFullPayload({ ... })` invocation in a file and
 * return an array of { lineNumber, body } for each. The body is the
 * substring between the outer braces with comments stripped.
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
    const body = stripComments(source.slice(start, i - 1));
    const lineNumber = source.slice(0, match.index).split('\n').length;
    calls.push({ lineNumber, body });
  }
  return calls;
}

/**
 * Detect `buildSyncFullPayload(X)` calls where X is NOT an inline object
 * literal (e.g., `buildSyncFullPayload(payloadObj)` after building the
 * arguments separately). These are invisible to findCallSites — the
 * guard can't audit them — so surface them as warnings to be reviewed
 * manually.
 */
function findVariableFormCalls(source) {
  const sites = [];
  // Strip comments first so JSDoc references like `buildSyncFullPayload()`
  // in documentation aren't flagged as variable-form callers.
  const code = stripComments(source);
  // Match buildSyncFullPayload( NOT followed by whitespace and {
  const re = /buildSyncFullPayload\((?!\s*\{)/g;
  let match;
  while ((match = re.exec(code)) !== null) {
    // Empty-paren calls (buildSyncFullPayload()) in docs/types — skip.
    if (code[match.index + match[0].length] === ')') continue;
    // Line number computation uses comment-stripped source so it may
    // differ from the original line number, but it's good enough to
    // surface the offending file for human inspection.
    const lineNumber = code.slice(0, match.index).split('\n').length;
    sites.push({ lineNumber });
  }
  return sites;
}

describe('sync:full caller audit — every site passes musicService', () => {
  const allFiles = SOURCE_DIRS.flatMap(walkJsFiles);
  const allCallSites = [];
  const allVariableFormSites = [];

  for (const file of allFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const site of findCallSites(source)) {
      allCallSites.push({
        file: path.relative(ROOT, file),
        line: site.lineNumber,
        body: site.body,
      });
    }
    for (const site of findVariableFormCalls(source)) {
      allVariableFormSites.push({
        file: path.relative(ROOT, file),
        line: site.lineNumber,
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

  it('no variable-form buildSyncFullPayload calls slip past the auditor', () => {
    // findCallSites only recognises inline-object calls
    // (`buildSyncFullPayload({ ... })`). If a caller refactors to a
    // pre-built variable (`buildSyncFullPayload(payloadObj)`), the audit
    // becomes blind to it — we'd report "all sites compliant" without
    // ever inspecting the arguments. Fail loudly so the auditor itself
    // is updated to cover the new pattern.
    if (allVariableFormSites.length > 0) {
      const lines = allVariableFormSites.map(s => `  ${s.file}:${s.line}`).join('\n');
      throw new Error(
        `Variable-form buildSyncFullPayload calls bypass the audit:\n${lines}\n\n` +
        `Extend findCallSites in this file to inspect these, OR convert the call back to an inline object literal.`
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

    it('strips line comments so "// TODO: musicService" is not a false negative', () => {
      const fakeSource = `
        buildSyncFullPayload({
          sessionService,
          // TODO: add musicService once Phase 7 lands
          spotifyService,
        })
      `;
      const sites = findCallSites(fakeSource);
      expect(sites).toHaveLength(1);
      // Comment-stripped body must NOT contain musicService.
      expect(/\bmusicService\b/.test(sites[0].body)).toBe(false);
    });

    it('strips block comments', () => {
      const fakeSource = `
        buildSyncFullPayload({
          sessionService,
          /* musicService is added in Phase 7 */
          spotifyService,
        })
      `;
      const sites = findCallSites(fakeSource);
      expect(/\bmusicService\b/.test(sites[0].body)).toBe(false);
    });

    it('findVariableFormCalls flags pre-built object form', () => {
      const fakeSource = `
        const args = { sessionService, musicService };
        await buildSyncFullPayload(args);
      `;
      const sites = findVariableFormCalls(fakeSource);
      expect(sites).toHaveLength(1);
    });

    it('findVariableFormCalls does NOT flag inline-object form', () => {
      const fakeSource = `await buildSyncFullPayload({ sessionService });`;
      const sites = findVariableFormCalls(fakeSource);
      expect(sites).toHaveLength(0);
    });
  });
});
