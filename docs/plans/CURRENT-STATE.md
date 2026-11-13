# Current state — the entry point (one screen, edited in place)

Read this first after any compaction, restart or new session. Nothing
else is required reading: the pointers at the bottom say what to open
and when. Check every claim of a summary against git and this page
before acting.

## 0. Resume here (2026-11-10)

- **The current unit** is the architecture pass: improving the
  architecture of the engine being rebuilt, so the rest of the rebuild
  stands on a sound structure. The owner's goal: "design a long-term
  optimal architecture for our engine that makes it intuitive and easy
  to maintain, continue development on, and extend". The method, since
  2026-11-10, is the three steps of the skill
  `improve-codebase-architecture`: explore the code, propose
  improvements in one visual report, work through what the owner picks.
  The heavy process around the design (requirements for review, an
  architects' panel, competing designs for every round) is retired. The
  owner's decisions about order are NOT retired: design first and then
  build, the hardest things to reverse first, a thin first version end
  to end, blue running ALN until the new engine is ready, and the
  paused hardening work waiting for the design. The ratified program document is
  `docs/plans/2026-10-30-architecture-pass.md`, and the decisions are in
  `docs/plans/architecture-pass/DECISIONS.md`. Working log
  (git-ignored):
  `.superpowers/sdd/2026-10-30-architecture-pass/progress.md`.
- **Now: the design of the messages between the backend and the
  devices, and the files, is settled (2026-11-13).** All by the owner:
  what a player sees after a scan, the same on the player scanner page
  and the hardware scanner; what a device that is out of date does; the
  pack says what each kind of device is sent (for ALN a player scanner
  gets the picture, sound and video name only); a GM sees the result of
  a scan when the backend replies; token ids are lowercase letters,
  digits and underscores; every device shows a credential, in three
  kinds (`docs/adr/0004`; this answers roadmap row 8.11: yes); the
  hardware scanner takes its firmware over the air after the cutover
  (`docs/adr/0006`); and after the cutover an iPhone and an Android
  phone scan a token the same way, so a tag holds the web link first
  and the token's id second (`docs/adr/0005`). On the tag the agent had
  recommended keeping the id first for ALN. The owner ruled the other
  way ("let's stick with the decision that AFTER the cutover, iphone
  and android paths to scan a token should be the same") and the agent
  agreed. What follows for the engineering is at the end of the working
  note: a short link, firmware that reads a tag written either way so
  that the tags are rewritten after the cutover, the GM scanner reading
  tags whenever it is on screen, a fresh page load at every scan, and
  the check on real phones at the start of the kit's DNS work. Earlier
  in this topic the agent had waved players' own phones off as "later
  work"; the owner: design the architecture to enable them now. The
  working note, with the owner's answers word for word, the two
  research files and what the owner had already decided about phones:
  `docs/plans/architecture-pass/design/2026-11-13-the-messages-and-files.md`.
  The design of how the backend keeps a session's data is settled. Decided on 2026-11-13,
  all by the owner: the session record only grows (`docs/adr/0001`); it
  holds the game, the capture, what the room did and what went wrong,
  one line for each event a person at the session would recognise
  (`docs/adr/0002`); after a session ends, notes, photos and the
  accusation can be added until the next session is created, and stored
  player scans that arrive late go into the session they were made in;
  between groups, what the group's play produced is wiped and kept only
  in that session's record, what is about the room stays, and the pack
  belongs to the production (`docs/adr/0003`); a backend runs one
  session at a time; each line names the device, not a person; moving
  money between accounts becomes one action for the GM and one line in
  the record, built with the GM scanner's redesign (ROADMAP row 8.17).
  Stated to the owner and not objected to: corrections stay visible in
  the record. The owner also confirmed how ALN runs while this work is
  done and the order of work. The page is version 25 (version id
  1794553647-5f13; source
  `docs/plans/architecture-pass/proposal/index.html`); it is the plan,
  and its last box lists what is decided and what is next. **Two rules
  from the owner on 2026-11-13.** (1) Never ask the owner whether a
  unit of work the agent defined is complete: at the start of each
  design topic, say which decisions are the owner's; the topic is
  settled when those are made. (2) No bare step or round numbers: name
  each piece of work by what it does, and question rounds go by date
  (the owner's rule of 2026-11-01, "Name each step by what it does").
  **The design of which device decides what is settled too
  (2026-11-13; the owner: "yes to all 3").** (1) A GM scanner with no
  connection works out the result itself and shows it at once, marked
  "not confirmed", and sends the scan when the connection returns; a
  result the backend has confirmed is never taken back; of two scans of
  one token, the first to reach the backend counts. (2) If the
  backend's computer dies and does not come back, the session goes on
  at the GM scanners, the room's video, music, lights and TV stop, and
  the scores and the record are completed when a backend runs again;
  no spare computer is required (`docs/adr/0007` for both). (3) For a
  game with no backend, the installation's settings say so and the GM
  no longer picks at start-up, every device works alone during play,
  and the GM scanner keeps the record and can save it (`docs/adr/0008`).
  Stated and not objected to: the GM scanner runs all of the game's
  rules, the same code as the backend; scans a GM scanner stored during
  a session count even when they arrive after its end (`docs/adr/0003`,
  amended). The working note:
  `docs/plans/architecture-pass/design/2026-11-13-which-device-decides-what.md`.
  **In progress: how the engine is extended** (the proposal's changes
  6, 4 and 7). Two of its three decisions are made (2026-11-13): a new
  capability becomes part of the engine and arrives with an engine
  update, with no add-ons (`docs/adr/0009`); and after a restart the
  session, clock, logins, music, TV, lights and volumes come back by
  themselves, while a video or cue that was cut off or missed is listed
  for the GM (`docs/adr/0010`). **The first decision went back to the
  agent, with a correction that binds everything after it.** The agent
  had recommended that a designer's rules may only run the room and
  that scoring is a developer's work. The owner: "This seems like
  you're somehow getting caught up in a bias towards maintaining the
  existing ALN ruleset instead of designing an engine that allows NEW
  games to be designed which MUST INCLUDE how things are scored / the
  verbs a designer can allow players to engage in using tokens." So: a
  designer designs a game's rules in the pack, scoring and the players'
  verbs included. Say "designer", never "maker". Do not treat today's
  code (one scoring formula, cues that only run the room) or the floor
  of 2026-07-09 (who may do staff actions) as limits on the game's own
  rules. Before answering, the agent reads the owner's records on
  rules, scoring and verbs itself, in full; the list is at the end of
  the working note
  `docs/plans/architecture-pass/design/2026-11-13-how-the-engine-is-extended.md`.
  **After that: how today's code moves to the new design.** A helper
  was started on 2026-11-13 to gather facts for it into
  `docs/plans/architecture-pass/design/2026-11-13-how-todays-code-moves-facts.md`
  (no recommendation in it; check its claims before relying on them;
  commit the file when it arrives). The decision itself is the lead's
  to work out and put to the owner.
  The questions as asked, the
  recommendations, the owner's answers word for word and the facts
  looked up for the first topic are in
  `docs/plans/architecture-pass/design/2026-11-13-how-the-backend-keeps-a-sessions-data.md`.
  When the owner answers a question: write the answer word for word
  into the topic's note, into `DECISIONS.md` ("Since the proposal"),
  onto this page, into `CONTEXT.md` when a term settles, and into
  `docs/adr/` when a decision is hard to reverse; then work out what is
  still open from the design tree in the note. The method is the skills `grilling` and
  `domain-modeling` (`docs/agents/process.md` section 1, the row for
  `grill-with-docs`). The seven changes: (1) the backend keeps one
  complete record of each session and updates every screen from it the
  same way; (2) a standalone game runs the same game code as a
  networked one; (3) the messages between the backend and the devices
  are defined in one place and checked automatically; (4) video, music,
  sound and lights are controlled through one pattern, and their
  programs restart when they crash; (5) the engine keeps separate what
  belongs to one session, one installation and the whole production;
  (6) the code has a known place for adding a new kind of rule,
  equipment or screen; (7) the backend is assembled in one place, and a
  copy started for a test or a rehearsal leaves the installed backend as
  it was. The picture the owner confirmed: blue (the backend computer
  in use, its scanners, the branch `production-2026-07`) runs every ALN
  session until all of the new engine is finished; then one cutover,
  green replacing blue and the hardware scanners re-flashed; nothing has
  to stay compatible with the old parts; green has not been started.
  The order the owner confirmed: design how the backend keeps a
  session's data (changes 1 and 5); the messages and files (3); which
  device decides what (2); how the engine is extended (6, with 4 and
  7); how today's code moves to the new design; then build a thin first
  version end to end; then one area at a time; then the cutover. Do not
  start building anything before the design it depends on is settled.
  Never order work by what needs no decision from the owner. Before
  talking to the owner, read three notes in
  `docs/plans/architecture-pass/rework/`:
  `2026-11-10-owner-step-back.md` (why the old site was retired, and
  the words to use), `2026-11-10-what-the-engine-is.md` (what the
  engine is supposed to be; physical against digital) and
  `2026-11-12-owner-comments-on-proposal.md` (the eight comments, the
  decisions they rest on, what a backend restart does today). Do not
  rebuild the old site, run the panel, or ask for answers to the old
  site's questions. Owed, and not blocking the conversation: remove the
  retired site's files and cut `DECISIONS.md` down (keep what the
  proposal cites: the extension cases, the relationship maps, the cause
  analysis), and sharpen three glossary entries (Token, Kit, "tonight").
- **Words for anything the owner reads.** After version 12 the owner
  said the descriptions had drifted into jargon and were ambiguous
  ("what does 'the same core runs wherever a game is decided' even
  mean?"). The cause: the agent had replaced the project's own names
  with made-up ones. Use the owner's and the glossary's names: backend,
  GM scanner, player scanner (the hardware one, or the web page on a
  phone), scoreboard, config tool, pack, kit, installation, production,
  session, standalone, networked. Never "show machine", "GM tablet",
  "design tool", "venue setup", "core", "door", or any other made-up
  label. For ALN say "account", never "team" (the engine's own word is
  "entity"). Never "step 1" or "round 2": name the work by what it does.
  A title is a plain sentence. A "today" line says what happens
  to a scan, a GM or a restart. The table of replacements is the last
  section of `rework/2026-11-10-owner-step-back.md`. `DECISIONS.md`
  still uses the made-up names; replace them when it is cut down. On
  2026-11-13 the owner asked for the tag decision to be rewritten "in
  clear, plain english": put a decision in the words a GM would use
  (the token's id, the web link, which is written first on the tag),
  never record, exchange, reader or definition, and say what each side
  of the choice does to a player or a GM before recommending.
- **Done so far.** Green's three follow-ups merged on 2026-10-30 at
  `089dd527` (full backend suite, coverage check and lint passed). The
  review of today's engine
  (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md`: sixteen
  design flaws over 358 findings, 21 set aside) is now evidence and test
  situations, not the design's input. The decision record by topic. The
  one-page architecture proposal, challenged by three independent
  readers.
- **The decisions** live in `docs/plans/architecture-pass/DECISIONS.md`,
  by topic: what stands now, each written as current truth with a dated
  history beneath, and the superseded ones in their own section. New
  decisions go there as the owner makes them, then into the pass's
  documents (`docs/agents/process.md` §5). The owner's decisions in it
  stand. Its entries on how the design half runs (the panel, the design
  rounds, the site's pages) describe the process retired on 2026-11-10
  and are history until the record is cut down. Open for the owner now:
  nothing at this moment (see "Now"). The proposal does not decide two
  product questions that come up in the next two design topics: what a GM may
  tell a team while their GM scanner has no connection, and what a
  device that missed a software update may do. The owner answered a
  third on 2026-11-12: no real situation has a test or a rehearsal
  running during a live session. Old
  decision and question numbers map to titles in the record's last
  table.
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
- **In flight:** nothing. Waiting for the owner's reply to the proposal
  (see "Now").
- **The owner's site.** "What the Engine Promises"
  (https://claude.ai/artifact/RzL2FzCZ4eESSNMYwkkKPL), since 2026-11-10
  it is one page, the architecture proposal (version id
  1794293132-2669), published from
  `docs/plans/architecture-pass/proposal/index.html` with the Artifact
  tool, passing the address as `url`. It is written by hand, with no
  build step. The retired six-page site (versions 8 to 11) and its
  machinery are still in the tree until the owner accepts the proposal:
  `docs/plans/architecture-pass/report/` (the builder, the page data,
  `site/`, the checks), `requirements/`, `panel/`, and the site's
  workflow scripts under `docs/agents/workflow-scripts/`. Do not extend
  them. Remove them, and cut the decision record down to the owner's
  decisions, once the owner has accepted the proposal; git history keeps
  everything.
- **Version 8** (five linked pages, version id 1793525496-560c,
  2026-11-01) is in git history: its overlays (`site/front.json`,
  `site/decisions.json`, `site/changes.json`) and its plan
  `site/2026-11-01-site-plan.md` with `site/inventory.md`; its pages
  were last built at commit `72b4f813`. Workflows `wf_d5c8c6db-981`,
  `wf_c3df370d-0dc`, `wf_73d06a3f-69f`, `wf_88aa92da-12e`,
  `wf_2d4b9ada-f47`. `report/build_report.py` and
  `report/2026-10-31-cause-report.html` are version 7's builder and
  page, retired.
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
