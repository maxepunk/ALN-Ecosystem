# CLAUDE.md - Backend Orchestrator

Last verified: 2026-02-14

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
npm run dev:full         # VLC + orchestrator (hot reload)
npm run dev:no-video     # Orchestrator only
npm run lint             # ESLint
```

### Testing
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
npm run health:vlc        # Check VLC only
```

**Critical Testing Notes:**
- Integration tests MUST run sequentially (`--runInBand`) to prevent state contamination
- Use `resetAllServicesForTesting()` helper in integration tests to prevent listener leaks
- E2E tests require orchestrator running: `npm run dev:full`
- E2E uses lightweight fixtures (`tests/e2e/fixtures/`) not production token data
- E2E uses 2 workers (`--workers=2` in npm script overrides playwright.config.js default of 1)
- E2E `GMScannerPage.createSession()` waits for `.session-status--setup` (Phase 1 lifecycle). `createSessionWithTeams()` then calls `startGame()` to transition to active. If session lifecycle states change, update locators in `tests/e2e/helpers/page-objects/GMScannerPage.js`.

## Architecture

### Service Singleton Pattern

Most services export a module-level singleton via `module.exports = new ServiceClass()`:

| Service | Purpose | Export Style |
|---------|---------|--------------|
| `sessionService` | Active session (source of truth, persisted) | `new SessionService()` |
| `stateService` | Global state (computed on-demand from session) | `new StateService()` |
| `transactionService` | Token scan processing and scoring | `new TransactionService()` |
| `videoQueueService` | Video playback queue | `new VideoQueueService()` |
| `vlcService` | VLC HTTP interface control | `new VlcService()` |
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
| `spotifyService` | D-Bus MPRIS wrapper for spotifyd playback | `new SpotifyService()` |
| `commandExecutor` | Shared gm:command execution logic | Function export (`executeCommand`) |

**System Reset:** `systemReset.js` exports `performSystemReset()` for coordinated reset (production `system:reset` command and test helper). Archives session, ends lifecycle, cleans up listeners, resets all services, re-initializes infrastructure (including cue engine event forwarding via `cueEngineWiring.js`).

**transactionService API Note:** `processScan()` and `createManualTransaction()` no longer accept a `session` parameter. The service retrieves the current session internally via `sessionService.getCurrentSession()`.

### Session and State (Source of Truth Pattern)

**CRITICAL**: Session is source of truth (persisted), GameState is computed on-demand.

- **Session** (`sessionService`): Persisted to disk, survives restarts
- **GameState** (`stateService`): Computed property derived from Session + live system status
  - Always call `getCurrentState()` - NEVER store state
  - Automatically includes: session data, VLC status, video queue, offline queue
  - Eliminates sync bugs on orchestrator restart

```javascript
// CORRECT: Compute state on-demand
const state = stateService.getCurrentState();

// WRONG: Storing state leads to stale data
const cachedState = stateService.getCurrentState(); // Don't do this
```

### Event-Driven Service Coordination

**Layer 1: Backend Internal (Node.js EventEmitter)**

Service-to-service communication within orchestrator backend.

**Pattern:**
```
Domain Event (Service) → Listener (stateService) → WebSocket Broadcast (broadcasts.js)
```

**Key Services & Events:**
- `sessionService`: `session:created`, `session:updated`, `transaction:added`, `player-scan:added`, `device:updated/removed`
- `transactionService`: `transaction:accepted`, `group:completed`, `score:adjusted`, `scores:reset`
- `stateService`: `state:updated`, `state:sync`, `sync:full`
- `videoQueueService`: `video:*`, `queue:*`
- `vlcService`: `degraded`, `connected`, `disconnected`
- `bluetoothService`: `device:connected/disconnected/paired/unpaired/discovered`, `scan:started/stopped`
- `audioRoutingService`: `routing:changed`, `routing:applied`, `routing:fallback`, `sink:added`, `sink:removed`
- `lightingService`: `scene:activated`, `connection:changed`, `scenes:refreshed`
- `gameClockService`: `gameclock:started`, `gameclock:paused`, `gameclock:resumed`, `gameclock:tick`, `gameclock:overtime`
- `cueEngineService`: `cue:fired`, `cue:completed`, `cue:error`, `cue:started`, `cue:status`, `cue:conflict`
- `spotifyService`: `playback:changed`, `volume:changed`, `playlist:changed`
- `soundService`: `sound:started`, `sound:completed`, `sound:stopped`, `sound:error`

**DEPRECATED Internal Event:**
- `score:updated` - The internal `transaction:accepted` event now includes `teamScore`. The WebSocket broadcast `transaction:new` also carries the score. Note: `score:updated` is still broadcast via WebSocket by `broadcasts.js` for score adjustments and group bonuses.

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

