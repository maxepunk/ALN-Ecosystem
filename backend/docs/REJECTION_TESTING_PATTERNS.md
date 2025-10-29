# Testing Anti-Patterns & Rejection Testing Best Practices
## Investigation Report for Tests 5-6: Duplicate Rejection in GM Scanner Networked Mode

**Investigation Date**: 2025-10-29  
**Scope**: E2E test patterns from existing test suite and integration tests  
**Thoroughness Level**: Medium - Error/rejection testing focus

---

## EXECUTIVE SUMMARY

Based on analysis of existing E2E tests (00-smoke, 01-lifecycle, 07b-networked, etc.) and integration tests (duplicate-detection), here are the critical patterns to follow when writing Tests 5-6 for duplicate rejection:

### Key Finding: Tests 5-6 ARE REJECTION TESTS - Different from Acceptance Tests

Tests 1-4 (passing) test **happy path scenarios**. Tests 5-6 test **rejection scenarios** (duplicate detection). This requires different assertion patterns and validation strategies.

---

## PART 1: ANTI-PATTERNS TO AVOID (What NOT to Do)

### Anti-Pattern #1: Testing Test Logic Instead of Production Logic

**The Problem:**
```javascript
// ❌ BAD: Test recalculates score to verify it didn't change
test('rejects duplicate and score unchanged', async () => {
  const socket1 = await connectWithAuth(...);
  
  // Scan 1: success
  await scanToken(socket1, 'sof002');
  const score1 = await page.evaluate(() => {
    // TEST IS RECALCULATING SCORE! Not reading production's calculation
    const tokens = ['sof002'];
    return tokens.reduce((sum, tid) => sum + tokenValues[tid], 0);
  });
  
  // Scan 2: duplicate
  await scanToken(socket1, 'sof002');
  const score2 = await page.evaluate(() => {
    // SAME PROBLEM - test logic, not production
    return score1; // This is the test's value, not production's
  });
  
  expect(score2).toBe(score1); // ❌ Only proves test logic is consistent!
});
```

**Why It's Wrong:**
- Tests `Math.add()` twice instead of testing that **production didn't add twice**
- If production has a bug (counts duplicates twice), test won't catch it
- Test passes even if production is broken

**The Fix:**
```javascript
// ✅ GOOD: Read ONLY production's calculated value
test('rejects duplicate and score unchanged', async () => {
  const socket1 = await connectWithAuth(...);
  
  // Scan 1: success
  const result1Promise = waitForEvent(socket1, 'transaction:result');
  await scanToken(socket1, 'sof002');
  const result1 = await result1Promise;
  
  // Record production's score (don't calculate it)
  const scoreAfterFirst = await getTeamScore(page, '001', 'networked');
  expect(scoreAfterFirst).toBe(500); // Production calculated this
  
  // Scan 2: duplicate
  const result2Promise = waitForEvent(socket1, 'transaction:result');
  await scanToken(socket1, 'sof002');
  const result2 = await result2Promise;
  
  // Verify rejection
  expect(result2.data.status).toBe('duplicate');
  expect(result2.data.points).toBe(0);
  
  // Read ONLY production's new score (don't calculate)
  const scoreAfterSecond = await getTeamScore(page, '001', 'networked');
  expect(scoreAfterSecond).toBe(scoreAfterFirst); // Should be unchanged
});
```

**Reference from Code**: 
- `backend/tests/e2e/helpers/scanner-init.js:64-97` - `getTeamScore()` function has explicit comment:
  > "ONLY read production's calculated score from localStorage. StandaloneDataManager should have calculated and saved this. If this is 0/undefined, test SHOULD FAIL (indicates production bug)"

**Iron Law #3 Violation**: Tests that calculate instead of verify are testing their own logic, not production.

---

### Anti-Pattern #2: Arbitrary Timeouts Without Event Waits

**The Problem:**
```javascript
// ❌ BAD: Guessing how long duplicate detection takes
test('rejects duplicate', async () => {
  await scanToken(socket, 'sof002'); // First scan
  await page.waitForTimeout(2000);    // ❌ Arbitrary 2 second timeout
  
  await scanToken(socket, 'sof002'); // Second scan
  await page.waitForTimeout(2000);    // ❌ Again guessing
  
  const error = await scanner.getErrorMessage();
  expect(error).toContain('duplicate');
});
```

