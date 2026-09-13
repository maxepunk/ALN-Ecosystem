# Dormancy-core survivors brief — the standing findings of the adversarial pass (implementer)

Read this first; it is your single source of requirements. The FACTS
(mechanics, reproductions, evidence) live in the adversarial report
`/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/dormancy-core-adversarial.md`,
section "Standing findings", numbered 1–12; read the numbered entries
this brief names before touching their code. Vocabulary: `CONTEXT.md`
§4 (dormant vs fault, alarm integrity, status with verbs), §5
(endpoints vs stack, paper vs live). Model: Opus. You dispatch no
subagents; review arrives from the orchestrator after your report.

## What this buys, and for whom

The dormancy core landed this week: grey means "not installed tonight",
red means "act now". The adversarial pass found seven places where that
promise breaks on show night: a pack naming an equipment family the
code does not know makes "Create Session" fail an hour after boot hid
the cause; the display's own Check Now button turns a real red green;
a display that went down never comes back on its own and stays red
after a system reset; a queue stalls behind a dormant TV; a deliberate
shutdown is logged as a crash; a half-silenced standing cue looks fully
live on the panel; and a mistyped service name answers "healthy". This
task closes all seven before any lane merges (ruling R26 point 1).

## Where you work

`/home/user/ALN-Ecosystem/.worktrees/dormancy-fix/` on branch
`claude/nice-curie-hescfv-dormancy-fix` (parent) and the same branch
name inside its `ALNScanner/` submodule; confirm both with
`git branch --show-current` before the first edit. Commit scanner
changes in the submodule first, then the pin in the parent. Other
worktrees under `.worktrees/` are other lanes: never read or write
them; the top-level `/home/user/ALNScanner` and `/home/user/ALN-TokenData`
are stale clones. Push nothing. The rig's daemons under `/tmp/rung1`
are shared and not yours to stop; take `flock /tmp/rung1/e2e.lock`
around any Playwright or Tier L run.

## Out of scope (ruled; do not touch)

- Standing finding 1 (a null profile latches the whole kit dormant):
  the ruled profile check (plan §4 "The two pieces that run first",
  P17–P20) builds it in a separate task. No change to
  `dormancyService.compute()`'s null-profile outcome; its pinned tests
  stand.
- Standing finding 10 (`ORCHESTRATOR_KINDS` covers the whole
  `endpoint` kind): the arms lane rewrites that resolution code; a
  ledger row carries it. `gameRules/resolution.js` is untouched here.
- The display's Restart verb and automatic relaunch: the supervisor
  lane (R20). The `display:scoreboard` health gate stays as pinned
  (P16).
- No contract change; no new WebSocket event; `MESSAGE_TYPES` untouched.

## Deliverables (each red first at its seam, then green; one commit per deliverable naming the finding)

1. **Unknown equipment family never throws (findings 2 and 11).**
   `gameRules/endpointServices.js`: `dormantServicesFor()` skips a
   family outside `ENDPOINT_FAMILIES` instead of throwing; a new pure
   export `unknownFamilies(manifest) → string[]` lists them (sorted).
   `services/dormancyService.js` `compute()` returns `unknownFamilies`
   beside its existing result and `apply()`/`recompute()` log ONE
   `logger.warn` per unknown family per recompute:
   `unknown equipment family '<name>' in the pack manifest: no service maps to it; check the pack`.
   The doc comment's "the schema also refuses this" sentence goes (the
   manifest schema is open; the report's finding 2 evidence). Tests:
   the two unit tests that pinned the throw
   (`tests/unit/gameRules/endpointServices.test.js:151-153` and the
   `dormancyService` equivalent) are re-pinned to the skip + list; a
   new test that `session:create` succeeds with a manifest declaring
   `display.remote` (the report's reproduction, driven through
   `sessionService.createSession` with the feed wired as the existing
   dormancy tests do); the boot run point no longer needs its
   try/catch for this case (leave the guard; it now catches nothing
   from this path).
2. **The display probe remembers how the kiosk last ended (findings 3
   and 4).** `utils/displayDriver.js` keeps one retained verdict
   `{status, message}` written by `_doLaunch` on failure, by the exit
   handler on every exit (the ruling-27 classification), and by the
   `error` handler. `probe()`: process alive → `healthy 'kiosk running'`;
   no process → the retained verdict re-reported verbatim when one
   exists; no process and no verdict ever (no launch attempted) →
   `down 'kiosk never launched'`. "Closed while hidden" is therefore
   healthy only when the last exit was clean, exactly as the exit
   handler already decides. Tests: the report's two reproductions as
   unit tests beside `tests/unit/utils/displayDriver.test.js:1073`
   (failed launch then probe → down; clean hidden close then probe →
   healthy; a hidden crash then probe → down with the crash message);
   the existing "no kiosk while hidden stays healthy" case is re-pinned
   to the never-launched → down truth and says why.
