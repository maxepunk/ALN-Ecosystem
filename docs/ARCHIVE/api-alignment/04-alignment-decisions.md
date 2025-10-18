# API Alignment Decisions

**Created**: 2025-09-30
**Status**: ✅ COMPLETE - All Decisions Finalized
**Approach**: Contract-First with OpenAPI 3.1 + AsyncAPI 2.6

---

## Summary

**12 Strategic Decisions Made**:
1. ✅ Overall Strategy: Contract-First Approach
2. ✅ WebSocket Envelope: Standard Wrapped Format
3. ✅ HTTP Response Format: RESTful Resource Pattern
4. ✅ Field Naming: deviceId, tokenId, id (standardized)
5. ✅ video:status: Fixed structure with queueLength
6. ✅ state:update: Eliminated (redundant event)
7. ✅ session:update: Full resource + correct field name
8. ✅ device events: Fixed scanner bug
9. ✅ Player Scanner: Keep fire-and-forget pattern
10. ✅ Error Display: Add user-facing error UI
11. ✅ Minor Issues: Fix all validations and dead code
12. ✅ Contracts: Full OpenAPI + AsyncAPI in backend/contracts/

**Impact Summary**:
- 🔴 **Breaking Changes**: Field names, event structures, response formats
- 🟢 **Simplifications**: Removed state:update event, standardized patterns
- 🟡 **Additions**: Error display, validations, queueLength field
- 📝 **Documentation**: Formal contracts for all APIs

**Next Phase**: Create OpenAPI and AsyncAPI contracts, then refactor plan

---

## Strategic Decision

**Decision 1: Overall Standardization Strategy**

**Choice**: **Contract-First Approach (Option D)**

**Rationale**:
- Pre-production system - opportunity to fix everything properly
- Already begun documentation-driven approach
- Prevents future drift through formal contracts
- Best practices with meticulous contract design
- Goal: Minimal architectural complexity through well-defined contracts

**Commitment**:
- Define OpenAPI 3.1 specification for HTTP endpoints
- Define AsyncAPI 2.6 specification for WebSocket events
- Implement all APIs to match contracts exactly
- Avoid over-engineering through meticulous, focused contract design

---

## Contract Design Decisions

### Decision 2: WebSocket Event Envelope Format

**Choice**: **Standard Wrapped Envelope (Option A)**

**Contract Standard**:
```javascript
{
  event: string,        // Event type identifier
  data: object,         // Event-specific payload
  timestamp: string     // ISO8601 server timestamp
}
```

**Rationale**:
- Modern AsyncAPI best practice pattern
- Enables generic event handlers and middleware
- Allows standard metadata (correlation IDs, versions, etc.)
- GM Scanner already supports with `eventData.data || eventData` fallback
- Consistent structure across all WebSocket events
- Better logging, debugging, and tracing capabilities

**Impact**:
- ✅ Keep wrapped: transaction:new, score:updated, group:completed, team:created, video:status, state:update (6 events)
- 🔄 Wrap currently unwrapped: state:sync, session:update, error, device:connected, device:disconnected, gm:identified, heartbeat:ack, sync:full, offline:queue:processed (9 events)
- 🔧 Scanner updates: Remove fallback logic (eventData.data || eventData) - always use eventData.data

**Breaking Changes**:
- 9 unwrapped events need wrapping
- Scanner needs to update handlers for unwrapped events (currently expect direct payload)

---

### Decision 3: HTTP Response Format Standardization

**Choice**: **RESTful Resource Pattern (Option A)**

**Contract Standard**:

For resource endpoints (GET/POST/PUT on resources):
```javascript
// Return resource directly
{ id, name, status, ...resourceFields }
```

For operation endpoints (actions like scan, control):
```javascript
// Return operation result directly
{ status: 'accepted', message: string, ...operationFields }
```