**Why It's Wrong:**
- Tests are timing-dependent, not event-dependent
- May flake on slow systems (takes >2s) or waste time on fast systems
- Doesn't prove the right event was received

**The Fix:**
```javascript
// ✅ GOOD: Wait for actual events
test('rejects duplicate', async () => {
  const result1Promise = waitForEvent(socket, 'transaction:result');
  
  // Scan 1
  await scanToken(socket, 'sof002');
  const result1 = await result1Promise;
  expect(result1.data.status).toBe('accepted');
  
  // Scan 2 - wait for ACTUAL rejection event
  const result2Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result2 = await result2Promise;
  
  expect(result2.data.status).toBe('duplicate'); // Event-driven, not time-driven
});
```

**Reference from Code**:
- `backend/tests/e2e/setup/websocket-client.js:222-241` - `waitForEvent()` with predicate support
- `backend/tests/e2e/helpers/wait-conditions.js` - All wait functions use events, NO arbitrary timeouts
- Line 5: "Event-driven wait conditions for E2E tests. Follows testing-anti-patterns skill: NO arbitrary timeouts, use actual state changes."

---

### Anti-Pattern #3: Not Verifying the RIGHT Rejection

**The Problem:**
```javascript
// ❌ BAD: Just checks that SOME error occurred, not WHY
test('rejects duplicate', async () => {
  await scanToken(socket, 'sof002');
  await scanToken(socket, 'sof002');
  
  const result = await waitForEvent(socket, 'transaction:result');
  
  // Very weak assertion - could be ANY failure
  expect(result.data.status).not.toBe('accepted');
  
  // OR even worse: checking for absence of success
  expect(result.data.points).not.toBe(500);
});
```

**Why It's Wrong:**
- Test passes if production crashes (not 'accepted')
- Test passes if token not found (not 'accepted')
- Test passes if duplicate detection failed differently
- Can't distinguish between "duplicate correctly rejected" vs "duplicate not handled at all"

**The Fix:**
```javascript
// ✅ GOOD: Verify SPECIFIC rejection reason
test('rejects duplicate by same team', async () => {
  const result1Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result1 = await result1Promise;
  
  const result2Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result2 = await result2Promise;
  
  // All three assertions together verify the RIGHT rejection
  expect(result2.data.status).toBe('duplicate');           // Specific status
  expect(result2.data.message).toContain('already claimed'); // Specific message
  expect(result2.data.claimedBy).toBe('001');             // Shows original team
});
```

**Reference from Code**:
- `backend/tests/integration/duplicate-detection.test.js:123-126` - Examples of proper rejection verification
- `backend/src/services/transactionService.js:170-185` - `isDuplicate()` implementation shows what is checked

---

### Anti-Pattern #4: Mocking Production Behavior

**The Problem:**
```javascript
// ❌ BAD: Mocking transactionService to "force" duplicate detection
test('rejects duplicate', async () => {
  const socket = await connectWithAuth(...);
  
  // Mocking production code
  jest.spyOn(transactionService, 'isDuplicate').mockReturnValue(true);
  
  await scanToken(socket, 'sof002');
  // Mock makes it "duplicate" regardless of actual logic
  
  expect(transactionService.isDuplicate).toHaveBeenCalled();
});
```

**Why It's Wrong:**
- Test doesn't verify REAL duplicate detection logic
- Mocked version might not match production
- If production's `isDuplicate()` breaks, test still passes
- Violates Iron Law #3: "NEVER mock without understanding dependencies"

**The Fix:**
```javascript
// ✅ GOOD: Don't mock - test REAL duplicate detection
test('rejects duplicate by same team', async () => {
  const socket = await connectWithAuth(...);
  
  // Real first scan
  const result1Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result1 = await result1Promise;
  expect(result1.data.status).toBe('accepted'); // Actually succeeded
  
  // Real second scan - REAL duplicate detection happens
  const result2Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result2 = await result2Promise;
  
  // These assertions verify REAL production behavior
  expect(result2.data.status).toBe('duplicate');
  expect(result2.data.originalTransactionId).toBe(result1.data.transactionId);
});
```

