# P2a brief — worker isolation, run teardown, the merge gate, two small fixes (implementer)

Read this first; it is your single source of requirements, with the
exact values to use verbatim. Vocabulary: `CONTEXT.md` §5 (environment
ladder, rung, simulation). Model: Opus. You dispatch no subagents;
review arrives from the orchestrator after your report.

## What this buys, and for whom

The engineering loop only. Today three parallel test workers share one
`backend/data/` directory, so one worker's clean start deletes another
worker's live session file (the red leg on CI run 299); daemons the
suite starts are invisible to the rig's teardown script; an orphaned
orchestrator outlives its worker; and no single command runs what CI
runs. After this task a worker cannot touch another worker's files, a
run can be torn down, and one command gives the orchestrator the same
verdict CI would, before a merge.

## Where you work

`/home/user/ALN-Ecosystem/` on the task branch the dispatch names, cut
from the designated branch `claude/nice-curie-hescfv` after P2b merged.
Backend tests and scripts only. Never touch `ALNScanner/`,
`ALN-TokenData/`, or `.worktrees/`. Push nothing. Commit per pin. The
rig's own daemons under `/tmp/rung1` (session bus, system bus, PipeWire
family, Docker with the witness Home Assistant, the Bluetooth mock, the
display `:99`) are NOT yours to stop; the pins say exactly what a
teardown may reap.

## The facts you build on (fact sheet: `.superpowers/sdd/2026-09-12-block2-hardening-plan/p2-factsheet.md` §1, §2, §6, §7, §8, §9)

- `backend/tests/e2e/setup/test-server.js`: `TEST_ENV` 77–102; the
  child env 212–233 (starts from `process.env`); `spawn('node',
  [serverPath], {env, cwd: backend/, stdio: ['ignore','pipe','pipe']})`
  259–263, not detached; `stopOrchestrator` 353–380 (SIGTERM, then
  SIGKILL after `timeout`); `restartOrchestrator` 397–427 (carries
  `serverPackPath`/`serverProfilePath`); `clearSessionData` 458–506 (a
  `memory` branch that clears a singleton in the calling process — dead
  — and a file branch that unlinks every file in `backend/data/`);
  `registerCleanupHandler` 569–585 guards only the calling process.
  `config/index.js:52–53`: `DATA_DIR` and `LOGS_DIR` default to
  `cwd/data` and `cwd/logs`. `tests/rung1/up.sh:113–114` sets both for
  the rig's engine.
- `backend/tests/e2e/setup/session-env.js`: `WORKER_SLOT =
  TEST_PARALLEL_INDEX || '0'` (58); the bus socket
  `/tmp/aln-e2e-env/dbus-w<slot>.sock` (59); `ensureBus` (84),
  `ensureXvfb` (103), `ensurePipewire` (202–205) called WITHOUT
  `pidFile`/`pidDir`; `ensureBluetoothMock` (211) and `ensureHA`
  (215–217) record their own. `provision.js` spawns those daemons
  `detached` and `unref`'d (294, 321, 365); only the CLI entry
  (765–830, used by `up.sh`) passes PID files (800–807).
- `backend/tests/rung1/down.sh` (30 lines) kills by `$RUNG1/<name>.pid`
  for seven names plus `/tmp/aln-pm-*.pid`, removes the `rung1-ha`
  container, leaves `dockerd`.
- `backend/playwright.config.js:30–31`: `globalSetup` and
  `globalTeardown` are commented out. `tests/e2e/setup/vlc-service.js`
  spawns VLC (95, 101) and kills its process group (151) from flow hooks.
- `backend/tests/rung1/probe.sh:18–20` runs `pactl info` as the invoking
  user; the rig's PipeWire runs as `$RUNG1_USER` (default `rung1vlc`,
  `provision.js:31`; CI overrides `runner`) through `runuser`
  (`up.sh:35` `as_user()`).
- `backend/tests/unit/services/bluetoothService.test.js`: `createMockSpawnProc()`
  (1263–1269) gives the mocked child `pid = 99999`; `fs` is not mocked,
  so `ProcessMonitor.start()` writes `/tmp/aln-pm-bluez-dbus-monitor.pid`;
  `beforeEach` resets, no `afterAll`, so the last test leaves the file.
- CI (`.github/workflows/test.yml`, fact sheet §9): backend `npm run
  lint`, `npm test -- --coverage --maxWorkers=2`, `npm run
  coverage:check`; `npm run test:integration`; ALNScanner `npm test --
  --coverage`, `npm run coverage:check`; PWA `npm test`; config-tool
  `npm test`, `npm run lint`; scripts `python3 -m pytest tests/ -v`;
  ESP32 `pio test -e native`; four Tier L legs (`test.yml:236–249`) with
  `E2E_PACK_PATH`/`E2E_PROFILE_PATH`: production (`''`, `''`); toy-heist
  (`tests/e2e/fixtures/packs/toy-heist`, `''`); toy-dormant-lighting
  (that pack, `tests/e2e/fixtures/profiles/toy-dormant-lighting.json`);
  toy-require-dormant (`tests/e2e/fixtures/packs/toy-heist-require`, the
  same profile); each `npm run test:e2e:tier-l`. `rung1.yml:97–106`:
  `up.sh`, `probe.sh`, `engine.sh start`, `node
  backend/tests/rung1/audit-flows.js` as root with `RUNG1_USER`, then
  `down.sh`. No merge-gate script exists.

## Requirements (the plan's pins, verbatim)

