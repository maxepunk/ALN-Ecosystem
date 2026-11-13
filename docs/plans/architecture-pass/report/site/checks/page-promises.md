# Check: promises.html

Checked 2026-11-01 against the site plan (section 3.3, section 6), every
inventory row homed on this page, version 7 (`2026-10-31-cause-report.html`
and `build_report.py`), the page data (`2026-10-31-engine-jobs.json`,
`2026-11-01-engine-shape.json`, `2026-10-31-cause-cards.json`), decision 28
(`CURRENT-STATE.md` section 0, `2026-11-01-after-game-report.md`) and the
shape document. The page was read as text with the command in the task.

**13 conflicts. 163 items checked** (110 page elements: 10 entries x 9
fields, 10 glance rows, 3 intro paragraphs, the lead-in, 2 diagrams, the
key, the relations note, the footer, the nav and status line; plus 53
inventory rows: 31 in table 1, 13 in table 2, 9 in table 3). Line numbers
are as the files stand now. EJ = `2026-10-31-engine-jobs.json`; its texts
also sit in `2026-10-31-engine-jobs.md`, so a data fix there keeps the two
equal.

## Conflicts

| # | Where on the page | What it says | What it should say | Place to change |
|---|---|---|---|---|
| 1 | Every entry, "Broken by" label; intro paragraph 2 | "Broken by these design flaws today, the main one first". "The designer changes a value..." has no main flaw (C8 and C12 are both secondary), so the label is false there; four entries have several main flaws (one game: C1 C6 C9 C11). Main and other flaws differ only by colour (`.secondary` is muted), so read as text, or by a colour-blind reader, nothing shows where the main ones end. Version 7 marked them in text (secondary ids unlinked, "(its card is under ...)") | "Broken by these design flaws today", with a "Main" and an "Also" tag before each group, as the glance table already does; when no flaw is main, the "Main" line says "none yet". Intro: "the main ones first, each marked" | `build_site.py` `promise_html`: label at line 1392, the `shorts` loop at lines 1369-1374; `front.json` `intros.promises[1]` (line 372) |
| 2 | Intro, paragraph 1, last sentence | "Whether these are the right ten, and whether three of them should split, is the promises question and A to G on Decisions." Two whether-clauses take "are"; "A to G" is bare and unlinked | "The [[q:promises]] asks whether these are the right ten; [[q:A\|questions A]] to [[q:G\|G]] ask about their wording and whether three of them should split." | `front.json` `intros.promises[0]` (line 371) |
| 3 | Intro, paragraphs 2 and 3 | "each a link to Parts"; "the cards are on Design flaws"; "are on Change log": page names dropped in as bare nouns read stiffly | "each a link to [[page:parts\|the Parts page]]"; "the cards are on [[page:flaws\|the Design flaws page]]"; "are in [[page:changes\|the change log]]" | `front.json` `intros.promises[1]` and `[2]` (lines 372, 373) |
| 4 | Intro, paragraph 2 | "where it is marked open, step 3 settles it" implies an unmarked goal has nothing open. Three unmarked goals end with open points: the night's record ("Whether refused scans are recorded stays open", the owner's question 19, not step 3), the designer's loop ("Where it runs is open"), the venue ("where, and how many tablets, stays open") | "A goal marked open is left to step 3 as a whole; other goals name what stays open in their last sentence." | `front.json` `intros.promises[1]` (line 372) |
| 5 | Every entry, test cases summary | "Answers the pass's questions 6, 5, 8": nothing on the site says what the pass's nine questions are, and the reader meets numbered questions (19, 21, 22, 24, 25) on Decisions that are a different list | Explain once in the intro: "The test cases' summary names which of the architecture pass's nine design questions the promise answers; these are not the numbered questions on Decisions." Optionally word the summary "the pass's design questions 6, 5, 8" | `front.json` `intros.promises[1]` (line 372); `build_site.py` `promise_html`, `qtext` (line 1378) |
| 6 | "The ten at a glance", lead-in | Two full titles dropped mid-sentence: '"Anyone reading a screen can act on it without a second question" by a label on every fact (how sure, how old), and "A change is proven before it reaches anyone, and the owner alone sends it to the show" by tests every part passes.' Stiff, and the three titles are not links | Short link forms: "Two are kept mainly by a quality every part must have, with a few parts of their own: [[promise:J9\|reading a screen without a second question]] by a label on every fact (how sure, how old), and [[promise:J10\|proving a change before it reaches anyone]] by tests every part passes. [[promise:J5\|The lifecycle buttons]] rest on a table of moments ..." Meaning unchanged | `build_site.py` `FIT_SUMMARY[3]` (line 204), and line 1415 renders it with `e(text)`: use `rich(text)` so markers resolve |
| 7 | "How the promises depend on each other", first figure | Caption "The promises at a glance" sits right under "The ten at a glance": two "at a glance" items on one page that are different things | "The main dependencies in brief" (or "The promises and the shared work") | `build_site.py` `page_promises`, figcaption line 1422 and the `diagram(...)` caption line 1424 |
| 8 | "Every tap gets its answer...", Built today | "Outside the engine, ALN's article writer, the Director Console, reads that report by hand." A program does not read by hand. The source: the director pastes the GM tablet's report into the console, and an AI call parses it (after-game report, "What it takes") | "Outside the engine, the director pastes that report by hand into ALN's article writer, the Director Console." | `build_site.py` `BUILT['J3']` (line 59) |
| 9 | "Every tap gets its answer...", folded needs | Item 1 says "held items (capability 14), where a held cue is an answer the GM sees"; item 4 says again "Held items (capability 14): a held cue counts as an answer the GM can see, ..." | Item 1: "Interaction primitives (capability 36): multi-tap actions are requests with the same reply shape." Item 4 keeps held items, with its "defined end for holds caused by a broken service" | EJ `jobs[J3].needs[0]` |
| 10 | "The game fits the venue...", folded needs | Item 4 repeats the standalone line two blocks above ("Today the tablet's mode is a tap, the phone's is its URL path, the hardware scanner has no such notion, and the pack has no field for it") and calls the phone's mode a "URL path" where the line says "web address" | "Standalone games need something that says a game is standalone; today the pack has no field for it." | EJ `jobs[J8].needs[3]` |
| 11 | "A change is proven...", Built today and folded needs | Built today: "the standing test rig was lost with the old container; step 2 rebuilds it". Needs, last item: "The rig that ran the real stack was lost with the container; its recipe survives." | Keep one: Built today "(the standing test rig was lost with the old container; its recipe survives, and step 2 rebuilds it)"; drop the needs item | `build_site.py` `BUILT['J10']` (line 66); EJ `jobs[J10].needs[5]` |
| 12 | "Each lifecycle button...", needs item 1; "The designer changes a value...", needs item 5 | "the eleven in the capabilities sheet's table ... which that sheet's section 3 places here"; "set no demand in the direction map's section 3". The page cites document sections the reader cannot see (plan section 6: the page never cites files) | "thirteen list it as a secondary promise, dormancy (capability 8) and the second game's modules (capability 38) among them"; "set no demand on it" | EJ `jobs[J5].needs[0]`, `jobs[J6].needs[4]` |
| 13 | "A change is proven...", Built today and needs item 5 | Working jargon with no meaning on the site: "a rung-1 run"; "the Block 1 deliverables", "the Block 6 close", "frozen production and blue containment honored" | "a run with the real programs in CI on the first test level"; "the program's first and last blocks (capabilities 45 and 51): the live machine stays frozen and nothing deploys until the owner says so" | `build_site.py` `BUILT['J10']` (line 66); EJ `jobs[J10].needs[4]` |

