# Scanner API Analysis

**Created**: 2025-09-30
**Status**: 🔄 In Progress - GM Scanner Complete, Player Scanner Pending
**Source**: Detailed investigation with atomic findings in work/FINDINGS-LOG.md

---

## Executive Summary

### GM Scanner Analysis (Complete)
- **Total Findings**: 25
- **Critical Issues**: 4 (transaction error handling, auth destructuring, event mismatch, missing error display)
- **WebSocket Events Analyzed**: 15 events with complete field usage documentation
- **HTTP Endpoints Analyzed**: 6 endpoints (session, video, admin ops, auth)
- **Error Handling**: Consistent pattern identified with 2 exceptions

### Player Scanner Analysis (Complete)
- **Total Findings**: 8 (including video trigger architecture clarification)
- **Critical Issues**: 0 - **Design is intentionally simple for ESP32 port**
- **HTTP Endpoints Analyzed**: 3 (scan, batch, status)
- **Pattern**: Fire-and-forget, minimal parsing, HTTP-only
- **Video Trigger**: CLIENT-SIDE decision from local tokens.json (not backend response)
- **Breaking Change Risk**: ZERO - ignores all response bodies by design
- **Key Insight**: Simplicity is a feature, not a bug (Arduino/ESP32 compatibility)

---

## GM Scanner Deep Dive

### Architecture Overview
- **Type**: Single-page PWA (260KB index.html)
- **Communication**: WebSocket (Socket.io) + HTTP (fetch)
- **Dual Mode**: Networked (with orchestrator) OR Standalone
- **Authentication**: JWT Bearer tokens via HTTP, then WebSocket handshake

---

## WebSocket Events Analysis

### 1. Authentication & Connection

#### gm:identified (Finding #8, #24)
**Purpose**: Authentication confirmation after handshake
**Format**: Unwrapped object
**Fields**:
- `data.sessionId` 🔴 REQUIRED (stored for status reporting)

**Issues**:
- No validation before storing
- sessionId only used for status reporting, not business logic
- Missed opportunity for session validation

**Backend Must Send**: `{ sessionId: string }`

---

#### heartbeat:ack (Finding #15)
**Purpose**: Keep-alive acknowledgment
**Format**: Any (payload ignored)
**Fields**: NONE - signal-only event

**Issues**: None - works well as-is

**Backend Can Send**: `{}` or `{ timestamp }` (optional)

---

### 2. Transaction Events

#### transaction:result (Finding #1, #19)
**Purpose**: Transaction processing result
**Format**: Unwrapped object
**Fields**:
- `result.status` - logged but NOT checked

**Issues**:
- 🔴 **CRITICAL BUG**: Result logged but never checked for errors
- Users don't see transaction failures
- No retry logic for failed transactions
- Queue sync doesn't listen for results at all

**Backend Sends**: `{ status, transactionId?, points?, ... }` (structure unclear)

**Required Action**: Scanner must check result.status and display errors to users

---

#### transaction:new (Finding #2, #3)
**Purpose**: New transaction broadcast (any scanner)
**Format**: WRAPPED `{event, data, timestamp}`
**Fields**:
- `eventData.data` or fallback to `eventData` (unwrapped)
- All transaction fields from Finding #2:
  - `transaction.timestamp` ✅
  - `transaction.scannerId` → normalized to `stationId`
  - `transaction.stationMode` ✅
  - `transaction.teamId` ✅
  - `transaction.tokenId` → also copied to `rfid`
  - `transaction.memoryType` → fallback to token lookup
  - `transaction.group` → fallback to token lookup
  - `transaction.valueRating` → fallback to token lookup
  - `transaction.isUnknown` → calculated if no token data

**Issues**:
- Field name inconsistencies (scannerId vs stationId, tokenId vs rfid)
- Scanner normalization layer masks API contract
- Backend MUST send enriched token fields (memoryType, group, valueRating)

