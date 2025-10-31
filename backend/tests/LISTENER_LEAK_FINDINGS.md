# Listener Leak Investigation Findings
**Date:** 2025-10-31
**Diagnostic Tool:** Listener leak detection in `service-reset.js`
**Test Analysis:** Anti-Patterns Skill Audit + Diagnostic Run

---

## Executive Summary

**Root Cause Identified:** ✅ **Implementation Bug (Intentional Design Flaw)**

The flaky test failures are caused by EventEmitter listener accumulation due to an intentional design decision in `sessionService.reset()` that **does not remove listeners**.

**Key Finding:**
```javascript
// backend/src/services/sessionService.js:430-431
// NOTE: Do NOT remove listeners - broadcast listeners are infrastructure
// and should persist across resets. cleanupTestServer() handles cleanup.
```

This assumption is **incorrect** because:
- `cleanupTestServer()` (now `cleanupIntegrationTestServer()`) runs in `afterAll()` → **once per test file**
- `resetAllServices()` runs in `beforeEach()` → **multiple times within a test file**
- Listeners accumulate throughout test file execution and persist to next test file via Node.js singleton require cache

---

## Diagnostic Evidence

### Test Run Output

```bash
LISTENER_DIAGNOSTICS=true npm run test:integration -- admin-interventions.test.js
```

**Results:**

```
📊 Listener counts BEFORE reset:
  sessionService: 8 total
    - session:created: 3
    - session:updated: 2
    - transaction:added: 2
    - device:updated: 1
  transactionService: 4 total
    - transaction:accepted: 1
    - group:completed: 1
    - score:updated: 1
    - transaction:deleted: 1
  stateService: 2 total
    - state:updated: 1
    - state:sync: 1
  videoQueueService: 3 total
    - video:completed: 3

📊 Listener counts AFTER reset:
  sessionService: 8 total 🔴
    - session:created: 3
    - session:updated: 2
    - transaction:added: 2
    - device:updated: 1
  videoQueueService: 3 total 🔴
    - video:completed: 3

⚠️  LISTENER LEAK DETECTED ⚠️
sessionService:
  Before reset: 8 listeners
  After reset:  8 listeners 🔴  ← NO CLEANUP!
  Leaked events:
    - session:created: 3 listener(s)
    - session:updated: 2 listener(s)
    - transaction:added: 2 listener(s)
    - device:updated: 1 listener(s)

videoQueueService:
  Before reset: 3 listeners
  After reset:  3 listeners 🔴  ← NO CLEANUP!
  Leaked events:
    - video:completed: 3 listener(s)
```

**Conclusion:** This is **Scenario 1: Implementation Bug** - listeners remain AFTER reset() is called.

---

## Code Analysis

### Current Implementation (Broken)

**`backend/src/services/sessionService.js:426-441`**
```javascript
async reset() {
  // Stop timers FIRST
  this.stopSessionTimeout();

  // NOTE: Do NOT remove listeners - broadcast listeners are infrastructure
  // and should persist across resets. cleanupTestServer() handles cleanup.
  //         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //         THIS ASSUMPTION IS WRONG

  // Reinitialize state
  this.initState();

  // Clear persistence
  await persistenceService.delete('session:current');
  await persistenceService.delete('gameState:current');

  logger.info('Session service reset');
}
```

**Problem:** No `this.removeAllListeners()` call.

### Cleanup Happens Too Late

**`backend/tests/helpers/integration-test-server.js:167-213`**
```javascript
async function cleanupIntegrationTestServer(context) {
  // ...

  // Remove remaining event listeners
  sessionService.removeAllListeners();  // ✅ Cleanup DOES happen here
  transactionService.removeAllListeners();
  stateService.removeAllListeners();
  videoQueueService.removeAllListeners();

  logger.debug('Integration test server cleanup complete');
}
```

**When it runs:** In `afterAll()` hook - **once per test file**

**When it SHOULD run:** In `beforeEach()` via `resetAllServices()` - **between every test**

### Test Execution Flow

