# Green follow-ups brief — three code-side facts the guide repair could not fix (implementer)

Read this first; it is your single source of requirements. Vocabulary:
`CONTEXT.md` §4 (alarm integrity), §5 (blue/green). Model: Sonnet. You
dispatch no subagents; review arrives from the orchestrator after your
report.

## What this buys, and for whom

The deployment guide now describes a fresh install on the new machine
(green). Three files the guide repair was not allowed to edit still
contradict it: the environment template lacks the two bus variables
the guide tells the owner to set; the Python requirements file tells
the owner to run a pip command the new OS refuses; and the
orchestrator's boot check looks for the WirePlumber rule at the old
path only, so a correctly built green logs "WirePlumber rule missing"
on every boot — a false alarm on the one machine the rule is right on.

## Where you work

The worktree and branch the dispatch names. Backend and `scripts/`
only. Push nothing. Never amend or rewrite a commit. The top-level
`/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are
stale clones: never read them.

## Deliverables (one commit each)

1. **The boot check accepts both WirePlumber paths.**
   `backend/src/services/audioRoutingService.js` `_verifyWirePlumberRule()`:
   the rule is present when EITHER
   `/etc/wireplumber/wireplumber.conf.d/51-aln-vlc-no-restore.conf`
   (WirePlumber 0.5, the guide's path) OR
   `/etc/wireplumber/main.lua.d/51-aln-vlc-no-restore.lua` (0.4, blue's
   path) exists; the warn fires only when neither does and names both
   paths and "DEPLOYMENT_GUIDE.md, the WirePlumber step" (drop the
   "Step 5" number, which no longer matches). Red first: a unit test in
   `backend/tests/unit/services/audioRoutingService.test.js` (or the
   file that tests this service; find it) with `fs.promises.access`
   stubbed: `.conf` present → no warn; `.lua` present → no warn;
   neither → one warn naming both paths.
2. **The environment template carries the two bus variables.**
   `backend/.env.example`: two commented-out lines,
   `#DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus` and
   `#XDG_RUNTIME_DIR=/run/user/1000`, under a four-line comment saying
   why (PM2 resurrects the orchestrator with the environment of the
   first start; every `pactl` and VLC D-Bus call inherits these; set
   them here and start from an SSH shell, where they are unset, because
   dotenv never overrides a value the shell already exports). Place
   them beside `CHROMIUM_BIN` (`:172`). If a contract or unit test pins
   the template's key set, update it and say so.
3. **The requirements file says how to install on the new OS.**
   `scripts/requirements.txt:2`: replace the `pip install -r` line with
   the apt line the guide carries
   (`sudo apt install python3-requests python3-pil python3-dotenv`)
   and one line naming the venv alternative; keep the package list
   unchanged.

## Proof runs

From `backend/`: the RED and GREEN run of the new test; `npm test`;
`npm run coverage:check`; `npm run lint`. Paste each command and its
summary line.

## Report

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/green-followups-report.md`:
Status; Commits; RED/GREEN evidence; Proof runs; Files changed;
Concerns. Reply with at most 6 lines.
