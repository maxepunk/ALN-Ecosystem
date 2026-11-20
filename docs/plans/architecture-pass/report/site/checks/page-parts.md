# Page check: parts.html

Checked 2026-11-01 against the site plan (section 3.4 and the rules of
section 6), version 7 (`2026-10-31-cause-report.html` and
`build_report.py`), the shape data (`2026-11-01-engine-shape.json`),
the shape document (`2026-11-01-engine-shape.md`), decision 28
(`CURRENT-STATE.md` section 0 and `2026-11-01-after-game-report.md`)
and every inventory row whose home is `parts.html`. The page was read
as text with the diagrams' labels kept, and its links were read from
the HTML.

**23 conflicts. 118 items checked.**

"ES" is `report/2026-11-01-engine-shape.json`; "BS" is
`report/build_site.py`. Line numbers are as the files stand now.

## Conflicts

| # | Where on the page | What it says | What it should say | Where to change it |
|---|---|---|---|---|
| 1 | Where today's code tangles, the note under the summary | "Each causes some of the design flaws on Design flaws." The link repeats the words just before it. | "Each causes some of the design flaws named under it." The flaw links under each tangle already lead to the Design flaws page. | BS `TANGLE_NOTE`, lines 926 to 928 |
| 2 | Header, paragraph 1, sentence 4 | "In the candidate each such piece of work becomes one part, seventeen in all". This says all seventeen parts come from shared work. The shape makes one part per promise or per piece of shared work (shape section 4: "one part per job or per shared mechanism"); seven parts, such as Game record, Show runner and Release, carry one promise's own work. | "In the candidate each such piece of work becomes one part, and so does the work only one promise needs: seventeen parts in all." | `front.json` `intros.parts[0]` (line 376) |
| 3 | Header, paragraph 1, sentence 4 | "the parts already well built today (the game rules, the verdict, the health words)". The health words are not a part; the shape places them inside the verdict (section 2.3, M-F). Version 7 carried the same slip. | "the parts already well built today (the game rules, and the verdict with its health words)" | `front.json` `intros.parts[0]` (line 376) |
| 4 | Header, paragraph 1, last sentence | "where the map found two sound ways, the last table on this page names both and what each costs." Paragraph 3 announces the same table ("the choices where a real alternative exists"), and the table's own intro says "the map found two sound ways" again. | End the sentence at "puts competing designs in front of you." | `front.json` `intros.parts[0]` (line 376) |
| 5 | Header, paragraph 2, sentence 2 | "What it does says the part's work in plain words." No card shows a "What it does" label: the card's first paragraph has no label, so a reader looks for one that is not there. | "The card's first paragraph says the part's work in plain words." | `front.json` `intros.parts[1]` (line 377) |
| 6 | Header, paragraph 2, sentence 3 | "Mainly keeps names the promises the part exists for, and also needed by the promises that use it". The second clause has no verb and reads as broken. | "Mainly keeps names the promises the part exists for, and Also needed by names the promises that use it;" | `front.json` `intros.parts[1]` (line 377) |
| 7 | Header, paragraph 2, sentence 4 | "Today says how the same work is done now". Only ten of the seventeen cards carry Today (the parts that take over shared work, BS `MECH_PART`); the sentence reads as if every card does. | "Today, on the ten parts that take over work done in several places now, says how it is done; Removes names the design flaws the part would take away, each a link to [[page:flaws]]." | `front.json` `intros.parts[1]` (line 377) |
| 8 | Header, paragraph 3 | "the parts in layers (each part uses only the parts in the rows below it, so nothing loops back)". The layers caption says the same words a screen later, and the "uses" note says "No arrow loops back" a third time. | Drop the parenthesis: "the parts in layers and five moments at a show ..." | `front.json` `intros.parts[2]` (line 378) |
| 9 | Five moments, the line under each walkthrough title | "Keeps" followed by the promises. A moment does not keep a promise; parts do (decision 27). The plan asks for "the promises it shows" (3.4, item 4). Version 7 said "Keeps"; the meaning is kept by the new word. | "Shows" followed by the promises. | BS `page_parts`, the walks f-string, line 1470 |
| 10 | Qualities, row "Who decides when there is no engine" | "Today: A tap on the tablet, ..." with a capital A after the colon. `today_of()` capitalises the letter after "Today " and `page_parts` then adds "Today: " again. | "Today: a tap on the tablet, ..." | BS `page_parts`, line 1458 (pass the mechanism's text with its first letter kept lower case, or lower it there) |
| 11 | The parts in layers, folded "Which part uses which: 54 links" | The diagram's boxes read "P1 Game rules" to "P17 Release". Part numbers appear nowhere else a reader sees, so they mean nothing here; the site names parts, as it names promises, by name. | Boxes read "Game rules" to "Release". | BS `page_parts`, line 1502: strip the `P\d+ ` prefix from the node labels of `shape["partsMermaid"]` before `present()` (the edge parse at line 158 reads ids, not labels, so it is unaffected) |
| 12 | Every part card's Removes line, and every tangle's "Flaws:" line | Bare ids, "C9 C14 C11", with no title. In version 7 the cards sat on the same page; here the titles are a page away, so the ids say nothing until clicked. | Keep the short ids, and give each link the flaw's title as a `title` attribute, so it shows on hover and to screen readers. | BS `flaw_a()`, line 708, and `flaw_links()`, line 715 |
| 13 | Where today's code tangles, tangles 2, 6 and 11 | "re-decided in five parts"; "nineteen parts each reset themselves"; "tests per part" and "Twelve test configurations by part". On the Parts page, "part" names the seventeen candidate parts; these mean today's modules and areas. The shape document says "nineteen modules each have a reset()" (section 3.3, T6). | "re-decided in five places"; "nineteen modules each reset themselves"; "tests by area" and "Twelve test configurations, one per area of the engine". | ES `today.tangles[1].title` (line 167), `today.tangles[5].plain` (line 188), `today.tangles[10].title` and `.plain` (lines 212, 213) |
| 14 | Where today's code tangles, tangle 12 | Title "Shallow chains and thick doors". A metaphor and design jargon in an owner-facing title (rule: no metaphors). | "Long call chains, and entry points that do too much." | ES `today.tangles[11].title` (line 217) |
| 15 | Which part would run where, folded "As a diagram" | The first box reads "Backend on the show machine", and the scoreboards box "an equipment adapter on the backend". The list above it and every card say "the engine". | "The engine on the show machine: ..." and "an equipment adapter on the engine". | ES `componentsMermaid` (line 401), nodes BE and SB |
| 16 | Release card against the "As a diagram" figure | The card says "Runs on the engine, the config tool", and its first paragraph has the engine compare the installed set at start. The diagram puts release only in the config tool's box, and the shape document says the backend runs "every part except the studio, the proofs and the release" (section 4.3). The page says two things. | Add "the release check at start" to the engine's box, matching the card and the part's own text; or drop "the engine" from the card's Runs on. The first keeps the part's text true. | ES `componentsMermaid` (line 401), node BE; or ES `parts[16].runsOn` (P17, line 390) |
| 17 | The night's record card, first paragraph | (a) "The director tells the night from it; the owner and the designer read it too." The players are missing: decision 28, point 1, names the director and the players it is told to, as the promise's people do (EJ J3 `functional.people`). (b) "stamped with the game it ran and the texts the players saw". A stamp is an identity; decision 28, point 3, says the record carries the pack and the texts, so the article can quote them. (c) "later photos captured into it during play" reads as a contradiction. | "When a game ends, one structured record of the night is written from the facts the engine decided, with the roster, the GM's notes and the accusation captured into it during play and the photos added later. It carries the game it ran and the texts the players saw. The director tells the players the night from it; the owner and the designer read it too." | ES `parts[4].plain` (P5, line 272); the shape document's P5 entry (section 4.1) to match |
| 18 | Where a real alternative exists, row "The tap's answer and the night's record" | "give the night's record one input and one reader". Since decision 28 the record has several readers: the director's telling from outside (for ALN, the Director Console), the Review stage, the owner and the designer. The card two screens up names three. | "give the night's record one input, the end of the game, and readers of its own after the show" | ES `alternatives[4].cost` (line 431); shape document section 4.4, row "J3: one part or two" |
| 19 | Verdict card | First paragraph: "Already built; what is missing is a route to the screen." Today line: "Built and in good shape today; its result reaches no screen except ...". The card says it twice. | Drop the last sentence of the first paragraph; the Today line holds it with more detail. | ES `parts[9].plain` (P10, line 322) |
| 20 | Game record card, Where it can be swapped | "the host (the engine in a networked game, the tablet in a standalone one, depending on whether the game is standalone)". The last clause repeats what the parenthesis just said. | "the host (the engine in a networked game, the tablet in a standalone one)." | ES `parts[2].seams` (P3, line 257) |
| 21 | Pack channel card, Where it can be swapped | "Adopt is called once per boundary by the lifecycle." "Adopt" is a function name from the shape document, capitalised as if it were a word the reader knows. The walkthrough on the same page says "take up the new pack". | "The lifecycle takes up a new pack once per boundary." | ES `parts[1].seams` (P2, line 247) |
| 22 | Delivery card, Where it can be swapped | "the role filter from the connection registry". No part is called that; the part is Connections and roles. | "the role filter from Connections and roles." | ES `parts[5].seams` (P6, line 287) |
| 23 | Joins and proofs card, Where it can be swapped | "a test for each plugged-in program that it does what its part promises". A promise is what a person counts on (decision 27); a part keeps promises, it does not promise. | "a test for each plugged-in program that it does what its part needs of it" | ES `parts[15].seams` (P16, line 387) |

## What was checked and found right

**The frame (4 items).** The title "Parts · What the Engine Promises",
a full document with doctype, charset and the viewport meta; the
navigation bar with Parts marked current and Decisions showing 13
(promises, A to G, 22, 24, 25, 19, 21); the status line word for word
(plan 2); the footer names the shape document, its four relationship
maps and its check, and the promises document (inventory row 91). No
page script; all seven diagrams are inline SVG.

**The header (3 paragraphs).** It opens with "a candidate shape ...
not a decision" and keeps version 7's shape intro near word for word
(inventory rows 18 and 26), apart from conflicts 2 to 8.

**Qualities (6 items).** The intro and all five rows match version 7
and ES `qualities`; the promise links follow `QUALITY_KEEPS`, which is
version 7's; the fourth row's Today text is ES `mechanisms[10]`
(inventory row 24). "Who decides when there is no engine" names the
venue technician's profile as the candidate favoured, never as decided.

**The parts in layers (4 items).** The caption is version 7's; the
eight rows match version 7 (Top: Design studio, Joins and proofs,
Release; Bottom: Game rules, Engine instance); each chip links to its
card; the folded "Which part uses which: 54 links" with the "uses" note
is under the figure as plan 3.4 item 3 asks (inventory rows 32, 34).

**Five moments (6 items).** The reading key sits under the heading
(inventory row 30, the resolved GAP). The five titles, their promises
and their sequence diagrams are version 7's `WALKS`, unchanged (`WALKS`,
`SEQ_INIT` and `present()` compared with `build_report.py` by syntax
tree); actors read left to right in the drawn order (checked by x
position in the first diagram). The GM ends the game shows the night's
record reading the facts after the end, as decision 28 has it.

