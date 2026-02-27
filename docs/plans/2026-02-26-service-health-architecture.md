# Service Health Architecture

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current silent-degradation architecture with a system where every service is honest about its state, the GM has full visibility into service health, and failed/blocked actions are held for GM decision — never silently dropped or simulated.

**Core Principle:** Every service is essential. Every failure is surfaced. Every service is recoverable. The GM decides what to do.

**Architecture:** Four layers of change: (1) Service Health Registry — centralized health tracking, (2) Honest Services — remove all silent simulation, (3) Gated Execution — commands and cues check health before dispatching, (4) GM Visibility — unified health dashboard and held items queue.

**Tech Stack:** Node.js (backend services, EventEmitter), ES6 modules (GM Scanner), Jest (both), Vite (GM Scanner build)

**Supersedes:** `docs/plans/2026-02-26-show-control-audit-fixes.md` — the original 13-task plan addressed symptoms of the same root cause. Tasks 1, 2, 3, 4, 5, 6, 7, 9, 10, 12 from that plan are still valid fixes that integrate into this architecture. Tasks 8 and 11 are replaced by this design (Layer 3 gated execution covers Task 8's VLC degraded mode reporting; `spotify:reconnect` is subsumed by `service:check` which covers Task 11's ack data enrichment).

---

## Implementation Status (Updated 2026-02-27)

| Phase | Status | Tasks | Notes |
|-------|--------|-------|-------|
| Phase -1 | **COMPLETE** | 2/2 | Integration test baseline established (256/256) |
| Phase 0 | **COMPLETE** | 13/13 | All preserved bug fixes + contract updates |
| Phase 1 | **COMPLETE** | 12/12 | Registry operational, all 8 services reporting, pragmatic deviations documented below |
| Phase 2 | **COMPLETE** | 5/5 | Honest services — all simulation removed, per-command cue tracking, stateService cleanup |
| Phase 3 | Not started | 0/8 | Gated execution |
| Phase 4 | Not started | 0/11 | GM visibility |
| Phase 5 | Not started | 0/6 | Documentation + cleanup |

**Test baselines after Phase 2:** Backend unit+contract: 1196 tests (2 todo), 67 suites. Integration: 256 tests, 30 suites. ALNScanner unit: 974.

### Phase 1 Deviations from Plan

These are intentional pragmatic choices made during implementation:

1. **`isConnected()` wrappers kept on vlcService, spotifyService, lightingService.** Plan said to remove these methods. Instead, they were kept as thin wrappers delegating to `registry.isHealthy()`. This avoids updating all consumer call sites during Phase 1. Consumers will be updated as part of Phase 2 (honest services) and Phase 3 (gated execution) when they're already being touched.

2. **No periodic health checks for bluetooth, audio, sound.** Plan called for adding periodic probes (e.g., `bluetoothctl show`, `pactl info`, `which pw-play`). Instead, services report at init/reset only. Dedicated `checkHealth()` methods will be added in Phase 3 when implementing the `service:check` gm:command dispatch table, which is the only consumer of on-demand health checks.

3. **`heldItems` not added to sync:full.** Plan listed this under Layer 1 sync:full integration, but it depends on `cueEngineService.getHeldCues()` and `videoQueueService.getHeldVideos()` methods which are Phase 3 features. Moved to Phase 3 task 3e.

4. **`stateService` legacy properties not removed.** ~~`vlcConnected` and `videoDisplayReady` still exist in `stateService.js` but are never updated (dead). Cleanup deferred to Phase 2 when stateService is being modified anyway.~~ **Resolved in Phase 2 (task 2e).**

5. **gameClockService reports `'healthy'` on reset** (plan implied `'down'`). In-process timer is always available — reset just means the clock is stopped, not that the service is broken.

### Phase 2 Deviations from Plan

1. **Contract test `scan.test.js` "should return 409 when video already playing" → `it.todo`.** Removing VLC simulation means videos fail immediately when VLC is down instead of entering "playing" state. The 409 path (`videoQueueService.isPlaying()` in scanRoutes.js) is only reachable when VLC is healthy. This test relied on simulation to fake the precondition. Converted to `it.todo` — **re-enable in Phase 3c** when `canAcceptVideo()` gates the scan route.

2. **`lightingService._usingFallback` is now dead code.** `activateScene()` was the only reader of this flag (via `if (this._usingFallback || ...)`). After removing the simulation check, `_usingFallback` is set in `getScenes()`/`_loadFallbackScenes()`/`reset()` but never read. **Remove in Phase 5** (cleanup).

### Additional Work Done Beyond Plan

These items were identified during code review and fixed during Phase 1:

- **`stateRoutes.js`**: Replaced `systemStatus` with `serviceHealth: registry.getSnapshot()`. Plan listed the openapi.yaml contract update but missed the implementation file.
- **`deviceTracking.js`**: Replaced inline sync:full payload construction with `buildSyncFullPayload()`, eliminating code duplication that had already caused a `systemStatus`/`serviceHealth` divergence.
- **Dead `offlineQueueService` params**: Removed from `broadcasts.js` (2 calls) and `server.js` (1 call) — passed to `buildSyncFullPayload()` which doesn't use it.
- **`soundService.init()`**: Refactored from raw `child_process.execFile` to shared `execFileAsync` from `utils/execHelper.js`.
- **Dead VLC listeners in `app.js`**: Removed `connected`/`disconnected` listeners that updated `stateService` — those events no longer exist.

---

## Design Principles

1. **No silent failures.** If a service is called and can't do what was asked, it throws. No simulated events, no fake success responses, no `{degraded: true}` returns.

2. **One health channel.** All service health flows through the registry. No service tracks its own `this.connected` boolean. No direct-to-DOM health writes. No scattered connection indicators.

3. **GM decides.** Nothing auto-resumes after an outage. Video queue items, held cues — the GM reviews everything and releases or discards. The system provides information and options, not decisions.

4. **Unified hold system.** Cue conflicts (video busy) and service outage holds use the same data structure, same GM-facing UI, same release/discard flow. The existing `pendingConflicts` in cueEngineService merges into this.

5. **Pre-show verification.** The GM can verify all services and all cue resource dependencies before the game starts.

---

## Layer 1: Service Health Registry

### New File: `backend/src/services/serviceHealthRegistry.js`

A lightweight singleton that tracks service health. Services push state in, consumers read it out.

```javascript
class ServiceHealthRegistry extends EventEmitter {
  // Map<serviceId, { status: 'healthy'|'down', message: string, lastChecked: Date }>
  constructor()

  // Called by services when their health changes
  report(serviceId, status, message = '')

  // Called by consumers to check before dispatching
  isHealthy(serviceId) → boolean

  // Called by commandExecutor to check before dispatching
  getStatus(serviceId) → { status, message, lastChecked }

  // Called by syncHelpers for sync:full payload
  getSnapshot() → Map<serviceId, { status, message, lastChecked }>

  // Emits: 'health:changed', { serviceId, status, message, previousStatus }
}
```

**Registered services:** `vlc`, `spotify`, `sound`, `bluetooth`, `audio`, `lighting`, `gameclock`, `cueengine`

**Not a god object.** The registry doesn't manage services, restart them, or make decisions. It's a bulletin board — services post, consumers read.

### Service Consolidation

Each service's health tracking consolidates into registry calls. The service keeps its reconnection/polling logic (it knows how to talk to its dependency) but stops maintaining its own `this.connected` flag and stops emitting its own connection events.

