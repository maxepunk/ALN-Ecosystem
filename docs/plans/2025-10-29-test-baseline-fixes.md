# Fix Test Baseline Failures - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILLS: Use `superpowers:executing-plans` to execute this plan, use `superpowers:systematic-debugging` when investigating root causes, use `superpowers:test-driven-development` when writing new tests or fixing broken ones.

**Created:** 2025-10-29
**Status:** Not Started
**Total Estimated Time:** 5-8 hours
**Success Criteria:**
- Unit tests: < 10 seconds total execution time
- Integration tests: > 90% pass rate
- All layers: No timeout failures, no incomplete mocks

---

## Executive Summary

### Current Baseline Status
| Layer | Pass Rate | Time | Critical Issues |
|-------|-----------|------|-----------------|
| Unit | 90.3% | 54.5s | orchestratorClient.test.js timeouts (50.4s) |
| Contract | 93.4% | 33.3s | MODE field contract violations |
| Integration | 40.1% | 52.8s | DataManager contract violations (81% suite failure) |
| E2E | 91.9% | 312s | WebSocket state sync issues |

### Root Causes Identified
1. **Performance Bottleneck**: Single test file accounts for 92.5% of unit test time
2. **Contract Violations**: Backend assumes scanner methods that don't exist
3. **Mock Anti-Patterns**: Incomplete mocks, testing mock behavior, over-mocking
4. **Cross-Module API Drift**: Backend and scanner submodules out of sync

### Implementation Strategy
Fix in order of impact × effort ratio:
1. **Phase 1 (CRITICAL):** orchestratorClient.test.js mock fixes → 50 seconds savings
2. **Phase 2 (CRITICAL):** Integration layer contract violations → 40% → 90% pass rate
3. **Phase 3 (MEDIUM):** Video subsystem mock replacement → Eliminate brittleness
4. **Phase 4 (MEDIUM):** Remaining high-value failures → Clean up test suite
5. **Phase 5 (LOW):** Async cleanup issues → Eliminate warnings

---

## Phase 1: Fix orchestratorClient.test.js Performance (CRITICAL)

**Estimated Time:** 30 minutes
**Impact:** 50 second reduction in unit test time (92.5% of total)
**Priority:** CRITICAL - Immediate developer feedback loop improvement

### Context
- **File:** `backend/tests/unit/scanner/orchestratorClient.test.js`
- **Issue:** 10 tests timing out at 10 seconds each (50 seconds total wait time)
- **Root Cause:** Incomplete mock socket implementation
  - Missing `.off()` method → TypeError during cleanup
  - Mock event handlers registered but never invoked
  - Connection promises never resolve → tests wait full 10 seconds

### Failing Tests (All in orchestratorClient.test.js)
1. "Event Listener Registration › should register all AsyncAPI server events"
2. "Rate Limiting › should process rate limit queue with delay"
3. "State Request › should emit state:request when connected" (2 instances)
4. "State Request › should rate limit state requests (max 1 per 5 seconds)"
5. Additional timeout failures in event handling (5 more tests)

### Anti-Pattern Violations
- **Incomplete Mocks:** mockSocket missing `.off()`, `.removeAllListeners()` methods
- **Testing Mock Behavior:** Tests expect mock to auto-fire events (never happens)
- **Mocking Without Understanding:** Mock doesn't replicate socket.io lifecycle

### Implementation Tasks

#### Task 1.1: Read Current Mock Implementation
**File:** `backend/tests/unit/scanner/orchestratorClient.test.js` (lines 1-100)
**Action:** Read entire file to understand current mock structure
```bash
# Verify mock implementation
grep -A 20 "mockSocket = {" backend/tests/unit/scanner/orchestratorClient.test.js
```

