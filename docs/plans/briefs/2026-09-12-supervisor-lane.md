# The supervisor lane — the supervisor and the fault buttons (implementer brief)

Read this first; it is your single source of requirements, with the
exact values to use verbatim. Vocabulary: `CONTEXT.md` §2 (one truth,
three loops), §4 (dormant vs fault, alarm integrity, status with
verbs), §5 (paper vs live). Model: Opus. You dispatch no subagents;
review arrives from the orchestrator after your report.

## What this buys, and for whom

The GM's loop. Tonight a service that crashes five times stops being
restarted and nobody is told: `gave-up` has no listener, the health
card keeps its last word, and the only verb the GM has is "Check Now".
After this task a crashing service restarts inside a bounded window,
escalates to a red card that says "crashed N times in Ws — supervision
stopped; Restart to try again", and the GM can act from the card:
Restart, Run without it (the operator door), Put back in service. Holds
that a dead service blocks expire when the GM takes it out of service,
at session end, and at reset, instead of surviving as ghosts. The
venue's switch for all of this is one hand-edited JSON file on the show
machine (R13: the supervisor ships ENABLED; the file is the fallback).

## Where you work

The worktree `.worktrees/supervisor` on branch
`claude/nice-curie-hescfv-supervisor`, cut from the designated branch
after the harness minimum merged; its `ALNScanner/` submodule is checked
out on the ALNScanner branch of the same name. Backend + ALNScanner +
the contracts. Never touch `ALN-TokenData/` or another worktree. Push
nothing. Commit per pin, backend and scanner commits separate.

Shared-file rules (plan §1 R15; the credentials and self-heal lanes
build in parallel; the preflight arms come after you):
- `backend/contracts/asyncapi.yaml`: you append three `action` enum
  entries after `service:check` (line 1822 today) and add their payload
  schemas; `preflight:run` is NOT yours (the arms lane appends it after
  your merge). Do not touch the handshake prose near line 30.
- `backend/src/services/commandExecutor.js`: your three `service:*`
  cases and the `display:*` dependency rows only.
- `backend/src/websocket/gmAuth.js`: not yours. Add no room join; the
  `show-control` room belongs to the wiring step after the lanes merge.
- `ALNScanner/src/network/messageRouters.js`: not yours (the self-heal
  lane owns the `sync:full` case).

## The facts you build on

Fact sheet `.superpowers/sdd/2026-09-12-block2-hardening-plan/supervisor-factsheet.md`,
read §1–§10 in full before the first edit. The load-bearing facts:
- `utils/processMonitor.js` (220 lines): five consumers — VLC
  (`vlcMprisService.js:113`, fixed 3 s delay), MPD (`musicService.js:603`),
  and three observers (`audioRoutingService.js:789` pactl subscribe,
  `bluetoothService.js:497` BlueZ D-Bus monitor, `mprisPlayerBase.js:205`
  VLC's D-Bus monitor). One policy for all five. The failure counter
  resets on ANY stdout (`receivedData`, lines 136-138), not on exit code;
  the delay `restartDelay * backoffMultiplier ** failures` (149) has no
  cap and no non-finite guard; `'gave-up'` (143) has zero listeners.
- Chromium is NOT a ProcessMonitor consumer: `utils/displayDriver.js`
  spawns it itself (`_doLaunch` 122-250) with the two-stage orphan kill
  (123-159, the only orphan sweep) and ruling 27's exit classification
  (192-224; 58 tests, 130 s). `probe()` (359-379) launches nothing.
- VLC adopt mode (`VLC_SELF_SPAWN=false`, `vlcMprisService.js:142-158`)
  creates no monitor and never restarts. MPD's gate is
  `ENABLE_MUSIC_PLAYBACK` read in `app.js:226-236`, not in the service.
- Lighting: HA WebSocket reconnect is unbounded with a capped backoff
  (`lightingService.js:236-256`, `min(5000*attempts, 30000)`);
  `auth_invalid` (205-209) never reports to the registry.
- Holds: two independent implementations — `heldItemsStore.js` (the
  cue engine's, `cueEngineService.js:51`; per-item `discard`; 10 s
  auto-discard only for `video_busy` cue holds) and
  `videoQueueService.js`'s raw `_heldVideos` array (915-961; never
  auto-expires). `endSession()` (`sessionService.js:503-556`) expires
  nothing; `systemReset.js` clears both silently (lines 87, 110).
- Contracts: the `action` enum ends at `service:check` (1822); the ack
  requires `[action, success, message]` only; `DomainStateHealth` (2688)
  pins `message maxLength: 300`, enforced nowhere.
