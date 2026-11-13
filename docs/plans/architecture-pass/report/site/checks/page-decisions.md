# Page check: `decisions.html`

Checked 2026-11-01 against the built page read as text, the site plan
(sections 2, 3.2, 4.2 and 6), every inventory row homed on this page,
version 7's questions (`report/build_report.py` TEMPLATE, lines 1013 to
1135), the overlay `site/decisions.json`, the builder
(`report/build_site.py`), the engine-shape data (`questionNotes`,
`alternatives`, `parts`, `qualities`, `ownerChoices`), the cards, the
promises data, the standalone lines and the standalone pass, the program
document (`docs/plans/2026-10-30-architecture-pass.md`, step 2), the
after-game report, `docs/plans/CURRENT-STATE.md` section 0 (decisions 20
to 29), and the earlier overlay check (`checks/check-decisions.md`).
Refute by default.

**Result: 26 conflicts in 208 items checked.** No fact is wrong on the
large scale: every key, group, status and recommendation holds. The
conflicts are of five kinds, counted by each row's main fault: a full
flaw or promise title that reads stiffly (rows 1, 5, 6, 8, 10, 15, 19);
repetition within the page, mostly an evidence line that says what an
option's cost or the recommendation says again (rows 2, 3, 4, 9, 12, 16,
17, 18, 22, 25); edit history kept on the page although the inventory
sends it to the change log (rows 7, 11); a fact or link that says more
or other than its source (rows 13, 14, 20, 21); and reader-facing gaps
(rows 23, 24, 26). Line numbers in `decisions.json` are as
the file stands now.

## Conflicts

