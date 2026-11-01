# Inventory: nothing from version 7 is lost

Written 2026-11-01 for the site plan (`site/2026-11-01-site-plan.md`,
section 6, last rule). It lists every element of version 7 of "What
the Engine Promises" (`report/2026-10-31-cause-report.html`, read as
text with the command in plan section 7, and its builder
`report/build_report.py`) and says where each goes on the six-page
site. The checkers compare the built site against this table.

Each row carries one disposition:

- **home**: the element moves to the named page and section (plan
  section numbers in brackets, such as 3.4.5).
- **change log**: the element is history and moves to `changes.html`;
  the row names the `changes.json` field.
- **duplicate**: the element is dropped because its one kept copy sits
  at the named home.
- **GAP**: the plan places it nowhere; the row says where it should go.

## Counts

| | Count |
|---|---|
| Rows in the element table (table 1) | 93 |
| with disposition **home** | 81 |
| with disposition **change log** | 5 (rows 18, 41, 44, 56, 86) |
| with disposition **duplicate** | 4 (rows 6, 7, 9, 39) |
| with disposition **GAP** | 3 (rows 20, 30, 55) |
| Headings in version 7 (table 2), each with a home | 77 (1 h1, 19 h2, 40 h3, 17 h4) |
| Field kinds listed once: promise entry / flaw card / part card / walkthrough | 18 / 17 / 8 / 3 |
| Tables in version 7 | 6 (glance, qualities, alternatives, parity, set-aside, grid) |
| Figures in version 7 | 40 (1 overview, 1 whole engine, 5 walkthroughs, 1 layers, 16 + 16 card diagrams) |
| Diagrams in version 7 | 41 Mermaid sources + 1 hand-drawn SVG |
| Folded blocks (`details`) in version 7 | 42 |
| Question blocks in version 7 | 13 open questions + 1 step-3 list, in 5 groups |
| Things the plan adds that version 7 lacked (table 3) | 31 |

Counts come from the published HTML: 19 `h2`, 40 `h3`, 17 `h4`, 6
`table`, 40 `figure`, 41 `pre.mermaid`, 42 `details`, 10 promise
sections, 16 cards, 17 part cards, 14 `.q` blocks in 5 `.qgroup`s.

## Table 1: every element of version 7

"Where" names the version 7 section and the builder code that renders
it. "v7" is the published page; "BR" is `build_report.py`; "EJ" is
`2026-10-31-engine-jobs.json`; "ES" is `2026-11-01-engine-shape.json`;
"CC" is `2026-10-31-cause-cards.json`; "SL" is
`2026-10-31-standalone-lines.json`.

### A. The top of the page (BR `TEMPLATE`)

| # | Element | What it is | Where in v7 | Disposition | New home, or the kept copy |
|---|---|---|---|---|---|
| 1 | Page title | `<title>What the Engine Promises</title>` and the viewport meta | first two lines of `TEMPLATE` | home | `index.html` keeps both unchanged; the other five carry `<Page> · What the Engine Promises` (plan 1) |
| 2 | Design system | The `:root` tokens, the three IBM Plex families, light and dark, every rule in `<style>` | `TEMPLATE` `<style>` | home | every page, one CSS string inlined, unchanged (plan 2); new `--dia-*` tokens join the `:root` blocks (plan 5.1) |
| 3 | Eyebrow | "Architecture pass · phase 1, step 1 · the engine's promises and how they fit together · 2026-11-01" | `header.top p.eyebrow` | duplicate: kept at the status line on every page (plan 2) | the status line says the pass, the step and the date; the page title clause is the site's `h1`. No eyebrow on `index.html` (plan 3.1.1, settled after the page checks) |
| 4 | h1 | "What the engine promises" | `header.top h1` | home | `index.html` h1 (3.1.1) |
| 5 | Lead, sentences 1 and 2 | "The engine runs shows for any game, not only ALN. This page starts from its ten promises: what each person can count on, when, and what must happen for them." | `header.top p.lead` | home | `index.html` `front.lead` (3.1.1), "page" changed to "site" |
| 6 | Lead, sentence 3 | "Then it maps how the promises fit together, offers one candidate shape for the whole engine, and shows where today's design breaks a promise." | `p.lead` | duplicate | kept at `index.html` "How to use these pages" (`front.siteGuide`, 3.1.7), one line per page |
| 7 | Lead, sentence 4 | "The problems from blue's shows appear as evidence and as test cases, not as the plan." (decision 26) | `p.lead` | duplicate | kept at `decisions.html#decided`, decision 26's line (3.2.4), which holds the substance ("clues to where today's design is off, never the driver"). `front.intros.flaws` says only where the findings come from ("from blue's shows and from the maps of today's engine"); no overlay says "not as the plan" |
| 8 | Box "What you are deciding" | h2 and three paragraphs: the promises (A to G; the map changed E, F, G); how the promises fit together (a map, a candidate shape, five moments, a note on each card); standalone games, the game's record, the next step; links to `#fit` and `#your-questions` | `section.decide` | home | `index.html` "Where things stand", `front.whereYouAre.open` (3.1.2), and `decisions.html` intro (3.2.1); the in-page links become `[[page:parts]]` and `[[page:decisions]]`; the clause "a note at the top of each card says what changed" goes to the change log (row 56) |
| 9 | Note "Already decided: your words" | Decision 27 in one paragraph: promise, "job" is gone, parts keep, flaws break, quality, titles with no numbers, venue technician | `p.decided-note` | duplicate | kept at `decisions.html#decided`, decision 27's line (3.2.4); a condensed copy also in `front.whereYouAre.decided` (3.1.2); the clause "\"job\" is gone" is kept only by `changes.json` `vocabulary[0]` ("Promise, not job", 3.6.6), since plan section 6 allows "job" on the change log alone |
| 10 | Section "What the engine is for" | h2 and the eight `purpose` paragraphs from EJ | `section.sa-box#purpose` | home | `index.html` "What the engine is for" (3.1.3), the paragraphs as they are |
| 11 | "How to read a promise", paragraph 1 | What a promise entry shows: who, when, what must happen; the changed note; the parts; built today; the goal; the flaws under it | `section.howto`, first `div` | home | `promises.html` header via `front.intros.promises` (3.3.1), rewritten for the new entry order; "the changed note" is now in the change log (rows 44, 56) |
| 12 | "How to read a promise", paragraph 2 | What a card shows: one moment, why, two diagrams (Today; Candidate, not decided), the parts, the changed note, "Step 3 puts competing designs in front of you; nothing on the right is decided" | same `div` | home | `flaws.html` header via `front.intros.flaws` (3.5.1); the sentence "Where the relationship map changed a card, a note at its top says what and why" is history and goes to `changes.cards` (row 56), as row 8 does for the same clause; `front.intros.flaws` does not carry it |
| 13 | Diagram legend | Red swatch "where it goes wrong"; teal swatch "the one place that would own the fact" | `div.legend` | home | `flaws.html` header, "the diagram legend" (3.5.1) |
| 14 | "The words", h2 and intro sentence | "The page's own words come first. The rest are the words step 3 uses; each card ends with the reason restated in them." | `section.howto`, second `div` | home | `index.html` "The words" (3.1.8) |
| 15 | The words, 15 terms | Promise, Moment, Design flaw, Part, Quality, Paper or live, Pass, Not installed tonight; Module, Interface, Seam, Deep and shallow, Locality, Leverage, Adapter | `dl.terms` | home | `index.html` `front.words` (3.1.8), verbatim, grouped `page` and `design`; "Director" added (table 3) |
| 16 | "The ten promises at a glance", h2 and note | "Each design flaw has one promise it mainly breaks; its card sits there. Flaws also listed under other promises point back to their card." | `section[aria-labelledby=glance]` | home | `promises.html` "The ten at a glance" h2 (3.3.2); the note's rule (one main promise per flaw, the card sits there) is stated in `front.intros.flaws` and shown by the flaws page's grouping (3.5.3) |
| 17 | Glance table | 10 rows: promise (link); design flaws that mainly break it; also touched by; parts that would keep it. Empty cases render "none yet" in the main-flaw column of "The designer changes a value and plays it within minutes, and the live show never notices" (its flaws C8 and C12 are both secondary) and "N1 (proposed)" (the venue promise); the "Also touched by" cell of "Each person sees their part and can do only their part" is empty | `table.glance`, BR `glance_html` | home | `promises.html` table (3.3.2), restructured: title, who, when, parts, flaws with the main one first; its inverse is the flaws table (3.5.2). In the single flaw column that promise's cell is not empty (C8, C12), so what the builder keeps is the "no main flaw" case and the "N1 (proposed)" text |

