# Kickoff brief: the whole-engine architecture pass (definition session)

Written 2026-10-30 for the next session's orchestrator. Your first job
is a planning session with the owner. Nothing is built until it ends.
Vocabulary: `CONTEXT.md`. Process: `docs/agents/process.md`.

## Steps, in order

1. **Reload.** Run `docs/agents/process.md` rule 6, starting at
   `docs/plans/CURRENT-STATE.md` §0. You are done when every claim on
   that page has been checked against git, and you have confirmed that
   nothing is running.
2. **Bootstrap.** If the session started outside the project folder,
   run `CLAUDE_PROJECT_DIR="$PWD" bash .claude/hooks/session-start.sh` from the repository root.
   It sets up the submodules, the dependencies and the declared
   plugins. Then confirm the mattpocock skills include
   `grill-with-docs`, `wait-what`, `codebase-design` and
   `improve-codebase-architecture`. If they are missing, tell the owner
   which ones and carry on with `grilling` plus `domain-modeling`.
3. **Read the evidence** listed below. Read only the sections named.
   You are done when you can state each lesson theme in one plain
   sentence, with the file that shows it.
4. **Report to the owner** in the checkpoint template: where the
   program stands, the recommendation on the table, and the questions
   the session will settle.
5. **Run the definition session** with `grill-with-docs`. Settle every
   open question below. Record each term in `CONTEXT.md` as it
   settles, and each decision on the state page as it is made.
6. **Write the pass's program document** from the answers, at
   `docs/plans/<date>-architecture-pass.md`. It covers scope, method,
   evidence readers, outputs, and how the pass revises the roadmap.
   Submit it to the owner for ratification.

The session is complete when the owner has ratified that document and
the state page names the pass as the current unit, with its first
step. Commit and push after every step.

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
- No session data from the run is coming off blue.

## The recommendation on the table (proposed, not ratified)

The orchestrator's assessment, given to the owner on 2026-10-30:

- **The hardening block** has real architecture at its core: the "one
  truth" rule (`CONTEXT.md` §2), one supervision path, the credential
  rules. But it was run as a deadline race of task-sized changes, and
  when its own adversarial pass found the core breaking its principle,
  the response was a list of patches.
- **The truth sweep** is patch-shaped by charter: "fix every place the
  panel shows something false", with the score, transaction and
  session screens left out (`ROADMAP.md` §4, Block 3). Blue's review
  found its worst defects on exactly those screens.
- **The order's recorded reason** was that the sweep's tests should
  lock in the final health words. The dormancy core already landed
  them, so that reason is spent. The remaining hardening pieces all
  put new state on the GM's panel, so the dependency now runs the
  other way.
- **The gap:** "one truth" governs readiness only. The runtime state
  the GM watches has no rule like it.
- **Recommendation:** make the whole-engine architecture pass the next
  unit. Its central question: should "one truth" extend to runtime
  state? That would mean one owner per fact in the engine, one
  delivery path to every screen, a reload that uses the live path, and
  a scanner that replaces its copy instead of adding to it. The
  remaining hardening pieces and the truth sweep would be re-cut from
  the answer.

The owner replied "great" and moved on to the handoff. Treat the
recommendation as accepted in spirit, not ratified: the definition
session confirms or changes it.

## Evidence (read the named parts only)

- **Blue's lessons.** On branch `production-2026-07`, read with
  `git show origin/production-2026-07:<path>`:
  - `docs/plans/2026-09-15-alnscanner-wiring-review.md`: the
    executive summary and the owner triage. Its root pattern: "the
    client mirrors backend state … and the mirror has add-only or
    one-shot update paths."
  - `docs/plans/2026-09-15-alnscanner-wiring-fixes-plan.md`: the
    sections W9 and W10. They cover the video status parser, the
    shared process files, leaked test processes, and the logout
    incident.
- **Which of those defects the new engine still has:**
  `docs/plans/2026-10-30-production-fixes-triage.md`. This is
  evidence, not a port queue.
- **Our own findings:** `docs/plans/2026-10-30-recovered-review-findings.md`
  §1 conclusions and standing findings 1 to 4. They show one unknown
  equipment name getting three answers on three code paths, and one
  display state classified both healthy and down.
- **The owner's live-run issue:** the GM panel does not keep up with
  live music playback without a refresh. The music service and the
  panel's music section are identical to July on the new engine.
- **The doctrine:** `CONTEXT.md` §2 (one truth, three loops), §4
  (dormant vs fault, alarm integrity, status with verbs, self-heal,
  supervisor, service domain), §5 (endpoints vs stack, preflight,
  paper vs live); `ROADMAP.md` §1 and §2.
- **The roadmap's own census of the panel's paths:** `ROADMAP.md` §4,
  Block 3.

## Lesson themes to test

1. **State ownership.** The scanner keeps its own copies of backend
   state, and those copies mostly only grow.
2. **Health and service state travel separately**, so one can change
   without the other.
3. **External programs are read by parsing their text output.** One
   message-splitting bug caused the long video stall, and only venue
   hardware exposed it.
4. **Tests share the machine with the live system:** process files,
   the TV, the live players.
5. **One question, several code paths, several answers.** This is
   our own adversarial pass's pattern.
6. **Lifecycle ownership.** After a reset, nothing re-reports the
   display.

## Open questions for the definition session

1. Is the pass a roadmap revision, run the way the September
   re-charter was (evidence, a grill, ratified changes), or a unit
   inside the current blocks?
2. What does the pass produce? Options include a target architecture,
   interface changes, decision records (`docs/adr/` does not exist
   yet), and a revised block sequence.
3. Method: which subsystems get an evidence reader? Candidates are the
   backend services and their adapters, event and state delivery, the
   GM scanner's state, the scoreboard and the player scanners, the
   config tool, and the test environment. Size every fleet so it stays
   inside the usage limit, and commit findings as they land.
4. What happens to the paused Block 2 work? The merged dormancy core
   and harness minimum stand. Which of the on-hold briefs survive the
   redesign?
5. Where does the truth sweep's boundary go, now that the excluded
   screens hold the worst defects?
6. How do lessons from future fixes on blue flow into the engine, as a
   standing step?
7. Green can take its home hardware pass any time; the guide is ready.
   Does the owner want that hardware pass before, during or after the
   architecture pass?

## Working with the owner (recorded from the owner's words)

- Explain decisions by how the system behaves during a game, in plain
  language a product manager follows. No internal codes or jargon.
- Investigate before asking or asserting, and cite the files.
- Weigh downstream consequences: duplicate code paths and new debt
  count against a choice.
- State dependencies, never a schedule. The schedule is the owner's.
- Treat feedback as a reason to check the facts first, not to react.
- Put every decision made in conversation on the state page at once.
