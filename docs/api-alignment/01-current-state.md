# Backend API Current State Analysis

**Analysis Date**: 2025-09-29
**Analyst**: Claude Code (Ultrathink Review)
**Codebase**: ALN-Ecosystem/backend
**Branch**: 001-backend-aln-architecture

---

## Executive Summary

The ALN Orchestrator backend has a solid architectural foundation with event-driven design, singleton services, and comprehensive validation. However, there is a **critical mismatch** between documented and actual API response formats across all 27 HTTP endpoints.

**Key Finding**: The documented standard response format `{status: 'success'|'error', data?, error?, code?}` is NOT consistently implemented. Instead, **4 different response patterns** are in use.

---

## API Inventory

### HTTP Endpoints (27 total)

#### Scan Operations (scanRoutes.js)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/scan` | None | Player scanner token scan |
| POST | `/api/scan/batch` | None | Batch scan processing |

**Response Pattern**: Domain-specific status (Pattern A)

#### Session Management (sessionRoutes.js)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/session` | None | Get current session |
| GET | `/api/session/:id` | None | Get session by ID |
| POST | `/api/session` | JWT | Create new session |
| PUT | `/api/session` | JWT | Update current session |
| PUT | `/api/session/:id` | JWT | Update session by ID |

**Response Pattern**: Mixed (returns `session.toAPIResponse()`)
**Auth Issue**: POST/PUT manually implement auth instead of using middleware

#### State & Status (stateRoutes.js)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/state` | None | Get game state (ETag support) |
| GET | `/api/status` | None | Get orchestrator status |

**Response Pattern**: Unwrapped JSON (no standard envelope)

#### Transactions (transactionRoutes.js)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/transaction/submit` | None | Submit scoring transaction |
| GET | `/api/transaction/history` | None | Get transaction history |
| GET | `/api/transaction/:id` | None | Get specific transaction |
| DELETE | `/api/transaction/:id` | Admin | Delete transaction |

**Response Pattern**: Generic success/error (Pattern B)
**Auth Issue**: DELETE uses `x-admin-token` header instead of Bearer token

#### Video Control (videoRoutes.js)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/video/control` | JWT | Control video playback |

**Response Pattern**: Simple success flag (Pattern C)
**API Issue**: Accepts both `action` and `command` fields

#### Admin Operations (adminRoutes.js)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/admin/auth` | Password | Authenticate as admin |
| POST | `/api/admin/reset-scores` | JWT | Reset all team scores |
| POST | `/api/admin/clear-transactions` | JWT | Clear transaction history |
| POST | `/api/admin/stop-all-videos` | JWT | Stop all video playback |
| POST | `/api/admin/offline-mode` | JWT | Toggle offline mode |
| GET | `/api/admin/sessions` | JWT | List all sessions |
| DELETE | `/api/admin/session/:id` | JWT | Delete session |
| GET | `/api/admin/devices` | JWT | List connected devices |
| POST | `/api/admin/reset` | JWT | System reset |
| GET | `/api/admin/logs` | JWT | Get system logs |
| POST | `/api/admin/config` | JWT | Update configuration |

**Response Pattern**: Mixed (auth returns `{token, expiresIn}`, others use `{success, message}`)

#### Token Data (tokenRoutes.js)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/tokens` | None | Get all token data |

**Response Pattern**: Custom `{tokens, count, lastUpdate}`

#### Documentation (docsRoutes.js)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/docs` | None | Get OpenAPI spec |
| GET | `/api-docs` | None | Swagger UI |

**Response Pattern**: Direct JSON/HTML

#### Health (app.js)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/health` | None | Health check |

**Response Pattern**: Custom health object

### WebSocket Events

#### Incoming Events (6)
| Event | Handler | Auth Required | Purpose |
|-------|---------|---------------|---------|
| `heartbeat` | gmAuth.js | Yes | GM station heartbeat |
| `sync:request` | deviceTracking.js | Yes | Request full state sync |
| `state:request` | adminEvents.js | Yes | Request current state |
| `gm:command` | adminEvents.js | Yes (GM only) | GM control commands |
| `transaction:submit` | adminEvents.js | Yes | Submit transaction |
| `disconnect` | deviceTracking.js | No | Socket disconnection |

