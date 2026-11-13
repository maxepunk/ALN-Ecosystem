# How today's code moves to the new design (design topic, opened 2026-11-13)

Status: WITHDRAWN for rework (2026-11-13). The agent put two decisions
to the owner and the owner sent them back as not fully considered. Read
"The owner's answers" at the end first. Everything between here and
there is the first attempt, kept as the record of what was put. Do not
put it again as it stands. It is the last topic of the design.

The facts are in `2026-11-13-how-todays-code-moves-facts.md`, gathered
by a helper. The agent checked these of its claims itself on
2026-11-13: the line counts of the backend's source and tests and of
the GM scanner's source (26,916, 88,538 and 16,497); that nothing in
`backend/src` appends to a file and that a session is saved whole,
twice, on each change (`backend/src/services/sessionService.js:718-731`);
that the rules folder requires only its own files; that no package file
exists at the root and no package declares a workspace; that about half
of the backend's unit test files require a service (42 of 110 by the
agent's narrower search, 59 by the helper's); 27 files in the flows
folder. The helper's file was written before the owner's correction on
the game's rules (`docs/adr/0011`).

## What the owner has already ruled here

- Blue runs every ALN session until one cutover. Nothing new has to
  work with anything old (confirmed 2026-11-13).
- The build half changes the engine one area at a time. It starts with
  a thin first version of the new design running end to end on a new
  test bench. Each area gets its detailed design just before it is
  built. The design half ends with the decision notes and the new
  roadmap (`../DECISIONS.md`, "One program: design half, then build
  half" and "Five documents the design half hands over", 2026-10-30).
- One published definition of everything that crosses the engine's
  edge, and the tests as a test bench outside the engine
  (2026-11-01).
- The hardening pieces merged in September stay, changed only where
  the design requires. The unbuilt ones (the profile check,
  credentials, the supervisor, the pack self-heal, the preflight) are
  rebuilt in the build half (`docs/plans/CURRENT-STATE.md` section 5).
- One pull request per touched repository per block, merged by the
  owner (hardening plan R4, 2026-09-12). Decision 2 below would change
  this to one pull request per change.
- Nothing rules on the repositories themselves. The cause analysis
  named "several separately versioned checkouts and hand-run steps" as
  a cause of faults.

## The facts that decide it

- Four things at the centre all change: how a session is stored (one
  object saved whole today; a record that only grows in the design),
  where the rules come from (formulas in the engine's code today; the
  designer's rules in the pack), every message (all 34 files of
  message tests change with the definitions alone), and how the
  backend is put together (17 single shared instances and 13
  hand-typed lists of them today; one place in the design).
- 16 source files and 66 test files require the session service.
  About half of the backend's unit test files and 33 of its 38
  integration files reach a service directly.
- Three groups of tests check behaviour from outside and stay valid in
  kind: the 26 end-to-end flows, the rules tests, the file-format
  tests. One audit runs against real video and music players with
  stand-in gear.
- The backend is CommonJS with no build. The GM scanner is ES modules
  built by Vite. No package depends on another. The GM scanner's own
  tests and its public page build see its repository and the pack
  data, and nothing else. Three checkouts of the pack data sit at two
  commits today.
- Parts that already have the target shape: the part that restarts a
  crashed program, the health words, the pack check, the installation
  profile, the comparison of what a pack needs with what is installed,
  the stand-ins for gear, the GM scanner's own assembly file, the
  firmware's layers.

## The decisions asked of the owner (2026-11-13)

**1. Build the new engine beside today's code, or reshape today's code
step by step.** Recommended: beside. The new engine is built in new
folders, starting with the thin first version. The parts of today's
code that already fit move across with their tests. Today's code stays
untouched as the reference and is deleted when the new engine passes
the same end-to-end checks. The other way keeps today's tests passing
at every step while the code under them is replaced, which buys
nothing while blue runs ALN.

**2. One repository for the whole engine.** Recommended: the backend,
the GM scanner, the player scanner page, the scoreboard, the config
tool, the firmware, the shared game code and the definition of the
messages live in one repository, so that one commit is one version of
the engine on every device. ALN's pack keeps its own repository. The
separate GM scanner, player scanner and firmware repositories are
archived at the cutover and not touched before it.

Put with them, no decision asked:

- The config tool stops writing the backend's files. It sends its
  changes to the backend, which checks and stores them. Where an
  installation has no backend, the config tool writes the pack and the
  settings for the devices itself, with the same checking code.
- The hardware scanner's firmware is changed where it stands.
- After these two decisions the design is done, and the agent writes
  the build plan: the thin first version, then the areas in order,
  with the paused September work placed inside them.

## For the agent's own engineering

- What moves across, with its tests: `utils/processMonitor.js`, the
  health registry and the dormancy service, the pack check in
  `packService.js`, the profile service and `gameRules/resolution.js`,
  the seven equipment modules' knowledge of their programs (wrapped in
  the one pattern), the stand-ins and the profile generator, the GM
  scanner's tag reading, pack loader and renderers, the web player
  scanner's display code, the firmware.