- `REQUIRED_PAYLOAD_FIELDS` already lists the four new actions
  (`commandExecutor.js:94-97`) and `grants.js` (78, 84) already maps
  `service:` / `preflight:` → `show-control`.
- Host config: nothing exists (`config/host*.json`, `HOST_CONFIG_PATH`,
  `.gitignore` entry). Copy `profileService.js:31-59`'s seam pattern.
- Scanner: `HealthRenderer.js` has one verb, "Check Now", shown only
  when down (lines 141-148, 194-215); `AdminOperations.checkService()`
  (58-60) and `domEventBindings.js` `case 'serviceCheck'` (137-140) are
  the shapes to copy; `CueRenderer.js`'s dormant badge (121-136) is an
  existing consumer to re-test, not to change.

## The pins (plan §3 P10–P13, verbatim scope; rulings below settle what they leave open)

P10 Supervision; P11 Host config is the single source; P12 Verbs are
commands; P13 Hold policy. Read them in the plan before the first edit
(search `P10.`). Every number and message in them is binding.

## Orchestrator rulings on what the pins leave open (each recorded in the plan's record; cost if wrong stated there)

- **R-S1 Chromium.** Extract the restart POLICY from `ProcessMonitor`
  into a pure module `utils/restartPolicy.js` (sliding flap window over
  exit timestamps, `maxFailures` inside `flapWindowMs`, delay =
  `restartDelayMs * backoffMultiplier ** failuresInWindow` capped at
  `backoffCapMs` for observers and at `flapWindowMs` for services, a
  non-finite result falls back to `restartDelayMs`; `kind: 'service' |
  'observer'`; observers never give up). `ProcessMonitor` uses it;
  `displayDriver.js` keeps its own spawn and ruling 27's exit
  classification and asks the SAME policy whether and when to relaunch,
  with the existing two-stage orphan kill as the pre-start hook.
  Chromium relaunches only while the scoreboard is the intended visible
  mode; dead-while-hidden relaunches on show, as today.
- **R-S2 What counts as a failure.** An exit not initiated by `stop()`
  or `restart()`, whatever the exit code and whether or not the child
  ever wrote to stdout. The `receivedData` reset rule goes.
- **R-S3 Host-config modes.** `self`: spawn at boot and supervise.
  `adopt`: never spawn; attach to the external process; on its exit
  re-resolve (VLC: the bus-name owner) and never restart. `off`: spawn
  once at boot, never restart automatically; the GM's Restart verb still
  works. `off` is R13's fallback: it removes every automatic kill and
  restart and keeps the venue booting as today. (Owner to confirm; the
  brief ships with this meaning.)
- **R-S4 One expiry method.** `services/holdExpiry.js` exports
  `expireHolds({reason, blockedBy})`: iterates the cue engine's store and
  the video queue's list, calls each item's owning-service discard, and
  emits nothing itself. Called with no filter by `endSession` and by
  system reset; called with `blockedBy: serviceId` by
  `service:out-of-service`. The two stores stay separate.
- **R-S5 Messages.** `serviceHealthRegistry.report()` and `markDormant()`
  truncate `message` to 300 code points, warning once per service.
  `reason` on `service:out-of-service` is normalized as P7's typed
  override reason (trim, 200 code points, suffix after truncation).

## Deliverables, each red-first at its seam

1. **Contract first.** `asyncapi.yaml`: `service:restart {serviceId}`,
   `service:out-of-service {serviceId, reason}`, `service:in-service
   {serviceId}` appended to the `action` enum with payload schemas
   (`serviceId` enum = the nine ids; `reason` string, `maxLength` 200);
   `DomainStateHealth.message` keeps `maxLength: 300`. Commit alone.
2. **The policy and the monitor.** `utils/restartPolicy.js` (pure; unit
   tests: trips inside the sliding window, decays outside it, observers
   never give up, delay cap, non-finite fallback). `ProcessMonitor`
   gains `supervisionKind` and `restart()` (clears the pending timer,
   kills the child, awaits close, resets the window, starts, emits
   `restarted`); `'gave-up'` carries `{failures, windowMs}`. Red-first
   in `tests/unit/utils/processMonitor.test.js` (39 today): five silent
   or noisy exits inside the window → `gave-up`; the same five spread
   past the window → no `gave-up`; `restart()` on a hung child.
3. **Host config.** `config/host.example.json`, `config/host.schema.json`
   (AJV; the per-process fields and ranges of P11), `.gitignore` gains
   `backend/config/host.json`, `services/hostConfigService.js` reads once
   at boot (`HOST_CONFIG_PATH` seam with the loud warn-once as
   `profileService.js` does it; absent file = defaults, no warn; each
   out-of-range field clamped with a loud warn). `VLC_SELF_SPAWN` and
   `ENABLE_MUSIC_PLAYBACK` become deprecated aliases read once with a
   warn and mapped onto modes (`VLC_SELF_SPAWN=false` → vlc `adopt`;
   `ENABLE_MUSIC_PLAYBACK=false` → mpd `off`). Red-first: one test per
   out-of-range field; alias env vars warn; absent file silent.
