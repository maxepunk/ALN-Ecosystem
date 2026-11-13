# Check of the built page: `today.html` (version 9)

Checked 2026-11-01, refute by default. The built page was read as text
(diagram labels kept) against plan v2 sections 2, 3.5 and 6 (plan v1
sections 2, 4, 5 and 6 where v2 is silent); `front.json` `intros.today`
and `front.words` with `v9/front-log.md`; `build_site.py` (`BUILT`,
`WELL_BUILT`, `SET_ASIDE`, `PARITY_WORDS`, `PARITY_PREFIX`,
`STANDALONE_P1`, `STANDALONE_P2`, `PARITY_NOTE`, `EVIDENCE_INTRO`,
`FOOTERS['today']`, `card_html`, `n1_html`, `page_today`, `parity_html`,
`part_row`, `questions_line`, `chips`); the data files
`2026-10-31-cause-cards.json`, `2026-10-31-standalone-lines.json`,
`2026-10-31-engine-jobs.json`, `2026-11-01-engine-shape.json`; the
decision record `DECISIONS.md`; `v9/decisions.json` (question letters
and titles); the panel's brief; the jargon table; `v9/build-log.md`;
and version 8's Design flaws and Promises pages (`git show 72b4f813:...`).
22 conflicts; 253 items checked.

Paths: overlays under `report/site/v9/`; `build_site.py` and the data
files under `report/`.

## Conflicts

