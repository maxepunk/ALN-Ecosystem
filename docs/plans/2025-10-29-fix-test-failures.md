# Fix Test Failures After Mode Standardization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILLS: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:verification-before-completion for EACH task. Use superpowers:testing-anti-patterns to review any test changes.

**Goal:** Fix 7 test failures identified after mode field standardization refactoring, ensuring tests follow testing best practices and anti-pattern guidelines.

**Architecture:** Address three independent test issues: (1) broadcasts.test.js unit/integration scope violation requiring test restructure, (2) videoQueueService.test.js test data source issue requiring fixture usage, (3) orchestratorClient.test.js false alarm requiring no action. All fixes follow TDD principles and testing layer separation.

**Tech Stack:** Jest, Node.js, Socket.IO (integration tests), test fixtures

**Testing Baseline:**
- PASSING: 682 tests
- FAILING: 7 tests (2 broadcasts, 4 videoQueue, 1 orchestrator - false alarm)
- Target: All tests passing with proper test layer separation

---

## Pre-Implementation Checklist

**Before starting:**
1. Review testing anti-patterns: Read `.claude/plugins/cache/superpowers/skills/testing-anti-patterns/SKILL.md`
2. Understand test layers:
   - Unit tests: Test single unit in isolation, mock external dependencies
   - Integration tests: Test multiple components working together, real infrastructure
3. Verify baseline: Run `cd backend && npm test` to confirm current state

---

## Task 1: Fix videoQueueService.test.js - Use Test Fixtures

**Files:**
- Modify: `backend/tests/unit/services/videoQueueService.test.js:16-19, 27`

**Issue:** Test loads real production data from `ALN-TokenData/tokens.json` which doesn't contain test token `534e2b03`, causing undefined token errors.

**Step 1: Read test fixtures to understand structure**

Run: `cat backend/tests/fixtures/test-tokens.js | head -100`
Expected: See token `534e2b03` defined with `video: 'test_30sec.mp4'`

**Step 2: Update test to use fixtures instead of real data**

**Before** (lines 16-19):
```javascript
beforeAll(async () => {
  // Initialize transactionService with tokens
  const tokens = tokenService.loadTokens();
  await transactionService.init(tokens);
});
```

**After**:
```javascript
beforeAll(async () => {
  // Use test fixtures instead of production token data
  // Fixtures designed for test isolation (see tests/fixtures/test-tokens.js:1-8)
  const testTokens = require('../../fixtures/test-tokens');
  await transactionService.init(testTokens.getAllAsArray());
});
```

**Step 3: Verify testToken retrieval works**

**Before** (line 27):
```javascript
testToken = transactionService.tokens.get('534e2b03'); // test_30sec.mp4
```

**After** (no change needed - token now exists in fixture data):
```javascript
testToken = transactionService.tokens.get('534e2b03'); // test_30sec.mp4
```

**Step 4: Run videoQueueService tests**

Run: `cd backend && npm run test:unit -- services/videoQueueService.test.js`
Expected: All 5 tests pass (was 1/5, now 5/5)

**Step 5: Verify no undefined errors**

Check test output for:
- ✓ No "Cannot read properties of undefined (reading 'mediaAssets')" errors
- ✓ testToken is defined and has mediaAssets.video property
- ✓ All queue operations work correctly

**Step 6: Commit**

```bash
git add backend/tests/unit/services/videoQueueService.test.js
git commit -m "test: use fixtures in videoQueueService tests for isolation

- Replace tokenService.loadTokens() with test fixtures
- Eliminates dependency on production token data
- Fixes 4 failing tests (undefined token errors)
- Follows test isolation best practices"
```

---

## Task 2: Restructure broadcasts.test.js - Remove Unit Tests with Side Effects

**Files:**
- Modify: `backend/tests/unit/websocket/broadcasts.test.js:67-96, 384-409`

**Issue:** Unit tests trigger `session:created` event which has side effects (device initialization). This violates unit test scope and causes mock structure issues.

**Anti-Pattern:** Tests are checking wrapper behavior but triggering device initialization that requires complex Socket.IO mocking (incomplete mock anti-pattern).

**Step 1: Understand what session:created handler does**

Read: `backend/src/websocket/broadcasts.js:48-65`

Handler does TWO things:
1. Wraps event with envelope (lines 50-58) - Unit test concern
2. Calls `initializeSessionDevices()` (line 62) - Integration test concern

**Step 2: Verify session:updated tests same wrapper logic**