---

### Anti-Pattern #5: Not Checking Complete State After Rejection

**The Problem:**
```javascript
// ❌ BAD: Only checks the rejection event, ignores state
test('rejects duplicate', async () => {
  await scanToken(socket, 'sof002');
  
  const result2Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result2 = await result2Promise;
  
  expect(result2.data.status).toBe('duplicate');
  // DONE - but what about the session state?
});
```

**Why It's Wrong:**
- Event rejection ≠ proper state management
- Production might:
  - Accept rejection event but still count points (state bug)
  - Reject but add token to "scanned" list (state bug)
  - Reject but lock the team (state bug)
- Incomplete verification of production behavior

**The Fix:**
```javascript
// ✅ GOOD: Verify BOTH event AND resulting state
test('rejects duplicate and maintains correct state', async () => {
  // Setup: listen for broadcasts
  let transactionBroadcast = null;
  socket.on('transaction:new', (data) => {
    transactionBroadcast = data;
  });
  
  // Scan 1: success
  const result1Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result1 = await result1Promise;
  
  expect(result1.data.status).toBe('accepted');
  expect(result1.data.points).toBe(500);
  
  // Scan 2: duplicate
  const result2Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result2 = await result2Promise;
  
  // 1. Event rejection verified
  expect(result2.data.status).toBe('duplicate');
  expect(result2.data.points).toBe(0);
  
  // 2. Score state NOT changed (read production's calculation)
  const currentScore = await getTeamScore(page, '001', 'networked');
  expect(currentScore).toBe(500); // Same as before
  
  // 3. Transaction NOT broadcast to other clients (shouldn't see transaction:new)
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(transactionBroadcast?.transaction?.tokenId).not.toBe('sof002');
  
  // 4. Scanner still functional (can scan other tokens)
  const result3Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'rat002');
  const result3 = await result3Promise;
  expect(result3.data.status).toBe('accepted');
});
```

---

## PART 2: CORRECT PATTERNS FOR REJECTION TESTING

### Pattern #1: Three-Part Rejection Verification

**Structure:**
1. **Pre-condition**: Establish state before rejection
2. **Trigger**: Cause the rejection
3. **Verify**: Check rejection AND resulting state

**Example Template:**
```javascript
test('rejects duplicate by same team', async () => {
  // ===== PART 1: PRE-CONDITION =====
  // Establish baseline - team '001' scans 'sof002' successfully
  const result1Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result1 = await result1Promise;
  
  expect(result1.data.status).toBe('accepted');
  expect(result1.data.tokenId).toBe('sof002');
  expect(result1.data.teamId).toBe('001');
  
  const scoreAfterFirst = await getTeamScore(page, '001', 'networked');
  expect(scoreAfterFirst).toBe(500); // Baseline score
  
  // ===== PART 2: TRIGGER =====
  // Same team tries to scan same token again
  const result2Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result2 = await result2Promise;
  
  // ===== PART 3: VERIFY =====
  // 3A. Rejection event properties
  expect(result2.data.status).toBe('duplicate');
  expect(result2.data.tokenId).toBe('sof002');
  expect(result2.data.teamId).toBe('001');
  expect(result2.data.points).toBe(0);
  expect(result2.data.message).toContain('already claimed');
  
  // 3B. Original transaction reference
  expect(result2.data.originalTransactionId).toBe(result1.data.transactionId);
  expect(result2.data.claimedBy).toBe('001');
  
  // 3C. State unchanged
  const scoreAfterSecond = await getTeamScore(page, '001', 'networked');
  expect(scoreAfterSecond).toBe(scoreAfterFirst);
  
  // 3D. Scanner still operational
  const result3Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'rat002'); // Different token
  const result3 = await result3Promise;
  expect(result3.data.status).toBe('accepted'); // Can scan other tokens
});
```

**Reference from Code**:
- `backend/tests/integration/duplicate-detection.test.js:80-136` - Same three-part pattern
- `backend/tests/integration/duplicate-detection.test.js:174-220` - Cross-team variant

---

### Pattern #2: Predicate-Based Event Waiting

