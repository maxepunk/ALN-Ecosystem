# Flaky Test Analysis Report
**Date:** 2025-10-30
**Analyzed By:** Claude Code (condition-based-waiting skill)
**Test Runs Analyzed:** 3 consecutive integration test runs with inconsistent failures

---

## Executive Summary

**4 tests are flaky** due to two primary root causes:
1. **Arbitrary timeouts** (guessing at async operation duration)
2. **Manual promise-based event filtering** (race conditions with event listeners)

**Impact:** Tests pass 84-95% of the time (16/19 or 18/19 pass), but fail unpredictably under load or in CI environments.

**Test Failure Pattern:**
- Run 1: `multi-client-broadcasts.test.js` (FAIL), `state-synchronization.test.js` (FAIL)
- Run 2: `admin-interventions.test.js` (FAIL)
- Run 3: `udp-discovery.test.js` (FAIL)

---

## Root Cause Analysis

### Category 1: Arbitrary Timeouts (Condition-Based Waiting Issue)

**Anti-Pattern:** Using `setTimeout` to "wait for async operations to complete" instead of waiting for actual conditions.

#### Files Affected:

**`multi-client-broadcasts.test.js`**
- **Line 172:** `await new Promise(resolve => setTimeout(resolve, 50));` - "Wait for pending events from beforeEach to clear"
- **Line 235:** `await new Promise(resolve => setTimeout(resolve, 500));` - **CRITICAL** - "Wait for all events to propagate"
- **Line 268:** `await new Promise(resolve => setTimeout(resolve, 50));` - "Wait before session updates"
- **Line 270:** `await new Promise(resolve => setTimeout(resolve, 50));` - Second wait in rapid session updates
- **Line 274:** `await new Promise(resolve => setTimeout(resolve, 200));` - "Wait for all events to propagate"

**`admin-interventions.test.js`**
- **Line 387:** `await new Promise(resolve => setTimeout(resolve, 100));` - "Wait after session end for scores to clear"

**Why These Fail:**
- 50ms/100ms may be too short under CPU load (Pi 4, CI environments)
- 500ms/200ms wastes time when events arrive faster
- No guarantee events have actually arrived after timeout expires
- Tests pass on fast machines, fail on slow machines

**Recommended Fix Pattern:**
```javascript
// ❌ BEFORE: Guessing at timing
await new Promise(resolve => setTimeout(resolve, 500));
expect(gm1Events.length).toBe(5);

// ✅ AFTER: Waiting for actual condition
await waitForMultipleEvents(gm1, 'transaction:new', 5, 5000);
const events = gm1Events; // Now guaranteed to have 5 events
```

---

### Category 2: Manual Promise-Based Event Filtering (Race Condition)

**Anti-Pattern:** Setting up event listeners AFTER triggering the event, then manually filtering for specific values.

#### Files Affected:

**`admin-interventions.test.js`**
- **Line 101-107:** Waiting for `score:updated` with specific value (`currentScore === -460`)
- **Line 165-171:** Waiting for `score:updated` with specific value (`currentScore === 2030`)
- **Line 230-236:** Waiting for `session:update` with specific name (`name === 'Admin Created Session'`)
- **Line 311-317:** Waiting for `session:update` with specific status (`status === 'active'`)
- **Line 789-795:** Waiting for `score:updated` with specific value (`currentScore === -960`)

**Why These Fail:**
1. Event listener registered **AFTER** command is emitted
2. If event arrives before `socket.on()` is registered → missed event
3. If multiple events arrive, filter may catch wrong event
4. Race condition: Command processing speed vs listener registration speed

**Example of the Race:**
```javascript
// Line 109: Send command (starts async processing)
gmAdmin.socket.emit('gm:command', { action: 'score:adjust', ... });

// Line 101-107: Listener setup happens AFTER emit (race!)
const scorePromise = new Promise((resolve) => {
  gmObserver.socket.on('score:updated', (event) => {
    if (event.data.currentScore === -460) {  // May miss earlier events!
      resolve(event);
    }
  });
});
```