#### Task 1.2: Complete Mock Socket Implementation
**File:** `backend/tests/unit/scanner/orchestratorClient.test.js` (mock setup section)
**Changes:**
```javascript
// BEFORE (incomplete mock)
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  once: jest.fn(),
  connected: false
  // Missing: .off(), .removeAllListeners()
};

// AFTER (complete mock)
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),  // Add missing method
  removeAllListeners: jest.fn(),  // Add missing method
  connected: false,
  // Add event emitter behavior
  _events: {},
  _mockEmit(event, ...args) {
    if (this._events[event]) {
      this._events[event].forEach(handler => handler(...args));
    }
  }
};

// Make .on() actually register handlers
mockSocket.on.mockImplementation((event, handler) => {
  mockSocket._events[event] = mockSocket._events[event] || [];
  mockSocket._events[event].push(handler);
  return mockSocket;
});
```

#### Task 1.3: Fix Event-Driven Test Pattern
**File:** `backend/tests/unit/scanner/orchestratorClient.test.js` (failing test cases)
**Pattern to Fix:**
```javascript
// BEFORE (waits forever for event that never fires)
it('should connect successfully', async () => {
  await client.connect();  // Timeout - 'connect' event never fires
  expect(mockSocket.emit).toHaveBeenCalledWith('gm:auth', ...);
});

// AFTER (trigger mock events)
it('should connect successfully', async () => {
  // Trigger connect event after connection attempt
  const connectPromise = client.connect();
  await new Promise(resolve => setTimeout(resolve, 10));  // Let async init happen
  mockSocket._mockEmit('connect');  // Fire the event
  await connectPromise;
  expect(mockSocket.emit).toHaveBeenCalledWith('gm:auth', ...);
});
```

#### Task 1.4: Use Jest Fake Timers for Rate Limiting Tests
**File:** `backend/tests/unit/scanner/orchestratorClient.test.js` (rate limiting tests)
**Changes:**
```javascript
// BEFORE (real timers - slow)
it('should rate limit state requests (max 1 per 5 seconds)', async () => {
  await client.requestState();
  await client.requestState();  // Should be blocked
  await new Promise(resolve => setTimeout(resolve, 5000));  // SLOW
  await client.requestState();  // Should succeed
});

// AFTER (fake timers - instant)
it('should rate limit state requests (max 1 per 5 seconds)', async () => {
  jest.useFakeTimers();
  await client.requestState();
  await client.requestState();  // Should be blocked
  jest.advanceTimersByTime(5000);  // Instant
  await client.requestState();  // Should succeed
  jest.useRealTimers();
});
```

### Verification Steps
1. **Run orchestratorClient.test.js in isolation:**
   ```bash
   npx jest tests/unit/scanner/orchestratorClient.test.js --verbose
   ```
   - **Expected:** All tests pass, no timeouts, < 1 second execution time
   - **Current:** 10 failures, 50+ seconds

2. **Run full unit test suite:**
   ```bash
   npm run test:unit
   ```
   - **Expected:** ~4-5 seconds total (down from 54.5s)
   - **Expected:** No "Exceeded timeout of 10000 ms" errors
   - **Expected:** No "Have you considered using --detectOpenHandles" warning

3. **Verify mock completeness:**
   ```bash
   grep -E "(\.off\(|\.removeAllListeners\()" backend/tests/unit/scanner/orchestratorClient.test.js
   ```
   - **Expected:** Find mock implementations for both methods

### Success Criteria
- [ ] All 10 timeout failures resolved
- [ ] orchestratorClient.test.js execution time < 1 second
- [ ] Unit test suite total time < 10 seconds
- [ ] No TypeError about missing `.off()` method
- [ ] No Jest force exit warnings

---

## Phase 2: Fix Integration Layer Contract Violations (CRITICAL)

**Estimated Time:** 2-3 hours
**Impact:** Integration test pass rate from 40% → 90%+
**Priority:** CRITICAL - Validates backend-scanner contract compliance

### Context
- **Issue:** Backend code assumes scanner methods that don't exist in submodule
- **Root Cause:** Cross-module API contract drift
- **Impact:** 17 of 21 integration test suites fail (81%)
- **Pattern:** Backend calls `window.DataManager.resetForNewSession()` → ReferenceError