**Problem**: Listening for one event type might receive multiple events. Need to wait for SPECIFIC event.

**Solution**: Use predicates to filter for the exact event you need.

```javascript
// ✅ GOOD: Wait for specific rejection with predicate
const result2Promise = waitForEvent(
  socket,
  'transaction:result',
  (data) => data.tokenId === 'sof002' && data.status === 'duplicate',
  5000 // timeout
);

await scanToken(socket, 'sof002');
const result2 = await result2Promise;
```

**Why Predicates Matter for Rejection Tests**:
- Without predicate: First event wins (might be any transaction)
- With predicate: Get the EXACT rejection event you're testing
- Especially important with multiple teams/devices

**Reference from Code**:
- `backend/tests/e2e/setup/websocket-client.js:222-241` - `waitForEvent()` predicate parameter
- Example: Lines 215-219 shows waiting for specific team score update

---

### Pattern #3: Rejection vs. Broadcast - Understanding Event Routing

**Critical Knowledge**: 
- `transaction:result` - Sent ONLY to the submitting device
- `transaction:new` - Broadcast to ALL gm-stations (other devices should NOT see rejection)
- `score:updated` - Broadcast to ALL gm-stations

**Testing Implication**:
```javascript
test('rejection NOT broadcast to other clients', async () => {
  const gm1 = await connectWithAuth(..., 'GM_1');
  const gm2 = await connectWithAuth(..., 'GM_2');
  
  // GM1 scans first
  const result1Promise = waitForEvent(gm1, 'transaction:result');
  await scanToken(gm1, 'sof002');
  const result1 = await result1Promise;
  expect(result1.data.status).toBe('accepted');
  
  // GM2 should receive transaction:new broadcast
  let txBroadcast = null;
  const broadcastPromise = new Promise(resolve => {
    gm2.once('transaction:new', (data) => {
      txBroadcast = data;
      resolve();
    });
  });
  await Promise.race([broadcastPromise, sleep(3000)]);
  expect(txBroadcast?.transaction?.tokenId).toBe('sof002');
  
  // GM1 tries duplicate
  const result2Promise = waitForEvent(gm1, 'transaction:result');
  await scanToken(gm1, 'sof002');
  const result2 = await result2Promise;
  expect(result2.data.status).toBe('duplicate');
  
  // CRITICAL: GM2 should NOT see rejection broadcast
  // (transaction:new not emitted for rejected transactions)
  const noSecondBroadcast = await waitForEvent(
    gm2,
    'transaction:new',
    (data) => data.transaction?.tokenId === 'sof002',
    2000
  ).catch(() => 'timeout'); // Expected to timeout
  
  expect(noSecondBroadcast).toBe('timeout');
});
```

**Reference from Code**:
- `backend/src/routes/scanRoutes.js:30-50` - Shows transaction event routing
- AsyncAPI contract shows event routing per event type

---

### Pattern #4: WebSocket Event Validation

**Critical**: All WebSocket events MUST follow the envelope pattern per AsyncAPI contract.

```javascript
// ✅ GOOD: Validate envelope for rejection events too
const result2 = await waitForEvent(socket, 'transaction:result');

// Validate envelope
assertEventEnvelope(result2, 'transaction:result');

// Then validate data structure
expect(result2.data).toHaveProperty('status');
expect(result2.data).toHaveProperty('tokenId');
expect(result2.data).toHaveProperty('teamId');
expect(result2.data).toHaveProperty('message');
expect(result2.data).toHaveProperty('timestamp');
```

**Reference from Code**:
- `backend/tests/e2e/setup/websocket-client.js:260-294` - `validateEventEnvelope()` function
- `backend/tests/e2e/helpers/assertions.js:17-26` - `assertEventEnvelope()` helper
- AsyncAPI contract: All events must have `{event, data, timestamp}` structure

---

## PART 3: SPECIFIC RECOMMENDATIONS FOR TESTS 5-6

### Test 5: Duplicate Detection - Same Team

**Test Purpose**: Verify that when the SAME team scans the SAME token twice, the second scan is rejected and state is unchanged.