| # | Where on the page | What it says | What it should say | Where to change it |
|---|---|---|---|---|
| 1 | The promises question, "What we know", line 4 | "The designer changes a value and plays it within minutes, and the live show never notices is the one promise no flaw mainly breaks today; Engine and tests both assume they own the machine and Pack edits reach each copy of the pack differently break it beside others." A 17-word title as the subject, run straight into "is"; two more titles as a joint subject. Reads stiffly. | "No flaw mainly breaks [[promise:J6]] today; [[flaw:C8\|C8]] and [[flaw:C12\|C12]] break it beside others." (Each design flaw mainly breaks exactly one promise stays as the first sentence.) | `decisions.json` `groups[0].questions[0].evidence[3]` (line 21) |
| 2 | The promises question, "What we know", lines 2 and 3, and the recommendation | Evidence says "In the map every promise is kept by parts of its own" and "The one candidate for an eleventh promise, running in any setup, owns no part"; the recommendation then says both again in nearly the same words. Repetition within one block. | Keep the recommendation as version 7 had it. Evidence line 2: "Each entry on the [[page:promises]] page names the parts that keep it." Evidence line 3: "Whether running in any setup needs an eleventh promise is [[q:E]]." | `decisions.json` `groups[0].questions[0].evidence[1]` and `evidence[2]` (lines 19, 20) |
| 3 | Question A, "What we know", line 3, and the recommendation | "The second clause is what Pack edits reach each copy of the pack differently breaks: today ..." (title then "breaks", stiff); the recommendation then says "the second is what design flaw C12 breaks". Said twice. | Evidence: "Today a tablet running a different pack than the engine is only written to a log, and nothing tells the GM ([[flaw:C12]])." The recommendation keeps the link between the clause and C12. | `decisions.json` `groups[0].questions[1].evidence[2]` (line 37) |
| 4 | Question C, "What it decides" | 'whether "nothing declares a game standalone" is a design flaw of its own ( Nothing declares a game standalone ) with its own rule'. The same words come twice in one clause. | 'whether [[flaw:N1]] is a design flaw of its own, with its own rule' (the link is the phrase), or keep the quoted phrase and use [[flaw:N1\|N1]]. | `decisions.json` `groups[0].questions[3].decides` (line 64) |
| 5 | Question C, "What we know", line 2 | "The game fits the venue it is in tonight, which fits the game to tonight's setup, is where it is declared." The title is the subject and the relative clause repeats the title. Version 7: "fitting the game to tonight's setup is where it is declared." | "...an input every rule takes (the quality \"Who decides when there is no engine\"), and it is declared where the game is fitted to tonight's setup, under [[promise:J8\|the venue promise]]." | `decisions.json` `groups[0].questions[3].evidence[1]` (line 67) |
| 6 | Question C, "What we know", line 5 | "they join Tablets and phones decide facts the engine owns , Several places answer the same question, each differently and Names joining two places are kept by hand and the hardware scanner parity list. On the map it lands on ..." Three titles in a list joined by "and ... and" cannot be parsed; "it" has no clear antecedent (the source means N1: `ownerChoices`, "on this map it lands on the pack channel and venue fit"). | "If it is not a flaw of its own, they join [[flaw:C9\|C9]], [[flaw:C11\|C11]] and [[flaw:C14\|C14]] and the hardware scanner parity list. On the map [[flaw:N1\|N1]] lands on [[part:P2]] and [[part:P12]], or on [[part:P3]] if the declaration is kept there; the answer to 23 does not move it." (Version 7 used the short ids here.) | `decisions.json` `groups[0].questions[3].evidence[4]` (line 70) |
| 7 | Question D, "What we know", lines 1 and 3 | "Decision 28 (2026-11-01) changed the second half of [title]: it now names ... This question stays open." and "The night's record now carries ...". The wording's history is change-log matter (`changes.json` `promises` J3 `changes[2]` holds it); "This question stays open" repeats the Open tag. | Line 1: "The night's record half names the director who tells the night's story and the players it is told to, beside you and the designer (decision 28, 2026-11-01)." Line 3: "[[part:P5]] carries the game the night ran ..." (drop "now"). | `decisions.json` `groups[0].questions[4].evidence[0]` and `evidence[2]` (lines 83, 85) |
| 8 | Question D, "What we know", line 4, and option 2 | "A reply never says which request, final or stored mainly breaks the tap's answer." reads as a garbled sentence (title, no comma, then the verb). Its second sentence, "No design flaw mainly breaks the night's record half yet, because that half is mostly planned work", is option 2's cost again. | "The tap's answer is mainly broken by [[flaw:C7]]; no design flaw mainly breaks the night's record half yet." Leave the reason ("mostly planned work") to option 2's cost. | `decisions.json` `groups[0].questions[4].evidence[3]` (line 86) |
| 9 | Question E, "What we know", line 3, and option 3 | Evidence: "the last two are in its sentences, not in its title"; option 3's cost: "the GM running a standalone game and a future operator with another kit are named in a sentence, not in a title". Said twice. | Evidence line 3 ends at "...and a future operator with a second kit." The cost carries the rest. | `decisions.json` `groups[0].questions[5].evidence[2]` (line 111) |
| 10 | Question E, "What we know", line 4 | "Nothing declares a game standalone mainly breaks this promise; The deployed game is many parts nothing compares breaks it where program names ..." Two titles as subjects; a capital "The" mid-sentence. Stiff. | "This promise is mainly broken by [[flaw:N1]]. [[flaw:C15\|C15]] also breaks it: program names and install commands are fixed to one operating-system release, so a new machine logs warnings or refuses its install." | `decisions.json` `groups[0].questions[5].evidence[3]` (line 112) |
| 11 | Recommendations of E, F and G; intro paragraph 2 | E: "This replaces the earlier recommendation to split." F: "The earlier split into 'prove it works' and 'keep every part in step' does not match the map, because keeping joined parts in step is part of the proof." G: "This replaces the earlier answer, which put the route under the room promise whatever the design." Inventory row 86 sends these sentences to the change log and keeps "one pointer line per question" here; each question already has that pointer ("The earlier ... is in the Change log"). So the page holds edit history and says it twice. `changes.json` `recommendations` E, F, G hold all three in full. F's reason survives in its evidence line 1 ("checking that joined parts agree is part of it"). | Delete the three sentences. Intro paragraph 2 then reads: "Recommendation changed by the map: the candidate shape changed what we recommend, and the Change log has the earlier recommendation." | `decisions.json` `groups[0].questions[5].recommendation` (line 129), `questions[6].recommendation` (line 163), `questions[7].recommendation` (line 193), `intro[1]` (line 4) |
| 12 | Question F, "What we know", line 3 | "Four flaws mainly break this promise: [four full titles]. Question 4 of the pass covers ... ([title again]). For the other three no question of the nine fits: question 5 is only the nearest ... ([title again]) ... ([title again]) ... ([title again]) have none." Every title twice in two sentences. "The nine" and "question 5" are never introduced; "question 5" sits beside the page's own questions 19 to 25. | "Four flaws mainly break this promise. The pass's fourth design question covers keeping tests away from the live show ([[flaw:C8\|C8]]). For the other three none of its nine questions fits: the fifth is only the nearest for the names two parts share ([[flaw:C14\|C14]]), and the installed pieces ([[flaw:C15\|C15]]) and tests that prove the real path ([[flaw:C16\|C16]]) have none." | `decisions.json` `groups[0].questions[6].evidence[2]` (line 141) |
| 13 | Question F, "What we know", line 4 | "Every option below places The deployed game is many parts nothing compares ; A green test run proves nothing about the show lands on Joins and proofs whichever you choose." Overstates the source: the shape's note for F names three ways that place C15 (widen, split, file under the venue) and says of the fourth only that it "also fits the parts". "Places" is unexplained, and the title after it reads stiffly. Flagged before (`checks/check-decisions.md` #6) and not applied. | "Options a, b and c each give [[flaw:C15\|C15]] a home in a part; [[flaw:C16\|C16]] lands on [[part:P16]] whichever you choose." | `decisions.json` `groups[0].questions[6].evidence[3]` (line 142); source `2026-11-01-engine-shape.json` `questionNotes` F |
| 14 | Question F, option a's cost | "One title covers two people at two moments, the developer's proof and your release day; the pass gives each its own question." Version 7 gave option a no cost. The clause states as fact what the recommendation proposes; today no question of the nine covers release day (C15) or real-path tests (C16), as line 3 says. | "One title covers two people at two moments, the developer's proof and your release day; the recommendation gives each its own question in the pass." | `decisions.json` `groups[0].questions[6].options[0].cost` (line 148) |
| 15 | Question G, "What we know", line 4 | "Service health and service state travel on separate paths is the flaw this question places: ..." (title as subject, stiff); its last sentence, "Its card sits under [title], where its moment at a show is felt", is the recommendation's clause word for word. | "This question places [[flaw:C2]]: today health and state travel on separate routes, so the music card keeps its playing look while the health row turns red." Drop the last sentence; the recommendation keeps it. | `decisions.json` `groups[0].questions[7].evidence[3]` (line 176) |
| 16 | Question 22, "What it decides", "What we know" lines 1 and 4, option "Yes" | "as decision 22 recorded on your parity reasoning" (decides) and "Decision 22 (2026-10-31) recorded ... a parity gap" (line 1) say the same thing; the Decided list says it a third time. Line 4, "A yes means the standalone declaration must reach a device that has no idea of it today", is the Yes option's cost word for word. The heading says "ESP32" and "web scanner"; every other line says "hardware scanner" and "phone", and nothing joins the two names. | Decides: "Whether the hardware scanner, the ESP32, gets a standalone mode matching the phone's as parity work the pass must serve. Your explicit word is asked for." Line 4: "On the map [[part:P2]] carries the declaration to every device with its pack." | `decisions.json` `groups[1].questions[0].decides` (line 206) and `evidence[3]` (line 211) |
| 17 | Question 24, "What we know", line 2, and option 2 | "Several tablets sharing one game with no engine would need them to talk to each other directly, a large new piece." and the cost "They would need to talk to each other directly, a large new piece." Said twice. | Drop evidence line 2; the option carries it. | `decisions.json` `groups[1].questions[1].evidence[1]` (line 234) |
| 18 | Question 19, "What we know", lines 1 and 2, and both options | Line 1, "a refused GM scan is told to the tablet that scanned and recorded nowhere else", is option No's cost again; line 2, "A yes adds a kind of fact to the record that no screen shows yet", is option Yes's cost again. | Line 2 ends at "...the answer goes back through [[part:P4]]." Option No's cost: "Nothing is recorded, as today, and the night's record cannot tell a refused attempt." | `decisions.json` `groups[2].questions[0].evidence[1]` (line 290) and `options[1].cost` (line 301) |
| 19 | Question 19, "What we know", lines 3 and 4 | "Where Every tap gets its answer, and the night can be told afterwards lists Tablets and phones decide facts the engine owns , it leaves this to you" (two titles back to back) and "a yes needs a standalone counterpart, which A reply never says which request, final or stored 's change carries" (unreadable). | Line 3: "Where [[promise:J3\|the tap promise]] lists [[flaw:C9\|C9]] among its flaws, it leaves this to you: whether refused scans belong in the night's record is your open question, not that flaw's." Line 4: "...; a yes needs a standalone counterpart, which the change for [[flaw:C7\|C7]] carries." | `decisions.json` `groups[2].questions[0].evidence[2]` and `evidence[3]` (lines 291, 292) |
| 20 | Question 25, "What we know", line 2 | "A video token on the phone shows a black screen with the token's name" | "...a black screen with the token's id" (standalone pass SP-06: "New Memory! Token: kai001"; parity row 13: "Blank screen with 'Token: id'"). | `decisions.json` `groups[1].questions[2].evidence[1]` (line 260) |
| 21 | Every evidence line that names a row, a table or an earlier wording | "The alternatives table on the Parts page has this row" (D, F, G, 24) links to the top of `parts.html`, though each row has its own anchor (`alt-answer-and-record`, `alt-release`, `alt-delivery`, `alt-standalone-tablet`); the step-3 list already links to rows. "The parity table on the Design flaws page" (22) links to the top of `flaws.html`; the table sits under `#standalone`. "is in the Change log" (promises, E, F, G) links to the top of `changes.html`, though `#earlier-wording`, `#rec-e`, `#rec-f` and `#rec-g` exist. The words name a place; the link lands a long page away from it. | Let the page marker take an anchor, `[[page:parts#alt-release]]`, rendering the page's name linked to that id, and use it in each line: D `#alt-answer-and-record`, F `#alt-release`, G `#alt-delivery`, 24 `#alt-standalone-tablet`, 22 `flaws#standalone`, promises `changes#earlier-wording`, E/F/G `changes#rec-e`/`#rec-f`/`#rec-g`. | `build_site.py` `rich()`, the `page` branch (lines 759 to 762), and `page_a()` (line 733); `decisions.json` lines 18, 87, 113, 143, 177, 209, 237 |
| 22 | Step-3 list, items 2 to 7 | Each ends "Both designs and their costs are compared on Parts." (item 2: "...under 'Where a real alternative exists' on Parts"): one sentence six times in a twelve-item list. Inventory row 88 says version 7's eleven are kept "word for word"; these six are not. | Restore version 7's eleven items word for word. Say once, in the list's intro, that "the six with a row in the alternatives table on [[page:parts]] link to it", and let `page_decisions()` link each of the six items' opening words (its `STEP3_ALT` key) to the row. | `decisions.json` `step3[1]` to `step3[6]` (lines 334 to 339); `build_site.py` `STEP3_INTRO` (line 971) and `page_decisions()` (lines 1305 to 1312) |
| 23 | Decided list, decision 20 | "No rule for documents in the pass. Documents are fixed as we go, always." On a page whose step-3 list asks whether paper documents join the pack, a reader can take decision 20 to settle that. Decision 20 is about the program's own written documents (`CURRENT-STATE.md` section 0 points it to `docs/agents/process.md` section 4). | "No rule in the pass for the program's own written documents. They are fixed as we go, always." | `decisions.json` `decided[0].line` (line 347) |
| 24 | Intro, paragraph 1 | "Answer in the chat, by the question's letter or number. Each question stands alone: answer any of them, in any order." The first question has neither letter nor number; and the first question's own recommendation ties it to D to G ("settle D to G below"), so they do not all stand alone. | "Answer in the chat, by the question's letter or number (the first one is the promises question). Answer any of them, in any order, and leave the rest for later." | `decisions.json` `intro[0]` (line 3) |
| 25 | Intro, paragraph 3 | "The shape is a candidate; nothing on this page is decided unless the Decided list at the end says so." The status line just above says "The shape is a candidate; nothing is decided unless a page says so." | "Only the Decided list at the end records what you have decided." | `decisions.json` `intro[2]` (line 5) |
| 26 | Footer | Names version 7's questions, the shape, the cause analysis, the standalone pass, the after-game report and decisions 20 to 29. Question 21's four reproductions come from the program document of 2026-10-30 (step 2 of its table), and several evidence lines come from the promises document (who counts on the venue promise; the tap promise's flaw lines). Neither is named. | Add "the program document of 2026-10-30 (the test rig's step)" and "the promises document of 2026-10-31". | `build_site.py` `FOOTERS['decisions']` (lines 981 to 985) |

