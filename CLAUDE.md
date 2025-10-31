# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The ALN (About Last Night) Ecosystem is a memory token scanning and video playback system for about last night, a 2 hour immersive game about unlocking and trading in memory tokens containing game characters' lost memories. It is a live event that is run one iteration at a time, either using github pages deployments of player and gm scanners in standalone mode, or using the backend orchestrator to enable syncing across devices and additional features like VLC video playback. It consists of:
- **Memory Tokens** - RFID tags with IDs corresponding to the keys from tokens.json. Players scan then to get associated media content, and turn them into GMs to be scanned for game logic calculations/scoring. (SUBMODULE: ALN-TokenData)
- **Backend Orchestrator**: Node.js server managing video playback, sessions, and state. Used when available; when not, scanners operate independently via deployment on Github Pages.
- **Scanner Apps**: Web-based token scanners (Player and GM) with WebSocket/HTTP integration
  --**Player Scanner**: Uses HTTP endpoints, simple scan logging, display of local assets if token contains audio or image content, and triggering of video files for tokens containing video content (IF orchestrator is present) on separate screen controlled by the orchestrator. intended for players to discover and use as a tool to see the narrative contents of in-game memory tokens. Can operate WITH orchestrator OR WITHOUT in standaalone mode (no video playback). (SUBMODULE: aln-memory-scanner, aka ALNPlayerScan)
  --**GM Scanner**: Uses Websocket after HTTP handshake. Responsible for game logic. Can function in networked mode (in communcation with orchestrator) or standalone. Detective Mode scans and logs tokens (future feature: create player-facing log of narrative events that have been 'made public' by being scanned by the Detective Mode scanner) that were 'turned into' (scanned by) the GM playing the Detective. Black Market Mode scans tokens and handles scoring calculations using scanner/team number for score assignment, by parsing token scoring information from tokens.jason and doing the relevant calculations to keep team scores up to date for each play session.  (SUBMODULE: ALNScanner)
- **Scoreboard Display**: TV-optimized web display (`backend/public/scoreboard.html`) showing live Black Market rankings, group completions, and detective log. Uses hardcoded admin authentication for read-only WebSocket connection.
- **VLC Integration**: Video display on TV/monitor via VLC HTTP interface
- **Submodule Architecture**: Shared token data across modules.

**Contracts (Contract-First Architecture):**
- **API Contract**: `backend/contracts/openapi.yaml` - Defines ALL HTTP endpoints
- **Event Contract**: `backend/contracts/asyncapi.yaml` - Defines ALL WebSocket events
- **Functional Requirements**: `docs/ARCHIVE/api-alignment/08-functional-requirements.md` (archived)

**CRITICAL - Contract-First Development:**
- Contracts define the interface between backend orchestrator and scanner submodules
- ALL API changes MUST update `backend/contracts/openapi.yaml` FIRST
- ALL WebSocket event changes MUST update `backend/contracts/asyncapi.yaml` FIRST
- Breaking contract changes require coordinated updates across:
  - Backend implementation (`backend/src/`)
  - GM Scanner submodule (ALNScanner - WebSocket client)
  - Player Scanner submodule (aln-memory-scanner - HTTP client)
- Contract tests in `backend/tests/contract/` validate implementation matches contracts
- When debugging cross-module communication issues, ALWAYS check contracts first

## Recent Changes

### October 2025: Connection Monitoring Simplification
- **Breaking Change**: Removed custom heartbeat system for WebSocket clients
- GM Scanner and Scoreboard now rely solely on Socket.io's built-in ping/pong mechanism
- Removed `handleHeartbeat` function, `monitorDeviceHealth` interval, and related code
- Eliminated ~80 lines of unused heartbeat handling code
- Player Scanner HTTP polling unchanged (different transport, still required)
- Fixes erratic "disconnected" status despite active Socket.io connections

### October 2025: Test Infrastructure and Service Stability
- **Test Helper**: Added `resetAllServicesForTesting()` to eliminate listener leaks in integration tests
- **Unit Test Achievement**: All 12 unit tests now passing (100% pass rate achieved Oct 30, 2025)
- **Service Cleanup**: Migrated all integration tests to use `resetAllServicesForTesting()` helper
- **Submodule Updates**: ALNScanner and aln-memory-scanner updated with HTTPS normalization and disconnect fixes

### October 2025: mode Field Standardization
- **Breaking Change**: Removed `stationMode` field entirely from all code
- All code now uses `mode` consistently (matches AsyncAPI/OpenAPI contracts)

## Critical Architecture Decisions

### Submodule Structure
The project uses Git submodules for code and data sharing:
```
ALN-Ecosystem/                     # Parent repository
├── aln-memory-scanner/            # [SUBMODULE] Player scanner PWA
│   └── data/                      # [NESTED SUBMODULE → ALN-TokenData]
├── ALNScanner/                    # [SUBMODULE] GM scanner web app
│   └── data/                      # [NESTED SUBMODULE → ALN-TokenData]
├── ALN-TokenData/                 # [SUBMODULE] Token definitions (backend direct access)
└── backend/                       # [DIRECT FOLDER] Orchestrator server
```

