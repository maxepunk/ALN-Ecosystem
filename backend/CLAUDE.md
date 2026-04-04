# CLAUDE.md - Backend Orchestrator

Last verified: 2026-03-01

This file provides guidance for working with the ALN Backend Orchestrator - a Node.js server managing sessions, scoring, video playback, and WebSocket/HTTP APIs.

For cross-cutting concerns (scoring logic, operation modes, game modes, token schema), see '../CLAUDE.md'.

## Quick Reference

| Resource | Location |
|----------|----------|
| API Contract (HTTP) | 'contracts/README.md', 'contracts/openapi.yaml' |
| WebSocket Events | 'backend_docs/WEBSOCKET_QUICK_REFERENCE.md' |
| WebSocket Deep Dive | 'backend_docs/WEBSOCKET_ANALYSIS.md' |
| E2E Testing | 'backend_docs/E2E_TEST_HELPERS.md' |
| Deployment Guide | '../DEPLOYMENT_GUIDE.md' |
| Scoring Logic | '../docs/SCORING_LOGIC.md' |
| Session Validation | `npm run session:validate` (see Post-Session Analysis) |
| Log Archival | '../logs/README_LOG_ARCHIVAL.md' |

## Key Commands

### Development
```bash
npm run dev              # Interactive mode selector
npm run dev:full         # Orchestrator with VLC (hot reload, VLC auto-spawned)
npm run dev:no-video     # Orchestrator only
npm run lint             # ESLint
```

### Testing

**4 test layers:** unit, contract, integration, E2E. (The former functional layer was merged into integration.)

```bash
# Fast feedback
npm test                  # Unit + contract (~15-30s)
npm run test:unit         # Unit tests (parallel, 4 workers)
npm run test:contract     # Contract tests (parallel, 4 workers)

# Integration (MUST run sequentially)
npm run test:integration  # Sequential (~5 min)

# E2E (requires orchestrator running)
npm run test:e2e          # Playwright (2 workers, ~4-5 min)
npx playwright test flows/00-smoke  # Specific suite
npx playwright test --debug         # Step-through debugger

# Comprehensive
npm run test:all          # Unit + contract + integration (~5-6 min)
npm run test:full         # All tests including E2E (~10-15 min)

# Coverage ratchet (per-file thresholds, unit + contract only)
npm run coverage:ratchet  # Regenerate per-file coverage thresholds
npm run coverage:check    # Verify no file regressed below threshold
```

### Production
```bash
npm start                 # PM2 start
npm run prod:status       # Check processes
npm run prod:logs         # View logs
npm run prod:restart      # Restart all services
npm run health            # Full system health check
```

### Utilities
```bash
node start-session.js     # CLI to create test session
npm run health:api        # Check orchestrator only
```

**Critical Testing Notes:**
- Contract tests call `initializeServices()` from `app.js` (full service init). `ENABLE_VIDEO_PLAYBACK=false` is set in `jest.config.base.js` to prevent real VLC spawning. Can be overridden by setting the env var explicitly before Jest runs.
- Integration tests do selective init in `setupIntegrationTestServer()` (persistenceService, transactionService, sessionService only) — they never call `vlcService.init()` or `initializeServices()`.
- Integration tests MUST run sequentially (`--runInBand`) to prevent state contamination
- Use `resetAllServicesForTesting()` helper in integration tests to prevent listener leaks
- E2E tests require orchestrator running: `npm run dev:full`
- E2E uses lightweight fixtures (`tests/e2e/fixtures/`) not production token data
- E2E uses 2 workers (`--workers=2` in npm script overrides playwright.config.js default of 1)
- E2E `GMScannerPage.createSession()` waits for `.session-status--setup` (Phase 1 lifecycle). `createSessionWithTeams()` then calls `startGame()` to transition to active. If session lifecycle states change, update locators in `tests/e2e/helpers/page-objects/GMScannerPage.js`.

**Shared Mock Factories:**

Shared mock factories in `tests/helpers/mocks/` provide canonical mock shapes for each service. Use `createMockSessionService()`, `createMockTransactionService()`, etc. for new tests. Each factory extends EventEmitter and stubs all public methods with `jest.fn()`. Accepts an `overrides` parameter for test-specific customization. Available factories: sessionService, transactionService, videoQueueService, bluetoothService, audioRoutingService, lightingService, offlineQueueService.

**Coverage Ratchet:**

Per-file coverage thresholds in `.coverage-thresholds.json` (tracked in git). Thresholds are rounded down to nearest 5%. Covers unit + contract tests only (not integration). `npm run coverage:ratchet` regenerates thresholds from current coverage data. `npm run coverage:check` verifies no file regressed. Script: `scripts/coverage-ratchet.js`. **Enforced automatically:** `test:all` and `test:ci` run `jest --coverage` + `coverage:check` before integration tests.

**Contract Request Validation:**

`tests/helpers/contract-validator.js` validates both REQUEST and RESPONSE schemas against OpenAPI spec:
- `validateHTTPRequest(body, path, method)` — validates request body against OpenAPI requestBody schema
- `validateHTTPResponse(response, path, method, status)` — validates response against OpenAPI response schema
- `getHTTPRequestSchema(path, method)` / `getHTTPSchema(path, method, status)` — extract JSON Schema
- Scanner contract tests in `tests/contract/scanner/request-schema-validation.test.js` validate ESP32 and PWA payload formats

**Model unit tests:** `tests/unit/models/` covers TeamScore (scoring, groups, comparison, reset, serialization), DeviceConnection (lifecycle, heartbeat timeout, sync state, serialization), VideoQueueItem (playback state machine, timing).

