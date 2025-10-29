# Unit Test Anti-Pattern Audit & Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate anti-patterns from unit test suite, fix 2 failing tests, add 3 missing service test files

**Architecture:** Fix production code bugs revealed by tests, update tests to match evolved singleton architecture, add missing test coverage for persistenceService, discoveryService, vlcService

**Tech Stack:** Jest, Node.js EventEmitter, fs/promises, dgram (UDP), axios mocking

**Anti-Pattern Focus:** #2 (test-only methods), #4 (incomplete mocks), #5 (tests as afterthought)

---

## Task 1: Fix Failing Tests - connection-manager.test.js

**Files:**
- Read: `backend/tests/unit/scanner/connection-manager.test.js:924-941`
- Modify: `ALNScanner/js/network/connection-manager.js` (find stationMode getter)

**Step 1: Read test expectations**

Read test file to understand expected behavior:
```bash
backend/tests/unit/scanner/connection-manager.test.js (lines 924-941)
```

Expected behavior:
- `connectionManager.stationMode` should default to `'detective'` when not in localStorage
- Setting `connectionManager.stationMode = 'blackmarket'` should persist to localStorage

**Step 2: Read production implementation**

Read: `ALNScanner/js/network/connection-manager.js`

Find the `stationMode` getter/setter. Look for:
```javascript
get stationMode() {
  return localStorage.getItem('stationMode');
}
```

**Step 3: Add default value to getter**

Modify the `stationMode` getter to return `'detective'` when not stored:

```javascript
get stationMode() {
  return localStorage.getItem('stationMode') || 'detective';
}
```

**Step 4: Run test to verify fix**

Run: `cd backend && npm run test:unit -- connection-manager.test.js`

Expected output:
```
✓ should default to detective mode when not stored
✓ should persist station mode to localStorage
```

**Step 5: Commit**

```bash
git add ALNScanner/js/network/connection-manager.js
git commit -m "fix(scanner): default stationMode to 'detective' when not stored

- Fixes 2 failing tests in connection-manager.test.js
- stationMode getter now returns 'detective' as default
- Anti-pattern audit task 1 complete"
```

---

## Task 2: Update dataManager.test.js to Match Singleton Architecture

**Files:**
- Read: `ALNScanner/js/core/dataManager.js` (production implementation)
- Read: `backend/tests/unit/scanner/dataManager.test.js` (current test)
- Modify: `backend/tests/unit/scanner/dataManager.test.js:18-42`

**Step 1: Read production architecture**

Read: `ALNScanner/js/core/dataManager.js`

Document:
- Is it a singleton module or class?
- What is the initialization pattern?
- What methods are exported?
- Does it have a reset() method?

**Step 2: Read current test file**

Read: `backend/tests/unit/scanner/dataManager.test.js`

Identify:
- How many test cases exist?
- What is the current (incorrect) initialization pattern?
- Which tests are valuable vs implementation-specific?

**Step 3: Rewrite test initialization**

Replace class-based initialization with singleton pattern:

```javascript
// OLD (lines 18-42):
beforeEach(() => {
  mockTokenManager = {
    findToken: jest.fn(),
    getGroupInventory: jest.fn()
  };

  mockSettings = {
    deviceId: 'TEST_SCANNER',
    stationMode: 'blackmarket'
  };

  dataManager = new DataManager({
    tokenManager: mockTokenManager,
    settings: mockSettings
  });
});

// NEW:
const dataManager = require('../../../../ALNScanner/js/core/dataManager');

beforeEach(() => {
  mockTokenManager = {
    findToken: jest.fn(),
    getGroupInventory: jest.fn()
  };

  mockSettings = {
    deviceId: 'TEST_SCANNER',
    stationMode: 'blackmarket'
  };

  // Reset module state if method exists
  if (dataManager.reset) {
    dataManager.reset();
  }

  // Initialize dependencies (if module supports it)
  // Adjust based on actual production API discovered in Step 1
  if (dataManager.initialize) {
    dataManager.initialize({
      tokenManager: mockTokenManager,
      settings: mockSettings
    });
  }
});
```