## What I checked and found right

**Rules.** No J1 to J10 in visible text; no "job", "installer" or em
dash. Promises go by their exact titles: the ten h2s, the glance rows and
the relations diagram's nodes all match `functional.proposedTitle` (the
relations source's old J8 label "Fit the game to..." is replaced by the
title at build time). "Venue technician" throughout. The shape is
written as a candidate ("Kept by these parts of the candidate shape";
"the parts named under each are a candidate"; "The promises wait for your
confirmation"). No edit history on the page: no earlier wording, no
"changed after the relationship map" note; the intro only points to the
change log.

**Decision 28.** "Every tap gets its answer..." names after the show the
director who tells the night's story and the players it is told to; its
need says how the story reaches the players is the game's own business;
its goal stamps the record with the game it ran and the texts the players
saw, keeps the Director Console a separate program and leaves room for
the Review stage. No player emails appear. X-08 (the two clocks) is a
card fact; nothing on this page contradicts it (the TV's clock in the
read-a-screen promise is a different matter).

**Entries, against EJ and version 7.** For all ten: who and when
(`functional.people`, `moment`), what they count on (`functional.need`),
the goal and the "(open for step 3)" mark (only the lifecycle promise has
`goalOpen`), the part chips (`parts`, names and anchors), the flaw lines
(every `flaws[].how`, mains first, N1 "(proposed)" and linked to
`flaws.html#n1`), the standalone line (prefix stripped as v7 did), the
needs and tests with their counts and the questions summary (row 55)
match the data and v7's text word for word. `BUILT`, `FIT_SUMMARY` and
`OVERVIEW` are equal to `build_report.py`'s. Entry order and the new
field order match plan 3.3.4 and the intro. The fallback "No design flaw
breaks this promise mainly" branch is kept (row 52). Flaw-to-promise
mapping agrees with the cards' homes (each card's main promise is the one
entry that lists it as main). Spot facts traced: "seven of 24 abilities"
(standalone pass section 4 via the today-components map); C11's "eight
answers ... four of them" (cause analysis); 25 links and 23
dependencies (shape document line 39); the lead-in's "two kept by a
quality" and "a table of moments" (shape document line 29).

