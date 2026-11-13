# Check: `site/inventory.md`

Checked 2026-11-01, refute by default, against: version 7 as published
(`report/2026-10-31-cause-report.html`, read as text with the command in
plan section 7 and as HTML for counts), its builder
(`report/build_report.py`), the data it reads
(`2026-10-31-cause-cards.json`, `2026-10-31-engine-jobs.json`,
`2026-10-31-standalone-lines.json`, `2026-11-01-engine-shape.json`), the
site plan (`site/2026-11-01-site-plan.md`), the three overlays
(`site/front.json`, `site/decisions.json`, `site/changes.json`, for
every "kept copy" the inventory names), `docs/plans/CURRENT-STATE.md`
section 0 (decisions 20 to 29) and `2026-10-30-cause-analysis.md` (the
totals).

**Result: 15 conflicts in 218 items checked** (93 rows of table 1, 77
of table 2, 31 of table 3, 13 lines of the counts table, 4 builder
notes). Four are wrong figures (rows 27, 35, 73 and the field-kind
count), two are unflagged gaps (row 20's dropped synthesis, row 21's
two unmapped colours), three are kept copies that do not hold the
content named, and the rest are wrong cross-references or sources.

## Conflicts

| # | Where | What it says | What it should say | Source that shows it |
|---|---|---|---|---|
| 1 | Counts table, "Field kinds listed once" | "promise entry / flaw card / part card / walkthrough: 17 / 17 / 8 / 3" | "18 / 17 / 8 / 3". Section C lists 18 field kinds (rows 38 to 55); section D lists 17 card field kinds (rows 56 to 72) plus N1 (row 73). No consistent rule gives 17 for both: dropping the container row 38 would also drop row 57. | `inventory.md` table 1, sections C and D; BR `job_html`, `job_head`. |
| 2 | Row 11, last clause | "\"the changed note\" is now in the change log (rows 38, 56)" | "(rows 44, 56)". Row 38 is the entry section; the promise's "Changed after the relationship map" note is row 44. | `inventory.md` rows 38 and 44. |
| 3 | Row 12 | Home `flaws.html` header via `front.intros.flaws`; the row is silent on the paragraph's sentence "Where the relationship map changed a card, a note at its top says what and why." | Add: that sentence is history and goes to `changes.cards` (row 56), as row 8 says for the same clause. `front.intros.flaws` does not carry it. | v7 `section.howto` first `div`; `front.json` `intros.flaws` (three paragraphs, no changed-note sentence); `changes.json` `intro`. |
| 4 | Row 17 | "Empty cases render \"none yet\" (the designer's promise)" | Name it by title: "none yet" sits on "The designer changes a value and plays it within minutes, and the live show never notices"; "The designer's game is the game the whole kit plays" has C12. In the plan's single flaw column that promise is not empty (C8, C12), so what the builder keeps is "no main flaw", not an empty cell. The empty "Also touched by" cell of "Each person sees their part and can do only their part" goes unmentioned. | v7 glance table; BR `glance_html` (`or '<span class="muted">none yet</span>'` on primaries); EJ J6 flaws C8, C12 both non-primary; EJ J7 flaws C13 only. |
| 5 | Row 7 | "also in `front.intros.flaws` (\"came from blue's records\")" | Drop the quote: no overlay holds "came from blue's records". `front.intros.flaws` says the findings come "from blue's shows and from the maps of today's engine" and nowhere says "not as the plan". The kept copy that holds the substance is decision 26's line ("clues to where today's design is off, never the driver"). | `front.json` `intros.flaws`; `decisions.json` `decided` n 26; grep of the three overlays. |
| 6 | Row 9 | Kept copies: `decisions.html#decided` decision 27's line and `front.whereYouAre.decided`. | Also name `changes.json` `vocabulary[0]` ("Promise, not job"). Neither named copy carries v7's clause "\"job\" is gone", and plan section 6 allows "job" only on the change log, so that clause can only live there. | v7 `p.decided-note`; `decisions.json` `decided` n 27; `front.json` `whereYouAre.decided[2]`; `changes.json` `vocabulary[0]`; plan section 6. |
| 7 | Row 18 | "the two levels and the candidate shape are restated in `front.intros.parts`" | The candidate shape is restated there; the two levels (the engine and the devices it talks to; the parts inside them) are not. They are held by `changes.versions` version 5's `prompt` ("at both levels (the big components and the modules inside them)"). | `front.json` `intros.parts` (three paragraphs); `changes.json` `versions[3].prompt`. |
| 8 | Row 20, and the counts table | Disposition **duplicate**, kept copies at three places; the row itself says "the one-line synthesis itself is written nowhere on the site". | **GAP**. A duplicate needs one kept copy holding the same content (plan section 6). The qualities table holds the two quality-kept promises, but "most promises are kept by one or two parts of their own" and "the lifecycle promise rests on a table of moments that most other promises read" have no copy: `front.fitSummary[1]` lists the moments without saying other promises read them. Put the passage, or its synthesis, in `front.fitSummary` or `front.intros.parts`. Counts then read duplicate 4, GAP 3 (rows 30, 20, 55). | BR `FIT_SUMMARY[3]`; `front.json` `fitSummary` (four passages, the fourth now "The night's record, after the end"); plan section 6, last rule. |
| 9 | Row 21 | "the class colours map to tokens" | Unflagged GAP. The overview's `classDef` lines use three colours: `#0f766e` (tap), `#b45309` (machine), `#6b7280` (outside). Plan 5.1 maps only `#dc2626` to `--fault` and `#0f766e` to `--accent`, and the build "fails, naming the diagram and the colour, if any colour literal is left unmapped". `#b45309` and `#6b7280` need tokens in plan 5.1 (light and dark) or the overview's classes restyled. No other diagram source carries a colour. | BR `OVERVIEW` (classDef tap, machine, outside); plan 5.1; scan of every Mermaid source in CC, ES, `OVERVIEW` and `WALKS`. |
| 10 | Row 24 | "`QUALITY_KEEPS` and the \"Today\" line for quality 4 live in BR, not in the data" | `QUALITY_KEEPS` lives in BR; the "Today" text lives in the data, ES `mechanisms[10].plain` ("Today a tap on the tablet, a URL path on the phone, ..."). BR only selects it (`quality_today = {3: today_of(shape['mechanisms'][10]['plain'])}` in `fit_html`). | BR `fit_html`; ES `mechanisms[10]`. |
| 11 | Row 27 | "22 labelled arrows" | "20 labelled arrows". `shape_svg` makes 20 `arrow()` calls, each with a label; the published SVG has 20 paths with `marker-end` (its 22 paths include the two arrowhead markers). | BR `shape_svg`; v7 `svg.shape-svg`. |
| 12 | Row 35 | "three carry \"Today ...\" and two an \"open choice for step 3\"" | "four carry \"Today ...\"": the networked GM tablet, the scoreboards, the config tool and the tests. The two open choices are right. | BR `FIT_DEVICES`; v7 `ul.devices`. |
| 13 | Row 73 | N1 appears in "three part cards' Removes" | "two part cards' Removes": Pack channel and Venue fit. | ES `parts[].flaws` (N1 in P2 and P12 only); v7 `#p2` "C12 C15 N1", `#p12` "N1 C10 C15". |
| 14 | Notes for the builder, note 1 | "Four blocks of text live in `build_report.py`", followed by a list of about ten | Drop "Four" and complete the list: it omits `RUNS_ON` (row 33), `OUTSIDE_NINE` (row 60), `INIT` and `SEQ_INIT` (rows 31, 92), and the texts written inline in `fit_html` besides the two keys: the relations note (row 23), the qualities intro (row 24), the tangle note (row 25), the shape intro (row 26), the moments intro (row 30), the layers caption (row 32), the "uses" note (row 34) and the alternatives intro (row 37). Each must be imported or moved to the data, never retyped. | BR lines 29 to 65, 85 to 90, `fit_html`. |
| 15 | Notes for the builder, note 3 | "Several rows marked **home** also carry a second, historical clause to the change log (rows 8, 11, 18, 84, 90, 91)" | "(rows 8, 11, 12, 84, 90, 91)". Row 18's disposition is **change log**, not home; row 12 carries such a clause (conflict 3). | `inventory.md` row 18 disposition; conflict 3. |