### Failing Test Suites (17 total)
All failures follow same pattern: `ReferenceError: window is not defined` or `DataManager is not defined`

**Test Files:**
1. `tests/integration/admin/admin-authentication.test.js`
2. `tests/integration/admin/admin-intervention.test.js`
3. `tests/integration/admin/admin-state-access.test.js`
4. `tests/integration/discovery/discovery-service.test.js`
5. `tests/integration/offline/offline-queue-crud.test.js`
6. `tests/integration/offline/offline-queue-sync.test.js`
7. `tests/integration/persistence/persistence-memory-only.test.js`
8. `tests/integration/scanner-sync/gm-scanner-state-sync.test.js`
9. `tests/integration/scanner-sync/player-scanner-state-sync.test.js`
10. `tests/integration/scoring/audit-trail.test.js`
11. `tests/integration/scoring/duplicate-scan-prevention.test.js`
12. `tests/integration/scoring/group-scoring.test.js`
13. `tests/integration/scoring/transaction-deletion.test.js`
14. `tests/integration/session/session-persistence.test.js`
15. `tests/integration/session/session-state-transition.test.js`
16. `tests/integration/video/video-queue-sync.test.js`
17. `tests/integration/websocket/broadcasts.test.js`

### Root Cause Analysis
**Backend Assumption:** Scanner has `DataManager.resetForNewSession()` method
**Scanner Reality:** Method doesn't exist in ALNScanner or aln-memory-scanner submodules
**Test Environment:** Integration tests run in Node.js (no `window` object)
**Anti-Pattern:** Mocking at wrong level - mocking browser APIs in Node.js tests

### Implementation Tasks

#### Task 2.1: Locate DataManager References in Backend
**Action:** Find all backend code that assumes DataManager exists
```bash
cd backend
grep -r "DataManager" src/ --include="*.js"
grep -r "window\.DataManager" src/ --include="*.js"
grep -r "resetForNewSession" src/ --include="*.js"
```
**Expected Locations:**
- Session lifecycle code (session creation/reset)
- WebSocket event handlers (state sync)
- API route handlers (session endpoints)

#### Task 2.2: Read Backend Code Assuming DataManager
**Action:** Examine how backend uses scanner methods
```bash
# Find specific usages
grep -B 5 -A 10 "DataManager" backend/src/**/*.js
```
**Questions to Answer:**
- What does backend expect `resetForNewSession()` to do?
- Is this a real requirement or test artifact?
- Should this be in AsyncAPI contract?

#### Task 2.3: Check AsyncAPI Contract for DataManager
**File:** `backend/contracts/asyncapi.yaml`
**Action:** Verify if DataManager is specified in contract
```bash
grep -i "datamanager" backend/contracts/asyncapi.yaml
grep -i "resetForNewSession" backend/contracts/asyncapi.yaml
```
**Decision Point:**
- **If in contract:** Scanner submodule needs implementation (update ALNScanner)
- **If NOT in contract:** Backend code is wrong (remove assumptions)

#### Task 2.4: Verify Scanner Submodule Implementation
**Files:**
- `ALNScanner/` (GM Scanner submodule)
- `aln-memory-scanner/` (Player Scanner submodule)

**Action:** Check if DataManager exists in either scanner
```bash
# Check GM Scanner
grep -r "DataManager" ALNScanner/ --include="*.js"
grep -r "resetForNewSession" ALNScanner/ --include="*.js"

# Check Player Scanner
grep -r "DataManager" aln-memory-scanner/ --include="*.js"
grep -r "resetForNewSession" aln-memory-scanner/ --include="*.js"
```

#### Task 2.5: Determine Fix Strategy
**Three Possible Approaches:**

**Option A: Remove Backend Assumptions (RECOMMENDED)**
- Remove `window.DataManager` calls from backend code
- Backend shouldn't manipulate client-side state directly
- Violates separation of concerns (backend orchestrates, scanner manages own state)

**Option B: Add to Contract + Implement in Scanner**
- Add DataManager methods to AsyncAPI contract
- Implement in both scanner submodules
- Requires coordinated multi-repo update

