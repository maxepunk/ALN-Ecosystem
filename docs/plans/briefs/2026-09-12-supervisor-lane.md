# The supervisor lane — the supervisor and the fault buttons (implementer brief, revision 2: three tasks)

Read this first; it is your single source of requirements, with the
exact values to use verbatim. Vocabulary: `CONTEXT.md` §2 (one truth,
three loops), §4 (dormant vs fault, alarm integrity, status with verbs,
supervisor, held item), §5 (endpoints vs stack). Model: Opus. You
dispatch no subagents; review arrives from the orchestrator after each
task's report. Revision 2 folds in the plan-and-brief review of
2026-09-12 (scratch `supervisor-lane-review.md`) and cuts the lane into
THREE tasks, run in order in the same worktree, each reviewed before the
next starts. The dispatch names your task: **Task A** (deliverables
1–4), **Task B** (5–7), **Task C** (8–9).

## What this buys, and for whom

The GM's loop. Tonight a service that crashes five times stops being
restarted and nobody is told: `gave-up` has no listener, the health
card keeps its last word, and the only verb the GM has is "Check Now".
After this lane a crashing service restarts inside a bounded window,
escalates to a red card that says "crashed N times in Ws — supervision
stopped; Restart to try again", and the GM can act from the card:
Restart, Run without it (the operator door), Put back in service. Holds
that a dead service blocks expire when the GM takes it out of service,
at session end, and at reset, instead of surviving as ghosts. The TV
browser obeys the same rules as video and music (one supervision path,
ruling R20). The venue's switch for all of this is one hand-edited JSON
file on the show machine (R13: the supervisor ships ENABLED; the file's
numbers are the fallback; there is no `off`, ruling R18).

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
  entries after `service:check` (line 1822 today) and document their
  payloads in the SAME `payload.description` bullet list (:1824-1841)
  with one example each (the `session:start` idiom at :1829); the
  payload node stays the free-form object it is; `preflight:run` is
  NOT yours (the arms lane appends it after your merge). Do not touch
  the handshake section near line 30.
- `backend/src/services/commandExecutor.js`: your three `service:*`
  cases only; the `display:*` dependency rows already exist (:51-53,
  landed by T1a P16) — verify, do not add.
- `backend/src/websocket/gmAuth.js`: not yours. Nothing in this lane
  needs the `show-control` room: the verbs answer on `gm:command:ack`
  to the requesting socket and health flows on the existing `gm` room;
  only the preflight domain needs that room (the wiring step).
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
  `start()` (55) is synchronous and returns nothing.
- Chromium is NOT a ProcessMonitor consumer: `utils/displayDriver.js`
  spawns it itself (`_doLaunch` 122-250) with the two-stage orphan kill
  (123-159), a 1 s alive check (237-249), and ruling 27's exit
  classification (192-224: a hidden exit with `launched && (code === 0
  || terminating)` is `healthy` "relaunches on show"; a visible exit is
  always `down`; 58 tests, 130 s). `showScoreboard()` (278-281) AWAITS
  `ensureBrowserRunning()` (257-268) and returns false on failure;
  `displayControlService.js:91,233` branch on that result. `probe()`
  (359-379) launches nothing.
- VLC adopt mode (`VLC_SELF_SPAWN=false`, `vlcMprisService.js:111-158`)
  creates no monitor; the D-Bus name-owner path (`startPlaybackMonitor`
  + `_resolveOwner`, :155-158) runs regardless of mode.
- MPD's gate is `ENABLE_MUSIC_PLAYBACK` in `app.js:226-239`: `false`
  skips `spawnMpd()` AND `init()` and calls `_loadPlaylistsFromDisk()`;
  `jest.config.base.js:15-17` forces `false` for every backend test
  process; music's health then stays the registry default `down`
  ("Not yet checked").
- Lighting: the HA WebSocket reconnect is unbounded with a capped
  backoff (`lightingService.js:236-246`: `report('lighting','down',
  'WebSocket disconnected')` at once, then `min(5000*attempts, 30000)`);
  `auth_invalid` (205-209) never reports to the registry.
- Holds: two independent implementations — `heldItemsStore.js` (the
  cue engine's, `cueEngineService.js:51`; per-item `discard`; cue holds
  record `blockedBy` at :64; 10 s auto-discard only for `video_busy`
  cue holds) and `videoQueueService.js`'s raw `_heldVideos` array
  (915-926; NO `blockedBy` field; never auto-expires; feeds `sync:full`
  at `syncHelpers.js:260-261`). `endSession()` (`sessionService.js:503-556`)
  expires nothing; `systemReset.js` clears both silently (87, 110). The
  dormant-fails-not-holds branch already exists
  (`videoQueueService.js:107-115`, test at `videoQueueService.test.js:594-622`).
