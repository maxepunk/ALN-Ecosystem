# Test Architecture Design

**Created**: 2025-09-30
**Updated**: 2025-09-30 (Post-Phase 5 Alignment Review)
**Status**: ✅ COMPLETE - All Decisions Approved + Updated for Phase 5 Contracts
**Phase**: 4.5 Step 3 - Collaborative Test Architecture Design
**Method**: Decision-by-decision collaboration (like Phase 4)

---

## Document Updates

**2025-09-30 Post-Phase 5 Review**: Updated examples, context, and references to align with:
- **Phase 4.75**: Functional Requirements (standalone mode constraint, ONE session model)
- **Phase 4.9**: Essential API List (24 APIs: 8 HTTP + 16 WebSocket, 59% reduction)
- **Phase 5**: Formal Contracts (OpenAPI 3.1.0 + AsyncAPI 2.6.0)

**Core decisions remain unchanged**. Updates address:
- Field naming (scannerId → deviceId per Decision #4)
- Team ID format ('TEAM_A' → "001" - 3-digit zero-padded strings)
- Eliminated event references (14 WebSocket events removed in Phase 4.9)
- Admin transport change (11 HTTP endpoints → WebSocket gm:command)
- Critical constraints from later phases

**See**: `work/TEST-ARCHITECTURE-REVIEW.md` for complete alignment analysis
**See**: `work/TEST-CLEANUP-PLAN.md` for existing test cleanup strategy

---

## Overview

This document defines the test architecture for validating backend APIs against OpenAPI 3.1 and AsyncAPI 2.6 contracts. Each decision was made collaboratively with full context analysis, grounded in the project's reality as a live-event tool (not enterprise SaaS).

**Core Principle**: Tests validate contracts, not the other way around.

**Project Context**:
- Local network tool for ~2-hour live events
- 1-3 GM stations, handful of player scanners
- **Pre-production project** (NO backwards compatibility, NO users, breaking changes atomic)
- **ONE session at a time** (no multi-session management)
- **Standalone mode required** (scanners work without orchestrator, game logic client-side)
- Goal: **Minimal architectural complexity**
- Deployed locally OR via GitHub Pages (standalone)

**Contract Scope** (from Phase 4.9):
- **24 essential APIs**: 8 HTTP endpoints + 16 WebSocket events
- **59% reduction** from original 59 APIs
- See: `09-essential-api-list.md` for complete scope

---

## Decision 1: Contract Validation Approach

**Status**: ✅ APPROVED
**Date**: 2025-09-30

### Problem Statement

We need to validate that backend APIs conform to OpenAPI 3.1 and AsyncAPI 2.6 contracts. Currently:
- HTTP contract tests manually validate structure using `toHaveProperty()` assertions
- WebSocket contract tests validate **fake example objects**, NOT actual backend behavior
- No automated schema validation against formal contract documents

With Contract-First approach (Decision #4.1 from Phase 4), tests must validate real API behavior against formal schemas.

### Current State

**HTTP Contract Tests** (`backend/tests/contract/http-api-contracts.test.js`):
- ✅ Tests real backend via supertest
- ✅ Clean, readable assertions
- ❌ Manual validation (verbose, must sync with contracts)
- ❌ No OpenAPI schema validation

**WebSocket Contract Tests** (`backend/tests/contract/websocket-contracts-simple.test.js`):
- ❌ Tests fake example objects, not real backend
- ❌ No Socket.IO connection
- ❌ Zero validation of actual behavior
- **Needs**: Complete redesign to use real WebSocket connections

### Options Considered

**Option A**: Manual Validation (Current Approach)
- Keep manual assertions, redesign WebSocket tests to use real connections
- **Pros**: Zero new dependencies, full control
- **Cons**: Verbose, manual sync with contracts, no schema validation

**Option B**: jest-openapi for HTTP + ajv for WebSocket (Mixed)
- Add `jest-openapi` library for HTTP, custom ajv for WebSocket
- **Pros**: Automated HTTP validation, contracts drive tests
- **Cons**: Two patterns (HTTP magic, WS custom), 500kb dependencies, abandoned library (last updated 2 years ago), inconsistent errors

**Option C**: Pure ajv for Both HTTP and WebSocket (Unified)
- Custom validation helpers using `ajv` for both HTTP and WebSocket
- **Pros**: ONE system, 76% smaller (120kb vs 500kb), you own the code, consistent errors, explicit and debuggable
- **Cons**: Write ~85 lines of helper code once (~45 min)

### Decision: Option C - Pure ajv (Unified Approach)

**Rationale**:

1. **Minimal Architectural Complexity** (Project Goal):
   - ONE validation system for all APIs (HTTP + WebSocket)
   - 76% less code (120kb vs 500kb with mixed approach)
   - No magic, just explicit JSON schema validation
   - Consistent patterns across all contract tests

2. **Live Event Tool Reality**:
   - Fast debugging critical during event setup
   - Clear error messages > library convenience
   - "Can I understand this at 9pm before the event?" → Yes

3. **Long-term Maintainability**:
   - YOU own 85 lines of helper code (never breaks from external changes)
   - No dependency on abandoned jest-openapi (last updated 2 years ago)
   - No "why are HTTP and WS different?" confusion
   - Consistent error format for all contract violations

4. **Cost-Benefit for This Project**:
   - **Cost**: 45 min to write helper (once)
   - **Benefit**: Ongoing simplicity, clear errors, 380kb less bloat
   - **ROI**: Pays for itself after 1-2 debugging sessions

5. **Aligns with Project Philosophy**:
   - Not enterprise SaaS → don't need enterprise patterns
   - Goal is simplicity → pure ajv is simpler
   - Refactoring for minimal complexity → this supports that

### Dependencies

**Install**:
```bash
npm install --save-dev ajv ajv-formats js-yaml
```

**Packages**:
- `ajv` (v8.12.0+) - Industry-standard JSON Schema validator (~100kb)
- `ajv-formats` (v2.1.1+) - Format validators (date, uri, etc.) (~20kb)
- `js-yaml` (v4.1.0+) - YAML parser for reading contracts (already installed)

**Total size**: ~120kb (vs 500kb with jest-openapi + its dependencies)

### Implementation

#### Contract Validator Helper

**File**: `backend/tests/helpers/contract-validator.js`

```javascript
/**
 * Unified contract validation for HTTP and WebSocket APIs
 * Validates responses/events against OpenAPI/AsyncAPI schemas
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Initialize ajv with formats (dates, uris, etc.)
const ajv = new Ajv({
  strict: false,  // Allow additional properties (flexible for optional fields)
  allErrors: true // Show all validation errors, not just first
});
addFormats(ajv);

// Load contracts once
const openapi = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../contracts/openapi.yaml'), 'utf8')
);
const asyncapi = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../contracts/asyncapi.yaml'), 'utf8')
);

/**
 * Extract schema from OpenAPI spec
 */
function getHTTPSchema(path, method, status = '200') {
  const pathSpec = openapi.paths[path];
  if (!pathSpec) throw new Error(`Path ${path} not found in OpenAPI spec`);

  const methodSpec = pathSpec[method.toLowerCase()];
  if (!methodSpec) throw new Error(`Method ${method} not found for ${path}`);

  const responseSpec = methodSpec.responses[status];
  if (!responseSpec) throw new Error(`Response ${status} not found for ${method} ${path}`);

  return responseSpec.content['application/json'].schema;
}

/**
 * Extract schema from AsyncAPI spec
 */
function getWebSocketSchema(eventName) {
  const channel = asyncapi.channels[eventName];
  if (!channel) throw new Error(`Event ${eventName} not found in AsyncAPI spec`);

  return channel.publish.message.payload;
}

/**
 * Validate HTTP response against OpenAPI schema
 */
function validateHTTPResponse(response, path, method, expectedStatus = 200) {
  // Check status code
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}\n` +
      `Response body: ${JSON.stringify(response.body, null, 2)}`
    );
  }

  // Get schema
  const schema = getHTTPSchema(path, method, expectedStatus.toString());

  // Validate
  const validate = ajv.compile(schema);
  const valid = validate(response.body);

  if (!valid) {
    const errors = ajv.errorsText(validate.errors, {
      separator: '\n  ',
      dataVar: 'response.body'
    });
    throw new Error(
      `HTTP Response failed OpenAPI validation:\n` +
      `  Endpoint: ${method.toUpperCase()} ${path}\n` +
      `  Errors:\n  ${errors}\n` +
      `  Actual response: ${JSON.stringify(response.body, null, 2)}`
    );
  }

  return true;
}