**Key Files:** `src/services/stateService.js` (`setupTransactionListeners`), `src/websocket/broadcasts.js`

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
- Chromium requires `--password-store=basic` flag to prevent keyring dialog
- Scoreboard URL uses auto-detected local IP (not localhost) for CDN resources
- Browser process killed before VLC starts; VLC stopped before browser launches

**Key Files:** `src/services/displayControlService.js`, `src/utils/displayDriver.js`, `src/services/vlcService.js`

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

**Session Lifecycle:** `setup` → `active` → `paused` ↔ `active` → `ended`

Sessions are created in `setup` state. Transactions are rejected until `session:start` transitions to `active`. Pausing cascades to game clock (paused), cue engine (suspended), and Spotify (`pauseForGameClock()`). Resuming restores Spotify only if it was paused by the game clock (preserves user-paused state).

**Command Execution:** `commandExecutor.js` contains the shared `executeCommand()` function used by both WebSocket handler (`adminEvents.js`) and cue engine (`cueEngineService.js`). Returns `{success, message, data?, source, broadcasts[]}`. The `broadcasts[]` array separates socket emission concerns from command logic.

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

**WebSocket Events (Server → Client):**

| Event | Payload | Source |
|-------|---------|--------|
| `bluetooth:device` | `{type, device}` | pair/unpair/connect/disconnect/discovered |
| `bluetooth:scan` | `{scanning, ...}` | scan start/stop |
| `audio:routing` | `{stream, sink}` | route changed/applied |
| `audio:routing:fallback` | `{stream, actualSink}` | BT unavailable, fell back to HDMI |
| `lighting:scene` | `{sceneId}` | scene activated |
| `lighting:status` | `{connected, scenes}` | HA connection/scene refresh |

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
| `gameclock:status` | `{state, elapsed}` | clock started/paused/resumed |
| `cue:fired` | `{cueId, source, trigger, commands}` | cue evaluation or manual fire |
| `cue:completed` | `{cueId}` | all cue commands executed |
| `cue:error` | `{cueId, error}` | cue execution error |
| `sound:status` | `{type, file, ...}` | sound started/completed/stopped |

**Config Files:** `config/environment/cues.json` (cue definitions, wrapper format `{"cues": [...]}`), `config/environment/routing.json` (audio stream routes). `app.js` handles both wrapper and plain array formats.

**Key Files:** `src/services/gameClockService.js`, `src/services/cueEngineService.js`, `src/services/soundService.js`, `src/services/commandExecutor.js`, `src/services/cueEngineWiring.js`

### Compound Cue Architecture (Phase 2)

Extends Phase 1 cues with timeline-driven compound cues (multi-step sequences) and Spotify integration.

**Compound Cue Timelines:** Cues with `timeline` arrays containing timed commands. Two drive modes:
- **Clock-driven:** Advances via `gameclock:tick`. Relative time = `elapsed - startElapsed`.
- **Video-driven:** Advances via `video:progress`. VLC `position` is 0.0-1.0 ratio, converted via `position * duration` to seconds.

**Video Conflict Detection:** If a compound cue needs to play a video but another video is already playing, emits `cue:conflict` with 10s auto-cancel window.

**Spotify Service:** D-Bus MPRIS wrapper for `spotifyd`. Uses `dbus-send` CLI (no compiled bindings). D-Bus destination discovered dynamically (PID suffix changes on restart). Methods: `play()`, `pause()`, `stop()`, `next()`, `previous()`, `setVolume()`, `setPlaylist()`, `checkConnection()`, `getState()`, `reset()`. `resumeFromGameClock()` only resumes if `_pausedByGameClock === true`.

**Audio Stream Volume:** `audioRoutingService.setStreamVolume(stream, volume)` / `getStreamVolume(stream)`. Valid streams: `['video', 'spotify', 'sound']`.

**Game Clock Overtime:** `gameClockService.setOvertimeThreshold(seconds)` → `gameclock:overtime` event (fires ONCE, does NOT end session).

**Phase 2 Event Forwarding (cueEngineWiring.js):**
- `videoQueueService.video:progress` → `cueEngineService.handleVideoProgressEvent(data)`
- `videoQueueService.video:paused/resumed/completed` → `cueEngineService.handleVideoLifecycleEvent(type, data)`
- `spotifyService` forwarded for standing cue conditions

**WebSocket Events (Server → Client, Phase 2):**

| Event | Payload | Source |
|-------|---------|--------|
| `cue:status` | `{cueId, state, progress, duration}` | Compound cue lifecycle (running/paused/stopped) |
| `cue:conflict` | `{cueId, reason, currentVideo}` | Video conflict detected |
| `spotify:status` | `{connected, state, volume, pausedByGameClock}` | Spotify playback state |

