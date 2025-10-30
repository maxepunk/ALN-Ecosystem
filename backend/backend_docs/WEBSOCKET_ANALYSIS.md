# WebSocket Event Flows and State Synchronization - Deep Analysis

## Executive Summary

This document provides a comprehensive analysis of the ALN Orchestrator's WebSocket communication patterns for end-to-end testing. The system uses a **contract-first architecture with wrapped event envelopes**, **event-driven service coordination**, and **session-based state synchronization**. All WebSocket interactions follow the AsyncAPI contract defined in `backend/contracts/asyncapi.yaml`.

---

## 1. AUTHENTICATION & CONNECTION FLOW

### 1.1 Complete Authentication Flow

```
STEP 1: HTTP Authentication
┌─────────────────────────────────────────────────────────┐
│ Client POST /api/admin/auth                             │
│ { password: "admin-secret" }                             │
│                                                          │
│ Backend response: { token: "eyJh...", expiresIn: 86400 } │
└─────────────────────────────────────────────────────────┘
        │
        ▼
STEP 2: WebSocket Connection with Handshake Auth
┌─────────────────────────────────────────────────────────┐
│ Client connects with auth in handshake.auth:             │
│ {                                                        │
│   token: "eyJh...",        // JWT from Step 1           │
│   deviceId: "GM_Station_1", // Unique device ID          │
│   deviceType: "gm",         // "gm" or "admin"           │
│   version: "1.0.0"          // Optional                   │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
        │
        ▼
STEP 3: Server Handshake Validation (Middleware)
┌─────────────────────────────────────────────────────────┐
│ Socket.io middleware validates auth (socketAuth.js)      │
│ - Checks JWT signature                                   │
│ - Verifies token not expired (24h max)                   │
│ - Validates deviceId format                              │
│ - Validates deviceType in ['gm', 'admin']                │
│                                                          │
│ FAILURE: Connection rejected → client receives           │
│          connect_error (transport-level, not app event)  │
│ SUCCESS: Connection accepted → proceed to Step 4         │
└─────────────────────────────────────────────────────────┘
        │
        ▼
STEP 4: Auto-Identification & Device Registration
┌─────────────────────────────────────────────────────────┐
│ Server.js (line 68-74) calls handleGmIdentify()         │
│ - Extracts deviceId, version, token from handshake      │
│ - Creates DeviceConnection model                         │
│ - Registers device in current session                    │
│ - Stores auth info on socket object                      │
│ - Joins 'gm-stations' room for broadcasts                │
└─────────────────────────────────────────────────────────┘
        │
        ▼
STEP 5: Broadcast Device Connection
┌─────────────────────────────────────────────────────────┐
│ broadcasts.js listens to sessionService 'device:updated' │
│ event with isNew=true                                    │
│                                                          │
│ Broadcasts to OTHER connected clients:                   │
│ {                                                        │
│   event: 'device:connected',                             │
│   data: {                                                │
│     deviceId: "GM_Station_1",                            │
│     type: "gm",                                          │
│     name: "GM Station v1.0.0",                           │
│     ipAddress: "10.0.0.82",                              │
│     connectionTime: "2025-10-15T19:05:00.000Z"           │
│   },                                                     │
│   timestamp: "2025-10-15T19:05:00.000Z"                  │
│ }                                                        │
│                                                          │
│ NOTE: New device does NOT receive this event about itself│
└─────────────────────────────────────────────────────────┘
        │
        ▼
STEP 6: Auto-Sync on Connection (CRITICAL)
┌─────────────────────────────────────────────────────────┐
│ Server immediately sends sync:full event to new device:  │
│ {                                                        │
│   event: 'sync:full',                                    │
│   data: {                                                │
│     session: { ... },      // Full session if exists     │
│     scores: [ ... ],        // All team scores            │
│     recentTransactions: [ ], // Last 100 transactions     │
│     videoStatus: { ... },   // Current video state        │
│     devices: [ ... ],       // Connected devices          │
│     systemStatus: { ... }   // Orchestrator & VLC status  │
│   },                                                     │
│   timestamp: "2025-10-15T19:05:00.200Z"                  │
│ }                                                        │
│                                                          │
│ Per AsyncAPI: This is AUTOMATIC, not request-based       │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Key Authentication Files

| File | Responsibility |
|------|-----------------|
| `backend/src/middleware/auth.js` | JWT generation, verification, token management |
| `backend/src/middleware/socketAuth.js` | Socket.io handshake middleware validation |
| `backend/src/server.js:40-79` | WebSocket connection handler, pre-auth logic |
| `backend/src/websocket/gmAuth.js:21-164` | Device identification and sync:full sending |

### 1.3 Authentication Failure Scenarios

**Scenario 1: Missing or Malformed JWT**
```javascript
// Client connects without token
io.connect('http://orchestrator:3000', {
  auth: {
    deviceId: "GM_Station_1",
    deviceType: "gm"
    // NO token field
  }
})

