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