## What I checked and found right

**The counts table against the published HTML.** 1 `h1`, 19 `h2`, 40
`h3`, 17 `h4` (77 headings); 6 `table` (glance, mech, alts, parity,
aside, grid); 40 `figure` (1 overview, 1 whole, 5 walks, 1 layers, 16 +
16 card); 41 `pre.mermaid` (overview, relations, 5 walks, parts,
components, 32 card); 1 inline SVG; 42 `details` (relations, tangles,
parts uses, devices diagram, 10 needs, 10 tests, 16 cards, parity,
grid); 10 `section.job`; 16 `article.card`; 17 `article.part`; 14 `.q`
in 5 `.qgroup`s (13 open questions and the step-3 list). Table 1 has 93
rows numbered 1 to 93 with 81 home, 5 change log (18, 41, 44, 56, 86),
5 duplicate (6, 7, 9, 20, 39) and 2 GAP (30, 55), as the counts say
(conflict 8 moves row 20). Table 3 has 31 rows.

**Table 2, every heading.** A script matched all 77 rows against the
HTML headings in order: tag and text agree for every row (the long
question headings by their prefix). Each card sits under the promise it
mainly breaks, as in v7: C12 under the designer's game; C1, C6, C9, C11
under one game; C7 under every tap; C2, C3 under the room; C4, C5 under
the lifecycle buttons; C13 under each person; C10 under reading a
screen; C8, C14, C15, C16 under the proven change. Every promise and
part anchor matches plan section 2.