// Result: Connection rejected at handshake
// Client receives: connect_error event (transport-level)
// No application-level error event sent
```

**Scenario 2: Expired JWT (>24 hours old)**
```javascript
// Backend verifyToken() returns null
// Socket.io rejects connection
// Client cannot proceed to Step 4 (auto-identification)
```

**Scenario 3: Invalid deviceType**
```javascript
// deviceType not in ['gm', 'admin']
// Socket.io rejects connection at handshake validation
```

---

## 2. EVENT CATALOG

### 2.1 All WebSocket Events by Category

#### SERVER-TO-CLIENT EVENTS (Broadcasts from Orchestrator)

| Event | Trigger | Recipient | Payload Structure | Contract Link |
|-------|---------|-----------|-------------------|----------------|
| **device:connected** | Device handshake + registration | All OTHER clients | `{ deviceId, type, name, ipAddress, connectionTime }` | AsyncAPI:109-180 |
| **device:disconnected** | Device closes socket | All clients | `{ deviceId, type, disconnectionTime, reason }` | AsyncAPI:182-227 |
| **sync:full** | Auto on connection, after offline queue, after admin commands | Single client (sender) | Session, scores, transactions, video, devices, system status | AsyncAPI:233-538 |
| **session:update** | session:created or session:updated domain event | All clients | `{ id, name, startTime, endTime, status, teams, metadata }` | AsyncAPI:957-1051 |
| **transaction:result** | Transaction processing complete | Submitting device only | `{ status, transactionId, tokenId, teamId, points, message, error }` | AsyncAPI:603-673 |
| **transaction:new** | Transaction added to session | All GMs in gm-stations room | `{ transaction: { id, tokenId, teamId, deviceId, mode, points, timestamp, memoryType, valueRating, group } }` | AsyncAPI:675-764 |
| **score:updated** | Team score recalculated | All GMs in gm-stations room | `{ teamId, currentScore, baseScore, bonusPoints, tokensScanned, completedGroups, adminAdjustments, lastUpdate }` | AsyncAPI:766-865 |
| **video:status** | Video playback state change | All GMs in gm-stations room | `{ status, queueLength, tokenId, duration, progress, expectedEndTime, error }` | AsyncAPI:871-951 |
| **video:progress** | Emitted every 1s during playback | All GMs in gm-stations room | `{ tokenId, progress, position, duration }` | Internal (broadcasts.js:324-335) |
| **video:queue:update** | Queue add/clear/complete | All GMs in gm-stations room | `{ items: [], length: 0 }` | Internal (broadcasts.js:338-355) |
| **group:completed** | Token group bonus earned | All GMs in gm-stations room | `{ teamId, group, bonusPoints, completedAt }` | AsyncAPI:1287-1339 |
| **offline:queue:processed** | Offline queue sync complete | All GMs in gm-stations room | `{ queueSize, results: [{ transactionId, status, error }] }` | AsyncAPI:1216-1281 |
| **gm:command:ack** | Admin command executed | Command sender only | `{ action, success, message, error, result }` | AsyncAPI:1151-1210 |
| **error** | Any error condition | Relevant client(s) | `{ code, message, details }` | AsyncAPI:1345-1402 |
| **gm:identified** | Device identification complete | Single device | `{ success, deviceId, sessionId, state }` | Internal (gmAuth.js:141-146) |
| **heartbeat:ack** | Heartbeat received | Single device | `{}` (empty) | Internal (gmAuth.js:196-197) |

#### CLIENT-TO-SERVER EVENTS (Commands to Orchestrator)

| Event | Sender | Handler | Payload Structure | Contract Link |
|-------|--------|---------|-------------------|----------------|
| **transaction:submit** | GM Scanner | handleTransactionSubmit | `{ tokenId, teamId, deviceId, mode }` | AsyncAPI:544-601 |
| **gm:command** | Admin/GM Station | handleGmCommand | `{ action, payload }` (11 actions) | AsyncAPI:1057-1149 |
| **sync:request** | Any client | handleSyncRequest | Empty | Internal |
| **state:request** | Any client | handleStateRequest | Empty | Internal |
| **heartbeat** | GM Scanner | handleHeartbeat | `{ stationId }` | Internal |
| **gm:identify** | GM Scanner (legacy) | handleGmIdentify | `{ deviceId, version, token }` | Internal (auto-called now) |

### 2.2 Event Envelope Structure (ALL events follow this)

**Server → Client:**
```javascript
{
  event: "event:name",
  data: {
    // Event-specific payload per AsyncAPI schema
  },
  timestamp: "2025-10-15T19:05:00.000Z"  // ISO 8601 UTC
}
```

**Client → Server:**
```javascript
{
  event: "event:name",
  data: {
    // Event-specific payload per AsyncAPI schema
  },
  timestamp: "2025-10-15T19:05:00.000Z"  // ISO 8601 UTC
}
```

---

## 3. CRITICAL EVENT SEQUENCES

### 3.1 GM Scan → Transaction Flow (Most Common)

```
SEQUENCE: GM Scanner scans token (e.g., "534e2b03") with team "001"

