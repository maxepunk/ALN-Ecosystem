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

- Harness build DONE 22:19:55Z (head f778f15, review clean, five minors
  ledgered in the progress file); its hostile tester runs now,
  `wf_dfd702f3-067` (script `hostile-harness.js`); then one fixer
  commit + scoped re-review, my fresh gate, the merge, the lane
  worktrees. Arms fact sheet DONE (scratch `preflight-arms-factsheet.md`,
  20 design-changing facts, recount clean on substance).
- Brief reviews DONE (all three REVISE; findings refuted independently);
  the three briefs rewritten to revision 2 (44c331f): credentials as one
  task, supervisor and self-heal as three reviewed tasks each. Scoped
  re-reviews of credentials and self-heal run now (`wf_ce9f7fcc-512`);
  the supervisor's re-review waits for the dormancy-core adversarial
  pass (it builds on that core; survivors fold in first).
- Research DONE once (10 differences; document in the docs worktree);
  its critic left three show-night gaps (the environment PM2 freezes at
  first start; the acceptance checklist blind to a missing browser or a
  Wayland session; MPD's major-version step); revision 2 runs now
  (`wf_a50361c3-286`), then the final commit and the guide repair.
- Workflows still running (owner: "go" 21:40Z; the adversarial pass
  "agreed" 21:59:19Z, 2026-09-12;
  resumable after any stop with `Workflow({scriptPath, resumeFromRunId})`,
  finished agents cached; scripts copied to the scratchpad
  `<scratchpad>/harness-minimum-build.js`, `research.js`,
  `arms-factsheet.js`, `brief-reviews.js`):
  harness build `wf_e025191e-511` (implementer → task review → fix
  rounds; main checkout on `claude/nice-curie-hescfv-harness-minimum`,
  base 33b2128, two commits carried; report `harness-minimum-report.md`);
  research `wf_c1fcc10c-87d` (nine topic readers + a repository reader
  → synthesis → critic; writes
  `docs/plans/2026-09-12-green-fresh-install-research.md` in the docs
  worktree); arms fact sheet `wf_64f7562e-cc8` (three readers → recount
  → writer; scratch `preflight-arms-factsheet.md`); brief reviews
  `wf_48810aa9-f35` (three reviewers → a refuter per blocking finding;
  scratch `<lane>-lane-review.md`); dormancy-core adversarial pass
  `wf_6858337e-efa` (three attacking lenses → a refuter per finding →
  report; scratch `dormancy-core-adversarial.md`; script
  `dormancy-adversarial.js`). A message never stops them; the stop
  button does, and then they resume. Ruling R26: survivors of the
  adversarial pass are fixed before any lane merges; each brief gets a
  red team after its review passes; each build task gets a hostile
  tester after its task review.
- Harness facts verified from the official docs (20:25Z): a plain
  message never stops agents; the stop button stops every running one
  and they cannot be resumed; a COMPLETED agent resumes by message;
  compaction leaves running agents alone; a container restart ends all
  background work; workflows resume from their run id; cap here = 2
  concurrent agents per workflow; the harness's own worktree tool
  branches from the default branch and inits no submodules, so lane
  worktrees are hand-cut under `.worktrees/`.
- Main checkout is on the harness task branch (the workflow's
  implementer edits there); docs commits go through the worktree
  `.worktrees/docs` (designated branch, now a92a76a). Remove that
  worktree before checking the designated branch out in the main
  checkout again. Never commit in a checkout where an implementer edits.
- Rig: shared arms up under `/tmp/rung1` (engine stopped); E2E and
  Tier L runs take `/tmp/rung1/e2e.lock` with `flock` (lanes share the
  rig); a restart loses the arms (recipe `2026-09-12-container-baseline.md` §7).
- Scratch `.superpowers/sdd/2026-09-12-block2-hardening-plan/`: the
  progress file (append-only; live-state lines at its end); six fact
  sheets, each opening with a Conclusions section — read only that;
  earlier reviews `p1-…` (DISPATCH), `p2-…` (REVISE),
  `harness-minimum-rereview.md` (DISPATCH).
- Lane briefs, rewritten to rulings R18–R25 and committed (a92a76a):
  `docs/plans/briefs/2026-09-12-<lane>-lane.md` (+ `-review.md`) for
  credentials, supervisor, self-heal; worktrees `.worktrees/<lane>` are
  cut after the harness minimum merges (recipe in the progress file).
- Next, in order: the harness build's result → my fresh gate → merge →
  cut the three lane worktrees; the reviews' verdicts → brief fixes →
  lanes dispatched as build workflows; the profile check after the
  merge; the arms brief from its fact sheet; the guide repair from the
  research (then the owner's guide-ready note).

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
