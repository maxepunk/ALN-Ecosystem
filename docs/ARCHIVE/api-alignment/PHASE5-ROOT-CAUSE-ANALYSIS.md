# Phase 5 Root Cause Analysis: The "Thrashing" Incident
**Date**: 2025-10-03
**Investigator**: Claude Code
**Method**: Systematic code archaeology + test layer analysis

---

## Executive Summary

**What Happened**: Previous session attempted to make `transaction-events.test.js` pass, introducing changes that:
1. ✅ Correctly updated validators to match AsyncAPI (capitalized memoryType)
2. ❌ Failed to update unit tests with new enum values
3. ❌ Wrote unit tests that validate at WRONG LAYER (expecting wrapped events from unwrapped emitter)

**Result**: 6 failing tests, all from the SAME two root causes

---

## The Two Root Causes

### Root Cause #1: Enum Capitalization Mismatch

**The Change** (CORRECT for contract compliance):
```javascript
// validators.js - AFTER Phase 5.2.1 contract fixes
memoryType: Joi.string().valid('Technical', 'Business', 'Personal').required()
```

**The Forgotten Update** (BROKE unit tests):
```javascript
// transactionService.test.js lines 45, 100, etc.
const testToken = new Token({
  id: 'test123',
  memoryType: 'technical',  // ❌ Lowercase! Fails validation
  // ...
});
```

**Impact**: ALL 4 unit tests fail DURING SETUP (before assertions run)
- Error: `ValidationError: Validation failed: memoryType`
- Tests never reach their actual test logic
- False appearance that implementation is broken (implementation is fine!)

**Why This Happened**:
1. AsyncAPI contract specifies capitalized: `Technical`, `Business`, `Personal`
2. Validators correctly updated to match contract
3. Unit tests still used old lowercase values
4. Token constructor validates, throws error

---

### Root Cause #2: Test Layer Confusion

**The Architecture** (Phase 3 EventEmitter Pattern):
```
transactionService → emits UNWRAPPED score:updated (just teamScore object)
                          ↓
             broadcasts.js listens (unwrapped)
                          ↓
             emitToRoom() WRAPS it → {event, data, timestamp}
                          ↓
             WebSocket clients receive WRAPPED
```

**The Unit Test** (WRONG LAYER):
```javascript
// transactionService.test.js:55-58
transactionService.once('score:updated', (eventData) => {
  // ❌ WRONG: Expects wrapped envelope from unwrapped emitter!
  validateWebSocketEvent(eventData, 'score:updated');
  expect(eventData.event).toBe('score:updated'); // Won't exist!
  expect(eventData.data).toBeDefined(); // Won't exist!
});
```

**What It SHOULD Be**:
```javascript
// Unit test validates UNWRAPPED events
transactionService.once('score:updated', (teamScore) => {
  // ✅ Validate unwrapped structure
  expect(teamScore).toHaveProperty('teamId');
  expect(teamScore).toHaveProperty('currentScore');
  expect(teamScore).toHaveProperty('baseScore');
  // NO validateWebSocketEvent - that's for contract tests!
});
```

**The Contract Test** (CORRECT LAYER):
```javascript
// transaction-events.test.js:111-135
const scorePromise = waitForEvent(socket, 'score:updated'); // ✅ WebSocket
socket.emit('transaction:submit', { /* ... */ });
const event = await scorePromise;

// ✅ CORRECT: Validates wrapped structure from WebSocket
validateWebSocketEvent(event, 'score:updated');
expect(event).toHaveProperty('event', 'score:updated');
```

**Why This Matters**:
- Unit tests should validate service behavior (unwrapped events)
- Contract tests should validate API structure (wrapped events)
- Mixing layers creates false test failures

---

## The "Thrashing" Sequence (Reconstructed)

### What Previous Session Did:

**Step 1**: Ran `transaction-events.test.js`, saw `score:updated` timeout
- Test expects wrapped event via WebSocket
- Token validation rejected `fli001` (this is STILL the actual bug!)
- No score calculated → no score:updated emitted → timeout

**Step 2**: Attempted to "fix" by making test match AsyncAPI
- Updated validators.js: `memoryType` → capitalized enum ✅ CORRECT
- This was the RIGHT fix for contract compliance