**Service unit tests:** `tests/unit/services/heartbeatMonitorService.test.js` covers init/start/stop, interval checking, device timeout detection.

**WebSocket unit tests:** `tests/unit/websocket/adminEvents.test.js` covers core gm:command routing (auth, ack format, system:reset mutex, envelope unwrapping) and transaction submission (session state, offline queuing). Environment commands tested separately in `adminEvents-envControl.test.js`.

**Full verification workflow** (including E2E prerequisites): See root `CLAUDE.md` → Verification Checkpoints

## Architecture

### Service Singleton Pattern

Most services export a module-level singleton via `module.exports = new ServiceClass()`:

| Service | Purpose | Export Style |
|---------|---------|--------------|
| `sessionService` | Active session (source of truth, persisted) | `new SessionService()` |
| `transactionService` | Token scan processing and scoring | `new TransactionService()` |
| `videoQueueService` | Video playback queue | `new VideoQueueService()` |
| `vlcService` | VLC D-Bus MPRIS control (extends MprisPlayerBase) | `new VlcMprisService()` |
| `discoveryService` | UDP broadcast (port 8888) | Class export (instantiated by caller) |
| `tokenService` | Token data loading | Function exports (no class) |
| `offlineQueueService` | Offline scan management | `new OfflineQueueService()` |
| `persistenceService` | Disk persistence | `new PersistenceService()` |
| `displayControlService` | HDMI display mode state machine | `new DisplayControlService()` |
| `audioRoutingService` | PipeWire audio routing (HDMI/Bluetooth) | `new AudioRoutingService()` |
| `bluetoothService` | Bluetooth speaker pairing via bluetoothctl | `new BluetoothService()` |
| `lightingService` | Home Assistant scene control (Docker lifecycle) | `new LightingService()` |
| `heartbeatMonitorService` | HTTP device timeout monitoring | `new HeartbeatMonitorService()` |
| `gameClockService` | Game clock (start/pause/resume/tick) | `new GameClockService()` |
| `cueEngineService` | Standing + manual cue evaluation and firing | `new CueEngineService()` |
| `soundService` | pw-play wrapper for audio playback | `new SoundService()` |
| `spotifyService` | D-Bus MPRIS wrapper for spotifyd playback (extends MprisPlayerBase) | `new SpotifyService()` |
| `serviceHealthRegistry` | Centralized health for 8 services | `new ServiceHealthRegistry()` |
| `commandExecutor` | Shared gm:command execution logic | Function export (`executeCommand`) |

**System Reset:** `systemReset.js` exports `performSystemReset()` for coordinated reset (production `system:reset` command and test helper). Archives session, ends lifecycle, cleans up listeners, resets all services (tear-down only), then re-initializes infrastructure via centralized post-reset wiring: `registerBroadcastListeners()`, `cueEngineWiring.registerCueEngineListeners()`, `sessionService.registerTransactionListeners()`, and `sessionService.registerBroadcastListeners()`.

**transactionService API Note:** `processScan()` and `createManualTransaction()` no longer accept a `session` parameter. The service retrieves the current session internally via `sessionService.getCurrentSession()`.

### Session as Source of Truth

**CRITICAL**: Session (`sessionService`) is the single source of truth — persisted to disk, survives restarts. There is no separate state service; game state is derived from the session and delivered via `sync:full` and `service:state` events.

### Event-Driven Service Coordination

**Layer 1: Backend Internal (Node.js EventEmitter)**

Service-to-service communication within orchestrator backend.

**Pattern:**
```
Domain Event (Service) → Listener (broadcasts.js) → WebSocket Broadcast
```

**Key Services & Events:**
- `sessionService`: `session:created`, `session:updated`, `transaction:added`, `player-scan:added`, `device:updated/removed`
- `transactionService`: `transaction:accepted`, `group:completed`, `score:adjusted`, `scores:reset`
- `videoQueueService`: `video:*`, `queue:*`
- `serviceHealthRegistry`: `health:changed` (all service health consolidated here — no per-service connection events)
- `bluetoothService`: `device:connected/disconnected/paired/unpaired/discovered`, `scan:started/stopped`
- `audioRoutingService`: `routing:changed`, `routing:applied`, `routing:fallback`, `sink:added`, `sink:removed`
- `lightingService`: `scene:activated`, `scenes:refreshed`
- `gameClockService`: `gameclock:started`, `gameclock:paused`, `gameclock:resumed`, `gameclock:tick`, `gameclock:overtime`
- `cueEngineService`: `cue:fired`, `cue:completed`, `cue:error`, `cue:started`, `cue:status`, `cue:held`, `cue:released`, `cue:discarded`
- `spotifyService`: `playback:changed`, `volume:changed`, `playlist:changed`, `track:changed`
- `soundService`: `sound:started`, `sound:completed`, `sound:stopped`, `sound:error`
- `vlcService`: `state:changed` (emitted by D-Bus MPRIS monitor when playback state or filename changes)

**Score Delivery (Layer 2→3 Cleanup):**
- `score:updated` removed — no longer emitted by any service or broadcast
- Scores delivered via: `transaction:new.teamScore` (per-transaction), `score:adjusted` (admin adjustments), `transaction:deleted.updatedTeamScore` (deletions), `sync:full` (reconnection)

**Transaction Event Flow (SRP Architecture):**
```
processScan()
  → transactionService.emit('transaction:accepted', {transaction, teamScore, groupBonus, deviceTracking})
    → sessionService listener persists to session
      → sessionService.emit('transaction:added')
        → broadcasts.js sends WebSocket 'transaction:new'
```