## What I checked and found right

**The frame.** The title is "Decisions · What the Engine Promises"; the
page is a full document with doctype, charset, the `viewport-fit=cover`
meta and the base reset. The navigation shows "Decisions 13", which
matches the thirteen question blocks. The status line is the plan's text.
No promise id (J1 to J10) appears in the visible text; no "job", no
"installer", no em or en dash. Every `href` on the page resolves to an id
that exists on its target page (64 distinct links listed and checked).

**Keys, groups, statuses, order (inventory rows 80 to 84, 87; headings 58
to 77).** h1 "Decisions" and the intro replace "Your questions". Four
groups in version 7's order with its titles. Thirteen blocks in version
7's order, each with version 7's key and heading (anchors `q-promises`,
`q-a` to `q-g`, `q-22`, `q-24`, `q-25`, `q-19`, `q-21`). A, B and C are
"Applied, please confirm"; E, F and G "Recommendation changed by the
map"; the rest "Open". "This replaces question 17" (promises, now with
"which asked whether the list of causes was right", true to section 0),
"replaces question 18" (F) and "Question 23 is folded in" (C) are kept.
Every block has "What it decides", two to five evidence lines (59 in
all), and a recommendation; 25 keeps "Suggestion".

**Meaning kept from version 7.** Each recommendation keeps its substance
word for word or nearly so (promises, A, B, C, D with "different people"
for decision 28, E, F, G, 22, 24, 25, 19, 21). Version 7's option
sentences became options with their costs: D (2), E (3, from version 7's
two titles and the cost of not splitting), F (a to d, version 7's costs
for b to d), G (3, from "If you still want one promise to hold the
words"), 22, 24, 25 and 19 (2 each). Only F's option a gained a cost
(conflict 14).

**Facts, each traced.** Each flaw mainly breaks exactly one promise and
the designer's promise (J6) is the only one no flaw mainly breaks, with
C8 and C12 as its secondary flaws (`engine-jobs.json` `flaws`). A: the
quality Generic, carried by Game rules, Venue fit and Engine instance;
the pack stamp on every copy and game record, compared at connect
(shape `questionNotes` A; P2 `plain`); the log-only pack mismatch (C12
`atAShow`). B: Connections and roles holds pass and grants, Answering
checks once; the quality "Only the GM moves the game"; anyone fetches the
whole state, the TV connects as a GM (C13 examples). C: decision 22's
words; the quality "Who decides when there is no engine"; the profile
favoured because a profile with no engine equipment reads dormant; Pack
channel carries the declaration (`questionNotes` C); today's tap, web
address, nothing on the hardware scanner, no pack field (standalone pass
line 19); eight findings under N1. D: five promises depend on Answering
(P4 `jobs`, engine-shape line 354; version 7's "six" was its error, now
corrected); the night's record stamped with the game and the texts, read
by the Review inside and the Director Console outside (P5 `plain` and
`seams`; decision 28 points 3 and 5); C7 is the tap half's only main
flaw; the alternatives row exists (`alt-answer-and-record`). E: Venue fit
and Verdict; "run in any setup" owns no part; J8's people (J8
`functional.people`); C15's line under J8. F: the quality Proof; Joins
and proofs and Engine instance carry it; Release compares one described
set (P17 `plain`); C8, C14, C15, C16 are J10's main flaws; questions 4
and 5 (cards `questions`; `OUTSIDE_NINE`). G: Delivery used by six
promises (`questionNotes` G); Equipment, Delivery, Screens; C2's card
under the room promise. 22: 24 parity rows, the hardware scanner behind
in seven (rows 1 to 4, 17, 23, 24; standalone pass line 284); red
Disconnected, growing queue, "Rescan later" (standalone line C10). 24:
two standalone tablets, two games (SG-06); the game id or a reset of
their own (standalone line C4); the tablet runs Game record and
Lifecycle or its own engine (standalone line C1). 25: SG-07's exposure
facts; the Verdict stand-in (J9 `standalone`); parity row 13's "declared
answer". 19: set aside as the owner's question (`SET_ASIDE`); J3's C9
line; the standalone counterpart under C7 (standalone pass section 3.3
row "B-08 and question 19"). 21: step 2 follows the answers
(section 0); the four reproductions (program document, step 2 row);
eight flaws seen live with the four quoted notes (cards `seenLive`);
Equipment's stand-ins (P8 `seams`).

