# Current state — the entry point (one screen, edited in place)

Read this first after any compaction, restart or new session. Nothing
else is required reading: the pointers at the bottom say what to open
and when. Check every claim of a summary against git and this page
before acting.

## 0. Resume here (2026-10-30)

- **The current unit** is a planning session with the owner that
  defines the whole-engine architecture pass. Its brief:
  `docs/plans/briefs/2026-10-30-architecture-pass-kickoff.md`. Nothing
  is built before that session ends. In progress since 2026-10-30;
  round 1 is answered. Working log (git-ignored):
  `.superpowers/sdd/2026-10-30-architecture-pass/progress.md`.
- **Decisions so far (owner, 2026-10-30):**
  1. The architecture pass is the next unit. The paused hardening
     pieces and the truth sweep wait for its answers. Its central
     question: who decides each fact the GM sees (the authority,
     `CONTEXT.md` §4b). It must also answer five more: does a
     service's state travel with its health; how does the engine read
     the programs it drives; can a test touch the live show; does one
     question get one answer; who re-checks after a reset. The owner's
     condition with the yes: the orchestrator must understand the
     engine being built and the roadmap being adjusted, starting with
     how the truth sweep differs from the pass.
  2. The pass is a roadmap revision, run the way the September
     re-charter ran: evidence, a draft with numbered questions, an
     adversarial review, grill rounds, ratification. The
     `CONTEXT.md` entry for "architecture pass" waits until its
     difference from the truth sweep is settled.
  3. Four terms are in `CONTEXT.md` §4b: runtime state, authority,
     copy, delivery path. "Verdicts" names what one truth checks
     (§1). While writing "authority" the orchestrator added that an
     outside program can be one (VLC decides what is playing); the
     owner has not yet confirmed that addition.
  - Still open from round 1: the pass's outputs and the path for
    blue's lessons (the owner did not follow them; to be re-asked in
    plain words), and green's three follow-ups shipping when this
    session ends (the owner leans yes; to confirm).
- **The branch.** This program's records live on the branch
  `claude/nice-curie-hescfv`, with three draft pull requests:
  ALN-Ecosystem #35, ALNScanner #17 and ALN-TokenData #8. `main` is
  older and lacks the hardening plan; a clone on `main` checks this
  branch out first. Work inside ALN-Ecosystem and its submodules; the
  four top-level clones beside it are separate copies.
- **The bootstrap.** A cloud session starts in the folder above the
  repositories, so the project's start-up script does not run on its
  own. From the ALN-Ecosystem root run
  `CLAUDE_PROJECT_DIR="$PWD" bash .claude/hooks/session-start.sh`.
  Proven on 2026-10-30: it finished in under a minute and installed
  the declared plugins, but a plugin installed mid-session only works
  from the next session. The owner added a plugin-install line to the
  cloud environment's setup script on 2026-10-30, for sessions started
  after that.
