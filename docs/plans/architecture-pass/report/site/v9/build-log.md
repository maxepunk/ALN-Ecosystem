# Builder's log: the owner's site, version 9

Written 2026-11-01 for version 9 of "What the Engine Promises", to the plan
`site/2026-11-01-site-plan-v2.md` (plan v1, `site/2026-11-01-site-plan.md`,
sections 2, 4, 5 and 6 where v2 is silent) and the builder's brief. Files
changed: `report/build_site.py` (rewritten for the six pages),
`report/site_smoke.js` (the six pages, and retired-page links), the six pages
in `report/site/`, and this log. Deleted: `site/promises.html`,
`site/parts.html`, `site/flaws.html` (the build deletes them after its checks
pass). No overlay, requirements file, data file, plan, `render_diagrams.js`
or `diagram_theme.py` was edited. Nothing was committed.

Run: `cd docs/plans/architecture-pass/report && MERMAID_JS=<mermaid.min.js> python3 -I build_site.py`;
smoke: `node site_smoke.js site <shots folder>`.

## 1. What changed in the builder

- **Inputs.** The overlays now come from `site/v9/` (front, decisions,
  design, changes, rules); the requirements files are read directly from
  `../requirements/`. Version 8's overlays in `site/` are no longer read.
- **Pages.** `PAGES` is the six of plan v2 section 1: `index.html` (The
  engine), `decisions.html`, `requirements.html`, `design.html`,
  `today.html` ("Today's engine"), `changes.html`. The navigation reads
  "The engine · Decisions (15) · Requirements · Design · Today's engine ·
  Change log", the count summed over `decisions.groups` as version 8 summed
  it. The status line is the plan's sentence, exactly.
- **Renderers moved.** `promise_html` and `glance_html` to Requirements;
  `part_html`, `shape_svg`, the walkthroughs, the layers, the devices, the
  tangles and the alternatives to Design, inside the earlier candidate's
  fold (`earlier_html`); `card_html`, `n1_html`, `parity_html`,
  `grid_html` and the set-aside table to Today's engine; `question_html` and
  `page_changes` stay where they were, rebuilt for the v9 fields.
- **New renderers.** The timeline (done, now with the current item marked
  "Now" and `aria-current="step"`, next); the qualities and growth lines on
  the front page; the world picture (`world_src`); Decided lately; the
  quality targets (`qt_html`), extension cases (`ex_html`), growth groups
  (`growth_groups`), standing rules; the decisions ahead, decided
  directions and later choices on Design; the topics of decided entries on
  Decisions; the three new change-log tables.
- **Markers.** `rich()` resolves `[[promise:]]` (to `requirements.html`),
  `[[part:]]` (to `design.html#<plan v1 part slug>`), `[[flaw:]]` (title
  only, to `today.html#cN`), `[[q:X]]` ("question X", capitalised at a
  sentence start), `[[qt:]]`, `[[ex:]]`, `[[dec:]]` (title from
  `decisions.decided`, to `decisions.html#dec-<slug>`) and `[[page:]]` with
  the six v9 names. `[[page:promises]]`, `[[page:parts]]` and
  `[[page:flaws]]` stop the build. Slugs: `slug()` lower-cases and turns
  every run of non-letters into one hyphen; the build checks that every
  decided entry's, topic's and decision-ahead's slug equals the slug of its
  title. Part anchors keep plan v1's rule (apostrophes dropped), as plan v2
  asks for the earlier candidate.
- **Promise titles in the requirements.** Each quality target's and
  extension case's `promises` field is mapped from exact title to promise;
  a title that matches no promise stops the build. The map gives each
  promise its "Served by" lists and the glance table its counts.
- **Growth groups.** Each extension case falls in the group of the
  `front.growth` item whose line links it with `[[ex:]]`, in marker order;
  a case in no group or in two stops the build. All 24 fall in exactly one
  of the six groups.
