# Block 2 re-open census

Tree commit: `e87f8c5` (branch `claude/nice-curie-hescfv`, parent `ALN-Ecosystem`, submodules at their pins, working tree clean). Date: 2026-09-12.

Every claim below carries `file:line`. Every count is verified by the `grep -rn` command printed beside it — run from the repo root (`/home/user/ALN-Ecosystem`) unless noted. Prose appears only where a table cannot carry the fact.

---

## 1. Health enum blast radius

```
for lit in healthy down degraded dormant; do
  grep -rn "['\"]$lit['\"]" backend/src backend/contracts backend/tests/e2e/helpers \
    backend/tests/rung1 backend/scripts ALNScanner/src config-tool/lib config-tool/public/js \
    2>/dev/null | grep -v -E '/(node_modules|dist)/'
done
```

Counts: `healthy` 36, `down` 23, `degraded` 0, `dormant` 7 — **66 total**.

**Methodology caveat (found while running it):** this grep only matches *quoted* literals. The one real `degraded` in the tree is an **unquoted** YAML enum member (`asyncapi.yaml:2597`, `enum: [healthy, degraded, down]`) — a bare-word grep for `degraded` (no quote requirement) finds it; the quoted-literal search specified by this step does not. The brief's own methodology has a blind spot here, and it is exactly the skew the design doc exists to close. Flagged, not silently corrected — the table below still reports the quoted-only count as instructed.

### `healthy` (36)

| file:line | context | consumer class |
|---|---|---|
| `backend/src/services/videoQueueService.js:31` | `status === 'healthy' && this._heldVideos.length > 0` — recoverable-hold check | comparison |
| `backend/src/services/commandExecutor.js:832` | `` `Health check: ${serviceId} = ${checkResult ? 'healthy' : 'down'}` `` — `service:check` ack text | other (message text) |
| `backend/src/services/vlcMprisService.js:437` | `registry.report('vlc', 'healthy', 'MPRIS signal received')` in `_processStateChange` | producer report (out-of-band: D-Bus monitor) |
| `backend/src/services/audioRoutingService.js:146` | comment referencing the literal | other (comment) |
| `backend/src/services/audioRoutingService.js:159` | `checkHealth()` success branch | producer report (in-band) |
| `backend/src/services/gameClockService.js:17` | constructor: reports healthy unconditionally at construction | producer report (out-of-band: init) |
| `backend/src/services/gameClockService.js:279` | `reset()` | producer report (out-of-band: reset) |
| `backend/src/services/systemReset.js:221` | post-reset gameclock re-report | producer report (out-of-band: system reset) |
| `backend/src/services/cueEngineService.js:142` | `loadCues()` end | producer report (out-of-band: cue load event) |
| `backend/src/services/cueEngineService.js:172` | `checkHealth()` | producer report (in-band) |
| `backend/src/services/lightingService.js:114` | `checkConnection()` success branch | producer report (in-band: HTTP probe) |
| `backend/src/services/lightingService.js:207` | HA WebSocket `auth_ok` handler | producer report (out-of-band: socket) |
| `backend/src/services/soundService.js:45` | `checkHealth()` success branch | producer report (in-band) |
| `backend/src/services/musicService.js:223` | docblock comment | other (comment) |
| `backend/src/services/musicService.js:225` | docblock comment | other (comment) |
| `backend/src/services/musicService.js:232` | `_setConnected()` ternary → `report()` | producer report (**mixed** — see §2) |
| `backend/src/services/bluetoothService.js:86` | `checkHealth()`, no devices connected | producer report (in-band) |
| `backend/src/services/bluetoothService.js:96` | `checkHealth()`, BT sink found | producer report (in-band) |
| `backend/src/services/bluetoothService.js:98` | `checkHealth()`, BT sink missing (warn branch) | producer report (in-band) |
| `backend/src/services/bluetoothService.js:105` | `checkHealth()`, pactl check threw | producer report (in-band) |
| `backend/src/services/mprisPlayerBase.js:138` | `_setConnected()` ternary → `report()` | producer report (**mixed** — see §2) |
| `backend/src/services/serviceHealthRegistry.js:42` | `report()`'s own input validator | comparison (validator) |
| `backend/src/services/serviceHealthRegistry.js:72` | `isHealthy()` | comparison |
| `backend/src/gameRules/resolution.js:144` | `resolveOne`, `case 'service'` | comparison |
| `backend/contracts/asyncapi.yaml:672` | `sync:full` example payload (vlc) | contract enum (example value) |
| `backend/contracts/asyncapi.yaml:673` | `sync:full` example payload (music) | contract enum (example value) |
| `backend/contracts/openapi.yaml:1308` | example payload | contract enum (example value) |
| `backend/contracts/openapi.yaml:1312` | example payload | contract enum (example value) |
| `backend/contracts/openapi.yaml:2014` | example payload | contract enum (example value) |
| `backend/contracts/openapi.yaml:2018` | example payload | contract enum (example value) |
| `backend/tests/e2e/helpers/assertions.js:187` | `expect(['healthy','down']).toContain(...)` | test helper |
| `backend/tests/e2e/helpers/capabilities.js:61` | `caps[key] = health[key]?.status === 'healthy'` | test helper (comparison — the S5 finding, still live) |
| `backend/tests/rung1/audit-flows.js:91` | filters services by healthy status | test helper |
| `ALNScanner/src/ui/renderers/HealthRenderer.js:48` | `healthyCount` filter (collapse-rule input) | renderer |
| `ALNScanner/src/ui/renderers/HealthRenderer.js:83` | `isDown = s.status !== 'healthy'` (build) | renderer |
| `ALNScanner/src/ui/renderers/HealthRenderer.js:136` | `isDown = s.status !== 'healthy'` (update) | renderer |

### `down` (23)

