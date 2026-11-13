# How today's code moves to the new design (design topic, opened 2026-11-13)

Status: with the owner. Two decisions asked on 2026-11-13. The topic is
settled when the owner has made them. It is the last topic of the
design.

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

## The owner's answers

(none yet)