**Option C: Mock Only in Test Environment**
- Add proper integration test fixtures that mock browser environment
- Backend code unchanged
- Tests replicate actual browser context

**Decision Criteria:**
1. Check if backend ACTUALLY needs this (review code context)
2. Check if this is already communicated via WebSocket events (preferred pattern)
3. Prefer WebSocket events over direct method calls (architecture alignment)

#### Task 2.6: Implement Chosen Strategy

**If Option A (Remove Backend Assumptions):**
1. Read backend files with DataManager references
2. Refactor to use WebSocket events instead:
   ```javascript
   // BEFORE (direct call)
   window.DataManager.resetForNewSession(sessionData);

   // AFTER (WebSocket event)
   socket.emit('session:reset', sessionData);  // Scanner listens and resets itself
   ```
3. Update integration tests to remove DataManager mocks
4. Verify AsyncAPI contract has `session:reset` event

**If Option B (Add to Contract):**
1. Update `backend/contracts/asyncapi.yaml` with DataManager spec
2. Create GitHub issues for scanner submodule updates
3. Document breaking change in CLAUDE.md
4. Add temporary test fixtures until scanners updated

**If Option C (Mock in Tests):**
1. Create `backend/tests/integration/fixtures/browser-environment.js`
2. Mock `window.DataManager` with proper methods
3. Setup/teardown in integration test lifecycle
4. Document that this is test-only (not real architecture)

### Verification Steps
1. **Run failing integration tests after fix:**
   ```bash
   npm run test:integration 2>&1 | tee /tmp/integration-after-fix.txt
   ```
   - **Expected:** 17 previously failing suites now pass
   - **Expected:** No "ReferenceError: window is not defined"
   - **Expected:** Pass rate > 90%

2. **Verify contract alignment:**
   ```bash
   npm run test:contract
   ```
   - **Expected:** All contract tests pass
   - **Expected:** Backend implementation matches AsyncAPI/OpenAPI specs

3. **Test with real scanner:**
   - Start orchestrator: `npm run dev:no-video`
   - Connect GM Scanner (ALNScanner submodule)
   - Create new session from GM Scanner
   - **Expected:** No console errors about missing methods

### Success Criteria
- [ ] Integration test pass rate > 90% (from 40%)
- [ ] No "ReferenceError: window is not defined" errors
- [ ] No "DataManager is not defined" errors
- [ ] Contract tests confirm backend-scanner alignment
- [ ] Real scanner connection works (no console errors)

---

## Phase 3: Fix Video Subsystem Mock Replacement (MEDIUM)

**Estimated Time:** 1-2 hours
**Impact:** Eliminate brittle mocks, improve test reliability
**Priority:** MEDIUM - Quality improvement, not blocking

### Context
- **Issue:** Video-related tests fail due to incomplete VLC mocks
- **Anti-Pattern:** Over-mocking at unit level for integration-level behavior
- **Better Approach:** Use real video queue service, mock only VLC HTTP interface

### Failing Tests (Video Subsystem)
**Unit Tests:**
1. `videoQueueService.test.js` - "should skip videos when VLC not responding" (timeout)
2. `videoQueueService.test.js` - "should retry failed video plays" (timeout)
3. `vlcService.test.js` - Multiple timeout failures

**Integration Tests:**
4. `video/video-queue-sync.test.js` - Multiple failures (DataManager + video mocking)

### Anti-Pattern Analysis
**Current Pattern (WRONG):**
```javascript
// Unit test mocking too much
const mockVlcService = {
  play: jest.fn().mockResolvedValue(true),
  isPlaying: jest.fn().mockResolvedValue(false),
  // Mock doesn't replicate actual VLC state machine
};
```

**Recommended Pattern (RIGHT):**
```javascript
// Use real videoQueueService, mock only external HTTP calls
const vlcService = require('../../src/services/vlcService');
// Mock HTTP client, not the service
jest.mock('axios');
axios.get.mockResolvedValue({ data: { state: 'playing' } });
```

