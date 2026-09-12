# P2b brief — the log guard, the health timer, deterministic fixtures (implementer)

Read this first; it is your single source of requirements, with the
exact values to use verbatim. Vocabulary: `CONTEXT.md` §2 (benign
emptiness), §5 (environment ladder, rung, witness lights, simulation).
Model: Opus. You dispatch no subagents; review arrives from the
orchestrator after your report.

## What this buys, and for whom

The engineering loop only. Three harness faults make every local and CI
verdict less trustworthy: a test worker that dies leaves an orchestrator
writing a failed console write into its own log file at about 40
megabytes per second (this container has 7.3 GB free); the health check
timer keeps ticking after a test file ends and imports modules into a
torn-down environment; and fixture generation writes different content
from different workers and fails outright for a fixture pack with no
`cues.json`. Fix these three and a red leg means a real defect again.

## Where you work

`/home/user/ALN-Ecosystem/` on the task branch the dispatch names, cut
from the designated branch `claude/nice-curie-hescfv`. Backend only.
Never touch `ALNScanner/`, `ALN-TokenData/`, or `.worktrees/`. Push
nothing. Commit per pin with a message naming it. The disk is thin:
every reproduction you run is bounded as the pins say, and you check
`df -h /` before and after any run that spawns an orchestrator.

## The facts you build on (fact sheet: `.superpowers/sdd/2026-09-12-block2-hardening-plan/p2-factsheet.md` §3, §4, §5)

- `backend/src/utils/logger.js`: transports at 75–107 (Console 77–79;
  File `combined.log` 81–86; File `error.log` 88–94; exception and
  rejection handlers 96–107); `exitOnError: false` at 74; no `error`
  listener anywhere in the file; the `uncaughtException` handler at
  161–168 (guarded by `NODE_ENV !== 'test'`) logs the error through
  every transport, then `setTimeout(() => process.exit(1), 1000)`. The
  loop: the Console transport writes to a closed `process.stdout`, the
  stream's `error` is unhandled and surfaces as another uncaught
  exception, whose handler writes through the same transport again
  while the File transport lands a JSON blob on disk each turn.
  winston `^3.11.0` (`package.json:104`).
- `backend/tests/helpers/service-reset.js`: `resetAllServicesForTesting`
  (241–323) calls `performSystemReset` at 282, then forces eight services
  healthy (290–292); it never calls `stopRevalidation()`; the sibling
  `resetAllServices` does (183). `systemReset.js:291` and `app.js:333`
  restart the 15-second timer. Twenty integration files call the helper;
  one (`service-state-push.test.js`) stops the timer itself. `forceExit:
  true` (`jest.config.base.js:60`) masks the leaked interval.
- `backend/tests/rung1/generate-fixtures.js`: `loadPack()` (61–69) reads
  `cues.json` unconditionally; writes `ha-config/configuration.yaml`
  (76–79) and `simulation-profile-<packId>.json` (84–87) unconditionally
  with `fs.writeFileSync`; media copies are guarded (100, 130, 155).
  `provision.generateFixtures()` (`provision.js:717–736`) spawns it
  synchronously and reports `haConfigChanged` by hashing the register.
  `session-env.js:54–57` `KNOWN_PACK_DIRS` = ALN-TokenData + toy-heist;
  `session-env.js:165–166` unions the requesting run's pack in.
  `tests/e2e/fixtures/packs/parity-pack/` has no `cues.json`, so any run
  pinning it fails generation and falls back silently (`session-env.js:173–178`).

## Requirements (the plan's pins, verbatim)

- **P22. A closed output pipe never fills the disk.** In
  `src/utils/logger.js`: one `error` listener each on `process.stdout`
  and `process.stderr`, attached once, that on `EPIPE` or
  `ERR_STREAM_DESTROYED` silences the Console transport (`silent =
  true`) and writes one line to the file transports; the
  `uncaughtException` handler, on an error whose `code` is `EPIPE`,
  silences the console the same way instead of logging through it, then
  exits after the existing one-second delay. Under PM2 on the Pi the
  pipe never closes, so the guard is inert in production. Proof RED
  first: spawn the orchestrator with a piped stdout, close the read end,
  and watch its log directory for 10 seconds under a 200 MB cap and a
  hard kill; before the fix the file grows without bound, after it the
  file gains one line and the process exits.