**Test Structure**:
```javascript
test('backend rejects duplicate scan by same team', async () => {
  // 1. Create WebSocket connection
  const socket = await connectWithAuth(
    orchestratorInfo.url,
    'test-admin-password',
    'TEST_DUPLICATE_SAME_TEAM',
    'gm'
  );
  
  // 2. Create session and initialize scanner
  socket.emit('gm:command', {
    event: 'gm:command',
    data: {
      action: 'session:create',
      payload: { name: 'Test Session - Same Team Duplicate', teams: ['001', '002'] }
    },
    timestamp: new Date().toISOString()
  });
  await waitForEvent(socket, 'gm:command:ack', null, 5000);
  
  const context = await createBrowserContext(browser, 'mobile');
  const page = await createPage(context);
  const scanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
    orchestratorUrl: orchestratorInfo.url,
    password: 'test-admin-password'
  });
  
  await scanner.enterTeam('001');
  await scanner.confirmTeam();
  
  // 3. Scan 1 - should succeed
  const result1Promise = waitForEvent(socket, 'transaction:result');
  await page.evaluate((tokenId) => {
    window.App.processNFCRead({ id: tokenId, source: 'nfc', raw: tokenId });
  }, 'sof002');
  await scanner.waitForResult(5000);
  
  const result1 = await result1Promise;
  assertEventEnvelope(result1, 'transaction:result');
  expect(result1.data.status).toBe('accepted');
  expect(result1.data.tokenId).toBe('sof002');
  expect(result1.data.teamId).toBe('001');
  expect(result1.data.points).toBe(500);
  
  const scoreAfterFirst = await getTeamScore(page, '001', 'networked');
  expect(scoreAfterFirst).toBe(500);
  
  // 4. Scan 2 - should be rejected as duplicate
  const result2Promise = waitForEvent(socket, 'transaction:result');
  await page.evaluate((tokenId) => {
    window.App.processNFCRead({ id: tokenId, source: 'nfc', raw: tokenId });
  }, 'sof002');
  
  const result2 = await result2Promise;
  assertEventEnvelope(result2, 'transaction:result');
  
  // Verify rejection
  expect(result2.data.status).toBe('duplicate');
  expect(result2.data.tokenId).toBe('sof002');
  expect(result2.data.teamId).toBe('001');
  expect(result2.data.points).toBe(0);
  expect(result2.data.message).toContain('already claimed');
  expect(result2.data.claimedBy).toBe('001');
  expect(result2.data.originalTransactionId).toBe(result1.data.transactionId);
  
  // 5. Verify state unchanged
  const scoreAfterSecond = await getTeamScore(page, '001', 'networked');
  expect(scoreAfterSecond).toBe(scoreAfterFirst);
  
  // 6. Verify scanner still works
  const result3Promise = waitForEvent(socket, 'transaction:result');
  await page.evaluate((tokenId) => {
    window.App.processNFCRead({ id: tokenId, source: 'nfc', raw: tokenId });
  }, 'rat002');
  await scanner.waitForResult(5000);
  
  const result3 = await result3Promise;
  expect(result3.data.status).toBe('accepted');
  expect(result3.data.tokenId).toBe('rat002');
});
```

**Checklist**:
- [ ] Event envelope validated
- [ ] Rejection status is 'duplicate' (not generic error)
- [ ] Points are 0
- [ ] Message references "already claimed"
- [ ] claimedBy shows original team
- [ ] originalTransactionId matches first scan
- [ ] Score unchanged after rejection
- [ ] Scanner functional after rejection
- [ ] WebSocket connection still active

---

### Test 6: Duplicate Detection - Different Teams (First-Come-First-Served)

**Test Purpose**: Verify that when a DIFFERENT team scans a token already claimed, the second team's scan is rejected (first-come-first-served logic).

