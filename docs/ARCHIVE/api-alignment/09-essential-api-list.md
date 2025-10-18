# Definitive Essential API List

**Created**: 2025-09-30
**Status**: ✅ COMPLETE - Minimal Contract Scope Defined
**Purpose**: Define ONLY essential APIs needed for intended functionality (minimal architectural complexity)

---

## Document Purpose

This document defines the **minimal essential API surface** for the ALN system. This is the definitive contract scope - ONLY these APIs will be formalized in OpenAPI/AsyncAPI specifications.

**Design Principle**: Include ONLY what's necessary for intended functionality. Eliminate redundancy, over-engineering, and architectural confusion.

**Grounded In**:
- **08-functional-requirements.md** - What each component SHOULD do
- **04-alignment-decisions.md** - Target structure and conventions (12 decisions)
- **Investigation findings** - Verified implementation details
- **Minimal complexity principle** - Live event tool, not enterprise SaaS

---

## PART 1: ESSENTIAL HTTP ENDPOINTS

**Total: 8 endpoints** (down from 29 current)

---

### 1. POST /api/admin/auth

**Purpose**: Authenticate as admin, receive JWT token

**Functional Requirement**: Auth & Authorization (Section 1.1)

**Target Structure** (per Decision 3 - RESTful HTTP):
```yaml
Request:
  password: string (required)

Response (200 OK):
  token: string          # JWT token
  expiresIn: number      # Seconds (86400 = 24 hours)

Response (401 Unauthorized):
  error: string          # 'AUTH_REQUIRED'
  message: string        # 'Authentication failed'

Response (400 Bad Request):
  error: string          # 'VALIDATION_ERROR'
  message: string
```

**Why Essential**: Required for WebSocket handshake authentication (GM Scanner connection)

**Decision Reference**: Decision 3 (RESTful HTTP), Decision 12 (contracts location)

---

### 2. POST /api/scan

**Purpose**: Player Scanner single token scan (fire-and-forget)

**Functional Requirement**: Player Scanner Token Scanning (Section 2.1)

**Target Structure** (per Decision 3 - RESTful HTTP):
```yaml
Request:
  tokenId: string (required)
  teamId: string (optional, player scanner may not know team)
  deviceId: string (required, per Decision 4)
  timestamp: string (optional, ISO8601)

Response (200 OK):
  status: string         # 'accepted'
  message: string
  tokenId: string
  mediaAssets: object    # {video?, image?, audio?}
  videoQueued: boolean

Response (202 Accepted) - Offline mode:
  status: string         # 'queued'
  message: string
  tokenId: string
  offlineMode: boolean
  queuePosition: number

Response (409 Conflict) - Video already playing:
  status: string         # 'rejected'
  message: string
  tokenId: string
  waitTime: number       # Estimated seconds

Response (400 Bad Request):
  error: string          # 'VALIDATION_ERROR'
  message: string
  details: array
```

**Why Essential**: Core Player Scanner function (video triggering, scan logging)

**Decision Reference**:
- Decision 3 (RESTful HTTP)
- Decision 4 (deviceId field)
- Decision 9 (fire-and-forget pattern preserved)

**Note**: Player Scanner IGNORES response body (client-side decisions from tokens.json). Response provided for debugging and future non-ESP32 clients.

---

### 3. POST /api/scan/batch

**Purpose**: Player Scanner offline queue batch upload

**Functional Requirement**: Offline Queue Management (Section 1.8), Player Scanner Connection Management (Section 2.3)

**Target Structure** (per Decision 3 - RESTful HTTP):
```yaml
Request:
  transactions: array (required)
    - tokenId: string
      teamId: string (optional)
      deviceId: string (per Decision 4)
      timestamp: string (ISO8601)

Response (200 OK):
  results: array
    - tokenId: string
      status: string      # 'processed' | 'failed'
      videoQueued: boolean
      message: string (optional)
      error: string (optional, if failed)
```

**Why Essential**: Offline queue functionality (Player Scanner operates without orchestrator, syncs when reconnected)

**Decision Reference**:
- Decision 3 (RESTful HTTP)
- Decision 4 (deviceId field)
- Investigation finding (HTTP batch endpoint exists and essential)

---

### 4. GET /api/session

**Purpose**: Get current active session (one-time fetch)

**Functional Requirement**: Session Management (Section 1.2) - ONE session at a time

