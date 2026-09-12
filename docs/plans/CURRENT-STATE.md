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
the token id (plus an unused address). Two scoreboard displays: the TV
on HDMI (the Pi's own browser, sharing the TV with the idle loop and
the game-event videos) and a remote display (a Pi 4 with a browser in
fullscreen at the scoreboard link; warning accepted once; nothing to
change at the cutover). Audio: HDMI (monitor speakers) and a W-KING X10
Bluetooth speaker. DNS is not set up; the profile says so. DNS, the
certificate and player phones are deferred (ROADMAP row 8.19). Green
can reach blue's filesystem over a network share.

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

- Owner: green's acceptance checklist (ROADMAP §6 Stage B): a video
  plays on the TV with real picture and sound; audio routes to the
  Bluetooth speaker and ducks under a video; a lighting scene fires on
  a real bulb; a tablet scans a tag over the secure connection; a
  hardware scanner does a full asset sync from green; green activates
  the pack and runs the preflight. Inputs on the way: copy blue's
  certificate files over the share; capture the seven Home Assistant
  scenes from blue; pair the speaker and give its sink name for the
  profile; flash the three scanners; practice the token sync once on
  green and check how many image files changed. Do not start on green
  before the guide-ready note.
- Owner: review the sixteen visible changes (ROADMAP Appendix B) as
  the GM on a running system; timing yours.
- Orchestrator: the guide repair (R24) after the research lands; the
  Thursday runbook's differences fold into it (its review then happens
  on the repaired guide).
- Standing, owner: delete remote branch `claude/nice-curie-hescfv-t1a-ci`;
  secrets rotation and the WiFi-password scrub are deferred by ruling.

## 6. Running, and on disk

- Nothing is running (2026-09-12 20:27Z). Six agents (harness
  implementer, researcher, three brief reviewers, arms reader) were
  stopped at 19:59:41Z by the owner's stop button; stopped agents cannot
  be resumed (documented). The harness implementer's two commits survive
  on `claude/nice-curie-hescfv-harness-minimum` (`1b2cccb` P22,
  `30d1514` P21), tree clean; no report, review or fact sheet was written.
- Harness facts verified from the official docs (guide agent, 20:25Z):
  a plain message never stops background agents; the stop button stops
  every running one and they cannot be resumed; a COMPLETED agent can be
  resumed by message with its context; compaction does not touch running
  agents; a container restart ends all background work; workflows resume
  from their run id with finished agents' results cached, cap on this
  4-CPU box = 2 concurrent agents per workflow; workflows need the
  owner's explicit "use a workflow"; auto worktrees (`.claude/worktrees/`)
  branch from the default branch and do not init submodules, so lane
  worktrees stay hand-cut under `.worktrees/`.
- Main checkout is on the harness task branch; docs commits go through
  the worktree `.worktrees/docs` (designated branch). Remove that
  worktree before checking the designated branch out in the main
  checkout again. Never commit in a checkout where an implementer edits.
- Rig: shared arms up under `/tmp/rung1` (engine stopped); a restart
  loses them (recipe `2026-09-12-container-baseline.md` §7).
- Scratch `.superpowers/sdd/2026-09-12-block2-hardening-plan/`: the
  progress file (append-only; live-state lines at its end); six fact
  sheets (`supervisor-`, `credentials-`, `self-heal-factsheet.md`,
  `sweep-audit-producers/-renderers/-restore.md`), each opening with a
  Conclusions section — read only that; reviews `p1-…` (DISPATCH),
  `p2-…` (REVISE), `harness-minimum-rereview.md` (DISPATCH).
- Lane briefs, committed but AWAITING REWRITE after the decisions above:
  `docs/plans/briefs/2026-09-12-<lane>-lane.md` (+ `-review.md`) for
  credentials, supervisor, self-heal; the arms reader brief
  `…-preflight-arms-factsheet-reader.md`.

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
