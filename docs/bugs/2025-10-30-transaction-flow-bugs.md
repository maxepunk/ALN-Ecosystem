# Transaction Flow Test Failures - Implementation Bugs

**Date:** 2025-10-30
**Test File:** `backend/tests/integration/transaction-flow.test.js`
**Related Task:** Task 2.5 from `docs/plans/2025-10-30-fix-test-failures-comprehensive.md`

## Status

**Test fixture value alignment:** COMPLETE ✅
**Tests passing:** ❌ NO - 3 failures out of 10 tests
**Root cause:** Mode propagation bug (same as group-completion bug)

---

## Bug 1: Scanner Mode Defaulting to Detective Instead of Blackmarket

**Severity:** BLOCKER
**Test:** `tests/integration/scanner/app-transaction-flow.test.js:74`
**Impact:** 1 test failure

### Symptom

```
Expected mode: "blackmarket"
Received mode: "detective"
```

### Evidence

```javascript
// Test expectation (line 74-78):
expect(submittedTransaction).toMatchObject({
  tokenId: '534e2b03',
  teamId: '001',
  deviceId: 'GM_APP_TEST',
  mode: 'blackmarket',  // Expected
});

// Actual transaction:
{
  deviceId: "GM_APP_TEST",
  mode: "detective",  // Received (WRONG)
  teamId: "001",
  tokenId: "534e2b03"
}
```

### Root Cause Analysis

**Same bug as group-completion.test.js** (documented in `docs/bugs/2025-10-30-group-completion-bugs.md`):

1. Scanner initialized in test with mode setting
2. Mode not propagating to transaction payload
3. Backend receives detective mode (default) instead of blackmarket

### Investigation Required

**Related to October 2025 mode standardization** (see `CLAUDE.md` lines regarding stationMode → mode):

1. Check `backend/tests/helpers/browser-mocks.js`:
   - Verify `Scanner.Settings.mode` initialized in DOM mock
   - Check if App.js reads mode from correct localStorage key

2. Check `ALNScanner/js/app.js`:
   - Line where transaction payload is created
   - Verify mode field included in transaction object
   - Check if Settings.mode is accessible

3. Check `backend/src/routes/scanRoutes.js`:
   - Verify mode field extracted from request body
   - Check default value applied when mode missing

### Files to Investigate

- `backend/tests/helpers/browser-mocks.js` (Scanner.Settings mock)
- `ALNScanner/js/app.js` (transaction payload creation)
- `ALNScanner/js/services/settings.js` (mode storage)
- `backend/src/routes/scanRoutes.js` (mode extraction)

---

## Bug 2: Timeout Waiting for score:updated Event

**Severity:** HIGH
**Test:** `tests/integration/transaction-flow.test.js` (multiple tests)
**Impact:** 2 test failures

### Symptom

```
Error: Timeout waiting for event: score:updated
at websocket-helpers.js:41
```

### Evidence

Tests timeout after 5 seconds waiting for `score:updated` WebSocket event that never arrives.

### Possible Root Causes

1. **Mode propagation bug (primary suspect)**:
   - If scanner in detective mode, transactions score 0 points
   - No score change → no `score:updated` event emitted
   - Test times out waiting for event

2. **Event listener registration timing**:
   - Listener registered after event already emitted
   - Race condition between transaction processing and listener setup

3. **WebSocket room membership**:
   - Socket not joined to 'gm-stations' room before event broadcast
   - Event sent to room socket hasn't joined yet

### Investigation Required

1. Check if tests set up event listeners BEFORE triggering transactions
2. Verify socket joins 'gm-stations' room before scanning
3. Confirm transaction actually processes (check backend logs for "transaction accepted")
4. Check if `transactionService` emits events when score changes

### Related Tests

All tests that wait for `score:updated` event:
- Transaction flow tests (basic scoring)
- Duplicate detection tests

---

## Bug 3: Duplicate Detection Receiving 0 Points

**Severity:** HIGH
**Test:** `tests/integration/transaction-flow.test.js:283`
**Impact:** 1 test failure (likely caused by Bug 1)

### Symptom

```
Expected: 30 (fixture value for 534e2b03)
Received: 0 (no points awarded)
```

### Evidence

```javascript
// Line 283:
expect(teamScore.currentScore).toBe(30);
// Actual: 0
```

### Root Cause

**Cascading failure from Bug 1**:
1. First scan fails to score points (mode bug)
2. Team score remains at 0
3. Test expects 30 but receives 0

This is NOT a duplicate detection bug - it's the initial scan failing to score.

### Verification

After fixing Bug 1 (mode propagation), re-run this test to confirm it passes.

---

## Summary

| Bug | Type | Severity | Tests Affected | Root Cause |
|-----|------|----------|----------------|------------|
| Mode defaulting to detective | Mode propagation | BLOCKER | 1 | October 2025 mode standardization incomplete |
| score:updated timeout | Event emission | HIGH | 2 | Likely caused by Bug 1 (detective mode = 0 points) |
| Duplicate detection 0 points | Cascading failure | HIGH | 1 | Caused by Bug 1 |

**Primary Bug:** Mode propagation (same as group-completion bug)
**Secondary Bugs:** Cascading failures from primary bug

---

## Next Steps

1. **Fix mode propagation bug** (affects multiple test files):
   - See `docs/bugs/2025-10-30-group-completion-bugs.md` for detailed investigation plan
   - Single fix should resolve issues in both test files

2. **Re-run transaction-flow tests** after mode fix:
   ```bash
   npm run test:integration -- transaction-flow
   ```

3. **If timeouts persist after mode fix**:
   - Investigate WebSocket room join timing (Task 2.8 addresses this)
   - Check event listener registration order

4. **Update this document** with resolution details once bugs fixed

---

## References

- **Related Bug:** `docs/bugs/2025-10-30-group-completion-bugs.md` (same mode propagation issue)
- **Mode Standardization:** `CLAUDE.md` (October 2025 changes)
- **WebSocket Timing Fix:** Task 2.8 in comprehensive plan (lines 938-1010)
- **Contracts:**
  - `backend/contracts/openapi.yaml` (scan endpoint, mode field)
  - `backend/contracts/asyncapi.yaml` (score:updated event)