**Step 4: Update test cases to use module API**

Review each test case and ensure it uses the singleton module API instead of class methods. No code provided here - adjust based on actual API from Step 1.

**Step 5: Run tests**

Run: `cd backend && npm run test:unit -- dataManager.test.js`

Expected: All tests pass

If tests fail, debug by:
1. Checking production API matches test expectations
2. Verifying mock structure is complete
3. Ensuring reset() properly clears state between tests

**Step 6: Commit**

```bash
git add backend/tests/unit/scanner/dataManager.test.js
git commit -m "test(scanner): update dataManager tests to match singleton architecture

- Replace class instantiation with module initialization
- Use singleton pattern matching current production code
- Anti-pattern #4 (incomplete mocks) fixed"
```

---

## Task 3: Add persistenceService.test.js (CRITICAL - Data Integrity)

**Files:**
- Create: `backend/tests/unit/services/persistenceService.test.js`
- Read: `backend/src/services/persistenceService.js`

**Step 1: Read production implementation**

Read: `backend/src/services/persistenceService.js`

Document:
- All exported methods and their signatures
- File path patterns used
- Error handling approach
- Return values (paths, null, booleans)

**Step 2: Write test file structure**

Create: `backend/tests/unit/services/persistenceService.test.js`

```javascript
const persistenceService = require('../../../src/services/persistenceService');
const fs = require('fs').promises;
const path = require('path');

describe('PersistenceService', () => {
  const testDataDir = path.join(__dirname, '../../fixtures/test-persistence');
  const testSessionId = 'test-session-123';

  beforeEach(async () => {
    // Create clean test directory
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test files
    await fs.rm(testDataDir, { recursive: true, force: true });
  });

  // Tests will go here
});
```

**Step 3: Write test for saveSessionToFile (happy path)**

Add test case:

```javascript
describe('saveSessionToFile', () => {
  it('should persist session data as JSON', async () => {
    // ARRANGE
    const sessionData = {
      id: testSessionId,
      teamScores: { '001': 100, '002': 50 },
      status: 'active',
      startTime: Date.now()
    };

    // ACT
    const filePath = await persistenceService.saveSessionToFile(sessionData);

    // ASSERT
    expect(filePath).toBeTruthy();

    // Verify file exists and content is correct
    const fileContent = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(fileContent);
    expect(parsed.id).toBe(testSessionId);
    expect(parsed.teamScores['001']).toBe(100);
    expect(parsed.status).toBe('active');
  });
});
```

**Step 4: Run test to verify it fails or passes**

Run: `cd backend && npm run test:unit -- persistenceService.test.js`

Expected: Either passes (production code works) or fails (reveals bug)

**Step 5: Write test for directory creation**

Add test case:

```javascript
it('should create data directory if missing', async () => {
  // ARRANGE - Remove directory
  await fs.rm(testDataDir, { recursive: true, force: true });

  const sessionData = { id: testSessionId };

  // ACT
  const filePath = await persistenceService.saveSessionToFile(sessionData);

  // ASSERT - Verify directory was created
  const dirExists = await fs.access(path.dirname(filePath))
    .then(() => true)
    .catch(() => false);
  expect(dirExists).toBe(true);
});
```

**Step 6: Run tests**

Run: `cd backend && npm run test:unit -- persistenceService.test.js`

Expected: 2 tests pass

**Step 7: Write test for loadSessionFromFile (happy path)**

Add test case:

```javascript
describe('loadSessionFromFile', () => {
  it('should load existing session file', async () => {
    // ARRANGE - Create test file
    const sessionData = {
      id: testSessionId,
      teamScores: { '001': 200 }
    };
    await persistenceService.saveSessionToFile(sessionData);

    // ACT
    const loaded = await persistenceService.loadSessionFromFile(testSessionId);

    // ASSERT
    expect(loaded).toBeTruthy();
    expect(loaded.id).toBe(testSessionId);
    expect(loaded.teamScores['001']).toBe(200);
  });
});
```