### B. "How the promises fit together" (BR `fit_html`, `FIT_SUMMARY`, `OVERVIEW`, `WALKS`, `FIT_DEVICES`, `shape_svg`, `part_html`, `part_layers`)

| # | Element | What it is | Where in v7 | Disposition | New home, or the kept copy |
|---|---|---|---|---|---|
| 18 | Section h2 and intro | "How the promises fit together" and the paragraph "You asked how the ten promises relate ... two levels ... Every card further down now follows that shape, and each says what changed." | `section.fit p.intro` | change log | the "You asked" framing is version 5's prompt: `changes.versions[].prompt` (3.6.2), which also holds the two levels ("at both levels (the big components and the modules inside them)"); the candidate shape is restated in `front.intros.parts` (3.4.1), the two levels are not; "each says what changed" is `changes.cards` (row 56) |
| 19 | Fit summary, passages 1 to 3 | "What happens at every tap"; "The engine's own machinery" (with the seven-module loop); "Two promises reach the show from outside" | `div.fit-summary`, BR `FIT_SUMMARY[0..2]` | home | `index.html` "How it fits together", `front.fitSummary` (3.1.5), with part and promise markers |
| 20 | Fit summary, passage 4 | "How each promise is kept": most promises by one or two parts; two by a quality (a label on every fact; tests every part passes); the lifecycle promise rests on a table of moments | BR `FIT_SUMMARY[3]` | GAP | no copy holds the same content, so this is not a duplicate (plan section 6, last rule). The qualities table (3.4.2) holds the two quality-kept promises, but "most promises are kept by one or two parts of their own" and "the lifecycle promise rests on a table of moments that most other promises read" are written nowhere: `front.fitSummary[1]` lists the moments without saying other promises read them, and the writer replaced this passage with "The night's record, after the end". Put the passage, or its one-line synthesis, in `front.fitSummary` or `front.intros.parts` |
| 21 | Figure "The promises at a glance" | Overview flowchart: ten promise nodes by title, 14 edges with labels, three classes (tap, machine, outside); `nodeSpacing: 20` | `figure.dia.wide`, BR `OVERVIEW`, `overview_src` | home | `promises.html` "How the promises depend on each other", first diagram (3.3.3), drawn at build time (plan 5.1). Unflagged gap in plan 5.1: the three `classDef` colours are `#0f766e` (tap), `#b45309` (machine) and `#6b7280` (outside); the plan maps only `#0f766e` to `--accent` and `#dc2626` to `--fault`, and the build fails on any unmapped colour literal. `#b45309` and `#6b7280` need `--dia-*` tokens in plan 5.1, light and dark, or the overview's classes are restyled. No other Mermaid source (CC, ES, `WALKS`) carries a colour |
| 22 | Overview key | Three swatches (what happens at every tap; the engine's own machinery; from outside the show) and "Each arrow runs from a promise to one that cannot be kept without it, and says what passes. The dotted line is a label every fact carries, not a dependency." | `figure.dia.wide p.figkey` | home | with row 21 on `promises.html` (3.3.3). The key is inline in `fit_html`, not in a reusable renderer: the builder must carry it by hand |
| 23 | Folded "The 25 main links between the promises" | Summary with the count; note "23 are dependencies ... One is a quality and one is shared work; they are drawn dotted"; the relations flowchart (ES `relationsMermaid`, titles substituted, 25 edges) | `figure.dia.wide details`, BR `relations_src` | home | `promises.html` second diagram, folded (3.3.3); counts computed from ES as today |
| 24 | "Qualities every part must have" | h3; "A quality is not a part. It is something every part must have ..."; table of 5 rows: quality, what it means (the fourth with "Today: a tap on the tablet, a URL path on the phone, nothing on the hardware scanner, no field in the pack"), mainly keeps (promise links) | `div.fit-block table.mech`, BR `QUALITY_KEEPS`, `today_of` | home | `parts.html` "Qualities every part must have" (3.4.2), each with the promises it keeps linked. `QUALITY_KEEPS` lives in BR, not in the data; the "Today" text for quality 4 lives in the data, ES `mechanisms[10].plain`, and BR only selects it (`quality_today = {3: today_of(shape['mechanisms'][10]['plain'])}` in `fit_html`) |
| 25 | Folded "13 tangles" | Summary with the count; note defining a tangle; 13 items, each a title, a plain paragraph and "Flaws: ..." links | `details ul.examples`, ES `today.tangles` | home | `parts.html` "Where today's code tangles", folded (3.4.7) |
| 26 | "A candidate shape: 17 parts", h3 and intro | "Most of today's problems sit in work several promises depend on ... The parts that are already well built today (the game rules, the verdict, the health words) are the pattern for the rest." | `div.fit-block > p` | home | `parts.html` header via `front.intros.parts` (3.4.1), near verbatim; the heading becomes "The seventeen parts" (3.4.5) |
| 27 | Figure "The candidate engine, whole" | The hand-drawn SVG on a 1000 × 800 grid: people line; screens band with three device boxes and the stamped-copy note; Design studio, Release, Joins and proofs; the two doors in teal; Connections and roles; the game's facts, the life of a game, the room; Outside programs dashed; the foundations band; 20 labelled arrows (20 `arrow()` calls; the published SVG's 22 paths include the two arrowhead markers); the aria-label | `figure.dia.whole`, BR `shape_svg` | home | `index.html` "How it fits together" (3.1.5), the renderer reused |
| 28 | Whole-engine key | The long paragraph: every request through Answering, every fact out through Delivery with its label; Delivery reads, nothing sends to it; the verdict before a start; a new pack only between games; teal doors; the dashed box; rows are not layers; the standalone tablet's stand-ins; "The moments below follow single steps" | `figure.dia.whole p.figkey` | home | `index.html` with row 27, "with its key" (3.1.5); its last sentence points to `parts.html` moments instead of "below" |
| 29 | "5 moments, part by part", h3 | The heading with the count | `h3` in `fit_html` | home | `parts.html` "Five moments, part by part" (3.4.4) |
| 30 | Moments intro | "Each moment follows one thing that happens at a show through the parts that handle it, in order. Solid arrows are requests; dashed arrows are answers. Delivery always asks what changed; nothing pushes facts to it. Each screen asked Delivery, when it connected, to keep it up to date; Delivery's dashed arrows to screens answer that standing request." | `p` after the h3 | GAP | the plan (3.4.4) names the five walkthroughs and the promises each shows, not this reading key. Without it the solid and dashed arrows and the "what changed?" pattern are unexplained. Put it under the heading on `parts.html` (3.4.4) |
| 31 | Walkthrough figures, 5 | Field kinds (once): the title as figcaption; "Keeps" with the promise links (BR `WALKS[1]`); the sequence diagram with `SEQ_INIT`. Titles: A GM taps a token; A cue plays, or cannot; The GM ends the game; Doors open: the preflight; The designer publishes a change | `div.walks figure.dia.walk`, BR `WALKS` | home | `parts.html` (3.4.4), each with the promises it shows; drawn at build time, compact, at least 720 px wide (plan 5.1) |
| 32 | Layers figure | Figcaption "The parts in layers, top row first. Each part uses only the parts in the rows below it, so nothing loops back ... Tap a part to read it."; 8 rows of part chips with Top and Bottom labels | `figure.layers-fig ol.layers`, BR `part_layers` | home | `parts.html` "The parts in layers" (3.4.3) |
| 33 | Part cards, 17 | Field kinds (once): name (h4); what it does (ES `plain`); Mainly keeps (promise links, from EJ `parts`); Also needed by (ES `jobs` minus mainly keeps); Today (10 of 17, from ES `mechanisms` via BR `MECH_PART` and `today_of`); Removes (flaw links, ES `flaws`); Runs on (BR `RUNS_ON`, with "in a standalone game, a small stand-in on the GM tablet"); Where it can be swapped (ES `seams`). Order: layer order, bottom row first | `div.parts article.part`, BR `part_html` | home | `parts.html` "The seventeen parts" (3.4.5), the seven fields as listed; anchors by name (plan 2). `MECH_PART`, `RUNS_ON` and `today_of` live in BR, not in the data |
| 34 | Folded "Which part uses which: 54 links" | Summary with the count; note "An arrow means uses. No arrow loops back."; the parts flowchart (ES `partsMermaid`, 17 nodes, 54 edges) | `details` after the parts | home | `parts.html` folded under the layers figure (3.4.3) |
| 35 | "Which parts would run where" | h3 and 7 items: the engine; a GM tablet in a networked game; a GM tablet in a standalone game; the phone and the ESP32; the scoreboards; the config tool; the tests; four carry "Today ..." (the networked GM tablet, the scoreboards, the config tool, the tests) and two an "open choice for step 3" | `ul.devices`, BR `FIT_DEVICES` | home | `parts.html` "Which part would run where" (3.4.6) |
| 36 | Folded "As a diagram" | ES `componentsMermaid`: 8 nodes (backend, GM tablet networked, GM tablet standalone, phone and hardware scanner, scoreboards, config tool, tests, pack data), 7 labelled edges | `details` under the devices | home | `parts.html` (3.4.6), drawn at build time |
| 37 | "Where a real alternative exists" | h3; intro "For these, the map found two sound ways ... Step 3 puts each in front of you with designs side by side; no answer is needed now."; table of 8 rows: choice, the candidate, the other way, what each costs | `div.fit-block table.alts`, ES `alternatives` | home | `parts.html` "Where a real alternative exists" (3.4.8); the intro's substance also in `front.intros.parts`; six rows are linked from the step-3 list (3.2.3) |

