# Kickoff brief: the whole-engine architecture pass (planning session)

Written 2026-10-30 for the next session's orchestrator. Your first job
is a planning session with the owner, the "definition session" a unit
gets before its design opens (`docs/plans/ROADMAP.md` §10.3). Nothing
is built until it ends. Vocabulary: `CONTEXT.md`. Process:
`docs/agents/process.md`, including §5 on working with the owner.

## Steps, in order

1. **Bootstrap.** From the ALN-Ecosystem root, run
   `CLAUDE_PROJECT_DIR="$PWD" bash .claude/hooks/session-start.sh`. It
   sets up the submodules, the dependencies and the declared plugins.
   Then check this session's skill list for `grill-with-docs`,
   `wait-what`, `codebase-design` and `improve-codebase-architecture`.
   If they are missing, the plugin was installed during this session
   and registers only at the next one. Recommend that the owner restart
   the session before the planning session starts. Until then, read
   each skill's `SKILL.md` from
   `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/`
   and follow it by hand.
2. **Reload.** Run `docs/agents/process.md` rule 6, starting at
   `docs/plans/CURRENT-STATE.md` §0. Keep your working log at
   `.superpowers/sdd/2026-10-30-architecture-pass/progress.md`. You are
   done when every claim on the state page has been checked against git,
   and you have confirmed that nothing is running.
3. **Read the evidence** listed below, only the parts named. You are
   done when you can state each lesson theme in one plain sentence,
   with the file that shows it.
4. **Report to the owner** in the five-line checkpoint format of the
   hardening plan §8: what landed, what is in flight, what is blocked
   and on whom, what the GM has if we stop here, and open risks. Follow
   it with the recommendation on the table and the questions the
   planning session will settle. Change no file before the owner has
   this report.
5. **Run the planning session** with `grill-with-docs`. Settle every
   open question below. Record each term in `CONTEXT.md` as it
   settles, and each decision on the state page as it is made.
6. **Write the pass's program document** from the answers, at
   `docs/plans/<ratification date>-architecture-pass.md`. It covers
   scope, method, evidence readers, outputs, and how the pass revises
   the roadmap. Submit it to the owner for ratification.

The session is complete when the owner has ratified that document and
the state page names the pass as the current unit, with its first
step. From step 5 on, commit and push after every step.

## The owner's direction (2026-10-30, the owner's words)

- "What's more important than triaging the production fixes in ASAP
  is to integrate the lessons that may be learned into our updated
  engine architecture."
- Scope of the pass: "the whole engine."
- "I want to avoid overly fixating on making patches to the production
  build when our roadmap includes or at least is intended to include
  cleaning up the architecture and interfaces involved with anything
  that may be a problem during the runs on the current version of the
  software on blue."
- "It seems potentially backwards to do a hardening pass before a
  truth sweep."
- "No date that matters. We're going to be continuing to run the game
  off of blue until the new engine is ready to be swapped in on green."
- No game data from the run is coming off blue.

## The recommendation on the table (proposed, not ratified)

The orchestrator's assessment, given to the owner on 2026-10-30:

- **The hardening block** has real architecture at its core: the "one
  truth" rule (`CONTEXT.md` §2), a single supervision path for every
  program the engine starts, and the rules for which credential opens
  which door. But it was run as a deadline race of task-sized changes.
  When its own adversarial pass found the core breaking its principle,
  the response was a list of patches.
- **The truth sweep** is patch-shaped by charter: "fix every place the
  panel shows something false", with the score, transaction and
  session screens left out (`docs/plans/ROADMAP.md` §4, Block 3).
  Blue's review found its worst defects on exactly those screens.
- **The order's recorded reason** was that the sweep's tests should
  lock in the final health states (healthy, down, dormant). The
  dormancy core already landed them, so that reason is spent. Most of
  the remaining hardening pieces put new state on the GM's panel, so
  the dependency now runs the other way.
- **The gap:** "one truth" governs readiness only. The runtime state
  the GM watches has no rule like it.
- **Recommendation:** make the whole-engine architecture pass the next
  unit. Its central question: should "one truth" extend to runtime
  state? That would mean one owner per fact in the engine, one
  delivery path to every screen, a reload that uses the live path, and
  a scanner that replaces its copy instead of adding to it. The
  remaining hardening pieces and the truth sweep would be re-planned
  from the answer.