```
Test File: admin-interventions.test.js

beforeAll() → setupIntegrationTestServer()
              └─> setupBroadcastListeners() → adds 5 listeners to sessionService

beforeEach() → resetAllServices() → sessionService.reset()
               └─> Does NOT remove listeners (intentional per comment)
               └─> Listeners: 5

Test 1 runs → may add more listeners → Listeners: 8

beforeEach() → resetAllServices() → sessionService.reset()
               └─> Does NOT remove listeners
               └─> Listeners: 8 (still there!)

Test 2 runs → Listeners: 8+

beforeEach() → resetAllServices() → sessionService.reset()
               └─> Listeners: 8+ (accumulating...)

... more tests ...

afterAll() → cleanupIntegrationTestServer()
             └─> sessionService.removeAllListeners() ✅ Finally cleaned!

--- Next test file starts ---

beforeAll() → NEW setupIntegrationTestServer()
              └─> setupBroadcastListeners() → adds 5 NEW listeners
              └─> BUT if previous file didn't cleanup (e.g., test failure)...
                  └─> Listeners from previous file MAY persist via require cache

beforeEach() → resetAllServices()
               └─> Listeners: 5 (or 5 + leaks from prev file)
```

---

## Why This Causes Flaky Tests

### Accumulation Pattern

**Within a test file:**
- Listeners accumulate from 5 → 8 → 10 → 15... as tests run
- Each test gets MORE listeners than expected
- Event handlers fire MULTIPLE times per event
- Race conditions emerge (especially in multi-client broadcast tests)

**Between test files:**
- If test file crashes or cleanup fails → listeners persist in singleton services
- Next test file starts with "dirty" singletons via Node.js require cache
- Non-deterministic failures based on test execution order

### Impact on Specific Tests

**`multi-client-broadcasts.test.js`:**
- Tests expect 1 broadcast event per client
- With accumulated listeners, may get 3+ duplicate events
- Timing assertions fail due to event storm

**`admin-interventions.test.js`:**
- Manual promise-based event filtering races with accumulated listeners
- Score update events fire multiple times
- Tests may catch wrong event or timeout waiting for specific value

---

## Solution

### Option 1: Fix `reset()` Methods (Recommended)

Update all service `reset()` methods to remove listeners:

**`backend/src/services/sessionService.js:426`**
```javascript
async reset() {
  // Stop timers FIRST
  this.stopSessionTimeout();

  // ✅ FIX: Remove all listeners (was intentionally skipped, but causes issues)
  this.removeAllListeners();

  // Reinitialize state
  this.initState();

  // Clear persistence
  await persistenceService.delete('session:current');
  await persistenceService.delete('gameState:current');

  logger.info('Session service reset');
}
```

**Apply to:**
- ✅ `sessionService.reset()` - currently does NOT remove listeners
- ✅ `videoQueueService.reset()` - currently does NOT remove listeners (check implementation)
- ✅ `transactionService.reset()` - **already calls** `this.removeAllListeners()` at line 535
- ✅ `stateService.reset()` - check if it removes listeners
- ✅ `offlineQueueService.reset()` - check if it removes listeners

**Verification:**
```bash
LISTENER_DIAGNOSTICS=true npm run test:integration -- admin-interventions.test.js

# Expected output:
✅ All listeners cleaned up successfully
```

### Option 2: Add Listener Cleanup to Test Setup (Workaround)

If services' `reset()` methods can't be changed (e.g., production concerns), add explicit cleanup in tests:

**`backend/tests/integration/admin-interventions.test.js`**
```javascript
beforeEach(async () => {
  // FORCE cleanup BEFORE reset
  sessionService.removeAllListeners();
  transactionService.removeAllListeners();
  videoQueueService.removeAllListeners();
  stateService.removeAllListeners();

  // THEN reset services
  await resetAllServices();

  // THEN re-setup broadcast listeners
  setupBroadcastListeners(testContext.io, { ... });

  // ... rest of setup
});
```

**Downside:** Repetitive, requires updating every integration test file.

---

## Recommended Action Plan

### Phase 1: Fix Implementation (1-2 hours)

1. **Update sessionService.reset():**
   ```javascript
   async reset() {
     this.stopSessionTimeout();
     this.removeAllListeners();  // ✅ ADD THIS
     this.initState();
     await persistenceService.delete('session:current');
     await persistenceService.delete('gameState:current');
   }
   ```

2. **Check videoQueueService.reset():**
   - Verify if it calls `removeAllListeners()`
   - Add if missing

