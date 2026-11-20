# Writer's log: `front.json`

Written 2026-11-01 for the site plan (`site/2026-11-01-site-plan.md`,
sections 3.1, 3.3 to 3.5, 4.1 and 6). Each section below names the
source of every sentence; where a sentence is carried from version 7 or
a data file with its meaning unchanged, the source is named once for the
run of sentences. Paths are relative to `docs/plans/architecture-pass/`
unless they start with `/`; "v7" is the published page
`report/2026-10-31-cause-report.html`, read as text with the command in
plan section 7; "EJ" is `report/2026-10-31-engine-jobs.json`; "ES" is
`report/2026-11-01-engine-shape.json`; "BR" is `report/build_report.py`;
"CS" is `/docs/plans/CURRENT-STATE.md` section 0; "AG" is
`2026-11-01-after-game-report.md`; "CX" is `/CONTEXT.md`.

## lead

1. "The engine runs shows for any game, not only ALN." v7 lead, first
   sentence, verbatim.
2. "This site starts from its ten promises: what each person can count
   on, when, and what must happen for them." v7 lead, second sentence,
   "page" changed to "site".
3. "The other pages hold what is open ... a change log of earlier
   wordings." New: the six pages of plan section 1 in one sentence; the
   change log's content from plan section 3.6.
4. "The shape is a candidate; nothing is decided unless a page says
   so." Plan section 2, the status line; plan section 6, "the shape is
   a candidate".

## whereYouAre

### open

1. "Thirteen questions wait for you ... in four groups; answer in the
   chat by the question's letter or number." Count: plan section 3.2
   lists the ten-promises question, A to G, 22, 24, 25, 19 and 21
   (eight plus three plus one plus one). How to answer: plan 3.2,
   `decisions.intro`.