**Target Structure** (per Decision 3 - RESTful HTTP):
```yaml
Response (200 OK):
  id: string             # Per Decision 4 (use 'id' within resource)
  name: string
  startTime: string      # ISO8601
  endTime: string | null # ISO8601 or null if active
  status: string         # 'active' | 'paused' | 'ended'
  teams: array of strings
  metadata: object

Response (404 Not Found):
  error: string          # 'SESSION_NOT_FOUND'
  message: string
```

**Why Essential**: One-time session info fetch (primary session state comes via WebSocket sync:full)

**Decision Reference**:
- Decision 3 (RESTful HTTP)
- Decision 4 (id field within resource)
- Decision 7 (full session resource structure)
- Functional Requirements (ONE session at a time, no multi-session endpoints)

**Note**: Session commands (create/pause/resume/end) handled via WebSocket gm:command, NOT HTTP

---

### 5. GET /api/tokens

**Purpose**: Fetch token database (tokens.json)

**Functional Requirement**: Static Resource Serving (Section 1.9)

**Target Structure** (per Decision 3 - RESTful HTTP):
```yaml
Response (200 OK):
  tokens: object         # Map of tokenId -> token data
  count: number
  lastUpdate: string     # ISO8601
```

**Why Essential**: Scanners need token metadata (standalone mode requires local copy)

**Decision Reference**: Decision 3 (RESTful HTTP)

---

### 6. GET /api/state

**Purpose**: Get current game state (debugging/recovery, one-time fetch)

**Functional Requirement**: State Synchronization (Section 1.7) - debugging utility

**Target Structure** (per Decision 3 - RESTful HTTP):
```yaml
Response (200 OK):
  session: object | null      # Current session
  scores: array               # Team scores
  recentTransactions: array   # Last 100 transactions
  videoStatus: object         # Current video state
  devices: array              # Connected devices
  systemStatus: object        # Orchestrator/VLC health

Response (304 Not Modified) - ETag match:
  (empty body)
```

**Why Essential**: Debugging/recovery tool (primary state sync via WebSocket sync:full)

**Decision Reference**:
- Decision 3 (RESTful HTTP)
- Investigation finding (no polling detected, used for one-time fetch)

**Note**: NOT for polling (WebSocket provides real-time state). Includes ETag caching for efficiency.

---

### 7. GET /api/admin/logs

**Purpose**: Fetch recent error logs for troubleshooting

**Functional Requirement**: System Administration - Logging (Section 1.10.2)

**Target Structure** (per Decision 3 - RESTful HTTP):
```yaml
Query Parameters:
  lines: number (optional, default 100, max 500)
  level: string (optional, default 'error', values: 'error'|'warn'|'info')

Response (200 OK):
  logs: array of strings    # Last N log lines
  count: number
  timestamp: string         # ISO8601
```

**Why Essential**: Troubleshooting during live event (one-time fetch, not streaming)

**Decision Reference**: Decision 3 (RESTful HTTP)

**Note**: Logs are NOT real-time streaming (use HTTP GET for simplicity, not WebSocket)

---

### 8. GET /health

**Purpose**: Health check endpoint

**Functional Requirement**: Static Resource Serving (Section 1.9), System health metrics

**Target Structure** (per Decision 3 - RESTful HTTP):
```yaml
Response (200 OK):
  status: string          # 'online'
  version: string
  uptime: number          # Process uptime in seconds
  timestamp: string       # ISO8601
```

**Why Essential**: Connection health checks, standard pattern

**Decision Reference**: Decision 3 (RESTful HTTP)

---

## HTTP Endpoints Summary

| Endpoint | Method | Purpose | Component |
|----------|--------|---------|-----------|
| `/api/admin/auth` | POST | Admin authentication | Admin Panel |
| `/api/scan` | POST | Single token scan | Player Scanner |
| `/api/scan/batch` | POST | Offline queue batch | Player Scanner |
| `/api/session` | GET | Get current session | GM Scanner / Debug |
| `/api/tokens` | GET | Token database | All Scanners |
| `/api/state` | GET | Game state (debug) | Debug / Recovery |
| `/api/admin/logs` | GET | System logs | Admin Panel |
| `/health` | GET | Health check | All Clients |

**Total: 8 essential HTTP endpoints**

---

## PART 2: ESSENTIAL WEBSOCKET EVENTS

**Total: 16 events** (down from 30 current)

---

### Category: Authentication & Connection (4 events)