**Step 8: Run tests**

Run: `cd backend && npm run test:unit -- persistenceService.test.js`

Expected: 3 tests pass

**Step 9: Write test for missing file**

Add test case:

```javascript
it('should return null for missing file', async () => {
  // ACT
  const loaded = await persistenceService.loadSessionFromFile('nonexistent-id');

  // ASSERT
  expect(loaded).toBeNull();
});
```

**Step 10: Run tests**

Run: `cd backend && npm run test:unit -- persistenceService.test.js`

Expected: 4 tests pass

**Step 11: Write test for corrupted JSON**

Add test case:

```javascript
it('should handle corrupted JSON gracefully', async () => {
  // ARRANGE - Write corrupted file
  const corruptedPath = path.join(testDataDir, `session-corrupted.json`);
  await fs.writeFile(corruptedPath, '{ invalid json without closing', 'utf8');

  // ACT
  const loaded = await persistenceService.loadSessionFromFile('corrupted');

  // ASSERT - Should not throw, return null
  expect(loaded).toBeNull();
});
```

**Step 12: Run tests**

Run: `cd backend && npm run test:unit -- persistenceService.test.js`

Expected: 5 tests pass (or reveals bug if error handling missing)

**Step 13: Write tests for ensureDataDirectory**

Add test cases:

```javascript
describe('ensureDataDirectory', () => {
  it('should create directory if missing', async () => {
    // ARRANGE
    const testPath = path.join(testDataDir, 'subdir');

    // ACT
    await persistenceService.ensureDataDirectory(testPath);

    // ASSERT
    const exists = await fs.access(testPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it('should not error if directory exists', async () => {
    // ARRANGE
    await fs.mkdir(testDataDir, { recursive: true });

    // ACT & ASSERT
    await expect(persistenceService.ensureDataDirectory(testDataDir))
      .resolves.not.toThrow();
  });
});
```

**Step 14: Run all tests**

Run: `cd backend && npm run test:unit -- persistenceService.test.js`

Expected: 7 tests pass

**Step 15: Commit**

```bash
git add backend/tests/unit/services/persistenceService.test.js
git commit -m "test(services): add persistenceService unit tests

- 7 test cases covering save, load, error handling
- Tests directory creation, missing files, corrupted JSON
- Anti-pattern #5 (tests as afterthought) - critical gap closed"
```

---

## Task 4: Add discoveryService.test.js

**Files:**
- Create: `backend/tests/unit/services/discoveryService.test.js`
- Read: `backend/src/services/discoveryService.js`

**Step 1: Read production implementation**

Read: `backend/src/services/discoveryService.js`

Document:
- API methods (startBroadcast, stopBroadcast, etc.)
- Event names emitted
- Port configuration (should be 8888)
- UDP socket handling

**Step 2: Write test file structure**

Create: `backend/tests/unit/services/discoveryService.test.js`

```javascript
const discoveryService = require('../../../src/services/discoveryService');
const dgram = require('dgram');
const EventEmitter = require('events');

describe('DiscoveryService', () => {
  beforeEach(() => {
    // Reset service state if method exists
    if (discoveryService.reset) {
      discoveryService.reset();
    }
  });

  afterEach(() => {
    // Cleanup
    if (discoveryService.stopBroadcast) {
      discoveryService.stopBroadcast();
    }
  });

  // Tests will go here
});
```

**Step 3: Write test for startBroadcast initialization**

Add test case:

```javascript
describe('startBroadcast', () => {
  it('should initialize UDP broadcast on port 8888', (done) => {
    // ACT
    discoveryService.once('discovery:started', ({ port }) => {
      // ASSERT
      expect(port).toBe(8888);
      done();
    });

    discoveryService.startBroadcast();
  });
});
```

**Step 4: Run test**

Run: `cd backend && npm run test:unit -- discoveryService.test.js`

Expected: Pass or reveals actual event name/API