2. "About the promises: eight. Whether these are the right ten ... and
   whether one is missing" v7, "What you are deciding", first item, and
   v7 "The promises" question heading ("Is something the engine must
   promise, for any game, missing? Are two of them really one?"). "then
   A to G on their wording and whether three of them should split": v7
   "What you are deciding", first item. "The relationship map changed
   the recommendations for E, F and G": same item, last sentence.
3. "About standalone games: three." Group and members: plan 3.2. The
   three one-line summaries: v7 questions 22 ("The ESP32 gets a
   standalone mode matching the web scanner's ... under your parity
   rule"), 24 ("Does a standalone game run on one GM tablet?") and 25
   ("With no engine and no TV, what do exposed evidence and video
   tokens do?").
4. "About the game's record: one." v7 question 19 ("When a GM scan is
   refused, does the game keep a record of the attempt?").
5. "About the next step: one. How many problems the test rig proves
   before design starts" v7 question 21 heading ("How many problems
   should the test rig prove before design starts?"); CS "21 (how many
   findings the rig shows in step 2)". The question counts problems
   (findings), not design flaws; decision 27 retires "job" and
   "installer", not "problem" (check-front conflict 2).

### decided

1. Decision 29: CS, decision 29, condensed; "nothing in version 7 had
   to stay" dropped in the tightened version.
2. Decision 28: CS, decision 28, points 1 to 6, each clause in order;
   the promise named by marker (plan 4, "titles never retyped").
3. Decision 27: CS, decision 27, condensed; the retired word for the
   venue technician is not written (plan 5.2 forbids it on every page).

### next

1. "Step 2 rebuilds the test rig ... How many it proves first is
   question 21." The rig's description ("the automated test machine
   with real video, music, audio and lighting stand-ins. On it a
   problem can be made to happen for real instead of read off the
   code"): v7 question 21. "lost with the old container; step 2
   rebuilds it": BR `BUILT` J10. The count is left to the question:
   question 21 is open (`decisions.json` q21 `status: open`; CS "Open
   in round 8 ... 21"); "one per design flaw" is only its
   recommendation, so the earlier "one run per flaw, as question 21
   sets" stated the answer as settled (check-front conflict 1). The
   task text names step 2's purpose.
2. "Step 3 designs rule by rule ... Each rule's page joins this site
   and links back": plan, "What the site must do next" (2) and the task
   text; "competing designs side by side": v7, "Coming in step 3".
3. "This site replaces version 7 at the same link; earlier versions are
   in the Change log." Plan header ("Published to the same artifact
   link as version 7"); plan 3.6 item 2 (this site is version 8 in the
   change log's versions list). The earlier sentence ("Version 7 of the
   page stays live until this site is checked and published") came from
   CS "In flight", a working note that is false on the published page
   (check-front conflict 3).

## moments

Built from EJ `jobs[].functional.people` and `.moment` for every
promise. Each "why" is clauses of that promise's `functional.need`,
EJ, in its own words; no clause is from another promise. Column
names: the production stages and points in a show that the promises
name, in CX section 5b's words (Author, Rehearse, Review) and the
glossary's points inside a show (CX section 7, "Moment": doors open,
mid-show, the end of a game).

### Author and Rehearse

- Named by: J6's moment ("In the days before a show, on a laptop or on
  the show machine between games") and need ("play a round within
  minutes"); CX 5b makes the designer's try-my-change loop Rehearse.
- when: J6 moment and need, EJ.
- people: J6 people (the game designer; the owner designing the second
  game; a new designer learning from the toy game); J9 people ("the
  designer reading a badge").
- J6 why: J6 need, EJ. J9 why: J9 need ("the venue technician's go is a
  go and a desk check never passes for a room check ... the editor and
  the show use the same words"), EJ, with "badge" from J9 people. J7
  why: J7 need ("designers and venue technicians reach their tools and
  only those"), EJ.

### Before doors

- Named by: J8's moment ("In the days before an event"), J1's moment
  ("at doors-open when the GM checks that every device matches"), J9's
  people ("the venue technician reading the preflight").
- when: J8 moment and need; BR `WALKS` "Doors open: the preflight".
- people: J8 people (the venue technician; a future operator with a
  second kit, moved here from Release day because J8's moment is "In
  the days before an event", check-front conflict 4), J1 people (the GM
  at doors-open), J7 people (a stranger on the venue wifi).
- J8, J9, J1, J7 whys: each promise's need, EJ. J8's why ends with its
  need's last clause ("a second kit or a new machine needs no change to
  engine code"), moved here with the future operator.

### During play

- Named by: J2 ("Mid-show, at once, and after a tablet comes back"), J3
  ("During play at every tap"), J4 ("whenever the GM presses a
  control"), J7 ("At every connection and every command"), J9 ("At a
  glance, whenever a screen is read"), J5 ("At each lifecycle button,
  at an engine restart"), J8 ("on the night when the engine is absent
  by choice"), J10's people ("the GM running a live show").
- when: those moments, EJ, in one sentence.
- people: J3, J4 and J10 people (the GM at a token or button, at the
  Environment and Show Control sections, running a live show); J5
  people (starts, pauses) as "the start and pause buttons"; J3 and J7
  people (the player at a token, with no account); J2 and J9 people
  (the audience reading the TV, watching the clock); J2 people (a
  player with a hidden fact); J8 people (a GM running a game with no
  engine); J7 people (a stranger on the venue wifi).
- whys: each promise's need, EJ. J5's why takes the two clauses of its
  need that fall during play (a pause blocks scans; a restart loses
  nothing). J10's why takes its last clause (no test or rehearsal ever
  reaches a live show). J8's why takes its standalone clause.

### The end of a game, and between games

- Named by: J5 ("At each lifecycle button ... when a pack changes";
  people: "ends and resets games", "the designer whose edit lands
  between games"), J1 ("Between games when the designer publishes"), J6
  ("on the show machine between games").
- when: those moments, EJ; "a pack change is taken up only here": ES
  P11 seams ("The apply window for a pack change is a row of the
  table") and BR `WALKS` "The designer publishes a change" (refused
  during a game).
- people: J5 people; J1 people ("the designer who publishes a game; ...
  a second designer later").
- J5, J1, J6 whys: each promise's need, EJ.

### Review

- Named by: J3's moment ("after the game when the night is reviewed");
  CX 5b, Review.
- when: J3 moment, EJ.
- people: J3 people, EJ ("the director who tells the night's story, the
  players it is told to, and the owner and designer"); decision 28
  point 1 (CS) requires the director and the players here.
- J3 why: the second sentence of J3's need, EJ.

### Release day

- Named by: J10's moment ("Before every change reaches anyone, and on
  release day").
- when: J10 moment, EJ; "sends a new version to the venue" from J10
  people.
- people: J10 people (the developer; the owner sending a version). The
  future operator with a second kit, J8's person, moved to Before doors
  (J8's moment, EJ; check-front conflict 4); J10's third person, the GM
  running a live show, is in During play.
- J10 why: J10 need, EJ.

## standaloneLine

1. "Decision 22 adds a requirement to every promise: a whole game can
   run with no engine, the GM tablet and the player scanners each
   working alone, as a choice the game declares, and no game mixes
   networked and standalone devices." v7 "Standalone games", first
   sentence; CS decision 22 (a) and (b).
2. "Each promise and each card says what changes with no engine; the
   standalone pass, with the hardware scanner's parity table, is on the
   Design flaws page." v7 "Standalone games", second paragraph ("Each
   promise and each card says what changes"); plan 3.5 item 4 (the
   section and the folded parity table live on `flaws.html`).

## fitSummary

Adapted from BR `FIT_SUMMARY` (the first three passages) and ES, with
part and promise names replaced by markers. The fourth passage of
`FIT_SUMMARY` ("How each promise is kept") is left out on the task's
instruction; the night's record takes its place. Passages 1, 3 and 4
open with "In the candidate shape," or "In the candidate," so the
parts read as a candidate, not as today's facts (plan section 6; BR
`FIT_DEVICES` writes "would"; today replies do not say which request
they answer, card C7, screens show a normal value when nothing is
known, card C10, and nothing writes the night's record,
`2026-11-01-engine-shape.md` alternatives table; check-front conflict
5). Passage 2 closes with "In today's code the loop is also ..." as
its own contrast.

### What happens at every tap

- Sentences 1 to 5: BR `FIT_SUMMARY[0]`, with markers for the parts
  that do each step: rules P1 (ES P1 plain: "only calculates"), record
  P3, answering P4 ("the one door in": v7 whole-engine key, "Every
  request comes in through Answering and gets one reply"), roles P7.
- Sentence 6 ("Every fact that changed then goes out through Delivery
  ... with its label: what it is, how old, how sure"): v7 whole-engine
  key ("every fact goes out to the screens through Delivery, with its
  label") and ES P6 plain ("every fact carrying its label (what it is,
  how old, how sure) and filtered by the reader's role").

### The engine's own machinery

- Sentences 1, 2, 4 (second half), 5 and 6: BR `FIT_SUMMARY[1]`, with
  markers: equipment P8 ("dated": ES P8 plain), verdict P10, profile
  P12, lifecycle P11.
- Sentence 3 (show runner): ES P9 plain ("the designer's cues, the game
  clock, the video queue and the held items ... what is parked because
  a service is down").
- Sentence 4, the list of moments: BR `FIT_SUMMARY[3]` ("setup, start,
  pause, end, reset, restart, the next game"); "it alone moves a game":
  ES P11 plain ("the only code that moves a game"); "takes up a new
  pack only between games": v7 whole-engine key ("it also takes up a
  new pack from the pack channel, only between games").

### What reaches the show from outside

- Sentence 1: BR `FIT_SUMMARY[2]`, first clause.
- Sentence 2: ES P15 plain ("talks to the engine by message") and P2
  plain ("One list of every holder of the pack ... a version stamp
  every copy shows").
- Sentence 3: ES P13 plain ("its own names (data folder, process files,
  sockets, ports, ... the passes it accepts), so a second engine on the
  same machine, a test, a preview or a second kit, never touches the
  first"); ES P16 plain ("the same suite runs on two packs ... under an
  engine of its own"); ES P17 plain ("one described set ... that the
  engine compares at start").

### The night's record, after the end

- Sentence 1: BR `WALKS` "The GM ends the game" (lifecycle closes the
  game; the night's record reads the night's facts) and ES P5 plain
  ("one structured record of the night is written from the facts the
  engine decided, with the roster, notes, accusation and later photos
  captured into it during play, stamped with the game it ran and the
  texts the players saw").
- Sentence 2: ES P5 plain ("The director tells the night from it; the
  owner and the designer read it too"); "the second half of" the
  promise: EJ J3 title and `2026-11-01-engine-shape.md` P5 ("J3's
  afterwards half").
- Sentence 3: ES P5 seams ("the designer's Review reads it inside the
  engine, and the game's own telling (for ALN, the Director Console)
  reads it from outside, with room to move inside the Review stage
  later"); CS decision 28 point 5.
- Sentence 4: `2026-11-01-engine-shape.md` P5 "Today" ("nothing writes
  it; the tablet's `sessionReportGenerator` builds markdown from its
  own copies").

## around

### Notion

- what: `/CLAUDE.md` "Notion Sync Scripts" (the Notion description
  format: SF_ValueRating, SF_MemoryType, SF_Group) and "Token Data
  Schema" (the Notion Elements database is the source of truth).
- connects, sentence 1: `/CLAUDE.md` "Data Flow" (Notion Elements DB
  → `sync_notion_to_tokens.py` → `ALN-TokenData/tokens.json`).
  Sentence 2: ES quality "Generic" ("taking rules only from the pack").
  Sentence 3: AG "What it takes" ("Memory text and paper documents:
  Notion, read when the report is made, not the pack the show ran").
- status, sentence 1: `/CLAUDE.md` "Data Flow". Sentence 2: AG ("Paper
  documents are not in the pack at all"); CS decision 28 point 3.

### The sync script

- what: `/CLAUDE.md` "Notion Sync Scripts" (generates the display
  BMPs) and "Token Data Schema", `SF_Group` note (the `(xN)` shorthand
  is parsed only by the sync script, which derives the groups block);
  `/CLAUDE.md` "Pack channel & staleness" (the sync pipeline regenerates
  the manifest).
- connects: ES P2 seams ("The pack source (a folder, the draft store,
  the toy packs)"); ES tangle 1 ("the sync script's output" among the
  holders).
- status: ES tangle 1 ("The pack is held in nine places and nothing
  joins them", flaws C12, C14, N1).

### The pack files

- what: the file list is from the project instructions: `/CLAUDE.md`
  "Shared Scoring Source" (`tokens.json`; `game.json`;
  `pack-manifest.json`) and the ALN-TokenData `CLAUDE.md` file
  structure (`game.json`: "scoring, modes, groupRules, duplicatePolicy,
  gameClock"; `pack-manifest.json`: "Pack inventory + contentHash").
  "fingerprint": ES P2 plain.
- connects, sentence 1: ES tangle 1 ("The engine's frozen snapshot ...
  the tablet's cache, the phone's own file, the hardware scanner's
  card"); `/CLAUDE.md` "Data Flow" (nested submodule; ESP32 downloads
  via API). Sentence 2: ES P2 plain and P1 plain.
- status: ES tangle 1, second sentence; its flaws C12 and C14.

### The design studio, today the config tool

- what: ES P15 plain (drafts, publish) and P12 plain (the venue
  technician's profile); BR `FIT_DEVICES` "The config tool" ("would
  hold the design studio and the venue technician's profile editor").
- connects, sentence 1: ES tangle "The design tool reaches the engine
  by file and by import, never by message" (writes settings, routing
  file and media folders; imports engine modules by path; runs the pack
  check as a child process; an edit becomes visible at the next
  restart). Sentence 2: ES P15 plain ("published through the engine's
  own gate, applied to a running engine at a window the lifecycle
  allows, rehearsed on a preview engine kept apart"); P15 seams ("the
  preview engine as a second engine instance").
- status: that tangle's flaws (C12, C8); BR `FIT_DEVICES` "The config
  tool" ("A separate program or a surface the engine serves is an open
  choice for step 3").

### Video and the TV

- what: `2026-11-01-engine-shape.md` P8 seams (VLC, the TV's browser);
  ES `componentsMermaid` SB ("the TV's browser is also an equipment
  adapter on the backend").
- connects, sentence 1: ES P8 plain (adapter beneath one interface); ES
  P9 plain (video queue, held items). Sentence 2: ES tangle "The
  scoreboard page is one file, two deployments" ("the engine launches,
  shows, hides and kills its browser as an outside program while the
  page is a client of the engine under a pass"); "watch-only pass": ES
  P7 seams (the kinds of pass are operator, watch-only, device and
  session) and BR `BUILT` J7 ("a watch-only pass for the Pi 4
  scoreboard"); the earlier "display pass" named no kind that exists
  (check-front conflict 7).
- status: v7 card C3 "Why it happens" ("a saved copy that starts from a
  guess and carries no age. Re-reads are partial"); ES tangle "The
  scoreboard page" ("it decides the evidence rule and the money format
  from a file it fetched", flaw C12); ES alternatives "Equipment: an
  interface per capability or per program".

### Music

- what: `2026-11-01-engine-shape.md` P8 seams (MPD); `/CLAUDE.md` "GM
  Scanner Admin Capabilities" (Music (MPD) control; playlists in
  `sync:full`).
- connects: ES P8 plain; `/CLAUDE.md` "Event Architecture" ("ducking
  engine (auto-duck music for video/sound)").
- status: ES tangle "Equipment: seven adapters" ("the music player
  keeps a private connected flag beside the shared health list"); v7
  card C2 summary ("the music panel can keep a calm playing look while
  the engine knows the player is down").

### Audio and Bluetooth

- what: `2026-11-01-engine-shape.md` P8 seams (PipeWire, `pw-play`,
  BlueZ); `/CLAUDE.md` "GM Scanner Admin Capabilities" (Audio routing
  (HDMI/BT), per-stream volume, Bluetooth speaker pairing); ES P8 plain
  ("route and set a volume").
- connects: ES P8 plain; ES P12 plain ("which real instrument each of
  the pack's names binds to").
- status: ES P8 "Today" line in ES tangle "Equipment: seven adapters,
  no shared interface" ("supervision has two shapes"); ES tangle "The
  engine assumes it owns the machine" ("Tests adopt the live display,
  audio and Bluetooth", flaw C8).

### Lighting

- what: `2026-11-01-engine-shape.md` P8 seams (Home Assistant);
  `/CLAUDE.md` "GM Scanner Admin Capabilities" (Lighting scenes (Home
  Assistant)).
- connects: ES P8 plain; ES P12 plain.
- status, sentence 1: v7 card C2 examples ("A-11 Lighting panel stays
  unavailable until a reload if Home Assistant was down at engine
  start"). Sentence 2: CX section 5, "Witness lights" (one virtual
  light per lighting role on the rung-1 rig).

### The after-game article: ALN's Director Console

- what: AG "What it is", item 1 (a web app on the director's Windows
  computer, outside the kit; the pipeline waits at 11 stops; the
  director's actions at the stops; approving the desk publishes the
  article as a web page); AG "What it takes", last paragraph (the
  articles went up 2 to 11 days after their games).
- connects, sentence 1: AG "What it takes" (the GM tablet's report,
  parsed by an AI call; memory text and paper documents from Notion, not
  the pack; roster, notes and photos typed or named by the director);
  AG "A flaw the console already works around" (two clocks; the console
  shifts them back; now finding X-08 under C9, decision 28 point 6).
  Sentence 2: ES P5 plain; CS decision 28 point 3 ("so the article
  quotes what they held").
- status: CS decision 28 point 5 ("Plan for the console staying a
  separate program that reads the engine's record; design the record so
  the console can later become ALN's own part of the engine's Review
  stage"), in its words: the owner planned for (a) and kept (b) open.
  The earlier second sentence ("The engine's own story-of-the-night
  reading must stand alone; a per-game console is the advanced
  instance, never the baseline"), from CX section 5b, is dropped: it
  is the glossary's wording of option (c), which decision 28 did not
  choose, and under "Decided (28)" it read as the owner's answer
  (check-front conflict 6).

### The emailer

- what: AG "What it is", item 2, each clause in order.
- connects: AG "What it takes" (player names and emails from the
  booking list, pasted into the emailer) and "What it gives"; nothing in
  AG has the emailer read the engine, and decision 28 point 4 keeps
  emails outside it.
- status: CS decision 28 point 2.

### The booking list and the ticketing service

- what: AG "What it is", item 2 ("the booking list (each player's name
  and email)").
- connects, sentence 1: AG "What it takes". Sentence 2: EJ `purpose`
  (a player taps "with no account, no login, no app to install and no
  recorded identity unless the game designs an identification moment";
  "players' data stays on the kit").
- status: CS decision 28 point 4.

## aroundMermaid

Eleven nodes. Edges: Notion → sync script → pack files → engine
(`/CLAUDE.md` "Data Flow"; "adopted, stamped": ES P2 plain); engine →
venue programs (ES P8 plain); engine → the night's record "candidate:
written at the end" (ES P5 plain; labelled candidate because nothing
writes the record today, `2026-11-01-engine-shape.md` alternatives
table and `fitSummary[3]`; check-front conflict 8); record → console
"candidate: read from outside" (ES P5 seams); engine ⇢ console "today:
the tablet's report, pasted" and Notion ⇢ console "today: memory texts
and paper documents" (AG "What it takes", the row "Memory text and
paper documents: Notion"; check-front conflict 8);
console → article → emailer, booking list → emailer → players' inboxes
(AG "What it is" item 2, "What it gives"). The teal stroke `#0f766e` on
the engine and the record maps to `--accent` (plan 5.1); no other colour
literal is used.

## siteGuide

Each line condenses plan section 1's "Job" column for that page with the
page's contents in plan sections 3.1 to 3.6: decisions (3.2 item 1, "in
the chat, by the question's letter or number"); promises (3.3 item 4's
fields); parts (3.4 items 2 to 8); flaws (3.5 items 2 to 4); changes
(3.6 items 2 to 6).

## words

All fifteen terms and definitions are v7's words box (BR TEMPLATE,
`<dl class="terms">`), verbatim, in v7's order and grouping: the page's
own words (Promise to Not installed tonight) as group `page`, the rest
(Module to Adapter) as group `design`. "Director" is added to the page
group because the front page uses it (whereYouAre, moments, fitSummary,
around); its definition is CX section 5b, "Director" ("The Review-stage
hat (usually the same human as GM or designer): the person who crafts
the night's telling and harvests design learning back into Author"), in
plain words.

## intros.promises

- Paragraph 1, sentence 1: CS decision 27 (the definition). Sentence 2:
  v7 "The promises" question ("each said from the side of the people who
  count on it") and v7 "How to read a promise" ("who counts on it, when,
  and what must happen for them"). Sentence 3: plan 3.3 items 2 and 3.
  Sentence 4: v7 "What you are deciding", first item; plan 3.2.
- Paragraph 2: the fields of plan 3.3 item 4 in order; "the
  orchestrator's summary": BR `BUILT` comment and v7 footer ("'Built
  today' is the orchestrator's summary from the root CLAUDE.md and the
  capability map"); "where it is marked open, step 3 settles it": EJ
  `goalOpen` and v7 J5 goal heading ("The long-term goal (open for step
  3)"); "the main one first, each with one line on how": plan 3.3 item
  4; "test cases taken from the shows": v7 ("Test cases from the
  shows").
- Paragraph 3, sentence 1: plan 6 ("The shape is a candidate"); v7
  "What you are deciding" (the promises are what the owner confirms).
  Sentence 2: plan 3.3 item 4, last two sentences (both move to the
  change log).

## intros.parts

- Paragraph 1, sentences 1 to 5: v7 "A candidate shape: 17 parts"
  intro (BR `fit_html`), near verbatim, with "not a decision" from plan
  6. Sentence 6: v7 "Where a real alternative exists" intro ("the map
  found two sound ways ... Step 3 puts each in front of you with
  designs side by side") and plan 3.4 item 8.
- Paragraph 2: the card fields of plan 3.4 item 5 in order, each
  explained from its v7 card label (BR part card: "What it does",
  "Mainly keeps", "Also needed by", "Today", "Removes", "Runs on",
  "Where it can be swapped"); the device list from BR `RUNS_ON`; "in a
  standalone game several parts run as small stand-ins on the GM
  tablet": v7 part cards ("in a standalone game, a small stand-in on
  the GM tablet") and v7 whole-engine key; "seams": v7 words box.
- Paragraph 3: plan 3.4 items 2, 3, 4, 6, 7 and 8 in order; "each part
  uses only the parts in the rows below it, so nothing loops back": v7
  layers figure caption (BR `fit_html`); "tangles": v7 tangles intro
  ("one piece of work spread over many places").

## intros.flaws

- Paragraph 1, sentence 1: v7 words box, "Design flaw". Sentence 2:
  CX section 7, "Design flaw" (C1 to C16; N1 proposed); v7 question C
  ("Question 23 is folded in here"). Sentence 3: v7 "The ten promises
  at a glance" note ("Each design flaw has one promise it mainly
  breaks; its card sits there. Flaws also listed under other promises
  point back to their card"). Sentence 4: plan 3.5 item 2.
- Paragraph 2, sentences 1 to 3: v7 "How to read a promise", second
  paragraph ("A card tells one moment at a show, why it happens, and
  shows two diagrams. Today ... Candidate, not decided ..."); the red
  and teal legend from v7 ("where it goes wrong", "the one place that
  would own the fact") and plan 3.5 item 1 ("the diagram legend").
  Sentence 4: v7 card labels "Removed by these parts of the candidate
  shape" and "In design terms", with the design words from v7's words
  box. Sentence 5: v7 card label "In a standalone game". Sentence 6: v7
  card label "The problems behind it, and the code they live in" and v7
  evidence intro ("came from blue's records and the maps of today's
  engine"). Sentence 7: v7 card heads ("29 problems found", "Question
  5", "Clue from blue: fix W3", "Seen live"); its shape ("names the
  questions it answers where there are any, marks a problem that was
  seen live, and names any fix on blue it came from") follows
  `2026-10-31-cause-cards.json`, where `questions`, `seenLive` and
  `blueFixes` are each present on some cards and absent on others
  (C2, C3, C8, C11 carry both marks; C6, C7, C9, C12, C13 neither; C15
  and C16 name no question), so the marks are not one either-or
  (check-front conflict 9).
- Paragraph 3, sentence 1: plan 3.5 item 4; v7 "Standalone games"
  (decision 22; "The two biggest gaps"; the ESP32 parity table).
  Sentence 2: plan 3.5 item 5 and v7 "The evidence" (totals, the
  set-aside table, "where each flaw lives in today's code"). Sentence
  3: v7 "How to read a promise" ("Step 3 puts competing designs in
  front of you; nothing on the right is decided").

## Checks run on the file

- Valid JSON; 78 markers (77, plus the Change log page link in
  `whereYouAre.next[2]`), every id in the task's valid set.
- Every promise J1 to J10 placed in `moments` (20 entries over 6
  columns after the J8 line moved from Release day into Before doors);
  every person named in any promise's `functional.people` appears in a
  column's people list (checked by hand against EJ, re-run by script
  after the check's changes).
- All fifteen v7 words present with their definitions; one added
  (Director).
- No em dash; no "installer"; no "job"; no promise id in visible text
  (ids appear only inside markers and in `moments[].promises[].id`).
- Word counts (markers counted as their rendered length, roughly):
  lead 83, whereYouAre 426, moments 944, standaloneLine 64, fitSummary
  522, around 1,161, siteGuide 163, words 329; the front page's prose
  without the two table-like blocks (moments, words) is 2,419, inside
  plan 3.1's 2,000 to 2,800 target; intros 895 (they render on three
  other pages).

## Changes after the check (2026-11-01)

The check `site/checks/check-front.md` found 9 conflicts over 88 items.
Each was verified against the source the check names before it was
applied. Applied 9, rejected 0.

| # | Where | Outcome | What changed | Verified against |
|---|---|---|---|---|
| 1 | `whereYouAre.next[0]` | Applied | "...reading them off the code: one run per flaw, as question 21 sets" became "...reading them off the code. How many it proves first is question 21." | `decisions.json` q21 `status: open`, `recommendation: "One per design flaw, 16 runs."`; BR line 1110 (the recommendation, not an answer); CS "Open in round 8 ... 21" |
| 2 | `whereYouAre.open[4]` | Applied | "How many design flaws the test rig proves live before design starts" became "How many problems the test rig proves before design starts" | BR line 1108 (v7 heading, "problems"); `decisions.json` q21 heading; CS "21 (how many findings the rig shows in step 2)"; CS decision 27 retires "job" and "installer" only |
| 3 | `whereYouAre.next[2]` | Applied | "Version 7 of the page stays live until this site is checked and published to the same link" became "This site replaces version 7 at the same link; earlier versions are in the Change log" (page marker) | Plan header; plan 3.6 item 2; CS "In flight" is a working note |
| 4 | `moments[5]` Release day, `moments[1]` Before doors | Applied | "A future operator with a second kit" moved from Release day's people to Before doors; the J8 line left Release day and its clause ("a second kit or a new machine needs no change to engine code") joined Before doors' J8 why, so J8 keeps one line per moment. Release day keeps the developer, the owner and J10. | EJ J8 `functional.moment` ("In the days before an event, and on the night when the engine is absent by choice"); EJ J10 `functional.people` (developer, owner, the GM running a live show; no future operator) |
| 5 | `fitSummary[0]`, `[2]`, `[3]` | Applied | Passage 1 opens "In the candidate shape, four promises meet at every tap in a networked game."; passage 3 opens "In the candidate, the designer's week..."; passage 4 opens "In the candidate, when the GM ends a game...". Passage 2 unchanged: its last sentence already contrasts today's code. | Plan section 6; BR `FIT_DEVICES` ("would"); cards C7, C10; `2026-11-01-engine-shape.md` alternatives table ("nothing writes the night's record yet") |
| 6 | `around[8]` Director Console `status` | Applied | Now "Decided (28): plan for the console staying a separate program that reads the engine's record, and design the record so the console can later become ALN's own part of the engine's Review stage." The second sentence (story-of-the-night reading stands alone; a per-game console is the advanced instance) is dropped. | CS decision 28 point 5; AG question 5 options (a), (b), (c) and answer 5 ("Plan for (a) ... Design the record so (b) ... stays open"); CX line 538 is the source of the dropped sentence, not decision 28 |
| 7 | `around[4]` Video and the TV `connects` | Applied | "under a display pass" became "under a watch-only pass" | ES P7 `seams` ("operator, watch-only, device, session"); BR `BUILT` J7 ("a watch-only pass for the Pi 4 scoreboard"); today-components :633 ("under an observe credential") |
| 8 | `aroundMermaid` | Applied | Edge engine → record labelled "candidate: written at the end" (kept solid, like the record → console edge, which is also labelled candidate); edge Notion ⇢ console labelled "today: memory texts and paper documents" | `2026-11-01-engine-shape.md` alternatives table; `fitSummary[3]`; AG "What it takes" row "Memory text and paper documents: Notion" |
| 9 | `intros.flaws[1]` | Applied | Last sentence now "The card's head counts those findings, names the questions it answers where there are any, marks a problem that was seen live, and names any fix on blue it came from as a clue." | `2026-10-31-cause-cards.json`: `questions` empty on C15, C16; `seenLive` and `blueFixes` both set on C2, C3, C8, C11, both empty on C6, C7, C9, C12, C13 |

Checks re-run after the changes: `python3 -I -m json.tool` passes; 78
markers, all valid; every promise still placed (20 entries); every
promise's person still in a column's people list; no promise id in
visible text, no "installer", no "job", no em or en dash, no "display
pass".