**Recommended Fix Pattern:**
```javascript
// ✅ Set up listener BEFORE triggering event
const scorePromise = waitForMultipleEvents(
  gmObserver.socket,
  'score:updated',
  (events) => events.some(e => e.data.currentScore === -460),
  5000
);

// THEN trigger the command
gmAdmin.socket.emit('gm:command', { action: 'score:adjust', ... });

const events = await scorePromise;
```

---

### Category 3: Timing-Sensitive Assertions (Stress Test)

**Location:** `multi-client-broadcasts.test.js:296-345` - "Broadcast Timing Consistency"

**Anti-Pattern:** Asserting that 3 clients receive broadcasts within 100ms of each other.

```javascript
// Line 338-340: Strict timing assertion
const variance = maxTime - minTime;
expect(variance).toBeLessThan(100); // Fails under load
```

**Why This Fails:**
- Network stack timing varies (even on localhost)
- CPU scheduling delays under load
- 100ms variance is too strict for integration tests
- This is a **stress test masquerading as a functional test**

**Recommended Fix:**
- Increase tolerance to 500ms (functional requirement: "timely", not "exact")
- OR move to performance test suite (not integration tests)
- OR remove entirely (functional tests already verify broadcasts reach all clients)

---

## Test Isolation Analysis

### Good Practices Found:

✅ **Listener cleanup is comprehensive:**
- `cleanupBroadcastListeners()` properly removes service event listeners (broadcasts.js:43-78)
- `listenerRegistry` tracks all listeners and removes them (listenerRegistry.js:44-78)
- Socket listeners removed via `socket.removeAllListeners()` (multi-client-broadcasts.test.js:39-43)

✅ **Service reset is thorough:**
- `resetAllServices()` calls `.reset()` on all services (service-reset.js:21-32)
- Services are re-initialized with test fixtures after reset (integration-test-server.js:28-45)
- Broadcast listeners re-setup after cleanup (multi-client-broadcasts.test.js:60-66)

✅ **Test fixtures are isolated:**
- Integration tests use `TestTokens` fixtures (not production ALN-TokenData)
- Each test gets clean service state via `beforeEach`

### Potential Isolation Issue:

⚠️ **Service singleton state may leak between test files:**
- Services are Node.js module singletons (require cache persists)
- `beforeAll` in integration-test-server.js initializes services ONCE
- Individual tests call `resetAllServices()` but not `cleanupIntegrationTestServer()`
- **If one test file fails to cleanup, next test file inherits dirty state**

**Evidence:**
- Failures are **non-deterministic across test files** (different test fails each run)
- Suggests state pollution from previous test file, not within-file isolation

**Recommended Investigation:**
```bash
# Run each flaky test in isolation (should pass)
npm run test:integration -- multi-client-broadcasts.test.js  # Passes alone?
npm run test:integration -- admin-interventions.test.js      # Passes alone?

# Run in specific order to reproduce failure
npm run test:integration -- multi-client-broadcasts.test.js admin-interventions.test.js
```

---

## Priority Ranking (by Impact)

### 🔴 **Critical - Fix Immediately**

**1. Line 235 in `multi-client-broadcasts.test.js`** - 500ms arbitrary timeout in concurrent load test
- **Why:** This test validates core multi-client broadcast functionality
- **Impact:** 500ms delay * multiple iterations = slowest test in suite
- **Flakiness:** Highest (fails most often under load)
- **Fix Effort:** Low (use `waitForMultipleEvents`)

**2. Lines 101-107, 165-171, 789-795 in `admin-interventions.test.js`** - Score filtering race conditions
- **Why:** Admin interventions are critical for game operation
- **Impact:** 3 separate tests affected by same pattern
- **Flakiness:** High (race condition with command processing)
- **Fix Effort:** Medium (set up listeners before commands)

### 🟡 **Medium - Fix Soon**

