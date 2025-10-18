# Phase 5 Investigation Findings
**Date**: 2025-10-03
**Investigator**: Claude Code
**Methodology**: Systematic ground-truth investigation (helpers → tests → execution → meta-analysis)

---

## Executive Summary

**Documentation Claim**: "1 failing, 0 skipped (69 tests passing)"
**Actual Reality**: **6 failing, 69 passing** (75 total tests, 3 failed suites)

The phase5 document contains significant inaccuracies and gaps that would mislead implementation. This investigation reveals:

1. **Test Infrastructure**: ✅ **Excellent** - Well-designed, consistent patterns established
2. **Pattern Adherence**: ⚠️ **Mixed** - Working tests follow patterns perfectly, failing tests reveal implementation gaps
3. **Documentation Quality**: ❌ **Misleading** - Status inaccuracies, missing context, structural issues

---

## Part 1: Test Infrastructure Analysis

### Established Helpers (All Excellent ✅)

#### contract-validator.js
- **Purpose**: ajv-based validation against OpenAPI/AsyncAPI schemas
- **Key Functions**:
  - `validateHTTPResponse(response, path, method, status)` - Validates HTTP response structure
  - `validateWebSocketEvent(eventData, eventName)` - Validates WebSocket event structure
- **Design Quality**: ✅ Perfect - Pre-loads contracts, registers schemas for $ref resolution, clear error messages
- **Pattern**: Finds AsyncAPI messages by 'name' field in components/messages (AsyncAPI 2.6 spec)

#### websocket-helpers.js
- **Purpose**: Promise-based WebSocket test utilities
- **Key Functions**:
  - `waitForEvent(socket, eventName, timeout=5000)` - Timeout-protected event waiting
  - `connectAndIdentify(socketUrl, deviceType, deviceId)` - Connect + auth handshake in one call
  - `createTrackedSocket(url, options)` - Socket creation with cleanup tracking
- **Design Quality**: ✅ Perfect - Consistent promises, timeout protection, cleanup tracking
- **Pattern**: Always returns promises (never done() callbacks), 5-second default timeout

#### test-server.js
- **Purpose**: Real HTTP + WebSocket server for contract tests
- **Key Functions**:
  - `setupTestServer()` - Initializes services, creates server, sets up WebSocket handlers, registers broadcast listeners
  - `cleanupTestServer(context)` - Closes sockets, server, resets services, removes event listeners
- **Design Quality**: ✅ Perfect - Real server (not mocks), comprehensive cleanup, prevents test contamination
- **Pattern**: Returns `{server, io, port, url, socketUrl}` context object

---

## Part 2: Established Test Patterns

### WebSocket Contract Test Pattern (EXCELLENT ✅)

**Files Demonstrating Pattern**:
- ✅ `session-events.test.js` (1/1 passing) - **GOLD STANDARD**
- ✅ `auth-events.test.js` (3/3 passing) - **GOLD STANDARD**
- ⚠️ `transaction-events.test.js` (2/3 passing, 1 timeout due to impl bug)

**Pattern Structure**:
```javascript
const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent } = require('../../helpers/websocket-helpers');
const { setupTestServer, cleanupTestServer } = require('../../helpers/test-server');
const sessionService = require('../../../src/services/sessionService');

describe('Event Name - Contract Validation', () => {
  let testContext;
  let socket;

  beforeAll(async () => {
    testContext = await setupTestServer(); // Once per suite
  });

  afterAll(async () => {
    await cleanupTestServer(testContext); // Once per suite
  });

  beforeEach(async () => {
    await sessionService.reset(); // Clean state per test
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'DEVICE_ID'); // Connect + auth
  });

  afterEach(async () => {
    if (socket && socket.connected) socket.disconnect(); // Cleanup socket
    await sessionService.reset(); // Clean state again
  });

  it('should emit event matching AsyncAPI schema', async () => {
    // Setup: Listen BEFORE triggering
    const eventPromise = waitForEvent(socket, 'event:name');

    // Trigger: Emit or call service method
    socket.emit('trigger:event', { wrapped: 'envelope', data: {}, timestamp: '...' });

    // Wait: For event (timeout-protected)
    const event = await eventPromise;

    // Validate: Wrapped envelope structure
    expect(event).toHaveProperty('event', 'event:name');
    expect(event).toHaveProperty('data');
    expect(event).toHaveProperty('timestamp');
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601

    // Validate: Against AsyncAPI contract (ajv)
    validateWebSocketEvent(event, 'event:name');
  });
});
```