**Glance table (rows 16, 17, 20; table 3 row 22).** Ten rows: title
link to the right entry, who, when, part links, flaws with "Main" and
"Also" tags; "none yet" for the designer's loop and "N1 (proposed)" kept.
The lead-in is v7's "How each promise is kept" passage.

**Diagrams (rows 21 to 23, 92).** Both drawn at build time as inline SVG
with `--accent`, `--warm`, `--muted` and `--dia-*` tokens, no stray colour
literal; the overview has v7's 14 edges, nodeSpacing 20 and its three-
swatch key with v7's sentence; the relations diagram is folded under
"The 25 main links between the promises" with v7's note.

**Links (row 93).** 159 links on the page; every `href` finds its id;
every flaw link's text is the id of the card it opens; every part link's
text is the name of the part it opens; every glance title opens its own
entry.

**Inventory rows accounted for.** Table 1: 1, 2 (title, design system),
11, 16, 17, 20, 21, 22, 23, 38, 39 (as the h1), 40, 42, 43, 45, 46, 47,
48, 49, 51, 52, 53, 54, 55, 90, 91, 92, 93 present; 41, 44 and 50
correctly absent (change log, flaws page). Rows 90 and 91: `changes.json`
does not yet hold "171 claims, 53 corrected" or the four relationship
maps, so the footer carries them, as inventory note 4 allows. Table 2:
rows 4, 6, 7 (diagram part), 30, 32, 37, 39, 42, 45, 46, 48, 49, 51.
Table 3: rows 1 to 5, 13, 22, 30, 31.

**Notes, not conflicts on this page.** (a) `build_site.py` copies
`BUILT`, `FIT_SUMMARY` and `OVERVIEW` from `build_report.py` instead of
importing them (inventory note 1 asks for an import); identical today.
(b) The lead-in says two promises are kept mainly by a quality, which
matches the shape document; the Parts page's qualities table
(`QUALITY_KEEPS`, line 184) also gives "mainly keeps" to three other
promises and differs from the shape's `qualities[].jobs`: for the Parts
page's checker. (c) The C9 line under the night's record calls refused
scans "the owner's open question" without linking question 19; the data
is escaped text, so a link needs a builder change.
