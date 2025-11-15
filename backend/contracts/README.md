# ALN Orchestrator API Contracts

**Contract-First Architecture** | **OpenAPI 3.1.0** | **AsyncAPI 2.6.0**

This directory contains the formal API contracts for the ALN (About Last Night) Orchestrator backend.

## 📋 Table of Contents

- [Overview](#overview)
- [Contract Files](#contract-files)
- [Quick Start](#quick-start)
- [HTTP Endpoints (8)](#http-endpoints-8)
- [WebSocket Events (16)](#websocket-events-16)
- [Key Design Decisions](#key-design-decisions)
- [Validation](#validation)
- [Breaking Changes](#breaking-changes)
- [Development Workflow](#development-workflow)

---

## Overview

These contracts define the **target architecture** for the ALN system - what the APIs **should be**, not necessarily what they currently are. They represent the minimal essential surface (24 APIs total, 59% reduction from current 59 APIs).

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
├── asyncapi.yaml       # WebSocket contract (AsyncAPI 2.6.0)
└── MIGRATION-GUIDE.md  # Breaking changes migration guide
```

### openapi.yaml - HTTP API (8 endpoints)

- **POST /api/admin/auth** - Admin authentication (JWT tokens)
- **POST /api/scan** - Player Scanner token scan (fire-and-forget)
- **POST /api/scan/batch** - Player Scanner offline queue batch
- **GET /api/session** - Current session info (lightweight)
- **GET /api/tokens** - Token database (tokens.json)
- **GET /api/state** - Complete game state (debug/recovery)
- **GET /api/admin/logs** - System logs (troubleshooting)
- **GET /health** - Health check

### asyncapi.yaml - WebSocket API (16 events)

**Authentication (4)**: gm:identify, gm:identified, device:connected, device:disconnected
**State Sync (1)**: sync:full
**Transactions (4)**: transaction:submit, transaction:result, transaction:new, score:updated
**Video (1)**: video:status
**Session (1)**: session:update
**Admin (2)**: gm:command, gm:command:ack
**Other (3)**: offline:queue:processed, group:completed, error

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

## HTTP Endpoints (8)

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
Single token scan (fire-and-forget).

**Request**:
```json
{
  "tokenId": "534e2b03",
  "teamId": "001",         // Optional (players haven't committed yet)
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

#### POST /api/scan/batch
Offline queue batch upload.

**Request**:
```json
{
  "transactions": [
    {
      "tokenId": "534e2b02",
      "teamId": "001",
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
  "teams": ["001", "002", "003"],
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

## WebSocket Events (16)

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
    "teamId": "001",
    "deviceId": "GM_Station_1",
    "mode": "blackmarket"
  },
  "timestamp": "2025-10-15T20:15:30.000Z"
}
```

**Flow**:
1. Client sends transaction:submit
2. Server sends transaction:result to submitter
3. Server broadcasts transaction:new to all GMs
4. Server broadcasts score:updated to all GMs

#### video:status (Server → Clients)
Video playback status updates.

```json
{
  "event": "video:status",
  "data": {
    "status": "playing",
    "queueLength": 2,
    "tokenId": "534e2b03",
    "duration": 30,
    "progress": 45,
    "expectedEndTime": "2025-10-15T20:16:00.000Z",
    "error": null
  },
  "timestamp": "2025-10-15T20:15:45.000Z"
}
```

**Breaking Changes**:
- Field rename: `current` → `status`
- Added field: `queueLength` (REQUIRED)

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

**Available Actions**:
- Session: `session:create`, `session:pause`, `session:resume`, `session:end`
- Video: `video:play`, `video:pause`, `video:stop`, `video:skip`, `video:queue:add`, `video:queue:reorder`, `video:queue:clear`
- Score: `score:adjust`, `score:reset`
- Transaction: `transaction:delete`, `transaction:create`
- System: `system:reset`

**Response**: Server sends `gm:command:ack` with success/failure, then broadcasts side effects (e.g., video:status, score:updated).

#### scores:reset (Server → Clients)
Broadcast when all team scores are reset to zero (triggered by `score:reset` command).

```json
{
  "event": "scores:reset",
  "data": {
    "teamsReset": ["001", "002", "003"]
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

### Decision #5: video:status Fixed Structure
- Renamed: `current` → `status`
- Added: `queueLength` field (REQUIRED)

### Decision #7: session:update Full Resource
Send complete session object (not minimal delta).

### Decision #9: Player Scanner Fire-and-Forget
Player Scanner ignores response bodies (ESP32 compatibility).

### Decision #10: Error Display
User-facing errors via `error` event (no more console-only errors).

---

## Validation

### Schema Validation (ajv)

Per Test Architecture (Decision 1 from 06-test-architecture.md), all contracts validated with ajv.

**Setup** (coming in Phase 6):
```javascript
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const openapi = require('./openapi.yaml');
const asyncapi = require('./asyncapi.yaml');

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);

// Compile schemas
const validateSession = ajv.compile(openapi.components.schemas.Session);
const validateSyncFull = ajv.compile(asyncapi.components.messages.SyncFull.payload);

// Validate responses
const isValid = validateSession(response);
if (!isValid) console.error(validateSession.errors);
```

### Contract Tests

Per Test Architecture, proper test pyramid:
- **100+ unit tests**: Business logic
- **30-40 contract tests**: API compliance (ajv validation)
- **5-10 integration tests**: End-to-end flows

---

## Breaking Changes

See `MIGRATION-GUIDE.md` for comprehensive migration documentation.

### Critical Breaking Changes

1. **Field Renames**:
   - `scannerId` → `deviceId` (everywhere)
   - `sessionId` → `id` (within session resource)
   - `video:status.current` → `video:status.status`

2. **Added Required Fields**:
   - `video:status.queueLength` (REQUIRED)
   - `session.teams` array (target state)

3. **Wrapped Envelopes**:
   - `gm:identified` now wrapped
   - `video:status` now wrapped

4. **Transport Changes**:
   - Admin commands moved from HTTP POST to WebSocket `gm:command`

5. **Eliminated Events**:
   - `state:sync` (use `sync:full`)
   - `state:update` (use domain events)
   - `session:new/paused/resumed/ended` (use `session:update` with status)

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
2. Document breaking changes in MIGRATION-GUIDE.md
3. Update affected contract tests
4. Coordinate backend + scanner changes
5. Update examples in README

---

## Contract Principles

### ✅ DO

- Reference functional requirements (section numbers)
- Reference decisions (decision numbers)
- Use realistic examples (actual token IDs, team formats)
- Document breaking changes inline
- Specify target structure (what SHOULD exist)
- Include validation rules (patterns, enums, min/max)

### ❌ DON'T

- Make up fields not grounded in requirements
- Use fake examples (TEAM_A instead of "001")
- Omit required fields
- Document current broken behavior
- Create duplicate patterns

---

## Support

**Questions?** See documentation:
- Alignment Decisions: `docs/api-alignment/04-alignment-decisions.md`
- Functional Requirements: `docs/api-alignment/08-functional-requirements.md`
- Essential API List: `docs/api-alignment/09-essential-api-list.md`

**Validation Issues?** Check:
- Test Architecture: `docs/api-alignment/06-test-architecture.md`
- Test Analysis: `docs/api-alignment/05-test-analysis.md`

---

**Contract Version**: 1.0.0
**Last Updated**: 2025-09-30
**Phase**: 5 - Contract Formalization Complete
**Next Phase**: 6 - Create Refactor Plan
