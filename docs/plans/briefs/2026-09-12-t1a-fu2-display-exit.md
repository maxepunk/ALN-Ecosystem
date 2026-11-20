# T1a follow-up 2 brief — a crashed kiosk is DOWN, not "closed while hidden"

Read this first; it is your single source of requirements. Vocabulary:
`CONTEXT.md` §4 (dormant vs fault, alarm integrity). Model: Sonnet. You
dispatch no subagents.

## Where you work

`/home/user/ALN-Ecosystem/` on branch `claude/nice-curie-hescfv-t1a-fu2`
(checked out, cut from the designated branch at `6b223d0`). Backend only
(`backend/`). Dependencies installed. Never touch `ALNScanner/`,
`ALN-TokenData/`, or `.worktrees/`. Push nothing.

## The defect (from CI Test run 297, job "Backend Integration Tests")

`tests/integration/service-state-push.test.js` › "should coalesce rapid
changes into one push per domain (50ms debounce)" saw 2 health pushes
instead of 1. The extra push came from this engine log line, 20 ms
before the assertion:

```
[DisplayDriver] Browser process exited {"code":null,"signal":"SIGABRT"}
Service health changed: display down → healthy kiosk closed while hidden; relaunches on show
```

T1a's exit handler in `backend/src/utils/displayDriver.js` reports
`healthy` ("kiosk closed while hidden; relaunches on show") on ANY exit
while the kiosk is hidden. On the hosted runner the `chromium-browser`
stub aborts a second after launch, while hidden, so a crash was reported
as healthy and the `down → healthy` transition emitted `health:changed`
into another test's debounce window. Two errors: (1) a crash is a fault
(alarm integrity: a kiosk that died of SIGABRT must show `down`, not
healthy); (2) a launch that never succeeded must not be turned healthy
by its own exit.

## Ruling 27 (the requirement; refines ruling 13)

The exit handler decides by HOW the kiosk exited and WHETHER it had
launched successfully:
- exit while hidden, after a successful launch, with exit code 0 or the
  signal the driver itself sends on hide/cleanup (`SIGTERM`) → `healthy`,
  message `kiosk closed while hidden; relaunches on show` (as today);
- any other exit while hidden — non-zero code, or a signal other than the
  driver's own (`SIGABRT`, `SIGSEGV`, `SIGKILL`, …), or an exit before the
  launch's alive-check passed → `down`, message
  `kiosk crashed while hidden (code <code>, signal <signal>)`;
- exit while visible → `down` (as today), message carrying code/signal.
The driver tracks `launched` (alive-check passed) and whether the driver
itself is terminating the process (`terminating` flag set before its own
kill) so the handler can tell a deliberate stop from a crash. `probe()`
keeps its semantics; "closed while hidden" remains a healthy answer only
when the close was clean.

## Deliverables (tests first: red, then green)

1. `backend/src/utils/displayDriver.js`: the exit-handler rule above;
   the `launched`/`terminating` bookkeeping; `cleanup()` and `hideScoreboard()`
   set `terminating` before killing (if they kill) and clear it after.
2. `backend/tests/unit/utils/displayDriver.test.js` (extend): exit while
   hidden with SIGABRT after a successful launch → `down` with the crash
   message; exit while hidden with code 1 → `down`; exit while hidden with
   code 0 after a successful launch → `healthy` closed-while-hidden; exit
   while hidden via the driver's own SIGTERM → `healthy` closed-while-hidden;
   exit while hidden BEFORE the alive-check passed (launch failed) →
   `down`, and the previously-reported `down` (launch failed) does not flip;
   exit while visible → `down` with code/signal in the message.
3. Prove the integration symptom is gone: from `backend/`,
   `npx jest --config jest.integration.config.js tests/integration/service-state-push.test.js --runInBand`
   three times in a row, all green (paste the three summary lines), then
   the full `npm run test:integration` once (expect 348/348), `npm test`
   once (0 failed), `npm run coverage:check`, `npm run lint`.

Also record (no code): the same CI log shows
`ReferenceError: You are trying to import a file after the Jest
environment has been torn down` from `serviceHealthRegistry.js:248`
(the revalidation timer calling `musicService.checkConnection` after a
test file ended). Check whether the integration test server starts
revalidation and never stops it (grep `startRevalidation` under
`backend/tests`); report what you find under Concerns, do not fix it
unless it is a one-line `stopRevalidation()` in an existing teardown
that the file already has — say which.

## Guardrails

Edit only `displayDriver.js`, its unit test, and (only per the note
above) one existing test teardown. Winston logger. No changes to the
health registry, the executor, or the contracts. Push nothing.

## Report

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/t1a-fu2-report.md`:
Status; Commits; TDD evidence (RED/GREEN per case); Proof runs (the
commands with summary lines, incl. the three integration runs); Files
changed; Deviations; Concerns (incl. the revalidation finding). Reply
with at most 10 lines: status, commits, one-line test summary, report path.
