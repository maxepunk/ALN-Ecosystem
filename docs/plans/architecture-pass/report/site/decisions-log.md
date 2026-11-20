# Decisions page: writer's log

Written 2026-11-01 for `site/decisions.json` (plan section 4.2). For
each question: the version 7 text it started from, what changed and
why, and the source of every evidence line. Paths without a folder are
in `docs/plans/architecture-pass/`; `report/` is
`docs/plans/architecture-pass/report/`; `CS` is
`docs/plans/CURRENT-STATE.md` section 0.

## Sources read

- Version 7's questions: `report/build_report.py` TEMPLATE, lines
  1013 to 1140 ("Your questions" to the footer).
- The shape's `questionNotes` and `ownerChoices`, the `parts[].name`
  list, the `qualities`, the `alternatives` table and `partsMermaid`
  (the 54 links): `report/2026-11-01-engine-shape.json`.
- The promises' people, moments, needs, flaws (with the `primary`
  flag), parts and standalone lines: `report/2026-10-31-engine-jobs.json`.
- The cards' "at a show", examples and "seen live" notes:
  `report/2026-10-31-cause-cards.json`.
- The standalone lines and new findings:
  `report/2026-10-31-standalone-lines.json`; `2026-10-31-standalone-pass.md`
  (line 19, the "Applies" paragraph under C10 at line 99, rows SG-06,
  SG-07, SP-06, SP-07, the B-08 row in section 3.3, the parity table
  count at line 299).
- The cause analysis: `2026-10-30-cause-analysis.md` lines 17 (the
  four rig reproductions), 35 and 456 (X-08), 863 (B-08 set aside),
  1285 to 1291 (section 7).
- Decisions 20 to 29: CS. Dates of 20, 22 and 26 from the commits that
  recorded them (`git log -S` on CURRENT-STATE.md: all three
  2026-10-31; 27, 28 and 29 are dated in CS itself, 2026-11-01).
- The after-game survey and its answers:
  `2026-11-01-after-game-report.md`.
- The program document's step 2 (the test rig):
  `docs/plans/2026-10-30-architecture-pass.md` line 125.

## Rules applied everywhere