### Implementation Tasks

#### Task 3.1: Analyze Video Service Architecture
**Files to Read:**
- `backend/src/services/videoQueueService.js` (queue management)
- `backend/src/services/vlcService.js` (VLC HTTP interface)
- `backend/tests/unit/services/videoQueueService.test.js` (current mocks)
- `backend/tests/unit/services/vlcService.test.js` (current mocks)

**Questions to Answer:**
- What's the actual dependency chain? (queue → vlc → HTTP)
- Which layer should be mocked? (HTTP, not service)
- What's the real VLC state machine? (stopped → playing → stopped)

#### Task 3.2: Create VLC HTTP Mock Fixture
**File:** `backend/tests/fixtures/vlc-mock-responses.js` (NEW)
**Content:**
```javascript
// VLC HTTP API response fixtures
module.exports = {
  status: {
    stopped: { state: 'stopped', position: 0, length: 0 },
    playing: { state: 'playing', position: 45, length: 120 },
    paused: { state: 'paused', position: 45, length: 120 }
  },
  playlist: {
    empty: { children: [{ children: [] }] },
    withVideo: { children: [{ children: [{ id: 123, name: 'test.mp4' }] }] }
  }
};
```

#### Task 3.3: Refactor videoQueueService.test.js
**File:** `backend/tests/unit/services/videoQueueService.test.js`
**Changes:**
```javascript
// BEFORE (mocking service)
jest.mock('../../src/services/vlcService', () => ({
  getInstance: () => mockVlcService
}));

// AFTER (mocking HTTP)
const axios = require('axios');
jest.mock('axios');

describe('videoQueueService', () => {
  beforeEach(() => {
    const vlcMock = require('../fixtures/vlc-mock-responses');
    axios.get.mockResolvedValue({ data: vlcMock.status.stopped });
  });

  it('should queue video and play', async () => {
    await videoQueue.enqueue('test.mp4');
    // Real service processes queue, mock HTTP responds
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/requests/status.json'),
      expect.any(Object)
    );
  });
});
```

#### Task 3.4: Add Retry Logic Tests with Fake Timers
**File:** `backend/tests/unit/services/videoQueueService.test.js`
**Add:**
```javascript
it('should retry failed video plays', async () => {
  jest.useFakeTimers();

  // First attempt fails
  axios.post.mockRejectedValueOnce(new Error('VLC not responding'));

  await videoQueue.enqueue('test.mp4');

  // Advance time to trigger retry
  jest.advanceTimersByTime(5000);

  // Second attempt succeeds
  axios.post.mockResolvedValueOnce({ data: vlcMock.status.playing });

  await jest.runAllTimersAsync();
  expect(axios.post).toHaveBeenCalledTimes(2);

  jest.useRealTimers();
});
```

#### Task 3.5: Fix vlcService.test.js Timeouts
**File:** `backend/tests/unit/services/vlcService.test.js`
**Changes:**
```javascript
// Mock HTTP, use fake timers for polling
describe('vlcService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    axios.get.mockResolvedValue({ data: vlcMock.status.stopped });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should detect when video finishes', async () => {
    // Start playing
    axios.get.mockResolvedValueOnce({ data: vlcMock.status.playing });

    const statusPromise = vlc.waitForVideoEnd();

    // Advance polling interval
    jest.advanceTimersByTime(1000);

    // Video finished
    axios.get.mockResolvedValueOnce({ data: vlcMock.status.stopped });

    await jest.runAllTimersAsync();
    await expect(statusPromise).resolves.toBe(true);
  });
});
```

### Verification Steps
1. **Run video unit tests:**
   ```bash
   npx jest tests/unit/services/videoQueueService.test.js
   npx jest tests/unit/services/vlcService.test.js
   ```
   - **Expected:** All pass, no timeouts, < 1 second each

2. **Run video integration tests:**
   ```bash
   npx jest tests/integration/video/
   ```
   - **Expected:** All pass (after Phase 2 DataManager fix)

