# AdminModule Bug Discovery Log
## Phase 2.2: AdminModule Unit Testing

**Date:** 2025-10-06
**Tests Created:** 37 tests (8 test groups)
**Bugs Found:** 8 bugs (5 HIGH, 3 MEDIUM)
**All Bugs Fixed:** ✅ All 37 tests passing

---

## Bug Summary

| Bug # | Severity | Type | Status | Tests Added |
|-------|----------|------|--------|-------------|
| #005 | HIGH | Missing Feature | ✅ Fixed | 1 |
| #006 | HIGH | Missing Feature | ✅ Fixed | 1 |
| #007 | HIGH | Missing Feature | ✅ Fixed | 1 |
| #008 | HIGH | Missing Feature | ✅ Fixed | 1 |
| #009 | HIGH | Missing Feature | ✅ Fixed | 1 |
| #010 | MEDIUM | Missing Validation | ✅ Fixed | 1 |
| #011 | MEDIUM | Missing Validation | ✅ Fixed | 1 |
| #012 | MEDIUM | Missing Validation | ✅ Fixed | 1 |

---

## Bug #005: Missing video:queue:add Command
**Severity:** HIGH
**Discovered:** Phase 2.2 - Test 7
**Root Cause:** AsyncAPI contract defines video:queue:add (line 1032) but implementation missing

### Impact
- **Contract Violation:** Admin panel cannot add videos to queue manually
- **Functional Requirement:** Section 4.2 Video Control requires queue:add for manual intervention
- **Use Case:** GM needs to manually queue a video when Player Scanner has issues

### Test That Found It
```javascript
it('should have addToQueue method for video:queue:add command', () => {
  expect(videoController.addToQueue).toBeDefined();
  expect(typeof videoController.addToQueue).toBe('function');
});
```

### Fix Applied
Added `addToQueue(tokenId, filename)` method to VideoController:
```javascript
async addToQueue(tokenId, filename) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

        this.connection.socket.once('gm:command:ack', (response) => {
            clearTimeout(timeout);
            if (response.data.success) {
                resolve(response.data);
            } else {
                reject(new Error(response.data.message || 'Failed to add to queue'));
            }
        });

        this.connection.socket.emit('gm:command', {
            event: 'gm:command',
            data: {
                action: 'video:queue:add',
                tokenId: tokenId,
                filename: filename,
                timestamp: new Date().toISOString()
            }
        });
    });
}
```

**Verification:** Test passes ✅

---

## Bug #006: Missing video:queue:reorder Command
**Severity:** HIGH
**Discovered:** Phase 2.2 - Test 7
**Root Cause:** AsyncAPI contract defines video:queue:reorder (line 1045) but implementation missing

### Impact
- **Contract Violation:** Admin panel cannot reorder queue
- **Functional Requirement:** Section 4.2.3 Queue Management requires reordering
- **Use Case:** GM needs to prioritize important video after accidental scan

### Test That Found It
```javascript
it('should have reorderQueue method for video:queue:reorder command', () => {
  expect(videoController.reorderQueue).toBeDefined();
  expect(typeof videoController.reorderQueue).toBe('function');
});
```

### Fix Applied
Added `reorderQueue(newOrder)` method to VideoController.

**Verification:** Test passes ✅

---

## Bug #007: Missing video:queue:clear Command
**Severity:** HIGH
**Discovered:** Phase 2.2 - Test 7
**Root Cause:** AsyncAPI contract defines video:queue:clear (line 1058) but implementation missing

### Impact
- **Contract Violation:** Admin panel cannot clear queue
- **Functional Requirement:** Section 4.2.3 Queue Management requires clearing
- **Use Case:** GM needs to clear queue when session restarts or errors occur

### Test That Found It
```javascript
it('should have clearQueue method for video:queue:clear command', () => {
  expect(videoController.clearQueue).toBeDefined();
  expect(typeof videoController.clearQueue).toBe('function');
});
```

### Fix Applied
Added `clearQueue()` method to VideoController.

**Verification:** Test passes ✅

---

## Bug #008: Missing transaction:delete Command
**Severity:** HIGH
**Discovered:** Phase 2.2 - Test 10
**Root Cause:** AsyncAPI contract defines transaction:delete (line 844) but implementation missing

### Impact
- **Contract Violation:** Admin panel cannot delete erroneous transactions
- **Functional Requirement:** Section 4.4.1 Transaction Management requires deletion
- **Use Case:** GM needs to delete transaction if wrong token scanned or manual correction needed