---

#### 1. gm:identify (Incoming)

**Purpose**: GM Scanner/Admin Panel authenticates WebSocket connection

**Functional Requirement**: Auth & Authorization (Section 1.1), WebSocket handshake

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Client sends:
  event: 'gm:identify'
  data:
    token: string          # JWT from POST /api/admin/auth
    deviceId: string       # Per Decision 4
    type: string           # 'gm' | 'admin'
    name: string           # Friendly device name
  timestamp: string        # ISO8601
```

**Why Essential**: Required for WebSocket authentication (establish GM Scanner session)

**Decision Reference**:
- Decision 2 (wrapped envelope)
- Decision 4 (deviceId field)

---

#### 2. gm:identified (Outgoing)

**Purpose**: Confirm GM Scanner authentication

**Functional Requirement**: Auth & Authorization (Section 1.1)

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Server sends:
  event: 'gm:identified'
  data:
    success: boolean
    deviceId: string
    sessionId: string | null   # Current session ID (null if none)
  timestamp: string
```

**Why Essential**: WebSocket handshake completion (client knows auth succeeded)

**Decision Reference**: Decision 2 (wrapped envelope)

**Note**: After this event, server sends sync:full with complete state

---

#### 3. device:connected (Outgoing)

**Purpose**: Broadcast when new device connects

**Functional Requirement**: Device Tracking (Section 1.6)

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Server broadcasts:
  event: 'device:connected'
  data:
    deviceId: string       # Per Decision 4
    type: string           # 'gm' | 'player'
    name: string
    ipAddress: string
    connectionTime: string # ISO8601
  timestamp: string
```

**Why Essential**: Admin panel monitoring (device list updates)

**Decision Reference**:
- Decision 2 (wrapped envelope)
- Decision 4 (deviceId field)
- Decision 8 (fix scanner bug - send object, not array)

---

#### 4. device:disconnected (Outgoing)

**Purpose**: Broadcast when device disconnects

**Functional Requirement**: Device Tracking (Section 1.6)

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Server broadcasts:
  event: 'device:disconnected'
  data:
    deviceId: string
    reason: string         # 'manual' | 'timeout' | 'error'
    disconnectionTime: string # ISO8601
  timestamp: string
```

**Why Essential**: Admin panel monitoring (device list updates)

**Decision Reference**: Decision 2 (wrapped envelope), Decision 4 (deviceId)

---

### Category: State Synchronization (1 event)

**Note**: state:update ELIMINATED per Decision 6, state:sync ELIMINATED as redundant with sync:full per investigation

---

#### 5. sync:full (Outgoing)

**Purpose**: Send complete system state (on connection, on request, after offline queue processing)

**Functional Requirement**: State Synchronization (Section 1.7)

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Server sends:
  event: 'sync:full'
  data:
    session: object | null      # Full session resource (per Decision 7)
      id: string
      name: string
      startTime: string
      endTime: string | null
      status: string
      teams: array
      metadata: object
    scores: array                # Team scores
      - teamId: string
        currentScore: number
        baseScore: number
        bonusPoints: number
        tokensScanned: number
        completedGroups: array
        lastUpdate: string
    recentTransactions: array    # Last 100 transactions
    videoStatus: object          # Current video state (per Decision 5)
      status: string
      queueLength: number
      tokenId: string | null
      duration: number | null
      progress: number | null
      expectedEndTime: string | null
    devices: array               # Connected devices
    systemStatus: object
      orchestrator: string       # 'online' | 'offline'
      vlc: string                # 'connected' | 'disconnected' | 'error'
  timestamp: string
```

**Why Essential**: Complete state sync on connection, replaces state:sync (richer payload, consolidates redundant events)

**Decision Reference**:
- Decision 2 (wrapped envelope)
- Decision 5 (video:status structure with queueLength)
- Decision 7 (full session resource)
- Investigation finding (consolidate state:sync into sync:full)

---

### Category: Transactions & Scoring (4 events)

---

#### 6. transaction:submit (Incoming)

**Purpose**: GM Scanner submits token scan for scoring

**Functional Requirement**: Transaction Processing (Section 1.3)

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Client sends:
  event: 'transaction:submit'
  data:
    tokenId: string        # Per Decision 4
    teamId: string
    deviceId: string       # Per Decision 4
    mode: string           # 'detective' | 'blackmarket'
  timestamp: string
```

