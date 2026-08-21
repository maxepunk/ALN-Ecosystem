/**
 * Scoreboard window-marker coupling (A3 slice 3a, pre-fix 1 — the
 * "Case File" booby trap, capability-matrix 2.5)
 *
 * displayDriver discovers the kiosk Chromium window by TITLE
 * (`xdotool search --name <marker>`), so the scoreboard page's <title>
 * and the driver's search string are a FUNCTIONAL coupling: before this
 * suite existed, a rebrand of either side passed CI green and broke
 * HDMI show/hide at the venue (runtime-only failure — the driver unit
 * mocks match `--name` by argument position, never the literal).
 *
 * The fix is a single shared engine config value
 * (config.display.scoreboardWindowMarker, env SCOREBOARD_WINDOW_MARKER)
 * consumed by BOTH sides: the driver searches for it, and the served
 * page's title carries it via server-side injection
 * (resourceRoutes.renderScoreboardHtml replaces %%WINDOW_MARKER%%).
 * These tests are the tripwire: each half is pinned against the SAME
 * config value, and the injection placeholder is pinned into the real
 * public/scoreboard.html on disk.
 */

const fs = require('fs');
const path = require('path');

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const config = require('../../../src/config');

describe('scoreboard window marker (shared engine config — slice 3a pre-fix 1)', () => {
  it('config declares the marker with a stable non-themed default', () => {
    expect(config.display.scoreboardWindowMarker).toBe('ALN-SCOREBOARD');
  });

  it('the REAL scoreboard.html carries the injection placeholder in its <title>', () => {
    // Pins the page half of the coupling: a rebrand that drops the
    // placeholder would sever the xdotool discovery chain.
    const html = fs.readFileSync(
      path.resolve(__dirname, '../../../public/scoreboard.html'), 'utf8'
    );
    const title = html.match(/<title>([^<]*)<\/title>/);
    expect(title).not.toBeNull();
    expect(title[1]).toContain('%%WINDOW_MARKER%%');
  });

  it('renderScoreboardHtml injects the CONFIG marker into the served title (cross-file tripwire)', () => {
    const { renderScoreboardHtml } = require('../../../src/routes/resourceRoutes');
    const html = renderScoreboardHtml();
    const title = html.match(/<title>([^<]*)<\/title>/);
    expect(title[1]).toContain(config.display.scoreboardWindowMarker);
    // The placeholder itself must never reach the browser
    expect(html).not.toContain('%%WINDOW_MARKER%%');
  });

  // The driver half of the coupling (xdotool search uses the CONFIG
  // marker) is pinned in displayDriver.test.js, which owns the full
  // spawn/fs harness the driver needs.
});

describe('scoreboard admin credential injection (slice 3a pre-fix 2 — matrix 2.34)', () => {
  // The page used to BAKE the live venue admin password into a file
  // committed to git. Serve-time injection moves the source to env/config
  // (same delivery to the same LAN clients — no new exposure; the deeper
  // scoped display-token flow is future work, noted in the design doc).
  const scoreboardPath = path.resolve(__dirname, '../../../public/scoreboard.html');

  it('the on-disk page carries the placeholder and NO baked password', () => {
    const html = fs.readFileSync(scoreboardPath, 'utf8');
    expect(html).toContain("adminPassword: '%%ADMIN_PASSWORD%%'");
    expect(html).not.toContain('@LN-c0nn3ct');
  });

  it('renderScoreboardHtml injects the ACTIVE pack strings as JSON (null-safe)', () => {
    // The default pack dir is ALN-TokenData, whose strings.json declares
    // the scoreboard section — the rendered page must carry it (and no
    // placeholder). The null path (pack without strings) is covered by
    // the parity-pack E2E leg + the packService unit pins.
    const { renderScoreboardHtml } = require('../../../src/routes/resourceRoutes');
    const packService = require('../../../src/services/packService');
    const html = renderScoreboardHtml();
    expect(html).not.toContain('%%PACK_STRINGS%%');
    expect(html).toContain(`const PACK_STRINGS = ${JSON.stringify(packService.getStrings())}`);
    expect(packService.getStrings().scoreboard.header).toBe('CASE FILE: ABOUT LAST NIGHT');
  });

  it('script-context breakout is neutralized: injected JSON never contains a literal </script>', () => {
    // JSON.stringify does NOT escape '<' — a pack string (or env value)
    // containing '</script>' would close the inline script block in the
    // served page and inject markup. The injections must emit \u003c.
    const { renderScoreboardHtml } = require('../../../src/routes/resourceRoutes');
    const packService = require('../../../src/services/packService');
    const payload = 'x</script><script>alert(1)</script>';
    const spy = jest.spyOn(packService, 'getStrings')
      .mockReturnValue({ scoreboard: { header: payload } });
    const original = config.security.adminPassword;
    try {
      config.security.adminPassword = payload;
      const html = renderScoreboardHtml();
      expect(html).not.toContain('</script><script>alert(1)');
      expect(html).toContain('\\u003c/script>');
      // Still valid JSON-in-JS: parsing the injected strings object back
      // yields the original value (escaping changed encoding, not content)
      const m = html.match(/const PACK_STRINGS = (.*);/);
      expect(JSON.parse(m[1]).scoreboard.header).toBe(payload);
    } finally {
      config.security.adminPassword = original;
      spy.mockRestore();
    }
  });

  it('renderScoreboardHtml injects the CONFIG password as a JSON string (quote-safe)', () => {
    const { renderScoreboardHtml } = require('../../../src/routes/resourceRoutes');
    const original = config.security.adminPassword;
    try {
      config.security.adminPassword = `qu"ote'n\\slash`;
      const html = renderScoreboardHtml();
      // Injected as JSON.stringify output — valid JS whatever the value
      expect(html).toContain(`adminPassword: ${JSON.stringify(config.security.adminPassword)}`);
      expect(html).not.toContain('%%ADMIN_PASSWORD%%');
    } finally {
      config.security.adminPassword = original;
    }
  });
});