**Step 3**: Didn't update unit tests
- Unit tests still use lowercase `memoryType: 'technical'`
- Token constructor now throws validation error
- Unit tests fail during setup (before reaching assertions)

**Step 4**: Wrote unit tests at wrong layer
- Tried to validate unwrapped events with WebSocket schema
- Mixed unit testing concerns with contract validation
- Tests expect wrapped structure from unwrapped emitter

**Step 5**: Left incomplete state
- Contract test still times out (token validation bug unfixed)
- Unit tests broken (enum mismatch + layer confusion)
- Documentation claims "COMPLETE" but reality is broken

---

## Why transaction-events.test.js Times Out

**The Real Bug** (still unfixed):
```
Logs: "Scan rejected: invalid token" for tokenId "fli001"
Logs: "Loaded 9 tokens from submodule"
```

**The Mystery**: Token loads successfully but is rejected during scan

**Hypothesis** (needs investigation):
1. Token loading transforms data structure
2. Validation expects different structure than loaded
3. OR: Token key in map doesn't match tokenId in request
4. OR: Token properties missing after transformation

**Where to Investigate**:
- `tokenService.js`: Token loading and transformation
- `transactionService.js:93-100`: Token lookup logic
- Test environment vs production differences

---

## What's Actually Broken vs What's Not

### ❌ Actually Broken:

1. **Unit Test Setup Data** (4 tests fail):
   - Using lowercase `memoryType` values
   - Token validation rejects them
   - Tests fail before assertions

2. **Unit Test Architecture** (logic issue):
   - Expecting wrapped events from unwrapped emitter
   - Wrong validation layer (AsyncAPI schema on unit test)
   - Tests wouldn't work even if setup fixed

3. **Token Validation in Tests** (1 contract test fails):
   - Real tokens `tac001`, `fli001` rejected as invalid
   - Causes score:updated to never emit
   - Contract test times out waiting for event

### ✅ Actually Working:

1. **transactionService Implementation**:
   - Emits unwrapped `score:updated` correctly ✅
   - Uses top-level imports (no lazy requires) ✅
   - Follows Phase 3 EventEmitter pattern ✅

2. **broadcasts.js Implementation**:
   - Listens for unwrapped events ✅
   - Wraps with `emitToRoom()` helper ✅
   - Sends to WebSocket correctly ✅

3. **Contract Test Design** (transaction-events.test.js):
   - Tests at correct layer (WebSocket) ✅
   - Validates wrapped structure ✅
   - Uses correct helpers and patterns ✅
   - Only fails due to token validation bug (not test design)

---

## Test Layer Architecture (Clarified)

### Layer 1: Services (Internal - Unwrapped)
```javascript
// transactionService.js
this.emit('score:updated', teamScore); // Unwrapped teamScore object
```

**Tested By**: **Unit Tests**
- Listen directly to service events
- Validate unwrapped data structure
- No WebSocket, no server
- Example: `transactionService.test.js` (when fixed)

### Layer 2: broadcasts.js (Translation - Unwraps → Wraps)
```javascript
// broadcasts.js
transactionService.on('score:updated', (teamScore) => { // Receives unwrapped
  emitToRoom(io, 'gm-stations', 'score:updated', payload); // Sends wrapped
});
```

**Tested By**: **Unit Tests** (broadcasts.test.js)
- Verify correct helper usage
- Verify event name mapping
- Verify payload transformation

### Layer 3: WebSocket (External - Wrapped)
```javascript
// Client receives:
{
  event: 'score:updated',
  data: { teamId, currentScore, ... },
  timestamp: '2025-10-03T...'
}
```

**Tested By**: **Contract Tests**
- Real WebSocket connections
- Validate against AsyncAPI schema
- Validate wrapped envelope structure
- Example: `transaction-events.test.js` (correct pattern)

### Layer 4: Multi-Component Flows
```javascript
// GM submits → backend processes → all GMs receive
```

**Tested By**: **Integration Tests**
- Multiple services coordinating
- End-to-end flows
- Example: `service-events.test.js`

---

## Fixes Required

### Fix #1: Update Unit Test Enum Values (SIMPLE)
```javascript
// transactionService.test.js (4 occurrences)
const testToken = new Token({
  id: 'test123',
  memoryType: 'Technical',  // ✅ Capitalized to match validators
  // ...
});
```