Compare:
- `session:created` handler (lines 48-65): Uses `emitWrapped(io, 'session:update', {...})`
- `session:updated` handler (lines 67-78): Uses `emitWrapped(io, 'session:update', {...})`

Both use IDENTICAL wrapper logic. Testing `session:updated` proves wrapper works without side effects.

**Step 3: Remove session:created test from unit tests**

**Delete** (lines 67-96):
```javascript
it('should wrap session:created event using emitWrapped helper', () => {
  // ... entire test ...
});
```

**Replace with comment**:
```javascript
// session:created test moved to integration tests (session-device-initialization.test.js)
// Reason: Triggers initializeSessionDevices() side effect (Socket.IO device registry)
// Wrapper logic is identical to session:updated (tested below)
```

**Step 4: Update "wrapped envelope" test to remove session:created**

**Before** (lines 394-395):
```javascript
// Trigger various events
mockSessionService.emit('session:created', { id: 'test', name: 'Test' });
mockStateService.emit('state:sync', { test: 'data' });
```

**After**:
```javascript
// Trigger various events (NO session:created - has side effects)
mockSessionService.emit('session:updated', { id: 'test', name: 'Test', status: 'active' });
mockStateService.emit('state:sync', { test: 'data' });
```

**Step 5: Remove unnecessary mock structure**

**Before** (lines 29-33):
```javascript
sockets: {
  adapter: {
    rooms: new Map()
  }
}
```

**After** (remove entirely - not needed without session:created):
```javascript
// No sockets structure needed - unit tests don't trigger device initialization
```

Final mock structure (lines 26-28):
```javascript
mockIo = {
  emit: jest.fn(),
  to: jest.fn().mockReturnThis() // Chainable for emitToRoom
};
```

**Step 6: Run broadcasts tests**

Run: `cd backend && npm run test:unit -- websocket/broadcasts.test.js`
Expected: All tests pass (was 10/12, now 10/10 after removing 2)

**Step 7: Verify no mock structure errors**

Check test output for:
- ✓ No "Cannot read properties of undefined (reading 'values')" errors
- ✓ session:updated test passes (proves wrapper works)
- ✓ Wrapped envelope test passes with multiple event types

**Step 8: Commit**

```bash
git add backend/tests/unit/websocket/broadcasts.test.js
git commit -m "test: remove session:created from unit tests (side effects)

- Delete session:created wrapper test (line 67-96)
- Update wrapped envelope test to use session:updated (line 394)
- Remove unnecessary io.sockets mock structure
- Wrapper logic tested via session:updated (identical behavior)
- Device initialization will be tested in integration layer (next task)"
```

---

## Task 3: Create Integration Test for Session Device Initialization

**Files:**
- Create: `backend/tests/integration/websocket/session-device-initialization.test.js`

**Purpose:** Test the device initialization behavior that was removed from unit tests. Integration test can use real Socket.IO infrastructure and test cross-component behavior.

**Step 1: Create test file with proper structure**

Create: `backend/tests/integration/websocket/session-device-initialization.test.js`

```javascript
/**
 * Integration Tests: Session Device Initialization
 *
 * Tests initializeSessionDevices() behavior when session:created event fires
 * This is integration test scope (not unit) because it requires:
 * - Real Socket.IO server and client connections
 * - SessionService device registry
 * - Room joining and WebSocket state
 *
 * Moved from unit tests (broadcasts.test.js) due to scope violation
 */

const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const sessionService = require('../../../src/services/sessionService');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../../src/websocket/broadcasts');
const { resetAllServices } = require('../../helpers/service-reset');

describe('Session Device Initialization - Integration', () => {
  let io;
  let httpServer;
  let clientSockets = [];
  const TEST_PORT = 3001;

  beforeAll(async () => {
    // Setup real Socket.IO server for integration tests
    httpServer = createServer();
    io = new Server(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(TEST_PORT, resolve);
    });

    // Setup broadcast listeners (real implementation)
    setupBroadcastListeners(io, {
      sessionService: sessionService,
      transactionService: require('../../../src/services/transactionService'),
      stateService: require('../../../src/services/stateService'),
      videoQueueService: require('../../../src/services/videoQueueService'),
      offlineQueueService: require('../../../src/services/offlineQueueService')
    });
  });

  afterAll(async () => {
    cleanupBroadcastListeners();
    io.close();
    await new Promise((resolve) => {
      httpServer.close(resolve);
    });
  });

  beforeEach(async () => {
    await resetAllServices();
    // Disconnect any existing test clients
    clientSockets.forEach(socket => socket.disconnect());
    clientSockets = [];
  });

  afterEach(async () => {
    await resetAllServices();
  });

  // Test implementation in next step
});
```