/**
 * Validate WebSocket event against AsyncAPI schema
 */
function validateWebSocketEvent(event, eventName) {
  // Get schema
  const schema = getWebSocketSchema(eventName);

  // Validate
  const validate = ajv.compile(schema);
  const valid = validate(event);

  if (!valid) {
    const errors = ajv.errorsText(validate.errors, {
      separator: '\n  ',
      dataVar: 'event'
    });
    throw new Error(
      `WebSocket Event failed AsyncAPI validation:\n` +
      `  Event: ${eventName}\n` +
      `  Errors:\n  ${errors}\n` +
      `  Actual event: ${JSON.stringify(event, null, 2)}`
    );
  }

  return true;
}

module.exports = {
  validateHTTPResponse,
  validateWebSocketEvent,
};
```

**Total code**: 85 lines (including comments)

#### Usage in Tests

**HTTP Contract Test Example**:
```javascript
const request = require('supertest');
const app = require('../../src/app');
const { validateHTTPResponse } = require('../helpers/contract-validator');

describe('HTTP API Contracts', () => {
  it('POST /api/scan matches OpenAPI contract', async () => {
    const response = await request(app)
      .post('/api/scan')
      .send({
        tokenId: '534e2b03',        // Actual token ID from tokens.json
        teamId: '001',               // 3-digit zero-padded string (optional)
        deviceId: 'PLAYER_SCANNER_01',  // deviceId per Decision #4
        timestamp: new Date().toISOString()
      });

    // Single line validates entire response against OpenAPI schema
    validateHTTPResponse(response, '/api/scan', 'post', 200);
  });

  it('POST /api/scan error response matches OpenAPI contract', async () => {
    const response = await request(app)
      .post('/api/scan')
      .send({}); // Missing required fields

    // Validates error response structure
    validateHTTPResponse(response, '/api/scan', 'post', 400);
  });
});
```

**WebSocket Contract Test Example**:
```javascript
const { setupTestServer, cleanupTestServer } = require('./ws-test-utils');
const { connectAndIdentify, waitForEvent } = require('../integration/test-helpers');
const { validateWebSocketEvent } = require('../helpers/contract-validator');

describe('WebSocket Event Contracts', () => {
  let testContext;

  beforeEach(async () => {
    testContext = await setupTestServer();
  });

  afterEach(async () => {
    await cleanupTestServer(testContext);
  });

  it('transaction:new matches AsyncAPI contract', async () => {
    // Connect real GM scanner
    const socket = await connectAndIdentify(
      testContext.socketUrl,
      'gm',
      'GM_TEST_01'
    );

    // Trigger real backend event (uses wrapped envelope per Decision #2)
    socket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',            // 3-digit zero-padded string
        deviceId: 'GM_TEST_01',   // deviceId per Decision #4
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    // Wait for real broadcast from backend
    const event = await waitForEvent(socket, 'transaction:new');

    // Single line validates entire event against AsyncAPI schema
    validateWebSocketEvent(event, 'transaction:new');

    socket.disconnect();
  });
});
```

### Error Messages

**HTTP Validation Error Example**:
```
HTTP Response failed OpenAPI validation:
  Endpoint: POST /api/scan
  Errors:
  response.body.queueLength: must have required property 'queueLength'
  response.body.status: must be equal to one of the allowed values
  Actual response: {
    "status": "invalid_value",
    "message": "Scan accepted"
  }
