# ALN Ecosystem Architecture Investigation Report

**Date:** 2026-03-07
**Purpose:** Inform decisions about what to address before tonight's game
**Status:** Findings complete, awaiting independent verification before action

---

## Table of Contents

1. [Investigation Objectives](#1-investigation-objectives)
2. [System Context](#2-system-context)
3. [What Was Investigated](#3-what-was-investigated)
4. [Cross-Service Findings](#4-cross-service-findings)
5. [Per-Service Findings](#5-per-service-findings)
6. [Data Pipeline Findings](#6-data-pipeline-findings)
7. [Uncommitted Changes](#7-uncommitted-changes)
8. [Verification Gaps](#8-verification-gaps)

---

## 1. Investigation Objectives

### What Triggered This

Yesterday's game (0306) had **transactions missing from session reports** despite scores displaying correctly on the scoreboard. Rather than treating this as an isolated bug, the system owner identified it as a **symptom of larger architectural drift** and requested a comprehensive investigation.

### Owner's Stated Requirements

These requirements were clarified through multiple rounds of correction during the investigation. They are listed here so the verifier understands what the analysis was supposed to achieve:

1. **Do NOT overfit on the transaction bug.** It is ONE symptom. The system has many moving parts and the investigation must cover ALL of them.

2. **Think from gameplay purpose.** Every piece of code exists to serve the game experience. Understand WHAT it accomplishes for players, GMs, and the venue audience — not just HOW it works technically.

3. **Cover ALL services — especially external services.** The external services (audio routing, VLC, Spotify, Bluetooth, lighting, sound, cue engine) are the **most flaky** parts of the system. They control the venue experience for everyone present. The scoreboard and scoring pipeline are a small piece of the system, not the centerpiece.

4. **Be precise.** Without precise understanding of how each pattern of drift affects gameplay functionality, the owner cannot prioritize. ALL patterns are important if they could cause unexpected behavior, service failures, or degraded experience.

5. **Do NOT make assumptions.** State what is known from code evidence. State what is not known. Do not fill gaps with guesses. (Specific correction: "HDMI is NOT necessarily video audio" — audio routing is configurable per-stream, per-cue, per-command.)

6. **Read actual source code.** Documentation (CLAUDE.md, comments, READMEs) has KNOWN DRIFT from implementation. Do not trust documentation as ground truth.

7. **This investigation should INFORM decisions, not produce a quick-fix checklist.** The owner decides priorities based on precise information.

### What "Architectural Drift" Means Here

The system evolved through three architectural layers, each built on top of the previous:

- **Layer 1 (original):** `stateService` computed monolithic `GameState`, emitted `state:updated`. Clients pulled state via `state:request` / `state:sync`.
- **Layer 2 (SRP refactor):** `sessionService` became persistence owner. `transaction:accepted` event chain. `broadcasts.js` became the bridge between internal events and WebSocket delivery.
- **Layer 3 (unified service:state):** 10 domain-specific state snapshots for service/environment state. `StateStore` on GM Scanner for reactive rendering. `sync:full` enhanced with all domains. ~3200 lines removed March 1.

The investigation question: Did each layer get fully completed? Does Layer 1 dead code interfere with Layers 2/3? Do Layer 2 and 3 have overlapping responsibilities? Has post-March-1 feature work introduced new issues?

---

## 2. System Context

### What ALN Is

ALN is a 2-hour immersive crime thriller game running on a **single Raspberry Pi 5**. The Pi runs everything: game server (Node.js backend), media center (VLC video on HDMI, Spotify on Bluetooth speakers, sound effects, smart lighting), web server for PWAs and a TV scoreboard.

### Three Audiences

1. **Players** — roam the venue with ESP32 hardware scanners. Find NFC tokens, discover "memories" (images/audio/video). Make strategic decisions per-token.
2. **Game Masters (GMs)** — sit at GM stations with phones running GM Scanner PWA. Process tokens teams bring them, monitor show control, manage the entire game.
3. **Everyone in the venue** — see the scoreboard on TV, watch triggered videos, hear Spotify music and sound effects, experience lighting changes.

### The Game Loop

1. Player scans NFC token with ESP32 -> sees memory content. If video token -> TV plays video for everyone.
2. Team decides: sell on Black Market (earn money) or expose to Detective (evidence on scoreboard).
3. At GM station: GM selects/creates team -> selects transaction mode -> scans token.
4. Backend processes transaction, calculates score, persists, broadcasts.
5. Scoreboard on TV updates live. Other GMs see the transaction.

### Service Landscape

The backend runs ~18 singleton services. Each serves a specific gameplay purpose:

| Service | Gameplay Purpose |
|---------|-----------------|
| `sessionService` | Game lifecycle — create, start, pause, resume, end. Source of truth for session data. |
| `transactionService` | Token processing and scoring when teams bring tokens to GMs. |
| `stateService` | Legacy Layer 1 state aggregator. Computes GameState. |
| `videoQueueService` | Video queue for the TV. Players discovering video tokens trigger playback for everyone. |
| `vlcMprisService` | VLC process management and D-Bus MPRIS control. Plays videos on HDMI. |
| `displayControlService` | HDMI display state machine (idle loop / scoreboard / video). |
| `spotifyService` | Background venue music. Auto-ducked during videos/sounds. Paused with game clock. |
| `audioRoutingService` | Routes audio streams (video, spotify, sound) to outputs (HDMI, BT speakers). Ducking engine. |
| `bluetoothService` | BT speaker pairing and connection for venue audio. |
| `lightingService` | Venue lighting scenes via Home Assistant. Sets mood. |
| `soundService` | Sound effects via pw-play. Triggered by cues or GM commands. |
| `gameClockService` | Master game timer. Drives cue engine clock triggers and overtime. |
| `cueEngineService` | Automated show control — lighting, sound, Spotify, triggered by game events or time. |
| `serviceHealthRegistry` | Centralized health bulletin board for 8 services. |
| `commandExecutor` | Shared command dispatch for GM commands and cue engine. Service dependency gating. |

### Communication Architecture

```
Internal Events (EventEmitter)     WebSocket (Socket.io)        Clients
     services emit events    ->    broadcasts.js translates  ->  GM Scanner, Scoreboard
                                   syncHelpers.js builds         (via rooms: 'gm', 'session:{id}')
```

- `service:state` with `{domain, state}` envelope is the sole push mechanism for 10 service domains
- `sync:full` provides complete state restoration on connect/reconnect
- Discrete game events (`cue:fired`, `cue:completed`, `cue:error`, `transaction:new`, `session:update`, `display:mode`) are separate from service state

---

## 3. What Was Investigated

### Method

1. **Four parallel subagents** explored: scoreboard architecture, GM Scanner data pipeline, backend event chains, and uncommitted audio routing changes.
2. **Direct code reads** of all 18 service implementations, `broadcasts.js`, `syncHelpers.js`, `systemReset.js`, `cueEngineWiring.js`, `processMonitor.js`, `dbusSignalParser.js`, `networkedSession.js`, `NetworkedStorage.js`, `orchestratorClient.js`, `stateStore.js`, and `scoreboard.html`.
3. **Grep searches** to verify listener registration, event consumption, and dead code.

### Files Read (Complete List)

**Backend services (all read in full):**
- `backend/src/services/stateService.js` (411 lines)
- `backend/src/services/transactionService.js` (first 80 lines + structure)
- `backend/src/services/vlcMprisService.js` (545 lines)
- `backend/src/services/spotifyService.js` (446 lines)
- `backend/src/services/mprisPlayerBase.js` (389 lines)
- `backend/src/services/audioRoutingService.js` (first 400 lines + getState)
- `backend/src/services/bluetoothService.js` (837 lines)
- `backend/src/services/lightingService.js` (538 lines)
- `backend/src/services/soundService.js` (148 lines)
- `backend/src/services/gameClockService.js` (161 lines)
- `backend/src/services/cueEngineService.js` (first 150 lines)
- `backend/src/services/serviceHealthRegistry.js` (124 lines)
- `backend/src/services/displayControlService.js` (351 lines)
- `backend/src/services/cueEngineWiring.js` (127 lines)

**Backend infrastructure:**
- `backend/src/websocket/broadcasts.js` (674 lines, full)
- `backend/src/websocket/syncHelpers.js` (230 lines, full)
- `backend/src/services/systemReset.js` (285 lines, full — previous session)
- `backend/src/utils/processMonitor.js` (141 lines, full)

**GM Scanner (read by subagent + direct verification):**
- `ALNScanner/src/network/networkedSession.js` (328 lines)
- `ALNScanner/src/network/orchestratorClient.js` (299 lines)
- `ALNScanner/src/core/unifiedDataManager.js` (888 lines)
- `ALNScanner/src/core/storage/NetworkedStorage.js` (422 lines)
- `ALNScanner/src/core/stateStore.js` (48 lines)

**Scoreboard (read by subagent):**
- `backend/public/scoreboard.html` (1631 lines)

---

## 4. Cross-Service Findings

These patterns affect multiple services or cut across the architecture.

### 4.1 D-Bus Owner Resolution Not Called After VLC Crash-Restart

**Severity:** Could cause erratic behavior during a game after any VLC crash

**Code evidence:**

Both VLC and Spotify extend `MprisPlayerBase` which uses `_ownerBusName` for D-Bus sender filtering (`mprisPlayerBase.js:266`). This prevents one service from processing the other's D-Bus signals (they share the session bus at path `/org/mpris/MediaPlayer2`).

When VLC crashes:
- `vlcMprisService.js:68` — `this._ownerBusName = null` (correctly cleared)
- `vlcMprisService.js:73-76` — VLC respawns after 3s delay
- The D-Bus monitor (`startPlaybackMonitor()`) is still running from init
- But nothing calls `_resolveOwner()` to get the new VLC's unique bus name

The sender filtering check in `mprisPlayerBase.js:266`:
```javascript
if (this._ownerBusName && signal.sender && signal.sender !== this._ownerBusName) {
```
When `_ownerBusName` is null, the first condition is false — ALL signals pass through regardless of sender.

The mismatch handler (`mprisPlayerBase.js:269-273`) that would trigger `_refreshOwner()` only fires when `_ownerBusName` IS set but doesn't match. When it's null, this path is never reached.

**Contrast with Spotify** — `spotifyService.js:364-371` calls `this._resolveOwner()` during health auto-recovery in `_processStateChange()`. VLC's `_processStateChange()` (`vlcMprisService.js:452-455`) does NOT:

```javascript
// VLC — missing _resolveOwner() call
if (!registry.isHealthy('vlc')) {
  registry.report('vlc', 'healthy', 'MPRIS signal received');
}

// Spotify — has _resolveOwner() call
if (!registry.isHealthy('spotify')) {
  // ...clear caches...
  registry.report('spotify', 'healthy', 'MPRIS signal received');
  this._resolveOwner(); // Fire-and-forget: re-resolve after restart
}
```

**Gameplay impact:** After VLC crash, Spotify signals processed by VLC's state handler. Video `service:state` domain updates with bogus data on every Spotify track/playback change. GM admin panel shows incorrect video state. Possible false video:started/completed events cascading to display control, ducking engine, cue engine.

### 4.2 ProcessMonitor Silent Permanent Give-Up

**Severity:** Could silently disable monitoring mid-game with no notification

**Code evidence:** `processMonitor.js:98-101`:
```javascript
this._failures++;
if (this._failures >= this._maxFailures) {
  logger.error(`${this._label} failed ${this._failures} times, giving up`);
  this.emit('gave-up', { failures: this._failures });
  return;
}
```

Grep for `gave-up` across all backend source: **only ProcessMonitor emits it. No service listens for it.**

Four services use ProcessMonitor:
- `audioRoutingService` — `pactl subscribe` for sink detection
- `bluetoothService` — `dbus-monitor --system` for device state
- `spotifyService` (via MprisPlayerBase) — `dbus-monitor --session` for playback
- `vlcService` (via MprisPlayerBase) — `dbus-monitor --session` for playback

Default `maxFailures = 5`. A "failure" is a process exit without receiving any stdout data. If the underlying system (PipeWire, D-Bus) is temporarily unavailable during restart, each attempt exits immediately → failure count increments.

**Gameplay impact:** If PipeWire restarts during a game (e.g., Bluetooth A2DP profile switch can trigger this), `pactl subscribe` could hit maxFailures and permanently stop. Sink add/remove events would no longer be detected. Audio routing changes (BT speaker connect/disconnect) would be invisible to the system. No health report, no GM notification.

### 4.3 stateService Computing GameState for Zero Consumers (Layer 1 Dead Code)

**Severity:** Wasted CPU on every event, no functional impact

**Code evidence:** `stateService.js` registers 8 event listeners (lines 56-244) on `sessionService`, `transactionService`, `offlineQueueService`, and `videoQueueService`. Each listener calls `this.getCurrentState()` → `GameState.fromSession()` → `this.emitStateUpdate()` → `this.emit('state:updated', ...)`.

Grep for `state:updated` across `backend/src/websocket/`: **zero matches**. `broadcasts.js` does NOT listen for this event. No other consumer exists.

On every transaction, video event, session change, and offline status change, stateService:
1. Retrieves the full session object
2. Constructs a complete `GameState` object (scores, transactions, video status)
3. Emits it into the void

The 100ms debounce (`stateService.js:31`) mitigates but doesn't eliminate the waste.

**Gameplay impact:** Adds CPU load to the Pi's single Node.js thread during peak game activity. No functional effect on gameplay.

### 4.4 Listener Lifecycle Fragility in systemReset

**Severity:** Works correctly today but fragile — reordering breaks silently

**Code evidence:** `systemReset.js` reset sequence (line numbers from previous session read):

1. `cleanupBroadcastListeners()` — removes broadcasts.js listeners
2. `listenerRegistry.cleanup()` — removes tracked listeners
3. `sessionService.reset()` — internally calls `setupPersistenceListeners()` → registers listeners on `transactionService`
4. `transactionService.reset()` — calls `removeAllListeners()` → **clears what step 3 just added**
5. (later) `sessionService.setupPersistenceListeners()` — re-registers on `transactionService`

Step 5 restores what step 4 destroyed. The system works because steps 3-5 happen in this exact order. But:
- If someone reorders steps 3 and 4, listeners accumulate (double-fire)
- If someone removes step 5 thinking step 3 handled it, persistence breaks
- No test enforces this ordering dependency

**Gameplay impact:** Between games, if reset execution order changes, the next game could have missing transaction persistence or double-fired events.

### 4.5 sync:full Global Broadcast on scores:reset and offline:queue:processed

**Severity:** Low immediate risk, architectural inconsistency

**Code evidence:**

`broadcasts.js:338` (scores:reset handler):
```javascript
emitWrapped(io, 'sync:full', syncFullPayload);  // GLOBAL — to all sockets
```

`broadcasts.js:379` (offline:queue:processed handler):
```javascript
emitWrapped(io, 'sync:full', syncFullPayload);  // GLOBAL — to all sockets
```

Contrast with correct patterns:
- Session creation (`broadcasts.js:95`): `emitToRoom(io, 'gm', 'sync:full', syncPayload)` — gm room
- GM connect (`gmAuth.js`): sent to individual socket — individual

`emitWrapped()` broadcasts to ALL connected sockets. The `scores:reset` event itself IS correctly session-scoped (line 321: `emitToRoom(io, \`session:${session.id}\`, 'scores:reset', ...)`), but the subsequent sync:full is global.

**Gameplay impact:** Combined with finding 6.1 (transaction re-submission), a global sync:full triggers re-submission on ALL connected GM Scanners simultaneously. On its own, the global targeting is wasteful but not functionally broken since the scoreboard already joins the gm room and would receive it either way.

---

## 5. Per-Service Findings

### 5.1 VLC (`vlcMprisService.js`)

**Gameplay role:** Plays videos on the TV (HDMI output). Player-discovered video tokens trigger playback for the whole venue. Also plays idle-loop.mp4 between videos.

**Process management:** VLC is spawned directly (NOT via ProcessMonitor — VLC writes to stderr not stdout, which would trigger false `maxFailures` give-ups). Custom restart-on-exit with 3s delay. `pkill -x cvlc` on spawn prevents orphan D-Bus name conflicts.

**Findings:**

1. **Owner resolution gap after crash** — See finding 4.1 above. After VLC crash+restart, D-Bus sender filtering is permanently disabled.

2. **State delta detection** (`vlcMprisService.js:485-492`) — Only emits `state:changed` when playback state OR filename actually changes. This prevents spurious broadcasts but means if VLC crashes and restarts into the same state (e.g., stopped with no file), no `state:changed` event fires. Health auto-recovers via `_processStateChange()`, but the video `service:state` domain may not push to the GM Scanner until something actually changes.

3. **Init sequence** (`vlcMprisService.js:177-197`) — Spawns VLC, waits up to 5s for D-Bus registration, starts playback monitor, resolves owner. If VLC isn't ready in 5s, init continues without error ("D-Bus monitor will detect when available"). This is graceful degradation but means video commands could fail in the first few seconds after server start.

### 5.2 Spotify (`spotifyService.js`)

**Gameplay role:** Background venue music via spotifyd + Bluetooth speakers. Auto-ducked when videos/sounds play. Paused when game clock pauses. Resumed when game clock resumes (only if it was paused BY the game clock — preserves user-paused state).

**Findings:**

1. **TransferPlayback intentionally NOT called at init** (`spotifyService.js:213-216` comment). Init only checks if MPRIS is already available. If not, it waits for the user to transfer playback via the Spotify app on their phone. The D-Bus monitor auto-detects the transfer. This means **Spotify won't play at server start** — requires manual GM action before the game. If forgotten, Spotify commands fail silently until transfer.

2. **Most robust recovery of all services** — `_dbusCall()` override (`spotifyService.js:131-162`) catches failures → clears all caches → activates via TransferPlayback → retries. `_recovering` flag prevents infinite recursion. After recovery, re-discovers destination AND resolves owner. This handles spotifyd PID changes on restart.

3. **5-minute destination cache TTL** (`DBUS_DEST_CACHE_TTL = 300000`). If spotifyd restarts mid-game, passive monitoring would detect the sender mismatch and trigger `_refreshOwner()`. Active commands would fail once, then recovery logic kicks in. The 5-minute TTL is only relevant if no commands or signals occur in that window.

4. **`_pausedByGameClock` flag** (`spotifyService.js:264-265`) — Set when Spotify is paused by game clock pause. `resumeFromGameClock()` only resumes if this flag is true. If Spotify was manually paused by the GM, game clock resume won't start it. This is correct intentional behavior.

### 5.3 Audio Routing (`audioRoutingService.js`)

**Gameplay role:** Routes audio streams (video, spotify, sound) to output sinks (HDMI, Bluetooth, combine-bt virtual sink). Ducking engine auto-reduces Spotify volume during videos/sounds.

**Findings:**

1. **Combine-sink processes are unmonitored** — `pw-loopback` processes for dual BT speakers are spawned and tracked in `_combineSinkProcs` array, but NOT managed by ProcessMonitor. If one dies silently (OOM kill, crash), one BT speaker goes quiet with no notification. The `_combineSinkActive` flag remains true.

2. **HDMI card activation at init only** (`_activateHdmiCards()` in init). If the projector/TV is powered on AFTER server start, the HDMI sink may not appear in PipeWire until its card profile is activated. The `pactl subscribe` monitor would detect the new card, but `_activateHdmiCards()` is not re-called on card events. Only sink add/remove is processed.

3. **Ducking wiring lives in broadcasts.js** (lines 389-415) — not in audioRoutingService itself. `broadcasts.js` listens for video/sound lifecycle events and calls `audioRoutingService.handleDuckingEvent()`. This wiring is created in `setupBroadcastListeners()` and torn down in `cleanupBroadcastListeners()`. During system reset, it's removed and re-registered — correct, but relies on the same ordering fragility as finding 4.4.

4. **Routing fallback to HDMI** (`audioRoutingService.js:338-350`) — If the configured BT sink is unavailable when `applyRouting()` is called, it falls back to HDMI and emits `routing:fallback`. This is graceful, but the GM might not notice their audio routing was silently changed. The `routing:fallback` event does push via `service:state` domain `audio`.

5. **`findSinkInput()` retry with 2s max wait** — If PipeWire hasn't created the sink-input yet (e.g., VLC just started a video), routing silently fails with a warning log. No retry after the 2s window.

### 5.4 Bluetooth (`bluetoothService.js`)

**Gameplay role:** Pairs and connects BT speakers in the venue. Audio routing depends on BT sinks being available.

**Findings:**

1. **Interactive pairing state machine** (`_pairInteractive()`, lines 645-763) — 4-state machine (scan -> discover -> pair -> trust) in a single interactive `bluetoothctl` session. Required because BlueZ evicts unpaired devices from cache when scan exits. ANSI escape stripping, multiple timeouts, fallback discovery timer. Complex but necessary.

2. **A2DP profile enforcement is best-effort** (`_enforceA2DPProfile()`, lines 344-354). Sets PipeWire card profile to `a2dp-sink` to prevent HFP/HSP (mono 16kHz headset mode). If this fails, audio plays through HFP which sounds garbled. **No detection of failure state** — the GM hears bad audio with no diagnostic information in the admin panel.

3. **D-Bus device monitor** uses debounce at 500ms per device. During rapid connect/disconnect cycling, state updates are delayed but accurate.

4. **Pre-seed cache** (`_preSeedDeviceCache()`, lines 476-492) runs asynchronously and non-blocking on monitor start. If the first D-Bus signal arrives before pre-seed completes, the device name may not be cached and requires a `bluetoothctl info` shell-out.

### 5.5 Lighting (`lightingService.js`)

**Gameplay role:** Controls venue lighting scenes via Home Assistant (Docker container on the Pi). Sets mood for the immersive experience.

**Findings:**

1. **Fallback scenes from test fixtures** (`_loadFallbackScenes()`, lines 329-346) — reads from `../../tests/fixtures/scenes.json`. If HA is unreachable at init AND the WebSocket connection fails, the GM sees **test fixture scene names** in the admin panel dropdown. These won't match real HA scene entity IDs, so activation attempts will fail with unhelpful errors.

2. **`auth_invalid` is permanent death** (line 214: `this._wsStopped = true`) — If the HA long-lived access token expires or is rotated during a game, the WebSocket stops and **never reconnects**. HTTP polling continues (30s interval) but only checks connection status. Scene activations via REST API still work if the token is valid for REST (separate auth path), but WebSocket event monitoring (scene activation detection) stops.

3. **Scene state detection string** (line 237): `new_state?.state === 'scening'` — This is the HA state string used to detect scene activations via WebSocket. **Not verified against actual Home Assistant behavior.** If HA uses a different state string, scene activations via WebSocket would never be detected (only direct `activateScene()` calls would update `_activeScene`).

4. **Docker container readiness** — `_ensureContainerRunning()` starts the HA container if needed but does not wait for HA to be ready. The subsequent `checkConnection()` has a 5s timeout. If HA takes longer to start, init falls back to reconnect polling (30s).

### 5.6 Sound (`soundService.js`)

**Gameplay role:** Sound effects played via `pw-play`. Triggered by cues or direct GM commands.

**Findings:**

1. **Minimal service, no significant issues.** Simple spawn/kill pattern. Health check is `which pw-play`.

2. **Not included in sync:full** — `buildSyncFullPayload()` does not call `soundService.getState()`. On GM reconnect, any currently-playing sound won't appear in the admin panel. Low impact since sounds are typically short-lived.

3. **No volume validation** — `volume` parameter from GM command goes directly to `pw-play --volume` as `volume / 100`. The `commandExecutor` should validate range, but if it doesn't, extreme values go through.

### 5.7 Game Clock (`gameClockService.js`)

**Gameplay role:** Master game timer (2-hour game). Drives cue engine clock-based triggers and overtime detection. Session pause cascades to game clock pause, which cascades to Spotify pause and cue engine suspend.

**Findings:**

1. **`gameclock:tick` is NOT in the service:state broadcast list** — `broadcasts.js` (lines 516-518) only pushes `service:state` domain `gameclock` on `gameclock:started`, `gameclock:paused`, `gameclock:resumed`. This is by design (1-second ticks would be too chatty for WebSocket). The GM Scanner must compute elapsed time locally from the last known start/resume event + local clock. If local clock drifts relative to Pi clock, the displayed elapsed time gradually diverges from reality.

2. **Restore from persistence doesn't emit events** (`gameClockService.js:99-113`) — After server restart mid-game, `restore()` starts the tick interval but does NOT emit `gameclock:started` or `gameclock:resumed`. This means:
   - The cue engine isn't notified the clock is running again
   - Standing cues that trigger on `gameclock:started` won't fire
   - `broadcasts.js` doesn't push a `gameclock` service:state update
   - The GM Scanner won't know the clock is running until the next `sync:full`

3. **Always reports healthy** — Constructor reports healthy (`registry.report('gameclock', 'healthy', 'In-process timer')`) and `reset()` also reports healthy. Game clock never appears "down" in the health dashboard regardless of actual state (stopped/running/paused). Not wrong (it's an in-process timer), but could be misleading.

### 5.8 Cue Engine (`cueEngineService.js`)

**Gameplay role:** Automated show control. Standing cues fire on game events (transaction types, clock thresholds, player scans). Manual cues fired by GM. Compound cues run multi-step timelines with commands.

**Findings:**

1. **Held cues auto-discard after 10s** — When a cue command requires a service that's down or a video is already playing, the cue is held. After 10s, auto-discarded. No automatic retry when the service comes back. GM can manually release held items but needs to notice within 10s window.

2. **EVENT_NORMALIZERS** (`cueEngineService.js:26-55`) — Flatten event payloads to flat fields for condition matching. If a normalizer doesn't match the actual payload shape from the emitting service (e.g., if transactionService changes its `transaction:accepted` payload structure), condition fields evaluate as `undefined` and conditions silently fail to match.

3. **Cue engine wiring** (`cueEngineWiring.js`) — `video:paused` and `video:resumed` are forwarded twice: once for standing cue evaluation (line 57-61: `handleGameEvent()`) and once for compound cue lifecycle control (lines 74-83: `handleVideoLifecycleEvent()`). These call different methods and do different things. Not a bug — compound cue lifecycle control (pause/resume timeline) is separate from standing cue evaluation (check conditions). But the double registration could cause confusion during maintenance.

4. **Self-chaining** (`cueEngineWiring.js:108-110`) — The cue engine listens for its own `cue:completed` event to support cue chaining. This is intentional but creates theoretical infinite loop risk if cues chain circularly. No guard against this.

### 5.9 Display Control (`displayControlService.js`)

**Gameplay role:** Manages what appears on the TV via HDMI — idle loop video, scoreboard web page, or triggered video. Automatically returns to previous mode after video finishes.

**Findings:**

1. **Pre-play hook timing** (`displayControlService.js:63-74`) — `videoQueueService.registerPrePlayHook()` enters VIDEO mode BEFORE VLC starts playing. If VLC fails to play the video, the pre-play hook has already hidden the scoreboard and switched mode. The `_doPlayVideo()` failure handler (line 259) reverts mode, but this only covers direct `playVideo()` calls. The pre-play hook runs for ALL video sources (player scan, compound cue, manual) via `videoQueueService`.

2. **Lock pattern** — `_withLock()` serializes async transitions. But `_handleVideoComplete()` is called from a `video:idle` event handler (not within a lock) and then calls `setScoreboard()` or `setIdleLoop()` (which acquire locks). Small interleave window exists between event delivery and lock acquisition.

### 5.10 Service Health Registry (`serviceHealthRegistry.js`)

**Gameplay role:** Centralized health tracking for 8 services. GM admin panel shows per-service status. Commands are gated by service health (commandExecutor rejects commands when dependencies are down).

**Findings:**

1. **8 hard-coded known services** (`serviceHealthRegistry.js:14`): `vlc`, `spotify`, `sound`, `bluetooth`, `audio`, `lighting`, `gameclock`, `cueengine`. If a new service is added without updating this list, its `report()` calls are silently ignored with a warning log.

2. **`reset()` emits `health:changed` for each service going from healthy to down** (lines 104-121). This triggers 8 separate `service:state` domain `health` pushes to the GM Scanner (one per service status change).

---

## 6. Data Pipeline Findings

These findings are about the transaction/scoring/sync pipeline. Included for completeness — they are NOT the primary focus of this investigation per the owner's instructions.

### 6.1 sync:full Transaction Re-Submission Bug

**Code evidence:** `networkedSession.js:216`:
```javascript
payload.recentTransactions.forEach(tx => this.dataManager.addTransaction(tx));
```

`addTransaction()` routes to `NetworkedStorage.addTransaction()` (`NetworkedStorage.js:55-95`) which emits `transaction:submit` back to the backend via WebSocket. Every transaction in a sync:full payload gets re-submitted as a new scan.

The correct methods already exist:
- `addTransactionFromBroadcast()` (`NetworkedStorage.js:336`) — stores locally without re-submitting
- `setTransactions()` (`NetworkedStorage.js:328`) — bulk replace

The `transaction:new` handler (`networkedSession.js:262`) correctly uses `addTransactionFromBroadcast()`. Only the sync:full handler uses the wrong method.

**Gameplay impact:** On GM Scanner reconnect (page refresh, network blip, server restart), duplicate `transaction:submit` events flood the backend. Backend's `isDuplicate()` should reject them, but it creates processing overhead and log noise. Could be related to yesterday's missing transactions if the re-submission storm corrupts the pipeline.

### 6.2 Score Delivery Redundancy (4 Paths)

Four separate paths deliver score data to consumers:

| # | Event | Room | Trigger |
|---|-------|------|---------|
| 1 | `score:updated` | `gm` | Every `transaction:accepted` and `score:adjusted` |
| 2 | `score:adjusted` | `session:{id}` | Admin score adjustments only |
| 3 | `transaction:new.teamScore` | `session:{id}` | Every new transaction (stashed from `transaction:accepted`) |
| 4 | `sync:full.scores` | varies | Connect, scores:reset, offline processing |

For a single transaction, the GM Scanner receives score data through paths 1 AND 3. The scoreboard receives it through paths 1, 3, and potentially 4. No single authoritative path.

### 6.3 Scoreboard Architecture

The scoreboard (`backend/public/scoreboard.html`, 1631 lines) reports `deviceType: 'gm'` (line 1371), which means it joins the `gm` room and `session:{id}` room — receiving ALL GM-targeted broadcasts including `service:state` events it doesn't need.

Has hardcoded auth password (`@LN-c0nn3ct`, line 769). Listens for 14 WebSocket events. `sync:full` handler uses REPLACE semantics. No guards against missing fields in sync:full.

---

## 7. Uncommitted Changes

### Status

8 modified files from yesterday's rushed pre-game bug fixing:

| File | Status | What Changed |
|------|--------|-------------|
| `audioRoutingService.js` | Staged | `getState()` includes `availableSinks`, HDMI card activation fix, `parsePactlEvent` regex fix |
| `mprisPlayerBase.js` | Unstaged | D-Bus sender filtering via `_ownerBusName` |
| `spotifyService.js` | Unstaged | `_refreshOwner()` override for PID restart handling |
| `vlcMprisService.js` | Unstaged | `_resolveOwner()` after `startPlaybackMonitor()`, clear on process exit |
| 4 test files | Unstaged | Test updates matching implementation changes |

### Assessment

- All 354 tests pass
- The D-Bus sender filtering fix addresses init-time cross-contamination
- However, the VLC crash-restart path is NOT fully addressed (see finding 4.1)
- The audio routing `getState()` fix is needed for the GM admin panel sink dropdown
- These changes are safe to commit

---

## 8. Verification Gaps

Things this investigation could NOT determine from code reading alone:

1. **Home Assistant `'scening'` state string** — Is this actually what HA emits for scene activations? Needs testing against live HA instance.

2. **ProcessMonitor give-up frequency** — Does PipeWire actually restart frequently enough during BT profile switches to trigger 5 consecutive failures? Needs observation during actual BT speaker pairing.

3. **VLC cross-contamination in practice** — Does the owner resolution gap (finding 4.1) actually manifest during a game? Depends on whether VLC crashes occur while Spotify is actively changing state. Need to check yesterday's logs for VLC crash events.

4. **HDMI card activation** — Does the specific TV/projector used in the venue require explicit card profile activation, or does PipeWire auto-activate on HDMI hotplug?

5. **Game clock drift** — How much does the GM Scanner's locally-computed elapsed time diverge from the Pi's clock over a 2-hour game? Depends on browser timer accuracy.

6. **Combine-sink process stability** — Do `pw-loopback` processes survive a full 2-hour game, or do they occasionally die? No monitoring means no historical data.

7. **Ducking wiring after reset** — Does the broadcast listener re-registration (finding 4.4) correctly restore ducking wiring between games? Needs testing across system reset.

8. **Game clock `restore()` event gap** — After a server restart mid-game, does the lack of `gameclock:started` emission cause cue engine misfire? Depends on whether there are standing cues that trigger on `gameclock:started` in the current cue definitions.

---

## Appendix: Key File Locations

For the verifier's reference:

| Purpose | Path |
|---------|------|
| Broadcast bridge (events → WebSocket) | `backend/src/websocket/broadcasts.js` |
| sync:full payload builder | `backend/src/websocket/syncHelpers.js` |
| System reset sequence | `backend/src/services/systemReset.js` |
| GM Scanner event routing | `ALNScanner/src/network/networkedSession.js` |
| GM Scanner storage (networked) | `ALNScanner/src/core/storage/NetworkedStorage.js` |
| Cue engine event wiring | `backend/src/services/cueEngineWiring.js` |
| Process monitor utility | `backend/src/utils/processMonitor.js` |
| D-Bus signal parser | `backend/src/utils/dbusSignalParser.js` |
| Service health registry | `backend/src/services/serviceHealthRegistry.js` |
| Scoreboard | `backend/public/scoreboard.html` |
| MPRIS base class | `backend/src/services/mprisPlayerBase.js` |
| Command executor | `backend/src/services/commandExecutor.js` |