- What is written new: the session's record and everything worked out
  from it; the code that works a game's rules out from its pack
  (`docs/adr/0011`), with today's `gameRules` functions and recorded
  sessions as the check for ALN's rules; the definition of the
  messages and files, and the checks against it; credentials; the one
  place of assembly; the GM scanner's store, which becomes a copy of
  the record plus its own unconfirmed scans.
- Tests: the flows, the rules tests, the file-format tests, the audit
  against real programs and the session report's exact text come
  across and are rewritten against the new messages. Tests tied to the
  old inside are not maintained and go with the code they test. The
  coverage floors, keyed by file path today, start again.
- To settle at the start of the build, the agent's own: whether the
  new code is written with checked types; the test runner; how the
  packages are joined in one repository; how the standalone pages are
  built with a pack.
- The owner's own tooling reads the session report's exact text
  (`ALNScanner/tests/contract/sessionReport.contract.test.js`). The new
  record must feed it or replace it with the owner's agreement.

## The owner's answers (2026-11-13)

Word for word:

> These decisions don't yet feel like they're fully considered. for
> example, what does a 'thin first version' even mean? What are the
> architectural tradeoff of one repo vs multiple for long term
> operation, maintenance, and extensions? How would the ALN report
> pipeline fit into all this? etc. not to mention, I've noticed you
> haven't waitedfor the agent researching how today's code moves

Both decisions are withdrawn. What the agent did wrong:

- It did not wait for the helper. The helper's file appeared in the
  tree, the agent took it for finished, committed it as "as the helper
  left them" (`d1b441a7`), read its summary and four of its eight
  sections, and built the recommendation on that. The helper was still
  running and still changing the file: by 08:01 it had changed 164
  lines. No completion notice had arrived. A file in the tree is not a
  finished report.
- It used "thin first version" without saying what it contains, what
  it proves and what it leaves out. The phrase comes from the owner's
  decision of 2026-10-30 and was never defined for the owner.
- It recommended one repository on three sentences of reasons, with no
  account of the trade-off for running kits, for keeping the engine
  maintained, and for people who extend it or adopt it.
- It did not say where ALN's own report pipeline goes, although the
  facts file itself notes that the owner's tooling reads the session
  report's exact text.
- "etc." in the owner's message: the same is true of everything else
  that is ALN's and not the engine's and lives in these repositories
  today (the Notion sync, the tag tools, the post-session checks), of
  the documents, and of what the cutover does to the repositories.

What a considered answer needs before anything is put again:

1. The helper's finished file, read in full, with its main claims
   checked. Wait for the completion notice.
2. "Thin first version" defined in plain words: what a person can do
   with it, what it proves, what it leaves out, how it is checked.
   Start from the owner's decision and the program document
   (`docs/plans/2026-10-30-architecture-pass.md`).