```

**WebSocket Validation Error Example**:
```
WebSocket Event failed AsyncAPI validation:
  Event: transaction:new
  Errors:
  event.data.transaction.teamId: must have required property 'teamId'
  event.timestamp: must match format "date-time"
  Actual event: {
    "event": "transaction:new",
    "data": {
      "transaction": {
        "id": "tx-123",
        "tokenId": "TEST_001"
      }
    },
    "timestamp": "invalid-date"
  }
```

### Benefits

1. **Unified System**: ONE validation approach for all APIs (HTTP + WebSocket)
2. **Clear Errors**: Explicit error messages show exactly what failed and why
3. **Contracts Drive Tests**: Tests read from OpenAPI/AsyncAPI YAML (single source of truth)
4. **Minimal Dependencies**: Only ajv + ajv-formats (120kb, industry standard)
5. **You Own It**: 85 lines of code you control (never breaks from external changes)
6. **Consistent Patterns**: All contract tests look the same (easy to write new ones)
7. **Debuggable**: Clear, explicit code (no magic, no black boxes)
8. **Future-Proof**: ajv is the industry standard JSON Schema validator (will be maintained)

### Breaking Changes

- ❌ **None for HTTP**: Existing HTTP contract tests will be updated to use `validateHTTPResponse()` (same supertest patterns)
- ❌ **Complete redesign for WebSocket**: Current fake tests replaced with real connection tests (already identified as broken in Phase 4.5 Step 2)

### Migration Plan

1. **Install dependencies**: `npm install --save-dev ajv ajv-formats`
2. **Create helper**: Write `contract-validator.js` (85 lines, ~45 min)
3. **Update HTTP tests**: Replace manual assertions with `validateHTTPResponse()` (~2 hours)
4. **Redesign WebSocket tests**: Create new tests with real connections + `validateWebSocketEvent()` (~12 hours, part of Phase 4.5 overall effort)

### Success Criteria

- ✅ All contract tests validate against OpenAPI/AsyncAPI schemas
- ✅ HTTP and WebSocket tests use same validation approach
- ✅ Clear error messages when validation fails
- ✅ Tests read from contracts (single source of truth)
- ✅ Fast test execution (contract tests complete in <10 seconds)

---

## Decision 2: WebSocket Contract Test Infrastructure

**Status**: ✅ APPROVED
**Date**: 2025-09-30

### Problem Statement

WebSocket contract tests currently validate **fake example objects** instead of real backend behavior. We need to redesign them to:
1. Use real WebSocket connections (like integration tests do)
2. Trigger actual backend events (not test mock objects)
3. Validate emitted events against AsyncAPI contracts
4. Use consistent async patterns (promises, not done() callbacks)
5. Integrate with Decision 1 (pure ajv validation)

From Phase 4.5 Step 2 analysis:
- ❌ Current approach validates fake objects (useless for catching regressions)
- ✅ Working patterns exist in integration tests
- ✅ Good infrastructure exists (ws-test-utils.js, test-helpers.js)

### Current State

**What Works Well**:

**1. WebSocket Test Infrastructure** (`ws-test-utils.js`):
- ✅ `setupTestServer()` - Real server with dynamic port allocation (197 lines)
- ✅ `cleanupTestServer()` - Comprehensive cleanup (prevents test contamination)
- ✅ Real server (not mocks), full service initialization

**2. Integration Test Helpers** (`test-helpers.js`):
- ✅ `waitForEvent()` - Promise-based event waiting with timeout protection
- ✅ `connectAndIdentify()` - Connect + identify in one call
- ✅ Promise-based (clean async/await, no done() callbacks)
- ✅ Well-tested (used by 500-line gm_scanner.test.js successfully)

**What Doesn't Work**:

**Current Contract Tests** (`websocket-contracts-simple.test.js` - 306 lines):
```javascript
// ❌ USELESS: Tests fake objects, not real backend
it('should have correct structure', () => {
  const exampleBroadcast = {  // ← FAKE!
    transaction: { id: 'tx-123' }
  };
  expect(exampleBroadcast).toHaveProperty('transaction');
});
```

**Problems**:
- Zero validation of actual backend behavior
- No Socket.IO connection
- Can't catch regressions
- Backend could emit anything → tests still pass

### Options Considered

**Option A: Inline Tests (No Shared Base)**
- Each test sets up server, connects, validates, cleans up
- **Pros**: Simple, explicit, no abstraction, easy to debug
- **Cons**: Repetitive setup (~15 lines per test), manual socket cleanup

**Option B: Shared Base Class**
- Create `ContractTestBase` class with common setup/teardown
- **Pros**: Less repetition, auto cleanup, shorter tests (~3-5 lines)
- **Cons**: New abstraction layer, less explicit, harder to customize, against "minimal complexity" goal

**Option C: Inline with `withSocket()` Helper**
- Inline tests + tiny helper for socket lifecycle management
- **Pros**: Guaranteed cleanup, still explicit, minimal abstraction (10 lines), flexible, balances brevity and clarity
- **Cons**: Slightly more nesting (callback pattern), one new helper

### Decision: Option C - Inline with `withSocket()` Helper

**Rationale**:

1. **Minimal Architectural Complexity** (Project Goal):
   - ONE tiny helper (10 lines) vs entire base class
   - Still explicit (all logic visible in test)
   - Easy to understand 6 months later

2. **Balances Clarity and Brevity**:
   - Guaranteed socket cleanup (try/finally)
   - Tests are readable (~10 lines each)
   - Can customize per test if needed

3. **Aligns with Existing Patterns**:
   - Integration tests are inline (no base class)
   - Uses existing helpers (setupTestServer, connectAndIdentify, waitForEvent)
   - Promises everywhere (consistent with codebase)

4. **Live Event Tool Reality**:
   - "Can I debug this at 9pm?" → Yes (simple, explicit)
   - No magic, no hidden complexity
   - Easy to add new tests (copy/paste pattern)

5. **Flexible**:
   - Some tests need multiple sockets (device:connected)
   - Some tests need admin setup first (session:new)
   - Inline pattern handles all cases easily

### Implementation

#### Add `withSocket()` Helper

**File**: `backend/tests/integration/test-helpers.js` (add to existing file)

```javascript
/**
 * Execute test function with connected socket, guaranteed cleanup
 * @param {Object} testContext - Test context from setupTestServer
 * @param {string} deviceType - Device type ('gm' or 'scanner')
 * @param {string} deviceId - Device ID
 * @param {Function} testFn - Async test function receiving socket
 * @returns {Promise} Test function result
 */