**Key Change:** `sessionService` now owns ALL transaction persistence. The `transaction:accepted` event contains the full scoring context (teamScore, groupBonus, deviceTracking) so listeners don't need to recalculate.

**Player Scan Event Flow:**
```
POST /api/scan (player scanner) [scanRoutes.js]
  → sessionService.addPlayerScan() persists to session.playerScans[]
  → scanRoutes.js emits WebSocket 'player:scan' directly to GM room via emitToRoom()
```

Note: Player scan broadcast is handled directly in `scanRoutes.js` (not via broadcasts.js). The `player-scan:added` event is emitted by sessionService but has no listener in broadcasts.js. Player scans in `sync:full` payloads come from `session.playerScans[]`.

Player scans are tracked for Game Activity (token lifecycle visibility) but do not affect scoring.

**Key Files:** `src/websocket/broadcasts.js`

**Layer 2: WebSocket (AsyncAPI)**

See 'backend_docs/WEBSOCKET_QUICK_REFERENCE.md' for event reference.

### Display Control Architecture

Manages HDMI output display modes (idle loop video, scoreboard browser, triggered videos).

**Display Modes:**
- `IDLE_LOOP`: VLC plays idle-loop.mp4 on continuous loop
- `SCOREBOARD`: Chromium kiosk displays scoreboard.html
- `VIDEO`: VLC plays triggered video, returns to previous mode after

**Architecture:**
```
displayControlService (State Machine)
  ├── vlcService (Video playback)
  └── displayDriver (Browser control)
```

**Key Implementation Details:**
- Chromium is launched ONCE and persisted for the session. Display transitions use `xdotool windowminimize` (hide) and `xdotool windowactivate` + `wmctrl -b add,fullscreen` (show). No kill/spawn per video cycle.
- `xdotool search --name "Case File"` finds the content window by HTML `<title>` (not `--class` which returns all Chromium windows; not `--pid` — Chromium forks). Looked up fresh per show/hide — never cached.
- `displayDriver.cleanup()` is the only kill path (called from server.js shutdown handler). Sends SIGTERM, waits 1s, escalates to SIGKILL via `process.kill(pid, 0)` alive-check.
- `_doLaunch()` kills orphaned Chromium via PID file (`/tmp/aln-pm-scoreboard-chromium.pid`) with SIGKILL before spawning. Includes 1s alive-check after spawn to detect early crashes.
- System dependencies: `sudo apt-get install -y xdotool wmctrl`
- Chromium requires `--password-store=basic` flag to prevent keyring dialog
- Scoreboard URL uses auto-detected local IP (not localhost) for CDN resources

**Key Files:** `src/services/displayControlService.js`, `src/utils/displayDriver.js`, `src/services/vlcMprisService.js`

### VLC State Architecture (Reactive Monitor)

**CRITICAL**: `vlcMprisService.getStatus()` only queries Position from D-Bus. PlaybackStatus and Metadata come from `this.state`/`this.track` (maintained reactively by the D-Bus monitor via `_processStateChange`). Do NOT add back D-Bus reads for PlaybackStatus or Metadata.

**CRITICAL — Render Blindness:** Backend health checks verify D-Bus reachability only, NOT actual video output.
VLC can report "Playing" via D-Bus while displaying a black screen (broken vout, GPU failure, etc.).
`vlcHealthy: true` in logs means D-Bus responded — it says nothing about what's on the display.
GM Scanner VideoRenderer also shows "Playing" based on queue item state, not VLC output.

**`waitForVlcLoaded` is reactive**: Listens for `vlcService` `state:changed` event instead of polling `getStatus()`. Event payload is `{ previous: { state, filename }, current: { state, filename } }`. `_previousDelta` MUST be seeded to `{ state: 'stopped', filename: null }` (not null) in constructor and `reset()` — null suppresses first emission.

**processQueue concurrency**: `startPlayback()` + `this.currentItem` set BEFORE pre-play hooks (prevents concurrent `processQueue` re-entry during async hook window).

**clearQueue**: Only emits `video:idle` when `currentItem !== null` or queue had pending items. NOT unconditional.

### Scoreboard Architecture

The scoreboard (`public/scoreboard.html`) displays differently based on game mode:

**Detective Mode - "Classified Evidence Terminal":**
- Dynamic evidence grid with responsive slot calculation
- Cycling evidence cards showing ALL discoveries
- Adaptive cycling intervals: 18s (few), 15s (moderate), 12s (many)
- Hero evidence card highlighting latest discovery

**Black Market Mode:**
- Team rankings by score
- Score updates via WebSocket broadcasts

**Key Pattern:** Evidence cards filter to detective mode only - cards display when `mode === 'detective'`.

### WebSocket Authentication Flow

1. HTTP POST `/api/admin/auth` → Returns JWT token
2. Socket.io connection with `handshake.auth.token`
3. Middleware validates JWT BEFORE accepting connection
4. On success: Auto-send `sync:full` event
5. Broadcast `device:connected` to other clients

**Failure Handling:**
- Invalid JWT → Connection rejected at handshake (transport-level error)
- Client receives `connect_error` event (NOT `error` event)

**Key Files:** `src/websocket/gmAuth.js`, `src/middleware/auth.js`

### Admin Commands (gm:command)

WebSocket command interface for session management:

| Action | Payload | Description |
|--------|---------|-------------|
| `session:create` | `{name, teams}` | Create new session in **setup** state |
| `session:start` | `{}` | Transition setup → active, start game clock |
| `session:addTeam` | `{teamId}` | Add team mid-game (trimmed, non-empty) |
| `session:pause` | `{}` | Pause active session (cascades to game clock + cue engine) |
| `session:resume` | `{}` | Resume paused session |
| `session:end` | `{}` | End active session |
| `cue:fire` | `{cueId}` | Manually fire a cue |
| `cue:enable` | `{cueId}` | Enable a standing cue |
| `cue:disable` | `{cueId}` | Disable a standing cue |
| `sound:play` | `{file, target?, volume?}` | Play sound via pw-play |
| `sound:stop` | `{file?}` | Stop sound (specific or all) |
| `spotify:play` | `{}` | Resume Spotify via D-Bus |
| `spotify:pause` | `{}` | Pause Spotify via D-Bus |
| `spotify:stop` | `{}` | Stop Spotify via D-Bus |
| `spotify:next` | `{}` | Next Spotify track |
| `spotify:previous` | `{}` | Previous Spotify track |
| `audio:volume:set` | `{stream, volume}` | Set per-stream volume (0-100). Streams: `video`, `spotify`, `sound` |
| `service:check` | `{serviceId}` or `{}` | On-demand health probe (single or all services) |
| `held:release` | `{heldId}` | Release held cue/video (routes by ID prefix) |
| `held:discard` | `{heldId}` | Discard held cue/video |
| `held:release-all` | `{}` | Release all held items |
| `held:discard-all` | `{}` | Discard all held items |

**Session Lifecycle:** `setup` → `active` → `paused` ↔ `active` → `ended`

Sessions are created in `setup` state. Transactions are rejected until `session:start` transitions to `active`. Pausing cascades to game clock (paused), cue engine (suspended), and Spotify (`pauseForGameClock()`). Resuming restores Spotify only if it was paused by the game clock (preserves user-paused state).

**Command Execution:** `commandExecutor.js` contains the shared `executeCommand()` function used by both WebSocket handler (`adminEvents.js`) and cue engine (`cueEngineService.js`). Returns `{success, message, source}`. Has `SERVICE_DEPENDENCIES` map — commands are rejected pre-dispatch if their service dependency is down (gated execution). `validateCommand()` checks health AND resource existence for pre-show verification. Services emit their own domain events (EventEmitter) which `broadcasts.js` forwards as `service:state` to WebSocket clients.

**Circular Dependency:** `commandExecutor.js` ↔ `cueEngineService.js` — cueEngineService imports commandExecutor at module load, so commandExecutor MUST use lazy `require('./cueEngineService')` inside case blocks (not top-level). Other services like `soundService` can use top-level requires.

**Key Files:** `src/websocket/adminEvents.js`, `src/services/commandExecutor.js`, `src/services/sessionService.js`

### Connection Monitoring

**Two Mechanisms:**

| Device Type | Protocol | Timeout Detection |
|-------------|----------|-------------------|
| GM Scanner, Scoreboard | WebSocket | Socket.io ping/pong (25s interval, 60s timeout) |
| Player Scanner, ESP32 | HTTP | HeartbeatMonitorService (30s timeout) |

**HTTP Heartbeat Monitoring:**
- Player scanners poll `/health?deviceId=X&type=player` every 10 seconds
- `heartbeatMonitorService` checks every 15 seconds for 30s timeout
- Uses shared `disconnectDevice()` helper for consistency
- Broadcasts `device:disconnected` on timeout

**Key Files:** `src/services/heartbeatMonitorService.js`, `src/websocket/deviceHelpers.js`

Both mechanisms converge at `sessionService.updateDevice()` for tracking.

### Environment Control Architecture (Phase 0)

GM Scanner admin panel controls venue environment (audio, lighting, Bluetooth) via WebSocket commands routed through `adminEvents.js`.

**Services:**

| Service | Backend | CLI Dependency | Purpose |
|---------|---------|---------------|---------|
| `bluetoothService` | `bluetoothctl` | BlueZ | BT speaker scan/pair/connect |
| `audioRoutingService` | `pactl` | PipeWire | Route VLC audio to HDMI or BT sink |
| `lightingService` | Home Assistant REST API | axios | Scene activation (Docker lifecycle) |

**State Delivery:** All environment service state is delivered via unified `service:state` events with domains: `bluetooth`, `audio`, `lighting`. Each push contains the full `getState()` snapshot. See "Unified `service:state` Pattern" section below.

**Key Helper Files:**
- `src/websocket/environmentHelpers.js` - Builds environment state for `sync:full` payloads
- `src/websocket/syncHelpers.js` - Assembles full `sync:full` payload (session + environment + video + gameClock + cueEngine + spotify)
- `src/websocket/listenerRegistry.js` - Tracks EventEmitter listeners for cleanup (prevents leaks)
- `src/utils/execHelper.js` - `execFileAsync` wrapper (no shell injection)
- `src/utils/dockerHelper.js` - Docker container lifecycle (start/stop Home Assistant)

**Environment Config (.env):**
```env
BLUETOOTH_SCAN_TIMEOUT_SEC=15
BLUETOOTH_CONNECT_TIMEOUT_SEC=10
AUDIO_DEFAULT_OUTPUT=hdmi
LIGHTING_ENABLED=true
HOME_ASSISTANT_URL=http://localhost:8123
HOME_ASSISTANT_TOKEN=              # Long-lived HA access token
HA_DOCKER_MANAGE=true              # Auto-start/stop HA container
```

**`sync:full` includes environment state** — on GM connect, `buildEnvironmentState()` snapshots bluetooth/audio/lighting into the sync payload. Gracefully degrades to defaults when services are unavailable.

### External State Monitoring

Services that wrap external systems use persistent monitors to detect state changes the backend didn't initiate:

| Service | Monitor | What It Detects |
|---------|---------|-----------------|
| `audioRoutingService` | `ProcessMonitor` + `pactl subscribe` | PipeWire sink add/remove |
| `bluetoothService` | `ProcessMonitor` + `DbusSignalParser` + `dbus-monitor --system` | Device connect/disconnect/pair |
| `spotifyService` | `ProcessMonitor` + `DbusSignalParser` + `dbus-monitor --session` | Playback/track/volume changes |
| `vlcService` | `ProcessMonitor` + `DbusSignalParser` + `dbus-monitor --session` | Playback state/filename/volume changes |
| `lightingService` | WebSocket client (`ws://host:8123/api/websocket`) | HA scene activations |

**Reusable Utilities:**
- `src/utils/processMonitor.js` — Self-healing spawned-process wrapper (spawn, line-buffer, exponential backoff restart, orphan prevention, PID-file orphan recovery after SIGKILL). Manages 5 processes: VLC player, 3 D-Bus monitors (VLC/Spotify/BlueZ), pactl subscriber. PID files in `/tmp/aln-pm-*.pid`. **`stop()` is intentionally sync** — making it async cascades through 12+ methods (all service cleanup/reset methods, systemReset.js, test helpers). Exit handler uses captured `proc` closure + SIGKILL (not `this._proc` + SIGTERM) so it works after `stop()` nulls `_proc`. Exit handler removed in the `close` handler (not `stop()`) so the safety net persists until child is confirmed dead.
- `src/utils/dbusSignalParser.js` — Parses `dbus-monitor --monitor` multi-line output into structured signal objects with PropertiesChanged property extraction

**Key Pattern:** Monitors emit domain events on service singletons (e.g., `device:connected`, `playback:changed`, `state:changed`). These events are already wired in `broadcasts.js` → WebSocket delivery. No new broadcast wiring needed for monitors.

**Key Files:** `src/utils/processMonitor.js`, `src/utils/dbusSignalParser.js`, `tests/integration/external-state-propagation.test.js`

### Cue Engine Architecture (Phase 1)

Automated show control: standing cues fire on game events, manual cues fired via GM Scanner.

**Services:**

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| `gameClockService` | Game elapsed time tracking | `start()`, `pause()`, `resume()`, `getElapsed()`, `toPersistence()`/`restore()` |
| `cueEngineService` | Cue evaluation and firing | `loadCues()`, `fireCue()`, `handleGameEvent()`, `handleClockTick()`, `activate()`/`suspend()` |
| `soundService` | pw-play audio wrapper | `play({file, target?, volume?})`, `stop({file?})` |
| `commandExecutor` | Shared command dispatch | `executeCommand({action, payload, source, deviceId})` |

**Event Forwarding:** `cueEngineWiring.js` registers listeners that forward game events (transaction:accepted, group:completed, video:*, session:*, sound:completed, gameclock:*) to `cueEngineService.handleGameEvent()`. This wiring is shared between `app.js` (startup) and `systemReset.js` (re-initialization).

