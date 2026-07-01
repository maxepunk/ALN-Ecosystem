# ALN Orchestrator API Contracts

**Contract-First Architecture** | **OpenAPI 3.1.0** | **AsyncAPI 2.6.0**

This directory contains the formal API contracts for the ALN (About Last Night) Orchestrator backend.

## 📋 Table of Contents

- [Overview](#overview)
- [Contract Files](#contract-files)
- [Quick Start](#quick-start)
- [HTTP Endpoints (13)](#http-endpoints-13)
- [WebSocket Events (25)](#websocket-events-25)
- [Key Design Decisions](#key-design-decisions)
- [Validation](#validation)
- [Breaking Changes](#breaking-changes)
- [Development Workflow](#development-workflow)

---

## Overview

These contracts define the **live, implemented** ALN Orchestrator API, kept in sync with the backend HTTP routes and the `gm:command` executor via contract tests. They are the source of truth for the request/response shapes the backend actually serves.

### Architecture Principles

1. **Contract-First**: Contracts define behavior, tests validate compliance, implementation follows
2. **Minimal Complexity**: Live event tool (2-hour window), not enterprise SaaS
3. **Standalone Mode**: Scanners work without orchestrator (client-side game logic)
4. **ONE Session**: No multi-session complexity

### Documentation References

- **Alignment Decisions**: `docs/ARCHIVE/api-alignment/04-alignment-decisions.md` (15 strategic decisions)
- **Functional Requirements**: `docs/ARCHIVE/api-alignment/08-functional-requirements.md` (component responsibilities)
- **Essential API List**: `docs/ARCHIVE/api-alignment/09-essential-api-list.md` (minimal contract scope)
- **Test Architecture**: `docs/ARCHIVE/api-alignment/06-test-architecture.md` (validation strategy)

---

## Contract Files

```
backend/contracts/
├── README.md           # This file
├── openapi.yaml        # HTTP API contract (OpenAPI 3.1.0)
└── asyncapi.yaml       # WebSocket contract (AsyncAPI 2.6.0)
```

### openapi.yaml - HTTP API (13 endpoints)

- **POST /api/admin/auth** - Admin authentication (JWT tokens)
- **POST /api/scan** - Player Scanner token scan (persisted to session.playerScans)
- **POST /api/scan/batch** - Player Scanner offline queue batch
- **GET /api/session** - Current session info (lightweight)
- **GET /api/tokens** - Token database (tokens.json)
- **GET /api/state** - Complete game state (debug/recovery)
- **GET /api/admin/logs** - System logs (troubleshooting)
- **GET /api/assets/manifest** - Asset sync manifest (ESP32 CYD scanner)
- **GET /api/assets/images/{tokenId}.bmp** - Per-token BMP image (ESP32 asset sync)
- **GET /api/assets/audio/{tokenId}.{ext}** - Per-token audio file (ESP32 asset sync)
- **GET /api/music/tracks** - Music track catalog (MPD)
- **GET /api/music/playlists** - Music playlists (music-playlists.json)
- **GET /health** - Health check

### asyncapi.yaml - WebSocket API (25 messages)

**Sync (2)**: sync:request, sync:full
**Device Tracking (2)**: device:connected, device:disconnected
**Transactions (4)**: transaction:submit, transaction:result, transaction:new, transaction:deleted
**Scores (2)**: score:adjusted, scores:reset
**Display (1)**: display:mode
**Scoreboard (1)**: scoreboard:page
**Session (2)**: session:update, session:overtime
**Admin (2)**: gm:command, gm:command:ack
**Service State (1)**: service:state (10 domains — the sole push mechanism for service domain state; documented in [Key Events](#key-events) below)
**Offline Queue (2)**: offline:queue:processed, batch:ack
**Game Activity (2)**: group:completed, player:scan
**Cues (3)**: cue:fired, cue:completed, cue:error
**Error (1)**: error

---

## Quick Start

### View Contracts

**OpenAPI (HTTP)**:
```bash
# View in browser (Swagger UI)
npx @redocly/cli preview-docs contracts/openapi.yaml

# Or use online viewer
# https://editor.swagger.io/
# Paste contents of openapi.yaml
```

**AsyncAPI (WebSocket)**:
```bash
# View in browser (AsyncAPI Studio)
npx @asyncapi/studio contracts/asyncapi.yaml

# Or use online viewer
# https://studio.asyncapi.com/
# Paste contents of asyncapi.yaml
```

### Validate Contracts

```bash
# Validate OpenAPI
npx @redocly/cli lint contracts/openapi.yaml

# Validate AsyncAPI
npx @asyncapi/cli validate contracts/asyncapi.yaml
```

---

## HTTP Endpoints (13)

### Authentication

#### POST /api/admin/auth
Authenticate as admin, receive JWT token.

**Request**:
```json
{
  "password": "admin-secret-123"
}
```

**Response (200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400
}
```

**Usage**: JWT token used for WebSocket authentication (gm:identify event).

---

### Player Scanner Operations

#### POST /api/scan
Single token scan. Persisted to `session.playerScans[]` and broadcast via `player:scan` event.

**Request**:
```json
{
  "tokenId": "534e2b03",
  "teamId": "Team Alpha",  // Optional (players haven't committed yet)
  "deviceId": "PLAYER_SCANNER_01",
  "timestamp": "2025-10-15T14:30:00.000Z"
}
```

**Response (200)**:
```json
{
  "status": "accepted",
  "message": "Video queued for playback",
  "tokenId": "534e2b03",
  "mediaAssets": {
    "video": "test_30sec.mp4",
    "image": null,
    "audio": null
  },
  "videoQueued": true
}
```

**CRITICAL**: Player Scanner **IGNORES response body** by design (ESP32 compatibility). Response provided for debugging/future clients.

**Other responses**: The 200 body also models a **rejected** case (`status: rejected`, `videoQueued: false`, optional `waitTime` when a video is already playing or VLC is down), plus error responses `SESSION_NOT_FOUND` (no active session) and `SERVICE_UNAVAILABLE` (token data not loaded yet). See `openapi.yaml` for the full schemas.

#### POST /api/scan/batch
Offline queue batch upload.

**Request**:
```json
{
  "transactions": [
    {
      "tokenId": "534e2b02",
      "teamId": "Team Alpha",
      "deviceId": "PLAYER_SCANNER_01",
      "timestamp": "2025-10-15T14:25:00.000Z"
    },
    {
      "tokenId": "tac001",
      "deviceId": "PLAYER_SCANNER_01",
      "timestamp": "2025-10-15T14:26:30.000Z"
    }
  ]
}
```

**Response (200)**:
```json
{
  "results": [
    {
      "tokenId": "534e2b02",
      "status": "processed",
      "videoQueued": false
    },
    {
      "tokenId": "tac001",
      "status": "processed",
      "videoQueued": false
    }
  ]
}
```

---

### Session & State

#### GET /api/session
Get current active session (lightweight).

**Response (200)**:
```json
{
  "id": "2a2f9d45-5d2d-441d-b32c-52c939f3c103",
  "name": "About Last Night - Oct 15 2025",
  "startTime": "2025-10-15T19:00:00.000Z",
  "endTime": null,
  "status": "active",
  "teams": ["Team Alpha", "Detectives", "Blue Squad"],
  "metadata": {
    "gmStations": 2,
    "playerDevices": 3,
    "totalScans": 47
  }
}
```

#### GET /api/state
Get complete game state (debug/recovery).

**Response (200)**: Complete state including session, scores, recentTransactions, videoStatus, devices, systemStatus.

**ETag Support**: Include `If-None-Match` header for caching (304 Not Modified response).

**CRITICAL**: NOT for polling. Use WebSocket sync:full for real-time state.

---

### Static Resources

#### GET /api/tokens
Get token database (tokens.json).

**Response (200)**:
```json
{
  "tokens": {
    "534e2b02": {
      "image": "assets/images/534e2b02.jpg",
      "audio": "assets/audio/534e2b02.mp3",
      "video": null,
      "SF_RFID": "534e2b02",
      "SF_ValueRating": 3,
      "SF_MemoryType": "Technical",
      "SF_Group": ""
    }
  },
  "count": 42,
  "lastUpdate": "2025-09-30T12:00:00.000Z"
}
```

#### GET /api/assets/manifest
Asset sync manifest describing every image and audio file shipped with the token database. Used by the ESP32 CYD scanner at boot to decide which files to download. See `openapi.yaml` for the manifest schema.

#### GET /api/assets/images/{tokenId}.bmp
Serve an individual BMP for the given `tokenId` (from `aln-memory-scanner/assets/images/`). Used by the ESP32 CYD scanner during asset sync.

#### GET /api/assets/audio/{tokenId}.{ext}
Serve an individual audio file for the given `tokenId` (from `aln-memory-scanner/assets/audio/`). Same validation and caching as the image endpoint.

#### GET /health
Health check.

**Response (200)**:
```json
{
  "status": "online",
  "version": "1.0.0",
  "uptime": 3600.5,
  "timestamp": "2025-10-15T12:00:00.000Z"
}
```

---

### Admin Operations

#### GET /api/admin/logs
Get system logs (requires JWT auth).

**Query Parameters**:
- `lines` (optional, default 100, max 500)
- `level` (optional, default 'error', values: error|warn|info)

**Response (200)**:
```json
{
  "logs": [
    "2025-10-15T20:15:30.123Z [ERROR] VLC connection lost",
    "2025-10-15T20:14:22.456Z [ERROR] Transaction validation failed"
  ],
  "count": 2,
  "timestamp": "2025-10-15T20:16:00.000Z"
}
```

**Security**: Requires `Authorization: Bearer <token>` header.

---

### Music

#### GET /api/music/tracks
List all music tracks known to MPD's database (derived from `backend/public/music/` at MPD startup). See `openapi.yaml` for the response schema.

#### GET /api/music/playlists
Return the contents of `backend/config/music-playlists.json` verbatim. Consumed by the GM Scanner (via `sync:full`) and the Config Tool editor.

---

## WebSocket Events (25)

### Connection Pattern

All WebSocket events use **wrapped envelope** format:

```json
{
  "event": "event:name",
  "data": { /* event-specific payload */ },
  "timestamp": "2025-10-15T20:15:30.000Z"
}
```

### Authentication Flow

1. **Client**: HTTP POST /api/admin/auth → receive JWT token
2. **Client**: Connect WebSocket
3. **Client**: Send `gm:identify` event with token
4. **Server**: Validate token → send `gm:identified` event
5. **Server**: Send `sync:full` event with complete state

---

### Key Events

#### gm:identify (Client → Server)
Authenticate WebSocket connection.

```json
{
  "event": "gm:identify",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "deviceId": "GM_Station_1",
    "type": "gm",
    "name": "GM Station v1.0.0"
  },
  "timestamp": "2025-10-15T19:00:30.000Z"
}
```

#### sync:full (Server → Client)
Complete state synchronization (sent after authentication, after offline queue processing).

```json
{
  "event": "sync:full",
  "data": {
    "session": { /* full session object */ },
    "scores": [ /* team scores */ ],
    "recentTransactions": [ /* last 100 */ ],
    "videoStatus": { /* current video state */ },
    "devices": [ /* connected devices */ ],
    "systemStatus": { /* orchestrator + VLC health */ }
  },
  "timestamp": "2025-10-15T19:00:30.200Z"
}
```

**CRITICAL**: This is the PRIMARY state sync mechanism. Replaces eliminated `state:sync` and `state:update` events.

#### transaction:submit (Client → Server)
GM Scanner submits token scan for scoring.

```json
{
  "event": "transaction:submit",
  "data": {
    "tokenId": "534e2b03",
    "teamId": "Team Alpha",
    "deviceId": "GM_Station_1",
    "mode": "blackmarket"
  },
  "timestamp": "2025-10-15T20:15:30.000Z"
}
```

**Flow**:
1. Client sends transaction:submit
2. Server sends transaction:result to submitter
3. Server broadcasts a single transaction:new (enriched with teamScore) to all GMs in the session room

#### service:state (Server → Clients)

**The SOLE push mechanism for all service domain state.** A `service:state` event carries a full state snapshot (not a delta) for one domain, wrapped in a `{domain, state}` envelope. It replaced every per-service discrete event (`video:status`, `gameclock:status`, `bluetooth:device`, `lighting:scene`, `audio:routing`, `held:*`, `cue:status`, `audio:ducking:status`, etc.).

**10 domains**: `music`, `video`, `health`, `bluetooth`, `audio`, `lighting`, `sound`, `gameclock`, `cueengine`, `held`.

```json
{
  "event": "service:state",
  "data": {
    "domain": "video",
    "state": {
      "status": "playing",
      "currentVideo": { "tokenId": "534e2b03" },
      "queue": [],
      "queueLength": 2,
      "connected": true
    }
  },
  "timestamp": "2025-10-15T20:15:45.000Z"
}
```

The authoritative shape for each domain's `state` object is the matching `components.schemas.DomainState*` schema in `asyncapi.yaml` (e.g., `DomainStateVideo`, `DomainStateHealth`), enforced by the backend's service-domain-state contract test. Video playback state rides this event under domain `video` — there is no separate `video:status` event.

#### gm:command (Client → Server)
Unified admin command interface (replaces 11 HTTP admin endpoints).

```json
{
  "event": "gm:command",
  "data": {
    "action": "video:skip",
    "payload": {}
  },
  "timestamp": "2025-10-15T20:20:00.000Z"
}
```

**Available Actions** (59 total — the `GmCommand` `action` enum in `asyncapi.yaml` is the source of truth):
- Session: `session:create`, `session:addTeam`, `session:start`, `session:pause`, `session:resume`, `session:end`
- Video: `video:play`, `video:pause`, `video:stop`, `video:skip`, `video:seek`, `video:queue:add`, `video:queue:reorder`, `video:queue:clear`
- Display: `display:idle-loop`, `display:scoreboard`, `display:return-to-video`, `display:status`
- Scoreboard: `scoreboard:page:next`, `scoreboard:page:prev`, `scoreboard:page:owner`
- Score: `score:adjust`, `score:reset`
- Transaction: `transaction:delete`, `transaction:create`
- System: `system:reset`
- Bluetooth: `bluetooth:scan:start`, `bluetooth:scan:stop`, `bluetooth:pair`, `bluetooth:unpair`, `bluetooth:connect`, `bluetooth:disconnect`
- Audio: `audio:route:set`, `audio:volume:set`
- Lighting: `lighting:scene:activate`, `lighting:scenes:refresh`
- Cue: `cue:fire`, `cue:stop`, `cue:pause`, `cue:resume`, `cue:enable`, `cue:disable`
- Held: `held:release`, `held:discard`, `held:release-all`, `held:discard-all`
- Sound: `sound:play`, `sound:stop`
- Music: `music:play`, `music:pause`, `music:stop`, `music:next`, `music:previous`, `music:setVolume`, `music:setShuffle`, `music:setLoop`, `music:loadPlaylist`, `music:seek`
- Service: `service:check`

**Response**: Server sends `gm:command:ack`, then any resulting state changes arrive separately via `service:state` (and `score:adjusted` for score adjustments).

#### gm:command:ack (Server → Client)
Acknowledges a `gm:command`. Payload is exactly `{action, success, message}` — there is **no** `result`/`data` field. State changes caused by the command are delivered separately via `service:state`.

```json
{
  "event": "gm:command:ack",
  "data": {
    "action": "video:skip",
    "success": true,
    "message": "Video skipped"
  },
  "timestamp": "2025-10-15T20:20:00.500Z"
}
```

#### scores:reset (Server → Clients)
Broadcast when all team scores are reset to zero (triggered by `score:reset` command).

```json
{
  "event": "scores:reset",
  "data": {
    "teamsReset": ["Team Alpha", "Detectives", "Blue Squad"]
  },
  "timestamp": "2025-10-15T20:20:01.000Z"
}
```

**Pattern**: Follows "bulk event + sync:full" pattern - server broadcasts `scores:reset` first, then sends `sync:full` with updated state.

**Usage**: Allows clients to show immediate feedback ("Scores reset!") while waiting for complete state sync.

---

## Key Design Decisions

### Decision #2: Wrapped WebSocket Envelope
All WebSocket events use `{event, data, timestamp}` structure.

### Decision #3: RESTful HTTP
Direct resources/results, HTTP status codes communicate status (no wrapper envelope).

### Decision #4: Field Naming Standardization
- `deviceId` (not scannerId/stationId)
- `tokenId` (not rfid/videoId)
- `id` within resources (not sessionId)

### Decision #7: session:update Full Resource
Send complete session object (not minimal delta).

### Decision #9: Player Scanner Fire-and-Forget
Player Scanner ignores response bodies (ESP32 compatibility).

### Decision #10: Error Display
User-facing errors via `error` event (no more console-only errors).

---

## Validation

### Schema Validation (ajv)

Contract validation against these specs is **implemented** in `backend/tests/helpers/contract-validator.js`, which compiles the OpenAPI/AsyncAPI schemas with ajv (+ `ajv-formats`) and exposes:

- `validateHTTPRequest(body, path, method)` — validate a request body against the OpenAPI `requestBody` schema
- `validateHTTPResponse(response, path, method, status)` — validate a response against the OpenAPI response schema
- `validateWebSocketEvent(eventData, eventName)` — validate a WebSocket payload against its AsyncAPI message
- `getHTTPRequestSchema` / `getHTTPSchema` / `getWebSocketSchema` — extract the raw JSON Schema

### Contract Tests

Contract tests under `backend/tests/contract/` use the validator above to assert backend payloads match these specs. Scanner payload formats (ESP32 + PWA) are validated against the OpenAPI request schemas in `tests/contract/scanner/request-schema-validation.test.js`. Run with `npm run test:contract` (or `npm test` for unit + contract).

---

## Breaking Changes

### Critical Breaking Changes

1. **Field Renames**:
   - `scannerId` → `deviceId` (everywhere)
   - `sessionId` → `id` (within session resource)

2. **Added Required Fields**:
   - `session.teams` array

3. **Wrapped Envelopes**:
   - `gm:identified` now wrapped

4. **Transport Changes**:
   - Admin commands moved from HTTP POST to WebSocket `gm:command`

5. **Eliminated Events** (all replaced by `sync:full` and the unified `service:state` event):
   - `state:sync` (use `sync:full`)
   - `state:update` (use `service:state` domain events)
   - `score:updated` (use `transaction:new.teamScore`, `score:adjusted`, `transaction:deleted.updatedTeamScore`)
   - `session:new/paused/resumed/ended` (use `session:update` with status)
   - `video:status` and all per-service discrete state events (`gameclock:status`, `bluetooth:device`, `lighting:scene`, `audio:routing`, `held:*`, `cue:status`, `audio:ducking:status`) — replaced by the unified `service:state` event. Video state now rides `service:state` domain `video` (the old `current` → `status` rename and `queueLength` addition were superseded by the domain schema).

---

## Development Workflow

### Contract-First Process

1. **Update Contract** (`openapi.yaml` or `asyncapi.yaml`)
2. **Validate Contract** (`npx @redocly/cli lint ...`)
3. **Write/Update Tests** (contract tests validate schema compliance)
4. **Update Implementation** (make tests pass)
5. **Verify Contract Compliance** (all contract tests green)

### Adding New Endpoint

1. Add to appropriate contract file
2. Reference functional requirements + decisions in description
3. Include realistic examples (team IDs as "001", token IDs from tokens.json)
4. Document breaking changes inline
5. Update this README if adding new category

### Modifying Existing Endpoint

1. Update contract specification
2. Document breaking changes inline (and in the Breaking Changes section above)
3. Update affected contract tests
4. Coordinate backend + scanner changes
5. Update examples in README

---

## Contract Principles

### ✅ DO

- Reference functional requirements (section numbers)
- Reference decisions (decision numbers)
- Use realistic examples (actual token IDs, alphanumeric team names)
- Document breaking changes inline
- Specify target structure (what SHOULD exist)
- Include validation rules (patterns, enums, min/max)

### ❌ DON'T

- Make up fields not grounded in requirements
- Use fake examples (TEAM_A instead of "Team Alpha")
- Omit required fields
- Document current broken behavior
- Create duplicate patterns

---

## Support

**Questions?** See the archived historical planning docs:
- Alignment Decisions: `docs/ARCHIVE/api-alignment/04-alignment-decisions.md`
- Functional Requirements: `docs/ARCHIVE/api-alignment/08-functional-requirements.md`
- Essential API List: `docs/ARCHIVE/api-alignment/09-essential-api-list.md`

**Validation Issues?** Check:
- Test Architecture: `docs/ARCHIVE/api-alignment/06-test-architecture.md`
- Test Analysis: `docs/ARCHIVE/api-alignment/05-test-analysis.md`

---

**Contract Version**: 1.0.0
**Last Updated**: 2026-06-18
These contracts reflect the live, implemented API (HTTP + WebSocket), kept in sync with the backend via contract tests.