### Token Data Loading
- Backend MUST load tokens from `ALN-TokenData/tokens.json` submodule
- NO hardcoded tokens in backend configuration
- Token paths differ by media type:
  - Videos: `"video": "filename.mp4"` → Played from `backend/public/videos/`
  - Images/Audio: `"image": "assets/images/file.jpg"` → Scanner local files

### Cross-Module Data Flow
**Understanding Token Data Paths Across Submodules:**

The system uses a dual-path architecture to enable both networked and standalone scanner operation:

**Backend Direct Access:**
```javascript
// backend/src/services/tokenService.js:51
path.join(__dirname, '../../../ALN-TokenData/tokens.json')
```
- Backend loads tokens directly from root-level `ALN-TokenData/` submodule
- Used for: Game logic, scoring calculations, video queue decisions
- Path resolution: `backend/src/` → `../../..` → `ALN-TokenData/`

**Scanner Nested Submodules:**
```
aln-memory-scanner/data/      → [NESTED SUBMODULE to ALN-TokenData]
ALNScanner/data/              → [NESTED SUBMODULE to ALN-TokenData]
```
- Scanners have ALN-TokenData nested as `data/` subdirectory
- Used for: Standalone mode operation (no orchestrator), local media display
- Enables GitHub Pages deployment with bundled token data

**Data Synchronization:**
- ALN-TokenData is the single source of truth (updated once)
- Submodule references propagate changes to all three locations
- Run `git submodule update --remote --merge` to sync all modules
- Check sync status: `git submodule status --recursive`

**When Debugging Token Issues:**
1. Verify ALN-TokenData submodule is up-to-date: `git submodule status`
2. Check backend can load: `backend/src/services/tokenService.js` logs path on startup
3. Check scanners have synced: `ls -la aln-memory-scanner/data/tokens.json`
4. Token ID mismatches indicate stale submodule references

### Network Flexibility
- System works on ANY network without router configuration
- Uses UDP discovery broadcast (port 8888) for auto-detection
- Supports manual configuration fallback
- Scanners work independently via GitHub Pages when orchestrator unavailable

### HTTPS Architecture and Web NFC Requirements

**CRITICAL**: The system uses HTTPS for all scanner-orchestrator communication to support the Web NFC API, which requires a secure context (HTTPS).

#### HTTPS Configuration (Implemented Oct 24, 2025)

**Backend HTTPS Setup:**
```env
# backend/.env
ENABLE_HTTPS=true
SSL_KEY_PATH=./ssl/key.pem
SSL_CERT_PATH=./ssl/cert.pem
HTTP_REDIRECT_PORT=8000
```

**Architecture:**
- **HTTPS Server**: Port 3000 (primary orchestrator endpoint)
- **HTTP Redirect Server**: Port 8000 (301 redirects to HTTPS:3000)
- **Self-Signed Certificate**: 365-day validity (`backend/ssl/`)
- **Discovery Protocol**: UDP service advertises `protocol: "https"` in responses

**Why HTTPS is Required:**
- **Web NFC API**: GM Scanner uses `NDEFReader` which only works in secure contexts
- **Mixed Content Security**: HTTPS pages cannot make HTTP fetch/WebSocket requests
- **Browser Requirement**: Modern browsers block insecure requests from secure pages

#### Scanner Protocol Handling

**GM Scanner (ALNScanner):**
```javascript
// Default protocol: HTTPS
// connectionManager.js:47 - URL normalization defaults to https://
// orchestratorClient.js:16 - Localhost fallback uses https://
// scanForServers() - Scans HTTPS:3000 and HTTP:8000 ports
```

**Player Scanner (aln-memory-scanner):**
```javascript
// Uses window.location.origin (preserves protocol)
// Falls back to https://localhost:3000 for development
```

**Discovery Service:**
```javascript
// backend/src/services/discoveryService.js:86
protocol: config.ssl.enabled ? 'https' : 'http'  // Dynamic protocol
```

#### Connection Flow with HTTPS

1. **Scanner Entry**: User enters IP without protocol (e.g., `192.168.1.100:3000`)
2. **URL Normalization**: Scanner adds `https://` prefix automatically
3. **Certificate Warning**: Browser shows "not private" warning (first time only)
4. **User Trust**: User clicks "Advanced" → "Proceed to [IP]"
5. **Connection**: Health check, authentication, WebSocket connection succeed
6. **NFC Enabled**: Web NFC API now works (secure context established)

#### Certificate Trust Workflow

**One-Time Setup Per Device:**
```
Android Device → https://[IP]:3000/gm-scanner/
             ↓
    "Your connection is not private" warning
             ↓
    Advanced → Proceed to [IP] (unsafe)
             ↓
    Certificate trusted for this device
             ↓
    NFC scanning enabled
```

