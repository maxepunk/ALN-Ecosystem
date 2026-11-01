# Current state — the entry point (one screen, edited in place)

Read this first after any compaction, restart or new session. Nothing
else is required reading: the pointers at the bottom say what to open
and when. Check every claim of a summary against git and this page
before acting.

## 0. Resume here (2026-11-01)

- **The current unit** is the architecture pass, in its design half,
  under the owner's proactive goal: "design a long-term optimal
  architecture for our engine that makes it intuitive and easy to
  maintain, continue development on, and extend". The ratified program
  document is `docs/plans/2026-10-30-architecture-pass.md`; its order
  is replaced by the decision "Design top-down, hardest-to-reverse
  choices first" (`docs/plans/architecture-pass/DECISIONS.md`). The design
  half runs: the requirements (now), the panel, the design rounds, the
  build plan, the hostile review, the final questions, the owner's
  sign-off; then the build half. Working log (git-ignored):
  `.superpowers/sdd/2026-10-30-architecture-pass/progress.md`.
- **Now: the requirements.** The owner confirms them on the owner
  site's Decisions page: the ten promises (their questions are listed
  below by title); the quality targets (42, fourteen with a number the
  owner sets) and the extension cases (24), drafted and checked in
  `docs/plans/architecture-pass/requirements/`; and the readings the
  decision record marks "to be confirmed". The site is being rewritten
  to the proactive frame for this (plan
  `docs/plans/architecture-pass/report/site/2026-11-01-site-plan-v2.md`).
  Then the panel: its brief goes to the owner before it runs.
