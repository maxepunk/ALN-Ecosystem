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
  rounds 1 to 5 are answered. Working log (git-ignored):
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
     copy, delivery path. An outside program can be an authority (VLC
     decides what is playing; confirmed in round 2). "Verdicts" names
     what one truth checks (§1).
  4. Green's three follow-ups ship as one small task as soon as this
     planning session ends (round 2; the brief's hold line says so).
  5. The question set (round 2). Question 4 becomes "can anything
     other than the live engine touch the live show?" (tests today, the
     preview engine later). Question 6 becomes "what does each fact and
     each copy do at a boundary?" (a game starting or ending, a system
     reset, a restart, a pack change while running). A seventh question
     asks what each component receives; the owner ruled that it must
     start from the settled roles of the player scanners (web and ESP32
     mirror each other), the GM scanner and the scoreboards. Its
     wording is open in round 3.
  6. The truth sweep's charter is retired (round 2). Its purpose,
     proving with rig tests and screen captures that every screen tells
     the truth, moves into the build work the pass plans and covers
     every screen. Its census and five recorded desync bugs become
     evidence for the pass. `ROADMAP.md` §3, §4 and §10.1 and
     `CONTEXT.md` §7 carry notes.
  7. The pass is one program in two phases (round 3, option c).
     Phase 1 decides the shared rules for the whole engine together,
     with throwaway prototypes allowed, and ends with the new roadmap.
     Phase 2 changes the engine to follow the rules, one area at a
     time, as the first work in that roadmap, before capture, preview
     and phones; it takes the show-ready gate's second condition
     (`ROADMAP.md` §3 note). Each area gets its detailed design just
     before it is built and starts with its proof test failing on
     today's engine. The remaining hardening pieces and the sweep's
     purpose are rebuilt inside phase 2. The pass ends when every
     rule's test passes on the rig. `CONTEXT.md` §7 has the
     "architecture pass" entry.
  8. Blue's fixes and unfixed findings are evidence (round 3; the
     owner's meaning of the brief's question 6). For each: the problem
     area, the design cause, every other place with that cause, the
     design choice that removes it, and the proving test. Fixes that
     share a cause become one design decision.
  9. The seventh question (round 3): "does each component receive
     what its role needs, and no more?", starting from the settled
     roles: player scanners (web and ESP32, the same functions) show
     token content and report scans, with no scoring and no live feed;
     the GM scanner is the command center; the scoreboards show the
     public results.
  10. Phase 1 hands over five documents (round 4): the rules, one per
      question, each with a plain-words proof test (what to do, what
      must happen); the cause analysis (decision 8); contract
      proposals, drafted for the two contract files before code;
      decision records, one short note per hard-to-reverse choice, in
      a new `docs/adr/`; the new roadmap with phase 2's areas in build
      order, the remaining hardening pieces and the sweep's purpose
      placed inside them, the show-ready gate restated and the later
      blocks after phase 2.
  11. Two more questions (round 4): 8, "how may a copy be updated,
      and can a screen tell how old it is?"; 9, "is each fact's
      reconnect snapshot built the same way as its live update?".
      Phase 1 designs questions 1, 6, 8 and 9 together as one rule
      for live state.
  12. Phase 1's method (round 4), in order: (1) the cause analysis,
      one small workflow (readers grouped by cause, a merge, a
      skeptical check); (2) the rung-1 rig rebuilt from its recipe and
      used to reproduce the unrun findings (the music panel lag, the
      ended game returning after a restart, the reset without music,
      the refused deleted token); phase 2's proof tests run on it too;
      (3) design rule by rule with `codebase-design` (vocabulary,
      "design it twice") and `improve-codebase-architecture` (a visual
      report per design choice with before-and-after diagrams,
      published as a page), both confirmed for this pass: for the hard
      rules two or three competing designs side by side, a throwaway
      prototype where the code's behaviour is uncertain, never merged,
      and every rule saying how it serves hot-apply, the preview
      engine, capture and phones; (4) an adversarial review of the
      draft rules and roadmap: two reviewers with different angles, a
      checker per finding, one fleet at a time; (5) grill rounds on
      each decision; ratification.
  13. Phase 1 ends at ratification, once every question has a rule
      and proof test, every finding and blue fix is assigned or set
      aside with a reason, every rule serves the planned capabilities,
      the review's blocking findings are resolved, and the rig
      reproduces each finding marked for live proof (round 4).
  14. Phase 1 runs as a flow in which every decision is made in a
      question round with the evidence in view, and written into its
      document at once; ratification is a skim with no new decisions
      (round 5). The approved flow: step 1, the owner confirms the
      cause list; step 2, facts only; step 3, one page per rule (the
      designs side by side, before-and-after diagrams, a
      recommendation) and the owner picks; step 4, only the review
      findings that would change a decision come back, as questions;
      step 5, the owner decides phase 2's build order; at ratification
      the state page names phase 2's first area. The rule stands for
      every unit: `docs/agents/process.md` §5, last bullet.
      (Decisions 10, 12 and 14 were completed on 2026-10-30 from the
      approved question text, after a record check found the first
      summaries too short.)
  - Next: the pass's program document,
    `docs/plans/2026-10-30-architecture-pass.md` (draft built only
    from decisions 1 to 14 and the evidence; a record check by a
    separate reviewer, run `wf_b18b5df5-3f9`, then the owner's
    ratification).
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
- **Live state:** nothing running, no worktrees, no test rig. Three
  read-only mapping runs finished on 2026-10-30 (`wf_7bc41460-e87`,
  `wf_dfeaf164-afd`, `wf_3f365994-ba6`; about 4.2 million helper
  tokens). Their nine files are the pass's evidence, all committed in
  `docs/plans/architecture-pass/`: start with
  `2026-10-30-map-runtime-state.md` §0 (corrections) and §1. The last
  code merge, `209916b`, passed CI (run 303).

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