**Certificate Details:**
- **Type**: Self-signed X.509 certificate
- **Validity**: 365 days (expires Oct 24, 2026)
- **CN**: Server IP address (e.g., `10.0.0.177`)
- **Location**: `backend/ssl/cert.pem` and `key.pem`

#### Troubleshooting HTTPS Issues

**Mixed Content Blocking:**
```
Symptom: "Mixed Content: The page at 'https://...' was loaded over HTTPS,
          but requested an insecure resource 'http://...'"
Solution: All scanner code now defaults to HTTPS (fixed Oct 29, 2025)
Check: Browser DevTools Console for blocked requests
```

**Certificate Errors:**
```
Symptom: "NET::ERR_CERT_AUTHORITY_INVALID"
Solution: One-time trust required per device (see Certificate Trust Workflow)
Note: This is expected behavior with self-signed certificates
```

**Discovery Service Failures:**
```
Symptom: "Scan for Servers" finds no servers
Debug:
  1. Check backend HTTPS enabled: grep ENABLE_HTTPS backend/.env
  2. Verify scanner tries HTTPS: Check browser Network tab
  3. Test manually: curl -k https://[IP]:3000/health
  4. Check mixed content: HTTPS scanner must scan HTTPS endpoints
```

**WebSocket Connection Issues:**
```
Symptom: Authentication succeeds but connection shows "Connecting..." indefinitely
Root Cause: Race condition between wizard close and socket connection (fixed Oct 29, 2025)
Verification: Status indicator should turn GREEN before wizard closes
```

**HTTP Redirect Server:**
```
Purpose: Convenience fallback for users entering http:// URLs
Port: 8000
Behavior: Sends 301 redirect to https://[IP]:3000
Note: Required for backward compatibility, not for NFC functionality
```

#### Protocol Migration History

**Oct 24, 2025 (Commit 97e7edc5):**
- ✅ Backend HTTPS server implemented
- ✅ Self-signed certificates generated
- ✅ Discovery service updated to advertise `protocol: "https"`
- ✅ HTTP redirect server added (port 8000)
- ❌ Scanner clients NOT updated (caused breakage)

**Oct 29, 2025 (Commit 3137b0ec):**
- ✅ Fixed scanner URL normalization (http → https default)
- ✅ Fixed discovery service scanning (now tries HTTPS:3000)
- ✅ Fixed WebSocket connection race condition
- ✅ Updated both GM and Player scanners

**Breaking Pattern Identified:**
```
Backend Migration → Scanner Not Updated → Mixed Content Blocking
       ↓                    ↓                        ↓
   HTTPS:3000         http:// default        Browser blocks requests
```

**Current State:**
- ✅ Backend advertises HTTPS in discovery responses
- ✅ Scanners default to HTTPS for all connections
- ✅ Discovery scans HTTPS:3000 and HTTP:8000
- ✅ WebSocket connections wait for actual socket establishment
- ✅ Mixed content errors eliminated

## Key Commands

**System Configuration:** All commands optimized for Raspberry Pi 4 (8GB RAM) with:
- Node.js: 2GB max memory (`--max-old-space-size=2048`)
- Jest tests: 4 parallel workers for unit/contract tests
- Playwright E2E: 2-3 parallel workers (configurable)
- Integration tests: Sequential execution (architectural requirement)

### Development
```bash
cd backend
npm run dev                # Interactive development mode selector
npm run dev:full          # VLC + orchestrator with hot reload
npm run dev:no-video      # Orchestrator only (no VLC)
npm test                  # Run all tests
npm run lint              # Run ESLint
```

### Production
```bash
cd backend
npm start                 # Start with PM2 (VLC + orchestrator)
npm run prod:status       # Check PM2 processes
npm run prod:logs         # View logs
npm run prod:restart      # Restart all services
```

### Testing

**Test Architecture:**
- **jest.config.base.js**: Shared base configuration for all Jest tests
- **jest.config.js**: Unit + Contract tests (parallel execution, 4 workers)
- **jest.integration.config.js**: Integration tests (sequential, 1 worker - required)
- **playwright.config.js**: E2E browser tests (2-3 workers)

