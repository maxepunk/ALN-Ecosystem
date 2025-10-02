# Test Coverage Analysis

**Created**: 2025-09-30
**Status**: ✅ COMPLETE
**Phase**: 4.5 Step 2 - Test Coverage Analysis
**Total Tests Analyzed**: 75+ tests across 11 files

---

## Executive Summary

### Quick Stats

**Test Files**: 11 total (10 active, 1 disabled)
- Contract Tests: 2 files (20 tests)
- Integration Tests: 7 files (45+ tests, 1 file disabled)
- Unit Tests: 2 files (14+ tests)

**Test Health**:
- ✅ **Keep As-Is**: ~40 tests (53%) - Already contract-compliant
- ⚠️ **Update Required**: ~33 tests (44%) - Format/field changes needed
- ❌ **Delete**: 1 test (1%) - Feature eliminated
- 🔍 **Investigate**: 1 file (DISABLED) - Core functionality not tested

### Critical Findings

🔴 **CRITICAL**: `gm_scanner.test.js` is DISABLED
- 500 lines, 30+ tests covering core game mechanics
- No validation of GM Scanner flows currently running
- MUST investigate before refactoring GM-related code

🔴 **HIGH**: WebSocket contract tests don't validate real behavior
- Tests use example objects, not actual WebSocket connections
- Backend could send wrong structure, tests would still pass
- Need complete redesign of WebSocket contract validation

🟡 **MEDIUM**: Sparse unit test coverage
- Only 2 unit test files (middleware, one service)
- No route unit tests, no other service tests
- Suggests components not designed for unit testability

🟡 **MEDIUM**: Test brittleness indicators
- 1 test file disabled, 1 test skipped, custom singleton preservation
- Comments about Jest module issues in offline tests
- Integration tests very large (up to 500 lines)

### Decision Impact Summary

| Decision | Tests Affected | Priority | Breaking |
|----------|----------------|----------|----------|
| #2 Wrapped Envelope | 10 tests | Medium | No |
| #3 RESTful HTTP | 15+ tests | Medium | Low risk |
| #4 Field Names (deviceId) | ~10 tests | HIGH | YES |
| #5 video:status Fix | 1 test | Low | No |
| #6 state:update Eliminated | 1 test | Low | No |
| #7 session:update Full | 1 test | Low | No |

**Decision #4 is BREAKING**: Field name changes affect WebSocket handshake. Must coordinate backend, scanner, and test changes.

### Priority Order for Implementation