### Test That Found It
```javascript
it('should have deleteTransaction method for transaction:delete command', () => {
  expect(adminOps.deleteTransaction).toBeDefined();
  expect(typeof adminOps.deleteTransaction).toBe('function');
});
```

### Fix Applied
Added `deleteTransaction(transactionId, reason)` method to AdminOperations.

**Verification:** Test passes ✅

---

## Bug #009: Missing transaction:create Command
**Severity:** HIGH
**Discovered:** Phase 2.2 - Test 10
**Root Cause:** AsyncAPI contract defines transaction:create (line 857) but implementation missing

### Impact
- **Contract Violation:** Admin panel cannot manually create transactions
- **Functional Requirement:** Section 4.4.2 Transaction Management requires manual entry
- **Use Case:** GM needs to manually enter transaction if NFC scanner fails

### Test That Found It
```javascript
it('should have createTransaction method for transaction:create command', () => {
  expect(adminOps.createTransaction).toBeDefined();
  expect(typeof adminOps.createTransaction).toBe('function');
});
```

### Fix Applied
Added `createTransaction(transactionData)` method to AdminOperations.

**Verification:** Test passes ✅

---

## Bug #010: Missing teamId Validation in score:adjust
**Severity:** MEDIUM
**Discovered:** Phase 2.2 - Test 8
**Root Cause:** AsyncAPI contract requires teamId format validation but not implemented

### Impact
- **Contract Violation:** Can send invalid teamId to server
- **Data Integrity:** Could cause scoring errors if malformed teamId
- **User Experience:** No client-side validation feedback

### Test That Found It
```javascript
it('should validate teamId format', async () => {
  const invalidCases = [null, undefined, '', '   ', 123, {}];

  for (const invalid of invalidCases) {
    await expect(adminOps.adjustScore(invalid, 100, 'test'))
      .rejects.toThrow(/teamId/i);
  }
});
```

### Fix Applied
Added validation at start of `adjustScore()`:
```javascript
if (!teamId || typeof teamId !== 'string' || teamId.trim() === '') {
    throw new Error('Invalid teamId: must be non-empty string');
}
```

**Verification:** Test passes ✅

---

## Bug #011: Missing delta Validation in score:adjust
**Severity:** MEDIUM
**Discovered:** Phase 2.2 - Test 8
**Root Cause:** No type checking for delta parameter

### Impact
- **Contract Violation:** Can send non-numeric delta to server
- **Data Integrity:** Could cause NaN in score calculations
- **User Experience:** Confusing error messages from server

### Test That Found It
```javascript
it('should validate delta is a number', async () => {
  const invalidCases = ['abc', null, undefined, {}, []];

  for (const invalid of invalidCases) {
    await expect(adminOps.adjustScore('001', invalid, 'test'))
      .rejects.toThrow(/delta/i);
  }
});
```

### Fix Applied
Added validation:
```javascript
if (typeof delta !== 'number' || isNaN(delta)) {
    throw new Error('Invalid delta: must be a number');
}
```

**Verification:** Test passes ✅

---

## Bug #012: Missing reason Parameter Validation in score:adjust
**Severity:** MEDIUM
**Discovered:** Phase 2.2 - Test 8
**Root Cause:** AsyncAPI contract requires reason for audit trail but not validated

### Impact
- **Contract Violation:** Can omit required audit information
- **Compliance:** Poor audit trail for score adjustments
- **Debugging:** Harder to understand why scores were adjusted

### Test That Found It
```javascript
it('should require reason parameter', async () => {
  const invalidCases = [null, undefined, '', '   '];

  for (const invalid of invalidCases) {
    await expect(adminOps.adjustScore('001', 100, invalid))
      .rejects.toThrow(/reason/i);
  }
});
```

### Fix Applied
Added validation:
```javascript
if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('Invalid reason: must be non-empty string for audit trail');
}
```

**Verification:** Test passes ✅

---

## Phase 2.2 Continuation: Monitoring Display Architecture
**Date:** 2025-10-06 (Continued)
**Tests Added:** 41 new monitoring display tests
**Architecture Change:** Event-driven monitoring display implementation
**Status:** Implementation Complete, Integration Pending

### Discovery: Incomplete Monitoring Display Implementation

**User Question:** "does this test also make sure the admin panel is displaying the correct monitoring information?"

**Answer:** NO - Command construction tests verified commands sent correctly, but did NOT test monitoring display updates.

