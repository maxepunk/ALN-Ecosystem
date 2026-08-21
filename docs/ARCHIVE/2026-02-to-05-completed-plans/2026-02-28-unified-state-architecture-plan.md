# Unified State Architecture — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fragmented command/observation architecture with a single state flow — one store, one push mechanism, differential rendering — across both backend and frontend.

**Architecture:** See `docs/plans/2026-02-28-unified-state-architecture.md` (design doc).

**Tech Stack:** Node.js (backend), ES6 modules + Vite (ALNScanner), D-Bus MPRIS (VLC/Spotify), Socket.io (WebSocket), Jest (testing), Playwright (E2E)

---

## Review Decisions (2026-02-28)

These decisions were made during critical plan review and override the design doc where they differ:

1. **No post-command state push** — Task 4.3 from the original plan is removed. D-Bus monitors are the sole state authority. Pending button UX + ACK failure handling cover the feedback gap. No state push from commandExecutor.
2. **Store = service state only** — StateStore handles service domains (spotify, video, health, etc.) with snapshot/shallow-merge semantics. Session/transaction data stays in UDM + storage strategies (list/accumulator semantics). Intentional architectural boundary.
3. **Video domain = `video`** — Single domain owned by `videoQueueService.getState()`, which reads VLC playback state internally. Not two domains.
4. **StateStore is Networked-only** — In Standalone mode, the store is created but empty. Admin panel requires Networked mode. Scanning/transaction UI uses UDM (supports both modes).
5. **`_dbusCall()` is the override point** — No `_onDbusCallError()` hook. Spotify overrides the entire `_dbusCall()` method, calling `super._dbusCall()` for initial attempt and retry.
6. **SessionRenderer dual subscription** — Subscribes to both `session` and `gameclock` store domains (game clock display is visually part of the session panel).
7. **orchestratorClient update sequence** — Phase 5: add `service:state`. Phase 8: remove old event names. Never remove while backend still emits.
8. **vlcService baseline = 22 tests** (not 21).
9. **`clearPlaylist()` dropped** — `playVideo()` uses MPRIS OpenUri directly (replaces current media). No independent callers of clearPlaylist exist.
10. **Video lifecycle consolidated** — `video:loading/started/completed/failed/paused/idle/resumed` consolidated into `service:state` domain `video`. `video:progress` WebSocket broadcast removed. Backend keeps internal position polling for cue engine (reads from MPRIS). Frontend interpolates progress client-side.
11. **`skip()` = MPRIS Stop + emit `video:skipped`** — videoQueueService handles queue advancement (unchanged).
12. **`toggleFullscreen()` removed entirely** — command, button, and tests. Not used in show, VLC launched in fullscreen mode.
13. **ALNScanner build step** — `cd ALNScanner && npm run build` required before E2E at every checkpoint after ALNScanner source changes.
14. **ScreenUpdateManager replacement** — ScreenUpdateManager (state routing layer) is deleted. Badge logic moves to simple store/UDM listeners in main.js. Screen/container scoping dropped (differential rendering makes it unnecessary). Scanner/Admin/Debug tab navigation (`viewController`) is preserved — it's a layout concern, not a state concern. The 8 scanner screens within Scanner view and their `.active` class toggling are also preserved. Admin sections stay as vertical scrolling column. No layout redesign needed.
15. **Submodule commit strategy** — Each commit instruction specifies location (ecosystem vs ALNScanner submodule). Submodule commits first, then ecosystem ref update.

---

## Test Baselines (MUST match or exceed at every checkpoint)

| Layer | Location | Baseline | Command |
|-------|----------|----------|---------|
| Backend Unit+Contract | `backend/tests/unit/` + `tests/contract/` | 70 suites, 1384 pass (+1 todo) | `cd backend && npm test` |
| Backend Integration | `backend/tests/integration/` | 31 suites, 265 pass | `cd backend && npx jest --config jest.integration.config.js` |
| Backend E2E | `backend/tests/e2e/` | 16 files | `cd backend && npm run test:e2e` |
| ALNScanner Unit | `ALNScanner/tests/` | 57 suites, 1015 pass | `cd ALNScanner && npm test` |

**Key file test counts (track these for regression):**

| File | Tests | Layer |
|------|-------|-------|
| `vlcService.test.js` | 22 | Backend unit |
| `spotifyService.test.js` | 82 | Backend unit |
| `broadcasts*.test.js` (4 files) | 72 | Backend unit |
| `commandExecutor.test.js` | 95 | Backend unit |
| `videoQueueService.test.js` | 30 | Backend unit |
| `external-state-propagation.test.js` | 10 | Backend integration |
| `video-orchestration.test.js` | 5 | Backend integration |
| Renderers (6 files) | 35 | ALNScanner unit |
| UDM (5 files) | 65 | ALNScanner unit |
| `networkedSession.test.js` | 60 | ALNScanner unit |
| `ScreenUpdateManager.test.js` | 44 | ALNScanner unit |
| MonitoringDisplay (5 files) | 52 | ALNScanner unit |

---

## Phase Overview

| Phase | Scope | Risk | Dead Code Removed | Docs Updated |
|-------|-------|------|-------------------|--------------|
| **1** | MPRIS Base Class | Low (new code) | None | None |
| **2** | Spotify onto MPRIS Base | Medium (refactor) | Duplicated D-Bus code in spotifyService | backend/CLAUDE.md |
| **3** | VLC MPRIS + HTTP Removal | **HIGH** (service swap) | `vlcService.js` (entire file), mock VLC HTTP server, VLC HTTP config, `toggleFullscreen` command | backend/CLAUDE.md, config docs |
| **4** | Backend getState() + service:state | Medium (additive) | None (dual-emit period) | AsyncAPI contract, backend/CLAUDE.md |
| **5** | Frontend StateStore | Medium (additive) | None (dual-path period) | ALNScanner/CLAUDE.md |
| **6** | Differential Renderers | Medium (per-renderer) | innerHTML patterns per renderer | None |
| **7** | Frontend Old Path Removal | Medium (cleanup) | UDM updateX methods, networkedSession case router, ScreenUpdateManager (state routing layer — tab navigation preserved), MonitoringDisplay dual wiring | ALNScanner/CLAUDE.md |
| **8** | Backend Old Event Removal | Medium (cleanup) | Old per-service broadcasts, old orchestratorClient messageTypes entries | AsyncAPI contract, backend/CLAUDE.md |
| **9** | Final Documentation + Verification | Low | Any remaining dead code | Root CLAUDE.md, all component CLAUDE.md files |

---

## Phase 1: MPRIS Base Class (Backend — New Code Only)

**Goal:** Create `MprisPlayerBase` class extracting shared D-Bus MPRIS patterns from `spotifyService.js`.

**Risk:** Low — entirely new code, no existing behavior changes.

### Task 1.1: Write MprisPlayerBase tests

**Files:**
- Create: `backend/tests/unit/services/mprisPlayerBase.test.js`

**What to test:**
- Constructor stores config (destination, label, healthServiceId)
- `_buildDbusArgs()` builds correct argument arrays for dbus-send
- `_dbusCall()` calls execFileAsync with correct args, returns stdout
- `_dbusCall()` throws on non-zero exit / spawn failure
- `_dbusGetProperty()` and `_dbusSetProperty()` delegate to `_dbusCall()` with correct method signatures
- `_transport()` calls `_dbusCall()` with MPRIS Player interface method
- `startPlaybackMonitor()` creates ProcessMonitor + DbusSignalParser, wires them together
- `stopPlaybackMonitor()` stops ProcessMonitor, clears debounce timer
- Signal debounce: rapid signals within window are merged (Object.assign), single `_processStateChange()` call
- `checkConnection()` calls `_dbusGetProperty('PlaybackStatus')`, reports health
- `getState()` returns `{connected, state, volume, track}`
- `reset()` stops monitor, clears state, reports health down