**Test Structure**:
```javascript
test('backend rejects duplicate scan by different team (first-come-first-served)', async () => {
  // 1. Create WebSocket connection
  const socket = await connectWithAuth(
    orchestratorInfo.url,
    'test-admin-password',
    'TEST_DUPLICATE_DIFF_TEAM',
    'gm'
  );
  
  // 2. Create session with 2 teams
  socket.emit('gm:command', {
    event: 'gm:command',
    data: {
      action: 'session:create',
      payload: {
        name: 'Test Session - Different Team Duplicate',
        teams: ['001', '002']
      }
    },
    timestamp: new Date().toISOString()
  });
  await waitForEvent(socket, 'gm:command:ack', null, 5000);
  
  // 3. Create two scanner instances (one for each team)
  const context1 = await createBrowserContext(browser, 'mobile');
  const page1 = await createPage(context1);
  const scanner1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', {
    orchestratorUrl: orchestratorInfo.url,
    password: 'test-admin-password'
  });
  await scanner1.enterTeam('001');
  await scanner1.confirmTeam();
  
  const context2 = await createBrowserContext(browser, 'mobile');
  const page2 = await createPage(context2);
  const scanner2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', {
    orchestratorUrl: orchestratorInfo.url,
    password: 'test-admin-password'
  });
  await scanner2.enterTeam('002');
  await scanner2.confirmTeam();
  
  // 4. Team 001 scans first - should succeed
  const result1Promise = waitForEvent(socket, 'transaction:result');
  await page1.evaluate((tokenId) => {
    window.App.processNFCRead({ id: tokenId, source: 'nfc', raw: tokenId });
  }, 'sof002');
  await scanner1.waitForResult(5000);
  
  const result1 = await result1Promise;
  assertEventEnvelope(result1, 'transaction:result');
  expect(result1.data.status).toBe('accepted');
  expect(result1.data.teamId).toBe('001');
  expect(result1.data.points).toBe(500);
  
  const score001AfterFirst = await getTeamScore(page1, '001', 'networked');
  expect(score001AfterFirst).toBe(500);
  
  // 5. Team 002 tries same token - should be rejected (first-come-first-served)
  const result2Promise = waitForEvent(socket, 'transaction:result');
  await page2.evaluate((tokenId) => {
    window.App.processNFCRead({ id: tokenId, source: 'nfc', raw: tokenId });
  }, 'sof002');
  
  const result2 = await result2Promise;
  assertEventEnvelope(result2, 'transaction:result');
  
  // Verify rejection
  expect(result2.data.status).toBe('duplicate');
  expect(result2.data.tokenId).toBe('sof002');
  expect(result2.data.teamId).toBe('002');
  expect(result2.data.points).toBe(0);
  expect(result2.data.message).toContain('already claimed');
  expect(result2.data.claimedBy).toBe('001'); // CRITICAL: Shows which team claimed it
  expect(result2.data.originalTransactionId).toBe(result1.data.transactionId);
  
  // 6. Verify scores unchanged (both teams)
  const score001AfterSecond = await getTeamScore(page1, '001', 'networked');
  expect(score001AfterSecond).toBe(500); // Team 001 unchanged
  
  const score002 = await getTeamScore(page2, '002', 'networked');
  expect(score002).toBe(0); // Team 002 still 0 (didn't get points)
  
  // 7. Verify both scanners still functional
  const result3Promise = waitForEvent(socket, 'transaction:result');
  await page1.evaluate((tokenId) => {
    window.App.processNFCRead({ id: tokenId, source: 'nfc', raw: tokenId });
  }, 'rat002');
  await scanner1.waitForResult(5000);
  
  const result3 = await result3Promise;
  expect(result3.data.status).toBe('accepted');
  expect(result3.data.teamId).toBe('001');
  
  // Team 002 should also be able to scan different token
  const result4Promise = waitForEvent(socket, 'transaction:result');
  await page2.evaluate((tokenId) => {
    window.App.processNFCRead({ id: tokenId, source: 'nfc', raw: tokenId });
  }, 'mab002');
  await scanner2.waitForResult(5000);
  
  const result4 = await result4Promise;
  expect(result4.data.status).toBe('accepted');
  expect(result4.data.teamId).toBe('002');
});
```

**Checklist**:
- [ ] Event envelope validated for both results
- [ ] First scan accepted with correct points
- [ ] Second scan (different team) rejected as 'duplicate'
- [ ] Points are 0 for rejection
- [ ] claimedBy correctly shows team '001' (original)
- [ ] originalTransactionId matches first scan
- [ ] Both teams' scores remain unchanged
- [ ] Both scanners functional after rejection
- [ ] Rejection doesn't prevent scanning other tokens
- [ ] WebSocket connection stable throughout

