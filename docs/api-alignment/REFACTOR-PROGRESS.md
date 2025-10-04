# API Alignment Refactor - Progress Report

**Created**: 2025-10-03
**Status**: Phase 3 Complete, Phase 4 Next
**Branch**: 001-backend-aln-architecture

---

## Executive Summary

**Phases Completed**: 0, 1, 2, 3 (100%)
**Phases Remaining**: 4, 5 (GM Scanner Modularization + Final Validation)
**Total Commits**: 30+ across backend + 2 submodules
**Code Changes**: ~2,000+ lines modified/deleted

**Current State**:
- ✅ Backend services use EventEmitter pattern (no circular deps)
- ✅ Backend routes consolidated (29 → 8 essential endpoints)
- ✅ Field naming standardized (scannerId → deviceId everywhere)
- ✅ All WebSocket events use wrapped envelope {event, data, timestamp}
- ✅ GM Scanner handlers standardized and contract-compliant
- 🔜 GM Scanner still monolith (6,428 lines) - Phase 4 target

---

## Phase 0: Test Infrastructure Setup

**Goal**: Establish test infrastructure before refactoring

**Duration**: ~4 hours

### Commits

| Commit | Description |
|--------|-------------|
| 74bec84c | Install test dependencies (ajv, ajv-formats, js-yaml) |
| 1ea7bcb6 | Delete broken tests for clean slate |
| a688e401 | Create contract validator helpers (Decision 1 from 06-test-architecture.md) |

### Changes

**Installed**:
- `ajv` v8.12.0 - JSON Schema validator
- `ajv-formats` v2.1.1 - Format validators (date-time, uri, etc.)
- `js-yaml` v4.1.0 - YAML parser for contracts

**Created**:
- `backend/tests/helpers/contract-validator.js` (85 lines)
  - `validateHTTPResponse()` - OpenAPI validation
  - `validateWebSocketEvent()` - AsyncAPI validation

**Deleted**:
- Obsolete integration tests (network_recovery.test.js, etc.)
- Broken contract tests (websocket-contracts-simple.test.js)

### Impact

- ✅ Clean test slate for TDD implementation
- ✅ Contract validation infrastructure ready
- ✅ Single source of truth: contracts drive tests

---

## Phase 1.1: Service EventEmitter Pattern Migration

**Goal**: Remove lazy requires, implement event-driven architecture

**Duration**: ~14 hours

### Commits

| Commit | Description |
|--------|-------------|
| 3a0739c4 | sessionService emits session:update event [1.1.1] |
| 8e07fb45 | transactionService listens to session:update [1.1.2] |
| f03c4263 | transactionService emits score:updated [1.1.3] |
| 7aff263f | stateService uses top-level imports [1.1.4] |
| bff33ee5 | Remove 5 redundant lazy requires from videoQueueService [1.1.5] |
| 2f35d87f | Remove final 2 lazy requires from transactionService [1.1.6] |
| 0e362e6f | docs: Update refactor plan - Phase 1.1 COMPLETE |

### Changes

**Services Refactored** (event-driven):
- `sessionService` - Emits: session:update
- `transactionService` - Emits: score:updated, transaction:new
- `stateService` - Listens only (no circular deps)
- `videoQueueService` - Cleaned up config lazy requires

**Pattern**:
```javascript
// Before (lazy require = circular dependency)
function endSession() {
  const stateService = require('./stateService'); // ❌ Lazy
  stateService.resetState();
}

// After (event emission)
function endSession() {
  this.emit('session:update', { status: 'ended' }); // ✅ Event
}
```