- **P23. The health timer stops when a test file ends.**
  `resetAllServicesForTesting` calls
  `serviceHealthRegistry.stopRevalidation()` right after
  `performSystemReset`, covering all twenty files; `forceExit` and the
  global teardown stay as they are.
- **P24. Fixture generation is deterministic and atomic.** The witness
  register and the simulation profiles are generated from ONE fixed pack
  set on every pass — `ALN-TokenData`, `toy-heist`, `toy-heist-require`,
  `parity-pack` — never from the requesting run's pack alone, so every
  worker writes identical content and the witness Home Assistant never
  restarts mid-run. `loadPack()` treats a missing `cues.json` as benign
  emptiness (`cues: []`, CONTEXT.md §2). Every generated file is written
  to `<file>.tmp-<pid>` and renamed into place. No lock file.

Exact values: the fixed set is a named constant `FIXTURE_PACK_DIRS` in
`session-env.js` replacing `KNOWN_PACK_DIRS`, holding the four absolute
directories in that order; `provisionForRun` passes exactly that set
(the requesting run's pack is still activated by `PACK_PATH`, only the
generation input is fixed). The one guard line written to the file
transports reads `console output closed (<code>); console transport
silenced`. The reproduction lives in
`backend/tests/integration/logger-epipe-guard.test.js`: it spawns
`node src/server.js` with `stdio: ['ignore', 'pipe', 'pipe']`, the env
`test-server.js` uses (`TEST_ENV`, lines 77–102, with a random `PORT`,
`LOGS_DIR` and `DATA_DIR` under a fresh temp directory), waits for
`/health`, then destroys the stdout and stderr read streams, polls the
temp `combined.log` size every 500 ms for at most 10 seconds, kills the
child with `SIGKILL` at the end whatever happened, deletes the temp
directory, and asserts the final size is under 1 MB and the child exited
on its own within the window.

## Deliverables (tests first: red, then green)

1. P22: the reproduction test RED against the current logger (paste the
   size it reached inside the cap), the guard, the test GREEN, plus a
   unit test in `tests/unit/utils/logger.test.js` (create it if absent)
   that emits a synthetic `error` with `code: 'EPIPE'` on
   `process.stdout` and asserts the Console transport is `silent` and
   exactly one guard line reached the file transport.
2. P23: the one call in the helper; proof that
   `npm run test:integration` output contains no line matching
   `import a file after the Jest environment has been torn down` (grep
   the saved output and paste the count: 0).
3. P24: the constant, the tolerant `loadPack()`, atomic writes; a unit
   test `tests/unit/rung1/generate-fixtures.test.js` that runs the
   generator twice into a temp directory over the fixed set and asserts
   byte-identical outputs, and once over a pack directory without
   `cues.json` and asserts success with an empty cue list; then one
   local Tier L leg (`E2E_PACK_PATH=tests/e2e/fixtures/packs/toy-heist
   npm run test:e2e:tier-l`) with zero failures and zero retries, and
   the register's hash unchanged across the run (hash it before and
   after).

## Proof runs (paste each command and its summary line)

From `backend/`: `df -h /` before; the RED and GREEN runs above;
`npm test`; `npm run coverage:check`; `npm run lint`;
`npm run test:integration` (with the grep count); the toy-heist leg;
`df -h /` after; `ps -eo pid,args | grep -E 'src/server.js|vlc -I' | grep -v grep`
after the leg (paste it; the expected residue today is the leg's own
VLCs, which P2a removes — say what you saw).

## Guardrails

Edit only `src/utils/logger.js`, `tests/helpers/service-reset.js`,
`tests/rung1/generate-fixtures.js`, `tests/e2e/setup/session-env.js`,
`tests/rung1/provision.js` (only if the wrapper must pass the fixed
set), and the tests named. No change to the Jest configs, `test-server.js`,
`down.sh`, or any engine service. Kill only processes you started.
Winston logger. The ratchet never lowers. Push nothing.

## Report

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/p2b-report.md`:
Status; Commits; TDD evidence per pin (RED and GREEN commands with
their lines, including the size the loop reached under the cap); Proof
runs; Files changed; Deviations; Concerns. Reply with at most 10 lines:
status, commits, one-line test summary, report path.
