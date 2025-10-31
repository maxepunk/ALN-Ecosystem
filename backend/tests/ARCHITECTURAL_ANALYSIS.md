# Architectural Analysis: Listener Management and Test Isolation
**Date:** 2025-10-31
**Analysis:** Downstream implications of proposed `reset()` fix

---

## Critical Discovery: Two Categories of Listeners

The diagnostic revealed that service event listeners fall into **two distinct categories** with different purposes and lifecycles:

### Category 1: Broadcast Listeners (Infrastructure)
**Purpose:** Forward service events to WebSocket clients
**Location:** `backend/src/websocket/broadcasts.js`
**Tracking:** ✅ Tracked via `listenerRegistry`
**Lifecycle:** Test-scoped (reset between tests)

**Example:**
```javascript
// broadcasts.js:48
addTrackedListener(sessionService, 'session:created', (session) => {
  emitWrapped(io, 'session:update', { ... });  // Forward to WebSocket clients
});
```

**Count per test:** ~5-6 listeners

### Category 2: Service Coordination Listeners (Internal Logic)
**Purpose:** Internal service-to-service coordination
**Location:** Service constructors and init methods
**Tracking:** ❌ NOT tracked (intentionally persistent)
**Lifecycle:** Application-scoped (persist across tests)

**Example:**
```javascript
// transactionService.js:51
sessionService.on('session:created', (sessionData) => {
  // Initialize team scores for new session
  sessionData.teams.forEach(teamId => {
    this.teamScores.set(teamId, TeamScore.createInitial(teamId));
  });
});
```

**Count:** 2 listeners (from transactionService constructor)

**Total: 8 listeners** (matches diagnostic output) ✓

---

## Why The Original Design Was Correct

### Production Behavior (system:reset command)

```javascript
// adminEvents.js:204-236
case 'system:reset': {
  await sessionService.endSession();
  await sessionService.reset();       // Clears session state
  transactionService.reset();         // Clears scores/transactions
  videoQueueService.clearQueue();
  // Server continues running...
}
```

**After system:reset:**
- ✅ Session data cleared
- ✅ Transactions cleared
- ✅ Scores reset
- ✅ Broadcast listeners PERSIST → broadcasts still work
- ✅ Service coordination listeners PERSIST → internal logic still works
- ✅ New session can be created immediately

**The comment in sessionService.reset() was CORRECT for production:**
```javascript
// NOTE: Do NOT remove listeners - broadcast listeners are infrastructure
// and should persist across resets.
```

In production, `reset()` is **state cleanup**, not **infrastructure teardown**.

### Test Behavior (integration tests)

```javascript
// admin-interventions.test.js:41-65
beforeEach(async () => {
  await resetAllServices();           // 1. Reset state (listeners NOT removed)
  cleanupBroadcastListeners();        // 2. Remove BROADCAST listeners (tracked)
  // ... re-init tokens ...
  await resetAllServices();           // 3. Reset again (why?)
  setupBroadcastListeners(...);       // 4. Re-register BROADCAST listeners
  // Service coordination listeners persist (untracked) ✓
});
```

**After beforeEach:**
- ✅ Session data cleared
- ✅ Transactions cleared
- ✅ Broadcast listeners re-registered (fresh)
- ✅ Service coordination listeners PERSIST → internal logic works

**The design is CORRECT for tests too** - as long as `cleanupBroadcastListeners()` is called.

---

## So What's Actually Causing The Flaky Tests?

### Diagnostic Output Analysis

```
📊 Listener counts BEFORE reset:
  sessionService: 8 total
    - session:created: 3
    - session:updated: 2
    - transaction:added: 2
    - device:updated: 1

📊 Listener counts AFTER reset:
  sessionService: 8 total 🔴
```

**This is expected behavior!** The diagnostic runs DURING `resetAllServices()`, which is called BEFORE `cleanupBroadcastListeners()`.

The 8 listeners are:
- 2 untracked (transactionService) → SHOULD persist
- 6 tracked (broadcasts + stateService) → WILL be cleaned by cleanupBroadcastListeners() in next step

### The Real Problem: Double Setup

Look at the beforeEach sequence:

```javascript
beforeEach(async () => {
  await resetAllServices();           // Line 43
  cleanupBroadcastListeners();        // Line 45
  const testTokens = TestTokens.getAllAsArray();
  await transactionService.init(testTokens);
  await resetAllServices();           // Line 57 - CALLED AGAIN! ⚠️
  setupBroadcastListeners(testContext.io, { ... });  // Line 59
});
```

**Flow:**
1. Reset services (listeners: 8)
2. Cleanup broadcast listeners (listeners: 2 - only untracked remain)
3. Reset services AGAIN (listeners: 2 - why?)
4. Setup broadcast listeners (listeners: 8 - back to 8)

The comment says: "CRITICAL: Reset videoQueueService to clear all timers"

### Potential Issue: Duplicate setupBroadcastListeners() Calls

**beforeAll:**
```javascript
// integration-test-server.js:134
setupBroadcastListeners(io, { ... });  // Call #1
```

**beforeEach:**
```javascript
// admin-interventions.test.js:59
setupBroadcastListeners(testContext.io, { ... });  // Call #2, #3, #4...
```

**Does `setupBroadcastListeners()` check for duplicates?**

From broadcasts.js:20:
```javascript
function addTrackedListener(service, event, handler) {
  service.on(event, handler);  // ← Adds EVERY time, no duplicate check!
  activeListeners.push({ service, event, handler });
  listenerRegistry.trackListener(service, event, handler);
}
```

❌ **NO DUPLICATE CHECK!**

This means if `cleanupBroadcastListeners()` fails or is skipped, calling `setupBroadcastListeners()` again would **add duplicate listeners**.

---

## Downstream Implications of Proposed Fix

### Option 1: Add `removeAllListeners()` to service `reset()`

```javascript
// sessionService.js
async reset() {
  this.stopSessionTimeout();
  this.removeAllListeners();  // ⚠️ PROPOSED FIX
  this.initState();
  await persistenceService.delete('session:current');
}
```

#### Impact on Production:

**system:reset command flow:**
```javascript
case 'system:reset': {
  await sessionService.reset();  // ← Removes ALL listeners!
  // ... no call to setupBroadcastListeners() in production!
}
```

**Result:**
- 🔴 **BREAKING:** Broadcast listeners removed → broadcasts stop working
- 🔴 **BREAKING:** Service coordination listeners removed → internal logic breaks
- 🔴 **BREAKING:** No mechanism to re-register listeners in production

**Production would be BROKEN after system:reset.**

#### Impact on Tests:

```javascript
beforeEach(async () => {
  await resetAllServices();           // ← Removes ALL listeners!
  cleanupBroadcastListeners();        // ← No-op (nothing to clean)
  await resetAllServices();           // ← Removes ALL listeners again!
  setupBroadcastListeners(...);       // ← Re-adds broadcast listeners
  // ⚠️ Service coordination listeners GONE - need re-init!
});
```

**Result:**
- ⚠️ **PARTIAL BREAK:** Service coordination listeners lost
- ⚠️ Need to call `transactionService.registerSessionListener()` again
- ⚠️ Need to call `stateService.setupTransactionListeners()` again
- 🔴 These aren't currently called in test setup

**Tests would need significant refactoring.**

### Option 2: Status Quo (Current Behavior)

**Keep production working as-is, fix the test issue properly.**

---

## The Testing Anti-Pattern Question

### Is using production `reset()` in tests an anti-pattern?

**Anti-Pattern 2 from the skill:**
> "Never add test-only methods to production classes"

But `reset()` is NOT test-only - it's used by the `system:reset` admin command (FR 4.2.5).

**However, there's a deeper issue:**

The production `reset()` and test `resetAllServices()` have **conflicting requirements**:

| Requirement | Production | Tests |
|-------------|-----------|-------|
| Clear state | ✅ Yes | ✅ Yes |
| Remove listeners | ❌ No (infrastructure persists) | ⚠️ Tracked: Yes, Untracked: No |
| Re-init required | ❌ No | ✅ Yes (broadcast listeners) |

**This is NOT Anti-Pattern 2, but it IS a design smell:**

**"Production method with dual purpose that has conflicting requirements in different contexts"**

---

## The Real Anti-Pattern: Lack of Idempotency

`setupBroadcastListeners()` is **not idempotent** - calling it twice adds duplicate listeners.

From testing-anti-patterns skill:
> "Mock the COMPLETE data structure... Partial mocks fail silently"