**Step 5: Write test for broadcast events**

Add test case:

```javascript
it('should emit broadcast events', (done) => {
  // ACT
  discoveryService.once('discovery:broadcast:sent', (data) => {
    // ASSERT
    expect(data).toBeTruthy();
    expect(data.port).toBe(3000); // Orchestrator port
    done();
  });

  discoveryService.startBroadcast();
});
```

**Step 6: Run test**

Run: `cd backend && npm run test:unit -- discoveryService.test.js`

Expected: 2 tests pass

**Step 7: Write test for stopBroadcast**

Add test cases:

```javascript
describe('stopBroadcast', () => {
  it('should close UDP socket', (done) => {
    // ARRANGE
    discoveryService.startBroadcast();

    // ACT
    discoveryService.once('discovery:stopped', () => {
      // ASSERT
      done();
    });

    discoveryService.stopBroadcast();
  });

  it('should not error if already stopped', () => {
    // ACT & ASSERT
    expect(() => discoveryService.stopBroadcast()).not.toThrow();
  });
});
```

**Step 8: Run tests**

Run: `cd backend && npm run test:unit -- discoveryService.test.js`

Expected: 4 tests pass

**Step 9: Write test for broadcast message structure**

Add test case:

```javascript
describe('getBroadcastMessage', () => {
  it('should include orchestrator IP and port', () => {
    // ACT
    const message = discoveryService.getBroadcastMessage();

    // ASSERT
    expect(message).toBeTruthy();
    expect(message).toHaveProperty('type', 'orchestrator');
    expect(message).toHaveProperty('port', 3000);
  });
});
```

**Step 10: Run all tests**

Run: `cd backend && npm run test:unit -- discoveryService.test.js`

Expected: 5 tests pass

**Step 11: Commit**

```bash
git add backend/tests/unit/services/discoveryService.test.js
git commit -m "test(services): add discoveryService unit tests

- 5 test cases covering UDP broadcast lifecycle
- Tests startBroadcast, stopBroadcast, message structure
- Anti-pattern #5 (tests as afterthought) - network discovery covered"
```

---

## Task 5: Add vlcService.test.js

**Files:**
- Create: `backend/tests/unit/services/vlcService.test.js`
- Read: `backend/src/services/vlcService.js`

**Step 1: Read production implementation**

Read: `backend/src/services/vlcService.js`

Document:
- API methods (connect, play, stop, getStatus)
- VLC HTTP endpoints used
- Authentication pattern
- Event names emitted

**Step 2: Write test file structure with axios mocking**

Create: `backend/tests/unit/services/vlcService.test.js`

```javascript
const vlcService = require('../../../src/services/vlcService');
const axios = require('axios');

// Mock axios HTTP calls
jest.mock('axios');

describe('VLCService', () => {
  beforeEach(() => {
    if (vlcService.reset) {
      vlcService.reset();
    }
    jest.clearAllMocks();
  });

  // Tests will go here
});
```

**Step 3: Write test for connect (happy path)**

Add test case:

```javascript
describe('connect', () => {
  it('should connect to VLC HTTP interface', async () => {
    // ARRANGE
    axios.get.mockResolvedValue({
      status: 200,
      data: { version: '3.0.0' }
    });

    // ACT
    const result = await vlcService.connect({
      host: 'localhost',
      port: 8080,
      password: 'vlc'
    });

    // ASSERT
    expect(result).toBe(true);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('localhost:8080'),
      expect.objectContaining({
        auth: expect.anything()
      })
    );
  });
});
```

**Step 4: Run test**

Run: `cd backend && npm run test:unit -- vlcService.test.js`

Expected: Pass or reveals actual API signature

**Step 5: Write test for connection failure**

Add test case:

```javascript
it('should handle connection failure', async () => {
  // ARRANGE
  axios.get.mockRejectedValue(new Error('Connection refused'));

  // ACT
  const result = await vlcService.connect({
    host: 'localhost',
    port: 8080,
    password: 'vlc'
  });

  // ASSERT
  expect(result).toBe(false);
});
```