---

## PART 4: TIMING AND RACE CONDITIONS

### Best Practices for Async Rejection Testing

**Rule 1: Set up event listeners BEFORE triggering action**
```javascript
// ❌ WRONG - listener set after scan triggered
await scanToken(socket, 'sof002');
const result1Promise = waitForEvent(socket, 'transaction:result'); // Too late!

// ✅ CORRECT - listener before action
const result1Promise = waitForEvent(socket, 'transaction:result');
await scanToken(socket, 'sof002');
```

**Rule 2: Use Promise.all() for multiple parallel events**
```javascript
// ✅ GOOD - wait for multiple events in parallel
const [result1, score1, broadcast1] = await Promise.all([
  waitForEvent(socket, 'transaction:result'),
  waitForEvent(socket, 'score:updated'),
  waitForEvent(socket, 'transaction:new')
]);
```

**Rule 3: Use Promise.race() for timeout-with-error**
```javascript
// ✅ GOOD - expect rejection, timeout is failure
const result2 = await waitForEvent(
  socket,
  'transaction:result',
  (data) => data.status === 'duplicate',
  5000 // Will throw Error if timeout
).catch(err => {
  throw new Error(`Expected duplicate rejection but timed out: ${err.message}`);
});
```

**Rule 4: Avoid arbitrary delays between scans**
```javascript
// ❌ WRONG - arbitrary delay
await scanToken(socket, 'sof002');
await page.waitForTimeout(1000); // Why 1 second?
await scanToken(socket, 'sof002');

// ✅ CORRECT - event-driven
const result1Promise = waitForEvent(socket, 'transaction:result');
await scanToken(socket, 'sof002');
const result1 = await result1Promise; // Wait for actual completion
await scanToken(socket, 'sof002');
```

**Reference from Code**:
- `backend/tests/e2e/helpers/wait-conditions.js` - All timing is event-based
- `backend/tests/integration/duplicate-detection.test.js:80-136` - Real pattern example

---

## PART 5: COMPLETENESS CHECKLIST FOR REJECTION TESTS

After writing each rejection test, verify:

### Event & Message Level
- [ ] Status is exactly 'duplicate' (not generic error)
- [ ] Points are exactly 0
- [ ] Message contains contextual information ("already claimed")
- [ ] originalTransactionId provided for correlation
- [ ] claimedBy shows which team/device claimed token first
- [ ] Timestamp is valid ISO 8601 format
- [ ] Event envelope validates (event, data, timestamp fields)

### State Level
- [ ] Team score unchanged after rejection
- [ ] Token not added to team's scanned list
- [ ] Scanner state allows continued scanning
- [ ] WebSocket connection remains active
- [ ] Session state not corrupted

### Scanner Behavior Level
- [ ] UI displays rejection message (if applicable)
- [ ] Scanner can continue scanning after rejection
- [ ] Can scan different tokens successfully
- [ ] Team entry/exit still functional
- [ ] Mode switching still works (if applicable)

### Broadcast Level (Multiple Clients)
- [ ] Rejection NOT broadcast to other GM stations
- [ ] Accepted transaction IS broadcast (for first scan)
- [ ] Score:updated broadcast only for accepted scans
- [ ] No score change broadcasts on rejection

