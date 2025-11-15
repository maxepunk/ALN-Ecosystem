# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ALN (About Last Night) Ecosystem is a memory token scanning and video playback system for a 2-hour immersive game. It's a **monorepo with Git submodules** for both code sharing (scanners) and data sharing (token definitions).

**Key Components:**
- **Backend Orchestrator** (`backend/`): Node.js server managing sessions, scoring, video playback, and WebSocket/HTTP APIs
- **GM Scanner** (SUBMODULE: `ALNScanner/`): ES6 module PWA for game masters - @ALNScanner/CLAUDE.md
- **Player Scanner (Web)** (SUBMODULE: `aln-memory-scanner/`): Vanilla JS PWA for players - @aln-memory-scanner/CLAUDE.md
- **Player Scanner (ESP32)** (SUBMODULE: `arduino-cyd-player-scanner/`): Hardware scanner (ESP32-CYD with RFID) - @arduino-cyd-player-scanner/CLAUDE.md
- **Token Data** (SUBMODULE: `ALN-TokenData/`): Shared JSON definitions of memory tokens and their associated media
- **Notion Sync Scripts** (`scripts/`): Python scripts for syncing Notion Elements database to tokens.json

**Contract-First Architecture:**
- `backend/contracts/openapi.yaml` - ALL HTTP endpoints (validates with contract tests)
- `backend/contracts/asyncapi.yaml` - ALL WebSocket events (validates with contract tests)
- **CRITICAL**: Update contracts FIRST before changing APIs or events
- Breaking changes require coordinated updates across backend + all 3 scanner submodules

**Scanner Protocol Comparison:**

| Aspect | GM Scanner | Player Scanner (Web) | ESP32 Scanner |
|--------|-----------|---------------------|---------------|
| Language | ES6 modules (Vite) | Vanilla JS (monolithic HTML) | C++ (Arduino/ESP-IDF) |
| Backend Protocol | WebSocket (Socket.io) | HTTP (fetch) | HTTP/HTTPS (WiFiClient) |
| Authentication | JWT token (24h expiry) | Device ID (auto-generated) | Device ID (config.txt) |
| Real-time Updates | Yes (broadcasts) | No (stateless) | No (stateless) |
| Offline Support | Queue + localStorage | Dual-mode (GitHub Pages OR queue) | SD card queue (JSONL) |
| Admin Functions | Session/Video/System control | None | None |

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
- **Backend**: Loads from `ALN-TokenData/tokens.json` (path: `../../../ALN-TokenData/tokens.json` from services/)
- **GM Scanner**: Nested `data/` submodule for standalone mode, TokenManager with fuzzy matching
- **Player Scanner (Web)**: Nested `data/` submodule, dual-mode detection (GitHub Pages vs orchestrator)
- **ESP32 Scanner**: Downloads from orchestrator `/api/tokens`, caches to SD card
- **Notion**: Source of truth (SF_RFID, SF_ValueRating, SF_MemoryType, SF_Group fields)

**Submodule Commands:**
```bash
git submodule update --init --recursive    # Initialize all (including nested)
git submodule update --remote --merge      # Update to latest
git submodule status --recursive           # Check sync status (detect detached HEAD)
```

