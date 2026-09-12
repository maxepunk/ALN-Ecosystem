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

- Harness minimum: build workflow clean at f778f15 (review pass /
  approved; five minors); the hostile tester's seven findings all
  refuted on evidence, seventeen attacks held; MY gate on f778f15 green
  (unit+contract 3121, ratchet 85/85, lint, integration 349/349). A
  fixer (sonnet) is applying the five one-line minors now; then a scoped
  re-review, my rerun of the touched suites, the merge (remove
  `.worktrees/docs` first, then check the designated branch out in the
  main checkout), the three lane worktrees.
- Lane briefs: credentials and self-heal at revision 3 (e3d8474) after
  two review passes; a third-pass scoped re-review runs
  (`wf_c6d1f39c-7ba`, script `rereview-pass3.js`). The supervisor
  brief (revision 2, three tasks) waits for the dormancy-core
  adversarial pass to fold its survivors in, then its re-review.
- Dormancy-core adversarial pass resumed (`wf_6858337e-efa`): 29
  findings (11 major), refuters and the writer running; the standing
  majors so far are the null-profile whole-kit dormancy (a duplicate of
  the ruled profile check, not new), an unknown endpoint family
  throwing at boot, and the display health word (probe reports healthy
  while hidden; nothing returns it from down without a launch). Per
  R26 survivors are fixed as one task before any lane merges.
- Research: revision 2 running (`wf_a50361c3-286`) to close the three
  show-night gaps; the document (revision 1) is committed in the docs
  worktree; then the guide repair (R24) and your guide-ready note.
- Every workflow resumes with `Workflow({scriptPath, resumeFromRunId})`;
  scripts under `<scratchpad>/` (`harness-minimum-build.js`,
  `research.js`, `research-revision-2.js`, `arms-factsheet.js`,
  `brief-reviews.js`, `rereviews-cred-selfheal.js`, `rereview-pass3.js`,
  `dormancy-adversarial.js`, `hostile-harness.js`). A message never
  stops them; the stop button does, and then they resume. The session's
  usage limit stopped twenty-five agents at 23:0xZ (reset 23:20Z); all
  were resumed.
- Main checkout is on the harness task branch (the fixer edits there);
  docs commits go through `.worktrees/docs` (designated branch,
  e3d8474). Never commit in a checkout where an implementer edits.
- Rig: shared arms up under `/tmp/rung1` (engine stopped); E2E and
  Tier L runs take `/tmp/rung1/e2e.lock` with `flock` (a convention,
  not yet harness machinery); a restart loses the arms (recipe
  `2026-09-12-container-baseline.md` §7).
- Scratch `.superpowers/sdd/2026-09-12-block2-hardening-plan/`: the
  progress file (append-only; live-state lines at its end); seven fact
  sheets (`supervisor-`, `credentials-`, `self-heal-`,
  `preflight-arms-factsheet.md`, `sweep-audit-producers/-renderers/-restore.md`),
  each opening with a Conclusions section — read only that; reviews
  and re-reviews per lane; `harness-minimum-report.md`.

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