- **Live state:** no worktrees, no test rig. Two read-only workflows
  started 2026-10-30 to give the planning session a real map of the
  engine and the roadmap (the owner's condition, decision 1): run
  `wf_7bc41460-e87` (direction and roadmap documents) and run
  `wf_dfeaf164-afd` (the engine as built: four readers, a merge, a
  check). Each reader writes one file in `docs/plans/architecture-pass/`
  (`2026-10-30-map-*.md`); commit what lands. The last code merge,
  `209916b`, passed CI (run 303).

## 1. The goal (owner, 2026-10-30)

The game keeps running on blue, the production machine, until the new
engine is ready to swap in on green, the second machine (blue and
green: `CONTEXT.md` §5). No date governs the work. Lessons from blue's
run go into the engine's architecture and interfaces, never into
patches on blue or one-for-one ports. The architecture pass covers the
whole engine. The order of the hardening block (Block 2) before the truth sweep
(Block 3; `docs/plans/ROADMAP.md` §4) is under review. The end goal stands: an open-source show platform
(`docs/plans/ROADMAP.md` §1).

## 2. What happened since 2026-09-13

- Blue ran the September and October shows with no major breaks.
  Minor issues remain; for example, the GM panel does not keep up with
  live music playback without a refresh.
- A separate working session fixed defects on blue's own branch,
  `production-2026-07`, from 2026-09-12 to 09-18, then synced tokens on
  09-18. Its records live on that branch. Its fixes were checked
  against the new engine in
  `docs/plans/2026-10-30-production-fixes-triage.md`.
- The cloud container was reclaimed during the pause. Lost: the
  unpushed dormancy-core fixes, the uncommitted working notes, meaning
  research notes, reviews and the working log, and the test rig, the
  automated test setup with real video, audio and lighting services.
  What survived in this session's transcript is in
  `docs/plans/2026-10-30-recovered-review-findings.md`.
- Green has not been started.

## 3. How the venue runs (owner, 2026-09-12; still true)

GM tablets reach the orchestrator at the fixed address 192.168.0.191
on the kit WiFi; the certificate warning is accepted once per device.
Two GM tablets. Three ESP32 player scanners. No player phones, no QR
codes. Two scoreboard displays: the TV on HDMI, driven by the Pi's own
browser and shared with the idle loop and game videos; and a Pi 4
showing the scoreboard page in a fullscreen browser. Audio: HDMI and a
W-KING X10 Bluetooth speaker. DNS and certificate work wait for the
players'-phones block (`docs/plans/ROADMAP.md` row 8.19). Green can
reach blue's files over a network share.

## 4. Blue containment (non-negotiable)

Blue runs the July system plus its September fixes on the branch
`production-2026-07` in all five repositories; in the ESP32 one that
branch sits at the July commit. (1) Blue never reads from or writes to
the token repository's `main`. (2) Blue's token updates follow "Token
Update Before a Game" in `DEPLOYMENT_GUIDE.md` on `production-2026-07`;
the `blue-2026-07-tokens` branch named in older text was never used.
(3) Never run the player scanner's "Sync & Deploy" workflow until the
final cutover. (4) Rollback follows "Emergency Rollback (Game Day)" in
that same guide: blue's stable build is the tip of
`production-2026-07`, so roll back to a commit on that branch. The tag
`blue-2026-07` is the July build without September's fixes and later
token data; use it only on purpose. (5) Work on the new engine never
touches blue's branch.

## 5. Where the program stands (`docs/plans/ROADMAP.md` §4)

- **Block 1, unlock:** done except green's home hardware pass
  (ROADMAP §6, Stage B). The baseline screen images were never
  captured; ruling R22 moved them into the truth-sweep work, which has
  not started.
- **Block 2, hardening:** done and merged: the equipment families, the
  dormancy core, the test-harness minimum. Paused until the
  architecture pass re-plans them: the profile check, the dormancy-core
  fixes, credentials, the supervisor, the self-heal, the preflight
  checks and panel, the final wiring, the close review, and the three
  small green follow-ups. Those with briefs carry an on-hold line; the
  preflight checks and panel, the wiring and the close review have no
  brief yet. The piece names are the plan's plain names (plan §4).
- **Block 3, truth sweep:** not started; its audit notes were lost.
- **Blocks 4 to 6 and the later blocks:** not started.
- The roadmap's calendar, built around the September run, has passed.

## 6. Open items, and who owns them

- Owner: the planning session's open questions (§0).
- Owner, any time: green's home hardware pass from the start-here
  section of `DEPLOYMENT_GUIDE.md`. The guide is a plan to be proven on
  the bench. While the green follow-ups stay on hold, a correct green
  logs a false "WirePlumber rule missing" warning at every boot.
  Whether those follow-ups ship before the test is an open question
  for the planning session.
- Owner: review the visible-change list (ROADMAP Appendix B) once a
  running new engine exists.
- Owner, open: may task branches be pushed as a backup? Only the
  program's working branch is pushed today.
- Standing, owner: delete the remote branch
  `claude/nice-curie-hescfv-t1a-ci`. Secrets rotation and the WiFi
  password scrub were deferred by the owner on 2026-09-12, recorded
  only on this page; rotation must happen before the previewable state
  (ROADMAP §3).

## 7. Pointers (open when)

- Starting the next unit: the kickoff brief named in §0.
- Evidence for the pass: the triage and the recovered findings named
  in §2; blue's records, read with
  `git show origin/production-2026-07:<path>`.
- Touching paused Block 2 work: `docs/plans/2026-09-12-block2-hardening-plan.md`
  §1, §3, §4 and its §9 record; the briefs in `docs/plans/briefs/`.
- Naming anything or ruling on a conflict: `CONTEXT.md` §2, §4, §5.
- The frame and the gates: `docs/plans/ROADMAP.md` §1, §3, §4, §10.
- Setting up green: `DEPLOYMENT_GUIDE.md`, its start-here section.
- Rebuilding the test rig: `backend/tests/rung1/` and the recipe in
  `docs/plans/2026-09-12-container-baseline.md` §7.
- How work runs: `docs/agents/process.md`; reusable workflow scripts in
  `docs/agents/workflow-scripts/`.
- History: the plan's §9 and `docs/plans/PHASE3-STATUS.md`, never on
  reload.