3. **Verify mock realism:**
   - Compare mock responses to real VLC: `curl http://localhost:8080/requests/status.json -u :vlc`
   - **Expected:** Mock structure matches real VLC JSON

### Success Criteria
- [ ] No timeout failures in video tests
- [ ] Mocks replicate real VLC HTTP responses
- [ ] Tests use fake timers (not real delays)
- [ ] videoQueueService uses real implementation (not mocked)

---

## Phase 4: Fix Remaining High-Value Failures (MEDIUM)

**Estimated Time:** 1-2 hours
**Impact:** Clean up remaining test suite failures
**Priority:** MEDIUM - Polish and completeness

### Failing Tests by Category

#### Contract Tests (8 failures)
**File:** `backend/tests/contract/websocket-events.contract.test.js`

**Failures:**
1. "sync:full event should match AsyncAPI schema › should include MODE field in session data"
2. "gm:scan response should match AsyncAPI schema"
3. "transaction:new event should match AsyncAPI schema"
4. "transaction:deleted event should match AsyncAPI schema"
5. "score:updated event should match AsyncAPI schema"
6. "session:created event should match AsyncAPI schema"
7. "session:ended event should match AsyncAPI schema"
8. "offline:queue:update event should match AsyncAPI schema"

**Root Cause:** MODE field added to contracts but not all events updated to include it

#### Unit Tests (58 remaining failures after Phase 1)
**Categories:**
- Event envelope format mismatches (10 tests)
- Score calculation edge cases (8 tests)
- Transaction validation failures (12 tests)
- Session state transitions (15 tests)
- Offline queue edge cases (13 tests)

#### Integration Tests (remaining after Phase 2)
Expect ~10-20 failures to remain after DataManager fix, mostly:
- Async timing issues
- Test cleanup incomplete
- Event listener leaks

### Implementation Tasks

#### Task 4.1: Fix MODE Field Contract Violations
**Files:**
- `backend/src/services/sessionService.js`
- `backend/src/websocket/broadcasts.js`

**Action:** Ensure all events include `mode` field
```javascript
// Check current implementation
grep -A 20 "sync:full" backend/src/websocket/broadcasts.js

// Expected pattern
{
  event: 'sync:full',
  data: {
    session: {
      mode: 'blackMarket',  // MUST be present
      sessionId: '...',
      // ...
    }
  }
}
```

#### Task 4.2: Review and Fix Event Envelope Format
**File:** `backend/src/websocket/eventHelpers.js`
**Contract:** All events must have `{ event, data, timestamp }` structure
```bash
# Find envelope creation
grep -r "emitWrapped" backend/src/websocket/ --include="*.js"
```

#### Task 4.3: Fix Score Calculation Edge Cases
**Files:** `backend/tests/unit/services/transactionService.test.js`
**Pattern:** Likely incorrect expected values in tests
**Action:**
1. Read failing test assertions
2. Trace calculation logic in `backend/src/services/transactionService.js`
3. Verify expected values match business logic in `ALN-TokenData/tokens.json`

#### Task 4.4: Fix Session State Transition Tests
**Files:** `backend/tests/unit/services/sessionService.test.js`
**Common Issue:** Tests don't wait for async state updates
**Fix Pattern:**
```javascript
// BEFORE
await sessionService.createSession({ mode: 'blackMarket' });
expect(sessionService.getCurrentSession().status).toBe('active');

// AFTER (wait for state to settle)
await sessionService.createSession({ mode: 'blackMarket' });
await new Promise(resolve => setImmediate(resolve));  // Let events propagate
expect(sessionService.getCurrentSession().status).toBe('active');
```

#### Task 4.5: Fix Offline Queue Edge Cases
**Files:** `backend/tests/unit/offline/offlineQueueService.test.js`
**Common Issues:**
- Queue persistence timing
- Duplicate detection edge cases
- Sync conflict resolution

**Action:**
1. Run tests individually to isolate failures
2. Add detailed logging to understand state
3. Fix one at a time, verify with `npx jest <file> --testNamePattern="<specific test>"`