The owner replied "great" and moved on to the handoff. Treat the
recommendation as accepted in spirit, not ratified: the planning
session confirms or changes it.

## Evidence (read the named parts only)

- **Blue's lessons.** On branch `production-2026-07`, read with
  `git show origin/production-2026-07:<path>`:
  - `docs/plans/2026-09-15-alnscanner-wiring-review.md`: the
    executive summary and the owner triage. Its root pattern: "the
    client mirrors backend state … and the mirror has add-only or
    one-shot update paths."
  - `docs/plans/2026-09-15-alnscanner-wiring-fixes-plan.md`: section
    W10, covering the video status parser (P1), the shared process
    files (P2), leaked test processes and the 2026-09-18 incident in
    which a test helper killed the desktop session (P3), and the
    kiosk-off switch (P4). Section W9 covers the guard that trusts the
    video's live position.
- **Which of the defects blue fixed are still in the new engine:**
  `docs/plans/2026-10-30-production-fixes-triage.md`. It covers the
  fixes only, not the findings blue left unfixed, and it is evidence,
  not a list of fixes to copy.
- **Our own findings:** `docs/plans/2026-10-30-recovered-review-findings.md`
  §1, the conclusions and standing findings 1 to 4. They show one
  unknown equipment name getting three answers on three code paths,
  and one display state classified both healthy and down.
- **The owner's live-run issue:** the GM panel does not keep up with
  live music playback without a refresh. The music service and the
  panel's music section are identical to July on the new engine, but
  the path between them has changed, so the defect is expected there,
  not shown. It needs a live reproduction on the test rig.
- **A doc that disagrees with the code:** root `CLAUDE.md` says no
  service keeps its own connection flag; `musicService.js:73` and
  `:231` still do.
- **The doctrine:** `CONTEXT.md` §2 (one truth, three loops), §4
  (dormant vs fault, alarm integrity, status with verbs, self-heal,
  supervisor, service domain), §5 (endpoints vs stack, preflight,
  paper vs live); `docs/plans/ROADMAP.md` §1 and §2.
- **The roadmap's own census of the panel's paths:**
  `docs/plans/ROADMAP.md` §4, Block 3.

## Lesson themes to test

1. **State ownership.** The scanner keeps its own copies of backend
   state, and those copies mostly only grow.
2. **Health and service state travel separately**, so one can change
   without the other. The music service still keeps a private
   connection flag beside the health registry.
3. **External programs are read by parsing their text output.** One
   message-splitting bug caused the long video stall. It was first
   blamed on the test harness; a venue run disproved that, and the
   bench then reproduced it every time.
4. **Tests share the machine with the live system:** the files that
   track running programs, the TV, and the running video and music
   programs.
5. **One question, several code paths, several answers.** This is the
   pattern our own adversarial pass found.
6. **Lifecycle ownership.** After a system reset, the display reads
   down until a later launch, exit or manual check reports it; no step
   of the reset re-checks it.

## Open questions for the planning session

1. Is the pass a roadmap revision, run the way the September
   re-charter was, or a unit inside the current blocks? The
   re-charter's records: `docs/plans/2026-09-04-roadmap-r4-draft.md`,
   `2026-09-04-recharter-audit-corpus.md` and
   `2026-09-04-recharter-audit-dependencies.md`.
2. What does the pass produce? Options include a target architecture,
   interface changes, decision records in `docs/adr/` (not created
   yet), and a revised block sequence.
3. Method: which parts of the system get an evidence reader?
   Candidates are the backend services and their adapters, event and
   state delivery, the GM scanner's state, the scoreboard and the
   player scanners, the config tool, and the test environment. Size
   every fleet: a two-lens red team with one refuter per finding cost
   about six million subagent tokens. Commit findings as they land.
4. What happens to the paused Block 2 work? The merged dormancy core
   and harness minimum stand. Which of the on-hold briefs survive the
   redesign?
5. Where does the truth sweep's boundary go, now that the excluded
   screens hold the worst defects?
6. How do lessons from future fixes on blue flow into the engine, as a
   standing step?
7. Green can take its home hardware test any time; the guide is ready.
   When does the owner want that test, and should the three small green
   follow-ups ship before it? Until they do, a correct green logs a
   false "WirePlumber rule missing" warning at every boot.