**Why Essential**: Core game mechanic (GM Scanner submits transactions for scoring)

**Decision Reference**:
- Decision 2 (wrapped envelope)
- Decision 4 (tokenId, deviceId fields)

---

#### 7. transaction:result (Outgoing)

**Purpose**: Send transaction processing result to submitting device

**Functional Requirement**: Transaction Processing (Section 1.3)

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Server sends (to submitter only):
  event: 'transaction:result'
  data:
    status: string         # 'accepted' | 'duplicate' | 'error'
    transactionId: string  # Generated transaction ID
    tokenId: string
    teamId: string
    points: number         # Points awarded (0 if duplicate/error)
    message: string        # User-friendly message
    error: string | null   # Error code if status='error'
  timestamp: string
```

**Why Essential**: GM Scanner needs feedback on transaction submission

**Decision Reference**: Decision 2 (wrapped envelope)

---

#### 8. transaction:new (Outgoing)

**Purpose**: Broadcast new transaction to all GMs in session

**Functional Requirement**: Transaction Processing (Section 1.3), real-time broadcasting

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Server broadcasts (to session room):
  event: 'transaction:new'
  data:
    transaction:
      id: string           # Transaction ID
      tokenId: string      # Per Decision 4
      teamId: string
      deviceId: string     # Per Decision 4 - which scanner created it
      mode: string         # 'detective' | 'blackmarket'
      points: number
      timestamp: string    # ISO8601
      memoryType: string   # From token metadata
      valueRating: number  # From token metadata
      group: string        # From token metadata
  timestamp: string
```

**Why Essential**: All GMs see all transactions (real-time game state sync)

**Decision Reference**:
- Decision 2 (wrapped envelope)
- Decision 4 (tokenId, deviceId fields)

---

#### 9. score:updated (Outgoing)

**Purpose**: Broadcast team score update to all GMs

**Functional Requirement**: Score Management (Section 1.4)

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Server broadcasts (to session room):
  event: 'score:updated'
  data:
    teamId: string
    currentScore: number
    baseScore: number
    bonusPoints: number
    tokensScanned: number
    completedGroups: array of strings
    lastUpdate: string     # ISO8601
  timestamp: string
```

**Why Essential**: Real-time score updates (GMs see live leaderboard)

**Decision Reference**: Decision 2 (wrapped envelope)

---

### Category: Video Orchestration (1 event)

---

#### 10. video:status (Outgoing)

**Purpose**: Broadcast video playback status updates

**Functional Requirement**: Video Orchestration - State Broadcasting (Section 1.5.3)

**Target Structure** (per Decision 2 - Wrapped envelope, Decision 5 - fixed structure):
```yaml
Server broadcasts:
  event: 'video:status'
  data:
    status: string         # 'loading'|'playing'|'paused'|'completed'|'error'|'idle'
    queueLength: number    # Per Decision 5 - ADDED FIELD
    tokenId: string | null # Current video token (null if idle)
    duration: number | null # Video duration in seconds
    progress: number | null # 0-100 percentage
    expectedEndTime: string | null # ISO8601
    error: string | null   # Error message if status='error'
  timestamp: string
```

**Why Essential**: GMs monitor video playback (know when videos playing/queued)

**Decision Reference**:
- Decision 2 (wrapped envelope)
- Decision 5 (fixed structure, added queueLength field)

---

### Category: Session Management (1 event)

**Note**: Granular events (session:paused, session:resumed, session:ended) ELIMINATED per functional requirements - use single session:update with status field

---

#### 11. session:update (Outgoing)

**Purpose**: Broadcast session state changes (created/paused/resumed/ended)

**Functional Requirement**: Session Management (Section 1.2)

**Target Structure** (per Decision 2 - Wrapped envelope, Decision 7 - full resource):
```yaml
Server broadcasts:
  event: 'session:update'
  data:
    id: string             # Per Decision 4/7 (use 'id' within resource)
    name: string
    startTime: string      # ISO8601
    endTime: string | null # ISO8601 or null if active
    status: string         # 'active' | 'paused' | 'ended'
    teams: array of strings
    metadata: object
  timestamp: string
