export const meta = {
  name: 'site-build',
  description: "Write build_site.py for the owner's five-page site from the plan, the inventory and the content overlays; build it and smoke-test every page",
  phases: [
    { title: 'Build', detail: 'one builder writes, runs and smoke-tests build_site.py' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const RP = ROOT + '/docs/plans/architecture-pass/report'
const SITE = RP + '/site'
const SCRATCH = '/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad'
const MERMAID_JS = SCRATCH + '/mermaid-pkg/node_modules/mermaid/dist/mermaid.min.js'

const SCHEMA = { type: 'object', properties: {
  files: { type: 'array', items: { type: 'string' } },
  checksPassed: { type: 'boolean' }, smokePassed: { type: 'boolean' },
  sizes: { type: 'array', items: { type: 'string' } },
  notPlaced: { type: 'array', items: { type: 'string' } },
  screenshots: { type: 'string' },
  keyPoints: { type: 'array', items: { type: 'string' } } },
  required: ['files', 'checksPassed', 'smokePassed', 'sizes', 'notPlaced', 'screenshots', 'keyPoints'] }

phase('Build')
const r = await agent(`Context. The ALN show engine's architecture pass publishes one page for the owner, "What the Engine Promises" (version 7: ${RP}/2026-10-31-cause-report.html, built by ${RP}/build_report.py). The owner decided it becomes five linked pages and a change log. Everything about the new site is fixed in the plan ${SITE}/2026-11-01-site-plan.md: read all of it first and follow it exactly. ${SITE}/inventory.md lists every element of version 7 and its home on the site (its table and the closing "Gaps resolved" section); every element with a home on a site page must appear there.

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit. Do not edit the data files, the overlays, the plan, build_report.py, render_diagrams.js or diagram_theme.py: if one of them is wrong, say so in your log and in notPlaced.

Your task: write ${RP}/build_site.py and a smoke test ${RP}/site_smoke.js, build the six pages into ${SITE}/, and make both pass.

build_site.py (run as: cd ${RP} && MERMAID_JS=${MERMAID_JS} python3 -I build_site.py):
- Self-contained: copy from build_report.py what you need (the renderers for cards, promise entries, part cards, the walkthroughs WALKS, the whole-engine picture shape_svg, the layers, parity, the code grid, glance, qualities, devices FIT_DEVICES, tangles, alternatives, the overview and relations diagrams, BUILT, SET_ASIDE, present() and its sizing directives, the TEMPLATE's CSS and text) and adapt it; do not import build_report.py, so it can retire later.
- Reads the four data files and the three overlays (front.json, decisions.json, changes.json); resolves every [[marker]] (plan section 4) into a link with the title or name from the data, after HTML-escaping the text around it. A question marker that starts a sentence renders "Question E", elsewhere "question E".
- Every link between pages uses the plan's anchors (plan section 2); within a page, a bare #anchor.
- Diagrams (plan section 5.1): collect every Mermaid source of every page (after present()), with keys d-<page>-<n>, including front.json's aroundMermaid when it is not empty; draw them all in one call of node ${RP}/render_diagrams.js <in.json> <out.json> (temporary files; pass MERMAID_JS through the environment); pass each SVG through diagram_theme.theme_svg(svg, key); place it as <div class="dia-svg" role="img" aria-label="(the figure's caption)">SVG</div> inside the figure and scroll box the diagram had in version 7. No page loads Mermaid or any other script library. Port every pre.mermaid CSS rule to .dia-svg (for example the walkthroughs' minimum width of 720 pixels). Put diagram_theme.DIAGRAM_TOKENS_LIGHT in the light :root block, DIAGRAM_TOKENS_DARK in both dark blocks, and DIAGRAM_CSS in the stylesheet.
- Page shells (plan sections 1 and 2): index.html with no doctype, html, head or body tags, starting with its <title> and the viewport-fit-sides meta; the other five as full documents with the base reset the plan lists. One shared stylesheet string, inlined in each page: version 7's tokens and components plus the nav, the status line, the moments columns, the question blocks with their status tags, the decided list and the change-log entries, every colour from a token, light and dark both defined. The side gutter is padding-left: max(16px, env(safe-area-inset-left, 0px)) and the same on the right, set once on the outer wrapper; the sticky nav uses top: env(safe-area-inset-top, 0px) with a fixed body::before band in its background. Nothing makes the page body scroll sideways at 400 pixels; only tables, diagrams and code scroll, each in its own overflow-x: auto box. Headings use text-wrap: balance; focus is visible; reduced motion is respected.
- Each page's sections in the plan's order (section 3), with everything the inventory homes there. The promise entries keep version 7's fields except the earlier wording, the "what changed" note and the embedded cards; the cards keep theirs except the "what changed" note.
- The build's checks (plan section 5.2) fail loudly. Also print each page's file size and prose word count.

site_smoke.js (run as: node ${RP}/site_smoke.js <siteDir> <shotsDir>), using the pre-installed Playwright (require('playwright'); chromium.launch() needs no options): load each page as a browser would see it (index.html wrapped in a minimal skeleton like the publish step: doctype, charset, viewport meta with viewport-fit=cover; the other five as they are, from file URLs so their relative links resolve), at 1100 and 400 pixels wide, in light and in dark (emulate prefers-color-scheme). Fail on any console error or page error, on document.documentElement.scrollWidth greater than the viewport width, on any .dia-svg without an svg, on any link to another page of the site whose file or anchor is missing. Save one full-page screenshot per page per width per theme into <shotsDir> (24 files, named <page>-<width>-<theme>.png).

Run the build and the smoke test (shots into ${SCRATCH}/site-shots) until both pass. Then look at a few of the screenshots yourself (the Read tool shows images): the 400-pixel index and flaws pages in dark, the 1100-pixel decisions and parts pages in light; fix anything clipped, overlapping or unreadable.

Write ${SITE}/build-log.md: what you ported and changed, how each inventory element with a site home was placed (by inventory row number), anything you could not place and why, the checks' and smoke test's results, and each page's size and word count.

Done when: build_site.py builds all six pages with its checks passing; site_smoke.js passes all 24 loads; every inventory row with a site home is placed or listed in notPlaced with a reason; build-log.md is written. Return the files written, whether the checks and the smoke test passed, each page's size and word count, anything not placed, the screenshots folder, and five key points.`, { label: 'build:site', phase: 'Build', effort: 'high', schema: SCHEMA })
log(r ? `build: checks ${r.checksPassed}, smoke ${r.smokePassed}, not placed ${r.notPlaced.length}` : 'build: no result')
return r