**Step 6: Run tests**

Run: `cd backend && npm run test:unit -- vlcService.test.js`

Expected: 2 tests pass

**Step 7: Write tests for play command**

Add test cases:

```javascript
describe('play', () => {
  it('should send play command with file path', async () => {
    // ARRANGE
    axios.get.mockResolvedValue({ status: 200 });

    // ACT
    await vlcService.play('/path/to/video.mp4');

    // ASSERT
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('command=in_play'),
      expect.anything()
    );
  });

  it('should emit video:started event', (done) => {
    // ARRANGE
    axios.get.mockResolvedValue({ status: 200 });

    // ACT
    vlcService.once('video:started', (data) => {
      // ASSERT
      expect(data.file).toBe('test.mp4');
      done();
    });

    vlcService.play('test.mp4');
  });
});
```

**Step 8: Run tests**

Run: `cd backend && npm run test:unit -- vlcService.test.js`

Expected: 4 tests pass

**Step 9: Write test for stop command**

Add test case:

```javascript
describe('stop', () => {
  it('should send stop command', async () => {
    // ARRANGE
    axios.get.mockResolvedValue({ status: 200 });

    // ACT
    await vlcService.stop();

    // ASSERT
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('command=pl_stop'),
      expect.anything()
    );
  });
});
```

**Step 10: Run tests**

Run: `cd backend && npm run test:unit -- vlcService.test.js`

Expected: 5 tests pass

**Step 11: Write tests for getStatus**

Add test cases:

```javascript
describe('getStatus', () => {
  it('should parse VLC status response', async () => {
    // ARRANGE
    axios.get.mockResolvedValue({
      status: 200,
      data: {
        state: 'playing',
        position: 0.5,
        length: 120
      }
    });

    // ACT
    const status = await vlcService.getStatus();

    // ASSERT
    expect(status.state).toBe('playing');
    expect(status.position).toBe(0.5);
    expect(status.length).toBe(120);
  });

  it('should return null on error', async () => {
    // ARRANGE
    axios.get.mockRejectedValue(new Error('Timeout'));

    // ACT
    const status = await vlcService.getStatus();

    // ASSERT
    expect(status).toBeNull();
  });
});
```

**Step 12: Run all tests**

Run: `cd backend && npm run test:unit -- vlcService.test.js`

Expected: 7 tests pass

**Step 13: Commit**

```bash
git add backend/tests/unit/services/vlcService.test.js
git commit -m "test(services): add vlcService unit tests

- 7 test cases covering VLC HTTP interface
- Tests connect, play, stop, getStatus with axios mocking
- Anti-pattern #5 (tests as afterthought) - all services now tested"
```

---

## Task 6: Address Anti-Pattern #2 - Test-Only Methods [REQUIRES APPROVAL]

**Files:**
- Review: `backend/src/services/sessionService.js:448`
- Review: `backend/src/services/transactionService.js:729`
- Review: `backend/src/services/videoQueueService.js:791`
- Potentially modify: All 3 service files + 17 test files

**Step 1: Present options to user**

**STOP HERE - User decision required**

Present 3 options:

**OPTION A: Conditional Export (Minimal Change)**
```javascript
// Only export reset() in test environment
if (process.env.NODE_ENV === 'test') {
  module.exports.reset = reset;
}
// Remove: module.exports.resetForTests = ...
```
- **Pros:** Zero production overhead, minimal code change
- **Cons:** Still exposes method in test builds
- **Effort:** 10 minutes (3 service files)

**OPTION B: Test Helper Utility (Clean Separation)**
```javascript
// NEW FILE: backend/tests/helpers/service-reset.js
const sessionService = require('../../src/services/sessionService');
// ... import other services

module.exports = {
  async resetAllServices() {
    // Call internal methods here
  }
};

// Tests use:
const { resetAllServices } = require('../helpers/service-reset');
beforeEach(() => resetAllServices());
```
- **Pros:** Complete separation, production unaware of tests
- **Cons:** Requires updating 17 test files
- **Effort:** 2-4 hours