| file:line | context | consumer class |
|---|---|---|
| `backend/src/services/commandExecutor.js:832` | same ternary as above | other (message text) |
| `backend/src/services/audioRoutingService.js:162` | `checkHealth()` catch | producer report (in-band) |
| `backend/src/services/audioRoutingService.js:196` | `reset()` | producer report (out-of-band) |
| `backend/src/services/cueEngineService.js:904` | `reset()` | producer report (out-of-band) |
| `backend/src/services/lightingService.js:116` | `checkConnection()` catch | producer report (in-band) |
| `backend/src/services/lightingService.js:254` | HA WebSocket close handler | producer report (out-of-band: socket) |
| `backend/src/services/lightingService.js:436` | `reset()` | producer report (out-of-band) |
| `backend/src/services/soundService.js:48` | `checkHealth()` catch | producer report (in-band) |
| `backend/src/services/soundService.js:154` | `reset()` | producer report (out-of-band) |
| `backend/src/services/musicService.js:199` | comment | other |
| `backend/src/services/musicService.js:224` | docblock comment | other |
| `backend/src/services/musicService.js:226` | docblock comment | other |
| `backend/src/services/musicService.js:232` | `_setConnected()` ternary | producer report (mixed) |
| `backend/src/services/bluetoothService.js:77` | `checkHealth()`, adapter unavailable | producer report (in-band) |
| `backend/src/services/bluetoothService.js:478` | `reset()` | producer report (out-of-band) |
| `backend/src/services/mprisPlayerBase.js:138` | `_setConnected()` ternary | producer report (mixed) |
| `backend/src/services/mprisPlayerBase.js:384` | `reset()` | producer report (out-of-band) |
| `backend/src/services/serviceHealthRegistry.js:25` | constructor's initial per-service seed (`status: 'down'`) — not a `.report()` call | producer report (out-of-band: init default) |
| `backend/src/services/serviceHealthRegistry.js:42` | validator | comparison |
| `backend/src/services/serviceHealthRegistry.js:149` | docblock comment | other |
| `backend/src/services/serviceHealthRegistry.js:155` | comment | other |
| `backend/src/services/serviceHealthRegistry.js:157` | `reset()` loop → `report(id, 'down', 'Reset')` | producer report (out-of-band: self) |
| `backend/tests/e2e/helpers/assertions.js:187` | same `expect` as above | test helper |

### `dormant` (7)

| file:line | context | consumer class |
|---|---|---|
| `backend/src/gameRules/resolution.js:47` | `case 'endpoint'`, no fallback available in this branch's message | producer (verdict producer) |
| `backend/src/gameRules/resolution.js:89` | `case 'endpoint'`, degrade default | producer |
| `backend/src/gameRules/resolution.js:119` | `case 'surface-channel'` | producer |
| `backend/src/gameRules/resolution.js:184` | `rollUp`, filters dormant service/endpoint verdicts | comparison |
| `backend/src/gameRules/resolution.js:195` | `rollUp`, `go-degraded` status test | comparison |
| `config-tool/public/js/sections/packs.js:52` | hardcoded prototype/mock need row (`{kind:'endpoint', ..., verdict:'dormant', ...}`) | other (prototype/mock UI data) |
| `config-tool/public/js/sections/packs.js:216` | filters the mock needs list by verdict for display | renderer |

**`degraded` (0)** — no quoted occurrence; see the methodology caveat above for the one unquoted occurrence.