Success/failure communicated via HTTP status codes:
- 200 OK - Successful operation
- 201 Created - Resource created
- 202 Accepted - Async operation accepted
- 409 Conflict - Resource conflict
- etc.

**Rationale**:
- OpenAPI / RESTful best practice
- HTTP status codes communicate success/failure (no redundant wrapper needed)
- Less nesting, cleaner payloads
- Session endpoints already follow this pattern
- Simpler client code (no unwrapping needed)
- Industry standard approach

**Impact**:
- ✅ Keep as-is: Session endpoints (already RESTful), auth endpoint
- 🔄 Simplify: Scan endpoints (remove status wrapper, use HTTP codes)
- 🔄 Simplify: Admin operations (remove success: true wrapper)
- 🔄 Update: Transaction endpoints (remove status/data wrapper)

**Error Format** (Keep consistent):
```javascript
{
  error: 'ERROR_CODE',
  message: string,
  details?: array
}
```

**Breaking Changes**:
- Scan endpoint responses change from `{status, message, ...}` to direct result
- Admin operation responses lose `success: true` wrapper
- Transaction endpoints lose `status/data` wrapper
- Clients must check HTTP status code instead of `success` field

---

### Decision 4: Field Naming Conventions

**Choice**: Standardized, semantic field names

**Contract Standard**:

1. **Device Identifier**: `deviceId`
   - Generic term, works for all device types (GM stations, player scanners, future devices)
   - Replaces: `scannerId`, `stationId`, `gmStation`

2. **Token Identifier**: `tokenId`
   - Semantic, not implementation-specific
   - Replaces: `rfid`, `videoId`

3. **Session Identifier**: `id`
   - RESTful convention (use `id` within resource context)
   - Use `sessionId` only in cross-resource references
   - Replaces inconsistent `sessionId` in session resource responses

**Rationale**:
- Generic over specific (`deviceId` not `scannerId` - future-proofs for non-scanner devices)
- Semantic over technical (`tokenId` not `rfid` - tokens may not always be RFID)
- RESTful conventions (`id` within resource, `{resource}Id` for foreign keys)
- Clear, unambiguous, maintainable

**Impact**:
- 🔄 Backend: Rename `scannerId` → `deviceId` everywhere
- 🔄 Backend: Ensure `tokenId` used consistently (already mostly done)
- 🔄 Backend: Session resources use `id`, cross-references use `sessionId`
- 🔄 Scanner: Remove normalization layer (stationId, rfid aliases)
- 🔄 Scanner: Update all field references to new names
- 🔄 Frontend Admin: Update field references

**Breaking Changes**:
- All APIs change field names
- Scanner normalization layer removed (breaking internal code)
- Any hardcoded field name references break

---

### Decision 5: Fix video:status Event Structure

**Context**: CRITICAL MISMATCH #1 - Backend and scanner have incompatible structures

**Choice**: Backend field names + add missing queueLength field

**Contract Standard**:
```javascript
{
  event: 'video:status',
  data: {
    status: 'loading' | 'playing' | 'completed' | 'error' | 'paused' | 'idle',
    queueLength: number,        // Current queue size
    tokenId?: string,           // Current video token (if playing/loading)
    duration?: number,          // Video duration in seconds
    expectedEndTime?: string,   // ISO8601 timestamp when video expected to end
    progress?: number,          // 0-100 percentage
    error?: string             // Error message if status is 'error'
  },
  timestamp: string
}
```

**Rationale**:
- `status` is clearer and more semantic than `current`
- `queueLength` essential for UI display (was missing)
- Keep rich metadata (duration, progress, expectedEndTime) for better UX
- Wrapped format per Decision 2
- Backend mostly correct, just needs to add queueLength

**Impact**:
- 🔄 Backend: Add queueLength to video:status emissions (query videoQueueService)
- 🔄 Scanner: Update field name `current` → `status`
- 🔄 Scanner: Update to use wrapped format `eventData.data.status`
- ✅ Backend: Keep all existing metadata fields (already good)