**Token Sync Workflow (Notion → Git → Scanners):**
```bash
# 1. Update token data in Notion Elements database
# 2. Sync Notion to tokens.json
export NOTION_TOKEN="your_token_here"
python3 scripts/sync_notion_to_tokens.py

# 3. Commit to ALN-TokenData submodule
cd ALN-TokenData && git add tokens.json && git commit -m "sync: update tokens from Notion" && git push

# 4. Update parent repo submodule reference
cd .. && git submodule update --remote --merge ALN-TokenData && git add ALN-TokenData && git commit -m "chore: update token data submodule" && git push
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

### Event-Driven Service Coordination (Three-Layer Architecture)

**CRITICAL**: The system uses THREE DISTINCT event layers. Understanding this is essential for debugging.

#### Layer 1: Backend Internal (Node.js EventEmitter)
**Purpose**: Service-to-service communication within orchestrator backend
**Pattern**: Domain events → Listener aggregation → State updates → WebSocket broadcast

```
Domain Event (Service) → Listener (stateService) → WebSocket Broadcast (broadcasts.js)
```

**Key Services & Events:**
- `sessionService`: `session:created`, `session:updated`, `transaction:added`, `device:updated/removed`
- `transactionService`: `transaction:accepted`, `group:completed`, `score:updated`, `scores:reset`
- `stateService`: `state:updated`, `state:sync`, `sync:full`
- `videoQueueService`: `video:*`, `queue:*`
- `vlcService`: `degraded`, `connected`, `disconnected`

**Key Files:** `backend/src/services/stateService.js:79-112`, `backend/src/websocket/broadcasts.js`

#### Layer 2: WebSocket AsyncAPI Events (Backend ↔ GM Scanner)
**Purpose**: Real-time communication between orchestrator and GM Scanner
**Contract**: `backend/contracts/asyncapi.yaml`

**Envelope Pattern:**
```javascript
{
  event: "transaction:new",
  data: { /* payload */ },
  timestamp: "2025-11-15T10:30:00.000Z"
}
```

**Server → Client:** `sync:full`, `transaction:new`, `transaction:deleted`, `session:update`, `video:status`, `score:updated`, `scores:reset`, `gm:command:ack`, `device:connected/disconnected`, `group:completed`, `offline:queue:processed`, `batch:ack`, `player:scan`, `error`

**Client → Server:** `transaction:submit`, `gm:command`

**Key Files:** `backend/contracts/asyncapi.yaml`, `backend/src/websocket/eventWrapper.js`

#### Layer 3: Frontend Client-Side Events (Browser EventTarget)
**Purpose**: Internal pub/sub within GM Scanner ES6 modules
**Type**: Browser `EventTarget` with `CustomEvent` (NOT Node.js EventEmitter)

**Pattern:** WebSocket receives → Forward as CustomEvent → Consumers update state → Emit to UI

**EventTarget Classes (8 in GM Scanner):**
1. **OrchestratorClient** - Forwards WebSocket as `message:received` events
2. **ConnectionManager** - `connected`, `disconnected`, `auth:required`
3. **NetworkedSession** - `session:ready`, `session:error`
4. **DataManager** - `transaction:added`, `transaction:deleted`, `scores:cleared`, `data:cleared`
5. **StandaloneDataManager** - `standalone:transaction-added`, `standalone:scores-updated`
6. **AdminController**, **Settings** - Lifecycle events

**Example Flow:**
```
Backend broadcasts 'transaction:new' (Layer 2)
  → OrchestratorClient receives
  → Dispatches CustomEvent 'message:received' (Layer 3)
  → DataManager.addTransaction()
  → Dispatches 'transaction:added'
  → UIManager.renderTransactions() (if active screen)
```

**Critical Pattern:**
```javascript
// ✅ CORRECT: Register listener BEFORE action
DataManager.addEventListener('transaction:added', handler);
DataManager.addTransaction(tx);

// ❌ WRONG: Race condition
DataManager.addTransaction(tx);
DataManager.addEventListener('transaction:added', handler);
```

**Key Files:** `ALNScanner/src/network/orchestratorClient.js`, `ALNScanner/src/core/dataManager.js`, `ALNScanner/src/main.js:68-164`

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
3. Middleware validates JWT BEFORE accepting connection
4. On success: Auto-send `sync:full` event
5. Broadcast `device:connected` to other clients

**Failure Handling:**
- Invalid JWT → Connection rejected at handshake (transport-level error)
- Client receives `connect_error` event (NOT `error` event)

**Key Files:** `backend/src/websocket/gmAuth.js:122`, `backend/src/middleware/socketAuth.js`

### Connection Monitoring
- **WebSocket Clients** (GM Scanner, Scoreboard): Socket.io ping/pong (25s interval, 60s timeout)
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

**Certificate Trust (One-Time Per Device):**
1. Navigate to `https://[IP]:3000/gm-scanner/`
2. Browser shows "not private" warning → "Advanced" → "Proceed to [IP] (unsafe)"
3. Certificate trusted, NFC now works

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