**Decision 28 holds.** D names the director and the players with the
owner and designer; the night's record carries the game it ran and the
texts the players saw; the Director Console reads it from outside, with
room to run inside the Review stage later; decision 28's line adds that
what players receive is the game's business, that emails stay outside
the engine, and that the two clocks join C9. The shape is never written
as decided: "candidate shape", "on the map", "if step 3 keeps one
delivery part" throughout.

**Step-3 list (inventory rows 88, 76, 77; additions 18, 19).** Heading
"Coming in step 3, no answer needed", version 7's "The map leaves these
choices to you." and its intro. Version 7's eleven items, in order, plus
the twelfth: paper documents joining the pack with "unlocked" recorded
during play, left to step 3 by decision 28 point 3, with the director
marking them by hand today (after-game report lines 19 and 40). Six items
link to their own rows, each mapping right (`STEP3_ALT` against the
shape's `alternatives` order). The items match the shape's
`ownerChoices` that are not questions. The shape's silence on a short
offline claim list (`2026-11-01-cards-shape-facts-check.md`) is a record
for step 3 in section 0, not one version 7 or the plan puts on this list;
not a conflict.

**Decided list (inventory rows 89, 7, 9; addition 20).** Decisions 20,
22, 26, 27, 28 and 29, each dated right (20 from commit `c40d70c0`,
2026-10-31; the rest from section 0) and each line true to section 0.
Decision 26's line keeps version 7's lead sentence ("clues to where
today's design is off, never the driver"); decision 27's keeps the words
note, without "job", which plan section 6 allows only on the change log.

**Other inventory rows.** Row 8: the intro takes the decide-box's place
for this page. Row 51: question C carries N1 as proposed and question 23
folded in. Additions 14 to 17 and 21 are all present. Row 86 is the one
row the page does not follow (conflict 11).

**Not a conflict, noted.** The page runs to about 4,850 prose words
against plan 3.2's 2,500 to 3,500 (`build-log.md` line 44). The plan
calls this a target; conflicts 2, 3, 8, 9, 11, 12, 15 to 18 and 22 remove
repeated text and bring it closer.