**Key Principles**:
1. ✅ Listen BEFORE triggering (setup event promise first)
2. ✅ Use timeout-protected helpers (waitForEvent defaults to 5s)
3. ✅ Always validate wrapped envelope: `{event, data, timestamp}`
4. ✅ Always validate against AsyncAPI contract with ajv
5. ✅ Reset services before AND after each test
6. ✅ Disconnect sockets in afterEach
7. ✅ Use promises everywhere (never done() callbacks)

**Two Connection Patterns** (both valid):
- **Pattern A**: Use `connectAndIdentify()` helper (most tests) - Convenient for tests not testing handshake
- **Pattern B**: Manual `createTrackedSocket()` + `waitForEvent('connect')` + emit `gm:identify` + `waitForEvent('gm:identified')` - For tests that need to test the handshake itself

### HTTP Contract Test Pattern (EXCELLENT ✅)

**Files Demonstrating Pattern**:
- ✅ `scan.test.js` - Validates player scanner endpoints
- ✅ `session.test.js` - Validates session endpoint

**Pattern Structure**:
```javascript
const request = require('supertest');
const app = require('../../../src/app');
const { validateHTTPResponse } = require('../../helpers/contract-validator');

describe('POST /api/endpoint', () => {
  it('should match OpenAPI contract', async () => {
    const response = await request(app.app)
      .post('/api/endpoint')
      .send({ field: 'value' })
      .expect(200);

    validateHTTPResponse(response, '/api/endpoint', 'post', 200);
  });

  it('should return error structure on validation failure', async () => {
    const response = await request(app.app)
      .post('/api/endpoint')
      .send({}) // Missing required fields
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
  });
});
```

**Key Principles**:
1. ✅ Use supertest to make requests to `app.app`
2. ✅ Use `.expect(statusCode)` for status validation
3. ✅ Call `validateHTTPResponse()` for schema validation
4. ✅ Additional manual assertions for specific field validation
5. ✅ Test both success AND error cases

### Unit Test Pattern (GOOD ✅)

**Files Demonstrating Pattern**:
- ✅ `sessionService.test.js` - Tests UNWRAPPED domain events
- ⚠️ `transactionService.test.js` (4 failing tests reveal implementation gaps)

**Pattern Structure**:
```javascript
const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const sessionService = require('../../../src/services/sessionService');

describe('ServiceName - Event Emission', () => {
  beforeEach(async () => {
    await sessionService.reset();
  });

  afterEach(async () => {
    sessionService.removeAllListeners();
  });

  describe('Domain events (unwrapped)', () => {
    it('should emit domain event when action occurs', async () => {
      const eventPromise = new Promise((resolve) => {
        sessionService.once('event:name', resolve); // Listen to UNWRAPPED event
      });

      await sessionService.methodCall();

      const eventData = await eventPromise;

      // Validate UNWRAPPED structure (no {event, data, timestamp} wrapper)
      expect(eventData).toHaveProperty('id');
      expect(eventData).toHaveProperty('name');
      expect(eventData).toHaveProperty('status', 'active');
    });
  });
});
```

**Key Principles**:
1. ✅ Tests UNWRAPPED domain events (services emit raw data)
2. ✅ No server, no WebSocket (pure service + listeners)
3. ✅ Uses promises (not done() callbacks in newer tests)
4. ✅ Validates that broadcasts.js will receive correct unwrapped data to wrap

