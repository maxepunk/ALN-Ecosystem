# Guide repair brief — the deployment guide for a fresh install on green (implementer)

Read this first; it is your single source of requirements. Vocabulary:
`CONTEXT.md` §5 (kit, venue, installation profile, blue/green, remote
display, preflight). Model: Opus. You dispatch no subagents; review
arrives from the orchestrator after your report. Ruling R24 of the
hardening plan (`docs/plans/2026-09-12-block2-hardening-plan.md` §1)
defines this task.

## What this buys, and for whom

The owner sets up the green machine from a fresh Raspberry Pi OS image
this week and follows `DEPLOYMENT_GUIDE.md` to do it. Today the guide
is written for the Bookworm release and for blue: the research found
ten differences that break a fresh install silently, a gate that passes
a broken machine, stale sections, and steps the guide never had (Home
Assistant, media transfer, the installation profile, boot-to-running).
The owner's instruction: fix all the documentation; archive or delete
deprecated documents. After this task one document, read top to
bottom, takes the owner from a blank card to a machine that passes the
acceptance checklist, and every other document either agrees with it
or points at it.

## Where you work

Edit under `/home/user/ALN-Ecosystem/.worktrees/docs/` (the designated
branch). Verify every code fact in the main checkout
`/home/user/ALN-Ecosystem/` (same backend content; the scanner and
data submodules are present there, not in the docs worktree). The
top-level `/home/user/ALNScanner` and `/home/user/ALN-TokenData`
directories are stale clones: never read them. Never run a git write
command except `git mv` for Task B; never commit (the orchestrator
commits). Do not edit the research document, the plan, the state page,
`CONTEXT.md` or `ROADMAP.md`; say in the report what they should say.

## Inputs, in reading order