| # | Where on the page | What it says | What it should say | Where to change it |
|---|---|---|---|---|
| 1 | Header, paragraph 2, end of sentence 2 | "the panel sees this page only after its first proposals" | The panel never sees this page. Its brief gives it, in the second round, today's engine as facts and the sixteen situations "with no fix attached"; this page attaches the earlier candidate's fixes. Say: "The panel meets these situations only in its second round, as facts with no fix attached." | `front.json` `intros.today[1]` |
| 2 | Header, paragraph 2, sentence 2; and What works today, The pieces already well built, item 2 | The same point twice, each with a link to "Blue's fixes are evidence of design causes": "Blue's fixes and the findings behind each flaw are clues to where today's design is off, never the driver" and "its fixes and the problems found in it are evidence of where today's design is weak, never the reason for a design". The header also uses "Blue" before the page says what blue is (that comes only in the second instance). | Say it once, where blue is first named: "Blue, the show machine in use now, runs every show until the new engine is ready. Its fixes, and the problems it left unfixed, are evidence of where today's design is weak, never the reason for a design (link)." The blue item is not a piece already well built, so it belongs in the header, and the "well built" list keeps the hardening pieces only. The record's words are "the findings blue left unfixed", not "the findings behind each flaw". | `front.json` `intros.today[1]`; `build_site.py` `WELL_BUILT[1]` (drop it) |
| 3 | Sixteen situations, lead-in under the heading | "Each is a design flaw of today's engine, kept as a situation every design is checked against. Under each card's first drawing, where it goes wrong today, the second is folded: the earlier candidate's way of removing it." | Both sentences repeat the header ("each a situation any new design must handle ... Every design ... is checked against these situations"; "Under each flaw, folded, is how the earlier candidate would remove it"), and the second reads stiffly. Replace the lead-in with the card guide in conflict 4. | `build_site.py` `page_today()`, the `lead-in` paragraph literal |
| 4 | Sixteen situations, before the first card (nowhere on the page) | Version 8's intro told the owner what each part of a card is. Version 9 drops it: nothing says that "The problems behind it" lists only a few of a card's problems (a card says "19 problems found" and lists six), that "the architecture pass questions" are the pass's nine questions and not the questions on Decisions, or that "In design terms" restates the cause in the words of The engine page's word list (module, interface, seam, locality, adapter). | One short paragraph: "Each card tells one moment at a show and why it happens, then what it does in a standalone game. The drawing shows where it goes wrong today. The card's head names the architecture pass's own questions it touches (the nine questions the pass answers, not the questions on Decisions). In design terms restates the cause in the words listed on The engine page (link to the words). The problems behind it lists a few of the card's problems and the code they live in." | `build_site.py` `page_today()`, the `lead-in` paragraph (replacing conflict 3's text) |
| 5 | Every card, "In design terms" (sixteen places), outside the fold | Visible on every card, outside "How the earlier candidate would remove it": "The Pack channel should own one loaded pack behind one interface ...", "The Game record should own which tokens are claimed ...", "Lifecycle should own the table of moments ...", "Joins and proofs should own every test ...". | The earlier candidate's parts written as what the design should be, on the face of the card, breaks the proactive frame: the candidate is one input among the panel's and never the answer. Either move the paragraph into the fold, after the parts row, or split it: today's cause stays visible ("Today both the copy the engine froze at start and the files on disk under it cross the seam: no locality."), and the "should own" half goes into the fold as "In the earlier candidate, Pack channel would own ...". | `build_site.py` `card_html()` (move `<p class="design">` inside the `<details class="fold">`), or `2026-10-31-cause-cards.json` `cards[].designTerms` split into two fields |
| 6 | Cards "Engine and tests both assume they own the machine", "Names joining two places are kept by hand", "A green test run proves nothing about the show": parts rows, In design terms, folded notes and diagrams; the second card's standalone line | "Removed by these parts of the earlier candidate Engine instance Joins and proofs Design studio"; "Joins and proofs should own every test ..."; "Joins and proofs checks every test stand-in against the real part ..."; "Joins and proofs would check each device against the pack ..." | The decision "One published protocol and an outside test bench" replaced Joins and proofs; the Design page marks it replaced, this page does not. Wherever it is named, add "(replaced by the published protocol and the test bench outside the engine)" with the two links, as `part_html` does on Design. | `build_site.py` `part_row()` / `part_link()` (mark `JOINS` as `part_html` does); `2026-10-31-cause-cards.json` `cards[id=C16].designTerms` and `after.note`, `cards[id=C14].designTerms` and `after.note`; `2026-10-31-standalone-lines.json` `lines.C14` |
| 7 | Card "Nothing says what a game boundary clears or keeps", In a standalone game | "a game id from the tablet that they check, if they are joined to it ( question M ), or a reset of their own." | Questions carry letters only on the Decisions page: "... if they are joined to it (your open question One GM tablet per standalone game?), or a reset of their own." (title linked to `decisions.html#q-m`). | `2026-10-31-standalone-lines.json` `lines.C4` (the `[[q:M]]` marker) |
| 8 | The proposed seventeenth, last line | Tag "Proposed, with no card", then "Whether it is a design flaw of its own, needing its own design choice, is question G ." | The tag is internal history (it means "no record in the cards data") and contradicts what the reader sees, a card. The letter breaks the titles rule. Say: tag "Waiting for your answer", then "Whether it is a design flaw of its own, needing its own design choice, is part of your question The venue promise names declared standalone." (title linked to `decisions.html#q-g`). | `build_site.py` `n1_html()`, the `<p class="design">` literal |
| 9 | The evidence, The 21 set aside, row "A question for you" | "It is question O on Decisions ." | "It is your open question Record every refused GM scan attempt? on Decisions." (title linked to `decisions.html#q-o`; the separate "Decisions" link can go). | `build_site.py` `SET_ASIDE[4]` (the `[[q:O]]` marker) |
| 10 | What works today, The pieces already well built, item 1 | "The hardening block's merged pieces stay in the engine and change only where a design choice requires: the equipment families, the core that marks equipment not installed tonight, and the smallest test set-up" | A block's name may stay only if the page says what it means at first use; "merged", "equipment families" and "the core" need the internal documents. Say: "Three pieces finished in the hardening block, the roadmap's work to make the show machine safer, stay in the engine and change only where a design choice requires: the list of kinds of equipment a pack says it needs, the code that marks equipment not installed tonight, and the smallest test set-up (link)." | `build_site.py` `WELL_BUILT[0]` |
| 11 | What works today, "A change is proven before it reaches anyone ...", first clause | "Automated tests at four levels, from single pieces of code to the whole system in a browser; an automatic test run ... at the level of real programs with stand-in hardware" | "Four levels" here means the four kinds of test (small tests, contract tests, integration tests, full run-through tests), but the site's named test levels are also four (logic only; real programs with stand-in hardware; the home test bed; the venue), and the same sentence then names one of those. Say: "Four kinds of automated test, from small tests of single pieces of code to full run-through tests of the whole system in a browser; ..." | `build_site.py` `BUILT['J10']` |
| 12 | In a standalone game, on five cards ("Each tablet keeps its own list of claimed tokens", "Service health and service state travel on separate paths", "Tablets and phones decide facts the engine owns", "Screens show a normal value when nothing is known", "Several places answer the same question, each differently") | "In the candidate shape ..." / "The candidate shape declares ..." / "The candidate shape puts ..." | The page names it "the earlier candidate" everywhere else, and the plan names it so outside the change log. Say "In the earlier candidate ...". | `2026-10-31-standalone-lines.json` `lines.C1`, `lines.C2`, `lines.C9`, `lines.C10`, `lines.C11` |
| 13 | Folded notes on fourteen cards, last sentence | "Or: the parts keeping each promise send their own facts."; "Or: an interface per program, ..."; "Or: two kinds of connection, ..." | "Or:" with no subject: the owner cannot tell this is the other way the earlier candidate weighed. Say "The other way the earlier candidate weighed: the parts keeping each promise send their own facts." | `2026-10-31-cause-cards.json` `cards[].after.note` (or one prefix in `build_site.py` `card_html()`) |
| 14 | Card "Reconnect snapshot and live update are built apart": Today drawing, In design terms, the problems | "Five adapters reshape before drawing"; "five adapters on the tablet reshape what it builds"; "five adapters reshape them, and the clock's adapter loses the values it does not name" | The site's word list defines an adapter as "the real thing plugged in at a seam, like VLC"; here it means five pieces of tablet code that convert a message. Say "five pieces of tablet code reshape ...", "the clock's piece loses ...". | `2026-10-31-cause-cards.json` `cards[id=C6].before.mermaid`, `.designTerms`, `.examples[]` (the line on formats) |
| 15 | Card "Names joining two places are kept by hand": Today drawing, In design terms, the problems | "Tablet data layer no score-box value"; "Networked half holds the score-box value"; "a value the layer above it never passes on"; "a step that the tablet's data layer does not have" | The owner cannot read "data layer", "the layer above it" or "Networked half" without the code. Say "the tablet's store of game data", "the part of it used in a networked game", "a value the tablet's store never passes on". | `2026-10-31-cause-cards.json` `cards[id=C14].before.mermaid`, `.designTerms`, `.examples[0]` |
| 16 | Standalone today, the comparison table, first column | A "Row" column numbering every behaviour 1 to 24 ("1 How "no engine" is chosen", "2 Configuration needed" ...) | A number in front of a title invites "row 12"; the table's rows are named by their behaviour. Drop the column (the numbers stay as `PARITY_WORDS` keys). | `build_site.py` `parity_html()` (the `<td class="num">` cell and the `Row` header) |
| 17 | Standalone today, the comparison table, cells | Row "Start-up time": "with a Wi-Fi name set ... with no WiFi name both are skipped" and "(an empty WiFi name already skips WiFi and health)"; row "Team field": "Required by the config check, which does not stop boot; whatever value parsed, or nothing, is stamped on queued scans"; row "Dismiss": "Double-tap, 1-second splash first"; row "Pack identity shown", last cell: "Read identity from a file on the card"; header "What the hardware scanner would need (candidate)" | One spelling, "Wi-Fi"; "skips Wi-Fi and the check-in with the engine". "Required by the settings check, which does not stop start-up; whatever value was read, or nothing, is written on each queued scan". "Double-tap, after a 1-second opening screen". "Read which pack it is from a file on the card". Header "What the hardware scanner would need (a proposal, not decided)", so "(candidate)" is not read as the earlier candidate. | `build_site.py` `PARITY_PREFIX[('18', 2)]` and `PARITY_WORDS` (add rows `'18'` cell 3, `'20'` cell 2, `'23'` cell 2, `'6'` cell 3); `parity_html()` header |
| 18 | The evidence, The 21 set aside, rows "Already fixed in today's code" and "Plain fixes for the build half" | "(fixed in this work's first follow-ups on green)"; "standalone mode's red "Disconnected" pill" | "This work's first follow-ups" reads as edit history and needs the record to decode. Say "(fixed on 2026-10-30, with three small fixes for green, the new show machine)". "pill" is a developer's word: "red "Disconnected" label". (The first wording is the jargon table's row F158; the table's row needs the same change.) | `build_site.py` `SET_ASIDE[0]` and `SET_ASIDE[1]`; `checks/jargon-table.md` row F158 |
| 19 | Footer | "the survey of ALN's after-game tools (2026-11-01; the two clocks)" | "The two clocks" appears nowhere else on the page; the reader cannot tell what it means. Say "(2026-11-01; the sale and adjustment times printed hours apart)". | `build_site.py` `FOOTERS['today']` |
| 20 | Card "Engine and tests both assume they own the machine": At a show, and the first problem | "In this code the same test run kills the live engine's watcher ..."; "in this code it stops the video player's watcher ..." | "This code" has no referent for the owner (it means today's engine code, as against blue's). Say "In today's code ...". | `2026-10-31-cause-cards.json` `cards[id=C8].atAShow`, `.examples[0]` |
| 21 | Header, paragraphs 2 and 3 | "Nothing here drives the design. Blue's fixes ... never the driver"; "the findings behind each flaw"; "Standalone today, with the table comparing ..., and the evidence (the totals, the findings set aside with their reasons, and where each flaw lives in today's code) close the page."; "the earlier candidate" unlinked | "Drives" and "driver" twice in two sentences, and the image of a driver; the page says "problems" everywhere else, the header "findings"; the closing sentence is a stiff table of contents. Say "Nothing here is the reason for a design." Use "problems". Close with "The page ends with standalone games today, with the table comparing the two player scanners, and the evidence: the totals, the problems set aside and why, and where each situation lives in today's code." Link "the earlier candidate" to `design.html#earlier`. | `front.json` `intros.today[1]`, `intros.today[2]` |
| 22 | Sixteen situations, the glance table | Rows in an order nothing on the page explains (it is the hidden id order: claimed tokens, health, stale picture, game boundary, ...), while the cards below are grouped by promise | Put the rows in the cards' order, grouped by the promise each mainly touches, so the table reads as the index of the cards below. | `build_site.py` `page_today()`, the `entries` sort |

## What was checked and found right

- **Frame and shell.** The status line is plan v2's sentence, exactly.
  Navigation reads The engine · Decisions · Requirements · Design ·
  Today's engine · Change log. No visible flaw, finding, promise,
  target or case id; no bare phase, step, block, round, decision or
  question number; no em dash. Every card's second drawing sits in a
  closed fold labelled "How the earlier candidate would remove it",
  and each folded drawing is captioned "Candidate, not decided".
- **What works today.** All ten promises, each linked to its entry on
  Requirements, with version 8's "Built today" text and the jargon
  table's rows P31, P40, P79 and P92 applied (the test rig line now
  "built again when the build half starts", from the decision "Build the
  test rig when building starts"). The health words match the word
  list's "Health words" entry. Blue running the shows until the new
  engine is ready matches the record ("The architecture pass is the work
  now") and the roadmap. The hardening pieces match "Corrections to the
  readers and the hardening pieces" (wording aside, conflict 10).
- **The glance table.** Seventeen rows (sixteen and the proposed one
  marked "(proposed)"), each title linked to its card; the promise each
  mainly touches and the others match version 8's columns; the problem
  counts (19, 6, 25, 22, 7, 11, 18, 41, 19, 20, 29, 20, 24, 41, 12, 23;
  8 for the proposed one) match the cards data and version 8; seen live
  on six (C2, C3, C8, C10, C15, C16 in the data), reproduced in a test on
  two (C5, C11), and the summary line says so. The parts column is
  dropped with the build log's reason; the parts now sit in each fold.
- **The sixteen cards.** Grouped under the promise each mainly touches,
  in promise order; titles only. Each card's head: problem count, blue's
  fixes as a count ("A fix on blue points here", "Two ... Five fixes on
  blue point here", matching the number of `blueFixes`), seen live or
  reproduced in a test as a separate chip, the architecture pass
  questions by name (and "No architecture pass question covers it" on
  the three the review left outside the nine). At a show, Why it
  happens, the seen-live notes, the standalone lines, both drawings, the
  folded notes and the problem lines render the cards data unchanged in
  substance from version 8 (finding ids dropped by row F7); the code
  file lists are kept. A number check of version 8's Design flaws page
  against this page loses only finding ids and flaw numbers.
- **The proposed seventeenth.** Title, "Proposed", 8 problems (the
  standalone review's eight N1 findings); what breaks, the promise it
  mainly touches and the three others with their lines from the
  promises data; its earlier-candidate parts (Pack channel, Venue fit)
  folded under the same label as the cards.
- **Standalone today.** The decision "Standalone games: declared, never
  mixed" stated as the record states it; "four ... no problem, four in
  part, eight in full" matches the standalone lines (four say "no fault
  today"); the two biggest gaps as in version 8 with row F135; the
  parity note; the 24-row table folded, with the jargon table's 19
  parity rows and the build log's three extra cells applied, shaded
  rows as version 8. Row "Seen mark" names the situation by title.
- **The evidence.** 358 in all, 337 under the sixteen (the card counts
  sum to 337), 21 set aside (7 + 5 + 2 + 2 + 1 + 4), and 35 from the
  standalone review, 27 under the situations and 8 under the proposed
  one (the data's `newFindings` causes agree). The set-aside table keeps
  version 8's six groups and items in plain words; "Documents" links "No
  rule for documents: fix as we go" correctly. The code grid has sixteen
  rows by title and version 8's nine columns, "Contracts" renamed
  "Message lists" (row F163).
- **Links.** Every link's words name where it goes: flaw titles to
  `#c1`...`#c16` and `#n1`, promise titles to their entries on
  Requirements, part names to their cards on Design, decision titles to
  their entries on Decisions.
- **Footer.** Names the review that named the design flaws, the review
  of standalone games, the promises, the earlier candidate, the
  after-game survey and the decision record by name and date (one
  phrase, conflict 19).