### Integration Test Pattern (GOOD ✅)

**Files Demonstrating Pattern**:
- ✅ `service-events.test.js` - Tests inter-service event communication

**Pattern Structure**:
```javascript
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Service Event Communication', () => {
  beforeEach(async () => {
    await sessionService.reset();
    await transactionService.reset();

    // Re-register listeners after reset
    if (!transactionService.sessionListenerRegistered) {
      transactionService.registerSessionListener();
      transactionService.sessionListenerRegistered = true;
    }
  });

  it('should trigger side effect when service emits event', async () => {
    await sessionService.createSession({ teams: ['001', '002'] });

    await new Promise(resolve => setTimeout(resolve, 100)); // Event propagation delay

    // Verify side effect occurred
    const scores = transactionService.getTeamScores();
    expect(scores.length).toBe(2);
  });
});
```

**Key Principles**:
1. ✅ Tests service-to-service event flow
2. ✅ Uses setTimeout for event propagation (100ms)
3. ✅ Validates side effects (not just events emitted)
4. ✅ Re-registers listeners after reset if needed

---

## Part 3: Actual Test Status (Ground Truth)

### Test Suite Summary

**Overall**: 6 failing, 69 passing (75 total), 3 failed suites

### Failed Tests (6 total)

#### Suite 1: broadcasts.test.js (1 failing)
```
FAIL: should use emitToRoom for transaction:added (session-specific room)
```
**Root Cause**: Implementation not using `emitToRoom` helper for room-specific broadcast
**Location**: broadcasts.js

#### Suite 2: transactionService.test.js (4 failing)
```
FAIL: should emit score:updated when team score changes
FAIL: should NOT directly modify sessionService state
FAIL: should use top-level sessionService import in isGroupComplete()
FAIL: should use top-level videoQueueService import in createScanResponse()
```
**Root Cause**: Phase 1.1 lazy require removal incomplete
**Location**: transactionService.js

#### Suite 3: transaction-events.test.js (1 failing)
```
FAIL: should match AsyncAPI schema when broadcasted to GMs (timeout on score:updated)
```
**Root Cause**: Token validation rejecting valid tokens (`tac001`, `fli001`)
**Evidence**: Logs show "Scan rejected: invalid token" for tokens that exist in tokens.json
**Location**: Token validation logic (need to investigate tokenService)

### Passing Tests (69 total)

**Contract Tests (HTTP)**: ✅ All passing (8/8 endpoints)
- scan.test.js (6 tests)
- session.test.js (4 tests)
- admin.test.js, resource.test.js, state.test.js

**Contract Tests (WebSocket)**: ⚠️ 5/6 passing
- ✅ session-events.test.js (1/1)
- ✅ auth-events.test.js (3/3)
- ⚠️ transaction-events.test.js (2/3, score:updated timeout)

**Unit Tests**: ⚠️ Mixed
- ✅ sessionService.test.js (all passing)
- ⚠️ transactionService.test.js (4 failing)
- ✅ stateService.test.js, offlineQueueService.test.js, validators.test.js, transaction.test.js
- ⚠️ broadcasts.test.js (1 failing)

**Integration Tests**: ✅ All passing
- ✅ service-events.test.js (2/2)

---

## Part 4: Pattern Violations Found

### Violation 1: Token Validation Bug
**Location**: transaction-events.test.js:87, 119
**Pattern**: Uses real token IDs from tokens.json
**Violation**: Tokens `tac001` and `fli001` exist in tokens.json but are rejected as "invalid token"
**Impact**: Cannot test success cases for `score:updated` broadcast
**Fix Required**: Investigate tokenService validation logic