**OPTION C: Keep Current Pattern (Document as Acceptable)**
```javascript
/**
 * @internal Test-only method for state cleanup
 * Used in test suite to reset singleton state between tests
 */
module.exports.resetForTests = () => module.exports.reset();
```
- **Pros:** Zero effort, common Node.js pattern
- **Cons:** Design smell remains
- **Effort:** 5 minutes (just add JSDoc)

**Ask user:** "Which option do you prefer? A, B, or C?"

**Step 2: Wait for user response**

**STOP - Do not proceed until user chooses**

**Step 3: Implement chosen option**

If Option A chosen:
- Remove `resetForTests` exports from 3 services
- Add conditional `reset` export in test environment
- Test files call `.reset()` directly

If Option B chosen:
- Create `backend/tests/helpers/service-reset.js`
- Remove `resetForTests` from 3 services
- Update all 17 test files to use helper

If Option C chosen:
- Add JSDoc comments to 3 service files
- No test file changes needed

**Step 4: Run full test suite**

Run: `cd backend && npm run test:unit`

Expected: All tests still pass

**Step 5: Commit**

```bash
git add <affected files>
git commit -m "refactor(tests): address anti-pattern #2 - test-only methods

- [Option A/B/C] implemented
- Production code [no longer exports|documents] test helpers
- All tests still pass"
```

---

## Task 7: Run Full Test Suite & Generate Report

**Files:**
- None (verification only)

**Step 1: Run complete unit test suite**

Run: `cd backend && npm run test:unit`

Expected output:
```
Test Suites: X passed, X total
Tests:       Y passed, Y total
```

Verify:
- All previously passing tests still pass
- 2 connection-manager tests now pass
- 3 new service test files run (persistenceService, discoveryService, vlcService)
- Total tests increased from 57 to ~79+

**Step 2: Generate coverage report**

Run: `cd backend && npm run test:coverage`

Expected improvements:
- Service coverage: 66.7% → 100% (all 9 services tested)
- Overall line coverage increase

**Step 3: Document results**

Copy test output showing:
- Total test count
- Pass rate (should be 100%)
- Coverage improvements

---

## Task 8: Create Documentation

**Files:**
- Create: `backend/tests/UNIT_TEST_ANTI_PATTERNS.md`

**Step 1: Write documentation file**

Create: `backend/tests/UNIT_TEST_ANTI_PATTERNS.md`

