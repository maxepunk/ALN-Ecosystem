# Listener Leak Diagnostics

## Overview

This diagnostic system helps identify EventEmitter listener leaks that can cause test isolation issues and flaky test failures.

**Key Question:** Is this a test isolation bug or an implementation bug?

## How to Use

### Quick Start

Run integration tests with diagnostics enabled:

```bash
cd backend
LISTENER_DIAGNOSTICS=true npm run test:integration
```

### Run Specific Flaky Test Files

Test just the flaky files to see listener accumulation:

```bash
LISTENER_DIAGNOSTICS=true npm run test:integration -- \
  admin-interventions.test.js \
  multi-client-broadcasts.test.js
```

### Understanding the Output

#### 1. Test File Tracking

```
============================================================
🧪 Starting test file: admin-interventions.test.js
============================================================
```

Shows which test file is currently executing.

#### 2. Listener Counts BEFORE Reset

```
📊 Listener counts BEFORE reset:
  sessionService: 5 total
    - session:created: 1
    - session:updated: 1
    - transaction:added: 1
    - device:updated: 1
    - device:removed: 1
  transactionService: 3 total
    - transaction:new: 1
```

Shows how many listeners exist **before** `resetAllServices()` is called.
- **Normal:** Small counts (1-2 per event) from broadcast listeners
- **Warning:** Large counts (5+) suggest accumulation from previous tests

#### 3. Listener Counts AFTER Reset

```
📊 Listener counts AFTER reset:
  sessionService: 5 total 🔴
    - session:created: 1
    - session:updated: 1
```

Shows listeners that **remain after** `resetAllServices()` completes.
- **Expected:** `✅ All listeners cleaned up successfully`
- **Problem:** Any listeners remaining indicate a leak

#### 4. Leak Detection Report

```
⚠️  LISTENER LEAK DETECTED ⚠️
═══════════════════════════════════════════════════════

sessionService:
  Before reset: 5 listeners
  After reset:  5 listeners 🔴
  Leaked events:
    - session:created: 1 listener(s)
    - session:updated: 1 listener(s)
    - transaction:added: 1 listener(s)
    - device:updated: 1 listener(s)
    - device:removed: 1 listener(s)

═══════════════════════════════════════════════════════
💡 Diagnosis:
  - If listeners remain AFTER reset() → Implementation bug
    (reset() should call removeAllListeners() or cleanup properly)
  - If listeners accumulate across test files → Test isolation bug
    (need to add explicit listener cleanup in test setup)
═══════════════════════════════════════════════════════
```

## Interpreting Results

### Scenario 1: Implementation Bug (Likely)

**Pattern:**
- Listeners exist BEFORE reset: ✅ Expected (broadcast listeners)
- Listeners remain AFTER reset: 🔴 **Problem**
- Count stays constant across tests: 🔴 **Problem**

**Example:**
```
BEFORE: sessionService: 5 listeners
AFTER:  sessionService: 5 listeners 🔴  (same count - not cleaned up!)
```

**Root Cause:** The service's `reset()` method doesn't call `removeAllListeners()`.

**Fix Location:** `backend/src/services/sessionService.js` (or other service)

**Fix:**
```javascript
async reset() {
  this.stopSessionTimeout();
  this.removeAllListeners();  // ✅ ADD THIS LINE
  this.initState();
  await persistenceService.delete('session:current');
}
```

### Scenario 2: Test Isolation Bug

**Pattern:**
- Listeners exist BEFORE reset: 5, 10, 15, 20... (increasing)
- Listeners cleaned AFTER reset: ✅ (count drops to 0)
- Count **accumulates** across test files

**Example:**
```
Test File 1:
  BEFORE: sessionService: 5 listeners
  AFTER:  sessionService: 0 listeners ✅

Test File 2:
  BEFORE: sessionService: 10 listeners  (5 new + 5 from file 1)
  AFTER:  sessionService: 0 listeners ✅

Test File 3:
  BEFORE: sessionService: 15 listeners  (accumulating!)
```