### Violation 2: Incomplete Lazy Require Removal
**Location**: transactionService.js
**Pattern**: Phase 1.1 removed lazy requires, replaced with top-level imports
**Violation**: 4 failing tests indicate lazy requires still present in:
- `isGroupComplete()` method (sessionService)
- `createScanResponse()` method (videoQueueService)
**Impact**: Tests fail because services not imported at top level
**Fix Required**: Complete Phase 1.1.6 transformations

### Violation 3: Missing Helper Usage
**Location**: broadcasts.js
**Pattern**: Use `emitToRoom()` helper for room-specific broadcasts
**Violation**: `transaction:added` broadcast not using `emitToRoom()`
**Impact**: Test expects helper pattern, implementation uses manual `io.to(room).emit()`
**Fix Required**: Replace manual broadcast with `emitToRoom()` helper

### Violation 4: Direct State Modification
**Location**: transactionService.js
**Pattern**: Services emit events, don't modify other service state
**Violation**: TransactionService directly modifying sessionService state
**Impact**: Test fails checking for event emission pattern
**Fix Required**: Replace direct state modification with event emission

---

## Part 5: Phase5 Document Gaps & Inaccuracies

### Critical Inaccuracies

#### 1. Test Count Mismatch
**Document Says**: "1 failing, 0 skipped (69 tests passing)" (line 73)
**Reality**: 6 failing, 69 passing
**Impact**: User assumes better state than exists

#### 2. Misleading "COMPLETE" Status
**Document Says**: "Phase 5.1 COMPLETE" (line 37)
**Reality**: Phase 5.1 has incomplete transformations (lazy requires, broadcasts helper)
**Impact**: User may skip fixes thinking phase is done

#### 3. Token Loading Issue Framing
**Document Says**: "Token loading in test environment prevents testing success cases" (line 254)
**Reality**: Tokens ARE loading (logs show 9 tokens loaded), but validation logic rejects them
**Impact**: Misdiagnoses root cause, misleads debugging

#### 4. Contract Violation Count
**Document Says**: "Contract violations found and fixed: 7" (line 225)
**Reality**: At least 3 contract violations remain unfixed (token validation, lazy requires, helper usage)
**Impact**: False sense of completion

### Missing Context

#### 1. EventEmitter Pattern Critical Principle
**Missing**: Clear statement that unit tests validate UNWRAPPED events, contract tests validate WRAPPED events
**Why Important**: This distinction is the CORE of Phase 3 architecture
**Consequence**: Could write tests at wrong level

#### 2. Test Execution Order
**Missing**: Why helpers must be read before tests, tests must be read before running
**Why Important**: Understanding established patterns before implementation
**Consequence**: Could violate established patterns unknowingly

#### 3. Promise Pattern Requirement
**Missing**: Explicit prohibition of done() callbacks, requirement for promises
**Why Important**: Existing helpers are promise-based, mixing patterns causes issues
**Consequence**: Could write inconsistent tests

#### 4. Token Validation Context
**Missing**: How tokenService validates tokens, what constitutes "valid"
**Why Important**: Critical for debugging the score:updated timeout
**Consequence**: Cannot fix root cause without this

### Structural Issues

#### 1. Status Buried in Sub-Sections
**Issue**: Overall status at top says "~20% complete", but sub-sections say "COMPLETE"
**Impact**: Contradictory signals about actual progress
**Fix**: Use consistent status indicators, or remove granular "COMPLETE" markers

#### 2. Pattern Documentation Scattered
**Issue**: Pattern examples in Phase 5.2.1, but not in Phase 5.1
**Impact**: Hard to find established patterns when writing new tests
**Fix**: Consolidate pattern documentation in one section at top

#### 3. TODO Comments Without Context
**Issue**: "TODO Phase 5.2.2: Fix sync:full payload" (auth-events.test.js:111) not explained in doc
**Impact**: User doesn't know WHY sync:full validation is commented out
**Fix**: Document known incomplete implementations explicitly

### Redundancies

#### 1. Duplicate Contract Violation Lists
**Issue**: Same violations listed in multiple places (lines 227-253 duplicate findings)
**Impact**: Hard to track what's actually fixed vs planned
**Fix**: Single source of truth for violations