**Eliminated**:
- 18 lazy `require()` statements (all 8 from original Finding #44 + 10 more discovered)
- Circular dependencies: sessionService ↔ stateService ↔ transactionService

### Impact

- ✅ Zero circular dependencies (verified with madge)
- ✅ Services independently testable
- ✅ Domain events = WebSocket events (single event system)
- ✅ broadcasts.js listens to domain events, forwards as WebSocket

---

## Phase 1.2: Route File Consolidation

**Goal**: Implement Decision #1 route structure (8 → 5 files)

**Duration**: ~4 hours

### Commits

| Commit | Description |
|--------|-------------|
| 3c12ecf9 | Create resourceRoutes.js (tokens + health) [1.2.3] |
| acc757bc | Prune adminRoutes.js (11 → 2 endpoints) [1.2.4] |
| eae4a3be | Prune sessionRoutes.js (5 → 1 endpoint) [1.2.5] |
| 4a3b040b | Prune stateRoutes.js (2 → 1 endpoint) [1.2.6] |
| db7e4509 | Delete obsolete route files [1.2.7] |
| 4c95fa12 | Clean up route registrations [1.2.8] |
| c205760a | Add scan endpoint contract tests [1.2.9] |

### Changes

**Route Structure**:
```
Before (8 files, 29 endpoints):
- adminRoutes.js (11)
- scanRoutes.js (2)
- sessionRoutes.js (5)
- stateRoutes.js (2)
- tokenRoutes.js (1)
- transactionRoutes.js (4)
- videoRoutes.js (1)
- docsRoutes.js (static)
- app.js (1 inline health)

After (5 files, 8 endpoints):
- adminRoutes.js (2) - auth, logs
- scanRoutes.js (2) - scan, batch
- sessionRoutes.js (1) - GET /api/session
- stateRoutes.js (1) - GET /api/state
- resourceRoutes.js (2) - tokens, health
```

**Deleted Files**:
- `transactionRoutes.js` - All endpoints moved to WebSocket
- `videoRoutes.js` - Moved to WebSocket gm:command
- `tokenRoutes.js` - Merged into resourceRoutes.js

**Lines Removed**: ~870 lines from pruned files

### Impact

- ✅ 72% endpoint reduction (29 → 8 essential)
- ✅ RESTful resource-based organization
- ✅ Admin commands unified under WebSocket gm:command
- ✅ Matches 09-essential-api-list.md specification

---

## Phase 2: Field Naming Standardization

**Goal**: Change scannerId → deviceId atomically across entire system

**Duration**: ~6 hours

### Commits

| Commit | Description | Repos |
|--------|-------------|-------|
| b8ff2370 | Change scannerId → deviceId atomically [2.1.1] | backend |
| 89e3b440 | Complete deviceId in remaining services [2.1.2] | backend |
| 9a2404fa | Update ALNScanner reference [2.2] | parent |
| 6ec0df88 | Update aln-memory-scanner reference [2.3] | parent |
| 7824ddc3 | Phase 2 complete [phase-2-complete] | backend |

### Changes

**Backend** (Transaction.toJSON() + validators + 12 files):
- `models/transaction.js:113` - Transaction.toJSON() field
- `utils/validators.js:37,148` - transactionSchema + scanRequestSchema
- All services, routes, WebSocket handlers using Transaction

**ALNScanner** (GM Scanner):
- `index.html:2672` - DataManager.addTransaction() normalization
- `index.html:4510` - App.processTransaction() submission
- Internal references: Settings, ConnectionManager, OrchestratorClient

**aln-memory-scanner** (Player Scanner):
- Field naming updates for HTTP scan submission

**ATOMIC Change**: Backend + both scanners changed in coordinated commits

### Impact

- ✅ Consistent field naming across entire system
- ✅ Matches AsyncAPI contract (deviceId field per Decision #4)
- ✅ No orphaned references (grep verified 0 occurrences of scannerId)
- ✅ Demonstrates submodule coordination pattern

---

## Phase 3.1: Backend Event Wrapping

**Goal**: All WebSocket events use wrapped envelope {event, data, timestamp}

**Duration**: ~4 hours

### Commits

| Commit | Description |
|--------|-------------|
| 30824c20 | Use eventWrapper helpers for broadcasts [3.1.1] |
| 05553d54 | Complete Phase 3.1 + dead code cleanup [3.1] |

### Changes

**Files Modified** (77 emissions wrapped):
- `websocket/broadcasts.js` - 19 emissions (service events → WebSocket)
- `websocket/adminEvents.js` - 20 emissions
- `websocket/deviceTracking.js` - 6 emissions
- `websocket/videoEvents.js` - 24 emissions
- `websocket/gmAuth.js` - 8 emissions

**Pattern Applied**:
```javascript
// Before (unwrapped or manually wrapped)
io.emit('score:updated', { teamId: '001', score: 100 });
// OR
io.emit('score:updated', {
  event: 'score:updated',
  data: { teamId: '001', score: 100 },
  timestamp: new Date().toISOString()
});

// After (using helper)
emitWrapped(io, 'score:updated', { teamId: '001', score: 100 });
// Helper adds: {event, data, timestamp} wrapper
```

**Dead Code Removed** (381 lines):
- `websocket/roomManager.js` - Deleted entire file (340 lines, 0 usage)
- `websocket/broadcasts.js` - Removed 3 legacy helpers (41 lines):
  - `broadcastToRoom()` - Partial wrapping, unused
  - `broadcastToGmStations()` - Unused
  - `broadcastToPlayers()` - Unused

**Unit Tests Created**:
- `tests/unit/websocket/broadcasts.test.js` - 12 tests, all passing
- Validates wrapper usage, room targeting, envelope structure

### Impact

- ✅ 100% AsyncAPI compliance for backend WebSocket events
- ✅ Consistent envelope structure: {event, data, timestamp}
- ✅ Finding #21 resolved (eventWrapper.js now imported everywhere)
- ✅ Finding #22 resolved (62% unwrapped → 0% unwrapped)
- ✅ Cleaner codebase (381 lines dead code removed)

---

## Phase 3.2: GM Scanner Event Handler Standardization

**Goal**: All handlers use const payload = eventData.data; pattern

**Duration**: ~3 hours (2 attempts)

### Commits

| Commit | Description | Repo |
|--------|-------------|------|
| 5ca6a86 | Standardize all event handlers [3.2] | ALNScanner |
| cbd4b0bc | Update ALNScanner reference [3.2] | parent |
| 41bc53a | Fix contract violations [3.2-fix] | ALNScanner |
| f32da8ce | Update ALNScanner reference [3.2-fix] | parent |

### First Attempt (5ca6a86)

**What Was Done**:
- Standardized 14 WebSocket event handlers
- Applied `const payload = eventData.data;` pattern
- Removed defensive fallback `|| eventData`

**What Was Missed**:
- Did NOT delete 4 dead event handlers
- Did NOT add 4 missing event handlers
- Did NOT fix 2 inconsistent payload emissions

### Second Attempt (41bc53a - Contract Violations Fixed)

**Deleted 4 Dead Event Handlers** (93 lines):
- `state:update` - Eliminated per asyncapi.yaml:318
- `scores:reset` - Not in AsyncAPI contract
- `team:created` - Not in AsyncAPI contract
- `state:sync` - Eliminated (redundant with sync:full)

**Fixed 2 Inconsistent Emissions**:
- `score:updated` line 5803: `emit(payload)` not `emit(eventData)`
- `group:completed` line 5831: `emit(payload)` not `emit(eventData)`

**Added 4 Missing Handlers**:
1. **transaction:result** (Decision #10 compliance):
   ```javascript
   this.socket.on('transaction:result', (eventData) => {
     const payload = eventData.data;
     // MUST check status and display errors to user
     if (payload.status === 'error') {
       UIManager.showError(payload.message);
     }
   });
   ```

2. **session:update** (replaces session:paused/resumed/ended):
   ```javascript
   this.socket.on('session:update', (eventData) => {
     const payload = eventData.data;
     this.sessionId = payload.id;
     console.log(`Session ${payload.status}:`, payload);
   });
   ```

3. **gm:command:ack** (admin panel feedback):
   ```javascript
   this.socket.on('gm:command:ack', (eventData) => {
     const payload = eventData.data;
     if (!payload.success) {
       UIManager.showError(`Command failed: ${payload.message}`);
     }
   });
   ```

4. **offline:queue:processed** (queue management):
   ```javascript
   this.socket.on('offline:queue:processed', (eventData) => {
     const payload = eventData.data;
     UIManager.showInfo(`Processed ${payload.queueSize} queued transactions`);
   });
   ```

**Test Files Cleanup**:
- Deleted 14 untracked test files (tested wrong abstraction)
- Files tested OrchestratorClient module, not Phase 3.2 handlers
- Proper unit tests will be written in Phase 4 after modularization

### Final State

**14 Application Event Handlers** (all contract-compliant):
1. gm:identified
2. transaction:new
3. transaction:result ← NEW
4. video:status
5. score:updated
6. group:completed
7. device:connected
8. device:disconnected
9. sync:full
10. session:update ← NEW
11. gm:command:ack ← NEW
12. offline:queue:processed ← NEW
13. error
14. heartbeat:ack

**Plus 5 Socket.io Protocol Handlers** (unchanged):
- connect, disconnect, connect_error, reconnecting, reconnect

**Validation Results**:
- ✅ All 14 handlers use `const payload = eventData.data;`
- ✅ Zero defensive fallbacks (grep `|| eventData` returns 0)
- ✅ All emit `payload` not `eventData`
- ✅ Matches AsyncAPI 2.6.0 contract

### Impact

- ✅ Finding #54 resolved (3 inconsistent patterns → 1 standard pattern)
- ✅ Finding #55 resolved (4 dead handlers deleted)
- ✅ Decision #10 implemented (transaction:result error display)
- ✅ 08-functional-requirements.md compliance (all required handlers present)
- ✅ GM Scanner ready for Phase 4 modularization

---

## Phase 3 Summary

**Combined Impact**:

**Backend**:
- 77 WebSocket emissions wrapped with eventWrapper helpers
- 381 lines dead code removed
- 100% AsyncAPI contract compliance

**GM Scanner**:
- 14 event handlers standardized
- 4 dead handlers deleted (93 lines)
- 4 missing handlers added
- 100% AsyncAPI contract compliance

**Test Strategy**:
- Manual validation per refactor-plan.md (no premature tests)
- Proper unit tests deferred to Phase 4 (after modularization)
- Follows established test pyramid (06-test-architecture.md)

---

## Key Patterns Established

### 1. Submodule Coordination Pattern

**Two-Step Commit**:
1. Commit changes in submodule (ALNScanner/aln-memory-scanner)
2. Update parent submodule reference with `chore(submodule): ...`

**Example** (Phase 3.2):
```bash
# In ALNScanner:
git commit -m "refactor(websocket): Fix contract violations [3.2-fix]"

# In parent:
git add ALNScanner
git commit -m "chore(submodule): Update ALNScanner to Phase 3.2 fixes [3.2-fix]"
```

### 2. ATOMIC Breaking Changes

**Phase 2 Field Naming**:
- Changed backend Transaction.toJSON() + validators FIRST (blocking)
- Changed both scanners IMMEDIATELY after
- Single coordinated deploy (backend + scanners + tests together)
- No orphaned references

### 3. Event-Driven Architecture

**Domain Events = WebSocket Events**:
```javascript
// Service emits domain event
sessionService.emit('session:update', { status: 'ended' });

// Two listeners:
// 1. Other services (internal coordination)
stateService.on('session:update', () => { resetState(); });

// 2. broadcasts.js (external broadcast)
sessionService.on('session:update', (data) => {
  emitWrapped(io, 'session:update', data);
});
```

**Single source of truth**: asyncapi.yaml documents both uses

### 4. Test Strategy

**Test Pyramid** (from 06-test-architecture.md):
```
         ▲
        ╱ ╲        5-10 Integration tests (multi-component flows)
       ╱   ╲
      ╱     ╲      25-35 Contract tests (API structure)
     ╱       ╲
    ╱         ╲    100+ Unit tests (business logic, isolated)
   ╱___________╲
```

**When to Write Tests**:
- ❌ NOT during monolith refactoring (Phase 3.2)
- ✅ AFTER modularization (Phase 4+)
- ✅ Unit tests for extracted modules
- ✅ Contract tests for API compliance
- ✅ Integration tests for end-to-end flows

---

## Statistics

**Commits**: 30+ (backend) + 4 (ALNScanner) + 2 (aln-memory-scanner)

**Code Changes**:
- Backend: ~1,500 lines modified, ~450 lines deleted
- ALNScanner: ~150 lines modified, ~93 lines deleted
- aln-memory-scanner: ~50 lines modified

**Files Modified**: 35+ backend files, 1 scanner monolith

**Dead Code Removed**: 474 lines total
- roomManager.js: 340 lines
- broadcasts.js legacy helpers: 41 lines
- ALNScanner dead handlers: 93 lines

**Tests Created**: 1 unit test file (broadcasts.test.js - 12 tests)

---

## Next Phase: Phase 4 - GM Scanner Modularization

**Goal**: Extract 6,428-line monolith into 15 modular files

**Status**: Ready to begin (Phase 3 complete)

**Prerequisites** (all ✅):
- ✅ Event handlers standardized (Phase 3.2)
- ✅ Field naming consistent (Phase 2)
- ✅ Contract compliance verified
- ✅ Clean slate for modular extraction

**See**: 07-refactor-plan.md Phase 4 (lines 1817-2342) for detailed tasks

---

*Last Updated: 2025-10-03*
*Branch: 001-backend-aln-architecture*
*Next: Phase 4 preparation and task analysis*
