# Current state — the entry point (one screen, edited in place)

Read this first after any compaction or restart. Nothing else is
required reading: the pointers at the bottom say what to open and when.
Check every claim of a summary against git and this page before acting.

## 1. The goal this week (owner, 2026-09-11, recorded 2026-09-12)

Green runs the show on Friday 2026-09-18; blue is the fallback. This
week: build the remaining hardening block and the truth sweep in
parallel lanes; the owner sets up the green machine at home (start
Saturday or Monday, owner's call); a venue rehearsal happens before
Friday (owner's day); new tokens sync from Notion on Thursday, run by a
Claude session on the Pi. Calendar: shows Fri–Sun weekly to 2026-10-18;
Mon–Thu are the engineering windows. The show-ready gate stands as
written in ROADMAP §3.

## 2. How the venue runs today (owner, 2026-09-12)

GM tablets reach the orchestrator at the fixed address 192.168.0.191 on
the kit WiFi; the certificate warning is accepted once per tablet. Two
GM tablets. Three ESP32 player scanners, to be flashed this week; they
skip certificate checks. No player phones, no QR codes. NFC tags carry
the token id (plus an unused address). Audio: HDMI (monitor speakers)
and a W-KING X10 Bluetooth speaker. DNS is not set up; the profile says
so. DNS, the certificate warning and player phones are later work.

## 3. Blue containment (non-negotiable; carried from the retired handoff)

Blue runs the July system with the old token format. (1) Blue never
reads from or writes to the token repository's main. (2) Blue's on-board
docs are stale where they say push main, pull first, or run the deploy
sync. (3) If blue must take a token update: sync from blue's own
checkout, commit to a NEW branch `blue-2026-07-tokens`, push only that
branch, apply locally on blue. (4) Never run the player scanner's
"Sync & Deploy" workflow until the final-cutover list item 6. (5)
Rollback anchor: tag `blue-2026-07` in all five repos.

## 4. Done, and next

Done on branch `claude/nice-curie-hescfv` (parent; ALNScanner
`e83723c`; ALN-TokenData `6f9bc30`; draft PRs #35, #17, #8; CI green
at run 300): the dormancy core — three health words, dormant grey with
its door, the display as the ninth service, cues silenced by absent
equipment, the require gate with the typed override, the profile
identity on the wire; the venue profile corrected (two tablets, both
audio outputs, DNS off). Rulings R1–R17 in the plan's §1.

Next, in this order (owner: "go"): (1) documents [x] rulings rows
[x] task section [x] page cut [x] rule 6 [x] handoff retired [x] progress
file no longer "the ledger"; (2) readers for the supervisor, credentials,
the self-heal; the sweep audit as reading; Thursday's runbook committed
for the owner; the guide repair when the fresh-install research lands,
BEFORE the owner starts on green; (3) the two held plans revised, one
scoped re-review each; (4) the harness minimum built in the main
checkout, reviewed, gated, merged; three worktrees cut and provisioned;
(5) the profile check built, reviewed, gated, merged; the arms worktree
cut; (6) lane briefs reviewed against the plan, lanes dispatched;
(7) merges in order with the full suite after each: credentials, the
supervisor, the self-heal, the arms; then the panel, the wiring, the
sweep's fixes; (8) the pre-rehearsal review and report = handover:
everything merged or pushed, this page current, development moves to
green; (9) after the rehearsal: the delta review; the owner's go at the
Thursday preflight.

## 5. Open items, and who owns them

- Deployment guide ready for a fresh OS on green: orchestrator; the
  research is running; a repair task follows; the owner gets a note
  with the copy / pull / install lists. Do not start on green before it.
- Thursday's sync runbook for the owner's review: orchestrator, step 2.
- During the home setup, owner: copy blue's certificate files; capture
  the seven Home Assistant scenes from blue; pair the speaker and give
  its sink name for the profile; flash the three scanners; practice the
  token sync once on green and check how many image files changed.
- Standing, owner: delete remote branch `claude/nice-curie-hescfv-t1a-ci`;
  secrets rotation and the WiFi-password scrub are deferred by ruling.

## 6. Running, and on disk

- Researcher (fresh install vs the guide) → `docs/plans/2026-09-12-green-fresh-install-research.md`.
- Scratch, `.superpowers/sdd/2026-09-12-block2-hardening-plan/`: the
  progress file (append-only recovery notes); fact sheets `p1-`, `p2-`,
  `token-sync-workflow.md`, `collision-matrix.md`; reviews
  `p1-plan-brief-review.md` + `-rereview.md` (DISPATCH), `p2-plan-brief-review.md`
  (REVISE, six blocking). Scratch survives compaction, not a restart.
- The test rig is provisioned in this container (recipe:
  `2026-09-12-container-baseline.md` §7); a restart loses it.
- Lanes: none dispatched. Format when one is: name | worktree | branch |
  brief | report path | agent | state.

## 7. Pointers (open when)

- Resuming a piece of work → its brief under `docs/plans/briefs/` (the
  lane line names it) and the tail of the scratch progress file.
- Writing or reviewing a brief → the plan's current pins and order:
  `docs/plans/2026-09-12-block2-hardening-plan.md` §1, §3, §4; the spec
  `2026-09-04-phase3-c2c3-resolution-dormancy.md` §8 when a pin touches
  a ruled mechanism.
- Naming anything or ruling on a conflict → `CONTEXT.md` (§2, §4, §5).
- The frame, the gate, the documentation system → `ROADMAP.md` §3, §4, §6, §9.
- Setting up green → `DEPLOYMENT_GUIDE.md` once the repair note is out;
  the fresh-install research; the retired handoff's setup notes are in
  history: `git show e6c1404:docs/plans/2026-09-12-postwalk-handoff.md`.
- How work runs → `docs/agents/process.md` (§2 continuity rules).
- History → the plan's §9 record and `PHASE3-STATUS.md`; never on reload.