## Notion Sync Scripts

**Purpose**: Sync Notion Elements database (source of truth) to `ALN-TokenData/tokens.json`

### Key Scripts

**1. `sync_notion_to_tokens.py`:**
- Queries Notion for Memory Token elements (filters by Basic Type: Image, Audio, Video, Audio+Image)
- Parses SF_ fields from Description/Text property (regex pattern matching)
- Extracts display text (everything BEFORE first SF_ field) for NeurAI display generation
- **Generates NeurAI-styled BMP** if display text exists (240x320, red branding, ASCII logo)
- Checks filesystem for existing image/audio/video assets
- Handles video tokens specially (`image: null`, `processingImage: {path}`)
- Writes sorted tokens.json to `ALN-TokenData/tokens.json`

**2. `compare_rfid_with_files.py`:**
- Identifies mismatches between Notion SF_RFID values and actual filenames
- Generates detailed mismatch report

**Notion Description/Text Format:**
```
Display text goes here (will be shown on scanners)

SF_RFID: [jaw001]
SF_ValueRating: [5]
SF_MemoryType: [Personal]
SF_Group: [Black Market Ransom (x2)]
SF_Summary: [Optional summary for backend scoring display]
```

**tokens.json Schema:**
```json
{
  "tokenId": {
    "image": "assets/images/{tokenId}.bmp" | null,
    "audio": "assets/audio/{tokenId}.wav" | null,
    "video": "{tokenId}.mp4" | null,
    "processingImage": "assets/images/{tokenId}.bmp" | null,
    "SF_RFID": "tokenId",
    "SF_ValueRating": 1-5,
    "SF_MemoryType": "Personal" | "Business" | "Technical",
    "SF_Group": "Group Name (xN)" | "",
    "summary": "Optional summary text"
  }
}
```

**Key Files:** `scripts/sync_notion_to_tokens.py`, `scripts/compare_rfid_with_files.py`

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

**Key Files:** `backend/src/websocket/gmAuth.js`, `backend/src/middleware/socketAuth.js`

### Player Scanner Connectivity Issues
**Symptoms:** Can't reach orchestrator, scans not logged

**Debug:**
1. `curl -k https://[IP]:3000/health` - Verify orchestrator running
2. Check scanner using correct IP (not localhost)
3. Test endpoint: `curl -k -X POST https://[IP]:3000/api/scan -d '{"tokenId":"test","deviceId":"s1"}'`
4. `npm run prod:logs` - Check backend logs

**Key Files:** `backend/src/routes/scanRoutes.js`, `backend/contracts/openapi.yaml`

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

### GM Scanner Admin Panel DataManager Issues
**Symptoms:** Admin panel history doesn't auto-update, transaction displays show empty data
**Root Cause:** MonitoringDisplay accessing `window.DataManager` (undefined in ES6 modules)

**Debug:**
1. Check browser console for "Cannot read property 'transactions' of undefined"
2. Verify DataManager passed through DI chain: App → NetworkedSession → AdminController → MonitoringDisplay
3. Check AdminController passes dataManager to MonitoringDisplay constructor
4. Verify E2E test selectors match actual DOM (`#historyContainer .transaction-card`)

**DI Pattern:**
```javascript
// ✅ CORRECT: Use injected dependency
constructor(client, dataManager) {
  this.dataManager = dataManager;  // From DI chain
}

// ❌ WRONG: Undefined in ES6 modules
constructor(client) {
  this.dataManager = window.DataManager;  // ALWAYS undefined
}
```

**Key Files:** `ALNScanner/src/utils/adminModule.js:427`, `ALNScanner/src/app/adminController.js:52`, `ALNScanner/src/main.js:68-86`

## Code Style

- ES6 modules with async/await
- Singleton services with `getInstance()`
- JSDoc comments for public methods
- Event-driven architecture (EventEmitter backend, EventTarget frontend)
- Winston logger (no console.log)
- Error codes for API responses