4. **The owning services.** VLC, MPD, Chromium (via R-S1), the three
   observers, HA: each reads its host-config row; on `gave-up` the
   owner reports `down` with `crashed N times in Ws — supervision
   stopped; Restart to try again` (N and W filled; W in whole seconds).
   Dormancy-aware: a profile-dormant service's child is neither started
   nor restarted; an operator latch stops restarts; `service:in-service`
   starts it. HA: reconnect stays unbounded with the capped backoff,
   reports `down` when downtime passes `escalateAfterMs`, reports `down`
   on `auth_invalid`. Red-first: `gave-up` reports the message; a
   dormant service's child is not started; the latch stops restarts;
   `auth_invalid` reports down.
5. **The verbs.** `commandExecutor.js` cases per P12 (`service:restart`
   per service as P12 lists, including adopt-mode VLC's "owner
   re-resolved only" ack; `service:out-of-service` latches, stops
   restarts, calls `expireHolds({blockedBy})`; `service:in-service`
   clears the latch, starts the child, recomputes dormancy, marks
   past-due cues fired, probes). All three ungated by the health gate and
   exempt from the dormant branch, in the `service:check` idiom;
   `serviceId` checked against `KNOWN_SERVICES`; `service:check` on a
   dormant id acks the door wording without probing (already true —
   keep the test). Red-first in the commandExecutor suites: `in-service`
   succeeds on a latched service and marks past-due cues fired;
   `restart` succeeds on a down one; `out-of-service` latches, stops
   restarts, expires its holds; an unknown id is refused.
6. **Hold expiry.** `services/holdExpiry.js` (R-S4); `endSession` and
   `systemReset` call it unconditionally; `processQueue` fails an
   already-queued video when `vlc` is dormant instead of holding;
   `video_busy` keeps its 10 s auto-discard. Red-first: expiry at
   session end and at reset (both stores, per-item discard observed);
   already-queued video fails under a latch.
7. **Display.** `displayDriver.js` on the shared policy (R-S1);
   `service:restart display` relaunches; the `display:*` dependency rows
   in `commandExecutor.js`. Red-first: Chromium restarts only while
   visible; five exits inside the window → `gave-up` → `down` with the
   message; the 58 existing tests stay green.
8. **The scanner's verbs.** `HealthRenderer.js` renders verbs per
   status: down → Check Now, Restart, Run without it; dormant with the
   operator door → Put back in service; dormant with the profile door →
   none; healthy → Check Now. `audio` and `bluetooth` cards add
   Re-route, a link that opens the routing panel. Run without it
   prompts for the reason (the dialog idiom the E2E page object
   handles). `AdminOperations` gains `restartService`,
   `takeOutOfService(serviceId, reason)`, `putInService`;
   `domEventBindings.js` gains the three cases. Red-first in
   `tests/unit/ui/renderers/HealthRenderer.test.js` (32 today): one case
   per status's verb set; the `CueRenderer` dormant badge re-tested
   across an in-service transition. Rebuild `dist`.
9. **The rig audit.** `backend/tests/rung1/audit-flows.js` gains the
   five-kills scenario (kill VLC five times inside the window → `down`
   with the message) and the recovered playback (`service:restart vlc`
   → a video plays). Run it on the rig: shared arms are up under
   `/tmp/rung1`; boot the engine with `backend/tests/rung1/engine.sh
   start`, stop it after; never stop the shared arms.

## Runs before your report (fresh; paste the last lines)

Backend: `npm test`, `npm run coverage:check`, `npm run lint`,
`npm run test:integration`, the audit. Scanner (in the worktree's
`ALNScanner/`): `npm test`, `npm run coverage:check`, `npm run lint`,
`npm run test:e2e`, `npm run build`. Check `df -h /` before and after
any run that spawns an orchestrator.

## Completion criterion

Every deliverable has a commit naming its pin; every red-first seam
went red on the old code and green on the new (say how you saw red);
`gave-up` has a listener in every owning service; the contract, the
executor and the scanner agree on the three action names and payloads;
the diff touches no file the shared-file rules reserve.

## Report

Write `.superpowers/sdd/2026-09-12-block2-hardening-plan/supervisor-lane-report.md`:
status, commits (backend and scanner), what went red and how, the run
tails, any ruling you had to make, concerns. Return to the orchestrator
only: status, commits, one-line test summary, concerns.