#### Outgoing Events (24)

**Authentication & Connection**:
- `gm:identified` - GM identification confirmation
- `heartbeat:ack` - Heartbeat acknowledgment
- `device:connected` - Device connected (broadcast)
- `device:disconnected` - Device disconnected (broadcast)

**State Synchronization**:
- `state:sync` - Current state sync to client
- `state:update` - State delta updates (GM stations only)
- `sync:full` - Full system state sync

**Transactions & Scoring**:
- `transaction:result` - Transaction processing result (to submitter)
- `transaction:new` - New transaction notification (to session room)
- `score:updated` - Score update (GM stations only)
- `group:completed` - Group completion bonus (GM stations only)
- `team:created` - New team created (GM stations only)

**Video Control**:
- `video:status` - Video status updates (GM stations only)
  - Statuses: loading, playing, paused, completed, error, idle

**Session Management**:
- `session:new` - New session created
- `session:update` - Session updated
- `session:paused` - Session paused by GM
- `session:resumed` - Session resumed by GM
- `session:ended` - Session ended by GM

**Admin Commands**:
- `video:skipped` - Video skipped by GM
- `scores:reset` - Scores reset by GM
- `gm:command:ack` - GM command acknowledgment

**Offline Queue**:
- `offline:queue:processed` - Queue processing results (GM stations)

**Errors**:
- `error` - Error notifications with code and message

---

## Response Format Patterns

### Pattern A: Domain-Specific Status (scanRoutes)

**Success Response**:
```javascript
{
  status: 'accepted' | 'rejected' | 'queued',
  message: string,
  tokenId: string,
  mediaAssets: object,
  videoPlaying: boolean,
  // Optional fields based on status
  waitTime?: number,           // For 'rejected'
  queued?: boolean,            // For 'queued'
  offlineMode?: boolean,       // For 'queued'
  transactionId?: string       // For 'queued'
}
```

**Example**:
```javascript
// Accepted scan
{
  status: 'accepted',
  message: 'Video queued for playback',
  tokenId: '534e2b03',
  mediaAssets: { video: 'memory_token_05.mp4' },
  videoPlaying: true
}

// Offline queue
{
  status: 'queued',
  queued: true,
  offlineMode: true,
  transactionId: 'uuid-here',
  message: 'Scan queued for processing when system comes online'
}
```

**Location**: scanRoutes.js:98-126

### Pattern B: Generic Success/Error (transactionRoutes)

**Success Response**:
```javascript
{
  status: 'success',
  data: {
    // Response payload
  }
}
```

**Error Response**:
```javascript
{
  status: 'error',
  error: string  // Error message
}
```

**Example**:
```javascript
// Success
{
  status: 'success',
  data: {
    transactionId: 'uuid',
    status: 'accepted',
    points: 50
  }
}

// Error
{
  status: 'error',
  error: 'No active session'
}
```

**Location**: transactionRoutes.js:63-70, 102-106

### Pattern C: Simple Success Flag (videoRoutes, adminRoutes)

**Success Response**:
```javascript
{
  success: boolean,
  message: string,
  // Additional fields vary by endpoint
  [key: string]: any
}
```

**Special Case (admin auth)**:
```javascript
{
  token: string,
  expiresIn: number
}
```

**Example**:
```javascript
// Video control
{
  success: true,
  message: 'Video queued for playback',
  tokenId: '534e2b03',
  currentStatus: 'playing'
}

// Admin operation
{
  success: true,
  message: 'Scores reset successfully'
}
```

**Location**: videoRoutes.js:68-201, adminRoutes.js:93-96

### Pattern D: Error-Only (Validation/Auth Errors)