```

**Why Essential**: All GMs see session status changes (paused for technical issues, resumed, ended)

**Decision Reference**:
- Decision 2 (wrapped envelope)
- Decision 4 (id field)
- Decision 7 (full session resource, not minimal delta)
- Functional Requirements (eliminated granular session events)

---

### Category: Admin Commands (2 events)

---

#### 12. gm:command (Incoming)

**Purpose**: Admin Panel sends control commands (unified command interface)

**Functional Requirement**: Admin Panel Intervention Functions (Section 4.2)

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Client sends:
  event: 'gm:command'
  data:
    action: string         # Command type (see below)
    payload: object        # Action-specific parameters
  timestamp: string

Actions:
  # Session Control
  'session:create': { name: string, teams: array }
  'session:pause': {}
  'session:resume': {}
  'session:end': {}

  # Video Control
  'video:play': { tokenId: string }
  'video:pause': {}
  'video:stop': {}
  'video:skip': {}
  'video:queue:add': { tokenId: string, position?: number }
  'video:queue:reorder': { fromIndex: number, toIndex: number }
  'video:queue:clear': {}

  # Score Control
  'score:adjust': { teamId: string, delta: number, reason?: string }

  # Transaction Control
  'transaction:delete': { transactionId: string }
  'transaction:create': { tokenId: string, teamId: string, mode: string }

  # System Control
  'system:reset': {}  # Full nuclear option
```

**Why Essential**: All admin intervention commands unified (replaces 11 HTTP admin endpoints)

**Decision Reference**:
- Decision 2 (wrapped envelope)
- Functional Requirements Section 4.2 (admin commands via WebSocket)
- Investigation finding (admin HTTP endpoints architectural confusion)

**Note**: This single event replaces ALL admin HTTP POST endpoints (except /api/admin/auth which must be HTTP for JWT issuance)

---

#### 13. gm:command:ack (Outgoing)

**Purpose**: Acknowledge admin command execution

**Functional Requirement**: Admin Panel command feedback

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Server sends (to command sender):
  event: 'gm:command:ack'
  data:
    action: string         # Original action
    success: boolean
    message: string        # Result message
    error: string | null   # Error code if failed
    result: object | null  # Action-specific result data
  timestamp: string
```

**Why Essential**: Admin panel needs command feedback (success/failure)

**Decision Reference**: Decision 2 (wrapped envelope)

---

### Category: Offline Queue (1 event)

---

#### 14. offline:queue:processed (Outgoing)

**Purpose**: Notify clients when offline queue has been processed

**Functional Requirement**: Offline Queue Management (Section 1.8)

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Server broadcasts:
  event: 'offline:queue:processed'
  data:
    queueSize: number      # Number of items processed
    results: array
      - transactionId: string
        status: string     # 'processed' | 'failed'
        error: string | null
  timestamp: string
```

**Why Essential**: GM Scanners know when queued transactions have been processed

**Decision Reference**: Decision 2 (wrapped envelope)

**Note**: Followed by sync:full broadcast to update all clients with new state

---

### Category: Group Completion Bonus (1 event)

---

#### 15. group:completed (Outgoing)

**Purpose**: Broadcast when team completes token group (bonus points)

**Functional Requirement**: Transaction Processing - Group Completion (Section 1.3.6)

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Server broadcasts:
  event: 'group:completed'
  data:
    teamId: string
    group: string          # Group name
    bonusPoints: number    # Bonus awarded
    completedAt: string    # ISO8601
  timestamp: string
```

**Why Essential**: Important game event (group completion bonuses are major scoring moments)

**Decision Reference**: Decision 2 (wrapped envelope)

---

### Category: Errors (1 event)

---

#### 16. error (Outgoing)

**Purpose**: Send error notifications to clients

**Functional Requirement**: Error Handling (Section 5), Decision 10 (error display)

**Target Structure** (per Decision 2 - Wrapped envelope):
```yaml
Server sends:
  event: 'error'
  data:
    code: string           # Error code ('AUTH_REQUIRED', 'PERMISSION_DENIED', etc.)
    message: string        # User-friendly error message
    details: object | null # Optional error details
  timestamp: string