```markdown
# Unit Test Anti-Pattern Audit Results

**Audit Date:** 2025-10-29
**Auditor:** Claude Code
**Skill Used:** superpowers:testing-anti-patterns

## Summary

| Anti-Pattern | Status | Severity | Resolution |
|--------------|--------|----------|------------|
| #1: Testing Mock Behavior | ✅ Clean | N/A | No violations found |
| #2: Test-Only Methods | ✅ Addressed | Medium | [Option A/B/C implemented] |
| #3: Mocking Without Understanding | ✅ Clean | N/A | No violations found |
| #4: Incomplete Mocks | ✅ Fixed | Low | dataManager.test.js updated |
| #5: Tests as Afterthought | ✅ Fixed | High | 3 service tests added |

## Test Suite Metrics

**Before Audit:**
- Total unit tests: 57
- Passing: 55 (96.5%)
- Failing: 2
- Service coverage: 66.7% (6/9 services)

**After Audit:**
- Total unit tests: 79+
- Passing: 79+ (100%)
- Failing: 0
- Service coverage: 100% (9/9 services)

## Findings Detail

### Anti-Pattern #2: Test-Only Methods
**Location:** sessionService.js, transactionService.js, videoQueueService.js
**Issue:** Production code exports `resetForTests()` wrappers
**Resolution:** [Describe chosen option here]
**Files Changed:** [List files based on option chosen]

### Anti-Pattern #4: Incomplete Mocks
**Location:** dataManager.test.js
**Issue:** Test expected class architecture, production uses singleton
**Resolution:** Updated test initialization to match singleton pattern
**Files Changed:** backend/tests/unit/scanner/dataManager.test.js

### Anti-Pattern #5: Tests as Afterthought
**Missing Tests:** persistenceService, discoveryService, vlcService
**Resolution:** Added 19 new unit tests covering all 3 services
**Files Added:**
- backend/tests/unit/services/persistenceService.test.js (7 tests)
- backend/tests/unit/services/discoveryService.test.js (5 tests)
- backend/tests/unit/services/vlcService.test.js (7 tests)

### Production Bugs Found
**Bug #1:** connection-manager stationMode missing default
**Location:** ALNScanner/js/network/connection-manager.js
**Fix:** Added `|| 'detective'` default in getter
**Impact:** 2 tests were failing, now pass

## Prevention Guidelines

### The Iron Laws
1. **NEVER test mock behavior** - Test what the code does, not what mocks do
2. **NEVER add test-only methods to production** - Use test utilities instead
3. **NEVER mock without understanding** - Know what you're isolating and why

### Best Practices
- ✅ Use real service instances for integration testing
- ✅ Mock only external boundaries (network, filesystem, DOM)
- ✅ Test behavior, not implementation details
- ✅ Write tests BEFORE implementing features (TDD)
- ✅ Verify mock calls with assertions

### Test Organization
- Unit tests: `tests/unit/` - Fast, isolated, no external dependencies
- Integration tests: `tests/integration/` - Multiple components
- E2E tests: `tests/e2e/` - Full system, browser automation
- Contract tests: `tests/contract/` - API/WebSocket validation

### Running Tests
\`\`\`bash
npm run test:unit          # Unit tests only (~79 tests)
npm run test:coverage      # With coverage report
npm test                   # All test types (~722 tests)
\`\`\`

## References
- Superpowers Skill: `superpowers:testing-anti-patterns`
- CLAUDE.md: Project testing guidelines
- Implementation Plan: `docs/plans/2025-10-29-unit-test-anti-pattern-audit.md`
```

**Step 2: Update [Option chosen] placeholder**

Replace `[Option A/B/C implemented]` and `[Describe chosen option here]` with actual choice from Task 6.

**Step 3: Commit**

```bash
git add backend/tests/UNIT_TEST_ANTI_PATTERNS.md
git commit -m "docs(tests): add unit test anti-pattern audit results

- Documents 5 anti-pattern categories and resolutions
- Before/after metrics showing improvements
- Prevention guidelines for future contributors"
```

---

## Success Criteria Checklist

- [ ] All unit tests pass (100% pass rate)
- [ ] 2 failing connection-manager tests fixed
- [ ] dataManager.test.js updated to match singleton architecture
- [ ] persistenceService.test.js added (7 tests)
- [ ] discoveryService.test.js added (5 tests)
- [ ] vlcService.test.js added (7 tests)
- [ ] Anti-pattern #2 addressed (user choice implemented)
- [ ] Service coverage improved from 66.7% to 100%
- [ ] Total unit tests increased from 57 to 79+
- [ ] Documentation created (UNIT_TEST_ANTI_PATTERNS.md)
- [ ] All commits follow conventional commit format

---

## Execution Notes

**Estimated Timeline:** 7-8 hours total

**Task Breakdown:**
- Task 1: 30 min (bug fix)
- Task 2: 1 hour (test refactor)
- Task 3: 2 hours (persistenceService tests)
- Task 4: 1.5 hours (discoveryService tests)
- Task 5: 1.5 hours (vlcService tests)
- Task 6: 10 min - 4 hours (depends on option chosen)
- Task 7: 15 min (verification)
- Task 8: 15 min (documentation)

**Approval Required:** Task 6 (user must choose Option A, B, or C)

**Skills Referenced:**
- @superpowers:testing-anti-patterns (anti-pattern detection)
- @superpowers:verification-before-completion (Task 7)
- @superpowers:test-driven-development (test-first approach)