```bash
cd backend

# Quick feedback (default - runs unit + contract in ~15-30 seconds)
npm test                              # Uses jest.config.js (parallel, 4 workers)

# Individual test suites (8GB Pi optimized)
npm run test:unit                     # Unit tests only (parallel, 4 workers)
npm run test:contract                 # Contract tests only (parallel, 4 workers)
npm run test:integration              # Uses jest.integration.config.js (sequential)

# E2E Tests (Playwright browser automation)
npm run test:e2e                      # E2E tests (2 workers, ~4-5 min)
npm run test:e2e:fast                 # E2E tests (3 workers, max speed)
npm run test:e2e:headed               # Visible browser (1 worker, debugging)
npm run test:e2e:ui                   # Interactive UI mode

# Comprehensive test suites
npm run test:all                      # Unit + Contract + Integration (~5-6 min)
npm run test:full                     # All tests including E2E (~10-15 min)

# CI/CD pipeline
npm run test:ci                       # Standard CI (unit + contract + integration)
npm run test:ci:full                  # Full CI with E2E

# Development utilities
npm run test:watch                    # Watch mode (2 workers)
npm run test:coverage                 # Coverage report (4 workers)
npm run test:offline                  # Offline mode integration test only

# Running individual test files
npm test -- tests/unit/services/persistenceService.test.js
npm test -- persistenceService        # Pattern matching

# Running specific test suites
npm run test:unit -- sessionService   # Unit tests matching pattern
npm run test:integration -- offline   # Integration test matching pattern

# Playwright commands
npx playwright test                   # All E2E tests (uses playwright.config.js)
npx playwright test --workers=3       # Override worker count
npx playwright test flows/00-smoke    # Specific test suite
npx playwright test --grep "session"  # Pattern matching
npx playwright test --debug           # Step-through debugger
npx playwright show-report            # View HTML report after run
```

**Test Performance (8GB Pi):**
- `npm test`: ~15-30 seconds (unit + contract, parallel, 4 workers)
- `npm run test:unit`: ~10-20 seconds (parallel, 4 workers)
- `npm run test:contract`: ~5-10 seconds (parallel, 4 workers)
- `npm run test:integration`: ~5 minutes (sequential - MUST run single-threaded)
- `npm run test:e2e`: ~4-5 minutes (2 workers, down from ~10 min sequential)
- `npm run test:full`: ~10-15 minutes total

**Critical Testing Notes:**
- Integration tests MUST run sequentially (`--runInBand`) to prevent state contamination
- Use `resetAllServicesForTesting()` helper in integration tests to prevent event listener leaks
- E2E tests require orchestrator running: `npm run dev:no-video` (VLC optional)
- Default `npm test` provides fastest feedback for typical development
- Use `npm run test:all` before commits to catch integration issues

### Submodule Management
```bash
git submodule update --init --recursive    # Initialize all submodules
git submodule update --remote --merge      # Update to latest
npm run sync:quick                          # Quick sync and commit
```

### Health Checks
```bash
npm run health            # Full system health check
npm run health:api        # Check orchestrator API
npm run health:vlc        # Check VLC status
```

### Utilities
```bash
cd backend
node start-session.js     # Quick CLI tool to create a session (useful for testing)
```

## Core Services Architecture

### Service Singleton Pattern
All services in `backend/src/services/` use singleton pattern with getInstance():
- **sessionService**: Active session management (source of truth)
- **stateService**: Global state coordination (computed from session)
- **videoQueueService**: Video playback queue management
- **vlcService**: VLC HTTP interface control
- **transactionService**: Token scan transaction processing
- **tokenService**: Token data loading and validation
- **discoveryService**: UDP broadcast for network auto-discovery
- **offlineQueueService**: Offline scan queue management
- **persistenceService**: Disk persistence for sessions and state

### Session and State Architecture
**Critical Design Pattern**: Session is the single source of truth, GameState is computed.

- **Session** (sessionService): Persistent, loads from disk on restart
- **GameState** (stateService): Computed property derived from Session + live system status
  - Always call `getCurrentState()` - never store state
  - Automatically derives from `sessionService.getCurrentSession()`
  - Includes: session data, VLC status, video display status, offline status
  - Eliminates sync bugs on orchestrator restart

This pattern ensures GameState always reflects current reality even after crashes/restarts.

### Event-Driven Service Coordination
**Understanding Internal Event Flow:**

Services use Node.js EventEmitter for internal coordination (separate from WebSocket events):

**Event Flow Pattern:**
```
Domain Event (Service) → Event Listener (stateService) → WebSocket Broadcast (broadcasts.js)
```

**Example: Transaction Processing**
```javascript
// 1. Transaction created
transactionService.emit('transaction:new', transactionData)

// 2. State service listens (stateService.js:100+)
stateService.on('transaction:new', () => {
  const currentState = this.getCurrentState(); // Computes from session
  this.emit('state:updated', currentState);
})

// 3. Broadcast handler wraps for WebSocket (broadcasts.js)
stateService.on('state:updated', (state) => {
  io.to('gm-stations').emit('sync:full', { event: 'sync:full', data: state, timestamp });
})
```

**Critical Service Dependencies:**
- sessionService → Source of truth (persisted)
- stateService → Aggregates session + live status (computed on-demand)
- transactionService → Emits scoring events
- videoQueueService → Emits video status events
- broadcasts.js → Wraps all domain events for WebSocket clients

