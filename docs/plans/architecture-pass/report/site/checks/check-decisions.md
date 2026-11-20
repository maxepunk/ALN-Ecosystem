# Check: `site/decisions.json`

Checked 2026-11-01, refute by default, against: version 7's questions
(`report/build_report.py` TEMPLATE, lines 1013 to 1135), the shape's
`questionNotes`, `ownerChoices`, `parts`, `qualities` and `alternatives`
(`report/2026-11-01-engine-shape.json`), the promises
(`report/2026-10-31-engine-jobs.json`), the cards
(`report/2026-10-31-cause-cards.json`), the standalone lines
(`report/2026-10-31-standalone-lines.json`), `2026-10-31-standalone-pass.md`,
`2026-10-30-cause-analysis.md`, `2026-11-01-engine-shape.md`,
`2026-11-01-after-game-report.md`, `docs/plans/CURRENT-STATE.md`
section 0 (decisions 20 to 29), the program document
(`docs/plans/2026-10-30-architecture-pass.md` step 2), the site plan
(sections 3.2, 4.2 and 6) and the writer's log (`site/decisions-log.md`).

**Result: 7 conflicts in 113 items checked.** Two are substantive (C
presents a step-3 choice as made; D carries a false count from v7); the
rest are evidence lines that overstate or link the wrong thing.

## Conflicts

| # | Where | What it says | What it should say | Source that shows it |
|---|---|---|---|---|
| 1 | `groups[0].questions[3]` (C), `evidence[1]` | "…and fitting the game to tonight's setup, [[part:P12]], is where it is declared." | Point at the promise, not the part: "…and [[promise:J8]], which fits the game to tonight's setup, is where it is declared." With the part marker the line says the declaration lives in Venue fit, which is the step-3 choice the very next line leaves open; it presents the favoured option as decided (plan section 6, "the shape is a candidate"). | `questionNotes` C: "J8, the job that fits the game to tonight's setup, is where it is declared. Where the fact is held is a later choice"; `parts` P12 `plain`: "and, **if the owner places it here**, the declared fact…"; `decisions.json` `step3[0]`; `ownerChoices[0]`. |
| 2 | `groups[0].questions[4]` (D), `evidence[1]` | "[[part:P4]] sits in the middle of the engine, and six promises depend on it" | "…and five promises depend on it" (or drop the count). v7 carried the error; the writer's log keeps it knowingly. | `2026-11-01-engine-shape.md` line 354 (question D): "P4 sits above the record and the show runner and is used by five jobs"; `parts` P4 `jobs`: J3, J2, J4, J5, J7 (five); P4 serves line 185: "J3 (owner), J2, J4, J5, J7". |
| 3 | `groups[2].questions[0]` (19), `evidence[2]` | "[[flaw:C9]]'s card leaves this to you: whether refused scans belong in the night's record is your open question, not that flaw." | "Where [[promise:J3]] lists [[flaw:C9]], it leaves this to you: …". The sentence is on the promise's flaw line, not on the card; the C9 card on the Design flaws page says nothing about refused scans or question 19, so the link sends the owner to a page that does not hold the fact. | `engine-jobs.json` J3 `flaws` C9 `how` ("Whether refused scans belong in the night's record is the owner's open question, not this flaw"); `cause-cards.json` C9 (no such text; `questions` [1, 5]). The writer's log cites the J3 line itself. |
| 4 | `groups[1].questions[2]` (25), `evidence[0]` | "A tablet alone has no scoreboard to show it on, so the GM sees the summary once, on the result screen" | "On a tablet alone the scoreboard screen is kept to ranking modes and the evidence picker is hidden, so the GM sees the summary once, on the result screen". As written it contradicts the suggestion on the same screen ("the GM tablet's own scoreboard screen, which standalone already has"). | `2026-10-31-standalone-pass.md` row SG-07 (line 171): "A tablet alone has no scoreboard to show it on: the scoreboard screen is gated to ranking modes, the evidence picker is skipped and hidden"; v7 question 25 suggestion. |
| 5 | `groups[1].questions[2]` (25), `evidence[1]` | "A video token on the phone shows a black screen with the token's name; on the hardware scanner, its picture and "Rescan later", which never works ([[flaw:C10]])." | Link both halves: the phone's black screen is [[flaw:N1]]'s finding, the hardware scanner's "Rescan later" is [[flaw:C10]]'s: "…([[flaw:N1]], [[flaw:C10]])". | `2026-10-31-standalone-pass.md` SP-06 (line 187, cause "N1 (fallback C14)") and SP-07 (line 188, cause "C10"); N1's eight instances (line 243) include SP-06. |
| 6 | `groups[0].questions[5]` (F), `evidence[3]` | "Every option below places [[flaw:C15]]; [[flaw:C16]] lands on [[part:P16]] whichever you choose." | "Options a, b and c each place [[flaw:C15]]; [[flaw:C16]] lands on [[part:P16]] whichever you choose." The note names three ways that place C15 and says of the fourth (option d, the earlier wording) only that it "also fits the parts". | `questionNotes` F: "Widening the sentence, splitting it, or filing release day in J8's deploy chain all place C15; C16 lands on the proofs whichever way. Leaving J10 as drafted also fits the parts; its cost is that release day stays unnamed". |
| 7 | `intro[2]` | "Each fact links to the promise, part, design flaw or question it comes from" | "Most facts link to…", or add links. Nine of the 59 evidence lines carry no link: promises 5, C 1, E 3, 22 1, 24 2, 25 4, 19 1, 21 1, 21 4. | `decisions.json` `groups[*].questions[*].evidence` (script count, below). |