async function withSocket(testContext, deviceType, deviceId, testFn) {
  const socket = await connectAndIdentify(
    testContext.socketUrl,
    deviceType,
    deviceId
  );

  try {
    return await testFn(socket);
  } finally {
    if (socket && socket.connected) {
      socket.disconnect();
    }
  }
}

module.exports = {
  createTrackedSocket,
  waitForEvent,
  connectAndIdentify,
  waitForMultipleEvents,
  cleanupSockets,
  testDelay,
  withSocket,  // NEW
};
```

**Total code**: 10 lines

#### WebSocket Contract Test Pattern

**File**: `backend/tests/contract/websocket-contracts.test.js` (redesigned)

```javascript
const { setupTestServer, cleanupTestServer } = require('./ws-test-utils');
const { withSocket, waitForEvent } = require('../integration/test-helpers');
const { validateWebSocketEvent } = require('../helpers/contract-validator');

describe('WebSocket Event Contracts', () => {
  let testContext;

  beforeEach(async () => {
    testContext = await setupTestServer();
  });

  afterEach(async () => {
    await cleanupTestServer(testContext);
  });

  it('transaction:new matches AsyncAPI contract', async () => {
    await withSocket(testContext, 'gm', 'GM_TEST_01', async (socket) => {
      // Trigger backend event (wrapped envelope per Decision #2)
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '001',              // 3-digit zero-padded string
          deviceId: 'GM_TEST_01',     // deviceId per Decision #4
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for broadcast
      const event = await waitForEvent(socket, 'transaction:new');

      // Validate against AsyncAPI contract
      validateWebSocketEvent(event, 'transaction:new');
    });
  });

  it('score:updated matches AsyncAPI contract', async () => {
    await withSocket(testContext, 'gm', 'GM_TEST_01', async (socket) => {
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '001',
          deviceId: 'GM_TEST_01',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const event = await waitForEvent(socket, 'score:updated');
      validateWebSocketEvent(event, 'score:updated');
    });
  });

  // Test requiring multiple sockets
  it('device:connected matches AsyncAPI contract', async () => {
    // First socket for admin monitoring
    await withSocket(testContext, 'gm', 'GM_ADMIN', async (adminSocket) => {
      // Second socket triggers device:connected event
      await withSocket(testContext, 'gm', 'GM_NEW', async (newSocket) => {
        const event = await waitForEvent(adminSocket, 'device:connected');
        validateWebSocketEvent(event, 'device:connected');
      });
    });
  });
});
```

### Additional Standards

#### 1. Use Promises Everywhere

**Standard Pattern**:
```javascript
it('test name', async () => {
  // All async operations use await
  const result = await asyncOperation();
  expect(result).toBe(expected);
});
```

**Never use done() callbacks**:
```javascript
// ❌ DON'T DO THIS (causes timing issues, tests can hang)
it('test', (done) => {
  socket.on('event', () => {
    done(); // Easy to forget, no timeout protection
  });
});
```

**Rationale**:
- Your helpers are promise-based (`waitForEvent` returns Promise)
- All working integration tests use async/await
- Jest supports async/await natively
- Cleaner error handling (try/catch)
- No hanging tests (Jest timeout catches stuck promises)
- More readable

#### 2. Always Use Timeout-Protected Helpers

Your `waitForEvent()` already has 5-second timeout ✅

```javascript
// ✅ GOOD: Timeout protection built-in
const event = await waitForEvent(socket, 'transaction:new', 5000);

