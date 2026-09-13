# P2 fact sheet brief — the test harness: worker isolation, teardown, log guard, health timer, fixtures, merge gate (reader)

You read; you write one file, the fact sheet named under Output. Change
nothing else and kill nothing. Vocabulary: `CONTEXT.md` §5 (environment
ladder, rung, witness lights, simulation). Model: Sonnet. You dispatch
no subagents.

## Where you work

Work only under `/home/user/ALN-Ecosystem/`. The top-level
`/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are
stale clones: never read them.

## Why

Before round 3, Block 2 repairs the test harness so that a parallel
worker cannot delete another worker's session file, a closed output pipe
cannot fill the disk, a test file's health timer stops when the file
ends, fixture generation runs once per run, and every run tears down
what it started. It also adds a one-command merge gate that mirrors CI.
The orchestrator writes those briefs from your facts, never from memory.
Every claim cites a file and a line.

## Questions (answer every one)

1. `backend/tests/e2e/setup/test-server.js`: the environment block
   passed to the spawned orchestrator (file:line, the full key list);
   where `DATA_DIR` and `LOGS_DIR` would be set; how the worker slot is
   known (`WORKER_SLOT` in `session-env.js` and its source variable);
   `clearSessionData()` in full; `startOrchestrator`, `stopOrchestrator`,
   `restartOrchestrator`: which child PIDs are tracked and killed on stop
   (the orchestrator, VLC, others), and what survives when a Playwright
   worker dies in the middle of a test.
2. `backend/src/config/index.js`, `persistenceService.js`, the logger:
   confirm `DATA_DIR` and `LOGS_DIR` are read from the environment
   (file:line) and how the log file paths are built.
3. `backend/src/utils/logger.js`: the transports; the `uncaughtException`
   handler near line 164, exactly what it writes and to which transports;
   whether any transport has an `error` handler. Trace how a closed
   stdout pipe (EPIPE) produces the loop seen in the T1a record (about
   40 megabytes per second into `combined.log`). Cite the winston version
   (package.json) and the transport options.
4. `backend/tests/helpers/service-reset.js` `resetAllServicesForTesting`:
   what it calls, in order; where the health revalidation timer restarts
   (`systemReset.js` near line 291, `app.js` near line 333: confirm) and
   whether the helper stops it. Count the integration test files that
   call the helper (`grep -l`, list them) and the files that call
   `stopRevalidation` (expect one: `service-state-push.test.js`). Check
   `jest.integration.config.js` for a global teardown.
5. Fixture generation: `backend/tests/rung1/generate-fixtures.js` and
   `generateFixtures` / `provisionForRun` in `session-env.js` and
   `provision.js`: which files they write (paths), whether every worker
   runs them, any lock or guard, and where the race the T1b record calls
   "the generate-fixtures parity-pack race" (ruling 9) can occur. Quote
   the code.
6. Teardown today: Playwright `globalSetup` and `globalTeardown` in
   `backend/playwright.config.js`; what `provision.js` spawns per run and
   per worker (the display, the buses, others) and which PIDs it records
   where; what `backend/tests/rung1/down.sh` reaps (by PID file only?);
   how the CI job's "Cleaning up orphan processes" step differs. Then
   list what the current container holds, read-only:
   `ls -la /tmp/aln-e2e-env /tmp/rung1`, `ls /tmp/aln-pm-*.pid`, and
   `ps -eo pid,etime,args | grep -E 'vlc|dbus-daemon|Xvfb|node' | grep -v grep`.
7. `backend/tests/rung1/probe.sh`: the PipeWire check near lines 18 to
   20 runs `pactl` as the invoking user, while the rig's PipeWire runs as
   user `rung1vlc` with `XDG_RUNTIME_DIR=/tmp/rung1/xdg`. Confirm this
   and propose, without applying, the smallest change that makes the
   probe use the rig user.
8. The stale unit-test PID file: find the unit test that writes
   `/tmp/aln-pm-bluez-dbus-monitor.pid` with PID 99999 (grep
   `backend/tests/unit` for `aln-pm-` and `99999`). Does it clean up
   after itself?
9. The merge gate must mirror CI. From `.github/workflows/test.yml` list
   every job and the exact commands it runs (lint, unit and contract with
   coverage, ratchet, integration, scanner tests and ratchet, the PWA,
   the config-tool, the scripts, ESP32, the four Tier L legs with their
   environment values). From `.github/workflows/rung1.yml` list the
   audit invocation. From `backend/package.json` list the npm scripts
   these map to.
10. Disk now: `du -sh` of `backend/logs`, `backend/data`,
    `backend/test-results`, `backend/playwright-report`,
    `/tmp/rung1/engine-logs`, so the brief can set a size tripwire.

## Completion criterion

All ten questions answered with file:line evidence; every count verified
by a raw grep you paste; every claim about the container backed by the
command output you paste. Kill nothing. Change nothing.

## Output

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/p2-factsheet.md`
with sections numbered 1 to 10 as above, then "Risks the orchestrator
should know", then "Commands run". Reply with at most five lines:
status, the path, and the three facts most likely to change the design.