TIME: T+0s
┌─────────────────────────────────────────────────────────┐
│ 1. Client sends: transaction:submit                      │
│ {                                                        │
│   event: "transaction:submit",                           │
│   data: {                                                │
│     tokenId: "534e2b03",                                 │
│     teamId: "001",                                       │
│     deviceId: "GM_Station_1",                            │
│     mode: "blackmarket"                                  │
│   },                                                     │
│   timestamp: "2025-10-15T20:15:30.000Z"                  │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
        │
        ▼ [Server processes transaction:submit]
        │
TIME: T+10ms
┌─────────────────────────────────────────────────────────┐
│ 2a. adminEvents.js:handleTransactionSubmit() executes   │
│     - Validates transaction data                        │
│     - Calls transactionService.processScan()            │
│     - Returns TransactionResult structure                │
│                                                          │
│ 2b. Sends transaction:result to SUBMITTING DEVICE ONLY: │
│ {                                                        │
│   event: "transaction:result",                           │
│   data: {                                                │
│     status: "accepted",  // or "duplicate" or "error"   │
│     transactionId: "7b8b1d85-b234-4be9-...",            │
│     tokenId: "534e2b03",                                │
│     teamId: "001",                                       │
│     points: 3000,                                       │
│     message: "Transaction accepted - 3000 points awarded", │
│     error: null                                          │
│   },                                                     │
│   timestamp: "2025-10-15T20:15:30.100Z"                  │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
        │
        ▼ [Service events trigger broadcasts]
        │
TIME: T+15ms
┌─────────────────────────────────────────────────────────┐
│ 3. transactionService emits 'transaction:added' event    │
│    (Domain event - unwrapped, internal only)             │
│                                                          │
│ 4. broadcasts.js listener receives 'transaction:added'   │
│    and broadcasts transaction:new to ALL GMs:            │
│ {                                                        │
│   event: "transaction:new",                              │
│   data: {                                                │
│     transaction: {                                       │
│       id: "7b8b1d85-b234-4be9-...",                      │
│       tokenId: "534e2b03",                               │
│       teamId: "001",                                     │
│       deviceId: "GM_Station_1",                          │
│       mode: "blackmarket",                               │
│       points: 3000,                                      │
│       timestamp: "2025-10-15T20:15:30.000Z",             │
│       memoryType: "Technical",   // From tokens.json    │
│       valueRating: 3,             // From tokens.json    │
│       group: "jaw_group",         // From tokens.json    │
│       isUnknown: false                                   │
│     }                                                    │
│   },                                                     │
│   timestamp: "2025-10-15T20:15:30.100Z"                  │
│ }                                                        │
│                                                          │
│ BROADCAST TARGET: ALL sockets in 'gm-stations' room     │
│ (via emitToRoom(io, 'session:${sessionId}', ...))        │
└─────────────────────────────────────────────────────────┘
        │
        ▼ [Score update triggered]
        │
TIME: T+20ms
┌─────────────────────────────────────────────────────────┐
│ 5. transactionService emits 'score:updated' event       │
│    (Domain event - unwrapped, internal only)             │
│                                                          │
│ 6. broadcasts.js listener receives 'score:updated'       │
│    and broadcasts to ALL GMs in 'gm-stations' room:      │
│ {                                                        │
│   event: "score:updated",                                │
│   data: {                                                │
│     teamId: "001",                                       │
│     currentScore: 11500,      // baseScore + bonus      │
│     baseScore: 11000,                                    │
│     bonusPoints: 500,                                    │
│     tokensScanned: 8,                                    │
│     completedGroups: ["jaw_group"],                      │
│     adminAdjustments: [],                                │
│     lastUpdate: "2025-10-15T20:15:30.000Z"               │
│   },                                                     │
│   timestamp: "2025-10-15T20:15:30.120Z"                  │
│ }                                                        │
│                                                          │
│ NOTE: If team completes a group, emits group:completed   │
└─────────────────────────────────────────────────────────┘
        │
        ▼ [Optional: Video queueing if token has video]
        │
TIME: T+25ms
┌─────────────────────────────────────────────────────────┐
│ 7. If token contains video field, scanRoutes.js          │
│    queues video in videoQueueService                     │
│                                                          │
│ 8. videoQueueService emits 'video:loading' event         │
│    broadcasts.js broadcasts to 'gm-stations':            │
│ {                                                        │
│   event: "video:status",                                 │
│   data: {                                                │
│     status: "loading",                                   │
│     tokenId: "534e2b03",                                 │
│     queueLength: 1                                       │
│   },                                                     │
│   timestamp: "2025-10-15T20:15:30.150Z"                  │
│ }                                                        │
└─────────────────────────────────────────────────────────┘

SUMMARY:
- T+0ms:   Client sends transaction:submit
- T+10ms:  Server sends transaction:result to submitter
- T+15ms:  Server broadcasts transaction:new to ALL GMs
- T+20ms:  Server broadcasts score:updated to ALL GMs
- T+25ms:  (Optional) Server broadcasts video:status to ALL GMs

TOTAL LATENCY: 25ms typical (all events complete before next scan)
```

### 3.2 Session Lifecycle → Broadcasts

```
SCENARIO: Admin creates new session via gm:command

TIME: T+0s
┌─────────────────────────────────────────────────────────┐
│ 1. Admin sends: gm:command                              │
│ {                                                        │
│   event: "gm:command",                                   │
│   data: {                                                │
│     action: "session:create",                            │
│     payload: {                                           │
│       name: "About Last Night - Oct 15 2025",           │
│       teams: ["001", "002", "003"]                       │
│     }                                                    │
│   },                                                     │
│   timestamp: "2025-10-15T19:00:00.000Z"                  │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
        │
        ▼ [handleGmCommand processes]
        │
TIME: T+5ms
┌─────────────────────────────────────────────────────────┐
│ 2. sessionService.createSession() called                 │
│    - Creates new Session model                          │
│    - Saves to disk                                       │
│    - Emits 'session:created' event (domain event)        │
└─────────────────────────────────────────────────────────┘
        │
        ▼ [Broadcast listeners triggered]
        │
TIME: T+10ms
┌─────────────────────────────────────────────────────────┐
│ 3. broadcasts.js 'session:created' listener triggers:    │
│                                                          │
│    3a. Broadcasts session:update to ALL clients:        │
│    {                                                    │
│      event: "session:update",                            │
│      data: {                                             │
│        id: "2a2f9d45-5d2d-441d-b32c-52c939f3c103",       │
│        name: "About Last Night - Oct 15 2025",          │
│        startTime: "2025-10-15T19:00:00.000Z",            │
│        endTime: null,                                    │
│        status: "active",                                │
│        teams: ["001", "002", "003"],                    │
│        metadata: { gmStations: 2, ... }                 │
│      },                                                 │
│      timestamp: "2025-10-15T19:00:00.100Z"              │
│    }                                                    │
│                                                          │
│    3b. Calls initializeSessionDevices()                 │
│         - Adds all pre-connected devices to session      │
│         - Joins sockets to session:${sessionId} room     │
│         - Each device now receives transaction:new,      │
│           score:updated, video:status for this session   │
└─────────────────────────────────────────────────────────┘
        │
        ▼ [Command acknowledgment sent]
        │
TIME: T+12ms
┌─────────────────────────────────────────────────────────┐
│ 4. Server sends gm:command:ack to SENDER ONLY:          │
│ {                                                        │
│   event: "gm:command:ack",                               │
│   data: {                                                │
│     action: "session:create",                            │
│     success: true,                                       │
│     message: "Session "About Last Night - Oct 15 2025" created successfully" │
│   },                                                     │
│   timestamp: "2025-10-15T19:00:00.120Z"                  │
│ }                                                        │
└─────────────────────────────────────────────────────────┘

BROADCAST FLOW:
  Domain Event (service)
  ↓
  stateService listener
  ↓
  broadcasts.js wraps event
  ↓
  io.emit() or io.to(room).emit()
  ↓
  All affected clients receive wrapped event
```

### 3.3 Offline Queue Processing → Full Resync

```
SCENARIO: Player scanner reconnects after offline period

TIME: T+0s
┌─────────────────────────────────────────────────────────┐
│ 1. Player Scanner comes online                          │
│    - Uploads queued scans via HTTP POST /api/scan/batch  │
│    - Backend receives array of offline transactions      │
└─────────────────────────────────────────────────────────┘
        │
        ▼
TIME: T+10ms
┌─────────────────────────────────────────────────────────┐
│ 2. Backend processes batch via transactionService       │
│    - Validates each transaction                         │
│    - Creates Transaction models                         │
│    - Updates TeamScore for each                         │
│    - Emits multiple 'transaction:added' events          │
│    - Emits 'score:updated' for affected teams           │
│                                                          │
│ 3. offlineQueueService.processQueue() completes         │
│    - Emits 'offline:queue:processed' domain event        │
└─────────────────────────────────────────────────────────┘
        │
        ▼
TIME: T+15ms
┌─────────────────────────────────────────────────────────┐
│ 4. broadcasts.js 'offline:queue:processed' listener:    │
│                                                          │
│    4a. Broadcasts offline:queue:processed to GMs:       │
│    {                                                    │
│      event: "offline:queue:processed",                  │
│      data: {                                             │
│        queueSize: 5,                                    │
│        results: [                                        │
│          {                                               │
│            transactionId: "7b8b...",                     │
│            status: "processed",                         │
│            error: null                                  │
│          },                                              │
│          // ... 4 more transactions ...                  │
│        ]                                                 │
│      },                                                 │
│      timestamp: "2025-10-15T19:10:00.100Z"              │
│    }                                                    │
│                                                          │
│    4b. Per AsyncAPI line 392-393: Broadcast sync:full   │
│         after offline:queue:processed                    │
└─────────────────────────────────────────────────────────┘
        │
        ▼
TIME: T+20ms
┌─────────────────────────────────────────────────────────┐
│ 5. Broadcasts sync:full with complete updated state:   │
│ {                                                        │
│   event: "sync:full",                                    │
│   data: {                                                │
│     session: { ... with updated transaction count ... }, │
│     scores: [                                            │
│       { teamId: "001", currentScore: 14500, ... },      │
│       // ... other teams ...                             │
│     ],                                                   │
│     recentTransactions: [ ... last 100 ... ],           │
│     videoStatus: { status: "idle", queueLength: 0 },   │
│     devices: [ ... connected devices ... ],             │
│     systemStatus: { orchestrator: "online", vlc: "..." }│
│   },                                                    │
│   timestamp: "2025-10-15T19:10:00.150Z"                 │
│ }                                                        │
│                                                          │
│ SENT TO: All GMs in 'gm-stations' room                  │
└─────────────────────────────────────────────────────────┘

KEY PATTERN:
- Offline processing triggers multiple domain events
- Each domain event broadcasts its update
- After all updates complete, sync:full sent as final state snapshot
- Ensures GMs have consistent state after catching up
```

---

## 4. ROOM BROADCASTING ARCHITECTURE

### 4.1 Socket.io Rooms and Memberships

```
┌─ All Sockets
│
├─ 'gm-stations' room
│  │ Created when: GM device authenticates
│  │ Destroyed when: All GMs disconnect
│  │ Contains: All connected GM scanners
│  │ Broadcasts: transaction:new, score:updated, video:*, group:completed, offline:queue:processed
│  │
│  ├─ GM_Station_1 (socket id: abc123...)
│  ├─ GM_Station_2 (socket id: def456...)
│  └─ GM_Station_3 (socket id: ghi789...)
│
├─ 'session:${sessionId}' room (PER SESSION)
│  │ Created when: Session created
│  │ Destroyed when: Session ended
│  │ Contains: All devices connected to this session
│  │ Broadcasts: transaction:new (session-scoped)
│  │
│  ├─ GM_Station_1 (socket id: abc123...)
│  ├─ GM_Station_2 (socket id: def456...)
│  └─ Player_1 (socket id: xyz111...)
│
└─ Direct socket (not in room)
   │ Single device communications
   │ Broadcasts: sync:full, transaction:result, gm:command:ack, error
```

### 4.2 Broadcasting Patterns

**Pattern 1: GM-Exclusive Broadcasts**
```javascript
// File: broadcasts.js
emitToRoom(io, 'gm-stations', 'score:updated', scoreData);
// Recipient: All connected GM scanners ONLY
// Never reaches player scanners
```

**Pattern 2: Session-Scoped Broadcasts**
```javascript
// File: broadcasts.js (line 128-134)
const session = sessionService.getCurrentSession();
if (session) {
  emitToRoom(io, `session:${session.id}`, 'transaction:new', payload);
}
// Recipient: All devices in current session only
// Prevents broadcasts to devices in other/old sessions
```

**Pattern 3: Direct Socket Broadcasts**
```javascript
// File: gmAuth.js (line 122)
emitWrapped(socket, 'sync:full', { ... });
// Recipient: Single device only
// Used for: Initial sync, acknowledgments, errors
```

**Pattern 4: Global Broadcasts**
```javascript
// File: broadcasts.js (line 50)
emitWrapped(io, 'session:update', { ... });
// Recipient: ALL connected clients
// Used for: Session lifecycle, system-wide events
```

### 4.3 Room Membership Lifecycle

```
TIMELINE: Device connection through session lifecycle

T+0s:   Device connects to WebSocket
        └─ Socket joins 'gm-stations' room (gmAuth.js:70)

T+0.5s: Device successfully authenticated
        └─ socket.join(`session:${session.id}`) (gmAuth.js:78)
        └─ Now in TWO rooms:
           - 'gm-stations' (for all GM broadcasts)
           - 'session:${sessionId}' (for session-specific broadcasts)

T+30m:  Session ends via admin command
        └─ sessionService.endSession() called
        └─ No automatic room cleanup (Socket.io allows multiple rooms)
        └─ Device should still in 'gm-stations' for next session

T+30m+5s: New session created
        └─ initializeSessionDevices() called
        └─ socket.join(`session:${newSessionId}`)
        └─ Now in TWO session rooms + 'gm-stations'

T+40m:  Device disconnects
        └─ handleDisconnect() called (deviceTracking.js:18-56)
        └─ Device marked as disconnected
        └─ Socket automatically leaves all rooms
        └─ device:disconnected broadcast sent
```

---

## 5. EVENT VALIDATION & ERROR HANDLING

### 5.1 Event Envelope Validation

**All WebSocket events MUST follow this structure:**

```javascript
{
  event: string,         // REQUIRED: Event type from contract
  data: object,          // REQUIRED: Event payload per schema
  timestamp: string      // REQUIRED: ISO 8601 UTC timestamp
}
```

**Validation happens in multiple layers:**

```
Layer 1: eventWrapper.js (line 12-18)
├─ wrapEvent() enforces envelope structure
└─ All emitWrapped() calls include event, data, timestamp

Layer 2: Contract tests (backend/tests/contract/websocket/)
├─ validateWebSocketEvent() validates against AsyncAPI schemas (ajv)
└─ Tests verify timestamp format, required fields, enum values

Layer 3: Client validation (during E2E testing)
├─ Clients should validate received events match contract
└─ Discard invalid events, log warning
```

### 5.2 Error Handling & Error Events

**Error Event Structure:**
```javascript
{
  event: 'error',
  data: {
    code: string,        // Enum from AsyncAPI contract
    message: string,     // User-friendly message
    details: object|null // Optional implementation details
  },
  timestamp: string
}
```

**Error Codes (from AsyncAPI schema):**
```
AUTH_REQUIRED         - Authentication missing or invalid
PERMISSION_DENIED     - Insufficient permissions
VALIDATION_ERROR      - Invalid input data
SESSION_NOT_FOUND     - No active session
TOKEN_NOT_FOUND       - Token ID not in database
DUPLICATE_TRANSACTION - Token already scanned
INVALID_REQUEST       - Malformed request
VLC_ERROR             - Video playback system error
INTERNAL_ERROR        - Unhandled server error
```

**Error Broadcasting Patterns:**

```javascript
// Pattern 1: Connection-level error (disconnect)
try {
  // validation fails
  throw new Error('Invalid deviceId');
} catch (error) {
  emitWrapped(socket, 'error', {
    code: 'VALIDATION_ERROR',
    message: error.message
  });
  socket.disconnect(true);  // Force disconnect
}

// Pattern 2: Event handling error (continue connected)
try {
  // transaction processing fails
} catch (error) {
  emitWrapped(socket, 'error', {
    code: 'INTERNAL_ERROR',
    message: 'Failed to process transaction',
    details: error.message
  });
  // Socket remains connected for retry
}

// Pattern 3: Broadcast error to all GMs
if (offlineQueueService) {
  offlineQueueService.on('error', (error) => {
    emitWrapped(io, 'error', {
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  });
}
```

### 5.3 Duplicate Transaction Prevention

**Critical Race Condition:**
```
Scenario: GM scanner scans token twice within 1 second

T+0ms:   Socket 1 sends transaction:submit (token: 534e2b03, team: 001)
         └─ Backend adds to recentTransactions deduplication cache

T+100ms: Socket 1 sends transaction:submit again (same token + team)
         └─ transactionService.processScan() checks cache
         └─ Detects DUPLICATE

Response:
{
  event: 'transaction:result',
  data: {
    status: 'duplicate',                    // NOT 'accepted'
    transactionId: 'original-txn-id',       // Original transaction ID
    tokenId: '534e2b03',
    teamId: '001',
    points: 0,                               // No points awarded
    message: 'Token already scanned',
    originalTransactionId: 'original-txn-id' // Added field per contract
  }
}

PREVENTION MECHANISM:
- transactionService maintains Set<"tokenId:teamId:sessionId">
- Window: 3600 seconds per game session (FR 1.3.7)
- Checked BEFORE transaction processing
- Prevents both accidental double-scans and malicious replay
```

---

## 6. STATE SYNCHRONIZATION ARCHITECTURE

### 6.1 Session vs GameState (CRITICAL DISTINCTION)

**Session (Single Source of Truth):**
- Stored in memory: `sessionService.currentSession`
- Persisted to disk: `backend/data/session-*.json`
- Data: teams, transactions, device list, status, timestamps
- Lifetime: Survives orchestrator restarts

**GameState (Computed on-demand):**
- Computed from: Session + live service status (video queue, VLC)
- NOT stored persistently
- Recreated on every request/subscription
- Lifetime: Exists only during request processing

**Why this matters for E2E tests:**
```javascript
// After orchestrator restart:
// 1. Session loads from disk ✓
// 2. Services initialize ✓
// 3. First sync:full request computes GameState on-demand ✓
// 4. No data loss, consistent state
// 5. Tests can restart server and verify state persistence

// If you store GameState instead:
// - Restart → GameState lost
// - Mismatch between Session and GameState
// - Tests fail unpredictably
```

### 6.2 sync:full Event - Complete State Snapshot

**When Sent:**
1. Immediately on successful WebSocket connection (gmAuth.js:122)
2. On explicit sync:request from client (deviceTracking.js:62)
3. After offline queue processing completes (broadcasts.js:459)
4. After certain admin commands (session create, etc.)

**Never sent:**
- In response to transaction:submit (use transaction:result instead)
- In response to gm:command (use gm:command:ack instead)
- Periodically as a keepalive (use heartbeat instead)

**Payload Structure:**
```javascript
{
  event: 'sync:full',
  data: {
    session: {
      id: string,
      name: string,
      startTime: ISO8601,
      endTime: ISO8601|null,
      status: 'active'|'paused'|'ended',
      teams: string[],
      metadata: object
    },
    scores: [
      {
        teamId: string,
        currentScore: number,
        baseScore: number,
        bonusPoints: number,
        tokensScanned: number,
        completedGroups: string[],
        adminAdjustments: AdjustmentObject[],
        lastUpdate: ISO8601
      }
    ],
    recentTransactions: Transaction[],  // Last 100 per AsyncAPI
    videoStatus: {
      status: 'idle'|'loading'|'playing'|'paused'|'completed'|'error',
      queueLength: number,
      tokenId: string|null,
      duration: number|null,
      progress: number|null,
      expectedEndTime: ISO8601|null,
      error: string|null
    },
    devices: DeviceInfo[],
    systemStatus: {
      orchestrator: 'online'|'offline',
      vlc: 'connected'|'disconnected'|'error'
    }
  },
  timestamp: ISO8601
}
```

**Client Behavior on Session ID Change:**
```javascript
// Per AsyncAPI lines 261-265 & 981-986:
// When receiving sync:full with NEW session ID:

const previousSessionId = clientState.session?.id;
const newSessionId = event.data.session.id;

if (previousSessionId && previousSessionId !== newSessionId) {
  // CRITICAL: Reset session-scoped state
  clientState.duplicateDetectionCache.clear();
  clientState.recentTransactionIds.clear();
  
  // PRESERVE: Historical/aggregate data
  clientState.allHistoricalTransactions.push(...clientState.recentTransactions);
  clientState.sessionHistory.push({ sessionId: previousSessionId, ... });
}

// Then update current state
clientState.session = event.data.session;
clientState.scores = event.data.scores;
// ... etc
```

### 6.3 Incremental Updates vs Full Sync

**Incremental Updates (For Efficiency):**
```javascript
// transaction:new, score:updated, video:status, etc.
// These are sent IMMEDIATELY after change
// Smaller payloads, lower latency
```

**Full Sync (For Consistency):**
```javascript
// sync:full sent when:
// - New device connects (initial state)
// - System comes online after offline period
// - Certain admin operations
// - Client explicitly requests it

// Larger payload, but guarantees consistency
// Useful when client state might be stale
```

**When to use each in tests:**
```javascript
// Use incremental if:
// - Testing single transaction
// - Testing rapid sequence of same event type
// - Verifying real-time latency

// Use full sync if:
// - Testing after restart/reconnect
// - Testing state consistency across multiple changes
// - Verifying complete game state
// - Testing offline → online transition
```

---

## 7. SERVICE EVENT COORDINATION (Internal Flow)

### 7.1 Event Flow Pattern

```
DOMAIN LAYER (Services emit unwrapped events)
↓
sessionService.emit('session:created', sessionData)
transactionService.emit('transaction:added', transactionData)
videoQueueService.emit('video:started', videoData)
stateService.emit('state:updated', gamestateData)
↓
BROADCAST LAYER (broadcasts.js listens and wraps)
↓
listenerRegistry.addTrackedListener(service, eventName, handler)
├─ service.on('transaction:added', (tx) => {
│   const payload = {
│     transaction: { ...tx enriched with token data... }
│   };
│   emitToRoom(io, `session:${sessionId}`, 'transaction:new', payload);
│ })
└─ Wraps payload with envelope: { event, data, timestamp }
↓
WEBSOCKET TRANSPORT
↓
io.to('gm-stations').emit('transaction:new', wrappedEvent)
↓
CLIENT LAYER (Clients receive wrapped events)
↓
socket.on('transaction:new', (wrappedEvent) => {
  // wrappedEvent.event === 'transaction:new'
  // wrappedEvent.data.transaction === enriched transaction
  // wrappedEvent.timestamp === ISO8601
})
```

### 7.2 Listener Registration Pattern

**Key Files:**
- `backend/src/websocket/broadcasts.js` - Primary listeners
- `backend/src/websocket/listenerRegistry.js` - Tracking (prevent duplicates in tests)
- `backend/src/server.js:114-126` - Service listener initialization

**Setup Flow:**
```javascript
// 1. App initialization (app.js)
const { initializeServices } = require('./app');
await initializeServices();

// 2. Service initialization (services load tokens, setup internal listeners)
await sessionService.init();
await transactionService.init(tokens);
await videoQueueService.init();

// 3. Broadcast listener setup (server.js:114-126)
function setupServiceListeners(ioInstance) {
  setupBroadcastListeners(ioInstance, {
    sessionService,
    stateService,
    videoQueueService,
    offlineQueueService,
    transactionService,
  });
}

// 4. For each service event:
addTrackedListener(sessionService, 'session:created', (session) => {
  emitWrapped(io, 'session:update', {
    id: session.id,
    name: session.name,
    // ... wrapped payload
  });
});
```

### 7.3 Preventing Listener Accumulation (Critical for Tests)

**Problem in Tests:**
```javascript
// Test 1
setupBroadcastListeners(io, services);
// Adds listener: sessionService.on('session:created', ...)

// Test 2 (without cleanup)
setupBroadcastListeners(io, services);
// Adds ANOTHER listener: sessionService.on('session:created', ...)
// NOW THERE ARE 2 LISTENERS

// When session:created emitted:
// - Broadcast happens TWICE
// - Tests see duplicate events
// - Race conditions appear sporadically
```

**Solution via listenerRegistry:**
```javascript
// File: listenerRegistry.js
class ListenerRegistry {
  cleanup() {
    // Remove all tracked listeners
    for (const [service, listeners] of this.listeners) {
      for (const { event, handler } of listeners) {
        service.removeListener(event, handler);
      }
    }
    this.listeners.clear();
  }
}

// Usage in test afterEach:
afterEach(async () => {
  listenerRegistry.cleanup();  // CRITICAL for test isolation
  await cleanupIntegrationTestServer();
});
```

---

## 8. E2E TEST SCENARIOS

### 8.1 Test Pattern: Full Transaction Flow

```javascript
describe('E2E: Complete GM Transaction Flow', () => {
  let testContext;
  let socket;
  let transactionResultPromise;
  let transactionNewPromise;
  let scoreUpdatedPromise;

  beforeAll(async () => {
    // Setup server with WebSocket
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Reset services
    await sessionService.reset();

    // Create session
    await sessionService.createSession({
      name: 'Transaction Test',
      teams: ['001', '002']
    });

    // Connect GM socket
    socket = await connectAndIdentify(
      testContext.socketUrl,
      'gm',
      'TEST_GM_1'
    );
  });

  afterEach(async () => {
    if (socket?.connected) socket.disconnect();
    await sessionService.reset();
  });

  it('should complete full transaction sequence', async () => {
    // Setup: Listen for all events BEFORE submitting
    const resultListener = waitForEvent(socket, 'transaction:result');
    const newListener = waitForEvent(socket, 'transaction:new');
    const scoreListener = waitForEvent(socket, 'score:updated');

    // Trigger: Submit transaction
    socket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'TEST_GM_1',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    // Verify: transaction:result (direct response)
    const resultEvent = await resultListener;
    expect(resultEvent.event).toBe('transaction:result');
    expect(resultEvent.data.status).toBe('accepted');
    expect(resultEvent.data.transactionId).toBeDefined();
    validateWebSocketEvent(resultEvent, 'transaction:result');

    // Verify: transaction:new (broadcast to all GMs)
    const newEvent = await newListener;
    expect(newEvent.event).toBe('transaction:new');
    expect(newEvent.data.transaction.tokenId).toBe('534e2b03');
    validateWebSocketEvent(newEvent, 'transaction:new');

    // Verify: score:updated (broadcast to all GMs)
    const scoreEvent = await scoreListener;
    expect(scoreEvent.event).toBe('score:updated');
    expect(scoreEvent.data.teamId).toBe('001');
    expect(scoreEvent.data.currentScore).toBeGreaterThan(0);
    validateWebSocketEvent(scoreEvent, 'score:updated');

    // Verify: All events have correct timestamp order
    const resultTime = new Date(resultEvent.timestamp).getTime();
    const newTime = new Date(newEvent.timestamp).getTime();
    const scoreTime = new Date(scoreEvent.timestamp).getTime();
    expect(resultTime <= newTime).toBe(true);
    expect(newTime <= scoreTime).toBe(true);
  });
});
```

### 8.2 Test Pattern: Race Condition Detection

```javascript
describe('E2E: Race Conditions', () => {
  let testContext;
  let socket1;
  let socket2;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await sessionService.createSession({
      name: 'Race Test',
      teams: ['001']
    });

    socket1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_1');
    socket2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_2');
  });

  afterEach(async () => {
    if (socket1?.connected) socket1.disconnect();
    if (socket2?.connected) socket2.disconnect();
    await sessionService.reset();
  });

  it('should handle simultaneous transactions without duplication', async () => {
    // Setup: Collect all transaction:new events
    const newEvents = [];
    socket1.on('transaction:new', (event) => newEvents.push(event));

    // Trigger: Both sockets submit SAME token simultaneously
    const token = '534e2b03';
    const promises = [
      new Promise(resolve => {
        socket1.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: token,
            teamId: '001',
            deviceId: 'GM_1',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });
        socket1.once('transaction:result', resolve);
      }),
      new Promise(resolve => {
        socket2.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: token,
            teamId: '001',
            deviceId: 'GM_2',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });
        socket2.once('transaction:result', resolve);
      })
    ];

    // Wait for both to complete
    const [result1, result2] = await Promise.all(promises);

    // Verify: One accepted, one duplicate
    const statuses = [result1.data.status, result2.data.status].sort();
    expect(statuses).toEqual(['accepted', 'duplicate']);

    // Verify: Only ONE transaction:new broadcast (not two)
    await sleep(100);  // Wait for broadcasts to settle
    expect(newEvents).toHaveLength(1);
    expect(newEvents[0].data.transaction.tokenId).toBe(token);
  });
});
```

### 8.3 Test Pattern: Device Lifecycle

```javascript
describe('E2E: Device Connection Lifecycle', () => {
  let testContext;
  let observer;     // Socket that observes events
  let subject;      // Socket whose lifecycle we test

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await sessionService.createSession({
      name: 'Device Test',
      teams: ['001']
    });

    // Observer socket connects first
    observer = await connectAndIdentify(
      testContext.socketUrl,
      'gm',
      'OBSERVER'
    );
  });

  afterEach(async () => {
    if (observer?.connected) observer.disconnect();
    if (subject?.connected) subject.disconnect();
    await sessionService.reset();
  });

  it('should broadcast device:connected on new connection', async () => {
    // Setup: Listen for device:connected on observer
    const connectedListener = waitForEvent(observer, 'device:connected');

    // Trigger: Subject connects
    subject = await connectAndIdentify(
      testContext.socketUrl,
      'gm',
      'SUBJECT_GM'
    );

    // Verify: Observer receives device:connected
    const event = await connectedListener;
    expect(event.event).toBe('device:connected');
    expect(event.data.deviceId).toBe('SUBJECT_GM');
    expect(event.data.type).toBe('gm');
    validateWebSocketEvent(event, 'device:connected');

    // Verify: Subject did NOT receive its own device:connected
    // (Need separate check - subject has sync:full instead)
    const subjectEvents = [];
    subject.on('device:connected', (e) => subjectEvents.push(e));
    await sleep(100);
    expect(subjectEvents).toHaveLength(0);
  });

  it('should broadcast device:disconnected on disconnection', async () => {
    // Setup: Connect subject
    subject = await connectAndIdentify(
      testContext.socketUrl,
      'gm',
      'SUBJECT_GM'
    );

    // Setup: Listen for device:disconnected on observer
    const disconnectedListener = waitForEvent(observer, 'device:disconnected');

    // Trigger: Subject disconnects
    subject.disconnect();

    // Verify: Observer receives device:disconnected
    const event = await disconnectedListener;
    expect(event.event).toBe('device:disconnected');
    expect(event.data.deviceId).toBe('SUBJECT_GM');
    expect(event.data.reason).toBe('manual');
    validateWebSocketEvent(event, 'device:disconnected');
  });
});
```

---

## 9. MONITORING & DEBUGGING STRATEGIES

### 9.1 Event Flow Tracing

```javascript
// Setup: Add logging to trace events
class EventTracer {
  constructor(socket) {
    this.events = [];
    this.startTime = Date.now();

    // Capture all events
    socket.onAny((eventName, data) => {
      const elapsed = Date.now() - this.startTime;
      this.events.push({
        timestamp: elapsed,
        event: eventName,
        dataKeys: Object.keys(data?.data || {})
      });

      console.log(`[${elapsed}ms] ${eventName}`);
      if (eventName.includes('error')) {
        console.error('ERROR EVENT:', data);
      }
    });
  }

