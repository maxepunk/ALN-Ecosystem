# Build log: the owner's site (version 8)

Written 2026-11-01 by the builder. Plan: `site/2026-11-01-site-plan.md`. Inventory:
`site/inventory.md`. Builder: `report/build_site.py`. Smoke test: `report/site_smoke.js`.

Run:

```
cd docs/plans/architecture-pass/report
MERMAID_JS=<path>/mermaid.min.js python3 -I build_site.py
node site_smoke.js site <shotsDir>
```

## Results

- **Build checks (plan 5.2): passed.** 886 links resolve (every `#x` and `page.html#x` finds its id;
  no own-page links outside the nav); every marker resolves; no promise id (J1 to J10) in the visible
  text of any page, SVG labels included; "job" and "installer" appear only on `changes.html`; each
  promise, part and flaw (N1 included) appears once as an entry on its own page; each of the 13
  question keys appears once; the plan's anchors exist; the six step-3 links to alternatives rows
  exist; every diagram is placed as an inline SVG; no page carries a script or Mermaid; the
  stylesheet has no literal colour outside the `:root` token blocks (apart from the attribute
  selectors that restyle Mermaid's fixed presentation attributes), and every `var(--x)` it uses is
  defined; `index.html` starts with its title and the viewport-fit-sides meta and has no doctype,
  html, head or body; the other five are full documents; the evidence totals computed from the data
  are 337 under the flaws, 21 set aside, 358 in all.
- **Diagrams:** 42 drawn in one call of `render_diagrams.js` (Mermaid 11.4.1 from `MERMAID_JS`):
  1 on the engine page (around the engine), 2 on promises, 7 on parts, 32 on flaws. Every one passed
  `diagram_theme.theme_svg()` with no unmapped colour.
- **Smoke test: passed, 24 of 24 loads** (6 pages × 1100 and 400 px × light and dark): no console or
  page error, `scrollWidth` equal to the viewport on every load, every `.dia-svg` holds its svg, every
  link to a site page finds its file and anchor. Screenshots:
  `/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad/site-shots/<page>-<width>-<theme>.png`.
- **Looked at by eye:** index and flaws at 400 px dark, decisions and parts at 1100 px light, plus
  clips of `#n1`, `#every-tap` and `changes.html#rec-f`. Two faults found and fixed (below).

## Sizes and prose words

Prose words count the visible text outside tables, diagrams, code, the nav and the footer.

| Page | Bytes | Prose words | Plan target |
|---|---:|---:|---|
| `index.html` | 94,814 | 4,553 | 2,000 to 2,800 |
| `decisions.html` | 62,038 | 4,853 | 2,500 to 3,500 |
| `promises.html` | 145,966 | 7,343 | about 6,000 |
| `parts.html` | 280,814 | 4,767 | 6,000 to 7,000 |
| `flaws.html` | 634,541 | 8,240 | 9,000 to 11,000 |
| `changes.html` | 65,096 | 5,573 | 3,000 to 4,000 |

The engine, decisions and change-log pages run over their targets because the overlays are longer
than the plan expected (front.json's "around" and "moments", decisions.json's evidence lines,
changes.json's version items); the builder renders every field and cuts nothing. Parts and flaws
fall under theirs only because their tables are not counted.

## What was ported, and what changed

Copied verbatim from `build_report.py` (by line range, so nothing was retyped): `RUNS_ON`, `BUILT`,
`PARTS`, `OUTSIDE_NINE`, `chips()`, `INIT`, `SEQ_INIT`, `present()`, `SET_ASIDE`, `parity_rows()`,
`part_layers()`, `MECH_PART`, `QUALITY_KEEPS`, `today_of()`, `FIT_SUMMARY`, `OVERVIEW`,
`FIT_DEVICES`, `wrap_label()`, `shape_svg()`, `WALKS`, and the whole TEMPLATE stylesheet (braces
undoubled). `build_site.py` does not import `build_report.py`.

Adapted:

- `card_html`: no "what changed" note; part chips link to `parts.html`; card titles are h4 under
  promise-group h3 headings; diagrams go through the diagram registry.
- `job_html` became `promise_html`: no "Promise" kind label, no earlier wording, no "what changed"
  note, no nested cards; order per plan 3.3.4 (title, who and when, what they count on, built today,
  the goal, kept by, broken by with the main flaw first, standalone, the two folds); every flaw line
  links to `flaws.html#cN`; secondary lines lose the "(its card is under ...)" note; N1 lines say
  "(proposed)" and link to `flaws.html#n1`; the fallback line is kept.
- `part_html`: anchors by name (`part_anchor()`); h3; N1 in "Removes" links to `#n1`.
- `glance_html`: rebuilt as plan 3.3.2 asks (title, who, when, parts, flaws with "Main" first; "none
  yet" kept for the promise with no main flaw; "N1 (proposed)" kept).
- `grid_html`, `parity_html`, `overview_src`, `relations_src`: links made site-relative; otherwise as v7.
- Stylesheet: diagram tokens (`DIAGRAM_TOKENS_LIGHT` in the light `:root`, `DIAGRAM_TOKENS_DARK` in
  both dark blocks) and three site tokens (`--nav-bg`, `--on-accent`, `--line-strong`) joined the
  blocks; `DIAGRAM_CSS` appended; both `pre.mermaid` rules moved to `.dia-svg` (including the
  walkthroughs' 720 px minimum); the overview key's swatches use `--accent`, `--warm`, `--muted`
  instead of literals; the gutter moved from `.wrap` to the outer `.site` wrapper (set once);
  `scroll-margin-top` raised to clear the sticky nav.
- New: the sticky nav (`top: env(safe-area-inset-top, 0px)`, a fixed `body::before` band, full-bleed
  background by box-shadow so nothing widens the page; wraps to two lines at 400 px), the status
  line, the footers, a skip link, the moments columns, the where-things-stand blocks, the "around"
  cards, the question blocks with status tags, the decided list, the change-log entries, visible
  focus everywhere, reduced motion respected.

Faults found by eye and fixed:

1. The status classes `open` and `changed` on question blocks collided with v7's `.open` (red, bold)
   and `.changed` (grey box) rules, so every open question rendered in red. Renamed to `q-open`,
   `s-open` and so on.
2. v7's `.part` card rule also matched the part chips (`a.chip.part`), giving every chip 14 px of
   padding (50 px tall chips; v7 had the same fault). The card rules now apply to `article.part` only.

## Builder choices the plan did not settle

- `[[q:promises]]` renders "the promises question" ("The promises question" at a sentence start).
- `[[flaw:N1]]` renders "Nothing declares a game standalone", question C's own words for the flaw,
  since N1 has no record in the cards data.
- In the step-3 list, `[[page:parts]]` links to the item's row in the alternatives table
  (`parts.html#alt-delivery` and so on; rows carry `alt-*` ids, which plan section 2 does not list).
- Question headings carry their key ("A. ", "22. "); the promises question has none, as in v7.
- Footers name the documents in words ("the promises document of 2026-10-31"), not by file: the file
  names contain the retired word "jobs", and plan section 6 says the page never cites files.

## Placement by inventory row

Every row with a site home is placed. Rows 6, 7, 9, 39 are duplicates (their kept copies are in place);
rows 18, 41, 44, 56, 86 are change-log rows (rendered on `changes.html` from `changes.json`).

| Rows | Placed |
|---|---|
| 1 | `index.html` starts with the title and viewport-fit-sides meta; the other five carry "Page · What the Engine Promises" |
| 2 | One stylesheet inlined in all six pages, v7 tokens unchanged plus `--dia-*` and site tokens |
| 3, 4, 5 | `index.html` header: the plan's eyebrow, the h1, `front.lead` |
| 6, 7, 9 | Duplicates: kept in `front.siteGuide` (6), `decisions.html#decided` decision 26 (7) and decision 27 plus `front.whereYouAre.decided` (9) |
| 8 | `index.html#where` (`front.whereYouAre`) and the `decisions.html` intro |
| 10 | `index.html#purpose`, EJ `purpose` as it is |
| 11, 12, 13 | `promises.html` header (`front.intros.promises`); `flaws.html` header (`front.intros.flaws`) with v7's legend |
| 14, 15 | `index.html#words`: v7's intro (adapted to "The site's own words") and `front.words` in two groups |
| 16, 17 | `promises.html#glance`: h2 and the restructured table, "none yet" and "N1 (proposed)" kept |
| 18 | Change log: `changes.versions` (version 5's prompt) |
| 19 | `index.html#fit`: `front.fitSummary`, markers resolved |
| 20 | `promises.html#glance`: `FIT_SUMMARY[3]` as the table's lead-in (gaps resolved) |
| 21, 22, 23 | `promises.html#depend`: overview diagram (nodeSpacing 20, classes themed `--accent`, `--warm`, `--muted`) with v7's key; the 25 links folded with the 23-dependency note |
| 24 | `parts.html#qualities`: v7's intro and table; quality 4 carries its "Today" text; promise links |
| 25 | `parts.html#tangles`: folded, 13 tangles with flaw links; the note now points to Design flaws |
| 26 | `parts.html` header (`front.intros.parts`); heading "The seventeen parts" (`#the-parts`) |
| 27, 28 | `index.html#fit`: `shape_svg()` with its key; "below" and "further down" now name the Parts page |
| 29, 30, 31 | `parts.html#moments`: "Five moments, part by part", v7's reading key under the heading, five walkthroughs with "Keeps" links, drawn compact at 720 px minimum |
| 32 | `parts.html#layers`: the layers figure and caption, chips linking to the cards |
| 33 | `parts.html#the-parts`: 17 cards, all seven fields, bottom row first, anchors by name |
| 34 | `parts.html#layers`: folded "Which part uses which: 54 links" with the "uses" note |
| 35, 36 | `parts.html#where-they-run`: `FIT_DEVICES` and the folded components diagram |
| 37 | `parts.html#alternatives`: intro and 8-row table, rows anchored `alt-*` |
| 38, 40, 42, 43 | `promises.html`: ten entries in EJ order, anchors per plan 2, title h2, who and when, what they count on |
| 39 | Duplicate: kept as the page h1 "Promises" |
| 41, 44 | Change log: `changes.promises` (earlier wording, what changed) |
| 45, 46, 47 | Each entry: kept-by part chips, built today (`BUILT`), the goal with "(open for step 3)" on the lifecycle promise |
| 48, 49, 51, 52 | Each entry: "Broken by", main first, every flaw linked to `flaws.html`, N1 "(proposed)", fallback branch kept |
| 50 | `flaws.html#cards`: cards grouped under the promise each mainly breaks |
| 53, 54, 55 | Each entry: standalone line; folded needs; folded tests with "Answers the pass's questions ..." in the summary |
| 56 | Change log: `changes.cards` |
| 57 to 72 | `flaws.html`: 16 cards, `#c1` to `#c16`, every v7 field except the "what changed" note: id and title, chips (findings, questions, clue from blue, seen live), at a show, why, seen-live note, standalone, both diagrams themed, removed-by parts, design terms, folded problems and code |
| 58, 59, 62, 69 (table) | Also in `flaws.html#glance`: id and title, findings, seen live, parts that would remove it |
| 73 | `flaws.html#n1`: short entry under "The game fits the venue it is in tonight", from EJ's four N1 lines, its parts (Pack channel, Venue fit), 8 findings counted from the standalone pass, pointing to question C |
| 74, 75, 76 | `flaws.html#standalone`: v7's two paragraphs and the folded 24-row parity table |
| 77, 78, 79 | `flaws.html#evidence`: totals computed (358, 337, 21; 35, 27, 8 from the standalone data), N1 and question C linked; set-aside table folded; the grid folded |
| 80, 81, 82, 83, 84, 85, 87 | `decisions.html`: h1 and intro; four groups in order; 13 question blocks with status tags (A, B, C applied; E, F, G changed; the rest open), what it decides, what we know, options with costs, recommendation or suggestion |
| 86 | Change log: `changes.recommendations` (E, F, G) |
| 88 | `decisions.html#step-3`: v7's "The map leaves these choices to you." and intro, 12 items, six linked to alternatives rows |
| 89 | `decisions.html#decided`: 20, 22, 26, 27, 28, 29 with dates and lines |
| 90, 91 | Every page's footer names its documents; 171 and 53 in the promises footer; the four relationship maps in the promises, parts and flaws footers |
| 92 | All 42 diagrams drawn at build time, inline SVG, themed; `present()` sizing kept |
| 93 | All in-page links rebuilt as site links with the plan's anchors, checked by the build and the smoke test |

## Not placed, and observations for the writers

Nothing with a site home is unplaced. Observations (no data file, overlay or plan was edited):

- `changes.json` still lacks the two footer facts inventory note 4 names (the 171/53 check for version
  3; the four maps under `relationships/` for version 5). The footers of `promises.html` and
  `parts.html` carry them, as the note allows.
- `front.aroundMermaid` is written `flowchart LR`; `present()` turns every flowchart top-down, so the
  diagram draws tall and sparse. Writing it for TD, or exempting it, would read better.
- Flaw markers render the full flaw title, so lines such as "the two clocks join Tablets and phones
  decide facts the engine owns" read stiffly; `[[flaw:C9|C9]]` would read better in those places.
- The overlays push the engine, decisions and change-log pages over the plan's word targets.
- On a phone, a wide flowchart opens at its left edge in its scroll box, as in v7; some card diagrams
  show empty space there until scrolled.
