# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ALN (About Last Night) Ecosystem is a memory token scanning and video playback system for a 2-hour immersive game. It's a **monorepo with Git submodules** for both code sharing (scanners) and data sharing (token definitions).

**Key Components:**
- **Backend Orchestrator** (`backend/`): Node.js server managing sessions, scoring, video playback, and WebSocket/HTTP APIs
- **GM Scanner** (SUBMODULE: `ALNScanner/`): Web app for game masters. WebSocket-based, supports standalone and networked modes
- **Player Scanner (Web)** (SUBMODULE: `aln-memory-scanner/`): PWA for players. HTTP-based, displays token content
- **Player Scanner (ESP32)** (SUBMODULE: `arduino-cyd-player-scanner/`): Hardware scanner (ESP32-CYD with RFID)
- **Token Data** (SUBMODULE: `ALN-TokenData/`): Shared JSON definitions of memory tokens and their associated media

**Contract-First Architecture:**
- `backend/contracts/openapi.yaml` - ALL HTTP endpoints (validates with contract tests)
- `backend/contracts/asyncapi.yaml` - ALL WebSocket events (validates with contract tests)
- **CRITICAL**: Update contracts FIRST before changing APIs or events
- Breaking changes require coordinated updates across backend + all 3 scanner submodules

## Submodule Architecture

```
ALN-Ecosystem/                     # Parent repo
├── backend/                       # [DIRECT] Orchestrator server
├── ALN-TokenData/                 # [SUBMODULE] Token definitions (backend loads from here)
├── aln-memory-scanner/            # [SUBMODULE] Player scanner web app
│   └── data/                      # [NESTED SUBMODULE → ALN-TokenData]
├── ALNScanner/                    # [SUBMODULE] GM scanner web app
│   └── data/                      # [NESTED SUBMODULE → ALN-TokenData]
└── arduino-cyd-player-scanner/    # [SUBMODULE] ESP32 scanner (no nested submodule)
```

**Token Data Flow:**
- Backend: Loads from `ALN-TokenData/tokens.json` directly (path: `../../../ALN-TokenData/tokens.json` from services/)
- Web Scanners: Have nested `data/` submodule for standalone mode (GitHub Pages deployment)
- ESP32 Scanner: Downloads tokens from orchestrator `/api/tokens` on boot, caches to SD card

**Syncing Submodules:**
```bash
git submodule update --init --recursive    # Initialize
git submodule update --remote --merge      # Update to latest
git submodule status --recursive           # Check sync status
```

## Key Commands

### Development
```bash
cd backend
npm run dev                # Interactive mode selector
npm run dev:full          # VLC + orchestrator (hot reload)
npm run dev:no-video      # Orchestrator only
npm test                  # Unit + contract tests (~15-30s)
npm run lint              # ESLint
```

### Testing (Raspberry Pi 4 8GB optimized)
```bash
cd backend

# Fast feedback (default)
npm test                              # Unit + contract (parallel, ~15-30s)

# Individual suites
npm run test:unit                     # Unit tests (parallel, 4 workers)
npm run test:contract                 # Contract tests (parallel, 4 workers)
npm run test:integration              # Integration (MUST be sequential, ~5 min)
npm run test:e2e                      # Playwright E2E (2 workers, ~4-5 min)

# Comprehensive
npm run test:all                      # Unit + contract + integration (~5-6 min)
npm run test:full                     # All tests including E2E (~10-15 min)

# Playwright specific
npx playwright test flows/00-smoke    # Specific suite
npx playwright test --debug           # Step-through debugger
npx playwright test --ui              # Interactive UI mode
npx playwright show-report            # View HTML report

# Run individual tests
npm test -- persistenceService        # Pattern matching
```

**Critical Testing Notes:**
- Integration tests MUST run sequentially (`--runInBand`) to prevent state contamination
- Use `resetAllServicesForTesting()` helper in integration tests to prevent listener leaks
- E2E tests require orchestrator running: `npm run dev:full`
- E2E uses lightweight fixtures (`backend/tests/e2e/fixtures/`) not production token data

