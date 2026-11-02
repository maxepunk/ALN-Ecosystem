# Block 3 truth-sweep census: the store-fed path

Tree: `ALN-Ecosystem` branch `claude/nice-curie-hescfv` @ `e87f8c5` (submodules at their pins: ALNScanner `5653a3e` / `music-cutover-2026-05-20-174-g5653a3e`, ALN-TokenData `d9e37be`, aln-memory-scanner `e0bf299`, arduino-cyd-player-scanner `f81aba5`). Date: 2026-09-12.

Read-only census. Scope is the store-fed path only (ROADMAP §4 Block 3 brake): `GameOpsRenderer`, `GameAdminRenderer`, `EvidencePickerRenderer` are OUT — confirmed OUT in code too (`MonitoringDisplay._wireGameOpsSubscriptions` has zero store subscriptions; those three renderers are driven by `UnifiedDataManager` events, not `StateStore`).

---

## 1. Producer edges

`backend/src/websocket/broadcasts.js`:
- `pushServiceState(domain, service)` — **:487-493**. 50ms per-domain debounce (`setTimeout(..., 50)`, keyed by `_pushTimers[domain]`), emits `service:state` with `{domain, state: service.getState()}`.
- Music has its OWN inline debounced pusher, `pushMusicState` — **:498-504** — same 50ms pattern, but calls `buildMusicState(musicService)` instead of raw `getState()` (see §2).
- `video:failed` — **:523-529** — bypasses the debounce entirely (immediate `emitToRoom`), because `getState()` would otherwise report `idle` once `currentItem` is nulled.
- `pushHeldState()` — **:589-593** — **undebounced**, no `_pushTimers` entry at all.

Verification greps (event names per domain, run against `broadcasts.js`):
```
$ sed -n '505p' broadcasts.js | grep -oE "'[a-zA-Z:_-]+'" | wc -l        # music        -> 6
$ sed -n '514,517p' broadcasts.js | grep -oE "'[a-zA-Z:_-]+'" | wc -l    # video lifecycle -> 6
$ sed -n '530p' broadcasts.js | grep -oE "'[a-zA-Z:_-]+'" | wc -l        # video queue  -> 5
$ sed -n '542p' broadcasts.js | grep -oE "'[a-zA-Z:_-]+'" | wc -l        # bluetooth    -> 7
$ sed -n '549p' broadcasts.js | grep -oE "'[a-zA-Z:_-]+'" | wc -l        # audio        -> 6
$ sed -n '556p' broadcasts.js | grep -oE "'[a-zA-Z:_-]+'" | wc -l        # lighting     -> 2
$ sed -n '563p' broadcasts.js | grep -oE "'[a-zA-Z:_-]+'" | wc -l        # sound        -> 4
$ sed -n '573p' broadcasts.js | grep -oE "'[a-zA-Z:_-]+'" | wc -l        # gameclock    -> 5
$ sed -n '582p' broadcasts.js | grep -oE "'[a-zA-Z:_-]+'" | wc -l        # cueengine    -> 4
$ sed -n '594p' broadcasts.js | grep -oE "'[a-zA-Z:_-]+'" | wc -l        # held/cue     -> 3
$ sed -n '598p' broadcasts.js | grep -oE "'[a-zA-Z:_-]+'" | wc -l        # held/video   -> 4
```
Plus 1 vlc `state:changed` (:512), 1 `video:failed` (:523), 1 `health:changed` (:536) counted by inspection (single-event `addTrackedListener` calls, not arrays).
Sum: 6+1+6+1+5 (video=13) + 1 (health) + 7 (bt) + 6 (audio) + 2 (lighting) + 4 (sound) + 5 (gameclock) + 4 (cueengine) + 3+4 (held=7) = **55**. Matches claim 4 exactly; unchanged on this tree.

| Domain | Edges | Source service | Event(s) | file:line | Debounced? |
|---|---|---|---|---|---|
| music | 6 | musicService | playback:changed, volume:changed, track:changed, position:changed, playlist:changed, playlists:reloaded | 505-508 (wired to `pushMusicState`, def. 498-504) | Yes, 50ms (own pusher) |
| video | 1 | vlcService | state:changed | 512 | Yes, 50ms (`pushServiceState`) |
| video | 6 | videoQueueService | video:started, video:completed, video:paused, video:resumed, video:loading, video:idle | 514-519 (`VIDEO_LIFECYCLE_EVENTS`) | Yes, 50ms |
| video | 1 | videoQueueService | video:failed | 523-529 | **No — bypasses debounce** |
| video | 5 | videoQueueService | queue:added, queue:cleared, queue:reordered, queue:pending-cleared, queue:reset | 530-532 (`QUEUE_EVENTS`) | Yes, 50ms |
| health | 1 | serviceHealthRegistry | health:changed | 536-538 | Yes, 50ms |
| bluetooth | 7 | bluetoothService | device:connected/disconnected/paired/unpaired/discovered, scan:started/stopped | 541-544 | Yes, 50ms |
| audio | 6 | audioRoutingService | routing:changed/applied/fallback, sink:added/removed, ducking:changed | 548-551 | Yes, 50ms |
| lighting | 2 | lightingService | scene:activated, scenes:refreshed | 555-558 | Yes, 50ms |
| sound | 4 | soundService | sound:started/completed/stopped/error | 562-565 | Yes, 50ms |
| gameclock | 5 | gameClockService | gameclock:started/paused/resumed/stopped, phase:changed | 572-576 | Yes, 50ms |
| cueengine | 4 | cueEngineService | cue:fired/completed/started/status | 581-585 | Yes, 50ms |
| held | 3 | cueEngineService | cue:held/released/discarded | 593-597 (`pushHeldState`) | **No — undebounced** |
| held | 4 | videoQueueService | video:held/released/discarded/recoverable | 598-600 (`pushHeldState`) | **No — undebounced** |

**Total: 55 producer wiring edges across 10 domains.** Matches claim 4's "55" exactly; no drift found.

---

## 2. `getState()` shapes

For each domain: the real function that produces the pushed `state` payload (not just any `getState()` — for `music` and `held` the push uses a different builder), its file:line, its top-level keys (read from source, §1 confirms which fire it), the matching `components.schemas.DomainState*` schema in `backend/contracts/asyncapi.yaml`, and every key mismatch found.

