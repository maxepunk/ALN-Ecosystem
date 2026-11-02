# Brief — the harness minimum: the log guard and one data directory per test worker (implementer)

Read this first; it is your single source of requirements, with the
exact values to use verbatim. Vocabulary: `CONTEXT.md` §5 (environment
ladder, rung). Model: Opus. You dispatch no subagents; review arrives
from the orchestrator after your report. This brief supersedes the
harness parts of `2026-09-12-p2b-log-guard-timer-fixtures.md` and
`2026-09-12-p2a-isolation-teardown-merge-gate.md`; only pins P21 and
P22 build now (owner ruling 2026-09-12); P23–P27 wait.

## What this buys, and for whom
The engineering loop only. A test worker that dies leaves an
orchestrator writing about 40 megabytes per second into its own log
file through a closed console pipe (this container has 7.3 GB free),
and three parallel workers share one `backend/data/` directory, so one
worker's clean start deletes another worker's live session file (the
red leg on CI run 299). After this task, a dead pipe costs one log
line, and a worker cannot touch another worker's files.

## Where you work
`/home/user/ALN-Ecosystem/` on the task branch the dispatch names, cut
from the designated branch `claude/nice-curie-hescfv`. Backend only.
Never touch `ALNScanner/`, `ALN-TokenData/`, or `.worktrees/`. Push
nothing. Commit per pin. Check `df -h /` before and after any run that
spawns an orchestrator; every reproduction is bounded as the pin says.
The rig's daemons under `/tmp/rung1` are not yours to stop.

## The facts you build on
Fact sheet `.superpowers/sdd/2026-09-12-block2-hardening-plan/p2-factsheet.md`
§1 (the test server), §2 (`DATA_DIR`/`LOGS_DIR` seams), §3 (the logger),
and the plan review `p2-plan-brief-review.md` findings 1–4 and 11–13,
which corrected the mechanism: `src/utils/logger.js:96-101` configures
`exceptionHandlers`, so winston registers its own `uncaughtException`
handler unconditionally (`node_modules/winston/lib/winston/exception-handler.js:51`,
fan-out at `:220` through every transport, `doExit` false because
`exitOnError: false` at `logger.js:74`); the app's handler at
`logger.js:161-168` is inside `if (process.env.NODE_ENV !== 'test')`,
and every harness orchestrator runs with `NODE_ENV: 'test'`
(`tests/e2e/setup/test-server.js:78`). No transport or stream has an
`error` listener (`grep -n "on('error'" src/utils/logger.js` → none).
`test-server.js`: `TEST_ENV` 77–102 (`LOG_LEVEL: 'warn'` at 88), the
child env 212–233, the spawn 259–263 (`cwd: backend/`, not detached),
`clearSessionData` 458–506 (a `memory` branch that clears a singleton in
the calling process — dead — and a file branch that unlinks every file
in `backend/data/`). `config/index.js:52–53`: `DATA_DIR` and `LOGS_DIR`
default to `cwd/data` and `cwd/logs`. `session-env.js:58`: `WORKER_SLOT
= TEST_PARALLEL_INDEX || '0'`. MPD defaults to the machine-wide
`/tmp/aln-mpd.sock` (`src/services/musicService.js:47-48`, pid file
`/tmp/aln-pm-mpd.pid`), so a reproduction must not start music.

## Requirements (pins P21 and P22, verbatim from the plan)
Copy of the plan's pins follows; the plan is the source if they ever differ.