1. `docs/plans/2026-09-12-green-fresh-install-research.md`: the
   Conclusions (ten differences, the copy / read / never lists, the
   pull list, the install order), §2 (each difference and its smallest
   fix, §2.11 the bus address, §2.12 the checklist's edits), §3, §4, §5,
   §9 (the ranking). Its facts are sourced; reuse them, do not re-derive.
2. `docs/plans/ROADMAP.md` Appendix C: the repair scope ruled before the
   research (write, reconcile, fix, remove, add). Every item is yours.
3. `docs/runbooks/2026-09-thursday-token-sync.md` §"Where the code and
   the assumption differ": thirteen facts about the sync on green.
4. `docs/plans/CURRENT-STATE.md` §2: how the venue runs today (the
   fixed address; two GM tablets; three hardware scanners; two
   scoreboard displays — the TV on HDMI driven by the Pi's own browser,
   and a remote display, a Pi 4 running a browser in fullscreen at the
   scoreboard link; the certificate warning accepted once per device;
   DNS and the certificate deferred; blue's filesystem reachable from
   green over a network share).
5. `backend/.env.example` and `backend/src/config/index.js` for the
   environment keys; `DEPLOYMENT_GUIDE.md` and
   `docs/preflight-checklist.md` as they stand.

## Task A — the guide and the checklist

Repair `DEPLOYMENT_GUIDE.md` and `docs/preflight-checklist.md` so that:

1. **Appendix C, item by item.** Each of its items (every "Write",
   "Reconcile", "Fix", "Remove", "Add") is either already true in the
   guide (cite the lines), written now (cite the new lines), or
   deferred with a reason the roadmap already gives (only the
   certificate spike, row 8.19). The research found two items already
   done (the Bluetooth instruction inverted, two of three password
   sections gone) — confirm on the tree, do not take the research's
   word.
2. **The ten differences land at the step where each applies**, in the
   research's install order (§5): the X11 switch at first boot; the
   WirePlumber drop-in in `wireplumber.conf.d/` with its `mkdir -p`;
   `chromium` plus `CHROMIUM_BIN` in `backend/.env`; Node 22; the apt
   Python packages; the address reservation moved to green's MAC at
   cutover; the timezone as step 0; the certificate check and copy
   between the clone and the first `npm start`; the bus variables in
   `.env` with the rule the research states (dotenv never overrides an
   inherited value: start, and `pm2 restart --update-env`, from an SSH
   shell); the repaired gate. Where the guide's old text said the
   Bookworm thing, replace it; keep one "changed from" note only where
   the owner would otherwise look for the old step.
3. **Three lists, as steps, not prose:** copy from blue (over the
   network share, mounted on green — the share's name and credentials
   are the owner's: write the mount with placeholders `//<blue>/<share>`
   and a check that lists the certificate directory; the `.env` copy
   placed after the clone and before the Home Assistant container step
   and the first `npm start`, then audited for blue-only values); pull
   from git (the pack pinned at blue's submodule revision, read on blue
   with `git -C ~/ALN-Ecosystem/ALN-TokenData rev-parse HEAD`; the
   content hash is the verification against `/health`, never the
   source); never copy (`backend/data/`, `~/.pm2/`,
   `/var/lib/bluetooth/`, the `.lua` drop-in).
4. **The runbook's thirteen facts** that are deployment facts land in
   the guide's operations section (audio and video files placed by
   hand before a sync; `fonts-dejavu-core` before the first sync on
   green and the 127-file check; the orchestrator restart after a sync,
   devices rebooted only after it; the pack-manifest rebuild after a
   hand edit; the web player scanner's nested pin; the hardware
   scanner's 50,000-byte token ceiling). The runbook then points at
   that section instead of repeating it (one source of truth; edit the
   runbook's pointer, nothing else in it).
5. **The connection posture and the two displays** (Appendix C "Add"):
   the fixed address; the self-signed certificate copied from blue; the
   warning accepted once per tablet and on the Pi 4 remote display; the
   TV display is the Pi's own browser, spawned by the orchestrator only
   when the scoreboard is first shown; DNS and the certificate deferred
   to row 8.19.
6. **The checklist:** the five edits of research §2.12; the chromium
   check reads `CHROMIUM_BIN` from `backend/.env`; the display check is
   the xdotool search with its precondition (orchestrator running, the
   scoreboard shown once from the panel); the header no longer pins
   blue's path; the required-service line names MPD, never `spotifyd`.
7. **The environment keys:** every key in `backend/.env.example` has a
   line in the guide (count them both; the counts match in the report),
   and the five keys documented nowhere (the pack path, the profile
   path, the scoreboard window marker, the idle-loop file, the browser
   binary) are written from the code that reads them, each with its
   `file:line`.
8. **Boot to running (Q13):** `pm2 startup`, `pm2 save`, the logind
   window, the cold-boot check, written as steps.
9. **A "Green, fresh install, September 2026 — start here" section at
   the top of the guide**: the three lists and the install order in
   one screen, each line pointing at the guide step that carries it,
   and the inputs only the owner holds (the share name; the Bluetooth
   speaker's sink name for the profile; the Home Assistant scenes ride
   the `~/ha-config` copy). This section is the owner's guide-ready
   note.

Completion criterion for Task A, written into the report as tables:
one row per Appendix C item, per research difference (1–10), per list
entry (copy, read, never, pull), per runbook fact (1–13), per checklist
edit, and per environment key — each with the guide or checklist line
where it now lives; and the grep counts, after your edits, for
`Bookworm`, `setup_20`, `chromium-browser`, `main.lua.d`, `spotifyd`,
`scoreboard password` (case-insensitive) in both files, each hit
justified as a "changed from" note or absent.

## Task B — the documentation sweep

Find every document in the parent repository that tells a person how
to set up, deploy or operate the machine: run
`grep -rlE 'raspi-config|pm2 startup|Raspberry Pi OS|Bookworm|DEPLOYMENT_GUIDE|apt install' --include=*.md .`
from the docs worktree, excluding `node_modules`, the submodule
directories and `docs/ARCHIVE/`; add the root `*.md` files and
`docs/*.md` by hand. For each file, one verdict: **current** (agrees
with the repaired guide, or is a record — plans, briefs, reviews,
runbooks, `CONTEXT.md`, `ROADMAP.md`, `CLAUDE.md` files and everything
under `docs/plans/` are records and stay), **repaired** (a deployment
claim in it now contradicts the guide: replace the claim with a pointer
to the guide section), or **archived** (a document whose only job the
guide now does: `git mv` it to `docs/ARCHIVE/2026-09-deployment/` and
add one line to `docs/ARCHIVE/2026-09-deployment/README.md` saying what
replaced it). The Pi 5 video settings that Appendix C says live only in
an agent document: find that document, move the settings into the
guide's machine-preparation step, and give the source the pointer.

Completion criterion for Task B: the table of every candidate file
(the grep list plus the hand-added ones) with its verdict and, for
repaired and archived files, the lines changed or the new path.

## Guardrails

Plain language (`docs/agents/process.md` §4): short sentences, active
voice, one idea per sentence; a newcomer can follow it. Every claim
about code cites `file:line` on the main checkout. Every command in
the guide comes from the research document (sourced), from the
existing guide, or is verified on this container; write no command from
memory. Placeholders in angle brackets only where the value is the
owner's. The research document is read, never edited. Push nothing.

## Report

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/guide-repair-report.md`:
Status (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED); Files
changed (with `git -C /home/user/ALN-Ecosystem/.worktrees/docs status --short`);
the Task A tables and grep counts; the Task B table; what the research
document, the plan or the state page should now say (you do not edit
them); Concerns. Reply with at most 10 lines: status, files changed,
the counts, the report path.