### C. The promise entries, 10 (BR `job_html`, `job_head`; field kinds listed once)

| # | Element | What it is | Where in v7 | Disposition | New home, or the kept copy |
|---|---|---|---|---|---|
| 38 | Entry section | `section.job#j1` to `#j10`, in EJ order, each holding its primary flaw cards | `{jobs}` in `TEMPLATE` | home | `promises.html` "The ten promises" (3.3.4), one entry each, same order; anchors `designers-game` to `proven-change` (plan 2); the cards leave the entry (row 50) |
| 39 | Kind label | "Promise" above the title | `p.kind` | duplicate | kept as the page's h1 "Promises" (3.3.1) |
| 40 | Title | EJ `functional.proposedTitle`, as h2 | `job-head h2` | home | `promises.html` entry h2 (3.3.4) |
| 41 | Earlier wording | "Earlier wording, as a job: “<EJ title>”." (10 of 10) | `p.was` | change log | `changes.promises[].earlierTitle` (3.6.3) |
| 42 | What they count on | EJ `functional.need` | `p.meaning` | home | `promises.html` entry, "what they count on" (3.3.4) |
| 43 | Who and When | `dl.who` from EJ `functional.people` and `functional.moment` | `job-head dl.who` | home | `promises.html` entry, "who and when" (3.3.4); also feeds the glance table's who and when columns (3.3.2) and the front page's moments (3.1.4) |
| 44 | "Changed after the relationship map" | EJ `shapeChange` (10 of 10) | `p.changed`, BR `changed_html` | change log | `changes.promises[].changes` (3.6.3) |
| 45 | "Kept by these parts of the candidate shape" | Part chips from EJ `parts` | `div.partrow`, BR `part_row` | home | `promises.html` entry, "kept by" (3.3.4) |
| 46 | "Built today" | BR `BUILT[id]`: the orchestrator's summary from the root CLAUDE.md and the capability map | `div.job-facts`, first box | home | `promises.html` entry, "built today" (3.3.4). `BUILT` lives in BR, not in a data file; the site builder imports it or the text moves to the data |
| 47 | "The long-term goal" | EJ `goal`; "(open for step 3)" in red when `goalOpen` (the lifecycle promise only) | `div.job-facts`, second box | home | `promises.html` entry, "the long-term goal (with goalOpen)" (3.3.4) |
| 48 | "Design flaws that break it today", primary items | For each EJ `flaws[]` with `primary`: the id as a link to the card and the one-line `how` | `div.short li`, BR `job_html` | home | `promises.html` entry, "broken by", the main one first, each a flaw link with its `how` (3.3.4); the link now crosses to `flaws.html#cN` |
| 49 | Secondary items | For each non-primary flaw: muted id, `how`, and "(its card is under “<promise>”)" (27 renderings) | `li.secondary` | home | `promises.html` entry, "broken by", after the main ones (3.3.4); the "(its card is under ...)" note is a duplicate kept at `flaws.html` (3.5.3), where the card sits under that promise's heading and the link lands on it |
| 50 | Flaw cards nested in the entry | `card_html` for each primary flaw with a card | `{cards}` at the end of `job_html` | home | `flaws.html` "The cards", grouped under the promise each mainly breaks (3.5.3); the entry links to them (row 48) |
| 51 | N1 items | "N1 <how> (proposed, question 23; it has no card)" (4 renderings: primary under the venue promise, secondary under three others) | `li` with `span.fid` | home | `promises.html` entry links to `flaws.html#n1` (3.3.4); the note "proposed, question 23" is a duplicate kept at `flaws.html#n1` (3.5.3) and `decisions.html#q-c` (3.2.2), where question 23 is folded in |
| 52 | Fallback line | "No design flaw breaks this promise mainly: its planned parts are not built yet." (rendered 0 times in v7; every promise has at least one flaw line) | `job_html`, `or` branch | home | `promises.html` entry (3.3.4): the builder keeps the branch; the glance table's "none yet" (row 17) is its visible counterpart |
| 53 | "In a standalone game" | EJ `standalone`, prefix stripped | `p.standalone` | home | `promises.html` entry, "in a standalone game" (3.3.4) |
| 54 | Folded "What the planned capabilities need from it (n)" | EJ `needs` as a list, count in the summary | `details ul.examples` | home | `promises.html` entry, folded `needs` (3.3.4) |
| 55 | Folded "Test cases from the shows (n); Answers the pass's questions …" | EJ `tests` as a numbered list; the summary also says which of the pass's nine questions the promise answers (EJ `questions`) or "No question of the nine covers it yet" | `details ol.examples` | GAP | the plan (3.3.4) folds `tests` but names no field for the pass's question numbers (EJ `questions`); the cards keep their own (row 60). Keep them in the folded summary line as v7 has it |

