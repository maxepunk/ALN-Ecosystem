# Test Isolation Analysis
**Date:** 2025-10-30
**Focus:** Cross-test state pollution and cleanup verification

---

## Summary

**Good news:** Your test isolation infrastructure is well-designed. Tests have proper cleanup between runs within a test file.

**Mystery:** Flaky failures are **non-deterministic across test files** (different test fails each run), suggesting potential state leakage between test files, not within a file.

---

## Test Infrastructure Review

### ✅ **Excellent: Within-File Isolation**

#### Cleanup Mechanisms:

**1. Broadcast Listener Cleanup (`broadcasts.js`)**
```javascript
// Line 12: Module-level tracking
const activeListeners = [];

// Line 20-36: Tracked listener addition
function addTrackedListener(service, event, handler) {
  service.on(event, handler);
  activeListeners.push({ service, event, handler });
  listenerRegistry.trackListener(service, event, handler);
}

// Cleanup removes ALL tracked listeners
function cleanupBroadcastListeners() {
  listenerRegistry.cleanup();  // Removes via registry
  activeListeners.length = 0;   // Clears module array
}
```

**2. Listener Registry (`listenerRegistry.js`)**
```javascript
// Lines 44-78: Comprehensive cleanup
cleanup() {
  for (const [service, listeners] of this.listeners) {
    for (const { event, handler } of listeners) {
      service.removeListener(event, handler);  // Remove from service
    }
    listeners.length = 0;  // Clear tracking array
  }
  this.listeners.clear();  // Clear registry map
}
```

**3. Service State Reset (`service-reset.js`)**
```javascript
async function resetAllServices() {
  await sessionService.reset();      // Clears session state
  await transactionService.reset();  // Clears transactions and scores
  videoQueueService.reset();         // Clears video queue
}
```

**4. Socket Cleanup (in test files)**
```javascript
// multi-client-broadcasts.test.js:39-43
beforeEach(async () => {
  [gm1, gm2, gm3].forEach(socket => {
    if (socket) socket.removeAllListeners();  // Remove ALL socket listeners
  });
  // ... then reset services and re-setup
});
```

#### Test Pattern:
```javascript
beforeEach(async () => {
  // 1. Remove old socket listeners
  sockets.forEach(s => s?.removeAllListeners());

  // 2. Reset service state
  await resetAllServices();

  // 3. Cleanup broadcast listeners
  cleanupBroadcastListeners();

  // 4. Re-initialize tokens
  await transactionService.init(testTokens);

  // 5. Re-setup broadcast listeners
  setupBroadcastListeners(io, services);

  // 6. Create fresh session
  await sessionService.createSession({ ... });

  // 7. Connect fresh clients
  gm1 = await connectAndIdentify(...);
});

afterEach(async () => {
  // Disconnect sockets
  sockets.forEach(s => s?.connected && s.disconnect());

  // Reset services again
  await resetAllServices();
});
```

**Verdict:** ✅ This is excellent test isolation. Tests within a file should not pollute each other.

---

### ⚠️ **Potential Issue: Between-File Isolation**

#### Observed Behavior:
- Run 1: `multi-client-broadcasts.test.js` fails, `admin-interventions.test.js` passes
- Run 2: `multi-client-broadcasts.test.js` passes, `admin-interventions.test.js` fails
- Run 3: Both pass, `udp-discovery.test.js` fails

**This pattern suggests:**
1. Tests pass when run in isolation (within-file cleanup works)
2. Tests fail non-deterministically when run in sequence (between-file state leak?)

#### Hypothesis: Service Singleton State Leak

**Setup Pattern:**
```javascript
// integration-test-server.js:27-60
async function setupIntegrationTestServer() {
  const persistenceService = require('../../src/services/persistenceService');
  const transactionService = require('../../src/services/transactionService');
  // ... other services

  await persistenceService.init();        // ONCE per server
  await transactionService.init(tokens);  // ONCE per server
  await sessionService.init();            // ONCE per server
}
```

**Problem:**
- `setupIntegrationTestServer()` called in `beforeAll()` (once per test file)
- Services are Node.js module singletons (cached in `require()`)
- **If Test File A fails to cleanup fully, Test File B gets dirty singletons**

#### Evidence:

**1. Services are shared across test files:**
```javascript
// Every test file does:
beforeAll(async () => {
  testContext = await setupIntegrationTestServer();  // Same singleton services
});
```

**2. Cleanup only happens in `afterAll()`:**
```javascript
// cleanupIntegrationTestServer() only called at end of file
afterAll(async () => {
  await cleanupIntegrationTestServer(testContext);
});
```

**3. Services might accumulate state across files:**
- EventEmitter listener count can accumulate if `removeAllListeners()` not called
- Service internal state might not fully reset
- Timer references (videoQueueService) might leak

---

## Diagnostic Recommendations