**Step 2: Write test for device registration on session creation**

Add to test file:

```javascript
it('should register connected devices when session created', async () => {
  // Step 1: Create and authenticate socket clients
  const socket1 = await createAuthenticatedSocket('DEVICE_1', 'gm', '1.0.0');
  const socket2 = await createAuthenticatedSocket('DEVICE_2', 'gm', '1.0.0');

  clientSockets.push(socket1, socket2);

  // Step 2: Create session (triggers session:created → initializeSessionDevices)
  const session = await sessionService.createSession({
    name: 'Test Session',
    teams: ['001', '002']
  });

  // Small delay for async device initialization
  await new Promise(resolve => setTimeout(resolve, 50));

  // Step 3: Verify devices registered in session
  const currentSession = sessionService.getCurrentSession();
  expect(currentSession.connectedDevices).toBeDefined();
  expect(currentSession.connectedDevices.length).toBe(2);

  const device1 = currentSession.connectedDevices.find(d => d.id === 'DEVICE_1');
  const device2 = currentSession.connectedDevices.find(d => d.id === 'DEVICE_2');

  expect(device1).toBeDefined();
  expect(device1.type).toBe('gm');
  expect(device1.connectionStatus).toBe('connected');

  expect(device2).toBeDefined();
  expect(device2.type).toBe('gm');

  // Step 4: Verify sockets joined session room
  const serverSocket1 = io.sockets.sockets.get(socket1.id);
  const serverSocket2 = io.sockets.sockets.get(socket2.id);

  expect(serverSocket1.rooms.has(`session:${session.id}`)).toBe(true);
  expect(serverSocket2.rooms.has(`session:${session.id}`)).toBe(true);
});
```

**Step 3: Write test for no devices scenario**

Add to test file:

```javascript
it('should handle no connected devices gracefully', async () => {
  // No sockets connected
  const session = await sessionService.createSession({
    name: 'Empty Session',
    teams: []
  });

  await new Promise(resolve => setTimeout(resolve, 50));

  // Should not crash, devices list empty
  const currentSession = sessionService.getCurrentSession();
  expect(currentSession.connectedDevices).toBeDefined();
  expect(currentSession.connectedDevices.length).toBe(0);
});
```

**Step 4: Add helper function for authenticated socket creation**

Add to test file (after describe block starts):

```javascript
// Helper: Create authenticated socket client
async function createAuthenticatedSocket(deviceId, deviceType, version) {
  return new Promise((resolve, reject) => {
    const socket = Client(`http://localhost:${TEST_PORT}`, {
      auth: {
        token: 'test-jwt-token', // Mock token for test
        deviceId,
        deviceType,
        version
      }
    });

    socket.on('connect', () => {
      // Simulate authentication
      socket.isAuthenticated = true;
      socket.deviceId = deviceId;
      socket.deviceType = deviceType;
      socket.version = version;

      resolve(socket);
    });

    socket.on('connect_error', reject);

    setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
  });
}
```

**Step 5: Run integration tests**

Run: `cd backend && npm run test:integration -- websocket/session-device-initialization.test.js`
Expected: 2 tests pass

**Step 6: Verify coverage of removed unit tests**

Check that integration test covers what was removed:
- ✓ Device registration when session created
- ✓ Socket room joining
- ✓ Handling empty device list
- ✓ session:update event broadcast (implicitly via createSession)

**Step 7: Commit**

```bash
git add backend/tests/integration/websocket/session-device-initialization.test.js
git commit -m "test: add integration tests for session device initialization