### Production
```bash
cd backend
npm start                 # Start with PM2
npm run prod:status       # Check PM2 processes
npm run prod:logs         # View logs
npm run prod:restart      # Restart all services
```

### Utilities
```bash
cd backend
node start-session.js     # CLI to create test session
npm run health            # Full system health check
npm run health:api        # Check orchestrator only
npm run health:vlc        # Check VLC only
```

## Critical Architecture Patterns

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
Services use Node.js EventEmitter for internal coordination (separate from WebSocket events):

```
Domain Event (Service) → Listener (stateService) → WebSocket Broadcast (broadcasts.js)
```

**Example Flow:**
1. `transactionService.emit('transaction:new', data)` - Domain event
2. `stateService.on('transaction:new', ...)` - Listener recomputes state
3. `stateService.emit('state:updated', state)` - State change event
4. `broadcasts.js` wraps for WebSocket - `io.emit('sync:full', {event, data, timestamp})`

**Key Files:**
- `backend/src/services/sessionService.js:69` - Session event emission
- `backend/src/services/stateService.js:79` - Event listener setup
- `backend/src/websocket/broadcasts.js` - WebSocket broadcast wrapping
- `backend/src/websocket/listenerRegistry.js` - Prevents duplicate listeners

### Service Singleton Pattern
All services in `backend/src/services/` use singleton with `getInstance()`:
- **sessionService**: Active session (source of truth)
- **stateService**: Global state (computed from session)
- **transactionService**: Token scan processing and scoring
- **videoQueueService**: Video playback queue
- **vlcService**: VLC HTTP interface control
- **tokenService**: Token data loading
- **discoveryService**: UDP broadcast (port 8888)
- **offlineQueueService**: Offline scan management
- **persistenceService**: Disk persistence

### WebSocket Authentication Flow
1. HTTP POST `/api/admin/auth` → Returns JWT token
2. Socket.io connection with `handshake.auth.token`
3. Middleware validates JWT BEFORE accepting connection (`backend/src/middleware/socketAuth.js`)
4. On success: Auto-send `sync:full` event (`backend/src/websocket/gmAuth.js:122`)
5. Broadcast `device:connected` to other clients

**Failure Handling:**
- Invalid JWT → Connection rejected at handshake (transport-level error)
- Client receives `connect_error` event (NOT `error` event)
- No `sync:full` sent on auth failure

### Connection Monitoring
- **WebSocket Clients** (GM Scanner, Scoreboard): Socket.io built-in ping/pong (25s interval, 60s timeout)
- **HTTP Clients** (Player Scanner): Poll `/health?deviceId=X&type=player` every 10 seconds
- Both converge at `sessionService.updateDevice()` for tracking

## HTTPS Architecture

**CRITICAL**: System uses HTTPS because Web NFC API (used by GM Scanner) requires secure context.

**Configuration:**
```env
ENABLE_HTTPS=true
SSL_KEY_PATH=./ssl/key.pem
SSL_CERT_PATH=./ssl/cert.pem
HTTP_REDIRECT_PORT=8000
```

**Architecture:**
- HTTPS Server: Port 3000 (primary)
- HTTP Redirect: Port 8000 (301 → HTTPS:3000)
- Self-signed certificate (365-day validity)
- Discovery service advertises `protocol: "https"`