### Edge Cases Covered
- [ ] Same token, same team, same scanner - reject
- [ ] Same token, same team, different scanner - reject
- [ ] Same token, different team - reject (first-come-first-served)
- [ ] Rejection in first scan context (doesn't break second device)

---

## PART 6: GOOD VS BAD EXAMPLE CODE

### Example 1: Test That Will Catch Production Bugs

**Scenario**: Testing that duplicate rejection doesn't affect database state

```javascript
// ✅ EXCELLENT - Catches real production bugs
test('duplicate rejection does not corrupt session state', async () => {
  // Pre-condition: baseline
  const sessionBefore = await getSessionState(page);
  const scoresBefore = sessionBefore.scores;
  
  // Trigger: first scan
  const result1Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result1 = await result1Promise;
  
  // Verify: first scan succeeded
  const sessionAfterFirst = await getSessionState(page);
  expect(sessionAfterFirst.scores['001']).toBe(500);
  expect(sessionAfterFirst.transactions).toHaveLength(1);
  
  // Trigger: duplicate scan
  const result2Promise = waitForEvent(socket, 'transaction:result');
  await scanToken(socket, 'sof002');
  const result2 = await result2Promise;
  
  // Critical assertions that catch bugs:
  // Bug 1: Double-counting
  expect(result2.data.status).toBe('duplicate');
  expect(result2.data.points).toBe(0);
  
  // Bug 2: Database corruption
  const sessionAfterSecond = await getSessionState(page);
  expect(sessionAfterSecond.transactions).toHaveLength(1); // Still 1, not 2
  expect(sessionAfterSecond.scores['001']).toBe(500); // Still 500, not 1000
  
  // Bug 3: Token list corruption
  expect(sessionAfterSecond.tokensClaimed).toEqual(['sof002']); // Not ['sof002', 'sof002']
  
  // Bug 4: Session integrity
  expect(sessionAfterSecond.status).toBe('active'); // Not corrupted
});
```

**This test catches**:
- Transaction counted twice
- Score counted twice
- Token list duplicated
- Session marked as corrupted/ended

---

### Example 2: Test That Will NOT Catch Production Bugs

**Bad Example - Will Miss Real Issues**:

```javascript
// ❌ POOR - Won't catch many production bugs
test('duplicate is handled', async () => {
  await scanToken(socket, 'sof002');
  await page.waitForTimeout(1000);
  
  const result = await waitForEvent(socket, 'transaction:result', null, 5000);
  
  // Very weak assertions
  expect(result).toBeDefined();
  expect(result.data).toBeDefined();
  expect(result.data.tokenId).toBe('sof002');
  // Test ends here - no verification of actual rejection
});
```

**This test MISSES**:
- Whether status is actually 'duplicate' or some other error
- Whether points are correctly 0
- Whether score was actually unchanged
- Whether scanner can continue
- Whether database was corrupted

---

## SUMMARY: Key Takeaways for Tests 5-6

1. **Don't Mock Production** - Test real duplicate detection, not a mock version
2. **Event-Based, Not Time-Based** - Wait for `transaction:result` event, not arbitrary timeouts
3. **Three-Part Structure** - Pre-condition, Trigger, Verify
4. **Verify Rejection Specifically** - Check status='duplicate', not just "failure"
5. **Check State, Not Just Events** - Verify scores unchanged, scanner still works
6. **Use Predicates for Filtering** - Ensure you get the RIGHT event (same token, duplicate status)
7. **No Arbitrary Timeouts** - All waits should be event-driven per testing-anti-patterns skill
8. **Validate Envelope** - All WebSocket events must have {event, data, timestamp}
9. **Complete Verification** - Check both event properties AND resulting state
10. **Scanners Still Work** - Verify scanner functional after rejection

---

## References from Codebase

**Integration Tests** (existing duplicate tests):
- `/backend/tests/integration/duplicate-detection.test.js` - Complete pattern reference

**Functional Tests** (error scenarios):
- `/backend/tests/functional/fr-transaction-processing.test.js` - Lines 133-151

**E2E Test Patterns**:
- `/backend/tests/e2e/flows/07b-gm-scanner-networked-blackmarket.test.js` - Lines 350-356 show test stubs for Tests 5-6
- `/backend/tests/e2e/setup/websocket-client.js` - Authentication and event waiting patterns
- `/backend/tests/e2e/helpers/wait-conditions.js` - All event-based waits (no arbitrary timeouts)
- `/backend/tests/e2e/helpers/assertions.js` - Validation helpers

**Production Logic**:
- `/backend/src/services/transactionService.js:170-185` - Actual duplicate detection logic
- `/backend/src/services/transactionService.js:188-205` - Finding original transaction
- `/backend/contracts/asyncapi.yaml` - Event contract definitions

**Key Insight from Code**:
The existing E2E tests are 100% event-driven with zero arbitrary timeouts. They set up listeners BEFORE triggering actions. Tests 5-6 should follow the identical pattern.

