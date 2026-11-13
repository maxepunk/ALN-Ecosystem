// Draw Mermaid diagrams to SVG at build time, so no page of the owner's site loads Mermaid.
// Usage: node render_diagrams.js <in.json> <out.json>
//   in.json:  [{"key": "d-flaws-3", "src": "flowchart TD ..."}]
//   out.json: {"d-flaws-3": "<svg ...>...</svg>"}
// Mermaid 11.4.1 comes from MERMAID_JS (a local mermaid.min.js) if set, else from cdnjs.
// Labels are measured in IBM Plex Sans, the page's own font, loaded from Google Fonts first.
// Colours are stand-ins that diagram_theme.py swaps for the page's theme tokens.
const fs = require('fs');
const { chromium } = require('playwright');

const MERMAID_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.1/mermaid.min.js';
const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap';
const FONT_FAMILY = '"IBM Plex Sans", system-ui, sans-serif';
const BG = '#fefef1', NODE = '#fefef2', NODE2 = '#fefef6', CLUSTER = '#fefef7', NOTE = '#fefef8';
const TEXT = '#010103', BORDER = '#010104', LINE = '#010105', NOTE_BORDER = '#010109';
const THEME = {
  background: BG, edgeLabelBackground: BG, sequenceNumberColor: BG,
  primaryColor: NODE, mainBkg: NODE, actorBkg: NODE, labelBoxBkgColor: NODE,
  secondaryColor: NODE2, tertiaryColor: CLUSTER, clusterBkg: CLUSTER, activationBkgColor: CLUSTER,
  noteBkgColor: NOTE,
  primaryTextColor: TEXT, secondaryTextColor: TEXT, tertiaryTextColor: TEXT, textColor: TEXT, nodeTextColor: TEXT,
  titleColor: TEXT, actorTextColor: TEXT, signalTextColor: TEXT, labelTextColor: TEXT, loopTextColor: TEXT, noteTextColor: TEXT,
  primaryBorderColor: BORDER, secondaryBorderColor: BORDER, tertiaryBorderColor: BORDER, nodeBorder: BORDER,
  clusterBorder: BORDER, actorBorder: BORDER, labelBoxBorderColor: BORDER, activationBorderColor: BORDER,
  lineColor: LINE, actorLineColor: LINE, signalColor: LINE, noteBorderColor: NOTE_BORDER,
  fontFamily: FONT_FAMILY, fontSize: '14px',
};

async function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) { console.error('usage: node render_diagrams.js <in.json> <out.json>'); process.exit(2); }
  const items = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"></head><body></body></html>`, { waitUntil: 'networkidle' });
    const fontsOk = await page.evaluate(async () => {
      await Promise.all(['400', '500', '600'].map(w => document.fonts.load(`${w} 14px "IBM Plex Sans"`)));
      return document.fonts.check('14px "IBM Plex Sans"');
    });
    if (!fontsOk) throw new Error('IBM Plex Sans did not load; labels would be measured in another font');
    if (process.env.MERMAID_JS) await page.addScriptTag({ path: process.env.MERMAID_JS });
    else await page.addScriptTag({ url: MERMAID_URL });
    const result = await page.evaluate(async ({ items, theme, family }) => {
      window.mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: theme, fontFamily: family, securityLevel: 'strict' });
      const out = {}, failed = [];
      for (const { key, src } of items) {
        const id = key.replace(/[^A-Za-z0-9_-]/g, '-');
        try { out[key] = (await window.mermaid.render(id, src)).svg; }
        catch (e) { failed.push(`${key}: ${String((e && e.message) || e).slice(0, 300)}`); }
      }
      return { out, failed, version: window.mermaid.version || (window.mermaid.mermaidAPI && window.mermaid.mermaidAPI.getConfig && 'unknown') };
    }, { items, theme: THEME, family: FONT_FAMILY });
    if (result.failed.length) {
      console.error(`${result.failed.length} diagram(s) failed:\n` + result.failed.join('\n'));
      process.exit(1);
    }
    fs.writeFileSync(outPath, JSON.stringify(result.out));
    console.log(`drew ${Object.keys(result.out).length} diagrams`);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