### D. The flaw cards, 16 (BR `card_html`, `chips`; field kinds listed once)

| # | Element | What it is | Where in v7 | Disposition | New home, or the kept copy |
|---|---|---|---|---|---|
| 56 | "Changed after the relationship map" | CC `shapeChange` (16 of 16) | `p.changed` under the card head | change log | `changes.cards[].changes` (3.6.4) |
| 57 | Card article | `article.card#c1` to `#c16`, under the promise it mainly breaks | nested in `job_html` | home | `flaws.html` "The cards" (3.5.3), grouped under that promise's title as a linked heading; anchors `c1` to `c16` unchanged |
| 58 | Id and title | `span.cid` and h3 | `header.card-head` | home | card head on `flaws.html` (3.5.3); also the first column of the flaws table (3.5.2) |
| 59 | Chip "N problems found" | CC `findings` | `div.chips` | home | card chips (3.5.3) and the flaws table's "number of findings" (3.5.2) |
| 60 | Chip "Question N" / "Questions N, M" / "No question covers it (nearest: N)" | CC `questions` against the pass's nine questions; C14, C15, C16 are the three no question covers (BR `OUTSIDE_NINE`) | `div.chips` | home | card chips (3.5.3): the plan keeps v7's card whole except the changed note. These numbers are the pass's questions 1 to 9, not the site's questions, so they carry no `[[q:]]` marker |
| 61 | Chip "Clue from blue: fix W…" | CC `blueFixes` (7 cards) | `div.chips` | home | card chips (3.5.3) |
| 62 | Chip "Seen live" | CC `seenLive` present (8 cards: C2, C3, C5, C8, C10, C11, C15, C16) | `span.chip.live` | home | card chips (3.5.3) and the flaws table's "seen live" column (3.5.2) |
| 63 | "At a show" | CC `atAShow` | `div.story` | home | card (3.5.3) |
| 64 | "Why it happens" | CC `whyItHappens` | `div.story` | home | card (3.5.3) |
| 65 | "Seen live" note | CC `seenLive` text (8 cards) | `p.live-note` | home | card (3.5.3) |
| 66 | "In a standalone game" | SL `lines[id]`, prefix stripped (16 of 16) | `p.standalone` | home | card (3.5.3) |
| 67 | Figure "Today" | CC `before.caption` and `before.mermaid`, fault nodes in red | `figure.dia.before` | home | card (3.5.3), drawn at build time; `#dc2626` maps to `--fault` (plan 5.1) |
| 68 | Figure "Candidate, not decided" | CC `after.caption`, `after.mermaid` (owner node in teal) and `after.note` | `figure.dia.after` | home | card (3.5.3); `#0f766e` maps to `--accent` |
| 69 | "Removed by these parts of the candidate shape" | Part chips from CC `parts` | `div.partrow` | home | card (3.5.3) and the flaws table's "parts that would remove it" (3.5.2) |
| 70 | "In design terms" | CC `designTerms` | `p.design` | home | card (3.5.3) |
| 71 | Folded "The problems behind it, and the code they live in": the problems | CC `examples[]`: finding ids and text | `details ul.examples` | home | card, folded (3.5.3) |
| 72 | The code they live in | CC `modules[]` as code chips | `div.mods` | home | card, folded (3.5.3); also feeds the grid (row 78) |
| 73 | N1, the proposed flaw | No card in v7. It appears in the glance table ("N1 (proposed)"), four promise lines (row 51), two tangles, two part cards' Removes (Pack channel and Venue fit), the evidence intro ("8 under the proposed N1") and question C | scattered | home | `flaws.html#n1`, a short entry under the venue promise's group pointing to question C (3.5.3); its text comes from EJ's four `how` lines for N1, question C and the standalone pass, since N1 has no record in CC |