**Standing Cues:** Trigger on game events or clock thresholds. Evaluated via `EVENT_NORMALIZERS` that flatten event payloads into flat fields for condition matching. Conditions support operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`.

**WebSocket Events (Server → Client):**

| Event | Payload | Source |
|-------|---------|--------|
| `cue:fired` | `{cueId, source, trigger, commands}` | cue evaluation or manual fire |
| `cue:completed` | `{cueId}` | all cue commands executed |
| `cue:error` | `{cueId, error}` | cue execution error |

Game clock and sound state delivered via `service:state` domains `gameclock` and `sound`.

**Config Files:** `config/environment/cues.json` (cue definitions, wrapper format `{"cues": [...]}`), `config/environment/routing.json` (audio stream routes). `app.js` handles both wrapper and plain array formats.

**Key Files:** `src/services/gameClockService.js`, `src/services/cueEngineService.js`, `src/services/soundService.js`, `src/services/commandExecutor.js`, `src/services/cueEngineWiring.js`

### Compound Cue Architecture (Phase 2)

Extends Phase 1 cues with timeline-driven compound cues (multi-step sequences) and Spotify integration.

**Compound Cue Timelines:** Cues with `timeline` arrays containing timed commands. Two drive modes:
- **Clock-driven:** Advances via `gameclock:tick`. Relative time = `elapsed - startElapsed`.
- **Video-driven:** Advances via `video:progress`. VLC `position` is 0.0-1.0 ratio, converted via `position * duration` to seconds.

**Cue Hold System:** When a cue command requires a service that's down or a video is already playing, the cue is held (not discarded). Emits `cue:held` with reason (`video_busy` or `service_down`). Held cues auto-cancel after 10s or can be released/discarded via `held:release`/`held:discard` commands. `cue:released`/`cue:discarded` events emitted on resolution.

**Spotify Service:** Extends `MprisPlayerBase` (shared D-Bus MPRIS foundation). Uses `dbus-send` CLI (no compiled bindings). D-Bus destination discovered dynamically (PID suffix changes on restart). Overrides `_dbusCall()` for reactive recovery (activate + retry), `_processStateChange()` for Spotify-specific signal handling, `checkConnection()` for metadata refresh. Methods: `play()`, `pause()`, `stop()`, `next()`, `previous()`, `setVolume()`, `setPlaylist()`, `checkConnection()`, `getState()`, `reset()`. `resumeFromGameClock()` only resumes if `_pausedByGameClock === true`.

**MprisPlayerBase:** Shared base class (`src/services/mprisPlayerBase.js`) for D-Bus MPRIS media player services. Provides: `_buildDbusArgs()`, `_dbusCall()` (overrideable), `_dbusGetProperty/SetProperty`, `_transport()`, `startPlaybackMonitor/stopPlaybackMonitor` (ProcessMonitor + DbusSignalParser), signal debounce+merge, `checkConnection()`, `getState()`, `reset()/cleanup()`. Subclasses override `_processStateChange()`, `_parseMetadata()`, optionally `_dbusCall()` (recovery) and `_getDestination()` (dynamic discovery).

**Audio Stream Volume:** `audioRoutingService.setStreamVolume(stream, volume)` / `getStreamVolume(stream)`. Valid streams: `['video', 'spotify', 'sound']`.

**Game Clock Overtime:** `gameClockService.setOvertimeThreshold(seconds)` → `gameclock:overtime` event (fires ONCE, does NOT end session).

**Phase 2 Event Forwarding (cueEngineWiring.js):**
- `videoQueueService.video:progress` → `cueEngineService.handleVideoProgressEvent(data)`
- `videoQueueService.video:paused/resumed/completed` → `cueEngineService.handleVideoLifecycleEvent(type, data)`
- `spotifyService` forwarded for standing cue conditions

**WebSocket Events (Server → Client, Phase 2):**

All service domain state (cue status, held items, health, spotify, video) is delivered via unified `service:state` events. See "Unified `service:state` Pattern" section below.

**`sync:full` Phase 2 Additions:**
- `spotify`: `{connected, state, volume, pausedByGameClock}` via `buildSpotifyState()`
- `gameClock`: `{status, elapsed, expectedDuration}` via `buildGameClockState()`
- `cueEngine`: `{cues, activeCues, standingCues}` via `buildCueEngineState()`

**`sync:full` Phase 4 Additions:**
- `serviceHealth`: `{vlc: {status, message}, spotify: {...}, ...}` via `serviceHealthRegistry.getSnapshot()`
- `heldItems`: `[{id, type, cueId?, reason, ...}]` via `buildHeldItemsState()`
- `sound`: `{playing: [{file, target, volume, pid}]}` via `soundService.getState()`

**CRITICAL `sync:full` Completeness:** Every code path that emits `sync:full` MUST call `buildSyncFullPayload()` with ALL service references (including `spotifyService`, `soundService`). Missing a service = silent state desync. Bug has recurred 4 times: `scores:reset`, `offline:queue:processed`, `integration-test-server.js`, and `soundService` omission. 7 callers as of 2026-03-27: `gmAuth.js`, `broadcasts.js` (×3), `stateRoutes.js`, `server.js`, `integration-test-server.js`. Audit ALL when adding new services.

**Unified `service:state` Pattern (Sole Push Mechanism):**
- Every service has a sync `getState()` method returning a full state snapshot
- `broadcasts.js` `pushServiceState(domain, service)` emits `service:state` with `{domain, state: service.getState()}` to GM room
- 10 domains: `spotify`, `video`, `health`, `bluetooth`, `audio`, `lighting`, `sound`, `gameclock`, `cueengine`, `held`
- `video` domain is owned by `videoQueueService.getState()` — composes VLC connection state from `vlcMprisService.getState()`
- `held` domain aggregates held cues + videos via `buildHeldItemsState()`, pushed via `pushHeldState()`
- **CRITICAL**: `service:state` is the SOLE mechanism for service domain state delivery. Old discrete events (`spotify:status`, `gameclock:status`, `video:status`, `bluetooth:device`, `lighting:scene`, etc.) have been removed. Only discrete game events remain (`cue:fired`, `cue:completed`, `cue:error`, `transaction:new`, `session:update`, `display:mode`)
- `gm:command:ack` payload simplified to `{action, success, message}` — no more `result.data` forwarding. State comes via `service:state` events
- No post-command state push: state pushes triggered ONLY by service events (D-Bus monitors, service lifecycle)
- **service:state debounce**: `pushServiceState` in `broadcasts.js` debounces per domain (50ms). `video:failed` bypasses the debounce for immediate error state capture. Tests must use `jest.useFakeTimers()` + `jest.advanceTimersByTime(51)` for service:state assertions.
- Tests: `tests/unit/services/getState.test.js` (19 tests), `tests/integration/service-state-push.test.js` (13 tests), broadcast unit tests

**CRITICAL Gotchas:**
- `video:play` in commandExecutor = resume VLC (no file). `video:queue:add` = start new video.
- `cue:started` internal event broadcasts as `cue:status` with `state: 'running'` (not `started`)
- VLC `position` is 0.0-1.0 ratio, NOT seconds

**Key Files:** `src/services/spotifyService.js`, `src/services/cueEngineWiring.js`, `src/websocket/broadcasts.js`, `src/websocket/syncHelpers.js`

### Multi-Speaker Routing + Ducking (Phase 3)

Extends Phase 0 audio routing with event-driven ducking engine and cue-level routing inheritance.

**Ducking Engine:** Automatically reduces Spotify volume when video or sound is playing. Rules loaded from `config/environment/routing.json` (`ducking` array). `audioRoutingService.loadDuckingRules(rules)` / `handleDuckingEvent(source, lifecycle)`. Multi-source tracking: when multiple sources duck simultaneously, the lowest volume wins. Restoration only occurs when ALL ducking sources complete. Supports pause/resume (pausing a source restores volume, resuming re-ducks). Emits `ducking:changed` event. Broadcasts wired in `broadcasts.js` forward video/sound lifecycle events to `handleDuckingEvent()`.

**CRITICAL**: `handleDuckingEvent()` is async (returns a Promise). Callers in `broadcasts.js` use `.catch()`. `_handleDuckingStart` awaits `_capturePreDuckVolume` before applying duck volume to prevent race condition where captured "pre-duck" value is already ducked.

**Sink-input tracking**: `audioRoutingService._sinkInputRegistry` (Map) is populated reactively from `pactl subscribe` sink-input events. `findSinkInput()` checks this registry first (fast-path), falls back to `pactl list sink-inputs`. Registry cleared on `reset()`.

**Routing Inheritance (3-tier resolution):** When a compound cue dispatches a command, routing is resolved as: command-level `target` > cue-level `routing` map > global default. The `_resolveRouting(action, payload, cueDef)` method in `cueEngineService` derives stream type from the action prefix (e.g., `sound:play` → `sound`), then checks `cueDef.routing[streamType]`.

**Config:** `config/environment/routing.json` — `ducking` array:
```json
[
  { "when": "video", "duck": "spotify", "to": 20, "fadeMs": 500 },
  { "when": "sound", "duck": "spotify", "to": 40, "fadeMs": 200 }
]
```

**Note:** Ducking state is delivered via `service:state` domain `audio` (included in `audioRoutingService.getState().ducking`). Ducking is fully automated on the backend — no GM intervention needed, but the indicator gives the GM visibility into active ducking.

**Key Files:** `src/services/audioRoutingService.js` (ducking engine), `src/services/cueEngineService.js` (`_resolveRouting`), `config/environment/routing.json`

## Configuration

### Environment Variables

**Required:**
```env
NODE_ENV=development|production
PORT=3000
ENABLE_VIDEO_PLAYBACK=true
HOST=0.0.0.0                  # For network access
DISCOVERY_UDP_PORT=8888       # UDP broadcast
ENABLE_HTTPS=true             # Required for NFC
```

**HTTPS (Required for NFC):**
```env
ENABLE_HTTPS=true
SSL_KEY_PATH=./ssl/key.pem
SSL_CERT_PATH=./ssl/cert.pem
HTTP_REDIRECT_PORT=8000
```

**Critical Gotchas:**
- VLC controlled via D-Bus MPRIS (no HTTP interface needed)
- `ADMIN_PASSWORD` must match hardcoded value in `public/scoreboard.html`

### HTTPS Architecture

**CRITICAL**: System uses HTTPS because Web NFC API (used by GM Scanner) requires secure context.

- HTTPS Server: Port 3000 (primary)
- HTTP Redirect: Port 8000 (301 → HTTPS:3000)
- Self-signed certificate (365-day validity)
- Discovery service advertises `protocol: "https"`

**Certificate Trust (One-Time Per Device):**
1. Navigate to `https://[IP]:3000/gm-scanner/`
2. Browser shows "not private" warning → "Advanced" → "Proceed to [IP] (unsafe)"
3. Certificate trusted, NFC now works

