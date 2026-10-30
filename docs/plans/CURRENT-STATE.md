# Current state — the entry point (one screen, edited in place)

Read this first after any compaction, restart or new session. Nothing
else is required reading: the pointers at the bottom say what to open
and when. Check every claim of a summary against git and this page
before acting.

## 0. Resume here (2026-10-30)

- **The current unit** is the definition session for the whole-engine
  architecture pass, run with the owner. Its brief:
  `docs/plans/briefs/2026-10-30-architecture-pass-kickoff.md`. Nothing
  is built before that session ends.
- **The branch.** All of this program's records live on
  `claude/nice-curie-hescfv` in ALN-Ecosystem, with draft PRs #35,
  #17 and #8. `main` is older and lacks the hardening plan. A session
  that lands on `main` checks this branch out first.
- **The bootstrap.** A cloud session starts in the folder above the
  five repositories, so the project's start-up script does not run on
  its own: run `CLAUDE_PROJECT_DIR="$PWD" bash .claude/hooks/session-start.sh` from the
  repository root. The cloud environment's setup script now installs
  the mattpocock skills (owner, 2026-10-30).
- **Live state:** nothing running, no worktrees, no rig. The last code
  merge, `209916b`, passed CI (run 303).

## 1. The goal (owner, 2026-10-30)

The game keeps running on blue until the new engine is ready to swap
in on green. No date governs the work. Lessons from blue's run go into
the engine's architecture and interfaces, never into patches on blue
or one-for-one ports. The architecture pass covers the whole engine.
The order of the hardening block before the truth sweep is under
review. The end goal stands: an open-source show platform
(`ROADMAP.md` §1).

## 2. What happened since 2026-09-13

- Blue ran the September and October shows with no major breaks.
  Minor issues remain; for example, the GM panel does not keep up with
  live music playback without a refresh.
- A separate session hardened blue on its own branch,
  `production-2026-07`, from 2026-09-12 to 09-18, then synced tokens
  on 09-18. Its records live on that branch. Its fixes were checked
  against the new engine in
  `docs/plans/2026-10-30-production-fixes-triage.md`.
- The cloud container was reclaimed during the pause. Lost: the
  unpushed dormancy-core fixes, the scratch record of fact sheets,
  reviews and the working log, and the test rig. What survived in the
  session transcript is in
  `docs/plans/2026-10-30-recovered-review-findings.md`.
- Green has not been started.

## 3. How the venue runs (owner, 2026-09-12; still true)

GM tablets reach the orchestrator at the fixed address 192.168.0.191
on the kit WiFi; the certificate warning is accepted once per device.
Two GM tablets. Three ESP32 player scanners. No player phones, no QR
codes. Two scoreboard displays: the TV on HDMI, driven by the Pi's own
browser and shared with the idle loop and game videos; and a Pi 4
showing the scoreboard page in a fullscreen browser. Audio: HDMI and a
W-KING X10 Bluetooth speaker. DNS and certificate work are deferred to
the players'-phones block (ROADMAP row 8.19). Green can reach blue's
files over a network share.

## 4. Blue containment (non-negotiable)

Blue runs the July system plus its September fixes on
`production-2026-07` in ALN-Ecosystem, ALN-TokenData, ALNScanner and
ALNPlayerScan; the ESP32 repository sits at the rollback tag.
(1) Blue never reads from or writes to the token repository's `main`.
(2) Blue's token updates follow the runbook on blue's own line:
"Token Update Before a Game" in `DEPLOYMENT_GUIDE.md` on
`production-2026-07`. The `blue-2026-07-tokens` branch named in older
text was never used. (3) Never run the player scanner's "Sync &
Deploy" workflow until the final cutover. (4) The rollback anchor is
the tag `blue-2026-07` in all five repositories. (5) Work on the new
engine never touches blue's line.

## 5. Where the program stands (`ROADMAP.md` §4)

- **Block 1, unlock:** done except green's home hardware pass. No
  record shows the baseline screen images were captured.
- **Block 2, hardening:** done and merged: the equipment families, the
  dormancy core, the test-harness minimum. Paused until the
  architecture pass re-cuts them: the profile check, the dormancy-core
  fixes, credentials, the supervisor, the self-heal, the preflight
  checks and panel, the wiring, the close review. Their briefs each
  carry an on-hold line.
- **Block 3, truth sweep:** not started; its audit readings were lost.
- **Blocks 4 to 6 and the later blocks:** not started.
- The roadmap's calendar, built around the September run, has passed.

## 6. Open items, and who owns them

- Owner: confirm or change the architecture pass at the definition
  session.
- Owner, any time and independent of the engine work: green's home
  hardware pass from the start-here section of `DEPLOYMENT_GUIDE.md`.
  The guide is a plan to be proven on the bench. Until the follow-ups
  in `briefs/2026-09-13-green-followups.md` land, a correct green logs
  a false "WirePlumber rule missing" warning at every boot.
- Owner: review the visible-change list (ROADMAP Appendix B) once a
  running new engine exists.
- Owner, open: may task branches be pushed as a backup? Only the
  designated branch is pushed today.
- Standing, owner: delete the remote branch
  `claude/nice-curie-hescfv-t1a-ci`. Secrets rotation and the WiFi
  password scrub stay deferred by ruling; rotation must happen before
  the previewable state.

## 7. Pointers (open when)

- Starting the next unit: the kickoff brief named in §0.
- Evidence for the pass: the triage and the recovered findings named
  in §2; blue's records, read with
  `git show origin/production-2026-07:<path>`.
- Touching paused Block 2 work: `docs/plans/2026-09-12-block2-hardening-plan.md`
  §1, §3, §4 and its §9 record; the briefs under `docs/plans/briefs/`.
- Naming anything or ruling on a conflict: `CONTEXT.md` §2, §4, §5.
- The frame and the gates: `ROADMAP.md` §1, §3, §4, §10.
- Setting up green: `DEPLOYMENT_GUIDE.md`, its start-here section.
- How work runs: `docs/agents/process.md`; reusable workflow scripts in
  `docs/agents/workflow-scripts/`.
- History: the plan's §9 and `PHASE3-STATUS.md`, never on reload.