**Confirms:** `serviceHealthRegistry.js` has **no** `dormant`-aware code anywhere (`report()`'s validator at :42 still accepts only `healthy`/`down`) — CS.2's enum change has not landed. `dormant` exists only in the CS.1-built pure core (`gameRules/resolution.js`) and in config-tool's hand-authored mock/prototype data — never wired to a live signal.

---

## 2. `serviceHealthRegistry`

Full public API (`backend/src/services/serviceHealthRegistry.js`):

| Member | Line | Signature / shape |
|---|---|---|
| `KNOWN_SERVICES` | `:14` | `['vlc','music','sound','bluetooth','audio','lighting','gameclock','cueengine']` (8 services) |
| `constructor()` | `:17-30` | seeds every known service to `{status:'down', message:'Not yet checked', lastChecked:null}` |
| `report(serviceId, status, message='')` | `:36-65` | rejects unknown `serviceId` (warn+return) and rejects `status` outside `'healthy'/'down'` (warn+return, `:42`); emits `health:changed` only when status actually changes |
| `isHealthy(serviceId)` | `:70-73` | `entry.status === 'healthy'`, `false` for unknown |
| `getStatus(serviceId)` | `:78-80` | raw entry or `null` |
| `getState()` | `:86-88` | alias for `getSnapshot()` |
| `getSnapshot()` | `:94-100` | plain object `{[id]: {status, message, lastChecked}}` (JSON-safe) |
| `startRevalidation(services, intervalMs=15000)` | `:110-136` | builds `HEALTH_CHECKS` (below), `setInterval` sweep with per-service `Promise.allSettled` |
| `stopRevalidation()` | `:141-146` | clears the timer |
| `reset()` | `:151-159` | stops revalidation, then routes every known service through `report(id,'down','Reset')` so the transition is logged |

`HEALTH_CHECKS` map (`:113-121`, local to `startRevalidation`):
```
vlc → services.vlc?.checkConnection()
music → services.music?.checkConnection()
sound → services.sound?.checkHealth()
bluetooth → services.bluetooth?.checkHealth()
audio → services.audio?.checkHealth()
lighting → services.lighting?.checkConnection()
// gameclock + cueengine: always healthy (in-process) — skipped
```

`getSnapshot()` shape: `{ vlc: {status, message, lastChecked}, music: {...}, ... }` — one entry per `KNOWN_SERVICES` id, no `dormant` field exists to carry.

### Every `.report(` call site in `backend/src` (28), grouped by service

```
grep -rn "\.report(" backend/src | grep -v node_modules
```

| Service | Call sites | Band |
|---|---|---|
| **vlc** (`vlcMprisService.js` + shared `mprisPlayerBase.js`) | `vlcMprisService.js:437` (`_processStateChange`, D-Bus signal auto-recovery) | out-of-band (monitor) |
| | `mprisPlayerBase.js:137` `_setConnected()`, called from `checkConnection()` at `:161/174` | in-band (probe) |
| | `mprisPlayerBase.js:384` `reset()` | out-of-band (reset) |
| | (vlcMprisService also calls the base's `_setConnected(false)` from its ProcessMonitor `exited` handler, `vlcMprisService.js:128`) | out-of-band (process-exit callback) |
| **audio** (`audioRoutingService.js`) | `:159/162` `checkHealth()` (probes `pactl info`) | in-band |
| | `:196` `reset()` | out-of-band |
| **gameclock** (`gameClockService.js` + `systemReset.js`) | `:17` constructor (always-healthy in-process timer) | out-of-band (init) |
| | `:279` `reset()` | out-of-band |
| | `systemReset.js:221` post-reset re-report | out-of-band (system reset) |
| **cueengine** (`cueEngineService.js`) | `:142` `loadCues()` end | out-of-band (event) |
| | `:172` `checkHealth()` | in-band |
| | `:904` `reset()` | out-of-band |
| **lighting** (`lightingService.js`) | `:114/116` `checkConnection()` (HTTP probe to HA REST) | in-band |
| | `:207` WebSocket `auth_ok` handler | out-of-band (socket) |
| | `:254` WebSocket close handler | out-of-band (socket) |
| | `:436` `reset()` | out-of-band |
| **sound** (`soundService.js`) | `:45/48` `checkHealth()` (`which pw-play`) | in-band |
| | `:154` `reset()` | out-of-band |
| **music** (`musicService.js`) | `:232` `_setConnected()`, one report() call site fed by 8 distinct callers: `:104/106` init connect, `:184` reconnect, `:195/208` `checkConnection()` ping | **mixed** — `:195/208` in-band; `:104/106/184/256(timeout)/617(MPD exit)` out-of-band |
| **bluetooth** (`bluetoothService.js`) | `:77/86/96/98/105` `checkHealth()` | in-band |
| | `:478` `reset()` | out-of-band |
| **registry self** | `serviceHealthRegistry.js:157` `reset()` loop | out-of-band (self) |

Count check: vlc 3 + audio 3 + gameclock 3 + cueengine 3 + lighting 5 + sound 3 + music 1 (call site) + bluetooth 6 + registry-self 1 = **28**, matching the grep.

---

## 3. `system:reset` path

`backend/src/services/systemReset.js`, `performSystemReset(io, services)`. Ordered sequence (comments in the file are the section numbers quoted):

1. **Archive session** (`:57-71`) — if `status === 'ended'`, `persistenceService.archiveSession()`; otherwise just warns (active session being reset).
2. **End session lifecycle** (`:74-75`) — `sessionService.endSession()`.
3. **Cleanup infrastructure listeners** (`:77-81`) — `cleanupBroadcastListeners()`, `listenerRegistry.cleanup()`.
4. **Reset all service state** (`:83-134`) — 14 `.reset()` calls in order: `sessionService`, `transactionService`, `videoQueueService`, `offlineQueueService`, then conditionally `displayControlService`, `bluetoothService`, `audioRoutingService`, `lightingService`, `gameClockService`, `cueEngineService`, `soundService`, `vlcService`, `musicService`; `invalidateObserveTokens()` (`:129`); `serviceHealthRegistry.reset()` (`:132`).
   - **`cueEngineService.reset()` clears `disabledCues`** (`cueEngineService.js:61`, inside the shared `_reset()` the constructor also calls) — the dormancy-disable Set (once it exists) and the GM-toggle Set (today, ONE Set) are wiped together, with nothing re-populating them.
   - `disabledCues` is **not** touched directly by `systemReset.js` — only transitively via `cueEngineService.reset()`.
5. **Re-initialize infrastructure** (`:136-211`) — `setupBroadcastListeners()`; then the "centralized cross-service listener wiring": `transactionService.registerSessionListener()`, `sessionService.setupScoreListeners/PersistenceListeners/GameClockListeners()`, `cueEngineWiring.setupCueEngineForwarding()` (`:168-180`, only if `cueEngineService && gameClockService`); `displayControlService.init()` (`:188-194`, ordering-critical per the comment — must run after cue-engine forwarding); ducking rules re-loaded from `config/environment/routing.json` (`:197-209`).
6. **Re-initialize service availability** (`:213-276`) — re-reports `gameclock` healthy (`:221`); re-probes `sound.checkHealth()`, reloads cues via `packService.getCues()` (`:236` — **the only `packService` touch in this entire file**) then `cueEngineService.checkHealth()` implicitly via `loadCues()`; re-inits `bluetoothService`, `audioRoutingService`, `lightingService`; re-checks + restarts VLC's playback monitor.
7. **Restart health revalidation** (`:279-286`) — `serviceHealthRegistry.startRevalidation({vlc, music, sound, bluetooth, audio, lighting}, 15000)`.

**`profileService` is never referenced in `systemReset.js`** (`grep -n "profileService" backend/src/services/systemReset.js` → no hits) and **`packService` is touched exactly once**, for `getCues()` (`:236`) — no `activatePack()` call. Confirms the design's M2 premise still holds on `main`: a `system:reset` re-loads the frozen pack's cues but never re-activates the pack or re-loads the profile; any dormancy/preflight state built on top of pack+profile is wiped by `serviceHealthRegistry.reset()` and never rebuilt (no feed exists yet to rebuild it — see §1's confirmation that the registry has no `dormant` concept at all today).

---

## 4. The `disabledCues` seam

`backend/src/services/cueEngineService.js` — every site (13):

| Line | What it does |
|---|---|
| `:61` | `this.disabledCues = new Set()` — inside `_reset()` (shared by constructor and `reset()`) |
| `:154` | `getState()` includes `disabledCues: this.getDisabledCues()` |
| `:167` | `getDisabledCues()` → `Array.from(this.disabledCues)` |
| `:192` | `getCueSummaries()`: `enabled: !this.disabledCues.has(cue.id)` |
| `:223` | `enableCue(cueId)`: `this.disabledCues.delete(cueId)`, emits `cue:status` `{state:'enabled'}` — **no distinction between a GM re-enable and a would-be dormancy re-enable; there is only one Set** |
| `:229` | `disableCue(cueId)`: `this.disabledCues.add(cueId)`, emits `cue:status` `{state:'disabled'}` |
| `:256` | `findMatchingEventCues(this.cues, this.disabledCues, ...)` — event-triggered standing cue match |
| `:272` | same, second call site (duplicate event-dispatch loop) |
| `:290` | `findMatchingClockCues(this.cues, this.disabledCues, ...)` — clock-triggered standing cue match |
| `:505` | `fireCue()`: `if (this.disabledCues.has(cueId)) { logger.info(...); return; }` — **silent no-op, no error, no return value carrying a reason** |
| `:848` | `standingToPersistence(this.firedClockCues, this.disabledCues, this.active)` — E1 persistence write |
| `:867` | `this.disabledCues = state.disabledCues` — E1 restore |
| `:873` | debug log includes `disabledCues: this.disabledCues.size` |

`backend/src/services/cue/standingEvaluator.js` — every site (12), **not fully covered by the dependency audit's own `:150-192` citation** (see final message):

| Line | What it does |
|---|---|
| `:150` | `findMatchingEventCues(cues, disabledCues, eventName, rawPayload)` signature |
| `:157` | `if (disabledCues.has(cue.id)) continue;` inside that function |
| `:187` | `findMatchingClockCues(cues, disabledCues, firedClockCues, elapsedSeconds)` signature |
| `:192` | `if (disabledCues.has(cue.id)) continue;` inside that function |
| `:226` | JSDoc param for `toPersistence` |
| `:230` | `toPersistence(firedClockCues, disabledCues, active)` |
| `:233` | `disabledCues: Array.from(disabledCues)` in the persisted shape |
| `:243` | JSDoc return type for `fromPersistence` |
| `:247` | `fromPersistence(null-ish snapshot)` → `{..., disabledCues: new Set(), ...}` |
| `:251` | `fromPersistence(snapshot)` → `disabledCues: new Set(snapshot.disabledCues || [])` |

**`fireCue()` return value** (`cueEngineService.js:501-508`): `async fireCue(cueId, trigger, parentChain, source='cue')` — on a disabled cue it logs and `return;`s **`undefined`**. No error object, no `{success:false, reason}` shape.

**`commandExecutor`'s `cue:fire` ack** (`commandExecutor.js:622-633`): calls `await cueEngineService.fireCue(...)`, then **unconditionally** sets `resultMessage = 'Cue fired: ${payload.cueId}'` regardless of `fireCue`'s (discarded) return value — a disabled-cue fire still acks success to the GM. Confirms the design's M3 finding is unfixed on `main`.

**`cue:enable` / `cue:disable` handling** (`commandExecutor.js:635-651`): both cases call `cueEngineService.enableCue()`/`disableCue()` unconditionally — no check for *why* a cue is disabled (there is no provenance to check; see M4).

---

## 5. `SERVICE_DEPENDENCIES`

`backend/src/services/commandExecutor.js:37-70` — **29 entries** (verified: `sed`-extracted block, counted `^\s*'[a-z]` lines):

```
video:play/pause/stop/skip/seek/queue:add → vlc   (6)
display:idle-loop → vlc                            (1)
sound:play/stop → sound                            (2)
lighting:scene:activate/scenes:refresh → lighting  (2)
bluetooth:pair/unpair/connect/disconnect/scan:start/scan:stop → bluetooth (6)
audio:route:set/volume:set → audio                 (2)
music:play/pause/stop/next/previous/setVolume/setShuffle/setLoop/loadPlaylist/seek → music (10)
```
Deliberately ungated (comments at `:44-47`): `video:queue:reorder`, `video:queue:clear` (pure queue ops), `service:check` (health probe bypasses the gate).

**Rejection wording** (`:178-187`): single template for both callers of the gate —
```js
message: `${requiredService} is ${status}: ${message}`
```
No dormant branch exists; `status` can only ever be `'healthy'`/`'down'` today.

**`validateCommand(action, payload)`** (`:912-958`): (1) service-health check via `SERVICE_DEPENDENCIES` + `registry.isHealthy()`; (2) resource-existence switch for `sound:play` (file), `video:queue:add` (file), `lighting:scene:activate` (scene, with the same role→scene normalization `executeCommand` uses), `audio:route:set` (sink), `music:loadPlaylist` (playlist). Returns `{valid, errors[]}`.

**Every caller of `validateCommand`:**
```
grep -rn "validateCommand" backend/src backend/tests backend/scripts
```
→ **zero production callers.** Every hit outside the definition/export line is in `backend/tests/unit/services/commandExecutor.test.js` (24 call sites). Confirms the design's premise ("EXPORTED WITH NO PRODUCTION CALLER") is unchanged on `main`.

---

## 6. Holds

`backend/src/services/heldItemsStore.js` — public API (class `HeldItemsStore`, not a singleton — cue engine and video queue each hold their own instance):

| Member | Line |
|---|---|
| `constructor()` | `:38-47` |
| `holdItem({type, cueId?, trigger?, parentChain?, blockedBy=[], reason='service_down', tokenId?, videoFile?, requestedBy?, queueItemId?, ...extras})` | `:65-108` |
| `getAll()` | `:114-116` |
| `getByType(type)` | `:123-125` |
| `find(heldId)` | `:132-134` |
| `release(heldId)` | `:142-151` |
| `discard(heldId)` | `:159-168` |
| `releaseAll(releaseFn)` | `:180-199` — try-all, never aborts on first failure (F-SHOW-16) |
| `discardAll()` | `:204-209` |
| `clear()` | `:214-220` — clears timers + items, no status change (reset path) |
| `setAutoDiscard(heldId, discardFn, delayMs)` | `:231-242` |
| `_clearTimer(heldId)` | `:248-253` |
| `reset()` | `:258-260` → `clear()` |

**Every caller of `setAutoDiscard`** (there is no `registerAutoDiscard` anywhere in the tree — that name does not exist; only `setAutoDiscard`):
```
grep -rn "setAutoDiscard\|registerAutoDiscard" backend/src backend/tests
```
→ **exactly one production caller**: `cueEngineService.js:632`, inside `_startCompoundCue()`'s **`video_busy`** branch only (`:614-641`) — a 10s timer that auto-discards the held cue. The **`service_down`** hold path (`cueEngineService.js:542-553`, inside `fireCue()`) calls `holdItem({..., reason:'service_down'})` and registers **no timer** — it holds forever until GM action, confirmed unchanged.

**`videoQueueService`'s own hold list:** does **not** use `HeldItemsStore` at all — a separate `this._heldVideos = []` array (`:26`), populated by `_holdVideo(queueItem, reason)` (`:885-903`, called at `:106` for `service_down`), read by `getHeldVideos()`, released/discarded at `:912-928`. **No `setAutoDiscard`/timer usage anywhere in this file** (`grep -n "setAutoDiscard" backend/src/services/videoQueueService.js` → no hits) — no expiry mechanism exists; the only place `_heldVideos` is cleared is `reset()` (`:1021-1035`, called only from `systemReset.js:87`, i.e. a full system reset, never a session end).

**What session end does to holds:** `sessionService.endSession()` (`:454-...`) stops the game clock and suspends the cue engine but **does not call `videoQueueService.reset()`, `cueEngineService.reset()`, or touch either hold store**. Confirmed by `grep -n "videoQueueService.reset\|cueEngineService.reset" backend/src/services/sessionService.js` → no hits. **Holds survive a session end today** — the design's "fault holds expire at session end" policy has no implementation yet.

---

## 7. Prior-art supervision

`backend/src/utils/processMonitor.js` (`ProcessMonitor` class, 221 lines) — used by 5 spawn sites:
```
grep -rn "new ProcessMonitor(" backend/src
```
→ `vlcMprisService.js:113` (VLC), `audioRoutingService.js:789` (pactl subscribe monitor), `musicService.js:603` (MPD), `bluetoothService.js:497` (BlueZ D-Bus device monitor), `mprisPlayerBase.js:205` (generic MPRIS playback monitor, base class for VLC/others).

| Property | Shape |
|---|---|
| Bounded attempts | `maxFailures` default 5 (`:17`); on exceed, emits `gave-up` and **stops retrying** (`:141-145`) — the only escalation signal, purely event-based, no caller wires it to a GM-visible verb today |
| Backoff | `restartDelay * backoffMultiplier ** failures` (`:149`); defaults `restartDelay=5000, backoffMultiplier=2` (real exponential growth) |
| Flap detection | **None as a distinct concept.** The failure counter resets to 0 whenever the child emitted ANY stdout/stderr data before exiting (`receivedData`, `:97-121,136-138`) — a process that always logs one line before crashing (VLC's "not supposed to run as root" case, per the CS.1 audit) never trips `maxFailures`, defeating the cap |
| PID files | One per monitored process (`_writePidFile`/`_killOrphan`/`_removePidFile`, `:180-212`); orphan recovery verifies `/proc/PID/cmdline` before SIGTERM |
| Escalation | `gave-up` event only; no built-in health-registry or GM-facing wiring inside `processMonitor.js` itself — callers decide |

**vlcMprisService + `VLC_SELF_SPAWN`:** `config.features.vlcSelfSpawn` (`backend/src/config/index.js:98`, `process.env.VLC_SELF_SPAWN !== 'false'`, default true). When true, `vlcMprisService.js:111-131` builds its own `ProcessMonitor({command:'cvlc', ..., restartDelay:3000, backoffMultiplier:1})` — a **flat 3s retry, no backoff growth** (comment at `:121` says so explicitly), `maxFailures` left at the default 5. Because VLC writes to stderr before dying, `receivedData` is almost always true → the failure counter never accumulates → the 13-restarts-in-40s root boot loop (recorded in the design doc's CS.1 audit) is explained by this exact interaction, still present in the code. `exited` handler at `:126-130` calls `this._setConnected(false)`.

**musicService MPD spawn:** `musicService.js:603-608` — `new ProcessMonitor({command:'mpd', args:['--no-daemon', configFile], label:'mpd', pidFile:'/tmp/aln-pm-mpd.pid'})` — **no overrides**, so it gets the real default exponential backoff (5000ms × 2^n) and `maxFailures=5`, unlike VLC's flat retry.

**displayDriver Chromium spawn:** `backend/src/utils/displayDriver.js` — **does not use `ProcessMonitor` at all.** `_doLaunch()` spawns Chromium directly (`:147-166`), writes a PID file for orphan recovery only, and on `'error'`/`'exit'` (`:168-178`) just logs, nulls `browserProcess`, sets `visible=false` — **no restart is attempted**, no bound, no backoff, no health-registry integration (Chromium/scoreboard is not one of the 8 registry services). This is a genuine supervision gap, not merely an unbounded one.

**lightingService HA container lifecycle:** `_ensureContainer()`-style logic at `:445-479` — one-shot at `init()`: checks `containerExists`/`isContainerRunning` via `dockerHelper.js`, starts it once if needed (tracked by `this._containerStartedByUs`), stops it on cleanup. **No ongoing supervision of the container itself** — if the HA container dies mid-show, nothing restarts it. Separately, the HA **WebSocket** has its own reconnect loop (`_startReconnect`, `:500-513`): linear backoff `min(5000 * attempts, 30000)`ms, **unbounded attempts, no flap detection, no escalation** — a different shape again from `ProcessMonitor`'s.

**Summary of shapes found (four different supervision patterns already in the codebase, none of them C3's target shape):** ProcessMonitor (bounded-by-count but flap-vulnerable, real backoff unless overridden), lightingService WS reconnect (unbounded, linear-capped, no escalation), lightingService Docker container (one-shot, no ongoing supervision), displayDriver Chromium (no supervision at all).

---

## 8. `session:start`

`commandExecutor.js:217-222`, `case 'session:start'`: calls `await sessionService.startGame()`, sets `resultMessage='Game started'`. **No pre-check, no gate, no override in commandExecutor.**

`sessionService.startGame()` (`:258-...`):
```js
if (!this.currentSession) throw new Error('No session to start');
if (this.currentSession.status !== 'setup')
  throw new Error(`Cannot start game: session is in "${status}" state (expected "setup")`);
```
That status check is the **only** gate today. After it passes: `session.start()`, `gameStartTime` stamped, `packService.getClockRules()` read for overtime/phases, `gameClockService.start()`, `cueEngineService.activate()`. **No health check, no dormancy check, no preflight call, no override mechanism of any kind** — the seam R-C3-1's require-gate ("`session:start` refuses while any `onAbsent: require` need is unresolved, with a typed, logged override") would attach is this exact spot: between the status check and `session.start()`.

---

## 9. `packHash` self-heal anchors

**`backend/src/websocket/socketServer.js`:** `packHash` captured at handshake destructure (`:50`), stored on the socket (`:127`), logged (`:133`). The mismatch check (`:139-148`):
```js
if (packHash) {
  const activePack = require('../services/packService').getActivePackInfo();
  if (activePack && packHash !== activePack.contentHash) {
    logger.warn('GM client pack MISMATCH: ...');
  }
}
```
— **loud warn only; connection proceeds unconditionally** (`next()` at `:152`). No refusal, no re-handshake, no self-heal trigger exists here today.

**`ALNScanner/src/network/orchestratorClient.js:101`:** `packHash: packLoader.getActivePack()?.contentHash ?? null` — sent once, at connect-time handshake construction. No re-send on pack change observed in this file (not searched further; out of the cited anchor's scope).

**`ALNScanner/src/core/packLoader.js` public API** (non-underscore members):
```
constructor({...})   :81
getActivePack()       :100
channel()             :109
loadPack()            :130   (async)
```
No `refresh()` method exists anywhere in the class — the R-C2-1 self-heal action ("fetch the connected orchestrator's current pack, apply, re-handshake") has **no code anchor yet**; only the passive mismatch-warn (above) and the load-once `loadPack()` exist.

**`ALNScanner/src/network/connectionManager.js` reconnect path:** handles Socket.io-level reconnect (auto-reconnect on unexpected server-initiated disconnects, `:227-297`, cancellable retry timer, ±20% jitter) — this is transport reconnection, not pack reconciliation; it never calls into `packLoader`.

**The two named ROADMAP §8.5 tests** ("packLoader behavioral timeout"; "staging-cache race"):
```
find ALNScanner/tests -iname "*packLoader*"
grep -n -i "staging.cache\|behavioral timeout\|staging-cache race" ALNScanner/tests/unit/core/packLoader.test.js
```
→ one file exists, `tests/unit/core/packLoader.test.js`, but it contains **neither named test**. The one hit found is an incidental comment ("`:221` ... 'activate' an empty staging cache, GC the good pack, and strand the ...") describing a *different* scenario in passing, not a dedicated race test. The nearest thing to a timeout test is `:199`, `'every network fetch carries a timeout signal — a hung server cannot stall fail-hard startup (PR #12 review)'`, which asserts the abort-signal wiring exists — it does not simulate an actual hang and assert fail-hard *behavior*. **Both named tests are absent** — confirmed still owed, exactly as ROADMAP §8.5 records ("follows the hardening block... the two tests land with that work").

---

## 10. Preflight protos

- **`validateCommand` resource checks** — covered in §5; unchanged, no production caller.
- **`packService` staleness compare** — `getManifest()` (`backend/src/services/packService.js:1254-1269`): once activated, compares the live on-disk manifest's `contentHash` against the frozen `activeManifest.contentHash` on every call; logs a one-shot warn (`warnedDriftHash` latch) on mismatch, clears the latch when they match again. This is the entirety of "the C1 preflight" today — pure contentHash compare, no resource/host/network checks.
- **`backend/scripts/check-health.sh`** — **exists** (`backend/scripts/check-health.sh`, 4696 bytes, executable).
- **`backend/scripts/preflight.js`** — **does not exist**:
  ```
  ls backend/scripts | grep -i preflight   →  (no output; check-health.sh is the only health/preflight-named script)
  ```
- **`backend/src/gameRules/packNeeds.js`** (`collectPackNeeds(pack)`) need kinds implemented (8): `service`, `endpoint`, `lighting-role`, `surface-channel`, `capability`, `sound`, `lighting-role-ref`, `device-class`. **No `video-file` kind** — `grep -n "video-file" backend/src/gameRules/packNeeds.js` → no hits. CS.1's own execution record (design doc `:522-526`) named this as an owed carryover; still open.
- **`backend/src/gameRules/resolution.js`** exported API: `module.exports = { resolve }` only (`:202`) — `resolve(needs, profile, inventory={})` → `{verdicts, rollup}`. `resolveOne()` and `rollUp()` are internal (not exported). Rollup shape (`rollUp()`, `:182-200`): **`{status, dormantServices, problems}`** — no `disabledCueIds` key. `resolveOne` handles `lighting-role`, `endpoint`, `device-class`, `surface-channel`, `sound`, `service`, `capability`, `lighting-role-ref`, plus a `default` fall-through (`'runs'/'paper'/'not yet resolved'`) — **no `video-file` case either**, consistent with the gap above.
- **CS.1 carry-overs:**
  - **`disabledCueIds` in the rollup** — **open**, deliberately: the code comment at `resolution.js:178-180` explains it is deferred to C3's session-start disable walk to avoid duplicating that mechanism. Confirmed absent from `rollUp()`'s return shape.
  - **A video-file need kind** — **open**, confirmed absent from both `packNeeds.js` and `resolution.js` as shown above.

---

## 11. Contract sites

Every health-status enum in the two contract files, with **current** line numbers (re-verified, not copied):

| File:line | Schema | Enum |
|---|---|---|
| `backend/contracts/asyncapi.yaml:664` | `sync:full`'s `serviceHealth[*].status` | `[healthy, down]` |
| `backend/contracts/asyncapi.yaml:2597` | `DomainStateHealth` (the `service:state` domain=`health` push) | `[healthy, degraded, down]` — **the skew; `degraded` is never emitted anywhere in `backend/src`** (§1) |
| `backend/contracts/openapi.yaml:2005` | `GameState`'s `serviceHealth[*].status` | `[healthy, down]` |

(The design doc and dependency audit cite `openapi.yaml:1998` for this third site — it has since drifted to `:2005`, a +7 line shift; see the final message.)

**Scanner contract cross-check test:** `backend/tests/contract/scanner/client-contract-conformance.test.js` — exists, but checking its content (`grep -n "healthy\|down\|degraded\|dormant\|MESSAGE_TYPES"`) shows it cross-checks `MESSAGE_TYPES` (event-name coverage, server→client subscribe set) only. **It asserts nothing about health-status enum values** — there is no automated cross-check today that the three enum sites above agree with each other or with `serviceHealthRegistry.js`'s validator.

**`sync:full` `serviceHealth` schema:** `asyncapi.yaml:652-668` — `additionalProperties` object, `required: [status, message]`, `properties: {status: {enum:[healthy,down]}, message: string, lastChecked: date-time|nullable}`. Matches `getSnapshot()`'s actual shape exactly (§2) except for the missing `dormant` enum member.

---

## 12. Renderers and helpers

**`ALNScanner/src/ui/renderers/HealthRenderer.js`** — every health-status comparison (3, matching §1's grep exactly):
- `:48` — `healthyCount = statuses.filter(s => s.status === 'healthy').length`
- `:83` — `isDown = s.status !== 'healthy'` (full-rebuild path, `_buildDOM`)
- `:136` — `isDown = s.status !== 'healthy'` (differential-update path, `_updateDOM`)

**Collapse rule** (`:50`): `mode = healthyCount === totalCount ? 'collapsed' : 'expanded'` — a binary "all healthy vs anything else" test over the fixed 8-service list (`SERVICE_NAMES`, `:15-24`). A `dormant` status (once it exists) would count as not-healthy exactly like `down` does today, keeping the dashboard permanently expanded — the "always red" failure the design describes, still fully reproducible on `main`.

**`ALNScanner/src/ui/renderers/HeldItemsRenderer.js`** — `grep -n "healthy\|status ===" ALNScanner/src/ui/renderers/HeldItemsRenderer.js` → **no hits**. This renderer has no health-status comparisons of its own (it renders held-item records, not service health).

**`backend/tests/e2e/helpers/capabilities.js`** — one status read, `:61`: `caps[key] = health[key]?.status === 'healthy'` inside `getCapabilities()`, over `CAPABILITY_KEYS = ['vlc','sound','music','bluetooth','audio','lighting']` (`:30`). Matches the design's S5 finding exactly and unchanged: a `dormant` status would silently read as `capability = false`, identical to a genuine fault, with no separate "deliberately absent" capability state.

---

## 13. Fix-vehicle deferrals to Block 2

Source: `docs/plans/2026-09-05-train-fix-vehicle.md` §2.1 ("→ Block 2, the hardening block") and §2.2 ("→ Block 2's close — the test-hardening & contract-truth sweep").

**Important census finding, stated up front:** §2.2's item ids trace back to an input document, `docs/plans/2026-09-05-whole-train-review.md` (cited at the fix-vehicle doc's own `:8`, "the whole-train review"), which **does not exist anywhere in this tree or in git history**:
```
find . -iname "*whole-train-review*"        → (no output)
git log --all --oneline -- '*whole-train-review*'  → (no output)
grep -rln "S2-2\|F-P8a-1\|P9b-2\b" --include='*.md' .   → only 2026-09-05-train-fix-vehicle.md itself, line 169-170
```
23 of the 32 item ids below (all of §2.2 except `P1-observation`) therefore have **no recoverable one-line meaning anywhere in the tree** beyond their bare id and category header ("Test quality" / "Contract truth"). This is reported honestly below rather than guessed.

### §2.1 → Block 2 open scope (9 ids)

| id | one-line meaning (quoted from the fix-vehicle doc) | current code state on `main` |
|---|---|---|
| **P4-2** | the read-plane credential posture: "any non-`gm` deviceType connects tokenless and reads full game state; the observe token exists for exactly this surface" | Confirmed present: `backend/src/websocket/socketServer.js:53` — `if (deviceType === 'gm') { ...require token... }` is the **entire** JWT gate; any other/absent `deviceType` skips it and reaches `next()` (`:152`) with `socket.isAuthenticated` unset. Downstream read-plane events are not separately gated in this file. Unchanged; deliberate per the doc. |
| **LC-3** | (same bullet as P4-2 — the standing posture is one item, two ids) | same anchor as above |
| **F-P2-3** | "manifest-builder symlink divergence + the symlinked inventory serving files from outside the pack dir" | **No confirmed anchor.** Only two symlinks exist in the tree at all: `backend/public/gm-scanner → ../../ALNScanner/dist` and `backend/public/player-scanner → ...` (both intentional dist-serving symlinks per CLAUDE.md, unrelated to pack inventory). `backend/scripts/build-pack-manifest.js`'s first 50 lines have no symlink-handling code. Cannot confirm the described defect's location without the source review — recorded as **no code anchor found by this search**. |
| **F-P2-7** | "content-edit-without-manifest-rebuild detection (the drift warn compares manifest-to-manifest only)" | Confirmed: `packService.js`'s `getManifest()` (`:1254-1269`) compares `contentHash` values only (manifest-to-manifest) — it cannot detect an edited pack FILE whose manifest was never rebuilt to reflect the edit. Unchanged. |
| **F-P2-8** | "surfacing the active profile's identity (rides the preflight instrument, which reports profile identity anyway)" | Confirmed open: `grep -n "profileId" backend/src/routes/healthRoutes.js backend/src/websocket/syncHelpers.js` → no hits. Profile identity is not surfaced in `/health` or `sync:full` today. |
| **LC-6** | "workflow `permissions:` blocks, action SHA-pins, concurrency guard" | Confirmed open (partially): all 3 workflow files (`capability-probe.yml`, `rung1.yml`, `test.yml`) lack a `permissions:` block; every `uses:` line pins to a version tag (`@v4`/`@v5`), never a commit SHA. Concurrency guard **already exists** in 2 of 3 (`rung1.yml`, `test.yml`) but not `capability-probe.yml`. |
| **P9b-9** | (same bullet as LC-6) | same anchor |
| **P9b-4** | "rung-1 hygiene (placeholder media in tree...)" | `backend/tests/rung1/generate-fixtures.js` generates placeholder media at harness-run time (`:90-137`), not committed to git — `git ls-files | grep -i rung1 | grep -iE '\.mp4$\|\.wav$\|\.bmp$'` → no tracked placeholder media files. Could not reproduce a "placeholder media left in tree" defect from a static read; may refer to a runtime artifact left after a harness run rather than a git-tracked file. |
| **P9b-8** | "...HA token + world-writable bus left in /tmp" | `backend/tests/rung1/up.sh` uses `chmod 700` (restrictive) for its XDG runtime dir (`:43`) — no `chmod 777`/world-writable pattern found in `up.sh`/`down.sh`. Could not reproduce the described defect from a static read of these two scripts; may require an actual harness run to observe the artifact. |

### §2.2 → Block 2's close (23 ids)

**Test quality** (15 ids — `S2-2, S2-3, S2-4, WE-4, F-P8a-1, F-P8a-3, F-P8b-1, F-P8b-3, F-P8b-4, F-P8b-5, F-P9a-1, F-P9a-2, F-P9a-3, P9b-2, P9b-6`) and **contract truth** (8 ids — `P4-5, P4-6, P4-7, LA-6, WE-2, LA-7, LA-8, P1-observation`):

| id | one-line meaning | current code state on `main` |
|---|---|---|
| S2-2, S2-3, S2-4, WE-4, F-P8a-1, F-P8a-3, F-P8b-1, F-P8b-3, F-P8b-4, F-P8b-5, F-P9a-1, F-P9a-2, F-P9a-3, P9b-2, P9b-6, P4-5, P4-6, P4-7, LA-6, WE-2, LA-7, LA-8 | **not documented beyond the id in this tree** — the source finding document (`docs/plans/2026-09-05-whole-train-review.md`) does not exist in the checkout or git history; no other file in the tree glosses these ids | **no code anchor determinable** — without the original finding text, a search cannot responsibly claim a specific file:line represents "the" fix target; guessing would misprice Block 2's close gate |
| P1-observation | "the dead `allTeamScores` field" | Confirmed and precisely located: `transactionService.js:737` computes `allTeamScores: (this._getSessionScores() || []).map(ts => ts.toJSON())` on **every** `transaction:deleted` emit (a full map over every team, wastefully, on each deletion) — but `broadcasts.js:257-262` builds its outbound WS payload from only `{transactionId, teamId, tokenId, updatedTeamScore}`, dropping `allTeamScores` before it ever reaches a client. `grep -rn "allTeamScores" backend/contracts ALNScanner/src aln-memory-scanner` → zero hits — never documented, never consumed. Genuinely dead computation, confirmed. |

---

## 14. Counts table

| Step | Verified count | Grep that verified it |
|---|---|---|
| 1 | 66 (`healthy` 36, `down` 23, `degraded` 0, `dormant` 7) | `for lit in healthy down degraded dormant; do grep -rn "['\"]$lit['\"]" backend/src backend/contracts backend/tests/e2e/helpers backend/tests/rung1 backend/scripts ALNScanner/src config-tool/lib config-tool/public/js 2>/dev/null | grep -v -E '/(node_modules|dist)/'; done` |
| 2 | 28 `.report(` call sites in `backend/src` | `grep -rn "\.report(" backend/src \| grep -v node_modules` |
| 3 | 14 `.reset()` invocations inside `performSystemReset()` (excl. 7 comment mentions) | `grep -n "\.reset(" backend/src/services/systemReset.js` |
| 4 | 13 `disabledCues` sites in `cueEngineService.js` + 12 in `cue/standingEvaluator.js` = 25 | `grep -c "disabledCues" backend/src/services/cueEngineService.js backend/src/services/cue/standingEvaluator.js` |
| 5 | 29 `SERVICE_DEPENDENCIES` entries; 0 production callers of `validateCommand` | `sed -n '/^const SERVICE_DEPENDENCIES = {/,/^};/p' backend/src/services/commandExecutor.js \| grep -E "^\s*'[a-z]" \| wc -l` and `grep -rn "validateCommand" backend/src backend/tests backend/scripts` |
| 6 | 4 total `setAutoDiscard` occurrences (1 definition, 1 production caller, 2 test calls); 1 production caller | `grep -rn "setAutoDiscard\|registerAutoDiscard" backend/src backend/tests \| grep -v node_modules` |
| 7 | 5 `new ProcessMonitor(` spawn sites | `grep -rn "new ProcessMonitor(" backend/src \| grep -v node_modules` |
| 8 | 1 gate (the `status !== 'setup'` check); 0 dormancy/health/override gates | `grep -n "async startGame" -A 10 backend/src/services/sessionService.js` |
| 9 | `packHash`: 6 occurrences in `socketServer.js`, 1 in `orchestratorClient.js`; 0 of 2 named ROADMAP §8.5 tests present | `grep -c "packHash" backend/src/websocket/socketServer.js ALNScanner/src/network/orchestratorClient.js`; `grep -n -i "staging.cache\|behavioral timeout\|staging-cache race" ALNScanner/tests/unit/core/packLoader.test.js` |
| 10 | 8 need kinds implemented in `packNeeds.js`; 0 `video-file` kind; `preflight.js` absent, `check-health.sh` present | `grep -n "kind: '" backend/src/gameRules/packNeeds.js \| sort -u`; `ls backend/scripts \| grep -i preflight` |
| 11 | 3 contract enum sites (`asyncapi.yaml:664`, `asyncapi.yaml:2597`, `openapi.yaml:2005`) | `grep -n "enum: \[healthy" backend/contracts/asyncapi.yaml backend/contracts/openapi.yaml` |
| 12 | 3 comparisons in `HealthRenderer.js`; 0 in `HeldItemsRenderer.js`; 1 in `capabilities.js` | `grep -c "'healthy'" ALNScanner/src/ui/renderers/HealthRenderer.js`; `grep -n "healthy\|status ===" ALNScanner/src/ui/renderers/HeldItemsRenderer.js` |
| 13 | 32 total deferred item ids (9 in §2.1, 23 in §2.2); 23 with no recoverable meaning in the tree | `sed -n '145,172p' docs/plans/2026-09-05-train-fix-vehicle.md` (manual id enumeration off the printed §2.1/§2.2 text — ids are prose-listed, not grep-countable as a pattern); source-doc absence confirmed via `find . -iname "*whole-train-review*"` and `git log --all --oneline -- '*whole-train-review*'` (both empty) |