- **P21. One data directory and one log directory per worker.**
  `startOrchestrator` passes `DATA_DIR` and `LOGS_DIR` to the child:
  `/tmp/aln-e2e-env/w<slot>/data` and `/tmp/aln-e2e-env/w<slot>/logs`,
  `slot = TEST_PARALLEL_INDEX || '0'` (the bus's own key). A restart in
  the same worker keeps the same directories. `clearSessionData()`
  clears only that worker's data directory; its `memory` branch, which
  clears a singleton in the calling process, is deleted and the comment
  says the respawn is the isolation. The child's `cwd` stays `backend/`.
- **P22. A closed output pipe never fills the disk (revised 2026-09-12
  after the harness plan review: the loop's engine is winston's OWN
  exception handler, registered unconditionally through
  `exceptionHandlers`, fanning every exception through the closed
  Console transport; the app's `NODE_ENV`-gated handler is absent in
  every harness orchestrator).** The guard sits at the stream: in
  `src/utils/logger.js`, one `error` listener each on `process.stdout`
  and `process.stderr`, attached unconditionally at module load,
  OUTSIDE the `NODE_ENV` guard, that on `EPIPE` or `ERR_STREAM_DESTROYED`
  sets the Console transport `silent = true` and writes ONE guard line
  through the file transports only: `console output closed (<code>);
  console transport silenced`. A synchronous write to a destroyed stream
  throws instead of emitting, so the app's `uncaughtException` handler
  (inside the guard) takes the same two codes and does the same; once
  the console is silent, winston's own exception handler can fan out
  safely because nothing writes to the pipe any more. The orphaned
  orchestrator SURVIVES with a silenced console; it does not exit
  (ruling: under PM2 a daemon death must never kill a running show).
  Under PM2 the guard changes nothing while the daemon lives; if the
  daemon dies, the guard silences the console instead of filling the
  disk, which is the wanted production behavior too. The unit test
  (`tests/unit/utils/logger.test.js`) emits a synthetic `error` with each
  code on `process.stdout` and restores `silent = false` afterwards.
  The reproduction (`tests/integration/logger-epipe-guard.test.js`,
  Jest timeout 40 s): spawn `node src/server.js` `detached: true` with
  `stdio: ['ignore', 'pipe', 'pipe']`, the harness's `TEST_ENV` plus
  `LOG_LEVEL=info`, `ENABLE_VIDEO_PLAYBACK=false`,
  `ENABLE_MUSIC_PLAYBACK=false`, `LIGHTING_ENABLED=false`, a random
  `PORT`, and `DATA_DIR`/`LOGS_DIR` under a fresh temp directory; wait
  for `/health`; destroy the stdout and stderr read streams; then for 10
  seconds poll `/health` every 250 ms (the write trigger: request
  logging at level info) while polling the temp `combined.log` size
  every 250 ms, breaking and killing the process GROUP the moment the
  file exceeds 200 MB. RED (before the fix): the cap trips; the size at
  the break is the evidence. GREEN: the file stays under 1 MB for the
  full window with at most one guard line, and the child is still alive
  (`kill -0`) with the console silenced. Afterwards the group is killed
  and residue is asserted absent: no new `node src/server.js`, and
  `/tmp/aln-pm-mpd.pid` unchanged. The temp directory is deleted.

## Deliverables (tests first: red, then green)
1. P22: the unit test RED (no listener, `silent` stays false), the
   stream listeners and the handler branch, the unit test GREEN. Then
   the reproduction RED against the guard disabled (paste the size at
   the 200 MB break and the time it took), and GREEN with the guard
   (paste the final size and the guard line). The reproduction is a
   Jest integration test with a 40 s timeout, spawned `detached: true`
   and stopped by process group; assert no residue afterwards as the pin
   says. Say in the report whether it belongs in `tests/integration/`
   (the only server-booting file there) or should move.
2. P21: a unit test for `clearSessionData` over two worker directories
   (the other untouched) and an assertion that the child env carries
   both directories under the slot; the `memory` branch removed with the
   comment rewritten.

## Proof runs (paste each command and its summary line)
From `backend/`: `df -h /` before; the RED and GREEN runs above;
`npm test`; `npm run coverage:check`; `npm run lint`;
`npm run test:integration`; one local Tier L leg with three workers
(`E2E_PACK_PATH=tests/e2e/fixtures/packs/toy-heist npm run test:e2e:tier-l`)
with zero failures, and `ls /tmp/aln-e2e-env/` afterwards showing the
per-worker directories; `df -h /` after; then
`ps -eo pid,args | grep -E 'src/server.js|cvlc' | grep -v grep` (paste it;
the leg's own VLCs are expected residue today and are not yours to fix).

## Guardrails
Edit only `src/utils/logger.js`, `tests/e2e/setup/test-server.js`, and
the tests named. No change to the Jest configs, `session-env.js`,
`provision.js`, `down.sh`, or any engine service. Kill only processes
you started, by process group. Winston logger. The ratchet never
lowers. Push nothing.

## Report
Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/harness-minimum-report.md`:
Status; Commits; TDD evidence per pin (RED and GREEN with the numbers);
Proof runs; Files changed; Deviations; Concerns. Reply with at most 10
lines: status, commits, one-line test summary, report path.
