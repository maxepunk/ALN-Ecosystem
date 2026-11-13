# Writer's log: `v9/design.json`

Written 2026-11-01 for version 9 of the owner's site, to the plan
`site/2026-11-01-site-plan-v2.md` (sections 2, 3.4, 4 and 6; plan v1
sections 2, 5 and 6 where v2 is silent). Each section below names the
source of every sentence. Paths are relative to
`docs/plans/architecture-pass/` unless they start with `/`. Short names:
"DR" is `DECISIONS.md` (the decision record, by topic; decisions named by
their titles); "JT" is `report/site/checks/jargon-table.md` (its wording
rows by number, its words-box rows by `W`-code); "QT" is
`requirements/2026-11-01-quality-targets.json` (targets by id); "EX" is
`requirements/2026-11-01-extension-cases.json` (cases by id); "shape" is
`report/2026-11-01-engine-shape.json` (the earlier candidate: its
`parts`, `alternatives`, `qualities`, `ownerChoices`); "cards" is
`report/2026-10-31-cause-cards.json` (the sixteen flaws, titles and
`atAShow` lines); "v8" is `site/decisions.json` (its `step3` list) and
`site/front.json`; "the explanation" is the published protocol as
explained to the owner on 2026-11-01, quoted in full in this task's brief
and summarized in DR "One published protocol and an outside test bench";
"CX" is `/CONTEXT.md` section 4b.