| Domain | Producer (push-time) | file:line | Top-level keys (code) | AsyncAPI schema | Schema line range | Key mismatch |
|---|---|---|---|---|---|---|
| music | `buildMusicState(musicService)` (NOT raw `getState()`) | `syncHelpers.js:218-239`; wraps `musicService.getState()` at `musicService.js:84-93` | connected, state, volume, track, playlist, pausedByGameClock, **playlists** | `DomainStateMusic` | 2567-2579 | **Schema's own description text says playlists is NOT part of this push ("delivered via sync:full's music block only," also repeated at asyncapi.yaml:2354) — but the code (`broadcasts.js:496,502`) explicitly uses `buildMusicState` "so playlists array travels with each push." Contract prose and code directly contradict each other.** `additionalProperties` being allowed means AJV validation still passes (extra key tolerated), so no test catches this — it is a documentation/behavior split, not a schema violation. |
| video | `videoQueueService.getState()` | `videoQueueService.js:629-674` | status, currentVideo, queue, queueLength, connected | `DomainStateVideo` | 2580-2588 | none — exact match |
| health | `serviceHealthRegistry.getSnapshot()` (aliased by `getState()`) | `serviceHealthRegistry.js:94-100` (alias at :86) | dynamic map `{vlc, music, sound, bluetooth, audio, lighting, gameclock, cueengine}`, each `{status, message, lastChecked}` | `DomainStateHealth` | 2589-2599 | Required top-level keys match `KNOWN_SERVICES` (`serviceHealthRegistry.js:14`) exactly. **But the schema's `status` enum is `[healthy, degraded, down]` (asyncapi.yaml:2597) while the code (`report()`, `serviceHealthRegistry.js:36-42`) accepts and ever emits ONLY `healthy`/`down` — `degraded` is dead on both sides, and the CONTEXT.md-ratified third word `dormant` is present on NEITHER side.** See §8(e). |
| bluetooth | `bluetoothService.getState()` | `bluetoothService.js:437-450` | available, scanning, pairedDevices, connectedDevices | `DomainStateBluetooth` | 2600-2607 | none |
| audio | `audioRoutingService.getState()` | `audioRoutingService.js:310-321` | routes, defaultSink, ducking, availableSinks, volumes | `DomainStateAudio` | 2608-2616 | none |
| lighting | `lightingService.getState()` | `lightingService.js:333-338` | connected, activeScene, scenes | `DomainStateLighting` | 2617-2623 | none |
| sound | `soundService.getState()` | `soundService.js:134-136` | playing | `DomainStateSound` | 2624-2628 | none |
| gameclock | `gameClockService.getState()` | `gameClockService.js:99-112` | status, elapsed, expectedDuration, startTime, totalPausedMs, phase | `DomainStateGameclock` | 2629-2649 | none — the fix-vehicle's P3-1 (`expectedDuration`) is present and required on both sides (schema comment at 2637-2641 cites "Fix-vehicle P3-1" by name) |
| cueengine | `cueEngineService.getState()` | `cueEngineService.js:150-155` | cues, activeCues, disabledCues | `DomainStateCueengine` | 2650-2656 | none against the real contract. **Side note (not a contract bug):** `backend/CLAUDE.md`'s own "sync:full Phase 2 Additions" prose says `cueEngine: {cues, activeCues, standingCues}` — the real code (both `getState()` and `buildCueEngineState`, see §3) has never had a `standingCues` key; it has `loaded` (sync:full only) and `disabledCues`. The doc line is stale, not the contract. |
| held | `{ items: buildHeldItemsState(cueEngineService, videoQueueService) }` | wrapper at `broadcasts.js:589-592`; builder at `syncHelpers.js:250-267` | items (array) | `DomainStateHeld` | 2657-2670 | none against the push shape. sync:full's `heldItems` key carries the BARE array (no `{items}` wrapper) — see §3/§4, this is the documented rename+rewrap, not a new finding. |

---

## 3. `sync:full`

`buildSyncFullPayload` — `backend/src/websocket/syncHelpers.js:36-152`. Full return object at **:131-151** (15 keys, matching the contract test's `requiredKeys.length >= 15` and `backend/CLAUDE.md`'s "14 + pack" count):

| Key | Builder | file:line |
|---|---|---|
| `session` | `sessionService.getCurrentSession().toJSON()` | :49,132 |
| `scores` | `transactionService.getTeamScores()` | :59,133 |
| `recentTransactions` | inline map over `session.transactions` | :63-81,134 |
| `videoStatus` | `videoQueueService.getState()` | :57,135 |
| `devices` | inline map over `session.connectedDevices` | :84-97,136 |
| `serviceHealth` | `serviceHealthRegistry.getSnapshot()` | :101,137 |
| `playerScans` | `session.playerScans` | :138 |
| `environment` | `buildEnvironmentState()` (→ `environmentHelpers.js:41-70`; nests `bluetooth`/`audio`/`lighting`) | :103-107,139 |
| `gameClock` | `buildGameClockState(gameClockService)` | :110,140,161-184 |
| `cueEngine` | `buildCueEngineState(cueEngineService)` | :113,141,193-208 |
| `music` | `buildMusicState(musicService)` | :116,142,218-239 |
| `heldItems` | `buildHeldItemsState(cueEngineService, videoQueueService)` | :119,143,250-267 |
| `sound` | `soundService.getState()` (or `{playing:[]}` default) | :122,144 |
| `displayStatus` | `displayControlService.getStatus()` minus `timestamp` | :126-129,145 |
| `pack` | `packService.getActivePackInfo()` | :150 |

Every caller of `buildSyncFullPayload` (verified `grep -rn "buildSyncFullPayload" backend/src backend/tests`):
1. `src/server.js:77`
2. `src/websocket/gmAuth.js:165`
3. `src/websocket/broadcasts.js:98` (initial-connect path re-used elsewhere)
4. `src/websocket/broadcasts.js:312`
5. `src/websocket/broadcasts.js:353`
6. `src/routes/stateRoutes.js:34`
7. `tests/helpers/integration-test-server.js:107`

= **7 callers**, matching `backend/CLAUDE.md`'s documented count exactly.