- **The fold opener.** Every page ends with one inline script
  (`OPEN_SCRIPT`, 14 lines, no library) that opens each `<details>` holding
  the hash's target, on load and on `hashchange`, then scrolls to it. The
  script check allows exactly that script and nothing else. Tested: loading
  `design.html#alt-delivery` and clicking a later choice's link both open
  the earlier candidate's fold.
- **The world picture.** `front.worldMermaid` renders without error, so the
  overlay was not touched. As written it lays out badly under Mermaid's
  layout engine (2,107 by 1,641 pixels, one outside box stretched across
  the whole picture, a group title covering a box). The builder draws it
  with three changes of presentation only, and checks that no node, label,
  edge or group title changes: it keeps the left-to-right direction (other
  flowcharts are still turned top-down); it draws the four receiving nodes
  of the outside group (TV and scoreboards, Audience, Director's console,
  Director) in a second box carrying the same title, so the layout can
  place them after the engine; and it draws group titles as plain text
  (`htmlLabels` off) with a small title margin, so a long title takes its
  own room. Result: 1,983 by 1,113 pixels, outside on the left, the
  protocol as the middle column, the engine, the programs on the right;
  readable at natural size in its scroll box at 400 pixels. For the writer:
  if the second box with the same title is not wanted, the source itself
  needs another arrangement.