  // Example trace for transaction sequence:
  // [0ms] sync:full
  // [1205ms] transaction:submit (client send)
  // [1215ms] transaction:result
  // [1220ms] transaction:new
  // [1230ms] score:updated
}

// Usage:
socket = await connectAndIdentify(...);
const tracer = new EventTracer(socket);

// ... do operations ...

// Print timeline
console.log('Event Timeline:');
tracer.events.forEach(e => {
  console.log(`  [${e.timestamp.toString().padStart(4)}ms] ${e.event} ${e.dataKeys.join(', ')}`);
});
```

### 9.2 Contract Validation Helper

```javascript
function validateWebSocketEvent(event, expectedEventName) {
  // Verify envelope structure
  expect(event).toHaveProperty('event');
  expect(event).toHaveProperty('data');
  expect(event).toHaveProperty('timestamp');

  expect(event.event).toBe(expectedEventName);
  expect(typeof event.timestamp).toBe('string');
  expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

  // Validate against AsyncAPI schema
  const schema = getAsyncAPISchema(expectedEventName);
  const valid = ajv.validate(schema, event);
  if (!valid) {
    console.error('Validation errors:');
    ajv.errors.forEach(err => {
      console.error(`  ${err.dataPath}: ${err.message}`);
    });
  }
  expect(valid).toBe(true);
}
```

### 9.3 State Consistency Check

```javascript
async function verifyGameStateConsistency() {
  const session = sessionService.getCurrentSession();
  const state = stateService.getCurrentState();

  // 1. Session exists
  expect(session).toBeDefined();

  // 2. State derives from session
  expect(state.sessionId).toBe(session.id);
  expect(state.teams).toEqual(session.teams);

  // 3. Scores match transactions
  for (const [teamId, teamScore] of transactionService.teamScores) {
    const stateScore = state.scores.find(s => s.teamId === teamId);
    expect(stateScore.currentScore).toBe(teamScore.currentScore);
  }

  // 4. Recent transactions are subset of session transactions
  const recentIds = new Set(state.recentTransactions.map(t => t.id));
  const sessionIds = new Set(session.transactions.map(t => t.id));
  for (const id of recentIds) {
    expect(sessionIds.has(id)).toBe(true);
  }

  // 5. Video status matches queue
  if (state.videoStatus.status !== 'idle') {
    expect(state.videoStatus.tokenId).toBeDefined();
  }

  console.log('State consistency: PASSED');
}
```

---

## 10. RACE CONDITIONS & KNOWN ISSUES

### 10.1 Critical Race Conditions to Watch

**Race 1: Multiple Listeners on Same Event**
```
Risk: Test accumulation of listeners between test runs
Symptom: Events broadcast multiple times, random test failures
Prevention: Call listenerRegistry.cleanup() in afterEach
```

**Race 2: Duplicate Transaction Detection Window**
```
Risk: Two scans of same token within 1-second window
Symptom: Second scan rejected, points not awarded
Expected Behavior: Duplicate detected, handled per contract
Testing: Verify status='duplicate' in transaction:result
```

**Race 3: Offline Queue Processing Order**
```
Risk: Transactions in offline queue processed out of order
Symptom: Final scores inconsistent, transaction IDs mismatched
Prevention: Ensure batch processing maintains order
Testing: Verify recentTransactions order after offline:queue:processed
```

**Race 4: Session Change During Transaction**
```
Risk: Transaction submitted, session changes before processing
Symptom: Transaction targets wrong session
Prevention: Lock session during processing
Testing: Verify all transactions in sync:full match current session ID
```

**Race 5: WebSocket Handshake Auth Timeout**
```
Risk: Socket connects, auth middleware slow, client sends event
Symptom: 'undefined device' errors
Prevention: Server pre-auth from handshake, store on socket immediately
Testing: Verify socket.isAuthenticated set before any events handled
```

### 10.2 Debugging Checklist

```
When tests fail mysteriously:

[ ] 1. Check listener accumulation
    afterEach(() => {
      listenerRegistry.cleanup();  // MUST call this
    });

[ ] 2. Check event timing assumptions
    // Don't assume events arrive instantly
    // Use proper async/await patterns
    const event = await waitForEvent(socket, 'event:name', timeout=1000);

[ ] 3. Check session state
    const session = sessionService.getCurrentSession();
    console.log('Session:', session?.id, session?.status);

[ ] 4. Check event envelope format
    // Verify { event, data, timestamp } structure
    console.log(JSON.stringify(event, null, 2));

[ ] 5. Check room membership
    const gmRoom = io.sockets.adapter.rooms.get('gm-stations');
    console.log('GMs in room:', gmRoom?.size);

[ ] 6. Check duplicate detection cache
    // For duplicate scan testing
    const cache = transactionService.recentTransactions;
    console.log('Recent txns:', cache.map(t => t.tokenId));

[ ] 7. Check authentication
    const decoded = verifyToken(socket.handshake.auth?.token);
    console.log('Authenticated:', !!decoded);

[ ] 8. Check event order
    // Trace with EventTracer class (section 9.1)
    // Verify events arrive in expected order
```

---

## 11. SUMMARY TABLE

| Aspect | Key Detail |
|--------|-----------|
| **Auth Flow** | HTTP JWT → WebSocket handshake → auto-identification → sync:full |
| **Events** | 25+ event types, all wrapped in `{ event, data, timestamp }` |
| **Broadcasts** | Room-based: gm-stations, session:${id}, direct socket |
| **State** | Session (persistent) + GameState (computed on-demand) |
| **Sync** | Transaction response immediate, sync:full on connection/offline |
| **Rooms** | Device joins 'gm-stations' + session-specific room |
| **Listener Cleanup** | CRITICAL for tests: call listenerRegistry.cleanup() afterEach |
| **Race Conditions** | Watch for: listener accumulation, duplicate transactions, session changes |
| **E2E Pattern** | Setup listeners → trigger event → await result → validate envelope |