`backend/tests/contract/websocket/sync-full-completeness.test.js` pins: the required-key list is PARSED from `asyncapi.yaml` at test time (never hand-copied), then asserts `buildSyncFullPayload()`'s own output object carries every one of those keys — once with all 10 services passed, once with `gameClockService`/`cueEngineService`/`musicService`/`soundService` all omitted (the four historical omission culprits) to prove the builder degrades to safe defaults rather than dropping the key. It does **not** by itself guard against a caller forgetting to pass a service — that is `tests/integration/music-sync-full-callers.test.js`'s job (static-analysis scan of the same 7 call sites above, asserting each literal-object call includes `musicService` and flagging any "call the builder with a pre-built variable instead of an inline object" refactor that would dodge the scan).

---

## 4. Transport (scanner side)

`ALNScanner/src/network/messageRouters.js` — `sharedInfraRouter(type, payload, dataManager, session, store, services, handleSessionBoundary)`, **:90-174**.

`service:state` handler, quoted verbatim (**:170-174**):
```js
case 'service:state':
  // All service domain state → StateStore (incremental update)
  if (store && payload.domain && payload.state) {
    store.update(payload.domain, payload.state);
  }
  return true;
```

`sync:full` restore block, quoted verbatim (**:123-136**):
```js
// Populate StateStore from sync:full (authoritative snapshot — use replace())
if (store) {
  if (payload.music) store.replace('music', payload.music);
  if (payload.serviceHealth) store.replace('health', payload.serviceHealth);
  if (payload.environment?.bluetooth) store.replace('bluetooth', payload.environment.bluetooth);
  if (payload.environment?.audio) store.replace('audio', payload.environment.audio);
  if (payload.environment?.lighting) store.replace('lighting', payload.environment.lighting);
  if (payload.gameClock) store.replace('gameclock', payload.gameClock);
  if (payload.cueEngine) store.replace('cueengine', payload.cueEngine);
  if (payload.heldItems) store.replace('held', { items: payload.heldItems });
  if (payload.videoStatus) store.replace('video', payload.videoStatus);
  if (payload.sound) store.replace('sound', payload.sound);
}
```

| sync:full key | Store domain | Guard expression | replace/update |
|---|---|---|---|
| `music` | music | `if (payload.music)` | replace |
| `serviceHealth` | health | `if (payload.serviceHealth)` | replace |
| `environment.bluetooth` | bluetooth | `if (payload.environment?.bluetooth)` | replace |
| `environment.audio` | audio | `if (payload.environment?.audio)` | replace |
| `environment.lighting` | lighting | `if (payload.environment?.lighting)` | replace |
| `gameClock` | gameclock | `if (payload.gameClock)` | replace |
| `cueEngine` | cueengine | `if (payload.cueEngine)` | replace |
| `heldItems` | held | `if (payload.heldItems)` (rewrapped `{items: payload.heldItems}`) | replace |
| `videoStatus` | video | `if (payload.videoStatus)` | replace |
| `sound` | sound | `if (payload.sound)` | replace |