## What I checked and found right

**Schema (plan 4.2).** Top-level keys exactly `intro`, `groups`,
`step3`, `decided`. Four groups in plan order and with v7's titles
(About the promises; About standalone games; About the game's record;
About the next step). Thirteen questions, each key once, in v7's order:
promises, A to G, 22, 24, 25, 19, 21. Every anchor is `q-` plus the
lowercased key. Every question has `key`, `anchor`, `heading`,
`status`, `decides`, `evidence`, `options`, `recommendation`,
`recKind`, and nothing else; every option has exactly `label` and
`cost`; `options` is an empty list where v7 offers none (promises, A,
B, C, 21). `step3` items are `{text}`; `decided` items are
`{n, date, line}`. All text is plain; no HTML.

**Markers.** 120 markers, all resolve against the valid ids (promises
J1 to J10; parts P1 to P17; flaws C1 to C16 and N1; questions
promises, A to G, 22, 24, 25, 19, 21; pages engine, decisions,
promises, parts, flaws, changes). No malformed marker; no promise id,
em dash, en dash, "installer" or "job" in visible text. Every place
the current title of a promise is quoted carries a marker; the two
candidate titles in E's options are typed, as v7 has them, which is
right because they are the choice being asked (the second equals the
current title; a marker would hide that).

**Status, kind, headings.** Statuses match v7's tags: A, B, C
`applied`; E, F, G `changed`; the rest `open`. `recKind` is
"Suggestion" for 25 only, as v7. Every heading matches v7's question
with titles as markers; 22 keeps v7's "ESP32" as asked.

**Recommendations.** Unchanged in substance from v7 for all thirteen:
promises, A, B, C (with question 23's yes), E, F, G, 22, 24, 25, 19,
21 word for word or with only markers added; D's "serve two people"
becomes "serve different people", which follows decision 28 point 1
and keeps the split recommendation.

**Options and costs.** D (2), E (3), F (4), G (3), 22 (2), 24 (2),
25 (2), 19 (2): every option v7 names is present and every cost v7
states is kept. New cost lines with no v7 sentence behind them are
supported: E's split ("would own nothing", v7), 24's one tablet (the
mirror of v7's "unless you plan standalone games with two GMs"). E's
first title cost ("the venue technician's moment moves to the
sentences") is the writer's mirror of v7's contrast ("names the
venue technician's moment"); the log flags it; I accept it. F option
a's cost borrows from the recommendation but states nothing false.

**Evidence lines found right (53 of 59), by source.**
- Promises: each promise names its people, earlier wording in the
  change log (v7; plan 3.6); every promise kept by parts of its own
  (v7 recommendation); the eleventh owns no part (`questionNotes` E);
  each flaw mainly breaks exactly one promise and J6 has none, C8 and
  C12 under it with `primary: false` (verified by script over
  `engine-jobs.json`); replaces question 17 (CS, "17 (is the cause
  list right)").
- A: Generic carried by P1, P12, P13 (`qualities[2]`, note A); P2's
  stamp on every copy and game record, compared when a connection is
  admitted (P2 `plain`, note A); C12 "only noted in the engine's log;
  nothing tells the GM" (C12 `atAShow`); a second designer's game and
  P1 calculating only (J1 `need`, P1 `plain`).
- B: P7 holds pass and grants, P4 checks once (note B, P4 `plain`);
  the quality "Only the GM moves the game" (`qualities[4]`); anyone
  fetches the whole game state, the TV connects as a GM (C13
  examples B-04 and B-89, `atAShow`).
- C: decision 22's words and date (CS item 22; commit `e42d4398`,
  2026-10-31); step-3 choice, profile favoured and why, P2 carries
  it (note C); today a tap, a web address, nothing on the hardware
  scanner, no pack field (standalone pass line 19); N1's eight
  findings, fallbacks C9, C11, C14 and the parity list, lands on P2
  and P12 or P3 (standalone pass lines 243 to 247; v7 C).
- D: decision 28 renamed the second half's people and D stays open
  (CS item 28 (1); J3 `functional.people`); P5 carries the game and
  the texts, Review inside, the Director Console outside with room to
  move in later (CS item 28 (3) and (5); P5 `plain` and `seams`); C7
  the only primary under J3; the alternatives row exists
  (`alternatives[4]`).
- E: P12's profile and P10's go or no-go; "run in any setup" owns no
  part; P13 knows its names (v7 E; note E; P12, P10, P13 `plain`); J8
  names the venue technician, a GM with no engine, a future operator
  (J8 `functional.people`); N1 primary, C15's fixed names (J8 flaws);
  earlier recommendation in the change log.
- F: Proof carried by P16 and P13 (note F; `qualities[1]`); P17's
  described set compared at start (P17 `plain`); C8, C14, C15, C16
  all primary under J10; questions 4 and 5 and the three uncovered
  (v7 F); the release-day alternatives row (`alternatives[7]`);
  replaces question 18 (v7; CS).
- G: P6 carries every fact with its label, used by six promises (P6
  `jobs`: J2, J4, J9, J1, J7, J5); P8 decides, P6 carries, P14 draw
  (note G); the two halves already covered and the running state's
  contents (v7 G; note G); C2's music card and health row, card under
  J4 (C2 `atAShow`; J4 flaws); the delivery alternatives row.
- 22: decision 22 on parity, date from the commit (CS item 22); seven
  of 24 abilities (parity table rows 1 to 4, 17, 23, 24; J8
  `standalone`); red Disconnected, growing queue, "Rescan later"
  (standalone pass line 19; SP-20, SP-07); P2 carries the
  declaration (note C).
- 24: two tablets are two games with their own claim lists and score
  tables (SG-06, cause C1); direct talk is a large new piece (v7);
  player scans only if handed to the tablet (v7; J3 `standalone`);
  player devices learn each new game (standalone line C4); P3 and P11
  or an engine of its own (standalone line C1; `alternatives[3]`).
- 25: P14 draws, a P10 stand-in marks duties dormant, grey (J9
  `standalone`; standalone line C10); both answers left to the owner
  (parity row 13; standalone line C3).
- 19: told to the tablet only, set aside as a product choice
  (cause analysis B-08, line 863); P3 decides, P4 replies, a yes adds
  a fact no screen shows (v7; P3, P4 `plain`); standalone records
  refusals nowhere, C7's change carries the counterpart (standalone
  pass section 3.3 row "B-08 and question 19", line 78).
- 21: what the rig is, step 2 follows the answers (v7; CS); the four
  reproductions C1, C2, C4, C5 (program document step 2; cause
  analysis line 17); eight cards with "seen live" (C2, C3, C5, C8,
  C10, C11, C15, C16) and the four quoted notes match `seenLive`;
  phase 2 proves each (v7); P8's stand-ins (P8 `seams`).

**Decision 28.** Held everywhere it appears: D's evidence 1 and 3,
the decided line, step-3 item 12. The night's-record half names the
director and the players; what players receive is the game's
business; the record carries the game it ran and the texts the
players saw; players' emails stay outside (not stated on this page,
nothing contradicts it); the Director Console stays separate, with
room inside the Review stage later; the two clocks join C9 (C9 card
example X-08). "The game it ran" paraphrases CS's "the pack the game
ran"; it matches the plan's rule, P5 `plain` ("stamped with the game
it ran") and J3 `need`, so I do not count it. D is open, tagged
`open`, and says "This question stays open".