- **P21. One data directory and one log directory per worker.**
  `startOrchestrator` passes `DATA_DIR` and `LOGS_DIR` to the child:
  `/tmp/aln-e2e-env/w<slot>/data` and `/tmp/aln-e2e-env/w<slot>/logs`,
  `slot = TEST_PARALLEL_INDEX || '0'` (the bus's own key). A restart in
  the same worker keeps the same directories. `clearSessionData()`
  clears only that worker's data directory; its `memory` branch, which
  clears a singleton in the wrong process, is deleted and the comment
  says the respawn is the isolation. The child's `cwd` stays `backend/`.
- **P25. A run can be torn down.** `session-env.js` passes `pidFile`
  (bus: `/tmp/aln-e2e-env/dbus-w<slot>.pid`; display:
  `/tmp/aln-e2e-env/xvfb.pid`) and `pidDir` (`/tmp/aln-e2e-env`) for
  every daemon it starts; `down.sh` also reaps `/tmp/aln-e2e-env/*.pid`
  and removes that directory's sockets. The orchestrator child is
  spawned `detached: true` and stopped by process group, so its own
  children (kiosk, monitors) die with it; `startOrchestrator` appends the
  child's PID to `/tmp/aln-e2e-env/orchestrators.pids` and
  `stopOrchestrator` removes it; `vlc-service.js` does the same in
  `vlcs.pids`. Playwright's `globalTeardown` is re-enabled to reap those
  two files only (never the shared daemons, which the rig owns), and
  `startOrchestrator` sweeps stale entries first, killing a listed PID
  only when `/proc/<pid>/cmdline` names `src/server.js` or `vlc`.
- **P26. One command mirrors CI.** `backend/scripts/merge-gate.sh`
  (npm script `merge-gate`) runs, in order, with every exit code
  captured and `pipefail` on: a disk check (fail under 5 GB free); a
  residue check (fail and list orphan orchestrators, VLCs, worker buses);
  backend `lint`, `test -- --coverage`, `coverage:check`,
  `test:integration`; scanner `test -- --coverage`, `coverage:check`,
  `lint`, `build`; PWA `test`; config-tool `test` and `lint`; scripts
  `pytest` and ESP32 `pio test -e native` when their tools exist, else a
  LOUD skip line; the four Tier L legs with CI's exact env values,
  selectable by `--legs`; the rung-1 audit when `/tmp/rung1` is
  provisioned (`--no-audit` to skip); a residue check and a log-size
  check after. It prints one verdict table with each step's exit code
  and the log path, and exits non-zero on any failure or any residue.
- **P27. Small hygiene.** `probe.sh` runs `pactl info` as
  `$RUNG1_USER` through `runuser`, the way `up.sh` does;
  `bluetoothService.test.js` gains an `afterAll` that stops the monitor
  so `/tmp/aln-pm-bluez-dbus-monitor.pid` is not left behind.

Exact values: the pids files hold one PID per line; the residue check
names a process an orphan when its `/proc/<pid>/cmdline` contains
`src/server.js` or `vlc -I dummy` or `aln-e2e-env/dbus` and it is not
listed in a pids file of a run still in progress (the gate runs with no
run in progress, so any such process is residue); `--legs` takes a
comma-separated subset of `production,toy-heist,toy-dormant-lighting,toy-require-dormant`
or `none`; the log written by the gate is
`/tmp/aln-e2e-env/merge-gate-<UTC timestamp>.log`; the log-size check
fails when any file under `/tmp/aln-e2e-env/w*/logs` or `backend/logs`
exceeds 200 MB; the verdict table has one row per step: name, exit code,
seconds, the summary line captured (the Jest `Tests:` line, the
Playwright counts line, or the last line of output).

## Deliverables (tests first: red, then green)

1. P21 with a unit test for `clearSessionData` over two worker
   directories (the other untouched) and an assertion that the child env
   carries both directories under the slot; the dead `memory` branch
   removed.
2. P25 with unit tests for the pids-file helpers (append, remove, sweep
   with a fake `/proc` reader), `down.sh` extended, `globalTeardown`
   restored in `playwright.config.js` (create
   `tests/e2e/setup/global-teardown.js` if the file is absent), the
   detached spawn and group stop. Proof: start one orchestrator through
   `startOrchestrator` from a small Node script, kill that script with
   `SIGKILL`, run the teardown, and paste `ps` showing no `src/server.js`
   process left.
3. P26 the script and the npm script. Proof: `npm run merge-gate --
   --legs none` (everything but the legs) with the verdict table
   pasted; then a run with a temporary failing unit test file present
   showing exit 1 and the red row, the file deleted afterwards.
4. P27 the two fixes; proof: `bash tests/rung1/probe.sh` as root shows
   `pipewire` ok; `npx jest tests/unit/services/bluetoothService.test.js`
   leaves no `/tmp/aln-pm-bluez-dbus-monitor.pid`.
5. The bar: `npm run merge-gate` with all four legs, three times in a
   row, zero failures and zero retries, residue check empty after each.
   The legs may run in the background while you write the report; paste
   all three verdict tables.

## Proof runs

`df -h /` before and after; the RED and GREEN runs per pin; `npm test`;
`npm run coverage:check`; `npm run lint`; `npm run test:integration`;
the three full gate runs. Paste each command and its summary line.

## Guardrails

Edit only files under `backend/tests/`, `backend/scripts/`,
`backend/playwright.config.js`, `backend/package.json` (scripts block
only), and `tests/rung1/{down.sh,probe.sh,provision.js,session-env.js}`.
No engine code. Kill only what the pins list. Never stop the rig's own
daemons. Push nothing.

## Report

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/p2a-report.md`:
Status; Commits; TDD evidence per pin; Proof runs (all three verdict
tables); Files changed; Deviations; Concerns. Reply with at most 10
lines: status, commits, one-line test summary, report path.