### Verification Steps
1. **Run contract tests:**
   ```bash
   npm run test:contract
   ```
   - **Expected:** 100% pass rate (from 93.4%)

2. **Run unit tests:**
   ```bash
   npm run test:unit
   ```
   - **Expected:** > 95% pass rate (from 90.3%)

3. **Run integration tests:**
   ```bash
   npm run test:integration
   ```
   - **Expected:** > 95% pass rate (from 40.1% after Phase 2)

### Success Criteria
- [ ] Contract tests: 100% pass
- [ ] Unit tests: > 95% pass
- [ ] Integration tests: > 95% pass
- [ ] No failures due to missing fields in contracts

---

## Phase 5: Fix Async Cleanup Issues (LOW)

**Estimated Time:** 30 minutes
**Impact:** Eliminate warnings, clean test output
**Priority:** LOW - Quality of life, not blocking

### Context
**Warning:** "Jest did not exit one second after the test run has completed. Have you considered using `--detectOpenHandles`?"

**Root Cause:** Async operations not cleaned up after tests
- Unresolved promises from timeout tests (orchestratorClient.test.js - fixed in Phase 1)
- WebSocket connections not closed
- Event listeners not removed
- Timers not cleared

### Implementation Tasks

#### Task 5.1: Detect Open Handles
```bash
npx jest --detectOpenHandles --testNamePattern="should" | tee /tmp/open-handles.txt
```
**Analysis:** Look for:
- Timers (setTimeout, setInterval)
- Network connections (sockets, HTTP)
- File handles
- Event listeners

#### Task 5.2: Add Proper Test Cleanup
**Pattern for All Test Files:**
```javascript
describe('ServiceName', () => {
  let service;

  beforeEach(() => {
    service = ServiceName.getInstance();
  });

  afterEach(async () => {
    // Clear timers
    jest.clearAllTimers();

    // Close connections
    if (service.socket?.connected) {
      await service.disconnect();
    }

    // Remove event listeners
    service.removeAllListeners();

    // Reset singleton state (if needed)
    service._reset?.();
  });

  afterAll(async () => {
    // Final cleanup
    await new Promise(resolve => setImmediate(resolve));
  });
});
```

#### Task 5.3: Add Service Reset Methods
**Files:** All singleton services in `backend/src/services/`
**Pattern:**
```javascript
class ServiceName extends EventEmitter {
  static getInstance() { /* ... */ }

  // Add reset method for testing
  _reset() {
    this.removeAllListeners();
    this._state = {};
    // Clear any internal timers, connections, etc.
  }
}
```

#### Task 5.4: Fix Integration Test Cleanup
**File:** `backend/tests/integration/setup/globalTeardown.js`
**Ensure:**
```javascript
module.exports = async () => {
  // Close all WebSocket connections
  const io = require('../../../src/app').io;
  if (io) {
    io.close();
  }

  // Close database connections (if any)

  // Clear all timers
  jest.clearAllTimers();

  // Wait for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
};
```

### Verification Steps
1. **Run with handle detection:**
   ```bash
   npx jest --detectOpenHandles
   ```
   - **Expected:** No open handles detected
   - **Expected:** Jest exits immediately after tests complete

2. **Verify no warnings:**
   ```bash
   npm test 2>&1 | grep -i "did not exit"
   ```
   - **Expected:** No output (no warnings)

### Success Criteria
- [ ] Jest exits immediately after test completion
- [ ] No "did not exit one second after" warnings
- [ ] `--detectOpenHandles` reports no open handles

---

## Verification and Documentation

### Full Test Suite Verification
After all phases complete, run full test suite:
```bash
# Run all tests
npm run test:full

# Capture new baseline
npm run test:unit 2>&1 | tee /tmp/unit-test-final.txt
npm run test:contract 2>&1 | tee /tmp/contract-test-final.txt
npm run test:integration 2>&1 | tee /tmp/integration-test-final.txt
npm run test:e2e 2>&1 | tee /tmp/e2e-test-final.txt
```

