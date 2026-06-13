/**
 * E2E harness drift gates (e2e-harness-assessment.md, rec. 4)
 *
 * The E2E page objects drift from the apps silently: members referencing
 * UI that no longer (or never) existed pass vacuously (.isVisible() of a
 * nonexistent element is false) until a refactor turns them into crashes.
 * The 2026-06-11 audit found 15 such members. These gates run with the
 * fast unit suite so drift is caught at edit time, not at the next
 * (rare) full E2E run.
 *
 * Gate 1: self-consistency — every `this.X` a page object uses is defined.
 * Gate 2: selector existence — every '#id' locator in a page object exists
 *         in the corresponding app's sources (monorepo-relative).
 */

const fs = require('fs');
const path = require('path');

const PO_DIR = path.resolve(__dirname, '../../e2e/helpers/page-objects');
const ALNSCANNER = path.resolve(__dirname, '../../../../ALNScanner');
const PWA = path.resolve(__dirname, '../../../../aln-memory-scanner');
const SCOREBOARD = path.resolve(__dirname, '../../../public/scoreboard.html');

function readSources(roots) {
  let blob = '';
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|html)$/.test(entry.name)) blob += fs.readFileSync(full, 'utf8');
    }
  };
  for (const root of roots) {
    if (fs.statSync(root).isDirectory()) walk(root);
    else blob += fs.readFileSync(root, 'utf8');
  }
  return blob;
}

// Page object → app sources its selectors must resolve against
const APP_SOURCES = {
  'GMScannerPage.js': [path.join(ALNSCANNER, 'index.html'), path.join(ALNSCANNER, 'src')],
  'PlayerScannerPage.js': [path.join(PWA, 'index.html'), path.join(PWA, 'js')],
  'ScoreboardPage.js': [SCOREBOARD],
};

// Documented exceptions: selectors for UI that intentionally does not exist
// (kept because flows use the always-false answer as an availability guard;
// the missing fallback UI is a UX-backlog item — see e2e-harness-assessment.md)
const KNOWN_MISSING_SELECTORS = new Set([
  'bt-unavailable',          // BT unavailable-fallback never built
  'lighting-not-connected',  // lighting fallback never built
]);

describe('E2E page-object drift gates', () => {
  const pageObjects = fs.readdirSync(PO_DIR).filter(f => f.endsWith('.js'));

  describe.each(pageObjects)('%s', (file) => {
    const src = fs.readFileSync(path.join(PO_DIR, file), 'utf8');

    it('every this.* member referenced is defined (no dangling members)', () => {
      const defined = new Set([...src.matchAll(/this\.(\w+)\s*=/g)].map(m => m[1]));
      const used = new Set([...src.matchAll(/this\.(\w+)[.([]/g)].map(m => m[1]));
      const methods = new Set([...src.matchAll(/^ {2}(?:async )?(\w+)\(/gm)].map(m => m[1]));

      const dangling = [...used].filter(u =>
        !defined.has(u) && !methods.has(u) && u !== 'page'
      );
      expect(dangling).toEqual([]);
    });

    it('every #id selector exists in the app sources (or is a documented exception)', () => {
      const sources = readSources(APP_SOURCES[file]);
      const ids = [...src.matchAll(/['"`]#([a-zA-Z][\w-]+)/g)].map(m => m[1]);

      const missing = [...new Set(ids)].filter(id =>
        !KNOWN_MISSING_SELECTORS.has(id)
        && !sources.includes(`id="${id}"`)
        && !sources.includes(`id='${id}'`)
        && !sources.includes(`getElementById('${id}')`)
        && !sources.includes(`getElementById("${id}")`)
        // dynamically-assigned ids (el.id = '...') and template literals
        && !sources.includes(`id = '${id}'`)
        && !sources.includes(`id="${id}`)
        && !sources.includes(`id='${id}`)
      );
      expect(missing).toEqual([]);
    });
  });
});