**Key Files for Event Tracing:**
- `backend/src/services/sessionService.js:69` - Session event emission
- `backend/src/services/stateService.js:79` - Event listener setup
- `backend/src/websocket/broadcasts.js` - WebSocket broadcast coordination
- `backend/src/websocket/listenerRegistry.js` - Prevents duplicate listeners

**Debugging Event Flow:**
1. Check domain event emission: `grep "this.emit" backend/src/services/*.js`
2. Verify listener registration: Check `listenerRegistry.addTrackedListener()` calls
3. Trace broadcast wrapping: Check `broadcasts.js` for envelope pattern
4. Test WebSocket delivery: Monitor client logs for wrapped events

### WebSocket Authentication Flow
**Complete Authentication Flow (HTTP → WebSocket):**

**Step 1: HTTP Authentication**
```javascript
// Client: POST /api/admin/auth
{ password: "admin-secret" }

// Backend: Returns JWT token
{ token: "eyJhbGc...", expiresIn: 86400 }
```

**Step 2: WebSocket Connection with Handshake Auth**
```javascript
// Client: Socket.io connection with handshake.auth
io.connect('http://orchestrator:3000', {
  auth: {
    token: "eyJhbGc...",           // JWT from Step 1
    deviceId: "GM_Station_1",      // Unique device ID
    deviceType: "gm",              // "gm" or "admin"
    version: "1.0.0"               // Client version (optional)
  }
})
```

**Step 3: Server Handshake Validation (BEFORE connection accepted)**
```javascript
// backend/src/websocket/gmAuth.js
// Middleware validates JWT in handshake.auth
// Connection REJECTED if invalid token
// Connection ACCEPTED if valid → proceeds to Step 4
```

**Step 4: Auto-Sync on Successful Connection**
```javascript
// backend/src/websocket/gmAuth.js:122
// Server automatically sends sync:full event (NOT request-based)
emitWrapped(socket, 'sync:full', {
  session: session?.toJSON(),
  scores: transactionService.getTeamScores(),
  recentTransactions: [...],
  videoStatus: {...},
  devices: [...],
  systemStatus: {...}
})
```

**Step 5: Broadcast Device Connection**
```javascript
// Server broadcasts to OTHER connected clients
io.to('gm-stations').emit('device:connected', {
  event: 'device:connected',
  data: { deviceId, type, name, ipAddress, connectionTime },
  timestamp
})
```

**Authentication Failure Handling:**
- Invalid/missing JWT → Connection rejected at handshake (transport-level error)
- Client receives `connect_error` event (NOT application-level `error` event)
- No `sync:full` sent on authentication failure
- Socket disconnected immediately

**Key Files:**
- `backend/src/routes/authRoutes.js` - JWT token generation (Step 1)
- `backend/src/middleware/socketAuth.js` - Handshake validation (Step 3)
- `backend/src/websocket/gmAuth.js` - Post-auth sync (Step 4)
- `backend/contracts/asyncapi.yaml:22-45` - Authentication flow documentation

### Connection Monitoring

The system uses different connection monitoring strategies for different client types:

**WebSocket Clients (GM Scanner, Scoreboard):**
- Rely on Socket.io's built-in ping/pong mechanism
- `pingInterval: 25000ms` (server sends ping every 25 seconds)
- `pingTimeout: 60000ms` (disconnect if no pong received within 60 seconds)
- `disconnect` event fired automatically when connection lost
- Backend's `handleDisconnect` marks device as disconnected and broadcasts
- No custom heartbeat events required

**HTTP-Only Clients (Player Scanner):**
- Poll `/health?deviceId=X&type=player` every 10 seconds
- Each poll updates `device.lastHeartbeat` timestamp
- Different transport, same convergence point (`sessionService.updateDevice`)
- Backend processes query params and updates device status

**Convergence Point:**
Both WebSocket and HTTP paths update devices through the same service methods:
```javascript
// Both paths call:
sessionService.updateDevice(device);  // Updates device in session
session.updateDevice(device);         // Adds/updates device in connectedDevices array
```

**Why Different Strategies:**
- WebSocket: Persistent connection → use transport-level monitoring (Socket.io ping/pong)
- HTTP: Stateless → require application-level polling
- Socket.io's built-in mechanism is industry standard for WebSocket connections
- Custom heartbeats are unnecessary duplication for WebSocket clients

**Connection Loss Detection:**
- WebSocket: Socket.io detects automatically via ping timeout → `disconnect` event
- HTTP: Health check polling fails → orchestrator marks stale after timeout
- Both cases: `handleDisconnect` broadcasts `device:disconnected` event to all clients

### WebSocket Event Flow
See `backend/contracts/asyncapi.yaml` for complete event definitions.

**Key WebSocket Events:**
- `gm:scan` → `game:state` - GM scanner triggers state broadcast
- `admin:intervention` - Manual state corrections with audit trail
- `transaction:deleted` - Real-time cross-scanner sync for deletions
- `session:update` - Session lifecycle events
- `offline:queue:update` - Offline scan synchronization
- `score:updated` - Includes adminAdjustments audit trail

