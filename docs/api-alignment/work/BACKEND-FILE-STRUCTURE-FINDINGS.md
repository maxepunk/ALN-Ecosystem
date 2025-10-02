# File Structure Investigation Findings

**Created**: 2025-10-01
**Status**: In Progress - Phase 6.1 (Backend)
**Purpose**: Atomic findings log for file/code organization analysis

---

## Investigation Scope

**Phase 6.1: Backend File Structure**
- Routes (7 files, ~1,608 lines)
- Services (8 files, ~3,860 lines)
- Models (8 files, ~2,019 lines)
- WebSocket (8 files, ~1,904 lines)
- Middleware (2 files, ~279 lines)
- Utils (2 files, ~406 lines)
- Storage (4 files, ~512 lines)
- Core (3 files, ~558 lines)

**Total Backend: 46 files, ~10,646 lines**

---

## Finding Template

```markdown
---
**Finding #N**: [One-line summary]
**Category**: Architecture / Anti-Pattern / Duplication / Missing Abstraction / Good Pattern
**Location**: file:line-range
**Severity**: 🔴 Critical / 🟡 Important / 🟢 Note / 🔵 Info
**Contract Alignment**: [Which decision/contract this relates to]

**Code/Pattern**:
```[language]
// relevant code or pattern description
```

**Issue**: [What's wrong - be direct, no sugar-coating]

**Impact**: [Why this matters for refactor]

**Target State**: [What should exist per our decisions]

**Action Required**: [What needs to be done]

**Related Findings**: #X, #Y
---
```

---

# BACKEND FINDINGS START HERE

---

## Phase 6.1.1: File Inventory & Architecture Overview

---
**Finding #1**: Complete Backend File Inventory
**Category**: Info
**Location**: backend/src/
**Severity**: 🔵 Info
**Contract Alignment**: Foundation for all analysis

**Directory Structure**:
```
backend/src/
├── config/           1 file,   153 lines
├── docs/             1 file,   474 lines
├── middleware/       2 files,  279 lines
├── models/           8 files, 2,019 lines
├── routes/           7 files, 1,608 lines
├── services/         8 files, 3,860 lines
├── storage/          4 files,   512 lines
├── utils/            2 files,   406 lines
├── websocket/        8 files, 1,904 lines
├── app.js                      222 lines
├── index.js                      7 lines
└── server.js                   329 lines

TOTAL: 46 files, ~10,646 lines
```

**Route Files**:
- adminRoutes.js (459 lines) - 11 admin HTTP endpoints
- docsRoutes.js (27 lines) - API documentation
- scanRoutes.js (239 lines) - 2 scan endpoints
- sessionRoutes.js (270 lines) - 5 session endpoints
- stateRoutes.js (127 lines) - 2 state endpoints
- tokenRoutes.js (39 lines) - 1 token endpoint
- transactionRoutes.js (239 lines) - 4 transaction endpoints
- videoRoutes.js (228 lines) - 1 video endpoint

**Service Files**:
- discoveryService.js (131 lines) - UDP network discovery
- offlineQueueService.js (399 lines) - Offline transaction queue
- persistenceService.js (363 lines) - State persistence
- sessionService.js (433 lines) - Session management
- stateService.js (675 lines) - Global state coordination
- tokenService.js (115 lines) - Token data loading
- transactionService.js (584 lines) - Transaction processing
- videoQueueService.js (698 lines) - Video queue management
- vlcService.js (593 lines) - VLC control

**WebSocket Files**:
- adminEvents.js (230 lines) - Admin WebSocket handlers
- broadcasts.js (427 lines) - Event broadcasting
- deviceTracking.js (166 lines) - Device connection tracking
- eventWrapper.js (46 lines) - Event envelope wrapper
- gmAuth.js (163 lines) - GM authentication
- listenerRegistry.js (125 lines) - Event listener management
- roomManager.js (339 lines) - Socket.io room management
- socketServer.js (50 lines) - WebSocket server setup
- videoEvents.js (308 lines) - Video event handlers

**Model Files**:
- adminConfig.js (275 lines)
- deviceConnection.js (243 lines)
- gameState.js (281 lines)
- session.js (291 lines)
- teamScore.js (229 lines)
- token.js (117 lines)
- transaction.js (170 lines)
- videoQueueItem.js (212 lines)

**Observation**:
- Backend is well-organized into logical directories ✅
- Large service files (600-700 lines) suggest possible tangled responsibilities
- adminRoutes.js is 459 lines (largest route file) - likely contains eliminated endpoints
- eventWrapper.js EXISTS (46 lines) - Decision #2 helper already present

**Next Steps**: Systematic deep dive into each category

---

## Phase 6.1.2: Route Files Analysis

### Category: Response Format Anti-Patterns

---
**Finding #2**: SEVEN Different Response Patterns - Architectural Chaos
**Category**: Anti-Pattern
**Location**: All route files
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #3 (RESTful HTTP - consistent response format)

**Pattern A - Domain-Specific Status** (scanRoutes.js):
```javascript
// Success (lines 111-117)
res.status(200).json({
  status: 'accepted',  // Domain value, not HTTP-standard
  message: '...',
  tokenId: '...',
  mediaAssets: {...},
  videoPlaying: boolean
});

// Offline queue (lines 30-36)
res.status(202).json({
  status: 'queued',
  queued: true,
  offlineMode: true,
  transactionId: '...',
  message: '...'
});

// Rejection (lines 98-105)
res.status(409).json({
  status: 'rejected',
  message: '...',
  tokenId: '...',
  videoPlaying: true,
  waitTime: number
});
```

**Pattern B - Generic Success/Error** (transactionRoutes.js, some adminRoutes):
```javascript
// Success (lines 63-70)
res.status(202).json({
  status: 'success',
  data: {
    transactionId: '...',
    status: 'accepted',
    points: number
  }
});

// Error (lines 21-24)
res.status(400).json({
  status: 'error',
  error: 'message'
});
```

**Pattern C - Simple Success Flag** (videoRoutes.js, some adminRoutes):
```javascript
// Success (lines 68-70, 201)
res.json({
  success: true,
  message: '...',
  currentStatus: '...'  // Additional fields vary
});
```

**Pattern D - Error-Only** (all files):
```javascript
// Error (common pattern)
res.status(400).json({
  error: 'VALIDATION_ERROR',  // No status field
  message: '...',
  details: [...]
});
```

**Pattern Session - Unknown Format** (sessionRoutes.js):
```javascript
// Lines 29, 54, 102, 172, 247
res.json(session.toAPIResponse());
// Format unknown - must investigate models/session.js
```

**Pattern State - Unwrapped** (stateRoutes.js):
```javascript
// Line 76
res.json(stateJSON);  // No envelope at all
```

**Pattern Token - Custom** (tokenRoutes.js):
```javascript
// Lines 25-29
res.json({
  tokens: [...],
  count: number,
  lastUpdate: ISO8601
});
```

**Issue**: SEVEN different response patterns across 7 route files. Client code must implement 7 parsing strategies. This is architectural chaos identified in Phase 1.

**Impact**:
- Impossible to create consistent client SDK
- Error handling fragmented across patterns
- No shared response builder
- Manual JSON construction in every endpoint (high duplication)