Rules applied throughout (plan v2 section 6, plan v1 section 6): the
proactive frame (the requirements and the decisions ahead first; today's
engine as evidence and test situations; the earlier candidate as one
input among the panel's); no option proposed or favoured anywhere in
`ahead`; decisions by their titles through `[[dec:]]` markers whose slug
is the title in lower case with every run of non-letters as one hyphen
(checked against every `**title**` line in DR: all thirteen slugs used
resolve); promises, quality targets, extension cases and flaws only as
markers; no visible promise, decision, question, flaw, finding,
quality-target or extension-case id (checked by script: none outside a
marker); no bare phase, step, block, round or decision number; the
sequencing names of DR "Name each step by what it does" (the design half
and the build half; the requirements, the panel, the design rounds, the
build plan, the hostile review, the final questions, the owner's
sign-off; test levels by name); JT's wordings; plain, short, active
sentences; no metaphors; no em dashes (checked by script).

Wordings applied from JT: row 4 (the design rounds); row 6 (the
candidate shape, written here as "the earlier candidate", the plan v2
name for it on this page, section 3.4 item 5 and the v9 front intro);
row 9 (the developer's tests); row 10 (each running copy of the engine
keeping its own files, network ports and settings); row 11 (a running
copy of the engine); row 12 (load, for a pack); row 13 (starts it, or
uses one already running); row 15 (a separate trial copy of the engine;
the trial copy); row 16 (applying a change while the engine runs,
between games); row 17 (blue and green, spelled out once); row 19 (the
list of planned capabilities); row 20 (each kind of job the room can
do); row 21 (the two clocks, in its wording); row 25 (design choice for
rule, where it is not a decision's title); row 29 (the hardware scanner;
the phone's scanner); row 34 (the catch-up); row 35 (live message); row
37 (one shared format); row 38 (format); row 39 (the written list of
messages between the engine and the devices; "the drafted message lists"
for DR's "contract proposals"); row 40 (device); row 42 (only by sending
it requests, never by writing its files); row 45 (not installed
tonight); row 46 (the program watcher); row 49 (the music player); row
51 (the check before a game starts; the check that refuses a broken
pack); row 54 (test stand-in, by the shorter "stand-in" where QT uses
it); row 61 (pages the engine itself serves); row 64 (fingerprint; the
list of media files); row 66 (the engine); W2 (the test rig); W5 (the
toy game); W7 (label: how old, how sure); W9 (Pi 4). Where a decision's
or a question's title contains a word JT replaces (snapshot, boundary),
the title is kept exact, as JT's "Not touched" list keeps titles.

Two words the explanation uses are rendered in the site's own words:
"the design studio" as "the design tool" (the promises' `purpose` in
`report/2026-10-31-engine-jobs.json`, and QT12, QT13, EX1); "VLC, the
music player and Home Assistant" as "the video player, the music player
and the lighting system" (QT2, QT23, EX15 name the programs that way;
JT row 49).

## ahead

The six decisions, their titles and their order: DR "Design top-down,
hardest-to-reverse choices first" ("design rounds ordered by the
hardest decisions to reverse: how the engine holds the game's state; the
published protocol and file formats; where authority lives across
devices, offline and standalone included; how games and venues extend
the engine; how one engine runs as many separate copies; how today's
engine moves to the new design") and plan v2 section 3.4 item 2 (the
same six, the second named "the published protocol's form"). Slugs are
the titles in the plan's marker form; anchors `d-<slug>` are the
builder's. Each entry's four fields follow plan v2 section 3.4 item 2.
The `panel` field of every entry rests on DR "What the architects'
panel sees, and when" (three architects propose blind, then critique
each other and the candidate shape; today's engine and the sixteen
flaws as test situations only after the first proposals), DR "Design
top-down, hardest-to-reverse choices first" ("two or three designs side
by side, checked against the promises, the quality targets, the
extension cases and today's sixteen design flaws as test cases") and DR
"The design half's method and tools" ("every rule says how it serves
hot-apply, the preview engine, capture, players' phones and standalone
games"). The flaws named in each `panel` field as "the situations
nearest this decision" are chosen by their titles and `atAShow` lines
in cards and by the parts they land on in shape (`parts[].flaws`); they
are test situations, not reasons (plan v2 section 6). No option is
proposed in any entry; where a source favours an option (shape's
`ownerChoices`, v8), the favouring is left out of `ahead`.

### How the engine holds the game's state

- `decides`, sentence 1 (where each fact lives and is decided, how it
  changes, how it is kept across a restart, how screens receive it and
  catch up): CX 4b (runtime state, authority, copy, delivery path) and
  DR "Four words for the game's live facts"; QT1 (a restart loses
  nothing); QT3 and QT17 (the catch-up and the live message carry the
  same values). Sentence 2 (what each fact and each copy does at a
  start, an end, a reset, a restart, a pack change): DR "The nine
  questions the pass answers", the question "Each fact at a game
  boundary" ("a game starting or ending, a system reset, a restart, a
  pack change while running"); JT row 24 names the five moments.
  Sentence 3 (hardest to reverse, so first): DR "Design top-down,
  hardest-to-reverse choices first" (it heads the list).
- `drivers`: the promises are those QT1, QT3, QT5, QT16 and QT17 serve
  (`promises` fields) and EX8's; QT1, QT3, QT5 and QT17 all concern a
  fact's home, its copies and the catch-up; QT16 concerns the record
  written from the facts the engine decided with one clock; EX2 (a
  change never reaches a running game), EX8 (the phase as a fact the GM
  writes, with a decider, a saved home and a defined fate at every
  lifecycle moment) and EX19 (the record of the facts the engine
  decided).
- `settled`, sentences 1 and 2: DR "Four words for the game's live
  facts" (the four terms; "An outside program can be an authority") and
  CX 4b ("They decide nothing about how the engine should hold them").
  Sentences 3 and 4: DR "The nine questions the pass answers" (the five
  titles; "the reading here, that they serve as checks on each design,
  is to be confirmed with the owner"); the four live-state questions
  that were "to be designed together" are the same four, with "One
  question gets one answer" added because it concerns the same facts.
  Sentence 5: DR "The night's record and the after-game article" ("The
  night's record carries the pack the game ran and the texts the
  players saw"); shape P5 ("written from the facts the engine decided").
  Sentence 6: the explanation ("if facts are numbered in order, a
  reconnecting screen asks for everything after a given number").
- `panel`, sentence 1: the panel sources above. Sentence 2: cards C1
  (claimed-token lists per tablet), C4 (what a game boundary clears or
  keeps), C5 (boot and reset wired differently), C6 (catch-up and live
  message built apart), C9 (tablets and phones decide facts the engine
  owns), C11 (several answers to one question); shape P3 and P11 carry
  these flaws. Sentence 3: DR "The design half's method and tools" (the
  five things every design choice serves), in JT rows 15 and 16 and QT16
  (what capture captures: the roster, the notes, the photos). Sentence 4:
  plan v2 section 3.4 item 2 ("No options are proposed here").

### The published protocol's form

- `decides`, sentence 1 (the protocol is decided; its form is not): DR
  "One published protocol and an outside test bench" (made 2026-11-01)
  and plan v2 section 3.4 item 2 ("the published protocol's form").
  Sentence 2 (how defined and versioned, generated or checked, what a
  fact and a reply carry): the explanation ("one written definition ...
  with a version number"; "generated from that one definition or
  checked against it"; "each with how old and how sure it is"); QT18.
  Sentence 3 (version rules): the explanation ("Version rules say what
  an older tablet, scanner or pack does when the engine is newer").
- `drivers`: QT18 (everything that crosses the edge written once;
  generated or checked), QT22 (a new device joins through the protocol
  with a pass), QT19 (the newcomer finds the protocol), QT7 (the tablet
  shows the engine's reason, no verdict of its own), QT32 (the engine
  filters before it sends), QT35 (the pack names media by fingerprint;
  the media bundle checked against the list), QT41 (one written list of
  what the machine carries; an engine and tablet mismatch shown); EX10
  (phones and the hardware scanner through the protocol), EX17 (the one
  matching set), EX18 (the pack as the ordinary pack from any source),
  EX19 (the record as a published file format), EX21 (a stranger works
  from the protocol). The promises are those these targets and cases
  serve.
- `settled`, sentence 1: DR "One published protocol and an outside test
  bench" ("One published, versioned protocol defines everything that
  crosses the engine's edge ... Every program's code is generated from
  it or checked against it ... designed in an early design round, not
  merely collected"). Sentence 2: DR "The role question starts from
  settled roles" (the three roles). Sentence 3: DR "The nine questions
  the pass answers" (the two titles). Sentence 4: DR "The night's record
  and the after-game article" (the console reads the record); the
  explanation (the night's record among the files; "the Director Console
  reading the night's record"). Sentence 5: DR "Five documents the
  design half hands over" ("the contract proposals, by the one published
  protocol ... to be confirmed") and its "Read as overtaken" list.
- `panel`, sentence 1: the panel sources; the hardware scanner as the
  hard case: the explanation ("the hardware scanner gets its names and
  test examples from it"; "partly for the hardware scanner's C++").
  Sentence 2: cards C7 (a reply never says which request, final or
  stored), C13 (who is connected), C14 (names joining two places kept by
  hand), C2 (health and state on separate paths), C12 (pack edits reach
  each copy differently); shape P4, P6, P7, P16 and P2 carry them.
  Sentence 3: the explanation ("The other big decisions show up in it
  ... which is why it comes early in the design rounds").

### Where authority lives across devices, offline and standalone included

- `decides`, sentence 1: CX 4b (authority: an engine module or an
  outside program); DR "Standalone games: declared, never mixed" (the
  tablet works alone); QT7 ("In a standalone game the tablet is the
  decider"). Sentence 2: QT3 ("refused with a reason, or kept and
  answered when the connection returns. Which of the two a disconnected
  tablet does is not decided here; it belongs to the design round on
  where authority lives across devices, offline included"). Sentence 3:
  DR "Standalone games: declared, never mixed" ("Where the fact 'this
  game is standalone' is held ... is a question for the design rounds");
  EX12 ("read by every device").
- `drivers`: QT3, QT7, QT37 (the tablet decides under the same rules,
  proven equal), QT38 (no mixing), QT39 (a standalone game's record),
  QT40 (a scanner offline keeps its scans), QT17 (one place decides each
  fact); EX12 (a declared standalone game), EX4 (rules written once, run
  by the engine and a standalone tablet alike), EX10 (phones and
  scanners, no second hand-written copy of the rules). The promises are
  those these serve.
- `settled`, sentence 1: DR "Standalone games: declared, never mixed"
  (both clauses; the four places the fact might be held). Sentence 2: DR
  "Four words for the game's live facts". Sentence 3: DR "The role
  question starts from settled roles". Sentence 4: DR "The nine
  questions the pass answers" (history: "Who decides each fact" central).
  Sentence 5: DR "Still open", "About standalone games" (the three
  titles); linked to the Decisions page by `[[page:decisions]]` rather
  than by `[[q:]]`, because the v9 letters are assigned on that page and
  not known here. Sentence 6: QT3, quoted above.
- `panel`, sentence 1: the panel sources; cards C9, C1, C7, C13 and the
  proposed seventeenth flaw (shape `ownerChoices`: "Whether N1 is a
  seventeenth flaw"; plan v2 section 3.5 item 3). Sentence 2: shape
  `qualities`, "Who decides when there is no engine" ("Every rule says
  who decides when there is no engine"), restated as a requirement on
  each design; QT37 ("under the same rules as the engine, and a test
  proves the two equal").

### How games and venues extend the engine

- `decides`, sentence 1: EX intro and EX1, EX3, EX6, EX7, EX9, EX11
  (what a pack declares), EX13 (what a profile declares), EX4, EX9,
  EX10, EX15, EX18 (where a developer adds a scoring model, a kind of
  screen, a device kind, a program, a content source). Sentence 2: QT10
  (two kinds of refusal, each naming what is at fault); QT21 (a pack
  that needs a missing capability is refused with it named). Sentence 3:
  EX15 ("where that setting lives, in the venue profile or in a settings
  file on the machine, is open for the design rounds").
- `drivers`: QT9, QT10, QT12 (a whole game in the design tool), QT20 (no
  ALN word in the engine), QT21, QT22, QT23, QT24, QT6 (a profile that
  says no lights: grey, never red); the fourteen extension cases whose
  `who` is a designer, a developer adding support, a venue technician
  or an operator with their own profiles and packs. The promises are
  those these serve.
- `settled`, sentence 1: the explanation ("the files that carry a game
  or a night (the pack, the venue profile, the night's record, the list
  of media files)"; "for an open-source platform it and the pack format
  are what other people build against"). Sentence 2: the promises'
  `purpose`, the standing rules ("media never lives inside the pack; ...
  the engine holds no opinion about game design"; "nothing in the engine
  may assume one kit, one pack or one production"), which plan v2
  section 3.3 item 5 places on Requirements. Sentence 3: DR "The night's
  record and the after-game article" ("Whether paper documents join the
  pack ... waits for the design rounds"). Sentence 4: DR "Corrections to
  the readers and the hardening pieces" (the three pieces stay; "The
  build half changes them only where a rule requires"), "rule" as
  "design choice" per JT row 25. Sentence 5: DR "Still open", "About the
  promises" ("Two clauses added to the pack promise"; "Keep the venue
  promise whole?"); DR "What the architects' panel sees, and when" (the
  panel gets "the promises with the owner's answers").
- `panel`, sentence 1: the panel sources; EX intro ("The independent
  panel designs against them beside the ten promises and the quality
  targets"). Sentence 2: EX20 (the second game's four needs, in its
  words) and QT12 and QT26 (the toy game); cards C12, C15 (the deployed
  game's parts nothing compares), C3 (the engine's picture of outside
  programs), C10 (a normal value when nothing is known), and the
  proposed seventeenth; shape P2, P12, P8 and P10 carry them.

### How one engine runs as many separate copies

- `decides`, sentence 1: QT43 ("Each keeps its own files, network ports
  and settings; neither can stop the other's programs, read its records
  or accept its passes"); QT11 (the trial copy); QT27 (a test run);
  EX16 (a second kit's copy). Sentence 2: QT23 ("the engine tells its
  own program from a stranger's copy of the same program"). Sentence 3:
  EX16 ("the engine's per-kit settings (its network name ...)"); QT36.
- `drivers`: QT11, QT27, QT43, QT24 (nothing assumes one kit), QT23,
  QT36 (the kit's own network); EX14 (a rehearsal on a trial copy),
  EX16, EX21 (a stranger stands it up), EX23 (a different installed game
  per event). The promises are those these serve.
- `settled`, sentence 1: DR "The nine questions the pass answers" (the
  title and its wording "can anything other than the live engine touch
  the live show (tests today, the preview engine later)?"), JT row 15
  for the trial copy. Sentence 2: DR "One published protocol and an
  outside test bench" ("The tests become a test bench outside the
  engine"); DR "Build the test rig when building starts" ("as part of the
  new test bench where a thin first version of the new design runs end
  to end"). Sentence 3: the explanation ("standalone means a tablet
  speaks the same protocol to its own built-in copy of the engine").
  Sentence 4: DR "The night's record and the after-game article"; QT23
  ("a separate program on another computer").
- `panel`, sentence 1: the panel sources; cards C8 (engine and tests
  both assume they own the machine), C5, C15; shape P13 carries them.
  Sentence 2: QT27 (a test run on the show machine during a show); EX16
  (per-kit settings); QT43 (per-copy).

### How today's engine moves to the new design

- `decides`, sentence 1: DR "Build the test rig when building starts"
  ("if the decision on how to move from today's engine chooses to change
  it in place"), which gives the two ways; DR "One program: design half,
  then build half" ("one area at a time"; "a thin first version").
  Sentence 2: DR "The architecture pass is the work now" ("Blue keeps
  running the game until the new engine is ready to swap in on green").
  Sentence 3: DR "One program" (the hardening pieces rebuilt inside the
  build half); DR "One published protocol and an outside test bench"
  (the tests move). Sentence 4: DR "The design half's method and tools"
  (the build plan follows the design rounds); DR "Design top-down"
  ("Then a build plan that starts with a thin first version").
- `drivers`: QT41 (one written list; rollback moves every piece), QT42
  (nothing reaches the machine until the owner says; the swap), QT26
  (every change tested on two packs), QT19 (a newcomer proves a change
  on the bench), QT1 (a restart loses nothing); EX17 (the second machine
  swapped in by replugging), EX21. The promises are those these serve.
- `settled`, sentence 1: DR "One program: design half, then build half"
  (quoted phrases). Sentence 2: DR "The architecture pass is the work
  now". Sentence 3: DR "Build the test rig when building starts".
  Sentence 4: DR "Corrections to the readers and the hardening pieces";
  DR "The truth sweep's charter is retired" ("proving ... that every
  screen tells the truth, moves into the build work"). Sentence 5: DR
  "One program" (history: "Starting each area with its proof test
  failing on today's engine returns only if the move from today's
  engine chooses to change it in place ... the reading is to be
  confirmed") and the "Read as overtaken" list.
- `panel`, sentence 1: the panel sources; plan v2 section 3.5 item 2
  (what works today and the pieces already well built, on Today's
  engine); DR "What the architects' panel sees, and when" (today's
  engine as facts after the first proposals). Sentence 2: cards C15,
  C16 (a passing test run proves nothing about the show), C5. Sentence
  3: DR "Design top-down" (the build plan starts with a thin first
  version); DR "Decide in question rounds, never at sign-off" (history:
  "the owner decides the build order").

## decided

The four directions and their order: plan v2 section 3.4 item 3.

### The published protocol

Every sentence follows the explanation, in its order (what it is, how it
is used, where it sits, today, what it is not, its cost), with these
changes: JT rows and the two word choices noted above; "the backend's
contract files for web requests, live messages and the night's record"
as "the engine's written lists of web requests, live messages and the
night's record" (JT rows 39 and 66); "the venue-profile format; the pack
formats in ALN-TokenData" as "the venue profile's format and the pack
formats" (no file names on the page, plan v1 section 6); "code
generation for JavaScript and partly for the hardware scanner's C++" as
"generating code for the web programs, and in part for the hardware
scanner's program in its own language". Paragraph 6's last two
sentences: DR "One published protocol and an outside test bench"
("Together these two replace the candidate shape's part called 'Joins
and proofs'") and plan v2 section 3.4 item 2 (the second decision
ahead).

### The test bench outside the engine

- Paragraph 1, sentence 1: DR "One published protocol and an outside
  test bench" ("The tests become a test bench outside the engine").
  Sentence 2: the explanation ("a test is the engine running with a
  stand-in venue profile"); EX14 ("A venue profile whose bindings point
  at software stand-ins, generated from the pack"); QT25 ("The
  simulation is an ordinary profile pointing at stand-ins; one can be
  generated from the pack's needs so that every need is met").
  Sentence 3: QT25 ("On a laptop or a cloud machine with no venue
  hardware, a developer runs a whole game end to end: the engine, the
  GM tablet's app, both player scanners' software and the TV page").
- Paragraph 2, sentence 1: QT25 ("The same engine, the same pack and
  the same checks run at every test level ... and each run records which
  checks it could not do and why"); the four levels by name from DR
  "Name each step by what it does". Sentence 2: QT26 (twice, ALN's pack
  and the toy game's; a test that cannot run fails loudly; every stand-in
  compared with the real thing). Sentence 3: QT27 ("Every test run keeps
  its own files, network ports and settings, and cannot stop a program
  it did not start").
- Paragraph 3, sentence 1: DR "One published protocol and an outside
  test bench" ("'Proof' stays a quality every part must meet"); shape
  `qualities`, Proof ("A passing test run means the show works for two
  games, and no test reaches a live show"). Sentence 2: QT25 (its last
  sentence). Sentence 3: DR "One program: design half, then build half"
  ("starts with a thin first version of the new design running end to
  end on a new test bench").

### The test rig built when building starts

- Paragraph 1: JT W2 (the rig's definition and its loss), without W2's
  closing "rebuilding it is the next step", which DR "Build the test rig
  when building starts" has overtaken.
- Paragraph 2, sentences 1 and 2: DR "Build the test rig when building
  starts" (its first two sentences). Sentence 3: the same decision's
  history ("the design half's second step, meant to reproduce four unrun
  findings before design (the deleted token still refused, the music
  panel behind live music, the ended game returning after a restart, the
  reset that leaves music out)"); the four flaws those findings sit
  under: v8 `decisions.json`, the earlier test-rig question's evidence,
  which links them to C1, C2, C4 and C5. Sentence 4: DR "Build the test
  rig when building starts" (history: "The question is withdrawn") and
  "Superseded and withdrawn".
- Paragraph 3, sentence 1: the decision's "Exception" sentence. Sentence
  2: DR "Read as overtaken, not yet confirmed" (its first and fourth
  items) and DR "When the design half is finished" ("the rig condition,
  by 'Build the test rig when building starts'").

### The after-game boundary

Every sentence is DR "The night's record and the after-game article",
in its order, with these changes: the promise named by its marker
(`[[promise:J3]]`) in place of its title; "join the flaw 'Tablets and
phones decide facts the engine owns' as a finding" rendered with the
flaw marker and JT row 21's wording for the two clocks ("a sale is
stamped with the tablet's time, a score adjustment with the engine
computer's"); the finding id left out (JT row 21; plan v2 section 2).

## later

The twelve items are v8 `decisions.json` `step3`, in its order; DR
"Still open" ("Kept for the design rounds, not questions now: the
Decisions page's list of twelve design choices") confirms that all
twelve still stand, so none is dropped. Plan v2 section 3.4 item 4
("the mid-level choices from version 8's step-3 list that still stand,
in plain words"). Changes to each, all from JT unless noted:

1. "(the map favours it)" to "(the earlier candidate favours it)" (JT
   row 6; the page's name for the candidate, plan v2 section 3.4 item
   5). The second sentence, placing it inside the decision ahead on
   where authority lives: DR "Standalone games: declared, never mixed"
   ("Where the fact ... is held ... is a question for the design
   rounds") and DR "Design top-down" (the third decision's title,
   "standalone included").
2. "in a shared shape" to "in one shared format" (JT rows 37 and 38).
   `alt`: `alt-delivery`, the builder's anchor for shape `alternatives`
   row 1 (`build_site.py` `ALT_ANCHORS`).
3. Unchanged. `alt`: `alt-lifecycle` (row 6).
4. Unchanged. `alt`: `alt-rules` (row 2).
5. "one per thing the room can do" to "one per kind of job the room can
   do" (JT row 20). `alt`: `alt-equipment` (row 3).
6. Unchanged. `alt`: `alt-standalone-tablet` (row 4).
7. "one page in two places" expanded with the two places from shape
   `alternatives` row 7 ("the TV's browser and the Pi 4"; JT row 48 and
   W9). `alt`: `alt-scoreboard` (row 7).
8. "The config tool" to "The design tool" (the promises' `purpose`;
   QT13 "the tool's pages"); "talks to the engine by message" to "talks
   to the engine only by sending it requests, never by writing its
   files" (JT row 42); "a surface the engine itself serves" to "pages
   the engine itself serves" (JT row 61).
9. "adopted" to "loaded" (JT row 12).
10. "adopts one already running" to "uses one already running" (JT row
    13); "as the candidate shape has it" to "as the earlier candidate
    has it" (as in item 1); "the capability map you approved" to "the
    list of planned capabilities you approved" (JT row 19).
11. "the engine's own names and delivery first since most flaws land on
    them" to "(the earlier candidate put each running copy of the engine
    keeping its own files, network ports and settings, and delivery,
    first)" (JT row 10; the reason "since most flaws land on them" is
    attributed to the earlier candidate rather than stated as a reason,
    plan v2 section 6: today's flaws are never the reason for a design).
    The second sentence: DR "Design top-down" ("Then a build plan that
    starts with a thin first version") and DR "The design half's method
    and tools" (the build plan after the design rounds).
12. "Decision 28 left this to step 3" to the sentence without the
    number (plan v2 section 2, titles not numbers; the decision is named
    in `decided` above). "today the director marks them by hand after
    the show": kept from v8.

## earlierNote

- Sentence 1: plan v2 section 3.4 item 5 (the label's words: "An
  earlier candidate, drawn bottom-up from today's engine"); the three
  things it holds: plan v1 section 3.4 items 5, 6 and 8 (the seventeen
  parts, which part would run where, where a real alternative exists).
- Sentence 2: plan v2 section 3.4 item 5 ("The panel compares it with
  its own proposals in its second round"); DR "What the architects'
  panel sees, and when" ("Three architects with different lenses propose
  blind, then critique each other and the candidate shape"; "it enters
  in a second round as one more proposal").
- Sentence 3: plan v2 section 3.4 item 5 ("Joins and proofs is marked as
  replaced by the published protocol and the test bench"); DR
  "Superseded and withdrawn", "The part 'Joins and proofs'"; "nothing
  else in it is decided": plan v1 section 6 ("The shape is a candidate.
  Never write it as decided") and the v9 status line (plan v2 section 2).

## Checks run on the file

By script after writing: the file parses as JSON; `ahead` has six
entries, `decided` four, `later` twelve, `earlierNote` one string; the
marker kinds used are `promise`, `qt`, `ex`, `flaw`, `dec` and `page`;
every `[[dec:]]` slug matches a `**title**` line of DR under the slug
rule; no promise, flaw, quality-target, extension-case, finding or
question id appears outside a marker; no em dash or en dash; none of
JT's replaced words appears except inside an exact decision or question
title ("Reconnect snapshot built like live update", "Each fact at a game
boundary") and JT's own replacement wordings ("kind of job", "stamped
with the tablet's time").

## Readings a checker should look at

- The flaws named in each `panel` field as "the situations nearest this
  decision" are this writer's selection from the sixteen, by title and
  by the parts they land on in the earlier candidate. Every design is
  checked against all sixteen (DR "Design top-down"); the selection
  only says which a reader should look at first. A checker may prefer to
  drop the selection and name all sixteen once.
- `drivers` lists are selections too: each names the quality targets
  and extension cases whose situation turns on the decision, and the
  promises those serve. The fourth decision names fourteen extension
  cases because the cases are mostly about extending.
- The three open questions named in the third decision's `settled` are
  linked through `[[page:decisions]]`, not `[[q:]]`, because the v9
  Decisions page assigns the letters. If the builder wants `[[q:]]`
  markers there, the letters come from `v9/decisions.json`.
- The second decision's `settled` renders DR's "contract proposals" as
  "the drafted message lists" (JT row 39). If the Decisions page quotes
  the record's own phrase, the two should agree.
- The quality targets and extension cases are referenced by id inside
  markers (`[[qt:QT3]]`, `[[ex:EX12]]`); plan v2 section 4 says each
  gains a `title` the builder renders. The requirements files in this
  tree do not yet carry `title` fields.
- "The design tool" stands for the explanation's "design studio" and
  v8's "config tool". If the site settles on another name for the
  designer's and venue technician's tool, items 8 of `later` and the
  protocol's second paragraph change with it.

## The check applied (2026-11-01)

`checks/v9-check-design.md` listed 22 conflicts. Each was read against
its source before anything changed; 21 were applied, 1 was rejected
because it needed no edit here. The file still parses, its layout is
unchanged (two-space JSON; a re-dump before and after the edits
reproduced the file byte for byte), `ahead` has six entries, `decided`
four, `later` twelve. Markers after the edits: 169 (23 promise, 39
quality target, 30 extension case, 34 decision, 32 flaw, 5 question, 2
page, 4 part), each checked by script against its source: every
`[[dec:]]` slug against DR's `**title**` lines, every `[[q:]]` letter
against `v9/decisions.json`, every `[[part:]]` id against shape
`parts`, every `[[qt:]]` and `[[ex:]]` id against the requirements. No
em or en dash.

By row of the check:

1. Rejected, no edit. The check found `v9/decisions.json`
   `designRounds[1]` linking to `design.html#d-the-published-protocol-and-file-formats`.
   That file now links to `design.html#d-the-published-protocol-s-form`
   (its own check, row 7, was applied on that side), so the two pages
   already agree on the plan's title and slug (plan v2 section 3.4 item
   2: "the published protocol's form"). Nothing to change here.
2. Applied. `ahead[0].panel`: "blind, from the goal, the requirements
   and the setting". Source: DR "What the architects' panel sees, and
   when" ("The panel first gets the goal, the requirements ... and the
   setting").
3. Applied. `ahead[1].panel`, sentence 3 now ends at "this round comes
   early." The dropped clause had no source; the explanation says only
   "which is why it comes early in the design rounds".
4. Applied. `ahead[2].settled`, sentence 5: "Three of your open
   questions feed this round: [[q:L]], [[q:M]] and [[q:N]]." Letters
   from `v9/decisions.json` (L the hardware scanner's standalone mode,
   M one GM tablet per standalone game, N exposed evidence and video
   with no engine).
5. Applied. `ahead[2].settled`, sentence 6: "[[qt:QT3]] leaves to this
   round what a disconnected tablet does with a scan." Source: QT3
   `status`.
6. Applied. `ahead[3].settled`, last sentence: "[[q:E]] and [[q:I]]
   touch the clauses added to the pack promise and whether the venue
   promise stays whole". Letters from `v9/decisions.json` (E "Two
   clauses added to the pack promise", I "Keep the venue promise
   whole?").
7. Applied. `ahead[3].settled`, sentence 4: "(the equipment families,
   the core that marks equipment not installed tonight, the smallest
   test set-up)". Sources: JT row 45 (dormancy); JT F158 ("minimum test
   harness" as "the smallest test set-up"). Note for the Decisions
   page's keeper: its decided line for the same decision says "the
   harness minimum"; F158's wording is the one used here.
8. Applied. `ahead[4].settled`, sentence 3 now reads: "How a standalone
   tablet runs its game, with the same parts the engine runs or an
   engine of its own, is still open (see Later choices)." Sources: the
   explanation gives the built-in copy only as an example; DR
   "Standalone games: declared, never mixed" and "Still open" (the
   standalone tablet is kept for the design rounds); `later[5]`
   (`alt-standalone-tablet`). The earlier sentence favoured one side of
   an open alternative inside `settled`.
9. Applied. `ahead[4].settled`, sentence 4: "The Director Console stays
   a separate program on another computer, for now, that reads the
   record; the record is designed so the console can later become ALN's
   own part of the engine's Review stage". Source: DR "The night's
   record and the after-game article" ("for now"; the Review-stage
   clause). "On another computer" is kept: QT23 says it ("a separate
   program on another computer").
10. Applied. `ahead[4].decides`, new last sentence: "Where the
    designer's trial copy runs, a laptop or the show machine between
    games, is open." Source: EX14 ("where it runs is an open
    question"); the same words as `v9/decisions.json` `designRounds[4]`.
11. Applied. `ahead[5].decides`, first use of the two words on this
    page: "blue, the show machine in use now" and "green, the new
    machine this work builds". Source: JT row 17 and W4. `settled`'s
    later use of the bare words follows the spelled-out first use, so
    it stays as it was. The earlier log line claiming row 17 was
    "spelled out once" was wrong until this edit.
12. Applied. `ahead[5].drivers` drops [[qt:QT1]] and [[ex:EX21]]: QT1
    is about the new design's state across a restart (it already drives
    `ahead[0]`), EX21 about extending (carried by `ahead[1]` and
    `ahead[4]`). The promises [[promise:J10]] and [[promise:J5]] stay:
    QT41, QT42, QT26 and QT19 serve J10, and EX17 serves J10 and J5
    (`promises` fields).
13. Applied. `ahead[5].settled`, last sentence: "its test failing on
    today's engine"; `decided[2].paragraphs[2]`: "its test failing on
    today's engine" and "each finding marked to be shown happening
    live". Source: JT row 9 (proof as the developer's tests);
    `checks/v9-check-decisions.md` row 4 renders the first the same
    way. "'Proof' stays a quality" in `decided[1]` is DR's own quoted
    term and stays; "how much the rig proves before design" is a
    question's title and stays.
14. Applied, the second way: the decision ahead drops the order of the
    work, which the record places with the build plan (DR "Design
    top-down, hardest-to-reverse choices first": "Then a build plan
    that starts with a thin first version"; DR "The design half's
    method and tools"). `ahead[5].decides`, sentence 1: "or a new
    engine is built beside it, starting from the thin first version,
    and the pieces swapped over." `ahead[5].panel`, last sentence: "The
    round ends by handing the build plan its starting point; the build
    plan settles the order of the work." `later[10]` keeps "The build
    plan ... settles it after the design rounds", so one owner remains.
15. Applied. `decided[0].paragraphs[2]`: "The other big decisions show
    up in it. For example, if facts are numbered in order, ...; and if
    a game is standalone, the tablet speaks the same protocol to
    whatever runs the game on it." Source: the explanation ("(for
    example, ...)"); DR "Still open" (the standalone tablet is open).
16. Applied. `decided[0].paragraphs[5]` and `earlierNote`: "the earlier
    candidate's part [[part:P16]]"; "Its part [[part:P16]] is
    replaced". Source: shape `parts` P16 (Joins and proofs); plan v2
    section 2 anchors (parts by slug on `design.html`); the brief's
    `[[part:]]` marker.
17. Applied. `later[10]`: "(the earlier candidate put [[part:P13]] and
    [[part:P6]] first)". Source: shape P13 (Engine instance), P6
    (Delivery); the same as `v9/decisions.json` `later[10]`.
18. Applied. `decided[0].paragraphs[5]`: "Its form is the decision
    ahead on the protocol's form, above." `decided[2].paragraphs[1]`:
    "It had come before the design rounds, right after the review that
    named the design flaws, meant to reproduce ...". Sources: DR "Name
    each step by what it does" (no bare step or decision number); DR
    "Superseded and withdrawn", "The design half's first order" (cause
    analysis, then the test rig), with "the review that named the
    design flaws" as the site's name for the cause analysis
    (`v9/decisions.json` uses it).
19. Applied. `decided[0].paragraphs[5]`: "generating code for the
    engine and the web programs, which share one language, and in part
    for the hardware scanner's program in its own". Source: the
    explanation ("code generation for JavaScript and partly for the
    hardware scanner's C++"; its list of generated sides names the
    engine first).
20. Applied. `decided[1].paragraphs[0]`: "a profile that binds the
    pack's names to software stand-ins for video, sound, lights and
    speakers". Source: JT C60 ("the bindings" as "binding the pack's
    names to real equipment").
21. Applied, the first way: `later[7]` now opens "The config tool, the
    designer's and venue technician's tool: ...". Sources: DR "Still
    open" ("the config tool"); v8 `step3[7]`; `v9/decisions.json`
    `later[7]` ("The config tool"), so the two pages agree. "The design
    tool" in `decided[0].paragraphs[1]` (the explanation's "design
    studio", the requirements' word) is untouched; the check found it
    right.
22. Applied. `later[0]`: "It is decided in the round on where authority
    lives." `later[9]` and `later[11]` each gain "It is decided in the
    round on how games and venues extend the engine." Sources:
    `ahead[3].decides` (where the start-or-use setting lives) and
    `ahead[3].settled` (paper documents) name both as that decision's;
    `v9/decisions.json` `later[0]` ("It falls inside the round on where
    authority lives").

Statements earlier in this log that these edits supersede: the marker
kinds under "Checks run on the file" (now also `q` and `part`); the
"Readings a checker should look at" note that the three open questions
go through `[[page:decisions]]` (they now go through `[[q:]]`); JT row
17 "spelled out once" (done only now); the `ahead[4]` `settled`
sentence 3 source (the explanation's example is no longer stated as
settled); the `ahead[5]` `drivers` list (QT1 and EX21 dropped); the
`ahead[5]` `decides` sentence 1 and `panel` sentence 3 sources (the
order of the work is the build plan's); and `later` item 8's "The
config tool" to "The design tool" (reversed).