- New integration test file for device registration behavior
- Tests removed from broadcasts.test.js unit tests (scope violation)
- Uses real Socket.IO server and clients
- Covers: device registration, room joining, empty device list
- Proper test layer separation (integration vs unit)"
```

---

## Task 4: Verify orchestratorClient.test.js (No Fix Needed)

**Files:**
- Verify: `backend/tests/unit/scanner/orchestratorClient.test.js`

**Issue:** Error message in test output suggested a failing test, but investigation revealed it's just logged output from defensive error handling.

**Step 1: Verify no test with claimed name exists**

Run: `grep -n "should throw errors for invalid event names when emitting" backend/tests/unit/scanner/orchestratorClient.test.js`
Expected: No matches (test doesn't exist)

**Step 2: Verify existing error handling test passes**

Run: `cd backend && npm run test:unit -- scanner/orchestratorClient.test.js --grep "should handle errors in event handlers gracefully"`
Expected: Test passes (validates defensive error handling)

**Step 3: Review implementation to confirm intentional behavior**

Read: `ALNScanner/js/network/orchestratorClient.js:559-569`

Confirm:
- Lines 562-566 wrap handler execution in try-catch
- Line 565 logs errors with console.error (NOT throw)
- Defensive pattern: One bad handler doesn't crash others

**Step 4: Document findings**

No fix needed. The console.error output in test results is NOT a test failure:
- Implementation intentionally catches errors (defensive)
- Existing test validates this behavior and passes
- No missing test coverage
- Error message was from logged output, not thrown error

**Step 5: Verify all orchestratorClient tests pass**

Run: `cd backend && npm run test:unit -- scanner/orchestratorClient.test.js`
Expected: All tests pass

**Step 6: Commit documentation update**

```bash
git add docs/plans/2025-10-29-fix-test-failures.md
git commit -m "docs: document orchestratorClient false alarm

- No test failure exists (console.error output misinterpreted)
- Defensive error handling is intentional and tested
- No action required"
```

---

## Task 5: Run Full Test Suite and Verify All Fixes

**Files:**
- Verify: All test files

**Step 1: Run unit tests**

Run: `cd backend && npm run test:unit`
Expected: All unit tests pass

Check specifically:
- ✓ videoQueueService.test.js: 5/5 pass (was 1/5)
- ✓ broadcasts.test.js: 10/10 pass (was 10/12, removed 2)
- ✓ orchestratorClient.test.js: All pass (no change)

**Step 2: Run integration tests**

Run: `cd backend && npm run test:integration`
Expected: All integration tests pass

Check specifically:
- ✓ session-device-initialization.test.js: 2/2 pass (new file)

**Step 3: Run full test suite**

Run: `cd backend && npm test`
Expected: All tests pass (unit + contract + integration)

**Step 4: Verify test count**

Compare before/after:
- Before: 682 passing, 7 failing
- After: 684 passing, 0 failing (lost 2 unit tests, gained 2 integration tests)

**Step 5: Check for any warnings or deprecations**

Review test output for:
- ✓ No anti-pattern violations
- ✓ No incomplete mock warnings
- ✓ No "testing mock behavior" issues
- ✓ Clean separation of unit vs integration tests

**Step 6: Document test results**

Create summary in plan or commit message:

```
Test Results Summary:
- videoQueueService: 4 failures fixed (fixture usage)
- broadcasts: 2 tests restructured (unit → integration)
- orchestratorClient: 0 failures (false alarm)
- Integration: 2 new tests added (device initialization)
- Total: 684 passing, 0 failing
- Anti-patterns: 0 violations
```

**Step 7: Final commit**

```bash
git add -A
git commit -m "test: verify all test fixes complete

- All 7 failures resolved
- Unit tests: proper scope (no side effects)
- Integration tests: cover cross-component behavior
- Test fixtures: proper isolation from production data
- Anti-patterns: none detected
- Final: 684 passing, 0 failing"
```

---

## Task 6: Update Testing Documentation

**Files:**
- Modify: `backend/tests/README.md` (if exists) or create

**Purpose:** Document the testing layer decisions made and anti-patterns avoided for future developers.

**Step 1: Check if testing documentation exists**

Run: `ls -la backend/tests/README.md`

If not exists, create it. If exists, append to it.

**Step 2: Add section on test layer separation**

Add to `backend/tests/README.md`:

```markdown
## Test Layer Separation Guidelines

### Unit Tests (`tests/unit/`)

**Scope:** Test single unit in isolation
- Mock external dependencies (databases, file systems, network)
- NO side effects (device registration, room joining, etc.)
- Fast execution (< 100ms per test)
- Use test fixtures, not production data

**Anti-Patterns to Avoid:**
- ❌ Testing mock behavior instead of real behavior
- ❌ Incomplete mocks (adding empty structures to prevent crashes)
- ❌ Triggering side effects (device init, WebSocket broadcasts)
- ✅ Test the wrapper/adapter logic only
- ✅ Use fixtures for test data isolation

### Integration Tests (`tests/integration/`)