**3. Lines 230-236, 311-317 in `admin-interventions.test.js`** - Session update filtering
- **Why:** Session lifecycle is important but less frequently tested
- **Impact:** 2 tests affected
- **Flakiness:** Medium
- **Fix Effort:** Low (same fix as #2)

**4. Lines 172, 268, 270, 274 in `multi-client-broadcasts.test.js`** - Short arbitrary timeouts
- **Why:** Tests work most of the time (50-200ms usually sufficient)
- **Impact:** Occasional flakiness, not consistent failures
- **Flakiness:** Low-Medium
- **Fix Effort:** Low (use condition-based waiting)

### 🟢 **Low - Consider Removing**

**5. Line 387 in `admin-interventions.test.js`** - 100ms wait after session end
- **Why:** Commented as "Wait for scores to clear" but no condition verified
- **Impact:** Single test, works most of the time
- **Flakiness:** Low
- **Fix Effort:** Low (poll for empty scores array)

**6. Lines 296-345 in `multi-client-broadcasts.test.js`** - Timing variance assertion (<100ms)
- **Why:** This is a **performance/stress test**, not a functional test
- **Impact:** Tests core functionality that's already covered elsewhere
- **Flakiness:** Medium (timing-sensitive)
- **Fix Effort:** Remove test OR move to perf suite OR increase tolerance to 500ms

---

## Recommended Fix Order

### Phase 1: Quick Wins (30 minutes)
1. Fix `multi-client-broadcasts.test.js:235` (500ms timeout) → use `waitForMultipleEvents`
2. Fix `admin-interventions.test.js:101-107` (score filtering) → set up listener before command

### Phase 2: Pattern Application (1 hour)
3. Apply same fix to all 5 manual promise-based filters in `admin-interventions.test.js`
4. Replace remaining arbitrary timeouts in `multi-client-broadcasts.test.js` with condition-based waiting

### Phase 3: Cleanup (30 minutes)
5. Remove or relocate timing variance test (line 296-345)
6. Run 20x in CI to verify fixes

---

## Test Isolation Recommendations

### Immediate Actions:
1. **Run isolation test:** Verify each flaky test passes when run alone
2. **Check for state leaks:** Add assertions in `beforeEach` to verify services are clean

### Future Improvements:
1. **Add service state validation:** Assert clean state at start of each test
2. **Consider per-test server creation:** Currently sharing server across all tests in file
3. **Add listener leak detection:** Assert listener count === 0 after cleanup

---

## Tools Available for Fixes

Your test infrastructure already has the right tools:

### ✅ `waitForEvent(socket, event, timeout)`
**Location:** `tests/helpers/websocket-helpers.js:36`
**Use:** Single event with timeout

### ✅ `waitForMultipleEvents(socket, event, countOrPredicate, timeout)`
**Location:** `tests/helpers/websocket-helpers.js:111`
**Use:** Multiple events with count or custom predicate
**Example:**
```javascript
// Wait for 5 transaction:new events
const events = await waitForMultipleEvents(socket, 'transaction:new', 5, 5000);

// Wait for specific score value
const events = await waitForMultipleEvents(
  socket,
  'score:updated',
  (events) => events.some(e => e.data.currentScore === -460),
  5000
);
```

### ✅ Cleanup infrastructure is solid:
- `cleanupBroadcastListeners()` - removes service event listeners
- `resetAllServices()` - clears service state
- `socket.removeAllListeners()` - removes socket listeners

---

## Next Steps

1. **Confirm analysis:** Run each flaky test in isolation to verify root cause
2. **Apply fixes:** Start with Phase 1 (highest impact, lowest effort)
3. **Verify fixes:** Run 20x to confirm flakiness eliminated
4. **Monitor CI:** Track pass rate over next 50 CI runs

---

## References

- **Condition-Based Waiting Skill:** `/home/maxepunk/.claude/plugins/cache/superpowers/skills/condition-based-waiting/SKILL.md`
- **Test Helpers:** `backend/tests/helpers/websocket-helpers.js`
- **Service Reset:** `backend/tests/helpers/service-reset.js`
- **Broadcast Cleanup:** `backend/src/websocket/broadcasts.js`