- Contracts: the `action` enum ends at `service:check` (1822); the ack
  requires `[action, success, message]` only; `DomainStateHealth` (2688)
  pins `message maxLength: 300`, enforced nowhere (`serviceHealthRegistry.js:65-106`
  report, :116-149 markDormant).
- `REQUIRED_PAYLOAD_FIELDS` already lists the four new actions
  (`commandExecutor.js:94-97`) and `grants.js` (78, 84) already maps
  `service:` / `preflight:` → `show-control`; the switch has no cases
  for them (all fall to `Unknown action`).
- P7's reason normalizer: `sessionService.js:840-855`, module-private,
  trims and caps at 350 code points, no suffix.
- Host config: nothing exists (`config/host*.json`, `HOST_CONFIG_PATH`,
  `.gitignore` entry). Copy `profileService.js:31-59`'s seam pattern.
- Scanner: `HealthRenderer.js` has one verb, "Check Now", shown only
  when down (lines 141-148, 194-215); `AdminOperations.checkService()`
  (58-60) and `domEventBindings.js` `case 'serviceCheck'` (137-140) are
  the shapes to copy; `CueRenderer.js`'s dormant badge (121-136) is an
  existing consumer to re-test, not to change.

## The pins (plan §3 P10–P13 as amended 2026-09-12 by R18 and R20)

Read them in the plan before the first edit (search `P10.`). Every
number and message in them is binding.

## Orchestrator rulings on what the pins leave open (recorded in the plan's record)

- **R-S1 One supervision path (R20).** Chromium becomes a
  `ProcessMonitor` consumer. `ProcessMonitor` gains optional hooks a
  consumer may supply: `preStart()` (the display's two-stage orphan
  sweep, moved from `_doLaunch` 123-159), `postStart()` (the 1 s alive
  check, 237-249), `mayRestart()` (true only while the scoreboard is the
  intended visible mode; dead-while-hidden relaunches on show), and
  `classifyExit({code, signal, terminating, launched, visible})`
  returning `{status, message}` (ruling 27's logic, 192-224, moved
  verbatim); plus an awaitable `ensureRunning()` that resolves to launch
  success (runs `preStart`, spawns if needed, awaits `postStart`), which
  `showScoreboard()` and `displayControlService` await as they await
  `ensureBrowserRunning()` today. The restart POLICY (sliding flap
  window over exit timestamps, `maxFailures` inside `flapWindowMs`,
  delay = `restartDelayMs * backoffMultiplier ** failuresInWindow`
  capped at `backoffCapMs` for observers and at `flapWindowMs` for
  services, a non-finite result falls back to `restartDelayMs`; `kind:
  'service' | 'observer'`; observers never give up) lives in
  `utils/restartPolicy.js` and `ProcessMonitor` alone applies it.
  `displayDriver.js` keeps window management (`showScoreboard`/
  `hideScoreboard`, `probe()`) and supplies the hooks; the 58 existing
  display tests stay green, adapted only where they reached into the
  removed spawn code.
- **R-S2 What counts as a failure.** An exit counts toward the flap
  window when it was not initiated by `stop()` or `restart()` AND the
  consumer's `classifyExit` did not return `healthy` (a consumer with
  no classifier never returns healthy: every uninitiated exit counts,
  whatever the exit code and whether or not the child wrote to stdout).
  The `receivedData` reset rule goes. So a hidden clean Chromium exit
  (ruling 27: `healthy`, relaunches on show) never trips escalation.
- **R-S3 Host-config modes (R18).** `self`: spawn at boot and
  supervise. `adopt`: never spawn; attach to the external process; on
  its exit re-resolve and never restart. For VLC in adopt mode the exit
  is detected on the D-Bus name-owner path (the owner vanishes) and
  triggers a re-resolve, never a restart. For MPD in adopt mode with
  nothing to adopt (every backend test process, via the alias): no
  spawn, `_loadPlaylistsFromDisk()` still runs, one connect probe, and
  the registry reports `down` with `no MPD to adopt at <socket path>` —
  the same health word tests see today. There is NO `off`: whether a
  program runs tonight is the profile's truth through the dormancy map.
  `maxFailures` ranges 0–20; 0 means manual restarts only (no automatic
  relaunch; escalation to the red card at the first death; the GM's
  Restart verb works) — R13's rehearsal fallback. Aliases:
  `VLC_SELF_SPAWN=false` → vlc `adopt`; `ENABLE_MUSIC_PLAYBACK=false` →
  mpd `adopt`; each read once with a deprecation warn.