**`sync:full` Phase 2 Additions:**
- `spotify`: `{connected, state, volume, pausedByGameClock}` via `buildSpotifyState()`
- `gameClock`: `{status, elapsed, expectedDuration}` via `buildGameClockState()`
- `cueEngine`: `{cues, activeCues, standingCues}` via `buildCueEngineState()`

**CRITICAL Gotchas:**
- `video:play` in commandExecutor = resume VLC (no file). `video:queue:add` = start new video.
- `cue:started` internal event broadcasts as `cue:status` with `state: 'running'` (not `started`)
- VLC `position` is 0.0-1.0 ratio, NOT seconds

**Key Files:** `src/services/spotifyService.js`, `src/services/cueEngineWiring.js`, `src/websocket/broadcasts.js`, `src/websocket/syncHelpers.js`

### Multi-Speaker Routing + Ducking (Phase 3)

Extends Phase 0 audio routing with PipeWire combine-sink management, event-driven ducking engine, and cue-level routing inheritance.

**Combine-Sink (Dual BT Speakers):** Creates a virtual `combine-bt` sink using `pw-loopback` processes to route audio to two Bluetooth speakers simultaneously. `audioRoutingService.createCombineSink()` / `destroyCombineSink()`. Requires 2+ paired BT sinks. The virtual sink appears in `getAvailableSinksWithCombine()` when active. Managed via `audio:combine:create` / `audio:combine:destroy` gm:command actions.

**Ducking Engine:** Automatically reduces Spotify volume when video or sound is playing. Rules loaded from `config/environment/routing.json` (`ducking` array). `audioRoutingService.loadDuckingRules(rules)` / `handleDuckingEvent(source, lifecycle)`. Multi-source tracking: when multiple sources duck simultaneously, the lowest volume wins. Restoration only occurs when ALL ducking sources complete. Supports pause/resume (pausing a source restores volume, resuming re-ducks). Emits `ducking:changed` event. Broadcasts wired in `broadcasts.js` forward video/sound lifecycle events to `handleDuckingEvent()`.

**Routing Inheritance (3-tier resolution):** When a compound cue dispatches a command, routing is resolved as: command-level `target` > cue-level `routing` map > global default. The `_resolveRouting(action, payload, cueDef)` method in `cueEngineService` derives stream type from the action prefix (e.g., `sound:play` → `sound`), then checks `cueDef.routing[streamType]`.

**Phase 3 gm:command Actions:**

| Action | Payload | Description |
|--------|---------|-------------|
| `audio:combine:create` | `{}` | Create combine-bt virtual sink from paired BT speakers |
| `audio:combine:destroy` | `{}` | Destroy combine-bt virtual sink |

**WebSocket Events (Server → Client, Phase 3):**

| Event | Payload | Source |
|-------|---------|--------|
| `audio:ducking:status` | `{stream, ducked, volume, activeSources[]}` | Ducking state change |

**Config:** `config/environment/routing.json` — `ducking` array:
```json
[
  { "when": "video", "duck": "spotify", "to": 20, "fadeMs": 500 },
  { "when": "sound", "duck": "spotify", "to": 40, "fadeMs": 200 }
]
```

**CRITICAL Gotcha:** `audio:ducking:status` is not yet forwarded to the GM Scanner (not in `orchestratorClient.js` messageTypes). Ducking is fully automated on the backend — no GM intervention needed.

**Key Files:** `src/services/audioRoutingService.js` (combine-sink + ducking), `src/services/cueEngineService.js` (`_resolveRouting`), `config/environment/routing.json`

## Configuration

### Environment Variables

**Required:**
```env
NODE_ENV=development|production
PORT=3000
VLC_PASSWORD=vlc              # MUST be exactly "vlc"
FEATURE_VIDEO_PLAYBACK=true
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
- `VLC_PASSWORD` must be exactly `vlc`, not `vlc-password`
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

**PM2 Ecosystem:**
- `aln-orchestrator`: Node.js server (2GB restart threshold)
- `vlc-http`: VLC with HTTP interface

**Network URLs:**
- Orchestrator: `https://[IP]:3000`
- GM Scanner: `https://[IP]:3000/gm-scanner/`
- Player Scanner: `https://[IP]:3000/player-scanner/`
- Scoreboard: `https://[IP]:3000/scoreboard`
- VLC Control: `http://[IP]:8080` (password: vlc, internal only)

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
1. `curl http://localhost:8080/requests/status.json -u :vlc` - VLC connection
2. `ls -lh public/videos/[filename].mp4` - File exists
3. Monitor `video:status` events in GM scanner
4. Check VLC logs: `npm run prod:logs | grep vlc`

**Key Files:** `src/services/videoQueueService.js`, `src/services/vlcService.js`

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
