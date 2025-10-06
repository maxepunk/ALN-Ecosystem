# Test Improvement Plan - Quick Start Guide
## Day 1 Implementation Example

This guide shows you exactly how to execute Day 1 of the TEST-IMPROVEMENT-PLAN.md using the TDD approach.

---

## Step-by-Step: Writing Your First Failing Test

### 1. Create the Test File

```bash
cd /home/spide/projects/AboutLastNight/ALN-Ecosystem/backend
mkdir -p tests/integration/scanner
touch tests/integration/scanner/app-transaction-flow.test.js
```

### 2. Write the First Failing Test

**File:** `tests/integration/scanner/app-transaction-flow.test.js`

```javascript
/**
 * App - Transaction Flow Integration Tests
 * Phase 1, Day 1: Critical Path Coverage
 *
 * OBJECTIVE: Test the main application orchestration from NFC read to submission
 * EXPECTED: Will reveal 4-6 bugs in app.js
 */

// Load browser mocks FIRST
require('../../helpers/browser-mocks');

const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const { createAuthenticatedScanner, waitForEvent } = require('../../helpers/websocket-helpers');
const sessionService = require('../../../src/services/sessionService');

describe('App - Transaction Flow Integration [Phase 1.1]', () => {
  let testContext, scanner;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await sessionService.createSession({
      name: 'App Flow Test',
      teams: ['001', '002']
    });

    scanner = await createAuthenticatedScanner(testContext.url, 'GM_APP_TEST', 'blackmarket');
  });

  afterEach(() => {
    if (scanner?.socket?.connected) scanner.socket.disconnect();
  });

  describe('TEST 1: Full Transaction Orchestration', () => {
    it('should orchestrate full transaction from NFC read to submission', async () => {
      // SETUP: Spy on internal methods to verify orchestration order
      const findTokenSpy = jest.spyOn(global.TokenManager, 'findToken');
      const queueSpy = jest.spyOn(scanner.queueManager, 'queueTransaction');

      // Set team
      scanner.App.currentTeamId = '001';

      // ACT: Trigger NFC read (production entry point)
      scanner.App.processNFCRead({ id: '534e2b03' });

      // Wait for transaction result from server
      const result = await waitForEvent(scanner.socket, 'transaction:result');

      // ASSERT: Verify orchestration happened
      expect(findTokenSpy).toHaveBeenCalledWith('534e2b03');
      expect(queueSpy).toHaveBeenCalled();

      const submittedTransaction = queueSpy.mock.calls[0][0];

      // ASSERT: Transaction has all required fields (AsyncAPI contract)
      expect(submittedTransaction).toMatchObject({
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_APP_TEST',
        mode: 'blackmarket'
      });

      // ASSERT: Timestamp is ISO 8601 format
      expect(submittedTransaction.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // ASSERT: Server accepted the transaction
      expect(result.data.status).toBe('accepted');
    });
  });
});
```

### 3. Run the Test (Expect Failure)

```bash
npm test -- tests/integration/scanner/app-transaction-flow.test.js
```

**Expected Output:**
```
FAIL tests/integration/scanner/app-transaction-flow.test.js
  App - Transaction Flow Integration [Phase 1.1]
    TEST 1: Full Transaction Orchestration
      ✕ should orchestrate full transaction from NFC read to submission (45ms)

  ● TEST 1 › should orchestrate full transaction from NFC read to submission

    TypeError: Cannot read property 'timestamp' of undefined

      at Object.<anonymous> (tests/integration/scanner/app-transaction-flow.test.js:52:50)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
```

### 4. Document the Bug