**Admin Audit Trail:**
- All admin score adjustments tracked with metadata (gmStation, reason, timestamp, delta)
- `transaction:deleted` events broadcast to all connected scanners for state sync
- Audit trail included in `score:updated` events via adminAdjustments array

### HTTP API Endpoints
See `backend/contracts/openapi.yaml` for complete API specification.

**Key Endpoints:**
- `POST /api/scan` - Player scanner token scans (fire-and-forget)
  - **Important:** Player Scanner sends ALL token scans to orchestrator (since Oct 2025)
  - Previously only sent video tokens; now includes image/audio for logging
  - Backend logs all scans but only queues videos for playback
- `GET /api/tokens` - Token data retrieval
- `POST /api/admin/auth` - Admin authentication
- `GET /health` - System health check (includes device tracking)

## Environment Configuration

### Required Variables
```env
NODE_ENV=development|production
PORT=3000
VLC_PASSWORD=vlc              # Must match VLC --http-password
FEATURE_VIDEO_PLAYBACK=true
```

### Critical Settings
- `VLC_PASSWORD` must be exactly `vlc`, not `vlc-password`
- `HOST=0.0.0.0` for network access
- `DISCOVERY_PORT=8888` for UDP broadcast
- `ADMIN_PASSWORD` must match hardcoded value in `backend/public/scoreboard.html` for scoreboard auth

## Common Development Tasks

### Adding a New Token
1. Edit `ALN-TokenData/tokens.json`
2. Video: Add file to `backend/public/videos/`, use filename only
3. Images: Add to `ALN-TokenData/assets/images/`, use `assets/images/` path
4. Commit ALN-TokenData changes
5. Update parent repo submodule reference

### Testing Video Playback
```bash
# Start system
cd backend && npm run dev:full

# Trigger test scan (note: -k flag skips cert verification for self-signed cert)
curl -k -X POST https://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "534e2b03", "teamId": "001", "deviceId": "test"}'
```


### File Path Resolution
```javascript
// Token data always from submodule
path.join(__dirname, '../ALN-TokenData/tokens.json')

// Videos from public folder
path.join(__dirname, '../public/videos', videoFilename)

// Persistent storage
path.join(__dirname, '../data')
```

## Deployment Notes

### PM2 Ecosystem
The `ecosystem.config.js` manages both processes:
- `aln-orchestrator`: Node.js server
- `vlc-http`: VLC with HTTP interface

### Raspberry Pi Specifics (8GB Model)
- **RAM**: 8GB total, Node.js configured for 2GB max (`--max-old-space-size=2048`)
- **PM2 restart threshold**: 2GB (automatically restarts if memory exceeds limit)
- **Test parallelization**:
  - Jest: 4 workers for unit/contract tests
  - Playwright: 2-3 workers for E2E tests (down from sequential)
  - Integration: Still sequential (architectural requirement, not RAM constraint)
- **HDMI output**: Configure in `/boot/config.txt`
- **VLC**: Needs GUI access (`--intf qt`)
- **GPU Memory**: Requires minimum 256MB for hardware-accelerated video decoding
  - Check with: `vcgencmd get_mem gpu`
  - Configure in: `/boot/firmware/config.txt` with `gpu_mem=256`
  - Reboot required after changes
  - Browser tests use `--disable-gpu` when VLC is running (GPU reserved for video)

### Video Optimization Requirements
**Critical**: Pi 4 hardware decoder requires properly encoded H.264 videos.

Videos with high bitrates (>5Mbps) will freeze/drop frames. Symptoms:
- Idle loop stops but new video doesn't appear
- VLC shows "displayedpictures: 1" (frozen on first frame)
- Logs show "buffer deadlock" and "dropping frame (computer too slow?)"

**Re-encode large videos with ffmpeg:**
```bash
ffmpeg -i INPUT.mp4 \
  -c:v h264 -preset fast -profile:v main -level 4.0 \
  -b:v 2M -maxrate 2.5M -bufsize 5M \
  -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ac 2 -ar 44100 \
  -movflags +faststart \
  OUTPUT.mp4 -y
```

This creates Pi 4-compatible videos at ~2Mbps bitrate with hardware acceleration support.

### Network Access URLs
**HTTPS is enabled for Web NFC API support (required for physical NFC scanning in GM Scanner):**

- Orchestrator: `https://[IP]:3000` (HTTPS - accepts self-signed cert)
- Admin Panel: `https://[IP]:3000/admin/`
- Player Scanner: `https://[IP]:3000/player-scanner/`
- GM Scanner: `https://[IP]:3000/gm-scanner/` (HTTPS required for NFC)
- Scoreboard Display: `https://[IP]:3000/scoreboard`
- HTTP Redirect: `http://[IP]:8000` (auto-redirects to HTTPS)
- VLC Control: `http://[IP]:8080` (password: vlc, internal only)

