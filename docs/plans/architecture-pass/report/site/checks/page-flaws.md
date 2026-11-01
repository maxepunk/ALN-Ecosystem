# Check: flaws.html

Checked 2026-11-01 against the site plan (section 3.5, section 6), every
inventory row homed on this page, version 7 (`2026-10-31-cause-report.html`
and `build_report.py`), the page data (`2026-10-31-cause-cards.json`,
`2026-10-31-engine-jobs.json`, `2026-10-31-standalone-lines.json`,
`2026-11-01-engine-shape.json`), `front.json` `intros.flaws`, the cause
analysis (sections 3, 4, 5.5, 5.6), the standalone pass (sections 1, 3.4, 4),
decision 28 (`CURRENT-STATE.md` section 0, `2026-11-01-after-game-report.md`)
and `changes.json`. The page was read as text with the command in the task,
diagram labels kept, and each card was diffed against version 7's card by
script.

**15 conflicts. 234 items checked** (100 page elements: nav, status line and
title, 3 intro paragraphs, the legend, 17 glance rows, 9 group headings, 16
cards field by field, the N1 entry, 2 standalone paragraphs, 24 parity rows,
the evidence intro, 6 set-aside rows, 16 grid rows, the footer; 55 inventory
rows: 32 in table 1, 19 in table 2, 4 in table 3; 79 distinct link
target-and-text pairs). Line numbers are as the files stand now. CC =
`2026-10-31-cause-cards.json`.

## Conflicts