1. 🔴 **CRITICAL - DO FIRST**: Investigate `gm_scanner.test.js.disabled`
2. 🔴 **BLOCKING**: Fix Decision #4 field names (breaks handshake)
3. 🟡 **MEDIUM**: Redesign WebSocket contract tests
4. 🟢 **LOW RISK**: HTTP response format updates (Decision #3)
5. 🟢 **PARALLEL**: WebSocket envelope updates (Decision #2)

---

## How to Use This Document

### Use Case 1: "What tests cover API X?"
→ Go to **Part 1: Test Coverage by API**
- Find your API (HTTP endpoint or WebSocket event)
- See: Backend location, all tests, current coverage, required actions, gaps

### Use Case 2: "What needs changing in test file X?"
→ Go to **Part 2: Test File Analysis**
- Find your test file
- See: Purpose, level assessment, all required changes, effort estimate, priority

### Use Case 3: "What tests are affected by Decision X?"
→ Go to **Part 3: Decision Impact Matrix**
- Find your decision
- See: All affected tests, backend dependencies, order of changes, risk level, effort

### Use Case 4: "What's the implementation order?"
→ Go to **Part 7: Implementation Roadmap**
- See: Critical path, blocking items, parallel work, dependencies

### Use Case 5: "What's wrong with our test architecture?"
→ Go to **Part 4: Critical Findings & Architecture Issues**
- Detailed analysis of structural problems
- Recommendations in **Part 5: Test Architecture Recommendations**

---

## Part 1: Test Coverage by API

### HTTP Endpoints

#### POST /api/scan (Player Scanner)

**Backend**: `scanRoutes.js:20-149`
**Alignment**: 03-alignment-matrix.md Section "POST /api/scan"

**Tests Covering**:
- ✅ Test #1: Contract - response structure (http-api-contracts.test.js:22-48)
- ✅ Test #2: Contract - error response (http-api-contracts.test.js:50-67)
- ✅ Test #31: Integration - video playback flow (video_playback.test.js:39-99)
- ✅ Test #38: Integration - duplicate scans allowed (player_scanner.test.js:30-58)
- ✅ Test #39: Integration - no transactionId (player_scanner.test.js:60-71)
- ✅ Test #40: Integration - mediaAssets in response (player_scanner.test.js:73-85)
- ✅ Test #43: Integration - video conflict detection (player_scanner.test.js:133-160)
- ✅ Test #48: Integration - validation (player_scanner.test.js:280-293)
- ✅ Test #49: Integration - offline queuing (offline_mode.test.js:184-224)

**Currently Validated**: ✅ Structure, ✅ Error handling, ✅ Business logic, ✅ Offline mode
**Coverage Quality**: EXCELLENT - comprehensive validation at all levels

**Decision Impact**:
- **Decision #3** (RESTful HTTP): Remove `status` field, use HTTP codes
  - Test #1: Update response assertions
  - Test #31, #38, #43: Update response format expectations
- **Decision #9** (Player Scanner): Tests correctly validate fire-and-forget ✅

**Actions Required**:
- ⚠️ UPDATE: Test #1, #31, #38, #43 (response format per Decision #3)
- ✅ KEEP: Test #2, #39, #40, #48, #49 (correct as-is)

**Missing Coverage**: None - excellent coverage

**Effort**: 2 hours (update 4 tests)
**Priority**: LOW (Player Scanner ignores responses per Decision #9)

---

#### POST /api/session

**Backend**: `sessionRoutes.js:68-124`, `Session.toAPIResponse()`
**Alignment**: 03-alignment-matrix.md Section "POST /api/session"

**Tests Covering**:
- ✅ Test #5: Contract - session resource structure (http-api-contracts.test.js:154-176)
- ✅ Test #6: Contract - unauthorized error (http-api-contracts.test.js:178-190)
- ✅ Test #23: Integration - admin creates session (admin_panel.test.js:79-89)
- ✅ Test #58: Integration - session persists across restart (restart_recovery.test.js:38-73)

**Currently Validated**: ✅ RESTful structure, ✅ Auth, ✅ Persistence
**Coverage Quality**: GOOD - validates contract and critical flows

**Decision Impact**:
- **Decision #3** (RESTful HTTP): Already RESTful ✅
- **Decision #4** (Field Names): Uses `id` field ✅

**Actions Required**:
- ✅ KEEP ALL: Tests already correct

**Missing Coverage**: None

**Effort**: 0 hours
**Priority**: N/A (no changes needed)

---

#### GET /api/state

**Backend**: `stateRoutes.js:76` (returns `GameState.toJSON()` directly)
**Alignment**: 03-alignment-matrix.md Section "GET /api/state"

**Tests Covering**:
- ✅ Test #3: Contract - state structure (http-api-contracts.test.js:70-104)
- ✅ Test #30: Integration - admin monitoring (admin_panel.test.js:280-300)
- ✅ Test #32: Integration - score validation (video_playback.test.js:101-128)
- ✅ Test #45: Integration - player scans don't create transactions (player_scanner.test.js:217-237)
- ✅ Test #46: Integration - player scans don't affect scores (player_scanner.test.js:239-261)

**Currently Validated**: ✅ Structure, ✅ Business rules (critical)
**Coverage Quality**: EXCELLENT - validates state isolation rules

**Decision Impact**: None (already RESTful, correct structure)

**Actions Required**:
- ✅ KEEP ALL: Tests already correct

**Missing Coverage**: None

**Effort**: 0 hours
**Priority**: N/A (no changes needed)

---

#### POST /api/video/control

**Backend**: `videoRoutes.js:18-227` (Pattern C - simple success flag)
**Alignment**: 03-alignment-matrix.md Section "POST /api/video/control"

**Tests Covering**:
- ✅ Test #25: Integration - admin commands (admin_panel.test.js:137-178)
- ✅ Test #26: Integration - skip command (admin_panel.test.js:169-178)
- ✅ Test #27: Integration - play with tokenId (admin_panel.test.js:180-194)
- ✅ Test #34: Integration - VLC errors (video_playback.test.js:166-184)
- ✅ Test #36: Integration - video commands (video_playback.test.js:205-235)
- ✅ Test #37: Integration - authorization (video_playback.test.js:237-245)
- ✅ Test #53: Integration - offline video requests (offline_mode.test.js:329-347)

**Currently Validated**: ✅ Commands, ✅ Auth, ✅ Error handling, ✅ Offline mode
**Coverage Quality**: GOOD - comprehensive command validation

**Decision Impact**:
- **Decision #3** (RESTful HTTP): Remove `success` field wrapper

**Actions Required**:
- ⚠️ UPDATE: Test #25, #26, #27, #34, #36 (remove `success` field assertions)
- ✅ KEEP: Test #37, #53 (auth and offline handling correct)

**Missing Coverage**: None

**Effort**: 1.5 hours (update 5 tests)
**Priority**: LOW (GM Scanner ignores success responses, uses WebSocket events)

---

#### GET /api/tokens

**Backend**: `tokenRoutes.js` (Pattern: Custom `{tokens, count, lastUpdate}`)
**Alignment**: 03-alignment-matrix.md Section "GET /api/tokens"

**Tests Covering**:
- ✅ Test #4: Contract - tokens array structure (http-api-contracts.test.js:107-141)

**Currently Validated**: ✅ Structure, ✅ Field types
**Coverage Quality**: ADEQUATE - contract validation only

**Decision Impact**:
- **Decision #3** (RESTful HTTP): Review if wrapper is needed (has metadata: count, lastUpdate)

**Actions Required**:
- 🤔 REVIEW: Wrapper provides useful metadata - likely keep as-is
- ✅ KEEP: Test #4 (structure correct for current design)

**Missing Coverage**: None for contract validation (integration coverage not critical)

**Effort**: 0 hours (likely no changes)
**Priority**: LOW

---

#### POST /api/admin/auth

**Backend**: `adminRoutes.js:20-54`
**Alignment**: 03-alignment-matrix.md Section "POST /api/admin/auth"

**Tests Covering**:
- ✅ Test #21: Integration - correct password (admin_panel.test.js:39-46)
- ✅ Test #22: Integration - invalid password (admin_panel.test.js:49-56)

**Currently Validated**: ✅ Auth flow, ✅ Token format, ✅ Errors
**Coverage Quality**: GOOD - validates auth contract

**Decision Impact**: None (auth endpoint keeps specialized format)

**Actions Required**:
- ✅ KEEP ALL: Tests correct

**Missing Coverage**: None

**Effort**: 0 hours
**Priority**: N/A

---

#### PUT /api/session

**Backend**: `sessionRoutes.js:126-198`
**Alignment**: 03-alignment-matrix.md Section "PUT /api/session"

**Tests Covering**:
- ✅ Test #24: Integration - pause/resume (admin_panel.test.js:91-115)
- ✅ Test #59: Integration - status persistence (restart_recovery.test.js:75-99)

**Currently Validated**: ✅ Status updates, ✅ Persistence
**Coverage Quality**: GOOD

**Decision Impact**:
- **Decision #7** (session:update Full Resource): Verify full session object returned

**Actions Required**:
- 🤔 VERIFY: Test #24 checks response includes full session (likely already correct)
- ✅ KEEP: Both tests

**Missing Coverage**: None

**Effort**: 0.5 hours (verification only)
**Priority**: LOW

---

#### GET /api/state/status

**Backend**: `stateRoutes.js:90-126`
**Alignment**: 03-alignment-matrix.md Section "GET /api/state/status"

**Tests Covering**:
- ✅ Player Scanner integration validates HTTP status only (Finding #29)

**Currently Validated**: ✅ HTTP status (200 OK)
**Coverage Quality**: MINIMAL - Player Scanner only checks `response.ok`

**Decision Impact**: None (Player Scanner behavior correct per Decision #9)

**Actions Required**:
- ✅ KEEP: Existing minimal validation correct
- 🆕 OPTIONAL: Could add contract test for response structure

**Missing Coverage**: Contract test for response structure (low priority)

**Effort**: 1 hour if adding contract test
**Priority**: LOW (endpoint works, just not contract-tested)

---

### WebSocket Events

#### transaction:new

**Backend**: `broadcasts.js:61-100` (ALREADY WRAPPED `{event, data, timestamp}`)
**Alignment**: 03-alignment-matrix.md Section "transaction:new"

**Tests Covering**:
- ✅ Test #14: Contract - structure (websocket-contracts-simple.test.js:98-130)
- ✅ gm_scanner.test.js.disabled:149 - expects wrapped format ✅
- ✅ Integration tests expect this event

**Currently Validated**: ⚠️ Structure (but contract test uses example, not real connection)
**Coverage Quality**: POOR - contract test doesn't validate real backend

**Decision Impact**:
- **Decision #2** (Wrapped Envelope): Backend ALREADY CORRECT ✅
- **Decision #4** (Field Names): Uses `tokenId`, `teamId` ✅

**Actions Required**:
- ⚠️ UPDATE: Test #14 - Redesign to use real WebSocket connection
- ✅ KEEP: gm_scanner tests (validate real behavior when re-enabled)

**Missing Coverage**: Real WebSocket contract validation

**Effort**: 2 hours (redesign contract test to use real connection)
**Priority**: MEDIUM (part of WebSocket contract test redesign)

---

#### transaction:result

**Backend**: `adminEvents.js:168` (sent to submitter only)
**Alignment**: Scanner Finding #1 (event ignored by GM Scanner)

**Tests Covering**:
- ✅ Test #13: Contract - structure (websocket-contracts-simple.test.js:70-95)
- ✅ gm_scanner.test.js.disabled uses this event

**Currently Validated**: ⚠️ Structure (example object only)
**Coverage Quality**: POOR - contract test fake, GM scanner tests disabled

**Decision Impact**:
- **Decision #2** (Wrapped Envelope): Needs wrapping

**Actions Required**:
- ⚠️ UPDATE: Test #13 - Redesign for real connection + wrap format
- ✅ KEEP: gm_scanner tests when re-enabled

**Missing Coverage**: Real WebSocket validation

**Effort**: 1.5 hours
**Priority**: LOW (event is ignored by scanner per Finding #1)

---

#### state:sync

**Backend**: `broadcasts.js:125-128` (emits state directly, UNWRAPPED)
**Alignment**: 03-alignment-matrix.md Section "state:sync"

**Tests Covering**:
- ✅ Test #15: Contract - structure (websocket-contracts-simple.test.js:133-169)
- ✅ gm_scanner.test.js.disabled tests this event

**Currently Validated**: ⚠️ Structure (example only)
**Coverage Quality**: POOR - fake contract test

**Decision Impact**:
- **Decision #2** (Wrapped Envelope): Backend needs to wrap this event

**Actions Required**:
- ⚠️ UPDATE: Backend broadcasts.js:125-128 (wrap in envelope)
- ⚠️ UPDATE: Test #15 (redesign + expect wrapped format)
- ⚠️ UPDATE: gm_scanner tests (expect wrapped format)

**Missing Coverage**: Real contract validation

**Effort**: Backend 1h, Contract test 1.5h, Integration tests 0.5h
**Priority**: MEDIUM (affects all GM clients)

---

#### state:update

**Backend**: `stateService.js:538-540` (emits FULL state, not delta - CONTRACT VIOLATION)
**Alignment**: 03-alignment-matrix.md Section "state:update" (CRITICAL MISMATCH)
**Scanner Expectation**: Finding #6, #23 (expects delta with `newTransaction`)

**Tests Covering**:
- ❌ Test #16: Contract - structure (websocket-contracts-simple.test.js:172-188)

**Currently Validated**: ⚠️ Wrong behavior (validates full state, scanner expects delta)
**Coverage Quality**: N/A - event being eliminated

**Decision Impact**:
- **Decision #6** (state:update Eliminated): EVENT REMOVED ENTIRELY

**Actions Required**:
- ❌ DELETE: Test #16 entirely
- 🔍 VERIFY: No integration tests rely on this event
- ⚠️ UPDATE: Backend stateService.js (remove event emission)

**Missing Coverage**: N/A (event eliminated)

**Effort**: 0.5 hours (delete test, remove backend emission)
**Priority**: MEDIUM (simplifies architecture per Decision #6)

---

#### video:status

**Backend**: `broadcasts.js:196-307` (sends wrapped `{event, data, timestamp}`)
**Alignment**: 03-alignment-matrix.md Section "video:status" (CRITICAL MISMATCH - missing queueLength)
**Scanner Expectation**: Finding #3 (expects `current` field, `queueLength`)

**Tests Covering**:
- ✅ Test #17: Contract - structure (websocket-contracts-simple.test.js:191-222)

**Currently Validated**: ⚠️ Structure (but example uses wrong field names)
**Coverage Quality**: POOR - fake test with wrong structure

**Decision Impact**:
- **Decision #2** (Wrapped Envelope): Backend already wraps ✅
- **Decision #5** (video:status Fix): Add `queueLength` field, verify `status` field name

**Actions Required**:
- ⚠️ UPDATE: Backend broadcasts.js (add queueLength to data)
- ⚠️ UPDATE: Test #17 (redesign for real connection + add queueLength assertion)

**Missing Coverage**: Real validation of queue information

**Effort**: Backend 1h, Test 1.5h
**Priority**: MEDIUM (GM Scanner displays queue info)

---

#### session:new, session:update, session:paused, session:resumed, session:ended

**Backend**: `sessionRoutes.js`, `broadcasts.js`
**Alignment**: 03-alignment-matrix.md Session events

**Tests Covering**:
- ✅ Test #18: Contract - session:new structure (websocket-contracts-simple.test.js:225-249)
- ⚠️ Admin panel integration tests use these indirectly

**Currently Validated**: ⚠️ Example objects only
**Coverage Quality**: POOR - no real WebSocket validation

**Decision Impact**:
- **Decision #2** (Wrapped Envelope): Need wrapping
- **Decision #4** (Field Names): Use `id` (not `sessionId`) ✅
- **Decision #7** (session:update Full Resource): Include all session fields

**Actions Required**:
- ⚠️ UPDATE: Test #18 (redesign for real connection + wrapped format)
- 🆕 CREATE: Contract tests for session:paused, session:resumed, session:ended
- ⚠️ UPDATE: Backend to wrap all session events

**Missing Coverage**:
- Contract tests for session:paused, session:resumed, session:ended
- Real WebSocket validation

**Effort**: 4 hours (redesign + create new tests)
**Priority**: MEDIUM

---

#### sync:full

**Backend**: `broadcasts.js:131-138` (emits fullState directly, UNWRAPPED)
**Alignment**: 03-alignment-matrix.md Section "sync:full"

**Tests Covering**:
- ✅ Test #19: Contract - structure (websocket-contracts-simple.test.js:252-283)

**Currently Validated**: ⚠️ Example object only
**Coverage Quality**: POOR

**Decision Impact**:
- **Decision #2** (Wrapped Envelope): Backend needs wrapping

**Actions Required**:
- ⚠️ UPDATE: Backend broadcasts.js:131-138 (wrap in envelope)
- ⚠️ UPDATE: Test #19 (redesign + expect wrapped)

**Effort**: Backend 0.5h, Test 1.5h
**Priority**: LOW (event used for initial sync, format change low risk)

---

#### gm:command:ack

**Backend**: `adminEvents.js`
**Alignment**: 03-alignment-matrix.md Section "gm:command"

**Tests Covering**:
- ✅ Test #20: Contract - structure (websocket-contracts-simple.test.js:286-305)
- ✅ gm_scanner.test.js.disabled:237-257 (pause/resume commands)
- ✅ gm_scanner.test.js.disabled:260-269 (clear scores command)

**Currently Validated**: ⚠️ Example only (contract), ✅ Real behavior (gm_scanner, but disabled)
**Coverage Quality**: POOR - comprehensive tests exist but disabled

**Decision Impact**:
- **Decision #2** (Wrapped Envelope): Need wrapping

**Actions Required**:
- ⚠️ UPDATE: Test #20 (redesign for real connection + wrapped format)
- ✅ KEEP: gm_scanner tests (when re-enabled)

**Effort**: 1.5 hours
**Priority**: LOW

---

#### score:updated

**Backend**: `broadcasts.js:183-194` (wrapped format)
**Alignment**: 03-alignment-matrix.md Section "score:updated" (CRITICAL MISMATCH - wrapped format)
**Scanner Expectation**: Finding #4 (expects `data.data`, all 7 fields required)

**Tests Covering**:
- ❌ NONE - No contract or integration test found

**Currently Validated**: ❌ NOT TESTED
**Coverage Quality**: CRITICAL GAP - Breaking change risk without tests

**Decision Impact**:
- **Decision #2** (Wrapped Envelope): Backend already wraps, but uses `data.data` nested structure
  - Current: `{event: 'score:updated', data: {data: {teamId, ...}}, timestamp}`
  - Should be: `{event: 'score:updated', data: {teamId, ...}, timestamp}`

**Actions Required**:
- 🆕 CREATE: Contract test for score:updated (real WebSocket connection)
- 🆕 CREATE: Integration test validating score broadcast flow
- ⚠️ UPDATE: Backend broadcasts.js:183-194 (fix nested data.data structure)
- 🔍 VERIFY: Scanner Finding #4 - ensure all 7 fields present

**Missing Coverage**: COMPLETE - no tests exist

**Effort**: 3 hours (contract test 1.5h, integration test 1.5h)
**Priority**: HIGH (breaking change for GM Scanner without tests)

---

#### group:completed

**Backend**: `broadcasts.js:145-181` (wrapped format)
**Alignment**: 03-alignment-matrix.md Section "group:completed" (CRITICAL MISMATCH - wrapped format)
**Scanner Expectation**: Finding #5 (expects `data.data`, all 4 fields required)

**Tests Covering**:
- ❌ NONE - No contract or integration test found

**Currently Validated**: ❌ NOT TESTED
**Coverage Quality**: CRITICAL GAP - Breaking change risk without tests

**Decision Impact**:
- **Decision #2** (Wrapped Envelope): Backend already wraps, but uses `data.data` nested structure
  - Current: `{event: 'group:completed', data: {data: {group, ...}}, timestamp}`
  - Should be: `{event: 'group:completed', data: {group, ...}, timestamp}`

**Actions Required**:
- 🆕 CREATE: Contract test for group:completed (real WebSocket connection)
- 🆕 CREATE: Integration test validating group completion flow
- ⚠️ UPDATE: Backend broadcasts.js:145-181 (fix nested data.data structure)
- 🔍 VERIFY: Scanner Finding #5 - ensure all 4 fields present

**Missing Coverage**: COMPLETE - no tests exist

**Effort**: 3 hours (contract test 1.5h, integration test 1.5h)
**Priority**: HIGH (breaking change for GM Scanner without tests)

---

#### device:connected, device:disconnected

**Backend**: `gmAuth.js:99-105`, `deviceTracking.js:28-32, 121-125`
**Alignment**: 03-alignment-matrix.md Section "device events" (PARTIAL MATCH - scanner admin handler bug)
**Scanner Expectation**: Finding #12, #25 (main handler correct, admin handler expects array)

**Tests Covering**:
- ✅ Test #29: Integration - device tracking (admin_panel.test.js:229-276)
- ❌ No contract tests

**Currently Validated**: ✅ Device tracking (partial)
**Coverage Quality**: ADEQUATE - integration test exists

**Decision Impact**:
- **Decision #2** (Wrapped Envelope): Need wrapping
- **Decision #4** (Field Names): Backend uses `deviceId` ✅
- **Decision #8** (device events): Fix scanner admin handler bug (expects array, gets object)

**Actions Required**:
- 🆕 CREATE: Contract tests for device:connected and device:disconnected
- ⚠️ UPDATE: Backend to wrap events
- ⚠️ UPDATE: Test #29 (`stationId` → `deviceId` in test setup)
- 🔍 VERIFY: Scanner admin handler fixed (Decision #8 scanner-side fix)

**Missing Coverage**: Contract tests for both events

**Effort**: 2.5 hours (contract tests 2h, update Test #29 0.5h)
**Priority**: MEDIUM (affects admin panel device display)

---

#### gm:identified

**Backend**: `gmAuth.js:91-95`
**Alignment**: 03-alignment-matrix.md Section "gm:identified" (MATCH, but sessionId may be undefined)
**Scanner Expectation**: Finding #8, #24 (stores sessionId but usage minimal)

**Tests Covering**:
- ✅ gm_scanner.test.js.disabled uses this event extensively
- ✅ Test #29, #56, #57: Integration tests perform gm:identify handshake

**Currently Validated**: ✅ Handshake flow (when gm_scanner enabled)
**Coverage Quality**: GOOD (when enabled) - comprehensive in gm_scanner tests

**Decision Impact**:
- **Decision #4** (Field Names): Uses `stationId` in request ❌ (should be `deviceId`)
- **Decision #11** (Minor Fixes): Add validation for undefined sessionId

**Actions Required**:
- ⚠️ UPDATE: All gm:identify calls (`stationId` → `deviceId`)
  - gm_scanner.test.js.disabled: Multiple locations
  - admin_panel.test.js:709
  - network_recovery.test.js:1270, 1298
- 🔍 VERIFY: Backend validation for undefined sessionId added

**Missing Coverage**: None (when gm_scanner re-enabled)

**Effort**: 2 hours (field name updates across tests)
**Priority**: HIGH (breaks WebSocket handshake)

---

#### heartbeat:ack

**Backend**: `gmAuth.js:152-154`
**Alignment**: 03-alignment-matrix.md Section "heartbeat:ack" (PERFECT MATCH)
**Scanner Expectation**: Finding #15 (payload ignored - signal only)

**Tests Covering**:
- ⚠️ Not explicitly tested (implicit in connection tests)

**Currently Validated**: ⚠️ Implicitly (keeps connection alive)
**Coverage Quality**: ADEQUATE - heartbeat mechanism works

**Decision Impact**: None (minimal payload, scanner ignores)

**Actions Required**:
- ✅ KEEP: Current implicit validation sufficient
- 🆕 OPTIONAL: Could add contract test for completeness

**Missing Coverage**: Explicit contract test (low priority)

**Effort**: 1 hour if adding test
**Priority**: LOW (works correctly, just not explicitly tested)

---

#### scores:reset

**Backend**: `adminEvents.js:68-71`, `transactionService.js:449`
**Alignment**: 03-alignment-matrix.md Section "scores:reset" (PERFECT MATCH)
**Scanner Expectation**: Finding #9 (payload ignored - signal only)

**Tests Covering**:
- ✅ gm_scanner.test.js.disabled:260-269 (clear scores command test)

**Currently Validated**: ✅ Real behavior (but test disabled)
**Coverage Quality**: GOOD (when enabled) - validates command flow

**Decision Impact**:
- **Decision #2** (Wrapped Envelope): Need wrapping

**Actions Required**:
- ⚠️ UPDATE: Backend adminEvents.js:68-71 (wrap in envelope)
- ✅ KEEP: gm_scanner test (when re-enabled)
- 🆕 OPTIONAL: Add contract test

**Missing Coverage**: Contract test (low priority - signal event)

**Effort**: Backend 0.5h, Contract test 1h if added
**Priority**: LOW (signal event, scanner ignores payload)

---

## Part 2: Test File Analysis

### tests/contract/http-api-contracts.test.js

**Purpose**: Validate HTTP API response structures
**Size**: 239 lines
**Tests**: 9 tests
**Level Assessment**: ✅ CORRECT - Structure validation without business logic
**Framework Usage**: ✅ EXCELLENT - Supertest used appropriately

**Test Quality Analysis**:
- ✅ Fast execution (no timeouts, no business logic)
- ✅ Validates field existence and types
- ✅ Checks HTTP status codes appropriately
- ✅ Doesn't test state transitions (correct scope)
- ✅ Good pattern for contract testing

**Actions Required**:
1. **Test #1** (Lines 22-48): POST /api/scan success response
   - ⚠️ UPDATE: Remove `status` field check, use HTTP codes (Decision #3)
   - Change: `expect(response.body).toHaveProperty('status')` → validate HTTP 200/202/409

2. **Test #4** (Lines 107-141): GET /api/tokens wrapper
   - 🤔 REVIEW: Verify wrapper necessity (has metadata: count, lastUpdate)
   - Likely KEEP as-is (wrapper provides value)

3. **Tests #2, #3, #5-9** (Various): All other tests
   - ✅ KEEP AS-IS: Structure already correct

**Effort Estimate**: 1.5 hours
- Update Test #1: 1 hour
- Review Test #4: 0.5 hours

**Priority**: LOW (Response formats low risk per Decision #9)

**Dependencies**: None (can update independently)

**Notes**: This file is a GOOD example of contract testing. Use as template for new tests.

---

### tests/contract/websocket-contracts-simple.test.js

**Purpose**: Validate WebSocket event structures
**Size**: 306 lines
**Tests**: 11 tests
**Level Assessment**: ❌ WRONG APPROACH - Tests example objects, not real API

**CRITICAL PROBLEM**:
```javascript
// Current approach (WRONG):
describe('transaction:new event', () => {
  it('should have correct structure', () => {
    const exampleBroadcast = { transaction: {...}, timestamp: '...' };
    expect(exampleBroadcast).toHaveProperty('transaction'); // NOT TESTING BACKEND!
  });
});
```

This validates NOTHING about actual backend behavior. Backend could send completely wrong structure and tests pass.

**Framework Usage**: ❌ MISUSED - Jest used to validate mock objects
**Test Quality Analysis**:
- ❌ No actual WebSocket connections
- ❌ No validation of real backend behavior
- ❌ False sense of security (tests pass but don't validate anything)
- ❌ Basically "unit tests" for example objects (useless)

**Required Complete Redesign**:
```javascript
// Correct approach (NEW):
describe('transaction:new event', () => {
  it('should emit correct structure when transaction created', async () => {
    // 1. Connect real WebSocket
    const socket = io(testServer);

    // 2. Trigger backend event
    await createTransaction();

    // 3. Validate ACTUAL emitted event
    const event = await waitForEvent(socket, 'transaction:new');
    expect(event).toMatchObject({
      event: 'transaction:new',
      data: {
        id: expect.any(String),
        tokenId: expect.any(String),
        // ... validate actual structure
      },
      timestamp: expect.any(String)
    });
  });
});
```

**Actions Required**:
1. **REDESIGN ALL 11 TESTS**: Use real WebSocket connections
   - Test #10-20: Validate actual backend emissions
   - Follow pattern from integration tests (connectAndIdentify, waitForEvent)

2. **ADD WRAPPING** per Decision #2:
   - All events: Expect `{event, data, timestamp}` structure

3. **DELETE Test #16**: state:update eliminated (Decision #6)

4. **ADD FIELDS** per decisions:
   - Test #17 (video:status): Add `queueLength` field (Decision #5)
   - Test #18 (session events): Full session resource (Decision #7)

**Effort Estimate**: 12 hours (complete redesign)
- Setup WebSocket test infrastructure: 3 hours
- Redesign 10 tests: 8 hours (0.8h each)
- Delete 1 test: 0.5 hours
- Test and debug: 0.5 hours

**Priority**: 🔴 HIGH - Current tests provide ZERO value

**Dependencies**:
- Backend changes for Decision #2 (wrapping) should be done first
- Can proceed in parallel with integration test updates

**Notes**:
- Reference `tests/integration/gm_scanner.test.js.disabled` for correct WebSocket testing patterns
- Use helper functions from `test-helpers.js` (connectAndIdentify, waitForEvent)
- This is architectural problem #2 (see Part 4)

---

### tests/integration/gm_scanner.test.js.disabled

**Purpose**: Validate complete GM Scanner integration flows
**Size**: 500 lines
**Tests**: 13 tests across 4 describe blocks
**Level Assessment**: ✅ **ALL 13 TESTS CORRECT LEVEL**
**Framework Usage**: ✅ **ALL 13 TESTS CORRECT FRAMEWORK**
**Async Patterns**: ⚠️ **MIXED** (Test #1 promises, Tests #2-13 done() callbacks)

**🔴 CRITICAL STATUS**: FILE IS DISABLED

**Root Cause Identified**: `connectAndIdentify` function signature changed

**The Signature Issue**:
- Test uses OLD signature: `connectAndIdentify(url, stationId)`
- Current signature: `connectAndIdentify(socketOrUrl, deviceType, deviceId, timeout)`
- **Test #1 line 50 will fail immediately** - wrong number of parameters
- File was added ALREADY disabled in initial commit 331e0fd
- Likely copied from older version where signature was different

---

#### **Detailed Test-by-Test Breakdown**

**Test #1: Should detect duplicates within same session (Lines 60-92)**
- **Purpose**: Validates FR-009 duplicate detection business rule
- **Level**: ✅ CORRECT (Integration - tests transaction + state services)
- **Framework**: ✅ CORRECT (Real WebSocket, appropriate assertions)
- **Async**: ✅ GOOD (Promise-based with waitForEvent)
- **Decision Conflicts**:
  - Line 50: `connectAndIdentify(testContext.socketUrl, 'GM_TEST_01')` ❌ **SIGNATURE BROKEN**
  - Lines 69, 84: `scannerId: 'GM_TEST_01'` ❌ **Decision #4**
- **Changes**: Fix signature + 2 field names
- **Effort**: 15 min

**Test #2: First-come-first-served (Lines 94-129)**
- **Purpose**: Validates token ownership business rule
- **Level**: ✅ CORRECT (Integration - multi-submission flow)
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done() callback (could be cleaner with promises)
- **Decision Conflicts**:
  - Lines 109, 127: `scannerId` ❌ **Decision #4**
- **Changes**: 2 field names, consider async refactor
- **Effort**: 20 min

**Test #3: Broadcasting (Lines 131-166)**
- **Purpose**: Validates transaction:new broadcast to session room
- **Level**: ✅ CORRECT (Integration - multi-client)
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done() with setTimeout (timing dependency)
- **Decision Conflicts**:
  - Line 141: `stationId: 'GM_OBSERVER_01'` ❌ **Decision #4**
  - Line 149: `expect(eventData.data)` ✅ **Matches Decision #2** (wrapped)
  - Line 161: `scannerId` ❌ **Decision #4**
- **Changes**: 2 field names
- **Effort**: 20 min

**Test #4: Score updates (Lines 168-194)**
- **Purpose**: Validates score calculation flow
- **Level**: ✅ CORRECT (Integration - scoring + state)
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done() with nested once()
- **Decision Conflicts**:
  - Line 177: `scannerId` ❌ **Decision #4**
- **Changes**: 1 field name
- **Effort**: 15 min

**Test #5: Invalid token (Lines 196-209)**
- **Purpose**: Validates error handling
- **Level**: ✅ CORRECT (Integration - error flow)
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done()
- **Decision Conflicts**:
  - Line 206: `scannerId` ❌ **Decision #4**
- **Changes**: 1 field name
- **Effort**: 10 min

**Test #6: Pause/resume commands (Lines 237-257)**
- **Purpose**: Validates admin command flow
- **Level**: ✅ CORRECT (Integration)
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done() with nested once()
- **Decision Conflicts**:
  - Line 223: Manual socket creation (not using connectAndIdentify)
  - Line 223: `stationId: 'GM_ADMIN_01'` ❌ **Decision #4**
- **Changes**: 1 field name
- **Effort**: 15 min

**Test #7: Clear scores (Lines 260-269)**
- **Purpose**: Validates clear_scores command
- **Level**: ✅ CORRECT
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done()
- **Decision Conflicts**: None in test body
- **Changes**: Verify after other changes
- **Effort**: 5 min

**Test #8: Invalid commands (Lines 272-282)**
- **Purpose**: Validates command error handling
- **Level**: ✅ CORRECT
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done()
- **Decision Conflicts**: None
- **Changes**: None
- **Effort**: 5 min

**Test #9: Session-wide duplicates (Lines 310-347)**
- **Purpose**: Validates FR-009 (no time window)
- **Level**: ✅ CORRECT (Integration - timing validation)
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done() with setTimeout
- **Decision Conflicts**:
  - Line 296: `stationId: 'GM_TIMING_01'` ❌ **Decision #4**
  - Lines 326, 342: `scannerId` ❌ **Decision #4**
- **Changes**: 3 field names
- **Effort**: 15 min

**Test #10: Concurrent submissions (Lines 349-398)**
- **Purpose**: Validates race condition handling
- **Level**: ✅ CORRECT (Integration - critical reliability test)
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done() with event counting
- **Decision Conflicts**:
  - Line 393: `scannerId: 'GM_CONCURRENT_${i}'` ❌ **Decision #4**
- **Changes**: 1 field name
- **Effort**: 15 min

**Test #11: Track transactions (Lines 402-433)**
- **Purpose**: Validates transaction state tracking
- **Level**: ✅ CORRECT
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done()
- **Decision Conflicts**:
  - Line 410: `stationId` ❌ **Decision #4**
  - Line 419: `scannerId` ❌ **Decision #4**
- **Changes**: 2 field names
- **Effort**: 10 min

**Test #12: Team scores (Lines 436-465)**
- **Purpose**: Validates team-specific scoring
- **Level**: ✅ CORRECT
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done()
- **Decision Conflicts**:
  - Line 444: `stationId` ❌ **Decision #4**
  - Line 453: `scannerId` ❌ **Decision #4**
- **Changes**: 2 field names
- **Effort**: 10 min

**Test #13: Unique tokens (Lines 468-498)**
- **Purpose**: Validates unique token tracking
- **Level**: ✅ CORRECT
- **Framework**: ✅ CORRECT
- **Async**: ⚠️ done()
- **Decision Conflicts**:
  - Line 476: `stationId` ❌ **Decision #4**
  - Line 485: `scannerId` ❌ **Decision #4**
- **Changes**: 2 field names
- **Effort**: 10 min

---

#### **Summary of Findings**

**Total Field Name Changes**: ~23 instances
- `stationId` in gm:identify: 7 instances
- `scannerId` in transaction:submit: 16 instances

**Signature Fix**: 1 instance (Test #1 line 50)

**Async Pattern Recommendation**: Standardize on promises (Test #1 pattern is cleaner)

**Effort Breakdown**:
- Fix all field names: ~2.8 hours
- Remove .disabled extension: 2 min
- Run test suite: 5 min
- Debug any remaining issues: 1 hour (buffer)
- **Total: ~4 hours**

**Actions Required**:

1. **FIX SIGNATURE** (Test #1 line 50):
   ```javascript
   // Current (BROKEN):
   gmSocket = await connectAndIdentify(testContext.socketUrl, 'GM_TEST_01');

   // Fix to:
   gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_TEST_01');
   ```

2. **UPDATE ALL FIELD NAMES** (~23 instances):
   - `stationId` → `deviceId` in all gm:identify calls
   - `scannerId` → `deviceId` in all transaction:submit calls

3. **VERIFY WRAPPING** (Line 149):
   - Test already expects wrapped format ✅
   - Matches Decision #2

4. **RE-ENABLE**:
   - Remove `.disabled` extension
   - Run: `npm test tests/integration/gm_scanner.test.js`
   - Fix any remaining issues

**Priority**: 🔴 CRITICAL - BLOCKS ALL GM REFACTORING

**Dependencies**:
- BLOCKS: Decision #4 implementation for GM Scanner
- DEPENDS ON: Backend Decision #4 field name changes must be done first

**Risk Assessment**:
- **MEDIUM RISK** - Issues are well-understood
- All 13 tests are at correct level and use correct framework
- Only need field name updates (mechanical changes)
- Most critical: Test #1 signature fix

**Recommendation**:
1. Fix Test #1 signature immediately (5 min)
2. Update all field names in batch (2-3 hours)
3. Re-enable and run test suite (verifies other changes didn't break these tests)
4. Consider splitting into 5 files post-refactor (maintainability)

---

### tests/integration/admin_panel.test.js

**Purpose**: Validate admin panel controls and monitoring
**Size**: 300+ lines
**Tests**: 10 tests (Tests #21-30)
**Level Assessment**: ✅ CORRECT - Multi-step admin flows
**Framework Usage**: ✅ GOOD - HTTP + WebSocket combined appropriately

**Test Quality Analysis**:
- ✅ Multi-component flows (auth → session → controls)
- ✅ Real integration testing
- ✅ Good error case coverage
- ⚠️ Large file (300+ lines) - could split into focused files
- ✅ Defensive testing (handles missing endpoints gracefully)

**Actions Required**:

1. **Video Control Tests** (Lines 137-194):
   - Test #25, #26, #27: Remove `success` field assertions
   - ⚠️ UPDATE: `expect(response.body.success).toBe(true)` → validate HTTP 200
   - Decision #3 impact: RESTful response format

2. **Device Tracking Test** (Lines 229-276):
   - Test #29: Change `stationId` → `deviceId` in gm:identify
   - ⚠️ UPDATE: Line 709 - `stationId: 'GM_MONITOR_1'` → `deviceId: 'GM_MONITOR_1'`
   - Decision #4 impact: Field name standardization

3. **Keep As-Is** (Lines 39-115, 197-227, 280-300):
   - Test #21-24: Auth and session management (already correct)
   - Test #28: System monitoring (defensive, handles optional endpoints)
   - Test #30: State access (correct)

**Effort Estimate**: 2 hours
- Video control updates: 1 hour
- Device tracking update: 0.5 hours
- Verification: 0.5 hours

**Priority**: MEDIUM
- Video controls: LOW (scanners ignore responses)
- Device tracking: HIGH (breaks handshake)

**Dependencies**:
- Video controls: After backend Decision #3 changes
- Device tracking: Coordinate with backend Decision #4 changes

**Notes**:
- Well-structured file, good example of integration testing
- Could split into: `admin_auth.test.js`, `admin_session.test.js`, `admin_controls.test.js` for maintainability

---

### tests/integration/video_playback.test.js

**Purpose**: End-to-end video playback flows
**Size**: 246 lines
**Tests**: 7 tests (Tests #31-37)
**Level Assessment**: ✅ CORRECT - Complete video flows
**Framework Usage**: ✅ GOOD - HTTP testing appropriate

**Test Quality Analysis**:
- ✅ Tests complete flows (scan → queue → playback → controls)
- ✅ Validates business rules (no duplicate transactions from player scans)
- ✅ Error handling (VLC connection errors)
- ✅ Authorization validation

**Actions Required**:

1. **Response Format Updates** (Lines 39-99, 132-160):
   - Test #31, #33: Remove `status` field checks
   - ⚠️ UPDATE: `expect(response.body.status).toBe('accepted')` → validate HTTP 200/409

2. **Video Control Tests** (Lines 166-235):
   - Test #34, #36: Remove `success` field assertions
   - ⚠️ UPDATE: Same as admin_panel video control tests

3. **Keep As-Is** (Lines 101-128, 186-201, 237-245):
   - Test #32: Score updates validation (critical business rule)
   - Test #35: Error handling (correct)
   - Test #37: Authorization (correct)

**Effort Estimate**: 2 hours
- Response format updates: 1 hour
- Video control updates: 0.5 hours
- Verification: 0.5 hours

**Priority**: LOW (responses ignored by scanner)

**Dependencies**: Backend Decision #3 changes

**Notes**: Clean, focused test file. Good example of integration testing.

---

### tests/integration/player_scanner.test.js

**Purpose**: Player Scanner behavior validation
**Size**: 294 lines
**Tests**: 11 tests (Tests #38-48)
**Level Assessment**: ✅ CORRECT - Scanner-specific flows
**Framework Usage**: ✅ EXCELLENT - Comprehensive coverage

**Test Quality Analysis**:
- ✅ Validates critical business rules:
  - Player scans allow duplicates
  - No transactionId returned
  - No score updates
  - No transaction creation
- ✅ These are CRITICAL tests - must keep
- ✅ Video conflict detection
- ✅ Good error handling coverage

**Actions Required**:

1. **Response Format Updates** (Lines 30-58, 133-213):
   - Test #38, #43, #44: Remove `status` field checks
   - ⚠️ UPDATE: Response format per Decision #3

2. **Keep As-Is** (Lines 60-129, 217-293):
   - Test #39: No transactionId (CRITICAL - must keep)
   - Test #40: mediaAssets presence (CRITICAL - validates contract)
   - Test #41-42: Duplicate and rapid scan behavior (CRITICAL)
   - Test #45-46: State isolation (CRITICAL - validates no scoring)
   - Test #47-48: Error handling (correct)

**Effort Estimate**: 1.5 hours
- Response format updates: 1 hour
- Verification: 0.5 hours

**Priority**: LOW (responses ignored) BUT tests are CRITICAL for business rules

**Dependencies**: Backend Decision #3 changes

**Notes**:
- **DO NOT DELETE** Tests #39, #45, #46 - these validate critical business logic
- These tests protect against accidental score updates from player scans
- Excellent example of integration testing for business rules

---

### tests/integration/offline_mode.test.js

**Purpose**: Offline queue functionality
**Size**: 400+ lines
**Tests**: 7+ tests (Tests #49-55+)
**Level Assessment**: ✅ CORRECT - Offline → online transition flows
**Framework Usage**: ✅ GOOD - But with concerning custom setup

**🟡 ARCHITECTURE CONCERN**: Custom setup preserving singletons
```javascript
// Comment in file (Line 18):
// "We preserve singletons because these tests verify state transitions (offline → online)
// that require services to maintain state across the transition."
```

**Problem**: If services require singleton preservation for testing, they're not properly designed for testability. This is a code smell indicating tight coupling.

**Test Quality Analysis**:
- ✅ Validates offline queue behavior
- ✅ Tests queue limits
- ✅ Validates processing order
- ⚠️ Complex setup/teardown (setupOfflineTest, cleanupOfflineTest)
- ⚠️ Comments about Jest module issues
- 🔴 Brittle: One test removed due to "WebSocket handlers don't see offline status due to Jest module issues"

**Actions Required**:

1. **Field Name Update** (Line 1136):
   - Test #50: Change `scannerId` → `deviceId` in transaction:submit
   - ⚠️ UPDATE: Single field name change

2. **Keep As-Is** (All other tests):
   - Tests #49, #51-55: Offline behavior, queue limits, status indication
   - ✅ KEEP: HTTP status codes already correct (202, 503)

**Effort Estimate**: 1 hour
- Field name update: 0.5 hours
- Verification: 0.5 hours

**Priority**: MEDIUM (field name breaks WebSocket)

**Dependencies**: Backend Decision #4 changes

**Recommendations for Future**:
- Refactor services to not require singleton preservation
- Design services with dependency injection for better testability
- This setup is a symptom of architectural testability problems (see Part 5)

**Notes**: Tests validate important functionality but setup complexity is concerning.

---

### tests/integration/network_recovery.test.js

**Purpose**: WebSocket reconnection resilience
**Size**: 150+ lines
**Tests**: 2 tests (Tests #56-57)
**Level Assessment**: ✅ CORRECT - Connection resilience flows
**Framework Usage**: ✅ GOOD - Real reconnection scenarios

**Test Quality Analysis**:
- ✅ Tests real reconnection behavior
- ✅ Validates session preservation
- ⚠️ One test SKIPPED (Test #56) - timing issues signal brittleness

**Actions Required**:

1. **Field Name Updates** (Lines 1270, 1298):
   - Test #56, #57: Change `stationId` → `deviceId` in gm:identify
   - ⚠️ UPDATE: Both tests

2. **Investigate Skipped Test** (Test #56):
   - Currently `.skip` due to timing issues
   - May work after field name updates
   - Test approach is correct, just brittle

**Effort Estimate**: 1.5 hours
- Field name updates: 0.5 hours
- Re-enable and test: 0.5 hours
- Fix timing issues if needed: 0.5 hours

**Priority**: MEDIUM (field names HIGH, skipped test MEDIUM)

**Dependencies**: Backend Decision #4 changes

**Notes**:
- Skipped test signals brittleness (architectural issue)
- May indicate WebSocket reconnection timing assumptions

---

### tests/integration/restart_recovery.test.js

**Purpose**: Session and state persistence across restarts
**Size**: 150+ lines (more tests likely exist)
**Tests**: 4+ tests read (Tests #58-61+)
**Level Assessment**: ✅ CORRECT - Persistence validation
**Framework Usage**: ⚠️ QUESTIONABLE - Uses `global.restartSimulation = true`

**🤔 TESTABILITY QUESTION**:
```javascript
// Line 66 in Test #58:
global.restartSimulation = true;
```

Is this testing:
- A) Real restart behavior (service re-initialization)? ✅
- B) Just service reset without actual restart? ⚠️

If (B), test may not validate what we think it validates. Actual restart involves:
- Process termination
- Memory cleared
- File system persistence as only state
- Process restart with new memory

**Test Quality Analysis**:
- ✅ Validates persistence (session, scores, metadata)
- ✅ Tests service re-initialization
- ⚠️ May not test "real" restart (depends on what `global.restartSimulation` does)
- ✅ Good coverage of persistence scenarios

**Actions Required**:
- ✅ KEEP ALL: Tests correct for their scope
- 🔍 VERIFY: What `global.restartSimulation` actually does
- 🤔 CONSIDER: Add true restart test (start new process, verify persistence)

**Effort Estimate**: 0 hours (tests correct as-is)
**Priority**: N/A (no changes needed)

**Dependencies**: None

**Notes**:
- These tests are valuable even if not "true" restart tests
- Could add true restart test as separate test (start orchestrator process, kill it, restart, verify)
- Current tests validate service-level persistence correctly

---

### tests/unit/middleware/offlineStatus.test.js

**Purpose**: Offline status middleware unit tests
**Size**: 120 lines
**Tests**: 5 tests (Tests #62-66)
**Level Assessment**: ✅ PERFECT - Textbook unit testing
**Framework Usage**: ✅ EXCELLENT - Proper mocking and isolation

**Test Quality Analysis**:
- ✅ **PERFECT EXAMPLE** of unit testing
- ✅ Complete isolation (mocks offlineQueueService)
- ✅ Tests single component
- ✅ Fast execution
- ✅ Good coverage of all functions
- ✅ No external dependencies

**Actions Required**:
- ✅ KEEP ALL: No changes needed
- 📚 USE AS TEMPLATE: This file is how unit tests should be written

**Effort Estimate**: 0 hours
**Priority**: N/A (no changes needed)

**Dependencies**: None

**Notes**:
- This is the GOLD STANDARD for unit testing
- Use this as template for creating new unit tests
- Shows proper mocking patterns
- Fast, isolated, comprehensive

---

### tests/unit/services/offlineQueueService.test.js

**Purpose**: Offline queue service business logic
**Size**: 150+ lines
**Tests**: 9+ tests (Tests #67-75+)
**Level Assessment**: ✅ PERFECT - Textbook unit testing
**Framework Usage**: ✅ EXCELLENT - Proper mocking and isolation

**Test Quality Analysis**:
- ✅ **PERFECT EXAMPLE** of unit testing
- ✅ Tests service logic in complete isolation
- ✅ Mocks all dependencies
- ✅ Fast execution
- ✅ Comprehensive coverage (queue management, limits, status, events)
- ✅ No HTTP/WebSocket layers

**Actions Required**:
- ✅ KEEP ALL: No changes needed
- 📚 USE AS TEMPLATE: This file shows how to unit test services

**Effort Estimate**: 0 hours
**Priority**: N/A (no changes needed)

**Dependencies**: None

**Notes**:
- Another GOLD STANDARD example
- Shows how to test:
  - Business logic without infrastructure
  - Event emission
  - State management
  - Queue limits
- Field names in this file are INTERNAL (not API-facing) so don't need Decision #4 updates

---

## Part 3: Decision Impact Matrix

### Decision #1: Contract-First Approach

**Description**: Use OpenAPI 3.1 + AsyncAPI 2.6 as source of truth
**Document**: 04-alignment-decisions.md Decision #1

**Backend Changes**: None (architectural decision)

**Test Changes**:
- Strategy shift: Tests validate contracts, not just current behavior
- Contract tests become critical (must validate real backend)

**Test Actions**:
- 🔄 REDESIGN: All WebSocket contract tests (use real connections)
- 🆕 CREATE: Missing contract tests (score:updated, group:completed, device events, session events)
- 🔍 ENSURE: All tests reference contract specs

**Order**: N/A (foundational decision)
**Breaking**: No
**Risk**: None (improves quality)

**Effort**: Included in other decision efforts
**Priority**: N/A (applied throughout)

---

### Decision #2: Wrapped WebSocket Envelope

**Description**: All WebSocket events use `{event, data, timestamp}` structure
**Document**: 04-alignment-decisions.md Decision #2

**Backend Changes**:
- `broadcasts.js`: Wrap state:sync, sync:full, session events
- `adminEvents.js`: Wrap scores:reset, gm:command:ack
- Fix nested `data.data` in score:updated, group:completed

**Affected APIs**: 15 WebSocket events total

**Test Changes** (10+ tests):
1. **Contract Tests** (10 tests):
   - Test #11: device:identify ack
   - Test #12: error events
   - Test #13: transaction:result
   - Test #14: transaction:new (verify backend already wraps)
   - Test #15: state:sync
   - Test #17: video:status
   - Test #18: session:new
   - Test #19: sync:full
   - Test #20: gm:command:ack
   - **DELETE** Test #16: state:update (eliminated)

2. **Integration Tests**:
   - gm_scanner.test.js.disabled: Verify wrapped format expectations
   - May need updates after backend wrapping changes

3. **New Tests Needed**:
   - score:updated contract test (wrap + fix data.data)
   - group:completed contract test (wrap + fix data.data)

**Order of Changes**:
1. Backend: Add wrapping to all events
2. Backend: Fix nested data.data structure
3. Tests: Redesign contract tests (real connections)
4. Tests: Update expectations for wrapped format
5. Integration tests: Verify still work

**Breaking**:
- YES for unwrapped events (state:sync, sync:full, session events)
- Scanners expect unwrapped currently
- Must coordinate: backend + scanner + tests

**Risk**: HIGH
- Scanner Finding #2 shows scanner expects wrapped transaction:new (fallback exists)
- But other events (state:sync) expected unwrapped
- Must update GM Scanner to expect wrapped format universally

**Effort**:
- Backend: 4 hours (wrap 8 events, fix 2 nested structures)
- Contract tests: 8 hours (redesign 10 tests for real connections)
- Integration tests: 2 hours (verify and update)
- Scanner updates: 3 hours (update expectations)
- **Total: 17 hours**

**Priority**: MEDIUM
- Not immediately breaking (transaction:new already works)
- But needed for consistency
- Should do before creating OpenAPI/AsyncAPI contracts

**Dependencies**:
- Should coordinate with Decision #4 (both affect scanners)
- Integration tests may reveal issues during scanner updates

---

### Decision #3: RESTful HTTP Response Format

**Description**: Direct resources/results, HTTP status codes for success/error, remove `status`/`success` wrapper fields
**Document**: 04-alignment-decisions.md Decision #3

**Backend Changes**:
- `scanRoutes.js`: Remove `status` field from success responses
- `videoRoutes.js`: Remove `success` field from responses
- `sessionRoutes.js`: Already RESTful ✅ (verify)
- Use HTTP status codes: 200 OK, 201 Created, 202 Accepted, 409 Conflict, 503 Service Unavailable

**Affected APIs**:
- POST /api/scan
- POST /api/video/control
- POST /api/session (already correct)
- GET /api/state (already correct)

**Test Changes** (15+ tests):

1. **Contract Tests** (1 test):
   - Test #1: POST /api/scan structure (http-api-contracts.test.js:22-48)
     - Remove: `expect(response.body).toHaveProperty('status')`
     - Add: Validate HTTP status codes (200, 202, 409)

2. **Integration Tests** (14+ tests):
   - Test #25-27: Admin video controls (admin_panel.test.js:137-194)
     - Remove: `expect(response.body.success).toBe(true)`
   - Test #31: Video playback flow (video_playback.test.js:39-99)
     - Remove: `expect(response.body.status).toBe('accepted')`
   - Test #33: Video queue handling (video_playback.test.js:132-160)
     - Remove: status field checks
   - Test #34: VLC errors (video_playback.test.js:166-184)
     - Remove: success field assertion
   - Test #36: Video commands (video_playback.test.js:205-235)
     - Remove: success field assertions (3 commands)
   - Test #38: Player duplicate scans (player_scanner.test.js:30-58)
     - Remove: status field checks
   - Test #43-44: Video conflicts (player_scanner.test.js:133-213)
     - Remove: status and videoPlaying field checks
     - Use HTTP 409 for conflicts ✅ (already correct)

**Order of Changes**:
1. Backend: Update response formats (remove wrappers)
2. Tests: Update assertions (check HTTP codes, not fields)
3. Verify: Error responses unchanged (already correct)

**Breaking**: LOW RISK
- **Decision #9**: Player Scanner ignores all responses (fire-and-forget)
- **GM Scanner**: Uses WebSocket events for video status, ignores HTTP responses
- Responses are logged but not used for UI updates

**Risk**: LOW
- Scanners don't rely on these responses
- But good to update tests to match intended contract

**Effort**:
- Backend: 3 hours (update 3 route files)
- Tests: 4 hours (update 15 tests)
- **Total: 7 hours**

**Priority**: MEDIUM
- Low risk but important for contract compliance
- Can do in parallel with Decision #2

**Dependencies**:
- Independent of other decisions
- Can proceed without blocking

**Notes**:
- Keep error format unchanged (already RESTful)
- Keep offline queue fields (queued, offlineMode) - operational metadata
- HTTP 202 Accepted already used correctly for async operations

---

### Decision #4: Field Name Standardization (deviceId)

**Description**: Standardize to `deviceId` (not scannerId/stationId), `tokenId` (not rfid), `id` in resource context
**Document**: 04-alignment-decisions.md Decision #4

**Backend Changes**:
- `gmAuth.js`: Accept `deviceId` in gm:identify (Line ~50)
- `broadcasts.js`: Use `deviceId` in event emissions
- `transactionService.js`: Accept `deviceId` in transaction:submit
- All WebSocket event handlers: Use `deviceId`

**Affected APIs**:
- WebSocket: gm:identify request field
- WebSocket: transaction:submit field
- WebSocket: All events emitting scanner/station identifier

**Test Changes** (~10 tests across 4 files):

1. **gm_scanner.test.js.disabled** (~15-20 instances):
   - Lines 69, 84, 110, 142, 163, 176, 207, 244, 326, 340, 393, etc.
   - ALL: `scannerId: 'GM_TEST_01'` → `deviceId: 'GM_TEST_01'`

2. **admin_panel.test.js** (2 instances):
   - Test #29, Line 709: `stationId: 'GM_MONITOR_1'` → `deviceId: 'GM_MONITOR_1'`
   - Line 710: (second socket, same change)

3. **network_recovery.test.js** (2 instances):
   - Test #56, Line 1270: `stationId: 'GM_RECONNECT_TEST'` → `deviceId: 'GM_RECONNECT_TEST'`
   - Test #57, Line 1298: `stationId: 'GM_STATE_TEST'` → `deviceId: 'GM_STATE_TEST'`

4. **offline_mode.test.js** (1 instance):
   - Test #50, Line 1136: `scannerId: 'GM_SCANNER'` → `deviceId: 'GM_SCANNER'`

**Order of Changes**:
1. 🔍 **CRITICAL**: Investigate gm_scanner.test.js.disabled FIRST
   - If disabled due to field names, this is the root cause
2. Backend: Update all handlers to accept `deviceId`
3. Backend: Update all emissions to use `deviceId`
4. Scanner: Update GM Scanner gm:identify to send `deviceId`
5. Tests: Update all test field names
6. Tests: Re-enable gm_scanner.test.js if field names were the issue

**Breaking**: YES - HIGH RISK
- **WebSocket Handshake Breaks**: gm:identify uses wrong field name → connection fails
- GM Scanner cannot connect until updated
- Must coordinate: backend + scanner + tests TOGETHER

**Risk**: HIGH
- This is the MOST breaking change
- Could be reason gm_scanner.test.js is disabled
- Must test thoroughly before deployment

**Effort**:
- Investigation: 1-2 hours (gm_scanner disabled reason)
- Backend: 2 hours (update handlers and emissions)
- Scanner: 2 hours (update GM Scanner code)
- Tests: 3 hours (update ~20 instances across 4 files)
- Verification: 2 hours (thorough testing)
- **Total: 10-13 hours**

**Priority**: 🔴 HIGH - BLOCKING
- Must investigate gm_scanner disabled status first
- Blocks other GM-related work
- Breaking change requires careful coordination

**Dependencies**:
- BLOCKS: gm_scanner.test.js re-enabling
- BLOCKS: Any GM Scanner code changes
- COORDINATE WITH: Decision #2 (both affect scanners)

**Testing Strategy**:
1. Update backend + tests first (in test environment)
2. Verify gm_scanner.test.js works (if field names were issue)
3. Update GM Scanner code
4. End-to-end test: real GM Scanner + backend
5. Only deploy when all pieces updated

**Notes**:
- This may be THE issue that disabled gm_scanner tests
- Investigation will inform implementation approach
- Consider backward compatibility during transition:
  - Backend accepts BOTH `stationId`/`scannerId` AND `deviceId`
  - After scanner updated, remove old field names
  - Safer migration path

---

### Decision #5: video:status Event Fix

**Description**: Add `queueLength` field, use `status` field name (not `current`), wrapped format
**Document**: 04-alignment-decisions.md Decision #5

**Backend Changes**:
- `broadcasts.js:196-307`: Add `queueLength` to data object
  ```javascript
  // Current:
  data: { status: 'playing', tokenId: '...', duration: 120 }

  // Updated:
  data: {
    status: 'playing',
    queueLength: videoQueue.length,
    tokenId: '...',
    duration: 120
  }
  ```

**Affected APIs**: video:status WebSocket event only

**Test Changes** (1 test):
- Test #17: Contract test (websocket-contracts-simple.test.js:191-222)
  - Redesign for real WebSocket connection (part of Decision #1 effort)
  - Add assertion for `queueLength` field
  - Verify `status` field (not `current`) ✅

**Order of Changes**:
1. Backend: Add queueLength to video:status emission
2. Test: Redesign contract test + add queueLength assertion
3. Verify: GM Scanner receives and displays queue length

**Breaking**: NO
- Scanner Finding #3 shows scanner expects `current` field
- But scanner has fallback behavior
- Adding `queueLength` is additive (not breaking)
- Field name `status` vs `current` - scanner may already handle this

**Risk**: LOW
- Additive change (new field)
- GM Scanner displays queue info, will benefit from this
- May fix existing UI issue (queue length not displayed)

**Effort**:
- Backend: 0.5 hours (add field to emission)
- Test: 1.5 hours (redesign contract test + new assertion)
- Verification: 0.5 hours
- **Total: 2.5 hours**

**Priority**: MEDIUM
- Not blocking other work
- Improves GM Scanner UX
- Should include in Decision #2 effort (wrapping)

**Dependencies**:
- Part of Decision #2 effort (WebSocket wrapping)
- Can do in parallel with other decisions

**Notes**:
- Scanner Finding #3: GM Scanner currently gets incomplete queue info
- This fixes that issue
- Low risk, high value change

---

### Decision #6: Eliminate state:update Event

**Description**: Remove redundant state:update event entirely
**Document**: 04-alignment-decisions.md Decision #6

**Rationale**:
- Contract violation (backend sends full state, scanner expects delta)
- Redundant with specific domain events (transaction:new, score:updated, etc.)
- Architectural simplification

**Backend Changes**:
- `stateService.js:538-540`: Remove `emit('state:update', ...)` call
- Remove event from all documentation
- Scanners use specific events instead

**Affected APIs**: state:update WebSocket event (ELIMINATED)

**Test Changes** (1 test):
- ❌ **DELETE** Test #16: state:update contract test (websocket-contracts-simple.test.js:172-188)
- 🔍 **VERIFY**: No integration tests rely on this event
  - gm_scanner.test.js.disabled: Uses state:sync, not state:update ✅
  - Other integration tests: Don't use state:update ✅

**Order of Changes**:
1. Verify: No tests rely on state:update (already verified ✅)
2. Tests: Delete Test #16
3. Backend: Remove event emission from stateService
4. Scanner: Already doesn't rely on this (uses specific events)

**Breaking**: NO
- Scanner Finding #6, #23 shows scanner expects this but:
  - Expected structure doesn't match what backend sends (delta vs full)
  - Event likely not working correctly anyway
  - Scanner uses specific events (transaction:new, score:updated) for actual updates

**Risk**: LOW
- Event was broken (contract violation)
- Scanner doesn't rely on it in practice
- Simplifies architecture

**Effort**:
- Tests: 0.5 hours (delete test)
- Backend: 0.5 hours (remove emission)
- Verification: 0.5 hours (ensure nothing breaks)
- **Total: 1.5 hours**

**Priority**: MEDIUM
- Architectural improvement
- Removes broken contract
- Low risk

**Dependencies**:
- Independent of other decisions
- Can do anytime

**Notes**:
- This is a SIMPLIFICATION (removes code, not adds)
- Validates Contract-First approach (caught broken contract)
- Scanner already uses correct events (transaction:new, score:updated, group:completed)

---

### Decision #7: session:update Full Resource

**Description**: session:update event includes full session object with `id` field (not `sessionId`)
**Document**: 04-alignment-decisions.md Decision #7

**Backend Changes**:
- `sessionRoutes.js`: Ensure session:update emits full Session.toAPIResponse()
- Verify field is `id` not `sessionId` ✅ (already correct per Test #5)

**Affected APIs**:
- session:update WebSocket event
- PUT /api/session HTTP response (already correct)

**Test Changes** (1 test + verification):
- Test #18: session events contract test (websocket-contracts-simple.test.js:225-249)
  - Redesign for real connection (part of Decision #1)
  - Verify full session object structure
  - Verify `id` field (not `sessionId`)
- 🔍 **VERIFY** Test #24: session pause/resume integration test
  - Ensure response includes full session object (likely already correct)

**Order of Changes**:
1. Verify: HTTP PUT /api/session returns full resource (already correct ✅)
2. Verify: session:update event structure
3. Test: Redesign contract test
4. Test: Verify integration test expectations

**Breaking**: NO
- Scanner Finding #7 shows mismatch (`sessionId` vs `id`)
- But scanner uses response to update display
- Changing to match HTTP response format is consistency fix

**Risk**: LOW
- Consistency improvement
- Scanner already handles session objects
- Field name change from `sessionId` → `id` matches HTTP endpoints

**Effort**:
- Backend: 1 hour (verify and update event emission)
- Tests: 1.5 hours (redesign contract test)
- Verification: 0.5 hours
- **Total: 3 hours**

**Priority**: LOW
- Consistency improvement
- Not blocking
- Part of Decision #2 effort (wrapping)

**Dependencies**:
- Part of Decision #2 (WebSocket wrapping)
- Can do in parallel with other decisions

**Notes**:
- Makes WebSocket session events consistent with HTTP responses
- Scanner Finding #7: Current mismatch in field names
- This aligns everything to use `id`

---

### Decision #8: Fix device Event Scanner Bug

**Description**: Scanner admin handler bug expects array, backend sends object - fix scanner side
**Document**: 04-alignment-decisions.md Decision #8

**Backend Changes**: NONE
- Backend is correct (sends single device object)
- Scanner has the bug

**Affected APIs**: device:connected, device:disconnected WebSocket events

**Scanner Changes** (not test changes):
- GM Scanner admin handler: Expect single device object, not array
- Fix per Scanner Finding #25 (admin handler bug)

**Test Changes** (1 test + new tests):
- Test #29: Device tracking (admin_panel.test.js:229-276)
  - ⚠️ UPDATE: Change `stationId` → `deviceId` (Decision #4)
  - ✅ KEEP: Test structure correct (validates real device tracking)
- 🆕 **CREATE**: Contract tests for device:connected and device:disconnected
  - Validate backend sends single object (not array)
  - Validate correct field structure

**Order of Changes**:
1. Scanner: Fix admin handler bug (expect object, not array)
2. Tests: Update field names (Decision #4)
3. Tests: Add contract tests for device events
4. Verify: Admin panel displays devices correctly

**Breaking**: NO
- Backend is already correct
- Scanner needs fixing (not breaking change, bug fix)

**Risk**: LOW
- Scanner-side bug fix
- Backend unchanged
- May fix existing admin panel display issue

**Effort**:
- Scanner: 1 hour (fix admin handler)
- Tests: 0.5 hours (field name update Test #29)
- Tests: 2 hours (create contract tests)
- **Total: 3.5 hours**

**Priority**: LOW
- Scanner bug fix (not backend)
- Admin panel feature may be broken currently
- Can do anytime

**Dependencies**:
- Coordinate with Decision #4 (field name changes)
- Part of Decision #2 effort (wrap device events)

**Notes**:
- Scanner Finding #25 identified this bug
- Backend is correct, scanner has bug
- May explain why admin device display doesn't work correctly

---

### Decisions #9-12: No Direct Test Changes

**Decision #9: Player Scanner Fire-and-Forget**
- **Description**: Keep Player Scanner response-ignoring behavior (ESP32 design)
- **Test Impact**: NONE - Tests already validate this behavior correctly
- **Tests Validate**:
  - Test #39: No transactionId ✅
  - Test #45-46: State isolation ✅
  - Player Scanner ignores responses ✅
- **Notes**: Tests protect this design decision

**Decision #10: Add Error Display to Scanners**
- **Description**: Add user-facing error UI to both scanners
- **Test Impact**: NONE - UI change, no backend API changes
- **Notes**: Tests already validate backend error responses

**Decision #11: Fix Minor Issues**
- **Description**: Validation checks, remove dead code (retryCount)
- **Test Impact**: NONE - Internal fixes, no contract changes
- **Notes**: Validation tests already exist and are correct

**Decision #12: Contracts Location**
- **Description**: Place contracts in `backend/contracts/` as source of truth
- **Test Impact**: DOCUMENTATION ONLY
- **Notes**: Tests will reference these contracts, no code changes

---

## Part 4: Critical Findings & Architecture Issues

### 🔴 CRITICAL ISSUE #1: gm_scanner.test.js.disabled - Root Cause Identified

**Problem**: Most comprehensive GM Scanner test file is DISABLED

**Root Cause**: `connectAndIdentify` function signature incompatibility

**The Signature Issue** (Lines analyzed from test file and test-helpers.js):
```javascript
// Test #1 (line 50) - BROKEN:
gmSocket = await connectAndIdentify(
  testContext.socketUrl,
  'GM_TEST_01'  // ❌ Only 2 parameters
);

// Current test-helpers.js signature (line 71):
async function connectAndIdentify(socketOrUrl, deviceType, deviceId, timeout)

// OLD signature (what test expects):
async function connectAndIdentify(url, stationId, timeout)
```

**What Happened**:
- File was added ALREADY disabled in initial commit 331e0fd (Sept 26, 2025)
- Function signature changed: added `deviceType` parameter, renamed `stationId` to `deviceId`
- Test file uses old signature → immediate failure on Test #1 line 50
- Likely copied from older codebase version where signature was different

**Impact**:
- 500 lines, 13 tests covering core game mechanics
- NO validation of GM Scanner flows currently running
- Core business logic untested:
  - Duplicate detection (session-wide) - FR-009
  - First-come-first-served token claiming
  - Score updates from GM scans
  - Transaction broadcasting
  - GM admin commands
  - State management
  - Concurrent submission handling

**Detailed Analysis Complete**:
- ✅ All 13 tests analyzed test-by-test (see Part 2 for details)
- ✅ All 13 tests at CORRECT level (integration tests)
- ✅ All 13 tests use CORRECT framework (real WebSocket)
- ⚠️ Async patterns mixed (Test #1 promises, others done())
- ❌ ~23 field name conflicts with Decision #4

**Field Name Issues** (Decision #4 conflicts):
- `stationId` in gm:identify: 7 instances → need `deviceId`
- `scannerId` in transaction:submit: 16 instances → need `deviceId`

**Required Actions**:

1. **FIX SIGNATURE** (5 minutes):
   ```javascript
   // Line 50 - Fix Test #1:
   gmSocket = await connectAndIdentify(
     testContext.socketUrl,
     'gm',         // ADD deviceType parameter
     'GM_TEST_01',
     5000
   );
   ```

2. **UPDATE FIELD NAMES** (~2.8 hours):
   - Replace all `stationId` → `deviceId` (7 instances)
   - Replace all `scannerId` → `deviceId` (16 instances)
   - Total: ~23 changes across 13 tests

3. **RE-ENABLE** (1 hour with buffer):
   - Remove `.disabled` extension
   - Run: `npm test tests/integration/gm_scanner.test.js`
   - Debug any remaining issues (likely minimal)

**Effort Breakdown**:
- Signature fix: 5 min
- Field name updates: ~2.8 hours
- Re-enable and verify: 1 hour (includes buffer)
- **Total: ~4 hours** (revised down from 7-10 hours)

**Risk Assessment**:
- **MEDIUM RISK** (revised down from HIGHEST)
- Issues are well-understood (not mysterious)
- All tests are architecturally sound
- Changes are mechanical (find-replace for field names)
- Signature fix is trivial

**Good News**:
- ✅ No architectural problems found
- ✅ No timing issues or race conditions
- ✅ Tests are at correct level
- ✅ Framework usage is correct
- ✅ Test quality is good

**Dependencies**:
- BLOCKS: Decision #4 implementation for GM Scanner
- DEPENDS ON: Backend must accept `deviceId` field before re-enabling
- COORDINATE: Backend + Scanner + Tests updated together

**Recommendation**:
1. Coordinate with Decision #4 backend implementation
2. Update backend to accept `deviceId` first
3. Update these tests + re-enable
4. Update GM Scanner frontend
5. Deploy all together (breaking change)

**Priority**: 🔴 CRITICAL - BLOCKS GM REFACTORING (but now understood)

---

### 🔴 HIGH ISSUE #2: WebSocket Contract Tests Don't Validate Real Behavior

**Problem**: `websocket-contracts-simple.test.js` tests example objects, not actual backend

**Current Approach** (WRONG):
```javascript
it('should have correct structure', () => {
  const exampleBroadcast = { transaction: {...}, timestamp: '...' };
  expect(exampleBroadcast).toHaveProperty('transaction'); // NOT TESTING BACKEND!
});
```

**What This Means**:
- Tests validate NOTHING about actual backend behavior
- Backend could send completely wrong structure → tests still pass
- False sense of security (green tests, broken contracts)
- Basically "unit tests" for mock objects (useless)

**Impact**:
- All 11 WebSocket contract tests provide ZERO value
- No contract validation happening
- Changes to backend events not caught by tests
- score:updated and group:completed have NO tests at all

**Why This Happened**:
- Likely attempt to avoid complexity of WebSocket testing
- Or misunderstanding of what "contract testing" means
- Testing framework (Jest) misused for pseudo-validation

**Required Actions**:

1. **COMPLETE REDESIGN** of all WebSocket contract tests:
   ```javascript
   // Correct approach:
   it('should emit correct structure when transaction created', async () => {
     // 1. Start test server with real WebSocket
     const { server, io } = await setupTestServer();

     // 2. Connect real client
     const socket = io(serverUrl);
     await socket.connected;

     // 3. Trigger backend event
     await createTransaction({ tokenId: 'TEST_001', ... });

     // 4. Validate ACTUAL emitted event
     const event = await waitForEvent(socket, 'transaction:new');
     expect(event).toMatchObject({
       event: 'transaction:new',
       data: {
         id: expect.any(String),
         tokenId: 'TEST_001',
         // ... validate actual structure
       },
       timestamp: expect.stringMatching(ISO_8601_REGEX)
     });

     // 5. Cleanup
     socket.disconnect();
     await server.close();
   });
   ```

2. **Test Infrastructure**:
   - Use helper functions from `test-helpers.js` (connectAndIdentify, waitForEvent)
   - Reference `gm_scanner.test.js.disabled` for correct patterns
   - Setup real test server (like integration tests do)

3. **All 11 Tests Need Redesign**:
   - Test #10-20: Redesign with real connections
   - DELETE Test #16: state:update (eliminated)
   - Add Decision #2 wrapping expectations
   - Add Decision #5 queueLength field

4. **Create Missing Tests**:
   - score:updated contract test
   - group:completed contract test
   - device:connected contract test
   - device:disconnected contract test
   - session:paused, session:resumed, session:ended contract tests

**Correct Approach** (from integration tests):
- `gm_scanner.test.js.disabled` shows RIGHT way to test WebSocket:
  - Real connections
  - Real event emissions
  - Actual backend behavior validation
  - Proper async handling

**Risk Assessment**:
- **HIGH RISK**: No contract validation happening
- Breaking changes could ship without detection
- Must fix before creating OpenAPI/AsyncAPI contracts

**Recommendation**:
- Redesign ALL WebSocket contract tests before Phase 5 (contracts)
- Use integration test patterns as template
- Consider this architectural problem #2
- May want dedicated WebSocket contract test infrastructure

**Effort**: 12 hours (complete redesign of 10 tests + create 7 new tests)
**Priority**: 🔴 HIGH - Do before Phase 5 (contract creation)

---

### 🟡 MEDIUM ISSUE #3: Sparse Unit Test Coverage

**Problem**: Only 2 unit test files exist

**Current Unit Tests**:
- ✅ `middleware/offlineStatus.test.js` (120 lines) - PERFECT
- ✅ `services/offlineQueueService.test.js` (150 lines) - PERFECT

**Missing Unit Tests**:
- ❌ No route unit tests (scanRoutes, videoRoutes, sessionRoutes, adminRoutes)
- ❌ No service unit tests (transactionService, sessionService, stateService, videoQueueService, vlcService)
- ❌ No model unit tests (Session, GameState, Transaction)
- ❌ No middleware unit tests (except offline status)
- ❌ No utility unit tests

**What This Means**:
- Components tested ONLY at integration level
- Slow test feedback (full HTTP/WebSocket stack)
- Difficult to test edge cases in isolation
- Components may not be designed for unit testability

**Why This Matters**:
- **Slow feedback loop**: Integration tests take longer to run
- **Hard to isolate failures**: Integration test failure could be any component
- **Edge cases untested**: Integration tests don't cover all code paths
- **Refactoring risk**: No safety net for internal changes

**Architectural Implications**:
This suggests components are:
- Tightly coupled (hard to test in isolation)
- Not using dependency injection
- May have hidden dependencies
- Not designed with testability in mind

**Evidence of Testability Problems**:
- `offline_mode.test.js` requires custom singleton preservation
- Comments about "Jest module issues"
- Large integration tests (500 lines)
- One integration test skipped (timing issues)

**Impact on Refactoring**:
- Changes require slow integration test runs
- Failures hard to diagnose
- Edge cases may be missed
- Confidence in changes lower

**Recommendations**:

1. **Short Term** (for this refactor):
   - Keep current integration tests (they work)
   - Add unit tests for NEW code
   - Don't block refactor on unit test creation

2. **Medium Term** (Phase 6+):
   - Add unit tests for routes (can mock services)
   - Add unit tests for services (can mock dependencies)
   - Use existing 2 unit tests as templates (they're PERFECT)

3. **Long Term** (future refactoring):
   - Refactor services for testability:
     - Use dependency injection
     - Extract interfaces
     - Avoid singleton preservation hacks
   - Design new components with unit testability
   - Achieve 80% coverage target via unit tests (not integration)

**Example What to Add**:
```javascript
// tests/unit/routes/scanRoutes.test.js
describe('POST /api/scan', () => {
  it('should call transactionService with correct params', async () => {
    const mockTransactionService = {
      createTransaction: jest.fn().mockResolvedValue({ id: 'tx-123' })
    };

    const app = createApp({ transactionService: mockTransactionService });

    await request(app)
      .post('/api/scan')
      .send({ tokenId: 'TEST', teamId: 'TEAM_A', deviceId: 'SCANNER_01' });

    expect(mockTransactionService.createTransaction).toHaveBeenCalledWith({
      tokenId: 'TEST',
      teamId: 'TEAM_A',
      deviceId: 'SCANNER_01'
    });
  });
});
```

**Effort**:
- Would take 20-30 hours to add comprehensive unit tests
- NOT recommended for this refactor (too much scope)
- Add incrementally in future work

**Priority**: 🟡 MEDIUM - Don't block refactor, but improve over time

**Notes**:
- The 2 unit tests that exist are GOLD STANDARD examples
- Use them as templates for new unit tests
- This is technical debt to address post-refactor

---

### 🟡 MEDIUM ISSUE #4: Test Brittleness Indicators

**Problem**: Multiple signals of test suite brittleness

**Evidence**:

1. **gm_scanner.test.js DISABLED** (500 lines):
   - Most important tests not running
   - Unknown reason (investigation needed)
   - Suggests breaking changes or architecture problems

2. **network_recovery.test.js Test SKIPPED**:
   - Test #56: WebSocket reconnection test `.skip`
   - Reason: "timing issues"
   - Suggests async handling problems or race conditions

3. **offline_mode.test.js Custom Setup**:
   ```javascript
   // Line 18 comment:
   // "We preserve singletons because these tests verify state transitions
   // that require services to maintain state across the transition."
   ```
   - Requires custom singleton preservation
   - Suggests services not designed for testability
   - Comment about "Jest module issues"
   - One test removed due to "WebSocket handlers don't see offline status"

4. **Large Integration Test Files**:
   - gm_scanner.test.js: 500 lines
   - offline_mode.test.js: 400+ lines
   - admin_panel.test.js: 300+ lines
   - Hard to maintain, easy to break

5. **Comments About Issues**:
   - "Jest module issues"
   - "WebSocket handlers don't see offline status"
   - "Timing issues"
   - Multiple "Test removed" comments

**What This Indicates**:
- **Underlying architectural problems**: Services tightly coupled
- **Async handling issues**: Timing problems, race conditions
- **Jest configuration problems**: Module loading issues
- **Test design problems**: Tests too large, complex setup

**Impact**:
- Tests become ignored (disabled/skipped)
- False failures due to timing
- Slow test runs
- Low confidence in test suite
- Refactoring becomes risky

**Root Causes**:

1. **Singleton Pattern Problems**:
   - Services use singleton pattern
   - Hard to reset between tests
   - State leaks between tests
   - Requires custom preservation logic

2. **Tight Coupling**:
   - Services directly reference each other
   - Hard to mock dependencies
   - Hard to test in isolation

3. **Async Complexity**:
   - WebSocket timing assumptions
   - Race conditions in event handling
   - done() callback issues

4. **Large Test Files**:
   - Too many scenarios in one file
   - Complex setup/teardown
   - Hard to understand failures

**Recommendations**:

1. **Immediate** (for this refactor):
   - Investigate gm_scanner disabled reason (CRITICAL)
   - Fix skipped test after Decision #4 field name changes
   - Keep current offline_mode setup (works, don't fix now)

2. **Short Term** (Phase 6):
   - Split large test files:
     - gm_scanner.test.js → 5 files of 100 lines each
     - offline_mode.test.js → 3 files
     - admin_panel.test.js → 3 files
   - Standardize async patterns (promises over done())

3. **Long Term** (post-refactor):
   - Refactor services for testability:
     - Dependency injection
     - Avoid singletons (or make them testable)
     - Extract interfaces
   - Improve test infrastructure:
     - Better async helpers
     - Standardized setup/teardown
     - Shared test utilities

**Effort**:
- Investigation: 2 hours (understand all issues)
- Fixes: 8-10 hours (split files, fix async)
- Long-term refactoring: 40+ hours (not for this phase)

**Priority**: 🟡 MEDIUM - Address critical items now, defer long-term fixes

**Notes**:
- These are symptoms of deeper architectural issues
- Don't try to fix everything in this refactor
- Focus on making tests pass with new contracts
- Plan separate initiative for test architecture improvements

---

### 🟢 LOW ISSUE #5: Integration Test Size

**Problem**: Several integration test files are very large

**Large Files**:
- gm_scanner.test.js.disabled: 500 lines, 30+ tests
- offline_mode.test.js: 400+ lines, 7+ tests (very dense)
- admin_panel.test.js: 300+ lines, 10 tests
- player_scanner.test.js: 294 lines, 11 tests

**Why This Matters**:
- **Hard to maintain**: 500 lines difficult to understand
- **Slow to run**: Many tests in one file
- **Difficult to debug**: Failures hard to isolate
- **Complex setup**: Shared state between tests

**Recommendations**:

**Split gm_scanner.test.js** (when re-enabled):
```
gm_scanner.test.js (500 lines) →
  - gm_handshake.test.js (handshake, identification)
  - gm_transactions.test.js (transaction submission, duplicates)
  - gm_scoring.test.js (score updates, calculations)
  - gm_commands.test.js (admin commands, state management)
  - gm_concurrency.test.js (rapid submissions, timing)
```

**Split offline_mode.test.js**:
```
offline_mode.test.js (400 lines) →
  - offline_queuing.test.js (queue behavior, limits)
  - offline_processing.test.js (online transition, processing)
  - offline_video.test.js (video handling when offline)
```

**Split admin_panel.test.js**:
```
admin_panel.test.js (300 lines) →
  - admin_auth.test.js (authentication flows)
  - admin_session.test.js (session management)
  - admin_controls.test.js (video controls, monitoring)
```

**Benefits**:
- Easier to understand (focused files)
- Faster to run (parallelizable)
- Easier to debug (isolated failures)
- Simpler setup (specific to scenario)

**Effort**: 8 hours (split 3 files)
**Priority**: 🟢 LOW - Don't block refactor, improve later

**Notes**:
- Do this AFTER re-enabling gm_scanner
- Part of general test architecture improvement
- Not critical for contract alignment refactor

---

## Part 5: Test Architecture Recommendations

### Current State Assessment

**Strengths**:
- ✅ Jest well-configured (good coverage thresholds, appropriate timeouts)
- ✅ Supertest HTTP testing excellent
- ✅ Integration tests validate real flows
- ✅ Existing unit tests are PERFECT examples
- ✅ Good test helper functions (connectAndIdentify, waitForEvent)

**Weaknesses**:
- ❌ WebSocket contract tests fake (don't validate real backend)
- ❌ Sparse unit test coverage (only 2 files)
- ❌ Test brittleness (disabled file, skipped test, custom setup)
- ❌ Large test files (up to 500 lines)
- ❌ Architectural testability issues (singleton preservation)

### Recommended Test Architecture

```
backend/tests/
├── contract/                           # API Contract Validation
│   ├── http-api-contracts.test.js     # ✅ GOOD (keep as-is, minor updates)
│   ├── websocket-contracts.test.js    # 🔄 REDESIGN (use real connections)
│   ├── http-test-utils.js             # ✅ GOOD (helper functions)
│   └── ws-test-utils.js                # ✅ GOOD (helper functions)
│
├── integration/                        # End-to-End Flows
│   ├── gm_handshake.test.js           # 🆕 SPLIT from gm_scanner
│   ├── gm_transactions.test.js        # 🆕 SPLIT from gm_scanner
│   ├── gm_scoring.test.js             # 🆕 SPLIT from gm_scanner
│   ├── gm_commands.test.js            # 🆕 SPLIT from gm_scanner
│   ├── admin_auth.test.js             # 🆕 SPLIT from admin_panel
│   ├── admin_session.test.js          # 🆕 SPLIT from admin_panel
│   ├── admin_controls.test.js         # 🆕 SPLIT from admin_panel
│   ├── player_scanner.test.js         # ✅ KEEP (good size)
│   ├── video_playback.test.js         # ✅ KEEP (good size)
│   ├── offline_queuing.test.js        # 🆕 SPLIT from offline_mode
│   ├── offline_processing.test.js     # 🆕 SPLIT from offline_mode
│   ├── network_recovery.test.js       # ✅ KEEP (fix skipped test)
│   ├── restart_recovery.test.js       # ✅ KEEP
│   └── test-helpers.js                # ✅ GOOD (shared utilities)
│
└── unit/                               # Isolated Component Testing
    ├── routes/                         # 🆕 ADD
    │   ├── scanRoutes.test.js
    │   ├── videoRoutes.test.js
    │   ├── sessionRoutes.test.js
    │   └── adminRoutes.test.js
    ├── services/                       # 🆕 ADD MORE
    │   ├── offlineQueueService.test.js # ✅ PERFECT (keep as template)
    │   ├── transactionService.test.js  # 🆕 ADD
    │   ├── sessionService.test.js      # 🆕 ADD
    │   ├── stateService.test.js        # 🆕 ADD
    │   └── videoQueueService.test.js   # 🆕 ADD
    └── middleware/
        └── offlineStatus.test.js       # ✅ PERFECT (keep as template)
```

### Test Layer Guidelines

#### Contract Tests
**Purpose**: Validate API structure matches contracts
**Scope**: Field existence, types, HTTP codes, event structure
**Do**: Validate response shape, required fields, data types
**Don't**: Test business logic, state transitions, complex flows

**Pattern**:
```javascript
describe('POST /api/scan contract', () => {
  it('should match OpenAPI schema for success response', async () => {
    const response = await request(app)
      .post('/api/scan')
      .send(validRequest);

    expect(response.status).toBe(200);
    expect(response.body).toMatchSchema(openapi, '/api/scan', 'post');
  });
});
```

#### Integration Tests
**Purpose**: Validate multi-component flows
**Scope**: Complete user journeys, component integration
**Do**: Test real HTTP/WebSocket flows, multi-step processes
**Don't**: Test every code path, test component internals

**Pattern**:
```javascript
describe('GM Scanner duplicate detection flow', () => {
  it('should detect duplicate within session', async () => {
    // 1. Connect GM
    const socket = await connectAndIdentify('GM_01');

    // 2. Submit first scan
    socket.emit('transaction:submit', { tokenId: 'TEST_001', ... });
    const first = await waitForEvent(socket, 'transaction:result');
    expect(first.status).toBe('accepted');

    // 3. Submit duplicate
    socket.emit('transaction:submit', { tokenId: 'TEST_001', ... });
    const second = await waitForEvent(socket, 'transaction:result');
    expect(second.status).toBe('duplicate');
  });
});
```

#### Unit Tests
**Purpose**: Validate component logic in isolation
**Scope**: Single function/class, mocked dependencies
**Do**: Test edge cases, error paths, pure logic
**Don't**: Test integration, real HTTP/WebSocket

**Pattern**:
```javascript
describe('TransactionService.createTransaction', () => {
  it('should detect duplicate token in session', async () => {
    const mockSessionService = {
      getCurrentSession: jest.fn().mockReturnValue({ id: 'session-123' })
    };
    const mockStateService = {
      hasTokenBeenScanned: jest.fn().mockReturnValue(true)
    };

    const service = new TransactionService({
      sessionService: mockSessionService,
      stateService: mockStateService
    });

    const result = await service.createTransaction({
      tokenId: 'TEST_001',
      teamId: 'TEAM_A'
    });

    expect(result.status).toBe('duplicate');
    expect(mockStateService.hasTokenBeenScanned).toHaveBeenCalledWith('TEST_001', 'session-123');
  });
});
```

### Infrastructure Improvements

#### 1. WebSocket Contract Test Infrastructure

Create shared infrastructure for real WebSocket testing:

```javascript
// tests/contract/ws-contract-test-base.js
class WebSocketContractTest {
  async setup() {
    this.testContext = await setupTestServer();
    this.socket = io(this.testContext.socketUrl);
    await this.socket.connected;
  }

  async teardown() {
    if (this.socket) this.socket.disconnect();
    if (this.testContext) await cleanupTestServer(this.testContext);
  }

  async validateEvent(eventName, expectedSchema) {
    const event = await waitForEvent(this.socket, eventName);
    expect(event).toMatchSchema(asyncapi, eventName);
    return event;
  }
}
```

#### 2. Contract Schema Validation

Integrate OpenAPI and AsyncAPI validation:

```javascript
// tests/helpers/schema-validator.js
const openapi = require('../../contracts/openapi.yaml');
const asyncapi = require('../../contracts/asyncapi.yaml');

function matchAPISchema(apiSpec, path, method) {
  return {
    asymmetricMatch(actual) {
      const schema = apiSpec.paths[path][method].responses['200'].schema;
      return validateSchema(actual, schema);
    }
  };
}
```

#### 3. Standardized Async Helpers

Improve async handling to avoid timing issues:

```javascript
// tests/helpers/async-helpers.js
async function waitForEvent(socket, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeout);

    const handler = (data) => {
      clearTimeout(timer);
      resolve(data);
    };

    socket.once(eventName, handler);
  });
}

async function waitForCondition(checkFn, timeout = 5000, interval = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await checkFn()) return true;
    await delay(interval);
  }
  throw new Error('Timeout waiting for condition');
}
```

### Service Refactoring for Testability

**Current Problem**: Services use singleton pattern, hard to test

**Recommended Pattern**: Dependency injection

```javascript
// Current (HARD TO TEST):
class TransactionService {
  constructor() {
    this.sessionService = require('./sessionService'); // COUPLED
    this.stateService = require('./stateService');     // COUPLED
  }
}

// Recommended (EASY TO TEST):
class TransactionService {
  constructor({ sessionService, stateService }) {
    this.sessionService = sessionService;
    this.stateService = stateService;
  }
}

// Testing becomes easy:
const service = new TransactionService({
  sessionService: mockSessionService,  // INJECT MOCK
  stateService: mockStateService        // INJECT MOCK
});
```

### Phased Implementation

#### Phase 1 (This Refactor - Weeks 1-2):
- 🔴 **CRITICAL**: Investigate gm_scanner.test.js disabled
- 🔴 **HIGH**: Redesign WebSocket contract tests
- Update existing tests for Decisions #2-7
- Create missing contract tests (score:updated, group:completed)
- Re-enable gm_scanner.test.js

#### Phase 2 (Post-Refactor - Weeks 3-4):
- Split large integration test files
- Fix skipped test (network_recovery)
- Standardize async helpers
- Add schema validation infrastructure

#### Phase 3 (Future Work - Months 2-3):
- Add route unit tests
- Add service unit tests
- Refactor services for dependency injection
- Achieve 80% coverage via unit tests

---

## Part 6: Missing Coverage & New Tests Needed

Based on 29 APIs verified in Phase 3, the following tests are missing:

### 🆕 High Priority - Missing Contract Tests

#### 1. score:updated Event Contract Test
**Why Critical**: Breaking change risk without tests
**Current Coverage**: ❌ NONE
**Backend**: broadcasts.js:183-194 (nested data.data structure)
**Scanner Expectation**: Finding #4 (expects data.data, 7 fields required)

**Test Should Validate**:
```javascript
{
  event: 'score:updated',
  data: {                    // NOT data.data (fix backend)
    teamId: string,
    currentScore: number,
    previousScore: number,
    pointsEarned: number,
    tokenId: string,
    transactionId: string,
    timestamp: string
  },
  timestamp: string
}
```

**Actions**:
- Create real WebSocket contract test
- Trigger score update (GM transaction)
- Validate event structure
- Verify all 7 fields present
- Fix backend nested data.data issue

**Effort**: 2 hours
**Priority**: 🔴 HIGH

---

#### 2. group:completed Event Contract Test
**Why Critical**: Breaking change risk without tests
**Current Coverage**: ❌ NONE
**Backend**: broadcasts.js:145-181 (nested data.data structure)
**Scanner Expectation**: Finding #5 (expects data.data, 4 fields required)

**Test Should Validate**:
```javascript
{
  event: 'group:completed',
  data: {                    // NOT data.data (fix backend)
    group: string,
    completedBy: string,
    bonusPoints: number,
    timestamp: string
  },
  timestamp: string
}
```

**Actions**:
- Create real WebSocket contract test
- Trigger group completion
- Validate event structure
- Verify all 4 fields present
- Fix backend nested data.data issue

**Effort**: 2 hours
**Priority**: 🔴 HIGH

---

#### 3. device:connected Event Contract Test
**Why Important**: Admin panel device tracking
**Current Coverage**: ⚠️ Integration test only (Test #29)
**Backend**: gmAuth.js:99-105, deviceTracking.js

**Test Should Validate**:
```javascript
{
  event: 'device:connected',
  data: {
    deviceId: string,
    type: 'gm' | 'player',
    name: string,
    ipAddress: string,
    timestamp: string
  },
  timestamp: string
}
```

**Actions**:
- Create real WebSocket contract test
- Connect GM scanner
- Validate event structure
- Verify Decision #2 wrapping
- Verify Decision #4 field name (deviceId)

**Effort**: 1.5 hours
**Priority**: 🟡 MEDIUM

---

#### 4. device:disconnected Event Contract Test
**Why Important**: Admin panel device tracking
**Current Coverage**: ⚠️ Implied by Test #29
**Backend**: deviceTracking.js:28-32, 121-125

**Test Should Validate**:
```javascript
{
  event: 'device:disconnected',
  data: {
    deviceId: string,
    reason: 'manual' | 'timeout',
    timestamp: string
  },
  timestamp: string
}
```

**Actions**:
- Create real WebSocket contract test
- Connect then disconnect GM scanner
- Validate event structure
- Verify Decision #2 wrapping

**Effort**: 1.5 hours
**Priority**: 🟡 MEDIUM

---

#### 5. session:paused Event Contract Test
**Why Important**: Session lifecycle validation
**Current Coverage**: ⚠️ Tested indirectly via admin commands
**Backend**: sessionRoutes.js, broadcasts.js

**Test Should Validate**:
```javascript
{
  event: 'session:paused',
  data: {
    id: string,
    name: string,
    status: 'paused',
    startTime: string,
    pausedAt: string,
    // ... full session object
  },
  timestamp: string
}
```

**Effort**: 1 hour
**Priority**: 🟢 LOW

---

#### 6. session:resumed Event Contract Test
**Why Important**: Session lifecycle validation
**Current Coverage**: ⚠️ Tested indirectly via admin commands
**Backend**: sessionRoutes.js, broadcasts.js

**Test Should Validate**: Similar to session:paused

**Effort**: 1 hour
**Priority**: 🟢 LOW

---

#### 7. session:ended Event Contract Test
**Why Important**: Session lifecycle validation
**Current Coverage**: ❌ No explicit test
**Backend**: sessionRoutes.js, broadcasts.js

**Test Should Validate**:
```javascript
{
  event: 'session:ended',
  data: {
    id: string,
    name: string,
    status: 'ended',
    startTime: string,
    endTime: string,
    finalScores: array,
    // ... full session object
  },
  timestamp: string
}
```

**Effort**: 1.5 hours
**Priority**: 🟡 MEDIUM

---

### 🆕 Medium Priority - Missing Integration Tests

#### 8. Score Update Broadcast Flow Integration Test
**Why Important**: Validates score:updated event in real scenario
**Current Coverage**: ❌ NONE

**Test Should Validate**:
- GM submits transaction
- Transaction accepted
- score:updated broadcast emitted
- All connected GMs receive event
- Score values correct
- All 7 fields present

**Pattern**:
```javascript
it('should broadcast score updates to all connected GMs', async () => {
  // Connect 2 GMs
  const gm1 = await connectAndIdentify('GM_01');
  const gm2 = await connectAndIdentify('GM_02');

  // GM1 submits transaction
  gm1.emit('transaction:submit', { tokenId: 'TEST_001', teamId: 'TEAM_A', ... });

  // Both GMs should receive score:updated
  const [update1, update2] = await Promise.all([
    waitForEvent(gm1, 'score:updated'),
    waitForEvent(gm2, 'score:updated')
  ]);

  // Validate structure and values
  expect(update1.data.teamId).toBe('TEAM_A');
  expect(update1.data.pointsEarned).toBeGreaterThan(0);
  expect(update2).toEqual(update1); // Same event to both
});
```

**Effort**: 2 hours
**Priority**: 🟡 MEDIUM

---

#### 9. Group Completion Flow Integration Test
**Why Important**: Validates group:completed event in real scenario
**Current Coverage**: ❌ NONE

**Test Should Validate**:
- Complete all tokens in a group
- group:completed broadcast emitted
- All connected GMs receive event
- Bonus points calculated correctly
- All 4 fields present

**Effort**: 2 hours
**Priority**: 🟡 MEDIUM

---

#### 10. Complete Game Session Lifecycle End-to-End Test
**Why Important**: Validates entire session flow
**Current Coverage**: ⚠️ Pieces tested separately

**Test Should Validate**:
- Admin creates session (session:new event)
- GM connects (gm:identified event)
- GM submits transactions (transaction:new, score:updated events)
- Admin pauses session (session:paused event)
- Admin resumes session (session:resumed event)
- Complete group (group:completed event)
- Admin ends session (session:ended event)
- Verify final scores
- Verify session persisted

**This is the "golden path" test** - exercises most of the system

**Effort**: 3 hours (complex flow)
**Priority**: 🟡 MEDIUM (validates system integration)

---

### Summary of New Tests Needed

**Total New Tests**: 10

**By Priority**:
- 🔴 **HIGH** (2 tests, 4 hours):
  1. score:updated contract test
  2. group:completed contract test

- 🟡 **MEDIUM** (5 tests, 10 hours):
  3. device:connected contract test
  4. device:disconnected contract test
  7. session:ended contract test
  8. score:updated integration test
  9. group:completed integration test

- 🟢 **LOW** (3 tests, 3.5 hours):
  5. session:paused contract test
  6. session:resumed contract test
  10. Complete session lifecycle E2E test (optional but valuable)

**Total Effort**: 17.5 hours

**Recommendation**:
- Do HIGH priority tests as part of this refactor (critical gaps)
- Do MEDIUM priority tests in Phase 4.5 Step 2 completion
- Do LOW priority tests in Phase 4.5 Step 3 (test architecture)

---

## Part 7: Implementation Roadmap

### Overview

This roadmap shows the **correct order** of test changes during refactoring. Dependencies and blocking items are clearly marked.

### Phase 0: INVESTIGATION COMPLETE ✅

**Status**: Investigation complete - root cause identified
**Duration**: Investigation already performed during Phase 4.5 Step 2

#### Task 0.1: Investigate gm_scanner.test.js.disabled - ✅ COMPLETE

**Investigation Performed**:
- Read complete 500-line test file
- Analyzed all 13 tests individually
- Cross-referenced with test-helpers.js
- Compared with working tests (admin_panel.test.js, offline_mode.test.js)
- Checked git history (file added already disabled in commit 331e0fd)

**Root Cause Identified**: `connectAndIdentify` function signature incompatibility

**The Issue**:
```javascript
// Test #1 line 50 (BROKEN):
gmSocket = await connectAndIdentify(testContext.socketUrl, 'GM_TEST_01');
// Only 2 parameters

// Current signature (test-helpers.js:71):
async function connectAndIdentify(socketOrUrl, deviceType, deviceId, timeout)
// Requires 3-4 parameters

// What test expects (OLD signature):
async function connectAndIdentify(url, stationId, timeout)
```

**Analysis Results**:
- ✅ All 13 tests at CORRECT level (integration)
- ✅ All 13 tests use CORRECT framework (real WebSocket)
- ✅ No architectural problems
- ✅ No timing issues or race conditions
- ❌ Signature incompatibility (1 instance - Test #1 line 50)
- ❌ Field name conflicts with Decision #4 (~23 instances across all tests)

**Why File Was Disabled**:
- Added already disabled in initial commit 331e0fd (Sept 26, 2025)
- Likely copied from older codebase where signature was different
- Would fail immediately on Test #1 due to wrong parameter count

**Issues to Fix**:
1. **Signature fix** (Test #1 line 50): Add `'gm'` parameter - 5 minutes
2. **Field names** (~23 instances): `stationId`/`scannerId` → `deviceId` - ~2.8 hours
3. **Re-enable**: Remove `.disabled` extension + verify - 1 hour

**Decision**: ✅ FIXABLE - No architectural refactoring needed

**Effort**: ~4 hours total (revised down from 7-10 hours after investigation)

**Risk**: MEDIUM (revised down from HIGHEST after investigation)
- Issues well-understood
- Changes are mechanical
- Tests are high quality

**Dependencies**:
- DEPENDS ON: Backend must accept `deviceId` first (Decision #4)
- BLOCKS: GM Scanner refactoring
- COORDINATE: Backend + Scanner + Tests together (breaking change)

**See**:
- Part 2 (lines 840-1060): Detailed test-by-test breakdown
- Part 4 Critical Issue #1 (lines 1943-2048): Complete analysis with code examples

---

### Phase 1: Backend Preparation & Non-Breaking Changes

**Duration**: 1-2 days
**Can proceed in parallel after Phase 0**

#### Task 1.1: Decision #6 - Eliminate state:update Event
**Why**: Simple, non-breaking, cleanup
**Actions**:
1. Delete Test #16 (websocket-contracts-simple.test.js:172-188)
2. Remove backend emission (stateService.js:538-540)
3. Verify no integration tests break

**Effort**: 1.5 hours
**Priority**: 🟡 LOW (but easy win)
**Blocking**: None
**Blocked By**: None

---

#### Task 1.2: Decision #5 - Add queueLength to video:status
**Why**: Additive, non-breaking
**Actions**:
1. Backend: Add queueLength field to broadcasts.js:196-307
2. Test: Note for later (will update in Phase 3 WebSocket redesign)

**Effort**: 0.5 hours (backend only)
**Priority**: 🟡 LOW
**Blocking**: None
**Blocked By**: None

---

#### Task 1.3: Create Missing High-Priority Contract Tests
**Why**: Need tests before making breaking changes
**Actions**:
1. score:updated contract test (2 hours)
2. group:completed contract test (2 hours)
3. Reveals if current backend structure works

**Effort**: 4 hours
**Priority**: 🔴 HIGH (creates safety net)
**Blocking**: Decision #2 backend changes
**Blocked By**: None (can create even with fake approach, then redesign in Phase 3)

**Note**: These can use temporary "fake" approach initially, then redesign in Phase 3 with other WebSocket tests

---

### Phase 2: Decision #4 - Field Names (BREAKING CHANGE)

**Duration**: 2-3 days
**BREAKING CHANGE - Requires coordination**

#### Task 2.1: Backend Field Name Changes
**Actions**:
1. gmAuth.js: Accept `deviceId` in gm:identify
2. broadcasts.js: Use `deviceId` in emissions
3. transactionService.js: Accept `deviceId` in transaction:submit
4. Keep backward compatibility temporarily:
   ```javascript
   // Accept both during transition:
   const deviceId = data.deviceId || data.scannerId || data.stationId;
   ```

**Effort**: 2 hours
**Priority**: 🔴 HIGH - BLOCKING
**Blocking**: All test updates, scanner updates
**Blocked By**: Phase 0 (investigation may inform approach)

---

#### Task 2.2: Test Field Name Updates
**Actions**:
1. gm_scanner.test.js.disabled: Update all ~20 instances (if re-enabling)
2. admin_panel.test.js: Update Test #29 (line 709)
3. network_recovery.test.js: Update Test #56, #57 (lines 1270, 1298)
4. offline_mode.test.js: Update Test #50 (line 1136)

**Effort**: 3 hours
**Priority**: 🔴 HIGH
**Blocking**: None
**Blocked By**: Task 2.1 (backend changes)

---

#### Task 2.3: Re-enable gm_scanner.test.js (If Possible)
**Actions**:
1. Remove .disabled extension
2. Run test suite
3. Fix any remaining issues
4. Verify all 30+ tests pass

**Effort**: 2 hours (if investigation successful)
**Priority**: 🔴 HIGH
**Blocking**: None (but validates Decision #4)
**Blocked By**: Task 2.2 (test updates)

---

### Phase 3: WebSocket Contract Test Redesign

**Duration**: 3-4 days
**Can start after Phase 1, parallel to Phase 2**

#### Task 3.1: Setup WebSocket Contract Test Infrastructure
**Actions**:
1. Create WebSocketContractTest base class
2. Setup schema validation helpers
3. Improve async helpers (waitForEvent, waitForCondition)
4. Document patterns for future tests

**Effort**: 3 hours
**Priority**: 🔴 HIGH
**Blocking**: Task 3.2 (all contract test redesigns)
**Blocked By**: None

---

#### Task 3.2: Redesign All WebSocket Contract Tests
**Actions**:
Redesign 10 tests to use real connections:
1. Test #11: device:identify ack (1h)
2. Test #12: error events (1h)
3. Test #13: transaction:result (1h)
4. Test #14: transaction:new - verify backend wraps (0.5h)
5. Test #15: state:sync - add wrapping (1h)
6. Test #17: video:status - add queueLength (1h)
7. Test #18: session:new - add wrapping (1h)
8. Test #19: sync:full - add wrapping (1h)
9. Test #20: gm:command:ack - add wrapping (1h)
10. CREATE new tests: device events, session events (4h)

**Effort**: 12 hours
**Priority**: 🔴 HIGH
**Blocking**: Phase 5 (contracts)
**Blocked By**: Task 3.1 (infrastructure)

---

### Phase 4: Decision #2 - WebSocket Envelope Wrapping

**Duration**: 2-3 days
**BREAKING CHANGE - Requires coordination**

#### Task 4.1: Backend Wrapping Changes
**Actions**:
1. broadcasts.js: Wrap state:sync (line 125-128)
2. broadcasts.js: Wrap sync:full (line 131-138)
3. broadcasts.js: Fix nested data.data in score:updated (line 183-194)
4. broadcasts.js: Fix nested data.data in group:completed (line 145-181)
5. broadcasts.js: Wrap session events
6. adminEvents.js: Wrap scores:reset (line 68-71)
7. adminEvents.js: Wrap gm:command:ack

**Effort**: 4 hours
**Priority**: 🟡 MEDIUM
**Blocking**: Scanner updates (must coordinate)
**Blocked By**: Task 3.2 (tests need to be ready to validate)

---

#### Task 4.2: Update Integration Tests for Wrapping
**Actions**:
1. Verify gm_scanner.test.js expectations (already expects wrapped for transaction:new)
2. Update any integration tests affected by wrapping changes
3. Run full integration test suite

**Effort**: 2 hours
**Priority**: 🟡 MEDIUM
**Blocking**: None
**Blocked By**: Task 4.1 (backend changes)

---

### Phase 5: Decision #3 - RESTful HTTP Responses

**Duration**: 1-2 days
**Low risk, can do anytime**

#### Task 5.1: Backend HTTP Response Changes
**Actions**:
1. scanRoutes.js: Remove `status` field wrapper
2. videoRoutes.js: Remove `success` field wrapper
3. Use HTTP status codes appropriately

**Effort**: 3 hours
**Priority**: 🟢 LOW (scanners ignore responses)
**Blocking**: Task 5.2 (test updates)
**Blocked By**: None

---

#### Task 5.2: Update HTTP Response Tests
**Actions**:
1. Test #1: POST /api/scan contract (1h)
2. Tests #25-27: Admin video controls (0.5h)
3. Tests #31, #33, #34, #36: Video playback integration (1.5h)
4. Tests #38, #43-44: Player scanner integration (1h)

**Effort**: 4 hours
**Priority**: 🟢 LOW
**Blocking**: None
**Blocked By**: Task 5.1 (backend changes)

---

### Phase 6: Decision #7 - session:update Full Resource

**Duration**: 0.5 days
**Low risk, simple verification**

#### Task 6.1: Verify and Update
**Actions**:
1. Verify backend already returns full session object
2. Update Test #18 (part of Task 3.2 redesign)
3. Verify Test #24 expectations

**Effort**: 3 hours
**Priority**: 🟢 LOW
**Blocking**: None
**Blocked By**: None (can do anytime)

---

### Phase 7: Remaining Items & Cleanup

**Duration**: 1 day
**Final verification and documentation**

#### Task 7.1: Create Remaining Integration Tests
**Actions**:
1. score:updated integration test (2h)
2. group:completed integration test (2h)
3. Optional: Complete session lifecycle E2E test (3h)

**Effort**: 4-7 hours
**Priority**: 🟡 MEDIUM
**Blocking**: None
**Blocked By**: Phase 2, 4 (backend changes need to be done)

---

#### Task 7.2: Final Verification
**Actions**:
1. Run complete test suite
2. Verify all tests pass
3. Check test coverage reports
4. Verify no skipped/disabled tests (except known items)
5. Document any remaining issues

**Effort**: 2 hours
**Priority**: 🔴 HIGH
**Blocking**: None
**Blocked By**: All other phases

---

#### Task 7.3: Update Documentation
**Actions**:
1. Update TEST-INVENTORY.md with changes
2. Update 05-test-analysis.md status
3. Update 00-INDEX.md with Phase 4.5 completion
4. Document any deferred items

**Effort**: 1 hour
**Priority**: 🔴 HIGH
**Blocking**: Phase 5 (contracts) and Phase 6 (refactor plan)
**Blocked By**: Task 7.2 (verification)

---

### Critical Path Summary

```
Phase 0: Investigation (CRITICAL) [2h]
    ↓
Phase 1: Non-breaking Changes [6h] ⟍
                                    ⟩ Can run parallel
Phase 2: Field Names (BREAKING) [7h] ⟋
    ↓
Phase 3: WebSocket Redesign [15h]
    ↓
Phase 4: Wrapping (BREAKING) [6h]
    ↓
Phase 5: HTTP Responses [7h] ⟍
                             ⟩ Can run parallel
Phase 6: Session Full Resource [3h] ⟋
    ↓
Phase 7: Final Items [7-10h]

TOTAL: 53-56 hours
```

### Parallel Work Opportunities

**Can run parallel**:
- Phase 1 + Phase 2 (after investigation)
- Phase 5 + Phase 6 (independent)
- Task 1.3 (create tests) + Phase 2 (backend changes)

**Must be sequential**:
- Phase 0 MUST be first (investigation)
- Phase 2 MUST complete before re-enabling gm_scanner
- Phase 3 SHOULD complete before Phase 4 (validates backend changes)

### Risk Mitigation

**High-Risk Items**:
1. **Phase 0**: May reveal architectural issues
   - Mitigation: Timebox to 2 hours, escalate if needed
   - Backup plan: Defer gm_scanner re-enabling, document issues

2. **Phase 2**: Breaking change (field names)
   - Mitigation: Backward compatibility during transition
   - Backup plan: Keep accepting old field names for one release

3. **Phase 4**: Breaking change (wrapping)
   - Mitigation: Coordinate with scanner updates
   - Backup plan: Scanner Finding #2 shows fallback exists for transaction:new

**Low-Risk Items**:
- Phase 1: Simple deletions/additions
- Phase 5: Scanners ignore responses
- Phase 6: Simple verification

---

## Conclusion

This test analysis provides:
- ✅ Complete coverage map of 75+ tests
- ✅ Detailed actions for each test
- ✅ Decision impact analysis with effort estimates
- ✅ Critical architectural issues identified
- ✅ Clear implementation roadmap with dependencies
- ✅ Missing test identification (10 new tests needed)
- ✅ Test architecture recommendations

**Next Steps**:
1. **CRITICAL**: Execute Phase 0 (investigate gm_scanner.test.js.disabled)
2. **HIGH**: Create score:updated and group:completed contract tests
3. **MEDIUM**: Begin WebSocket contract test redesign
4. **PARALLEL**: Start Decision #3 (HTTP) and Decision #6 (eliminate state:update)

**Ready for**:
- Phase 5: OpenAPI/AsyncAPI Contract Creation
- Phase 6: Refactor Plan Creation

**Total Effort Estimate**: 53-56 hours for all test changes

---

*Document Complete*: 2025-09-30
*Status*: ✅ READY FOR PHASE 4.5 STEP 3 (Test Architecture Design)