- **Prose count.** The build prints each page's bytes and prose words
  (version 8's count) and, for the front page, two counts without the
  moments and the words: all words, and words in sentences (headings,
  figure captions and the small labels left out). The check warns above
  2,500 sentence words and fails above 2,625 (5 per cent over "about
  2,500"). See section 6.

## 2. Where each version 8 section went

| Version 8 page and section | Version 9 home |
|---|---|
| index: header and lead | index: header, `front.lead` (new text) |
| index: Where things stand (open, decided lately, what comes next) | index: Where the work stands (`front.timeline`), What you can do now (`front.now`), Decided lately (`front.decidedLately`) |
| index: What the engine is for | index, unchanged |
| index: Who counts on the engine, and when | index, version 8's moment rows, `front.moments`, with `front.standaloneLine` |
| index: How it fits together: the whole-engine picture and its key | design: The earlier candidate (fold), "The earlier candidate, whole", rows I12 to I18 applied |
| index: How it fits together: the four passages (`front.fitSummary`) | design: the same section; version 9's front overlay has no `fitSummary`, so the builder's `FIT_SUMMARY` (the same four passages, version 7's wording) renders under the picture, in the plain wordings (wordings 8, 9, 10, 15, 66) |
| index: Around the engine (cards and diagram) | replaced by index: The engine in its world (`front.worldMermaid`, `front.worldKey`); the cards are dropped: the v9 front overlay no longer carries `around`, and the world picture and its key name the outside programs, the content source, the Director Console and the night's record |
| index: How to use these pages | index: The pages (`front.siteGuide`) |
| index: The words | index: The words, three groups (the site's words, the names of the steps, the words the design rounds use) |
| decisions: header | decisions: header (`decisions.intro`) |
| decisions: Open now | decisions: Open now, three groups, A to O |
| decisions: Coming in step 3 (`id="step-3"`) | decisions: Coming in the design rounds (`id="design-rounds"`): the six rounds, each linked to its `d-<slug>`, then the later choices; the six with an alternatives row link to `design.html#alt-*` |
| decisions: Decided (numbered) | decisions: Decided, by topic (`t-<slug>`, entries `dec-<slug>`), with a link to the change log's old numbers |
| promises: header | requirements: header (`front.intros.requirements`) |
| promises: The ten at a glance (lead-in and table) | requirements: The promises, glance table with new columns (who, when, quality targets, extension cases); the lead-in (`FIT_SUMMARY[3]`) moved to the earlier candidate's fold, since it says which parts keep which promise |
| promises: How the promises depend on each other (two diagrams) | design: The earlier candidate (fold), same title; the diagrams come from the studies the earlier candidate was drawn from |
| promises: the ten entries | requirements: the ten entries (anchors kept), with the changes in section 3 |
| parts: every section | design: The earlier candidate (one closed `<details>`): qualities (`candidate-qualities`), layers, the five walkthroughs (`walks`), the seventeen part cards (part-slug anchors), which part runs where, the tangles, the alternatives (`alt-*`, every cell through `rich()`) |
| flaws: header and legend | today: header (`front.intros.today`); the legend sits over the glance table |
| flaws: The flaws at a glance | today: Sixteen situations, glance table (titles only; parts column dropped, see section 3) |
| flaws: The cards | today: the sixteen cards (`c1` to `c16`), grouped by the promise each mainly touches; the proposed seventeenth (`n1`) after them |
| flaws: Standalone games | today: Standalone today, inside one closed `<details>` |
| flaws: The evidence | today: The evidence (totals 337, 21, 358; set-aside table; code grid) |
| changes: every section | changes: kept, version 9 first; plus the three tables |

Dropped, with the reason:

- The promise entries' "Built today" row: moved to Today's engine, What
  works today (the brief). Note for the front writer: `front.intros.requirements`
  still says "Built today says what already exists for it"; the entry no
  longer has that row.
- The promise entries' "Kept by these parts" row: the requirements say what
  is needed, not how; each part card on Design lists the promises it keeps.
- The glance table's parts column on the flaws page and the "Parts that
  would keep it" column on the promises page: same reason; a card's parts
  now sit inside its fold, "How the earlier candidate would remove it".
- Version 8's front-page "Around the engine" cards: no v9 overlay field
  (the front writer replaced the section with the world picture).
- Visible ids: the cards' and part cards' flaw ids (`cid`), the finding ids
  in "The problems behind it" (row F7), the ids in the grid's row labels.
  The change log keeps its card ids, as plan v2 allows.

## 3. Jargon rows

### `build_site.py` constants and renderers (69 rows)

Applied as written: I11 (no change), I12, I13, I14 (three lines in the
Verdict box, now 68 pixels tall), I15, I16, I49 (adapted to three word
groups), I50, P7, P8, P12 (no change), P21 to P30 (a table of the nine
question names, `PASS_QUESTIONS`, in each promise's test summary and in each
card's question line), P31, P40, P55, P79, A9, A10 and A11 (no change), A12,
A13, A14, A57, A58, A59, A60, A61, A75, F6 (`chips()`: "A fix on blue points
here", "Two fixes on blue point here" and so on), F7, F135, F137, F158,
F160, F161, F162, F163, C35, C47, C59.

Applied with the plan's names where it overrides the table:

- I1: the status line is plan v2's sentence.
- I17, I18: applied; "the Parts page" is now "below", on the same page.
- I54, D56, P107, P108, A119, F164, C79 (footers): applied for the source
  names; "your decisions 20 to 29" is "the decision record" (no bare
  decision number), "the candidate shape" is "the earlier candidate"
  outside the change log; the footers are rewritten for the six pages.
- D3: the tag reads "Recommendation changed by the earlier candidate", as
  `decisions.intro` names it.
- D44: "Coming in the design rounds, no answer needed now"; the anchor is
  plan v2's `design-rounds`, not `step-3`.
- D45, D46: replaced by one intro to the later choices (`LATER_INTRO`): the
  design rounds now go one decision at a time, and "After the test rig" is
  overtaken by the decision "Build the test rig when building starts".
- P92: applied, with "the rig is built again when the build half starts"
  for "rebuilding it is the next step" and the test level by its name.
- A102: "drawing the earlier candidate" for "drawing the candidate shape".
- F82: applied; the question is now `[[q:G]]` (the letters changed).
- F136: the fold's summary reads "Standalone games today, and the hardware
  scanner against the phone's scanner with no engine: 24 differences".
- F157: applied; the flaws are "the sixteen situations", and N1 is "the
  proposed seventeenth" by its title, not "N1".
- F159: "Plain fixes for the build half".

Not rendered in version 9: none of the 69; every row's constant or renderer
still renders on one of the six pages.

### Parity cells through `PARITY_WORDS` (19 rows)

All 19 applied: F138 (row 1, cells 1 and 3), F139 (row 2), F140 (row 3),
F141 (row 4), F142 (row 6: cell 1's start through `PARITY_PREFIX`, the rest
of the cell kept; cell 2), F143 (row 7), F144 (row 8), F145 (row 9), F146
(row 10), F147 (row 11), F148 (row 12, cell 1, beside version 8's cell 3),
F149 (row 14, cell 2, beside version 8's cell 3), F150 (row 15), F151 (row
16), F152 (row 17, cell 1), F153 (row 18, cell 2's start through
`PARITY_PREFIX`), F154 (row 19), F155 (row 21, cell 1), F156 (row 24).

Beyond the 19 rows, by wordings 29 and 66 (the retired-word check found
them): row 17, cell 2 ("Red Wi-Fi and engine lines, queue count", for
"orchestrator"); rows 21 and 22, cell 3 ("Nothing; the hardware scanner is
ahead here", for "the ESP32"). Version 8's row 12 cell 3 now names the flaw
by its title ("Tablets and phones decide facts the engine owns") instead of
its id, which the visible-id check bars.

## 4. The retired words

Allowed on `changes.html` only; the build fails on any other page. The
brief's list, then every other term from the table's "Term as it appears"
column a pattern can match here without a false positive:

job (but not "kind of job", jargon wording 20's own plain wording for a
capability, and not "a developer's job", see section 7), installer, orchestrator (but not where it names the agent
running the pass: "the orchestrator's reasoning", "the orchestrator (the
agent running the pass)", "the orchestrator's recommendations"; see section
7), the planning half, the building half, the map, relationship map(s),
hot-apply, preview instance/engine/profile, "capability" or "capabilities"
followed by a number, the designer's week, the developer's proof(s), the
cause analysis, the standalone pass, parity table, the program's state page,
the capability map, the engine-shape document, the promises document, the
shared vocabulary, the old container, start-or-adopt, interaction
primitive(s), session bundle, two-pack proof, toy pack, deploy chain, Deploy
stage, auth tier(s), activation gate, start gate, web (player) scanner,
ESP32, the session validator, snapshot builder(s), catch-up or full
snapshot(s), envelope(s), pack stamp, supervision shape(s), per-engine
names, the floor, described set, handoff, kiosk, MPD, ducking, step 3.

Left out because a pattern would match a legitimate use: "the program
document" (a decision's title, "The owner ratified the program document");
"snapshot" alone (the flaw title "Reconnect snapshot and live update are
built apart", kept by the table's "Not touched" list); "phase" (the game's
phase); "rule" (game and standing rules); "proof" ("Proof", a quality);
"preview" (the preview block); "instance" (the part "Engine instance");
"dormant" (the words box explains it); "boundary", "seam", "locality",
"stamped", "cutover", "supervisor", "candidate shape" (still in the data
files' plain wording, by the table's own rows).

The other two checks: no visible id outside the change log (J1 to J10, C1
to C16, N1, QT and EX ids, finding ids such as A-05 or X-08), and no bare
"phase N", "step N", "round N", "block N", "decision N" or "question N";
both read the visible text without the navigation (whose count reads
"Decisions 15") and without the code-file lists.

## 5. Checks and the smoke test

The build's checks (version 8's, kept: every link and anchor resolves; no
unresolved marker; no duplicate id; every diagram placed, 42 in one call of
`render_diagrams.js`; every stylesheet colour a token; the page shells; the
evidence totals 337, 21 and 358. Added: no visible id outside the change log;
no bare sequencing number outside it; every promise, quality target,
extension case, flaw, question and decided entry exactly once as an entry
on its home page, and every part of the earlier candidate once on Design;
titles unique within each kind (promises, targets, cases, flaws, questions,
decisions, decisions ahead, standing rules); the retired words; every
`[[dec:]]` slug, design-round link and later choice's `alt` resolves; no
link to `promises.html`, `parts.html` or `flaws.html`; the earlier
candidate one closed `<details>` with Joins and proofs marked replaced; the
status line exact; the one allowed script; no em dash).

Result of the last run (after the other agents' corrections to `rules.json`
and the requirements files, 22:16 to 22:18): all checks passed, 1,453 links
resolve, 42 diagrams drawn in one call; one warning, the front page's prose
(section 6).

The smoke test (`site_smoke.js`): the six pages at 1100 and 400 pixels,
light and dark, 24 loads, failing on a console or page error, sideways body
scroll, a `.dia-svg` without its svg, a link to a missing file or anchor,
and any link to a retired page. Result: passed, 24 loads, 24 screenshots in
`/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad/site-shots-v9`.

Screenshots read: index, requirements and today at 400 pixels in dark;
decisions and design (with the earlier candidate opened) at 1100 in light;
the world picture at 1100 and 400. Fixed after reading them: the world
picture's layout (section 1); the earlier candidate's summary (its fold
marker on its own line); the pieces already well built (a link broke its
sentence into rows); the Verdict box (three lines); spacing between the
standing rules' groups; the situations table's first column.

## 6. Each page's size and prose

| Page | Bytes | Prose words (version 8's count) |
|---|---:|---:|
| index.html | 116,444 | 5,831 |
| decisions.html | 100,299 | 8,994 |
| requirements.html | 223,451 | 25,495 |
| design.html | 411,378 | 11,253 |
| today.html | 643,037 | 9,351 |
| changes.html | 113,345 | 6,991 |

The front page without the moments and the words: 2,691 words in all,
2,614 in sentences. That is about 4.6 per cent over 2,500, so the build
warns and does not fail. The excess comes from rendered markers (24
extension-case titles in "How it must grow", decision titles in "Decided
lately", promise and target titles) and the promises' `purpose` paragraphs
(292 words), which the front writer's estimate of about 1,970 words did not
count. The builder does not cut overlay text; a shorter front page means
shorter `front.growth`, `front.qualities` or `front.decidedLately` lines.

## 7. Input problems (also in notPlaced)

1. **"a developer's job"** in extension case "A different installed game each
   night" (`why`, `requirements/2026-11-01-extension-cases.json`). "Job" is a
   retired word; the requirements corrector finished without changing it.
   The builder excepts this one phrase (everyday sense, a task) so the build
   passes; the requirements writer should reword it ("never work for a
   developer").
2. **"orchestrator" for the agent running the pass**: `front.json`
   (`decidedLately`, the words box's "The panel"), `decisions.json` (two
   decided lines). The builder excepts the three phrases; the owner may not
   know the word, and the writers could say "the agent running the pass".
3. **"kind of job" against "kind of thing"**: `design.json` `later[4]` and
   the earlier candidate's data say "one per kind of job the room can do"
   (jargon wording 20); `decisions.json` `later[4]` says "one per kind of
   thing the room can do". The same choice reads two ways on two pages.
4. **`front.intros.requirements`** still describes a "Built today" row in
   each promise; the brief moved that row to Today's engine.
5. **`front.worldMermaid`** renders, but its layout is tangled as written;
   the builder's three presentation changes (section 1) make it readable.
   If the second outside box with the same title is not wanted, the source
   needs another arrangement.
6. **The front page's length**: 2,614 words of sentences without the
   moments and the words, about 4.6 per cent over 2,500 (section 6).
7. **Quality target numbering**: the targets run QT1 to QT43 without QT28,
   so the anchors run `qt1` to `qt43` without `qt28` (42 targets). Not an
   error for the site; noted because the brief says "qt1, qt2, ...".
