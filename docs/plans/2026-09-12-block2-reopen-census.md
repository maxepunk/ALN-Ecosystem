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

**Census finding, updated:** §2.2's item ids trace back to an input document, `docs/plans/2026-09-05-whole-train-review.md` (cited at the fix-vehicle doc's own `:8`, "the whole-train review"). At the time this census was first drafted it **did not exist anywhere in this tree or in git history**:
```
find . -iname "*whole-train-review*"        → (no output, at first draft)
git log --all --oneline -- '*whole-train-review*'  → (no output, at first draft)
```
**It has since been copied into the tree from branch `claude/whole-train-review`** (`docs/plans/2026-09-05-whole-train-review.md`, 501 lines: §1 findings by severity, §2 cleared, Appendix A the NOTE-level table). All 32 item ids below are now sourced from it directly, each with its exact citation line, re-verified against `main` below. Three rows (`F-P2-3`, `P9b-4`, `P9b-8`) in §2.1's table below were originally marked "no confirmed anchor" before the document arrived — they are corrected in place. One data-quality note carries forward: several of the review's own table cells (Appendix A, its "Finding" column) are themselves truncated mid-sentence as committed — quoted verbatim below, truncation and all, rather than guessed at.

### §2.1 → Block 2 open scope (9 ids)

| id | one-line meaning (quoted from the fix-vehicle doc) | current code state on `main` |
|---|---|---|
| **P4-2** | the read-plane credential posture: "any non-`gm` deviceType connects tokenless and reads full game state; the observe token exists for exactly this surface" | Confirmed present: `backend/src/websocket/socketServer.js:53` — `if (deviceType === 'gm') { ...require token... }` is the **entire** JWT gate; any other/absent `deviceType` skips it and reaches `next()` (`:152`) with `socket.isAuthenticated` unset. Downstream read-plane events are not separately gated in this file. Unchanged; deliberate per the doc. |
| **LC-3** | (same bullet as P4-2 — the standing posture is one item, two ids) | same anchor as above |
| **F-P2-3** | Now sourced: whole-train-review.md's MINOR table, `:140` (`backend/scripts/build-pack-manifest.js:51-69 (Node walk); scrip[ts/build_pack_manifest.py, Python walk]`) — "The two manifest builders diverge on symlinks (byte-parity claim is false), and resolvePackFile's containment [check does not follow the resolved symlink target]"; fuller prose at `:111`: "the two manifest builders diverge on symlinks, and a Python-built inventory serves a symlinked file from outside the pack directory through `/api/pack/files/`; traversal by path is otherwise solid" | **Confirmed, root-caused.** `backend/scripts/build-pack-manifest.js`'s `walk()` (`:51-69`) uses `fs.readdirSync(dir, {withFileTypes:true})` + `entry.isFile()`/`isDirectory()` on the returned `Dirent` — a symlink's dirent type is neither, so the **Node** walker silently **excludes** symlinked files from the manifest. `scripts/build_pack_manifest.py`'s `_walk()` (`:65-79`) uses `pathlib.Path.is_file()`/`is_dir()`, which **follow symlinks by default** — the **Python** walker **includes** them. `packService.js`'s `resolvePackFile()` (`:1450-1460`) checks only the nominal string path (`abs.startsWith(getPackDir() + path.sep)`) — never `fs.realpathSync` — so a symlink entry the Python builder let into the manifest would pass containment as a path while `fs.readFileSync` on it follows the link to its real target, which may be outside the pack directory. Both mechanisms verified present and unchanged on `main`. |
| **F-P2-7** | "content-edit-without-manifest-rebuild detection (the drift warn compares manifest-to-manifest only)" | Confirmed: `packService.js`'s `getManifest()` (`:1254-1269`) compares `contentHash` values only (manifest-to-manifest) — it cannot detect an edited pack FILE whose manifest was never rebuilt to reflect the edit. Unchanged. |
| **F-P2-8** | "surfacing the active profile's identity (rides the preflight instrument, which reports profile identity anyway)" | Confirmed open: `grep -n "profileId" backend/src/routes/healthRoutes.js backend/src/websocket/syncHelpers.js` → no hits. Profile identity is not surfaced in `/health` or `sync:full` today. |
| **LC-6** | "workflow `permissions:` blocks, action SHA-pins, concurrency guard" | Confirmed open (partially): all 3 workflow files (`capability-probe.yml`, `rung1.yml`, `test.yml`) lack a `permissions:` block; every `uses:` line pins to a version tag (`@v4`/`@v5`), never a commit SHA. Concurrency guard **already exists** in 2 of 3 (`rung1.yml`, `test.yml`) but not `capability-probe.yml`. |
| **P9b-9** | (same bullet as LC-6) | same anchor |
| **P9b-4** | whole-train-review.md Appendix A `:446`: `backend/tests/rung1/generate-fixtures.js:78-107` — "rung-1 writes placeholder show media into the repo tree and nothing removes it" | **Confirmed exactly.** `generate-fixtures.js:90-137` writes placeholder mp4s into `backend/public/videos/` (git-ignored: `.gitignore:10` covers `backend/public/videos/*.mp4`, so this is working-tree hygiene, not a git-tracked leak) and placeholder audio into `backend/public/music/`; `backend/tests/rung1/down.sh` has **zero** references to `videos`/`mp4`/`public` (`grep -n "videos\|mp4\|public" down.sh` → no hits) — confirmed no teardown path removes them. Live evidence: `backend/public/videos/` on this container currently holds a stray `534e2b03.mp4` from a prior harness run, alongside the committed E2E fixtures. Citation line range (`:78-107`) matches current file content. |
| **P9b-8** | whole-train-review.md Appendix A `:448`: `backend/tests/rung1/up.sh:88-90, 163-181` — "rung-1 leaves the Home Assistant token and a world-writable session bus behind in /tmp" | **Confirmed, but the citation has drifted (see final message).** `up.sh` is now only 109 lines (was ≥181 when the review was written) — a comment at `:56-59` explains why: the harness's provisioning logic was extracted into a new shared script, `tests/rung1/provision.js` (818 lines, shared with the E2E suite), after the review. The **HA-token half still matches exactly at the cited lines**: `up.sh:88-90` writes `HOME_ASSISTANT_TOKEN="$HA_TOKEN"` in plaintext into `$RUNG1/env.sh` (default `/tmp/rung1/env.sh`), `chown`'d to the harness user (`:101`) but never `chmod`'d — no permission restriction. The **world-writable-bus half moved**: it's no longer at `up.sh:163-181` (that content doesn't exist there anymore) but is now `provision.js:289` — `fs.chmodSync(socketPath, 0o666)` on the D-Bus session-bus socket, comment "cross-uid best effort" (deliberate, for cross-user access, but still world-writable in effect). Both halves of the finding remain true on `main`; only the second half's location changed. |

### §2.2 → Block 2's close (23 ids)

**Test quality** (15 ids — `S2-2, S2-3, S2-4, WE-4, F-P8a-1, F-P8a-3, F-P8b-1, F-P8b-3, F-P8b-4, F-P8b-5, F-P9a-1, F-P9a-2, F-P9a-3, P9b-2, P9b-6`) and **contract truth** (8 ids — `P4-5, P4-6, P4-7, LA-6, WE-2, LA-7, LA-8, P1-observation`). All 22 non-`P1-observation` ids are sourced from `docs/plans/2026-09-05-whole-train-review.md`, Appendix A ("NOTE-level findings", `:438-500`) — one straight table, `# | Repo | File:line | Finding | Verdict`, all verdicts `SURVIVES` or `SURVIVES-NARROWED`. Quoted meanings below are the Appendix A "Finding" cell verbatim, **including mid-sentence truncation where the source table itself is cut off** (a known data-quality property of that table — flagged, not silently repaired):

| id | one-line meaning (quoted, review line cited) | current code state on `main` |
|---|---|---|
| **P4-5** | review `:442`, `backend/contracts/README.md:50`: "Contracts README HTTP endpoint inventory is stale in both count and list" | File exists (646 lines); `:50` is inside the endpoint-inventory section. Not independently re-counted against the live route table in this pass (out of the per-step budget) — file:line anchor confirmed present and on-topic. |
| **P4-6** | review `:443`, `backend/src/app.js:119-122`: "OpenAPI/Express inventory gap: /scoreboard (the observe-token mint point) is undocumented, and resourceRoutes [...]" | **Confirmed.** `app.js:122` — `app.use('/', resourceRoutes); // GET /scoreboard` — mounted in Express; `backend/src/routes/resourceRoutes.js:225` defines `router.get(['/scoreboard', '/scoreboard.html'], ...)`. `grep -n "^  /scoreboard" backend/contracts/openapi.yaml` → no hits — confirmed undocumented in the contract. Citation range matches exactly. |
| **P4-7** | review `:444`, `backend/src/middleware/auth.js:243-256`: "403 responses emit error code FORBIDDEN, which is outside the documented OpenAPI Error enum (currently unreach[able/ed])" | File exists (370 lines), cited range in bounds. Not independently re-diffed against the OpenAPI `Error` enum in this pass. |
| **P9b-2** | review `:445`, `backend/tests/e2e/helpers/scoring.js:40-56, 116-134`: "Non-scoring pack loaders swallow transport failure into null, so a broken pack channel is green on the product[ion leg]" | **Confirmed exactly.** `_fetchGameJsonField()` (`:40-56`) wraps its HTTPS GET: a non-200 status (`:47`) or a JSON parse throw (`:50-52`) both `resolve(null)` — indistinguishable from "field legitimately absent." A transport-level failure (`.on('error', ...)`, `:55`) does the same. |
| **P9b-6** | review `:447`, `backend/tests/e2e/flows/30-full-game-session-multi-device.test.js:700-726` (filename truncated in the review to `...te`; reconstructed) — "Flow 30's score expectation is read back from the engine's own rendered scoreboard" | File exists (892 lines) at the reconstructed name; cited range in bounds. Not independently re-read for the specific self-referential assertion in this pass. |
| **S2-2** | review `:450`, `ALNScanner/tests/unit/ui/uiManager.test.js:315-320 and 326-331`: "Two uiManager tests cannot fail: toBeDefined() on a DOM lookup that returns null" | **Confirmed exactly.** `:317-319` — `expect(document.querySelector('.toast-info')).toBeDefined()` (and `.toast-error`, `.toast-warning`) — `querySelector` returns `null` on a miss, and `null` passes Jest's `toBeDefined()` (only `undefined` fails it), so the assertion cannot detect a toast that never rendered. |
| **S2-3** | review `:451`, `ALNScanner/tests/app/initializationSteps.test.js:34`: "The segmented-selector pin is a tautology: `?.dataset.arg ?? 'blackmarket'` compared to 'blackmarket'" | File exists (49 lines), `:34` in bounds. Not independently re-read line-for-line in this pass; pattern is plausible given the file's small size and narrow scope. |
| **S2-4** | review `:452`, `ALNScanner/tests/unit/ui/renderers/GameOpsRenderer.rating.test.js:83-95`: "The 'ESCAPE PIN' case is vacuous and its comment over-claims; the load-bearing pin is in GameOpsRenderer.glyph" | **Confirmed, citation off by one line (see final message).** The file is 94 lines; the cited range ends at `:95`, past EOF. The described test (`it('ESCAPE PIN (§4a O1): ...')`) is real, at `:80-93` — content matches, only the trailing line number has drifted. |
| **WE-2** | review `:456`, `backend/contracts/openapi.yaml:/api/assets/manifest` (no line number given, a schema path key): "The `pack` block added to /api/assets/manifest is undocumented in openapi.yaml — contract-first violation, unc[onfirmed against the ESP32 consumer / uncorrected]" | `openapi.yaml:283-303` documents `GET /api/assets/manifest`; not independently checked in this pass for a missing `pack` property in its response schema. Duplicate-merge record (review `:430`) notes `LA-6` and `WE-2` were merged as describing the same hole from two repos' vantage points — see `LA-6` below for the schema-side confirmation. |
| **WE-4** | review `:458`, `backend/tests/contract/scanner/request-schema-validation.test.js:19-63` (filename truncated in the review; reconstructed) — "Scanner request-schema contract test validates hand-copied literals, not scanner payload construction" | File exists (208 lines) at the reconstructed name; cited range in bounds. Consistent with root CLAUDE.md's own description of this file ("validates ... payloads against OpenAPI request schemas using AJV") — the finding's claim is that the *fixture* literals are hand-copied rather than derived from the scanners' own payload-construction code, which this census did not independently re-verify. |
| **LA-6** | review `:462`, `backend/contracts/openapi.yaml:307-361`: "OpenAPI's /api/assets/manifest response schema omits the `pack` field the generator emits and the ESP32 consum[es]" | File exists (2183 lines), cited range in bounds, inside the same `/api/assets/manifest` block as WE-2 above. Not independently re-diffed against `scripts/generate_asset_manifest.py`'s actual output shape in this pass. |
| **LA-7** | review `:463`, `backend/src/websocket/gmAuth.js:178`: "Backend emits gm:identified, which is in no contract and no client, while AsyncAPI says the pattern was replac[ed]" | **Confirmed, citation drifted by 10 lines (see final message).** `gm:identified` is still emitted, at `gmAuth.js:188` (not `:178` — `:178` today sits inside the `sync:full` payload construction a few lines earlier in the same function). `asyncapi.yaml:295` reads literally "This replaces the old gm:identified → sync:full pattern" — the contract's own text says the event should be gone, but the code still sends it. `grep -rn "gm:identified" ALNScanner/src` → no hits — confirmed no client consumer (also absent from `orchestratorClient.js`'s `MESSAGE_TYPES` list per root CLAUDE.md). |
| **LA-8** | review `:464`, `backend/src/routes/resourceRoutes.js:225`: "GET /scoreboard and /scoreboard.html are served endpoints with no entry in openapi.yaml" | **Confirmed exactly, no drift.** `resourceRoutes.js:225` — `router.get(['/scoreboard', '/scoreboard.html'], (req, res) => {...})` — line matches precisely. `grep -n "^  /scoreboard" backend/contracts/openapi.yaml` → no hits. |
| **F-P8a-1** | review `:481`, `backend/tests/unit/services/tokenService.test.js:16, 90-98`: "Two tautological multiplier assertions in tokenService.test.js" | **Confirmed.** `:16` defines `calcExpected = (rating, type) => tokenService.calculateTokenValue(rating, type)` (production function, not a hardcoded oracle); `:92-93` — `calculateTokenValue(2, 'Mention')` is asserted `toBe(calcExpected(2, 'Business'))`, i.e. production-vs-production under a different type argument that happens to share the same multiplier — the assertion cannot catch a bug that mis-maps `Mention`'s multiplier specifically. Same pattern at `:96-97` for Party/Technical. |
| **F-P8a-3** | review `:483`, `backend/tests/unit/services/packService.test.js:256, 1289`: "Two test titles overstate what their bodies test" | File exists (1995 lines), both line numbers in bounds. Not independently re-read for the title/body mismatch in this pass. |
| **F-P8b-1** | review `:484`, `backend/tests/unit/utils/fontSelfHosting.test.js:11-12,23`: "L11 font-CDN tripwire states a repo-wide invariant that is false on the tip and is scoped to never see the cou[nter-example]" | File exists (81 lines), cited lines in bounds. Not independently re-read in this pass. |
| **F-P8b-3** | review `:486`, `backend/tests/unit/services/displayControlService.test.js:245-246`: "The pack scoreboard-opt-out test stubs the method under test, so the real _scoreboardEnabled() opt-out branch [is never exercised]" | File exists (627 lines), cited range in bounds. Not independently re-read for the stubbing pattern in this pass. |
| **F-P8b-4** | review `:487`, `backend/tests/unit/services/lightingRoleTripwire.test.js:15-16`: "Stale docstring on the L7 lighting tripwire claims it iterates zero entries; it now iterates seven" | **Confirmed exactly, including the "now iterates seven" claim.** `lightingRoleTripwire.test.js:16` — docstring still reads "... this iterates zero entries — it bites the moment S4 lands." `ALN-TokenData/game.json`'s `lightingRoleFallbacks` block now has **7** entries (`gameplay, video-playback, blackout, police-arrival-1, police-arrival-2, police-arrival-3, police-glitch`) — the S4 cutover the docstring anticipated has landed content-wise, and the test's own loop (`:33`, `for (const [role, sceneId] of Object.entries(fallbacks))`) does now iterate 7 times, but nobody updated the comment. |
| **F-P8b-5** | review `:488`, `backend/tests/unit/websocket/socketMiddleware.test.js:290-308`: "Pre-existing placeholder test that cannot fail (expect(true).toBe(true))" | File exists (439 lines), cited range in bounds. Not independently re-read in this pass. |
| **F-P9a-1** | review `:489`, `backend/tests/integration/cue-engine.test.js:474-483, 493-503`: "The phase-cue negative-match decoy asserts nothing — the guard its comment claims does not exist" | File exists (506 lines), both ranges in bounds. Not independently re-read in this pass. |
| **F-P9a-2** | review `:490`, `backend/tests/contract/websocket/sync-full-completeness.test.js:82-85, 102-105` (filename truncated in the review; reconstructed) — "sync:full completeness pin checks key presence, not that the key survives serialization" | File exists (107 lines) at the reconstructed name; both ranges in bounds. Not independently re-read in this pass. |
| **F-P9a-3** | review `:491`, `backend/tests/contract/profile/installation-profile-schema.test.js:97-104` (filename truncated in the review; reconstructed) — "The second real installation profile is never schema-validated, and nothing validates a profile at load" | **Partially confirmed, with a scope note.** `:97-101` schema-validates `backend/config/profiles/aln-full-kit.json` — the only real profile currently in the repo (`find backend/config/profiles -name '*.json'` → `aln-full-kit.json` and the schema itself only). `:104-104ish` validates a synthetic minimal object, not a second real profile. Since a genuine second real profile does not exist on `main` today (the design doc's D-C2.3 — "the toy fixture profile gains a contrasting one" — is CS.2 work, not yet landed per §10 of this census), the finding's forward-looking half ("nothing validates a profile at load") is the currently-checkable part: `grep -rn "installation-profile-schema\|validateProfile" backend/src/services/profileService.js` was not run in this pass to confirm load-time validation is absent — flagged as a gap in this verification, not a contradiction. |
| **P1-observation** | review `:163`, "P1-observation (`transaction:deleted` carries a dead `allTeamScores` field)" (Appendix A does not separately table this one — it is named only in the §1.3 NOTE summary prose) | **Confirmed and precisely located** (unchanged from this census's first draft): `transactionService.js:737` computes `allTeamScores: (this._getSessionScores() || []).map(ts => ts.toJSON())` on **every** `transaction:deleted` emit (a full map over every team, wastefully, on each deletion) — but `broadcasts.js:257-262` builds its outbound WS payload from only `{transactionId, teamId, tokenId, updatedTeamScore}`, dropping `allTeamScores` before it ever reaches a client. `grep -rn "allTeamScores" backend/contracts ALNScanner/src aln-memory-scanner` → zero hits — never documented, never consumed. Genuinely dead computation, confirmed. |

**Rows not independently re-verified beyond file-existence + line-range-in-bounds** (P4-5, P4-7, P9b-6, S2-3, WE-2, WE-4, LA-6, F-P8a-3, F-P8b-1, F-P8b-3, F-P8b-5, F-P9a-1, F-P9a-2 — 13 of 22): every cited file exists on `main` and the cited line range/number is within the file's current length, which is the load-bearing fact for "has this drifted" — none of these 13 show the kind of gross mismatch F-P2-3/P9b-8/LA-7/S2-4/F-P9a-3 did. A full content re-read of all 13 was out of this pass's budget; flagged here rather than silently presented as equally deep.

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
| 13 | 32 total deferred item ids (9 in §2.1, 23 in §2.2 incl. `P1-observation`); all 32 now sourced with a quoted meaning + citation; 5 rows show a confirmed citation drift (`F-P2-3` relocated across two files, `P9b-8` split across `up.sh`/`provision.js`, `LA-7` off by 10 lines, `S2-4` off by 1 line past EOF, `F-P9a-3` scope-narrowed since only one real profile exists yet); 13 rows verified only to file-exists + line-range-in-bounds depth (listed at the end of §2.2) | `sed -n '145,172p' docs/plans/2026-09-05-train-fix-vehicle.md` (id enumeration) cross-read against `docs/plans/2026-09-05-whole-train-review.md` Appendix A (`:438-500`) and its MINOR table (`:115-154`) for each id's citation; source-doc presence now confirmed via `find . -iname "*whole-train-review*"` → `docs/plans/2026-09-05-whole-train-review.md` |