**Error Response**:
```javascript
{
  error: 'ERROR_CODE',
  message: string,
  details?: array | object  // For validation errors
}
```

**Error Codes**:
- `AUTH_REQUIRED` - Authentication required/failed
- `VALIDATION_ERROR` - Input validation failed
- `NOT_FOUND` - Resource not found
- `INTERNAL_ERROR` - Server error
- `CONFLICT` - Resource conflict (e.g., video already playing)
- `METHOD_NOT_ALLOWED` - HTTP method not allowed
- `QUEUE_FULL` - Offline queue is full

**Example**:
```javascript
// Validation error
{
  error: 'VALIDATION_ERROR',
  message: 'Validation failed: tokenId, teamId',
  details: [
    { field: 'tokenId', message: 'tokenId is required' },
    { field: 'teamId', message: 'teamId is required' }
  ]
}

// Auth error
{
  error: 'AUTH_REQUIRED',
  message: 'auth required'
}
```

**Location**: All routes (validation/error handlers)

---

## Architectural Misalignments

### Critical Severity

#### 1. Inconsistent Response Formats ⚠️

**Issue**: Four different response format patterns across 27 endpoints vs. one documented standard.

**Documented Standard** (CLAUDE.md):
```javascript
{
  status: 'success' | 'error',
  data?: any,
  error?: string,
  code?: string
}
```

**Actual Implementation**: Patterns A, B, C, D (detailed above)

**Impact**:
- Client code must implement 4 different parsing strategies
- No standard error handling pattern
- Increased complexity for SDK/client library development
- OpenAPI contract will be fragmented

**Affected Endpoints**: ALL (27/27)

**Recommendation**: Standardize on ONE format (suggest Pattern B with modifications)

#### 2. Missing `status` Field in Error Responses ⚠️

**Issue**: Validation and authentication errors use Pattern D (error-only) without `status` field.

**Expected**:
```javascript
{
  status: 'error',
  error: 'VALIDATION_ERROR',
  message: '...',
  details?: [...]
}
```

**Actual**:
```javascript
{
  error: 'VALIDATION_ERROR',
  message: '...',
  details?: [...]
}
```