3. One repository against several, set out for three things the owner
   named: operation (versions on a kit, updates, the standalone pages,
   the cutover), maintenance (tests, drift between copies, review),
   and extension (a developer adding a capability, another production
   adopting the engine, a second game's pack), with the costs of each
   side and what cannot be undone.
4. Where ALN's report pipeline lives and what it reads, from the
   records (`../2026-11-01-after-game-report.md`; `../DECISIONS.md`,
   "The night's record and the after-game article").
5. A list of everything in these repositories that is ALN's and not
   the engine's, and where each goes.

# The considered version (2026-11-13, second writing, after an independent review)

How this was made. The helper finished at 08:05 and its final facts
file is committed (`e9d77bf9`); the agent read all of it. The agent
wrote a first considered version (`5b2de5e6`). One independent reader
then challenged it and returned fourteen findings. The agent checked
the main ones against the code and the records, and they held. This
second writing replaces the first. The findings and what each changed
are listed at the end.

Checked by the agent itself: the line counts; that nothing in
`backend/src` appends and a session is saved whole, twice; that the
rules folder requires only its own files; that no package file is at
the root; `gameRules/scoring.js:51` and `ALN-TokenData/game.json`; the
firmware repository's folder sizes; the owner's ruling on the report
(`docs/plans/2026-09-03-phase3-a3-slice7-report-wording.md:9-19`); how
the report prints times and the detail of a sale
(`ALNScanner/src/core/sessionReportGenerator.js:285-293`, `:482-492`);
that `backend/.env` is tracked; the licences of the firmware's
libraries; the roadmap's section 6 on the cutover; the media tracked
in the player scanner's repository (131 files, 37 MB).

## 1. What the "thin first version" is

The phrase is from the owner's decision of 2026-10-30. It is the
smallest engine in which one token goes through every part of the new
design. It is thin in what it does. It is not small in work: it holds
the first form of every new central part.

What a person can do with it:

1. Start the backend on a laptop with a pack of three tokens.
2. Open the GM scanner's page on a phone, log in, choose an account
   and enter a token, typed or read from a tag.
3. See the result on the GM scanner, and see the scoreboard page
   change on another screen.
4. Open the player scanner page from a link like the one on a tag,
   with no login, and see the token's picture.
5. Turn the phone's Wi-Fi off and enter another token. The result
   shows as "not confirmed". Turn Wi-Fi on. It becomes confirmed.
6. Two GM scanners, one with no connection, take the same token. The
   scan that reaches the backend first counts. The other GM is told
   which scan was refused and why.
7. Stop the backend and start it again. The session, the scores and
   the login are back.
8. End the session. A scan stored on a GM scanner arrives afterwards
   and lands in that session, marked late. Create the next session:
   every screen is cleared, and the record of the last one is kept.
9. Open the GM scanner with no backend at all. The same verbs give the
   same scores, and the session's record can be saved.
10. A rule asks the room for a sound. A stand-in for the sound player
    gets the command. Stop the stand-in: the backend starts it again,
    the crash is a line in the record, and what was cut off is on the
    GM's list.
11. The firmware's two small files that build and read messages are
    brought to the new definition and tested on a computer, so the
    C++ side is checked too. The hardware scanner itself joins in its
    own area.

What the steps prove: 1 to 3, the record that only grows
(`docs/adr/0001`), a designer's rules worked out from the pack
(`0011`), the one definition of the messages, the backend put together
in one place, and a kit screen with its own credential; 4, a phone's
credential (`0004`) and a device sent only what its kind may show; 5
and 6, the rules code inside the GM scanner and handing over
(`0007`); 7, restart (`0010`); 8, where a session ends (`0003`); 9, a
game with no backend (`0008`); 10, the one pattern for equipment, a
crash in the record (`0002`) and the GM's list (`0010`); 11, the
definition checked against C++.

It runs on two packs: a new toy pack scored its own way, and three of
ALN's tokens with ALN's two verbs written as pack rules, which must
give ALN's numbers. Today's toy pack is scored by ALN's formulas and
will not do.

How it is checked. By tests that drive it only from outside, through
the defined messages and the pages. They run with stand-ins, and on
the rig with the real video and music players: the owner decided on
2026-11-01 that the rig is rebuilt when building starts, as part of
this test bench, and that the pass ends when every test passes on it.

What it leaves out: ALN's 81 tokens and their media, video, music,
lights, Bluetooth, audio routes, cues and timelines, held items, the
session and admin screens, the look of every page, the config tool,
the preflight, the report, the hardware scanner as a device, updates
over the air, joining several standalone GM scanners' records.

Designs it needs before it starts. The owner decided that each area
gets its detailed design just before it is built. For the first
version that is four designs:

- the form of a line in the session's record (the agent's);
- the operations a formula has and how a rule is written in a pack
  (the agent's; ALN's rules and the toy's are shown to the owner
  written that way before anything is built);
