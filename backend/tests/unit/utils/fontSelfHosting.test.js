/**
 * Theme unit ST.F — ledger L11 retirement (D-T.6).
 *
 * The scoreboard's typography rode Google Fonts CDN links, which
 * SILENTLY FAIL at the offline-LAN venue — the intended look never
 * actually renders where it matters. The families are self-hosted
 * woff2 under backend/public/fonts with generated @font-face css;
 * the CDN links (stylesheet AND both preconnects) are gone.
 *
 * This file is the backend half of the L11 retirement tripwire
 * (`grep -RE 'fonts\.(googleapis|gstatic)' backend/public config-tool`
 * = zero); config-tool/test/fontSelfHosting.test.js is the other half.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');

const listFilesRecursive = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) return []; // gm-scanner/player-scanner mounts are other repos' trees
    return e.isDirectory() ? listFilesRecursive(p) : [p];
  });

describe('ledger L11 retirement: no runtime font-CDN dependency (theme unit ST.F)', () => {
  it('NO file under backend/public references fonts.googleapis or fonts.gstatic', () => {
    const offenders = listFilesRecursive(PUBLIC_DIR)
      .filter((p) => /\.(html|css|js)$/.test(p))
      .filter((p) => /fonts\.(googleapis|gstatic)/.test(fs.readFileSync(p, 'utf8')))
      .map((p) => path.relative(PUBLIC_DIR, p));
    expect(offenders).toEqual([]);
  });

  it('the dead --font-display token (unused Playfair Display) is DELETED, not self-hosted', () => {
    // D-T.6: Playfair had a declaration and zero var() consumers —
    // hosting a dead family would be speculative weight; it retires
    // with its token.
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'scoreboard.html'), 'utf8');
    expect(html).not.toContain('--font-display');
    expect(html).not.toContain('Playfair');
  });
});

describe('scoreboard fonts are self-hosted with the live fallback stacks (D-T.6)', () => {
  const html = () => fs.readFileSync(path.join(PUBLIC_DIR, 'scoreboard.html'), 'utf8');

  it('the page links the local font stylesheet', () => {
    expect(html()).toMatch(/<link[^>]+href="\/fonts\/fonts\.css"/);
  });

  it.each([
    ['IBM Plex Mono'],
    ['Libre Baskerville'],
    ['Special Elite'],
  ])('%s: @font-face declared locally and every referenced woff2 EXISTS', (family) => {
    const css = fs.readFileSync(path.join(PUBLIC_DIR, 'fonts', 'fonts.css'), 'utf8');
    const faces = css.split('@font-face').slice(1).filter((b) => b.includes(`'${family}'`));
    expect(faces.length).toBeGreaterThan(0);
    const urls = faces.flatMap((b) => [...b.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]));
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u).toMatch(/^\/fonts\/[\w.-]+\.woff2$/); // local, no CDN
      const file = path.join(PUBLIC_DIR, 'fonts', path.basename(u));
      expect(fs.existsSync(file)).toBe(true);
      // A real woff2, not an HTML error page saved by a broken fetch.
      const magic = fs.readFileSync(file).subarray(0, 4).toString('latin1');
      expect(magic).toBe('wOF2');
    }
  });

  it('the page keeps the live fallback stacks beside the hosted families', () => {
    // The offline-venue posture: if a woff2 ever fails to load the
    // page must still degrade to the same stacks it uses today.
    const h = html();
    expect(h).toContain("'Special Elite', 'Courier New', monospace");
    expect(h).toContain("'Libre Baskerville', Georgia, serif");
    expect(h).toContain("'IBM Plex Mono', 'Consolas', monospace");
  });
});