#### 2. Repeated Test Infrastructure Description
**Issue**: Test helpers described in 5.2.1 AND in 06-test-architecture.md
**Impact**: Which is authoritative? Do they match?
**Fix**: Reference 06-test-architecture.md, don't duplicate

---

## Part 6: Recommendations

### Immediate Actions Required

1. **Fix Token Validation** (CRITICAL - blocks score:updated testing)
   - Investigate why `tac001`, `fli001` rejected despite being in tokens.json
   - Check tokenService validation logic
   - Verify token transform in tokenService.loadTokens()

2. **Complete Lazy Require Removal** (Phase 1.1.6)
   - transactionService.js: Add top-level imports for sessionService, videoQueueService
   - Update `isGroupComplete()` to use imported sessionService
   - Update `createScanResponse()` to use imported videoQueueService

3. **Fix broadcasts.js Helper Usage** (Phase 3.1)
   - Replace manual `io.to(room).emit()` with `emitToRoom()` for `transaction:added`

4. **Remove Direct State Modification** (Phase 1.1.3)
   - transactionService should emit events, not modify sessionService state

### Documentation Improvements

1. **Add "Ground Truth Investigation Protocol"**
   - Read helpers first (understand tools)
   - Read tests second (understand patterns)
   - Run tests individually (understand reality)
   - Compare docs to reality (identify gaps)

2. **Create "Established Patterns Reference"**
   - WebSocket Contract Test Pattern (code example)
   - HTTP Contract Test Pattern (code example)
   - Unit Test Pattern (unwrapped events)
   - Integration Test Pattern (service-to-service)
   - WHEN to use each pattern

3. **Add "Common Pitfalls"**
   - Using done() callbacks (use promises)
   - Not listening BEFORE triggering (race condition)
   - Not resetting services (contamination)
   - Testing at wrong level (unit vs contract)

4. **Clarify EventEmitter Architecture**
   - Services emit UNWRAPPED domain events
   - broadcasts.js listens and WRAPS for WebSocket
   - Unit tests validate unwrapped
   - Contract tests validate wrapped
   - This is CORE to Phase 3 design

### Test Strategy Clarification

**What Each Test Type Validates**:

- **Unit Tests**: Unwrapped domain events from services (internal coordination)
- **Contract Tests**: Wrapped WebSocket events against AsyncAPI schemas (API structure)
- **Integration Tests**: Multi-component flows (service A → service B → side effect)

**Current Misconception**: phase5 doc treats contract tests as integration tests. They're NOT - they validate API structure, not component integration.

---

## Part 7: Next Steps

### Priority Order

1. **Debug & Fix Token Validation** (blocks score:updated)
2. **Complete Phase 1.1.6 Lazy Requires** (4 failing tests)
3. **Fix broadcasts.js Helper Usage** (1 failing test)
4. **Update phase5 Document** (correct inaccuracies, add missing context)
5. **Continue Phase 5.2** (remaining WebSocket events)

### Verification Protocol

For each fix:
1. Identify root cause (not symptom)
2. Write/update test demonstrating fix
3. Run test individually (verify fix)
4. Run full suite (verify no regressions)
5. Update documentation (actual status)

---

## Conclusion

**Test Infrastructure**: ✅ Excellent foundation established
**Established Patterns**: ✅ Clear, consistent patterns in working tests
**Pattern Adherence**: ⚠️ Violations exist due to incomplete Phase 1.1 work
**Documentation Quality**: ❌ Significant inaccuracies and gaps that would mislead implementation

**Core Issue**: Previous session introduced test files without completing underlying implementation fixes, creating a mismatch between test expectations and implementation reality.

**Path Forward**: Fix implementation to match test expectations (not vice versa), then continue with Phase 5.2 WebSocket event coverage.

---

**Investigation Complete**: 2025-10-03