**Table 1 against version 7 and the builder.** Every element of the
page has a row: the title and meta, the design system (the Google Fonts
links fall under row 2's "three IBM Plex families"), eyebrow, h1, the
lead's four sentences, the deciding box, the decided note, the purpose
(8 paragraphs), both how-to paragraphs, the legend, the words (8 page
and 7 design terms, verbatim in `front.words`, Director added), the
glance table, the fit intro and four passages, the overview with its
key, `nodeSpacing: 20`, 14 edges and three classes, the relations
diagram (25 edges, 23 dependencies), the qualities (5 rows, quality 4
with its Today line), the 13 tangles, the shape intro, the whole-engine
figure and key, the moments heading and intro, the five walkthroughs
(titles and kept promises right), the layers (8 rows, Top and Bottom),
the 17 part cards in layer order bottom first (8 field kinds; Today on
10 of 17), the 54-link diagram (17 nodes), the 7 devices and the
components diagram (8 nodes, 7 labelled edges), the 8 alternatives,
every promise and card field, the standalone section (24 parity rows, 9
shaded), the evidence, the questions and the footer. The only in-page
link targets in v7 are `#fit`, `#your-questions`, `#jN`, `#cN` and
`#pN`, as row 93 says. The non-functional branch of `job_head` (role
chips) renders nowhere in v7, so it needs no row.

**Figures in the rows.** Earlier wording on 10 of 10 promises (every
`proposedTitle` differs from `title`); `shapeChange` on 10 of 10
promises and 16 of 16 cards; 30 secondary flaw lines, 27 with "(its
card is under ...)" and 3 for N1; N1 rendered 4 times with "proposed,
question 23" (primary under the venue promise, secondary under three);
the fallback line rendered 0 times (J6 has two secondary lines);
`goalOpen` only on the lifecycle promise; "Clue from blue" on 7 cards
(C1, C2, C3, C4, C8, C11, C14); "Seen live" on 8 (C2, C3, C5, C8, C10,
C11, C15, C16); "No question covers it" on C14 (nearest 5), C15 and
C16; 16 standalone lines; the grid of 16 flaws by 9 code areas; the
totals 337 (the sum of CC `findings`), 21 (the sum of `SET_ASIDE`) and
358, with 35, 27 and 8 typed in the template. N1 appears 13 times on
the page: 4 glance cells, 4 promise lines, 2 tangles, 2 part cards, 1
evidence line.

**The homes against the plan.** Every home names a page and a plan
section that exists and holds that content: 3.1.1 to 3.1.8 on the
front page, 3.2.1 to 3.2.4 on Decisions, 3.3.1 to 3.3.4 on Promises,
3.4.1 to 3.4.8 on Parts, 3.5.1 to 3.5.5 on Design flaws, 3.6.2 to 3.6.6
on the change log, plan 2 for the frame and footers, plan 5.1 for the
diagrams. The two flagged GAPs are real: plan 3.4.4 names the
walkthroughs but not their reading key (row 30), and plan 3.3.4 folds
`tests` but names no field for the pass's question numbers (row 55).
Row 77 rightly separates the plan's "358 findings under the flaws"
from the data (337 under the flaws, 358 in all, X-08 now inside C9's
19). Row 60 rightly keeps the pass's question numbers off `[[q:]]`
markers.

**Kept copies that hold.** Row 6: the lead's third sentence is held by
`front.siteGuide` and, closer, by `front.lead`'s new third sentence.
Row 39: the "Promise" label by the page h1. Row 16: the glance note's
rule by `front.intros.flaws`. Row 74: decision 22's sentence by
`front.standaloneLine`. Rows 49 and 51: the "(its card is under ...)"
and "proposed, question 23" notes by the flaws page grouping, `#n1` and
`decisions.json` C. Row 86: E, F and G are in `changes.json`
`recommendations`, and `decisions.json` keeps a pointer line on each.

**Table 3 and the notes.** The front page's six moments, the Review
column's director and players, the eleven "around" entries, the
three-line "what comes next", options on D, E, F, G, 22, 24, 25 and 19,
the twelfth step-3 item, six step-3 links to the alternatives
(delivery, lifecycle, rules, equipment, standalone tablet, scoreboard),
the decided list 20, 22, 26, 27, 28, 29, and EJ `jobChanges` (7 items,
never read by `build_report.py`) all match the overlays and the plan.
Note 2 is right. Note 4 is right: `changes.json` has eight versions,
10 promises, 16 cards, E, F, G and ten vocabulary lines; version 5
carries 182 verdicts and 96 corrected; neither "171 claims and
corrected 53" nor "the four maps under `relationships/`" is in it yet.