**The seventeen parts (17 cards).** Every card matches version 7 word
for word, field for field, in layer order bottom row first: what it
does, Mainly keeps, Also needed by, Today (on 10 of 17, as in version
7), Removes, Runs on, Where it can be swapped (inventory row 33,
headings rows 11 to 27). `part_html` differs from version 7's only in
its anchor and heading level. Each card's anchor is the plan's (section
2). Each Removes list matches ES `parts[].flaws` and the shape
document's flaw landing list. The night's record card's last field
holds decision 28: the Director Console stays a separate program that
reads the record, with room to move inside the Review stage later.
Players' emails do not appear, which is right. The two clocks do not
belong on this page.

**Which part would run where (8 items).** The seven device lines are
version 7's `FIT_DEVICES`, unchanged, with their four "Today" notes and
two "open choice for step 3" notes; the folded diagram is ES
`componentsMermaid` (inventory rows 35, 36), apart from conflicts 15
and 16.

**Where today's code tangles (14 items).** Folded, with the summary
count, the note and all thirteen tangles word for word as version 7,
each with its flaw links (inventory row 25), apart from conflicts 1,
13 and 14. The note's "below" became a link to the Design flaws page,
which is the right target.

**Where a real alternative exists (9 items).** The intro and all eight
rows match version 7 word for word (inventory row 37). Each row has its
`alt-*` anchor, which the step-3 list on Decisions uses.

**Links (3 groups).** All 10 promise links land on their promise's
anchor and show the exact title from EJ `functional.proposedTitle`; all
17 part links land on their card; all flaw links land on `c1` to `c16`
or `n1`.

**The rules (5 sweeps).** No em dash; no "job" or "installer"; no
promise id in visible text; no edit history ("changed" appears only as
"what changed?" in the diagrams and as plain facts); the shape is
written as a candidate throughout ("would" in the devices list, the
status line, the header's first sentence).

**Inventory rows homed on this page (39).** Table 1 rows 18 (the
candidate shape restated), 24, 25, 26, 29, 30, 31, 32, 33, 34, 35, 36,
37 and 91; table 2 heading rows 7 (its parts share), 8, 9, 10, 11 to 27,
28 and 29; table 3 rows 5 (part anchors) and 13 (the page intro). Each
has its home on the page. None is missing.

**One note, not a conflict.** The build log counts 4,767 words of
prose against the plan's target of 6,000 to 7,000. Every element version
7 held is present, so the shortfall comes from version 7's own length,
not from a loss.