### New Architecture: AdminModule.MonitoringDisplay Class
- Event-driven monitoring updates (7 events wired)
- All 5 FR 4.1 monitoring types implemented:
  - FR 4.1.1: Session Display
  - FR 4.1.2: Video Display
  - FR 4.1.3: System Display
  - FR 4.1.4: Score Display
  - FR 4.1.5: Transaction Display
- 88 total tests (47 command + 41 monitoring)

### Contract Compliance Gaps Documented
**Gap #1: Video Queue Contents** - FR requires full queue, AsyncAPI only provides queueLength
**Gap #2: Session History** - FR requires 24h history, AsyncAPI only provides current session

These gaps noted for future backend enhancement. Current implementation uses available data.

### Integration into App.js
- Added MonitoringDisplay to App.viewController.initAdminModules()
- Replaced manual event listeners with MonitoringDisplay automatic registration
- Cleaned up App.updateAdminPanel() to delegate to MonitoringDisplay in networked mode
- Maintained fallback for standalone mode

### Success Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| FR 4.1 Monitoring Types Implemented | 2/5 (40%) | 5/5 (100%) | +60% |
| AdminModule Test Coverage | 47 tests | 88 tests | +87% |
| Event-Driven Display Updates | 0 events | 7 events | ∞ |
| Display Update Method | Manual calls | Automatic (events) | Real-time |
| Code Organization | Scattered (App.js) | Consolidated (AdminModule) | Clean architecture |

---

## Overall Phase 2.2 Summary

**Total Tests Created:** 88 tests (47 command + 41 monitoring)
**Total Bugs Fixed:** 8 bugs (5 HIGH, 3 MEDIUM) from command testing
**Total Architecture Improvements:** 1 major (event-driven monitoring display)
**Contract Gaps Identified:** 2 gaps (video queue, session history)
**Status:** Implementation complete, ready for Phase 2 integration

---

## Phase 2.2 Regression: Integration Test Failures
**Date:** 2025-10-06
**Discovered:** After MonitoringDisplay integration
**Initial Failures:** 20 tests (14 ReferenceErrors + 6 timeouts)
**Root Causes:** 3 distinct test setup issues
**Final Status:** ✅ All 115 integration tests passing

### Symptom Analysis

**Initial Failure Pattern:**
- app-initialization.test.js: 14 failures - `ReferenceError: SessionModeManager is not defined`
- Backend integration tests: 6 timeouts waiting for WebSocket events
  - transaction-flow.test.js: 3 failures
  - session-lifecycle.test.js: 1 failure
  - group-completion.test.js: 2 failures

**Key Observation:** First tests in each suite passed, later tests timed out → test isolation issue

### Systematic Investigation Process

**Hypothesis Testing:**
1. ❌ MonitoringDisplay crashes during connection → INVALIDATED (never instantiated in tests)
2. ❌ MonitoringDisplay breaks event flow → INVALIDATED (App.viewController undefined in tests)
3. ✅ Missing global assignments in test setup → VALIDATED
4. ✅ Accumulated client state between tests → VALIDATED

**Critical Insights:**
- MonitoringDisplay integration was NOT the cause (conditional guard prevented instantiation)
- Tests revealed pre-existing test setup fragility
- Scanner code worked correctly (app-transaction-flow.test.js: 6/6 passing)

### Root Cause #1: Missing Global References (14 failures)

**Issue:** App.init() expects `SessionModeManager` and `NFCHandler` as bare global references (no imports)

**Code Evidence:**
```javascript
// app.js line 19
InitializationSteps.createSessionModeManager(SessionModeManager, window);
// app.js line 31
this.nfcSupported = await InitializationSteps.detectNFCSupport(NFCHandler);
```

**Test Setup Issue:**
```javascript
// app-initialization.test.js loaded modules into local variables
SessionModeManager = require('...');  // Local, not global
```

**Fix Applied:**
```javascript
// Make modules available globally (App expects them)
global.Settings = Settings;
global.SessionModeManager = SessionModeManager;
global.NFCHandler = NFCHandler;
```

**Result:** 14 → 6 failures ✅

---

### Root Cause #2: Client-Side Duplicate Tracking Not Cleared (4 failures)

**Issue:** DataManager.scannedTokens Set persists across tests, causing client-side duplicate detection to block subsequent tests

**Flow:**
1. Test 1: Scan token '534e2b03' → marks in DataManager.scannedTokens → succeeds
2. Test 2: Scan token '534e2b03' → client-side check fails (already scanned) → never reaches server → timeout

