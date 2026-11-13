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

# The rework (2026-11-13, after the owner sent the decisions back)

The helper finished at 08:05 and its final file is committed
(`e9d77bf9`). The agent read all of it. Claims the agent checked itself:
the line counts; no append anywhere in `backend/src` and a session saved
whole, twice; the rules folder requires only its own files; no package
file at the root and no workspace; 14 files export a single shared
instance by the common spelling; `gameRules/scoring.js:51` and
`ALN-TokenData/game.json` (a mode picks `standard` or `none`, and the
bonus formula is a name); the folder sizes of the firmware's repository
(`du`: `ALNScanner_v5` 736 KB, `libraries` 86 MB, `test-sketches`
872 KB, `archive` 2 MB). The rest is the helper's.

## 1. What the "thin first version" is

The phrase is from the owner's decision of 2026-10-30 ("a thin first
version of the new design running end to end on a new test bench").
The proposal page gives it one sentence. This is the full meaning.

It is the smallest engine in which one token goes through every part of
the new design. It is not ALN with features missing.

What a person can do with it:

1. Start the backend on a laptop with a pack of three tokens.
2. Open the GM scanner's page on a phone, log in, choose an account and
   enter a token.
3. See the result on the GM scanner, and see the scoreboard page change
   on another screen.
4. Open the player scanner page from a link like the one on a tag, with
   no login, and see the token's picture.
5. Turn the phone's Wi-Fi off and enter another token. The result shows
   as "not confirmed". Turn Wi-Fi on. It becomes confirmed.
6. Stop the backend and start it again. The session, the scores and the
   login are back.
7. Open the GM scanner with no backend at all. The same verbs give the
   same scores, and the session's record can be saved.
8. A rule asks the room for a sound. A stand-in for the sound player
   gets the command. Stop the stand-in, and the backend starts it
   again.

What each step proves:

- 1 to 3: the record that only grows, with scores and screens worked
  out from it (`docs/adr/0001`); a designer's rules with a formula,
  worked out from the pack (`0011`); the one definition of the
  messages, checked against every program; the backend put together in
  one place.
- 4: a credential for each of the three kinds of device (`0004`); a
  device sent only what its kind may show.
- 5: the same rules code inside the GM scanner; "not confirmed" and
  handing over (`0007`).
- 6: restart from the record (`0010`).
- 7: a game with no backend (`0008`).
- 8: the one pattern for equipment, and the part that restarts a
  crashed program.

It runs on two packs: a toy pack scored its own way, and three of ALN's
tokens with ALN's two verbs written as pack rules. The second must give
ALN's numbers. Today's toy pack will not do: it is scored by ALN's
formulas (the facts file, section B, change 6).

What it leaves out: ALN's 81 tokens and their media, video, music,
lights, Bluetooth, audio routes, cues and timelines, held items, the
session and admin screens, the look of every page, the config tool, the
preflight, the report, the hardware scanner (its firmware joins in its
own area; the first version only checks that the firmware's messages
fit the definition), and updates over the air. Each is an area built
after it.

How it is checked: tests that drive it only from outside, through the
defined messages and the pages, doing the eight steps on both packs.
That set of tests is the "new test bench". It is the first of the
checks every later area adds to.

Why it comes first: a wrong joint in the design shows up here, when
changing it costs days. Every later area then adds one real thing to a
whole that already works, and none is built against a part that does
not exist yet.

## 2. Beside today's code, or in place

In place, fairly put. Today's backend and GM scanner are changed where
they stand, in stages: write the record beside the session object and
then read from it; take the shared instances apart file by file;
replace the messages one family at a time with every program changed
together; put the new rules code behind today's function names. At
every stage the branch holds a whole working engine, and every
behaviour of today's code is kept unless a stage removes it. That is
its real strength: nothing is forgotten by default, and the 26
end-to-end flows pass throughout.

Its costs here:

- Every one of the four central changes needs in-between states (two
  stores written at once, old and new messages side by side). Those
  states serve nobody: blue runs ALN, and nothing has to stay
  compatible.
- About 100 unit test files, 38 integration files and 33 of the 34
  message test files are tied to the inside or to today's messages.
  They must be kept passing or rewritten at every stage.
- The shared rules code needs a new home that both programs can load,
  whichever way is chosen.
