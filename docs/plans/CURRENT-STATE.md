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
audio outputs, DNS off); the harness minimum (one data and log
directory per test worker; the log guard) merged at `209916b`. Rulings
R1–R27 in the plan's §1; the record's rulings 1–31 in its §9.

Next, in this order (owner: "go"): (1) documents [x] rulings rows
[x] task section [x] page cut [x] rule 6 [x] handoff retired [x] progress
file no longer "the ledger"; (2) readers for the supervisor, credentials,
the self-heal; the sweep audit as reading; Thursday's runbook committed
for the owner; [x] the guide repair (7fab0b4; the guide-ready note is the
start-here section at the top of `DEPLOYMENT_GUIDE.md`); (3) the two held plans revised, one
scoped re-review each; (4) [x] the harness minimum built, reviewed, gated, merged; three
worktrees cut and provisioned;
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
  green and check how many image files changed. The guide-ready note
  is out: `DEPLOYMENT_GUIDE.md`, the start-here section at the top;
  green may start. Read it as a plan to be proven on the bench, not a
  proven plan (nothing was run on a real Trixie machine); blue is the
  contingency.
- Owner: review the sixteen visible changes (ROADMAP Appendix B) as
  the GM on a running system; timing yours.
- Orchestrator: three code-side follow-ups the guide cannot fix
  (brief `briefs/2026-09-13-green-followups.md`): the boot check
  accepts the WirePlumber `.conf` path (until then a correct green
  logs a false "rule missing" every boot — ignore it, never write the
  `.lua`); the two bus variables in the environment template; the
  requirements file's install line.
- Standing, owner: delete remote branch `claude/nice-curie-hescfv-t1a-ci`;
  secrets rotation and the WiFi-password scrub are deferred by ruling.

## 6. Running, and on disk

- Live state at the last edit (about 01:40Z 2026-09-13): the rig's
  shared arms up (brought back after the 23:21Z restart; engine
  stopped). Running: the dormancy-survivors build (`wf_bb6acf61-b89`,
  script `lane-build.js`, worktree `.worktrees/dormancy-fix`, brief
  `briefs/2026-09-13-dormancy-survivors.md`: seven fixes from the
  adversarial pass, then a hostile tester); three per-brief red teams
  (R26 point 2; `redteam-brief.js`): credentials `wf_aa1e1c73-4cc`,
  self-heal `wf_4b643628-042`, profile-check `wf_6a3b59bb-9af`;
  reports `<lane>-redteam.md` in scratch. Done since the last edit:
  research revision 4 (closed), the guide repair (7fab0b4, reviewed),
  the dormancy pass (12 standing: seven → the survivors task, one →
  the profile check, one → the arms brief, minors ruled).
- Checkouts: main checkout on `claude/nice-curie-hescfv-profile-check`
  at `209916b` (the profile-check build runs there); `.worktrees/docs`
  on the designated branch (all docs commits go through it);
  `.worktrees/credentials`, `.worktrees/supervisor` (+ ALNScanner
  branch), `.worktrees/self-heal` (+ ALNScanner branch), each at
  `209916b`, submodules at the pins, `node_modules` symlinked.
- Order by file sets (record ruling 30): the profile check first (owner
  ruling) beside the self-heal lane (disjoint files); credentials after
  the profile check merges (both edit `asyncapi.yaml`); the supervisor
  after the dormancy-core survivors task (R26 point 1) and its brief's
  re-review; the arms after the profile check.
- For each brief, when its red team returns: standing findings edited
  into the brief (self-heal's flow becomes `33-pack-self-heal`), then
  the build workflow (`lane-build.js`: per task an implementer, a task
  review, at most three fix rounds; then a hostile tester with
  refuters), then my fresh gate, then the merge in the order above.
- Briefs: credentials and self-heal at revision 3 (DISPATCH after two
  review passes), red teams running; the profile check (`p1-profile-check.md`,
  DISPATCH) red team running; the supervisor (revision 2, three tasks)
  waits for the dormancy pass to fold its survivors in.
- Dormancy pass: 29 findings (11 major); the standing majors so far:
  the null-profile whole-kit dormancy (a duplicate of the profile
  check), an unknown endpoint family throwing at boot, the display
  health word (probe healthy while hidden; nothing returns it from down
  without a launch). Survivors are fixed as one task before any lane
  merges.
- Research: revision 2 committed (`7b4493e`); revision 3 closes five
  narrower gaps; then the guide repair (R24) and the owner's
  guide-ready note.
- Every workflow resumes with `Workflow({scriptPath, resumeFromRunId})`;
  scripts under `<scratchpad>/`. A message never stops them; the stop
  button does, and then they resume; a container restart ends them
  (twice today; files survived both times, the rig's daemons did not).
- Rig: E2E and Tier L runs take `/tmp/rung1/e2e.lock` with `flock` (a
  convention, not harness machinery).
- Scratch `.superpowers/sdd/2026-09-12-block2-hardening-plan/`: the
  progress file (append-only; live-state lines at its end); fact sheets
  (`supervisor-`, `credentials-`, `self-heal-`, `p1-`,
  `preflight-arms-factsheet.md`, `sweep-audit-*.md`), each opening with
  a Conclusions section — read only that; reviews, re-reviews and red
  teams per lane; `harness-minimum-report.md`.

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
