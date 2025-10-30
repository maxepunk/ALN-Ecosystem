# Bug Report: Session Resume Test Failing - Transaction Returns 0 Points Instead of 30

**Date:** 2025-10-30
**Discovered During:** Task 2.7 - Test fixture value alignment
**Test File:** `tests/integration/session-lifecycle.test.js`
**Test:** "should resume session and allow transactions" (line 216)

## Summary
After updating test expectations to use fixture values (534e2b03: 30 points), the "session resume" test is failing because the transaction returns 0 points instead of the expected 30 points.

## Test Behavior
```javascript
// Test flow:
1. Create session with team '001'
2. Pause session
3. Create scanner (GM_RESUME_TEST)
4. Resume session via gm:command
5. Scan token 534e2b03
6. Expected: 30 points (fixture value)
7. Actual: 0 points
```

## Failure Details
```
expect(received).toBe(expected) // Object.is equality

Expected: 30
Received: 0

  258 |       const result = await resultPromise;
  259 |       expect(result.data.status).toBe('accepted'); // Transaction succeeds after resume
> 260 |       expect(result.data.points).toBe(30);
      |                                  ^
```

## Key Observations

### 1. Transaction Status is 'accepted' (not 'error' or 'duplicate')
The transaction is being processed successfully - not rejected due to:
- Paused session (we just resumed)
- Duplicate detection (would show status 'duplicate')
- Missing token (would show status 'error')

### 2. Separate Test Instances
This is a SEPARATE test from "should block transactions when session is paused":
- Different scanner instance (GM_RESUME_TEST vs GM_PAUSE_BLOCK_TEST)
- Different session (created fresh in this test)
- afterEach() cleanup runs between tests (clears DataManager.clearScannedTokens())

### 3. Other Tests Using Same Token Pass
Other tests in the same file that scan 534e2b03 PASS after fixture update:
- Line 407: "should handle positive delta (bonus points)" - PASSES
- Line 343: "should adjust team score by delta" - PASSES

This suggests the token fixture data (30 points) is loaded correctly in most contexts.

## Possible Root Causes

### Theory 1: Session State Contamination
The scanner connects AFTER the session is paused, then receives resume event.
There might be a race condition where:
- Scanner syncs with paused session state
- Resume command changes session state to active
- Scanner's cached state doesn't update correctly
- Transaction processed with stale paused state → 0 points

**Evidence:** Test creates scanner (line 224) BEFORE resuming (line 231)

### Theory 2: Token Loading Issue After Resume
The transactionService might not be loading token data correctly after session resume:
- Session pause/resume might clear or corrupt token mappings
- Token 534e2b03 lookup fails → defaults to 0 points
- But status still 'accepted' because transaction structure is valid

**Contradiction:** Other tests using same token pass

### Theory 3: Duplicate Detection in Transaction History
The session resume might be loading transaction history from a PREVIOUS test run:
- Previous test scanned 534e2b03 (blocked during pause)
- Transaction added to session history (even though blocked?)
- Resume loads history
- New scan detected as duplicate → 0 points but 'accepted' status

**Evidence:** Line 195-199 in previous test scans same token (but in different session)

### Theory 4: Test Fixture vs Production Token Mismatch
The test might be using production tokens.json instead of fixtures:
- Line 60: Loads rawTokens from `../../../ALN-TokenData/tokens.json` (PRODUCTION)
- Line 62: `global.TokenManager.database = rawTokens;` (scanner gets production)
- Line 56-57: transactionService initialized with TestTokens.getAllAsArray() (fixtures)
- Scanner has production token (5000 points)
- Backend has fixture token (30 points)
- Mismatch causes scoring error → 0 points

**This is likely the issue!** Scanner and backend using different token databases.

## Recommended Investigation Steps

1. **Add debug logging to test:**
   ```javascript
   // After line 256 (before scan):
   console.log('Scanner token database:', Object.keys(global.TokenManager.database).length);
   console.log('Token 534e2b03 in scanner:', global.TokenManager.database['534e2b03']);
   console.log('Backend token service has:', transactionService.tokens.size);
   ```

2. **Check transaction result details:**
   ```javascript
   // After line 258 (after scan):
   console.log('Full transaction result:', JSON.stringify(result.data, null, 2));
   ```

3. **Verify token alignment:**
   - Check if scanner TokenManager should use test fixtures, not production tokens
   - Verify backend transactionService actually loads fixture values
   - Compare token values in both systems before scan

## Workaround Options

### Option A: Use Different Token
Change test to use a token that hasn't been scanned in previous tests:
```javascript
scanner.App.processNFCRead({ id: 'tac001' }); // Use tac001 (10 points)
expect(result.data.points).toBe(10);
```

### Option B: Force Token Reload
Add explicit token reload before scan:
```javascript
const testTokens = TestTokens.getAllAsArray();
await transactionService.init(testTokens);
global.TokenManager.database = TestTokens.getAllAsObject(); // Need to add this method
```

### Option C: Accept 0 and Document
If this is expected behavior for resumed sessions:
```javascript
expect(result.data.points).toBe(0); // BUG: Resume doesn't restore scoring
// TODO: Fix scoring after session resume
```

## Next Steps
1. Run debug logging to confirm Theory 4 (token database mismatch)
2. If confirmed, update test setup to align scanner and backend token sources
3. If not Theory 4, investigate transaction processing logic during resume
4. Add regression test for scoring after session resume

## Related Files
- `tests/integration/session-lifecycle.test.js` - Test file
- `src/services/transactionService.js` - Scoring logic
- `tests/fixtures/test-tokens.json` - Fixture token values
- `ALN-TokenData/tokens.json` - Production token values
- `ALNScanner/js/data/tokenManager.js` - Scanner token database (in submodule)