**Certificate Trust (One-Time Setup Per Device):**
1. Navigate to `https://[IP]:3000/gm-scanner/` on Android device
2. Browser shows "Your connection is not private" warning
3. Click "Advanced" → "Proceed to [IP] (unsafe)"
4. Certificate is now trusted for this device
5. NFC scanning works (Web NFC API requires secure context)

## Cross-Module Debugging Guide

**Debugging Issues That Span Multiple Submodules:**

### Player Scanner Connectivity Issues
**Symptoms:** Player scanner can't reach orchestrator, scans not logged
**Debug Path:**
1. Verify orchestrator running: `curl -k https://[IP]:3000/health`
2. Check scanner using correct IP (not localhost): Inspect scanner config
3. Test HTTPS endpoint directly (note: -k flag skips cert verification):
   ```bash
   curl -k -X POST https://[IP]:3000/api/scan \
     -H "Content-Type: application/json" \
     -d '{"tokenId":"test","deviceId":"scanner1"}'
   ```
4. Check backend logs: `npm run prod:logs` or `tail -f logs/combined.log`
5. Verify firewall not blocking: `sudo ufw status` on Pi

**Key Files:**
- `backend/src/routes/scanRoutes.js` - HTTP endpoint implementation
- `aln-memory-scanner/` - Player scanner submodule
- `backend/contracts/openapi.yaml:280-488` - API contract for `/api/scan`

### GM Scanner WebSocket Issues
**Symptoms:** GM scanner connects but doesn't receive state updates
**Debug Path:**
1. Verify JWT authentication (note: -k flag skips cert verification):
   ```bash
   curl -k -X POST https://[IP]:3000/api/admin/auth \
     -H "Content-Type: application/json" \
     -d '{"password":"your-admin-password"}'
   ```
2. Check handshake.auth includes valid token: Inspect browser console
3. Verify `sync:full` event received after connection: Check client logs
4. Confirm device joined 'gm-stations' room: Check server logs for "GM already authenticated"
5. Test event broadcast: Create transaction, check if `transaction:new` received

**Key Files:**
- `backend/src/websocket/gmAuth.js:21-164` - Authentication and sync
- `backend/src/middleware/socketAuth.js` - JWT validation middleware
- `ALNScanner/` - GM scanner submodule (WebSocket client)
- `backend/contracts/asyncapi.yaml:234-501` - WebSocket contract for `sync:full`

### Token Data Synchronization Issues
**Symptoms:** Backend reports token not found, scanner shows different tokens
**Debug Path:**
1. Check submodule status: `git submodule status --recursive`
2. Look for detached HEAD or mismatched commits
3. Update all submodules: `git submodule update --remote --merge`
4. Verify backend loads correct file:
   ```bash
   grep "Loaded tokens from" logs/combined.log
   ```
5. Check token count matches: Compare counts in backend logs vs `wc -l ALN-TokenData/tokens.json`
6. Restart orchestrator to reload: `npm run prod:restart`

**Key Files:**
- `backend/src/services/tokenService.js:49-66` - Token file loading logic
- `ALN-TokenData/tokens.json` - Source of truth
- `.gitmodules` - Submodule configuration

### Video Playback State Issues
**Symptoms:** Videos queue but don't play, idle loop doesn't resume
**Debug Path:**
1. Check VLC connection: `curl http://localhost:8080/requests/status.json -u :vlc`
2. Verify video file exists: `ls -lh backend/public/videos/[filename].mp4`
3. Check video queue status: Monitor `video:status` events in GM scanner
4. Trace video flow:
   - tokenService → Check token has `video` property
   - videoQueueService → Check queue not empty
   - vlcService → Check VLC commands sent successfully
5. Check VLC logs: `npm run prod:logs | grep vlc`

**Key Files:**
- `backend/src/services/videoQueueService.js` - Queue management
- `backend/src/services/vlcService.js` - VLC HTTP interface
- `backend/src/routes/scanRoutes.js:30-50` - Video queueing trigger

### State Synchronization After Restart
**Symptoms:** GM scanner shows stale state after orchestrator restart
**Debug Path:**
1. Verify session loaded: `grep "Session restored from storage" logs/combined.log`
2. Check persistence file exists: `ls -lh backend/data/session-*.json`
3. Confirm GameState computed correctly:
   - sessionService.getCurrentSession() not null
   - stateService.getCurrentState() derives from session
4. Verify clients receive `sync:full` on reconnect
5. Check event listeners registered: No "duplicate listener" warnings in logs