- **Done so far.** Green's three follow-ups merged on 2026-10-30 at
  `089dd527` (full backend suite, coverage check and lint passed). The
  review of today's engine
  (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md`:
  sixteen design flaws over 358 findings, 21 set aside) is now
  evidence and test situations, not the design's input. The owner
  site, version 8. The decision record by topic.
- **The decisions** live in `docs/plans/architecture-pass/DECISIONS.md`,
  by topic: what stands now, each written as current truth with a
  dated history beneath, and the superseded ones in their own section.
  New decisions go there as the owner makes them, then into the pass's
  documents (`docs/agents/process.md` §5). Open for the owner, by
  title, each with its evidence on the owner site's Decisions page
  ("What the Engine Promises",
  https://claude.ai/artifact/RzL2FzCZ4eESSNMYwkkKPL): about the
  promises, "Are these the right ten promises?", "Two clauses added to
  the pack promise", "The roles promise covers who may act", "The venue
  promise names declared standalone", "Split the tap promise in two?",
  "Keep the venue promise whole?", "Proof and release in one promise?"
  and "Which promise carries equipment state on screens?"; about
  standalone games, "The ESP32's standalone mode", "One GM tablet per
  standalone game?" and "Exposed evidence and video with no engine";
  about the game's record, "Record every refused GM scan attempt?".
  Kept for the design rounds, not questions now: the page's twelve
  design choices, from where "this game is standalone" is declared to
  whether paper documents join the pack. "How much the rig proves
  before design" was withdrawn by "Build the test rig when building
  starts". Old decision and question numbers map to titles in the
  record's last table.
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
- **Live state** (2026-11-01): the relationship map is done and on the
  owner's page, now in the owner's words ("Promises, qualities,
  moments, venue technician": workflows
  `wf_d5b390ac-27a`, `wf_81c41f8d-ec0` and `wf_b5ed9f35-493`, 28
  conflicts applied); waiting for the owner's answers. The owner asked how the
  ten jobs relate, at both levels (the big components and the modules
  inside them), and said J8 and J9 read as mechanics, not what they do
  for people. Workflow `wf_5f2445a0-bac`
  (`docs/agents/workflow-scripts/engine-shape.js`) wrote four maps
  (`docs/plans/architecture-pass/relationships/`) and
  `docs/plans/architecture-pass/2026-11-01-engine-shape.md`: every job
  restated from the side of the people it serves, eleven shared
  mechanisms, thirteen tangles, and a candidate shape of 17 parts with
  one direction of dependency (54 edges, no cycle). Its check held 122
  claims and corrected 78; the fold applied them (section 8). Workflow
  `wf_b02b162e-653` (`reconcile-shape.js`) brought every card's
  candidate design and every job's entry into line with the shape (182
  verdicts, 96 corrected). Workflow `wf_c3571dd0-522`
  (`page-consistency.js`) put the cards and jobs into plain words and
  checked the whole page (57 conflicts, all applied); `wf_206a51c3-758`
  (`page-fix-verify.js`) confirmed 54 resolved and 3 partly, and its 10
  new conflicts were settled at `f509848c`. The map changed three
  recommendations: "Keep the venue promise whole?" (rename the venue
  promise, not split), "Proof and release in one promise?" (widen the
  proof-and-release promise), "Which promise carries equipment state
  on screens?" (route equipment state by one delivery part, so neither
  sentence changes, if step 3 keeps one delivery part). Records for
  step 3, not questions now: the shape departs from the ratified capability map on where the
  start-or-adopt setting lives (the page's step-3 preview asks); the
  shape is silent on a short offline claim list on a disconnected
  tablet (`report/2026-11-01-cards-shape-facts-check.md`). No
  worktrees, no test rig.
- **In flight** (2026-11-01): the owner site's rewrite to the proactive
  frame (version 9: Requirements, Design and Today's engine in place of
  Promises, Parts and Design flaws; titles, not numbers; the sequencing
  names; the jargon table's wordings). Version 8 stays live until it
  ships. Done: its content (`wf_e076baba-f34`, overlays in
  `report/site/v9/`, each with a writer's log; 99 conflicts, 95
  applied). Running: the build (`wf_0a97fbef-eae`: the standing rules
  in `site/v9/rules.json`, the requirements in plain words with a
  settled/proposed kind per item, `build_site.py` restructured for the
  six pages). Next: the panel's brief joins the Design page with three
  questions on Decisions (its draft:
  `docs/plans/architecture-pass/panel/2026-11-01-panel-brief.md`; its site
  content, merged into the overlays once the build lands:
  `docs/plans/architecture-pass/panel/2026-11-01-panel-site-content.json`), then the page checks
  (`docs/agents/workflow-scripts/site-v9-check.js`), then publish.
- **The owner's site.** "What the Engine Promises"
  (https://claude.ai/artifact/RzL2FzCZ4eESSNMYwkkKPL), version 8 live
  (version id 1793525496-560c, 2026-11-01): five linked pages and a
  change log ("The owner's site: five linked pages"), `index.html` (the engine), `decisions.html`,
  `promises.html`, `parts.html`, `flaws.html`, `changes.html`, all in
  `docs/plans/architecture-pass/report/site/`. Built by
  `report/build_site.py` from the four page-data files in `report/`
  and three overlays (`site/front.json`, `site/decisions.json`,
  `site/changes.json`, whose `[[markers]]` become links); every diagram
  is drawn at build time (`report/render_diagrams.js`, themed by
  `report/diagram_theme.py`), so no page loads a script. Rebuild:
  `cd docs/plans/architecture-pass/report && MERMAID_JS=<a local
  mermaid 11.4.1 mermaid.min.js, optional> python3 -I build_site.py`,
  then `node site_smoke.js site <shots dir>` (24 loads). Plan:
  `site/2026-11-01-site-plan.md`; what each element of version 7 became:
  `site/inventory.md`; checks: `site/checks/`. Workflows
  `wf_d5c8c6db-981` (content), `wf_c3df370d-0dc` (build),
  `wf_73d06a3f-69f` (six page checks, 116 applied), `wf_88aa92da-12e`
  (fix round), `wf_2d4b9ada-f47` (final check). `report/build_report.py`
  and `report/2026-10-31-cause-report.html` are version 7's builder and
  page, retired. Version 7 history follows.
- **Version 7 and before** (the single page): "What the Engine Promises"
  (same link; version 7 was live until version 8 replaced it;
  published 2026-11-01 after the owner said the 17-part shape was never
  diagrammed and the page did not show how everything comes together:
  the candidate shape now opens with one hand-drawn picture of the
  whole engine and five moments followed through its parts, checked
  against the shape twice (`wf_ef6158a7-f16`, `wf_6b57ff3f-3f3`).
  Version 6 was
  published 2026-11-01 in the words of "Promises, qualities, moments,
  venue technician": ten promises named
  by title, "How the promises fit together", part cards that say which
  promises each part mainly keeps and how its work is done today.
  Version 5 carried "How the jobs fit together";
  source `docs/plans/architecture-pass/report/`, built by
  `build_report.py`) leads with the engine's ten jobs
  (`docs/plans/architecture-pass/2026-10-31-engine-jobs.md`, workflow
  `wf_f3c1ef9e-a97`), with the design flaws under each job, the
  standalone pass (`2026-10-31-standalone-pass.md`, workflow
  `wf_d1152165-580`) and the evidence at the back. The consistency check
  the owner asked for ran as `wf_4e810a25-00f`: 39 conflicts, all
  applied (cause analysis section 8). Questions: the jobs (is the list
  right, and the seven promise questions now on the Decisions page by
  title), the standalone questions (the ESP32's standalone mode, one GM
  tablet per standalone game, exposed evidence and video with no
  engine), "Record every refused GM scan attempt?" and "How much the
  rig proves before design"; "Flaws none of the pass's questions
  covers" is folded into "Proof and release in one promise?" and "Is
  the missing standalone declaration a flaw?" into "The venue promise
  names declared standalone".
- **Earlier runs.** The doc-drift fixes merged at `4fc04790` (ALNScanner
  `b521774`). The cause-analysis workflow `wf_5b8300fe-cb6` finished on
  2026-10-30. Three read-only mapping runs finished earlier on
  2026-10-30 (`wf_7bc41460-e87`, `wf_dfeaf164-afd`,
  `wf_3f365994-ba6`); their nine files are the pass's evidence in
  `docs/plans/architecture-pass/`: start with
  `2026-10-30-map-runtime-state.md` section 0 (corrections) and section
  1. The last code merge, `089dd527` (green's follow-ups), passed CI run
  305 on 2026-10-30, after `04578a40` pinned the jobs that install
  Playwright's Chromium to ubuntu-24.04 (GitHub's default image moved
  to 26.04, which Playwright 1.57 refuses).

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
  purpose now moves into the pass's phase 2 ("The truth sweep's
  charter is retired").
- **Block 2, hardening:** done and merged: the kinds of equipment a
  pack can ask for and a venue profile can name (the equipment
  families), the code that marks equipment not installed tonight (the
  dormancy core) and the smallest test set-up (the test-harness
  minimum). They stay; phase 2 changes
  them only where a rule requires ("Corrections to the readers and the
  hardening pieces"). To be rebuilt inside the pass's phase 2 ("One
  program: design half, then build half"): the profile check, the dormancy-core
  fixes, credentials, the supervisor, the self-heal, the preflight
  checks and panel, the final wiring, the close review. Those with
  briefs carry an on-hold line; the preflight checks and panel, the
  wiring and the close review have no brief yet. The piece names are
  the plan's plain names (plan §4). Green's three follow-ups merged on
  2026-10-30 (`089dd527`).
- **Block 3, truth sweep:** never started; its audit notes were lost.
  Its charter is retired, and its purpose moves into the pass's phase
  2, covering every screen ("The truth sweep's charter is retired").
- **Blocks 4 to 6 and the later blocks:** not started. The capture
  block, the preview block and the later blocks come after phase 2;
  the new roadmap places Block 6 ("One program: design half, then
  build half"; "Five documents the design half hands over").
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
