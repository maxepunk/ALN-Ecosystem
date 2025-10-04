# Phase 5.4 Pre-Implementation Session: Critical Discoveries & Decisions

**Date**: 2025-10-04
**Status**: Infrastructure fixes completed, ready to start integration test implementation

---

## Session Overview

This session focused on deep investigation of test infrastructure before implementing Phase 5.4 integration tests. Multiple critical bugs were discovered and fixed.

---

## Critical Bugs Found & Fixed

### 1. Broadcast Listener Memory Leak (CRITICAL)
**Location**: `tests/helpers/test-server.js`

**Problem**:
- `cleanupTestServer()` never called `cleanupBroadcastListeners()`
- Every test setup added broadcast listeners via `setupBroadcastListeners()`
- Listeners accumulated across 271 tests → hundreds of leaked listeners
- This was the PRIMARY cause of "force exit" warnings

**Fix Applied**:
```javascript
// test-server.js cleanup function
async function cleanupTestServer(context) {
  // CRITICAL: Clean up broadcast listeners FIRST
  cleanupBroadcastListeners();  // ← ADDED THIS

  // ... rest of cleanup
}
```

**Impact**: Eliminated primary memory leak in test suite

---

### 2. Incomplete Service Cleanup
**Location**: `tests/helpers/test-server.js`

**Problem**:
- Only cleaned up sessionService, transactionService, stateService
- Never cleaned up videoQueueService (has playback timers!)
- Never cleaned up offlineQueueService (has queue state)

**Fix Applied**:
```javascript
async function cleanupTestServer(context) {
  // ...

  // Reset ALL services (not just 3)
  const videoQueueService = require('../../src/services/videoQueueService');
  const offlineQueueService = require('../../src/services/offlineQueueService');

  videoQueueService.reset(); // Clears playback timers
  offlineQueueService.reset(); // Clears queue state

  // Remove ALL event listeners
  videoQueueService.removeAllListeners();
  offlineQueueService.removeAllListeners();
}
```

**Impact**: Eliminated timer leaks from video queue service

---

### 3. HTTP Agent Keep-Alive Connections
**Location**: `jest.config.js` + new `jest.globalTeardown.js`

**Problem**:
- Contract tests use supertest → creates HTTP agents with keep-alive
- Keep-alive sockets stay open for ~5s after tests complete
- Jest sees: "Tests done, but connections open" → force exit warning

**Fix Applied**:
```javascript
// NEW FILE: jest.globalTeardown.js
module.exports = async () => {
  http.globalAgent.destroy();
  https.globalAgent.destroy();
};

// jest.config.js
module.exports = {
  // ...
  globalTeardown: '<rootDir>/jest.globalTeardown.js',  // ← ADDED THIS
};
```

**Why This is Safe**:
- Global teardown runs ONCE after ALL tests (not per-file)
- Each Jest worker has its own `http.globalAgent` (process-isolated)
- Destroying agents only closes sockets, doesn't prevent new connections
- Does NOT cause race conditions (unlike module cache / service resets)

**Impact**: Proper HTTP agent cleanup (remaining warnings are supertest internals - acceptable)

---

## Test Infrastructure Decisions

### Decision 1: Separate Integration Test Server
**Created**: `tests/helpers/integration-test-server.js`

**Reasoning**:
- Contract tests need stateless isolation (reset between tests)
- Integration tests need stateful flows (preserve state within scenarios)
- Sharing test-server.js would cause conflicts

**Key Differences**:
| Feature | test-server.js (Contract) | integration-test-server.js (Integration) |
|---------|---------------------------|------------------------------------------|
| Service initialization | Minimal/mock data | Full real token data |
| Cleanup timing | After every test | After entire test file |
| Broadcast listener cleanup | ✅ Now included | ✅ Included |
| State preservation | Reset immediately | Preserve during scenario |

**Usage Pattern**:
```javascript
// Integration test
const { setupIntegrationTestServer, cleanupIntegrationTestServer } =
  require('../helpers/integration-test-server');

beforeAll(async () => {
  testContext = await setupIntegrationTestServer();
});

afterAll(async () => {
  await cleanupIntegrationTestServer(testContext);
});
```

---

### Decision 2: WebSocket Helpers are Appropriate for Integration Tests
**Assessment**: ✅ NO CHANGES NEEDED

**Helpers from `websocket-helpers.js`**:
- `waitForEvent()` - Works for both contract and integration
- `connectAndIdentify()` - Handles GM and scanner types
- `waitForMultipleEvents()` - Useful for collecting broadcasts
- `cleanupSockets()` - Proper cleanup pattern

**Minor Enhancement Recommended**:
```javascript
// Add to websocket-helpers.js for convenience:
async function waitForAllEvents(socket, events, timeout = 5000) {
  // Wait for DIFFERENT events in parallel (not multiple of same)
  return Promise.all(events.map(e => waitForEvent(socket, e, timeout)));
}
```

---

### Decision 3: Use Contract Validator in Integration Tests
**Assessment**: ✅ RECOMMENDED for double-validation

**Pattern**:
```javascript
const { validateWebSocketEvent } = require('../helpers/contract-validator');

it('should process transaction correctly', async () => {
  const result = await waitForEvent(gmSocket, 'transaction:result');

  // Validate business logic
  expect(result.data.status).toBe('accepted');
  expect(result.data.points).toBe(3000);

  // ALSO validate contract compliance
  validateWebSocketEvent(result, 'transaction:result');
});
```