**Key Files:**
- `backend/src/services/sessionService.js:28-42` - Session loading on init
- `backend/src/services/stateService.js:42-63` - State computation
- `backend/src/services/persistenceService.js` - Disk persistence
- `backend/src/websocket/gmAuth.js:87-138` - Sync on connection

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| VLC not connecting | Check `VLC_PASSWORD=vlc` in .env |
| Video not playing | Verify file exists in `backend/public/videos/` |
| Video freezes/black screen | Check GPU memory (need 256MB), re-encode video if >5Mbps bitrate |
| Idle loop stops but video doesn't play | Video bitrate too high - re-encode with ffmpeg (see Video Optimization) |
| Scanner can't connect | Check firewall, use IP not localhost, verify HTTPS enabled |
| Certificate errors | One-time trust per device - see HTTPS Architecture section |
| Discovery finds no servers | Check HTTPS enabled, verify scanner scans HTTPS:3000 |
| NFC not working | Requires HTTPS (secure context) - see HTTPS Architecture section |
| Token not found | Update ALN-TokenData submodule |
| Port in use | `lsof -i :3000` and kill process |
| GameState null after restart | Session should auto-derive state - check logs for "Session loaded on startup" |
| GM scanner connects but no state | Check JWT token valid, verify `sync:full` event sent (see Cross-Module Debugging) |
| Transaction not scoring | Verify session exists, check transactionService event emission |
| Submodule out of sync | Run `git submodule update --remote --merge` and restart orchestrator |

## E2E Testing Infrastructure

### Overview
The project includes comprehensive end-to-end tests using Playwright to validate full system flows across all components (backend, GM Scanner, Player Scanner).

**Location:** `backend/tests/e2e/`

**Test Organization:**
```
backend/tests/e2e/
├── flows/                              # Test suites organized by feature
│   ├── 00-smoke-test.test.js          # Basic system health
│   ├── 01-session-*.test.js           # Session lifecycle tests
│   ├── 07a-gm-scanner-standalone-*.test.js    # Standalone mode
│   ├── 07b-gm-scanner-networked-*.test.js     # Networked mode
│   ├── 07c-gm-scanner-scoring-parity.test.js  # Mode parity validation
│   └── 21-player-scanner-*.test.js    # Player scanner integration
├── helpers/
│   ├── page-objects/                  # Page object models
│   │   ├── GMScannerPage.js          # GM Scanner interactions
│   │   └── PlayerScannerPage.js      # Player Scanner interactions
│   ├── assertions.js                  # Custom assertions
│   ├── wait-conditions.js            # Async wait utilities
│   └── scanner-init.js               # Scanner setup helpers
├── setup/
│   └── session-helpers.js            # Session management utilities
└── fixtures/
    ├── test-tokens.json              # 10 minimal test tokens (2.6KB)
    ├── test-videos/                  # Small test videos (~50KB total)
    └── test-assets/                  # Test images and audio
```

### Test Fixtures
E2E tests use lightweight fixtures (`backend/tests/e2e/fixtures/`) instead of production ALN-TokenData:
- **Rationale:** Fast execution, predictable data, Pi-compatible encoding
- **Size:** ~50KB total (vs 100+ MB production data)
- **Coverage:** All token types (video, image, audio, combinations)
- See `backend/tests/e2e/fixtures/README.md` for complete fixture documentation

### Key Test Patterns

**Page Object Model:**
- `GMScannerPage` and `PlayerScannerPage` encapsulate scanner interactions
- Methods for scanning, mode switching, authentication, state inspection
- Handles WebSocket event listening and DOM manipulation

**Wait Conditions:**
- Never use arbitrary timeouts (`page.waitForTimeout()`)
- Always use condition-based waiting (`wait-conditions.js`)
- Polls for actual state changes (score updates, transaction visibility)
- See `backend/tests/e2e/setup/BROWSER_CONTEXTS_README.md` for patterns

**Assertions:**
- Custom assertions in `assertions.js` for common validations
- Score expectations, transaction visibility, session state
- WebSocket event envelope validation

### Running E2E Tests
```bash
cd backend
npx playwright test                   # All E2E tests
npx playwright test --ui              # Interactive UI mode
npx playwright test flows/00-smoke   # Specific suite
npx playwright test --grep "Black Market"  # Pattern matching
npx playwright test --debug           # Step-through debugger
npx playwright show-report            # View HTML report
```

**Test Isolation:**
- Each test creates its own session to avoid cross-test pollution
- Session helpers in `setup/session-helpers.js` manage lifecycle
- Tests can run in parallel or sequential (`--workers=1` for sequential)

### Important E2E Testing Notes
- Tests require orchestrator running: `npm run dev:no-video` (VLC optional)
- Browser contexts are isolated (separate cookies, storage, WebSocket connections)
- Check `backend/tests/e2e/setup/BROWSER_CONTEXTS_README.md` for architecture details
- See `backend/tests/e2e/fixtures/FIXTURE_SUMMARY.txt` for fixture token IDs

## Code Style Guidelines

- ES6 modules with async/await
- Singleton services with getInstance()
- JSDoc comments for public methods
- Error codes for API responses
- Event-driven architecture with EventEmitter
- No console.log, use winston logger

