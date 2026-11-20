# Writer's log: `v9/front.json`

Written 2026-11-01 for version 9 of the owner's site, to the plan
`site/2026-11-01-site-plan-v2.md` (sections 2, 3.1, 3.3 to 3.5, 4 and 6;
plan v1 sections 2 and 5 where v2 is silent). Each section below names
the source of every sentence; where a sentence is carried from version 8
(`site/front.json`) with its meaning unchanged, the source is named once
for the run of sentences. Paths are relative to
`docs/plans/architecture-pass/` unless they start with `/`. Short names:
"DR" is `DECISIONS.md` (the decision record, by topic; decisions named by
their titles); "JT" is `report/site/checks/jargon-table.md` (its wording
rows by number, its front.json rows by `I`-code, its words-box rows by
`W`-code); "QT" is `requirements/2026-11-01-quality-targets.json`; "EX" is
`requirements/2026-11-01-extension-cases.json`; "RM" is
`/docs/plans/ROADMAP.md`; "CS" is `/docs/plans/CURRENT-STATE.md`; "EJ" is
`report/2026-10-31-engine-jobs.json`; "v8" is `site/front.json`; "plan"
is the v2 site plan; "CX" is `/CONTEXT.md`.

Rules applied throughout (plan section 6): the proactive frame (the
requirements and the decisions ahead first; today's engine as evidence
and test situations; the earlier candidate as one input among the
panel's); decisions by their titles, through `[[dec:]]` markers whose
slug is the title in lower case with every run of non-letters as one
hyphen (so "The night's record and the after-game article" is
`the-night-s-record-and-the-after-game-article` and "Blue's fixes are
evidence of design causes" is `blue-s-fixes-are-evidence-of-design-causes`;
plan v2 section 2, "Markers"); no visible promise, decision, question,
flaw, finding, quality-target or extension-case id; the sequencing names
of DR "Name each step by what it does"; JT's wordings, with plan v2's
"design half" and "build half" in place of JT rows 1 and 5's "planning
half" and "building half" (plan v2 overrides the table where they
differ); no em dashes.

## lead

1. "The engine runs shows for any game, not only ALN, and it is being
   redesigned for the long term: an engine that is intuitive and easy to
   maintain, to keep developing and to extend." First clause: v8 lead,
   first sentence. The rest: the owner's goal in DR "Design for the long
   term, beyond ALN" ("design a long-term optimal architecture for our
   engine that makes it intuitive and easy to maintain, continue
   development on, and extend"), in plain words; plan v2 header.
2. "This site holds the engine's requirements for you to confirm (...),
   the design decisions ahead and the few already made, today's engine as
   evidence, and everything decided, by title." Plan v2, "What the site
   must do now", items (1) to (4), in order.