= **10 truthiness guards**, all falsy-checked (a `0`, `false`, `''`, or empty-array-that's-still-truthy is fine; only `undefined`/`null`/missing-key skip the restore — an empty `heldItems: []` array IS truthy in JS so it still replaces, correctly clearing stale held items). Line numbers unchanged from claim 4's 125-137 (now 123-136 — one line shifted by a comment edit, same 10 guards, same non-uniform key mapping: `serviceHealth`→`health`, `environment.*`→3 domains, `gameClock`→`gameclock`, `cueEngine`→`cueengine`, `heldItems`→`held` (rewrapped), `videoStatus`→`video`).

`ALNScanner/src/core/stateStore.js` semantics (full file read):
- `update(domain, state)` (**:18-43**): `merged = {...prev, ...state}` — **shallow merge**, one level deep. A key ABSENT from the incoming `state` keeps its previous value. A key present with value `undefined`/`null` in the incoming `state` OVERWRITES the previous value (spread copies own-enumerable keys regardless of value). Change detection is shallow-equal over the merged object's own keys (`keys.length === prevKeys.length && every k: merged[k] === prev[k]`) — if the new push omits a key the old state had, `keys.length` differs and a re-render fires even if nothing visible actually changed. Listeners fire with `(newState, prevState)`.
- `replace(domain, state)` (**:50-75**): `next = {...state}` — **wholesale replace**, drops any key absent from `state`. Same shallow-equal skip-if-unchanged logic. This is the one sync:full uses (SSR-2 per its own comment), specifically so a domain "can't retain stale keys across the sync:full vs service:state shapes."
- `get(domain)` (**:77-83**) / `getAll()` (**:85**): return `structuredClone()`'d defensive copies (SSR-3) so a consumer mutating a nested array/object (e.g. `video.queue`) cannot corrupt canonical state or silently defeat the shallow-equality check.
- `on`/`off` (**:87-94**): per-domain `Set<callback>`.

---

## 5. Consumers

`ALNScanner/src/admin/MonitoringDisplay.js` — constructor wires `_wireStoreSubscriptions()` (**:41,53-66**), which delegates to four domain-grouped wiring methods (structural split not present in the claim-4 snapshot, same 10 subscriptions underneath):

| Domain | Handler file:line | Renderer + method | Reshaping code (quoted) | Fields dropped |
|---|---|---|---|---|
| cueengine | `:88-95` (`_wireShowControlSubscriptions`) | `CueRenderer.render` | `const cues = new Map(); (state.cues\|\|[]).forEach(c => cues.set(c.id, c)); const activeCues = new Map(); (state.activeCues\|\|[]).forEach(ac => activeCues.set(ac.cueId, ac)); const disabledCues = new Set(state.disabledCues\|\|[]);` | none named, but any array item lacking `.id`/`.cueId` silently vanishes into an undefined Map key |
| held | `:98-100` | `HeldItemsRenderer.renderSnapshot` | `this.heldItemsRenderer.renderSnapshot(state?.items \|\| [])` | none |
| video | `:113-116`, adapter `mapVideoState` at `:105-112` | `VideoRenderer.render` + `_updateReturnToVideoVisibility` | `nowPlaying: s.currentVideo?.filename\|\|null, isPlaying: s.status==='playing', isPaused: s.status==='paused', progress: s.currentVideo?.position\|\|0, duration: s.currentVideo?.duration\|\|0, queue: s.queue` | any `currentVideo`/top-level field not named here (e.g. `tokenId`) is invisible to the renderer |
| sound | `:119-131` | **none — inline `innerHTML`** | builds `<span>` list from `state.playing` directly | n/a (no adapter, but also no renderer class to reuse/test independently) |
| lighting | `:141-143` (`_wireEnvironmentSubscriptions`) | `EnvironmentRenderer.renderLighting` | none | — |
| audio | `:146-156` | `EnvironmentRenderer.renderAudio` **+ cross-domain fan-out** | `const musicSources = state?.ducking?.music; this.musicRenderer.renderDucking(musicSources && musicSources.length>0 ? {ducked:true, activeSources:musicSources} : {ducked:false, activeSources:[]});` | any ducking source key other than `.music` is not surfaced |
| bluetooth | `:159-161` | `EnvironmentRenderer.renderBluetooth` | none | — |
| music | `:164-166` | `MusicRenderer.render` | none | — |
| health | `:174-178` (`_wireGameAdminSubscriptions`) | `HealthRenderer.render` | none (renderer itself does 3 binary `=== 'healthy'`/`!== 'healthy'` comparisons — see §8(e)) | — |
| gameclock | `:183-188` | `SessionRenderer.renderGameClock` | `{ state: state.status \|\| state.state, elapsed: state.elapsed, phase: state.phase ?? null }` — comment: **"this adapter STRIPS unknown fields by design — a new clock field surfaces nowhere until named here"** | `startTime`, `totalPausedMs`, `expectedDuration` are all present on the `gameclock` domain (§2) but never reach `SessionRenderer` |

**5 reshaping adapters**, unchanged from claim 4: `mapVideoState` (video), the gameclock field-strip (gameclock), the cueengine array→Map/Set rebuild (cueengine), the held `{items}` unwrap (held), the audio→music ducking fan-out (audio). **1 domain with no renderer class**: `sound` (inline handler only). `GameOpsRenderer`/`GameAdminRenderer`/`EvidencePickerRenderer` confirmed OUT — `_wireGameOpsSubscriptions` (**:75-79**) is an explicit no-op with a comment: "Transactions, scores, and player scans are not StateStore domains... Nothing to subscribe here."

`refreshAllDisplays()` — **:374-378** — calls `updateSystemDisplay()` then `_requestInitialState()`. `_requestInitialState()` — **:195-200** — `this.client.socket.emit('sync:request')` if connected (the same request path `resume()` at `:383-386` uses on reconnect).

---

## 6. Ingress list

`ALNScanner/src/network/orchestratorClient.js` `MESSAGE_TYPES`, verbatim (**:26-49**):
```js
export const MESSAGE_TYPES = [
  'sync:full', 'transaction:result', 'transaction:new', 'transaction:deleted',
  'score:adjusted', 'scores:reset', 'session:update', 'session:overtime',
  'device:connected', 'device:disconnected', 'group:completed', 'display:mode',
  'gm:command:ack', 'offline:queue:processed', 'batch:ack', 'error',
  'player:scan', 'scoreboard:page', 'cue:fired', 'cue:completed', 'cue:error',
  'service:state', // Sole push mechanism for service domain state
];
```
= **22 entries**.

`backend/contracts/asyncapi.yaml` `channels['/'].subscribe.message.oneOf` (**:93-114**) resolves (via each `$ref`'s `.name` field) to 22 wire names: `device:connected, device:disconnected, sync:full, transaction:result, transaction:new, transaction:deleted, score:adjusted, scores:reset, session:update, session:overtime, gm:command:ack, offline:queue:processed, group:completed, display:mode, batch:ack, player:scan, scoreboard:page, cue:fired, cue:completed, cue:error, service:state, error`.

Diff both ways (sorted-set comparison): **empty — the two 22-item sets are IDENTICAL**, only differently ordered. No orphan either direction on this tree.

Contract test: `backend/tests/contract/scanner/client-contract-conformance.test.js`, describe block "server→client: MESSAGE_TYPES equals the subscribe oneOf set (WS-2)" (**:67-80**) — imports the real `MESSAGE_TYPES` export from the ALNScanner submodule and asserts `[...MESSAGE_TYPES].sort()` deep-equals the contract's sorted event-name list. This is a strict-equality pin (not subset), so it would fail immediately on either a scanner addition without a contract entry or vice versa. A companion pin, `backend/tests/contract/websocket/subscribe-oneof.test.js`, exists specifically because `batch:ack`/`player:scan` were once missing from the oneOf (regression-named in its own header comment).

---

## 7. The second (non-StateStore) state path

`ALNScanner/src/core/unifiedDataManager.js` `_wireStrategyEvents()`, forwarded-events array verbatim (**:155-164**):
```js
const events = [
  'transaction:added', 'transaction:deleted', 'team-score:updated',
  'scores:cleared', 'data:cleared', 'game-state:updated',
  'player-scan:added', 'session:updated'
];
```
= **8 events**.

`ALNScanner/src/main.js` `DataManager.addEventListener(...)` call sites (**:131, 140, 149, 164, 170, 179, 184**):
`transaction:added`, `transaction:deleted`, `data:cleared`, `game-state:updated`, `team-score:updated`, `scores:cleared`, `player-scan:added` = **7 listeners**.

Orphan: **`session:updated`** is forwarded by `unifiedDataManager.js` but has **zero consumers anywhere in `ALNScanner/src`** (verified: `grep -rn "'session:updated'" ALNScanner/src` returns only the 3 emit sites in `core/storage/LocalStorage.js:193,218,244` and the 1 forwarding-list entry in `unifiedDataManager.js:163` — no `addEventListener('session:updated', ...)` anywhere). Same asymmetry claim 4 recorded; unchanged, still present, not yet adjudicated.

---

## 8. Recorded desync classes

**(a) mpd2 idle-FIFO desync + `_refreshAfterCommand`.**
Current code: `backend/src/services/musicService.js` — shared positional response/idle FIFO noted at `:64-69`; bounded `_send(op)` (**:245-261**) wraps every mpd2 round-trip in `withTimeout(op(client), this._opTimeoutMs, 'MPD command')`; `_refreshAfterCommand(kind)` (**:276-282**) is called by every mutating command (`play/pause/stop/next/previous` at `:285-289`, `setVolume()` at `:291-300`, `seek()` at `:308-314`, `pauseForGameClock`/`resumeFromGameClock` elsewhere in the file) so each command's own effect is re-read and diffed even if the idle FIFO never fires.
Test: **COVERED.** `backend/tests/unit/services/musicService.test.js:324-335` — `pauseForGameClock() emits playback:changed from its own refresh (no idle event)`, with the test's own comment: "without its own refresh the panel keeps showing 'playing' whenever the idle FIFO is desynced — the exact class the command-path fix addresses." Also `:929-936` and neighboring tests directly exercise the timeout-drop-client recovery path (`rejects with TimeoutError and drops the client when a command hangs`).

**(b) `EnvironmentRenderer` `_volumeValues`.**
Current code: `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:47` (init `{video:100, music:100, sound:100}`), `:228` (cache-write on slider input), `:246,250` (render reads the cache, not the incoming state, for slider value/label), `:267` (cache-write on the volume-set command path). Lines unchanged from claim 4.
Test: **COVERED.** `ALNScanner/tests/unit/ui/renderers/EnvironmentRenderer.test.js:410-420` — "omitted volumes payload does not overwrite the cache" — renders once with `volumes:{video:75}`, then again with `volumes` key entirely absent, and asserts `_volumeValues.video` and the rendered slider value both stay `75`.

**(c) MPD `setvol` while stopped fails ("All outputs are disabled").**
Current code: **no handling exists.** `grep -n -i "output\|disabled" backend/src/services/musicService.js` finds nothing related to this error; `setVolume()` (`:291-300`) sends `setvol` unconditionally with no guard, no catch, no fallback for the stopped-output case.
Test: **UNCOVERED.** The only place this string appears is `backend/tests/rung1/audit-flows.js:172` and `generate-fixtures.js:40`, and in both cases it is a comment explaining why the rung-1 harness calls `music:play` BEFORE `music:setVolume` — the harness *avoids* triggering the bug rather than testing or fixing the underlying MPD behavior. No unit/contract/integration test asserts what happens (or should happen) when a GM moves the volume slider while music is stopped. Source of the finding: `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:498-501`.

**(d) `sync:full` omission class.**
Current code: 7 caller sites enumerated in §3. `backend/CLAUDE.md`'s "CRITICAL sync:full Completeness" section still names the same 4 historical recurrences (`scores:reset`, `offline:queue:processed`, `integration-test-server.js`, `soundService`).
Test: **COVERED, two layers.** (1) `backend/tests/contract/websocket/sync-full-completeness.test.js` — builder-output-carries-every-contract-key pin (§3). (2) `backend/tests/integration/music-sync-full-callers.test.js:138-176` — static-analysis scan of every `buildSyncFullPayload({...})` call site in `src/` + `tests/helpers/`, asserting `musicService` appears in each one AND that no call site has been refactored to a variable-form call that would dodge the regex (`:154-164`).

**(e) Health binary comparisons vs an incoming `dormant` value.**
Current code, three layers, all still binary:
1. `backend/src/services/serviceHealthRegistry.js:36-43` (`report()`) — `if (status !== 'healthy' && status !== 'down') { logger.warn(...); return; }` — a `'dormant'` report is **silently rejected and dropped**, not stored, not emitted.
2. `backend/src/services/serviceHealthRegistry.js:70-73` (`isHealthy()`) — `entry.status === 'healthy'` — a hypothetical `dormant` entry (if it ever got past #1) would read identically to `down`.
3. `backend/contracts/asyncapi.yaml:2597` — `DomainStateHealth.status` enum is `[healthy, degraded, down]` — has the CONTEXT.md-condemned `degraded` (never emitted anywhere in the codebase — `grep -rn "'degraded'" backend/src` finds nothing that reports it), does **not** have `dormant`.
4. `ALNScanner/src/ui/renderers/HealthRenderer.js:48,83,136` — `s.status === 'healthy'` / `s.status !== 'healthy'` — same binary; a `dormant` value would render red (DOWN), directly violating CONTEXT.md §4's alarm-integrity invariant ("intentional absence shows grey, never red").
`grep -rln "dormant" backend/src backend/tests ALNScanner/src ALNScanner/tests backend/contracts` finds **exactly one file**: `backend/src/gameRules/resolution.js` (the "one truth, three loops" verdict resolver, §2 of CONTEXT.md) plus its two test files — `dormant` has not yet reached the health-service/`service:state`/`StateStore`/renderer path AT ALL.
Test: **UNCOVERED by construction** — `backend/tests/contract/websocket/service-domain-state.test.js:68-87` validates every domain's live `getState()` output against its schema, but since the registry code literally cannot produce anything but `healthy`/`down`, the AJV check can never exercise the `dormant` (or even the dead `degraded`) branch. `backend/tests/unit/services/getState.test.js:204-216` only exercises `'healthy'`. This is confirmed pending work, not a regression — CONTEXT.md's ratification (2026-09-04) and ROADMAP's Block 2 scope both already say this is unbuilt ("The health-state change: the third health word (dormant) joins healthy/down at 42 places in 14 engine files, 3 contract sites, 3 scanner sites, and 1 test helper" — future-tense, Block 2, not Block 3).

**Fix-vehicle "display truth" items** (`docs/plans/2026-09-05-train-fix-vehicle.md` §1.2 — the section heading covers three flavors, "parity, display truth, engine smalls," un-labeled per bullet; anchors below, re-tested rather than assumed fixed):

| §1.2 item | Code anchor | On the store-fed path? |
|---|---|---|
| **P3-1** `gameclock` `service:state` carries `expectedDuration` | `backend/src/services/gameClockService.js:108`; `backend/src/websocket/syncHelpers.js:164-173`; `backend/contracts/asyncapi.yaml:736-740` (nested schema) and `:2637-2641` (`DomainStateGameclock`, comment names "Fix-vehicle P3-1" explicitly, field defined at :2641) | **Yes** — §2's gameclock row confirms the key is present and required on both getState() and the contract, and reaches `SessionRenderer.renderGameClock` (§5) |
| **F-P2-5/F-P8a-2** the L1 shim's `display` half drift-pinned | `backend/src/gameRules/formatting.js:24` (`BAKED_MONEY_SPEC = Object.freeze({prefix:'$', suffix:''})`), drift test `backend/tests/unit/gameRules/formatting.test.js:70-72` (`BAKED_MONEY_SPEC equals the parsed REAL ALN game.json format`, reading `ALN-TokenData/game.json:70` `scoring.display.format`) | **No** — `formatMoney`/`formatCurrency` are consumed by `GameOpsRenderer`, `uiManager.js`, `app.js`, `sessionReportGenerator.js` (`grep -rln "formatCurrency\|formatMoney" ALNScanner/src`) — none of those are store-fed; `GameOpsRenderer` is the explicitly-OUT renderer. Re-anchored here for completeness per the brief, out of this sweep's fix scope. |
| **LB-2/LB-3/LB-4**, **P1-2**, **P1-3**, **P4-1**, **P4-3**, **F-P6-1**, **S1-1** | Backend-parity / transaction-history-mode / cue-vocabulary / CORS / OpenAPI-docs / Notion-sync / report-sanitizer items — none touch `service:state`, `sync:full`'s service-domain keys, `StateStore`, or a store-fed renderer (spot-checked: `P1-2` lands in `backend/src/models/transaction.js:167` and `backend/src/utils/validators.js:67`; `P1-3` in `backend/src/gameRules/cueVocabulary.js:8,25,35`) | **No** — out of store-fed scope; not independently re-anchored for the other five (F-P6-1, S1-1, LB-2/3/4, P4-1, P4-3) beyond the §1.2 one-liner, since they sit in the Notion-sync script, CORS config, OpenAPI docs, and report generation — none of which the store-fed sweep touches |

---

## 9. Existing tests on the store path

| File | What it pins |
|---|---|
| `ALNScanner/tests/unit/core/stateStore.test.js` | `update()`/`replace()`/`get()`/`getAll()`/`on()`/`off()` semantics directly (merge depth, wholesale replace, defensive-copy isolation, listener firing/skip-on-no-change) |
| `ALNScanner/tests/unit/network/networkedSession.test.js` | Exercises `messageRouters.js`'s `sharedInfraRouter`/`gameOpsRouter` INDIRECTLY (no dedicated `messageRouters.test.js` exists) via `NetworkedSession`'s real, unmocked `_messageHandler` — dispatches synthetic `sync:full`/`service:state` `message:received` events and asserts `mockStore.replace`/`mockStore.update` call args per domain (`:628-1090`+). Explicitly proves 9 of the 10 sync:full restore guards fire (`:1057-1061`, `expect(mockStore.replace).toHaveBeenCalledTimes(9)`) — **`sound` is the one domain never exercised in this "complete restore" test** (no `store.replace('sound', ...)` assertion anywhere in the file). |
| `ALNScanner/tests/unit/admin/MonitoringDisplay-phase1.test.js` / `-phase2.test.js` / `-phase3.test.js` / `-environment.test.js` / `-showcontrol.test.js` | `MonitoringDisplay` store-subscription wiring and renderer delegation, split by the phase/domain each file was added in |
| `ALNScanner/tests/unit/ui/renderers/CueRenderer.test.js` | cueengine adapter output (Map/Set rebuild) and rendering |
| `ALNScanner/tests/unit/ui/renderers/HeldItemsRenderer.test.js` | held `renderSnapshot(items)` |
| `ALNScanner/tests/unit/ui/renderers/VideoRenderer.test.js` | video render incl. `mapVideoState`-shaped input |
| `ALNScanner/tests/unit/ui/renderers/EnvironmentRenderer.test.js` | lighting/audio/bluetooth rendering + the `_volumeValues` cache (§8b) |
| `ALNScanner/tests/unit/ui/renderers/MusicRenderer.test.js` | music render + `renderDucking` (the audio→music fan-out target) |
| `ALNScanner/tests/unit/ui/renderers/HealthRenderer.test.js` | health render, the 3 binary `healthy` comparisons (no `dormant` case — §8e) |
| `ALNScanner/tests/unit/ui/renderers/SessionRenderer.test.js` | includes `renderGameClock`, the field-stripping adapter |
| `ALNScanner/tests/unit/utils/domEventBindings-music.test.js` | music-related `data-action` wiring (peripheral to the store path, not a subscription test itself) |
| `backend/tests/unit/services/getState.test.js` | Shape + change-reflection for bluetooth/audio/lighting/sound/cueengine/health/video/gameclock/vlc `getState()` — its own docstring claims "every service with a getState() method" but **`musicService` is absent from this file** (covered instead, more thoroughly, in `musicService.test.js`) |
| `backend/tests/contract/websocket/service-domain-state.test.js` | AJV-validates each of the 10 domains' REAL push-time producer output against its `DomainState*` schema (`:29-46` producer map — note it calls `musicService.getState()` directly rather than the actual push-time `buildMusicState()`, so it does not exercise the `playlists` field the real push always includes — see §2); also pins "every domain in the enum has a schema, and vice versa" (`:64-66`) |
| `backend/tests/integration/service-state-push.test.js` | End-to-end: real service event → `broadcasts.js pushServiceState()` → WebSocket `service:state` delivery, for the debounce window |
| `backend/tests/unit/websocket/broadcasts.test.js` / `phase1-broadcasts.test.js` / `phase2-broadcasts.test.js` | Broadcast wiring incl. `sync:full` re-emission paths (`scores:reset`, `offline:queue:processed`) |
| `backend/tests/unit/websocket/syncHelpers.test.js` | `buildSyncFullPayload` field-by-field (recentTransactions enrichment, `sound` field, `videoStatus` shape, contract conformance) |
| `backend/tests/integration/music-sync-full-callers.test.js` | Static-analysis guard over all 7 `buildSyncFullPayload` call sites (§3/§8d) |
| `backend/tests/integration/external-state-propagation.test.js` | External monitor (D-Bus/pactl/etc.) → domain event → `service:state` propagation |
| `backend/tests/integration/cue-engine.test.js`, `environment_control.test.js` | Domain-specific `service:state` behavior for cueengine/held and bluetooth/audio/lighting respectively |
| `backend/tests/unit/services/musicService.test.js`, `gameClockService.test.js`, `audioRoutingService.test.js`, `videoQueueService.test.js`, `mprisPlayerBase.test.js` | Per-service `getState()` + event-emission correctness (musicService covers §8a directly) |
| `backend/tests/contract/websocket/lighting-state.test.js`, `music-events.test.js`, `display-events.test.js` | Per-domain contract/event shape spot checks |
| `backend/tests/rung1/audit-flows.js:158-164` | The ONE real-hardware (no-mock) `service:state` assertion in the whole tree: a live player scan of `kai001` must produce a `service:state{domain:'video', state.currentVideo.tokenId:'kai001', state.status ∈ {playing,loading}}` event from the actually-running VLC/orchestrator stack |

---

## 10. Screen capture

```
$ grep -rn "toHaveScreenshot" ALNScanner/tests backend/tests   →  0 hits
$ grep -rln "toHaveScreenshot|screenshot(" ALNScanner/tests/e2e backend/tests/e2e
  ALNScanner/tests/e2e/specs/phase2-validation.spec.js
  backend/tests/e2e/helpers/page-objects/PlayerScannerPage.js
  backend/tests/e2e/helpers/page-objects/ScoreboardPage.js
  backend/tests/e2e/README.md
```

**Zero Playwright visual-regression assertions (`toHaveScreenshot`) exist anywhere in either E2E suite.** What exists instead: 3 raw diagnostic `page.screenshot({...})` calls in `ALNScanner/tests/e2e/specs/phase2-validation.spec.js` (`:50, 202, 223`) that save a PNG for manual inspection with no baseline/diff assertion; a `screenshot(filename)` convenience helper method on `PlayerScannerPage.js:901-903` and `ScoreboardPage.js:545-547` (both just call `page.screenshot({path, fullPage:true})`, unused for comparison anywhere the grep found); and one example in `backend/tests/e2e/README.md:512`. This confirms ROADMAP §4 Block 1's "Screen baselines (Q8): capture baseline screen images from the pinned production release before further change" has **not yet happened** on this tree — there is no baseline to regress against, so Block 3's own screen-capture work (named in ROADMAP §4 Block 3's own text) starts from zero, not from an existing suite that merely needs extending.

---

## 11. The matrix

10 domains × 7 columns. Every cell is a citation or `MISSING`.

| Domain | Producer edges | `getState()` producer | sync:full key | Restore guard | Subscription | Adapter | Renderer |
|---|---|---|---|---|---|---|---|
| music | 6 (`broadcasts.js:505-508`) | `buildMusicState` → `syncHelpers.js:218` (wraps `musicService.js:84`) | `music` (`syncHelpers.js:142`) | `messageRouters.js:127` | `MonitoringDisplay.js:164-166` | none | `MusicRenderer.render` |
| video | 13 (`broadcasts.js:512,514-533`) | `videoQueueService.js:629` | `videoStatus` (`syncHelpers.js:135`) | `messageRouters.js:135` | `MonitoringDisplay.js:113-116` | `mapVideoState` (`:105-112`) | `VideoRenderer.render` |
| health | 1 (`broadcasts.js:536-538`) | `serviceHealthRegistry.js:94` | `serviceHealth` (`syncHelpers.js:137`) | `messageRouters.js:128` | `MonitoringDisplay.js:176-178` | none (renderer does own binary compare) | `HealthRenderer.render` |
| bluetooth | 7 (`broadcasts.js:541-544`) | `bluetoothService.js:437` | `environment.bluetooth` (`syncHelpers.js:139`→`environmentHelpers.js:41-70`) | `messageRouters.js:129` | `MonitoringDisplay.js:159-161` | none | `EnvironmentRenderer.renderBluetooth` |
| audio | 6 (`broadcasts.js:548-551`) | `audioRoutingService.js:310` | `environment.audio` (`syncHelpers.js:139`) | `messageRouters.js:130` | `MonitoringDisplay.js:146-156` | ducking→music fan-out (`:150-155`) | `EnvironmentRenderer.renderAudio` (+ `MusicRenderer.renderDucking`) |
| lighting | 2 (`broadcasts.js:555-558`) | `lightingService.js:333` | `environment.lighting` (`syncHelpers.js:139`) | `messageRouters.js:131` | `MonitoringDisplay.js:141-143` | none | `EnvironmentRenderer.renderLighting` |
| sound | 4 (`broadcasts.js:562-565`) | `soundService.js:134` | `sound` (`syncHelpers.js:144`) | `messageRouters.js:136` (**UNCOVERED by any test — §9**) | `MonitoringDisplay.js:119-131` | none (inline itself) | **none — inline `innerHTML` handler only** |
| gameclock | 5 (`broadcasts.js:572-576`) | `gameClockService.js:99` | `gameClock` (`syncHelpers.js:140`, via `buildGameClockState` `:161`) | `messageRouters.js:132` | `MonitoringDisplay.js:183-188` | field-strip (`:184-187`) | `SessionRenderer.renderGameClock` |
| cueengine | 4 (`broadcasts.js:581-585`) | `cueEngineService.js:150` | `cueEngine` (`syncHelpers.js:141`, via `buildCueEngineState` `:193`) | `messageRouters.js:133` | `MonitoringDisplay.js:88-95` | array→Map/Set rebuild (`:89-93`) | `CueRenderer.render` |
| held | 7 (`broadcasts.js:593-600`) | `syncHelpers.js:250` (`buildHeldItemsState`, shared by push wrapper `broadcasts.js:589-592` and sync:full `syncHelpers.js:119`) | `heldItems` (`syncHelpers.js:143`) | `messageRouters.js:134` | `MonitoringDisplay.js:98-100` | `{items}` unwrap/rewrap (`:99`, and `messageRouters.js:134` on restore) | `HeldItemsRenderer.renderSnapshot` |

No `MISSING` cells — every domain has a producer, a getState function, a sync:full key, a restore guard, a subscription, and a renderer (or the documented single exception, sound's inline handler). The one true gap is coverage, not wiring: sound's restore guard is real code with zero test evidence it ever fires correctly (§9).

---

## 12. Counts table

| # | Claim | Verified count | Verifying grep |
|---|---|---|---|
| 1 | Producer wiring edges | **55** | Ten `sed -n '<line>p' broadcasts.js \| grep -oE "'[a-zA-Z:_-]+'" \| wc -l` calls (§1) summed with 3 single-event `addTrackedListener` sites counted by inspection (vlc `state:changed` :512, `video:failed` :523, `health:changed` :536) |
| 2 | Service-domain schemas in the contract | **10** | `grep -n "DomainStateMusic:\|DomainStateVideo:\|DomainStateHealth:\|DomainStateBluetooth:\|DomainStateAudio:\|DomainStateLighting:\|DomainStateSound:\|DomainStateGameclock:\|DomainStateCueengine:\|DomainStateHeld:" backend/contracts/asyncapi.yaml` → 10 matches |
| 3 | `sync:full` required top-level keys | **15** | `syncHelpers.js:131-151` return object, hand-counted; matches `sync-full-completeness.test.js`'s own `requiredKeys.length >= 15` sanity assertion |
| 3 | `buildSyncFullPayload` callers | **7** | `grep -rn "buildSyncFullPayload" backend/src backend/tests \| grep -v "syncHelpers.js:"` (call sites only, excluding definition/import lines) → `server.js:77`, `gmAuth.js:165`, `broadcasts.js:98,312,353`, `stateRoutes.js:34`, `integration-test-server.js:107` = 7 |
| 4 | `sync:full` restore guards | **10** | `grep -n "store.replace" ALNScanner/src/network/messageRouters.js` → 10 lines (:127-136) |
| 5 | `MonitoringDisplay` store subscriptions | **10** | `grep -n "on('" ALNScanner/src/admin/MonitoringDisplay.js` inside `_wireShowControlSubscriptions`/`_wireEnvironmentSubscriptions`/`_wireGameAdminSubscriptions` → 10 `on(domain, ...)` calls (cueengine, held, video, sound, lighting, audio, bluetooth, music, health, gameclock) |
| 5 | Reshaping adapters | **5** | Manual enumeration cross-checked against claim 4: `mapVideoState`, gameclock field-strip, cueengine Map/Set rebuild, held `{items}` unwrap, audio→music ducking fan-out |
| 5 | Domains with no renderer class | **1** | `sound` — `grep -n "on('sound'" ALNScanner/src/admin/MonitoringDisplay.js` shows an inline handler, not a `renderer.method()` call, and `ls ALNScanner/src/ui/renderers/` has no `SoundRenderer.js` |
| 6 | `MESSAGE_TYPES` entries | **22** | `orchestratorClient.js:26-49` array, hand-counted; cross-checked by the diff script in §6 (empty diff against the 22-item asyncapi subscribe set) |
| 6 | AsyncAPI subscribe `oneOf` entries | **22** | `sed -n '93,114p' backend/contracts/asyncapi.yaml \| grep -c '\$ref'` → 22 |
| 7 | `unifiedDataManager` forwarded strategy events | **8** | `sed -n '155,164p' ALNScanner/src/core/unifiedDataManager.js` array, hand-counted |
| 7 | `main.js` `DataManager.addEventListener` calls | **7** | `grep -n "DataManager.addEventListener" ALNScanner/src/main.js` → 7 lines |
| 7 | Orphan forwarded events | **1** (`session:updated`) | `grep -rn "'session:updated'" ALNScanner/src` → 4 hits, all emit/forward sites, 0 listener sites |
| 8 | Recorded desync classes re-verified | **5** (2 COVERED outright + 1 COVERED-with-a-caveat + 1 UNCOVERED-and-unfixed + 1 UNCOVERED-by-construction/pending-Block-2) | Per-class file:line + test citations in §8 |
| 9 | Scanner-side files matching stateStore/messageRouters/MonitoringDisplay | **11** | `grep -rl "stateStore\|messageRouters\|MonitoringDisplay" ALNScanner/tests \| wc -l` → 11 |
| 9 | Renderer test files, store-fed only | **7 of 11** | `ls ALNScanner/tests/unit/ui/renderers/*.test.js` → 11 files; 4 are out-of-scope (`GameOpsRenderer.glyphEscape.test.js`, `GameOpsRenderer.rating.test.js`, `EvidencePickerRenderer.test.js`, `gameActivityClasses.test.js`) leaving 7 (Cue/Environment/Health/HeldItems/Music/Session/Video Renderer) — matches the 7 renderer classes named in §5/§11 exactly |
| 9 | Backend files matching `service:state`/`getState()` (raw string match, includes helpers and e2e flows that touch it only incidentally) | **32** | `grep -rl "service:state\|getState()" backend/tests \| wc -l` → 32 (the curated subset actually itemized by name in §9's table is smaller; this row is the raw grep, not a claim that all 32 are dedicated store-path unit tests) |
| 10 | `toHaveScreenshot` visual-regression assertions | **0** | `grep -rn "toHaveScreenshot" ALNScanner/tests backend/tests \| wc -l` → 0 |
| 10 | Raw diagnostic `page.screenshot()` call sites | **3** (scanner) + **2 helper methods** (backend, unused for comparison) | `grep -rn "screenshot(" ALNScanner/tests/e2e backend/tests/e2e` |

---

## Disagreements with claim 4

None found. Every re-verified number in claim 4 — 10 domains, 55 producer edges, 10 restore guards, 5 reshaping adapters, 22 `MESSAGE_TYPES`, 22 asyncapi subscribe entries (0 diff), 8 forwarded vs 7 consumed DataManager events (1 orphan: `session:updated`), 1 domain with no renderer (`sound`), 5 recorded desync classes — held exactly on this walked tree. The structural code (MonitoringDisplay's wiring split into four domain-grouped private methods) moved since claim 4 was written, but the counts and behavior underneath did not change.

What this census adds beyond claim 4 (new findings, not disagreements — claim 4 didn't check these):
- The `music` domain's `service:state` push carries `playlists[]` on every push (`broadcasts.js:496,502`, `buildMusicState`), while the AsyncAPI contract's own prose (`asyncapi.yaml:2354,2578`) says playlists ride `sync:full` only — code and contract documentation directly contradict each other (§2).
- `backend/tests/contract/websocket/service-domain-state.test.js`'s music producer calls `musicService.getState()` directly rather than the real push-time `buildMusicState()`, so its contract pin never exercises the `playlists` field the wire actually carries (§2/§9).
- The `sound` domain's sync:full restore guard (`messageRouters.js:136`) has zero test coverage — `networkedSession.test.js`'s own "populate all service domains" test explicitly stops at 9 domains, skipping `sound` (§9).
- `dormant` (CONTEXT.md-ratified third health word) exists in exactly one file in the whole tree (`backend/src/gameRules/resolution.js`, the unrelated verdict resolver) and has not reached the health-service/`service:state`/`StateStore`/`HealthRenderer` path at all — confirming CS.2/Block 2 dormancy work is genuinely not started on the store-fed surface, not merely undertested (§8e).
- The MPD "setvol while stopped" bug (§8c) has no code fix and no regression test anywhere — the only reference is a test harness that sequences around it.