**Code Evidence:**
```javascript
// app.js line 539-542
if (DataManager.isTokenScanned(tokenId)) {
    Debug.log(`Duplicate token detected: ${tokenId}`, true);
    this.showDuplicateError(tokenId);
    return;  // Never reaches server
}
```

**Fix Applied:**
```javascript
afterEach(async () => {
    if (gmScanner?.socket?.connected) gmScanner.socket.disconnect();
    // CRITICAL: Clear DataManager scanned tokens to prevent duplicate detection across tests
    global.DataManager.clearScannedTokens();
    await sessionService.reset();
});
```

**Result:** 6 → 2 failures ✅

---

### Root Cause #3: clearScannedTokens() Side Effect (1 failure)

**Issue:** Duplicate detection test calls `clearScannedTokens()` mid-test to bypass client-side check and test server-side duplicate detection. But `clearScannedTokens()` was clearing BOTH `scannedTokens` AND `transactions` array.

**Original Implementation:**
```javascript
clearScannedTokens() {
  this.scannedTokens.clear();
  this.transactions = [];  // Unintended side effect during test
}
```

**Test Intent:**
```javascript
// First scan - accepted
gmScanner.App.processNFCRead({id: '534e2b03'});
await waitForEvent(..., 'transaction:result');

// Clear CLIENT duplicate tracking to test SERVER duplicate detection
global.DataManager.clearScannedTokens();  // Should only clear scannedTokens Set

// Second scan - should reach server and be rejected as duplicate
gmScanner.App.processNFCRead({id: '534e2b03'});
```

**Fix Applied:**
```javascript
// Separate concerns
clearScannedTokens() {
  this.scannedTokens.clear();  // Only clear duplicate detection Set
},

clearAll() {
  this.scannedTokens.clear();
  this.transactions = [];      // Clear everything for test cleanup
  this.backendScores.clear();
}
```

**Result:** 2 → 0 failures ✅

---

### Root Cause #4: Token Database Loading in Node.js

**Issue:** TokenManager.loadDatabase() uses `fetch()` to load tokens, which doesn't work with file paths in Node.js tests

**Code Evidence:**
```javascript
// tokenManager.js line 18
let response = await fetch('data/tokens.json');  // Fails in Node.js
```

**Fix Applied:**
```javascript
// browser-mocks.js InitializationSteps.loadTokenDatabase
loadTokenDatabase: async (tokenManager, uiManager) => {
  // In Node.js tests, database is pre-populated - skip fetch if already loaded
  if (tokenManager.database && Object.keys(tokenManager.database).length > 0) {
    global.Debug.log(`Token database already loaded`);
    if (!tokenManager.groupInventory) {
      tokenManager.groupInventory = tokenManager.buildGroupInventory();
    }
    return true;
  }
  // Otherwise attempt fetch (browser context)
  const dbLoaded = await tokenManager.loadDatabase();
  // ...
}
```

**Result:** app-initialization tests all passing ✅

---

### Lessons Learned

1. **Systematic /think methodology effective**: Breaking down assumptions and methodically testing hypotheses prevented wild goose chases

2. **Test isolation critical**: Small state leaks (DataManager.scannedTokens) caused cascading failures that appeared unrelated

3. **Single responsibility for test helpers**: clearScannedTokens() should only clear scannedTokens, not have side effects

4. **Client-side vs server-side duplicate detection**: Scanner has client-side duplicate prevention, but tests need to bypass it to validate server-side logic

5. **Global references in legacy code**: Scanner modules use bare global references (not imports), tests must accommodate this

6. **MonitoringDisplay refactor was NOT the cause**: Despite appearing immediately after refactor, actual causes were pre-existing test setup fragility

### Final Verification

**Full Test Suite Results:**
```
Test Suites: 52 passed, 52 total (23 unit + 13 contract + 16 integration)
Tests:       697 passed, 697 total (526 unit + 56 contract + 115 integration)
Snapshots:   0 total
Time:        ~45s
```

**All Fixes Applied:**
1. ✅ Added global.SessionModeManager, global.NFCHandler to app-initialization.test.js
2. ✅ Added global.DataManager.clearScannedTokens() to afterEach in 3 test files
3. ✅ Separated clearScannedTokens() from clearAll() in browser-mocks.js
4. ✅ Made InitializationSteps.loadTokenDatabase() skip fetch when database pre-populated
5. ✅ Added clearScannedTokens() mid-test in duplicate detection test to bypass client-side check

**Impact:**
- No production code changes needed (issue was test setup only)
- Improved test isolation and robustness
- Better understanding of scanner duplicate detection architecture
- Cleaner separation of test helper concerns