3. **The display returns on its own (findings 5 and 8).**
   `serviceHealthRegistry.startRevalidation` gains
   `display: () => services.display?.probe()` (the caller in `app.js`
   passes `displayDriver` as `services.display`; find every
   `startRevalidation(` call site and pass it there too);
   `systemReset.js` step 6 re-probes `display` explicitly beside the
   other re-reports. Tests: with fake timers, a `display` entry knocked
   down by `reset()` returns to healthy on the next tick when the
   process is alive (the report's reproduction for finding 8); the
   revalidation test that pinned "display is never probed" is
   re-pinned.
4. **The dormant-VLC branch drains the queue (finding 7).**
   `services/videoQueueService.js:107-116`: after failing the item the
   branch re-drives with `setImmediate(() => this.processQueue())` and
   emits `video:idle` when nothing is pending, exactly as the throw
   path at `:129-142` does (extract the shared tail into one helper if
   the two paths then read as duplicates). Test: the report's
   reproduction (vlc dormant, two items → both fail, `video:idle`
   emitted once).
5. **A deliberate stop is a clean close (finding 9).** The exit
   handler checks `terminating` before `visible`: a SIGTERM the driver
   sent itself (including the SIGKILL escalation) is `healthy 'kiosk
   stopped'` whatever the visibility; the log line says "stopped on
   purpose". Test: the report's reproduction (scoreboard shown,
   `cleanup()` with the exit landing inside its wait → healthy). The
   false sentence in the ruling-27 test block
   (`displayDriver.test.js:1337-1345`, "cleanup() clears visible
   synchronously…") is corrected to what the code does.
6. **A half-silenced standing cue says so (finding 6; scanner).**
   `ALNScanner/src/ui/renderers/CueRenderer.js` `_buildStandingCues`:
   a standing row whose `dormantCommands` is non-empty and which is
   not wholly dormant carries the same badge the quick-fire tile
   carries (count of silenced commands and the first silenced
   command's service and door, from the existing helper), and its
   change-detection signature includes it (the existing
   `disabledBy` + first dormant command rule from PR #17's fixes).
   Test: the report's reproduction in
   `ALNScanner/tests/unit/ui/renderers/CueRenderer.test.js`; the
   invariant at `:529-533` updated. `npm run build` in `ALNScanner`
   afterwards (`backend/public/gm-scanner` serves `dist/`).
7. **`service:check` refuses names it does not own (finding 12).**
   `commandExecutor.js:916`: `Object.hasOwn(HEALTH_CHECKS, serviceId)`
   before the lookup; unknown → the existing "Unknown service" error.
   Test: `serviceId: 'constructor'` → `success: false`.

Exact values: warn text as quoted in deliverable 1; probe messages
`kiosk running`, `kiosk never launched`, the retained verdict verbatim;
clean-stop message `kiosk stopped`; no new health words (still
`healthy | down | dormant`); every health `message` under 300 code
points.

## Proof runs (paste each command and its summary line)

From `backend/`: the RED run per deliverable before its fix and the
GREEN run after; `npm test`; `npm run coverage:check`; `npm run lint`;
`npm run test:integration`. From `ALNScanner/`: `npm test`;
`npm run coverage:check`; `npm run lint`; `npm run build`. Then the
Tier L toy leg once, under the lock:
`flock /tmp/rung1/e2e.lock env E2E_PACK_PATH=tests/e2e/fixtures/packs/toy-heist npx playwright test --workers=1`
from `backend/` (the dormancy flows `30-*` and `31-*` must stay green);
`df -h /` before and after.

## Guardrails

Contract-first does not apply (no wire change; if you find one is
needed, stop and say so in the report as BLOCKED). `gameRules/` stays
pure. Winston logger. The ratchet never lowers. Never amend or rewrite
a commit. Push nothing.

## Report

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/dormancy-survivors-report.md`:
Status; Commits (parent and scanner); per deliverable the RED and
GREEN commands with their lines; Proof runs; Files changed; Deviations
(anything done differently from a deliverable, and why); Concerns.
Reply with at most 10 lines: status, commits, one-line test summary,
report path.