| # | Where on the page | What it says | What it should say | Place to change |
|---|---|---|---|---|
| 1 | C9 card, "The problems behind it", X-08 | "A sale carries the tablet's clock and a manual adjustment the engine's, so the bonus and transfers printed nine hours from the sales; ALN's article writer shifts them back." The cause is missing (the GM enters the bonus and transfers as adjustments), "nine hours from" lacks "away", and the program that shifts the times is the Director Console (cause analysis X-08: "ALN's Director Console shifts them back before its writers read them"; after-game report: "the console shifts them back"). The site's change log (C9) and front page call it the Director Console; this page alone says "article writer" | "A sale carries the tablet's clock and a manual adjustment the engine's. The GM enters the first-burial bonus and the transfers as adjustments, so they printed nine hours away from the sales; ALN's Director Console shifts them back." | CC `cards[C9].examples[6].text` (line 547) |
| 2 | Intro, paragraph 2, last two sentences | "The problems behind it lists the findings ... each with its id ... The card's head counts those findings": the list holds 4 to 7 of them (C8 counts 41, lists 6; C14 counts 41, lists 5). "names any fix on blue it came from as a clue": the flaw did not come from the fix; the fix is a clue to it | "The problems behind it lists a few of its findings, each with its id, and the code they live in. The card's head counts all its findings, ... and names any fix made on blue that points to it, as a clue." | `front.json` `intros.flaws[1]` (line 382) |
| 3 | Intro, paragraph 2, order | "A card tells one moment at a show, then why it happens. Two diagrams follow." and "In a standalone game" described after "in design terms". On every card the "Seen live" note (8 cards) and "In a standalone game" sit between "Why it happens" and the diagrams | "A card tells one moment at a show and why it happens. Where it was seen live, a note says how. In a standalone game says what the flaw does with no engine, today and in the candidate. Two diagrams follow. ..." (then the parts and design terms, without the later standalone sentence) | `front.json` `intros.flaws[1]` (line 382) |
| 4 | Every card head; intro paragraph 2 | Chips "Questions 6, 5, 8", "Question 4", "No question covers it (nearest: 5)"; the intro "names the questions it answers". These are the architecture pass's nine design questions, which no page lists, while the same page names question C, question 23 and question 19 (Decisions' list). A reader takes "Question 4" for a Decisions question | Intro: "names which of the architecture pass's nine design questions it answers; these are not the questions on Decisions." Chips: "Pass questions 6, 5, 8" / "Pass question 4" / "No pass question covers it (nearest: 5)" | `front.json` `intros.flaws[1]` (line 382); `build_site.py` `chips()`, lines 92, 94, 96 |
| 5 | Glance table, "Findings" column; intro paragraph 1 | The intro says the table gives "how many findings sit under it". C1 to C16 show only the cause analysis's findings (sum 337); the 27 standalone-pass findings placed under them (8 under C10, 4 under C4 ...) are in no count, while N1's 8 are all standalone-pass findings. One column, two bases | Intro: "how many findings from the cause analysis sit under it (for N1, from the standalone pass)"; or a header "Findings (cause analysis)" with a footnote row for N1 | `front.json` `intros.flaws[0]` (line 381); `build_site.py` `page_flaws`, table header line 1585 |
| 6 | The evidence, intro | "... and 8 under the proposed N1 that question 23 asks about, now folded into question C." "now folded into" is edit history; question 23 is on no page; and this is the third time the page ties N1 to question C (intro paragraph 1, the N1 entry) | "... and 8 under the proposed N1." (the N1 entry keeps "question C, where question 23 is folded in", as inventory row 51 asks) | `build_site.py` `EVIDENCE_INTRO`, lines 965-968 |
| 7 | The evidence, intro; intro paragraph 2 | "358 problems came from blue's records and the maps of today's engine"; "the findings from blue's shows and from the maps of today's engine". X-08, one of the 358 and on the C9 card, came from the survey of ALN's after-game tools (cause analysis 5.5: "the after-game survey, 2026-11-01, decision 28 (X-08)") | "358 problems came from blue's records, the maps of today's engine and, for one, the survey of ALN's after-game tools; ..." and in the intro "from blue's shows, the maps of today's engine and the after-game survey" | `build_site.py` `EVIDENCE_INTRO` line 965; `front.json` `intros.flaws[1]` (line 382) |
| 8 | Footer | "The cards were reconciled with the engine-shape document of 2026-11-01, each group checked on its own." That is history: inventory row 91 sends the reconciliation and its checks to the change log, where version 5 already holds it (182 verdicts, 96 corrected). The footer also omits documents the page is built from: the promises document (the grouping, "Mainly breaks", "Also breaks", N1's lines), the after-game report (X-08) and the four relationship maps (row 91) | "Built from the cause analysis of 2026-10-30 with its two checks; the standalone pass of 2026-10-31 with the ESP32 parity table; the promises document of 2026-10-31 (which promise each flaw breaks); the engine-shape document of 2026-11-01 and the four relationship maps it was drawn from (the candidate side and the parts); and the after-game report of 2026-11-01 (the two clocks under C9)." | `build_site.py` `FOOTERS['flaws']`, lines 999-1003 |
| 9 | N1 entry, second label | "It also touches", where the glance table's header for the same list is "Also breaks" and the owner's words are that design flaws break promises | "It also breaks" | `build_site.py` `n1_html`, line 1559 |
| 10 | C5 and C11 cards, "Seen live" notes | C5: "The red Display row after a reset was reproduced in-process by the review." C11: "The display's false healthy Check Now was reproduced in-process by the recovered review." "In-process" and "recovered review" are compressed jargon; "false healthy Check Now" reads stiffly | C5: "The review reproduced the red Display row after a reset on a running engine." C11: "The review reproduced, on a running engine, Check Now reporting the display healthy when it had not started." | CC `cards[C5].seenLive` (line 299), `cards[C11].seenLive` (line 687) |
| 11 | C7 and C13 candidate notes; C7, C11, C12 candidate diagrams | "one door and one list of outcome words"; "Or: two doors, one public for scoreboards and players, one for the GM"; diagram labels "Answering one door, one reply", "one door for scans and commands", "one door, every way in". "Door" is a metaphor (process.md: no metaphors). The same word runs through the shape data, Parts and The engine, so fix it site-wide or define it once in the words list | C7: "The Game record saves, then gives Answering the outcome: Answering takes every request and replies with one list of outcome words for every device." C13: "Or: two kinds of connection, one public for scoreboards and players, one for the GM." Labels: "Answering: every request, one reply" | CC `cards[C7].after.note` (line 389), `cards[C13].after.note` (line 782), `cards[C7/C11/C12].after.mermaid`; site-wide `2026-11-01-engine-shape.json` or `front.json` `words` |
| 12 | C5 card, candidate note | "One routine for start and reset, split in two." Read with the next sentences it says one thing and its opposite | "Two pieces replace today's two lists: a starting point builds every part once, from one list, and Lifecycle runs start and reset as one path and alone calls every reset." | CC `cards[C5].after.note` (line 274) |
| 13 | Parity table, rows 12 and 14 | Row 12: "The analysis's candidate (d) for C9 removes it from the player role instead". Row 14: "Decide what a standalone record is (SP-05) before matching either side". Candidate (d) and finding SP-05 appear on no page, so the reader cannot follow either | Row 12: "Optional. One design for C9 takes the seen mark away from player devices instead." Row 14: "Decide what a standalone record of player scans is before matching either side." | `2026-10-31-standalone-pass.md` section 4, rows 12 and 14 (lines 270, 272), which `build_site.py` `parity_rows()` (line 133) parses; or an override there |
| 14 | Standalone games, paragraph 2 and the parity summary | The section says "the ESP32" throughout; the intro and every card say "the hardware scanner". Nothing on the page says they are one device | Summary: "The ESP32 hardware scanner against the web scanner with no engine: 24 differences" | `build_site.py` `page_flaws`, summary line 1628 |
| 15 | The evidence, set-aside table | "Already fixed in this tree", "the harness-minimum review items", "the environment template's bus variables (green's follow-ups)", "read as a real key in plain-object lookups": compressed jargon for the owner | "Already fixed in this code"; "the items the review asked for before the test rig"; "the sound settings in the environment template (green's follow-ups)"; "a token named like a built-in word, such as \"constructor\", read as a real token" | `build_site.py` `SET_ASIDE`, lines 124-125 |

## What was checked and found right

- **Cards against version 7.** All 16 cards were diffed by script against
  version 7's. The only differences are the removed "Changed after the
  relationship map" notes (moved to `changes.cards`, row 56) and the capital
  letter after "In a standalone game". Every other field is word for word:
  chips, at a show, why it happens, seen-live notes, standalone lines (SL),
  both captions, the candidate notes, part chips, design terms, problems and
  code. 32 diagrams drawn inline, 16 "Today" and 16 "Candidate, not
  decided"; no Mermaid loads; no stand-in colour is left.
- **Cards against the data.** Findings, questions, blue's fixes, seen live
  and parts match CC for all 16. Card parts equal the shape's
  part-to-flaw lists for every flaw; N1's parts (Pack channel, Venue fit)
  come from the shape.
- **C9 carries X-08** (decision 28 point 6), and C9's count of 19 includes
  it (cause analysis 5.6). Only its wording is wrong (conflict 1).
- **Glance table.** 17 rows. Every "Mainly breaks" and "Also breaks" cell
  matches the engine-jobs `flaws[]` and `primary` flags (C16 has no other
  promise; N1 also breaks the designer's game, every tap and reading a
  screen). Parts, findings and seen live match CC (8 seen live: C2, C3, C5,
  C8, C10, C11, C15, C16).
- **Grouping.** Nine groups in promise order; group headings are the exact
  titles, linked; the lifecycle-buttons group holds C4 and C5, the venue
  group N1 alone; the promise with no main flaw has no group. Card order
  matches version 7 and inventory table 2 rows 31 to 55.
- **N1 entry.** Its main line is the venue promise's N1 `how`, its three
  other lines the other promises' N1 `how`s, its count the 8 N1 findings in
  SL, and it points to question C with question 23 folded in (rows 51, 73).
- **Standalone games.** Both paragraphs are version 7's, word for word; the
  4/4/8 split matches the standalone pass section 1 (C2, C3, C8, C13 none;
  C1, C5, C6, C7 partly; the other eight in full). Parity table: 24 rows,
  7 shaded, as in version 7.
- **The evidence.** 337 is the sum of CC findings, 21 the sum of
  `SET_ASIDE` (7+5+2+2+1+4), 358 their sum, matching the cause analysis
  5.6 totals; 35 = 27 + 8 from SL. The set-aside table and the grid match
  version 7; `SET_ASIDE`, `OUTSIDE_NINE` and `PARTS` are byte-identical to
  `build_report.py`'s. Folds: 19 (16 cards, parity, set-aside, grid).
- **Rules.** No promise id, no "job", no "installer", no em or en dash in
  the visible text or diagram labels. Every promise link shows its exact
  title and lands on its anchor; every flaw link lands on its card; part
  links land on `parts.html` by name; the three question links land on
  `#q-c`. Nothing on the candidate side is written as decided: design terms
  say "should own", and every candidate diagram is captioned "Candidate,
  not decided".
- **Inventory.** Rows 12, 13, 16, 17, 49, 50, 51, 56 to 79 and 91 (table
  1), rows 4, 31 to 55 and 56, 57 (table 2) and rows 13, 23, 24, 25 (table
  3) are all on the page, except the parts of row 91 that conflict 8
  names.
- **Size.** 8,240 prose words, below the plan's 9,000 to 11,000 target
  (a target, not a limit); nothing from version 7 is missing, so the gap
  needs no new text.