- **R-S4 One expiry method.** `services/holdExpiry.js` exports
  `expireHolds({reason, blockedBy})`: iterates the cue engine's store
  (filtering on each cue hold's recorded `blockedBy`) and the video
  queue's list (RULE: every held video is blocked by `vlc`; no field is
  added to the video record and the `sync:full.heldItems` wire is
  unchanged), calls each item's owning-service discard, and emits
  nothing itself. Called with no filter by `endSession` and by system
  reset; with `blockedBy: serviceId` by `service:out-of-service`. The
  two stores stay separate (their unification is backlog, CONTEXT §4).
- **R-S5 Messages and reasons.** `serviceHealthRegistry.report()` and
  `markDormant()` truncate `message` to 300 code points, warning once
  per service. `service:out-of-service`'s `reason` is normalized by the
  SAME function P7 uses: extract `normalizeOverrideReason` from
  `sessionService.js:840-855` into `utils/normalizeReason.js` (exported;
  trim; cap 350 code points; no suffix) and call it from both sites.
- **R-S6 Lighting escalation.** Today's immediate `down` on WebSocket
  close STAYS (alarm integrity: a real loss shows at once).
  `escalateAfterMs` changes only the MESSAGE once downtime passes it
  (`Home Assistant unreachable for <N>s — reconnecting; Restart
  re-creates the container`); `auth_invalid` reports `down` with
  `Home Assistant rejected the token`.

## Task A — deliverables 1–4 (the policy, the monitor, the host file, the owning services)

1. **Contract first.** `asyncapi.yaml`: `service:restart {serviceId}`,
   `service:out-of-service {serviceId, reason}`, `service:in-service
   {serviceId}` appended to the `action` enum; the three payloads
   documented in the description bullet list with one example each;
   `serviceId` (one of the nine ids) and `reason` (350 code points max)
   are enforced in the executor, not the schema. Red-first: a contract
   test asserting the three actions are in the `gm:command` action enum
   (the idiom at `tests/contract/websocket/phase1-events.test.js:52-83`).
   Commit alone.
2. **The policy and the monitor.** `utils/restartPolicy.js` (pure; unit
   tests: trips inside the sliding window, decays outside it, observers
   never give up, delay cap, non-finite fallback, `maxFailures: 0` never
   restarts). `ProcessMonitor` gains `supervisionKind`, the hooks and
   `ensureRunning()` of R-S1, and `restart()` (clears the pending timer,
   kills the child, awaits close, resets the window, starts, emits
   `restarted`); `'gave-up'` carries `{failures, windowMs}`. Red-first in
   `tests/unit/utils/processMonitor.test.js` (39 today): five uninitiated
   exits inside the window → `gave-up`; the same five spread past the
   window → no `gave-up`; an exit the classifier calls `healthy` does not
   count; `restart()` on a hung child; `maxFailures: 0` → `gave-up` at
   the first exit.
3. **Host config.** `config/host.example.json`, `config/host.schema.json`
   (AJV; the per-process fields and ranges of P11 as amended: `mode:
   'self' | 'adopt'`, `maxFailures` 0–20, `restartDelayMs` 250–60000,
   `backoffMultiplier` 1–10, `flapWindowMs` 5000–600000, observers'
   `backoffCapMs`, HA's `escalateAfterMs`; plus P11's recorded headroom
   as optional fields: `processes.<id>.bin`, `processes.<id>.user`, the
   runtime dir), `.gitignore` gains `backend/config/host.json`,
   `services/hostConfigService.js` reads once at boot (`HOST_CONFIG_PATH`
   seam with the loud warn-once as `profileService.js` does it; absent
   file = defaults, no warn; each out-of-range field clamped with a loud
   warn; 21 clamps to 20; 0 accepted). The two aliases of R-S3 read once
   with a warn. Red-first: one test per out-of-range field; the aliases
   warn and map; absent file silent.
4. **The owning services.** VLC, MPD, Chromium (through R-S1), the
   three observers, HA: each reads its host-config row. On `gave-up` the
   owner reports `down` with `crashed N times in Ws — supervision
   stopped; Restart to try again` (N and W filled; W in whole seconds).
   Dormancy-aware: a profile-dormant service's child is neither started
   nor restarted; an operator latch stops restarts; `service:in-service`
   (Task B) starts it. Adopt-mode VLC re-resolves on the name-owner
   path (R-S3). HA per R-S6. The registry truncates `message` to 300 code
   points warn-once (R-S5). Red-first: `gave-up` reports the message; a
   dormant service's child is not started; the latch stops restarts;
   adopt-mode VLC re-resolves when the owner vanishes; the mpd alias
   posture reports `down` with the R-S3 message and playlists still load;
   `auth_invalid` reports down; a 400-code-point message is truncated to
   300 with one warn.