```

**Why Essential**: User-facing error display (per Decision 10 - no more console-only errors)

**Decision Reference**:
- Decision 2 (wrapped envelope)
- Decision 10 (add error display to all scanners)

---

## WebSocket Events Summary

| Event | Direction | Purpose | Component |
|-------|-----------|---------|-----------|
| **Authentication & Connection** |
| `gm:identify` | Incoming | Authenticate WebSocket | GM Scanner |
| `gm:identified` | Outgoing | Confirm authentication | Orchestrator |
| `device:connected` | Outgoing | Device connection broadcast | Admin Panel |
| `device:disconnected` | Outgoing | Device disconnection broadcast | Admin Panel |
| **State Synchronization** |
| `sync:full` | Outgoing | Complete state sync | All GMs |
| **Transactions & Scoring** |
| `transaction:submit` | Incoming | Submit token scan | GM Scanner |
| `transaction:result` | Outgoing | Transaction result | GM Scanner |
| `transaction:new` | Outgoing | Transaction broadcast | All GMs |
| `score:updated` | Outgoing | Score update broadcast | All GMs |
| **Video Orchestration** |
| `video:status` | Outgoing | Video status broadcast | All GMs |
| **Session Management** |
| `session:update` | Outgoing | Session state change | All GMs |
| **Admin Commands** |
| `gm:command` | Incoming | Admin control commands | Admin Panel |
| `gm:command:ack` | Outgoing | Command acknowledgment | Admin Panel |
| **Offline Queue** |
| `offline:queue:processed` | Outgoing | Queue processing complete | All GMs |
| **Group Completion** |
| `group:completed` | Outgoing | Group bonus broadcast | All GMs |
| **Errors** |
| `error` | Outgoing | Error notifications | All Clients |

**Total: 16 essential WebSocket events** (5 incoming, 11 outgoing)

---

## PART 3: ELIMINATED APIS

**Documenting what we're NOT including in contracts (and why)**

---

### Eliminated HTTP Endpoints (21 endpoints removed)

---

#### Multi-Session Endpoints (4 eliminated)

**Eliminated:**
- `GET /api/session/:id` - Get session by ID
- `PUT /api/session/:id` - Update session by ID
- `GET /api/admin/sessions` - List all sessions
- `DELETE /api/admin/session/:id` - Delete session

**Why**: ONE session at a time (functional requirements Section 1.2). No multi-session management needed.

**Replacement**:
- Current session: `GET /api/session`
- Session commands: WebSocket `gm:command` (session:create, session:pause, etc.)

---

#### Session Lifecycle HTTP Endpoints (2 eliminated)

**Eliminated:**
- `POST /api/session` - Create new session (HTTP)
- `PUT /api/session` - Update current session (HTTP)

**Why**: Session commands should use WebSocket (admin panel shares GM Scanner connection)

**Replacement**: WebSocket `gm:command` with actions:
- `session:create`
- `session:pause`
- `session:resume`
- `session:end`

---

#### Transaction HTTP Endpoints (4 eliminated)

**Eliminated:**
- `POST /api/transaction/submit` - Submit transaction (HTTP)
- `GET /api/transaction/history` - Get transaction history (HTTP)
- `GET /api/transaction/:id` - Get specific transaction (HTTP)
- `DELETE /api/transaction/:id` - Delete transaction (HTTP)

**Why**:
- Transactions are real-time game logic (WebSocket, not HTTP)
- Transaction history comes via WebSocket sync:full
- Transaction deletion is admin intervention (WebSocket gm:command)

**Replacement**:
- Submit: WebSocket `transaction:submit` event
- History: Included in `sync:full` event (last 100 transactions)
- Delete: WebSocket `gm:command` with action `transaction:delete`
- Query specific: Admin can query via full state (transactions included in sync:full)

---

#### Video Control HTTP Endpoint (1 eliminated)

**Eliminated:**
- `POST /api/video/control` - Control video playback (HTTP)

**Why**: Admin commands via WebSocket (admin panel shares GM Scanner connection)

**Replacement**: WebSocket `gm:command` with actions:
- `video:play`
- `video:pause`
- `video:stop`
- `video:skip`
- `video:queue:add`
- `video:queue:reorder`
- `video:queue:clear`

---

#### Admin HTTP Endpoints (9 eliminated)

**Eliminated:**
- `POST /api/admin/reset-scores` - Reset scores
- `POST /api/admin/clear-transactions` - Clear transactions
- `POST /api/admin/stop-all-videos` - Stop videos
- `POST /api/admin/offline-mode` - Toggle offline mode
- `GET /api/admin/devices` - List devices
- `POST /api/admin/reset` - System reset
- `POST /api/admin/config` - Update configuration

**Why**:
- Wrong transport (admin commands should be WebSocket)
- Architectural confusion (HTTP POST for real-time admin operations)
- Some don't make sense (offline mode toggle for networked orchestrator)
- Some are over-engineering (runtime config changes)

**Replacement**:
- Reset scores: `gm:command` → `score:adjust` (or `system:reset` for full reset)
- Clear transactions: `gm:command` → `system:reset` (full nuclear option)
- Stop videos: `gm:command` → `video:stop` + `video:queue:clear`
- Offline mode toggle: ELIMINATED (doesn't make sense for orchestrator)
- List devices: Included in `sync:full` event
- System reset: `gm:command` → `system:reset`
- Config: ELIMINATED (config is pre-event only, not runtime)

**Investigation Finding**: `/api/admin/reset-scores` currently exists but is incomplete (only resets scores, not full system reset per requirements)

---

#### Documentation Endpoints (2 kept but not in core contract)

**Not Eliminated, but Utility (not game logic):**
- `GET /api/docs` - OpenAPI spec
- `GET /api-docs` - Swagger UI

**Why Keep**: Auto-generated from contracts, useful for development. Not game logic, won't be in core OpenAPI spec.

---

#### Status Endpoint (1 merged)

**Eliminated:**
- `GET /api/status` - Get orchestrator status

**Why**: Redundant with `/health` endpoint and system status included in `sync:full`

**Replacement**:
- Basic health: `GET /health`
- Full status: `sync:full` event includes systemStatus object

---

### Eliminated WebSocket Events (14 events removed)

---

#### Redundant State Sync Events (2 eliminated)

**Eliminated:**
- `state:sync` - Current state sync
- `state:update` - State delta updates

**Why**:
- `state:sync`: Redundant with `sync:full` (sync:full is richer payload, consolidate to one event)
- `state:update`: CRITICAL MISMATCH (Decision 6) - backend sends full state, scanner expects delta. Contract violation. Already covered by specific domain events (transaction:new, score:updated, etc.)

**Replacement**: `sync:full` handles all state synchronization

**Investigation Finding**: Both events exist, overlapping use cases, architectural confusion

---

#### Granular Session Events (4 eliminated)

**Eliminated:**
- `session:new` - New session created
- `session:paused` - Session paused
- `session:resumed` - Session resumed
- `session:ended` - Session ended

**Why**: Over-engineered (functional requirements - use single `session:update` with status field)

**Replacement**: Single `session:update` event with status: 'active'|'paused'|'ended'

---

#### Specific Admin Events (2 eliminated)

**Eliminated:**
- `video:skipped` - Video skipped by GM
- `scores:reset` - Scores reset by GM

**Why**: Redundant with `gm:command:ack` + follow-up state events

**Flow:**
- Admin sends `gm:command` → `video:skip`
- Server sends `gm:command:ack` → {success: true}
- Server broadcasts `video:status` → {status: 'idle', queueLength: 2} (side effect)

Same for scores:
- Admin sends `gm:command` → `system:reset`
- Server sends `gm:command:ack` → {success: true}
- Server broadcasts `score:updated` for each team (side effect)

**Replacement**: Command acknowledgment + domain events

---

#### Heartbeat Events (2 eliminated)

**Eliminated:**
- `heartbeat` (incoming) - GM station heartbeat
- `heartbeat:ack` (outgoing) - Heartbeat acknowledgment

**Why**: WebSocket connection has built-in ping/pong mechanism. Application-level heartbeat is over-engineering.

**Replacement**: Socket.IO built-in ping/pong (connection monitoring)

---

#### Redundant Request Events (2 eliminated)

**Eliminated:**
- `sync:request` - Request full state sync
- `state:request` - Request current state

**Why**:
- `sync:full` sent automatically on connection (no need to request)
- If client needs refresh, can reconnect (triggers automatic sync:full)
- Over-engineering (another event for same functionality)

**Replacement**: Automatic `sync:full` on connection

---

#### Unused Event (1 eliminated)

**Eliminated:**
- `team:created` - New team created

**Why**: Teams defined at session creation (not created dynamically during game)

**Replacement**: None needed (teams in session:update event)

---

#### Disconnect Event (1 eliminated)

**Eliminated:**
- `disconnect` (incoming) - Socket disconnection

**Why**: Socket.IO built-in event (not application event)

**Replacement**: Socket.IO native `disconnect` event handler (not in AsyncAPI contract)

---

## Elimination Summary

| Category | Current | Essential | Eliminated |
|----------|---------|-----------|------------|
| **HTTP Endpoints** | 29 | 8 | 21 |
| **WebSocket Events** | 30 | 16 | 14 |
| **Total APIs** | 59 | 24 | 35 |

**Reduction: 59 → 24 APIs (59% reduction)**

**Minimal architectural complexity achieved.**

---

## PART 4: DESIGN DECISIONS APPLIED

**How the 12 alignment decisions shaped this essential API list:**

---

### Decision 1: Contract-First Approach
**Applied**: This document defines contract scope. Next step: formalize in OpenAPI 3.1 + AsyncAPI 2.6

---

### Decision 2: Wrapped WebSocket Envelope
**Applied**: All 16 WebSocket events use `{event, data, timestamp}` structure

---

### Decision 3: RESTful HTTP
**Applied**: All 8 HTTP endpoints return direct resources/results, HTTP codes communicate status

---

### Decision 4: Field Naming
**Applied**:
- `deviceId` everywhere (not scannerId/stationId)
- `tokenId` everywhere (not rfid/videoId)
- `id` within session resource (not sessionId)

---

### Decision 5: video:status Fixed Structure
**Applied**: `video:status` event includes `queueLength` field, uses `status` (not `current`)

---

### Decision 6: Eliminate state:update
**Applied**: `state:update` NOT in essential list (redundant, contract violation)

---

### Decision 7: session:update Full Resource
**Applied**: `session:update` event sends complete session object (matches GET /api/session structure)

---

### Decision 8: Fix device Events
**Applied**: `device:connected`/`disconnected` send single device object (not array)

---

### Decision 9: Player Scanner Fire-and-Forget
**Applied**: POST /api/scan includes note that Player Scanner ignores response body

---

### Decision 10: Error Display
**Applied**: `error` event included for user-facing error notifications

---

### Decision 11: Minor Fixes
**Applied**: Validations, dead code removal will happen during implementation (not contract design concern)

---

### Decision 12: Contracts Location
**Applied**: These essential APIs will be formalized in `backend/contracts/openapi.yaml` and `backend/contracts/asyncapi.yaml`

---

## PART 5: FUNCTIONAL REQUIREMENTS MAPPING

**How functional requirements shaped this essential API list:**

---

### Orchestrator (10 functional areas → APIs)

1. **Auth & Authorization** → POST /api/admin/auth, gm:identify, gm:identified
2. **Session Management** → GET /api/session, session:update, gm:command (session actions)
3. **Transaction Processing** → transaction:submit, transaction:result, transaction:new
4. **Score Management** → score:updated, gm:command (score:adjust)
5. **Video Orchestration** → video:status, gm:command (video actions)
6. **Device Tracking** → device:connected, device:disconnected (in sync:full)
7. **State Synchronization** → sync:full
8. **Offline Queue** → POST /api/scan/batch, offline:queue:processed
9. **Static Resources** → GET /api/tokens, GET /health
10. **System Administration** → GET /api/admin/logs, gm:command (system:reset)

---

### Player Scanner (3 functional areas → APIs)

1. **Token Scanning** → POST /api/scan
2. **Local Media Display** → GET /api/tokens
3. **Connection Management** → GET /health, POST /api/scan/batch

---

### GM Scanner (4 functional areas → APIs)

1. **Token Scanning** → transaction:submit, transaction:result
2. **Real-Time State Display** → sync:full, transaction:new, score:updated, video:status, session:update
3. **Mode Selection** → (client-side, sent in transaction:submit)
4. **Offline Capability** → offline:queue:processed

---

### Admin Panel (2 functional areas → APIs)

1. **Monitoring** → sync:full, transaction:new, score:updated, video:status, session:update, device:connected/disconnected
2. **Intervention** → gm:command (all admin actions), gm:command:ack

---

### Cross-Cutting Concerns

- **Error Handling** → error event
- **Group Completion** → group:completed
- **Network Resilience** → Built into patterns (offline queue, sync:full on reconnect)

---

## Document Status

**Phase 4.9 Complete**: Definitive minimal API list created

**Next Phase**: Phase 5 - Formalize these 24 APIs in OpenAPI 3.1 and AsyncAPI 2.6 specifications

**Contract Scope Locked**:
- 8 HTTP endpoints
- 16 WebSocket events
- 24 total APIs (minimal essential surface)

---

*This document is the authoritative contract scope. Phase 5 will formalize these exact APIs with full OpenAPI/AsyncAPI specifications.*