**File:** `BUG-LOG.md` *(create if doesn't exist)*

```markdown
# Bug Discovery Log - Phase 1

## Bug #001

**Found By:** `app-transaction-flow.test.js:52`
**Severity:** HIGH
**Module:** `ALNScanner/js/app/app.js`
**Date:** 2025-10-06

### What Broke
Transaction submitted to queueManager is missing the `timestamp` field.

### Root Cause
`App.recordTransaction()` constructs the transaction object but doesn't add a timestamp.

### Expected Behavior
Per AsyncAPI contract, all events must include an ISO 8601 timestamp:
```json
{
  "tokenId": "534e2b03",
  "teamId": "001",
  "deviceId": "GM_APP_TEST",
  "mode": "blackmarket",
  "timestamp": "2025-10-06T12:00:00.000Z"  // ← MISSING
}
```

### Actual Behavior
Transaction object is missing timestamp field entirely, causing contract violation.

### Fix Applied
Added timestamp generation in `App.recordTransaction()` before calling `queueManager.queueTransaction()`.

### Code Change
```javascript
// BEFORE
this.queueManager.queueTransaction({
  tokenId: rfid,
  teamId: this.currentTeamId,
  deviceId: Settings.deviceId,
  mode: Settings.stationMode
});

// AFTER
this.queueManager.queueTransaction({
  tokenId: rfid,
  teamId: this.currentTeamId,
  deviceId: Settings.deviceId,
  mode: Settings.stationMode,
  timestamp: new Date().toISOString()  // ← ADDED
});
```

### Test Coverage
- [x] Integration test added
- [ ] Unit test added (pending Phase 5)
- [ ] Error path tested (N/A)

### Commit
`fix(scanner): Add timestamp to transaction objects per AsyncAPI contract`

---
```

### 5. Fix the Implementation

**File:** `ALNScanner/js/app/app.js`

Find the `recordTransaction` method and add the timestamp:

```javascript
recordTransaction(token, rfid, isUnknown) {
  // ... existing code ...

  // Submit to queue
  this.queueManager.queueTransaction({
    tokenId: rfid,
    teamId: this.currentTeamId,
    deviceId: Settings.deviceId,
    mode: Settings.stationMode,
    timestamp: new Date().toISOString()  // ← ADD THIS LINE
  });
}
```

### 6. Run the Test Again (Expect Pass)

```bash
npm test -- tests/integration/scanner/app-transaction-flow.test.js
```

**Expected Output:**
```
PASS tests/integration/scanner/app-transaction-flow.test.js
  App - Transaction Flow Integration [Phase 1.1]
    TEST 1: Full Transaction Orchestration
      ✓ should orchestrate full transaction from NFC read to submission (38ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

### 7. Run Full Test Suite (Check for Regressions)

```bash
npm test
```

Verify that your fix didn't break any existing tests.

### 8. Commit the Fix

```bash
cd /home/spide/projects/AboutLastNight/ALN-Ecosystem

# Stage the fix
git add ALNScanner/js/app/app.js

# Commit with descriptive message
git commit -m "fix(scanner): Add timestamp to transaction objects per AsyncAPI contract

- Transaction objects now include ISO 8601 timestamp
- Fixes AsyncAPI contract compliance for transaction:submit events
- Resolves Bug #001 discovered by app-transaction-flow.test.js

Ref: TEST-IMPROVEMENT-PLAN.md Phase 1.1"

# Stage the test
git add backend/tests/integration/scanner/app-transaction-flow.test.js

# Commit the test
git commit -m "test(scanner): Add app.js transaction flow integration test

- Tests full orchestration from NFC read to submission
- Verifies AsyncAPI contract compliance
- Part of Phase 1.1: Critical Path Coverage

Ref: TEST-IMPROVEMENT-PLAN.md"

# Stage bug log
git add backend/BUG-LOG.md

# Commit bug documentation
git commit -m "docs: Document Bug #001 - Missing transaction timestamp"
```

---

## Continuing with More Tests

### 9. Add the Next Test (TEST 2: Unknown Token)

In the same file, add:

```javascript
describe('TEST 2: Unknown Token Handling', () => {
  it('should handle unknown token gracefully without crashing', () => {
    // Mock TokenManager to return null (token not found)
    jest.spyOn(global.TokenManager, 'findToken').mockReturnValueOnce(null);

    scanner.App.currentTeamId = '001';

    // ACT: Try to scan unknown token
    // EXPECTED BUG: Will likely crash with "Cannot read property 'SF_ValueRating' of null"
    expect(() => {
      scanner.App.processNFCRead({ id: 'UNKNOWN_FAKE_TOKEN' });
    }).not.toThrow();

    // VERIFY: User should see error message
    // (Requires UIManager mock to verify this)
  });
});
```

### 10. Run Test, Document Bug, Fix, Repeat

```bash
npm test -- tests/integration/scanner/app-transaction-flow.test.js

# Test will fail → Document Bug #002
# Fix app.js → Add null check after findToken()
# Re-run test → Verify pass
# Commit fix
```

---

## Tips for Successful TDD Implementation

### ✅ DO:
- Write the test FIRST before looking at implementation
- Run the test and verify it FAILS for the right reason
- Make the SMALLEST fix possible to make the test pass
- Document every bug you find
- Commit fixes individually (one bug = one commit)
- Run full suite after each fix

### ❌ DON'T:
- Fix bugs without writing the test first
- Write multiple tests before running any
- Make "while I'm here" fixes outside test scope
- Skip bug documentation
- Commit multiple fixes in one commit
- Assume tests pass without running them

---

## Progress Tracking Template

Copy this to a daily standup doc:

```markdown
# Test Improvement - Day 1 Progress

## Tests Written: 2 / 6
- [x] TEST 1: Full transaction orchestration
- [x] TEST 2: Unknown token handling
- [ ] TEST 3: Duplicate detection
- [ ] TEST 4: No team selected
- [ ] TEST 5: Offline queue fallback
- [ ] TEST 6: Transaction data completeness

## Bugs Found: 2
- [x] Bug #001: Missing timestamp (FIXED)
- [x] Bug #002: No null check for unknown tokens (FIXED)

## Time Spent: 2 hours

## Blockers: None

## Next Steps:
- Write TEST 3 (duplicate detection)
- Expect to find duplicate bypass bug
```

---

## Expected Timeline for Day 1

| Time | Activity | Output |
|------|----------|--------|
| 30 min | Setup + Write TEST 1 | Failing test |
| 15 min | Document Bug #001 | BUG-LOG.md entry |
| 15 min | Fix Bug #001 | Passing test |
| 30 min | Write TEST 2 | Failing test |
| 15 min | Document Bug #002 | BUG-LOG.md entry |
| 15 min | Fix Bug #002 | Passing test |
| **2 hrs** | **Break / Code Review** | **2 bugs fixed** |
| 30 min | Write TEST 3 | Failing test |
| 15 min | Document Bug #003 | BUG-LOG.md entry |
| 15 min | Fix Bug #003 | Passing test |
| 30 min | Write TESTS 4-6 | 3 failing tests |
| 45 min | Fix remaining bugs | All tests passing |
| 30 min | Final suite run + commits | Clean state |
| **6 hrs** | **Total Day 1** | **6 tests, ~5 bugs fixed** |

---

## Troubleshooting Common Issues

### "Test hangs forever"
- Check for missing `await` on waitForEvent()
- Verify WebSocket connection is established
- Add timeout to test: `jest.setTimeout(10000)`

### "Cannot spy on method"
- Module not exported correctly
- Use `global.TokenManager` for scanner globals
- Check browser-mocks.js has mocked the object

### "Test passes but shouldn't"
- Verify you're testing the RIGHT thing
- Add more specific assertions
- Check test isn't just checking "doesn't crash"

### "Full suite breaks after fix"
- Your fix had side effects
- Review what changed
- Check if mock cleanup needed in afterEach

---

## Ready to Start?

1. Read TEST-IMPROVEMENT-PLAN.md (full plan)
2. Follow this Quick Start for Day 1
3. Document bugs as you find them
4. Commit frequently
5. Ask for code review after each day
6. Update progress daily

**Let's find and fix those bugs!** 🐛🔨

---

*Questions? Issues? Update this guide as you discover better practices.*
