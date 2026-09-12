# T1a brief — dormancy core, health enum, session-start gate, render-safe scanner (Block 2, stage CS.2)

Read this file first. It is your single source of requirements; the exact
values in it are used verbatim. Vocabulary is defined in `CONTEXT.md`: §2
(one truth, three loops; verdict; activation; capability), §4 (dormant vs
fault; alarm integrity; status with verbs; self-heal; service domain), §5
(endpoints vs stack; preflight; paper vs live; environment ladder). Use
those words as defined there.

Authority behind this brief: `docs/plans/2026-09-12-block2-hardening-plan.md`
§3 pins P2–P8 and P16 (quoted below) and §4 "T1a"; §5 DoD pins (a)–(d),
(f), (i); the ratified spec `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md`
§8 (R-C3-1, R-C3-2, R-C3-3) read with §5 rows M1–M8, S2, S5, S7. Facts
about the current code cited here were read from the tree on 2026-09-12
(`.superpowers/sdd/2026-09-12-block2-hardening-plan/t1a-factsheet.md`
holds the quoted lines; the code is the truth if the two differ).

## Where you work

Work in `/home/user/ALN-Ecosystem/` on the branch `claude/nice-curie-hescfv-t1a`,
already checked out (cut from the designated branch after T1b merged). The
GM scanner is the SUBMODULE at `/home/user/ALN-Ecosystem/ALNScanner/`;
in it, create branch `claude/nice-curie-hescfv` from its current HEAD and
commit the scanner half there; the parent commit that finishes the task
carries the moved pin. (The top-level `/home/user/ALNScanner` and
`/home/user/ALN-TokenData` are stale clones; never read or written.) The
ALN pack is the submodule `ALN-TokenData/` (unchanged by this task). Node
dependencies are installed in `backend/`, `ALNScanner/`; the rung-1 rig
arms are up under `/tmp/rung1` (session bus, Xvfb `:99`, PipeWire null
sinks `rung1_hdmi`/`rung1_bt`, witness Home Assistant `rung1-ha` on
`:8123`, Bluetooth mock); Playwright's Chromium is `/opt/pw-browsers/chromium`.
Component guidance: `backend/CLAUDE.md`, `ALNScanner/CLAUDE.md`. Commit
on the task branches; the orchestrator pushes after review; you push
nothing.

Model: Opus (plan §4). You dispatch no subagents; review comes from the
orchestrator after your report.

## Goal

The engine's health vocabulary becomes exactly three words,
`healthy | down | dormant`, at every site that speaks it: the registry,
the three contract enum sites, the resolver, the E2E capability helpers,
the rung-1 audit, and the GM scanner's dashboard. A service whose
equipment family is not installed tonight is DORMANT — latched, never
red, with its door named — and every cue that depends only on it is
silenced at session start, rendered as such, and refused quietly at
fire. The display becomes the ninth service. `session:start` refuses
while any `onAbsent: require` need is unresolved, with a typed, logged
"start anyway" override that ships in the same task as the gate, in
both the backend and the scanner. Every session carries a preflight
stamp; `sync:full` and `/health` carry the profile identity. The
operator door's latch mechanics land here (its commands ride T3).

## What T1b already built (interfaces you consume)

- `backend/src/gameRules/endpointServices.js` exports `ENDPOINT_FAMILIES`,
  `servicesForFamily(familyId)`, `dormantServicesFor(manifest, profile)`
  → `{ [serviceId]: { reason } }` with reasons `'<family>' not installed tonight`
  and `no audio sink installed tonight and no display`. Its private
  `isInstalled(familyId, declared)` becomes an export named
  `familyInstalled(profile, familyId)` (D3 below) so the resolver can
  ask the same question.
- The profile `endpoints` interior is pinned (schema `additionalProperties: false`);
  `installed: false` is legal on every family; `audio.sinks` is an array.
- Fixtures: `backend/tests/e2e/fixtures/profiles/toy-dormant-lighting.json`
  (toy-test-rig minus `lighting.instruments`, bindings kept);
  `backend/tests/e2e/fixtures/packs/toy-heist-require/` (toy pack with
  `lighting.instruments.onAbsent: "require"`; same packId and contentHash as
  `toy-heist` — the pack directory is its identity). The toy pack's cues:
  `vault-alarm-hit` (lighting only), `heist-sting` (sound only),
  `all-clear-chime` (sound + lighting role `all-clear`, a MIXED simple
  cue), `vault-sequence` (compound; timeline with a lighting entry).
- CI legs `production`, `toy-heist`, `toy-dormant-lighting`,
  `toy-require-dormant` in `.github/workflows/test.yml`; E2E flows pin a
  pack and profile per call through `startOrchestrator({ packPath, profilePath })`
  (`backend/tests/e2e/setup/test-server.js`).
- `packService.getManifest()` returns the frozen active manifest;
  `profileService.getProfile()` the frozen raw profile;
  `profileService.getProfileInfo()` → `{profileId, forPack}`.

## The pins you implement (plan §3, verbatim)

> **P2. Dependent needs follow their family (C1 §2 row 3; CS.1
> adjudication 4).** Under a dormant `lighting.instruments`,
> `lighting-role` and `lighting-role-ref` resolve DORMANT; under a
> dormant `display.main`, `surface-channel` does. Unbound roles under
> an INSTALLED family stay FAULT. Bindings under a dormant family are
> ignored with a warn (the endpoint wins).