**Backend Must Send**:
```javascript
{
  event: 'transaction:new',
  data: {
    id, tokenId, teamId, scannerId, stationMode, status,
    points, timestamp, memoryType, valueRating, group, tokenValue
  },
  timestamp
}
```

---

### 3. Scoring Events

#### score:updated (Finding #4)
**Purpose**: Team score update
**Format**: WRAPPED `{event, data, timestamp}`
**Fields**:
- `data.data.teamId` 🔴 REQUIRED (Map key)
- `data.data.currentScore` 🔴 REQUIRED
- `data.data.baseScore` 🔴 REQUIRED
- `data.data.bonusPoints` 🔴 REQUIRED
- `data.data.tokensScanned` 🔴 REQUIRED
- `data.data.completedGroups` 🔴 REQUIRED (array)
- `data.data.lastUpdate` 🔴 REQUIRED

**Issues**:
- All 7 fields REQUIRED with no fallbacks
- Unwrapping would break scanner

**Backend Must Send**:
```javascript
{
  event: 'score:updated',
  data: {
    teamId, currentScore, baseScore, bonusPoints,
    tokensScanned, completedGroups, lastUpdate
  },
  timestamp
}
```

---

#### scores:reset (Finding #9)
**Purpose**: Admin reset signal
**Format**: Any (payload ignored)
**Fields**: NONE - signal-only event

**Issues**: None - works well as-is

**Backend Can Send**: `{}` (payload ignored)

---

#### group:completed (Finding #10)
**Purpose**: Group completion bonus notification
**Format**: WRAPPED `{event, data, timestamp}`
**Fields**:
- `data.data.teamId` 🔴 REQUIRED
- `data.data.groupId` 🔴 REQUIRED
- `data.data.bonus` 🔴 REQUIRED (number for .toLocaleString())
- `data.data.multiplier` 🔴 REQUIRED

**Issues**:
- All 4 fields REQUIRED with no fallbacks
- Will crash if bonus is not a number
- No error handling for missing fields

**Backend Must Send**:
```javascript
{
  event: 'group:completed',
  data: { teamId, groupId, bonus, multiplier },
  timestamp
}
```

---

### 4. State Synchronization