### Test 1: Verify Within-File Isolation (Expected: PASS)
```bash
# Run each flaky test 10 times in isolation
for i in {1..10}; do
  echo "=== Run $i ==="
  npm run test:integration -- multi-client-broadcasts.test.js
done

# If all 10 pass → within-file isolation is good
# If any fail → there's a within-file issue
```

### Test 2: Verify Between-File Isolation (Expected: FAIL)
```bash
# Run flaky tests in specific order
npm run test:integration -- \
  multi-client-broadcasts.test.js \
  admin-interventions.test.js \
  state-synchronization.test.js \
  udp-discovery.test.js

# Run 10 times and track which test fails each time
# If failures are non-deterministic → between-file leak confirmed
```

### Test 3: Check Listener Accumulation
```bash
# Add debug logging to see listener counts
# In beforeEach of each test file, add:
console.log('Listener counts before reset:', {
  sessionService: sessionService.listenerCount('session:created'),
  transactionService: transactionService.listenerCount('transaction:new'),
  stateService: stateService.listenerCount('state:updated')
});
```

---

## Potential Fixes (If Between-File Leak Confirmed)

### Option 1: Force Service Cleanup in `beforeAll()` (Quick Fix)
```javascript
// In each test file's beforeAll (before setupIntegrationTestServer)
beforeAll(async () => {
  // FORCE cleanup from previous test file
  const { resetAllServices } = require('../helpers/service-reset');
  await resetAllServices();

  // Remove ALL listeners from services
  const sessionService = require('../../src/services/sessionService');
  const transactionService = require('../../src/services/transactionService');
  sessionService.removeAllListeners();
  transactionService.removeAllListeners();

  // NOW setup fresh server
  testContext = await setupIntegrationTestServer();
});
```

### Option 2: Global Test Setup (Better Fix)
```javascript
// jest.integration.config.js
module.exports = {
  globalSetup: './tests/helpers/global-setup.js',
  globalTeardown: './tests/helpers/global-teardown.js'
};

// tests/helpers/global-setup.js
module.exports = async () => {
  // Force clean state before ANY tests run
  const { resetAllServices } = require('./service-reset');
  await resetAllServices();
};
```

### Option 3: Isolate Test Server Per File (Best Fix, More Work)
```javascript
// Create fresh server for EACH test file (not shared singleton)
// Requires restructuring integration-test-server.js to avoid shared state
```

---

## Current Cleanup Analysis

### ✅ **What Gets Cleaned:**
- Socket event listeners → `socket.removeAllListeners()` ✓
- Broadcast listeners → `cleanupBroadcastListeners()` ✓
- Service state → `resetAllServices()` ✓
- HTTP server → `server.close()` ✓
- Socket.IO connections → `io.close()` ✓

### ❓ **What Might Not Get Cleaned:**
- EventEmitter listeners on services (if `removeAllListeners()` not called)
- Timer references (e.g., videoQueueService polling timers)
- File descriptors (persistenceService file handles)
- Global state in scanner submodules (if imported)

---

## Recommended Investigation Steps

### Step 1: Run Isolation Tests (15 min)
```bash
# Test within-file isolation
for test in multi-client-broadcasts admin-interventions state-synchronization udp-discovery; do
  echo "=== Testing $test in isolation ==="
  success=0
  for i in {1..10}; do
    npm run test:integration -- ${test}.test.js > /dev/null 2>&1 && ((success++))
  done
  echo "$test: $success/10 passed in isolation"
done
```

### Step 2: Add Listener Count Logging (10 min)
```javascript
// Add to beforeEach in each flaky test file
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

console.log('PRE-CLEANUP Listener counts:', {
  'session:created': sessionService.listenerCount('session:created'),
  'session:updated': sessionService.listenerCount('session:updated'),
  'transaction:new': transactionService.listenerCount('transaction:new')
});

await resetAllServices();
cleanupBroadcastListeners();

console.log('POST-CLEANUP Listener counts:', {
  'session:created': sessionService.listenerCount('session:created'),
  'session:updated': sessionService.listenerCount('session:updated'),
  'transaction:new': transactionService.listenerCount('transaction:new')
});

// If POST-CLEANUP counts != 0 → cleanup is incomplete
```

### Step 3: Check for Timer Leaks (5 min)
```bash
# Run tests with Node.js --trace-warnings
npm run test:integration -- --trace-warnings multi-client-broadcasts.test.js

# Look for: "Warning: Possible EventEmitter memory leak detected"
# Or: "Warning: Timeout was not cleared"
```

---

## Conclusion

**Current Status:**
- ✅ Within-file isolation appears excellent (comprehensive cleanup)
- ⚠️ Between-file isolation is suspect (non-deterministic failures suggest state leak)

**Next Action:**
- Run Step 1 isolation tests to **prove** within-file vs between-file hypothesis
- If confirmed, apply Option 1 quick fix (force cleanup in beforeAll)

**Long-term:**
- Consider per-test-file server creation (full isolation)
- Add automated listener leak detection (fail test if listeners remain after cleanup)