## Deployment

For full deployment procedures, see '../DEPLOYMENT_GUIDE.md'.

### Raspberry Pi 4 8GB Specifics

**Hardware Requirements:**
- RAM: 8GB (Node.js uses 2GB max via `--max-old-space-size=2048`)
- GPU Memory: 256MB minimum for VLC hardware-accelerated decoding
  - Check: `vcgencmd get_mem gpu`
  - Configure: `/boot/firmware/config.txt` with `gpu_mem=256` (requires reboot)

**Video Optimization:**
Pi 4 hardware decoder requires H.264 videos <5Mbps bitrate. Re-encode if needed:
```bash
ffmpeg -i INPUT.mp4 \
  -c:v h264 -preset fast -profile:v main -level 4.0 \
  -b:v 2M -maxrate 2.5M -bufsize 5M \
  -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ac 2 -ar 44100 \
  -movflags +faststart \
  OUTPUT.mp4 -y
```

### Raspberry Pi 5 Specifics

**CRITICAL — Video Codec:** Pi 5 has NO H.264 hardware decode (hardware block physically absent).
Only HEVC (H.265) is hardware-decoded via `rpi-hevc-dec` at `/dev/video19`.
All game videos MUST be HEVC or VLC software-decodes at ~47% CPU with artifacts.

**CRITICAL — VLC vout:** Must use `--vout=gles2` (EGL/OpenGL ES 2, native Pi 5 GPU).
`--vout=gl` uses desktop OpenGL via Mesa compatibility = 280% CPU + black screens.
`--vout=gles2` avoids DRM plane conflicts with Xorg the same way, at ~8% CPU.
Override via `VLC_HW_ACCEL` env var in `_getHwAccelArgs()`.

**Video Encoding (HEVC for Pi 5):**
```bash
ffmpeg -i INPUT.mp4 \
  -c:v libx265 -crf 20 -preset medium -tag:v hvc1 \
  -g 60 -keyint_min 30 \
  -movflags +faststart \
  -c:a copy \
  OUTPUT.mp4 -y
```
`-movflags +faststart` is required — without it, moov atom at end causes frozen first frame.
`-g 60 -keyint_min 30` = keyframe every 2s at 30fps for reliable seeking.

**Debugging VLC decode path:**
```bash
DISPLAY=:0 cvlc --verbose 2 --play-and-exit video.mp4 2>&1 | grep -i "v4l2\|Hwaccel\|hw fail\|codec.*started\|gles2"
```
- `Hwaccel V4L2 HEVC stateless V4` = hardware decode working
- `Set hw fail` at init = false alarm (pre-vout probe), check for Hwaccel lines after
- `Could not find a valid device` for h264_v4l2m2m = expected on Pi 5 (no H.264 hw)

**CPU measurement:** Use `top -b -n2 -d1 -p PID` (instantaneous), not `ps -o %cpu` (cumulative average).