Similarly: **Infrastructure setup should be idempotent** - calling it twice should not cause accumulation.

**Better design:**
```javascript
function setupBroadcastListeners(io, services) {
  // Idempotent check
  if (broadcastListenersActive) {
    logger.debug('Broadcast listeners already active, skipping');
    return;
  }
  broadcastListenersActive = true;

  // Setup listeners...
}

function cleanupBroadcastListeners() {
  // ... cleanup ...
  broadcastListenersActive = false;  // Allow re-setup
}
```

---

## Recommended Solutions

### Solution 1: Make setupBroadcastListeners() Idempotent (Safest)

**Changes:**
- Add idempotency check to `setupBroadcastListeners()`
- Track if listeners are already registered
- Skip duplicate registration

**Pros:**
- ✅ No production impact
- ✅ Tests become resilient to multiple setup calls
- ✅ No breaking changes

**Cons:**
- ⚠️ Doesn't fix root cause (why are we calling it multiple times?)

### Solution 2: Fix Test Setup Order (Most Correct)

**Changes:**
- Call `setupBroadcastListeners()` ONLY in beforeAll
- Do NOT call it in beforeEach
- Rely on cleanup/re-setup cycle in integration-test-server

**Pros:**
- ✅ Cleaner test structure
- ✅ No production impact
- ✅ Matches production pattern (setup once)

**Cons:**
- ⚠️ Requires updating all integration test files

### Solution 3: Separate Test Reset from Production Reset (Most Robust)

**Create test-specific helper:**
```javascript
// tests/helpers/service-reset.js
async function resetAllServicesForTesting() {
  // Reset state
  await sessionService.reset();
  await transactionService.reset();
  await videoQueueService.reset();
  await stateService.reset();
  await offlineQueueService.reset();

  // ALSO remove broadcast listeners (test-specific behavior)
  cleanupBroadcastListeners();

  // Re-register service coordination listeners (lost in cleanup)
  transactionService.registerSessionListener();
  stateService.setupTransactionListeners();
}
```

**Pros:**
- ✅ Clear separation of concerns
- ✅ No production impact
- ✅ Tests have explicit cleanup behavior

**Cons:**
- ⚠️ Creates parallel reset logic (maintenance burden)
- ⚠️ Not actually needed if Solution 1 or 2 applied

---

## Answers to Your Questions

### 1. Downstream implications of making the implementation code change?

**If we add `removeAllListeners()` to service `reset()` methods:**

**On tests:**
- ⚠️ Service coordination listeners lost → internal logic breaks
- ⚠️ Need to explicitly re-register listeners in test setup
- ⚠️ Significant test refactoring required

**On production:**
- 🔴 **BREAKING:** `system:reset` command would destroy infrastructure
- 🔴 Broadcasts stop working after reset
- 🔴 Internal service coordination breaks
- 🔴 Server would need restart after system:reset

**Verdict:** ❌ This change would break production.

### 2. Is this a test anti-pattern?

**It's not Anti-Pattern 2** (test-only methods), but it IS a design smell:

**"Using production methods with conflicting dual-purpose requirements"**

The issue is not that tests use `reset()`, but that:
1. `setupBroadcastListeners()` is not idempotent (the real anti-pattern)
2. Tests call it multiple times without proper guards
3. Production and test lifecycles differ but share the same method

### 3. Is this outdated understanding or misinterpretation?

**Neither - it's CORRECT understanding with incomplete visibility:**

**The original developer correctly understood:**
- Broadcast listeners are infrastructure (persist across resets)
- Production needs listeners to persist after `system:reset`
- `cleanupTestServer()` handles cleanup (which it does, in afterAll)

**What they DIDN'T account for:**
- Tests calling `setupBroadcastListeners()` multiple times
- Lack of idempotency guards in setup functions
- Interaction between tracked vs untracked listeners

The comment was correct, but the broader system lacks defensive guards against misuse.

---

## Recommended Action

**Apply Solution 1: Make setupBroadcastListeners() Idempotent**

This is the safest, lowest-impact fix that prevents the accumulation issue without breaking anything.

Then optionally apply Solution 2 to clean up test structure.

**DO NOT apply the original proposed fix** (`removeAllListeners()` in `reset()`) - it would break production.