- the language the messages are defined in, and how the C++ side is
  checked against it (the agent's);
- how a device is added to a kit, with a backend and without one
  (**the owner's**: it is what a technician or a GM does with each new
  device, and `docs/adr/0004` and `0008` both rest on it. Roadmap row
  8.11 had left it to the players' phones work.)

## 2. In place or beside, program by program

In place, fairly put. Today's code is changed where it stands, in
stages, and at every stage the branch holds a whole working engine.
Nothing is forgotten by default, and the 26 end-to-end flows pass
throughout. That is its real strength. Its costs here: every central
change needs in-between states that serve nobody (two stores written
at once, old and new messages side by side), because blue runs ALN;
about 100 unit test files, 38 integration files and 33 of 34 message
test files must be kept passing or rewritten at each stage; the
owner's decision of 2026-11-01 brings back "pin down today's
behaviour first" if in place is chosen; and it starts from ALN's shape
(accounts, transactions, one score, modes, named formulas) and widens
it, which is the bias the owner named.

Beside means a new structure, started with the first version, into
which parts of today's code are moved. It is decided program by
program:

| Program | Lines | Way | Rewritten | Moved and fitted |
|---|---|---|---|---|
| Backend | 26,916 | beside | The session store, how a scan is handled, the messages, the command switch, credentials, the assembly. About four lines in ten. | The seven equipment modules, the part that restarts a crashed program, the health words and September's "not installed" work, the pack check, the installation profile and the comparison of needs. Also the cue engine, the video queue, the game clock, held items, timelines, audio ducking and the TV's modes: each reads the session and the commands today, so each is fitted to the record when its area is built. |
| GM scanner | 16,497 | beside | Its two stores, its copy of the rules, its network code, and its game screens, which are built around ALN's fields and ALN's two modes. | Tag reading, pack loading, the show-control screens (cues, health, music, video, the room), the styles. The GM scanner's redesign (roadmap row 8.17) is designed with the owner before this area is built. |
| Player scanner page | 1,489 | beside | How it talks to the backend, and its start from a link. | How it shows a memory. |
| Scoreboard | 1,860 in one file | beside | Its script: it becomes a screen that is told what to show. | Its look. |
| Config tool | 6,510 | decided at its area | Its link to the engine: today it signs its own logins with the backend's secret, writes the backend's settings files and loads the backend's code. It will send its changes to the backend, or, with no backend, write the pack and the settings for the devices itself. Screens for verbs and formulas are new. | Its cue screens and its draft and publish. |
| Firmware | 9,606 | in place | | Changed where it stands, file by file (the facts file, section G). |
| Tag tools, the post-session checks | | rewritten | The tag tools write the id first and a `.local` link with a port, the opposite of `docs/adr/0005`. The checks read today's session file and the log, and score with ALN's formulas. | |
| ALN's pack | | rewritten | Its rules, as a designer's rules (`0011`). | Its tokens, texts, cues and look. |

Not kept: the backend's own queue for GM scans made with no
connection and its watch on player scanners' check-ins. The record and
credentials take their place.

Risks of beside, and what answers each:

- A fix nobody wrote down is lost. Answer: the equipment code is moved,
  not rewritten. Before each area a list is made from the flows, the
  audit against real players, the "CRITICAL" notes in the guides, the
  cause analysis and the triage of blue's fixes.
- ALN's scores change without anyone noticing. Answer: real sessions,
  turned into the new record, must give the same final scores.
  **Needed from the owner:** a few session files from blue, the report
  the GM downloaded for each, and which pack and which of blue's
  commits each ran. None is in the repository. A converter has to be
  written, and it cannot bring back what today's file never kept
  (deleted scans, refused scans).
- A long time with no whole. Answer: the first version, then one area
  at a time into it.
- A fault fixed on blue during the build never reaches the new engine.
  Answer: a list of pending cases kept for each area. A fix on blue
  adds a case to the list of the area it belongs to, and the case
  becomes a test when that area is built.
- Two of every program in one checkout for months. Answer: section 3.

Recommended: beside for the backend, the GM scanner, the player
scanner page and the scoreboard; in place for the firmware; the config
tool decided at its area.

## 3. The repositories

Three questions, not one.

**(a) One repository for the engine's web programs and the code they
share.** The backend, the GM scanner, the player scanner page, the
scoreboard, the config tool, the rules code, the definitions and the
tag tools. Against a repository for each, joined by pins, as today.

Operation. With one, a release is one commit: from it come the backend,
the pages it serves and the standalone pages. Updating a kit is
installing one release, and going back is installing the one before.
With several, a release is a set of pins; today three checkouts of the
pack data sit at two commits, and the guide has a section on detached
checkouts. What a release is on a kit should also change: a built
bundle that is installed, where today the Pi holds a git checkout and
builds the GM scanner when the backend starts.

Maintenance. A change to a message touches the definition, the
backend, the GM scanner, the player scanner page and the tests. With
one repository it is one commit, one review, and one run of the checks
sees every program. With several it is a commit in each and then the
pins, in a set order, and between merges the programs disagree; each
repository's own checks cannot see the others. The rules code needs
one source that the backend and the GM scanner both load; with
several repositories that means publishing a package on every change,
nesting a repository in each program (how the pack data came to sit
at two commits), or copying (today). Costs of one: the checks must run
only what a change touches; one place to break everything at once.

Extension. A developer adding a capability may touch the rules code, a
backend module, a GM scanner screen and the definition: one repository
to copy and one change to offer back, against several and their pins.
Another production needs an engine release, its own pack and its own
settings; the line between the engine and a game is the repository's
edge. What several give that one does not: a person can be given one
program without the rest, and each can have its own release rhythm.
The programs cannot run across versions, so neither is wanted here.

A correction to the first writing: it said a workspace meets the build
tool's two limits. For code written the backend's way it does not. The
shared code is to be written as ES modules, which both sides can load,
and proved with one real build in the first version. The backend
allows Node 22.0 today and loading ES modules that way needs 22.12.

Recommended: one.

**(b) The firmware: in that repository, or in its own.** The first
writing leaned to in. The review's facts turn it:

- Its real build uses `arduino-cli` with an ESP32 core of no fixed
  version and a library installed by hand on the machine. PlatformIO
  only runs its host tests. No workflow compiles it.
- Its repository holds 86 MB of copied libraries. One, 30 MB, is
  included by no source file. The display library is modified for this
  board.
- Two libraries linked into it (`ESP8266Audio`, `XPT2046_Bitbang`) are
  under the GPL, version 3. So the firmware as a whole must be
  released under the GPL when the engine goes public. That is true
  wherever it lives, and it bears on the licence the roadmap's release
  block has to choose.
- Its tie to the engine is narrow: a handful of messages. And it is
  for one kind of hardware; another production may use another, or
  none.

Costs of keeping it apart: a change to a message the scanner uses is
two repositories and a pin, and the backend's release has to name the
firmware version it carries for updates over the air. A scanner that
is out of step already says "UPDATE NEEDED" by the owner's decision.

Recommended: its own repository, checked against the definition the
engine publishes with each release.

**(c) Where the engine's repository starts.** In a new repository
created now, or in one folder of today's parent repository, lifted out
when the engine is released.

- A folder in the parent keeps everything in one place during the
  build. But `backend/.env`, with a live secret, is a tracked file
  there today, not only in the history; the parent's checks run every
  old flow on all four combinations at every push, with no filter by
  path; two backends, two GM scanners and two player pages would sit
  side by side in one checkout for months; and lifting the folder out
  later rewrites its history and breaks every link to it.
- A new repository starts clean: no secret, nothing of ALN's, no old
  program beside the new one, its own checks. It is ready to be made
  public when the release block says so. Its costs: two repositories
  during the build, with the reference code and this pass's records in
  the old one (the decision notes and the glossary are copied into the
  new one); a moved file loses its line-by-line history unless it is
  imported with it, so each move names the commit it came from; issues
  for the new engine live in the new repository.

Recommended: a new repository, created now. Today's parent stays as it
is, with blue's branch and the reference code. What it becomes after
the cutover (ALN's own repository for its settings and tools, or an
archive) is decided in the cutover plan. The pull request rule of
2026-09-12 (one per touched repository) becomes one per change.

## 4. ALN's report pipeline

- It is two programs of ALN's on the director's computer, outside the
  kit: the Director Console and the emailer, in the `aboutlastnight`
  repository under `reports`. The owner decided on 2026-11-01 that
  they stay separate and read the engine's record, and that becoming
  ALN's own part of the engine's review stage stays open.
- Today the console takes the report text the GM downloads from the GM
  scanner. The owner ruled on 2026-08-29 (the phase 3 program, section
  13.4) that the report's structure is fixed in the engine, its
  wording comes from the pack, and there is no template language; the
  ★ is a delimiter the console's parser depends on. **The first
  writing put the report's layout in ALN's pack. That contradicted the
  ruling and is withdrawn.**
- In the new engine the report stays what the owner ruled: fixed
  structure, the pack's wording. It is made from the session's record.
  It then also works in a game with no backend, where today it is "not
  supported".
- For the detail of a sale ("5★ Technical, $150,000 × 5x") the record
  has to keep what a formula read, not only its result. It will.
- The check is not "byte for byte against old downloads". Old reports
  print times in the timezone of the device that made them, and print
  adjustments nine hours off on some sessions, a fault that goes away
  when every line is stamped by one clock. The check is two things:
  the report's format, pinned on made-up records as the golden master
  does today; and the same final scores on real sessions.
- The file the record is handed over in is the session bundle whose
  schema the engine already has (decision B9), revised to the record's
  shape. One format, not two.
- The capture (roster, notes, photos, the accusation) is part of the
  record by the owner's decisions (`docs/adr/0002`, `0003`). The
  roadmap builds it in the capture block, after the build half. So at
  the cutover the director still types those into the console.
- Moving the console to read the record is at the owner's pace
  (roadmap row 8.10).
- Open, the owner's, and not needed for this decision: whether paper
  documents join the pack.

## 5. What in these repositories is ALN's

| Today | What it is | Where it goes |
|---|---|---|
| `ALN-TokenData`: tokens, rules, cues, strings, theme | ALN's pack | ALN's pack, its own repository; its rules rewritten |
| `ALN-TokenData`: the six schema files | the engine's definition of a pack | the engine |
| `ALN-TokenData`: the tag-writing and check-in tools | engine tools | the engine, rewritten |
| `aln-memory-scanner/assets`: 131 pictures and sounds, 37 MB | ALN's media | ALN's media, outside the engine and outside any pack (roadmap section 2.3) |
| `backend/public`: tracked sounds, fonts, loop pictures | ALN's media and look | ALN's media |
| `scripts/`: the Notion sync, the picture generator | ALN's content tools | with ALN's pack; today the sync loads the two list builders and writes to fixed paths in this tree |
| `scripts/`: the two list builders | engine tools, one of them a second copy of a backend script | the engine, as one builder |
| `scripts/gvoice-autoreply` | ALN's phone auto-reply for the game | ALN's; its guide holds a real phone number |
| `backend/config`: ALN's installation profile, playlists, audio routes | ALN's installation settings | the installation's data |
| `aln-memory-scanner`: the QR codes, `sync.py` | ALN's | with ALN's pack |
| `backend/scripts`: the post-session checks | an engine tool | the engine, rewritten to read the record |
| `.claude/`: the Notion skill, the session report command, the ALN agents | ALN's working tools | ALN's |
| The six component guides, `docs/SCORING_LOGIC.md` | half engine, half ALN | rewritten for the engine; ALN's part to ALN |
| The firmware's `sd-card-deploy`, `sample_config.txt` | set-up for a scanner | with the firmware |
| `aboutlastnight/reports` | ALN's report pipeline | stays |
| The toy packs | the engine's own test games | the engine; one scored its own way |
| `docs/`: plans, decisions, glossary | about the engine | this pass's records stay; the decision notes and glossary go with the engine |

Before anything is made public, the documents need a sweep for private
details.

## 6. The cutover and going back

The roadmap's section 6 (owner, 2026-08-29) says the cutover is a swap
of computers, "scanners, tablets, and hardware scanners never notice
the machine changed", and going back is "physical and immediate: swap
back to blue". Three decisions of 2026-11-13 change that, and the
agent did not say so when they were made:

- The hardware scanners are flashed with new firmware. Blue cannot
  talk to them. Going back means flashing each one back by USB.
- Tags are rewritten with the link first. Blue's firmware reads only a
  tag with the id first.
- Every device gets a credential from the new backend.

Rehearsals at the venue (the roadmap's stage C: swap in green, test
with the real kit, swap back) are touched the same way: the real
hardware scanners cannot serve both.

What keeps a way back, to be designed in the cutover plan and
confirmed by the owner there: the new firmware reads tags written
either way, so the tags are rewritten only once the owner calls the new
engine good; some scanners stay on the old firmware until then; a
venue rehearsal uses spare scanners.

## What is asked of the owner

1. Beside or in place, program by program (section 2).
2. The repositories: (a) one for the engine's web programs; (b) the
   firmware in its own; (c) a new repository created now (section 3).
3. A need: session files from blue, the report downloaded for each,
   and which pack and commit each ran.
4. To know, and to correct if wrong: going back to blue after the
   cutover is no longer a swap of computers (section 6); and one
   decision of the owner's comes before the first version: how a
   device is added to a kit (section 1).

## The review's fourteen findings, and what each changed

By one independent reader (a strong model one step below the session's
own, at high effort), 2026-11-13. All fourteen were accepted, in whole
or in part.

1. The report's layout was put in ALN's pack, against the owner's
   ruling of 2026-08-29. Section 4 corrected.
2. "Byte for byte from a recorded session" cannot be met. Section 4:
   the check is split, and the need from the owner is widened.
3. The first version depends on designs that do not exist. Section 1
   lists four, one the owner's.
4. "Moved across" held code that must be rewritten, and left modules
   unclassified. Section 2's table.
5. The table of ALN's things left out the media and several tools.
   Section 5.
6. Three things were given to the engine as if unchanged. Section 5
   marks them rewritten.
7. The first version skipped the hardest cases and its firmware check
   could not pass. Section 1: steps 6, 8, 10 and 11.
8. Nothing on going back after the cutover or on the repositories'
   fate. Section 6, and section 3(c).
9. The costs of "one folder, lifted out later" were missing. Section
   3(c), and the recommendation changed to a new repository.
10. The capture and the bundle schema were missing. Section 4.
11. The test bench dropped the rig the owner decided on. Section 1.
12. The claim about the build tool and a workspace was wrong. Section
    3(a).
13. The firmware reasoning understated the move. Section 3(b), and the
    recommendation changed to its own repository.
14. In place was not put evenly, with no middle option. Section 2:
    program by program, the consequence of in place named, the pending
    cases list.