- Promise titles are never typed: every place v7 quotes a title,
  including the question headings for A, B, C, D, E and F and the
  option labels in F and G, carries a `[[promise:…]]` marker inside
  the quote marks. The builder must render markers inside headings
  and option labels, not only in body text. The two titles question E
  offers ("The game fits the venue, whatever the setup" and "The game
  fits the venue it is in tonight") are candidate titles, not the
  promise's title, so they stay as typed text, as v7 has them; the
  second is also the current title and the marker form would hide
  that it is a choice.
- Part names in prose become markers (`[[part:P7]]` for "connections
  and roles", `[[part:P6]]` for "delivery", `[[part:P17]]` for "the
  release"), so the owner can read the part.
- "Installer" does not occur; "job" does not occur (v7's "written as
  a job" in the promises question is replaced, see below); no promise
  id is visible; no em dash. Checked by script after writing: all
  markers resolve against the valid id lists.
- Statuses: promises, D, 22, 24, 25, 19, 21 `open`; A, B, C `applied`;
  E, F, G `changed`. `recKind` is "Suggestion" for 25 (v7's word) and
  "Recommendation" for the rest.
- Word count: about 4,000 words of text outside the JSON keys, above
  the plan's 2,500 to 3,500 target for the page's prose. The excess is
  the evidence lines the task asks for (two to five per question) and
  the options with their costs, which the plan counts as lists, not
  prose. Every v7 sentence is kept in substance; nothing was cut to
  meet the count.

## Intro

Three paragraphs, new. (1) How to answer: in the chat, by letter or
number; each question stands alone (task and plan section 3.2, item
1). (2) The three status tags and what each means (plan section 3.2,
item 2, which names the tags; v7's class labels "Applied, please
confirm" and "Recommendation changed by the map"). (3) What the
evidence lines are, and the candidate rule (plan section 6, "the
shape is a candidate").

## The questions

### promises (q-promises), open

v7 started from: "Are these the right ten promises, and does each read
from the side of the people who count on it? Is something the engine
must promise, for any game, missing? Are two of them really one? Each
promise says who counts on it, when, and what must happen for them.
Each title is new; the earlier wording, written as a job, shows under
each. This replaces question 17. Recommendation: keep these ten as the
base, with these titles, and settle D to G below. In the map every
promise is kept by parts of its own, and the one candidate for an
eleventh, 'run in any setup', owns no part (question E)."

Changed: "the earlier wording, written as a job, shows under each"
became "the earlier wording of each is in the change log", because the
earlier wordings moved to `changes.html` (plan section 3.3, item 4;
decision 29) and "job" may appear only there (plan section 6). "Is
something missing? Are two of them really one?" is folded into
`decides`. The recommendation is v7's, word for word.

Evidence:
1. "Each promise says who counts on it, when…; earlier wording in the
   change log": v7's text; plan 3.6 item 3.
2. "Every promise is kept by parts of its own": v7's recommendation;
   `engine-jobs.json` `parts` arrays, non-empty for all ten.
3. "Running in any setup owns no part": v7 question E;
   `questionNotes` E ("a new eleventh job would have no part of its
   own").
4. "Each flaw mainly breaks exactly one promise; the designer's
   promise is the one no flaw mainly breaks; C8 and C12 break it":
   `engine-jobs.json` `flaws[].primary`: C8 and C12 under J6 both
   `false`; every other flaw is `primary: true` under exactly one
   promise (C1, C6, C9, C11 under J2; C7 under J3; C2, C3 under J4;
   C4, C5 under J5; C13 under J7; N1 under J8; C10 under J9; C8, C14,
   C15, C16 under J10; C12 under J1). New fact, added because the
   question asks whether two promises are really one.
5. "Replaces question 17": v7; CS ("17 (is the cause list right)").

### A (q-a), applied

v7 started from: the heading and the two body sentences ("'Nothing in
the engine assumes ALN' is now a quality every part must have
(Generic…). The version every device shows is the pack channel's stamp
on every copy, compared whenever a device connects.") and the
recommendation ("keep both…").

Changed: nothing in meaning. The body became evidence lines 1 and 2,
with the parts named; "(Generic, in 'How the promises fit together')"
became "named Generic on the Parts page", since the qualities table
moves there (plan 3.4, item 2). Recommendation word for word, with
"C12" as a flaw marker.

Evidence:
1. Generic quality carried by Game rules, Venue fit, Engine instance:
   `engine-shape.json` `qualities[2]` ("Carried by taking rules only
   from the pack and kit names only from the profile and the engine's
   own instance"); `questionNotes` A.
2. Pack channel's stamp on every copy and game record, compared when a
   connection is admitted: `parts` P2 `plain`; `questionNotes` A.
3. C12: a tablet on another pack only logged: `engine-jobs.json` J1
   flaws C12 `how`; C12 card example B-20 / C-08 / D-18.
4. Second designer's game rests on Game rules, which only calculates:
   `parts` P1 `plain`; J1 `need` ("A second designer's game runs on
   the same engine").

### B (q-b), applied

v7 started from: heading; "Starting, pausing and ending a game and
changing scores stay with the GM, and the stored passwords and keys
change before outsiders touch the system. The map agrees: one part,
connections and roles, holds both the pass and what it allows.
Recommendation: agree."

Changed: nothing in meaning. The first sentence is now `decides`; the
second is evidence line 1 with markers.

Evidence:
1. Connections and roles holds pass and grants; Answering checks once:
   `questionNotes` B; `parts` P4 `plain` ("The rule that only the GM
   may start, pause, end or change scores is checked here, once").
2. Quality "Only the GM moves the game": `qualities[4]`.
3. Today a connection's own word decides; whole game state fetched by
   anyone; TV connects as a GM: C13 card `atAShow` and examples
   B-04 / B-27 / D-27 / C-20, B-89 / D-25 / D-26.

### C (q-c), applied

v7 started from: heading; the two body paragraphs (decision 22's
words; where the declaration is kept, the profile favoured; question
23 folded in, the eight problems, C9, C11, C14 and the ESP32 parity
list, where it lands on the map) and the recommendation ("Agree. On
question 23, yes: three other rules…").

Changed: nothing in meaning. The paragraphs are split into evidence
lines 1 to 3 and 5; the question-23 fold is stated in `decides`.
"ESP32" became "hardware scanner" in the parity-list sentence to match
the page's words for the device (the cards say "hardware scanner");
question 22's heading keeps v7's "ESP32" because it is the question as
asked. Recommendation word for word.

Evidence:
1. Decision 22's words and date: CS item 22; commit date 2026-10-31.
2. Standalone as an input every rule takes; Venue fit is where it is
   declared: `qualities[3]` ("Who decides when there is no engine");
   `questionNotes` C; `parts` P12 `plain`.
3. Where it is kept is a step-3 choice; the profile favoured and why;
   the pack channel carries it: v7 C; `questionNotes` C.
4. Today: a tap, a URL path, nothing on the hardware scanner, no pack
   field: `2026-10-31-standalone-pass.md` line 19; J8 `standalone`
   line; `mechanisms` "The authority switch".
5. N1's eight findings; fallback homes C9, C11, C14 and the parity
   list; lands on P2 and P12, or P3: v7 C; standalone pass section
   3.4; `questionNotes` C; `ownerChoices` ("on this map it lands on
   the pack channel and venue fit either way").

### D (q-d), open

v7 started from: heading "Split 'Every tap gets its answer, and the
night can be told afterwards' into two promises?"; the two body
paragraphs (answering at the tap; the night's record for you and the
designer after the show; the map confirms no shared part; six
promises depend on answering; the record written once; the parts the
same either way; the cost of one and the cost of two) and the
recommendation ("Split…").

Changed: decision 28 (CS item 28, point 1) renamed the people of the
second half, so "for you and the designer after the show" became "for
after the show" with the people named in evidence line 1, and the
cost of one promise names "the people after the show (the director,
the players, you and the designer)" instead of "you after the show".
The recommendation's "serve two people at two moments" became "serve
different people at two moments", because the second half now has
several people. D itself stays open, as the task says. Evidence line
2 keeps v7's "six promises depend on it" as v7's figure; the parts
list names five promises Answering mainly keeps (`parts` P4 `jobs`),
and the dependency count comes from the links in `partsMermaid`, not
re-derived here.

Options (new structure, v7's content): one promise, cost from v7's
"Keeping one promise means…"; two promises, cost from v7's "Splitting
makes a promise that no design flaw mainly breaks yet…".

Evidence:
1. Decision 28 renamed the second half's people; D stays open: CS
   item 28 (1); `engine-jobs.json` J3 `functional.people` ("the
   director who tells the night's story, the players it is told to,
   and the owner and designer"); the task text.
2. Two halves share no part; Answering in the middle, six promises
   depend on it; the night's record written once at the end: v7 D;
   `questionNotes` D; `parts` P5 `plain`.
3. The night's record carries the game and the texts; Review reads it
   inside, the Director Console outside, room to move inside later:
   CS item 28 (3) and (5); `parts` P5 `plain` and `seams`; J3 `goal`.
4. C7 mainly breaks the tap's answer; no flaw mainly breaks the
   night's record half: `engine-jobs.json` J3 flaws (C7 `primary:
   true`, the rest false); v7 D second paragraph.
5. Alternatives row "The tap's answer and the night's record: one part
   or two": `engine-shape.json` `alternatives[4]`.

### E (q-e), changed

v7 started from: heading; two body paragraphs (venue fit as one part
with an output; "run in any setup" has no part; the switch and the
engine's own names; two titles fit the map; the cost of not
splitting) and the recommendation ("One promise, titled…; this
replaces the earlier recommendation to split").

Changed: nothing in meaning. "Fitting the game to tonight's venue is
one part" names the part with a marker. The options are new
structure: v7 names the split (as what the question asks) and two
titles; the costs: split, "would own nothing" (v7's words); the
second title, v7's "The cost of not splitting…" sentence; the first
title, v7 says only that it "keeps standalone games and other kits in
the title", so its cost line mirrors v7's contrast with the other
title ("names the venue technician's moment"): the venue technician's
moment moves to the sentences. That mirror is the one cost not stated
by v7 in so many words.

Evidence:
1. Venue fit's output; Verdict's go or no-go: v7 E; `parts` P12 and
   P10 `plain`.
2. "Run in any setup" owns no part; the switch every rule takes;
   Engine instance knows its own names and keeps a test from the live
   show: v7 E; `questionNotes` E; `qualities[3]`; `parts` P13 `plain`.
3. The promise names the venue technician, a GM with no engine, a
   future operator with a second kit; the last two in its sentences:
   `engine-jobs.json` J8 `functional.people` and `need`.
4. N1 mainly breaks it; C15 breaks it through fixed program names:
   J8 flaws (N1 `primary: true`; C15 `how`).
5. Earlier recommendation in the change log: plan 3.6, item 5.

### F (q-f), changed

v7 started from: heading; the body paragraph on the two moments; the
four options a to d; the paragraph on questions 4 and 5 and C14, C15,
C16, "This replaces question 18"; the recommendation.

Changed: nothing in meaning. The first body paragraph became evidence
lines 1 and 2 with the parts named. The paragraph on the questions
became evidence line 3. Options a to d keep v7's wording; the costs of
b, c and d are v7's own sentences. Option a's cost is not stated by
v7; the line written ("One title covers two people at two moments…;
the pass gives each its own question") is drawn from v7's
recommendation ("give the proof and the release a question each in
the pass") and the shape's note that the map splits the promise by
moment (`questionNotes` F).

Evidence:
1. The developer's proof is the quality Proof, carried by Joins and
   proofs and Engine instance: v7 F; `qualities[1]`; J10 `parts`.
2. Release day is one small part; the described set compared at
   start: v7 F; `parts` P17 `plain`.
3. Four flaws mainly break it; question 4 covers C8; no question fits
   C14, C15, C16: J10 flaws (all four `primary: true`); v7 F.
4. Every option places C15; C16 lands on the proofs either way:
   `questionNotes` F.
5. Alternatives row "Release day: its own part… or in venue fit's
   deploy chain": `alternatives[7]`; "replaces question 18": v7 F and
   CS; earlier recommendation in the change log: plan 3.6, item 5.

### G (q-g), changed

v7 started from: heading; two body paragraphs (the map's answer if one
delivery part; the equipment decides, delivery carries, the screens
draw; the two promises already cover their halves; if one promise must
hold the words, the cost under each) and the recommendation.

Changed: nothing in meaning. The body became evidence lines 1 to 3;
the "if you still want one promise to hold the words" sentence became
the two costed options, plus the recommended option "neither" with
the condition v7 attaches to it as its cost. "the room promise" and
"One game, the same on every screen" in the options carry markers.
Recommendation word for word, with C2 marked.

Evidence:
1. One delivery part carries every fact with its label; six promises
   use it: v7 G; `parts` P6 `plain` and `jobs` (J2, J4, J9, J1, J7,
   J5: six).
2. Equipment decides state and health as one dated fact; Delivery
   carries; Screens draw: v7 G; `questionNotes` G; `parts` P8 and P14
   `plain`.
3. The two promises already cover their halves; the running state
   already includes the video queue, music, held items, the clock and
   each service's health: v7 G; `questionNotes` G.
4. C2 today: health and state on separate routes, the music card
   keeps its playing look while the health row turns red; card under
   the room promise: C2 card `atAShow`; J4 flaws (C2 `primary: true`).
5. Step 3's choice; alternatives row "Getting state onto screens":
   `alternatives[0]`; earlier answer in the change log: plan 3.6 item
   5.

### 22 (q-22), open

v7 started from: heading "The ESP32 gets a standalone mode matching
the web scanner's."; "Recorded that way under your parity rule. On the
map, a yes means… A no leaves the ESP32 behind the phone… in seven of
the 24 abilities… and showing a missing engine as a red outage all
night. Is that right? Recommendation: yes, as your parity rule asks."

Changed: nothing in meaning. The heading keeps "ESP32" as asked; the
body uses "hardware scanner", the cards' word. The yes and no became
the two options with v7's costs. "Your explicit word is asked for"
(CS item 22) is in `decides`.

Evidence:
1. Decision 22 recorded the gap as parity on the owner's reasoning:
   CS item 22; date from the commit.
2. 24 abilities, seven behind: J8 `standalone` ("trails the phone in
   seven of 24 abilities"); standalone pass line 299 (24 rows); the
   parity table is on the flaws page (plan 3.5, item 4).
3. Red Disconnected, growing queue, "Rescan later": standalone pass
   lines 19 and 99 (SP-20, SP-07); J9 `standalone`.
4. A yes means the declaration reaches a device with no idea of it;
   the pack channel carries it: v7 22; `questionNotes` C.

### 24 (q-24), open

v7 started from: heading; "Today two standalone tablets are two
separate games. Several tablets sharing one game with no engine would
need them to talk to each other directly, a large new piece. This also
decides whether a standalone tablet's record of the night can hold
player scans: only if the standalone player scanners hand their scans
to that tablet. Recommendation: one tablet, unless you plan standalone
games with two GMs."

Changed: nothing in meaning. Two options: several tablets, cost v7's
"a large new piece"; one tablet, cost "standalone games with two GMs
are ruled out", the mirror of v7's "unless you plan standalone games
with two GMs".

Evidence:
1. Two tablets are two games: own claim list, one token sold on both,
   own score table: standalone pass SG-06; `standalone-lines.json` C1.
2. Direct talk between tablets, a large new piece: v7 24.
3. The record of the night holds player scans only if the player
   scanners hand them to the tablet: v7 24; J3 `standalone`.
4. Player devices must learn each new game: a game id they check if
   joined, or their own reset: `standalone-lines.json` C4.
5. The tablet runs Game record and Lifecycle or its own engine;
   alternatives row "The standalone tablet": `standalone-lines.json`
   C1; `alternatives[3]`.

### 25 (q-25), open

v7 started from: heading; "This decides what the screens draw in those
two cases. The suggestion below needs the tablet's own scoreboard
screen to show exposed evidence. The other way, showing nothing for
exposure and hiding video tokens, is smaller but drops a mode's effect
from a standalone game. Suggestion: exposed evidence shows on the GM
tablet's own scoreboard screen, which standalone already has. A video
token shows its picture with a plain note instead of an error."

Changed: nothing in meaning. The two ways became options with v7's
costs. Suggestion word for word; `recKind` "Suggestion".

Evidence:
1. Exposure has no scoreboard to show on in standalone; the GM sees
   the summary once: standalone pass SG-07.
2. Video token: black screen with the token's name on the phone;
   picture and "Rescan later" on the hardware scanner: standalone pass
   SP-06, SP-07 and parity row 13 (line 271).
3. Screens draw it; a Verdict stand-in marks engine duties dormant,
   grey: J9 `standalone`; `parts` P14 `plain`.
4. The pass left both answers to the owner: parity row 13 ("Standalone
   needs a declared answer for what a video token does with no
   engine"); `standalone-lines.json` C3 ("What a video token shows is
   the owner's choice").

### 19 (q-19), open

v7 started from: heading; "For example, a token already used, or no
game running. Today only the tablet that scanned hears about it. On
the map this decides whether the game's record keeps refused attempts,
or only the answer goes back to the tablet. Yes means the record gains
a kind of fact that no screen shows yet. No means a refused attempt is
recorded nowhere, as today… Recommendation: yes. Record every attempt
and its answer, and show it nowhere until a feature needs it."

Changed: nothing in meaning. Yes and no became options with v7's
costs. Recommendation word for word.

Evidence:
1. Told to the tablet only; set aside as a product choice: v7 19;
   `2026-10-30-cause-analysis.md` line 863 (B-08, "A question for the
   owner, not a cause").
2. Game record decides, Answering replies; a yes adds a fact no screen
   shows: v7 19; `parts` P3 and P4 `plain`.
3. C9's card leaves it to the owner: `engine-jobs.json` J3 flaws C9
   `how` ("Whether refused scans belong in the night's record is the
   owner's open question, not this flaw").
4. Standalone records refused duplicates and unknown tokens nowhere;
   a yes needs a counterpart under C7: standalone pass section 3.3,
   the "B-08 and question 19" row.

### 21 (q-21), open

v7 started from: heading; "The test rig is the automated test machine
with real video, music, audio and lighting stand-ins. On it a problem
can be made to happen for real instead of read off the code. Phase 2
proves each problem anyway, because every area starts with its test
failing on today's engine. Recommendation: one per design flaw, 16
runs."

Changed: nothing in meaning. v7 offers no options, so the list is
empty. Recommendation word for word.

Evidence:
1. What the rig is; step 2 follows the owner's answers: v7 21; CS
   ("Step 2, the test rig, follows the owner's answers"); program
   document line 125.
2. The four reproductions the program document names:
   `2026-10-30-cause-analysis.md` line 17; program document line 125.
3. Eight cards carry a "seen live" note (C2, C3, C5, C8, C10, C11,
   C15, C16); the four quoted: `cause-cards.json` `seenLive`.
4. Phase 2 proves each problem anyway: v7 21.
5. Equipment plans one software stand-in per capability for the
   preview engine and the test rig: `parts` P8 `seams`.

## Step 3 (step-3)

Items 1 to 11 are v7's eleven, word for word, each followed where it
matches by a sentence ending in `[[page:parts]]`. Item 12 is new:
paper documents joining the pack with "unlocked" recorded during play,
which decision 28 point 3 left to step 3 (CS item 28; the after-game
report's answer 3); "today the director marks them by hand after the
show" is the report's "Which paper documents were unlocked" row.

Matches to the shape's `alternatives`:

| Item | Alternatives row |
|---|---|
| 2, getting facts onto screens | 0, "Getting state onto screens: one part or a delivery per promise" |
| 3, the life of a game | 5, "The lifecycle: a module or a table each part reads" |
| 4, the game rules | 1, "The rules: shared code or two implementations under one contract" |
| 5, the equipment's interface | 2, "Equipment: an interface per capability or per program" |
| 6, the standalone tablet | 3, "The standalone tablet: the same modules as the engine, or its own engine" |
| 7, the scoreboard | 6, "The scoreboard: one page in two hosts, or a view of the GM app" |

No row for items 1 (where standalone is declared), 8 (the config
tool), 9 (hot-apply window), 10 (start-or-adopt setting), 11 (order
of work) or 12 (paper documents); these end without a marker. The two
remaining rows, 4 ("The tap's answer and the night's record") and 7
("Release day"), belong to questions D and F and are linked from their
evidence, not from the step-3 list.

## Decided

Six lines, one per decision, from CS section 0 items 20, 22, 26, 27,
28 and 29. Dates: 20, 22 and 26 from the commits that recorded them
(2026-10-31); 27, 28 and 29 as CS dates them (2026-11-01). Decision
22's line adds "your explicit word is question 22 above", from CS's
"the owner's explicit word is asked for". Decision 28's line uses a
promise marker for the title and a flaw marker for C9; decision 27's
line omits "job is retired", since the word may appear only in the
change log.

## Not done, for the builder and the checkers

- `decides` is a new field with no v7 text behind it; each line
  restates the question's own first sentence or v7's "this decides"
  sentence (C, D, E, F, G, 22, 24, 25, 19 have one; A, B and 21 are
  restated from their heading and body).
- Markers appear inside `heading` and `options[].label` (A, B, C, D,
  E, F, G); the builder must resolve them there.

## Check applied, 2026-11-01

`site/checks/check-decisions.md` found 7 conflicts in 113 items. Each
was verified against the source the check names before it was applied
or rejected. Six applied, one rejected. Everything the check found
right is unchanged.

| # | Where | Result | What changed, or why not |
|---|---|---|---|
| 1 | C, evidence 2 | Applied | "and fitting the game to tonight's setup, [[part:P12]], is where it is declared" became "and [[promise:J8]], which fits the game to tonight's setup, is where it is declared". Verified: `questionNotes` C says J8 is where it is declared and "where the fact is held is a later choice"; `parts` P12 `plain` says "if the owner places it here". The part marker read as the step-3 choice made (plan section 6). |
| 2 | D, evidence 2 | Applied | "six promises depend on it" became "five promises depend on it". Verified: `2026-11-01-engine-shape.md` line 354 ("used by five jobs"); `parts` P4 `jobs` lists J3, J2, J4, J5, J7; P4's serves line (line 185) names the same five. The earlier entry for D above said the count came from `partsMermaid`; counted now, that figure has 3 links into P4 and 5 out, so no source gives six. v7's figure was the error. |
| 3 | 19, evidence 3 | Applied | "[[flaw:C9]]'s card leaves this to you" became "Where [[promise:J3]] lists [[flaw:C9]], it leaves this to you". Verified: the sentence is J3's `flaws` C9 `how` in `engine-jobs.json`; the C9 card in `cause-cards.json` says nothing about refused scans or question 19 (its `questions` are 1 and 5). The earlier entry for 19 above already cites the J3 line, not the card. |
| 4 | 25, evidence 1 | Applied | "A tablet alone has no scoreboard to show it on" became "On a tablet alone the scoreboard screen is kept to ranking modes and the evidence picker is hidden". Verified: `2026-10-31-standalone-pass.md` SG-07 (line 171). The old wording contradicted the suggestion on the same screen, which rests on the tablet's own scoreboard screen. |
| 5 | 25, evidence 2 | Applied | "([[flaw:C10]])" became "([[flaw:N1]], [[flaw:C10]])". Verified: SP-06 (the phone's black screen, line 187) is cause N1 with fallback C14; SP-07 (the hardware scanner's "Rescan later", line 188) is cause C10; N1's eight instances (line 243) include SP-06. |
| 6 | F, evidence 4 | Rejected | The check proposes "Options a, b and c each place [[flaw:C15]]" because `questionNotes` F names three ways that place C15 and says of leaving J10 as drafted only that it "also fits the parts". Verified against the fuller source the check also lists: `2026-11-01-engine-shape.md` line 356 (question F) discusses all four readings, including "Leaving J10 as drafted is also consistent with the parts: P16, P13 and P17 all serve it already", and then says "C15 lands on P17 whichever way; C16 lands on P16". So C15 has its home under every option, option d included, and "Every option below places C15" holds. The `questionNotes` entry is the condensed form of that paragraph, not a narrower claim. Kept as written. |
| 7 | intro 3 | Applied | "Each fact links to the promise, part, design flaw or question it comes from" became "Most facts link to the promise, part, design flaw or question they come from". Verified by script: 9 of the 59 evidence lines carry no marker (promises 5; C 1; E 3; 22 1; 24 2; 25 4; 19 1; 21 1 and 4). The check offered wording or links; wording was chosen, since those nine lines state facts whose source is a document, not a page entry, and a marker would link the wrong thing. |

Marker count after the changes: 122 (120 before; conflict 1 swaps a
part marker for a promise marker, conflicts 3 and 5 add one marker
each). All resolve against the valid ids; no promise id, em dash,
"installer" or "job" in visible text. JSON validated with
`python3 -I -m json.tool`.