> **P3. Which cues are silenced (refinement of D-C3.2, argued from
> S2's reasoning, D-5 ★).** At session start a cue is dormancy-disabled
> when it has at least one service-bearing command AND every one of
> them depends on a dormant service, or when any entry of its
> TIMELINE depends on one (a compound cue is never "mixed"). A mixed
> simple cue stays enabled; its summary carries `dormantCommands:
> [{action, service, door}]` and the quick-fire tile shows the badge;
> at fire, each dormant command is refused quietly (info log, no
> `cue:error`, no hold) and the rest run. `fireCue` returns
> `{fired, held, reason}`: a wholly dormant cue is refused outright
> (never held); `cue:fire` acks `held` as success with the parked
> message and refusals as `success:false`; `releaseCue` propagates the
> outcome and re-holds with the new reason on a refusal. The dormancy
> check runs before lighting-role normalization. When a cue id leaves
> the dormancy set during an active session, its past-due clock
> threshold is marked fired (reuse `_markPastClockCuesFired`).

> **P4. Three disable provenances.** `disabledCues` (GM, persisted),
> `spentOnceCues` (fired once-cues, persisted), `dormancyDisabledCues`
> (recomputed, never persisted). `isCueDisabled(id)` is the union;
> summaries carry `disabledBy: 'gm' | 'once' | 'dormant' | null`;
> `cue:enable` on a dormancy-disabled cue is refused.

> **P5. Sticky dormant carries its door.** Registry entries are
> `{status, message, lastChecked, door?}`, `door: 'profile' |
> 'operator'` present only when dormant. `report()` is ignored while
> latched (debug log); `startRevalidation` skips dormant ids;
> `isHealthy` is false and `isDormant` true for dormant; `reset()`
> preserves dormant entries; `markDormant`/`clearDormant` check
> `KNOWN_SERVICES`. One wording helper keyed on `door` ("not installed
> tonight" / "out of service") serves the executor, the renderer
> summary and the row.

> **P6. The feed.** `services/dormancyService.js` owns `compute()`
> (pure over the frozen pack snapshot, the frozen profile and the
> registry), `apply()`, `recompute()`, AND the operator-latch set (the
> authority; the registry entry is its projection; latches survive
> `system:reset` and are lost on a process restart, recorded). Run
> points: the end of `initializeServices` (after every service init,
> before revalidation; this also covers restore after a restart), at
> session create, inside system reset after cues reload. The profile
> stays boot-frozen.

> **P7. The require gate.** `sessionService.startGame({startAnyway,
> reason}, actor)`: after the status check it evaluates live and
> refuses only when `blocking` (unresolved `onAbsent: require` needs,
> the one list the require rule alone can populate) is non-empty; no
> arm added later may widen it. `startAnyway` needs a normalized,
> non-empty `reason` (control and bidi strip, no pipes, 350 code
> points); the override stamp is `{reason, at, blocking, byDeviceId,
> byTier}` and the warn logs the same fields as metadata. The typed
> dialog ships in the same task as the gate (SB-6 ★). On restore of a
> non-ended session at boot the evaluation is re-run and re-stamped
> with `restoredAt`; a `no-go` there is a loud warn and a GM-visible
> row, never a refusal.

> **P8. One preflight evaluator.** `services/preflightService.js`
> `evaluate({live})` returns `{profileId, forPack, packHash,
> computedAt, depth, rows, rollup, blocking, limits}`. Rows quote
> `resolve()`'s verdicts verbatim (`runs | dormant | fault | no-go |
> unknown`), carry `depth`, `reason`, `verbs`, and a `severity` field
> (the certificate warn class; `fault` severity from
> `stack.onAbsent`). Resource rows come from iterating the pack's cue
> commands through `validateCommand` (its first production caller);
> the service adds only token videos via the `video-file` need. The
> fixed `limits` block (`verifies`, `cannotVerify`, `humanChecklist`)
> is the honesty rule's face. The service holds the last evaluation
> (the one source); the session stamp and the domain push derive from
> it. Every shell-out goes through `execHelper` with a bounded
> timeout; no sync fs on the evaluate path; DNS via `dns.Resolver`
> with a timeout; gateway reachability as a bounded TCP connect; a
> single-flight guard and a total wall-clock budget, over-budget arms
> reporting `unknown`.

(T1a builds P8 MINIMAL: the resolver rows, the service arm, `blocking`,
`limits`, `getLast()`. The `validateCommand` resource arm, `video-file`,
shell-outs, DNS, budget, and the domain push are T4's. Nothing in T1a
touches the network.)

> **P16. The display is the ninth service (D-1 ★).** Owned by
> `displayDriver`: healthy when the kiosk process is alive or hidden
> after a successful launch; down when it died while visible or a
> launch failed; dormant via `display.main`. Contract-first at the
> three enum sites' neighbours (`DomainStateHealth.required`,
> `sync:full`), the scanner's `SERVICE_NAMES`, the capabilities key.
> `display:scoreboard` depends on `display` and `display:return-to-video`
> on `vlc` in `SERVICE_DEPENDENCIES`; `display:status` stays ungated.

## Orchestrator rulings that refine the pins for this task (ledger rulings 11–20)

- **R11. The NO-GO ack.** `gm:command:ack` keeps its `{action, success, message}`
  shape. A refused `session:start` acks `success: false` with `message`
  = `NO-GO: ` followed by the blocking reasons joined by `; `. The
  scanner keys on the `NO-GO: ` prefix. A missing or empty `reason` with
  `startAnyway` acks `success: false`, message `startAnyway requires a reason`.
- **R12. The typed dialog** lives in the scanner's app layer
  (`src/app/domains/gameAdmin.js`, where the scanner's `prompt()` /
  `confirm()` idiom already lives) around `SessionManager.startGame({startAnyway, reason})`.
  Flow: send `session:start {}`; on a rejection whose message starts
  with `NO-GO: `, show `prompt()` whose text is the reasons plus
  "Type a reason to start anyway, or Cancel:"; empty or cancelled →
  stop (toast the NO-GO); otherwise re-send `session:start {startAnyway: true, reason}`.
- **R13. `display` health semantics.** `displayControlService.init`
  pre-launches the kiosk today; `display` reports `healthy` ("kiosk
  launched") when `_doLaunch` succeeds, `down` ("kiosk launch failed")
  when it fails, `down` ("kiosk exited while visible") on an exit while
  visible, and stays `healthy` with message "kiosk closed while hidden;
  relaunches on show" on an exit while hidden. When video playback is
  disabled by host config (`config.features.videoPlayback` false) it
  reports `down` ("video playback disabled (host config)") at init — the
  same posture `vlc` has there. Supervision and relaunch-on-show are T3.
- **R14. Restore re-evaluation** runs at the END of `initializeServices`
  (right after the dormancy feed, before `startRevalidation`), not in
  `sessionService.init()` — at that point no service has initialized.
- **R15. The require leg.** `GMScannerPage.startGame()` (E2E helper)
  re-sends with `{startAnyway: true, reason: 'e2e: require leg'}` when the
  first ack is `NO-GO: ` AND `process.env.E2E_PACK_PATH` ends with
  `toy-heist-require`; anywhere else a NO-GO fails the test. One flow
  asserts the refusal itself (DoD f).
- **R16. Inventory shape.** `resolve()`'s `inventory.serviceHealth[id]`
  may be a string (`'healthy' | 'down' | 'dormant'`, as today) or the
  registry snapshot entry `{status, message, door?}`; the resolver reads
  `status` and `door` from either. `preflightService` passes the snapshot.
- **R17. Once-cues.** `cue:enable` on a spent once-cue re-arms it (clears
  it from `spentOnceCues`), today's behavior; `cue:enable` on a
  GM-disabled cue clears `disabledCues`; `cue:enable` on a
  dormancy-disabled cue is refused with the door wording. A session
  persisted before this change has no `spentOnceCues` key: restore
  treats it as empty (a once-cue fired before the upgrade re-arms once;
  recorded, accepted).
- **R18. Rollup shape.** `rollUp()` returns `{status, dormantNeeds,
  problems, blocking}`: `dormantNeeds` = ids of dormant service and
  endpoint needs (the field formerly named `dormantServices`; fix its
  stale r1 comment); `problems` = every fault and no-go reason (as
  today); `blocking` = the reasons of `no-go` verdicts ONLY (the require
  rule and the device-class minimum are the only producers of `no-go`
  today; no other arm may add to it — say so in the doc comment).
- **R19. `message` maxLength** at both health sites is 300.
- **R20. The scanner's nested `data` submodule pin** moves to the
  ALN-TokenData commit T1b made (`6f9bc30`) in the same scanner commit
  (`git -C ALNScanner/data checkout 6f9bc30`, then `git add data` inside
  ALNScanner).

## Deliverables

Each ends with the check that proves it. Tests first: every new or
extended test file is seen red before the code that makes it green; the
report carries both runs.

### D1. Registry: three words, sticky dormant, the door, the ninth service

`backend/src/services/serviceHealthRegistry.js`:
- `KNOWN_SERVICES` gains `'display'` (nine). Export `HEALTH_STATUSES = Object.freeze(['healthy', 'down', 'dormant'])`
  and `DOORS = Object.freeze(['profile', 'operator'])`.
- Entries: `{status, message, lastChecked, door?}`; `door` present only
  while dormant. `getSnapshot()` copies it through.
- `report(id, status, message)`: accepts `healthy | down` from services
  (any other value still warns and returns); while the entry is dormant
  the call is IGNORED with a `logger.debug` naming the id, the ignored
  status and the door (no state change, no event).
- `markDormant(id, door, reason)`: `id` in `KNOWN_SERVICES`, `door` in
  `DOORS`, else warn + return; sets `{status: 'dormant', message: reason,
  lastChecked: now, door}`; emits `health:changed` when the status or door
  changed. `clearDormant(id)`: leaves the latch, sets `down` with message
  `awaiting first check` (not healthy — a probe decides), emits.
  `isDormant(id)` → boolean; `isHealthy(id)` → false for dormant.
- `startRevalidation`: the sweep skips ids where `isDormant` is true.
  `display` has no entry in `HEALTH_CHECKS` (the driver reports).
- `reset()`: routes non-dormant ids through `report(id, 'down', 'Reset')`;
  dormant entries are preserved unchanged (Sm-4).
- `backend/src/services/dormancyWording.js` (new, tiny, pure):
  `doorWording(door)` → `'profile'` → `not installed tonight`;
  `'operator'` → `out of service`; anything else throws. Every backend
  message that names a dormant service's reason is built from it:
  `<serviceId> is not installed tonight` / `<serviceId> is out of service`.

Tests red-first in `backend/tests/unit/services/serviceHealthRegistry.test.js`
(extend): nine known ids incl. `display`; `markDormant` latches with the
door and emits; `report()` while latched is ignored (status, message,
door unchanged; no `health:changed`); `clearDormant` unlatches to `down`
+ emits; `isHealthy` false / `isDormant` true; `getSnapshot` carries
`door` only when dormant; `reset()` preserves a dormant entry and still
resets the others; `report('display', 'healthy')` accepted; an unknown
door warns and does nothing. `serviceHealthRegistry-revalidation.test.js`:
a dormant id's check is never called during the sweep. New
`tests/unit/services/dormancyWording.test.js`: both doors, unknown throws.

### D2. Resolver: `installed:false`, the service `dormant` branch, dependent needs, `blocking`

`backend/src/gameRules/resolution.js` (pure; no requires from `services/`):
- `case 'endpoint'`: a family declared but not installed (per
  `endpointServices.familyInstalled(profile, need.id)`) resolves like an
  omitted one: `dormant` under degrade (`'<id>' not installed tonight`),
  `no-go` under require (`required endpoint '<id>' not installed at this venue`).
- `case 'service'`: per R16 read `status`/`door`; `status === 'dormant'`
  → verdict `dormant`, depth `live`, reason `'<id>' is <doorWording(door)>`
  (import `doorWording` — it is pure, allowed); `healthy` → `runs` live;
  anything else → `fault` live (as today); undefined → `runs` paper.
- `case 'lighting-role'` and `'lighting-role-ref'`: when the profile's
  `lighting.instruments` is not installed (absent or `installed:false`)
  → `dormant`, paper, `lighting not installed tonight`; otherwise the
  existing unbound-role FAULT logic stands unchanged.
- `case 'surface-channel'`: when `display.main` is not installed →
  `dormant`, paper, `display not installed tonight`; otherwise unchanged.
- `rollUp()` per R18.
- Bindings under a dormant family are not the resolver's concern (pure);
  the warn lives in D4's `apply()`.

Tests red-first in `tests/unit/gameRules/resolution.test.js` (extend):
`installed:false` on `display.main` resolves dormant/no-go exactly like
absent; a `{status:'dormant', door:'profile'}` inventory entry for `vlc`
resolves `dormant` live with the profile wording, `door:'operator'` with
the operator wording; a string `'dormant'` resolves dormant with no door
wording (`is dormant`); the toy needs against `toy-dormant-lighting.json`
resolve both lighting roles `dormant` (not fault) and `rollup.dormantNeeds`
lists `lighting.instruments`; the same needs against `toy-test-rig.json`
resolve `runs`; an unbound role under an installed family is still
`fault`; `blocking` holds only no-go reasons and is `[]` when a fault is
present; `dormantNeeds` is the renamed field (no `dormantServices` key).

### D3. `familyInstalled` export

`backend/src/gameRules/endpointServices.js`: export `familyInstalled(profile, familyId)`
(the existing private predicate, given the profile object): absent family
→ false; object family → `installed === true`; `audio.sinks` → some entry
`installed === true`. Test in `tests/unit/gameRules/endpointServices.test.js`
(extend): the three shapes plus a profile with no `endpoints`.

### D4. The feed: `dormancyService`

`backend/src/services/dormancyService.js` (new):
- `compute({ manifest, profile, registry })` (pure over its arguments):
  returns `{ profileDormant: { [serviceId]: { reason, door: 'profile' } }, operatorDormant: { [serviceId]: { reason, door: 'operator' } }, dormantServiceIds: [...] }`
  where `profileDormant` = `dormantServicesFor(manifest, profile)`,
  `operatorDormant` = the latch set (below), and the id list is the
  union (operator wins the door when both apply).
- The operator latch set: `setOutOfService(serviceId, reason)` /
  `putInService(serviceId)` / `getOperatorLatches()` — in-memory Map,
  validated against `KNOWN_SERVICES`; NOT persisted (lost on process
  restart; say so in the doc comment). T3 wires the commands.
- `apply(result)`: for every id in `dormantServiceIds` → `registry.markDormant(id, door, '<id> is <doorWording(door)>')`;
  for every KNOWN id NOT in the list that is currently dormant →
  `registry.clearDormant(id)`; then `cueEngineService.applyDormancy(result)`
  (D5); then, for each family dormant by profile that has bindings in the
  profile (`bindings.lighting` when `lighting.instruments` is dormant;
  `bindings.surfaces` when `display.main` is), one `logger.warn` per
  family: `profile binds <n> <family> names but the family is not
  installed tonight — bindings ignored`.
- `recompute()` = `compute` over `packService.getManifest()`,
  `profileService.getProfile()`, the registry, then `apply`. Returns the
  result. `_resetForTesting()` clears the latch set.
- Run points: `backend/src/app.js` at the end of `initializeServices`
  (after the last `init()`, before `startRevalidation`) — then D8's
  restore re-evaluation; `sessionService.createSession()` before the
  preflight stamp (D8); `systemReset.js` right after `cueEngineService.loadCues(packCues)`
  and before `startRevalidation`.

Tests red-first in `tests/unit/services/dormancyService.test.js` (new;
real manifests/profiles by path; registry and cue engine as the real
singletons reset per test, or minimal fakes where the file already uses
them): ALN manifest + `aln-full-kit.json` → nothing dormant; toy manifest
+ `toy-dormant-lighting.json` → `lighting` dormant by profile, the
registry entry carries `door: 'profile'`, `vault-alarm-hit` and
`vault-sequence` are dormancy-disabled, `all-clear-chime` is enabled with
`dormantCommands: [{action:'lighting:scene:activate', service:'lighting', door:'profile'}]`,
`heist-sting` untouched; `setOutOfService('vlc', 'TV died')` then
`recompute()` → `vlc` dormant with `door: 'operator'`; then
`performSystemReset` (the real one from `systemReset.js`, with the test
helper's service set) → `vlc` is STILL dormant by operator afterwards
(DoD i, backend half); `putInService('vlc')` → cleared to `down`;
`apply()` warns once about ignored lighting bindings for the dormant
profile.

### D5. Cue engine: three sets, silencing, the three-valued fire

`backend/src/services/cueEngineService.js` + `cue/standingEvaluator.js`:
- Sets: `disabledCues` (GM), `spentOnceCues` (once-cues fired; the two
  auto-disable sites at ~595 and ~694 move from `disabledCues` to it),
  `dormancyDisabledCues` (recomputed by `applyDormancy`, never
  persisted). `_dormantCommands: Map<cueId, [{action, service, door}]>`.
- `isCueDisabled(id)` = union of the three. `standingEvaluator`'s
  `findMatchingEventCues` / `findMatchingClockCues` receive the union
  (pass a Set built from `isCueDisabled`, or the three Sets — keep the
  signatures explicit; no hidden globals). `toPersistence(firedClockCues, disabledCues, spentOnceCues, active)`
  / `fromPersistence` gains `spentOnceCues` (missing → empty Set, R17).
- `applyDormancy({ dormantServiceIds, doorOf })`: for each cue, the
  service-bearing commands are those whose `SERVICE_DEPENDENCIES[cmd.action]`
  is defined; a compound cue with ANY timeline entry on a dormant service
  → wholly dormancy-disabled; a simple cue with ≥1 service-bearing
  command and ALL of them dormant → dormancy-disabled; some dormant →
  enabled, `dormantCommands` recorded; a cue leaving the dormancy set
  while `this.active` → `_markPastClockCuesFired(currentElapsed)` for it
  (reuse the existing method; it takes elapsed seconds — read the clock
  through the existing `gameClockService` reference the engine already
  holds). Emits `cue:status` once after the sweep.
- `getCueSummaries()` gains `disabledBy: 'gm' | 'once' | 'dormant' | null`
  (precedence when several apply: `dormant`, then `gm`, then `once`) and
  `dormantCommands` (array, possibly empty); `enabled` stays
  `!isCueDisabled(id)`.
- `fireCue(cueId, trigger, parentChain, source)` returns
  `{ fired: boolean, held: boolean, reason?: string }`: dormancy-disabled
  → `{fired:false, held:false, reason: '<cueId> is <doorWording(door)> (<service>)'}`
  (info log, no `cue:error`, no hold); GM- or once-disabled →
  `{fired:false, held:false, reason: '<cueId> is disabled'}` (info log,
  as today's skip); held for `service_down`/`video_busy` →
  `{fired:false, held:true, reason: '<cueId> held: <blockedBy>'}`; fired
  → `{fired:true, held:false}`. A mixed simple cue at fire skips each
  dormant command with an info log and runs the rest. The dormancy check
  precedes lighting-role normalization on every path.
- `releaseCue(heldId)`: after releasing, if the re-fire returns
  `fired:false`, re-hold the cue with `reason` = the refusal's reason and
  return `{released:false, reason}`; on `held:true` likewise; on
  `fired:true` return `{released:true}`. Its callers in `commandExecutor`
  (`held:release`, `held:release-all`) ack accordingly.
- `enableCue(id)`: refuses (`return {ok:false, reason}` and no state
  change) when `dormancyDisabledCues.has(id)`; otherwise clears the GM
  and once sets (R17). `disableCue` unchanged.

Tests red-first in `tests/unit/services/cueEngineService.test.js` (extend)
and `tests/unit/services/cue/standingEvaluator.test.js` (extend): the
provenance cases (gm / once / dormant / none, and the precedence); the
persistence shape with `spentOnceCues` and the missing-key restore;
`applyDormancy` on the toy cues under `lighting` dormant (wholly dormant
refused, mixed fires with the lighting command skipped quietly and the
sound command run, compound disabled); `fireCue` return values for all
four outcomes; `releaseCue` re-holds on a refusal; `enableCue` refusal on
a dormancy-disabled cue and re-arm on a spent once-cue; leaving the set
marks past-due clock cues fired.

### D6. Executor: the dormant branch, the acks, the pre-registered fields

`backend/src/services/commandExecutor.js`:
- Health gate: before the existing down check, `if (registry.isDormant(requiredService))`
  → `{success:false, message: '<service> is <doorWording(door)>', source}`.
- `SERVICE_DEPENDENCIES` gains `'display:scoreboard': 'display'` and
  `'display:return-to-video': 'vlc'`; `display:status` stays ungated.
- `case 'cue:fire'`: read `fireCue`'s result: `held` → success with
  message `Cue held: <reason>`; `fired:false` → success:false with
  `reason`; `fired:true` → `Cue fired: <id>`.
- `case 'cue:enable'`: on a refusal → success:false with the reason.
- `case 'held:release'` / `'held:release-all'`: use `releaseCue`'s
  result (success:false with reason on a re-hold; `release-all` stays
  try-all and reports the re-held ids in its message).
- `case 'service:check'`: when `registry.isDormant(serviceId)` → ack
  success:true with message `<serviceId> is <doorWording(door)> — not probed`
  and no probe; the all-services branch skips dormant ids the same way.
- `case 'session:start'`: `await sessionService.startGame({ startAnyway: !!payload.startAnyway, reason: payload.reason }, { deviceId, tier: actor?.tier ?? null })`;
  a `PreflightNoGoError` (D8) becomes `{success:false, message: 'NO-GO: ' + reasons.join('; ')}`;
  a missing reason becomes `{success:false, message: 'startAnyway requires a reason'}`.
- `REQUIRED_PAYLOAD_FIELDS` gains `'service:restart': ['serviceId']`,
  `'service:out-of-service': ['serviceId', 'reason']`,
  `'service:in-service': ['serviceId']`, `'preflight:run': []` — table
  entries only; NO switch cases (T3/T4 add them).
- `backend/src/gameRules/grants.js`: `FLOOR_ACTION_PREFIXES` gains
  `['preflight:', 'show-control']` beside `service:`.

Tests red-first in `tests/unit/services/commandExecutor.test.js` (extend)
and `tests/unit/websocket/adminEvents.test.js` where the actor is built:
the dormant branch wording for both doors; the three `cue:fire` acks; the
`cue:enable` refusal; `held:release` on a re-hold; `service:check` on a
dormant id acks without probing (spy: the check is not called);
`display:scoreboard` gated on `display`; `session:start` NO-GO ack text,
the missing-reason ack, and the override reaching `startGame` with the
actor `{deviceId, tier}`; an observe actor (tier `device`, functions
`['observe']`) is refused at the floor for `preflight:run`,
`service:restart`, `service:out-of-service`, `service:in-service` (the
refusal happens before the unknown-action default); `grants` unit test:
`preflight:` maps to `show-control`.

### D7. Preflight evaluator (minimal)

`backend/src/services/preflightService.js` (new):
- `evaluate({ live })` → `{ profileId, forPack, packHash, computedAt, depth: live ? 'live' : 'paper', rows, rollup, blocking, limits }`.
  `rows` = one per `resolve()` verdict: `{ id: need.kind + ':' + need.id, kind, verdict, depth, reason, severity, verbs: [] }`
  (`severity`: `'fault'` verdicts take `manifest.hardware.stack[need.id]?.onAbsent ?? 'degrade'`;
  `no-go` → `'blocking'`; others `null`). Inputs: needs =
  `collectPackNeeds(activePack)` (find how the pack object is assembled
  for `collectPackNeeds` — `packService` getters; the rung-1
  `generate-fixtures.js` shows a working call), profile =
  `profileService.getProfile()`, inventory = live ? `{ serviceHealth: registry.getSnapshot() }` : `{}`.
  `blocking` = `rollup.blocking`. `limits` is a fixed frozen object:
  `verifies: ['pack needs against the profile (paper)', 'service health (live)']`,
  `cannotVerify: ['media files', 'lighting scenes in Home Assistant', 'audio sinks', 'network', 'host resources', 'certificate']`
  (T4 moves items from the second list to the first as its arms land),
  `humanChecklist: ['speakers placed and powered', 'TV on the right input', 'tokens on set']`.
- `getLast()` returns the last evaluation or null; `_resetForTesting()`.
- No shell-outs, no fs, no network in this task.

Tests red-first in `tests/unit/services/preflightService.test.js` (new):
toy pack + `toy-dormant-lighting.json` paper: lighting rows dormant,
`blocking` empty; the require pack + the same profile: `blocking` holds
the one require reason and `rollup.status === 'no-go'`; live with a
registry where `vlc` is dormant by operator: the `service:vlc` row reads
`dormant` live with the operator wording; `limits` is the fixed block;
`getLast()` returns the evaluation just made.

### D8. Session: the gate, the stamps, the override, the restore re-evaluation

`backend/src/services/sessionService.js`:
- `createSession()`: after the pack stamp, `dormancyService.recompute()`,
  then `this.currentSession.metadata.preflight = stampFrom(preflightService.evaluate({ live: true }))`
  where the stamp is `{ status, computedAt, profileId, packHash, blocking, dormantNeeds }`
  (a compact projection; not the rows). `metadata.preflightOverride = null`.
- `startGame({ startAnyway = false, reason } = {}, actor = {})`: after
  the status check, `const ev = preflightService.evaluate({ live: true })`;
  re-stamp `metadata.preflight`; if `ev.blocking.length > 0`: without
  `startAnyway` → throw `PreflightNoGoError(ev.blocking)` (a named error
  class exported from `preflightService.js`, `.blocking` array); with
  `startAnyway` → `normalizeReason(reason)` (strip Unicode control and
  bidi-control characters, remove `|`, trim, cap at 350 code points;
  empty after → throw `Error('startAnyway requires a reason')`), stamp
  `metadata.preflightOverride = { reason, at: ISO, blocking: ev.blocking, byDeviceId: actor.deviceId ?? null, byTier: actor.tier ?? null }`,
  `logger.warn('session started over a preflight NO-GO', { ...the same fields })`,
  then continue. A `fault` never refuses (only `blocking` does).
- `restampAfterRestore()` (new; called from `app.js` per R14 when a
  restored session exists and is not `ended`): evaluate live, stamp
  `metadata.preflight` with an added `restoredAt`; if `blocking` is
  non-empty → `logger.warn` with the reasons; never refuse; save.
- Session model: `metadata.preflight` and `metadata.preflightOverride`
  default `null` on new sessions and on restore of older files (the A2
  `undefined → null` precedent).

Tests red-first in `tests/unit/services/sessionService.test.js` (extend)
and `tests/unit/models/session.test.js` (extend): create stamps
`preflight` with the projection; start with `blocking` refuses with
`PreflightNoGoError` and the session stays `setup`; `startAnyway` without
a reason refuses; with `'  the TV is dead ‮|ok  '` starts, the stored
reason is `the TV is dead ok` (bidi mark and pipe removed, trimmed), the
stamp carries `byDeviceId`/`byTier`, and the warn metadata carries the
same fields; a 400-code-point reason is cut to 350; a `fault` verdict does
not refuse; `restampAfterRestore` on a restored `active` session adds
`restoredAt` and warns on no-go without changing status; older session
JSON restores with both fields `null`.

### D9. Display as the ninth service

`backend/src/utils/displayDriver.js` per R13 (`registry.report('display', ...)`
at the launch success/failure branches, in the exit handler by
`visible`, and at `displayControlService.init` when video playback is
disabled — find where the driver learns that; if the driver never sees
the flag, report from `displayControlService.init` instead and say so).
`backend/src/services/videoQueueService.js` `canAcceptVideo()`: when
`registry.isDormant('vlc')` → `{ available: false, reason: 'vlc_dormant', message: 'Video is <doorWording(door)>' }`
(checked before the down branch); `scanRoutes.js` keeps its `409 {status:'rejected'}`
wire and maps `vlc_dormant` to the message `Video playback unavailable`
(same as `vlc_down`) — no wire change (S7). `processQueue`: an
already-queued item when `vlc` is dormant FAILS (`video:failed`) instead
of being held.

Tests red-first: `tests/unit/utils/displayDriver.test.js` (extend or
create beside the existing driver tests — grep for the file): the four
report cases; `tests/unit/services/videoQueueService.test.js`: the
dormant branch of `canAcceptVideo` and the queued-item failure;
`tests/unit/routes/scanRoutes*.test.js`: `vlc_dormant` → 409 rejected
with the unavailable message.

### D10. `sync:full` and `/health` carry the profile

`backend/src/websocket/syncHelpers.js`: `profile: require('../services/profileService').getProfileInfo()`
(nullable). `backend/src/routes/healthRoutes.js`: `profile: getProfileInfo()`
beside `pack`. The `sync:full` completeness test (grep `heldItems` under
`tests/contract` and `tests/unit/websocket` to find the test that pins
every emitter) covers `profile`. Tests red-first there and in
`tests/contract/http/*health*` for the `/health` key.

### D11. Contracts (edit FIRST, then the code that meets them)

`backend/contracts/asyncapi.yaml`:
- `sync:full` `serviceHealth` (≈652–670): `status` enum `[healthy, down, dormant]`;
  add `door: { type: string, enum: [profile, operator] }` (optional);
  `message` gains `maxLength: 300`.
- `DomainStateHealth` (≈2589–2598): `status` enum `[healthy, down, dormant]`
  (`degraded` deleted); `required` gains `display`; description "One
  entry per registered service (9 services)"; add `door` as above;
  `message` `maxLength: 300`.
- `SyncFull.data.required` gains `profile`; add `profile` schema:
  nullable object `{ profileId: string, forPack: string|null }` with a
  one-line description ("the installation profile frozen at boot").
- Session `metadata` (≈393–440): add `preflight` (nullable object:
  `status` enum `[go, go-degraded, no-go]`, `computedAt` date-time,
  `profileId`, `packHash`, `blocking` array of strings, `dormantNeeds`
  array of strings, `restoredAt` date-time optional) and
  `preflightOverride` (nullable object: `reason` string maxLength 350,
  `at` date-time, `blocking` array, `byDeviceId` string|null, `byTier`
  string|null). Mirror wherever the session shape is inlined a second
  time (`session:update`).
- `gm:command`: in the `action` enum's neighbouring description (or the
  `payload` description), document `session:start` payload
  `{ startAnyway?: boolean, reason?: string }` and the `NO-GO: ` ack
  convention (R11).
`backend/contracts/openapi.yaml`: `GameState.serviceHealth` status enum
`[healthy, down, dormant]` + `door` + `message` maxLength; `/health`
response gains `profile` (nullable `{profileId, forPack}`), listed in
`required`.

Contract tests red-first: `backend/tests/contract/scanner/client-contract-conformance.test.js`
gains "the three health enum sites agree with the registry": parse both
YAML files, read the three enums, assert each equals
`HEALTH_STATUSES` exactly (order-insensitive) and that no site contains
`degraded`; the existing contract suites that validate `sync:full`,
`service:state` health and `/health` payloads against the schemas pass
with `display` present, `door` present on a dormant entry, and `profile`
present.

### D12. E2E helpers and the rung-1 audit

- `backend/tests/e2e/helpers/capabilities.js`: `CAPABILITY_KEYS` gains
  `display`; `getCapabilities` returns, per key, `caps[key]` boolean
  (healthy) as today plus `caps._status[key]` = the status string and
  `caps._door[key]`; `requireCapabilities` skips with
  `dormant (not installed in this profile): [keys]` when every missing key
  is dormant, else the existing message; `requireDegraded` treats a
  dormant key as NOT degraded (skips unless a key is `down`); new
  `requireDormant(test, caps, keys)` skips unless every key is dormant,
  with the recorded reason.
- `backend/tests/e2e/helpers/assertions.js` ≈187: `['healthy', 'down', 'dormant']`.
- `backend/tests/rung1/audit-flows.js`: the healthy list gains `display`
  ("8 real services"; `bluetooth` stays honestly absent).
- `backend/tests/e2e/helpers/page-objects/GMScannerPage.js` `startGame()`:
  R15.
Unit tests for the helper functions where a unit test exists for
`capabilities.js` (grep); else a small new `tests/unit/e2e-helpers/capabilities.test.js`
covering the three gates with fake caps.

### D13. Scanner half (ALNScanner submodule; ES6 modules; Jest)

- `src/ui/renderers/HealthRenderer.js`: `SERVICE_NAMES` gains
  `display: 'Display (kiosk)'`; three states: `healthy` (as today),
  `down` (red, as today), `dormant` (grey: class
  `health-service--dormant`, text from a scanner-side
  `doorWording(door)` — `profile` → `Not installed tonight`, `operator`
  → `Out of service`, in `src/ui/renderers/dormancyWording.js`, a
  parity copy of the backend helper; note the parity in both files);
  collapse rule: collapsed when every service is `healthy` OR dormant by
  `profile`; expanded when any is `down` or dormant by `operator`;
  collapsed summary text `All installed systems operational (h/t, d not installed tonight)`
  when `d > 0`, else today's text; the collapsed summary is a toggle
  (click expands to show the grey rows; a second click collapses) —
  `data-action` wired through `domEventBindings.js` like the other
  buttons. Both `_buildDOM` and `_updateDOM` paths.
- `src/ui/renderers/CueRenderer.js`: standing list: a summary with
  `disabledBy === 'dormant'` renders `standing-cue-item--dormant` (grey),
  the door wording instead of the Enable button, no Enable/Disable
  button; quick-fire grid: a tile whose cue is disabled (any provenance)
  gets the `disabled` attribute and class `cue-tile--disabled` with a
  `title` carrying the reason; a tile whose summary has a non-empty
  `dormantCommands` shows a badge (`cue-tile__badge`, count) with a
  `title` listing `action → service (door wording)`.
- `src/admin/SessionManager.js`: `startGame({ startAnyway = false, reason } = {})`
  sends `session:start` with that payload (`{}` when neither is set).
- `src/app/domains/gameAdmin.js`: the dialog per R12 around the call
  that starts the game; the NO-GO reasons are shown in the prompt text
  and, on cancel, in the existing toast/error path.
- `src/styles/` (the admin stylesheet the health/cue components use):
  the grey states and the badge; use the `--color-` tokens.
- `data` submodule pin per R20.
- Tests red-first: `tests/unit/ui/renderers/HealthRenderer.test.js`
  (three states, the collapse rule incl. operator-expanded, door
  wording, the ninth name, the toggle), `CueRenderer.test.js` (dormant
  row, disabled tile, badge + title), `tests/unit/admin/SessionManager.test.js`
  (payload shapes), `tests/unit/app/domains/gameAdmin*.test.js` (NO-GO →
  prompt → resend with `startAnyway` and the typed reason; cancel → no
  resend; a non-NO-GO failure → no prompt), `dormancyWording.test.js`.
  Then `npm run build` so `backend/public/gm-scanner` serves the new
  dist for the E2E flows.

### D14. End-to-end proof (DoD a–d, f)

New flow `backend/tests/e2e/flows/30-dormancy-lighting.test.js`, pinned
per call to `packPath: tests/e2e/fixtures/packs/toy-heist` and
`profilePath: tests/e2e/fixtures/profiles/toy-dormant-lighting.json`
(follow `toy-pack-lighting-roles.test.js` for the pattern and the
pack-pinning gate so the flow runs on every leg):
(a) `lighting:scene:activate {role:'vault-alarm'}` over `gm:command` →
ack `success:false` whose message ends `is not installed tonight`, and
`sync:full.heldItems` stays empty; (b) `cueEngine` summaries show
`vault-alarm-hit` and `vault-sequence` with `disabledBy:'dormant'`,
`all-clear-chime` enabled with one `dormantCommands` entry, both at
session create and after `stopOrchestrator` + `startOrchestrator` with
the same pins (restore); (c) `sync:full.serviceHealth.lighting` equals
`{status:'dormant', door:'profile', message: <string>, lastChecked: <any>}`;
(d) in the GM scanner admin view (page object): the lighting row has
`health-service--dormant`, the dashboard root has the collapsed class,
and the cue list rows for the two silenced cues have
`standing-cue-item--dormant`. Second flow `31-preflight-require-gate.test.js`
pinned to `toy-heist-require` + the dormant profile: `session:start {}`
acks `NO-GO: ` with the lighting reason; `{startAnyway:true}` without a
reason acks the missing-reason message; with `reason:'e2e override'`
the session becomes `active` and `session.metadata.preflightOverride`
carries the reason, `byDeviceId`, `byTier:'operator'` (DoD f).

## Proof runs

From `backend/`, once all code is in, in this order, pasting each
command and its summary line into the report:
1. `npm test -- --coverage`; 2. `npm run coverage:check`; 3. `npm run lint`;
4. `npm run test:integration` (sequential, several minutes);
5. from `ALNScanner/`: `npm test -- --coverage`, `npm run coverage:check`, `npm run lint`, `npm run build`;
6. the rung-1 audit: `bash backend/tests/rung1/engine.sh start && node backend/tests/rung1/audit-flows.js; bash backend/tests/rung1/engine.sh stop` (from the repo root; expect every assertion PASS incl. the 8-service line);
7. the four Tier L legs locally, each with its own command (see T1b's
   report for the commands). The bar (ledger ruling 9): zero failures
   outside the recorded base set — T1b's report §"Proof runs" lists that
   set (6 on production, 14 on the toy legs, all resource-contention or
   the parity-pack race). Your new flows must pass on every leg where
   they run. A failure not in the base set is yours to root-cause.

## Guardrails

Edit contracts before the code that meets them. Winston logger, never
`console.log`, in `backend/src`. `gameRules/` stays pure (no `services/`
requires, no I/O). Existing tests keep their assertions except where a
deliverable above names the test and the new fact it pins. When a value
you need is not in this brief or the files it points at, stop and ask
(NEEDS_CONTEXT) rather than invent one. Keep `MESSAGE_TYPES` untouched
(no new discrete WS event). The profile stays boot-frozen. Push nothing.

## Completion criterion

Done means every deliverable D1–D14 is implemented with its tests seen
red then green; the three enum sites agree and contain no `degraded`;
`display` is a known service everywhere the eight were named (registry,
contracts, scanner `SERVICE_NAMES`, capability keys, audit); the two E2E
flows pass on the legs where they run; proof runs 1–7 are green under
the stated bar; commits on the two task branches (parent + scanner) with
the scanner pin and the nested `data` pin moved; dist rebuilt; nothing
pushed.

## Report

Write the full report to
`/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/t1a-report.md`:
Status; Commits (parent, scanner submodule, short SHA + subject); TDD
evidence per test file (RED command + failing lines; GREEN command +
summary line); Proof runs (the seven, with the Tier L table: leg /
passed / failed / skipped / failures outside the base set); Files
changed; Deviations from this brief (each with the reason); Concerns.
Then reply with at most 15 lines: status (DONE | DONE_WITH_CONCERNS |
BLOCKED | NEEDS_CONTEXT), commits, one-line test summary, concerns, the
report path.
