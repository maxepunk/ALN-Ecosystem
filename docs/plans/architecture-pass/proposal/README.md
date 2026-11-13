# The architecture proposal (2026-11-10)

`index.html` is the proposal the owner reads, published in place of the
old site at https://claude.ai/artifact/RzL2FzCZ4eESSNMYwkkKPL. It is
the single source: there is no second copy of its text. Each
change's "Where this is in the code" list holds its evidence.

How it was made, following the skill `improve-codebase-architecture`:

1. The agent read what the engine is supposed to be
   (`../rework/2026-11-10-what-the-engine-is.md`) and the code maps of
   2026-11-01 (`../2026-11-01-engine-shape.md`, `../relationships/`),
   and checked the claims it used in the code itself.
2. It wrote a first draft of seven changes (in git history at
   `1bae2452`: `2026-11-10-proposal-draft.md` and the first
   `index.html`).
3. Three independent readers challenged the draft with the code in
   front of them: `challenge/1-code-truth.md`,
   `challenge/2-purpose-fit.md`, `challenge/3-alternatives.md`. The
   agent checked every line they cited before using it.
4. The agent rewrote the proposal.

The seven changes, as the page titles them:

1. The backend keeps one complete record of each session, and updates
   every screen from it the same way.
2. A standalone game runs the same game code as a networked one.
3. The messages between the backend and the devices are defined in one
   place and checked automatically.
4. Video, music, sound and lights are controlled through one pattern,
   and their programs restart when they crash.
5. The engine keeps separate what belongs to one session, to one
   installation and to the whole production.
6. A designer writes a game's rules in the pack, and the code has a
   known place for each new capability. (Until 2026-11-13 this read
   "the code has a known place for adding a new kind of rule,
   equipment or screen", with a new way of scoring as a developer's
   file. The owner corrected that: `docs/adr/0011`.)
7. A test or a rehearsal can run on the backend's computer without
   disturbing a live session.

The wording. Version 12 of the page (commit `2f5989f8`) named the
changes with made-up labels ("one way in, one record, one way out",
"the same core runs wherever a game is decided", "a stated life for
every fact") and used names made up for the earlier site (show machine,
GM tablet, design tool). The owner said the descriptions had drifted
into jargon and were ambiguous
(`../rework/2026-11-10-owner-step-back.md`, last section). Version 13
(commit `ae6209f5`) says each change as a plain sentence and uses the
names the owner and the glossary use: backend, GM scanner, player
scanner, scoreboard, config tool, pack, kit, installation, production,
session, standalone, networked. Keep to those names.

What the challenge changed:

- Thirteen "today" claims were corrected. Among them: scans and
  commands reach the backend through six entry points, not three;
  sixteen rules are written a second time in the scanners and the
  scoreboard, not eighteen; five hand-written lists of steps, not two;
  the installation profile does declare an installation with no
  backend, though no device reads it; build-time contract tests exist;
  the hardware scanner runs no game rules.
- The first draft's changes 1 (the session's data) and 4 (how requests
  come in) became one, now change 1. Its change 2 (the rules) became
  "a standalone game runs the same game code as a networked one",
  because the GM scanner's own copy covers how the session's data is
  kept, not only the rule functions.
- A record that only grows became the recommended choice inside
  change 1.
- The table of what happens when a session starts and ends widened to
  change 5: what belongs to a session, an installation and a
  production.
- Change 6 (a known place for adding a new kind of rule, equipment or
  screen) was added, as worth exploring.
- Change 7 gained "assembled in one place", and its cost was
  corrected: it is not small.
- Stand-ins for a rehearsal are the ratified kind (an ordinary
  installation profile pointing the real programs at stand-in gear),
  not fake drivers.
- What keeps the programs running became a choice inside change 4,
  with one day of testing on the new backend computer.
- The order changed: changes 4 and 7 first; changes 1 and 2 gone
  through with the owner meanwhile, then built as one small working
  piece, in the backend and inside a standalone GM scanner, with the
  second game's taps as test cases.
- Costs are stated on every card.

Left out on purpose, and why:

- Generating code from the message definition: tests against it and a
  version number first; generation where it saves work.
- Rule tables for the hardware scanner: it runs no rules. Its replies
  carry what to show.
- A standalone game with player scanners only has nothing that gathers
  a session's record. That is true today and is a choice for later.
- Sending each device only the part of the pack it may read, and a
  game as one installable thing with its media, are named under
  changes 1 and 5 and not designed here.

What the owner's eight comments changed (version 14, 2026-11-12). The
comments, the earlier decisions they rest on, a trace of what a backend
restart does today, and the list of changes are in
`../rework/2026-11-12-owner-comments-on-proposal.md`. In short: blue
runs every ALN session until the new engine is finished, and then there
is one cutover; the work is ordered design first, hardest to reverse
first, then build; "what keeps the programs running" was already ruled
by the owner (the backend does) and is no longer shown as a choice;
changing packs without restarting the backend is not required by this
plan; change 6 is designed from the 28 extension cases, not from the
second game; change 7 is about a test or rehearsal copy leaving the
installed backend as it was, between sessions.

Two owner questions the proposal does not decide: what a GM may tell a
team while their GM scanner has no connection; what a device that
missed a software update may do. (A third, where a rehearsal may run
while a session is live, was answered by the owner: no real situation
needs it.)

The owner confirmed the picture and the order on 2026-11-13, decided
that the session record only grows, and resolved the comments. The page
(version 15) is now the plan, and its last box says where we are. The
design conversation, one topic at a time, is recorded in `../design/`.