### E. Standalone games (BR `TEMPLATE`, `parity_html`)

| # | Element | What it is | Where in v7 | Disposition | New home, or the kept copy |
|---|---|---|---|---|---|
| 74 | Section h2 and paragraph 1 | "Standalone games"; decision 22's requirement; the GM tablet decides everything from hand-kept copies; each player scanner decides only whether a token is known | `section.sa-box#standalone` | home | `flaws.html` "Standalone games" (3.5.4); the first sentence is also `front.standaloneLine` (3.1.4) |
| 75 | Paragraph 2 | "Four design flaws cause no problem in a standalone game, four apply in part and eight in full ... The two biggest gaps ..." with the three quoted screens | same section | home | `flaws.html` (3.5.4) |
| 76 | Folded ESP32 parity table | Summary "The ESP32 against the web scanner with no engine: 24 differences"; note on shaded rows; table of 24 rows × 5 columns (#, behaviour, web scanner standalone, ESP32 no engine, what the ESP32 would need), weak rows shaded; parsed from `2026-10-31-standalone-pass.md` section 4 | `details table.parity`, BR `parity_rows` | home | `flaws.html` (3.5.4), folded; the renderer reused |

### F. The evidence (BR `TEMPLATE`, `SET_ASIDE`, `grid_html`, `PARTS`)

| # | Element | What it is | Where in v7 | Disposition | New home, or the kept copy |
|---|---|---|---|---|---|
| 77 | Section h2 and totals | "The evidence"; "358 problems came from blue's records and the maps of today's engine; 337 of them sit under the design flaws above, and 21 needed no change to the design. The standalone pass added 35 more: 27 placed under the same flaws, and 8 under the proposed N1 that question 23 asks about." | `section[aria-labelledby=evidence] p.intro` | home | `flaws.html` "The evidence" (3.5.5). The totals come from the data: 337 is the sum of CC `findings`, 21 the sum of `SET_ASIDE`, 358 their sum. Plan 3.5.5 says "358 findings under the flaws"; the data says 337 under the flaws and 358 in all. The builder must compute, not copy the plan's figure. The standalone pass's 35, 27 and 8 are typed in the template, not in the data |
| 78 | Set-aside table | 6 rows: category, count, text (already fixed, 7; plain fixes, 5; code-structure notes, 2; no fault, 2; a question for you, 1; documents, 4) | `table.aside`, BR `SET_ASIDE` | home | `flaws.html` (3.5.5), folded; `SET_ASIDE` lives in BR, not in a data file |
| 79 | Folded "Where each flaw lives in today's code" | Summary; note "A dot means the flaw's problems sit in that part of the engine."; grid of 16 flaws × 9 parts of the engine (GM tablets, Scoreboards, Player scanners, Game state, Show control, Pack and config tool, Tests, Deployment, Contracts), dots from each card's `modules` through BR `PARTS` | `details table.grid` | home | `flaws.html` (3.5.5), folded; the renderer and `PARTS` reused |

### G. Your questions (BR `TEMPLATE`)

| # | Element | What it is | Where in v7 | Disposition | New home, or the kept copy |
|---|---|---|---|---|---|
| 80 | Section h2 | "Your questions" | `section.questions#your-questions` | home | `decisions.html` h1 "Decisions" and `decisions.intro` (3.2.1) |
| 81 | Group headings, 5 | About the promises; About standalone games; About the game's record; About the next step; Coming in step 3, no answer needed now | `div.qgroup > h3` | home | `decisions.html` groups in `decisions.groups` order (3.2.2) and the step-3 heading `#step-3` (3.2.3) |
| 82 | Question blocks, 13 | Field kinds (once): the heading (h3); the body paragraphs; the "Recommendation:" or "Suggestion:" line. Keys: promises, A to G, 22, 24, 25, 19, 21 | `div.q` | home | `decisions.html` one block each (3.2.2): heading, status tag, "What it decides", "What we know" evidence lines, options with costs where v7 offers them, the recommendation with `recKind`. Every v7 sentence is kept in substance (`decisions-log.md`); question D's people follow decision 28 |
| 83 | Status tag "Applied, please confirm" | On A, B and C | `p.applied` | home | status `applied` on A, B, C (3.2.2) |
| 84 | Status tag "Recommendation changed by the map" | On E, F and G | `p.changedrec` | home | status `changed` on E, F, G (3.2.2); the before and after also in the change log (row 86) |
| 85 | Question F's options | The list a to d: one promise; split release day; file release day under the venue promise; back to the earlier wording | `ol[type=a]` in F | home | `decisions.json` F `options[]` with v7's costs (3.2.2) |
| 86 | "This replaces the earlier recommendation / answer" sentences | E: "This replaces the earlier recommendation to split."; F: "The earlier split into 'prove it works' and 'keep every part in step' does not match the map ..."; G: "This replaces the earlier answer, which put the route under the room promise whatever the design." | `p.rec` in E, F, G | change log | `changes.recommendations[]` for E, F and G: before, after, why (3.6.5); `decisions.html` keeps one pointer line per question |
| 87 | "This replaces question 17 / 18"; "Question 23 is folded in here" | The promises question replaces 17; F replaces 18; C folds 23 | body text of promises, F, C | home | `decisions.html` evidence lines of those questions (3.2.2), as `decisions-log.md` records |
| 88 | Step-3 list | h3 "The map leaves these choices to you."; intro "Step 3 puts each in front of you with designs side by side ..."; 11 numbered items (standalone declaration; delivery; lifecycle; rules; equipment interface; standalone tablet; scoreboard; config tool; hot-apply window; start-or-adopt setting; the order of the work) | `div.qgroup`, last | home | `decisions.html` "Coming in step 3, no answer needed", `decisions.step3` (3.2.3), v7's eleven word for word plus the paper-documents item; six link to the alternatives table |
| 89 | "Decided so far" line | "Decided so far: 20 (...), 22 (...), 26 (...) and 27 (...)." | `p.muted` at the end | home | `decisions.html` "Decided", `decisions.decided` (3.2.4): 20, 22, 26, 27, 28 and 29, each with its date and one line |

### H. Footer (BR `TEMPLATE`)

| # | Element | What it is | Where in v7 | Disposition | New home, or the kept copy |
|---|---|---|---|---|---|
| 90 | Footer, paragraph 1 | Built from `2026-10-31-engine-jobs.md` (the check held 171 claims and corrected 53), `2026-10-30-cause-analysis.md` with its checks, `2026-10-31-standalone-pass.md`; "Built today" from the root CLAUDE.md and the capability map | `footer` | home | every page's footer names the documents it is built from (plan 2); the check counts (171 and 53) are history and go to `changes.versions[].items` (3.6.2) |
| 91 | Footer, paragraph 2 | `2026-11-01-engine-shape.md` and the four maps under `relationships/`, with its check; the cards and promises reconciled with the shape, each group checked; the words are decision 27 | `footer` | home | the footers of `parts.html`, `promises.html` and `flaws.html` (plan 2); the reconciliation and checks go to `changes.versions[].items` (3.6.2); "the words are decision 27" to `changes.vocabulary` (3.6.6) |

### I. Behaviour the viewer gave version 7

| # | Element | What it is | Where in v7 | Disposition | New home, or the kept copy |
|---|---|---|---|---|---|
| 92 | Mermaid drawing | 41 `pre.mermaid` blocks drawn by the artifact viewer at view time, with `present()`'s init directives | throughout | home | every diagram drawn at build time by `render_diagrams.js` and inlined as SVG with theme tokens; `present()`'s sizing stays (plan 5.1) |
| 93 | In-page links | `#fit`, `#your-questions`, `#jN`, `#cN`, `#pN`, part chips and promise links | throughout | home | relative links between pages with the new anchors (plan 2); every `href` checked by the build (plan 5.2) |

Rows 90 to 93 are counted in the totals above under their dispositions.

## Table 2: every heading of version 7, one row each

Generated from the published HTML (1 h1, 19 h2, 40 h3, 17 h4). Plan
section numbers in brackets.

| # | Tag | Heading in version 7 | New home (plan section) |
|---|---|---|---|
| 1 | h1 | What the engine promises | `index.html` h1 (3.1.1) |
| 2 | h2 | What you are deciding | `index.html` "Where things stand" (3.1.2) and `decisions.html` intro (3.2.1) |
| 3 | h2 | What the engine is for | `index.html` "What the engine is for" (3.1.3) |
| 4 | h2 | How to read a promise | `promises.html` header via `front.intros.promises` (3.3.1); card paragraph to `flaws.html` header via `front.intros.flaws` (3.5.1) |
| 5 | h2 | The words | `index.html` "The words" (3.1.8) |
| 6 | h2 | The ten promises at a glance | `promises.html` "The ten at a glance" (3.3.2) |
| 7 | h2 | How the promises fit together | split: picture and summary on `index.html` (3.1.5); diagrams on `promises.html` (3.3.3); qualities, layers, moments, parts, devices, tangles, alternatives on `parts.html` (3.4.2 to 3.4.8) |
| 8 | h3 | Qualities every part must have | `parts.html` "Qualities every part must have" (3.4.2) |
| 9 | h3 | A candidate shape: 17 parts | `parts.html` "The seventeen parts" (3.4.5); its intro via `front.intros.parts` (3.4.1) |
| 10 | h3 | 5 moments, part by part | `parts.html` "Five moments, part by part" (3.4.4) |
| 11 | h4 | Game rules | `parts.html#game-rules` part card (3.4.5) |
| 12 | h4 | Engine instance | `parts.html#engine-instance` part card (3.4.5) |
| 13 | h4 | Pack channel | `parts.html#pack-channel` part card (3.4.5) |
| 14 | h4 | Connections and roles | `parts.html#connections-and-roles` part card (3.4.5) |
| 15 | h4 | Venue fit | `parts.html#venue-fit` part card (3.4.5) |
| 16 | h4 | Game record | `parts.html#game-record` part card (3.4.5) |
| 17 | h4 | Equipment | `parts.html#equipment` part card (3.4.5) |
| 18 | h4 | Verdict | `parts.html#verdict` part card (3.4.5) |
| 19 | h4 | Show runner | `parts.html#show-runner` part card (3.4.5) |
| 20 | h4 | Lifecycle | `parts.html#lifecycle` part card (3.4.5) |
| 21 | h4 | Answering | `parts.html#answering` part card (3.4.5) |
| 22 | h4 | The night's record | `parts.html#the-nights-record` part card (3.4.5) |
| 23 | h4 | Delivery | `parts.html#delivery` part card (3.4.5) |
| 24 | h4 | Screens | `parts.html#screens` part card (3.4.5) |
| 25 | h4 | Design studio | `parts.html#design-studio` part card (3.4.5) |
| 26 | h4 | Joins and proofs | `parts.html#joins-and-proofs` part card (3.4.5) |
| 27 | h4 | Release | `parts.html#release` part card (3.4.5) |
| 28 | h3 | In the candidate shape, which parts would run where | `parts.html` "Which part would run where" (3.4.6) |
| 29 | h3 | Where a real alternative exists | `parts.html` "Where a real alternative exists" (3.4.8) |
| 30 | h2 | The designer's game is the game the whole kit plays | `promises.html#designers-game` entry h2 (3.3.4) |
| 31 | h3 | Pack edits reach each copy of the pack differently | `flaws.html#c12` card, under the group "The designer's game is the game the whole kit plays" (3.5.3) |
| 32 | h2 | One game, the same on every screen | `promises.html#one-game` entry h2 (3.3.4) |
| 33 | h3 | Each tablet keeps its own list of claimed tokens | `flaws.html#c1` card, under the group "One game, the same on every screen" (3.5.3) |
| 34 | h3 | Reconnect snapshot and live update are built apart | `flaws.html#c6` card, under the group "One game, the same on every screen" (3.5.3) |
| 35 | h3 | Tablets and phones decide facts the engine owns | `flaws.html#c9` card, under the group "One game, the same on every screen" (3.5.3) |
| 36 | h3 | Several places answer the same question, each differently | `flaws.html#c11` card, under the group "One game, the same on every screen" (3.5.3) |
| 37 | h2 | Every tap gets its answer, and the night can be told afterwards | `promises.html#every-tap` entry h2 (3.3.4) |
| 38 | h3 | A reply never says which request, final or stored | `flaws.html#c7` card, under the group "Every tap gets its answer, and the night can be told afterwards" (3.5.3) |
| 39 | h2 | The room does what the designer cued and the GM asked | `promises.html#the-room` entry h2 (3.3.4) |
| 40 | h3 | Service health and service state travel on separate paths | `flaws.html#c2` card, under the group "The room does what the designer cued and the GM asked" (3.5.3) |
| 41 | h3 | Engine trusts its stale picture of outside programs | `flaws.html#c3` card, under the group "The room does what the designer cued and the GM asked" (3.5.3) |
| 42 | h2 | Each lifecycle button does exactly what its name says | `promises.html#lifecycle-buttons` entry h2 (3.3.4) |
| 43 | h3 | Nothing says what a game boundary clears or keeps | `flaws.html#c4` card, under the group "Each lifecycle button does exactly what its name says" (3.5.3) |
| 44 | h3 | Boot and Reset System wire the engine differently | `flaws.html#c5` card, under the group "Each lifecycle button does exactly what its name says" (3.5.3) |
| 45 | h2 | The designer changes a value and plays it within minutes, and the live show never notices | `promises.html#change-a-value` entry h2 (3.3.4) |
| 46 | h2 | Each person sees their part and can do only their part | `promises.html#each-person` entry h2 (3.3.4) |
| 47 | h3 | The engine does not know who is connected | `flaws.html#c13` card, under the group "Each person sees their part and can do only their part" (3.5.3) |
| 48 | h2 | The game fits the venue it is in tonight | `promises.html#the-venue` entry h2 (3.3.4) |
| 49 | h2 | Anyone reading a screen can act on it without a second question | `promises.html#read-a-screen` entry h2 (3.3.4) |
| 50 | h3 | Screens show a normal value when nothing is known | `flaws.html#c10` card, under the group "Anyone reading a screen can act on it without a second question" (3.5.3) |
| 51 | h2 | A change is proven before it reaches anyone, and the owner alone sends it to the show | `promises.html#proven-change` entry h2 (3.3.4) |
| 52 | h3 | Engine and tests both assume they own the machine | `flaws.html#c8` card, under the group "A change is proven before it reaches anyone, and the owner alone sends it to the show" (3.5.3) |
| 53 | h3 | Names joining two places are kept by hand | `flaws.html#c14` card, under the group "A change is proven before it reaches anyone, and the owner alone sends it to the show" (3.5.3) |
| 54 | h3 | The deployed game is many parts nothing compares | `flaws.html#c15` card, under the group "A change is proven before it reaches anyone, and the owner alone sends it to the show" (3.5.3) |
| 55 | h3 | A green test run proves nothing about the show | `flaws.html#c16` card, under the group "A change is proven before it reaches anyone, and the owner alone sends it to the show" (3.5.3) |
| 56 | h2 | Standalone games | `flaws.html` "Standalone games" (3.5.4) |
| 57 | h2 | The evidence | `flaws.html` "The evidence" (3.5.5) |
| 58 | h2 | Your questions | `decisions.html` h1 "Decisions" (3.2.1) |
| 59 | h3 | About the promises | `decisions.html` group "About the promises" (3.2.2) |
| 60 | h3 | Are these the right ten promises, and does each read from the side of the people who co... | `decisions.html#q-promises` (3.2.2) |
| 61 | h3 | A. "The designer's game is the game the whole kit plays" now says a second designer's g... | `decisions.html#q-a` (3.2.2) |
| 62 | h3 | B. "Each person sees their part and can do only their part" now covers who may do what,... | `decisions.html#q-b` (3.2.2) |
| 63 | h3 | C. "The game fits the venue it is in tonight" now says a standalone game is a choice th... | `decisions.html#q-c` (3.2.2) |
| 64 | h3 | D. Split "Every tap gets its answer, and the night can be told afterwards" into two pro... | `decisions.html#q-d` (3.2.2) |
| 65 | h3 | E. Keep "The game fits the venue it is in tonight" as one promise, rather than split it? | `decisions.html#q-e` (3.2.2) |
| 66 | h3 | F. "A change is proven before it reaches anyone, and the owner alone sends it to the sh... | `decisions.html#q-f` (3.2.2) |
| 67 | h3 | G. Which promise covers the equipment's state on every screen? | `decisions.html#q-g` (3.2.2) |
| 68 | h3 | About standalone games | `decisions.html` group "About standalone games" (3.2.2) |
| 69 | h3 | 22. The ESP32 gets a standalone mode matching the web scanner's. | `decisions.html#q-22` (3.2.2) |
| 70 | h3 | 24. Does a standalone game run on one GM tablet? | `decisions.html#q-24` (3.2.2) |
| 71 | h3 | 25. With no engine and no TV, what do exposed evidence and video tokens do? | `decisions.html#q-25` (3.2.2) |
| 72 | h3 | About the game's record | `decisions.html` group "About the game's record" (3.2.2) |
| 73 | h3 | 19. When a GM scan is refused, does the game keep a record of the attempt? | `decisions.html#q-19` (3.2.2) |
| 74 | h3 | About the next step | `decisions.html` group "About the next step" (3.2.2) |
| 75 | h3 | 21. How many problems should the test rig prove before design starts? | `decisions.html#q-21` (3.2.2) |
| 76 | h3 | Coming in step 3, no answer needed now | `decisions.html` "Coming in step 3, no answer needed" `#step-3` (3.2.3) |
| 77 | h3 | The map leaves these choices to you. | `decisions.html` `#step-3`, the list intro (3.2.3) |

## Table 3: what the plan adds that version 7 lacked

| # | Addition | Where | Source |
|---|---|---|---|
| 1 | Six pages instead of one scroll; the engine page as the front | all | decision 29; plan 1 |
| 2 | A navigation bar with the count of open questions, `aria-current`, sticky under the safe area | all | plan 2 |
| 3 | A status line: "Architecture pass, phase 1, step 1. The shape is a candidate; nothing is decided unless a page says so. Updated 2026-11-01." | all | plan 2 |
| 4 | A footer on every page naming its own sources | all | plan 2 |
| 5 | Anchors by name for promises and parts (`every-tap`, `the-nights-record`), question anchors `q-a` to `q-21` | all | plan 2 |
| 6 | "Where things stand": open for the owner, decided lately, what comes next (step 2 the rig, step 3 rule by rule, version 7 stays live) | `index.html` 3.1.2 | `front.whereYouAre` |
| 7 | "Who counts on the engine, and when": six moment columns (Author and Rehearse; Before doors; During play; The end of a game, and between games; Review; Release day) with the people there and the promises they count on | `index.html` 3.1.4 | `front.moments`, built from EJ `functional.people` and `moment`; the Review column names the director and the players (decision 28) |
| 8 | A standalone line under the moments | `index.html` 3.1.4 | `front.standaloneLine` |
| 9 | A fourth fit passage, "The night's record, after the end" | `index.html` 3.1.5 | `front.fitSummary[3]`, from ES P5 and decision 28 |
| 10 | "Around the engine": Notion, the sync script, the pack files, the design studio, video and the TV, music, audio and Bluetooth, lighting, the Director Console, the emailer, the booking list and the ticketing service, each with what it is, how it connects, its status; an optional diagram | `index.html` 3.1.6 | `front.around`, `front.aroundMermaid`; decision 28 |
| 11 | "How to use these pages", one line per page | `index.html` 3.1.7 | `front.siteGuide` |
| 12 | The word "Director" in the words list | `index.html` 3.1.8 | `front.words`; `CONTEXT.md` section 5b |
| 13 | Three page intros written for the new pages | `promises.html`, `parts.html`, `flaws.html` headers | `front.intros` |
| 14 | A "What it decides" line on every question | `decisions.html` 3.2.2 | `decisions.groups[].questions[].decides` |
| 15 | "What we know": two to five evidence lines per question, each linked to its promise, part, flaw or question | `decisions.html` 3.2.2 | `evidence[]` |
| 16 | Options with costs on D, E, G, 22, 24, 25 and 19 (version 7 listed options only on F) | `decisions.html` 3.2.2 | `options[]` |
| 17 | A status tag on every question, "open" included | `decisions.html` 3.2.2 | `status` |
| 18 | The twelfth step-3 item: whether paper documents join the pack with "unlocked" recorded during play | `decisions.html` 3.2.3 | decision 28, point 3 |
| 19 | Links from six step-3 items to their row in the alternatives table | `decisions.html` 3.2.3 | `decisions-log.md` |
| 20 | The decided list with dates and one line each, now including 28 and 29 | `decisions.html` 3.2.4 | `decisions.decided` |
| 21 | Question D's people renamed by decision 28 (the director and the players) | `decisions.html` q-d | decision 28, point 1 |
| 22 | The glance table gains who and when columns, and one flaw column with the main flaw first | `promises.html` 3.3.2 | plan 3.3 |
| 23 | A flaws-at-a-glance table: flaw, promise mainly broken and the others, parts that would remove it, findings, seen live | `flaws.html` 3.5.2 | plan 3.5 |
| 24 | The cards grouped under linked promise headings, apart from the promise entries | `flaws.html` 3.5.3 | plan 3.5 |
| 25 | A short entry for N1, which had no card | `flaws.html#n1` 3.5.3 | plan 3.5 |
| 26 | A change log page: versions newest first (8 back to the first cause report), each with date, what changed and what prompted it | `changes.html` 3.6.2 | `changes.versions`; `CURRENT-STATE.md` section 0 |
| 27 | Every promise's earlier wording and changes in one place; every card's changes in one place (version 7 scattered them over 26 notes) | `changes.html` 3.6.3, 3.6.4 | `changes.promises`, `changes.cards`; EJ `jobChanges` (7 items version 7 never rendered) is a source |
| 28 | E, F and G before and after, with why | `changes.html` 3.6.5 | `changes.recommendations` |
| 29 | The words decision 27 replaced | `changes.html` 3.6.6 | `changes.vocabulary` |
| 30 | Diagrams drawn at build time as inline SVG with `--dia-*` tokens, light and dark; no page loads Mermaid | all | plan 5.1 |
| 31 | Build checks: every marker and href resolves; no promise id, no retired word for the venue technician, "job" only on the change log; each promise, part, flaw and question appears once as an entry; sizes and word counts printed | build | plan 5.2 |

## Notes for the builder

1. These blocks of text live in `build_report.py`, not in a data file:
   `BUILT` (built today, row 46), `SET_ASIDE` (row 78), `FIT_SUMMARY`
   and `FIT_DEVICES` (rows 19, 20, 35), `WALKS` (row 31), `OVERVIEW`
   (row 21), `QUALITY_KEEPS` and `MECH_PART` (rows 24, 33), `RUNS_ON`
   (row 33), `OUTSIDE_NINE` (row 60), `INIT` and `SEQ_INIT` (rows 31,
   92), the `PARTS` classifier (row 79), the two figure keys (rows 22,
   28), and the texts written inline in `fit_html`: the relations note
   (row 23), the qualities intro (row 24), the tangle note (row 25),
   the shape intro (row 26), the moments intro (row 30), the layers
   caption (row 32), the "uses" note (row 34) and the alternatives
   intro (row 37). `build_site.py` imports each or the text moves to
   the data; it never retypes them.
2. The evidence totals (row 77): compute 337, 21 and 358 from the
   data. The plan's "358 findings under the flaws" counts the 21 set
   aside as well.
3. The three GAPs (rows 20, 30, 55) are the only places where a
   reader of version 7 would miss a sentence. Rows 30 and 55 should
   be carried; row 20's passage, or its synthesis, goes in
   `front.fitSummary` or `front.intros.parts`. Several rows marked
   **home** also carry a second, historical clause to the change log
   (rows 8, 11, 12, 84, 90, 91); the disposition counts the main body
   of the element.
4. `changes.json` (checked 2026-11-01, after this table was written)
   holds rows 18, 41, 44, 56 and 86 in full: eight versions, every
   promise's earlier title and changes, every card's changes, E, F and
   G, ten vocabulary lines; version 5's items carry the reconcile (182
   verdicts, 96 corrected) from row 91. Two footer facts are not in it
   yet and belong in `changes.versions[].items`: the engine-jobs check
   that held 171 claims and corrected 53 (row 90, version 3), and the
   four maps under `relationships/` that the shape was drawn from (row
   91, version 5). Its writer adds them, or the footers of
   `promises.html` and `parts.html` carry them.

## Gaps resolved (2026-11-01, the orchestrator)

The plan now places all three GAP rows, so every element of version 7
has a home or a named kept copy:

- Row 20, v7's "How each promise is kept" passage: the lead-in to the
  glance table on `promises.html` (plan 3.3, item 2), from
  `FIT_SUMMARY[3]`.
- Row 30, the walkthroughs' reading key: under the heading of "Five
  moments, part by part" on `parts.html` (plan 3.4, item 4).
- Row 55, the pass's question numbers on each promise's test cases: the
  folded summary line, as in v7 (plan 3.3, item 4).

Also settled: the outside amber `#b45309` and the grey `#6b7280` map to
`--warm` and `--muted` in `report/diagram_theme.py` (row 21); "installer"
may appear on `changes.html`, which records the words decision 27
retired (plan sections 5.2 and 6).
