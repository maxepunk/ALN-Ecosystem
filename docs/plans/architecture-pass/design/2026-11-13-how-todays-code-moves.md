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