Task A gate: backend `npm test`, `npm run coverage:check`, `npm run
lint`, `npm run test:integration`; `df -h /` before and after.

## Task B — deliverables 5–7 (the verbs, the holds, the display)

5. **The verbs.** `commandExecutor.js` cases per P12: `service:restart`
   (vlc: monitor restart + owner re-resolve, or owner re-resolve only in
   adopt mode with the ack saying so; music: MPD respawn; lighting:
   container ensure + reconnect; display: relaunch through
   `ensureRunning()`; audio/sound/bluetooth: re-run the `init()` probe;
   gameclock/cueengine: no-op success); `service:out-of-service` (latch,
   stop restarts, `expireHolds({blockedBy: serviceId})`, reason
   normalized by R-S5's shared function); `service:in-service` (clear
   the latch, start the child, recompute dormancy, mark past-due cues
   fired, probe). All three ungated by the health gate and exempt from
   the dormant branch, in the `service:check` idiom; `serviceId` checked
   against `KNOWN_SERVICES`; `service:check` on a dormant id acks the
   door wording without probing (already true — keep the test).
   Red-first in the commandExecutor suites: `in-service` succeeds on a
   latched service and marks past-due cues fired; `restart` succeeds on a
   down one; `out-of-service` latches, stops restarts, expires its
   holds; an unknown id is refused; a 400-code-point reason is stored
   truncated to 350.
6. **Hold expiry.** `services/holdExpiry.js` (R-S4); `endSession` and
   `systemReset` call it unconditionally; `video_busy` keeps its 10 s
   auto-discard. Red-first: expiry at session end and at reset (both
   stores, per-item discard observed); videos ALREADY HELD when the
   latch lands are expired by `expireHolds({blockedBy: 'vlc'})`.
   Regression guard (green today): an already-queued video fails, not
   holds, under a dormant player.
7. **Display.** `displayDriver.js` supplies the hooks and
   `ProcessMonitor` owns the spawn (R-S1); `service:restart display`
   relaunches through `ensureRunning()`. Red-first: Chromium restarts
   only while visible; a dead-while-hidden display relaunches on show
   (through `ensureRunning()`); five uninitiated non-healthy exits inside
   the window → `gave-up` → `down` with the message; a latched display
   is not relaunched on show; `maxFailures: 0` never relaunches and
   reports `down` at the first death; the 58 existing display tests stay
   green.

Task B gate: as Task A, plus the display suite run alone
(`npx jest tests/unit/utils/displayDriver.test.js`).

## Task C — deliverables 8–9 (the scanner's verbs, the rig audit)

8. **The scanner's verbs.** `HealthRenderer.js` renders verbs per
   status: down → Check Now, Restart, Run without it; dormant with the
   operator door → Put back in service; dormant with the profile door →
   none; healthy → Check Now. `audio` and `bluetooth` cards add Re-route,
   a link that opens the routing panel. Run without it prompts for the
   reason (the dialog idiom the E2E page object handles). `AdminOperations`
   gains `restartService`, `takeOutOfService(serviceId, reason)`,
   `putInService`; `domEventBindings.js` gains the three cases. Red-first
   in `tests/unit/ui/renderers/HealthRenderer.test.js` (32 today): one
   case per status's verb set; the `CueRenderer` dormant badge re-tested
   across an in-service transition. Rebuild `dist`.
9. **The rig audit.** `backend/tests/rung1/audit-flows.js` gains the
   five-kills scenario (kill VLC five times inside the window → `down`
   with the message) and the recovered playback (`service:restart vlc`
   → a video plays). Run it on the rig: take `/tmp/rung1/e2e.lock` with
   `flock` first; boot the engine with `backend/tests/rung1/engine.sh
   start`, stop it after; never stop the shared arms.

Task C gate: scanner (in the worktree's `ALNScanner/`) `npm test`,
`npm run test:coverage && npm run coverage:check`, `npm run lint`,
`npm run test:e2e`, `npm run build`; the audit on the rig.

## Completion criterion (per task, then the lane)

Every deliverable of the task has a commit naming its pin; every
red-first seam went red on the old code and green on the new (say how
you saw red; regression guards marked); after Task A, `gave-up` has a
listener in every service-kind owner (vlc, music, display; observers
never emit it); after Task B, the contract, the executor and the
scanner agree on the three action names and payloads; the diff touches
no file the shared-file rules reserve.

## Report

Create `.superpowers/sdd/2026-09-12-block2-hardening-plan/supervisor-lane-report.md`
at the start of Task A and extend it per task: status, commits (backend
and scanner), what went red and how, the run tails, any ruling you had
to make, concerns. Return to the orchestrator only: status, commits,
one-line test summary, concerns.