**Target State** (per Decision #3 - RESTful HTTP):
```javascript
// Success responses - HTTP codes communicate status
res.status(200).json({
  // Resource data directly, or { data: resource }
});

// Error responses - use standard error codes
res.status(4xx/5xx).json({
  error: 'ERROR_CODE',
  message: 'human-readable',
  details: [...]  // optional
});
```

**Action Required**:
1. Create `src/utils/responseBuilder.js`
2. Implement: `success(data)`, `error(code, message, details?)`
3. Refactor ALL route files to use builder
4. Eliminate all manual res.json() calls

**Related Findings**: #3, #4, #11

---
**Finding #3**: No Shared Response Builder - Manual Construction Everywhere
**Category**: Missing Abstraction
**Location**: All route files (every res.json() call)
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #3 (RESTful HTTP)

**Duplication Count**:
- scanRoutes.js: 8 manual response constructions (lines 30-36, 39-43, 98-105, 111-117, 120-126, 136-140, 143-146, 237)
- transactionRoutes.js: 13 manual constructions
- adminRoutes.js: 21 manual constructions
- sessionRoutes.js: 15 manual constructions
- stateRoutes.js: 4 manual constructions
- tokenRoutes.js: 2 manual constructions
- videoRoutes.js: 11 manual constructions

**Total**: ~74 manual response constructions across 7 files

**Issue**: Every endpoint manually builds responses with `res.status().json({...})`. No shared utility. Phase 1 identified this as critical issue.

**Impact**:
- High duplication (~74 instances)
- Inconsistent patterns (Finding #2)
- Difficult to refactor to contracts
- Error-prone (easy to forget fields)

**Target State**:
```javascript
// src/utils/responseBuilder.js
const success = (res, data, status = 200) => {
  return res.status(status).json(data);
};

const error = (res, code, message, details, status = 400) => {
  const response = { error: code, message };
  if (details) response.details = details;
  return res.status(status).json(response);
};

// Usage in routes
const { success, error } = require('../utils/responseBuilder');
return success(res, { tokenId, videoQueued: true });
return error(res, 'VALIDATION_ERROR', 'Missing tokenId', errors, 400);
```

**Action Required**:
1. Create responseBuilder.js utility
2. Refactor all 74 manual constructions
3. Enforce via linting rule (no direct res.json())

**Related Findings**: #2, #4

---

### Category: Authentication Anti-Patterns

---
**Finding #4**: Manual Auth Duplication - 92 Lines of Copy-Paste
**Category**: Anti-Pattern / Duplication
**Location**: sessionRoutes.js:68-90, 130-152, 205-227; videoRoutes.js:18-39
**Severity**: 🔴 Critical
**Contract Alignment**: Phase 1 Finding #3 (use requireAdmin middleware)

**Duplication**:
```javascript
// sessionRoutes.js POST / (lines 68-90) - 23 lines
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return res.status(401).json({
    error: 'AUTH_REQUIRED',
    message: 'auth required',
  });
}
const token = authHeader.substring(7);
const decoded = authMiddleware.verifyToken(token);
if (!decoded) {
  return res.status(401).json({
    error: 'AUTH_REQUIRED',
    message: 'Invalid or expired token',
  });
}
req.admin = decoded;

// sessionRoutes.js PUT / (lines 130-152) - EXACT DUPLICATE 23 lines
// sessionRoutes.js PUT /:id (lines 205-227) - EXACT DUPLICATE 23 lines
// videoRoutes.js POST /control (lines 18-39) - EXACT DUPLICATE 22 lines
```

**Total**: 92 lines of duplicated auth code (23 + 23 + 23 + 22 + 1 line difference)

**Issue**: Phase 1 identified this as high-severity issue. Manual JWT verification instead of using `requireAdmin` middleware. 4 EXACT duplicates.

**Compare to Admin Routes** (correct pattern):
```javascript
// adminRoutes.js (lines 60, 110, 140, etc.)
router.post('/reset-scores', requireAdmin, async (req, res) => {
  // req.admin already populated ✅
});
```

**Impact**:
- Code duplication (92 lines wasted)
- Maintenance burden (4 places to update)
- Security risk (inconsistent auth checks)
- Violates DRY principle
- Makes refactor harder

**Target State**:
```javascript
// Should be ONE line per endpoint
router.post('/', requireAdmin, async (req, res) => {
  // req.admin already available
});
```

**Action Required**:
1. Remove manual auth from sessionRoutes.js POST, PUT, PUT /:id
2. Remove manual auth from videoRoutes.js POST /control
3. Add `requireAdmin` middleware to route definitions
4. Delete 88 lines of duplicated code

**Related Findings**: #8

---
**Finding #5**: x-admin-token Static Token Anti-Pattern
**Category**: Anti-Pattern / Security Risk
**Location**: transactionRoutes.js:190-196
**Severity**: 🔴 Critical
**Contract Alignment**: Phase 1 Finding #4 (use requireAdmin middleware)

**Code**:
```javascript
// DELETE /api/transaction/:id (lines 187-196)
router.delete('/:id', async (req, res) => {
  try {
    // Check admin auth
    const adminToken = req.headers['x-admin-token'];
    if (!adminToken || adminToken !== require('../config').adminToken) {
      return res.status(401).json({
        status: 'error',
        error: 'Unauthorized'
      });
    }
    // ...
```

**Issue**:
- Uses custom `x-admin-token` header (not standard `Authorization: Bearer`)
- Static token comparison (not JWT verification)
- Different auth mechanism than ALL other endpoints
- Phase 1 identified this as security risk

**Comparison**:
- All other admin endpoints: `Authorization: Bearer <jwt>`
- This endpoint: `x-admin-token: <static-string>`

**Impact**:
- Security risk (static token can't be revoked, no expiry)
- Inconsistent auth mechanism
- Client confusion (two auth methods)
- BUT: This endpoint is ELIMINATED per Phase 4.9

**Target State**:
DELETE endpoint is eliminated. If it existed, should use:
```javascript
router.delete('/:id', requireAdmin, async (req, res) => {
  // Standard JWT auth via middleware
});
```

**Action Required**:
1. DELETE transactionRoutes.js entirely (all 4 endpoints eliminated)
2. Anti-pattern disappears with file deletion

**Related Findings**: #6 (transaction routes elimination)

---

### Category: Eliminated Endpoints (Per Phase 4.9)

---
**Finding #6**: Transaction Routes - ALL 4 Endpoints ELIMINATED
**Category**: Architecture
**Location**: transactionRoutes.js (entire file, 239 lines)
**Severity**: 🟡 Important
**Contract Alignment**: Phase 4.9 Essential API List

**Endpoints**:
1. POST /api/transaction/submit (lines 17-86) → ❌ ELIMINATED
2. GET /api/transaction/history (lines 92-142) → ❌ ELIMINATED
3. GET /api/transaction/:id (lines 148-181) → ❌ ELIMINATED
4. DELETE /api/transaction/:id (lines 187-238) → ❌ ELIMINATED

**Why Eliminated** (from 09-essential-api-list.md):
- POST /api/transaction/submit: GM Scanner uses WebSocket `transaction:submit` event (not HTTP)
- GET endpoints: Not in essential 24 APIs
- DELETE endpoint: Admin commands moved to WebSocket `gm:command`

**Impact**:
- Entire file deleted in refactor
- 239 lines removed
- Response Pattern B anti-patterns disappear
- x-admin-token anti-pattern disappears

**Action Required**:
1. DELETE backend/src/routes/transactionRoutes.js
2. Remove from app.js route registration
3. Update OpenAPI docs to remove endpoints

**Related Findings**: #5 (x-admin-token), #2 (Pattern B)

---
**Finding #7**: Admin Routes - 9 of 11 Endpoints ELIMINATED
**Category**: Architecture
**Location**: adminRoutes.js (459 lines, 404 lines to be removed)
**Severity**: 🟡 Important
**Contract Alignment**: Phase 4.9 Essential API List

**Endpoints Analysis**:
1. POST /api/admin/auth (lines 20-54) → ✅ ESSENTIAL #1
2. POST /api/admin/reset-scores (lines 60-104) → ❌ ELIMINATED (WebSocket gm:command)
3. POST /api/admin/clear-transactions (lines 110-134) → ❌ ELIMINATED (WebSocket gm:command)
4. POST /api/admin/stop-all-videos (lines 140-175) → ❌ ELIMINATED (WebSocket gm:command)
5. POST /api/admin/offline-mode (lines 181-212) → ❌ ELIMINATED (not essential)
6. GET /api/admin/sessions (lines 217-231) → ❌ ELIMINATED (multi-session not supported)
7. DELETE /api/admin/session/:id (lines 236-267) → ❌ ELIMINATED (WebSocket gm:command)
8. GET /api/admin/devices (lines 272-304) → ❌ ELIMINATED (not essential)
9. POST /api/admin/reset (lines 309-357) → ❌ ELIMINATED (WebSocket gm:command)
10. GET /api/admin/logs (lines 362-388) → ✅ ESSENTIAL #7
11. POST /api/admin/config (lines 393-448) → ❌ ELIMINATED (not essential)

**Result**: Keep 2 endpoints (auth, logs), eliminate 9 endpoints

**Why Eliminated**:
- Admin commands (reset-scores, clear-transactions, stop-videos, reset, delete-session): Wrong transport per Phase 4.75. Admin Panel should use WebSocket `gm:command` event, not HTTP POST.
- Multi-session endpoints (sessions list, delete by ID): ONE session at a time constraint
- Offline-mode toggle: Not essential (offline detection is automatic)
- Config update: Pre-event configuration only, not runtime

**Impact**:
- File shrinks from 459 to ~90 lines (keep auth + logs + module boilerplate)
- 404 lines removed (~88% reduction)
- Response Pattern C+B anti-patterns mostly disappear

**Action Required**:
1. Delete 9 endpoint handlers from adminRoutes.js
2. Keep only auth + logs
3. Simplify file structure

**Related Findings**: #2 (mixed patterns), #13 (admin commands → WebSocket)

---
**Finding #8**: Session Routes - 4 of 5 Endpoints ELIMINATED + Auth Duplication
**Category**: Architecture / Anti-Pattern
**Location**: sessionRoutes.js (270 lines, 216 lines to be removed)
**Severity**: 🟡 Important
**Contract Alignment**: Phase 4.9 Essential API List + Decision #4

**Endpoints Analysis**:
1. GET /api/session (lines 18-37) → ✅ ESSENTIAL #4
2. GET /api/session/:id (lines 43-62) → ❌ ELIMINATED (multi-session not supported)
3. POST /api/session (lines 68-124) → ❌ ELIMINATED (WebSocket gm:command)
4. PUT /api/session (lines 130-199) → ❌ ELIMINATED (WebSocket gm:command)
5. PUT /api/session/:id (lines 205-269) → ❌ ELIMINATED (multi-session not supported)

**Result**: Keep 1 endpoint (GET current session), eliminate 4 endpoints

**Why Eliminated**:
- POST /api/session: Session creation via WebSocket `gm:command` (per Phase 4.75 admin commands)
- PUT endpoints: Session updates via WebSocket `gm:command` or `session:update` event
- GET /api/session/:id: Multi-session not supported (ONE session constraint)
- PUT /api/session/:id: Multi-session not supported

**Combined Issues**:
- 4 eliminated endpoints = 216 lines to remove
- 69 lines of manual auth duplication (Finding #4) also removed

**Impact**:
- File shrinks from 270 to ~40 lines (keep GET current + module boilerplate)
- 230 lines removed (~85% reduction)
- Manual auth duplication disappears
- session.toAPIResponse() still used (need to verify format)

**Action Required**:
1. Delete 4 endpoint handlers (GET /:id, POST, PUT, PUT /:id)
2. Keep only GET /api/session (lines 18-37)
3. Verify session.toAPIResponse() format matches contracts (Finding #16)

**Related Findings**: #4 (manual auth), #16 (toAPIResponse format)

---
**Finding #9**: Video Routes - Single Endpoint ELIMINATED
**Category**: Architecture / Anti-Pattern
**Location**: videoRoutes.js (228 lines, entire file to be removed)
**Severity**: 🟡 Important
**Contract Alignment**: Phase 4.9 Essential API List

**Endpoint**:
- POST /api/video/control (lines 18-227) → ❌ ELIMINATED

**Why Eliminated**:
- Admin video commands moved to WebSocket `gm:command` event (per Phase 4.75)
- Wrong transport (HTTP POST should be WebSocket)

**Combined Issues in This File**:
- Manual auth duplication (lines 18-39, same as sessionRoutes)
- action/command field confusion (lines 42-46, Phase 1 Finding #5)
- Test token creation duplication (lines 87-104)
- Response Pattern C (lines 68-201)

**Impact**:
- Entire file deleted (228 lines)
- Manual auth duplication instance removed
- Test code pollution removed
- Pattern C anti-pattern removed

**Action Required**:
1. DELETE backend/src/routes/videoRoutes.js
2. Remove from app.js route registration

**Related Findings**: #4 (manual auth), #11 (test pollution), #2 (Pattern C)

---
**Finding #10**: State Routes - 1 of 2 Endpoints ELIMINATED
**Category**: Architecture
**Location**: stateRoutes.js (127 lines, 42 lines to be removed)
**Severity**: 🟢 Note
**Contract Alignment**: Phase 4.9 Essential API List

**Endpoints Analysis**:
1. GET /api/state (lines 29-84) → ✅ ESSENTIAL #6
2. GET /api/status (lines 90-126) → ❌ ELIMINATED

**Why Eliminated**:
- GET /api/status: Orchestrator status info (not in essential 24)
- GET /api/state: Debugging/recovery tool (ESSENTIAL)

**Issue with Essential Endpoint**:
- Line 76: `res.json(stateJSON)` - Unwrapped response (no envelope)
- Phase 1 Finding #6 identified this
- ETag caching (lines 58-72) complicates wrapping

**Impact**:
- Remove GET /api/status handler (42 lines)
- Keep GET /api/state but need to evaluate wrapping
- Decision needed: Does wrapping break ETag caching?

**Action Required**:
1. Delete GET /api/status handler
2. Investigate: Can we wrap GET /api/state without breaking ETag?
3. If not, document as exception to response format

**Related Findings**: #2 (unwrapped pattern)

---

### Category: Test Code Pollution

---
**Finding #11**: Test Code Scattered Across Route Files
**Category**: Anti-Pattern
**Location**: Multiple files
**Severity**: 🟡 Important
**Contract Alignment**: Pre-production cleanup

**Test Code Instances**:

**scanRoutes.js**:
- Lines 48-51: Test environment service initialization
- Lines 54-61: Auto-create test session (7 lines)
- Lines 74-88: Test token creation (15 lines)
- Lines 189-202: Duplicate test token creation in batch (14 lines)

**videoRoutes.js**:
- Lines 87-104: Test token creation (18 lines)

**Pattern**:
```javascript
// Common pattern
if (process.env.NODE_ENV === 'test' && ...) {
  // Test-specific logic that shouldn't be in production code
}
```

**Issue**:
- Test logic pollutes production route handlers
- Duplicated test token creation (3 instances)
- Makes route handlers harder to read
- Violates separation of concerns

**Impact**:
- Harder to understand route logic
- Test code could accidentally run in production
- Duplication increases maintenance burden

**Target State**:
- Route handlers contain only production logic
- Test setup in test files using beforeEach/afterEach
- Test fixtures in separate test utility files

**Action Required**:
1. Move test session creation to test setup
2. Move test token creation to test fixtures
3. Remove all `if (NODE_ENV === 'test')` blocks from routes
4. Clean route handlers to production-only logic

**Related Findings**: #6, #9 (eliminated routes also had test pollution)

---

### Category: Minor Issues

---
**Finding #12**: Token Routes - Wrong Route Path
**Category**: Bug
**Location**: tokenRoutes.js:15
**Severity**: 🟢 Note
**Contract Alignment**: Essential API #5

**Code**:
```javascript
// Line 15
router.get('/api/tokens', (req, res) => {
  // Should be '/' not '/api/tokens'
});
```

**Issue**: Route path includes '/api/tokens' but router is already mounted at '/api' in app.js. This creates double path or incorrect mounting.

**Expected Pattern**:
```javascript
// tokenRoutes.js
router.get('/', (req, res) => {  // Just '/'
});

// app.js
app.use('/api/tokens', tokenRoutes);  // Full path in app.js
```

**Impact**:
- Likely works due to app.js mounting, but inconsistent with other routes
- Violates Express routing conventions

**Action Required**:
1. Change line 15 from `router.get('/api/tokens', ...)` to `router.get('/', ...)`
2. Verify app.js mounting is correct

**Related Findings**: None

---

### Category: Summary Statistics

---
**Finding #13**: Route File Elimination Summary
**Category**: Info
**Location**: All route files
**Severity**: 🔵 Info
**Contract Alignment**: Phase 4.9 Essential API List

**Current State** (29 HTTP endpoints across 7 files):
- scanRoutes.js: 2 endpoints
- transactionRoutes.js: 4 endpoints
- adminRoutes.js: 11 endpoints
- sessionRoutes.js: 5 endpoints
- stateRoutes.js: 2 endpoints
- tokenRoutes.js: 1 endpoint
- videoRoutes.js: 1 endpoint
- docsRoutes.js: 2 endpoints (documentation, not counted)

**Target State** (8 HTTP endpoints across 5 files):
- scanRoutes.js: 2 endpoints ✅ (POST /api/scan, POST /api/scan/batch)
- transactionRoutes.js: DELETED ❌
- adminRoutes.js: 2 endpoints ✅ (POST /api/admin/auth, GET /api/admin/logs)
- sessionRoutes.js: 1 endpoint ✅ (GET /api/session)
- stateRoutes.js: 1 endpoint ✅ (GET /api/state)
- tokenRoutes.js: 1 endpoint ✅ (GET /api/tokens)
- videoRoutes.js: DELETED ❌
- docsRoutes.js: 2 endpoints ✅ (GET /api/docs, GET /api-docs)
- NEW: healthRoutes.js: 1 endpoint (GET /health) - need to check if exists

**Elimination Statistics**:
- **21 out of 29 HTTP endpoints eliminated (72% reduction)**
- **2 route files deleted entirely** (transactionRoutes, videoRoutes)
- **~870 lines of route code removed**

**Line Count Changes**:
- adminRoutes.js: 459 → ~90 lines (369 removed)
- sessionRoutes.js: 270 → ~40 lines (230 removed)
- stateRoutes.js: 127 → ~85 lines (42 removed)
- transactionRoutes.js: 239 → DELETED (239 removed)
- videoRoutes.js: 228 → DELETED (228 removed)
- **Total**: 1,323 lines → ~453 lines (870 removed, 66% reduction)

**Files Remaining**:
- scanRoutes.js (239 lines, minimal changes)
- tokenRoutes.js (39 lines, one-line fix)
- adminRoutes.js (~90 lines after cleanup)
- sessionRoutes.js (~40 lines after cleanup)
- stateRoutes.js (~85 lines after cleanup)
- docsRoutes.js (27 lines, unchanged)

**Action Required**: This is the route refactor scope for Phase 7

**Related Findings**: #6, #7, #8, #9, #10

---

## Phase 6.1.2 Complete - Routes Analysis Done

**Next**: Phase 6.1.3 - Service Files Analysis (singleton usage, responsibilities, dependencies)

---

## Phase 6.1.3: Service Files Analysis

### Category: Singleton Pattern Inconsistency

---
**Finding #14**: Inconsistent Service Export Patterns
**Category**: Anti-Pattern / Inconsistency
**Location**: All service files
**Severity**: 🟡 Important
**Contract Alignment**: Phase 1 Finding #7 (singleton pattern usage)

**Pattern A - Singleton Instance Export** (7 services):
```javascript
// sessionService.js:430, transactionService.js:582, stateService.js:676,
// offlineQueueService.js:397, persistenceService.js:364,
// videoQueueService.js:696, vlcService.js:591
module.exports = new SessionService();

// Some add test helpers
module.exports.resetForTests = () => module.exports.reset();
```

**Pattern B - Class Constructor Export** (1 service):
```javascript
// discoveryService.js:132
module.exports = DiscoveryService;  // NOT instantiated!
```

**Pattern C - Object with Functions** (1 service):
```javascript
// tokenService.js:110-116
module.exports = {
  loadTokens,
  getTestTokens,
  parseGroupMultiplier,
  extractGroupName,
  calculateTokenValue
};
```

**Issue**: Phase 1 identified this inconsistency. 7 services export singleton instances (correct), but discoveryService exports CLASS (requires manual instantiation) and tokenService exports utility object (stateless functions).

**Impact**:
- Inconsistent import patterns across codebase
- discoveryService requires `new DiscoveryService()` at call site
- tokenService is stateless (no getInstance() possible)
- Confusing for developers (which pattern to use?)

**Target State**:
All services should export singleton instances consistently:
```javascript
class ServiceName extends EventEmitter {
  // ...
}

module.exports = new ServiceName();
```

**Action Required**:
1. discoveryService: Export singleton instance (not class)
2. tokenService: Evaluate if it should be a service or stay as utilities
3. Standardize pattern across all 9 services

**Related Findings**: None

---
**Finding #15**: Field Name Violation - scannerId vs deviceId
**Category**: Anti-Pattern
**Location**: Multiple service files
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #4 (standardized field names - use deviceId)

**Current Usage - scannerId** (WRONG):
```javascript
// stateService.js:151
scannerId: transaction.scannerId,  // Comment says "Required field per data model"

// offlineQueueService.js:84
scannerId: scanLog.scannerId,

// offlineQueueService.js:151
scannerId: scanLog.scannerId,
```

**Current Usage - deviceId** (CORRECT):
```javascript
// sessionService.js:366, 369, 374, 376
removeDevice(deviceId) {
  this.currentSession.removeDevice(deviceId);
  this.emit('device:removed', deviceId);
}
```

**Issue**: Services use BOTH `scannerId` AND `deviceId` inconsistently. Decision #4 mandates `deviceId` everywhere. The comment "Required field per data model" in stateService is WRONG - the data model should use `deviceId` per our contracts.

**Impact**:
- Violates Decision #4
- Inconsistent with contracts (all specify `deviceId`)
- Scanner normalization layer masks this (GM Scanner converts scannerId → stationId)
- Breaks contract compliance

**Target State** (per Decision #4):
```javascript
// All services must use deviceId
deviceId: transaction.deviceId,
deviceId: scanLog.deviceId,
```

**Action Required**:
1. Global search/replace: `scannerId` → `deviceId` in ALL services
2. Update Transaction model (Finding #16 will investigate)
3. Update all service methods to use `deviceId`
4. Remove incorrect "per data model" comments

**Related Findings**: #16 (model field names), Decision #4

---

### Category: Test Code Pollution (Services)

---
**Finding #16**: Test Code Scattered in Service Files
**Category**: Anti-Pattern
**Location**: 5 service files, 6 instances
**Severity**: 🟡 Important
**Contract Alignment**: Pre-production cleanup

**Test Code Instances**:

**transactionService.js:69-95** (27 lines):
```javascript
if (!token && process.env.NODE_ENV === 'test') {
  const tokenId = transaction.tokenId;
  if (tokenId.startsWith('TEST_') ||
      tokenId.startsWith('ORDER_') ||
      tokenId.startsWith('TIME_') ||
      tokenId.startsWith('RATE_') ||
      tokenId.startsWith('MEM_') ||
      tokenId === 'AFTER_LIMIT') {
    // Create a mock token for testing
    const Token = require('../models/token');
    const isVideoToken = tokenId.startsWith('TEST_VIDEO_') ||
                         tokenId === 'TEST_VIDEO_TX' ||
                         tokenId.startsWith('MEM_VIDEO_');
    token = new Token({
      id: tokenId,
      name: `Test Token ${tokenId}`,
      value: 10,
      memoryType: 'visual',
      mediaAssets: isVideoToken ? { video: `/test/videos/${tokenId}.mp4` } : {},
      metadata: isVideoToken ? { duration: 30 } : {},
    });
  } else if (tokenId === 'invalid_token') {
    token = null;
  }
}
```

**videoQueueService.js:45, 115** (2 instances):
```javascript
if (process.env.NODE_ENV === 'test') {
  // Test environment service initialization
}
```

**sessionService.js:420-423** (4 lines):
```javascript
if (process.env.NODE_ENV === 'test') {
  await persistenceService.delete('session:current');
  await persistenceService.delete('gameState:current');
}
```

**offlineQueueService.js:387-389** (3 lines):
```javascript
if (process.env.NODE_ENV === 'test') {
  await persistenceService.delete('offlineQueue:queue');
}
```

**persistenceService.js:39** (1 line):
```javascript
const storageType = process.env.NODE_ENV === 'test' ? 'memory' : 'file';
```

**Total**: 6 instances across 5 service files

**Issue**:
- Test logic pollutes production service code (same as routes)
- Test token creation is HUGE (27 lines in transactionService)
- Storage type selection in persistenceService is acceptable (minimal)
- Rest should be in test setup

**Impact**:
- Makes services harder to understand
- Test code could run in production (if NODE_ENV misconfigured)
- Duplication with route test code (Finding #11)

**Target State**:
- Services contain only production logic
- Test fixtures in test utility files
- Test setup in beforeEach/afterEach hooks
- persistenceService storage selection is OK (architectural decision)

**Action Required**:
1. Move test token creation to test/fixtures/tokens.js
2. Move test data cleanup to test setup (beforeEach)
3. Remove test blocks from transactionService, sessionService, offlineQueueService, videoQueueService
4. Keep persistenceService storage selection (valid architectural pattern)

**Related Findings**: #11 (route test pollution)

---

### Category: Service Architecture Patterns

---
**Finding #17**: EventEmitter Pattern - Good Architecture
**Category**: Good Pattern
**Location**: All major services
**Severity**: 🟢 Note
**Contract Alignment**: Architecture best practice

**Pattern**:
```javascript
// All major services (7 of 9)
class ServiceName extends EventEmitter {
  constructor() {
    super();
    // State initialization
  }

  async someMethod() {
    // Do work
    this.emit('event:name', data);  // Emit events for decoupling
  }
}
```

**Services Using EventEmitter**:
- sessionService ✅
- stateService ✅
- transactionService ✅
- offlineQueueService ✅
- videoQueueService ✅
- vlcService ✅
- persistenceService ✅

**Services NOT Using EventEmitter**:
- tokenService (stateless utilities, doesn't need events)
- discoveryService (network utility, doesn't need events)

**Benefits**:
- Decouples services from WebSocket broadcasting
- broadcasts.js listens to service events
- Clean separation of concerns
- Testable (can verify events emitted)

**Observation**: This is GOOD architecture. Phase 1 noted this as a strength (Finding #8 in 01-current-state.md).

**Action Required**: None (preserve this pattern)

**Related Findings**: None (positive finding)

---
**Finding #18**: Service Responsibilities - Generally Good Separation
**Category**: Good Pattern
**Location**: All service files
**Severity**: 🟢 Note
**Contract Alignment**: Architecture best practice

**Service Responsibilities**:

| Service | Lines | Responsibility | Status |
|---------|-------|----------------|--------|
| sessionService | 433 | Session lifecycle management | ✅ Clear |
| transactionService | 584 | Transaction processing, scoring | ✅ Clear |
| stateService | 675 | Global state coordination | ⚠️ Large |
| videoQueueService | 698 | Video queue + VLC control | ⚠️ Large |
| vlcService | 593 | VLC HTTP API integration | ✅ Clear |
| offlineQueueService | 399 | Offline transaction queue | ✅ Clear |
| persistenceService | 363 | State persistence (file/memory) | ✅ Clear |
| tokenService | 115 | Token data loading | ✅ Clear |
| discoveryService | 131 | UDP network discovery | ✅ Clear |

**Large Services**:
- **stateService (675 lines)**: Coordinates ALL state updates, handles debouncing, persistence, event listening. May have tangled responsibilities.
- **videoQueueService (698 lines)**: Manages queue AND controls VLC. Could be split into queue management + VLC orchestration.

**Observation**: Most services have clear, focused responsibilities. The two largest (stateService, videoQueueService) may benefit from refactoring, but not critical.

**Action Required**:
1. Investigate stateService: Can state coordination be simplified?
2. Investigate videoQueueService: Should VLC control be separated from queue management?
3. Not blocking for Phase 7 (can refactor later)

**Related Findings**: None

---

### Category: Service Dependencies & Circular Imports

---
**Finding #19**: Circular Service Dependencies - Require Inside Methods
**Category**: Anti-Pattern
**Location**: Multiple services
**Severity**: 🔴 Critical
**Contract Alignment**: Architecture anti-pattern

**Pattern**:
```javascript
// sessionService.js:57-59 (inside createSession method)
const transactionService = require('./transactionService');
const stateService = require('./stateService');
transactionService.resetScores();

// stateService.js:54, 88 (inside methods)
const sessionService = require('./sessionService');
const transactionService = require('./transactionService');

// Multiple services (inside methods)
const videoQueueService = require('./videoQueueService');
```

**Issue**: Services use `require()` INSIDE methods to avoid circular dependency deadlocks. This is a CODE SMELL indicating circular dependencies exist.

**Circular Dependency Graph** (from code analysis):
```
sessionService → transactionService → sessionService (circular!)
sessionService → stateService → sessionService (circular!)
stateService → transactionService → stateService (circular!)
stateService → videoQueueService → stateService (circular!)
offlineQueueService → stateService → offlineQueueService (circular!)
```

**Why This Happens**:
- Services need each other for coordination
- Top-level `require()` causes deadlock (module.exports = undefined during circular load)
- Require-inside-method delays loading until after all modules initialized

**Impact**:
- Hard to understand dependencies
- Can't see dependency graph from imports
- Fragile (easy to break if refactoring)
- Makes testing harder (can't easily mock)

**Target State**:
Break circular dependencies using:
1. **Event-driven communication** (already partially implemented with EventEmitter!)
2. **Dependency injection** (pass services to init())
3. **Service locator pattern** (central registry)
4. **Layered architecture** (clear dependency direction)

**Action Required**:
1. Map full dependency graph (Finding #21 will create this)
2. Choose dependency-breaking strategy
3. Refactor to eliminate circular requires
4. Update service initialization

**Related Findings**: #21 (dependency map)

---

### Category: TokenService Analysis

---
**Finding #20**: TokenService - Stateless Utilities Masquerading as Service
**Category**: Architecture
**Location**: tokenService.js (115 lines)
**Severity**: 🟢 Note
**Contract Alignment**: Architecture clarity

**Current Implementation**:
```javascript
// tokenService.js - exports object with functions
module.exports = {
  loadTokens,           // Loads from submodule
  getTestTokens,        // Returns test fixtures
  parseGroupMultiplier, // Utility function
  extractGroupName,     // Utility function
  calculateTokenValue   // Utility function
};
```

**Observation**:
- No state (no class, no instance)
- All pure functions (input → output)
- No EventEmitter (no events to emit)
- Called by other services, not a service itself

**Actual Use**:
```javascript
// transactionService.js:25-30
async init(tokens = []) {
  // Receives tokens from caller, doesn't load them itself
  this.tokens.clear();
  tokens.forEach(token => {
    this.tokens.set(token.id, new Token(token));
  });
}

// app.js initialization calls tokenService.loadTokens()
```

**Issue**: tokenService is NOT a service - it's a **utility module** for token loading and calculation. The name is misleading.

**Impact**:
- Misleading name (not a service)
- Doesn't fit service pattern (no state, no events, no singleton)
- But functionality is correct

**Target State**:
Rename to clarify purpose:
```javascript
// src/utils/tokenLoader.js  OR  src/loaders/tokenLoader.js
module.exports = {
  loadTokens,
  parseGroupMultiplier,
  extractGroupName,
  calculateTokenValue
};

// Move getTestTokens to test/fixtures/tokens.js
```

**Action Required**:
1. Rename tokenService.js → utils/tokenLoader.js
2. Move getTestTokens() to test fixtures
3. Update imports across codebase
4. Optional (not critical for Phase 7)

**Related Findings**: #14 (singleton inconsistency)

---

## Phase 6.1.3 Complete - Services Analysis Done

**Services Analysis Summary**:
- **7 findings documented** (#14-#20)
- **Singleton pattern**: 7 consistent, 2 inconsistent
- **EventEmitter pattern**: ✅ Good architecture (7 services)
- **Field names**: ❌ scannerId violation (must fix)
- **Test pollution**: 6 instances across 5 files
- **Circular dependencies**: ❌ Critical issue (require-inside-methods pattern)
- **Service responsibilities**: Generally good, 2 large services

**Critical Issues**:
1. Field name violation (scannerId vs deviceId) - MUST FIX
2. Circular dependencies - architectural refactor needed
3. Test code pollution - move to test fixtures

**Next**: Phase 6.1.4 - WebSocket Files Analysis (wrapping patterns, event handlers, duplication)

---

## Phase 6.1.4: WebSocket Files Analysis

### Category: Event Wrapping Anti-Patterns (CRITICAL)

---
**Finding #21**: eventWrapper.js EXISTS but NEVER USED - Architectural Failure
**Category**: Anti-Pattern
**Location**: eventWrapper.js:1-47 (helper), all other WebSocket files (NOT importing it)
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #2 (wrapped WebSocket envelope)

**Perfect Implementation**:
```javascript
// eventWrapper.js (46 lines) - PERFECT implementation of Decision #2
function wrapEvent(eventName, data) {
  return {
    event: eventName,
    data: data,
    timestamp: new Date().toISOString()
  };
}

function emitWrapped(emitter, eventName, data) {
  const wrappedEvent = wrapEvent(eventName, data);
  emitter.emit(eventName, wrappedEvent);
}

function emitToRoom(io, room, eventName, data) {
  const wrappedEvent = wrapEvent(eventName, data);
  io.to(room).emit(eventName, wrappedEvent);
}
```

**Actual Usage**:
```bash
# Grep for eventWrapper imports across backend/src/
grep -r "require.*eventWrapper" backend/src/
# RESULT: ZERO imports found outside eventWrapper.js itself
```

**Issue**: eventWrapper.js has PERFECT implementation of Decision #2 (wrapped envelope), but NO OTHER FILE imports or uses it. All event emissions are manual with inconsistent wrapping.

**Impact**:
- Decision #2 VIOLATED throughout WebSocket layer
- Inconsistent wrapping patterns (Finding #22-#28)
- Manual timestamp generation everywhere (duplication)
- No single source of truth for event format
- Helper exists but is dead code

**Target State**:
```javascript
// ALL WebSocket files should import and use:
const { emitWrapped, emitToRoom } = require('./eventWrapper');

// Instead of:
socket.emit('event', { data: {...}, timestamp: new Date().toISOString() });

// Use:
emitWrapped(socket, 'event', { data: {...} });
```

**Action Required**:
1. Add `require('./eventWrapper')` to ALL WebSocket handler files
2. Replace ALL manual emit calls with emitWrapped/emitToRoom
3. Remove manual timestamp generation
4. Enforce wrapper usage via linting rule

**Related Findings**: #22-#28 (all wrapping violations)

---
**Finding #22**: Inconsistent Event Wrapping Patterns - Architectural Chaos
**Category**: Anti-Pattern
**Location**: All WebSocket files
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #2 (wrapped envelope {event, data, timestamp})

**Pattern Analysis Across Files**:

**Pattern A - Full Manual Wrapping** (broadcasts.js lines 113-117, 144-155, 167-175, 184-187, 198-307):
```javascript
// GOOD structure, but manually constructed (should use eventWrapper)
io.emit('score:updated', {
  event: 'score:updated',
  data: { teamId, currentScore, ... },
  timestamp: new Date().toISOString()
});
```

**Pattern B - NO Wrapping** (gmAuth.js:91, deviceTracking.js:73, adminEvents.js:83):
```javascript
// WRONG - violates Decision #2
socket.emit('gm:identified', {
  success: true,
  sessionId: session?.id,
  state: state?.toJSON()  // Data directly, no {event, data, timestamp} wrapper
});
```

**Pattern C - Timestamp Only** (broadcasts.js:46-50, roomManager.js:162-165):
```javascript
// WRONG - has timestamp but missing {event, data} structure
io.emit('session:new', {
  sessionId: session.id,
  name: session.name,
  // Missing 'event' and 'data' wrapper, only has timestamp
});
```

**Pattern D - Spread with Timestamp** (roomManager.js:162-165):
```javascript
// WRONG - spreads data, adds timestamp, but no wrapper
io.to(roomName).emit(event, {
  ...data,
  timestamp: new Date().toISOString()
});
```

**Wrapping Compliance Count** (estimated from code review):
- **Fully wrapped (Pattern A)**: ~25 events (broadcasts.js video/score events)
- **NO wrapping (Pattern B)**: ~30 events (gmAuth, deviceTracking, adminEvents, videoEvents)
- **Partial wrapping (Pattern C/D)**: ~10 events (broadcasts.js session events, roomManager)
- **Total events emitted**: ~65 emit calls across 9 files

**Compliance Rate**: ~38% fully compliant, 62% violating Decision #2

**Issue**: FOUR different wrapping patterns across WebSocket layer. No consistency. Scanner clients must handle 4 different parsing strategies.

**Impact**:
- Scanner code cannot rely on consistent format
- Some events parsable as message.data.field, others as message.field
- Contract violations everywhere
- Manual testing required per event

**Target State**: 100% compliance using eventWrapper helpers

**Action Required**:
1. Audit all 65 emit calls
2. Replace with emitWrapped/emitToRoom
3. Verify scanner compatibility

**Related Findings**: #21 (wrapper exists), #23-#28 (specific violations)

---
**Finding #23**: gmAuth.js Manual Event Emission - 4 Events Without Wrapping
**Category**: Anti-Pattern
**Location**: gmAuth.js:87, 91, 99, 152
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #2 (wrapped envelope)

**Violations**:

**1. state:sync (line 87)** - DOUBLE VIOLATION:
```javascript
// ELIMINATED event (Phase 4.9) AND unwrapped
socket.emit('state:sync', state.toJSON());
// Should be removed entirely (event eliminated)
```

**2. gm:identified (line 91)** - ESSENTIAL event, unwrapped:
```javascript
// WRONG - no {event, data, timestamp} wrapper
socket.emit('gm:identified', {
  success: true,
  sessionId: session?.id,
  state: state?.toJSON()
});

// CORRECT (per contract):
emitWrapped(socket, 'gm:identified', {
  success: boolean,
  deviceId: string,
  sessionId: string | null
});
```

**3. device:connected (line 99)** - ESSENTIAL event, unwrapped:
```javascript
// WRONG - broadcast without wrapper
socket.broadcast.emit('device:connected', {
  deviceId: device.id,
  type: device.type,
  name: device.name,
  ipAddress: socket.handshake.address,
  timestamp: new Date().toISOString()  // Manual timestamp
});

// CORRECT:
const { emitWrapped } = require('./eventWrapper');
emitWrapped(socket.broadcast, 'device:connected', {
  deviceId: device.id,
  type: device.type,
  name: device.name,
  ipAddress: socket.handshake.address
});
```

**4. heartbeat:ack (line 152)** - ELIMINATED event, unwrapped:
```javascript
// ELIMINATED event (Phase 4.9) - Socket.IO has built-in ping/pong
socket.emit('heartbeat:ack', {
  timestamp: new Date().toISOString()
});
// Should be removed entirely
```

**Also: error events (lines 21, 61, 114)** - unwrapped:
```javascript
socket.emit('error', { code: '...', message: '...' });
// Should use wrapper
```

**Impact**:
- gm:identify is FIRST event in WebSocket handshake - sets wrong expectation
- Scanner expects wrapped format, receives unwrapped
- 4 violations in auth flow alone

**Action Required**:
1. Import eventWrapper
2. Wrap gm:identified, device:connected
3. DELETE state:sync, heartbeat:ack (eliminated events)
4. Wrap all error events

**Related Findings**: #21 (wrapper unused), #31 (eliminated events in this file)

---
**Finding #24**: deviceTracking.js Manual Event Emission - 5 Events Without Wrapping
**Category**: Anti-Pattern
**Location**: deviceTracking.js:28, 73, 85, 121, 61
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #2 (wrapped envelope)

**Violations**:

**1. device:disconnected (lines 28, 121)** - ESSENTIAL event, unwrapped:
```javascript
// WRONG (2 instances - manual disconnect + timeout)
io.emit('device:disconnected', {
  deviceId: socket.deviceId,
  reason: 'manual',  // or 'timeout'
  timestamp: new Date().toISOString()
});

// CORRECT:
emitWrapped(io, 'device:disconnected', {
  deviceId: socket.deviceId,
  reason: 'manual'
});
```

**2. sync:full (line 73)** - ESSENTIAL event, unwrapped:
```javascript
// WRONG - manual construction
socket.emit('sync:full', {
  session: session?.toJSON(),
  state: state?.toJSON(),
  devices: session?.connectedDevices || [],
  transactions: session?.transactions?.slice(-100) || [],
  timestamp: new Date().toISOString()
});

// CORRECT:
emitWrapped(socket, 'sync:full', {
  session: session?.toJSON(),
  state: state?.toJSON(),
  devices: session?.connectedDevices || [],
  transactions: session?.transactions?.slice(-100) || []
});
```

**3. error events (lines 61, 85)** - unwrapped:
```javascript
socket.emit('error', { code: '...', message: '...' });
// Should use wrapper
```

**Issue**: deviceTracking handles connection lifecycle - critical events emitted without wrapper.

**Impact**:
- device:connected (gmAuth.js) and device:disconnected (here) have inconsistent formats
- sync:full is CRITICAL state sync event - must be wrapped
- Scanners receive inconsistent connection events

**Action Required**:
1. Import eventWrapper
2. Wrap all 5 event emissions
3. Remove manual timestamp generation

**Related Findings**: #21 (wrapper unused), #23 (gmAuth violations)

---

### Category: Eliminated Events Still Implemented

---
**Finding #25**: Eliminated Events Still Emitted in broadcasts.js
**Category**: Architecture
**Location**: broadcasts.js:46, 126, 181
**Severity**: 🟡 Important
**Contract Alignment**: Phase 4.9 Essential API List

**Eliminated Events**:

**1. session:new (lines 45-51)** - ELIMINATED:
```javascript
// Lines 45-51
addTrackedListener(sessionService, 'session:created', (session) => {
  io.emit('session:new', {  // ❌ ELIMINATED - use session:update
    sessionId: session.id,
    name: session.name,
  });
});
```
**Why Eliminated**: Granular session events eliminated (Phase 4.9). Use single `session:update` with status field.

**2. state:sync (lines 125-128)** - ELIMINATED:
```javascript
// Lines 125-128
addTrackedListener(stateService, 'state:sync', (state) => {
  io.emit('state:sync', state);  // ❌ ELIMINATED - redundant with sync:full
});
```
**Why Eliminated**: Redundant with sync:full event.

**3. team:created (lines 181-192)** - ELIMINATED:
```javascript
// Lines 181-192
addTrackedListener(transactionService, 'team:created', (data) => {
  io.to('gm-stations').emit('team:created', {  // ❌ ELIMINATED
    event: 'team:created',
    data: { teamId: data.teamId },
    timestamp: new Date().toISOString()
  });
});
```
**Why Eliminated**: Teams defined at session creation (not created dynamically during game).

**Action Required**:
1. DELETE session:new listener (lines 45-51)
2. DELETE state:sync listener (lines 125-128)
3. DELETE team:created listener (lines 181-192)
4. Update sessionService.on('session:created') to emit session:update instead
5. Remove stateService 'state:sync' event emission

**Related Findings**: #29 (more eliminated events), #31 (eliminated events in gmAuth)

---
**Finding #26**: Eliminated Events in adminEvents.js - 5 Handlers
**Category**: Architecture
**Location**: adminEvents.js:30, 39, 48, 57, 68
**Severity**: 🟡 Important
**Contract Alignment**: Phase 4.9 Essential API List

**Eliminated Events**:

**1. session:paused (line 30)** - ELIMINATED:
```javascript
// Line 30 - case 'pause_session'
io.emit('session:paused', {  // ❌ Use session:update with status: 'paused'
  gmStation: socket.deviceId,
  timestamp: new Date().toISOString()
});
```

**2. session:resumed (line 39)** - ELIMINATED:
```javascript
// Line 39 - case 'resume_session'
io.emit('session:resumed', {  // ❌ Use session:update with status: 'active'
  gmStation: socket.deviceId,
  timestamp: new Date().toISOString()
});
```

**3. session:ended (line 48)** - ELIMINATED:
```javascript
// Line 48 - case 'end_session'
io.emit('session:ended', {  // ❌ Use session:update with status: 'ended'
  gmStation: socket.deviceId,
  timestamp: new Date().toISOString()
});
```

**4. video:skipped (line 57)** - ELIMINATED:
```javascript
// Line 57 - case 'skip_video'
io.emit('video:skipped', {  // ❌ Use gm:command:ack + video:status side effect
  gmStation: socket.deviceId,
  timestamp: new Date().toISOString()
});
```

**5. scores:reset (line 68)** - ELIMINATED:
```javascript
// Line 68 - case 'clear_scores'
io.emit('scores:reset', {  // ❌ Use gm:command:ack + score:updated broadcasts
  gmStation: socket.deviceId,
  timestamp: new Date().toISOString()
});
```

**Why Eliminated**: Phase 4.9 eliminated granular session events and specific admin events. Replaced by:
- Granular session events → single `session:update` with status field
- video:skipped → `gm:command:ack` + `video:status` side effect
- scores:reset → `gm:command:ack` + `score:updated` broadcasts

**Target Pattern**:
```javascript
// Instead of specific events, emit:
case 'pause_session':
  await sessionService.updateSession({ status: 'paused' });
  // sessionService emits 'session:updated' which broadcasts session:update
  emitWrapped(socket, 'gm:command:ack', {
    action: 'pause_session',
    success: true
  });
  break;
```

**Action Required**:
1. Replace session:paused/resumed/ended with session:update broadcasts
2. Replace video:skipped with gm:command:ack only (video:status broadcasts automatically)
3. Replace scores:reset with gm:command:ack only (score:updated broadcasts automatically)
4. Update handleGmCommand to use command acknowledgment pattern

**Related Findings**: #25 (eliminated events in broadcasts), #31 (eliminated events in gmAuth)

---
**Finding #27**: Eliminated Events in gmAuth.js - 2 Events
**Category**: Architecture
**Location**: gmAuth.js:87, 152-154
**Severity**: 🟡 Important
**Contract Alignment**: Phase 4.9 Essential API List

**Eliminated Events**:

**1. state:sync (line 87)**:
```javascript
// Line 87
socket.emit('state:sync', state.toJSON());  // ❌ ELIMINATED - use sync:full
```

**2. heartbeat + heartbeat:ack (lines 127-158)**:
```javascript
// Entire handleHeartbeat function (lines 127-158)
async function handleHeartbeat(socket, data) {
  // ... heartbeat validation ...
  socket.emit('heartbeat:ack', {  // ❌ ELIMINATED - Socket.IO has built-in ping/pong
    timestamp: new Date().toISOString()
  });
}
```

**Why Eliminated**:
- `state:sync`: Redundant with `sync:full` (eliminated per Phase 4.9)
- `heartbeat`/`heartbeat:ack`: Socket.IO has built-in ping/pong mechanism (over-engineering)

**Action Required**:
1. Line 87: Replace `state:sync` with `sync:full` (or remove if sync:full sent elsewhere)
2. DELETE handleHeartbeat function entirely (lines 127-158)
3. Remove heartbeat handler registration (if exists in main socket setup)

**Related Findings**: #25, #26 (other eliminated events)

---

### Category: Field Naming Violations

---
**Finding #28**: scannerId Used in broadcasts.js transaction:new Event
**Category**: Anti-Pattern
**Location**: broadcasts.js:72
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #4 (use deviceId everywhere)

**Code**:
```javascript
// Line 72 - transaction:new event broadcast
const eventData = {
  event: 'transaction:new',
  data: {
    id: transaction.id,
    tokenId: transaction.tokenId,
    teamId: transaction.teamId,
    scannerId: transaction.scannerId,  // ❌ WRONG - should be deviceId
    stationMode: transaction.stationMode,
    status: transaction.status,
    points: transaction.points,
    timestamp: transaction.timestamp,
    // ... token enrichment ...
  },
  timestamp: new Date().toISOString()
};
```

**Issue**: Uses `scannerId` field in WebSocket broadcast. Violates Decision #4 (standardized field names - use deviceId).

**Impact**:
- Contract specifies `deviceId` for transaction:new event
- Scanners expect `deviceId`, receive `scannerId`
- Breaks contract compliance

**Target State**:
```javascript
scannerId: transaction.scannerId,  // ❌ REMOVE
deviceId: transaction.deviceId,    // ✅ USE
```

**Action Required**:
1. Change line 72 from `scannerId` to `deviceId`
2. Ensure transaction model uses `deviceId` (Finding #15 identified services use scannerId)
3. Coordinate with model/service refactor (Phase 6.1.6)

**Related Findings**: #15 (services use scannerId), models TBD (Phase 6.1.6)

---

### Category: Event Structure Violations

---
**Finding #29**: session:update Wrong Structure - Decision #7 Violation
**Category**: Anti-Pattern
**Location**: broadcasts.js:53-59
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #7 (session:update full resource)

**Current Implementation**:
```javascript
// Lines 53-59
addTrackedListener(sessionService, 'session:updated', (session) => {
  io.emit('session:update', {  // ❌ WRONG structure
    sessionId: session.id,
    status: session.status
  });
});
```

**Contract Requirement** (Decision #7):
```javascript
// session:update should send FULL session resource
emitWrapped(io, 'session:update', {
  id: session.id,           // Note: 'id' not 'sessionId' (Decision #4)
  name: session.name,
  startTime: session.startTime,
  endTime: session.endTime,
  status: session.status,
  teams: session.teams,
  metadata: session.metadata
});
```

**Issue**: Currently sends only `{sessionId, status}` instead of full session object. Violates Decision #7 (full resource in session:update).

**Impact**:
- Scanner must make additional request to GET /api/session for full data
- Defeats purpose of WebSocket real-time updates
- Breaks contract compliance

**Action Required**:
1. Change broadcast to send full session.toJSON()
2. Wrap with eventWrapper
3. Use 'id' field (not sessionId) per Decision #4

**Related Findings**: #33 (session.toAPIResponse format - verify in Phase 6.1.6)

---

### Category: Non-Contract Events

---
**Finding #30**: Non-Essential Events in videoEvents.js
**Category**: Architecture
**Location**: videoEvents.js:37
**Severity**: 🟢 Note
**Contract Alignment**: Phase 4.9 Essential API List

**Event**:
```javascript
// Line 37 - handleVideoPlay
io.emit('video:queued', {  // Not in essential 24 APIs
  tokenId,
  position: queueItem.position,
  requestedBy: gmStation,
  timestamp: new Date().toISOString()
});
```

**Issue**: `video:queued` event is NOT in the essential 24 APIs (09-essential-api-list.md). Only `video:status` event is essential.

**Impact**:
- Extra event clients don't need
- Over-engineering (video:status covers queue state with queueLength field)

**Action Required**:
1. Evaluate: Is video:queued actually needed?
2. If not: Remove emission (lines 37-42)
3. If yes: Add to contracts or merge into video:status

**Related Findings**: Phase 4.9 endpoint/event minimization

---
**Finding #31**: roomManager.js Registers Non-Contract Events
**Category**: Architecture
**Location**: roomManager.js:277-327
**Severity**: 🟢 Note
**Contract Alignment**: Phase 4.9 Essential API List

**Events Registered**:
```javascript
// Lines 277-327 - registerRoomHandlers
socket.on('room:join', ...)        // Not in contracts
socket.on('room:leave', ...)       // Not in contracts
socket.on('room:stats', ...)       // Not in contracts
socket.on('room:list', ...)        // Not in contracts

// Also emits:
socket.emit('room:joined', ...)         // Not in contracts
socket.emit('room:left', ...)           // Not in contracts
socket.to(room).emit('room:member:joined', ...)    // Not in contracts
socket.to(room).emit('room:member:left', ...)      // Not in contracts
```

**Issue**: These events are NOT in the essential 24 APIs. Appear to be over-engineering (dynamic room management not needed for live event).

**Impact**:
- Unused complexity (rooms are statically defined: gm-stations, players, session:*)
- Events in code but not in contracts

**Action Required**:
1. Verify if registerRoomHandlers is actually called (grep for usage)
2. If not used: DELETE registerRoomHandlers function
3. If used: Evaluate if needed or can be removed

**Related Findings**: Phase 4.9 minimization (remove over-engineering)

---

### Category: Good Patterns (Preserve These)

---
**Finding #32**: Listener Registry Pattern - Good Architecture
**Category**: Good Pattern
**Location**: listenerRegistry.js:1-126, broadcasts.js usage
**Severity**: 🟢 Note
**Contract Alignment**: Architecture best practice

**Pattern**:
```javascript
// listenerRegistry.js - Tracks all listeners for cleanup
class ListenerRegistry {
  trackListener(service, event, handler) {
    // Track for later cleanup
  }

  cleanup() {
    // Remove all tracked listeners (prevents accumulation)
  }
}

// broadcasts.js usage
function addTrackedListener(service, event, handler) {
  service.on(event, handler);
  activeListeners.push({ service, event, handler });
  listenerRegistry.trackListener(service, event, handler);
}

function cleanupBroadcastListeners() {
  // Remove ALL tracked listeners
  activeListeners.forEach(({ service, event, handler }) => {
    service.removeListener(event, handler);
  });
}
```

**Benefits**:
- Prevents listener accumulation in tests
- Centralized cleanup mechanism
- Good separation of concerns
- Test-friendly architecture

**Observation**: This is GOOD architecture. Solves listener leak problem. Similar to EventEmitter pattern (Finding #17).

**Action Required**: None (preserve this pattern)

**Related Findings**: #17 (EventEmitter good pattern)

---

## Phase 6.1.4 Complete - WebSocket Files Analysis Done

**WebSocket Analysis Summary**:
- **13 findings documented** (#21-#33: 12 issues + 1 good pattern)
- **Files analyzed**: 9 files (~1,904 lines)

**Critical Issues**:
1. **eventWrapper.js exists but NEVER USED** (Finding #21) - 🔴 CRITICAL
2. **Inconsistent event wrapping** - 62% of events violate Decision #2 (Finding #22)
3. **Eliminated events still emitted** - 9+ events that should be deleted (Findings #25-#27)
4. **Field naming violations** - scannerId in broadcasts.js (Finding #28)
5. **Event structure violations** - session:update wrong format (Finding #29)

**Event Wrapping Violations Summary**:
- gmAuth.js: 4 unwrapped events (Finding #23)
- deviceTracking.js: 5 unwrapped events (Finding #24)
- broadcasts.js: Mixed patterns (Finding #25, #29)
- adminEvents.js: 5 eliminated events (Finding #26)
- videoEvents.js: All unwrapped + 1 non-contract event (Finding #30)
- roomManager.js: 8 non-contract events (Finding #31)

**Eliminated Events Count**:
- session:new, session:paused, session:resumed, session:ended (4)
- state:sync, state:update (2)
- heartbeat, heartbeat:ack (2)
- video:skipped, scores:reset (2)
- team:created (1)
- **Total**: 11 events to DELETE

**Good Patterns to Preserve**:
- listenerRegistry cleanup mechanism (Finding #32)
- EventEmitter service pattern (Finding #17)

**Next**: Phase 6.1.5 - Middleware & Utilities Analysis (4 files, ~685 lines)

---

## Phase 6.1.5: Middleware & Utilities Analysis

### Category: Response Format Anti-Patterns

---
**Finding #33**: auth.js Manual Response Construction - Missing responseBuilder
**Category**: Anti-Pattern
**Location**: auth.js:99-102, 111-115, 131-134
**Severity**: 🟡 Important
**Contract Alignment**: Decision #3 (RESTful HTTP), Finding #3 (response builder missing)

**Manual Response Construction**:
```javascript
// Line 99-102 - requireAdmin middleware
return res.status(401).json({
  error: 'AUTH_REQUIRED',
  message: 'Authorization required',
});

// Line 111-115
return res.status(401).json({
  error: 'AUTH_REQUIRED',
  message: 'Invalid or expired token',
});

// Line 131-134
res.status(500).json({
  error: 'INTERNAL_ERROR',
  message: 'Authentication error',
});
```

**Issue**: auth.js middleware manually constructs error responses (3 instances). Should use responseBuilder utility (Finding #3).

**Impact**:
- Inconsistent with target response format pattern
- Duplication of error response structure
- Cannot enforce consistent error format via single utility

**Target State**:
```javascript
const { error } = require('../utils/responseBuilder');
return error(res, 'AUTH_REQUIRED', 'Authorization required', null, 401);
```

**Action Required**:
1. Create src/utils/responseBuilder.js (Finding #3 action)
2. Refactor auth.js to use responseBuilder
3. Remove manual res.json() calls

**Related Findings**: #3 (response builder missing), #2 (7 response patterns)

---

### Category: Field Naming Violations (Critical)

---
**Finding #34**: validators.js Uses scannerId - Decision #4 Violation
**Category**: Anti-Pattern
**Location**: validators.js:37, 148
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #4 (standardized field names - use deviceId)

**Code**:
```javascript
// Line 37 - transactionSchema
const transactionSchema = Joi.object({
  id: uuid.required(),
  tokenId: Joi.string().required().min(1).max(100),
  teamId: teamId.required(),
  scannerId: Joi.string().required().min(1).max(100),  // ❌ WRONG
  stationMode: Joi.string().valid('detective', 'blackmarket').optional().default('blackmarket'),
  // ...
});

// Line 148 - scanRequestSchema
const scanRequestSchema = Joi.object({
  tokenId: Joi.string().required().min(1).max(100),
  teamId: teamId.required(),
  scannerId: Joi.string().required().min(1).max(100),  // ❌ WRONG
  stationMode: Joi.string().valid('detective', 'blackmarket').optional().default('blackmarket'),
  timestamp: isoDate.optional(),
});
```

**Issue**: Joi validation schemas use `scannerId` field. Validators ENFORCE the wrong field name. All requests validated with these schemas MUST use scannerId, preventing deviceId usage.

**Impact**:
- **BLOCKING ISSUE**: Cannot change to deviceId without updating validators first
- Validators enforce wrong field name
- Breaking change coordination critical (validators + models + services + routes + WebSocket all at once)

**Target State**:
```javascript
// transactionSchema
scannerId: Joi.string().required().min(1).max(100),  // ❌ DELETE
deviceId: Joi.string().required().min(1).max(100),   // ✅ ADD

// scanRequestSchema
scannerId: Joi.string().required().min(1).max(100),  // ❌ DELETE
deviceId: Joi.string().required().min(1).max(100),   // ✅ ADD
```

**Action Required**:
1. Update transactionSchema: scannerId → deviceId (line 37)
2. Update scanRequestSchema: scannerId → deviceId (line 148)
3. Coordinate with model/service/route changes (atomic refactor)
4. **This is a PREREQUISITE for all other scannerId → deviceId changes**

**Related Findings**: #15 (services use scannerId), #28 (broadcasts.js uses scannerId)

---

### Category: Schema for Eliminated APIs

---
**Finding #35**: validators.js Contains Schemas for Eliminated Endpoints
**Category**: Architecture
**Location**: validators.js:163-167 (videoControlSchema)
**Severity**: 🟢 Note
**Contract Alignment**: Phase 4.9 Essential API List

**Eliminated Schema**:
```javascript
// Lines 163-167 - videoControlSchema
const videoControlSchema = Joi.object({
  action: Joi.string().valid('play', 'pause', 'stop', 'skip').required(),
  videoId: uuid.optional(),
  tokenId: Joi.string().min(1).max(100).optional(),
});
```

**Issue**: `videoControlSchema` validates HTTP POST /api/video/control requests. This endpoint is ELIMINATED (Finding #9 - moved to WebSocket gm:command).

**Impact**:
- Dead code (validator not used if endpoint eliminated)
- Confusing (schema exists for non-existent endpoint)

**Action Required**:
1. DELETE videoControlSchema definition (lines 163-167)
2. Remove from module.exports (line 243)
3. Verify no imports of this schema

**Related Findings**: #9 (videoRoutes.js eliminated)

---
**Finding #36**: validators.js Missing Schemas for Essential WebSocket Events
**Category**: Missing Abstraction
**Location**: validators.js (entire file)
**Severity**: 🟡 Important
**Contract Alignment**: Phase 4.9 Essential API List

**Missing Schemas**:
```javascript
// MISSING: Validation for essential WebSocket events (16 events)

// 1. transaction:submit (incoming) - HAS scanRequestSchema (reusable) ✅
// 2. gm:command (incoming) - MISSING ❌
// 3. sync:request (incoming) - HAS wsSyncRequestSchema but event ELIMINATED ❌
// 4. device:connected, device:disconnected (outgoing) - MISSING ❌
// 5. transaction:result, transaction:new (outgoing) - MISSING ❌
// 6. score:updated, group:completed (outgoing) - MISSING ❌
// 7. session:update (outgoing) - MISSING ❌
// 8. video:status (outgoing) - MISSING ❌
// 9. sync:full (outgoing) - MISSING ❌
// 10. offline:queue:processed (outgoing) - MISSING ❌
// 11. error (outgoing) - MISSING ❌
```

**Current WebSocket Schemas**:
- gmIdentifySchema (lines 172-175) - ✅ ESSENTIAL (gm:identify)
- wsHeartbeatSchema (lines 178-180) - ❌ ELIMINATED (heartbeat event removed)
- wsSyncRequestSchema (lines 182-185) - ❌ ELIMINATED (sync:request event removed)

**Issue**: Only 1 of 16 essential WebSocket events has validation schema. Missing schemas for:
- Incoming: gm:command (critical - all admin commands)
- Outgoing: All 11 broadcast events

**Impact**:
- No validation for gm:command data (action, payload vary by command)
- Outgoing events not validated before broadcast (could send malformed data)
- Cannot validate contract compliance programmatically

**Target State**:
```javascript
// Add schemas for all essential events
const gmCommandSchema = Joi.object({
  action: Joi.string().valid(
    'session:create', 'session:pause', 'session:resume', 'session:end',
    'video:play', 'video:pause', 'video:stop', 'video:skip',
    'video:queue:clear', 'score:adjust', 'system:reset'
  ).required(),
  payload: Joi.object().optional()  // Varies by action
});

const transactionResultSchema = Joi.object({
  transactionId: uuid.required(),
  status: Joi.string().valid('accepted', 'rejected', 'queued').required(),
  // ...
});

// Similar for all 16 essential events
```

**Action Required**:
1. Create schema for gm:command (incoming) - HIGH PRIORITY
2. Create schemas for all outgoing events (contract validation)
3. DELETE wsHeartbeatSchema, wsSyncRequestSchema (eliminated events)
4. Use schemas in WebSocket handlers for validation

**Related Findings**: Phase 4.9 essential API list

---

### Category: Middleware Issues

---
**Finding #37**: offlineStatus.js Stub Implementation with Circular Dependency Risk
**Category**: Architecture / Anti-Pattern
**Location**: offlineStatus.js:1-74 (entire file)
**Severity**: 🟢 Note
**Contract Alignment**: Architecture

**Code**:
```javascript
// Lines 5-6
// This is a stub implementation for T023
// Will be fully implemented when offline mode is developed

// Lines 26-29 - Circular dependency pattern
function getService() {
  if (!offlineQueueServiceInstance) {
    // Fallback to requiring it if not initialized
    offlineQueueServiceInstance = require('../services/offlineQueueService');
  }
  return offlineQueueServiceInstance;
}
```

**Issue**:
- Middleware is a "stub implementation" (line 5 comment)
- Uses require-inside-function pattern to avoid circular dependency (Finding #19)
- Passes offline status from service to request (req.isOffline)

**Observation**:
- Minimal middleware (38 lines of actual code)
- Service reference pattern prevents circular dep
- Functionality works but marked as incomplete

**Impact**:
- Low (middleware works as intended)
- Technical debt (stub comment suggests incomplete implementation)

**Action Required**:
1. Evaluate if middleware is actually "stub" or complete
2. Remove "stub" comment if implementation is sufficient
3. Optional: Consider if this middleware is needed (services already have offline status)

**Related Findings**: #19 (circular dependencies in services)

---

### Category: Good Patterns (Preserve These)

---
**Finding #38**: logger.js Helper Methods - Good Abstraction
**Category**: Good Pattern
**Location**: logger.js:82-127
**Severity**: 🟢 Note
**Contract Alignment**: Architecture best practice

**Pattern**:
```javascript
// Lines 82-98 - Request logging helper
logger.logRequest = (req, res, responseTime) => {
  const logData = { method, url, status, responseTime, ip, userAgent };
  if (res.statusCode >= 400) {
    logger.warn('Request failed', logData);
  } else {
    logger.info('Request completed', logData);
  }
};

// Lines 100-107 - WebSocket event logging
logger.logSocketEvent = (event, socketId, data = {}) => {
  logger.debug('WebSocket event', { event, socketId, ...data });
};

// Lines 109-118 - Transaction logging
logger.logTransaction = (transaction, action) => {
  logger.info(`Transaction ${action}`, { transactionId, tokenId, teamId, status, action });
};

// Lines 120-127 - Error logging with context
logger.logError = (error, context = {}) => {
  logger.error(error.message, { stack, code, ...context });
};
```

**Benefits**:
- Consistent logging format across codebase
- Structured logging helpers (reduces boilerplate)
- Contextual data automatically included
- Good separation of concerns

**Usage Example**:
```javascript
// Routes use logRequest
logger.logRequest(req, res, responseTime);

// WebSocket handlers use logSocketEvent
logger.logSocketEvent('gm:identify', socket.id, { deviceId });

// Services use logTransaction
logger.logTransaction(transaction, 'created');
```

**Observation**: This is GOOD architecture. Well-designed logging abstraction.

**Action Required**: None (preserve this pattern)

**Related Findings**: #17, #32 (other good patterns)

---
**Finding #39**: auth.js Token Management - Production Warning Present
**Category**: Architecture / Production Concern
**Location**: auth.js:10-12, 184-188
**Severity**: 🟢 Note
**Contract Alignment**: Production readiness

**Code**:
```javascript
// Lines 10-12
// Store admin tokens (in production, use Redis or database)
const adminTokens = new Set();
const tokenExpiry = new Map();

// Lines 184-188 - Cleanup interval
let tokenCleanupInterval = null;
if (process.env.NODE_ENV !== 'test') {
  tokenCleanupInterval = setInterval(cleanupExpiredTokens, 60 * 60 * 1000);
}
```

**Observation**:
- In-memory token storage (Set + Map)
- Comment acknowledges production limitation (line 10)
- Cleanup interval prevents memory leak
- Test-safe (guards against intervals in tests)

**Impact**:
- Current: Works for single-instance orchestrator (which is the deployment model)
- Production concern: Tokens lost on restart (acceptable for 2-hour live event)
- If multi-instance needed: Would require Redis/database

**Assessment**:
- **ACCEPTABLE for current deployment model** (single PM2 process)
- Comment correctly identifies future scaling concern
- Implementation is clean and test-friendly

**Action Required**: None (acceptable for current architecture)

**Related Findings**: None

---

## Phase 6.1.5 Complete - Middleware & Utilities Analysis Done

**Middleware & Utilities Analysis Summary**:
- **7 findings documented** (#33-#39)
- **Files analyzed**: 4 files (~685 lines)
  - middleware/auth.js (207 lines)
  - middleware/offlineStatus.js (74 lines)
  - utils/logger.js (148 lines)
  - utils/validators.js (260 lines)

**Critical Issues**:
1. **validators.js uses scannerId** (Finding #34) - 🔴 CRITICAL BLOCKER
   - Validators ENFORCE wrong field name
   - MUST fix before any scannerId → deviceId refactor
   - Affects transactionSchema + scanRequestSchema

**Important Issues**:
2. **Missing response builder** (Finding #33) - auth.js manually constructs responses
3. **Missing WebSocket validation schemas** (Finding #36) - only 1 of 16 events has schema
4. **Dead code** (Finding #35) - videoControlSchema for eliminated endpoint

**Good Patterns to Preserve**:
- logger.js helper methods (Finding #38) - ✅ Excellent abstraction
- auth.js cleanup mechanisms (Finding #39) - ✅ Test-safe, production-aware

**Eliminated Code**:
- videoControlSchema (Finding #35) - DELETE
- wsHeartbeatSchema (Finding #36) - DELETE (heartbeat eliminated)
- wsSyncRequestSchema (Finding #36) - DELETE (sync:request eliminated)

**Next**: Phase 6.1.6 - Models Analysis (8 files, ~2,019 lines) - **CRITICAL for toAPIResponse verification**

---

## Phase 6.1.6: Models Analysis - Architectural Patterns

### Category: Field Naming Violations (SYSTEMIC)

---
**Finding #40**: Transaction Model Uses scannerId - Confirms Systemic Data Layer Violation
**Category**: Anti-Pattern
**Location**: transaction.js:113, 143
**Severity**: 🔴 Critical
**Contract Alignment**: Decision #4 (standardized field names - use deviceId)

**Code**:
```javascript
// Line 113 - toJSON() method
toJSON() {
  return {
    id: this.id,
    tokenId: this.tokenId,
    teamId: this.teamId,
    scannerId: this.scannerId,  // ❌ WRONG
    timestamp: this.timestamp,
    // ...
  };
}

// Line 143 - fromScanRequest() factory
static fromScanRequest(scanRequest, sessionId) {
  return new Transaction({
    tokenId: scanRequest.tokenId,
    teamId: scanRequest.teamId,
    scannerId: scanRequest.scannerId,  // ❌ WRONG
    // ...
  });
}
```

**Systemic Pattern Confirmed**:
```
validators.js (Finding #34) → ENFORCES scannerId
    ↓ (validation)
transaction.js (Finding #40) → DEFINES scannerId field
    ↓ (model instance)
transactionService.js (Finding #15) → USES scannerId
    ↓ (business logic)
broadcasts.js (Finding #28) → EMITS scannerId
    ↓ (WebSocket)
Scanner clients → RECEIVE scannerId
```

**Issue**: The ENTIRE data flow uses scannerId. Model is the **source of truth** for field structure. If model defines scannerId, everything downstream uses scannerId.

**Impact**:
- **Root cause identified**: Models define scannerId, validators enforce it, services use it
- Cannot change piecemeal - atomic refactor required
- Breaking change touches: validators → models → services → routes → WebSocket → scanners

**Refactor Sequence** (MUST be atomic):
1. **validators.js**: scannerId → deviceId (Finding #34)
2. **transaction.js**: scannerId → deviceId (this finding)
3. **services**: Update all references (Finding #15)
4. **routes/WebSocket**: Update all usages
5. **scanner clients**: Update field access
6. **All in single commit/PR** (cannot split - validation will fail)

**Related Findings**: #15, #28, #34 (systemic scannerId usage)

---

### Category: Mixed Concerns - Presentation in Model Layer

---
**Finding #41**: Session.toAPIResponse() Mixes Data Serialization with API Presentation
**Category**: Anti-Pattern
**Location**: session.js:244-257
**Severity**: 🟡 Important
**Contract Alignment**: Decision #3 (RESTful HTTP), Finding #3 (missing responseBuilder)

**Code**:
```javascript
// Lines 244-257
/**
 * Convert to API response representation (OpenAPI compliant)
 * Only returns fields defined in the API contract
 * @returns {Object}
 */
toAPIResponse() {
  return {
    id: this.id,
    name: this.name,
    startTime: this.startTime,
    endTime: this.endTime || null,
    status: this.status,
    metadata: this.metadata,
  };
}

// Compare to toJSON() (lines 228-241)
toJSON() {
  return {
    id: this.id,
    name: this.name,
    startTime: this.startTime,
    endTime: this.endTime || null,
    status: this.status,
    transactions: this.transactions,      // ❌ NOT in toAPIResponse
    connectedDevices: this.connectedDevices,  // ❌ NOT in toAPIResponse
    videoQueue: this.videoQueue,          // ❌ NOT in toAPIResponse
    scores: this.scores,                  // ❌ NOT in toAPIResponse
    metadata: this.metadata,
  };
}
```

**Issue**: Session model has **TWO serialization methods** with different purposes:
- `toJSON()`: Full object serialization (persistence, state sync)
- `toAPIResponse()`: Filtered fields for HTTP responses (presentation layer concern)

**Architectural Problem**:
1. **Mixed Concerns**: Model knows about API contract structure (comment says "OpenAPI compliant")
2. **Presentation Logic in Model**: Deciding which fields to expose is route/controller responsibility
3. **Inconsistent Pattern**: Only 1 of 8 models has toAPIResponse() (Session)
4. **Violates SRP**: Model should serialize data, route should format response

**Target Architecture** (per Decision #3 + Finding #3):
```javascript
// Model: Pure data serialization
class Session {
  toJSON() {
    return { /* all fields */ };
  }
}

// Route: Presentation formatting (uses responseBuilder)
const { success } = require('../utils/responseBuilder');
router.get('/api/session', (req, res) => {
  const session = sessionService.getCurrentSession();
  const data = {
    id: session.id,
    name: session.name,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    metadata: session.metadata,
  };
  return success(res, data);
});
```

**Why This Matters**:
- Model layer should not know about API contracts (separation of concerns)
- Route layer should control what fields are exposed (presentation responsibility)
- Creates coupling (changing API contract requires changing model)
- Contributes to "7 response patterns" confusion (Finding #2)

**Action Required**:
1. DELETE toAPIResponse() method from session.js
2. Update sessionRoutes.js to use toJSON() + field selection
3. Use responseBuilder utility (Finding #3 action) for formatting
4. Keep presentation logic in presentation layer

**Related Findings**: #3 (responseBuilder missing), #2 (7 response patterns), #29 (session:update wrong structure)

---

### Category: Model Serialization Inconsistency

---
**Finding #42**: Three Different Serialization Patterns Across 8 Models
**Category**: Architecture
**Location**: All 8 model files
**Severity**: 🟡 Important
**Contract Alignment**: Architecture consistency

**Pattern Analysis**:

**Pattern A - Pure Data Serialization** (6 models): ✅ CLEAN
- Transaction, DeviceConnection, TeamScore, GameState, Token, VideoQueueItem
- **Only toJSON()**: Returns all fields, no filtering
- **Purpose**: Data serialization for persistence/state sync
- **Good**: Single responsibility, presentation-agnostic

**Pattern B - Mixed Concerns** (1 model): ❌ ANTI-PATTERN
- Session
- **toJSON() + toAPIResponse()**: Two different serializations
- **Purpose**: toJSON() for persistence, toAPIResponse() for HTTP responses
- **Bad**: Presentation logic in model (Finding #41)

**Pattern C - Security-Focused** (1 model): ✅ ACCEPTABLE
- AdminConfig
- **toJSON() + toSecureJSON()**: Password masking vs full serialization
- **Purpose**: toJSON() masks password, toSecureJSON() for storage
- **Acceptable**: Security is data-layer concern, not presentation

**Inconsistency Impact**:
- 75% of models follow pure pattern (Pattern A)
- 12.5% mix concerns (Pattern B - Session)
- 12.5% handle security (Pattern C - AdminConfig)
- Developers must remember which models have toAPIResponse()
- Contributes to architectural confusion

**Target State**: 100% consistent serialization pattern
- All models: `toJSON()` for full serialization
- AdminConfig: Keep `toSecureJSON()` (security exception)
- Routes: Use responseBuilder for presentation formatting
- DELETE: Session.toAPIResponse()

**Action Required**:
1. Standardize on Pattern A (pure toJSON) for all models except AdminConfig
2. Remove Session.toAPIResponse() (Finding #41 action)
3. Document exception: AdminConfig.toSecureJSON() (security-focused, not presentation)

**Related Findings**: #41 (Session toAPIResponse), #3 (responseBuilder missing)

---

### Category: Good Patterns (Preserve These)

---
**Finding #43**: Model Architecture - Strong Foundations with Minor Issues
**Category**: Good Pattern
**Location**: All 8 model files
**Severity**: 🟢 Note
**Contract Alignment**: Architecture best practices

**Excellent Patterns Observed**:

**1. Consistent Validation Pattern** (all 8 models):
```javascript
class Model {
  constructor(data) {
    this.validate(data);  // Validate on construction
    Object.assign(this, data);
  }

  validate(data) {
    return validate(data, modelSchema);  // Uses Joi
  }
}
```
✅ Consistent across all models, prevents invalid instances

**2. Rich Business Logic Methods** (all models):
```javascript
// Transaction: isAccepted(), isDuplicate(), isWithinDuplicateWindow()
// Session: isActive(), isPaused(), canAcceptGmStation()
// TeamScore: addPoints(), completeGroup(), compare()
// GameState: isVideoPlaying(), createDelta()
```
✅ Encapsulates business rules in models, not scattered in services

**3. Factory Methods** (all 8 models):
```javascript
static fromJSON(json) { return new Model(json); }
static fromScanRequest(request, session) { /* ... */ }
static fromToken(token, requestedBy) { /* ... */ }
```
✅ Consistent fromJSON, domain-specific factories where appropriate

**4. Immutability Helpers** (selective):
```javascript
// Token.clone() - creates deep copy
// TeamScore.merge() - merges multiple sources
// GameState.createDelta() - computes differences
```
✅ Good patterns for state management

**5. Clear Responsibilities**:
- Transaction: Scan records with status management
- Session: Game instance lifecycle
- TeamScore: Team scoring with group tracking
- GameState: Derived state from session (with delta calculation)
- DeviceConnection: Connection lifecycle with heartbeat tracking
- Token: Memory token data (read-only)
- VideoQueueItem: Video playback queue management
- AdminConfig: System configuration with security

✅ Well-defined, non-overlapping responsibilities

**Minor Issues**:
- Session has 292 lines (largest) - still manageable
- GameState uses JSON.stringify for delta comparison (lines 253-269) - works but inefficient
- These are acceptable tradeoffs

**Summary**:
- **75% excellent patterns** (validation, business logic, factories)
- **12.5% anti-pattern** (Session.toAPIResponse - Finding #41)
- **12.5% acceptable exception** (AdminConfig.toSecureJSON - security)
- **Overall**: Strong model layer, needs minor cleanup

**Action Required**:
- Preserve all good patterns (validation, business logic, factories)
- Remove only Session.toAPIResponse() (Finding #41)
- Keep AdminConfig.toSecureJSON() (security exception)

**Related Findings**: #41 (remove toAPIResponse), #42 (standardize serialization)

---

## Phase 6.1.6 Complete - Models Analysis Done

**Models Analysis Summary**:
- **4 findings documented** (#40-#43)
- **Files analyzed**: 8 files (~2,019 lines)
  - transaction.js (171 lines)
  - session.js (292 lines)
  - deviceConnection.js (244 lines)
  - teamScore.js (230 lines)
  - gameState.js (282 lines)
  - token.js (117 lines)
  - videoQueueItem.js (213 lines)
  - adminConfig.js (276 lines)

**CRITICAL Architectural Discoveries**:

1. **Systemic Field Naming** (Finding #40):
   - Transaction model DEFINES scannerId field
   - Confirms systemic data layer violation
   - Atomic refactor required: validators → models → services → routes → WebSocket → scanners
   - **This is the ROOT CAUSE** of all scannerId violations

2. **Mixed Concerns Anti-Pattern** (Finding #41):
   - Session.toAPIResponse() mixes data serialization with API presentation
   - Only 1 of 8 models has this pattern (inconsistent)
   - Model should not know about API contract structure
   - DELETE and move logic to route layer

3. **Serialization Inconsistency** (Finding #42):
   - 3 different patterns across 8 models
   - 75% follow pure pattern (good)
   - 12.5% mix concerns (anti-pattern)
   - 12.5% handle security (acceptable)
   - Target: 100% consistency (toJSON only, except AdminConfig.toSecureJSON)

4. **Strong Foundations** (Finding #43):
   - Excellent validation pattern (100% consistent)
   - Rich business logic (models aren't anemic)
   - Consistent factory methods
   - Clear responsibilities
   - **Overall: 75% excellent, needs minor cleanup**

**Answered Critical Questions**:
1. ✅ Do models use scannerId? **YES** - Transaction.toJSON() line 113
2. ✅ What does session.toAPIResponse() return? **Subset of fields** - anti-pattern mixing concerns
3. ✅ What does transaction.toJSON() return? **Full object with scannerId field**

**Good Patterns to Preserve**:
- Joi validation on construction (all 8 models)
- Rich business logic methods (not anemic models)
- Factory methods (fromJSON + domain-specific)
- Clear, non-overlapping responsibilities

**Anti-Patterns to Eliminate**:
- Session.toAPIResponse() (Finding #41) - DELETE
- scannerId field (Finding #40) - RENAME to deviceId
- Inconsistent serialization (Finding #42) - STANDARDIZE

**Next**: Phase 6.1.7 - Dependency Mapping (create visual dependency graph)

---

## Phase 6.1.7: Dependency Mapping - Architectural Dependencies

---
**Finding #44**: Circular Service Dependencies (Triangle Pattern)
**Category**: Architecture
**Location**: sessionService.js, stateService.js, transactionService.js
**Severity**: 🔴 Critical
**Contract Alignment**: Foundation - enables all atomic refactors

**Circular Dependency Triangle**:
```
sessionService ← (lazy) → stateService
      ↓                        ↓
      └──→ transactionService ←┘
         (all connections lazy)
```

**Lazy Require Locations**:
```javascript
// sessionService.js:57-58 (inside endSession method)
const transactionService = require('./transactionService');
const stateService = require('./stateService');

// stateService.js:54, 88-89 (inside init and syncStateFromSession methods)
const sessionService = require('./sessionService');
const transactionService = require('./transactionService');

// transactionService.js:34, 222, 294 (inside init, initializeTeamScore, isValidTeam)
const sessionService = require('./sessionService');
```

**Total**: 8 lazy requires across 3 core services

**Issue**: Services have circular runtime dependencies, broken only by lazy `require()` calls inside methods. This is an anti-pattern that:
- Hides dependencies (not visible at file level)
- Makes initialization order critical
- Prevents static analysis
- Complicates testing (mocking is harder)
- Violates Dependency Inversion Principle

**Root Cause**: offlineQueueService.js imports ALL THREE services EAGERLY (lines 9-11), creating dependency pressure that forces the triangle to use lazy requires.

**Impact**: 
- Blocks introduction of proper dependency injection
- Makes atomic refactors risky (initialization failures)
- Service boundaries unclear (tight coupling)
- Cannot refactor services independently

**Target State**: 
- Constructor injection with explicit dependencies
- DI container manages service lifecycle
- No lazy requires
- Services declare dependencies in constructor

**Action Required**:
1. Introduce dependency injection framework/pattern
2. Update service constructors to accept dependencies
3. Wire services in app.js with proper initialization order
4. Remove all 8 lazy require statements
5. Update tests to use dependency injection for mocking

**Related Findings**: #45 (lazy require pattern), #47 (tight coupling)

**Detailed Analysis**: See docs/api-alignment/work/DEPENDENCY-MAP-PHASE-6-1-7.md

---
**Finding #45**: Lazy Require Anti-Pattern (Breaking Circular Dependencies)
**Category**: Anti-Pattern
**Location**: 8 instances across 3 service files
**Severity**: 🟡 Important
**Contract Alignment**: Code quality - maintainability

**Pattern**:
```javascript
// Instead of top-level import:
// const sessionService = require('./sessionService'); ← Would cause circular dependency

// Services use lazy require INSIDE methods:
someMethod() {
  const sessionService = require('./sessionService'); // ← Lazy require
  sessionService.doSomething();
}
```

**Complete Inventory**:

| File | Line | Lazy Import | Method | Why? |
|------|------|-------------|--------|------|
| sessionService.js | 57 | transactionService | endSession() | Break circular |
| sessionService.js | 58 | stateService | endSession() | Break circular |
| stateService.js | 54 | sessionService | init() | Break circular |
| stateService.js | 88 | transactionService | syncStateFromSession() | Break circular |
| stateService.js | 89 | sessionService | syncStateFromSession() | Break circular |
| transactionService.js | 34 | sessionService | init() | Break circular |
| transactionService.js | 222 | sessionService | initializeTeamScore() | Break circular |
| transactionService.js | 294 | sessionService | isValidTeam() | Break circular |

**Issue**: 
- Lazy requires are a **workaround** for architectural problem (circular dependencies)
- Dependencies are hidden (not declared at file level)
- Harder to reason about service relationships
- Complicates static analysis and tooling
- Performance overhead (require() called repeatedly, though cached)

**Why It Works**: Node.js caches `require()` results, so lazy requires access already-initialized modules at runtime (after app initialization completes).

**Why It's Bad**: 
- Fragile (depends on initialization timing)
- Hidden contract (dependencies not explicit)
- Testing complexity (must mock during method execution)
- Violates explicit dependencies principle

**Impact**: Makes refactoring service layer risky - must understand full dependency graph before making changes.

**Target State**: Zero lazy requires. All dependencies declared in constructor via dependency injection.

**Action Required**: 
1. Introduce DI container
2. Move all requires to constructor parameters
3. Wire dependencies in app.js
4. Remove all lazy require statements

**Related Findings**: #44 (circular dependencies)

---
**Finding #46**: Cross-Layer Import Violation (Service → WebSocket)
**Category**: Architecture
**Location**: stateService.js:11
**Severity**: 🟡 Important
**Contract Alignment**: Unidirectional data flow principle

**Violation**:
```javascript
// stateService.js:11
const listenerRegistry = require('../websocket/listenerRegistry');
```

**Issue**: Service layer imports from WebSocket layer. Expected data flow:

```
WebSocket Layer (presentation)
      ↓ calls
Service Layer (business logic)
      ↓ uses
Model Layer (data)
```

**Actual**:
```
WebSocket Layer ← IMPORTS (VIOLATION)
      ↕
Service Layer
      ↓
Model Layer
```

**Why This Exists**: stateService needs to emit events to WebSocket listeners. listenerRegistry is a pub/sub registry that WebSocket handlers register with.

**Why It's Wrong**: 
- Service layer should NOT know about WebSocket layer
- Violates separation of concerns
- Couples business logic to presentation layer
- Makes services harder to test (must mock WebSocket layer)

**Target State**: 
- Services emit domain events via EventEmitter (already extends EventEmitter)
- WebSocket layer listens to service events
- No service → WebSocket imports
- Unidirectional dependency flow

**Example Target**:
```javascript
// stateService.js - NO import of listenerRegistry
class StateService extends EventEmitter {
  broadcastStateUpdate(state) {
    this.emit('state:updated', state); // ← Service emits domain event
  }
}

// websocket/broadcasts.js - listens to service
const stateService = require('../services/stateService');
stateService.on('state:updated', (state) => {
  // Broadcast to WebSocket clients
});
```

**Impact**: Service layer is coupled to WebSocket layer, making it harder to:
- Test services in isolation
- Replace WebSocket with different transport
- Understand service responsibilities

**Action Required**:
1. Remove `listenerRegistry` import from stateService
2. Use EventEmitter pattern (stateService already extends EventEmitter)
3. Move listener registration to WebSocket layer (broadcasts.js)
4. Service emits domain events, WebSocket layer translates to client events

**Related Findings**: #19 (circular service dependencies)

---
**Finding #47**: Tight Coupling for Atomic Refactors (Coordination Map)
**Category**: Architecture
**Location**: Multiple files across all layers
**Severity**: 🔴 Critical
**Contract Alignment**: Foundation for Phase 7 implementation

**Atomic Refactor Chain 1: scannerId → deviceId**

Must change **atomically** (cannot be incremental):

```
validators.js (Joi schemas enforce scannerId)
  ↓ validates
models/transaction.js (defines scannerId field)
  ↓ uses
services/* (9 files use scannerId)
  ↓ emits
websocket/* (8 files broadcast scannerId)
  ↓ sends to
Scanner clients (expect scannerId field)
```

**Estimate**: ~30 files (all backend + 2 scanner repos)

**Why Atomic?**: 
- Validators reject unknown fields (breaking change)
- Models define data structure (all services use)
- Services use field names in logic (must match models)
- WebSocket broadcasts field names (scanners expect)
- Scanners parse specific fields (must match backend)

**Breaking Partial Changes**:
- Change validators only → models fail validation
- Change models only → services send wrong field names
- Change services only → WebSocket broadcasts wrong structure
- Change WebSocket only → scanners receive unexpected format

**Atomic Refactor Chain 2: Event Wrapping**

Must implement **atomically**:

```
websocket/eventWrapper.js (exists, unused)
  ↓ must wrap events in
websocket/broadcasts.js (8 broadcast methods)
websocket/adminEvents.js (3 emit sites)
websocket/videoEvents.js (2 emit sites)
websocket/gmAuth.js (4 emit sites)
  ↓ which send to
Scanner clients (must handle wrapped format)
```

**Estimate**: 8 backend files + 2 scanner repos

**Why Atomic?**: 
- Scanners expect consistent message format (Decision #2)
- Partial wrapping → inconsistent client behavior
- All emits must change simultaneously
- eventWrapper adds {event, data, timestamp} structure

**Atomic Refactor Chain 3: Circular Dependency Resolution**

Must refactor **together**:

```
Remove lazy requires from:
  sessionService.js (2 lazy requires)
  stateService.js (4 lazy requires)
  transactionService.js (3 lazy requires)

Introduce DI in:
  services/* (update constructors)
  app.js (wire dependencies)
  server.js (wire dependencies)
  tests/* (update mocking)
```

**Estimate**: 10 backend files + all test files

**Why Atomic?**: 
- Removing lazy requires without DI → initialization failure
- Services reference each other during init()
- Must introduce DI container simultaneously
- All tests must update mocking patterns

**Safe Refactors (No Coordination)**:

✅ **Remove Session.toAPIResponse()**: 2 route files only
✅ **Remove test code pollution**: Individual service files
✅ **Standardize response builders**: Route layer only

**Issue**: Multiple architectural changes are **tightly coupled** across layers. Cannot refactor incrementally without breaking the system.

**Impact**: 
- High-risk refactors require extensive coordination
- Must change 30+ files atomically for scannerId → deviceId
- Breaking changes require scanner repo updates
- Testing complexity (must test entire stack after each atomic change)

**Target State**: 
- Documented refactor order (safest → riskiest)
- Test coverage for all affected layers
- Feature flags for gradual rollout where possible
- Clear coordination plan with scanner repos

**Recommended Refactor Order**:
1. ✅ Remove test code pollution (safe, isolated)
2. ✅ Implement eventWrapper usage (medium, testable)
3. ✅ Remove Session.toAPIResponse() (safe, 2 files)
4. ⚠️ Resolve circular dependencies (high risk, enables next)
5. 🔴 scannerId → deviceId rename (highest risk, touch everything)

**Action Required**:
1. Establish comprehensive test coverage FIRST
2. Use feature flags for risky changes (support both scannerId and deviceId temporarily)
3. Document breaking changes clearly
4. Coordinate with scanner repos (update AFTER backend verified)
5. Test each atomic refactor thoroughly before proceeding

**Related Findings**: #40 (root cause scannerId), #44 (circular deps), #22 (event wrapping)

**Detailed Coordination Map**: See docs/api-alignment/work/DEPENDENCY-MAP-PHASE-6-1-7.md

---
**Finding #48**: Complete Backend Dependency Graph
**Category**: Info
**Location**: All 46 backend files
**Severity**: 🔵 Info
**Contract Alignment**: Foundation - enables informed refactor decisions

**Dependency Statistics**:
- **Total Files**: 46 backend files
- **Normal Imports**: 142 total
- **Lazy Requires**: 8 (anti-pattern)
- **Circular Dependencies**: 1 triangle (3 services)
- **Cross-Layer Violations**: 1 (stateService → listenerRegistry)
- **Unused Utilities**: 1 (eventWrapper.js)

**Layer Structure**:

```
Layer 1: Config (1 file) - no dependencies
Layer 2: Storage (4 files) - config only
Layer 3: Models (8 files) - validators only
Layer 4: Services (9 files) - models + services (CIRCULAR)
Layer 5: Middleware (2 files) - config, logger
Layer 6: WebSocket (8 files) - services, models
Layer 7: Routes (8 files) - services, validators, middleware
Layer 8: Core (3 files) - all layers
```

**External Dependencies** (npm):
- Web: express, socket.io, cors, helmet, rate-limit
- Validation: joi
- Logging: winston
- Utilities: uuid, bcrypt, jwt
- HTTP: axios (VLC control)
- Storage: node-persist
- Docs: swagger-ui-express

**Import Patterns**:

**Expected** (✅):
- Routes → Services (all 8 routes)
- Services → Models (all 9 services)
- Models → Validators (all 8 models)
- WebSocket → Services (all 8 handlers)
- Services → persistenceService (shared layer)

**Anti-Patterns** (❌):
- Services ↔ Services (circular triangle)
- Service → WebSocket (stateService → listenerRegistry)
- Lazy requires inside methods (8 instances)

**Issue**: Complete dependency map reveals:
1. Well-structured layers (mostly)
2. One major architectural flaw (service circular dependencies)
3. One cross-layer violation (service → WebSocket)
4. Clear atomic refactor requirements

**Impact**: Provides foundation for:
- Understanding refactor complexity
- Identifying safe vs risky changes
- Planning atomic refactor coordination
- Estimating affected files for each change

**Target State**: Maintain current layer structure, eliminate:
- Circular service dependencies (introduce DI)
- Cross-layer violations (service → WebSocket)
- Lazy require anti-pattern

**Action Required**: Use dependency graph to:
1. Plan refactor order (safest → riskiest)
2. Estimate affected files per change
3. Identify atomic refactor requirements
4. Guide test coverage priorities

**Visual Graph**: See docs/api-alignment/work/DEPENDENCY-MAP-PHASE-6-1-7.md (ASCII dependency diagrams)

**Related Findings**: #44 (circular), #45 (lazy), #46 (cross-layer), #47 (coordination)

---
**Finding #49**: Absence of Dependency Injection Framework
**Category**: Architecture
**Location**: All service files
**Severity**: 🟡 Important
**Contract Alignment**: Code quality - testability and maintainability

**Current Pattern** (Manual Singleton):
```javascript
// services/sessionService.js
let instance = null;

class SessionService extends EventEmitter {
  constructor() {
    super();
    // No dependencies injected
  }

  static getInstance() {
    if (!instance) {
      instance = new SessionService();
    }
    return instance;
  }
}

module.exports = SessionService.getInstance();
```

**Dependencies Acquired**:
- Top-level `require()` for persistent dependencies
- Lazy `require()` inside methods for circular dependencies

**Issues**:
- No explicit dependency declaration
- Singleton pattern enforced at module level (hard to test)
- Circular dependencies broken by lazy requires (hidden dependencies)
- Cannot inject mock dependencies for testing
- Tight coupling (services directly require each other)

**Target Pattern** (Constructor Injection):
```javascript
// services/sessionService.js
class SessionService extends EventEmitter {
  constructor({ transactionService, stateService, persistenceService }) {
    super();
    this.transactionService = transactionService;
    this.stateService = stateService;
    this.persistenceService = persistenceService;
  }

  endSession() {
    // Use injected dependencies
    this.transactionService.resetScores();
    this.stateService.reset();
  }
}

module.exports = SessionService;
```

**app.js Wiring** (Manual DI):
```javascript
// Create services in dependency order
const persistenceService = new PersistenceService();
const sessionService = new SessionService({ persistenceService });
const transactionService = new TransactionService({
  sessionService,
  persistenceService
});
const stateService = new StateService({
  sessionService,
  transactionService,
  persistenceService
});

// Wire circular dependencies (if needed)
sessionService.setDependencies({ transactionService, stateService });

// Export singleton instances
module.exports = {
  sessionService,
  stateService,
  transactionService,
  // ...
};
```

**Benefits of DI**:
- Explicit dependencies (declared in constructor)
- Easier testing (inject mocks)
- Clear initialization order
- Supports circular dependencies properly
- Decoupling (services don't know how to create dependencies)

**Issue**: Without DI framework:
- Services use lazy requires (anti-pattern)
- Hard to test (cannot inject mocks)
- Hidden dependencies (not visible at constructor level)
- Initialization order not explicit

**Impact**: 
- Testing requires complex mocking (rewire, proxyquire)
- Circular dependencies are fragile
- Service boundaries unclear
- Refactoring is risky (hidden dependencies)

**Target State**: 
- Constructor injection for all services
- Manual DI container in app.js (no framework needed for this size)
- Zero lazy requires
- Explicit dependency graph

**Action Required**:
1. Update all service constructors to accept dependencies
2. Wire services in app.js with explicit initialization order
3. Remove all lazy require statements (Finding #45)
4. Update tests to inject mock dependencies
5. Document service dependency graph in app.js comments

**Alternatives Considered**:
- **InversifyJS**: Full DI framework (overkill for 9 services)
- **Awilix**: Lightweight DI container (possible, but adds dependency)
- **Manual DI**: Simple wiring in app.js (RECOMMENDED - no new dependencies)

**Recommendation**: Manual dependency injection in app.js
- No new external dependencies
- Explicit control over initialization
- Simple to understand
- Sufficient for current scale (9 services)

**Related Findings**: #44 (circular deps), #45 (lazy requires)

---

## Phase 6.1.7 Complete - Dependency Mapping Done

**Dependency Mapping Summary**:
- **6 findings documented** (#44-#49)
- **Files analyzed**: All 46 backend files (~10,646 lines)
- **Dependencies mapped**: 150+ import statements
- **Lazy requires identified**: 8 instances
- **Circular dependencies**: 1 triangle (3 services)

**CRITICAL Architectural Discoveries**:

1. **Circular Service Dependencies** (Finding #44):
   - sessionService ↔ stateService ↔ transactionService triangle
   - Broken by 8 lazy require statements
   - offlineQueueService creates dependency pressure (imports all 3 eagerly)
   - **ROOT CAUSE**: No dependency injection framework

2. **Lazy Require Anti-Pattern** (Finding #45):
   - 8 lazy requires across 3 service files
   - Workaround for circular dependencies
   - Hidden dependencies (not declared at file level)
   - Complicates testing and refactoring

3. **Cross-Layer Violation** (Finding #46):
   - stateService imports WebSocket layer (listenerRegistry)
   - Violates unidirectional data flow
   - Should use EventEmitter pattern instead

4. **Tight Coupling for Atomic Refactors** (Finding #47):
   - scannerId → deviceId: ~30 files must change atomically
   - Event wrapping: ~8 backend + 2 scanner repos atomically
   - Circular deps: ~10 backend files + all tests atomically
   - Documented safe vs risky refactor order

5. **Complete Dependency Graph** (Finding #48):
   - 8-layer structure (mostly well-organized)
   - 142 normal imports, 8 lazy requires, 1 circular triangle
   - Visual ASCII diagrams created
   - Clear atomic refactor requirements

6. **No Dependency Injection** (Finding #49):
   - Services use singleton + lazy require pattern
   - Hard to test (cannot inject mocks)
   - Recommendation: Manual DI in app.js (no framework needed)

**Detailed Documentation**:
- **Comprehensive Map**: docs/api-alignment/work/DEPENDENCY-MAP-PHASE-6-1-7.md
  - Complete import inventory by layer
  - Circular dependency analysis
  - Lazy require inventory (8 instances)
  - Tight coupling coordination map
  - Visual ASCII dependency graphs
  - DI transformation examples
  - Refactor order recommendations

**Answered Critical Questions**:
1. ✅ What services import each other? **Circular triangle: session ↔ state ↔ transaction**
2. ✅ How are circular deps broken? **8 lazy requires inside methods**
3. ✅ What must change atomically? **scannerId rename: ~30 files, event wrapping: ~8 files**
4. ✅ What's the refactor order? **Test pollution → event wrapper → toAPIResponse → circular deps → scannerId**

**Architecture Quality**:
- **Layer Structure**: ✅ 75% excellent (well-separated)
- **Circular Dependencies**: ❌ 1 critical issue (service triangle)
- **Cross-Layer Violations**: ⚠️ 1 instance (service → WebSocket)
- **Lazy Requires**: ❌ 8 anti-pattern instances
- **DI Framework**: ❌ Absent (needed for proper service management)
- **Overall**: Strong foundations, needs architectural cleanup

**Atomic Refactor Complexity**:
| Refactor | Files Affected | Risk | Coordination |
|----------|---------------|------|--------------|
| Test code pollution | 5 services | Low | None |
| Event wrapping | 8 backend + 2 scanners | Medium | Scanner repos |
| Session.toAPIResponse | 2 routes | Low | None |
| Circular dependencies | 10 backend + tests | High | All tests |
| scannerId → deviceId | 30 backend + 2 scanners | Critical | Everything |

**Ready for Phase 6.2**: ✅
Backend dependency graph complete. Tight coupling identified. Atomic refactor requirements documented.

**Next**: Decide whether to proceed with Phase 6.2 (Scanner Investigation) or skip to Phase 6.5 (Collaborative Decisions) given comprehensive backend understanding.

---