**Scanner Protocol Defaults:**
- GM Scanner: Defaults to `https://` (connectionManager.js:47)
- Player Scanner: Uses `window.location.origin` or `https://localhost:3000`
- ESP32 Scanner: Uses WiFiClientSecure, auto-detects protocol from config.txt URL (supports both http:// and https://)

**Certificate Trust (One-Time Per Device):**
1. Navigate to `https://[IP]:3000/gm-scanner/`
2. Browser shows "not private" warning
3. "Advanced" → "Proceed to [IP] (unsafe)"
4. Certificate trusted, NFC now works

**Debugging HTTPS Issues:**
- Mixed content errors → Check scanner defaults to HTTPS not HTTP
- Discovery fails → Verify `ENABLE_HTTPS=true` in backend/.env
- Cert errors → Expected with self-signed, requires one-time trust

## Environment Variables

### Required
```env
NODE_ENV=development|production
PORT=3000
VLC_PASSWORD=vlc              # MUST be exactly "vlc"
FEATURE_VIDEO_PLAYBACK=true
HOST=0.0.0.0                  # For network access
DISCOVERY_PORT=8888           # UDP broadcast
ENABLE_HTTPS=true             # Required for NFC
```

### Critical Gotchas
- `VLC_PASSWORD` must be exactly `vlc`, not `vlc-password`
- `ADMIN_PASSWORD` must match hardcoded value in `backend/public/scoreboard.html`

## Deployment (Raspberry Pi 4 8GB)

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
- GM Scanner: `https://[IP]:3000/gm-scanner/` (HTTPS required for NFC)
- Player Scanner: `https://[IP]:3000/player-scanner/`
- Scoreboard: `https://[IP]:3000/scoreboard`
- VLC Control: `http://[IP]:8080` (password: vlc, internal only)

## Cross-Module Debugging

### Token Data Sync Issues
**Symptoms:** Backend reports token not found, scanners show different data
**Debug:**
1. `git submodule status --recursive` - Check for detached HEAD
2. `git submodule update --remote --merge` - Sync all submodules
3. `grep "Loaded tokens from" logs/combined.log` - Verify backend path
4. `npm run prod:restart` - Reload token data

**Key Files:** `backend/src/services/tokenService.js:49-66`, `.gitmodules`

### GM Scanner WebSocket Issues
**Symptoms:** Connects but no state updates
**Debug:**
1. `curl -k -X POST https://[IP]:3000/api/admin/auth -d '{"password":"..."}'` - Get JWT
2. Check browser console for `handshake.auth.token` presence
3. Verify `sync:full` event received after connection
4. Check server logs for "GM already authenticated"

**Key Files:** `backend/src/websocket/gmAuth.js:21-164`, `backend/src/middleware/socketAuth.js`

### Player Scanner Connectivity Issues
**Symptoms:** Can't reach orchestrator, scans not logged
**Debug:**
1. `curl -k https://[IP]:3000/health` - Verify orchestrator running
2. Check scanner using correct IP (not localhost)
3. Test endpoint: `curl -k -X POST https://[IP]:3000/api/scan -d '{"tokenId":"test","deviceId":"s1"}'`
4. `npm run prod:logs` - Check backend logs
5. `sudo ufw status` - Verify firewall

**Key Files:** `backend/src/routes/scanRoutes.js`, `backend/contracts/openapi.yaml:280-488`

### State Sync After Restart
**Symptoms:** GM scanner shows stale state after orchestrator restart
**Debug:**
1. `grep "Session restored from storage" logs/combined.log`
2. `ls -lh backend/data/session-*.json` - Check persistence file
3. Verify `sessionService.getCurrentSession()` not null
4. Verify clients receive `sync:full` on reconnect
5. Check for "duplicate listener" warnings

**Key Files:** `backend/src/services/sessionService.js:28-42`, `backend/src/services/persistenceService.js`

### Video Playback Issues
**Symptoms:** Videos queue but don't play, idle loop doesn't resume
**Debug:**
1. `curl http://localhost:8080/requests/status.json -u :vlc` - VLC connection
2. `ls -lh backend/public/videos/[filename].mp4` - File exists
3. Monitor `video:status` events in GM scanner
4. Check VLC logs: `npm run prod:logs | grep vlc`

**Key Files:** `backend/src/services/videoQueueService.js`, `backend/src/services/vlcService.js`

## Code Style

- ES6 modules with async/await
- Singleton services with `getInstance()`
- JSDoc comments for public methods
- Event-driven architecture with EventEmitter
- Winston logger (no console.log)
- Error codes for API responses