**Impact**: Inconsistent client-side error detection (can't rely on `status` field)

**Location**: Global error handler (app.js:146-153), all route validation errors

**Recommendation**: Add `status: 'error'` to all error responses

### High Severity

#### 3. Authentication Implementation Inconsistency ⚠️

**Issue**: Session routes manually implement JWT verification instead of using `requireAdmin` middleware.

**Code Location**:
- sessionRoutes.js:68-90 (POST /api/session)
- sessionRoutes.js:130-152 (PUT /api/session)
- sessionRoutes.js:205-227 (PUT /api/session/:id)

**Current Pattern**:
```javascript
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return res.status(401).json({...});
}
const token = authHeader.substring(7);
const decoded = authMiddleware.verifyToken(token);
if (!decoded) {
  return res.status(401).json({...});
}
req.admin = decoded;
```

**Should Be**:
```javascript
router.post('/', requireAdmin, async (req, res) => {
  // req.admin already populated by middleware
});
```

**Impact**: Code duplication, maintenance burden, potential for auth bypass bugs

**Recommendation**: Refactor to use `requireAdmin` middleware consistently

#### 4. Transaction DELETE Uses Different Auth Mechanism ⚠️

**Issue**: `DELETE /api/transaction/:id` uses custom `x-admin-token` header check instead of standard Bearer token.

**Code Location**: transactionRoutes.js:188-196

**Current**:
```javascript
const adminToken = req.headers['x-admin-token'];
if (!adminToken || adminToken !== require('../config').adminToken) {
  return res.status(401).json({...});
}
```

**All Other Endpoints**: Use `Authorization: Bearer <jwt-token>`

**Impact**:
- Inconsistent auth mechanism
- Security risk (static token instead of JWT)
- Client confusion

**Recommendation**: Change to use `requireAdmin` middleware like other endpoints

#### 5. Video Control Accepts Two Field Names ⚠️

**Issue**: `/api/video/control` accepts both `action` and `command` fields.

**Code Location**: videoRoutes.js:42-54

**Current**:
```javascript
const controlData = { ...req.body };
if (controlData.command && !controlData.action) {
  controlData.action = controlData.command;
}
```

**Impact**: API confusion, unclear contract

**Recommendation**:
- Choose ONE field name (suggest `action` for REST consistency)
- Deprecate the other
- Document in OpenAPI spec

### Medium Severity

#### 6. State Endpoint Returns Unwrapped JSON ⚠️

**Issue**: `GET /api/state` returns GameState JSON directly without standard response envelope.

**Code Location**: stateRoutes.js:76

**Current**:
```javascript
res.json(stateJSON);  // GameState object directly
```

**Expected** (for consistency):
```javascript
res.json({
  status: 'success',
  data: stateJSON
});
```

**Impact**: Inconsistent with documented pattern

**Note**: This endpoint has ETag caching (304 responses), which might complicate wrapping

**Recommendation**: Evaluate if wrapping breaks caching; if not, wrap for consistency

#### 7. Session toAPIResponse() Format Unknown ⚠️

**Issue**: Session model's `toAPIResponse()` method format not verified against standard.

**Code Location**: sessionRoutes.js:29, 54, 102, 172, 247

**Impact**: May not match documented format

**Recommendation**: Investigate Session model and ensure `toAPIResponse()` returns standard format

#### 8. WebSocket Event Format Inconsistency ⚠️

**Issue**: Some WebSocket events wrapped in `{event, data, timestamp}`, others sent as raw objects.

**Wrapped Events** (broadcasts.js):
- `transaction:new`
- `score:updated`
- `group:completed`
- `team:created`
- `video:status`

**Unwrapped Events**:
- `state:sync`
- `gm:identified`
- `heartbeat:ack`

**Example Wrapped**:
```javascript
{
  event: 'transaction:new',
  data: {
    id: 'uuid',
    tokenId: 'abc',
    // ...
  },
  timestamp: '2025-09-29T...'
}
```

**Example Unwrapped**:
```javascript
{
  success: true,
  sessionId: 'uuid',
  state: {...}
}
```

**Impact**: Client-side parsing complexity

**Recommendation**: Standardize on wrapped format for ALL events

### Low Severity

#### 9. Test Token Handling Duplication ℹ️

**Issue**: TEST_* token creation logic duplicated in scanRoutes and videoRoutes.

**Code Location**:
- scanRoutes.js:75-88
- scanRoutes.js:189-202
- videoRoutes.js:87-104

**Impact**: Maintenance burden for test code

**Recommendation**: Create centralized test token factory in test utilities

#### 10. Error Message Casing Inconsistency ℹ️

**Issue**: Inconsistent casing in error messages.

**Examples**:
- "auth required" (lowercase)
- "Authorization required" (sentence case)
- "Authentication failed" (sentence case)

**Impact**: Minor UX inconsistency

**Recommendation**: Standardize on sentence case for all user-facing messages

---

## Authentication Patterns

### HTTP Authentication

**Mechanism**: JWT (JSON Web Tokens)

**Flow**:
1. Client sends password to `POST /api/admin/auth`
2. Server validates against `config.security.adminPassword`
3. Server generates JWT with 24h expiry: `{id: 'admin', role: 'admin', timestamp: Date.now()}`
4. Server stores token in in-memory Set (`adminTokens`)
5. Server returns `{token: string, expiresIn: 86400}`
6. Client includes in subsequent requests: `Authorization: Bearer <token>`

**Middleware**:
- `requireAdmin`: Validates JWT, attaches `req.admin = decoded`
- `optionalAdmin`: Validates if present, non-blocking
- `isAdmin()`: Helper to check if request is from admin

**Security Notes**:
- In-memory storage (production should use Redis/database)
- Automatic cleanup of expired tokens (hourly)
- Token invalidation supported via `invalidateToken()`

**Code Location**: src/middleware/auth.js

### WebSocket Authentication

**Mechanism**: Handshake pre-authentication

**Flow**:
1. Client connects with auth in handshake:
```javascript
socket = io(url, {
  auth: {
    token: '<jwt-token>',
    stationId: 'GM-01',
    deviceType: 'gm',
    version: '1.0.0'
  }
});
```

2. Server validates during connection (server.js:42-73):
   - Extracts auth from `socket.handshake.auth`
   - Verifies JWT using same `verifyToken()` function
   - Checks `role === 'admin'` in decoded token
   - Sets socket properties: `isAuthenticated`, `authRole`, `deviceId`, `deviceType`

3. Server automatically triggers `gm:identify` for authenticated connections

**Connection States**:
- Pre-authenticated: Valid token in handshake → Auto-identify → Join `gm-stations` room
- Unauthenticated: No/invalid token → Emit `error` with `AUTH_REQUIRED` → Disconnect

**Code Location**: src/server.js:36-105, src/websocket/gmAuth.js

---

## Service Integration Patterns

### Import Pattern

**Direct Require**:
```javascript
const sessionService = require('../services/sessionService');
const stateService = require('../services/stateService');
```

Routes import services directly (no dependency injection)

### Singleton Pattern

**Services**:
- sessionService
- stateService
- videoQueueService
- vlcService
- transactionService
- offlineQueueService
- discoveryService

**Pattern**: Each exports `getInstance()` but not always used (sometimes services are used directly)

### Event-Driven Flow

**Broadcasting Architecture**:
1. Service performs operation
2. Service emits event (extends EventEmitter)
3. `broadcasts.js` listens to service events
4. `broadcasts.js` emits to appropriate Socket.io rooms

**Example**:
```javascript
// Service
transactionService.emit('score:updated', teamScore);

// broadcasts.js
transactionService.on('score:updated', (teamScore) => {
  io.to('gm-stations').emit('score:updated', {
    event: 'score:updated',
    data: { /* ... */ },
    timestamp: new Date().toISOString()
  });
});
```

### Room-Based Segregation

**Socket.io Rooms**:
- `gm-stations` - All authenticated GM scanners
- `session:{sessionId}` - All clients in a specific session
- Default (no room) - All connected clients

**Broadcasting Strategy**:
- State updates → `gm-stations` only
- Score updates → `gm-stations` only
- Transaction notifications → `session:{id}` room
- Video status → `gm-stations` only
- Session events → All clients

**Code Location**: src/websocket/broadcasts.js

### State Flow

```
HTTP Request/WebSocket Event
        ↓
Route Handler / Event Handler
        ↓
Service Layer (singleton)
        ↓
State Service (updates state)
        ↓
Service emits event
        ↓
broadcasts.js listens
        ↓
Socket.io emits to rooms
        ↓
Clients receive update
```

---

## Architectural Strengths

### 1. Event-Driven Design ✅

Clean separation between business logic and communication:
- Services focus on domain logic
- Events decouple services from WebSocket
- Easy to add new event listeners

### 2. Singleton Services ✅

Consistent state management:
- Single source of truth per service
- No duplicate instances
- Clear lifecycle management

### 3. Room-Based Broadcasting ✅

Efficient and secure WebSocket communication:
- GM-only events don't leak to players
- Session isolation
- Targeted updates reduce bandwidth

### 4. Comprehensive Validation ✅

Joi schemas for all inputs:
- Type safety at API boundary
- Clear error messages with field names
- Centralized validation logic

### 5. Offline Queue Handling ✅

Graceful degradation when offline:
- HTTP 202 (Accepted) responses
- Transaction queuing
- Automatic processing when back online

### 6. ETag Caching ✅

Efficient state endpoint:
- MD5 hash of state content
- 304 (Not Modified) responses
- Reduced bandwidth for polling clients

### 7. CORS Flexibility ✅

Network-friendly configuration:
- Local network range support (RFC1918)
- Dynamic origin validation
- No router configuration needed

### 8. Graceful VLC Failures ✅

System resilience:
- VLC connection failures don't crash server
- Degraded mode operation
- Error event handling

### 9. WebSocket Handshake Auth ✅

Security without overhead:
- Authentication before connection established
- No per-message auth overhead
- Early rejection of invalid clients

### 10. Health Monitoring ✅

Device health tracking:
- Heartbeat mechanism
- Stale connection detection (60s threshold)
- Automatic cleanup

---

## Documented vs. Actual Comparison

### Response Format

| Aspect | Documented (CLAUDE.md) | Actual Implementation | Match? |
|--------|------------------------|------------------------|--------|
| Standard format | `{status, data?, error?, code?}` | 4 different patterns | ❌ No |
| Error format | `{status: 'error', error, code}` | `{error, message, details?}` | ❌ No |
| Success format | `{status: 'success', data}` | Varies by endpoint | ❌ No |

### WebSocket Events

| Aspect | Documented (CLAUDE.md) | Actual Implementation | Match? |
|--------|------------------------|------------------------|--------|
| Incoming events | Listed | Matches | ✅ Yes |
| Outgoing events | General description | 24 specific events | ⚠️ Partial |
| Event format | Not specified | Inconsistent wrapping | ❌ No |

### Authentication

| Aspect | Documented (CLAUDE.md) | Actual Implementation | Match? |
|--------|------------------------|------------------------|--------|
| JWT for HTTP | Yes | Yes | ✅ Yes |
| Token format | Not specified | Bearer token | ✅ Yes |
| WebSocket auth | Described | Handshake pre-auth | ✅ Yes |

### Architecture

| Aspect | Documented (CLAUDE.md) | Actual Implementation | Match? |
|--------|------------------------|------------------------|--------|
| Singleton services | Yes | Yes | ✅ Yes |
| Event-driven | Yes | Yes | ✅ Yes |
| Room-based broadcasting | Yes | Yes | ✅ Yes |

---

## Critical Questions for Next Phase

### Scanner Investigation

1. **How do scanners currently parse responses?**
   - Do they expect specific formats?
   - Are there hardcoded status checks?
   - What breaks if formats change?

2. **Which response patterns do scanners rely on?**
   - Player scanner: Likely Pattern A (scan endpoint)
   - GM scanner: Likely WebSocket events + Pattern B (transactions)

3. **Are there error handling patterns in scanners?**
   - Do they check `status` or `error` field?
   - Do they handle all 4 patterns?

4. **What would breaking changes impact?**
   - Deployed scanners in production?
   - Development/testing environments?
   - Offline functionality?

### Design Decision Analysis

1. **Why were different formats chosen?**
   - Domain-specific semantics (accepted/rejected vs success/error)?
   - Historical evolution (different developers/timelines)?
   - Intentional flexibility?

2. **Are any patterns objectively better?**
   - REST conventions?
   - Error handling best practices?
   - Client simplicity?

3. **What was the original intent?**
   - Check git history for context
   - Review any design documents
   - Understand constraints/requirements

---

## Next Steps

1. **Scanner Investigation** (02-scanner-analysis.md)
   - Analyze GM scanner API usage
   - Analyze player scanner API usage
   - Document breaking change risks
   - Identify critical dependencies

2. **Design Decision Analysis** (03-design-decisions.md)
   - Research why current patterns exist
   - Evaluate if choices were misguided
   - Consider REST best practices
   - Document hypotheses and findings

3. **Standardization Decisions** (04-alignment-decisions.md)
   - Work with user to choose target format
   - Decide on migration strategy
   - Document each decision with rationale

4. **Refactor Plan** (05-refactor-plan.md)
   - Create detailed implementation steps
   - Cross-reference current codebase
   - Identify test requirements
   - Plan rollout strategy

---

*Analysis completed: 2025-09-29*
*Next: Scanner module investigation*