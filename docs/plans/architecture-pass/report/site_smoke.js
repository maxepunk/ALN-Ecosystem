// Smoke test for the owner's site, version 9 (site/2026-11-01-site-plan-v2.md): load each of the six pages as a
// browser would see it, at 1100 and 400 pixels wide, in light and in dark, and fail on:
//   - any console error or page error;
//   - document.documentElement.scrollWidth wider than the viewport (the body scrolling sideways);
//   - any .dia-svg box without its svg;
//   - any link to another page of the site whose file or anchor is missing;
//   - any link to version 8's retired pages (promises.html, parts.html, flaws.html).
// It saves one full-page screenshot per page, width and theme: <shotsDir>/<page>-<width>-<theme>.png (24 files).
//
// index.html is the artifact's main page and has no document skeleton; it is wrapped here as the publish step
// wraps it (doctype, charset, viewport meta with viewport-fit=cover, the base reset) and loaded from a temporary
// folder. Its links are checked against the site folder, where they resolve once published. The other five
// pages load as they are, from file URLs, so their relative links resolve.
//
// Usage: node site_smoke.js <siteDir> <shotsDir>
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const PAGES = ['index', 'decisions', 'requirements', 'design', 'today', 'changes'];
const RETIRED = new Set(['promises.html', 'parts.html', 'flaws.html']);
const WIDTHS = [1100, 400];
const THEMES = ['light', 'dark'];
const BASE_RESET = ':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);'
  + 'padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}';

function idsOf(file) {
  const s = fs.readFileSync(file, 'utf8');
  return new Set([...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
}

async function main() {
  const [siteArg, shotsArg] = process.argv.slice(2);
  if (!siteArg || !shotsArg) { console.error('usage: node site_smoke.js <siteDir> <shotsDir>'); process.exit(2); }
  const siteDir = path.resolve(siteArg);
  const shotsDir = path.resolve(shotsArg);
  fs.mkdirSync(shotsDir, { recursive: true });
  for (const p of PAGES) {
    if (!fs.existsSync(path.join(siteDir, `${p}.html`))) { console.error(`missing ${p}.html in ${siteDir}`); process.exit(1); }
  }
  const ids = Object.fromEntries(PAGES.map(p => [`${p}.html`, idsOf(path.join(siteDir, `${p}.html`))]));

  // The publish step's skeleton around the main page.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'site-smoke-'));
  const wrapped = path.join(tmp, 'index.html');
  fs.writeFileSync(wrapped, '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + `<style>${BASE_RESET}</style>\n</head>\n<body>\n`
    + fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8') + '\n</body>\n</html>\n');

  const failures = [];
  let loads = 0;
  const browser = await chromium.launch();
  try {
    for (const p of PAGES) {
      const url = 'file://' + (p === 'index' ? wrapped : path.join(siteDir, `${p}.html`));
      for (const width of WIDTHS) {
        for (const theme of THEMES) {
          const tag = `${p}-${width}-${theme}`;
          const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
          const page = await context.newPage();
          const errors = [];
          page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
          page.on('pageerror', err => errors.push(`page error: ${err.message}`));
          await page.goto(url, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const r = await page.evaluate(() => {
            const out = {};
            out.scrollWidth = document.documentElement.scrollWidth;
            out.innerWidth = window.innerWidth;
            out.dia = document.querySelectorAll('.dia-svg').length;
            out.diaEmpty = [...document.querySelectorAll('.dia-svg')].filter(d => !d.querySelector('svg')).map(d => d.getAttribute('aria-label'));
            out.links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
            out.dark = getComputedStyle(document.body).backgroundColor;
            // What sticks out past the viewport, if anything, for the failure message.
            out.wide = [...document.body.querySelectorAll('*')].filter(el => {
              const b = el.getBoundingClientRect();
              return b.right > window.innerWidth + 1 && !el.closest('.scroll, .tablewrap, .dia-svg, details:not([open])');
            }).slice(0, 5).map(el => `${el.tagName.toLowerCase()}.${el.className && el.className.baseVal === undefined ? el.className : ''}`);
            return out;
          });
          for (const err of errors) failures.push(`${tag}: ${err}`);
          if (r.scrollWidth > r.innerWidth) failures.push(`${tag}: page scrolls sideways (${r.scrollWidth} > ${r.innerWidth}); wide: ${r.wide.join(', ')}`);
          for (const label of r.diaEmpty) failures.push(`${tag}: .dia-svg without an svg: ${label}`);
          const own = `${p}.html`;
          for (const h of r.links) {
            if (/^[a-z]+:/i.test(h)) { failures.push(`${tag}: link leaves the site: ${h}`); continue; }
            const [file, anchor] = h.split('#');
            if (RETIRED.has(file)) { failures.push(`${tag}: link to a retired page: ${h}`); continue; }
            const target = file === '' ? own : file;
            if (!ids[target]) { failures.push(`${tag}: link to a missing page: ${h}`); continue; }
            if (anchor && !ids[target].has(anchor)) failures.push(`${tag}: link ${h} finds no id "${anchor}" on ${target}`);
          }
          await page.screenshot({ path: path.join(shotsDir, `${tag}.png`), fullPage: true });
          console.log(`${tag}: ${r.dia} diagrams, ${r.links.length} links, width ${r.scrollWidth}/${r.innerWidth}, `
            + `body ${r.dark}, ${errors.length} errors`);
          loads += 1;
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (failures.length) {
    console.error(`SMOKE FAILED (${failures.length}):\n` + failures.join('\n'));
    process.exit(1);
  }
  console.log(`smoke passed: ${loads} loads, ${loads} screenshots in ${shotsDir}`);
}

main().catch(err => { console.error(err && err.stack || err); process.exit(1); });