**PM2 Ecosystem:**
- `aln-orchestrator`: Node.js server (2GB restart threshold)
- VLC is managed by ProcessMonitor in `vlcMprisService.init()` (not PM2). `reset()` preserves VLC ProcessMonitor (process kept running), `cleanup()` stops it. PID file at `/tmp/aln-pm-vlc.pid`.

**Network URLs:**
- Orchestrator: `https://[IP]:3000`
- GM Scanner: `https://[IP]:3000/gm-scanner/`
- Player Scanner: `https://[IP]:3000/player-scanner/`
- Scoreboard: `https://[IP]:3000/scoreboard`

## Debugging

### State Sync After Restart
**Symptoms:** GM scanner shows stale state after orchestrator restart

**Debug:**
1. `grep "Session restored from storage" logs/combined.log`
2. `ls -lh data/session-*.json` - Check persistence file
3. Verify `sessionService.getCurrentSession()` not null
4. Verify clients receive `sync:full` on reconnect
5. Check for "duplicate listener" warnings

**Key Files:** `src/services/sessionService.js` (`init` method), `src/services/persistenceService.js`

### Video Playback Issues
**Symptoms:** Videos queue but don't play, idle loop doesn't resume

**Debug:**
1. `dbus-send --session --dest=org.mpris.MediaPlayer2.vlc --print-reply /org/mpris/MediaPlayer2 org.freedesktop.DBus.Peer.Ping` - VLC D-Bus check
2. `ls -lh public/videos/[filename].mp4` - File exists
3. Monitor `service:state` events (domain `video`) in GM scanner
4. Check VLC logs: `npm run prod:logs | grep vlc`

**Key Files:** `src/services/videoQueueService.js`, `src/services/vlcMprisService.js`

### WebSocket Issues
**Symptoms:** Connects but no state updates

**Debug:**
1. `curl -k -X POST https://[IP]:3000/api/admin/auth -d '{"password":"..."}'` - Get JWT
2. Check browser console for `handshake.auth.token` presence
3. Verify `sync:full` event received after connection
4. Check server logs for "GM already authenticated"

**Key Files:** `src/websocket/gmAuth.js`, `src/middleware/auth.js`

### Player Scanner Connectivity
**Symptoms:** Can't reach orchestrator, scans not logged

**Debug:**
1. `curl -k https://[IP]:3000/health` - Verify orchestrator running
2. Check scanner using correct IP (not localhost)
3. Test endpoint: `curl -k -X POST https://[IP]:3000/api/scan -d '{"tokenId":"test","deviceId":"s1"}'`
4. `npm run prod:logs` - Check backend logs

**Key Files:** `src/routes/scanRoutes.js`, `contracts/openapi.yaml`

## Post-Session Analysis

### Session Validation Tool

Post-game diagnostic tool for detecting scoring bugs, video issues, and system anomalies.

**Quick Start:**
```bash
npm run session:validate list              # List available sessions
npm run session:validate latest            # Validate most recent session
npm run session:validate <name>            # Match by partial name (e.g., "1207")
npm run session:validate latest > report.md  # Save report to file
```

**15 Holistic Validators:**

| Check | Detects |
|-------|---------|
| TransactionFlow | Missing/orphaned transactions, token lookup failures |
| TransactionIntegrity | Transaction data consistency and correctness |
| ScoringIntegrity | Score vs broadcast discrepancies (compares log broadcasts) |
| ScoreParity | Networked vs standalone scoring parity |
| DetectiveMode | Detective-specific validation issues |
| VideoPlayback | Queue failures, playback errors, missing videos |
| DeviceConnectivity | Connection drops, reconnection patterns |
| GroupCompletion | Bonus calculation errors, missed completions |
| GroupBonus | Group bonus calculation correctness |
| DuplicateHandling | False positives, ghost scoring, rejection accuracy |
| DuplicateConsistency | Cross-device duplicate detection consistency |
| PlayerCorrelation | Player scan to transaction correlation |
| EventTimeline | Event ordering and timing anomalies |
| ErrorAnalysis | Error patterns, frequency, categorization |
| SessionLifecycle | Deletions, resets, pause/resume anomalies |

**Key Files:** `scripts/validate-session.js`, `scripts/lib/`

**Architecture:**
```
validate-session.js
├── SessionLoader     # Finds/loads session JSON files from data/
├── TokenLoader       # Loads token database for validation
├── ScoringCalculator # Independent score recalculation
├── LogParser         # Parses logs/combined.log for event correlation
├── ReportGenerator   # Markdown report output
└── validators/       # 15 validator modules
```

**Exit Codes:**
- `0`: All critical checks passed
- `1`: One or more critical failures detected

**When to Use:**
- After every game session (recommended)
- When players report scoring discrepancies
- When investigating video playback issues
- Before archiving session data

## Maintenance

### Log Management

**Log Archival Script:**
```bash
# Archive log entries older than 2 weeks (from project root)
python logs/archive_logs.py backend/logs

# Preview without making changes
python logs/archive_logs.py backend/logs --dry-run

# Custom retention period (30 days)
python logs/archive_logs.py backend/logs --days 30
```

**Archive Location:** `logs/archive/` (organized by date)

**Details:** See '../logs/README_LOG_ARCHIVAL.md' for full documentation.

**Log Files:**
- `logs/combined.log` - All application logs (Winston)
- `logs/error.log` - Errors only
- `data/session-*.json` - Persisted session state

## Code Style

- ES6 modules with async/await
- Module-level singleton services (`module.exports = new ServiceClass()`)
- JSDoc comments for public methods
- Event-driven architecture (Node.js EventEmitter)
- Winston logger (no console.log)
- Error codes for API responses