**Breaking Changes**:
- Scanner video display code must update field references
- Scanner must handle wrapped format (already does for most events)

---

### Decision 6: Fix state:update Event (Contract Violation)

**Context**: CRITICAL MISMATCH #2 - Backend sends full state, scanner expects delta. Fundamental contract violation.

**Choice**: **Eliminate state:update event entirely (Option B)**

**Rationale**:
- **Contract violation**: Backend sends full GameState, scanner expects delta with newTransaction
- **Redundant architecture**: All state changes already covered by specific events:
  - Transaction changes → `transaction:new` ✅
  - Score changes → `score:updated` ✅
  - Video changes → `video:status` ✅
  - Session changes → `session:update` ✅
  - Full sync → `state:sync` ✅
- **Scanner doesn't use it meaningfully**: Just delegates to transaction:new handler
- **Simpler architecture**: Removes confusing, poorly-defined event
- **Minimal complexity principle**: One event per concern, not overlapping events

**Contract Decision**:
- ❌ Remove `state:update` event from AsyncAPI specification
- ✅ Keep all specific domain events (transaction:new, score:updated, etc.)
- ✅ Keep `state:sync` for full state synchronization on connect

**Impact**:
- 🔄 Backend: Remove state:update emissions from stateService
- 🔄 Backend: Remove state:update broadcast listener
- 🔄 Scanner: Remove state:update event handler
- ✅ No functionality lost: All state changes still propagated via specific events

**Breaking Changes**:
- Backend stops emitting state:update
- Scanner must remove state:update handler
- Any code depending on state:update must use specific events instead

---

### Decision 7: Fix session:update Field Name and Structure

**Context**: CRITICAL MISMATCH #3 - Field name mismatch (sessionId vs id) and incomplete data

**Choice**: **Full Session Resource (Option B)**

**Contract Standard**:
```javascript
{
  event: 'session:update',
  data: {
    id: string,                           // Changed from sessionId
    name: string,
    startTime: string,                    // ISO8601
    endTime: string | null,               // ISO8601 or null
    status: 'active' | 'paused' | 'ended',
    metadata: object
  },
  timestamp: string
}
```

**Rationale**:
- **Consistency**: Matches HTTP GET/POST /api/session response format exactly
- **RESTful principle**: Session resource should look identical across HTTP and WebSocket
- **Complete data**: Scanner has all info needed for display without additional fetch
- **Fixes field name**: Uses `id` per Decision 4 (RESTful convention)
- **Better UX**: UI can update all session fields, not just status

**Impact**:
- 🔄 Backend: Change `sessionId` → `id`
- 🔄 Backend: Send full session object (not just id + status)
- 🔄 Backend: Use session.toAPIResponse() for consistency
- 🔄 Scanner: Update to expect full session resource
- ✅ Wrapped format per Decision 2

**Breaking Changes**:
- Field name changes from `sessionId` to `id`
- Payload structure changes from minimal to full resource
- Scanner session update handler must process full session object

---

### Decision 8: Fix device Events Scanner Bug

**Context**: CRITICAL MISMATCH #4 - Scanner admin handler bug (expects array, backend sends object)

**Choice**: **Keep Backend Structure, Fix Scanner Bug (Option A)**

**Contract Standard**:
```javascript
{
  event: 'device:connected',
  data: {
    deviceId: string,              // Per Decision 4 (not scannerId)
    type: 'gm' | 'player',
    name: string,
    ipAddress: string
  },
  timestamp: string
}

{
  event: 'device:disconnected',
  data: {
    deviceId: string,
    reason: 'manual' | 'timeout' | 'error'
  },
  timestamp: string
}
```

