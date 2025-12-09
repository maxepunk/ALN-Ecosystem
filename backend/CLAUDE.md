# CLAUDE.md - Backend Orchestrator

Last verified: 2025-12-08

This file provides guidance for working with the ALN Backend Orchestrator - a Node.js server managing sessions, scoring, video playback, and WebSocket/HTTP APIs.

For cross-cutting concerns (scoring logic, operation modes, game modes, token schema), see @../CLAUDE.md.

## Quick Reference

| Resource | Location |
|----------|----------|
| API Contract (HTTP) | @contracts/README.md, @contracts/openapi.yaml |
| WebSocket Events | @backend_docs/WEBSOCKET_QUICK_REFERENCE.md |
| WebSocket Deep Dive | @backend_docs/WEBSOCKET_ANALYSIS.md |
| E2E Testing | @backend_docs/E2E_TEST_HELPERS.md |
| Deployment Guide | @../DEPLOYMENT_GUIDE.md |
| Scoring Logic | @../docs/SCORING_LOGIC.md |
| Session Validation | `npm run session:validate` (see Post-Session Analysis) |
| Log Archival | @../logs/README_LOG_ARCHIVAL.md |

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

## Architecture

### Service Singleton Pattern

All services use singleton with `getInstance()`:

| Service | Purpose |
|---------|---------|
| `sessionService` | Active session (source of truth, persisted) |
| `stateService` | Global state (computed on-demand from session) |
| `transactionService` | Token scan processing and scoring |
| `videoQueueService` | Video playback queue |
| `vlcService` | VLC HTTP interface control |
| `tokenService` | Token data loading |
| `discoveryService` | UDP broadcast (port 8888) |
| `offlineQueueService` | Offline scan management |
| `persistenceService` | Disk persistence |
| `displayControlService` | HDMI display mode state machine |
| `heartbeatMonitorService` | HTTP device timeout monitoring |

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
- `sessionService`: `session:created`, `session:updated`, `transaction:added`, `device:updated/removed`
- `transactionService`: `transaction:accepted`, `group:completed`, `score:updated`, `scores:reset`
- `stateService`: `state:updated`, `state:sync`, `sync:full`
- `videoQueueService`: `video:*`, `queue:*`
- `vlcService`: `degraded`, `connected`, `disconnected`

**Key Files:** `src/services/stateService.js:79-112`, `src/websocket/broadcasts.js`

**Layer 2: WebSocket (AsyncAPI)**

See @backend_docs/WEBSOCKET_QUICK_REFERENCE.md for event reference.

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
| `session:create` | `{name, teams}` | Create new session with initial teams |
| `session:addTeam` | `{teamId}` | Add team mid-game (alphanumeric, 1-30 chars) |
| `session:pause` | `{}` | Pause active session |
| `session:resume` | `{}` | Resume paused session |
| `session:end` | `{}` | End active session |

**session:addTeam Flow:**
1. Validate teamId format (alphanumeric, 1-30 chars)
2. Check team doesn't already exist
3. Create TeamScore with initial values
4. Persist to session
5. Broadcast `session:updated` to all clients

**Key Files:** `src/websocket/adminEvents.js`, `src/services/sessionService.js`

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

## Configuration

### Environment Variables

**Required:**
```env
NODE_ENV=development|production
PORT=3000
VLC_PASSWORD=vlc              # MUST be exactly "vlc"
FEATURE_VIDEO_PLAYBACK=true
HOST=0.0.0.0                  # For network access
DISCOVERY_PORT=8888           # UDP broadcast
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

For full deployment procedures, see @../DEPLOYMENT_GUIDE.md.

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

**Key Files:** `src/services/sessionService.js:28-42`, `src/services/persistenceService.js`

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

**9 Holistic Validators:**

| Check | Detects |
|-------|---------|
| TransactionFlow | Missing/orphaned transactions, token lookup failures |
| ScoringIntegrity | Score vs broadcast discrepancies (compares log broadcasts) |
| DetectiveMode | Detective-specific validation issues |
| VideoPlayback | Queue failures, playback errors, missing videos |
| DeviceConnectivity | Connection drops, reconnection patterns |
| GroupCompletion | Bonus calculation errors, missed completions |
| DuplicateHandling | False positives, ghost scoring, rejection accuracy |
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
└── validators/       # 9 validator modules
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

**Details:** See @../logs/README_LOG_ARCHIVAL.md for full documentation.

**Log Files:**
- `logs/combined.log` - All application logs (Winston)
- `logs/error.log` - Errors only
- `data/session-*.json` - Persisted session state

## Code Style

- ES6 modules with async/await
- Singleton services with `getInstance()`
- JSDoc comments for public methods
- Event-driven architecture (Node.js EventEmitter)
- Winston logger (no console.log)
- Error codes for API responses