#### state:sync (Finding #5)
**Purpose**: Full state synchronization
**Format**: Unwrapped GameState object
**Fields**:
- `state.currentVideo.tokenId` ⚠️ (optional)
- `state.systemStatus.orchestratorOnline` ⚠️ (optional boolean)
- `state.systemStatus.vlcConnected` ⚠️ (optional boolean)
- `state.scores[]` ⚠️ (optional array of score objects - reuses Finding #4 structure)
- `state.recentTransactions[]` ⚠️ (optional array - reuses Finding #2 structure)

**Issues**:
- CRITICAL DEPENDENCY CHAIN: Reuses score and transaction structures
- Changes to those formats cascade here
- All optional but no validation if exists

**Backend Should Send**:
```javascript
{
  currentVideo: { tokenId },
  systemStatus: { orchestratorOnline, vlcConnected },
  scores: [/* score objects */],
  recentTransactions: [/* transaction objects */]
}
```

---

#### state:update (Finding #6, #23)
**Purpose**: Delta state updates
**Format**: Object with optional properties
**Fields**:
- `data.newTransaction` ⚠️ (optional - delegates to Finding #2)
- `data.state.sessionId` ⚠️ (optional - tracked but not used)
- `data.state.gameMode` ⚠️ (optional - tracked but unclear purpose)

**Issues**:
- Generic wrapper pattern, unclear intent
- Redundant with specific events?
- gameMode tracking may be incomplete feature

**Backend Sends**: Structure unclear, seems underutilized

---

### 5. Admin Panel Events

#### session:update (Finding #20)
**Purpose**: Session change broadcast for admin panels
**Format**: Session object (same as HTTP)
**Fields**:
- `data.id` ✅ (same as Finding #16)
- `data.status` ✅ (same as Finding #16)

**Issues**:
- Duplicate of HTTP response data
- Unclear when sent vs relying on HTTP

**Backend Should Send**: Same format as POST/PUT /api/session responses

---

#### video:status (Finding #7)
**Purpose**: Video playback status for admin display
**Format**: Unwrapped object
**Fields**:
- `videoStatus.current` ⚠️ (optional, fallback to 'None')
- `videoStatus.queueLength` ⚠️ (optional, fallback to '0')

**Issues**: None - simple display-only, good fallbacks

**Backend Can Send**: `{ current, queueLength }`

---

### 6. Device Tracking

#### device:connected / device:disconnected (Finding #12, #25)
**Purpose**: Device connection tracking
**Format**: **MISMATCH DETECTED**
**Fields**:
- Main handler: Entire `data` as device object
- Admin handler: `data.devices` array (full list)

**Issues**:
- 🔴 **CRITICAL BUG**: Two handlers expect different structures!
- Main expects single device, admin expects full array
- One of these is wrong

**Backend Must Clarify**: Single device per event OR full list?

---

#### sync:full (Finding #13)
**Purpose**: Full device list sync
**Format**: Object with devices array
**Fields**:
- `data.devices` ⚠️ (optional array with defensive check)

**Issues**:
- Good defensive check ✅
- Must match device structure from Finding #12

**Backend Should Send**: `{ devices: [/* device objects */] }`

---

### 7. Other Events

#### team:created (Finding #11)
**Purpose**: Team creation notification
**Format**: Unknown (wrapped assumed)
**Fields**: NONE - only logged, never used

**Issues**:
- Event received but not utilized
- Incomplete feature or placeholder

**Backend Sends**: Unknown format, scanner doesn't use it

---

#### error (Finding #14)
**Purpose**: Server error notification
**Format**: Any (entire object logged)
**Fields**: NONE - no specific field access

**Issues**:
- 🔴 **CRITICAL**: Errors not shown to users (console only)
- No error type handling
- No recovery logic

**Backend Should Send**: `{ code, message, details? }`

**Required Action**: Scanner must display errors via UIManager

---

## HTTP Endpoints Analysis

### 1. Session Management

#### POST /api/session - Create Session (Finding #16)
#### PUT /api/session - Update Session (Finding #16)

**Response Expected**:
- `data.id` 🔴 REQUIRED (checked before processing)
- `data.status` ⚠️ (used with fallback to '-')

**Issues**:
- Silent failure if id missing (no error to user)
- Entire response stored (unknown additional fields)

**Backend Must Send**: `{ id, status, ...otherFields }`

---

### 2. Video Control (Finding #17)

#### POST /api/video/control

**Actions**: play, pause, stop, skip

**Response Expected**:
- **Error case**: `error.message` ⚠️ (optional, fallback)
- **Success case**: Response returned but NOT used

**Issues**: None - success responses ignored (WebSocket events used instead)

**Backend Can Send**: `{ success: true }` (ignored anyway)

---

### 3. Admin Operations (Finding #22)

#### POST /api/admin/reset-scores
#### POST /api/admin/clear-transactions

**Response Expected**:
- **Error case**: `error.message` ⚠️ (optional, fallback)
- **Success case**: Response returned but NOT used

**Issues**: None - consistent with video control pattern

**Backend Can Send**: `{ success: true }` (ignored)

---

### 4. Authentication (Finding #21)

#### POST /api/admin/auth

**Response Expected**:
- `response.token` 🔴 CRITICAL (destructured, no fallback)

**Issues**:
- 🔴 **CRITICAL BUG**: Destructuring crashes if token missing
- Error handling DIFFERENT from other endpoints (no error.message check)
- Generic "Invalid password" for any error

**Backend Must Send**: `{ token: string }`

**Required Action**: Add validation before destructuring

---

## Error Handling Patterns

### Standard HTTP Pattern (Finding #18)
```javascript
if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to [action]');
}
const data = await response.json();
```

**Used in**: Session, video, admin ops endpoints

**Issues**:
- 🔴 Errors thrown but not caught/displayed to users
- No error code handling
- No differentiation between error types

**Exceptions**:
1. Authentication endpoint (Finding #21) - no error.message check
2. Status checks - only check response.ok

---

### WebSocket Error Handling (Finding #14)
```javascript
socket.on('error', (error) => {
    console.error('Server error:', error);  // Only logs
});
```

**Issues**:
- 🔴 **CRITICAL**: Errors not shown to users
- No structured handling

---

## Critical Issues Summary

### 🔴 Critical Bugs (Must Fix)

1. **Transaction Error Handling** (Finding #19)
   - transaction:result event logged but never checked
   - Users don't see failures
   - No retry logic

2. **Authentication Token Destructuring** (Finding #21)
   - Destructuring crashes if token field missing
   - No validation

3. **Error Display Missing** (Finding #14, #18)
   - HTTP errors thrown but not caught
   - WebSocket errors only logged
   - Users see no error feedback

4. **Device Event Mismatch** (Finding #25)
   - Two handlers expect different structures
   - Likely broken device tracking

---

## Field Name Inconsistencies

### Backend → Scanner Mapping Issues (Finding #3)

| Backend Field | Scanner Expects | Scanner Normalizes To | Issue |
|--------------|-----------------|----------------------|--------|
| `scannerId` | `scannerId` or `stationId` | `stationId` | Inconsistent naming |
| `tokenId` | `tokenId` or `rfid` | Both `tokenId` AND `rfid` | Duplicated field |

**Recommendation**: Choose ONE standard name for each field

---

## Response Format Patterns

### Wrapped Format (WebSocket)
Used by: transaction:new, score:updated, group:completed

```javascript
{
  event: 'event-name',
  data: { /* actual data */ },
  timestamp: ISO8601
}
```

Scanner accesses via: `eventData.data` (with fallback to `eventData`)

---

### Unwrapped Format (WebSocket)
Used by: state:sync, video:status, session:update, device events

```javascript
{ /* data fields directly */ }
```

---

### Signal-Only Events (WebSocket)
Used by: scores:reset, heartbeat:ack

Payload ignored, only event receipt matters

---

### HTTP Response Formats
**Active endpoints** (session): `{ id, status, ...fields }`
**Command endpoints** (video, admin ops): Response ignored
**Auth endpoint**: `{ token }`
**Error responses**: `{ message, code?, details? }` (message is standard)

---

## Breaking Change Risk Matrix

### 🔴 CRITICAL RISK - Will Break Scanner

| Change | Events/Endpoints Affected | Impact |
|--------|--------------------------|---------|
| Unwrap transaction:new | transaction:new | Scanner breaks |
| Unwrap score:updated | score:updated | Scoreboard breaks |
| Unwrap group:completed | group:completed | Notifications break |
| Remove any of 7 score fields | score:updated, state:sync | Display breaks |
| Remove enriched token fields | transaction:new, state:sync | Token data missing |
| Change error response format | All HTTP endpoints | Error messages break |
| Remove token field | /api/admin/auth | Auth crashes |
| Remove id field | /api/session | Session ops silent fail |

---

### 🟡 MEDIUM RISK - Degraded Functionality

| Change | Impact |
|--------|---------|
| Field name changes (scannerId, tokenId) | Normalization fails, bad data |
| Missing sessionId in gm:identified | Status reporting breaks |
| Device event structure changes | Device tracking may break (already mismatched) |

---

### 🟢 LOW RISK - Compatible Changes

| Change | Reason |
|--------|---------|
| Video control success response format | Ignored by scanner |
| Admin ops success response format | Ignored by scanner |
| Signal event payloads (scores:reset, heartbeat) | Payloads ignored |
| Adding optional fields | Scanner has defensive checks |

---

## Recommendations Summary

### Immediate Fixes Required

1. **Fix transaction error handling** - Check result.status, show errors
2. **Fix auth destructuring** - Validate token exists before destructuring
3. **Add error display** - Catch HTTP errors, show WebSocket errors to users
4. **Resolve device event mismatch** - Align handlers or fix backend

### API Alignment Priorities

1. **Standardize field names** - Choose scannerId OR stationId, tokenId OR rfid
2. **Standardize error format** - Ensure all endpoints send `{ message, code?, details? }`
3. **Document wrapped vs unwrapped** - Explicit rules for when to use each
4. **Validate critical fields** - Add validation in scanner and document requirements

### Architecture Improvements

1. **Reduce redundancy** - state:update vs specific events
2. **Complete features** - team:created not used, gameMode unclear
3. **Session validation** - Use sessionId for validation/reconnection
4. **Error recovery** - Add retry logic, user guidance

---

---

## Player Scanner Analysis

### Architecture Overview
- **Type**: Progressive Web App
- **Main File**: index.html + js/orchestratorIntegration.js (separate module)
- **Communication**: HTTP only (no WebSocket)
- **Dual Mode**: Networked (with orchestrator) OR Standalone
- **Offline Support**: localStorage queue with batch processing
- **Design Philosophy**: ⚠️ **INTENTIONALLY SIMPLE** - designed for future Arduino/ESP32 port
  - Minimal response parsing keeps code simple
  - Fire-and-forget pattern reduces complexity
  - HTTP-only avoids WebSocket complexity
  - LocalStorage queue = simple buffer

---

## Video Trigger Architecture (Finding #33)

**CRITICAL CLARIFICATION**: Video triggering is **CLIENT-SIDE** decision, not server-driven

**How It Works**:
1. Player scans token (QR or NFC)
2. Scanner loads token from **LOCAL tokens.json**
3. Scanner checks `if (token.video)` exists in local data
4. If video exists AND orchestrator connected:
   - Show "Memory Processing..." modal
   - POST scan to backend (fire-and-forget)
   - Hide modal after 2 seconds
5. Backend receives scan, queues video (scanner doesn't wait for/check response)

**Key Insight**:
- Backend `videoPlaying` response field is **UNUSED** by scanner
- Scanner makes decision from local tokens.json, not backend response
- Backend uses scan request to trigger video queue, response is informational only
- Pattern is ESP32-friendly: local decision, simple POST, no response parsing needed

**Implications**:
- Backend response `videoPlaying` field is optional (can remove or keep)
- Video triggering works independently of response format
- ESP32 version will follow same pattern: check local data, POST, show local UI

---

## HTTP Endpoints Analysis

### 1. Scan Endpoint (Finding #26, #27, #32)

#### POST /api/scan

**Request Sent**:
```javascript
{
  tokenId: string,
  teamId: string,
  scannerId: string,
  timestamp: ISO8601
}
```

**Response Expected** (from backend docs):
- `status` - acceptance status
- `message` - user message
- `tokenId` - token scanned
- `mediaAssets` - media info
- `videoPlaying` - video trigger flag
- `waitTime` - wait time if rejected
- `queued` - queued flag

**Scanner Field Usage**:
- **NONE** - Response logged but NEVER parsed

**Design Rationale** (Arduino/ESP32 Port Consideration):
- ✅ Fire-and-forget pattern = simple ESP32 code
- ✅ No response parsing = minimal memory/CPU on ESP32
- ✅ HTTP status check only = easy to implement
- ✅ Queue-and-retry = robust for unstable connections
- 🤔 **Trade-off**: Simplicity vs user feedback

**Issues Re-evaluated**:
- ~~🔴 CRITICAL BUG~~ → 🟡 **INTENTIONAL DESIGN CHOICE** (for portability)
- User feedback sacrificed for implementation simplicity
- ESP32 port will have same fire-and-forget behavior
- PWA mirrors ESP32 constraints (good pattern consistency)

**Considerations**:
- Players rely on standalone mode display (local tokens.json) for feedback
- Orchestrator integration is "bonus feature" not primary UX
- Scan logging happens locally regardless of backend response

**Offline Behavior**:
Returns synthetic response: `{status: 'offline', queued: true}`

**Error Behavior**:
Returns synthetic response: `{status: 'error', queued: true, error: message}`

**Backend Can Send**: Any format (ignored for simplicity) - maintains flexibility for future needs

---

### 2. Batch Endpoint (Finding #28)

#### POST /api/scan/batch

**Request Sent**:
```javascript
{
  transactions: [
    { tokenId, teamId, scannerId, timestamp },
    ...
  ]
}
```

**Response Expected**: `{ results: [{...}, {...}] }`

**Scanner Field Usage**:
- HTTP status via `response.ok` ✅
- **Response body**: NEVER parsed

**Design Rationale** (Arduino/ESP32 Port):
- ✅ All-or-nothing = simple ESP32 logic
- ✅ No JSON parsing = saves ESP32 memory
- ✅ HTTP status sufficient for queue management
- ✅ Re-queue entire batch on failure = robust fallback

**Issues Re-evaluated**:
- ~~🟡 Inefficient~~ → ✅ **INTENTIONAL** (ESP32-friendly)
- Partial success handling adds complexity unsuitable for ESP32
- All-or-nothing is SIMPLER and more reliable for constrained devices

**Backend Should Send**: `{ results: [] }` (optional, currently ignored for simplicity)

---

### 3. Status Check (Finding #29)

#### GET /api/state/status

**Response Expected**: Any (ignored)

**Scanner Field Usage**:
- HTTP status via `response.ok` ✅
- **Response body**: NEVER accessed

**Design Rationale** (Arduino/ESP32 Port):
- ✅ **PERFECT** for ESP32 implementation
- ✅ Minimal overhead - just HTTP status code check
- ✅ No parsing required
- ✅ Standard pattern for health checks

**Issues**: None - this is IDEAL design for portability ✅

**Backend Can Send**: `{}` or state data (ignored) - maintains flexibility

---

## Offline Queue Analysis (Finding #31)

**Structure**:
```javascript
{
  tokenId: string,
  teamId: string,
  timestamp: number,  // Date.now()
  retryCount: number  // tracked but never used
}
```

**Persistence**: localStorage ('offline_queue' key)
**Max Size**: 100 (FIFO removal)
**Batch Processing**: 10 at a time with 1-second delays

**Design Rationale** (Arduino/ESP32 Port):
- ✅ Simple struct = easy ESP32 EEPROM/SPIFFS storage
- ✅ FIFO = straightforward circular buffer on ESP32
- ✅ Max 100 = reasonable ESP32 memory constraint

**Issues**:
- 🟡 retryCount is dead code - should be removed (cleanup needed)
- ✅ FIFO overflow is INTENTIONAL - prevents memory issues on ESP32
- 🟢 Silent drop is acceptable for constrained device (better than crash)

---

## Error Handling Analysis (Finding #32)

**Pattern**:
```javascript
// ALL errors just log to console
catch (error) {
    console.error('Scan failed:', error);
    // No UI feedback
}
```

**Design Rationale** (Arduino/ESP32 Port):
- ✅ Console logging = Serial monitor on ESP32
- ✅ No UI error handling = simpler ESP32 code
- ✅ Errors queued for retry = robust failure handling
- 🤔 **Trade-off**: Debugging ease vs user feedback

**Issues Re-evaluated**:
- ~~🔴 CRITICAL~~ → 🟡 **INTENTIONAL SIMPLICITY** (for portability)
- PWA could enhance with UI errors WITHOUT breaking ESP32 pattern
- ESP32 version will have same console-only errors (Serial monitor)
- Consider: Optional error callback for PWA enhancement layer?

---

## UI Integration (Finding #30)

**Connection Status**:
- CustomEvents: `orchestrator:connected`, `orchestrator:disconnected`
- Simple UI toggle: "Online" / "Offline"

**Issues**:
- No queue size display
- Users don't know scans are pending

---

## Player Scanner Issues (Re-evaluated for ESP32 Port Context)

### 🟡 Enhancement Opportunities (Not Bugs)

1. **Scan Response Ignored** (Finding #26)
   - ~~CRITICAL BUG~~ → **INTENTIONAL** for ESP32 simplicity
   - PWA could add optional UI feedback layer
   - ESP32 version will maintain fire-and-forget pattern
   - **Decision needed**: Keep PWA identical to ESP32, or enhance PWA UX?

2. **No Error Display** (Finding #32)
   - ~~CRITICAL BUG~~ → **INTENTIONAL** for ESP32 simplicity
   - Console logging = Serial monitor pattern
   - PWA could add optional error UI
   - **Decision needed**: Enhanced PWA vs consistent ESP32 pattern?

### 🟢 Minor Improvements

1. **Missing Queue Status** (Finding #30)
   - Could show queue count without complexity
   - ESP32 could display on LCD/OLED
   - Low complexity addition

2. **Dead Code Cleanup** (Finding #31)
   - Remove unused retryCount field

### ✅ Working As Intended

1. **Batch Processing** (Finding #28)
   - All-or-nothing = ESP32-friendly
   - Simple and robust

2. **Status Check** (Finding #29)
   - Perfect for ESP32 implementation

---

## Breaking Change Risk: Player Scanner

### 🟢 EXTREMELY LOW RISK - All Endpoints

| Endpoint | Risk Level | Reason |
|----------|-----------|---------|
| POST /api/scan | 🟢 ZERO RISK | Response ignored by design - any format works |
| POST /api/scan/batch | 🟢 ZERO RISK | Response body ignored by design - any format works |
| GET /api/state/status | 🟢 ZERO RISK | Response body ignored by design - any format works |

**Key Insight**: Player Scanner's simplicity is a **FEATURE not a BUG**
- Minimal parsing = easy ESP32 port
- Fire-and-forget = robust on unstable connections
- HTTP-only = simpler than WebSocket
- Backend has complete freedom to change response formats
- ESP32 version will maintain this pattern

**API Alignment Implications**:
- Player Scanner imposes ZERO constraints on backend response formats
- Backend can standardize formats for GM Scanner without affecting Player Scanner
- Future ESP32 implementation will work with any backend response structure

---

## Player Scanner Recommendations (ESP32-Aware)

### Code Cleanup (Low Priority)

1. **Remove dead code** - Remove unused retryCount field from queue structure

### Optional PWA Enhancements (Without Breaking ESP32 Pattern)

**IF enhanced UX desired for PWA version**:
1. **Optional UI feedback layer** - Parse scan response for display (PWA only)
2. **Optional error UI** - Show errors to users (PWA only)
3. **Queue status display** - Show pending scan count (works for ESP32 LCD too)

**Maintain ESP32 Compatibility**:
- Keep fire-and-forget core logic
- UI enhancements as optional wrapper layer
- ESP32 version uses same HTTP patterns
- Console logging remains for ESP32 Serial monitor

### Design Decisions Needed

1. **PWA Enhancement vs ESP32 Parity**:
   - Option A: Keep PWA identical to ESP32 (current approach)
   - Option B: Add PWA-specific UI layer while maintaining ESP32-compatible core

2. **Queue Overflow Handling**:
   - Current: Silent FIFO drop (ESP32-safe)
   - Alternative: Add warning (PWA), maintain silent drop (ESP32)

---

## Next Steps

1. ✅ GM Scanner analysis complete (25 findings)
2. ✅ Player Scanner analysis complete (7 findings)
3. 🔄 Cross-reference backend implementation (next)
4. ⏳ Create final alignment decisions
5. ⏳ Write refactor plan

---

*Status*: Scanner Analysis Complete - 33 findings total (25 GM + 8 Player)
*Last Updated*: 2025-09-30

**Key Architectural Discovery**: Player Scanner video triggering is CLIENT-SIDE (local tokens.json), NOT server-driven. Backend scan request triggers video queue, but scanner doesn't parse response. This confirms ESP32-friendly fire-and-forget pattern is intentional and complete.