**Root Cause:** Listeners added in `beforeAll()` persist across test files via Node.js require cache.

**Fix Location:** Test files' `beforeAll()` hooks

**Fix:**
```javascript
beforeAll(async () => {
  // FORCE cleanup from previous test file
  sessionService.removeAllListeners();
  transactionService.removeAllListeners();

  testContext = await setupIntegrationTestServer();
});
```

### Scenario 3: Both Issues (Worst Case)

**Pattern:**
- Listeners accumulate BEFORE reset (test isolation bug)
- Listeners remain AFTER reset (implementation bug)

**Fix:** Apply both fixes above.

## Adding Diagnostics to New Test Files

```javascript
const { resetAllServices, logTestFileEntry, logTestFileExit } = require('../helpers/service-reset');

describe('My Test Suite', () => {
  beforeAll(async () => {
    logTestFileEntry('my-test.test.js');  // Track test file entry
    // ... setup
  });

  afterAll(async () => {
    // ... cleanup
    logTestFileExit('my-test.test.js');   // Track test file exit
  });

  beforeEach(async () => {
    await resetAllServices();  // Automatic leak detection
  });
});
```

## Diagnostic Files

- **Helper:** `backend/tests/helpers/service-reset.js` - Leak detection implementation
- **Integration:** Applied to flaky test files:
  - `admin-interventions.test.js`
  - `multi-client-broadcasts.test.js`

## Expected Next Steps

1. **Run diagnostics:** `LISTENER_DIAGNOSTICS=true npm run test:integration`
2. **Identify pattern:** Implementation bug vs test isolation bug
3. **Apply fix:** Update service `reset()` methods or add test cleanup
4. **Verify:** Re-run tests, confirm leak eliminated
5. **Document:** Update findings in `FLAKY_TEST_ANALYSIS.md`

## Hybrid Fix Implementation

**As of 2025-10-31**, this system uses a defense-in-depth approach:

### Layer 1: Idempotency (Defensive)

`setupBroadcastListeners()` has an idempotency guard that prevents duplicate
registration if called multiple times without cleanup:

```javascript
if (broadcastListenersActive) {
  logger.debug('Broadcast listeners already active, skipping');
  return;
}
```

**Benefit:** Makes infrastructure resilient to misuse.

### Layer 2: Test Helper (Abstraction)

`resetAllServicesForTesting()` encapsulates the correct cleanup → reset → setup
cycle in a single function call:

```javascript
await resetAllServicesForTesting(testContext.io, {
  sessionService,
  transactionService,
  stateService,
  videoQueueService,
  offlineQueueService
});
```

**Benefit:** Clearer test code, harder to misuse, self-documenting.

### Expected Diagnostic Output

With hybrid fix in place:

```
🔄 Starting resetAllServicesForTesting cycle...
  ✓ Broadcast listeners cleaned up

📊 Listener counts BEFORE reset:
  sessionService: 2 total  (only untracked service coordination listeners)

📊 Listener counts AFTER reset:
  sessionService: 2 total ✓  (expected - coordination listeners persist)

  ✓ Service state reset
  ✓ Broadcast listeners re-registered
✅ resetAllServicesForTesting cycle complete

✅ All listeners cleaned up successfully
```

**Key indicators:**
- No "LISTENER LEAK DETECTED" warnings
- Listener counts stable across test runs
- No accumulation over time

## Related Documentation

- `backend/tests/FLAKY_TEST_ANALYSIS.md` - Timing anti-patterns analysis
- `backend/tests/ISOLATION_ISSUES.md` - Test isolation hypothesis
- `backend/tests/LISTENER_LEAK_FINDINGS.md` - Listener leak investigation results
- Testing Anti-Patterns Skill: `/home/maxepunk/.claude/plugins/cache/superpowers/skills/testing-anti-patterns/SKILL.md`