**Step 3.** All eleven v7 items, word for word, plus item 12 (paper
documents with "unlocked" recorded during play), which decision 28
point 3 left to step 3; "today the director marks them by hand after
the show" matches the after-game report's "Which paper documents were
unlocked" row (the director marks them at the console's first stop).
Every `ownerChoices` entry is a question or a step-3 item. The six
items with a matching `alternatives` row (2 to 7) link to the Parts
page and the other six do not; the two remaining rows belong to D and
F and are linked from their evidence. Plan 3.2 item 3 holds.

**Decided.** Exactly 20, 22, 26, 27, 28, 29 (plan 3.2 item 4). Dates:
20 and 22 from their commits (`c40d70c0`, `e42d4398`, both
2026-10-31), 26 dated 2026-10-31 in CS, 27 to 29 dated 2026-11-01 in
CS. Each line states its decision without loss: 20 (no rule for
documents; fixed as we go), 22 (the whole game, each device alone, a
declared choice, never mixed; the ESP32 recorded as parity, the
owner's word asked), 26 (the best engine for the long term; blue's
findings are clues, never the driver), 27 (promise, parts, design
flaws, quality, moment, venue technician, titles only; "job is
retired" left out because of the word rule), 28 (as above), 29 (five
linked pages from one set of data and a change log; nothing in v7
has to stay).

**Intro.** Paragraphs 1 and 2 hold: answer in the chat by letter or
number (plan 3.2 item 1); the three tags and their meanings (plan 3.2
item 2). Paragraph 3's candidate sentence holds; its "each fact
links" claim is conflict 7.

**Rules (plan 6).** Owner's words used throughout; titles never by
number; "venue technician", never "installer"; no "job"; the shape
is called a candidate wherever it is described, except the one
slip in conflict 1; plain sentences, no em dashes; no files cited in
the text.

## Counts

Items checked: 113 (3 intro paragraphs; 13 question blocks for key,
anchor, group, status, heading, `decides`, recommendation and
`recKind`; 59 evidence lines; 20 options with their costs; 12 step-3
items; 6 decided lines). Conflicts: 7 (evidence lines 6, intro 1),
matching the table.
