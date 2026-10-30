# Current state — the entry point (one screen, edited in place)

Read this first after any compaction, restart or new session. Nothing
else is required reading: the pointers at the bottom say what to open
and when. Check every claim of a summary against git and this page
before acting.

## 0. Resume here (2026-10-30)

- **The current unit** is the architecture pass, phase 1: deciding
  the shared rules for runtime state with the owner, one question
  round at a time. The owner ratified its program document on
  2026-10-30: `docs/plans/2026-10-30-architecture-pass.md`. Its §4 is
  phase 1's flow; its Appendix A holds the definition session's
  decisions 1 to 16. Working log (git-ignored):
  `.superpowers/sdd/2026-10-30-architecture-pass/progress.md`.
- **First steps** (program document §10):
  1. Green's three follow-ups: done. Merged on 2026-10-30 at
     `089dd527` after a task review, a final whole-branch review and
     one re-reviewed fix wave; the merged tree passed the full backend
     suite (151 files, 3127 tests), the coverage check and lint
     (hardening plan §9).
  2. Phase 1, step 1, the cause analysis: one small workflow (readers
     split by source, a merge that groups every finding by cause, a
     refute-by-default check), written into
     `docs/plans/architecture-pass/`. The owner then confirms the
     cause list. Step 2, the test rig, follows.
- **Phase 1's decisions** go here as the owner makes them, then into
  phase 1's documents (`docs/agents/process.md` §5). None yet.
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
- **Live state** (2026-10-30, 11:20Z; the container restarted at about
  10:20Z, nothing lost). Running: the cause analysis, workflow
  `wf_5b8300fe-cb6` (script
  `docs/agents/workflow-scripts/cause-analysis.js`), resumed after the
  restart from its run id. Its four reader sheets and the merge into
  `2026-10-30-cause-analysis.md` are committed; the two-part check
  (`2026-10-30-cause-analysis-check-1.md` and `-2.md`) and the fold
  follow. No worktrees. No test rig. Three read-only mapping runs finished earlier
  on 2026-10-30 (`wf_7bc41460-e87`, `wf_dfeaf164-afd`,
  `wf_3f365994-ba6`; about 4.2 million helper tokens). Their nine
  files are the pass's evidence, all committed in
  `docs/plans/architecture-pass/`: start with
  `2026-10-30-map-runtime-state.md` §0 (corrections) and §1. The last
  code merge, `089dd527` (green's follow-ups), was pushed on
  2026-10-30; its CI run is recorded in the hardening plan's §9.

## 1. The goal (owner, 2026-10-30)

The game keeps running on blue, the production machine, until the new
engine is ready to swap in on green, the second machine (blue and
green: `CONTEXT.md` §5). No date governs the work. Lessons from blue's
run go into the engine's architecture and interfaces, never into
patches on blue or one-for-one ports. The architecture pass covers the
whole engine. Its phase 2 takes the place the hardening block (Block 2)
and the truth sweep (Block 3) held in `docs/plans/ROADMAP.md` §4
(program document §7). The end goal stands: an open-source show
platform (`docs/plans/ROADMAP.md` §1).

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
  captured; ruling R22 moved them into the truth-sweep work, whose
  purpose now moves into the pass's phase 2 (decision 6).
- **Block 2, hardening:** done and merged: the equipment families, the
  dormancy core, the test-harness minimum. They stay; phase 2 changes
  them only where a rule requires (decision 15). To be rebuilt inside
  the pass's phase 2 (decision 7): the profile check, the dormancy-core
  fixes, credentials, the supervisor, the self-heal, the preflight
  checks and panel, the final wiring, the close review. Those with
  briefs carry an on-hold line; the preflight checks and panel, the
  wiring and the close review have no brief yet. The piece names are
  the plan's plain names (plan §4). Green's three follow-ups merged on
  2026-10-30 (`089dd527`).
- **Block 3, truth sweep:** never started; its audit notes were lost.
  Its charter is retired, and its purpose moves into the pass's phase
  2, covering every screen (decision 6).
- **Blocks 4 to 6 and the later blocks:** not started. The capture
  block, the preview block and the later blocks come after phase 2;
  the new roadmap places Block 6 (decisions 7 and 10).
- The roadmap's calendar, built around the September run, has passed.

## 6. Open items, and who owns them

- Owner: phase 1's question rounds, starting with confirming the
  cause list (§0).
- Owner, any time: green's home hardware pass from the start-here
  section of `DEPLOYMENT_GUIDE.md`. The guide is a plan to be proven on
  the bench. Green's follow-ups merged on 2026-10-30, so a correct
  green no longer logs a false "WirePlumber rule missing" warning. One check
  to add on the bench (the follow-ups' final review, 2026-10-30): in an
  SSH shell on green, run
  `env | grep -E '^(DBUS_SESSION_BUS_ADDRESS|XDG_RUNTIME_DIR)='`. The
  guide's step 8 assumes both are unset there. If both print, step 8,
  gate item 8.4 of `docs/preflight-checklist.md` and the comment in
  `backend/.env.example` need correcting together.
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

- Working the current unit: the program document named in §0; its §4
  for phase 1's steps, its §8 for the evidence.
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