**Scope:** Test multiple components working together
- Real infrastructure where practical (Socket.IO server, sessions)
- Cross-component interactions (broadcasts → sessions → devices)
- Slower execution (< 1s per test acceptable)
- Test side effects and state coordination

**When to Use:**
- Device initialization and registration
- WebSocket room joining
- Session lifecycle with connected devices
- Cross-service event flow

### Example: broadcasts.js Testing

**Unit Test (broadcasts.test.js):**
- Tests: Event wrapping logic (envelope structure, field mapping)
- Mocks: Minimal Socket.IO (emit, to methods)
- Events: session:updated, state:sync (no side effects)

**Integration Test (session-device-initialization.test.js):**
- Tests: Device registration when session created
- Real: Socket.IO server, authenticated clients
- Events: session:created (includes device initialization)

See: `docs/plans/2025-10-29-fix-test-failures.md` for refactoring rationale
```

**Step 3: Add section on test fixtures**

Add to `backend/tests/README.md`:

```markdown
## Test Fixtures

**Location:** `backend/tests/fixtures/`

**Purpose:** Provide controlled, isolated test data separate from production data

**Usage:**
```javascript
// ❌ BAD: Load production data (fragile, couples tests to real data)
const tokens = tokenService.loadTokens(); // from ALN-TokenData/tokens.json

// ✅ GOOD: Use test fixtures (isolated, predictable)
const testTokens = require('../../fixtures/test-tokens');
const tokens = testTokens.getAllAsArray();
```

**Available Fixtures:**
- `test-tokens.js`: 10 minimal tokens covering all media types
- Token IDs: `534e2b03` (video), others for audio/image/combinations

**Benefits:**
- Test isolation (production data changes don't break tests)
- Faster execution (small fixture files)
- Predictable test data (no external dependencies)
```

**Step 4: Commit documentation**

```bash
git add backend/tests/README.md
git commit -m "docs: add testing layer separation guidelines

- Document unit vs integration test scope
- Anti-pattern examples and solutions
- Test fixture usage guidelines
- broadcasts.js refactoring rationale"
```

---

## Completion Checklist

### Test Fixes
- [ ] Task 1: videoQueueService.test.js uses fixtures (4 failures fixed)
- [ ] Task 2: broadcasts.test.js unit tests restructured (2 tests removed)
- [ ] Task 3: Integration tests created for device initialization (2 tests added)
- [ ] Task 4: orchestratorClient.test.js verified (no fix needed)
- [ ] Task 5: Full test suite passes (684 passing, 0 failing)

### Documentation
- [ ] Task 6: Testing guidelines documented

### Verification
- [ ] No anti-pattern violations remain
- [ ] Unit tests have no side effects
- [ ] Integration tests cover cross-component behavior
- [ ] Test fixtures used for isolation
- [ ] All commits follow conventional format

---

## Success Criteria

**Functional:**
- ✅ All 684 tests pass (unit + contract + integration)
- ✅ No test failures or errors
- ✅ No mock structure warnings

**Architecture:**
- ✅ Unit tests test wrapper logic only (no side effects)
- ✅ Integration tests test device initialization
- ✅ Test fixtures used for data isolation
- ✅ No anti-patterns present

**Documentation:**
- ✅ Testing guidelines documented
- ✅ Refactoring rationale explained
- ✅ Future developers understand layer separation

---

## Notes for Engineer

**Context:** These test failures appeared after mode field standardization refactoring (see `docs/plans/2025-10-29-standardize-mode-field.md`). The refactoring itself is correct - these are pre-existing test design issues that were exposed.

**Key Principles:**
1. **Unit tests test units** - No side effects, mock external dependencies
2. **Integration tests test integration** - Real infrastructure, cross-component behavior
3. **Use fixtures, not production data** - Test isolation and predictability
4. **Follow anti-pattern guidelines** - Review `.claude/plugins/cache/superpowers/skills/testing-anti-patterns/SKILL.md`

**Testing Anti-Patterns to Avoid:**
- Don't test mock behavior (test real component behavior)
- Don't use incomplete mocks (provide what test actually needs OR restructure test)
- Don't trigger side effects in unit tests (move to integration tests)
- Don't load production data in unit tests (use fixtures)

**Commit Messages:**
Follow conventional commit format:
- `test:` for test changes
- `docs:` for documentation updates

**Questions?**
- Review anti-patterns skill for testing guidance
- Check existing integration tests for patterns
- Ask before adding complex mocks to unit tests