- It starts from ALN's shape (accounts, transactions, one score, modes,
  named formulas) and widens it. The owner named that bias on
  2026-11-13. Starting from the general model (verbs, effects, the
  record) and writing ALN as its first pack is the surer way to an
  engine that is not ALN-shaped.

Beside, exactly. A new structure is built in new folders, starting with
the first version above. It is not a rewrite of everything.

- Written new: the session's record; the code that works a game's
  rules out from its pack; the definition of the messages and files and
  the checks against it; credentials; the one place of assembly; the GM
  scanner's store.
- Moved across and fitted, with their tests: the part that restarts a
  crashed program; the health words and the "not installed" work from
  September; the check that refuses a broken pack; the installation
  profile and the comparison of needs with what is installed; the seven
  equipment modules (their knowledge of the video player, the music
  player, PipeWire, BlueZ, Home Assistant and Chromium is the code with
  the most hard-won fixes); the stand-ins for gear; the GM scanner's
  tag reading, pack loading and screens; the player scanner page's
  display; the config tool's pages and its draft and publish.
- Changed where it stands: the hardware scanner's firmware.
- Replaced, not moved, although built since July: the mode flags and
  named formulas (by a designer's rules), the session store, the
  message contracts and their 259 test cases, the command switch of 64
  cases.
- Today's code stays in the repository unchanged, as the reference,
  until the cutover. Blue's branch keeps it after that.

Its risks, and what answers each:

- A fix nobody wrote down is lost. Answered by: moving the equipment
  code and not rewriting it; a list made before each area from the
  flows, the audit against real players, the "CRITICAL" notes in the
  components' guides, the cause analysis and the triage of blue's fixes
  (`docs/plans/2026-10-30-production-fixes-triage.md`); recorded ALN
  sessions that must give the same scores and the same report text.
- No recorded session is in the repository (the facts file, section E).
  They are on blue, in `backend/data/`. **Needed from the owner:** a
  few session files from real ALN sessions, copied off blue.
- A long time with no whole. Answered by the first version and by
  building one area at a time into it.
- A fault fixed on blue during the build never reaches the new engine.
  Answered by: each fix on blue adds one check to the new engine's
  tests.

Recommended: beside.

## 3. One repository or several

What the design needs whatever the layout: one definition every
program is checked against; one source for the rules code, built for
the backend and for the GM scanner; one engine version that says what a
kit can do, reported by each device when it connects; the backend
holding the firmware file that matches it (`docs/adr/0006`); packs
outside the engine; ALN's own tools reading the engine's public files.

Three layouts:

- A. One repository for the whole engine: backend, GM scanner, player
  scanner page, scoreboard, config tool, firmware, the rules code, the
  definitions, the tag tools. Packs and ALN's tools outside.
- B. As today: a repository for each program, joined by pinned links,
  with the rules code and the definitions as one more repository or as
  published packages.
- C. A with the firmware left in its own repository.

Operation (running kits):

- A: a release is one commit. From it come the backend, the pages it
  serves, the firmware file it offers over the air and the standalone
  pages. Updating a kit is installing one release; going back is
  installing the one before. B: a release is a set of pins across five
  repositories. Today three checkouts of the pack data sit at two
  commits, and the guide has a section on detached checkouts. A wrong
  mix would be caught when devices connect, but it can be built. C: one
  version plus a pinned firmware version.
- The standalone pages. Today each scanner's repository publishes its
  own page on every push. A standalone page needs a pack, so its
  publishing belongs to the production (an engine release plus a pack)
  in every layout. A moves that publishing out of the scanner
  repositories. That is work.
- The cutover is the same in every layout. Blue uses today's
  repositories and its own branch until then.

Maintenance:

- A change to a message touches the definition, the backend, the GM
  scanner, the player scanner page, the firmware's message builder and
  the tests. A: one commit, one review, and one run of the checks sees
  every program. B: a commit in each repository and then the pins,
  merged in a set order (the "PR train" of 2026-07-17); between merges
  the programs disagree; each repository's own checks cannot see the
  others (the GM scanner's cannot see the message files today).
- The rules code. A: both programs load one folder (the build tool's
  two limits, converting only installed packages and serving only its
  own tree, are both met by a workspace). B: publish a package on every
  change, or nest a repository in each program (which is how the pack
  data came to sit at two commits), or copy (today).
- Costs of A: a bigger repository; the checks must run only what a
  change touches, or every change waits for everything; the firmware's
  tools join the same checks.
- The firmware. Its repository holds 86 MB of copied libraries and no
  workflow compiles it. Moving it in means declaring those libraries
  and compiling it in the checks. That work is owed in any layout, and
  A or C only decides where it happens.
- Agents do most of the work here. Five side-by-side repositories with
  nested copies have already needed standing rules ("never read the
  stale clones").

Extension:

- A developer adding a capability (`docs/adr/0009`) may touch the rules
  code, a backend module, a GM scanner screen and the definition. A:
  one repository to copy, one change to offer back. B: several
  repositories and their pins.
- Another production adopting the engine needs an engine release, its
  own pack and its own installation settings. In A the line is clear:
  the engine's repository holds nothing of any game.
- Someone building other hardware against the engine needs only the
  definition. In every layout it can be published as a file with each
  release.
- What B gives that A does not: a person can be given one program
  without the rest, and each program can have its own release rhythm.
  Neither is wanted here: the programs cannot run across versions.

What can be undone. A repository can be split later with its history,
and several can be joined later. Neither is cheap once the new code
exists, so the time to choose is before it is written.

One thing to settle with it. The parent repository's history holds a
live secret (`backend/.env`), which the roadmap already says must be
swept before any public release. If the new engine lives in one folder
that holds nothing of ALN's and no secrets, that folder can become the
public repository at the release block with a clean history. So: build
it inside today's parent repository now, in one folder, and lift it out
at release.

Recommended: A, built in one folder of today's parent repository. The
firmware is the least certain part; C is a fair second choice.

## 4. ALN's report pipeline

From `../2026-11-01-after-game-report.md` and the owner's answers of
2026-11-01.

- It is two programs on the director's computer, outside the kit: the
  Director Console and the emailer. Their code is in the
  `aboutlastnight` repository, folder `reports`. They are ALN's, and
  the owner decided they stay separate and read the engine's record,
  with becoming ALN's own part of the engine's review stage kept open.
- What it takes from the engine today: the report text the GM downloads
  from the GM scanner when a session ends, pasted into the console and
  parsed. The roadmap pins that text byte for byte (row 8.10) until the
  owner moves the console to the structured file. Memory texts come
  from Notion, not from the pack the session ran.
- In the new design the engine's side is the session's record, which
  carries the pack it ran and the texts players saw (the owner,
  2026-11-01). The record is handed over as a file in the defined
  format. That file is the console's future input.
- At the cutover the console must keep working unchanged. So the new
  engine still gives the GM the same report text, made from the record,
  and "the same text, byte for byte, from a recorded session" is one of
  the checks before the cutover. The layout of that text is ALN's and
  belongs with ALN's pack, not in the engine's code.
- Moving the console to read the record stays at the owner's pace.
- Repositories: the pipeline stays where it is. It needs the definition
  of the record's file, which each engine release publishes.
- One fault it works around goes away: sales stamped by the GM
  scanner's clock and adjustments by the backend's, nine hours apart on
  two sessions. In the record every line is stamped the same way.

## 5. What in these repositories is ALN's, and where it goes

| Today | What it is | Where it goes |
|---|---|---|
| `ALN-TokenData`: tokens, rules, cues, strings, theme | ALN's pack | stays ALN's pack, in its own repository |
| `ALN-TokenData`: the five schema files | the engine's definition of a pack | the engine |
| `ALN-TokenData`: the tag-writing and check-in tools | engine tools | the engine |
| `scripts/`: the Notion sync and the picture generator | ALN's content tools | with ALN's pack |
| `scripts/`: the asset list and pack list builders | engine tools | the engine |
| `backend/config/profiles/aln-full-kit.json`, the playlists, the audio routes | ALN's installation settings | the installation's data, outside the engine's code |
| `aln-memory-scanner`: the QR codes, `sync.py` | ALN's | with ALN's pack |
| `backend/scripts`: the post-session checks | an engine tool that reads a session's record | the engine |
| `aboutlastnight/reports` | ALN's report pipeline | stays |
| the toy packs | the engine's own test games | the engine |
| `docs/`: the plans, decisions and glossary | about the engine | the engine; ALN's running notes go with ALN |

## What is asked of the owner

1. Beside, or in place (section 2). Recommended: beside.
2. One repository, several, or one with the firmware apart (section
   3). Recommended: one, in one folder of today's parent repository.
3. Not a decision, a need: a few session files from real ALN sessions,
   copied off blue.