### Fix #2: Fix Unit Test Layer (ARCHITECTURE FIX)
```javascript
// transactionService.test.js
describe('score:updated event', () => {
  it('should emit unwrapped score:updated when team score changes', async () => {
    // Create session and token (with CORRECT memoryType)
    await sessionService.createSession({ teams: ['001'] });
    const testToken = new Token({
      id: 'test123',
      memoryType: 'Technical',  // Fixed
      value: 100,
      // ...
    });

    transactionService.tokens.set('test123', testToken);

    // Listen for UNWRAPPED event
    const eventPromise = new Promise((resolve) => {
      transactionService.once('score:updated', (teamScore) => { // Unwrapped!
        // Validate UNWRAPPED structure (no {event, data, timestamp} wrapper)
        expect(teamScore).toHaveProperty('teamId', '001');
        expect(teamScore).toHaveProperty('currentScore');
        expect(teamScore).toHaveProperty('baseScore');
        expect(teamScore).toHaveProperty('bonusPoints');
        expect(teamScore).toHaveProperty('tokensScanned');

        resolve(teamScore);
      });
    });

    // Trigger score update
    transactionService.updateTeamScore('001', testToken);

    await eventPromise;
  });
});
```

### Fix #3: Investigate Token Validation Bug (ROOT CAUSE for contract test)
**Steps**:
1. Read tokenService.js to understand token loading
2. Check how tokens.json is transformed
3. Verify token key matches request tokenId
4. Compare test vs production token structures
5. Fix mismatch causing "invalid token" rejection

---

## Phase5 Document Improvement Requirements

### Critical Additions Needed:

1. **Test Layer Architecture Section** (at beginning):
   - Layer 1: Services (unwrapped events) → Unit tests
   - Layer 2: broadcasts.js (translation) → Unit tests
   - Layer 3: WebSocket (wrapped events) → Contract tests
   - Layer 4: Multi-component → Integration tests
   - **WHY this matters**: Prevents layer confusion

2. **EventEmitter Pattern Refresher** (before any test code):
   - Services emit UNWRAPPED domain events
   - broadcasts.js listens and WRAPS for WebSocket
   - Unit tests validate unwrapped
   - Contract tests validate wrapped
   - **This is CORE to Phase 3 architecture**

3. **Common Pitfalls Section**:
   - ❌ Validating unwrapped events with AsyncAPI schema
   - ❌ Using lowercase enum values after capitalization fix
   - ❌ Expecting wrapped structure from service emitters
   - ❌ Testing WebSocket structure in unit tests
   - ✅ Match test layer to what you're testing

4. **Token Validation Context**:
   - How tokens load from tokens.json
   - What validation occurs
   - Test vs production differences
   - Known issues (fli001, tac001 rejection)

5. **Accurate Status Tracking**:
   - Remove "COMPLETE" markers for incomplete work
   - List known failing tests with root causes
   - Separate "tests written" from "tests passing"
   - Track fixes needed, not just work done

6. **Test Debugging Protocol**:
   - When test fails: Is it setup or assertion?
   - Check validation errors BEFORE checking logic
   - Verify test layer matches component layer
   - Compare expected structure to actual emission

---

## Conclusion

**The "Thrashing"** wasn't random chaos - it was a **systematic misunderstanding of test layers**.

**What Looked Like**: Implementation broken, services not emitting events
**What Actually Was**: Tests validating at wrong layer, setup data using wrong enum values

**The Implementation** (transactionService, broadcasts.js): ✅ **CORRECT**
**The Contract Test** (transaction-events.test.js): ✅ **CORRECT DESIGN** (fails due to token bug)
**The Unit Tests** (transactionService.test.js): ❌ **WRONG LAYER + WRONG DATA**

**Path Forward**:
1. Fix unit test enum values (5 min)
2. Rewrite unit tests at correct layer (30 min)
3. Investigate token validation bug (1-2 hours)
4. Update phase5 doc with layer architecture (1 hour)
5. Continue Phase 5.2 with clear understanding

**Key Lesson for Documentation**:
- Must explain **WHICH LAYER** each test type validates
- Must show **WHAT STRUCTURE** to expect at each layer
- Must warn against **LAYER CONFUSION** explicitly
- Architecture understanding > Code examples

---

**Analysis Complete**: 2025-10-03
