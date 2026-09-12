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

  it('renderScoreboardHtml injects the ACTIVE pack strings as JSON — all four scoreboard keys ride', () => {
    // The default pack dir is ALN-TokenData, whose strings.json declares
    // the scoreboard section — the rendered page must carry it (and no
    // placeholder).
    const { renderScoreboardHtml } = require('../../../src/routes/resourceRoutes');
    const packService = require('../../../src/services/packService');
    const html = renderScoreboardHtml();
    expect(html).not.toContain('%%PACK_STRINGS%%');
    expect(html).toContain(`const PACK_STRINGS = ${JSON.stringify(packService.getStrings())}`);
    const sb = packService.getStrings().scoreboard;
    expect(sb.header).toBe('CASE FILE: ABOUT LAST NIGHT');
    expect(sb.emptyTicker).toBe('No scores recorded');
    expect(sb.emptyEvidence).toBe('Awaiting evidence...');
    expect(sb.unknownOwner).toBe('Unknown');
  });

  it('renderScoreboardHtml injects the ACTIVE pack theme as JSON (theme unit ST.3 — D-T.2)', () => {
    // The default pack dir is ALN-TokenData, whose theme.json is the
    // ruled star-drop — the rendered page must carry it verbatim (the
    // scoreboard ignores rating; it reads only t?.scoreboard?.*, absent
    // for ALN, so the baked palette stands — benign emptiness).
    const { renderScoreboardHtml } = require('../../../src/routes/resourceRoutes');
    const packService = require('../../../src/services/packService');
    const html = renderScoreboardHtml();
    expect(html).not.toContain('%%PACK_THEME%%');
    expect(html).toContain(`const PACK_THEME = ${JSON.stringify(packService.getTheme())}`);
    // The snapshot is SECTIONS-ONLY — kind/schemaVersion are transport
    // framing, validated then stripped by _loadDeclaredTheme (the
    // getStrings posture). ALN's ruled star-drop is the sole section.
    expect(packService.getTheme()).toEqual({ rating: { display: 'none' } });
  });

  it('pack-controlled text can NEVER become a substitution pattern — a strings leaf carrying the theme placeholder survives as DATA and the page still parses (close review SEC-1)', () => {
    // The ordering attack: with chained replaceAll passes, a
    // gate-legal strings leaf containing the literal '%%PACK_THEME%%'
    // was rewritten by the LATER theme pass — theme JSON injected
    // mid-string broke the inline script's parse and the venue TV
    // went dead at serve time. A single-pass replacer never rescans
    // replaced output.
    const vm = require('vm');
    const { renderScoreboardHtml } = require('../../../src/routes/resourceRoutes');
    const packService = require('../../../src/services/packService');
    const hostileLeaf = "OWNED'%%PACK_THEME%%'END";
    const sSpy = jest.spyOn(packService, 'getStrings')
      .mockReturnValue({ scoreboard: { header: hostileLeaf } });
    const tSpy = jest.spyOn(packService, 'getTheme')
      .mockReturnValue({ scoreboard: { accent: '#ff0000', accentDark: '#00ff00' } });
    try {
      const html = renderScoreboardHtml();
      // The hostile leaf survives VERBATIM as JSON data.
      expect(html).toContain(JSON.stringify(hostileLeaf));
      // And every inline script still PARSES — the page must never be
      // served as a syntax error.
      const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      expect(scripts.length).toBeGreaterThan(0);
      for (const s of scripts) new vm.Script(s);
      // The real theme injection still landed at its own site.
      expect(html).toContain(`const PACK_THEME = ${JSON.stringify(packService.getTheme())}`);
    } finally {
      sSpy.mockRestore();
      tSpy.mockRestore();
    }
  });

  it('packless serve path: PACK_THEME renders as null (baked palette stands, no loud shim — D-T.2)', () => {
    const { renderScoreboardHtml } = require('../../../src/routes/resourceRoutes');
    const packService = require('../../../src/services/packService');
    const spy = jest.spyOn(packService, 'getTheme').mockReturnValue(null);
    try {
      const html = renderScoreboardHtml();
      expect(html).toContain('const PACK_THEME = null;');
      expect(html).not.toContain('%%PACK_THEME%%');
    } finally {
      spy.mockRestore();
    }
  });

  it('the on-disk page re-validates theme colors at the CSS sink (defense in depth — the closers\' posture)', () => {
    // The gate already refused non-hex at activation; the page must not
    // TRUST that — applyPackTheme applies a value to --evidence-red /
    // --evidence-red-dark only after its own strict 6-digit hex test.
    const html = fs.readFileSync(scoreboardPath, 'utf8');
    expect(html).toContain("const PACK_THEME = '%%PACK_THEME%%'");
    expect(html).toMatch(/#\[0-9a-fA-F\]\{6\}/); // the sink-side hex re-check
    expect(html).toContain('--evidence-red-dark');
    expect(html).toMatch(/setProperty\('--evidence-red'/);
  });

  describe('the sink guard is LOAD-BEARING — the page function executed with hostile values (ST.3 review fold)', () => {
    // The source-text pin above proves PLACEMENT only — a stripped guard
    // with the regex literal left behind stayed green (the ST.2
    // vacuous-pin class, caught again here). This pin EXECUTES the
    // page's own applyPackTheme: extract the THEME_HEX + function span
    // from the served source and drive it against a recording document
    // stub. Refactoring the page's theme block moves this span and
    // fails the extraction LOUDLY — that is the pin working.
    const extractApplyPackTheme = () => {
      const html = fs.readFileSync(scoreboardPath, 'utf8');
      const m = html.match(/const THEME_HEX[\s\S]*?\n {8}\}/);
      if (!m) throw new Error('scoreboard.html theme block not found — the sink pin must move with it');
      return m[0];
    };
    const drive = (themeValue) => {
      const calls = [];
      const doc = { documentElement: { style: { setProperty: (p, v) => calls.push([p, v]) } } };
      // eslint-disable-next-line no-new-func -- executing the page's own inline script under test
      new Function('document', 'PACK_THEME',
        `${extractApplyPackTheme()}\napplyPackTheme(PACK_THEME);`)(doc, themeValue);
      return calls;
    };

    it.each([
      ['CSS breakout', 'red; background: url(//evil)'],
      ['url() smuggle', 'url(javascript:alert(1))'],
      ['var() indirection', 'var(--evil)'],
      ['3-digit hex (schema-illegal shorthand)', '#f00'],
      ['non-string', { toString: () => '#c41e3a' }],
    ])('a hostile accent NEVER reaches setProperty: %s', (_label, evil) => {
      expect(drive({ scoreboard: { accent: evil, accentDark: evil } })).toEqual([]);
    });

    it('a strict 6-digit hex pair lands on both tokens', () => {
      expect(drive({ scoreboard: { accent: '#0e7490', accentDark: '#164e63' } })).toEqual([
        ['--evidence-red', '#0e7490'],
        ['--evidence-red-dark', '#164e63'],
      ]);
    });

    it('an undeclared scoreboard section (ALN) and a null theme touch NOTHING', () => {
      expect(drive({ rating: { display: 'none' } })).toEqual([]);
      expect(drive(null)).toEqual([]);
    });
  });

  it('packless serve path: PACK_STRINGS renders as null and the page keeps its baked STR fallbacks', () => {
    const { renderScoreboardHtml } = require('../../../src/routes/resourceRoutes');
    const packService = require('../../../src/services/packService');
    const spy = jest.spyOn(packService, 'getStrings').mockReturnValue(null);
    try {
      const html = renderScoreboardHtml();
      expect(html).toContain('const PACK_STRINGS = null;');
      expect(html).not.toContain('%%PACK_STRINGS%%');
    } finally {
      spy.mockRestore();
    }
  });

  it('DRIFT TRIPWIRE: the page STR baked fallbacks mirror the ALN sidecar verbatim', () => {
    // The baked fallbacks ARE the ALN wording — if the pack rewords,
    // the bake must follow (or a packless venue silently diverges from
    // the shipped game). Parses the on-disk STR table's packStr() calls.
    const html = fs.readFileSync(
      path.resolve(__dirname, '../../../public/scoreboard.html'), 'utf8'
    );
    const fallback = (key) => {
      const m = html.match(new RegExp(
        `${key}: packStr\\(PACK_STRINGS\\?\\.scoreboard\\?\\.${key}, '([^']*)'\\)`
      ));
      expect(m).not.toBeNull();
      return m[1];
    };
    const aln = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../../../ALN-TokenData/strings.json'), 'utf8'
    ));
    expect(fallback('header')).toBe(aln.scoreboard.header);
    expect(fallback('emptyTicker')).toBe(aln.scoreboard.emptyTicker);
    expect(fallback('emptyEvidence')).toBe(aln.scoreboard.emptyEvidence);
    expect(fallback('unknownOwner')).toBe(aln.scoreboard.unknownOwner);
  });

  it('non-string leaves in a drifted sidecar fall back to baked wording (packStr type guard on the page)', () => {
    // The page must apply the same non-empty-STRING leaf rule as every
    // other reader — a nested object where a string is expected must
    // never render '[object Object]' or reach escapeHtml as a non-string.
    const html = fs.readFileSync(
      path.resolve(__dirname, '../../../public/scoreboard.html'), 'utf8'
    );
    expect(html).toContain("return (typeof value === 'string' && value.length > 0) ? value : baked;");
    // Every STR entry routes through the guard — no bare || truthiness
    expect(html).not.toMatch(/PACK_STRINGS\?\.scoreboard\?\.\w+ \|\|/);
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

  it('$-substitution patterns pass through verbatim (replaceAll replacement-string hazard)', () => {
    // String.replaceAll with a STRING replacement interprets $$, $&, $',
    // $` — a password like p@$$w0rd was served mangled (p@$w0rd) and a
    // pack string containing $' spliced the rest of the page into the
    // literal. Function replacements are verbatim; this pins that.
    const { renderScoreboardHtml } = require('../../../src/routes/resourceRoutes');
    const packService = require('../../../src/services/packService');
    const strings = { scoreboard: { header: `all the $$ and $& and $' and \`$\`` } };
    const spy = jest.spyOn(packService, 'getStrings').mockReturnValue(strings);
    const original = config.security.adminPassword;
    try {
      config.security.adminPassword = 'p@$$w0rd$&';
      const html = renderScoreboardHtml();
      expect(html).toContain(`adminPassword: ${JSON.stringify('p@$$w0rd$&')}`);
      const m = html.match(/const PACK_STRINGS = (.*);/);
      expect(JSON.parse(m[1])).toEqual(strings);
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
