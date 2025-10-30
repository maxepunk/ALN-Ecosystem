# Admin Interventions Test Failures - Implementation Bugs

**Date:** 2025-10-30
**Task:** Task 2.3 from test failure resolution plan
**Status:** 7 fixture-related tests FIXED, 3 implementation bugs discovered

## Summary

After updating all 8 point value assertions to match test fixtures:
- **18 tests PASS** (up from 11 before fixture updates)
- **3 tests FAIL** due to implementation bugs (NOT fixture mismatches)

All fixture-related test failures have been resolved. The remaining 3 failures are implementation bugs in the admin intervention system.

## Bug 1: Score Adjustment Event Listener Race Condition

**Test:** `should adjust team score via admin command and broadcast to all GMs` (line 83)

**Symptom:**
```
thrown: "Exceeded timeout of 30000 ms for a test.
```

**Root Cause:** Event listener timing issue with score:updated event

**Location:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/tests/integration/admin-interventions.test.js:83`

**Test Code Context:**
```javascript
it('should adjust team score via admin command and broadcast to all GMs', async () => {
  // Setup: Create initial score by processing a transaction
  await transactionService.processScan({
    tokenId: 'rat001',
    teamId: '001',
    deviceId: 'SETUP',
    mode: 'blackmarket'
  }, sessionService.getCurrentSession());

  // Verify initial score
  let teamScores = transactionService.getTeamScores();
  let teamScore = teamScores.find(s => s.teamId === '001');
  expect(teamScore.currentScore).toBe(40); // rat001 = 40

  // CRITICAL: Set up listeners BEFORE command to avoid race condition
  const ackPromise = waitForEvent(gmAdmin.socket, 'gm:command:ack');

  // CRITICAL: Wait for score:updated event with ADJUSTED score (not setup transaction score)
  const scorePromise = new Promise((resolve) => {
    gmObserver.socket.on('score:updated', (event) => {
      if (event.data.currentScore === -460) { // 40 - 500 = -460
        resolve(event);
      }
    });
  });

  // Admin adjusts score
  gmAdmin.socket.emit('gm:command', {
    event: 'gm:command',
    data: {
      action: 'score:adjust',
      payload: {
        teamId: '001',
        delta: -500,
        reason: 'Rule violation penalty'
      }
    },
    timestamp: new Date().toISOString()
  });

  // Test hangs here - score:updated event never arrives with -460 value
  const [ack, scoreEvent] = await Promise.all([ackPromise, scorePromise]);
```

**Analysis:**
- Test sets up listener for `score:updated` event with `currentScore === -460`
- Event listener is conditional (only resolves if score matches -460)
- Test times out waiting for the specific event
- Possible causes:
  1. Event is emitted but with different score value
  2. Event is not being emitted at all
  3. Event is emitted to wrong socket room
  4. Race condition with initial score event (40) vs adjusted score event (-460)

**Impact:** 1 test failure (first test in Score Adjustment suite)

**Debugging Needed:**
- Check backend logs for score:updated emission with -460 value
- Verify gmObserver socket is in correct room to receive broadcasts
- Check if event is emitted but with different data structure
- Verify transactionService emits events correctly for score adjustments

---

## Bug 2: Missing DataManager.saveScannedTokens Function

**Test:** `should delete transaction via admin command` (line 647)

**Symptom:**
```
TypeError: window.DataManager.saveScannedTokens is not a function

  303 |                         if (payload.tokenId) {
  304 |                             window.DataManager.scannedTokens.delete(payload.tokenId);
> 305 |                             window.DataManager.saveScannedTokens();
      |                                                ^
  306 |                             console.log('Removed from scannedTokens:', payload.tokenId);
  307 |                         }
  308 |
```

**Root Cause:** DataManager mock is missing `saveScannedTokens()` method

**Location:** Test expects DataManager to have `saveScannedTokens()` but mock doesn't provide it

**Analysis:**
- Test tries to call `window.DataManager.saveScannedTokens()` after deleting a token
- Mock DataManager object doesn't have this method defined
- This is a test infrastructure issue, not a backend issue
- Need to add `saveScannedTokens: jest.fn()` to DataManager mock

**Impact:** 1 test failure (Transaction Intervention suite)

**Fix Required:**
Add to DataManager mock in test setup:
```javascript
window.DataManager = {
  scannedTokens: new Set(),
  saveScannedTokens: jest.fn(), // ADD THIS
  // ... other methods
};
```

**Note:** This is a JSDOM mock issue in the test environment, not a production bug.

---

## Bug 3: Multi-Client Broadcast Event Listener Timeout

**Test:** `should send ack to sender only, broadcasts to all GMs` (line 776)

**Symptom:**
```
thrown: "Exceeded timeout of 30000 ms for a test.
```

**Root Cause:** Similar event listener timing issue as Bug 1

**Location:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/tests/integration/admin-interventions.test.js:776`

**Test Code Context:**
```javascript
it('should send ack to sender only, broadcasts to all GMs', async () => {
  // Create initial score
  await transactionService.processScan({
    tokenId: 'rat001',
    teamId: '001',
    deviceId: 'SETUP',
    mode: 'blackmarket'
  }, sessionService.getCurrentSession());

  // Test hangs waiting for events
  // Similar pattern to Bug 1 - conditional event listener
```

**Analysis:**
- Test validates broadcast behavior (ack to sender only, broadcasts to all)
- Similar conditional event listening pattern as Bug 1
- Likely same root cause - event not matching expected conditions

**Impact:** 1 test failure (Multi-Client Broadcast Verification suite)

**Debugging Needed:**
- Same investigation as Bug 1
- Check if broadcast room membership is correct
- Verify event data structure matches expectations

---

## Test Results Summary

### Before Fixture Updates:
- Tests with fixture mismatches: 7+ failing tests
- Production values (15000, 5000, etc.) expected but fixtures had (40, 30, etc.)

### After Fixture Updates (Task 2.3 Complete):
- **Fixed:** 7 tests now PASS (fixture expectations aligned)
- **Remaining:** 3 tests FAIL due to implementation bugs

### Assertions Updated:
1. Line 95: `toBe(15000)` → `toBe(40)` (rat001 base)
2. Line 137: `toBe(14500)` → `toBe(-460)` (40 - 500 penalty) **SPECIAL CASE: Negative score**
3. Line 149: `toBe(14500)` → `toBe(-460)` (40 - 500 penalty)
4. Line 167: `toBe(3000)` → `toBe(2030)` (30 + 2000 bonus - conditional check)
5. Line 190: `toBe(3000)` → `toBe(2030)` (30 + 2000 bonus)
6. Line 194: `toBe(3000)` → `toBe(2030)` (30 + 2000 bonus)
7. Line 351: `toBe(15000)` → `toBe(40)` (rat001)
8. Line 365: `toBe(15000)` → `toBe(40)` (rat001)

**Total:** 8 assertions updated

### Special Handling:
- **Negative Score Test:** Lines 137, 149 expect -460 (40 - 500 penalty)
  - Test validates system correctly handles negative scores
  - This is an intentional test case, not a bug

---

## Recommendations

### Immediate Actions:
1. **Bug 2 (saveScannedTokens):** Add mock function to test setup (quick fix)
2. **Bugs 1 & 3 (Event Timeouts):** Investigate event emission and room membership

### Investigation Priority:
1. High: Bug 2 (simple mock fix)
2. High: Bug 1 (blocks score adjustment testing)
3. Medium: Bug 3 (multi-client broadcast validation)

### Next Steps:
1. Fix DataManager mock (Bug 2)
2. Add debug logging to score:updated event emission
3. Verify socket room membership for gmObserver
4. Re-run tests with enhanced logging

---

**Document Status:** Complete
**Created By:** Task 2.3 implementation (Systematic debugging process)
**Fixture Updates:** Complete (8 assertions)
**Implementation Bugs:** 3 discovered and documented