**Run:** `cd backend && npx jest tests/unit/services/mprisPlayerBase.test.js`
**Expected:** All new tests FAIL (class doesn't exist yet)

### Task 1.2: Implement MprisPlayerBase

**Files:**
- Create: `backend/src/services/mprisPlayerBase.js`

**Extract from `spotifyService.js` (lines to reference, not copy verbatim):**
- `_buildDbusArgs()` (lines 185-191) → generalize: accept destination as param
- `_dbusCall()` (lines 193-224) → base version: discover dest, build args, exec. No recovery logic (subclasses override entire method if needed)
- `_dbusGetProperty()` / `_dbusSetProperty()` (lines 226-236)
- `_transport()` (lines 283-288) → call `_ensureConnection()` then `_dbusCall()`
- `startPlaybackMonitor()` (lines 407-430) → generic MPRIS match rule (same for all MPRIS services)
- `stopPlaybackMonitor()` (lines 433-448)
- `_handleMprisSignal()` (lines 457-481) → debounce + merge logic
- `checkConnection()` (lines 344-374) → read PlaybackStatus, parse, report health
- State management: `connected`, `state`, `volume`, `track`
- `reset()` / `cleanup()` pattern

**Class design:**
```javascript
class MprisPlayerBase extends EventEmitter {
  constructor({ destination, label, healthServiceId, signalDebounceMs }) { ... }

  // Core D-Bus methods (overrideable):
  async _dbusCall(method, args)  // Spotify overrides entirely for recovery logic. VLC inherits base.
  _getDestination()              // static return for VLC, dynamic discovery for Spotify

  // Subclass hooks (must override):
  _processStateChange(signal)    // Parse service-specific properties
  _parseMetadata(raw)            // Different metadata parsing per service
}
```

**CRITICAL design decision:** `_dbusCall()` is the override point for error recovery, NOT a separate hook. Base implementation: discover dest → build args → exec → throw on failure. SpotifyService overrides the whole method, calling `super._dbusCall()` for initial attempt and retry after recovery. VlcMprisService inherits base behavior (no recovery).

**Run:** `cd backend && npx jest tests/unit/services/mprisPlayerBase.test.js`
**Expected:** All tests PASS

### Task 1.3: Verify no regressions

**Run:** `cd backend && npm test`
**Expected:** 70 suites, 1384 pass (+1 todo) + new mprisPlayerBase suite — ZERO regressions

**Commit (ecosystem):** `feat: add MprisPlayerBase — shared D-Bus MPRIS service foundation`

---

## Phase 2: Refactor Spotify onto MPRIS Base (Backend — API-Preserving Refactor)

**Goal:** `spotifyService` extends `MprisPlayerBase` instead of duplicating D-Bus code. Same public API, same events, same behavior.

**Risk:** Medium — existing 82 Spotify tests must still pass. Integration tests (external-state-propagation) must still pass.

### Task 2.1: Refactor spotifyService to extend MprisPlayerBase

**Files:**
- Modify: `backend/src/services/spotifyService.js`

**What changes:**
- `class SpotifyService extends MprisPlayerBase` (instead of extending EventEmitter directly)
- Constructor calls `super({ destination: null, label: 'spotify', healthServiceId: 'spotify', signalDebounceMs: 300 })`
- Remove duplicated methods now in base: `_buildDbusArgs`, `_dbusGetProperty`, `_dbusSetProperty`, base `_transport`, `startPlaybackMonitor`/`stopPlaybackMonitor` signal wiring, debounce logic
- Override `_getDestination()` → dynamic discovery with cache TTL (existing `_discoverDbusDest()` logic)
- Override `_dbusCall()` → call `super._dbusCall()`, catch errors, run recovery (activate + retry via `super._dbusCall()`)
- Override `_processStateChange()` → existing signal handler (playback/volume/metadata events)
- Override `_parseMetadata()` → existing `_parseMetadata()` for Spotify-specific xesam fields
- Keep Spotify-specific methods: `activate()`, `setPlaylist()`, `pauseForGameClock()`, `resumeFromGameClock()`, `verifyCacheStatus()`

**CRITICAL: Public API MUST NOT change.** Same method signatures, same events emitted, same `getState()` shape.

### Task 2.2: Update spotifyService tests if needed

**Files:**
- Modify: `backend/tests/unit/services/spotifyService.test.js` (only if mock setup needs adjustment)

**What might change:**
- If the test mocks `execFileAsync` directly, may need to account for base class requiring it
- If tests spy on internal methods that moved to base, update spy targets
- No test should be removed — only adjusted to work with new class hierarchy

**Run:** `cd backend && npx jest tests/unit/services/spotifyService.test.js`
**Expected:** 82 tests PASS (same count, no new tests needed for existing behavior)

### Task 2.3: Run full backend test suite

**Run:** `cd backend && npm test`
**Expected:** All 1384+ pass

**Run:** `cd backend && npx jest --config jest.integration.config.js tests/integration/external-state-propagation.test.js`
**Expected:** 10 pass (Spotify state propagation chain still works)

### Task 2.4: Remove dead code from spotifyService

**Files:**
- Modify: `backend/src/services/spotifyService.js`

**Remove:** Any duplicated helper methods that are now inherited from base class but were kept during initial refactor. Verify with `grep` that no references to removed methods exist.

**Run:** `cd backend && npm test && npx jest --config jest.integration.config.js`
**Expected:** All pass

### Task 2.5: Update backend documentation

**Files:**
- Modify: `backend/CLAUDE.md` — Add note about MprisPlayerBase, update Spotify architecture description
- Modify: `docs/plans/2026-02-28-unified-state-architecture.md` — Mark Phase 2 complete

**Commit (ecosystem):** `refactor: spotifyService extends MprisPlayerBase — remove duplicated D-Bus code`

---

## CHECKPOINT A: Backend Spotify Refactor Verified

**Full verification before proceeding:**
```bash
cd backend && npm test                                          # 1384+ pass
cd backend && npx jest --config jest.integration.config.js      # 265 pass
cd backend && npm run test:e2e                                  # E2E pass
```

**All three layers must pass. Do NOT proceed to Phase 3 if any failures.**

---

## Phase 3: VLC MPRIS Migration + HTTP Removal (Backend — HIGH RISK)

**Goal:** Replace VLC HTTP polling with D-Bus MPRIS control and monitoring. Delete the entire HTTP interface.

**Risk:** HIGH — VLC is critical for video playback during the game. This touches vlcService (22 tests), videoQueueService (30 tests), commandExecutor (95 tests), broadcasts (72 tests), integration video-orchestration (5 tests), displayControlService, systemReset.

### Task 3.1: Write vlcMprisService tests

**Files:**
- Create: `backend/tests/unit/services/vlcMprisService.test.js`

**What to test (must cover all existing vlcService behavior + MPRIS specifics):**
- Constructor configures static destination `org.mpris.MediaPlayer2.vlc`
- `init()` checks connection via D-Bus, starts playback monitor, initializes idle loop
- `playVideo(path)` → MPRIS OpenUri with `file://` prefix (no separate clearPlaylist step)
- `stop()` → MPRIS Stop
- `pause()` → MPRIS Pause
- `resume()` → MPRIS Play
- `skip()` → MPRIS Stop + emits `video:skipped` (videoQueueService handles queue advancement)
- `getStatus()` returns `{connected, state, currentItem, position, length, volume, fullscreen}`
- `setVolume(0-256)` → MPRIS Volume property (convert 0-256 → 0.0-1.0)
- `seek(seconds)` → MPRIS Seek or SetPosition
- `setLoop(enabled)` → MPRIS LoopStatus property ('Playlist' or 'None')
- `initializeIdleLoop()` → plays idle-loop.mp4, enables loop
- `returnToIdleLoop()` → plays idle-loop.mp4, enables loop
- Health reporting via serviceHealthRegistry
- PropertiesChanged signal monitoring detects external state changes
- `state:changed` event emitted on playback state delta (same event as current vlcService)
- `video:played`, `video:stopped`, `video:paused`, `video:resumed`, `video:skipped` events
- `reset()` full cleanup for tests
- `isConnected()` delegates to registry

**NOT tested (removed from API):**
- `clearPlaylist()` — dropped. OpenUri replaces current media.
- `toggleFullscreen()` — removed entirely. VLC launched in fullscreen mode.

**Run:** `cd backend && npx jest tests/unit/services/vlcMprisService.test.js`
**Expected:** All FAIL (service doesn't exist yet)

### Task 3.2: Implement vlcMprisService

**Files:**
- Create: `backend/src/services/vlcMprisService.js`

**Class design:**
```javascript
class VlcMprisService extends MprisPlayerBase {
  constructor() {
    super({
      destination: 'org.mpris.MediaPlayer2.vlc',  // static
      label: 'vlc',
      healthServiceId: 'vlc',
      signalDebounceMs: 100  // VLC signals are less chatty than Spotify
    });
  }

  // VLC-specific overrides:
  _getDestination() { return this._destination; }  // static, no discovery
  // _dbusCall() — NOT overridden, inherits base (no recovery, just throw)
  _processStateChange(signal) { /* VLC-specific property handling */ }

  // VLC-specific methods:
  async playVideo(videoPath) { /* OpenUri with file:// prefix — no clearPlaylist */ }
  async initializeIdleLoop() { /* play idle-loop.mp4, set LoopStatus */ }
  async returnToIdleLoop() { /* same */ }
  async setLoop(enabled) { /* LoopStatus property */ }
  async seek(position) { /* Seek method or SetPosition */ }
  async setVolume(volume) { /* Volume property, 0-256 → 0.0-1.0 */ }
}
```

**Removed from API (vs old vlcService):**
- `clearPlaylist()` — OpenUri replaces current media, no need
- `toggleFullscreen()` — no MPRIS equivalent, not used in show, VLC launched fullscreen

**CRITICAL:** The public API must be compatible with the old vlcService for all methods that consumers actually call. `videoQueueService` and `commandExecutor` call these methods by name. Verify no consumer calls `clearPlaylist()` or `toggleFullscreen()` (confirmed: no independent callers).

**Run:** `cd backend && npx jest tests/unit/services/vlcMprisService.test.js`
**Expected:** All PASS

### Task 3.3: Update vlcService consumers to use vlcMprisService

**Files to modify (from audit — exhaustive list):**
- `backend/src/app.js:19` — change require from `vlcService` to `vlcMprisService`
- `backend/src/server.js:40` — update service passed to `setupBroadcastListeners`
- `backend/src/websocket/broadcasts.js:61` — update vlcService reference
- `backend/src/services/videoQueueService.js:10` — update require
- `backend/src/services/commandExecutor.js:640` — update lazy require for health check command
- `backend/src/services/commandExecutor.js` — **remove `video:fullscreen` case** (toggleFullscreen removed)
- `backend/src/services/displayControlService.js` — update require
- `backend/src/services/systemReset.js:46,119-121` — update reset logic (no more `_previousState` cache)

**For each file:** Change the require/import, verify the method names match.

### Task 3.4: Update ALL VLC test mocks

**Files to modify:**
- `backend/tests/unit/services/videoQueueService.test.js` — update vlcService mock (remove clearPlaylist from mock)
- `backend/tests/unit/services/commandExecutor.test.js` — update vlcService mock, **remove `video:fullscreen` test cases**
- `backend/tests/unit/services/displayControlService.test.js` — update mock
- `backend/tests/unit/services/systemReset.test.js` — update mock
- `backend/tests/unit/websocket/broadcasts.test.js` — update vlcService event expectations
- `backend/tests/unit/websocket/phase1-broadcasts.test.js` — if VLC events tested here
- `backend/tests/unit/websocket/phase2-broadcasts.test.js` — if VLC events tested here
- `backend/tests/integration/video-orchestration.test.js` — update integration mock
- `backend/tests/integration/external-state-propagation.test.js` — if VLC state tested
- `backend/tests/e2e/setup/vlc-service.js` — update E2E mock
- `backend/tests/helpers/mock-vlc-server.js` — DELETE (HTTP mock server no longer needed)

**CRITICAL:** Every mock must match the new vlcMprisService API surface. The mock should implement the same methods and emit the same events. No `clearPlaylist()` or `toggleFullscreen()` in mocks.

### Task 3.5: Delete old vlcService and HTTP artifacts

**Files to DELETE:**
- `backend/src/services/vlcService.js` (513 lines — entire file)
- `backend/tests/unit/services/vlcService.test.js` (22 tests — replaced by vlcMprisService tests)
- `backend/tests/helpers/mock-vlc-server.js` (HTTP mock — no longer needed)

**Files to MODIFY:**
- `backend/src/config/index.js` — remove `vlc.host`, `vlc.port`, `vlc.password` config (keep `vlc.maxRetries`, `vlc.reconnectInterval` if still used)
- `.env` / `.env.example` — remove `VLC_HOST`, `VLC_PORT`, `VLC_PASSWORD` if present

**Verify no stale references:**
```bash
cd backend && grep -r "vlcService" src/ --include="*.js" | grep -v "vlcMprisService"
# Should return ZERO results
cd backend && grep -r "mock-vlc-server" tests/ --include="*.js"
# Should return ZERO results
cd backend && grep -r "VLC_HOST\|VLC_PORT\|VLC_PASSWORD" src/ --include="*.js"
# Should return ZERO results
cd backend && grep -r "toggleFullscreen\|video:fullscreen" src/ --include="*.js"
# Should return ZERO results
```

### Task 3.6: Run full backend test suite

**Run sequentially — do NOT skip any layer:**
```bash
cd backend && npm test                                          # Unit+Contract
cd backend && npx jest --config jest.integration.config.js      # Integration
```

**Expected:**
- Unit+Contract: 70+ suites pass (vlcService suite REMOVED, vlcMprisService suite ADDED, net change ~0)
- Integration: 265 pass
- Test count for vlcMprisService should be ≥ 22 (matching or exceeding old vlcService coverage)

### Task 3.7: Update documentation

**Files:**
- Modify: `backend/CLAUDE.md` — Replace all VLC HTTP references with MPRIS. Update service architecture section. Remove VLC HTTP config from examples. Remove toggleFullscreen references.
- Modify: Root `CLAUDE.md` — Update VLC references if any
- Modify: `docs/plans/2026-02-28-unified-state-architecture.md` — Mark Phase 3 complete

**Commit (ecosystem):** `refactor!: replace VLC HTTP interface with D-Bus MPRIS — delete vlcService.js`

---

## CHECKPOINT B: VLC MPRIS Migration Verified

**Full verification — ALL layers:**
```bash
cd backend && npm test                                          # Unit+Contract pass
cd backend && npx jest --config jest.integration.config.js      # Integration pass
cd backend && npm run test:e2e                                  # E2E pass
cd ALNScanner && npm test                                       # ALNScanner pass (unchanged)
```

**Verify dead code is truly gone:**
```bash
grep -r "vlcService\b" backend/src/ --include="*.js" | grep -v "vlcMprisService"  # ZERO
grep -r "axios" backend/src/services/ --include="*.js"                             # ZERO (was only used by vlcService)
grep -r "status\.json" backend/ --include="*.js"                                   # ZERO
grep -r "toggleFullscreen\|clearPlaylist" backend/src/ --include="*.js"            # ZERO
```

**Do NOT proceed to Phase 4 if any test layer fails or dead code references remain.**

---

## Phase 4: Backend getState() + service:state Broadcast (Backend — Additive)

**Goal:** Add `getState()` to all services, create `service:state` broadcast pattern. Dual-emit alongside existing events during transition.

**Risk:** Medium — additive only, no existing behavior changes. Dual-emit means old and new paths both work.

**CRITICAL design principle:** No post-command state push. D-Bus monitors are the sole state authority. Commands fire, monitors observe, `service:state` is pushed when monitors detect changes. The pending button UX provides instant feedback; the state update arriving IS the confirmation.

### Task 4.1: Add getState() to services that lack it

**Files to modify (from audit — gameClockService and spotifyService already have getState()):**

| Service | File | State Shape |
|---------|------|-------------|
| bluetoothService | `src/services/bluetoothService.js` | `{scanning, pairedDevices[], connectedDevices[], discoveredDevices[]}` |
| audioRoutingService | `src/services/audioRoutingService.js` | `{routes: {video, spotify, sound}, availableSinks[], ducking: {}}` |
| lightingService | `src/services/lightingService.js` | `{connected, activeScene, scenes[]}` |
| soundService | `src/services/soundService.js` | `{playing[]}` |
| cueEngineService | `src/services/cueEngineService.js` | `{cues[], activeCues[], disabledCues[]}` |
| serviceHealthRegistry | `src/services/serviceHealthRegistry.js` | Already has `getSnapshot()` — alias as `getState()` |
| videoQueueService | `src/services/videoQueueService.js` | `{status, currentVideo: {tokenId, filename, position, duration}, queue[], queueLength, volume, connected}` |

**CRITICAL: `videoQueueService.getState()` is the canonical source for the `video` domain.** It includes both queue state AND current playback state (read from vlcMprisService internally). This is the single state shape pushed to the frontend for all video concerns.

**Write tests for each getState():**
- Create: `backend/tests/unit/services/getState.test.js` (consolidated test file for all getState methods)
- Test each service returns expected shape
- Test state updates correctly after operations (e.g., after play, getState shows playing)
- Test videoQueueService.getState() includes VLC playback data

**Run:** `cd backend && npx jest tests/unit/services/getState.test.js`
**Expected:** All PASS

**Run:** `cd backend && npm test` — verify no regressions (1384+ pass)

**Commit (ecosystem):** `feat: add getState() to all backend services`

### Task 4.2: Create service:state broadcast pattern

**Files:**
- Modify: `backend/src/websocket/broadcasts.js`

**What to add (ALONGSIDE existing listeners, not replacing them yet):**

For each service, add a new listener pattern:
```javascript
// NEW: Unified service:state push (alongside existing discrete events)
function pushServiceState(io, domain, service) {
  emitToRoom(io, 'gm', 'service:state', { domain, state: service.getState() });
}
```

Wire into existing service events:
```javascript
// Spotify — after existing playback:changed/volume:changed/track:changed listeners:
for (const event of SPOTIFY_EVENTS) {
  addTrackedListener(spotifyService, event, () => {
    pushServiceState(io, 'spotify', spotifyService);
  });
}

// Video — VLC state changes AND video lifecycle events both push video domain:
addTrackedListener(vlcMprisService, 'state:changed', () => {
  pushServiceState(io, 'video', videoQueueService);
});
for (const event of ['video:started', 'video:completed', 'video:paused', 'video:resumed', 'video:loading', 'video:idle', 'video:failed']) {
  addTrackedListener(videoQueueService, event, () => {
    pushServiceState(io, 'video', videoQueueService);
  });
}
// Queue changes also push video domain:
for (const event of ['queue:added', 'queue:cleared', 'queue:reordered', 'queue:pending-cleared', 'queue:reset']) {
  addTrackedListener(videoQueueService, event, () => {
    pushServiceState(io, 'video', videoQueueService);
  });
}

// Health — after existing health:changed listener:
addTrackedListener(registry, 'health:changed', () => {
  pushServiceState(io, 'health', registry);
});

// ... similar for bluetooth, audio, lighting, sound, gameclock, cueengine
```

**CRITICAL:** This is DUAL-EMIT. Old events (`spotify:status`, `gameclock:status`, etc.) still fire. New `service:state` fires too. Frontend will consume whichever path it's wired to.

**No post-command state push.** State pushes are triggered ONLY by service events (D-Bus monitors, service lifecycle, etc.). Commands do not push state. See Review Decision #1.

### Task 4.3: Write integration tests for service:state flow

**Files:**
- Create: `backend/tests/integration/service-state-push.test.js`

**What to test:**
- External Spotify change (mock D-Bus signal) → service:state event with domain 'spotify'
- VLC state change → service:state event with domain 'video' (via videoQueueService.getState())
- Health change → service:state event with domain 'health'
- service:state events are wrapped in AsyncAPI envelope
- service:state carries full state snapshot (not delta)
- Multiple rapid changes → each emits service:state (no coalescing at this layer)
- sync:full still works (includes all service states)

**Run:** `cd backend && npx jest --config jest.integration.config.js tests/integration/service-state-push.test.js`
**Expected:** All PASS

### Task 4.4: Update broadcast unit tests

**Files:**
- Modify: `backend/tests/unit/websocket/broadcasts.test.js`
- Modify: `backend/tests/unit/websocket/broadcasts-environment.test.js`
- Modify: `backend/tests/unit/websocket/phase1-broadcasts.test.js`
- Modify: `backend/tests/unit/websocket/phase2-broadcasts.test.js`

**What to add:** Tests verifying `service:state` events are emitted for each service domain alongside existing events.

### Task 4.5: Update AsyncAPI contract

**Files:**
- Modify: `backend/contracts/asyncapi.yaml` — Add `service:state` event definition with domain enum and state shapes per domain

### Task 4.6: Run full test suite

**Run:**
```bash
cd backend && npm test                                          # Unit+Contract
cd backend && npx jest --config jest.integration.config.js      # Integration
```

**Expected:** All pass (old tests unchanged + new tests added)

### Task 4.7: Update documentation

**Files:**
- Modify: `backend/CLAUDE.md` — Document service:state pattern, getState() methods, dual-emit period, video domain ownership
- Modify: `docs/plans/2026-02-28-unified-state-architecture.md` — Mark Phase 4 complete

**Commit (ecosystem):** `feat: add service:state broadcast pattern — dual-emit alongside existing events`

---

## CHECKPOINT C: Backend service:state Verified

```bash
cd backend && npm test                                          # All pass
cd backend && npx jest --config jest.integration.config.js      # All pass (including new service-state-push tests)
cd backend && npm run test:e2e                                  # E2E pass (old events still work)
```

**Do NOT proceed if any layer fails.**

---

## Phase 5: Frontend State Store (ALNScanner Submodule — Additive)

**Goal:** Create `StateStore` class and wire `service:state` handler in `networkedSession.js` — alongside existing handlers, not replacing them yet.

**Risk:** Medium — additive only. Existing event paths still work.

**CRITICAL architectural boundary:** StateStore handles service domains ONLY (spotify, video, health, bluetooth, audio, lighting, sound, gameclock, cueengine, held). Session/transaction data stays in UDM + storage strategies. StateStore is populated in Networked mode only — in Standalone mode it's created but empty.

### Task 5.1: Write StateStore tests

**Files:**
- Create: `ALNScanner/tests/unit/core/stateStore.test.js`

**What to test:**
- Constructor creates empty store
- `update(domain, state)` stores state, stores previous
- `update()` emits event with `{domain, state, prev}`
- `on(domain, callback)` subscribes to specific domain updates only
- `on(domain)` callback receives `(state, prev)` — prev is null on first update
- `get(domain)` returns current state for domain
- `getAll()` returns entire store snapshot
- Rapid updates to same domain: each emits, prev is always the prior state
- Updates to different domains don't trigger other domain's subscribers
- `off(domain, callback)` unsubscribes

**Run:** `cd ALNScanner && npx jest tests/unit/core/stateStore.test.js`
**Expected:** All FAIL (class doesn't exist)

### Task 5.2: Implement StateStore

**Files:**
- Create: `ALNScanner/src/core/stateStore.js`

```javascript
/**
 * StateStore — domain-keyed state container for service state.
 *
 * Handles service domains only (spotify, video, health, etc.) with
 * snapshot/shallow-merge semantics. Session/transaction data stays
 * in UDM + storage strategies (different data pattern).
 *
 * Populated in Networked mode only. In Standalone mode, created but empty
 * (admin panel requires Networked mode; scanning UI uses UDM).
 */
export class StateStore {
  constructor() {
    this._state = {};
    this._prev = {};
    this._listeners = {};  // domain → Set<callback>
  }

  update(domain, state) {
    this._prev[domain] = this._state[domain] || null;
    this._state[domain] = { ...this._state[domain], ...state };  // shallow merge
    const listeners = this._listeners[domain];
    if (listeners) {
      for (const cb of listeners) {
        cb(this._state[domain], this._prev[domain]);
      }
    }
  }

  get(domain) { return this._state[domain] || null; }
  getAll() { return { ...this._state }; }

  on(domain, callback) {
    if (!this._listeners[domain]) this._listeners[domain] = new Set();
    this._listeners[domain].add(callback);
  }

  off(domain, callback) {
    this._listeners[domain]?.delete(callback);
  }
}
```

**Run:** `cd ALNScanner && npx jest tests/unit/core/stateStore.test.js`
**Expected:** All PASS

### Task 5.3: Wire service:state in networkedSession.js + update orchestratorClient

**Files:**
- Modify: `ALNScanner/src/network/networkedSession.js`
- Modify: `ALNScanner/src/network/orchestratorClient.js` — **ADD `service:state` to `messageTypes` array** (Review Decision #7: add now, remove old names in Phase 8)

**What to add in networkedSession (alongside existing case statements, NOT replacing them):**

In `_wireEventHandlers()`, add handler for the new `service:state` event:
```javascript
// NEW: service:state handler (populates store alongside existing UDM path)
this._client.on('message:received', (msg) => {
  if (msg.event === 'service:state' && msg.data) {
    const { domain, state } = msg.data;
    if (this._store) {
      this._store.update(domain, state);
    }
  }
});
```

**Also:** Pass store into networkedSession from main.js or create it internally.

**Files to modify:**
- `ALNScanner/src/network/networkedSession.js` — accept store, wire handler
- `ALNScanner/src/main.js` — create StateStore, pass to NetworkedSession

### Task 5.4: Wire sync:full into store

**Files:**
- Modify: `ALNScanner/src/network/networkedSession.js`

In the existing `sync:full` handler, add store population:
```javascript
// Existing sync:full handling stays. ADD store population:
if (this._store) {
  if (data.spotify) this._store.update('spotify', data.spotify);
  if (data.serviceHealth) this._store.update('health', data.serviceHealth);
  if (data.environment?.bluetooth) this._store.update('bluetooth', data.environment.bluetooth);
  if (data.environment?.audio) this._store.update('audio', data.environment.audio);
  if (data.environment?.lighting) this._store.update('lighting', data.environment.lighting);
  if (data.gameClock) this._store.update('gameclock', data.gameClock);
  if (data.cueEngine) this._store.update('cueengine', data.cueEngine);
  if (data.heldItems) this._store.update('held', { items: data.heldItems });
  if (data.videoStatus) this._store.update('video', data.videoStatus);
}
```

**Note:** Session/transaction data from sync:full continues to flow through UDM (not the store).

### Task 5.5: Update networkedSession tests

**Files:**
- Modify: `ALNScanner/tests/unit/network/networkedSession.test.js`

**What to add:**
- Test that `service:state` messages populate the store
- Test that sync:full populates the store for all service domains
- Existing 60 tests should still pass (dual path)

**Run:** `cd ALNScanner && npx jest tests/unit/network/networkedSession.test.js`
**Expected:** 60+ pass (existing + new)

### Task 5.6: Run full ALNScanner test suite

**Run:** `cd ALNScanner && npm test`
**Expected:** 57+ suites, 1015+ pass — ZERO regressions, new tests added

### Task 5.7: Update documentation

**Files:**
- Modify: `ALNScanner/CLAUDE.md` — Document StateStore, dual-path period, service-only scope

**Commit (ALNScanner submodule):** `feat: add frontend StateStore — wired alongside existing event paths`
**Commit (ecosystem — update ref):** `chore: update ALNScanner ref — StateStore added`

---

## CHECKPOINT D: Frontend Store Wired

```bash
cd ALNScanner && npm test                                       # All pass
cd ALNScanner && npm run build                                  # Rebuild dist for E2E
cd backend && npm run test:e2e                                  # E2E pass (dual paths, both work)
```

---

## Phase 6: Differential Renderers (ALNScanner Submodule — Per-Renderer Migration)

**Goal:** Migrate each renderer from innerHTML replacement to differential `render(state, prev)` pattern. Subscribe to store instead of DataManager events.

**Risk:** Medium — done one renderer at a time. E2E tests catch regressions.

**Order:** Start with simplest, end with most complex.

### Task 6.1: SpotifyRenderer (most impactful — fixes volume slider destruction)

**Files:**
- Modify: `ALNScanner/src/ui/renderers/SpotifyRenderer.js`
- Modify: `ALNScanner/tests/unit/ui/renderers/SpotifyRenderer.test.js`

**What changes:**
- `render(state, prev)` signature (add prev parameter)
- First render (prev === null): build full DOM, store element references (`_playBtn`, `_volumeSlider`, `_trackName`, etc.)
- Subsequent renders: compare state vs prev, update only changed elements
- Add `_volumeDragging` flag on pointerdown/pointerup (use pointer capture to ensure pointerup fires even if pointer leaves element)
- Remove all innerHTML replacement in render path
- Add pending state: `_playBtn.classList.remove('pending')` on render

**Tests to update:**
- Existing tests verify render output — update to check that DOM elements are updated, not rebuilt
- Add test: render(state, prev) with same state → no DOM changes
- Add test: render(state, prev) with only volume changed → only slider updated
- Add test: volume slider protected during drag

**Run:** `cd ALNScanner && npx jest tests/unit/ui/renderers/SpotifyRenderer.test.js`
**Expected:** All pass (updated + new tests)

**Commit (ALNScanner submodule):** `refactor: SpotifyRenderer differential rendering — fixes volume slider destruction`

### Task 6.2: HealthRenderer

**Files:**
- Modify: `ALNScanner/src/ui/renderers/HealthRenderer.js`
- Modify: `ALNScanner/tests/unit/ui/renderers/HealthRenderer.test.js`

**Same pattern:** render(state, prev), element references, targeted updates.

**Commit (ALNScanner submodule):** `refactor: HealthRenderer differential rendering`

### Task 6.3: VideoRenderer + client-side progress interpolation

**Files:**
- Modify: `ALNScanner/src/ui/renderers/VideoRenderer.js`
- Modify: `ALNScanner/tests/unit/ui/renderers/VideoRenderer.test.js`

**What changes:**
- Differential `render(state, prev)` pattern
- **Client-side progress interpolation** (replaces server-side `video:progress` events):
  - On state update with `position` and `duration`: store as interpolation base with timestamp
  - If state is 'playing': start `requestAnimationFrame` or `setInterval` loop incrementing progress bar
  - If state changes to paused/stopped/completed: stop interpolation
  - On next state update: resync interpolation base
- No dependency on `video:progress` WebSocket events (removed per Review Decision #10)
- Queue display renders from `state.queue` array within the video domain

```javascript
// Interpolation pattern:
_startInterpolation(position, duration) {
  this._positionBase = position;
  this._positionTimestamp = Date.now();
  this._duration = duration;
  this._animFrame = requestAnimationFrame(() => this._tick());
}

_tick() {
  const elapsed = (Date.now() - this._positionTimestamp) / 1000;
  const current = this._positionBase + elapsed;
  const progress = Math.min(1, current / this._duration);
  this._progressBar.style.width = `${progress * 100}%`;
  if (progress < 1) {
    this._animFrame = requestAnimationFrame(() => this._tick());
  }
}
```

**Tests to add:**
- Interpolation starts on playing state
- Interpolation stops on pause/stop
- Interpolation resyncs on new position update
- Progress bar doesn't exceed 100%

**Commit (ALNScanner submodule):** `refactor: VideoRenderer differential rendering with client-side progress interpolation`

### Task 6.4: CueRenderer

**Files:**
- Modify: `ALNScanner/src/ui/renderers/CueRenderer.js`
- Modify: `ALNScanner/tests/unit/ui/renderers/CueRenderer.test.js`

**Commit (ALNScanner submodule):** `refactor: CueRenderer differential rendering`

### Task 6.5: EnvironmentRenderer

**Files:**
- Modify: `ALNScanner/src/ui/renderers/EnvironmentRenderer.js`
- Modify: `ALNScanner/tests/unit/ui/renderers/EnvironmentRenderer.test.js`

**Note:** This renderer has sub-methods (renderLighting, renderAudio, renderBluetooth). Each needs differential treatment. Audio routing dropdowns must preserve selection during updates.

**Commit (ALNScanner submodule):** `refactor: EnvironmentRenderer differential rendering`

### Task 6.6: HeldItemsRenderer — validate and align

**Files:**
- Modify: `ALNScanner/src/ui/renderers/HeldItemsRenderer.js`
- Modify: `ALNScanner/tests/unit/ui/renderers/HeldItemsRenderer.test.js`

**This renderer already uses incremental updates.** Task here is:
- Validate its existing implementation against new store pattern
- Align its API to `render(state, prev)` if needed
- Ensure it subscribes to store `'held'` domain
- Write missing tests if coverage is inadequate

**Commit (ALNScanner submodule):** `refactor: HeldItemsRenderer aligned to store subscription pattern`

### Task 6.7: SessionRenderer + gameclock dual subscription

**Files:**
- Modify: `ALNScanner/src/ui/renderers/SessionRenderer.js`

**What changes:**
- Differential `render(state, prev)` pattern — eliminates template swap hack
- **Dual store subscription:** subscribes to both `session` and `gameclock` domains
  - `store.on('session', (state, prev) => sessionRenderer.render(state, prev))`
  - `store.on('gameclock', (state, prev) => sessionRenderer.renderGameClock(state, prev))`
- Session state comes from UDM events (session lifecycle) — the session domain in the store is populated from sync:full for initial state. Ongoing session updates continue through UDM.
- Game clock state comes from the store `gameclock` domain (via `service:state`)

**Note:** SessionRenderer caches clock display state across template swaps. The differential pattern should eliminate the need for this hack — no more template swaps.

**Commit (ALNScanner submodule):** `refactor: SessionRenderer differential rendering + gameclock dual subscription`

### After EACH renderer: Run

```bash
cd ALNScanner && npm test                                       # All pass
cd ALNScanner && npm run build                                  # Rebuild dist
cd backend && npm run test:e2e                                  # E2E pass
```

---

## CHECKPOINT E: All Renderers Differential

```bash
cd ALNScanner && npm test                                       # All pass
cd ALNScanner && npm run build                                  # Rebuild dist
cd backend && npm run test:e2e                                  # E2E pass
```

**At this point:** Renderers work via store subscriptions (new path) AND old DataManager events still fire (dual path). Both paths active.

**Commit (ecosystem — update ref):** `chore: update ALNScanner ref — all renderers differential`

---

## Phase 7: Frontend Old Path Removal (ALNScanner Submodule — Cleanup)

**Goal:** Remove the old event paths, UDM updateX methods, ScreenUpdateManager, MonitoringDisplay dual wiring. Store becomes sole source of truth for service state.

**Risk:** Medium — removing working code. E2E tests are the safety net.

### Task 7.1: Wire renderers to store ONLY (remove DataManager event subscriptions)

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js` — remove `_wireDataManagerEvents()`, subscribe renderers to store domains instead
- Modify: `ALNScanner/src/admin/adminController.js` — pass store to MonitoringDisplay

**Tests to update:**
- `ALNScanner/tests/unit/admin/MonitoringDisplay-*.test.js` (52 tests) — update to test store subscription pattern instead of DataManager event pattern

**Run:** `cd ALNScanner && npm test` — verify no regressions

### Task 7.2: Collapse networkedSession case router

**Files:**
- Modify: `ALNScanner/src/network/networkedSession.js`

**What changes:**
- Remove all case statements for events that are now handled via `service:state` → store
- Keep only: `sync:full` (initial state), `transaction:accepted`, `transaction:deleted`, `session:update`, `player:scan`, `scores:reset`, `group:completed`
- The 30+ cases for `spotify:status`, `service:health`, `bluetooth:device`, `audio:routing`, `lighting:scene`, `gameclock:status`, `sound:status`, `video:status`, `cue:*`, `held:*`, etc. are ALL removed — `service:state` handler covers them

**ALSO remove:** All calls to UDM updateX methods for service state (updateSpotifyState, updateServiceHealth, updateBluetoothDevice, updateAudioState, etc.)

**Tests to update:**
- `ALNScanner/tests/unit/network/networkedSession.test.js` (60 tests) — remove tests for deleted case statements, update remaining tests

**Run:** `cd ALNScanner && npm test`

### Task 7.3: Remove UDM ephemeral state methods

**Files:**
- Modify: `ALNScanner/src/core/unifiedDataManager.js`

**Remove these methods (from audit — lines 895-1332):**
- `updateVideoState()`, `getVideoState()`
- `updateCueStatus()`, `syncCueState()`, `getCueState()`, `updateCueConfig()`, `_dispatchCueUpdate()`
- `updateHeldItems()`
- `updateServiceHealth()`, `syncServiceHealth()`
- `updateSpotifyState()`, `getSpotifyState()`
- `updateLightingState()`, `updateAudioState()`, `updateAudioDucking()`, `updateBluetoothScan()`, `updateBluetoothDevice()`, `updateBluetoothState()`
- ~~`updateSessionState()`~~ **KEPT** — session is NOT a service domain (see Decision #2). Called by networkedSession for session:update and sync:full. getSessionData() depends on sessionState.
- All associated event emission (`spotify-state:updated`, `video-state:updated`, etc.)

**Keep:** Transaction/scoring methods (addTransaction, getTeamScores, etc.) AND `updateSessionState()` / `getSessionData()` — these are part of the storage strategy pattern. **This is an intentional architectural boundary:** service state lives in StateStore (snapshot semantics), session/transaction state lives in UDM + strategies (list/accumulator semantics). See Review Decision #2.

**Remove ephemeral state properties from constructor:**
- `videoState`, `cueState`, `spotifyState`, `environmentState`, `serviceHealth`
- ~~`sessionState`~~ **KEPT** — session is NOT a service domain

**Tests to update:**
- `ALNScanner/tests/unit/core/UnifiedDataManager-cue.test.js` — DELETE (cue state now in store)
- `ALNScanner/tests/unit/core/UnifiedDataManager-env.test.js` — DELETE
- `ALNScanner/tests/unit/core/UnifiedDataManager-spotify.test.js` — DELETE
- `ALNScanner/tests/unit/core/UnifiedDataManager-video.test.js` — DELETE
- `ALNScanner/tests/unit/core/unifiedDataManager.test.js` — remove tests for deleted methods, keep transaction/scoring tests

**Run:** `cd ALNScanner && npm test`

### Task 7.4: Remove ScreenUpdateManager

**Files:**
- DELETE: `ALNScanner/src/ui/ScreenUpdateManager.js`
- DELETE: `ALNScanner/tests/unit/ui/ScreenUpdateManager.test.js` (44 tests removed)
- Modify: `ALNScanner/src/main.js` — remove ScreenUpdateManager creation, registration, wiring

**Move badge logic to main.js:** The history badge update (currently a global handler in ScreenUpdateManager) moves to a simple UDM event listener:
```javascript
DataManager.addEventListener('transaction:added', () => updateHistoryBadge());
DataManager.addEventListener('transaction:deleted', () => updateHistoryBadge());
DataManager.addEventListener('data:cleared', () => updateHistoryBadge());
```

**Screen/container scoping is dropped entirely.** Differential rendering makes it unnecessary — updating invisible DOM elements costs microseconds with targeted `.textContent` assignments. Renderers already guard with `if (!this.container) return`.

**What is PRESERVED (not touched in this task):**
- `viewController` and Scanner/Admin/Debug tab navigation (`viewController.switchView()`) — this is a layout/navigation concern, not state routing. The GM switches between scanning tokens and show control; these are genuinely different activities on a phone-sized device.
- 8 scanner screens within Scanner view (loading, gameMode, teamEntry, scan, result, history, scoreboard, teamDetails) and their `.active` class toggling via `UIManager.showScreen()`.
- Admin sections as a vertical scrolling column of `section.admin-section` elements.
- Responsive breakpoints and all existing CSS.
- `domEventBindings.js` event delegation for tab switching and screen navigation.

**Verify no stale references:**
```bash
cd ALNScanner && grep -r "ScreenUpdateManager\|screenUpdateManager" src/ --include="*.js"
# Should return ZERO
```

**Run:** `cd ALNScanner && npm test`

### Task 7.5: Remove MonitoringDisplay dual event wiring

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js` — remove any remaining DataManager event listeners (should already be done in 7.1, but verify)
- Verify MonitoringDisplay ONLY uses store subscriptions

### Task 7.6: Verify orchestratorClient has service:state

**Files:**
- Verify: `ALNScanner/src/network/orchestratorClient.js` — confirm `service:state` was added to `messageTypes` in Phase 5 Task 5.3

**Do NOT remove old event names yet.** The backend still emits them (removed in Phase 8). See Review Decision #7.

### Task 7.7: Run full test suite

**Run:**
```bash
cd ALNScanner && npm test                                       # Pass (reduced count — deleted test files)
cd ALNScanner && npm run build                                  # Rebuild dist
cd backend && npm run test:e2e                                  # E2E pass
```

**Expected ALNScanner changes:**
- Removed ~4 UDM test files (cue, env, spotify, video) = ~50 tests removed
- Removed ScreenUpdateManager test file = 44 tests removed
- Removed MonitoringDisplay DataManager event tests = ~20 tests removed
- New StateStore tests added = ~15 tests
- Updated renderer tests = roughly net-zero
- **Net:** ~1015 → ~900 (rough estimate, exact count will vary)

### Task 7.8: Update documentation

**Files:**
- Modify: `ALNScanner/CLAUDE.md` — Remove all UDM updateX references, remove ScreenUpdateManager references, document store-based architecture, document UDM retained for transactions (intentional boundary)

**Commit (ALNScanner submodule):** `refactor!: remove old frontend event paths — store is sole source of truth for service state`
**Commit (ecosystem — update ref):** `chore: update ALNScanner ref — old event paths removed`

---

## CHECKPOINT F: Frontend Fully Migrated

```bash
cd ALNScanner && npm test                                       # All pass (reduced but clean)
cd ALNScanner && npm run build                                  # Rebuild dist
cd backend && npm run test:e2e                                  # E2E pass
```

**Verify dead code is gone:**
```bash
grep -r "updateSpotifyState\|updateVideoState\|updateCueStatus\|updateServiceHealth\|updateLightingState\|updateAudioState\|updateBluetoothDevice" ALNScanner/src/ --include="*.js"
# ZERO results

grep -r "ScreenUpdateManager" ALNScanner/src/ --include="*.js"
# ZERO results

grep -r "spotify-state:updated\|video-state:updated\|cue-state:updated\|service-health:updated\|lighting-state:updated\|audio-state:updated\|bluetooth-state:updated" ALNScanner/src/ --include="*.js"
# ZERO results
```

---

## Phase 8: Backend Old Event Removal (Backend — Cleanup)

**Goal:** Remove old per-service broadcast events. Backend now ONLY emits `service:state` for service domains. Discrete events remain for session-level data only. Clean up orchestratorClient messageTypes.

**Risk:** Medium — frontend already migrated, so old events have no consumers.

### Task 8.1: Remove old per-service broadcast listeners

**Files:**
- Modify: `backend/src/websocket/broadcasts.js`

**Remove listeners for (these are now replaced by service:state):**
- `spotify:status` broadcast
- `gameclock:status` broadcasts
- `sound:status` broadcasts
- `bluetooth:device` / `bluetooth:scan` broadcasts
- `audio:routing` / `audio:routing:fallback` / `audio:ducking:status` / `audio:sinks` broadcasts
- `lighting:scene` / `lighting:status` broadcasts
- `service:health` broadcast — replaced by service:state domain 'health'
- `video:status` from vlcService `state:changed` — replaced by service:state domain 'video'
- `video:status` from videoQueueService lifecycle events — consolidated into service:state domain 'video'
- `video:progress` broadcast — **removed** (backend keeps internal position polling for cue engine, but no WebSocket broadcast; frontend interpolates)
- `video:queue:update` broadcast — consolidated into service:state domain 'video' (queue is part of videoQueueService.getState())
- `cue:status` (compound cue lifecycle) — replaced by service:state domain 'cueengine'
- `held:added` / `held:released` / `held:discarded` / `held:recoverable` — replaced by service:state domain 'held'

**Keep (NOT service state — these are game events/session lifecycle):**
- `transaction:new`, `transaction:deleted`, `score:updated`, `group:completed`, `scores:reset`
- `session:update`, `session:overtime`
- `device:connected`, `device:disconnected`
- `cue:fired`, `cue:completed`, `cue:error` (discrete game events with action payloads — NOT state snapshots)
- `player:scan`
- `sync:full`
- `gm:command:ack` (simplified receipt)
- `display:mode`
- `error`

**Rationale for kept events:** These are game events (something happened) not service state (what is the current situation). `cue:fired` carries which cue fired and what actions ran — that's event data, not state. `transaction:new` is an event that UDM needs to process. These don't fit the `service:state` snapshot pattern.

### Task 8.2: Update broadcast tests

**Files:**
- Modify: `backend/tests/unit/websocket/broadcasts.test.js` — remove tests for deleted listeners
- Modify: `backend/tests/unit/websocket/broadcasts-environment.test.js` — remove old event tests, keep service:state tests
- Modify: `backend/tests/unit/websocket/phase1-broadcasts.test.js` — update
- Modify: `backend/tests/unit/websocket/phase2-broadcasts.test.js` — update

### Task 8.3: Update contract tests

**Files:**
- Modify: `backend/tests/contract/websocket/` — update event shape tests for removed events
- Modify: `backend/contracts/asyncapi.yaml` — remove old event definitions, keep service:state

### Task 8.4: Update integration tests

**Files:**
- Modify: `backend/tests/integration/external-state-propagation.test.js` — update to verify service:state instead of old discrete events
- Modify: `backend/tests/integration/multi-client-broadcasts.test.js` — update
- Modify: `backend/tests/integration/room-broadcasts.test.js` — update

### Task 8.5: Remove old event names from orchestratorClient messageTypes

**Files:**
- Modify: `ALNScanner/src/network/orchestratorClient.js`

**Remove these from `messageTypes` array (backend no longer emits them):**
- `'video:status'`, `'video:progress'`, `'video:queue:update'`
- `'spotify:status'`
- `'service:health'`
- `'bluetooth:device'`, `'bluetooth:scan'`
- `'audio:routing'`, `'audio:routing:fallback'`, `'audio:ducking:status'`, `'audio:sinks'`
- `'lighting:scene'`, `'lighting:status'`
- `'gameclock:status'`
- `'sound:status'`
- `'cue:status'`
- `'held:added'`, `'held:released'`, `'held:discarded'`, `'held:recoverable'`

**Keep (still emitted by backend):**
- `'service:state'` (added in Phase 5)
- `'sync:full'`, `'transaction:result'`, `'transaction:new'`, `'transaction:deleted'`
- `'score:updated'`, `'scores:reset'`, `'group:completed'`
- `'session:update'`, `'session:overtime'`
- `'device:connected'`, `'device:disconnected'`
- `'cue:fired'`, `'cue:completed'`, `'cue:error'`
- `'display:mode'`
- `'gm:command:ack'`, `'offline:queue:processed'`, `'batch:ack'`, `'error'`
- `'player:scan'`

### Task 8.6: Remove deprecated ACK payload logic

**Files:**
- Modify: `backend/src/websocket/adminEvents.js` — simplify `gm:command:ack` to just `{action, success, message}` (no state data, which it shouldn't have anyway — verify)
- Modify: `ALNScanner/src/admin/utils/CommandSender.js` — simplify ACK handling (just success/failure, no state extraction)

### Task 8.7: Run full test suite

```bash
cd backend && npm test                                          # Pass (reduced broadcast tests)
cd backend && npx jest --config jest.integration.config.js      # Pass
cd ALNScanner && npm test                                       # Pass
cd ALNScanner && npm run build                                  # Rebuild dist
cd backend && npm run test:e2e                                  # Pass
```

### Task 8.8: Update documentation

**Files:**
- Modify: `backend/CLAUDE.md` — Remove old event names, update broadcast architecture section, remove dual-emit references
- Modify: `backend/contracts/asyncapi.yaml` — Final state with service:state + remaining discrete events
- Modify: Root `CLAUDE.md` — Update event architecture section

**Commit (ALNScanner submodule):** `refactor: remove old event names from orchestratorClient messageTypes`
**Commit (ecosystem):** `refactor!: remove old per-service broadcasts — service:state is sole push mechanism`

---

## CHECKPOINT G: Old Events Removed

```bash
cd backend && npm test                                          # All pass
cd backend && npx jest --config jest.integration.config.js      # All pass
cd ALNScanner && npm test                                       # All pass
cd ALNScanner && npm run build                                  # Rebuild dist
cd backend && npm run test:e2e                                  # All pass
```

**Verify dead events are gone:**
```bash
grep -r "spotify:status\|gameclock:status\|sound:status\|bluetooth:device\|bluetooth:scan\|audio:routing\|audio:ducking\|audio:sinks\|lighting:scene\|lighting:status" backend/src/websocket/broadcasts.js
# ZERO (only service:state remains for these domains)

grep -r "video:progress" backend/src/websocket/broadcasts.js
# ZERO (backend-only internal event, no WebSocket broadcast)
```

---

## Phase 9: Final Documentation + Verification

**Goal:** Ensure all documentation is accurate, all dead code is gone, all tests pass across every layer.

### Task 9.1: Comprehensive dead code sweep

**Run these grep checks — ALL must return ZERO results:**

```bash
# Backend: no references to deleted services/methods
grep -r "vlcService\b" backend/src/ --include="*.js" | grep -v vlcMprisService   # ZERO
grep -r "status\.json\|axios" backend/src/services/ --include="*.js"              # ZERO
grep -r "VLC_HOST\|VLC_PORT\|VLC_PASSWORD" backend/src/ --include="*.js"          # ZERO
grep -r "toggleFullscreen\|clearPlaylist" backend/src/ --include="*.js"           # ZERO

# Frontend: no references to deleted UDM methods
grep -r "updateSpotifyState\|updateVideoState\|updateCueStatus" ALNScanner/src/ --include="*.js"   # ZERO
grep -r "ScreenUpdateManager" ALNScanner/src/ --include="*.js"                                      # ZERO
grep -r "spotify-state:updated\|video-state:updated\|cue-state:updated" ALNScanner/src/ --include="*.js"  # ZERO

# No dual-emit remnants
grep -r "spotify:status\|gameclock:status\|sound:status" backend/src/websocket/broadcasts.js        # ZERO

# No video:progress broadcast
grep -r "video:progress" backend/src/websocket/broadcasts.js                                        # ZERO
```

### Task 9.2: Update ALL CLAUDE.md files

**Files:**
- Modify: Root `CLAUDE.md` — Update event architecture section, remove old event names, add service:state, document video domain ownership, document StateStore vs UDM boundary
- Modify: `backend/CLAUDE.md` — Final architecture description (MPRIS, service:state, getState, no toggleFullscreen/clearPlaylist)
- Modify: `ALNScanner/CLAUDE.md` — Final architecture description (StateStore for services, UDM for transactions, differential rendering, no ScreenUpdateManager)

### Task 9.3: Update memory file

**Files:**
- Modify: `/home/maxepunk/.claude/projects/-home-maxepunk-projects-AboutLastNight-ALN-Ecosystem/memory/MEMORY.md`

**Update entries for:**
- VLC service (now MPRIS, not HTTP; no toggleFullscreen/clearPlaylist)
- Event architecture (service:state, not per-service events)
- Frontend architecture (StateStore for services, UDM for transactions)
- Video domain ownership (videoQueueService, not vlcService)
- Test baselines (new counts after refactor)
- Remove stale entries about old patterns

### Task 9.4: Final full verification

```bash
cd backend && npm test                                          # All pass
cd backend && npx jest --config jest.integration.config.js      # All pass
cd ALNScanner && npm test                                       # All pass
cd ALNScanner && npm run build                                  # Rebuild dist
cd backend && npm run test:e2e                                  # All pass
```

### Task 9.5: Update design doc status

**Files:**
- Modify: `docs/plans/2026-02-28-unified-state-architecture.md` — Change status from "Design approved, pending implementation planning" to "Implementation complete"

**Commit (ALNScanner submodule):** `docs: update ALNScanner CLAUDE.md for unified state architecture`
**Commit (ecosystem):** `docs: update all documentation for unified state architecture`

---

## CHECKPOINT H: FINAL — Everything Clean

```bash
cd backend && npm test                                          # All pass
cd backend && npx jest --config jest.integration.config.js      # All pass
cd ALNScanner && npm test                                       # All pass
cd ALNScanner && npm run build                                  # Rebuild dist
cd backend && npm run test:e2e                                  # All pass
```

All 4 test layers pass. All dead code gone. All documentation accurate.

---

## Appendix A: Files Created (new)

| File | Phase | Purpose |
|------|-------|---------|
| `backend/src/services/mprisPlayerBase.js` | 1 | Shared MPRIS base class |
| `backend/src/services/vlcMprisService.js` | 3 | VLC D-Bus MPRIS service |
| `backend/tests/unit/services/mprisPlayerBase.test.js` | 1 | Base class tests |
| `backend/tests/unit/services/vlcMprisService.test.js` | 3 | VLC MPRIS tests |
| `backend/tests/unit/services/getState.test.js` | 4 | getState() tests for all services |
| `backend/tests/integration/service-state-push.test.js` | 4 | service:state integration tests |
| `ALNScanner/src/core/stateStore.js` | 5 | Frontend state store (service domains only) |
| `ALNScanner/tests/unit/core/stateStore.test.js` | 5 | Store tests |

## Appendix B: Files Deleted (dead code)

| File | Phase | Reason |
|------|-------|--------|
| `backend/src/services/vlcService.js` | 3 | Replaced by vlcMprisService |
| `backend/tests/unit/services/vlcService.test.js` | 3 | Replaced by vlcMprisService tests |
| `backend/tests/helpers/mock-vlc-server.js` | 3 | HTTP mock no longer needed |
| `ALNScanner/tests/unit/core/UnifiedDataManager-cue.test.js` | 7 | Cue state now in store |
| `ALNScanner/tests/unit/core/UnifiedDataManager-env.test.js` | 7 | Env state now in store |
| `ALNScanner/tests/unit/core/UnifiedDataManager-spotify.test.js` | 7 | Spotify state now in store |
| `ALNScanner/tests/unit/core/UnifiedDataManager-video.test.js` | 7 | Video state now in store |
| `ALNScanner/src/ui/ScreenUpdateManager.js` | 7 | State routing layer eliminated (tab navigation preserved) |
| `ALNScanner/tests/unit/ui/ScreenUpdateManager.test.js` | 7 | Deleted with source |

## Appendix C: Files Heavily Modified

| File | Phase | Nature of Changes |
|------|-------|-------------------|
| `backend/src/services/spotifyService.js` | 2 | Extends MprisPlayerBase, overrides `_dbusCall()` for recovery |
| `backend/src/websocket/broadcasts.js` | 4, 8 | Add service:state (Phase 4), remove old events (Phase 8) |
| `backend/src/services/commandExecutor.js` | 3 | VLC mock update, remove `video:fullscreen` command |
| `backend/src/services/videoQueueService.js` | 3, 4 | VLC ref update, add `getState()` (canonical video domain source) |
| `backend/src/websocket/syncHelpers.js` | 4 | Ensure all getState() used in sync:full |
| `ALNScanner/src/network/networkedSession.js` | 5, 7 | Add store wiring (Phase 5), remove case router (Phase 7) |
| `ALNScanner/src/network/orchestratorClient.js` | 5, 8 | Add service:state (Phase 5), remove old names (Phase 8) |
| `ALNScanner/src/core/unifiedDataManager.js` | 7 | Remove ephemeral state methods (~400 lines), keep transaction/scoring |
| `ALNScanner/src/admin/MonitoringDisplay.js` | 7 | Store subscriptions replace DataManager events |
| `ALNScanner/src/ui/renderers/SpotifyRenderer.js` | 6 | Differential rendering, volume slider protection |
| `ALNScanner/src/ui/renderers/HealthRenderer.js` | 6 | Differential rendering |
| `ALNScanner/src/ui/renderers/VideoRenderer.js` | 6 | Differential rendering + client-side progress interpolation |
| `ALNScanner/src/ui/renderers/CueRenderer.js` | 6 | Differential rendering |
| `ALNScanner/src/ui/renderers/EnvironmentRenderer.js` | 6 | Differential rendering |
| `ALNScanner/src/ui/renderers/SessionRenderer.js` | 6 | Differential rendering + gameclock dual subscription |
| `ALNScanner/src/main.js` | 5, 7 | Create store (Phase 5), remove ScreenUpdateManager + add badge listeners (Phase 7) |

## Appendix D: Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| VLC MPRIS doesn't handle all commands | Verified on Pi during brainstorming. OpenUri, Play, Pause, Stop, Seek, Volume, LoopStatus all confirmed working. |
| `clearPlaylist()` has no MPRIS equivalent | Dropped from API. OpenUri replaces current media. Confirmed no independent callers. |
| `toggleFullscreen()` has no MPRIS equivalent | Removed entirely (command, button, tests). Not used in show. VLC launched in fullscreen mode. |
| Renderer migration breaks E2E tests | Migrate one renderer at a time, run E2E after each (with `npm run build` first). Rollback individual renderer if E2E fails. |
| Dual-emit period causes confusion | Document clearly in CLAUDE.md. Remove as soon as frontend migration complete (don't leave lingering). |
| sync:full regression (missing service) | Existing integration tests catch this. Add explicit test in Phase 4 that all domains present in sync:full → store. |
| Store shallow merge loses nested state | Store does shallow merge only. Services must send complete state snapshots, not deltas. Store handles service state only — list-based data (transactions, scores) stays in UDM. |
| Standalone mode breaks | StateStore is Networked-only by design. Standalone mode uses UDM for scanning/transactions. Admin panel requires Networked mode. |
| Video domain confusion (VLC vs queue) | Single domain `video` owned by `videoQueueService.getState()`. Reads VLC state internally. One source of truth. |
| No post-command feedback | Pending button UX provides instant feedback. ACK failure clears pending with error. D-Bus monitor state update IS the confirmation (100-300ms). |
| Cue engine loses video progress | Backend keeps internal position polling (reads from MPRIS). Only the WebSocket broadcast is removed. Cue engine timeline advancement unchanged. |
| orchestratorClient drops new events | `service:state` added to messageTypes in Phase 5. Old names removed in Phase 8 (after backend stops emitting). Sequence prevents silent drops. |