// ❌ DON'T DO THIS: Manual promise without timeout
await new Promise(resolve => socket.once('event', resolve)); // Can hang forever
```

#### 3. Jest Configuration Already Correct

From `jest.config.js`:
```javascript
{
  testTimeout: 10000,     // ✅ 10 seconds (good for WebSocket tests)
  clearMocks: true,       // ✅ Clean state between tests
  resetMocks: true,
  restoreMocks: true,
  resetModules: true,     // ✅ Fresh instances
}
```

**No changes needed** ✅

### Benefits

1. **Guaranteed Cleanup**: try/finally ensures socket disconnects even if test fails
2. **Minimal Abstraction**: Just 10 lines, easy to understand
3. **Explicit Logic**: Test body shows exactly what happens
4. **Flexible**: Easy to use multiple sockets, custom setup per test
5. **Consistent**: Uses existing helpers (no new patterns to learn)
6. **Debuggable**: Clear error messages, visible flow
7. **Tests Real Behavior**: Validates actual backend emissions (catches regressions)

### Comparison

| Aspect | Option A (Inline) | Option B (Base Class) | Option C (withSocket) |
|--------|-------------------|----------------------|----------------------|
| **Lines per test** | ~15 | ~3-5 | ~10 |
| **Cleanup guarantee** | Manual (can forget) | Auto | Auto ✅ |
| **Flexibility** | High ✅ | Low | High ✅ |
| **Complexity** | None ✅ | High (abstraction) | Minimal ✅ |
| **Explicit logic** | Yes ✅ | Hidden | Yes ✅ |
| **New code** | 0 lines | ~50 lines | 10 lines ✅ |
| **Debuggability** | Easy ✅ | Harder | Easy ✅ |

### Breaking Changes

- ❌ **Complete redesign**: Current fake WebSocket tests replaced entirely
- ✅ **Infrastructure reused**: Existing helpers (setupTestServer, waitForEvent) work as-is
- ✅ **Pattern familiar**: Same pattern as integration tests (easy to understand)

### Migration Plan

1. **Add `withSocket()` helper** to test-helpers.js (10 lines, ~5 min)
2. **Redesign WebSocket contract tests** to use real connections (~12 hours):
   - Replace fake object tests with real connection tests
   - Use `withSocket()` for socket lifecycle
   - Use `validateWebSocketEvent()` from Decision 1
   - Cover all 15+ WebSocket events from AsyncAPI

### Success Criteria

- ✅ All WebSocket contract tests use real Socket.IO connections
- ✅ Tests validate actual backend event emissions
- ✅ Consistent async patterns (promises everywhere)
- ✅ Guaranteed socket cleanup (no test contamination)
- ✅ Clear test failures when contracts violated
- ✅ Tests read from AsyncAPI contract (single source of truth)

---

## Decision 3: Test Organization & Proper Test Pyramid

**Status**: ✅ APPROVED
**Date**: 2025-09-30

### Problem Statement

Current test suite has an **inverted test pyramid** - most tests are at integration level but actually test unit-level concerns (business logic) or contract-level concerns (API structure). This violates the Contract-First principle and proper testing practices.

**Current Reality** (Inverted Pyramid):
```
         ▲
        ╱ ╲        1-2 Unit tests (offlineQueueService, offlineStatus)
       ╱   ╲
      ╱     ╲      0 True contract tests (current ones validate fake objects)
     ╱       ╲
    ╱         ╲    60+ Integration tests (but most test unit/contract concerns)
   ╱___________╲
```

**What We Need** (Proper Pyramid):
```
         ▲
        ╱ ╲        5-10 Integration tests (TRUE multi-component flows)
       ╱   ╲
      ╱     ╲      30-40 Contract tests (API structure validation)
     ╱       ╲
    ╱         ╲    100+ Unit tests (Business logic, isolated)
   ╱___________╲
```

### Current State Analysis

**Test Audit Results**:

**GM Scanner Tests** (13 tests):
- Only **1-2** are true integration tests (broadcast flow, multi-GM coordination)
- **8-10** should be unit tests (duplicate detection, token claiming, score calculation logic)
- **2-3** should be contract tests (event structure validation)

**Admin Panel Tests** (10 tests):
- Only **2-3** are true integration tests (session lifecycle flow, device tracking)
- **4-5** should be unit tests (auth middleware, session logic)
- **3-4** should be contract tests (HTTP response structure)

**Pattern**: Most "integration" tests are actually testing:
- Business logic in isolation → Should be **unit tests**
- API response structure → Should be **contract tests**
- NOT actual component integration → Only few should remain as integration tests

### Test Categorization Examples

**Example 1**: Currently integration, should be **UNIT**
```javascript
// Current: gm_scanner.test.js (integration level - real server, real WebSocket)
it('should detect duplicates within same session', async () => {
  gmSocket.emit('transaction:submit', { tokenId: 'TEST_001', teamId: 'TEAM_A' });
  const first = await waitForEvent(gmSocket, 'transaction:result');
  expect(first.status).toBe('accepted');

  gmSocket.emit('transaction:submit', { tokenId: 'TEST_001', teamId: 'TEAM_A' });
  const second = await waitForEvent(gmSocket, 'transaction:result');
  expect(second.status).toBe('duplicate'); // ← Testing LOGIC, not integration
});

// Should be: unit/services/transactionService.test.js (unit level - mocked dependencies)
it('should detect duplicate token in same session', () => {
  mockStateService.hasTokenBeenScanned.mockReturnValue(true);

  const result = transactionService.detectDuplicate('TOKEN_001', 'session-123');

  expect(result).toBe(true); // ← Tests logic in isolation
});
```

**Example 2**: Currently integration, should be **CONTRACT**
```javascript
// Current: admin_panel.test.js (integration level)
it('should authenticate admin with correct password', async () => {
  const response = await request(app).post('/api/admin/auth').send({ password: 'test' });
  expect(response.body).toHaveProperty('token'); // ← Testing STRUCTURE, not flow
  expect(response.body.token).toMatch(/^[A-Za-z0-9-._~+/]+=*$/);
});