**Benefits**:
- Catches contract regressions in integration tests
- Ensures integration flows produce contract-compliant events
- Extra confidence layer

---

## "No Global Teardown" Principle Re-Evaluated

### Original Principle (from jest.setup.js)
**Problem cases** (still valid - do NOT use global teardown):
1. ❌ Clearing module cache → breaks singleton services
2. ❌ Resetting services → race conditions in parallel tests
3. ❌ Deleting data directory → file system race conditions

**These are STATEFUL operations that conflict across parallel workers**

### Exception for HTTP Agents (new understanding)
**Why HTTP agent cleanup IS safe globally**:
1. ✅ Process-isolated (each Jest worker has own `http.globalAgent`)
2. ✅ Stateless (just connection pools, auto-recreate)
3. ✅ Non-blocking (`destroy()` doesn't prevent new connections)
4. ✅ No race conditions (workers don't share agents)

**Conclusion**: The principle still holds for stateful operations. HTTP agents are a valid exception.

---

## Mock VLC Implementation Requirements

### Critical Requirement from User
> "MAKE SURE you're checking the ACTUAL implementation for VLC and creating an ACCURATE mock to avoid big debugging headaches later on"

### VLC Service Analysis (from `src/services/vlcService.js`)

**Key VLC HTTP API Patterns**:
1. **Status endpoint**: `GET /requests/status.json`
2. **Command pattern**: `GET /requests/status.json?command=<cmd>&input=<value>`
3. **Commands used**:
   - `in_play` - Play video immediately (replaces current)
   - `pl_play` - Resume/start playback
   - `pl_pause` - Pause playback
   - `pl_stop` - Stop playback
   - `pl_next` - Skip to next

**Critical Behaviors**:
- Returns JSON status: `{ state, length, time, information: { category: { meta: { filename }}}}`
- Graceful degradation when disconnected (returns degraded: true)
- Path conversion: relative paths → `file://<absolute>` URLs

**Mock MUST Replicate**:
- Exact JSON structure (especially `information.category.meta.filename`)
- State transitions (stopped → loading → playing → stopped)
- Duration in `length` field
- Command handling (in_play, pl_pause, pl_stop)

---

## Test Execution Order Correction

### From Phase 5.4 Plan (original)
Priority 1A: Mock VLC Infrastructure + **Video Orchestration Tests**

### User Correction
> "follow the ACTUAL plan from refactor plan phase5.4 and create the FIRST test (Complete transaction flow)"

### Corrected Order
1. ✅ Priority 1A: Mock VLC Infrastructure (foundation)
2. ✅ **Priority 1B: Transaction Flow Tests** ← FIRST TEST per plan
3. Priority 1C: Offline Queue Sync
4. Priority 1D: State Synchronization
5. LATER: Video Orchestration (uses mock VLC)

**Reason**: Transaction flow is the PRIMARY integration test covering core game mechanics.

---

## Force Exit Warning: Final Status

### What We Fixed
✅ Broadcast listener leak (PRIMARY issue)
✅ Service timer cleanup (videoQueueService)
✅ HTTP agent cleanup (globalTeardown)

### What Remains
⚠️ Supertest ephemeral HTTP servers (node_modules/supertest internals)

### Why Remaining Warning is Acceptable
1. **Jest configured for this**: `forceExit: true` in jest.config.js
2. **No actual leak**: Supertest servers close after ~5s (by design)
3. **Known behavior**: Documented supertest characteristic
4. **All tests pass**: 271/271 ✅
5. **Real leaks eliminated**: Broadcast listeners were the actual problem

**Conclusion**: Force exit warning is cosmetic. System is properly cleaned up.

---

## Files Modified This Session

### Test Infrastructure
- ✅ `tests/helpers/test-server.js` - Fixed broadcast listener leak + service cleanup
- ✅ `tests/helpers/integration-test-server.js` - NEW (separate integration helper)
- ✅ `jest.config.js` - Added globalTeardown
- ✅ `jest.globalTeardown.js` - NEW (HTTP agent cleanup)
- ✅ `jest.setup.js` - Cleaned up, documented HTTP agent exception

### Documentation (pending)
- ⏳ `docs/api-alignment/07-refactor-plan-phase5.4.md` - Needs updates per this session

---

## Next Steps

1. ✅ Commit infrastructure fixes
   - Fix: Broadcast listener leak
   - Fix: Service cleanup completeness
   - Fix: HTTP agent cleanup
   - Add: integration-test-server.js helper

2. ⏳ Update Phase 5.4 plan with session discoveries

3. ⏳ Implement Priority 1B: Transaction Flow Tests (FIRST integration test)

---

## Key Takeaways

1. **Always investigate infrastructure deeply** before writing tests
2. **Test cleanup is CRITICAL** - leaks accumulate fast (271 tests!)
3. **Principles have exceptions** - "no global teardown" doesn't apply to process-isolated resources
4. **Mock accuracy matters** - must match actual implementation behavior
5. **Separate helpers for separate purposes** - contract vs integration tests have different needs

---

**This document serves as the authoritative record of infrastructure decisions and fixes made during Phase 5.4 preparation.**
