// Theme unit ST.F — ledger L11 retirement, config-tool half (D-T.6).
// DM Sans + JetBrains Mono move from Google Fonts CDN links (which
// silently fail at the offline-LAN venue) to self-hosted woff2 under
// public/fonts. The backend half of the tripwire lives in
// backend/tests/unit/utils/fontSelfHosting.test.js.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.resolve(__dirname, '../public');

const listFilesRecursive = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFilesRecursive(p) : [p];
  });

describe('ledger L11 retirement tripwire (config-tool half)', () => {
  it('NO file under public/ references fonts.googleapis or fonts.gstatic', () => {
    const offenders = listFilesRecursive(PUBLIC_DIR)
      .filter((p) => /\.(html|css|js)$/.test(p))
      .filter((p) => /fonts\.(googleapis|gstatic)/.test(fs.readFileSync(p, 'utf8')))
      .map((p) => path.relative(PUBLIC_DIR, p));
    assert.deepStrictEqual(offenders, []);
  });

  it('index.html links the local font stylesheet', () => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
    assert.match(html, /<link[^>]+href="\/fonts\/fonts\.css"/);
  });

  for (const family of ['DM Sans', 'JetBrains Mono']) {
    it(`${family}: @font-face declared locally and every referenced woff2 exists`, () => {
      const css = fs.readFileSync(path.join(PUBLIC_DIR, 'fonts', 'fonts.css'), 'utf8');
      const faces = css.split('@font-face').slice(1).filter((b) => b.includes(`'${family}'`));
      assert.ok(faces.length > 0, `no @font-face for ${family}`);
      const urls = faces.flatMap((b) => [...b.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]));
      assert.ok(urls.length > 0, `no urls for ${family}`);
      for (const u of urls) {
        assert.match(u, /^\/fonts\/[\w.-]+\.woff2$/, `non-local url: ${u}`);
        const file = path.join(PUBLIC_DIR, 'fonts', path.basename(u));
        assert.ok(fs.existsSync(file), `missing ${file}`);
        const magic = fs.readFileSync(file).subarray(0, 4).toString('latin1');
        assert.strictEqual(magic, 'wOF2', `${file} is not a woff2`);
      }
    });
  }

  it('styles.css keeps the live fallback stacks', () => {
    const css = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'styles.css'), 'utf8');
    assert.match(css, /'DM Sans', system-ui, sans-serif/);
    assert.match(css, /'JetBrains Mono', monospace/);
  });
});