// Should be: contract/http/admin-auth.contract.test.js (contract level)
it('POST /api/admin/auth matches OpenAPI contract', async () => {
  const response = await request(app).post('/api/admin/auth').send({ password: 'test' });
  validateHTTPResponse(response, '/api/admin/auth', 'post', 200); // ← Validates against schema
});
```

**Example 3**: TRUE integration test (keep as-is)
```javascript
// integration/transaction-broadcast-flow.test.js
it('should broadcast transaction:new to all connected GMs', async () => {
  const gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_01');
  const gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_02');

  gm1.emit('transaction:submit', { tokenId: 'TEST_001', teamId: 'TEAM_A', deviceId: 'GM_01' });

  // ← Tests INTEGRATION of WebSocket + service + broadcast infrastructure
  const [event1, event2] = await Promise.all([
    waitForEvent(gm1, 'transaction:new'),
    waitForEvent(gm2, 'transaction:new')
  ]);

  expect(event1.data.tokenId).toBe('TEST_001');
  expect(event2).toEqual(event1);
});
```

### Options Considered

**Option A: Keep Current Structure**
- Keep inverted pyramid
- **Cons**: Wrong test levels, slow tests, hard to isolate failures, violates Contract-First

**Option B: Reorganize into Proper Test Pyramid**
- Move logic tests → unit tests
- Move structure tests → contract tests
- Keep only flow tests → integration tests
- Clean up tests that don't fit
- **Pros**: Proper test pyramid, fast unit tests, clear contract validation, minimal integration tests

### Decision: Option B - Reorganize into Proper Test Pyramid

**Rationale**:

1. **Aligns with Contract-First** (Core Principle):
   - Contract tests validate API structure (Decision 1: ajv)
   - Unit tests validate business logic
   - Integration tests validate component integration
   - Each test at correct level

2. **Already Redesigning Tests**:
   - WebSocket contract tests need complete redesign (Decision 2)
   - gm_scanner.test.js disabled and needs fixes
   - This is the PERFECT time to reorganize properly
   - Incremental cost, not additional work

3. **Tests-First Refactoring**:
   - Proper unit tests guide implementation
   - "Make this unit test pass" = clear, isolated goal
   - Integration tests validate overall flows
   - Test failures clearly indicate what's broken (unit logic vs integration)

4. **Performance**:
   - Unit tests run in milliseconds (no server, no WebSocket)
   - Contract tests run in seconds (real connections, minimal logic)
   - Integration tests run when needed (few tests, comprehensive flows)
   - Faster development feedback loop

5. **Maintainability**:
   - Unit tests easy to write (mock dependencies)
   - Contract tests driven by OpenAPI/AsyncAPI (single source of truth)
   - Integration tests focused (only true multi-component flows)
   - Clear test failure = clear fix location

### Implementation

#### New Test Structure

```
backend/tests/
│
├── contract/                          ← 25-35 tests (API structure validation)
│   ├── http/
│   │   ├── scan.contract.test.js                (POST /api/scan)
│   │   ├── scan-batch.contract.test.js          (POST /api/scan/batch)
│   │   ├── session.contract.test.js             (GET /api/session)
│   │   ├── admin-auth.contract.test.js          (POST /api/admin/auth)
│   │   ├── admin-logs.contract.test.js          (GET /api/admin/logs)
│   │   ├── state.contract.test.js               (GET /api/state)
│   │   ├── tokens.contract.test.js              (GET /api/tokens)
│   │   ├── health.contract.test.js              (GET /health)
│   │   └── errors.contract.test.js              (Error response structures)
│   │
│   ├── websocket/
│   │   ├── gm-auth.contract.test.js             (gm:identify, gm:identified)
│   │   ├── device-events.contract.test.js       (device:connected, device:disconnected)
│   │   ├── sync-full.contract.test.js           (sync:full)
│   │   ├── transaction-submit.contract.test.js  (transaction:submit, transaction:result)
│   │   ├── transaction-new.contract.test.js     (transaction:new broadcast)
│   │   ├── score-updated.contract.test.js       (score:updated broadcast)
│   │   ├── video-status.contract.test.js        (video:status)
│   │   ├── session-update.contract.test.js      (session:update)
│   │   ├── gm-command.contract.test.js          (gm:command, gm:command:ack)
│   │   ├── offline-queue.contract.test.js       (offline:queue:processed)
│   │   ├── group-completed.contract.test.js     (group:completed)
│   │   └── error.contract.test.js               (error event)
│   │
│   ├── helpers/
│   │   └── contract-validator.js                (Decision 1: ajv validation)
│   ├── http-test-utils.js
│   └── ws-test-utils.js
│
├── integration/                       ← 5-10 tests (TRUE multi-component flows)
│   ├── transaction-broadcast-flow.test.js       (GM submits → all GMs receive)
│   ├── session-lifecycle-flow.test.js           (Create → pause → resume → end)
│   ├── offline-recovery-flow.test.js            (Offline → queue → online → process)
│   ├── device-tracking-flow.test.js             (Multiple GMs → admin sees all)
│   ├── score-update-flow.test.js                (Transaction → calc → broadcast)
│   ├── video-playback-flow.test.js              (Scan → queue → VLC plays)
│   ├── network-recovery.test.js                 (Keep: tests network resilience)
│   └── test-helpers.js
│
└── unit/                              ← 100+ tests (Business logic, isolated)
    ├── services/
    │   ├── transactionService.test.js           (detectDuplicate, claimToken, validateToken)
    │   ├── scoringService.test.js               (calculateScore, updateTeamScore)
    │   ├── stateService.test.js                 (updateState, syncState)
    │   ├── sessionService.test.js               (createSession, pauseSession, etc.)
    │   ├── videoQueueService.test.js            (queueVideo, processQueue)
    │   ├── offlineQueueService.test.js          (Keep existing: already good ✅)
    │   ├── broadcastService.test.js             (formatBroadcast, sendToRoom)
    │   └── authService.test.js                  (validatePassword, generateToken)
    │
    ├── middleware/
    │   ├── authMiddleware.test.js               (token validation, protected routes)
    │   ├── offlineStatus.test.js                (Keep existing: already good ✅)
    │   └── validation.test.js                   (request validation logic)
    │
    └── websocket/
        ├── gmAuth.test.js                       (GM identification logic)
        └── deviceTracking.test.js               (device connect/disconnect logic)
```

#### Test Level Guidelines

**Contract Tests**:
- **Purpose**: Validate API structure matches contracts
- **Scope**: Field existence, types, HTTP codes, event structure
- **Do**: Validate response shape, required fields, data types
- **Don't**: Test business logic, state transitions, complex flows
- **Pattern**: Real API call + schema validation (Decision 1: ajv)

**Integration Tests**:
- **Purpose**: Validate multi-component flows
- **Scope**: Complete user journeys, component integration
- **Do**: Test real HTTP/WebSocket flows, multi-step processes
- **Don't**: Test every code path, test component internals
- **Pattern**: Real server + real connections + flow validation

**Unit Tests**:
- **Purpose**: Validate component logic in isolation
- **Scope**: Single function/class, mocked dependencies
- **Do**: Test edge cases, error paths, pure logic
- **Don't**: Test integration, real HTTP/WebSocket
- **Pattern**: Mock dependencies + test logic + fast execution

#### Unit Test Example

**File**: `backend/tests/unit/services/transactionService.test.js`

```javascript
const TransactionService = require('../../../src/services/transactionService');