3. "You are at the design half's first step, the requirements; the panel
   and the design rounds design against what you confirm here." CS
   section 0 ("Now: the requirements"); DR "Design top-down,
   hardest-to-reverse choices first" ("First finish the requirements");
   DR "What the architects' panel sees, and when" ("The panel runs after
   the owner confirms the requirements"); plan v2 "What the site must do
   now" (1) ("the panel and the design rounds design against them").

## timeline

### done

1. "Coherent on main: the unlock block's merge train walked, the engine
   green on its full test suites, and the deployment guide repaired." RM
   section 3, "Coherent on main" ("Reached 2026-09-12 ... the train was
   walked and `main` passed its full suites"); RM section 4, the unlock
   block (the deployment-docs repair); RM Appendix C ("Closed by R24
   (2026-09-13)"); CS section 5 ("Block 1, unlock: done except green's
   home hardware pass"). The block is named, not numbered (DR "Name each
   step by what it does").
2. "The hardening block's merged pieces: the equipment families, the
   dormancy core and the test-harness minimum; its other pieces wait for
   the build half." CS section 5 ("Block 2, hardening: done and merged:
   the equipment families, the dormancy core, the test-harness minimum
   ... To be rebuilt inside the pass's phase 2"); DR "Corrections to the
   readers and the hardening pieces"; "build half" for "phase 2" per DR
   "Name each step by what it does".
3. "The architecture pass defined and its program ratified at the
   definition session; the truth sweep's charter retired." DR "The owner
   ratified the program document" (2026-10-30); DR "The truth sweep's
   charter is retired".
4. "The review of today's engine: sixteen design flaws, now test
   situations for every design." CS section 0 ("Done so far ... sixteen
   design flaws over 358 findings, 21 set aside ... now evidence and test
   situations"); DR "Blue's fixes are evidence of design causes" ("The
   sixteen design flaws ... are now test cases"); "the review of today's
   engine" is JT row 26's wording for the cause analysis, widened by the
   plan's name for the page (Today's engine).
5. "The owner's site, version 8, and the decision record kept by topic."
   CS section 0 ("The owner site, version 8. The decision record by
   topic."); DR "Titles, not numbers, and a topic record".

### now

The seven steps and their order: DR "The design half's method and tools"
("the requirements ...; the independent panel; the design rounds ...;
the build plan; the hostile review ...; the final questions; the owner's
sign-off") and DR "Name each step by what it does". The requirements
carry `current: true` (plan v2 section 3.1 item 2; CS section 0, "Now:
the requirements").

1. The requirements: DR "Design top-down, hardest-to-reverse choices
   first" ("the owner's answers, plus quality targets written as
   testable situations and the ways the platform must be extended, and
   by whom"); the standing rules from plan v2 section 3.3 item 5.
2. The panel: DR "What the architects' panel sees, and when" ("Three
   architects with different lenses propose blind ... The panel runs
   after the owner confirms the requirements, and its brief goes to the
   owner first").
3. The design rounds: DR "Design top-down, hardest-to-reverse choices
   first" ("design rounds ordered by the hardest decisions to reverse ...
   Each round has two or three designs side by side").
4. The build plan: same decision ("a build plan that starts with a thin
   first version").
5. to 7. The hostile review, the final questions, the owner's sign-off:
   DR "The design half's method and tools"; the sign-off ending the
   design half with the new roadmap: DR "One program: design half, then
   build half" ("ends with the new roadmap") and DR "Run the pass like
   the re-charter" ("Its new roadmap becomes the roadmap's next
   revision").

### next

1. "The build half: ... starting with a thin first version running end
   to end on a new test bench, where the test rig is built again. It
   takes the hardening block's remaining pieces, the truth sweep's
   purpose and the show-ready gate's second condition." DR "One program:
   design half, then build half" ("changes the engine to follow the
   design, one area at a time ... It takes the show-ready gate's second
   condition. The remaining hardening pieces and the truth sweep's
   purpose are rebuilt inside it ... starts with a thin first version of
   the new design running end to end on a new test bench"); DR "Build
   the test rig when building starts".
2. "Hardware-proven: green's home hardware pass, owner time, any time."
   RM section 3, "Hardware-proven"; CS section 5 ("done except green's
   home hardware pass") and section 6 ("Owner, any time: green's home
   hardware pass").
3. "Show-ready, then the swap to green: one full venue rehearsal and
   your review of the visible changes; the game runs on blue until
   then." RM section 3, "Show-ready", gate conditions (3) and (4); RM
   section 6 (the swap); CS section 1 ("The game keeps running on blue
   ... until the new engine is ready to swap in on green"); JT row 17
   ("swapping in the new machine" for cutover).
4. "The capture block, the preview block (which reaches previewable) and
   the depth-and-close block, in the order the new roadmap sets." RM
   section 4 (the capture block, the preview block "→ previewable", the
   depth-and-close block); RM section 10.1 (the order "Blocks 4/5 ordered
   once the capture block is priced"); DR "One program: design half, then
   build half" ("before the capture block, the preview block and
   players' phones") and DR "Five documents the design half hands over"
   ("the new roadmap, with ... the later blocks after the build half").
5. "The later blocks: players' phones, the second game's modules,
   content tooling, the operations era and the release block, which
   reaches adoptable." RM section 7 (7.1 to 7.4); RM section 3,
   "Adoptable" ("the release block (§7.4) charters them"); block names per
   DR "Name each step by what it does".

## now

1. "You can confirm the requirements now on Decisions: the quality
   targets, with every number left for you to set listed in one place;
   the extension cases; the promises and their wording questions; then
   the standalone questions and the game's record." Plan v2 section 3.2
   item 2 (the groups of "Open now", in that order; "every number left
   for the owner to set listed in one place"); CS section 0 ("Now: the
   requirements. The owner confirms them on the owner site's Decisions
   page").
2. "Answer in the chat by a question's letter or its title; each
   question stands alone." Plan v2 section 3.2 item 1 (`decisions.intro`:
   "answer in the chat by letter or title; each question stands alone").

## moments

Carried from v8 `moments` (six columns, twenty promise lines), whose
sources are v8's log (`site/front-log.md`, "moments"): every column's
people and promises come from EJ `jobs[].functional.people` and `.moment`
and every "why" from that promise's `functional.need`. Re-checked
2026-11-01 against EJ: every promise appears (ten ids over twenty
entries), and every person named in any promise's `functional.people`
appears in a column's people list. JT's front.json rows were applied:

- Release day, the proven-change promise's why: "the machine carries one
  matching set" became "the machine carries one set of matching versions
  (engine, apps, pack, media and profile)" (JT row I9; JT wording 62).
- No other row of JT's front.json section touches `moments`. The During
  play line for the roles promise keeps "The GM alone can start, pause,
  end and change scores": it is the promise's own need in EJ, and JT
  wording 52 ("staff who log in, such as the GM") targets other files
  (A27, P73, F75), not the promise text.

## standaloneLine

1. "The decision Standalone games: declared, never mixed adds a
   requirement every design choice must serve: ..." v8 `standaloneLine`,
   with "Decision 22" replaced by the `[[dec:]]` marker (plan v2 section
   2, titles not numbers; DR "Standalone games: declared, never mixed")
   and "every rule must serve" replaced by "every design choice must
   serve" (JT row I10; JT wording 25). The requirement's words: DR
   "Standalone games: declared, never mixed".
2. "Each promise and each design flaw says what changes with no engine;
   what each flaw does in a standalone game, with the table comparing the
   hardware scanner with the phone's scanner, is on Today's engine." v8
   `standaloneLine`, second sentence, with JT row I10's wording for the
   standalone pass and the parity table (JT wordings 27 and 28), and the
   page marker changed from the retired Design flaws page to
   `[[page:today]]` (plan v2 section 3.5 item 4: "Standalone today:
   version 8's standalone section and the hardware-scanner table").

## qualities

Twelve lines, one per distinct `quality` value in QT (checked by script:
the set of my `quality` values equals the set in QT). Each line condenses
that quality's targets' `situation` fields into what they ask, in plain
words; no number is stated where QT leaves it to the owner (`numberToSet`),
so each such place says "a set time", "set limits" or "as long as you
set".

1. Staying up through a live show: QT1 (power cut; the same game; no
   scan lost or counted twice; every tablet reconnects by itself under
   its own station name), QT2 (the music player stops dead; cues that
   depend on music are held and shown as held), QT3 (a tablet's wifi
   drops), QT4 (a batch sent twice appears exactly once).
2. Every screen telling the truth: QT5 ("No screen anywhere shows a calm,
   current-looking value for a fact it cannot confirm"; offline within
   one polling interval, the number to set), QT6 (grey for not installed
   tonight; "Red appears only when something that should work does
   not"), QT8 (every line says paper or live), QT7 ("The tablet shows no
   verdict of its own before the engine's arrives").
3. The designer's iteration speed: QT9 (within a set time, no restart;
   the minutes are the number to set), QT10 (refused at the desk, naming
   what is at fault), QT11 (a separate trial copy beside the show, the
   show untouched), QT12 (the whole game in the design tool, no code or
   configuration file).
4. Operating it without technical help: QT13 (from the guide alone, one
   go or no-go, no terminal), QT14 (powers on straight into a running
   show), QT15 (a red row that names the speaker and carries its
   actions), QT16 (the engine writes the record by itself; every time
   from one clock).
5. Easy to understand and change, for people and for AI agents: QT17
   (exactly one place where a fact is decided), QT18 (written once in
   the published protocol), QT19 (the newcomer, a person or an AI agent,
   finds the glossary, the promises and the protocol in one sitting and
   proves a small change within a set time), QT20 (none of ALN's words
   outside ALN's pack and profile).
6. Easy to extend: QT21 (a second game with a new scoring model, hidden
   facts and multi-tap actions; an additive change), QT22 (a new kind of
   device), QT23 (a swapped lighting system or video player changes
   nothing outside the code that talks to that program), QT24 (a second
   production's kit; "Nothing in the engine assumes one kit").
7. Testable without the live show: QT25 (a whole game end to end on a
   laptop with stand-ins; the same at every test level), QT26 (twice,
   once per pack; a skipped test never counts as a pass; every stand-in
   compared with the real thing), QT27 (the test set on the show machine
   leaves the show's programs running).
8. Privacy and access: QT29 (no account; nobody named unless the game
   designs an identification moment), QT30 (on the kit and nowhere else;
   retention the owner's setting per game), QT31 (a stranger gets
   nothing; only staff who log in can start, pause, end or reset), QT32
   ("The engine filters before it sends").
9. Running well on the show machine and the venue network at the size
   of a show: QT33 (tonight's kit; a full two-hour game with headroom;
   set times and limits), QT34 (the kit's capacity for phones measured
   before the first phone is admitted), QT35 (a pack stays small and
   names media by fingerprint), QT36 (no internet).
10. Standalone and offline: QT37 ("standalone", not "offline"; the
    tablet decides under the same rules, a test proves the two equal),
    QT38 (the mix refused), QT39 (the record carries the pack and
    version), QT40 (kept scans sent once).
11. Safe release and rollback: QT41 (one written list; a check names any
    piece that differs), QT42 (nothing reaches the machine until the
    owner says the new engine is ready; plugging the old machine back
    in).
12. More than one copy, kit or pack without rework: QT43 (two copies on
    one machine, each with its own files, ports and settings, neither
    stopping the other's programs or accepting its passes; a library of
    installed packs; a second kit needs a profile and nothing else).

## growth

The kinds group EX's `who` values: designer (EX1, 2, 3, 5, 6, 7, 8, 11,
12, 14, 22; and the designer's half of EX4, 9, 10, 18, 20); developer
(EX4, 9, 10, 15, 18, 20); developer from outside the team (EX21, kept as
its own kind because the case rests on what an outsider may not see);
venue technician (EX13; the technician's half of EX15); operator (EX16,
17, 23, 24: "operator", "operator (the owner)", "owner, or a future
operator"); director (EX19). The GM of EX12 ("designer declares it; the
GM runs it") is covered by the designer's line, which names the
declaration. Every case has one `[[ex:]]` marker across the six lines
(checked by script: 24 of 24).

1. Designers: EX1 `throughWhat` ("A pack, written in the design tool and
   published through the engine's own check") and `mustNotNeed` ("The
   engine's code, its settings files, new firmware"); the list of cases
   is each case's first sentence in a few words (EX1, 2, 3, 5, 6, 7, 8,
   22, 11, 12, 14).
2. Developers: EX4 ("A developer adds it once as a generic model"), EX10
   ("A developer builds each device kind's support once, as platform
   work, never per game"), EX9 (`throughWhat`: "added once at the place a
   new kind of screen plugs in"), EX15, EX18, EX20; "other games run as
   before": QT21 ("ALN's pack and the toy game's pack run as before") and
   EX15 `mustNotNeed`.
3. Developers from outside the team: EX21 `case` ("They work from the
   published protocol and the toy game as a worked example, and send
   their change back with the developer's tests, which show that the
   show still runs for both games. They never see our secrets, our pack
   or our venue") and `throughWhat` (the guides).
4. Venue technicians: EX13 `case` ("fills in a profile of what the room
   has tonight ..., binds each of the pack's names to a real instrument
   on one page, and runs one preflight that says go or no-go. ...
   Equipment left at home shows as not installed tonight") and
   `throughWhat` ("A venue profile").
5. Operators: EX16 `throughWhat` ("Their own venue profiles and installed
   packs; the engine's per-kit settings"), EX17, EX23, EX24 cases.
6. Directors: EX19 `who` ("director; the game's own developer builds the
   telling"), `throughWhat` ("The night's record, a published file format
   read from outside the engine") and `case` ("What reaches the players
   afterwards ... stay the game's business outside the engine").

## worldMermaid

Twenty-two nodes (checked by script), two subgraphs. The people and
their devices: EJ `purpose` (the designer in the design tool; the venue
technician's profile; the GM's four sections; the player tapping on a
phone or a shared station) and DR "The role question starts from settled
roles" (GM scanner, player scanners web and ESP32, scoreboards); the
director and the console: DR "The night's record and the after-game
article"; the developer and the test bench: DR "One published protocol
and an outside test bench". The outside programs: v8 `around` (video and
the TV, music, audio and Bluetooth, lighting), kept at the family level
with no program names, as the task lists them. The files: DR "One
published protocol and an outside test bench" ("the pack, the venue
profile, the night's record, the media list"), the media bundle from RM
section 2.3. The protocol as the line: the same decision ("defines
everything that crosses the engine's edge"), drawn as the subgraph around
the engine, styled with the owner teal `#0f766e`, which `diagram_theme.py`
maps to `--accent` (plan v1 section 5.1); no other colour literal is
used. Edges: the designer's tool publishes the pack (EX1, EX2) and
uploads media (EX5); pack and media list to the engine (QT35; EX5); the
profile to the engine (EX13); tablets and scanners both ways (EJ J3 need:
a tap and its answer); engine to TV, read by the audience (DR "The role
question starts from settled roles": "The scoreboards show the public
results: team scores and exposed evidence"); engine writes the record at
the end, read by the console, used by the director (QT16; EX19); the
developer's tests against the engine from outside (QT27; DR "One
published protocol and an outside test bench"); the engine drives and
asks its programs (QT2: the program watcher; DR "The nine questions the
pass answers": "how does the engine read the programs it drives?"). The
picture names no part inside the engine (plan v2 section 3.1 item 8: "It
shows what is required, not a design").

## worldKey

1. "Everything outside the engine reaches it across one line, the
   published protocol: what a device may ask, what the engine answers,
   what it tells screens, and the files that carry a game or a night (the
   pack, the venue profile, the night's record, the media list)." DR "One
   published protocol and an outside test bench", first sentence.
2. "No person touches the engine directly: the designer through the
   pack, the venue technician through the profile, the GM and the players
   through their devices, the audience through the TV, the director
   through the night's record, the developer through the test bench; the
   outside programs ... sit outside too, driven and asked by the engine."
   Reads the picture's edges; each clause's source is the edge's source
   above (EX1, EX13, EJ purpose and J3, DR "The role question starts from
   settled roles", EX19, QT27, QT2).
3. "The picture shows what is required at the engine's edge, not how the
   engine is built inside." Plan v2 section 3.1 item 8.

## decidedLately

The five latest decisions in DR's number-to-title table (32 to 36, all
made 2026-11-01), newest first by that order. Each line condenses the
decision's standing text in DR:

1. Titles, not numbers, and a topic record: DR, that entry ("go by short
   plain titles in conversation and on the owner's pages. Ids stay only
   inside records ... reorganized by topic: what stands now, each written
   as current truth with a dated history beneath").
2. What the architects' panel sees, and when: DR, that entry (the first
   package; "Only after its first proposals does it get today's engine as
   facts and the sixteen design flaws as test situations"; the candidate
   shape "enters in a second round as one more proposal"; "runs after the
   owner confirms the requirements, and its brief goes to the owner
   first"). "The earlier candidate" is plan v2's name for the candidate
   shape (section 3.4 item 5).
3. Name each step by what it does: DR, that entry, each clause in order;
   the record's closing clause ("No page uses a bare phase, step, block
   or round number") is given as "no page uses a bare step, block or
   round number" so the line itself carries no phase word (plan v2
   section 5's check).
4. One published protocol and an outside test bench: DR, that entry
   ("One published, versioned protocol defines everything that crosses
   the engine's edge ... Every program's code is generated from it or
   checked against it ... The tests become a test bench outside the
   engine. 'Proof' stays a quality every part must meet. Together these
   two replace the candidate shape's part called 'Joins and proofs'").
5. Independent architects propose the top-level design: DR, that entry
   ("An independent panel of architects, who have not seen the
   orchestrator's reasoning, proposes and stress-tests the top-level
   design decisions before the first design round ... its brief comes to
   the owner before the panel runs").

## siteGuide

One line per page, each condensing plan v2 section 1's "Job" column for
that page, with the Decisions line also taking section 3.2's groups
(what you answer now, by title with a letter; the design rounds; decided
by topic) and the Design line taking section 3.4 item 5's label for the
earlier candidate.

## words

Version 8's words carried with JT's wordings, the words-box additions,
new entries the page needs, and the sequencing names as group
`sequence`. Groups: 29 `page`, 13 `sequence`, 7 `design`.

- Promise: v8, plus "The ten promises are the first of the requirements"
  (plan v2, "What the site must do now" (1)).
- Moment: v8, unchanged (CX section 7, "Moment").
- Quality: v8, plus the last sentence (QT `intro`: "A quality is
  something every part of the engine must have so that a promise holds
  everywhere"; twelve distinct qualities in QT).
- Quality target (new): QT `intro` ("Each target below tells a situation
  ... what happens, then what must be true. The targets say what is
  needed, never how to build it; where a number would make a target
  testable and no source gives one, the owner sets it").
- Extension case (new): EX `intro` ("each told as a situation, with the
  person who does the growing, what they should need to touch, and what
  must stay untouched").
- The standing rules (new): RM section 2 (2.1 rules 1 and 3; 2.3; 2.5;
  2.6; 2.2); plan v2 section 3.3 item 5 names them as the Requirements
  page's last section.
- Design flaw: v8 first sentence (CX section 7); the second sentence from
  plan v2 section 6 ("today's engine is evidence and test situations,
  never the reason for a design").
- The published protocol (new): DR "One published protocol and an
  outside test bench", sentences 1, 2 and 4.
- The pack (new): EX1 `case` and `throughWhat` ("its tokens and their
  texts, its modes, scoring, groups, cues, clock, words and look"; "a
  pack, written in the design tool and published through the engine's
  own check that refuses a broken pack"); RM section 2.3 ("Media files
  never live in git packs ... The pack names its media files, with
  hashes"); "fingerprint" is JT wording 64's word for hash.
- The venue profile (new): EX13 `case` ("a profile of what the room has
  tonight (which speakers, which lights, which network, how many stations
  and how many extra scoreboard screens), binds each of the pack's names
  to a real instrument ... A second venue is a second profile; the pack
  is the same").
- The night's record (new): QT16 `situation` and DR "The night's record
  and the after-game article" ("carries the pack the game ran and the
  texts the players saw"); "The director tells the night from it": EJ J3
  need.
- Media list and media bundle (new): RM section 2.3 ("A managed media
  bundle carries the actual files ... checked against the pack's list and
  moved between orchestrator machines"); QT35 ("a missing or changed file
  is named before the show").
- The earlier candidate (new): plan v2 section 3.4 item 5 ("An earlier
  candidate, drawn bottom-up from today's engine. The panel compares it
  with its own proposals in its second round") and section 6 ("one input
  among the panel's"); DR "What the architects' panel sees, and when".
- Part: JT W-revise 3 ("One of the 17 pieces of the candidate shape"),
  with "the earlier candidate" as the name plan v2 gives the shape.
- Architecture pass questions: JT W-revise 1 (the nine by name), with
  its sentence "Each will be answered by one design choice for the whole
  engine, in the design rounds" replaced by DR "The nine questions the
  pass answers" ("Since the design half was reordered top-down, the
  design rounds go by the hardest decisions to reverse, not one rule per
  question ... the reading here, that they serve as checks on each
  design, is to be confirmed with the owner"), because the record marks
  the one-rule-per-question reading as overtaken, to be confirmed.
- Venue technician (new): DR "Promises, qualities, moments, venue
  technician" ("The person who fits a kit to a venue is the venue
  technician"); EX13 `case` (the profile, the bindings, the preflight).
- Director: v8 (CX section 5b, "Director", in plain words), unchanged.
- Paper or live, A device's pass: v8, unchanged.
- Door: v8, with the two doors now "The earlier candidate had two"
  (plan v2 section 3.4 item 5) and the clause "the published protocol now
  defines what crosses the engine's edge" (DR "One published protocol
  and an outside test bench"); "dormant" replaced by "not installed
  tonight" in the clause's first use (JT wording 45), the code's word
  kept in the Not installed tonight entry.
- Not installed tonight: v8, unchanged.
- Health words: JT W8. Label: JT W7. Pi 4: JT W9. The toy game: JT W5,
  with "for good" from QT26 ("The toy game stays in the repository for
  good"). Planned capability: JT W6.
- Blue, green: JT W4, with "The cutover swaps them" rewritten as
  "Swapping in green is done by replugging" (JT wording 17: a bare
  "cutover" becomes "swapping in the new machine"), "the game runs on it
  until the new engine is ready" from CS section 1, and C16's title given
  by the `[[flaw:C16]]` marker (titles, not numbers).
- The test bench (new): DR "One published protocol and an outside test
  bench" ("The tests become a test bench outside the engine"); DR "One
  program: design half, then build half" ("a thin first version of the
  new design running end to end on a new test bench"); QT25 ("The same
  engine, the same pack and the same checks run at every test level").
- The test rig: JT W2, with its last sentence ("rebuilding it is the next
  step") replaced by DR "Build the test rig when building starts" ("It is
  built at the start of building, as part of the new test bench ... not
  to reproduce today's problems first"), because that decision withdrew
  the rig as the next step.
- The architecture pass (sequence): DR "The architecture pass is the
  work now" ("Blue keeps running the game until the new engine is ready
  to swap in on green, and no date governs the work"); DR "Design for the
  long term, beyond ALN".
- The design half, the build half (sequence): JT W1's shape, renamed per
  DR "Name each step by what it does"; the content from DR "One program:
  design half, then build half".
- The requirements, The panel, The design rounds, The build plan, The
  hostile review, The final questions, The owner's sign-off (sequence):
  DR "The design half's method and tools" (each step's description),
  DR "Design top-down, hardest-to-reverse choices first" (the
  requirements' three parts; the rounds' order and checks; the thin first
  version), DR "What the architects' panel sees, and when" (the panel),
  DR "Decide in question rounds, never at sign-off" ("The owner's
  sign-off is a skim with no new decisions"; "Anything new found while
  writing comes back to the owner as a question first"), DR "Run the pass
  like the re-charter" (the new roadmap as the next revision). "Each
  round comes to you as its own page": DR "The design half's method and
  tools" ("published as pages for the owner").
- Question rounds (sequence): DR "Name each step by what it does"
  ("Question rounds go by date"); the three dated rounds named in DR's
  histories ("the definition session" of 2026-10-30; "the question round
  of 2026-10-30 to 2026-11-01"; the after-game survey "Asked on
  2026-11-01").
- The blocks (sequence): DR "Name each step by what it does" (the six
  block names); RM section 7 (the later blocks); the truth sweep's
  charter retired: DR "The truth sweep's charter is retired".
- The readiness states (sequence): RM section 3 (the five states;
  "Deployment and sharing decisions are made AT states"; Coherent on main
  "Reached 2026-09-12").
- Test levels (sequence): DR "Name each step by what it does" ("Test
  levels go by name: logic only; real programs with stand-in hardware;
  the home test bed; the venue"); QT25.
- Module: JT W-revise 2. Interface, Seam, Deep, shallow, Locality,
  Leverage, Adapter: v8, unchanged.

## intros.requirements

- Paragraph 1: plan v2, "What the site must do now" (1) (the four kinds
  of requirement; "the panel and the design rounds design against
  them"); QT `intro` ("The targets say what is needed, never how to build
  it"); DR "Promises, qualities, moments, venue technician" (the
  definition of a promise); the standing rules: plan v2 section 3.3 item
  5.
- Paragraph 2: the promise entry's fields in plan v2 section 3.3 item 2
  ("as in version 8, with 'Broken by' renamed 'Where today's engine falls
  short', each link going to its situation on Today's engine; the planned
  capabilities by name; the test cases called 'test situations'"; the
  glance table's "quality targets and extension cases that serve it"),
  with v8 `intros.promises[1]`'s field order ("Who and when ... What they
  count on ... Built today ... The long-term goal ... a goal marked open
  is left to the design rounds" per JT row P2); the quality target's
  fields: plan v2 section 3.3 item 3; the extension case's fields: plan
  v2 section 3.3 item 4.
- Paragraph 3: QT and EX `status` fields ("settled by the owner (...)" or
  "proposed"); EX `intro` ("every case not marked proposed rests on a
  decision the owner has already made or a roadmap section the owner
  ratified"); plan v2 section 3.2 item 2 ("every number left for the owner
  to set listed in one place").

## intros.design

- Paragraph 1: plan v2 section 3.4 item 1 (the order; "designs go
  top-down from the requirements; today's design flaws are test
  situations, not inputs"); DR "Design top-down, hardest-to-reverse
  choices first", by marker.
- Paragraph 2: plan v2 section 3.4 item 2 (the six decisions in order;
  "what it decides, the requirements that drive it, what is already
  settled around it, and what the panel and the design round will bring.
  No options are proposed here; the panel proposes them"); DR "Design
  top-down, hardest-to-reverse choices first" ("Each round has two or
  three designs side by side").
- Paragraph 3: plan v2 section 3.4 items 3 to 5 (the decided directions,
  each by its decision's marker; "Later choices"; the earlier candidate
  folded, "The panel compares it with its own proposals in its second
  round"). The test bench and the test rig are two of the three decided
  directions plan v2 lists under one entry each; the after-game boundary
  is DR "The night's record and the after-game article".

## intros.today

- Paragraph 1: plan v2 section 3.5 items 1 to 3 ("this page is evidence;
  every design is checked against it"; "What works today ... the pieces
  already well built"; "Sixteen situations any new design must handle";
  the glance table's "seen live or reproduced in a test").
- Paragraph 2: plan v2 section 3.5 item 1 ("nothing here drives the
  design"); DR "Blue's fixes are evidence of design causes" ("clues to
  where today's design is off, never the driver"), by marker; DR "What
  the architects' panel sees, and when" ("Only after its first proposals
  does it get today's engine as facts"); plan v2 section 3.5 item 3 (each
  card's second diagram "folded and labelled 'How the earlier candidate
  would remove it'") and section 6 ("the earlier candidate is one input
  among the panel's").
- Paragraph 3: plan v2 section 3.5 items 4 and 5 (standalone today with
  the hardware-scanner table; the evidence: totals, set-aside table and
  code grid), with JT wording 28 for the table.

## Checks run on the file

- Valid JSON (`python3 -I` `json.load`).
- 39 markers: 24 `[[ex:]]` (every extension case once), 6 `[[page:]]`
  (`decisions`, `today` only; no retired page name), 6 `[[dec:]]` (each
  slug matches a title in DR under the slug rule), 2 `[[part:]]`, 1
  `[[flaw:]]`; no `[[q:]]` (the front page names no question).
- Every promise placed in `moments` (ten ids over twenty entries); every
  person in every promise's `functional.people` appears in a column's
  people list (unchanged from version 8, re-read against EJ).
- Twelve `qualities` entries; their `quality` values equal the set of
  distinct qualities in QT.
- `worldMermaid`: 22 nodes (at most 24 allowed); one colour literal,
  `#0f766e`, mapped by the diagram theme.
- In visible text (markers and `moments[].promises[].id` stripped): no
  promise, flaw, finding, quality-target or extension-case id; no em or
  en dash; no "installer", "job", "phase", bare "step N", "Block N",
  "round N", "decision N" or "question N"; no "rule" as a design word;
  no "planning half" or "building half".
- Word counts (markers counted at roughly their rendered length): lead
  102; timeline 305; now 55; moments 840; standaloneLine 76; qualities
  637; growth about 340; worldKey 123; decidedLately 222; siteGuide 106;
  words 1,673; intros 687 (rendered on three other pages). The front
  page's prose without the two table-like blocks (moments, words) is
  about 1,970 words, under plan v2 section 3.1's 2,500.

## Readings a checker should look at

1. The `[[dec:]]` slug rule, applied literally to apostrophes
   (`the-night-s-record-...`, `blue-s-fixes-...`,
   `what-the-architects-panel-...`). If the builder's slug function drops
   apostrophes instead (as plan v1's part anchors did), these three
   markers need the hyphen after `night`, `blue` removed and nothing else
   changes.
2. `decidedLately` takes "latest" as the five highest numbers in DR's
   number-to-title table, all dated 2026-11-01; the record gives no finer
   order within that day.
3. `timeline.next` lists hardware-proven as a readiness state still to
   reach, from CS section 5, beside the build half; the roadmap's
   show-ready gate needs it, so it is shown, although it is owner
   hardware time and not a step of the pass.
4. The "Architecture pass questions" entry states DR's "to be confirmed"
   reading (the nine as checks on each design) as such, not as decided.

## The check of 2026-11-01 applied (`checks/v9-check-front.md`)

Applied 2026-11-01. The check found 18 conflicts over 129 items. Each
row was read against the source it names before anything changed; every
row held, so all 18 are applied and none is rejected. Where the applied
wording departs from the check's suggested wording, the row says why.
The sections above describe the file as first written; where a row
below changes a sentence, the row supersedes that section's description
of it. The JSON keeps its layout (one item per line in `timeline`, two
space indent, the same line count); 39 markers as before.

| # | Where | Applied wording | Source (verified) |
|---|---|---|---|
| 1 | `lead`, last sentence | "You are at the requirements, the design half's step now; the panel and the design rounds design against what you confirm here." | DR "The design half's method and tools" puts the cause analysis (done) first in the design half's order and the requirements after it, so "first step" was wrong under that decision; DR "Name each step by what it does" lists the requirements first among the seven named steps, so "step now" is the wording true under both. CS section 0: "the requirements (now)". |
| 2 | `timeline.done[0]` | "Coherent on main: the merge train walked and every group of tests passing on main. The unlock block also repaired the deployment guide, which hardware-proven needs." | RM section 3, "Coherent on main": "Reached 2026-09-12 ... the train was walked and `main` passed its full suites"; RM Appendix C heading "(gates hardware-proven)" and "Closed by R24 (2026-09-13)"; RM section 4, the unlock block, lists the deployment-docs repair as its first unit. The guide repair is no longer written as part of coherent on main. |
| 3 | `timeline.done[0]` | "every group of tests passing" in place of "green on its full test suites" (in the same sentence as row 2) | JT wording 54: suite becomes "group of tests". JT words box W4: green as a passing run is unrelated to green the machine, which `timeline.next` names twice, so "green" is no longer used for a passing run anywhere on the page except inside the words-box entry that explains the collision. |
| 4 | `timeline.done[3]` | "The review that named the design flaws: sixteen design flaws, now test situations for every design." | JT wording 26: the cause analysis reads "the review that named the design flaws" site-wide. The item is the cause analysis (the review that produced the sixteen flaws), so the wording applies. |
| 5 | `timeline.next[2]` | "Show-ready, then the swap to green when you say the new engine is ready: one full venue rehearsal and your review of the visible changes; the game runs on blue until then." | RM section 3, "Show-ready": "the decision itself remains the owner's at this state"; QT42 situation: "Nothing reaches the show machine until the owner says the new engine is ready". |
| 6 | `qualities[0]` | "every tablet back by itself under its own station name" | QT1 situation: "Every tablet reconnects by itself under its own station name"; QT3 situation: "back under its own station name within five seconds". Read QT1 to QT4 (the whole quality): no target says every device reconnects under its own name; QT4 (the hardware scanner's batch) is about counting once, not reconnecting by name. |
| 7 | `qualities[5]` | "A second game with new scoring, hidden facts and multi-tap actions runs on the pack, and a capability the engine lacks is added without touching the games already running; a new kind of device joins by its pass; a swapped lighting system or video player changes only the code that talks to it and the venue profile; and a second production's kit needs a new profile and no change to engine code." | QT21: "The game runs on the engine unchanged wherever the pack can declare what it needs ... Adding that capability is an additive change: ALN's pack and the toy game's pack run as before"; QT22 title "A new device kind joins by its pass"; QT23: "changes nothing outside the code that talks to that program and the venue profile"; QT24: "a new profile and the same engine code". Each case now gets its own cost; "an addition in one place" is gone. |
| 8 | `qualities[7]` | "Players have no account, and the engine records a device or session id and nothing about the person unless the game designs an identification moment;" | QT29 situation: "The engine records a device or session id and nothing about the person. Nobody is named unless the game's design made an identification moment"; RM section 2.1 rule 2: "The engine's only built-in identity is the device or session id". |
| 9 | `growth[0]` | "through the pack and its media bundle, written in the design tool ..." (in place of "through the pack alone"); "a game declared standalone ([[ex:EX12]]; where the declaration lives, with the pack, the venue profile or the game's record, is your choice)"; "a rehearsal on a trial copy of the engine, with a profile generated from the pack and bound to stand-ins ([[ex:EX14]])" | EX1 and EX5 `throughWhat`: the pack and "a media bundle for the files the pack names"; EX12 `throughWhat`: "A declaration carried with the pack, the venue profile or the game's record (the owner chooses where)"; EX14 `throughWhat`: "A venue profile whose bindings point at software stand-ins, generated from the pack; a separate trial copy of the engine". The closing sentence ("They never touch engine code, settings files or firmware") stands: the designer uses the trial copy, not its settings. |
| 10 | `worldMermaid`, `worldKey` | The picture is redrawn in four groups, left to right: "Outside the engine: the people, their devices and tools"; "The published protocol: every message and file that crosses the engine's edge", holding a messages node (what a device may ask, what the engine answers, what it tells screens) and the four protocol files (the pack, the media list and bundle, the venue profile, the night's record); the engine; "Outside programs, each reached through support written for it inside the engine" (video, music, audio and Bluetooth, lighting). Tablets, scanners and the TV connect to the messages node; the files connect to the engine; the programs connect to the engine on its other side and touch no part of the protocol group. The key's first two sentences say the same (see the wording under row 13). | DR "One published protocol and an outside test bench": the protocol defines "what a device may ask, what the engine answers, what it tells screens, and the files that carry a game or a night (the pack, the venue profile, the night's record, the media list)", and nothing about the outside programs; EX15 `throughWhat`: "Support for the program, added once inside the engine"; QT23: a swapped program "changes nothing outside the code that talks to that program and the venue profile"; EX21 `throughWhat` lists the protocol and, separately, "the places a developer adds a device, a program ...". Reading against plan v2 section 3.1 item 8 ("the published protocol drawn as the line between the engine's inside and everything outside"): the protocol stays the line everything from the outside crosses, drawn as the group every message and file passes through on its way to the engine; a closed box around the engine cannot be crossed on one side only, which is why the subgraph around the engine was replaced. The outside programs are drawn around the engine, as the plan asks, but on its other side, as the record's definition requires. The picture still names no part inside the engine. |
| 11 | `worldMermaid`, people; `worldKey` | Node "Operator", edge to the engine labelled "picks the installed pack, swaps machines"; key: "the operator, you or a future one, by picking the installed pack and swapping machines between events". The operator's edge goes to the engine, not through the protocol group: picking a pack and swapping a machine act on the machine, not by message. | EX16, EX17, EX23, EX24 `who`: operator (the owner, or a future one); EX23 `throughWhat`: "An installed pack picked by name: at startup by path or id today; a selection page later"; EX17 `throughWhat`: "the swap of machines"; QT41 (the machine's one written list); QT43 ("the operator picks one per event"); QT42 ("the engine changes only between events"). `growth[4]` on the same page names operators. |
| 12 | `worldMermaid`, programs; `worldKey` | Node "Content source (Notion today)", edge "feeds" to the design tool; key: "fed by the content source (Notion today; another tool later through one adapter)". | EX18 `throughWhat`: "A source adapter behind a published interface for content sources; the pack it produces is the ordinary pack"; QT23: "the designer replaces Notion with another authoring tool, which produces the same pack through the same check"; v8 `aroundMermaid` drew Notion and the sync script. |
| 13 | `worldKey` | "Every message and every file that reaches the engine from a device, a tool or a screen crosses one line, the published protocol: [the four kinds, as before]. The engine's outside programs (video, music, audio and Bluetooth, lighting) sit on its other side: the engine reaches each through support written for it inside the engine, and a swapped program changes that support and the venue profile, nothing else. At a show, no person touches the running engine directly: the designer through the pack, fed by the content source (Notion today; another tool later through one adapter); the venue technician through the profile; the operator, you or a future one, by picking the installed pack and swapping machines between events; the GM and the players through their devices; the audience through the TV; the director through the night's record. The developer changes the engine's code and proves it from the test bench outside. The picture shows what is required at the engine's edge, not how the engine is built inside." The picture gains a dotted edge from the developer to the engine, "changes the code", beside the test bench's "tests" edge. | Sentence 1: DR "One published protocol and an outside test bench", first sentence. Sentence 2: EX15 ("added once inside the engine"), QT23 (the code that talks to the program and the venue profile). Sentence 3: the picture's edges (EX1, EX18, EX13, EX17 and EX23, EJ `purpose` and J3, DR "The role question starts from settled roles", EX19). Sentence 4: DR "One published protocol and an outside test bench" ("The tests become a test bench outside the engine"); EX4, EX10, EX15 (code added inside the engine); `growth[1]`. The check's suggestion "swap changes in one place" was not used: QT23 names two places, the code that talks to the program and the venue profile, so the key names both. |
| 14 | `decidedLately[2]` | "no page uses a bare phase, step, block or round number." | DR "Name each step by what it does", last sentence, word for word; plan v2 section 2: "No bare phase, step, block, round, decision or question number". The word "phase" now appears once on the page, inside the decision's own sentence, as a kind of number no page may use bare; the "Checks run on the file" section above, which reports no "phase" in visible text, is superseded on that one word. |
| 15 | `words[2]` (Quality) | "like every screen telling the truth, or testable without the live show" in place of "like honest or proven" | The twelve `quality` values in QT include "Every screen telling the truth" and "Testable without the live show"; "Honesty" and "Proof" are the earlier candidate's qualities (engine-shape `qualities`), not among the twelve the page shows. CX "Quality" gives the example that every fact on a screen says how old and how sure it is, which "every screen telling the truth" covers. |
| 16 | `words[5]` (The standing rules) | "The roadmap's rules that bind every block: players never have accounts; the engine's only built-in identity is the device or session id, and naming a person is game policy, never an engine default; game data stays on the kit, and how long it is kept is your decision, per game; media never lives inside the pack; a game is playtested with no code or settings file, by changing a value in the tool, applying it and playing it; phones and hardware scanners stay equal in what the engine lets them do, not in their screens; the engine holds no opinion about game design; nothing assumes one kit, one pack or one production." | RM section 2.1 rule 2 ("The engine's only built-in identity is the device or session id ... Person-level identity is game policy, never an engine default") and rule 4 ("How long old session data is kept is the owner's decision, per game"); RM section 2.4 ("Making games playtestable without code or config files IS the point ... edit pack values in the tool, apply, playtest, repeat"); RM section 2.5 ("stay equal in engine capabilities ... Parity does NOT mean identical user interfaces"). The check's phrase "a change applied between games" was not used: RM section 2.4 says apply without a restart and says nothing about between games, so the entry follows the section's own loop. |
| 17 | `words[12]` (The earlier candidate) | "The 17-part shape of the engine drawn bottom-up from today's engine, on this site since version 5." | v8 `changes.json`: version 5 ("a candidate shape of 17 parts with one direction of dependency"), version 7 ("The candidate engine drawn whole"), version 8 (its own page, the parts page of DR "The owner's site: five linked pages"); CS section 0, "Live state" (workflow `wf_5f2445a0-bac` wrote the candidate shape). |
| 18 | `words[31]` (The requirements) | "The design half's step now: the promises with your answers, the quality targets as testable situations, the extension cases with who does the extending, and the standing rules. You confirm them on [[page:decisions]]." | Row 1's source for "step now"; DR "What the architects' panel sees, and when": "the requirements (the promises with the owner's answers, the confirmed quality targets and extension cases, the standing constraints)"; plan v2 "What the site must do now" (1), which lists the standing rules among the requirements, as the lead, `timeline.now[0]` and `siteGuide[2]` on this page already did. |

Rejected: none.

Checks run again after the changes: the file parses; 572 lines with the
trailing newline, as before; 39 markers, the same set; in visible text
(markers and promise ids stripped) no promise, flaw, finding,
quality-target or extension-case id, no em or en dash, no "suite", no
bare phase, step, block, round, decision or question number, none of
the banned words; "green" six times, all the machine, except the
words-box sentence that explains the collision (W4). The world picture
now has 25 nodes (15 outside, 5 in the protocol group, the engine, 4
programs) and three groups, replacing the "Twenty-two nodes, two
subgraphs" of the worldMermaid section above. The picture was not
rendered here: the renderer (`report/render_diagrams.js`) loads Mermaid
from the CDN, which this session could not reach, and fetching a copy
to run locally was not permitted. Its syntax follows the same forms as
the version it replaces (quoted subgraph titles, `direction` inside a
subgraph, labelled `<-->` and `-.->` edges, `<br/>` in labels), so the
builder's render step is where it is first drawn; a checker should look
at it at 1200 and 400 pixels, as the site plan asks of every diagram.

Readings a checker should look at, added by this pass:

5. Row 10's reading of plan v2 section 3.1 item 8: the protocol "drawn
   as the line" is kept as the group every message and file passes
   through between the outside and the engine, not as a box around the
   engine, so the outside programs can sit on the engine's other side
   without crossing it. If the builder or the owner prefers the box, the
   programs' edges will cross it and the key's second sentence will then
   contradict the drawing.
6. Row 11 draws the operator's edge straight to the engine, outside the
   protocol group, because picking a pack and swapping a machine act on
   the machine itself (EX17, EX23). If a later design makes the pack
   selection a protocol message (EX23's "selection page later"), the
   edge moves to the messages node.