### Expected Final Metrics
| Layer | Pass Rate | Time | Improvement |
|-------|-----------|------|-------------|
| Unit | > 95% | < 10s | 54.5s → 10s (82% faster) |
| Contract | 100% | ~30s | 93.4% → 100% |
| Integration | > 95% | ~50s | 40.1% → 95% (138% more tests passing) |
| E2E | > 95% | ~300s | 91.9% → 95% |

### Documentation Updates
1. **Update CLAUDE.md:**
   - Document mock best practices
   - Add section on integration test fixtures
   - Update troubleshooting guide

2. **Create docs/testing/MOCK_PATTERNS.md:**
   - Document when to mock vs use real implementation
   - Provide examples of good vs bad mocking
   - Reference testing-anti-patterns skill

3. **Update baseline documentation:**
   - Archive old baseline: `/tmp/baseline-analysis.md` → `docs/testing/2025-10-29-baseline-before-fixes.md`
   - Create new baseline: Run tests and create `docs/testing/2025-10-29-baseline-after-fixes.md`

---

## Risk Assessment

### High Risk Items
1. **Phase 2 (Contract Violations):** May require scanner submodule updates
   - **Mitigation:** Check contract first, prefer removing backend assumptions
   - **Fallback:** Create GitHub issues for scanner updates, use test fixtures temporarily

2. **Integration Test Refactoring:** May uncover additional architectural issues
   - **Mitigation:** Fix one test file at a time, verify after each
   - **Fallback:** Skip low-value integration tests, focus on critical paths

### Low Risk Items
- Phase 1 (orchestratorClient.test.js): Well-isolated, clear fix path
- Phase 5 (Async cleanup): Quality improvement, no functionality change

---

## Success Metrics

### Primary Goals (Must Achieve)
- [x] Unit tests < 10 seconds total execution time
- [x] Integration tests > 90% pass rate
- [x] No timeout failures across all layers
- [x] Contract tests 100% pass rate

### Secondary Goals (Nice to Have)
- [x] Unit tests > 95% pass rate
- [x] E2E tests > 95% pass rate
- [x] No Jest exit warnings
- [x] Documentation updated with learnings

### Quality Indicators
- Fewer mocks, more real implementations (especially integration layer)
- Tests fail fast (no 10-second timeouts)
- Clear error messages (not "ReferenceError: window is not defined")
- Tests follow anti-pattern skill guidelines

---

## Execution Notes

### Recommended Approach
1. **Execute Phase 1 FIRST** - 50 second immediate payoff, builds confidence
2. **Then Phase 2** - High impact (40% → 90%), may take time to understand
3. **Phases 3-5 in parallel** - Independent, can be done by different people/sessions

### Time Estimates
- **Minimum (Critical Only):** 2.5-3.5 hours (Phase 1 + 2)
- **Recommended (All Phases):** 5-8 hours total
- **Conservative (With Investigation):** 8-12 hours

### Stopping Points
If time limited, stop after:
1. **Phase 1 Complete:** Immediate dev experience improvement
2. **Phase 2 Complete:** Critical contract violations fixed
3. **Phase 4 Complete:** Test suite professional quality

Phase 3 and 5 are polish - can be deferred to separate session.

---

## Related Skills
- **superpowers:executing-plans** - Use to execute this plan in batches
- **superpowers:systematic-debugging** - Use when root cause not obvious
- **superpowers:test-driven-development** - Use when writing new tests
- **superpowers:testing-anti-patterns** - Reference throughout for validation

## Related Documentation
- `/tmp/baseline-analysis.md` - Original failure analysis
- `/tmp/unit-test-performance-analysis.md` - orchestratorClient.test.js deep dive
- `backend/contracts/asyncapi.yaml` - WebSocket event contract
- `backend/contracts/openapi.yaml` - HTTP API contract
- `docs/ARCHIVE/api-alignment/08-functional-requirements.md` - Business logic reference