**Rationale**:
- **Backend is correct**: Single device event = single device object (semantic clarity)
- **Scanner bug**: Admin handler expects `data.devices` array (Finding #25)
- **Main handler correct**: Scanner's main handler already expects single device object
- **One event per device**: Devices connect/disconnect individually, not in batches
- **Wrapped format**: Per Decision 2

**Impact**:
- ✅ Backend: Already correct, just apply wrapped format per Decision 2
- ✅ Backend: Already uses `deviceId` field name (matches Decision 4)
- 🔄 Scanner: Fix admin handler bug - expect single device object, not array
- ✅ Scanner: Main handler already correct

**Breaking Changes**:
- Scanner admin handler must be fixed (expects wrong structure)
- Wrapped format applied per Decision 2

---

### Decision 9: Player Scanner Response Handling

**Context**: Player Scanner ignores ALL backend responses by design (ESP32 compatibility)

**Choice**: **Keep Fire-and-Forget Pattern (Option A)**

**Contract Standard**:
- Player Scanner endpoints (POST /api/scan, POST /api/scan/batch, GET /api/state/status) return standard responses
- **Contract explicitly documents**: Player Scanner sends requests but does not parse responses
- Video triggering remains CLIENT-SIDE (scanner decides from local tokens.json)
- Backend responses provided for:
  - API consistency
  - Future non-ESP32 clients
  - Debugging/logging

**Rationale**:
- **Intentional design**: Fire-and-forget enables ESP32 portability (minimal parsing)
- **Already works**: Scanner operates successfully without response parsing
- **Robust**: No network dependency for client-side decisions
- **Simple**: Minimal scanner complexity
- **Documented pattern**: OpenAPI spec will clearly mark this behavior

**Impact**:
- ✅ Backend: Keep current response formats (no changes needed)
- ✅ Scanner: Keep fire-and-forget pattern (no changes needed)
- 📝 OpenAPI: Document that Player Scanner ignores responses
- 📝 Add comment in scanner code explaining design decision

**Breaking Changes**:
- None (preserving existing design)

**Note**: This is a **documented architectural decision**, not a bug. Future clients (non-ESP32) MAY parse responses, but Player Scanner will not.

---

### Decision 10: Scanner Error Display

**Context**: Both scanners only log errors to console - users never see errors (Findings #14, #18, #32)

**Choice**: **Add User-Facing Error Display (Option A)**

**Contract Standard**:
- All scanner errors must be displayed to users via UI
- Error display methods:
  - **Toast notifications** for transient errors (network, temporary failures)
  - **Error banners** for persistent errors (auth required, session not found)
  - **Status indicators** for connection state (online/offline)
- Error messages must be:
  - User-friendly (not technical stack traces)
  - Actionable (tell user what to do)
  - Dismissible (don't block workflow)

**Rationale**:
- **Critical UX gap**: Users currently have no feedback when errors occur
- **Pre-production opportunity**: Perfect time to add proper error handling
- **Live event critical**: GMs need to see auth failures, network issues, validation errors during event
- **Professional behavior**: Console-only errors are not acceptable for production tool
- **Debugging**: Easier troubleshooting during live events

**Implementation Requirements**:

**GM Scanner**:
- Display WebSocket error events in UI
- Show HTTP error responses (auth, session, video control)
- Connection status indicator (connected/disconnected)
- Error toast/banner component

**Player Scanner**:
- Even with fire-and-forget: show connection errors, offline mode status
- Network status indicator
- Simple error display (compatible with ESP32 simplicity goal)

**Impact**:
- 🔄 Both Scanners: Add error display UI components
- 🔄 Both Scanners: Update error handlers to call display functions
- 🔄 Both Scanners: Add connection status indicators
- 📝 Design simple, non-intrusive error UI

**Breaking Changes**:
- None (pure addition)

**Note**: For Player Scanner, keep display minimal and optional (can be disabled for ESP32 if needed).

---

### Decision 11: Fix Minor Issues and Add Validations

**Context**: Several minor issues found during investigation that should be fixed

**Choice**: **Fix All Minor Issues (Option A)**

**Issues to Fix**:

**1. gm:identified sessionId Validation**
- **Problem**: Backend sends `sessionId: session?.id` (undefined if no session)
- **Scanner**: Stores without validation
- **Fix**: Add defensive check
  ```javascript
  if (data.sessionId) {
    this.currentSessionId = data.sessionId;
  }
  ```

**2. Authentication Token Destructuring** (Finding #21)
- **Problem**: Scanner destructures `const { token } = response` without validation
- **Crash scenario**: AUTH_REQUIRED error returns `{error, message}` not `{token}`
- **Fix**: Validate before destructuring
  ```javascript
  if (!response.token) {
    throw new Error(response.message || 'Authentication failed');
  }
  const { token } = response;
  ```

**3. Dead Code - retryCount Field** (Finding #31)
- **Problem**: Player Scanner offline queue has unused `retryCount` field
- **Never read, never incremented**
- **Fix**: Remove field entirely from offline queue item structure

**Rationale**:
- **Contract-first principle**: Fix all known issues during standardization
- **Prevent crashes**: Validation prevents runtime errors
- **Clean codebase**: Remove dead code now while we're refactoring
- **Small effort, high value**: These are simple fixes with significant benefit
- **Pre-production opportunity**: Perfect time to fix minor issues

**Impact**:
- 🔄 GM Scanner: Add sessionId validation in gm:identified handler
- 🔄 GM Scanner: Add token validation in auth handler
- 🔄 Player Scanner: Remove retryCount field from offline queue
- 📝 Document validation patterns in code comments

**Breaking Changes**:
- None (pure improvements)

---

### Decision 12: Contract Documentation Format and Location

**Context**: Contract-First approach requires formal API specifications

**Choice**: **Full OpenAPI 3.1 + AsyncAPI 2.6 Specifications (Option A)**

**Contract Standards**:
- **OpenAPI 3.1** for HTTP REST endpoints
- **AsyncAPI 2.6** for WebSocket events
- Machine-readable YAML format
- Industry-standard specifications

**File Structure and Location**:

**Primary Location** (Source of Truth):
```
backend/contracts/
├── openapi.yaml          # HTTP API contract (OpenAPI 3.1)
├── asyncapi.yaml         # WebSocket events contract (AsyncAPI 2.6)
└── README.md            # Contract usage guide
```

**Documentation Reference**:
```
docs/api-alignment/contracts/
└── README.md            # Points to backend/contracts/ (avoids duplication)
```

**Rationale for Location**:
- **backend/contracts/**: Contracts live with implementation
- **Close to code**: Easy to reference during backend development
- **Version controlled**: Changes tracked with code changes
- **Single source of truth**: No duplication between docs and backend
- **Standard practice**: Contracts typically live in API project root or dedicated folder
- **CI/CD friendly**: Can validate backend against contracts in tests

**Benefits**:
- **Auto-generated documentation**: Tools can generate API docs from specs
- **Request/response validation**: Can validate in tests and runtime
- **Client code generation**: Can generate TypeScript types, SDK stubs
- **Industry standard**: Understood by all developers and tools
- **Clear contracts**: Unambiguous, machine-readable specifications
- **Tooling support**: Swagger UI, Redoc, Postman, etc.

**Impact**:
- 📝 Create backend/contracts/ directory
- 📝 Write comprehensive OpenAPI specification (all HTTP endpoints)
- 📝 Write comprehensive AsyncAPI specification (all WebSocket events)
- 📝 Create README explaining how to use/validate contracts
- 📝 Reference contracts from docs/api-alignment/
- 🔄 Consider adding contract validation to test suite

**Breaking Changes**:
- None (pure addition)

**Next Steps**:
1. Create backend/contracts/ directory structure
2. Write OpenAPI 3.1 specification based on decisions 1-11
3. Write AsyncAPI 2.6 specification based on decisions 1-11
4. Add contract validation to backend tests (optional but recommended)

---

