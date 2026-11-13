# The owner's eight comments on the proposal page (2026-11-12)

The owner left these on version 13 of the page
(`../proposal/index.html` at commit `ae6209f5`). They are in page
order. Each is word for word, with the text it was attached to. None of
the threads was sent to Claude, so they cannot be answered or resolved
in the thread: the answers went into the page and the chat.

Read this before changing the proposal's order of work, or anything on
it about blue, green, restarts, applying a pack, extension or tests.

## The comments

**1. On change 3, "What it costs"**: "While the old backend computer
stays as the fallback, the scanners have to work with both the old
backend and the new one."

> This is assuming a gradual migration instead of running the ALN games
> on the old backend and old scanners until the backend and scanner
> updates are complete and ready for a complete cutover to the new
> engine all at once. This assumption is incorrect.

**2. On change 4, the choice**: "One day of testing on the new backend
computer would settle it."

> This feels like putting off a decision and predicating it on a vague
> notion of 'testing' instead of making a choice based on best
> practices for a maintainable architecture. It also handwaves other
> consequences of a backend restart mid-game in the name of 'keeping
> music and video playing while the backend restarts' without
> considering whether that's really a worthwhile value added to the
> system for real-world use case scenarios.

**3. On change 5, "What it costs"**: "Updating a pack without a restart
is a large job by itself,"

> I'm not entirely clear about the value added by the requirement of
> updating a pack without a restart.

**4. On change 6, "Why I am less sure"**: "These places should be
designed from what the second game really needs, written first as
tests. Designing them from ALN alone would be guessing."

> I agree, but also I think there might be a better way of framing this
> given the goal is a game engine that allows for all kinds of
> different games to be designed and thinking based on what a 'second
> game really needs' then just constrains the capabilities of the
> engine to ALN and a single hypothetical game instead of thinking
> about the game engine's capabilities and potential future extensions
> that become (relatively) easy to implement.

**5. On change 7's title**: "A test or a rehearsal can run on the
backend's computer without disturbing a live session"

> I don't fully understand what this requirement is REALLY about. I
> think you may be conflating the ability to run tests or rehearse a
> new game on a computer that is installed to run another game while
> that game is not actively running a session with being able to run a
> test or rehearsal in the middle of a game session that's being run by
> that computer. There's not really any use case scenarios that I can
> think of, realistically, which involve a rehearsal or test run
> happening SIMULTANEOUSLY with an active game session.

**6. On the order, steps 1 and 2**: "Start with changes 4 and 7, the
show-control side. They need no decision from you [...] Meanwhile, go
through changes 1 and 2 with you. [...]"

> This feels like false efficiency, we should not be sequencing the
> work based on what doesn't require decisions from me, but instead
> based on what is going to be the cleanest and most efficient sequence
> from an engineering perspective.

**7. On the order**: "Throughout, today's software keeps running ALN's
sessions, and the old backend computer stays as the fallback."

> Actually, the old backend computer (the one we dubbed blue) that is
> on the 'production' branch is the one that's going to be running ALN
> sessions until the work on this version of the engine is completed.

**8. On "What I need from you"**

> These don't seem like the right questions to ask given my note about
> sequencing above. It seems that you're making assumptions about how
> I'll be running ALN while we work on the new iteration of the engine
> which is coloring this question and your sequencing plan and we need
> to correct those assumptions.

## What the records already said

Four of the eight restate or rest on decisions the owner had already
made. The page went against them because the agent, when it retired the
old process on 2026-11-10, also stopped reading the owner's decisions
about order and about blue. Those decisions were never retired.

- Comments 1, 7 and 8. `docs/plans/CURRENT-STATE.md` section 1 (owner,
  2026-10-30): "The game keeps running on blue, the production machine,
  until the new engine is ready to swap in on green, the second
  machine. No date governs the work." `DECISIONS.md`, "The architecture
  pass is the work now": the paused hardening pieces wait for the
  pass's answers. `ROADMAP.md` section 6: the cutover is a hardware
  swap. The state page section 2: green has not been started. Section
  4: work on the new engine never touches blue's branch.
- Comment 6. `DECISIONS.md`, "One program: design half, then build
  half" (2026-10-30): the design half decides the shared rules with the
  owner; the build half then changes the engine one area at a time,
  starting with a thin first version running end to end; each area gets
  its detailed design just before it is built. And "Design top-down,
  hardest-to-reverse choices first" (2026-11-01).
- Comment 2. `docs/plans/2026-09-12-block2-hardening-plan.md`, rulings
  R6, R13, R18 and R20 (owner, 2026-09-12): the supervisor ships
  enabled; a host file gives each program the mode `self` (the backend
  starts and supervises it) or `adopt` (something else on the host runs
  it; the backend attaches and never restarts it); one supervision
  path, with the TV browser on it too. `CONTEXT.md` section 4,
  "Supervisor": an engine component. The page's "choice" reopened this
  and recommended the opposite.
- Comment 3. `ROADMAP.md` section 2.4 (owner, 2026-08-29): the design
  loop is edit, apply, playtest, and "hot-apply (reload a pack without
  restarting the orchestrator)" is what makes it fast. Its landing slot
  is the mechanics editor (row 8.6). The page named the requirement
  without saying what it was for.