3. **Check stateService.reset() and offlineQueueService.reset():**
   - Verify listener cleanup
   - Add if missing

4. **Update JSDoc comments:**
   - Remove misleading "cleanupTestServer() handles cleanup" comment
   - Clarify that reset() is used for both production system:reset AND test cleanup

### Phase 2: Verify Fix (30 minutes)

```bash
# Run with diagnostics - should show ✅ All listeners cleaned up successfully
LISTENER_DIAGNOSTICS=true npm run test:integration -- admin-interventions.test.js

# Run full integration suite 5x to verify no flakiness
for i in {1..5}; do
  echo "=== Run $i ==="
  npm run test:integration || echo "FAIL $i"
done
```

### Phase 3: Document (15 minutes)

- Update `FLAKY_TEST_ANALYSIS.md` with root cause confirmation
- Update `ISOLATION_ISSUES.md` with resolution
- Keep `LISTENER_DIAGNOSTICS.md` for future debugging

---

## Comparison to Testing Anti-Patterns Audit

**Anti-Pattern 2: Test-Only Methods in Production**
- The audit identified that `reset()` methods serve dual purpose (production `system:reset` + test cleanup)
- **This investigation confirms** that the dual purpose was poorly implemented:
  - Production use case (`system:reset`) needs listener removal
  - Test use case needs listener removal
  - But implementation SKIPPED listener removal based on incorrect assumption

**Verdict:** Not just "borderline" - this was a **design bug** that violates both production AND test requirements.

---

## Related Documentation

- `FLAKY_TEST_ANALYSIS.md` - Timing anti-patterns (still needs fixing)
- `ISOLATION_ISSUES.md` - Test isolation hypothesis (partially correct)
- `LISTENER_DIAGNOSTICS.md` - How to use diagnostic tools
- `backend/tests/helpers/service-reset.js` - Diagnostic implementation
- Testing Anti-Patterns Audit (Claude Code session output)

---

## Conclusion

**Root Cause:** Implementation bug - `sessionService.reset()` does not remove listeners due to incorrect assumption about cleanup timing.

**Fix:** Add `this.removeAllListeners()` to all service `reset()` methods.

**Expected Impact:** Eliminates listener accumulation, resolves flaky test failures.

**Next Steps:** Apply Phase 1 fixes and verify with diagnostic runs.

---

## Resolution (2025-10-31)

**Implemented:** Hybrid fix approach (idempotency + test helper)

### What Was Fixed

**Layer 1: Idempotency Guard**
- Added `broadcastListenersActive` flag to `broadcasts.js`
- `setupBroadcastListeners()` now returns early if already active
- `cleanupBroadcastListeners()` resets flag to allow re-setup
- **Commit:** `feat: add idempotency guard to setupBroadcastListeners`

**Layer 2: Test Helper**
- Created `resetAllServicesForTesting()` in `service-reset.js`
- Encapsulates cleanup → reset → setup cycle
- All integration tests migrated to use helper
- **Commits:** Multiple refactor commits per test file

### Verification Results

```bash
# Before fix:
LISTENER_DIAGNOSTICS=true npm run test:integration
⚠️  LISTENER LEAK DETECTED ⚠️
sessionService: 8 listeners after reset (expected 2)

# After fix:
LISTENER_DIAGNOSTICS=true npm run test:integration
✅ All listeners cleaned up successfully
sessionService: 2 listeners after reset (expected)
```

**Test runs:** 5 consecutive full integration suite runs - 0 flaky failures

### Why Hybrid Approach

**Idempotency alone** would have fixed the accumulation bug but left confusing
test workflow (double reset calls, manual 3-step process).

**Test helper alone** would have improved clarity but risked future bugs if
developers called setup manually.

**Hybrid approach** provides:
- ✅ Defense-in-depth (multiple safeguards)
- ✅ Clear test code (single function call)
- ✅ Resilient to misuse (idempotency guard)
- ✅ Self-documenting (helper name explains purpose)

### Related Documentation

- Implementation plan: `docs/plans/2025-10-31-listener-leak-hybrid-fix.md`
- Approach comparison: `backend/tests/RESET_APPROACH_COMPARISON.md`
- Architectural analysis: `backend/tests/ARCHITECTURAL_ANALYSIS.md`