describe('TransactionService', () => {
  let transactionService;
  let mockSessionService;
  let mockStateService;
  let mockTokenService;

  beforeEach(() => {
    // Mock dependencies
    mockSessionService = {
      getCurrentSession: jest.fn().mockReturnValue({ id: 'session-123' })
    };
    mockStateService = {
      hasTokenBeenScanned: jest.fn(),
      getTokenClaim: jest.fn(),
      addTransaction: jest.fn()
    };
    mockTokenService = {
      validateToken: jest.fn(),
      getTokenData: jest.fn()
    };

    // Create service with mocked dependencies
    transactionService = new TransactionService({
      sessionService: mockSessionService,
      stateService: mockStateService,
      tokenService: mockTokenService
    });
  });

  describe('detectDuplicate', () => {
    it('should detect duplicate token in same session', () => {
      mockStateService.hasTokenBeenScanned.mockReturnValue(true);

      const result = transactionService.detectDuplicate('TOKEN_001', 'session-123');

      expect(result).toBe(true);
      expect(mockStateService.hasTokenBeenScanned).toHaveBeenCalledWith('TOKEN_001', 'session-123');
    });

    it('should allow same token in different session', () => {
      mockStateService.hasTokenBeenScanned.mockReturnValue(false);

      const result = transactionService.detectDuplicate('TOKEN_001', 'session-456');

      expect(result).toBe(false);
    });

    it('should handle session without scanned tokens', () => {
      mockStateService.hasTokenBeenScanned.mockReturnValue(false);

      const result = transactionService.detectDuplicate('TOKEN_001', 'new-session');

      expect(result).toBe(false);
    });
  });

  describe('claimToken', () => {
    it('should allow first team to claim token', () => {
      mockStateService.getTokenClaim.mockReturnValue(null);

      const result = transactionService.claimToken('534e2b03', '001', 'session-123');

      expect(result.success).toBe(true);
      expect(result.claimedBy).toBe('001');  // 3-digit zero-padded string
      expect(mockStateService.addTransaction).toHaveBeenCalled();
    });

    it('should reject second team claiming same token', () => {
      mockStateService.getTokenClaim.mockReturnValue({
        team: '001',  // 3-digit format
        transactionId: 'tx-123'
      });

      const result = transactionService.claimToken('534e2b03', '002', 'session-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('already_claimed');
      expect(result.claimedBy).toBe('001');
      expect(result.originalTransactionId).toBe('tx-123');
    });

    it('should allow same team to claim same token (idempotent)', () => {
      mockStateService.getTokenClaim.mockReturnValue({
        team: '001',
        transactionId: 'tx-123'
      });

      const result = transactionService.claimToken('534e2b03', '001', 'session-123');

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.originalTransactionId).toBe('tx-123');
    });
  });

  describe('validateToken', () => {
    it('should accept valid token ID', () => {
      mockTokenService.validateToken.mockReturnValue(true);
      mockTokenService.getTokenData.mockReturnValue({ id: 'TOKEN_001', value: 10 });

      const result = transactionService.validateToken('TOKEN_001');

      expect(result.valid).toBe(true);
      expect(result.tokenData).toBeDefined();
    });

    it('should reject invalid token ID', () => {
      mockTokenService.validateToken.mockReturnValue(false);

      const result = transactionService.validateToken('INVALID_TOKEN');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('invalid_token');
    });

    it('should reject null token ID', () => {
      const result = transactionService.validateToken(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('missing_token_id');
    });
  });
});
```

**Characteristics**:
- ✅ Fast (no server, no WebSocket, pure logic)
- ✅ Isolated (mocked dependencies)
- ✅ Comprehensive (tests all edge cases)
- ✅ Clear failures (exactly which logic failed)

### Cleanup Plan

**Remove/Archive**:
1. **Large integration test files** that are actually unit/contract tests:
   - `gm_scanner.test.js.disabled` (499 lines) → Extract to unit/contract
   - `admin_panel.test.js` (568 lines) → Extract to unit/contract
   - `offline_mode.test.js` (503 lines) → Extract to unit/contract
   - `restart_recovery.test.js` (636 lines) → Extract to unit/contract

2. **Current contract tests** (validate fake objects):
   - `websocket-contracts-simple.test.js` (306 lines) → Delete entirely, replace with real tests

3. **Redundant integration tests** (duplicate coverage):
   - Tests that cover same flow as unit tests
   - Tests that only validate structure (should be contract)
   - Tests that don't test integration

**Keep**:
- `network_recovery.test.js` (394 lines) - TRUE integration test ✅
- `player_scanner.test.js` (293 lines) - May need extraction, but has good flow tests
- `video_playback.test.js` (245 lines) - TRUE integration test ✅

### Migration Strategy

**Phase 1: Create Unit Tests** (~40 hours)
- Extract business logic from integration tests
- Create unit tests for all services (20+ files)
- Create unit tests for all middleware (3-5 files)
- Mock dependencies, test logic in isolation

**Phase 2: Create Contract Tests** (~12 hours)
- Already planned in Decision 1 & 2
- HTTP: Use ajv + validateHTTPResponse
- WebSocket: Use ajv + validateWebSocketEvent + real connections

**Phase 3: Consolidate Integration Tests** (~8 hours)
- Identify TRUE multi-component flows (5-10 tests)
- Consolidate/rewrite as focused integration tests
- Delete redundant tests

**Phase 4: Cleanup** (~4 hours)
- Remove old large integration files
- Delete fake contract tests
- Update test scripts (package.json)
- Verify test pyramid shape

**Total Effort**: ~64 hours

### Benefits

1. **Proper Test Pyramid**:
   - 100+ unit tests (fast, isolated, comprehensive)
   - 30-40 contract tests (validate API contracts)
   - 5-10 integration tests (validate flows)
   - Correct balance for maintainability

2. **Fast Development Feedback**:
   - Unit tests run in milliseconds
   - `npm test unit/` during development
   - Quick validation of logic changes

3. **Clear Test Failures**:
   - Unit test fails → Logic bug in specific service
   - Contract test fails → API structure doesn't match contract
   - Integration test fails → Components not integrating correctly

4. **Aligns with Contract-First**:
   - Contract tests validate contracts (Decision 1: ajv)
   - Unit tests validate implementation logic
   - Integration tests validate system behavior
   - Each test at correct level

5. **Supports Test-Driven Refactor**:
   - Write/fix unit tests first (isolated, fast)
   - Fix contract tests (validate structure)
   - Fix integration tests (validate flows)
   - Clear progression through refactor

### Success Criteria

- ✅ 100+ unit tests (services, middleware, websocket logic)
- ✅ 25-35 contract tests (24 essential APIs per Phase 4.9)
- ✅ 5-10 integration tests (only TRUE multi-component flows)
- ✅ Proper test pyramid shape
- ✅ Fast test execution (unit tests < 1 second total)
- ✅ Clear test failures guide implementation
- ✅ All tests at correct level (no inverted pyramid)

---

## Additional Context: Critical Constraints from Later Phases

**Added 2025-09-30** after Phase 4.75, 4.9, and 5 discoveries

### Standalone Mode Testing Requirements

**From Phase 4.75 - Functional Requirements** (08-functional-requirements.md):

**CRITICAL ARCHITECTURAL CONSTRAINT**: Scanners MUST work without orchestrator

**Three Operational Modes**:
1. **Networked**: With orchestrator (server authoritative, cross-device sync, video playback)
2. **Offline (Temporary)**: Lost connection (queue scans, provisional scores, will sync)
3. **Standalone (Permanent)**: No orchestrator (client authoritative, local scores, independent operation)

**Testing Implications**:

**Unit Tests MUST validate client-side game logic** (used in standalone mode):
- Score calculation (client-side, without server)
- Duplicate detection (within scanner's session)
- Group completion bonuses (local calculation)
- Token validation (from local tokens.json)

**Contract Tests validate networked mode ONLY**:
- HTTP endpoints require orchestrator
- WebSocket events require orchestrator
- Standalone mode has NO contracts (pure client-side)

**Integration Tests MUST cover mode transitions**:
- Networked → Offline (temporary) → Reconnect → Sync
- Standalone mode initialization (never connects)

**Why This Matters**:
- Cannot remove client-side logic during refactor (standalone depends on it)
- Unit tests protect standalone functionality
- Contract tests only validate networked APIs

---

### Admin Command Transport Change

**From Phase 4.75 + Phase 4.9**:

**11 admin HTTP endpoints ELIMINATED** → Moved to **WebSocket `gm:command`**

**Eliminated**:
```
POST /api/session (create)
PUT /api/session (update)
POST /api/video/control
POST /api/admin/reset-scores
POST /api/admin/clear-transactions
POST /api/admin/stop-all-videos
POST /api/admin/offline-mode
GET /api/admin/devices
POST /api/admin/reset
POST /api/admin/config
DELETE /api/transaction/:id
```

**Replaced By**: Single WebSocket `gm:command` event with actions:
- Session: `session:create`, `session:pause`, `session:resume`, `session:end`
- Video: `video:play`, `video:pause`, `video:stop`, `video:skip`, `video:queue:add`, `video:queue:reorder`, `video:queue:clear`
- Score: `score:adjust`
- Transaction: `transaction:delete`, `transaction:create`
- System: `system:reset`

**Testing Implications**:
- **Contract tests**: Cover `gm:command` + `gm:command:ack` extensively
- **Integration tests**: Validate command → ack → side effect flow
- **No HTTP contract tests** for eliminated endpoints

---

### Fire-and-Forget Pattern (Player Scanner)

**From Phase 5 - Contracts** (backend/contracts/README.md):

**Player Scanner IGNORES response bodies** (ESP32 compatibility)

**Why**:
- ESP32 has limited memory/processing
- Player Scanner makes all decisions client-side (from tokens.json)
- Response provided for debugging/future non-ESP32 clients

**Testing Implications**:
- **HTTP contract tests**: Validate response structure EXISTS (for debugging)
- **Unit tests**: Client-side Player Scanner logic (not dependent on response)
- **Integration tests**: Focus on video queue triggering (not response content)

**DO NOT test**: Player Scanner parsing response body (it doesn't)
**DO test**: Response structure valid for debugging/monitoring

---

### ONE Session Model (No Multi-Session)

**From Phase 4.75 - Functional Requirements**:

**System Constraint**: ONE active session at a time (2-hour live event)

**Testing Implications**:
- **No multi-session tests needed** (don't test session switching, session list management)
- **Session tests focus on single session lifecycle**: create → pause → resume → end
- **No session ID lookups** (always "current session")

**Eliminated Test Scope**:
- ❌ Session switching between multiple active sessions
- ❌ Session list management
- ❌ Concurrent session isolation
- ✅ ONLY: Single session lifecycle + state transitions

---

### Pre-Production Context (Atomic Breaking Changes)

**From Phase 5 - MIGRATION-GUIDE.md**:

**Context**:
- **NO backwards compatibility** needed
- **NO users, NO data** to preserve
- **Breaking changes applied atomically** (single PR/commit)
- Pre-production development project

**Testing Implications**:
- **No migration tests** needed (no backwards compatibility layer)
- **No dual-contract validation** (target contracts only)
- **Clean cutover**: Old tests deleted, new tests validate target
- **Test old behavior**: ONLY if preserving during migration, then DELETE

**Cleanup Approach**:
- Delete tests validating eliminated APIs immediately
- Delete tests validating broken behaviors immediately
- No need for "before/after" test suites

---

*Document Status: Complete - All 3 decisions approved + Updated for Phase 5*
*Last Updated: 2025-09-30 (Post-Phase 5 alignment review)*