- Comment 4. `../requirements/2026-11-01-extension-cases.json`: 28
  cases of how the platform must be able to grow, each with who does
  it, what they touch and what they must not need to touch. Two are the
  owner's own examples (lighting changed by scanning tokens; audio in
  several rooms).
- Comment 5. `DECISIONS.md`, the nine questions: "Only the live engine
  touches the show: can anything other than the live engine touch the
  live show (tests today, the preview engine later)?" Decision E7
  (2026-06-10): the config tool is pre-show only. The need is that a
  test or rehearsal copy leaves the installed backend and the real gear
  as they were. It was never about running beside a live session.

## What a backend restart in the middle of a session does today

Read from the code on 2026-11-12 for comment 2 (a helper traced it; the
agent then checked the lines marked "checked" itself). Nothing was run.

Comes back:

- The session: status, teams, transactions, scores, player scans
  (`backend/src/services/sessionService.js:108`, checked).
- The game clock. The time the backend was down counts as game time
  (`services/gameClockService.js:218`, checked).
- Which cues already fired. A clock cue that came due while the backend
  was down is marked fired and never runs (decision E1;
  `services/cueEngineService.js:1107`).
- The Bluetooth speaker stays connected. Audio routes and volumes
  reload from disk.

Does not come back:

- Every GM is logged out: valid logins live in a memory-only set
  (`middleware/auth.js:13`, checked). The login box then calls
  `selectGameMode`, whose `setMode` throws "Cannot change session mode
  after it is locked" (`ALNScanner/src/app/app.js:188` and `:422`,
  `ui/connectionWizard.js:407`, `app/sessionModeManager.js:30`,
  checked by reading). Reloading the page gets back in. A reload can
  wipe scans the GM scanner had queued
  (`network/networkedSession.js:250`, not checked).
- Blue's own code has the same path (`production-2026-07`, GM scanner
  tip `56fbff8`, read only, checked). The owner was told in chat.
- Music: the player is stopped with the backend and nothing starts it
  again (`services/musicService.js:95`, checked: no restore call).
- The TV's mode goes back to the idle loop
  (`services/displayControlService.js:31`, checked).
- A compound cue part-way through its timeline stops there
  (`services/cue/timelineRuntime.js:63`, checked). Held items are gone
  (`services/heldItemsStore.js:40`, checked). The video queue is gone.
- Hardware scanners believe they are still connected for 30 to 70
  seconds (`OrchestratorService.h`, not checked).

Also found:

- A restart re-reads the pack. A session restored under a different
  pack only logs a warning (`sessionService.js:113`, checked).
- A session that had ended comes back as the current one (not checked).
- The "out of service" mark is kept only in memory on purpose
  (`services/dormancyService.js:8-16`: "a process restart is a fresh
  look at the room"), and no command sets it today (only
  `service:check` has a case in `commandExecutor.js`, checked). Version
  13 listed its loss as a weakness. That was wrong and is removed.

## What changed on the page (version 14, version id 1794528649-c01e)

1. A box near the top says how ALN runs while this work is done: blue
   runs every session; nothing reaches a live session until all of the
   new engine is finished; one cutover, with green replacing blue and
   the hardware scanners re-flashed.
2. Change 3's cost no longer assumes the scanners work with both
   backends.
3. Change 4 no longer shows "what keeps the programs running" as a
   choice, and the "one day of testing" is gone. It states the owner's
   ruling, says what a restart does today, and proposes one way back: a
   restart follows the same steps as a normal start, then the show is
   put back from the session's record.
4. Change 5 no longer requires changing packs without restarting the
   backend. It says what that was for (the designer's loop), keeps
   "every device is told when a new pack is applied", and adds "a
   session keeps the pack it started with".
5. Change 6 is designed from the 28 extension cases, each place checked
   against at least two cases and against what an addition must not
   need to touch. Today's parts are the first of each kind. Its
   recommendation is now "Recommended".
6. Change 7 is about a test or rehearsal copy leaving the installed
   backend as it was, between sessions. Sharing the TV and the players
   with a live session is dropped. Its third proposed line: only one
   copy at a time uses the real gear.
7. The order follows the owner's decisions: design how the backend
   keeps a session's data (changes 1 and 5); the messages and files
   (3); which device decides what (2); how the engine is extended (6,
   with 4 and 7); how today's code moves to the new design; then build
   a thin first version end to end; then one area at a time; then one
   cutover.
8. The questions for the owner: is the picture of how ALN runs now
   right; is the order what they meant; then start step 1 with the
   choice inside change 1.
9. The third product question (where a rehearsal may run during a live
   session) is gone: the owner's comment 5 answers it. Two remain.

## For the next agent

- Before showing the owner a "choice", look for a ruling: the table at
  the top of `docs/plans/2026-09-12-block2-hardening-plan.md`,
  `DECISIONS.md`, and `CONTEXT.md`. Two of these comments exist because
  a ruled matter was reopened.
- The owner's decisions about order and about blue stand. Only the
  heavy process around them was retired on 2026-11-10 (the site, the
  panel, competing designs for every round).
- Never order work by what needs no decision from the owner.
- A claim that something is a weakness needs a check that it is not on
  purpose. Read the comment at the top of the file.