| Service | Current Health Pattern | Consolidated To | Phase 1 Status |
|---|---|---|---|
| vlcService | `this.connected`, `startHealthCheck()` (10s poll), emits `connected`/`disconnected`/`degraded` | `registry.report('vlc', ...)` from `checkConnection()`. `isConnected()` wraps `registry.isHealthy('vlc')`. `this.connected` removed. All three events removed. `degraded` eliminated — binary health only. | **DONE** — `isConnected()` kept as wrapper (see deviation #1) |
| spotifyService | `this.connected`, `_setConnected()`, emits `connection:changed` | `registry.report('spotify', ...)` from `_setConnected()`. `this.connected` removed. `connection:changed` event removed. | **DONE** — `_setConnected()` now delegates to registry |
| lightingService | `this._connected`, `checkConnection()` (30s reconnect), emits `connection:changed` | `registry.report('lighting', ...)` from `checkConnection()`. `this._connected` removed. `connection:changed` event removed. `isConnected()` wraps registry + token check. | **DONE** — `isConnected()` kept as wrapper (see deviation #1) |
| bluetoothService | `isAvailable()` (live probe via `bluetoothctl show` — no cached state), no polling | `registry.report('bluetooth', ...)` from `init()`. Periodic health check deferred to Phase 3 `service:check`. | **DONE** — periodic check deferred (see deviation #2) |
| audioRoutingService | Implicit health detection via `pactl subscribe` monitor process failure counter (`_monitorFailures`, `MONITOR_MAX_FAILURES`), but no explicit health API | `registry.report('audio', ...)` from `init()`. `checkHealth()` method deferred to Phase 3 `service:check`. | **DONE** — `checkHealth()` deferred (see deviation #2) |
| soundService | No health tracking at all | `registry.report('sound', ...)` from `init()` which probes `which pw-play` via `execFileAsync`. Named `checkHealth()` method deferred to Phase 3 `service:check`. | **DONE** — check in `init()`, named method deferred (see deviation #2) |
| gameClockService | In-process timer, no external dependency | `registry.report('gameclock', 'healthy')` on construction and reset (always healthy — in-process timer). | **DONE** |
| cueEngineService | No health tracking | `registry.report('cueengine', 'healthy')` after `loadCues()` succeeds, `'down'` on `reset()`. | **DONE** |

### Broadcasts Wiring

**New listener in `broadcasts.js`:**

```javascript
addTrackedListener(registry, 'health:changed', (data) => {
  emitToRoom(io, 'gm', 'service:health', data);
});
```

**Removed from broadcasts.js:** All individual service connection listeners that are replaced by the registry:
- spotifyService `connection:changed` (replaced by `service:health` with serviceId `spotify`)
- lightingService `connection:changed` (replaced by `service:health` with serviceId `lighting`)
- vlcService listeners (never existed, which was the original bug)

Spotify playback events (`playback:changed`, `volume:changed`, `track:changed`, `playlist:changed`) remain — those are operational events, not health events.

### sync:full Integration

**Phase 1 (DONE):** `syncHelpers.js` replaces the scattered health assembly with registry snapshot:

```javascript
// BEFORE (scattered, incomplete):
systemStatus: {
  orchestrator: 'online',
  vlc: vlcService.isConnected() ? 'connected' : 'disconnected',
  offline: offlineQueueService.isOffline
}

// AFTER (Phase 1 — registry snapshot):
serviceHealth: registry.getSnapshot(),
// Returns all 8 services with status, message, lastChecked
```

Also updated: `stateRoutes.js` (GET /api/state) uses `serviceHealth: registry.getSnapshot()`. `deviceTracking.js` replaced inline sync:full with `buildSyncFullPayload()`.

**Phase 3 (TODO):** Add `heldItems` field to sync:full payload:

```javascript
heldItems: buildHeldItemsState(cueEngineService, videoQueueService)
// Returns merged array from cueEngineService.getHeldCues() + videoQueueService.getHeldVideos()
```

`buildHeldItemsState()` follows the same pattern as `buildGameClockState()` / `buildCueEngineState()` / `buildSpotifyState()` — new function in syncHelpers.js that gracefully degrades to `[]` if services are unavailable. Depends on Phase 3 task 3e (cue engine hold system) and 3d (video queue hold behavior).

### GM Scanner Integration

**orchestratorClient.js:** Add `'service:health'` to the `messageTypes` array. Remove `'cue:conflict'` (replaced by `held:added`). Keep `'lighting:status'` in messageTypes — it still carries `scenes:refreshed` operational data; only the `connection:changed` listener in broadcasts.js is replaced by the registry.

**UnifiedDataManager:** New `updateServiceHealth(data)` method stores health in `this.serviceHealth` Map, dispatches `'service-health:updated'` CustomEvent.

**HealthRenderer (new):** Renders the health dashboard in the existing System Status section. Replaces MonitoringDisplay's direct-to-DOM VLC/orchestrator status writes.

**Removed from GM Scanner:**
- `SystemMonitor.js` — deleted entirely (unused class: instantiated in `adminController.js` line 57 and stored in `app.js` line 253 `adminInstances`, but no method is ever called). Removal requires updating:
  - `ALNScanner/src/app/adminController.js` — remove import (line 20) and `systemMonitor: new SystemMonitor(this.client)` (line 57)
  - `ALNScanner/src/app/app.js` — remove `systemMonitor: adminController.getModule('systemMonitor')` (line 253)
  - `ALNScanner/tests/unit/utils/adminModule.test.js` — remove SystemMonitor test suite (~lines 312-370)
  - `ALNScanner/tests/unit/AdminController.test.js` — remove SystemMonitor mock/assertions (~lines 28-29, 70, 119, 150)
  - `ALNScanner/tests/integration/service-wiring.test.js` — remove SystemMonitor mock (~lines 43-44, 93-94)
  - `ALNScanner/tests/app/app.test.js` — remove SystemMonitor mock (~lines 150-151)
- SpotifyRenderer's `spotify--disconnected` template with inline "Reconnect" button — connection status moves to health dashboard. Also remove `case 'spotifyReconnect':` from `domEventBindings.js` (~line 111) — reconnection now handled by health dashboard "Check Now" → `service:check` command. Remove `.spotify--disconnected` CSS rule from `ALNScanner/src/styles/components/spotify.css` (lines 5-11).
- EnvironmentRenderer's `#lighting-not-connected` element and "Retry" button — same consolidation. Also remove `case 'lightingRetry':` from `domEventBindings.js` (~lines 147-148).
- MonitoringDisplay's direct-to-DOM writes for VLC/orchestrator status dots (lines 254-259, 317-325)
- `CueRenderer.renderConflict()` method (~lines 164-203) — dead code after `cue:conflict` removal
- `#cue-conflict-container` div from `index.html` (line ~421) — orphaned element

---

## Layer 2: Honest Services

### Remove Silent Simulation

Every method that currently checks `if (!this.connected) { emit success; return; }` gets that pattern removed. The method throws instead.

**vlcService.js** — the largest change. Two simulation patterns to remove:

**Pattern 1 — Disconnect guards:** Every method (pause, resume, stop, skip, playVideo, setVolume, seek, toggleFullscreen, clearPlaylist, addToPlaylist, setLoop) currently has:
```javascript
if (!this.connected) {
  logger.warn('VLC not connected - simulating pause');
  this.emit('video:paused');  // fake event
  return;                      // fake success
}
```
Replace with:
```javascript
if (!registry.isHealthy('vlc')) {
  throw new Error('VLC not connected');
}
```

**Pattern 2 — Catch block simulation:** The catch blocks in `stop()`, `pause()`, `resume()`, `skip()` also emit fake success events (e.g., `stop()` catches the error then emits `video:stopped` anyway). Remove the fake event emissions from catch blocks — let errors propagate.

The `playVideo()` method also returns `{degraded: true}` on both disconnection and catch — both paths get replaced with throws.

Note: `setLoop()` catch block already throws (partial honest behavior). Its disconnect guard at line 482 still silently returns and needs the same fix as the others. `getStatus()` returns a fake status object when disconnected — should throw or be gated by registry.

**lightingService.js** — `activateScene()` currently simulates activation when disconnected (emits `scene:activated`, updates `_activeScene`). Replace with throw. The catch block that swallows HA API failures also becomes a throw.

**videoQueueService.js** — `pauseCurrent()`, `resumeCurrent()`, `skipCurrent()` currently catch VLC errors and emit success events anyway. Remove the try/catch around VLC calls — let errors propagate. The success events (`video:paused`, `video:resumed`) only emit after confirmed VLC success.

**cueEngineService.js** — `fireCue()` currently emits `cue:completed` even when individual commands failed. Change to track per-command success and emit `cue:completed` with a `{ completedCommands, failedCommands }` payload so the GM knows what actually happened.

### Fix Latent Bug

`cueEngineService.resolveConflict()` line 883 calls `videoQueueService.stopCurrent()` which doesn't exist. Replace with `videoQueueService.skipCurrent()`.

---

## Layer 3: Gated Execution

### commandExecutor Service Dependency Map

```javascript
const SERVICE_DEPENDENCIES = {
  'video:play': 'vlc',
  'video:pause': 'vlc',
  'video:stop': 'vlc',
  'video:skip': 'vlc',
  'video:queue:add': 'vlc',
  'video:queue:reorder': 'vlc',
  'video:queue:clear': 'vlc',
  'spotify:play': 'spotify',
  'spotify:pause': 'spotify',
  'spotify:stop': 'spotify',
  'spotify:next': 'spotify',
  'spotify:previous': 'spotify',
  // Note: spotify:reconnect removed (subsumed by service:check)
  'sound:play': 'sound',
  'sound:stop': 'sound',
  'lighting:scene:activate': 'lighting',
  'lighting:scene:refresh': 'lighting',
  'bluetooth:pair': 'bluetooth',
  'bluetooth:unpair': 'bluetooth',
  'bluetooth:connect': 'bluetooth',
  'bluetooth:disconnect': 'bluetooth',
  'bluetooth:scan:start': 'bluetooth',
  'bluetooth:scan:stop': 'bluetooth',
  'audio:route:set': 'audio',
  'audio:volume:set': 'audio',
  'audio:combine:create': 'audio',
  'audio:combine:destroy': 'audio',
};
```

Before executing any command, commandExecutor checks:
```javascript
const requiredService = SERVICE_DEPENDENCIES[action];
if (requiredService && !registry.isHealthy(requiredService)) {
  const { status, message } = registry.getStatus(requiredService);
  return {
    success: false,
    message: `${requiredService} is ${status}: ${message}`,
    source
  };
}
```

This is the fast path — clean error message without touching the service. The service-level throws (Layer 2) are the safety net if the registry is stale.

### Command Validation (Pre-Show Verification)

New function in commandExecutor: `validateCommand(action, payload)` — checks service health AND resource existence without executing.

```javascript
async function validateCommand(action, payload) {
  const requiredService = SERVICE_DEPENDENCIES[action];
  const errors = [];

  // 1. Check service health
  if (requiredService && !registry.isHealthy(requiredService)) {
    errors.push({ type: 'service', service: requiredService, status: registry.getStatus(requiredService) });
  }

  // 2. Check resource existence
  switch (action) {
    case 'sound:play':
      if (!soundService.fileExists(payload.file))
        errors.push({ type: 'resource', message: `Sound file not found: ${payload.file}` });
      break;
    case 'video:queue:add':
      if (!videoQueueService.videoFileExists(payload.videoFile))
        errors.push({ type: 'resource', message: `Video file not found: ${payload.videoFile}` });
      break;
    case 'lighting:scene:activate':
      if (!lightingService.sceneExists(payload.sceneId))
        errors.push({ type: 'resource', message: `Scene not found: ${payload.sceneId}` });
      break;
    case 'audio:route:set':
      if (!audioRoutingService.sinkExists(payload.sink))
        errors.push({ type: 'resource', message: `Audio sink not found: ${payload.sink}` });
      break;
  }

  return { valid: errors.length === 0, errors };
}
```

Services get corresponding resource-check methods:
- `soundService.fileExists(filename)` — `fs.existsSync()` on configured sound path
- `videoQueueService.videoFileExists(filename)` — `fs.existsSync()` on `public/videos/`
- `lightingService.sceneExists(sceneId)` — checks cached scene list
- `audioRoutingService.sinkExists(sinkName)` — checks cached sink list

### videoQueueService.canAcceptVideo()

Single source of truth for "can we play a video right now?" — checks both VLC health and queue state:

```javascript
canAcceptVideo() {
  if (!registry.isHealthy('vlc'))
    return { available: false, reason: 'vlc_down', message: 'VLC is offline' };
  if (this.isPlaying())
    return { available: false, reason: 'video_busy', waitTime: this.getRemainingTime() };
  return { available: true };
}
```

Four consumers, one method:
- `scanRoutes.js` single scan (line 130) → 409 to player scanner if unavailable
- `scanRoutes.js` batch endpoint (line 272) → skip video queueing if unavailable (currently also uses direct `isPlaying()` check)
- `commandExecutor` → `{success: false}` to GM if unavailable
- `cueEngineService` → holds the cue if unavailable

### Video Queue Hold Behavior

`processQueue()` checks registry before attempting playback:

```javascript
async processQueue() {
  if (this.currentItem && this.currentItem.isPlaying()) return;

  const nextItem = this.queue.find(item => item.isPending());
  if (!nextItem) {
    this.currentItem = null;
    this.emit('video:idle');
    return;
  }

  // NEW: Check VLC health before attempting
  if (!registry.isHealthy('vlc')) {
    // Don't fail the item — hold it
    this.emit('video:held', nextItem);
    return;
  }

  try {
    await this.playVideo(nextItem);
  } catch (error) {
    // ...existing error handling...
  }
}
```

When VLC recovers, the registry emits `health:changed`. videoQueueService listens and emits `video:recoverable` to notify the GM that held video items can now be released. The GM releases them from the held items UI.

### Cue Engine Hold System

The existing `pendingConflicts` Map in cueEngineService merges with a new `heldCues` system. Both represent "cue blocked, waiting for GM decision."

**Unified held item structure:**

```javascript
{
  id: 'held-001',                          // unique ID
  type: 'cue' | 'video',                   // what kind of item
  heldAt: Date.now(),                       // when it was held
  blockedBy: ['sound'],                     // which services were down
  reason: 'service_down' | 'video_busy',   // why it was held

  // For cues:
  cueId: 'attention-before-video',
  trigger: { event: 'video:loading', data: {...} },
  commands: [ { action: 'sound:play', payload: {...} }, ... ],

  // For video items:
  tokenId: 'jaw011',
  videoFile: 'jaw011.mp4',
  requestedBy: 'player-device-id',
  source: 'player-scan' | 'gm' | 'cue',

  status: 'held' | 'released' | 'discarded'
}
```

**In cueEngineService.fireCue():**

Before dispatching commands, check each command's service dependency:

```javascript
const blockedServices = [];
for (const cmd of cue.commands) {
  const dep = SERVICE_DEPENDENCIES[cmd.action];
  if (dep && !registry.isHealthy(dep)) {
    blockedServices.push(dep);
  }
}

if (blockedServices.length > 0) {
  const held = this._holdCue(cue, triggerEvent, blockedServices);
  this.emit('cue:held', held);
  return;
}
```

**Compound cues mid-timeline:** If a service goes down while a compound cue timeline is executing, the timeline pauses (same mechanism as session pause). The compound cue appears in the held items queue. On release, the timeline resumes from where it stopped. On discard, the remainder is abandoned.

**Conflict resolution merged:** The existing `pendingConflicts` for video busy scenarios uses the same held item structure with `reason: 'video_busy'`. The 10-second auto-cancel timer remains as a configurable policy (conflicts auto-cancel, service-down holds never do).

### Cue Engine Events

| Event | When | Payload |
|---|---|---|
| `cue:held` | Cue blocked by service health or resource contention | Held item structure |
| `cue:released` | GM released a held cue | `{ heldId, cueId }` |
| `cue:discarded` | GM discarded a held cue | `{ heldId, cueId }` |

Existing events unchanged: `cue:fired`, `cue:completed` (now with `completedCommands`/`failedCommands`), `cue:error`, `cue:status`.

**`cue:conflict` removal (not deprecated — deleted):** `cue:conflict` is replaced entirely by `cue:held` with `reason: 'video_busy'`. Full removal chain:

**Backend:**
1. `cueEngineService.js`: stop emitting `cue:conflict`, emit `cue:held` instead
2. `broadcasts.js`: remove `cue:conflict` listener (line ~720), add `cue:held` → `held:added` mapping
3. `commandExecutor.js`: remove `cue:conflict:resolve` case (line ~491), replace with `held:release`/`held:discard` routing

**GM Scanner:**
4. `orchestratorClient.js`: remove `'cue:conflict'` from messageTypes (line 272), add `'held:added'`
5. `networkedSession.js`: remove `cue:conflict` case handler (lines 311-313), add `held:added` routing to DataManager
6. `unifiedDataManager.js`: remove `handleCueConflict()` method (lines 1051-1056), add `updateHeldItems()` method
7. `MonitoringDisplay.js`: remove `cue:conflict` event listener (line 53) and toast handler (lines 136-141)
8. `CueRenderer.js`: remove `renderConflict()` method (~lines 164-203) — dead code
9. `CueController.js`: remove `resolveConflict()` method (~line 90) that sends `cue:conflict:resolve`, replace with `releaseHeld()`/`discardHeld()` for the new held items system
10. `domEventBindings.js`: remove `case 'resolveConflictCue':` handler (~lines 87-94), replace with held items release/discard handlers
11. `index.html`: remove `#cue-conflict-container` div (line ~421)

**Contracts:**
12. `asyncapi.yaml`: remove `cue:conflict` channel definition (line ~2850) and `cue:conflict:resolve` from gm:command actions (line ~2050)

---

## Layer 4: GM Visibility

### Health Dashboard (Expanded System Status Section)

The existing System Status section in `index.html` (lines 485-503) becomes the health dashboard. Currently has 3 items (orchestrator dot, VLC dot, device count). Expands to cover all 8 services with consistent rendering.

**Per-service row:**
- Status indicator (green/red — binary, no amber)
- Service name
- Status message (e.g., "Connected" or "HA container not running")
- Last checked timestamp
- "Check Now" button → sends `service:check` command

**Bulk actions:**
- "Verify All" button → sends `service:check` for all services simultaneously
- "Test Cues" button → sends `cue:verify-all` command, results displayed inline

**What gets removed from other panels:**
- SpotifyRenderer's `spotify--disconnected` template with inline "Reconnect" button → connection status in health dashboard, SpotifyRenderer always renders playback controls (disabled when spotify is down)
- EnvironmentRenderer's `#lighting-not-connected` element and "Retry" button → consolidated into health dashboard
- MonitoringDisplay's direct-to-DOM VLC/orchestrator status writes → replaced by HealthRenderer
- `SystemMonitor.js` → deleted

**Rendered by:** `HealthRenderer` (new file in `ALNScanner/src/ui/renderers/`). Wired through MonitoringDisplay via `service-health:updated` event from DataManager.

### Held Items Queue

New admin panel section positioned between health dashboard and show control sections.

**When empty:** Collapsed single line "No held items."

**When items exist:** Expanded with pulsing count badge. Each item shows:
- Item type icon (cue or video)
- Item name (cue ID or video filename)
- Blocked-by services
- Held duration (live-updating counter)
- Source (what triggered it)
- Release / Discard buttons
- Details expand (for cues: per-command checkboxes for partial release)

**Bulk actions:** "Release All" / "Discard All" at section top.

**Rendered by:** `HeldItemsRenderer` (new file in `ALNScanner/src/ui/renderers/`). Wired through MonitoringDisplay via `held-items:updated` event from DataManager.

**Backend events forwarded to GM (via broadcasts.js mapping):**
- `service:health` — registry `health:changed` forwarded directly
- `held:added` — mapped from `cue:held` (type `cue`) and `video:held` (type `video`) in broadcasts.js
- `held:released` — forwarded from cueEngineService `cue:released` / videoQueueService `video:released`
- `held:discarded` — forwarded from cueEngineService `cue:discarded` / videoQueueService `video:discarded`
- `video:recoverable` — VLC recovered, held videos can be released

broadcasts.js owns the mapping from service-specific events to unified `held:*` events. Same pattern as `cue:started` → `cue:status` with `state: 'running'` (line 710-711 today).

**orchestratorClient.js messageTypes changes:** Add `'service:health'`, `'held:added'`, `'held:released'`, `'held:discarded'`, `'video:recoverable'`. Remove `'cue:conflict'` (replaced by `'held:added'` with `reason: 'video_busy'`).

### Admin Command Error Feedback

All admin button clicks in `domEventBindings.js` currently fire-and-forget promises with no error handling. Add a `safeAdminAction` wrapper:

```javascript
function safeAdminAction(actionPromise, actionName) {
  if (actionPromise && typeof actionPromise.catch === 'function') {
    actionPromise.catch(err => {
      debug.log(`Command failed: ${actionName} — ${err.message}`, true);
    });
  }
}
```

Applied to ALL admin action cases in `handleAdminAction()`.

**Edge case — debounced volume slider:** The Spotify volume slider (domEventBindings.js lines 23-28) uses a debounced callback pattern. The actual promise is created inside the debounce callback, not returned from the `switch` case. The `safeAdminAction` wrapper must be applied **inside** the debounce callback, not at the `handleAdminAction` level:
```javascript
const debouncedSpotifyVolume = debounce((vol) => {
  safeAdminAction(adminController.getModule('spotifyController').setVolume(vol), 'Spotify Volume');
}, 300);
```

### New gm:command Actions

| Action | Payload | Description |
|---|---|---|
| `service:check` | `{serviceId}` or `{}` (all) | Trigger on-demand health check (see dispatch table below) |
| `cue:verify-all` | `{}` | Validate all cue service deps + resource existence |
| `held:release` | `{heldId, commands?}` | Release held item (optional partial command list) |
| `held:discard` | `{heldId}` | Discard held item |
| `held:release-all` | `{}` | Release all held items |
| `held:discard-all` | `{}` | Discard all held items |

**`spotify:reconnect` migration:** The existing `spotify:reconnect` gm:command (commandExecutor line 537) is subsumed by `service:check` with `serviceId: 'spotify'`. Remove `spotify:reconnect` case from commandExecutor and `SERVICE_DEPENDENCIES` map. The health dashboard "Check Now" button for Spotify replaces the old SpotifyRenderer "Reconnect" button.

**`service:check` dispatch table in commandExecutor:**

The registry is passive — services push state. `service:check` forces an on-demand probe by calling each service's existing check method. Each method internally calls `registry.report()` as part of Layer 1 consolidation.

```javascript
const HEALTH_CHECKS = {
  vlc: () => vlcService.checkConnection(),
  spotify: () => require('./spotifyService').checkConnection(),
  lighting: () => lightingService.checkConnection(),
  bluetooth: () => bluetoothService.isAvailable(),
  audio: () => audioRoutingService.checkHealth(),     // new method
  sound: () => soundService.checkHealth(),             // new method
  gameclock: () => true,                               // in-process, always healthy
  cueengine: () => getCueEngine().getCues().length > 0,
};
```

If `payload.serviceId` is provided, check that one service. If empty, check all. Same dispatch-table pattern as `BT_COMMANDS` in the existing bluetooth case block.

**`held:release`/`held:discard` routing in commandExecutor:**

Held items are owned by the service that created them. commandExecutor routes based on the held item's `type` field:
- `type: 'cue'` → `cueEngineService.releaseCue(heldId)` / `cueEngineService.discardCue(heldId)`
- `type: 'video'` → `videoQueueService.releaseHeld(heldId)` / `videoQueueService.discardHeld(heldId)`

For `held:release-all` / `held:discard-all`, commandExecutor calls both services.

---

## Preserved Fixes from Original Plan

These fixes from `2026-02-26-show-control-audit-fixes.md` are still valid and should be implemented alongside this architecture:

| Original Task | Fix | Why Still Needed |
|---|---|---|
| Task 1 | Route video:play/pause/stop through videoQueueService | Correct abstraction regardless of health system. Also fix `video:skip` not being awaited (line 160 of commandExecutor — fire-and-forget async call). |
| Task 2 | Add `queue:reordered` broadcast + `queue:pending-cleared` + `queue:reset` | Missing broadcast listeners |
| Task 3 | Await metadata in `_transport()`, null-protect `_refreshMetadata()` | Stale metadata bug independent of health. Note: `_parseMetadata()` already checks `if (!stdout) return null` so the null-protection is specifically about not overwriting `this.track` with null when parse returns null. |
| Task 4 | Emit `cue:status` on enable/disable | Missing event emission |
| Task 5 | Wire `video-state:updated` in MonitoringDisplay | Missing UI wire |
| Task 6 | Add `safeAdminAction` wrapper to all admin actions | Error feedback independent of health system (see Layer 4 for debounce edge case) |
| Task 7 | Emit `playback:changed` in `checkConnection()` when state changes | Independent concern — the registry reports health (connected/disconnected), but Spotify playback state (playing/paused/stopped) detected during probe needs its own event. Not covered by health architecture. |
| Task 9 | Add `sound:error` broadcast listener | Missing broadcast listener |
| Task 10 | Ducking status indicator in SpotifyRenderer | Independent concern — health dashboard shows service health, not ducking state. Ducking is an audio routing operational event. |
| Task 12 | Ducking volume failure reporting (`ducking:failed` event) | Independent concern — health architecture tracks service availability, not per-operation errors within a healthy service. |

Tasks 8 and 11 from the original plan are superseded by this architecture:
- **Task 8** (VLC degraded mode in command results): Covered by Layer 3 gated execution pre-dispatch health check.
- **Task 11** (Spotify reconnect ack data): `spotify:reconnect` is removed in favor of `service:check`, making the ack enrichment moot.

---

## What Does NOT Change

- **Video triggering paths.** `scanRoutes.js` calls `videoQueueService.addToQueue()`. GM admin and cue engine go through `commandExecutor` → `video:queue:add`. Standing cues like `attention-before-video` react to `video:loading` events from any source. No new event types.
- **Service reconnection logic.** Each service keeps its own polling/reconnection mechanism (vlcService 10s poll, spotifyService lazy probe, lightingService 30s reconnect). They just report to the registry instead of maintaining their own state.
- **Session lifecycle.** Setup → active → paused → active → ended. No new states.
- **Cue configuration format.** `cues.json` structure unchanged. No template variables. Cue payloads are static JSON passed through to commandExecutor.
- **Player scanner HTTP contract.** `POST /api/scan` and `POST /api/scan/batch` still return 200/409. The 409 check uses `canAcceptVideo()` instead of direct `isPlaying()` check.
- **Compound cue timeline mechanics.** Clock-driven and video-driven advancement unchanged. Pause/resume via session lifecycle unchanged.

---

## File Inventory

### New Files (Backend)
- `backend/src/services/serviceHealthRegistry.js` — Central health registry

### New Files (GM Scanner)
- `ALNScanner/src/ui/renderers/HealthRenderer.js` — Health dashboard renderer
- `ALNScanner/src/ui/renderers/HeldItemsRenderer.js` — Held items queue renderer

### Deleted Files
- `ALNScanner/src/admin/SystemMonitor.js` — Replaced by registry + HealthRenderer

### Modified Files (Contracts — FIRST)
- `backend/contracts/asyncapi.yaml`:
  - ~~Remove `cue:conflict` channel definition (line ~2850) and schema~~ → Phase 3f
  - ~~Remove `cue:conflict:resolve` from gm:command action enum (line ~2050)~~ → Phase 3f
  - Add `service:health` channel + schema — **DONE** (Phase 1)
  - ~~Add `held:added`, `held:released`, `held:discarded` channels + schemas~~ → Phase 3
  - ~~Add `video:recoverable` channel + schema~~ → Phase 3
  - ~~Add new gm:command actions to action enum: `service:check`, `cue:verify-all`, `held:release`, `held:discard`, `held:release-all`, `held:discard-all`~~ → Phase 3g
  - ~~Remove `spotify:reconnect` from gm:command action enum (subsumed by `service:check`)~~ → Phase 3g
  - Update `sync:full` schema: replace `systemStatus` with `serviceHealth` (Map of 8 services) — **DONE** (Phase 1). `heldItems` array → Phase 3
  - Add `cue:status` enabled/disabled states — **DONE** (Phase 0e)
  - Add `sound:error` in sound:status schema — **DONE** (Phase 0h)
- `backend/contracts/openapi.yaml`:
  - Update `GET /api/state` response schema: `systemStatus` → `serviceHealth` — **DONE** (Phase 1)
- `backend/contracts/README.md`:
  - Update `sync:full` response documentation (line ~365): `systemStatus` → `serviceHealth` — TODO. `heldItems` → Phase 3

### Modified Files (Backend)

**Phase 0+1 changes (DONE):**
- `backend/src/services/vlcService.js` — Report to registry from `checkConnection()`, `isConnected()` wraps registry, `this.connected` removed, `connected`/`disconnected`/`degraded` events removed. **(Phase 2a DONE):** All 12 methods — disconnect guards replaced with throws, catch-block fake events removed.
- `backend/src/services/spotifyService.js` — `_setConnected()` delegates to registry, `connection:changed` removed, metadata awaited in `_transport()`, null-protected `_refreshMetadata()`, `playback:changed` emitted in `checkConnection()` (Task 7). **Phase 1+0 DONE.**
- `backend/src/services/soundService.js` — Report to registry from `init()` via `execFileAsync`. **Remaining (Phase 3g):** Named `checkHealth()` method for `service:check`. **(Phase 3b):** `fileExists()` method.
- `backend/src/services/bluetoothService.js` — Report to registry at init/reset. **Remaining (Phase 3g):** Periodic health check + named `checkHealth()` for `service:check`.
- `backend/src/services/audioRoutingService.js` — Report to registry at init/reset, `ducking:failed` event emission (Task 12). **Remaining (Phase 3g):** `checkHealth()` probing `pactl info`. **(Phase 3b):** `sinkExists()` method.
- `backend/src/services/lightingService.js` — Report to registry from `checkConnection()`, `this._connected` removed, `connection:changed` removed, `isConnected()` wraps registry. **(Phase 2b DONE):** `activateScene()` throws on unhealthy or HA error, `_usingFallback` now dead code (Phase 5 task 5g). **(Phase 3b):** `sceneExists()` method.
- `backend/src/services/gameClockService.js` — Report to registry (always healthy). **Phase 1 DONE.**
- `backend/src/services/cueEngineService.js` — Report to registry (healthy after loadCues, down on reset), `cue:status` on enable/disable (Task 4), `resolveConflict()` fixed to use `skipCurrent()`. **(Phase 2d DONE):** `cue:completed` emits `{cueId, completedCommands, failedCommands}` for both simple and compound cues. **(Phase 3e):** Held cue system, merge pendingConflicts, `getHeldCues()`/`releaseCue()`/`discardCue()`, remove `cue:conflict` emission. **(Phase 3f):** Full `cue:conflict` removal chain.
- `backend/src/services/videoQueueService.js` — Duplicate `reset()` bug fixed, video commands routed through queue (Task 1). **(Phase 2c DONE):** pauseCurrent/resumeCurrent/skipCurrent propagate VLC errors, diagnostic log updated to use `registry.isHealthy('vlc')`. **Remaining (Phase 3c):** `canAcceptVideo()`. **(Phase 3d):** Queue hold behavior, `getHeldVideos()`/`releaseHeld()`/`discardHeld()`.
- `backend/src/services/commandExecutor.js` — Video commands routed through videoQueueService (Task 1), `video:skip` properly awaited. **Remaining (Phase 3a):** SERVICE_DEPENDENCIES map + pre-dispatch health check. **(Phase 3b):** `validateCommand()`. **(Phase 3g):** New held/service commands, remove `cue:conflict:resolve`, remove `spotify:reconnect`.
- `backend/src/websocket/broadcasts.js` — Registry `health:changed`→`service:health` broadcast, `sound:error` listener (Task 9), `queue:reordered`/`queue:pending-cleared`/`queue:reset` listeners (Task 2), dead `connection:changed` listeners removed, dead `offlineQueueService` params removed. **Remaining (Phase 3f):** Remove `cue:conflict` listener, add `cue:held`→`held:added` / `video:held`→`held:added` mapping, forward held:released/held:discarded.
- `backend/src/websocket/syncHelpers.js` — `systemStatus`→`serviceHealth` via `registry.getSnapshot()`, `vlcService` import removed, `offlineQueueService` param removed. **Remaining (Phase 3d/3e):** `buildHeldItemsState()`.
- `backend/src/websocket/deviceTracking.js` — Inline sync:full replaced with `buildSyncFullPayload()`. **Phase 1 DONE.**
- `backend/src/websocket/adminEvents.js` — **Remaining (Phase 3g):** Wire new command actions.
- `backend/src/services/cueEngineWiring.js` — No changes needed (event forwarding stays as-is).
- `backend/src/routes/stateRoutes.js` — `systemStatus`→`serviceHealth` via `registry.getSnapshot()`. **Phase 1 DONE** (not in original plan).
- `backend/src/routes/scanRoutes.js` — **Remaining (Phase 3c):** Use `canAcceptVideo()` instead of direct `isPlaying()` check.
- `backend/src/app.js` — Registry imported, `soundService.init()` added, dead VLC listeners removed. **Phase 1 DONE.**
- `backend/src/server.js` — Dead `offlineQueueService` param removed. **Phase 1 DONE** (not in original plan).

**Phase 2 additional files:**
- `backend/src/services/stateService.js` — **(Phase 2e DONE):** Removed `vlcConnected`/`videoDisplayReady` properties, `updateSystemStatus()`, `isSystemOperational()`. `getCurrentState()`/`createDefaultState()`/`createStateFromSession()` no longer pass these to GameState.
- `backend/src/models/gameState.js` — **(Phase 2e DONE):** Removed `vlcConnected`/`videoDisplayReady` from defaults and `fromSession()`. Removed `updateSystemStatus()` and `isSystemOperational()` methods.
- `backend/src/utils/validators.js` — **(Phase 2e DONE):** Removed `vlcConnected`/`videoDisplayReady` from `gameStateSchema`.
- `backend/contracts/asyncapi.yaml` — **(Phase 2d):** Updated `cue:completed` schema to include `completedCommands`/`failedCommands` arrays.
- `backend/tests/contract/http/scan.test.js` — **(Phase 2c):** 409 test converted to `it.todo` (requires Phase 3c).

### Modified Files (GM Scanner)

**Phase 0 changes (DONE):**
- `ALNScanner/src/admin/MonitoringDisplay.js` — Wire `video-state:updated` (Task 5). **DONE.**
- `ALNScanner/src/ui/renderers/SpotifyRenderer.js` — Add `renderDucking()` method (Task 10). **DONE.** **Remaining (Phase 4f):** Remove disconnected template, always render controls (disabled when down).

**Phase 4 changes (TODO):**
- `ALNScanner/index.html` — Expand System Status section, add Held Items section, remove `#cue-conflict-container` div (line ~421)
- `ALNScanner/src/app/adminController.js` — Remove SystemMonitor import (line 20) and instantiation (line 57)
- `ALNScanner/src/app/app.js` — Remove `systemMonitor` from `adminInstances` (line 253)
- `ALNScanner/src/admin/MonitoringDisplay.js` — Wire HealthRenderer and HeldItemsRenderer, remove direct-to-DOM health writes, remove `cue:conflict` event listener (line 53) and toast handler (lines 136-141)
- `ALNScanner/src/admin/CueController.js` — Remove `resolveConflict()` method (~line 90) that sends `cue:conflict:resolve`, replace with `releaseHeld()`/`discardHeld()` methods
- `ALNScanner/src/ui/renderers/SpotifyRenderer.js` — Remove disconnected template, always render controls (disabled when down)
- `ALNScanner/src/ui/renderers/EnvironmentRenderer.js` — Remove `#lighting-not-connected` element and related show/hide logic
- `ALNScanner/src/ui/renderers/CueRenderer.js` — Remove `renderConflict()` method (~lines 164-203)
- `ALNScanner/src/core/unifiedDataManager.js` — Add `updateServiceHealth()`, `updateHeldItems()` methods, remove `handleCueConflict()` method (lines 1051-1056)
- `ALNScanner/src/network/orchestratorClient.js` — Add `service:health`, `held:*`, `video:recoverable` to messageTypes, remove `cue:conflict` (line 272)
- `ALNScanner/src/network/networkedSession.js` — Handle new event types (`service:health`, `held:added`, `held:released`, `held:discarded`, `video:recoverable`), remove `cue:conflict` handler (lines 311-313), route to DataManager
- `ALNScanner/src/utils/domEventBindings.js` — Add `safeAdminAction` wrapper to all admin actions (Task 6 — Phase 3h), remove `case 'spotifyReconnect':` (~line 111), remove `case 'lightingRetry':` (~lines 147-148), remove `case 'resolveConflictCue':` (~lines 87-94), add held items release/discard handlers
- `ALNScanner/src/styles/components/spotify.css` — Remove `.spotify--disconnected` CSS rule (lines 5-11)

### Modified Files (Tests)

**Backend tests updated in Phase 0+1 (DONE):**
- `backend/tests/helpers/browser-mocks.js` — Added `syncCueState()`, `updateSpotifyState()` to MockDataManager (Phase -1a)
- `backend/tests/integration/audio-routing-phase3.test.js` — Added `format` field to BT sink mocks (Phase -1b)
- `backend/tests/unit/services/serviceHealthRegistry.test.js` — New file (Phase 1a)
- `backend/tests/unit/services/vlcService.test.js` — Registry integration tests
- `backend/tests/unit/services/spotifyService.test.js` — Registry + metadata timing tests
- `backend/tests/unit/services/lightingService.test.js` — Registry integration tests
- `backend/tests/unit/services/bluetoothService.test.js` — Registry integration tests
- `backend/tests/unit/services/audioRoutingService.test.js` — Registry integration tests
- `backend/tests/unit/services/soundService.test.js` — Registry + execFileAsync tests
- `backend/tests/unit/services/gameClockService.test.js` — Registry integration tests
- `backend/tests/unit/services/cueEngineService.test.js` — Registry + cue:status tests
- `backend/tests/unit/services/videoQueueService.test.js` — Registry integration tests
- `backend/tests/unit/services/commandExecutor.test.js` — Video routing through videoQueueService tests
- `backend/tests/unit/websocket/broadcasts.test.js` — service:health broadcast, queue listeners, dead listener removal
- `backend/tests/contract/http/state.test.js` — systemStatus→serviceHealth assertions
- `backend/tests/contract/scanner/event-handling.test.js` — Updated sync:full mock payloads
- `backend/tests/contract/websocket/session-events.test.js` — Updated sync:full assertions
- `backend/tests/integration/state-synchronization.test.js` — serviceHealth shape validation
- `backend/tests/integration/compound-cues.test.js` — Updated for Phase 0 changes
- `backend/tests/e2e/helpers/assertions.js` — Updated `assertSyncFullStructure`

**ALNScanner tests (TODO — Phase 4):**
- `ALNScanner/tests/unit/utils/adminModule.test.js` — Remove SystemMonitor test suite (~lines 312-370)
- `ALNScanner/tests/unit/AdminController.test.js` — Remove SystemMonitor mock/assertions (~lines 28-29, 70, 119, 150)
- `ALNScanner/tests/integration/service-wiring.test.js` — Remove SystemMonitor mock (~lines 43-44, 93-94)
- `ALNScanner/tests/app/app.test.js` — Remove SystemMonitor mock (~lines 150-151)
- `ALNScanner/tests/unit/ui/renderers/SpotifyRenderer.test.js` — Update for removed disconnected template
- `ALNScanner/tests/unit/ui/renderers/EnvironmentRenderer.test.js` — Update for removed `#lighting-not-connected`
- Backend test files: Update mocks and assertions for Phase 2-3 changes (simulation removal, gated execution, new methods)

---

## Test Suite Baselines

**Updated 2026-02-27 after Phase 1 commit.** All suites must remain green throughout implementation.

| Suite | Command | Baseline | Notes |
|-------|---------|----------|-------|
| Backend unit+contract | `cd backend && npm test` | **1188** (1 todo), 67 suites | Was 1134 pre-Phase 1 |
| Backend integration | `cd backend && npm run test:integration` | **256**, 30 suites | Sequential (~5 min) |
| ALNScanner unit | `cd ALNScanner && npm test` | 974 | Fast feedback (~15s) |
| ALNScanner integration | `cd ALNScanner && npx jest tests/integration/` | 21 | Quick (~5s) |
| Backend e2e | `cd backend && npm run test:e2e` | Requires running orchestrator | Full stack (~5 min) |
| ALNScanner e2e | `cd ALNScanner && npm run test:e2e` | Requires Vite dev server | Scanner only (~3 min) |

---

## Implementation Order

Strict dependency ordering. Each phase must complete before the next begins.

### Phase -1: Fix Pre-Existing Integration Test Failures — COMPLETE

Fix 2 pre-existing bugs in test infrastructure to establish a clean 256/256 integration baseline.

| Task | Fix | Files | Tests Fixed | Status |
|------|-----|-------|-------------|--------|
| -1a. Add missing methods to MockDataManager | `MockDataManager` is missing `syncCueState()` and `updateSpotifyState()`. When `sync:full` arrives with `cueEngine`/`spotify` fields, `networkedSession.js:243` throws `TypeError: this.dataManager.syncCueState is not a function`. Add both as no-ops. | `backend/tests/helpers/browser-mocks.js` | 24 tests (admin-interventions 21, transaction-flow 2, error-handling 1) | **DONE** |
| -1b. Add `format` field to BT sink mocks | `createCombineSink()` filters sinks through `_isHighQualitySink()` which requires a `format` field. Mock sinks lack this → all filtered out → "found 0" instead of "found 2". Add `format: 's16le 2ch 48000Hz'` to mock BT sink objects. | `backend/tests/integration/audio-routing-phase3.test.js` | 1 test (combine-sink create) | **DONE** |

**Verification:** `cd backend && npm run test:integration` → 256/256 passing, 0 failures. Confirmed.

### Phase 0: Contracts + Preserved Bug Fixes (independent, parallelizable) — COMPLETE

These have no dependencies on the health architecture and can be done first to reduce risk per commit.

| Task | Layer | Files | Dependencies | Status |
|------|-------|-------|-------------|--------|
| 0a. Update contracts (asyncapi + openapi) | Contracts | `backend/contracts/asyncapi.yaml`, `openapi.yaml` | None | **DONE** — Phase 0 scope items (service:health channel, cue:status enabled/disabled, sound:error, systemStatus→serviceHealth in sync:full + GameState). Remaining contract changes (held:*, video:recoverable, cue:conflict removal, new gm:command actions) are Phase 3/4 scope. README.md not yet updated. |
| 0b. Task 1: Route video commands through videoQueueService | Preserved | `commandExecutor.js`, tests | None | **DONE** — video:play→resumeCurrent(), video:pause→pauseCurrent(), video:stop→skipCurrent()+clearQueue(), video:skip→skipCurrent() |
| 0c. Task 2: Add missing broadcast listeners | Preserved | `broadcasts.js`, tests | None | **DONE** — queue:reordered, queue:pending-cleared, queue:reset all wired |
| 0d. Task 3: Fix Spotify metadata timing | Preserved | `spotifyService.js`, tests | None | **DONE** — _transport() awaits _refreshMetadata(), null-protection prevents overwriting this.track |
| 0e. Task 4: Emit cue:status on enable/disable | Preserved | `cueEngineService.js`, tests | None | **DONE** — enableCue() and disableCue() emit cue:status |
| 0f. Task 5: Wire video-state:updated | Preserved | `MonitoringDisplay.js`, tests | None | **DONE** — MonitoringDisplay wires video-state:updated to videoRenderer.render() |
| 0g. Task 7: Emit playback:changed in checkConnection | Preserved | `spotifyService.js`, tests | None | **DONE** — checkConnection() detects state change and emits playback:changed |
| 0h. Task 9: Add sound:error broadcast | Preserved | `broadcasts.js`, tests | None | **DONE** — sound:error broadcasts as sound:status with error field |
| 0i. Task 10: Ducking status indicator | Preserved | `SpotifyRenderer.js`, `MonitoringDisplay.js`, tests | None | **DONE** — SpotifyRenderer.renderDucking() method added |
| 0j. Task 12: Ducking failure reporting | Preserved | `audioRoutingService.js`, tests | None | **DONE** — ducking:failed event emitted |
| 0k. Fix duplicate reset() in videoQueueService | Bug fix | `videoQueueService.js`, tests | None | **DONE** — single reset() definition |
| 0l. Fix resolveConflict() stopCurrent() bug | Bug fix | `cueEngineService.js`, tests | None | **DONE** — calls skipCurrent() |
| 0m. Fix commandExecutor video:skip not awaited | Bug fix | `commandExecutor.js`, tests | 0b (Task 1) | **DONE** — properly awaited |

**Verification:** All green. Confirmed.

### Phase 1: Service Health Registry (Layer 1) — COMPLETE

| Task | Files | Dependencies | Status |
|------|-------|-------------|--------|
| 1a. Create serviceHealthRegistry.js | `backend/src/services/serviceHealthRegistry.js`, `tests/unit/services/serviceHealthRegistry.test.js` | None | **DONE** |
| 1b. Wire registry into app.js | `backend/src/app.js` | 1a | **DONE** — also added `soundService.init()`, removed dead VLC listeners |
| 1c. Consolidate vlcService health | `vlcService.js`, tests | 1a | **DONE** — `this.connected` removed, `isConnected()` wraps registry, events removed |
| 1d. Consolidate spotifyService health | `spotifyService.js`, tests | 1a | **DONE** — `_setConnected()` delegates to registry, `connection:changed` removed |
| 1e. Consolidate lightingService health | `lightingService.js`, tests | 1a | **DONE** — `this._connected` removed, `isConnected()` wraps registry, `connection:changed` removed |
| 1f. Add bluetoothService health | `bluetoothService.js`, tests | 1a | **DONE** — reports at init/reset (periodic deferred) |
| 1g. Add audioRoutingService health | `audioRoutingService.js`, tests | 1a | **DONE** — reports at init/reset (checkHealth deferred) |
| 1h. Add soundService health | `soundService.js`, tests | 1a | **DONE** — check in init() via execFileAsync |
| 1i. Add gameClockService health | `gameClockService.js`, tests | 1a | **DONE** — always healthy |
| 1j. Add cueEngineService health | `cueEngineService.js`, tests | 1a | **DONE** — healthy after loadCues, down on reset |
| 1k. Wire registry to broadcasts.js | `broadcasts.js`, tests | 1a, 1c-1j | **DONE** — health:changed→service:health, dead listeners removed |
| 1l. Update syncHelpers.js | `syncHelpers.js`, tests | 1a | **DONE** — systemStatus→serviceHealth, vlcService import removed |

Additional files modified during Phase 1 (review fixes):
- `stateRoutes.js` — systemStatus→serviceHealth via registry.getSnapshot()
- `deviceTracking.js` — inline sync:full replaced with buildSyncFullPayload()
- `server.js` — dead offlineQueueService param removed
- `openapi.yaml` — GameState schema updated (systemStatus→serviceHealth)
- `asyncapi.yaml` — sync:full schema updated, ServiceHealth channel added
- 16 test files updated across unit/contract/integration/e2e

**Commit:** `9b4bc99c` — `feat: centralized Service Health Registry (Phase 1)`

**Verification:** 1188 unit+contract, 256 integration. All green.

### Phase 2: Honest Services (Layer 2) — COMPLETE

| Task | Files | Dependencies | Status |
|------|-------|-------------|--------|
| 2a. Remove vlcService simulation (guards + catch blocks) | `vlcService.js`, tests | 1c (DONE) | **DONE** — all 12 methods: disconnect guards → throw, catch-block fake events removed |
| 2b. Remove lightingService simulation | `lightingService.js`, tests | 1e (DONE) | **DONE** — activateScene() throws on unhealthy or HA error |
| 2c. Remove videoQueueService error swallowing | `videoQueueService.js`, tests | Phase 1 (DONE) | **DONE** — pauseCurrent/resumeCurrent/skipCurrent propagate VLC errors |
| 2d. Add cue:completed per-command tracking | `cueEngineService.js`, `phase1-events.test.js`, `asyncapi.yaml`, tests | Phase 1 (DONE) | **DONE** — simple + compound cues track completedCommands/failedCommands |
| 2e. Clean up stateService legacy properties | `stateService.js`, `gameState.js`, `validators.js` | Phase 1 (DONE) | **DONE** — vlcConnected/videoDisplayReady removed, updateSystemStatus/isSystemOperational removed |

**Deferred from Phase 1:** Task 2e was deferred from Phase 1 (deviation #4) — cleaned up in Phase 2.

**Test impact:** Removing simulation changes error behavior — integration tests that previously saw fake success events now see throws. Update mocks/assertions in affected integration tests alongside each task.

**Verification:** `cd backend && npm test` + `cd backend && npm run test:integration`. All green. Confirm no tests depend on fake success events.

### Phase 3: Gated Execution (Layer 3) — NOT STARTED

| Task | Files | Dependencies |
|------|-------|-------------|
| 3a. Add SERVICE_DEPENDENCIES + pre-dispatch health check | `commandExecutor.js`, tests | Phase 1 (DONE) |
| 3b. Add validateCommand() + resource check methods | `commandExecutor.js`, `soundService.js`, `videoQueueService.js`, `lightingService.js`, `audioRoutingService.js`, tests | 3a |
| 3c. Add canAcceptVideo() + wire to scanRoutes. **Re-enable** `scan.test.js` "should return 409 when video already playing" (converted to `it.todo` in Phase 2). | `videoQueueService.js`, `scanRoutes.js`, `tests/contract/http/scan.test.js`, tests | Phase 1 (DONE) |
| 3d. Add video queue hold behavior + heldItems in sync:full | `videoQueueService.js`, `syncHelpers.js`, tests | 3c, Phase 2 |
| 3e. Implement cue engine hold system + heldItems in sync:full | `cueEngineService.js`, `syncHelpers.js`, tests | 3a, Phase 2 |
| 3f. Merge pendingConflicts into held system + remove cue:conflict | Full chain (see `cue:conflict` removal section) | 3e |
| 3g. Add new gm:command actions (incl. service:check dispatch + checkHealth methods) + remove spotify:reconnect | `commandExecutor.js`, `adminEvents.js`, `soundService.js`, `bluetoothService.js`, `audioRoutingService.js`, tests | 3a, 3e, 3f |
| 3h. Add safeAdminAction wrapper (Task 6) | `domEventBindings.js`, tests | None (frontend-only) |

**Deferred from Phase 1 into 3d/3e:** `buildHeldItemsState()` and `heldItems` field in sync:full payload — depends on `getHeldCues()`/`getHeldVideos()` methods created in 3d/3e.

**Deferred from Phase 1 into 3g:** Named `checkHealth()` methods for bluetooth, audio, sound services — only consumer is the `service:check` gm:command dispatch table created in 3g.

**Test impact (update alongside implementation):**
- 3f: `compound-cues.test.js` — HEAVY rewrite: all `cue:conflict` + `pendingConflicts` + `resolveConflict()` tests (~16 tests) must migrate to `cue:held` + `heldCues` + `releaseCue()`/`discardCue()`. Update `cue:completed` payload assertions for `{completedCommands, failedCommands}`.
- 3g: `ALNScanner/tests/unit/admin/SpotifyController.test.js` — replace `spotify:reconnect` test with `service:check` equivalent
- 3h: `ALNScanner/tests/unit/utils/domEventBindings.test.js` (if exists) — add safeAdminAction wrapper tests

**Verification:** `cd backend && npm test` + `cd backend && npm run test:integration` + `cd ALNScanner && npm test`. All green. `cue:conflict` fully removed from both codebases.

### Phase 4: GM Visibility (Layer 4) — NOT STARTED

| Task | Files | Dependencies |
|------|-------|-------------|
| 4a. Delete SystemMonitor + clean up references | `SystemMonitor.js` (delete), `adminController.js`, `app.js`, 4 test files | None |
| 4b. Add service:health to orchestratorClient + networkedSession | `orchestratorClient.js`, `networkedSession.js` | Phase 1 (backend events exist) |
| 4c. Add updateServiceHealth() to UnifiedDataManager | `unifiedDataManager.js` | 4b |
| 4d. Create HealthRenderer | `HealthRenderer.js` (new) | 4c |
| 4e. Wire HealthRenderer into MonitoringDisplay | `MonitoringDisplay.js` | 4d |
| 4f. Remove scattered health UI (SpotifyRenderer, EnvironmentRenderer, MonitoringDisplay DOM writes) | `SpotifyRenderer.js`, `EnvironmentRenderer.js`, `MonitoringDisplay.js`, `index.html`, CSS, tests | 4e |
| 4g. Add held:* events to orchestratorClient + networkedSession | `orchestratorClient.js`, `networkedSession.js` | Phase 3 (backend events exist) |
| 4h. Add updateHeldItems() to UnifiedDataManager | `unifiedDataManager.js` | 4g |
| 4i. Create HeldItemsRenderer | `HeldItemsRenderer.js` (new) | 4h |
| 4j. Wire HeldItemsRenderer into MonitoringDisplay + index.html | `MonitoringDisplay.js`, `index.html` | 4i |
| 4k. Update CueController for held items release/discard | `CueController.js`, `domEventBindings.js` | 4j, 3f |

**Test impact (update alongside implementation):**
- 4a: Remove SystemMonitor from 4 test files:
  - `ALNScanner/tests/unit/utils/adminModule.test.js` — delete SystemMonitor suite (~lines 312-370)
  - `ALNScanner/tests/unit/AdminController.test.js` — remove SystemMonitor mock/assertions (~6 locations)
  - `ALNScanner/tests/integration/service-wiring.test.js` — remove SystemMonitor mock (~lines 43-44, 93-94)
  - `ALNScanner/tests/app/app.test.js` — remove SystemMonitor mock (~lines 150-151)
- 4b/4g: `orchestratorClient.test.js` — update `messageTypes` array: remove `'cue:conflict'`, add `'service:health'`, `'held:added'`, `'held:released'`, `'held:discarded'`, `'video:recoverable'`
- 4b/4g: `networkedSession.test.js` — remove `cue:conflict` handler test (mock at line 68), add tests for `service:health`, `held:added`, etc.
- 4f: `MonitoringDisplay-phase2.test.js` — delete `cue:conflict` describe block (~lines 136-175+), delete `_handleCueConflict` toast handler tests
- 4f: `adminModule.test.js` — fix `systemStatus.vlc` fixture (line 589) to use `serviceHealth` shape
- 4f: `SpotifyRenderer.test.js` — update for removed disconnected template, add ducking indicator tests
- 4f: `EnvironmentRenderer.test.js` — update for removed `#lighting-not-connected`
- New: `ALNScanner/tests/unit/ui/renderers/HealthRenderer.test.js` — unit tests for health dashboard (4d)
- New: `ALNScanner/tests/unit/ui/renderers/HeldItemsRenderer.test.js` — unit tests for held items queue (4i)

**Verification:** All suites: `cd backend && npm test` + `cd backend && npm run test:integration` + `cd ALNScanner && npm test` + `cd ALNScanner && npx jest tests/integration/`. All green.

### Phase 5: Documentation + Cleanup — NOT STARTED

| Task | Files | Dependencies |
|------|-------|-------------|
| 5a. Update root CLAUDE.md | `CLAUDE.md` | All phases |
| 5b. Update backend CLAUDE.md | `backend/CLAUDE.md` | All phases |
| 5c. Update ALNScanner CLAUDE.md | `ALNScanner/CLAUDE.md` | All phases |
| 5d. Full test suite verification (unit + integration) | Backend unit + integration, ALNScanner unit + integration | All phases |
| 5e. E2E test verification | Backend e2e (Playwright), ALNScanner e2e (Playwright) | All phases |
| 5f. GM Scanner production build | `npm run build` | All phases |
| 5g. Remove dead `_usingFallback` from lightingService | `lightingService.js`, `lightingService.test.js` | Phase 2 (DONE) |

**E2E test impact (5e):**
- `backend/tests/e2e/flows/admin-state-reactivity.test.js` — line 77 skip condition reads `systemStatus.vlc` → update to use `serviceHealth`
- `backend/tests/e2e/flows/30-full-game-session-multi-device.test.js` — verify lighting section visibility trigger still works after `connection:changed` removal
- `ALNScanner/tests/e2e/specs/phase2-validation.spec.js` — must be compatible with SystemMonitor deletion (module import errors would surface here)
- E2E `GMScannerPage` helpers — verify `sync:full` payload handling still works with `serviceHealth` replacing `systemStatus`

**Final verification:** All 6 test suites green (see Test Suite Baselines table). Production build succeeds. No `cue:conflict`, `spotify:reconnect`, `SystemMonitor`, `systemStatus`, or `this.connected` patterns remain in codebase (except legitimate non-health uses of `this.connected` in socket/connection code).

---

## Documentation Updates (Phase 5 Detail)

### Root CLAUDE.md (`CLAUDE.md`)
- **Service events table**: Remove `vlcService: connected, disconnected, degraded`. Remove `lightingService: connection:changed`. Remove `spotifyService: connection:changed`. Add `serviceHealthRegistry: health:changed`.
- **Phase 2 events table**: Remove `cue:conflict` row. Add `cue:held` row.
- **New events section**: Add `service:health`, `held:added`, `held:released`, `held:discarded`, `video:recoverable`.
- **sync:full documentation**: `systemStatus` → `serviceHealth` + `heldItems`.
- **gm:command table**: Add `service:check`, `cue:verify-all`, `held:release`, `held:discard`, `held:release-all`, `held:discard-all`. Remove `cue:conflict:resolve`. Remove `spotify:reconnect`.
- **Event Architecture notes**: Add `serviceHealthRegistry` singleton. Note that individual service connection events are consolidated into registry.
- **Fix stale claim**: Remove note about `audio:ducking:status` not being in orchestratorClient messageTypes — it already is (line 275).

### Backend CLAUDE.md (`backend/CLAUDE.md`)
- **Service singleton table**: Add `serviceHealthRegistry` row.
- **Key Services & Events section**: Remove `vlcService: connected, disconnected, degraded`. Remove `lightingService: connection:changed`. Remove `spotifyService: connection:changed`. Add `serviceHealthRegistry: health:changed`.
- **Phase 2 events table**: Remove `cue:conflict` row. Add `cue:held` row.
- **Admin Commands table**: Add new actions, remove `cue:conflict:resolve`, remove `spotify:reconnect`.
- **sync:full documentation**: Update to include `serviceHealth` and `heldItems`.
- **Debugging section**: Update VLC debugging to reference registry instead of `isConnected()`.
- **Fix CRITICAL Gotchas section**: Remove reference to `audio:ducking:status` not being forwarded to GM Scanner (it already is).

### ALNScanner CLAUDE.md (`ALNScanner/CLAUDE.md`)
- **Admin modules list**: Remove SystemMonitor. Add HealthRenderer, HeldItemsRenderer.
- **Renderer list**: Add HealthRenderer, HeldItemsRenderer.
- **Event handling**: Remove `cue:conflict` references. Add `service:health`, `held:added`, `held:released`, `held:discarded`, `video:recoverable`.
- **orchestratorClient messageTypes**: Update documented list.
- **Remove all SystemMonitor references** (~3 locations).
