# E2E Test Plan: AUDIT PHASE - Fixing Existing Tests Before New Implementation

> **CRITICAL STATUS CHANGE (2025-10-28):** Pivot from implementation to systematic audit.
>
> **Why:** Test 01 audit revealed architectural issues causing failures across multiple test files. Must fix existing tests before implementing new ones.
>
> **For Claude:** REQUIRED SKILL: Use superpowers:systematic-debugging for test audits.

---

## 🚨 PROJECT STATUS UPDATE (2025-10-28)

### Current Reality vs Original Plan

**Original Plan:**
- Status: "90 passing tests (45 unique tests across 2 browsers)"
- Phase 1: Test 07 series marked "COMPLETE ✅"
- Next: Implement Journey tests (Phases 2-4)

**Current Status (2025-10-28 Evening):**
```
✅ VERIFIED PASSING (29 tests total):
  - 00-smoke-test.test.js:            14/14 tests ✅
  - 01-session-lifecycle.test.js:     13/13 tests ✅ (contract fix)
  - 01-session-persistence.test.js:    1/1  test  ✅ (new file)
  - 07a-gm-scanner-standalone.test.js: 1/1  test  ✅ (anti-pattern fix)

⚠️ NEXT TO AUDIT (Phase 1 in progress):
  - 07b-gm-scanner-networked-blackmarket.test.js (estimated 6 tests)
  - 07c-gm-scanner-scoring-parity.test.js (estimated 5 tests)

⏸️ BLOCKED UNTIL 07 COMPLETE:
  - 21-player-scanner-networked-scanning.test.js
  - 31-websocket-events.test.js
  - Journey tests (40-*, 41-*, 42-*)
```

### Why the Pivot to Audit Phase?

**Test 01 Deep Dive Revealed:**
1. **Contract Violations**: Session status used 'completed' vs contract enum 'ended'
2. **Cross-Test Pollution**: Shared orchestrator state leaked between tests
3. **Persistence Bugs**: Storage type not configurable, session loading broken
4. **Architecture Issues**: Dual storage (disk + memory) management problems

**Impact:** If Test 01 (simple session lifecycle) had 3 critical issues, Tests 07/21/31 (complex multi-device scenarios) likely have similar or worse problems.

**Decision:** Systematic audit of ALL existing tests before implementing new ones.

---

## 📋 TEST AUDIT METHODOLOGY (Based on Test 01 Learnings)

### The Three-Issue Pattern

Every failing E2E test falls into one or more categories:

#### Issue Type 1: Contract Violations
**Symptoms:**
- Test expects 'ended', receives 'completed'
- WebSocket event shape doesn't match AsyncAPI contract
- HTTP response fields missing or wrong type

**How to Detect:**
1. Check contracts FIRST (asyncapi.yaml / openapi.yaml)
2. Validate enum values match exactly
3. Look for hardcoded values in events (masking bugs)

**Example from Test 01:**
```javascript
// BUG: Session model
this.status = 'completed';  // ❌ Not in contract enum

// CONTRACT: asyncapi.yaml:1016
enum: [active, paused, ended]  // ✅ Source of truth
```

#### Issue Type 2: Cross-Test Pollution
**Symptoms:**
- Flaky tests (pass alone, fail in suite)
- Test receives data from PREVIOUS test
- Different results based on execution order

**How to Detect:**
1. Run test in isolation: `npx playwright test file.test.js:123 --project=chromium`
2. Check for state that persists between tests
3. Identify if clearSessionData() actually clears ALL state

**Example from Test 01:**
```javascript
// TEST 2 EXPECTED: Clean session
// TEST 2 RECEIVED: "Test Session Alpha" from Test 1

// ROOT CAUSE: clearSessionData() only clears DISK, not MEMORY
// FIX: Restart orchestrator between tests
```

#### Issue Type 3: Persistence/State Management
**Symptoms:**
- Expected data after restart, received null
- Session disappears after process restart
- State inconsistent between services

**How to Detect:**
1. Trace session lifecycle: save → load → verify
2. Check STORAGE_TYPE env var is passed through
3. Verify services init() in correct order

**Example from Test 01:**
```javascript
// BUG 1: config.storage.type not defined
// BUG 2: sessionService.init() looked for deleted gameState
// BUG 3: Session not saved to 'session:current' reference key

// FIX: Added storage type config, changed init logic, added reference key
```

### Audit Checklist (Use for EACH Test File)

**Phase 1: Read & Understand**
- [ ] Read test file completely
- [ ] Identify what's being tested (session? scoring? video?)
- [ ] List all external dependencies (orchestrator, VLC, submodules)
- [ ] Note test infrastructure (restart? cleanup? fixtures?)

**Phase 2: Run & Observe**
- [ ] Run test file: `npx playwright test file.test.js --project=chromium`
- [ ] Record results: X passing, Y flaky, Z failing
- [ ] Capture error messages and line numbers
- [ ] Run individual failing tests in isolation

**Phase 3: Categorize Issues**
- [ ] Contract violations? → Check contracts/openapi.yaml & asyncapi.yaml
- [ ] Cross-test pollution? → Check afterEach/beforeEach cleanup
- [ ] Persistence issues? → Check storage type, session lifecycle
- [ ] Test architecture? → Check if one test needs different infrastructure

**Phase 4: Root Cause Analysis**
- [ ] Trace data flow from source to test assertion
- [ ] Identify EXACT line where bug originates
- [ ] Distinguish: test bug vs implementation bug vs architecture issue
- [ ] Document findings before fixing

**Phase 5: Fix & Verify**
- [ ] Apply fix (code OR test separation OR both)
- [ ] Run test file again: verify all tests pass
- [ ] Run Test 00 + 01: verify no regressions
- [ ] Update plan document with findings

---

## 🎓 LESSONS LEARNED FROM TEST 01 AUDIT

### Finding 1: Test Architecture Matters

**Problem:** Test 7 (persistence) had DIFFERENT cleanup needs than Tests 1-6 (lifecycle).
- Lifecycle tests: Need clean state → restart orchestrator between each
- Persistence test: Need data to survive → controlled restart only when testing

**Solution:** Separated into TWO files with different afterEach strategies.
```
01-session-lifecycle.test.js (13 tests)
  afterEach: stopOrchestrator() → clearSessionData() → startOrchestrator()

01-session-persistence.test.js (1 test)
  afterEach: closeContexts() + cleanupSockets() (no orchestrator restart)
```

**Principle:** Tests with different infrastructure needs belong in separate files.

**Application to 07/21/31:** If a test file has ONE test that's always flaky or fails, check if that test needs different cleanup strategy. Consider file separation.

### Finding 2: clearSessionData() Is Not Enough

**Problem:** `clearSessionData()` only clears DISK storage via node-persist. It does NOT clear:
- sessionService.currentSession (in-memory)
- stateService state cache
- videoQueueService queue
- transactionService history

**Solution:** Restart orchestrator process to guarantee clean state.

**Architecture Insight:** ALN uses dual storage (disk + memory). Clearing one without the other causes pollution.

**Application to 07/21/31:** If tests show cross-pollution symptoms, don't add more clearXYZ() calls. Instead, restart the orchestrator between tests.

### Finding 3: Session Persistence Architecture Changed

**Problem:** sessionService.init() tried to load `gameState:current` to find session ID, but stateService.init() DELETES gameState (legacy cleanup from architectural refactor).

**Root Cause:** GameState used to be persisted, now it's computed from session. But session loading still depended on gameState.

**Solution:**
1. Added `session:current` reference key
2. Changed sessionService.init() to load from 'session:current' directly
3. All session saves write to BOTH session:{id} AND session:current

**Architectural Pattern:** Use reference keys for "current" pointers instead of depending on computed state.

**Application to 07/21/31:** If tests fail after restart with "null" data, check if loading logic depends on keys that another service deletes during init.

### Finding 4: Contract Alignment Is Non-Negotiable

**Problem:** Implementation used `status: 'completed'`, contracts defined `enum: [active, paused, ended]`.

**Impact:** Tests failed. GM Scanner submodule would fail validation. Future API clients would break.

**Solution:** Changed implementation to match contract (NEVER change contract to match bug).

**Principle:** Contracts in `backend/contracts/` are the single source of truth. Implementation must align.

**Application to 07/21/31:** ALWAYS check contracts FIRST when debugging WebSocket or HTTP issues. Don't trust in-memory values or logs - validate against schema.

### Finding 5: Test Cleanup Timing Matters

**Problem:** Test 7 saved session → afterEach cleared disk → restart tried to load → null.

**Root Cause:** afterEach ran AFTER test completed, clearing data BEFORE restart could verify persistence.

**Solution:** Moved clearSessionData() to beforeEach (runs BEFORE test starts).

**Timing Pattern:**
```javascript
beforeEach: Clear state from PREVIOUS test
test:       Create new state, verify behavior
afterEach:  Close connections, NOT clear state (save for next beforeEach)
```

**Application to 07/21/31:** If a test expects data to exist at a specific point, audit the timing of cleanup. Don't clear data the test needs mid-execution.

---

## 🔧 AUDIT PHASE ROADMAP

### Phase 0: Verification Baseline ✅ COMPLETE
**Duration:** 6 hours (2025-10-28)
**Status:** ✅ Complete

**Tests Fixed:**
- [x] 01-session-lifecycle.test.js - 13/13 passing
- [x] 01-session-persistence.test.js - 1/1 passing (NEW)
- [x] 00-smoke-test.test.js - 14/14 passing (REGRESSION CHECK)

**Issues Fixed:**
- [x] Contract violation: Session status 'completed' → 'ended'
- [x] Cross-test pollution: Added restart-between-tests
- [x] Persistence bugs: Storage type config, session:current key
- [x] Test architecture: Separated persistence into own file
- [x] Package management: Moved playwright to backend/package.json

**Artifacts Created:**
- Comprehensive commit message documenting all fixes
- Test audit methodology (this document)
- Debugging checklists for future audits

### Phase 1: Audit Test 07 Series ⏳ IN PROGRESS
**Started:** 2025-10-28 Evening | **Progress:** 1.67/3 files (07a ✅, 07b 67% complete)

**Tests to Audit:**
- [x] 07a-gm-scanner-standalone-blackmarket.test.js - 1/1 ✅ (anti-pattern fix)
- [~] 07b-gm-scanner-networked-blackmarket.test.js - 4/6 tests ✅ (2 remaining: duplicate rejection)
- [ ] 07c-gm-scanner-scoring-parity.test.js (~5 tests)

**What Was Done (07a):**
Applied `superpowers:testing-anti-patterns` skill → Found test helper was recalculating scores instead of reading production → Removed 64-line fallback → Test still passes, proving production works correctly.

**What Was Done (07b) - Session 2025-10-28 Late Evening:**
1. **Baseline Investigation:** Found 5 tests were empty placeholders (just TODO stubs), only connection test existed
2. **Test Implementation:** Wrote tests 2, 3, 4 using NFC simulation pattern from 07a
3. **Key Fixes Applied:**
   - Use `processNFCRead()` directly (simulates NFC API, not manual entry UI)
   - Contract alignment: `transaction:new` event has nested `data.transaction` structure
   - Broadcast transformations: `group:completed` uses `group`/`bonusPoints` not `groupId`/`bonus`
4. **Tests Passing (4/6):**
   - ✅ Test 1: Connection and session creation
   - ✅ Test 2: Single Personal token (500 points)
   - ✅ Test 3: Business token with 3x multiplier (15,000 points)
   - ✅ Test 4: Group completion - 5 tokens, x2 multiplier, 53,200 points with bonus
   - ⏸️ Test 5: Duplicate rejection (same team) - Not yet written
   - ⏸️ Test 6: Duplicate rejection (different team) - Not yet written

**Next:** Complete tests 5-6 (duplicate rejection scenarios), then audit 07c (scoring parity).

### Phase 2: Audit Test 21 (Player Scanner) ⏸️ BLOCKED
**Duration:** Estimated 2-3 hours
**Priority:** MEDIUM

**Tests to Audit:**
- [ ] 21-player-scanner-networked-scanning.test.js (status unknown)

**Known Concerns:**
- Tests player scanner HTTP endpoint integration
- May have offline queue sync issues
- Video queueing logic complex

**Audit Strategy:**
1. Run test file, document status
2. Check for contract violations (HTTP responses)
3. Verify offline queue sync logic
4. Test video queueing flow

### Phase 3: Audit Test 31 (WebSocket Events) ⏸️ BLOCKED
**Duration:** Estimated 2-3 hours
**Priority:** MEDIUM

**Tests to Audit:**
- [ ] 31-websocket-events.test.js (status unknown)

**Known Concerns:**
- Direct WebSocket contract validation
- Event envelope structure
- Broadcast patterns
- May overlap with contract tests

**Audit Strategy:**
1. Run test file, document status
2. Check against asyncapi.yaml (this IS contract testing)
3. Verify event envelope wrapping
4. Check broadcast room logic

### Phase 4: Regression Suite & Documentation 📋 BLOCKED
**Duration:** 1 hour
**Priority:** LOW (after audits complete)

**Tasks:**
- [ ] Create regression test suite (00 + 01 + 07 + 21 + 31)
- [ ] Document audit findings summary
- [ ] Update architectural diagrams if needed
- [ ] Create "E2E Test Patterns" guide

---

## 🚫 BLOCKED: Journey Test Implementation

**These phases CANNOT proceed until audit complete:**

### ~~Phase 5: Journey 1 - Player Scanner Offline-First~~
**Status:** 🚫 BLOCKED
**Reason:** Test 21 (player scanner) must be verified first
**File:** `backend/tests/e2e/flows/40-player-scanner-offline-journey.test.js`

### ~~Phase 6: Journey 2 - Video Orchestration~~
**Status:** 🚫 BLOCKED
**Reason:** Video infrastructure must be stable (Test 07 audit required)
**File:** `backend/tests/e2e/flows/41-video-orchestration-journey.test.js`

### ~~Phase 7: Journey 3 - Multi-Device Coordination~~
**Status:** 🚫 BLOCKED
**Reason:** WebSocket events must be verified (Test 31 audit required)
**File:** `backend/tests/e2e/flows/42-multi-device-coordination-journey.test.js`

**Unblock Criteria:** All audit phases (0-3) complete with 100% pass rate.

---

## 📊 SUCCESS METRICS (Updated)

### Audit Phase Success Criteria

**Test Reliability:**
- [ ] 100% pass rate across ALL tests (00, 01, 07, 21, 31)
- [ ] 0 flaky tests (must pass consistently, any order)
- [ ] Tests run independently (can run single test in isolation)

**Code Quality:**
- [ ] All contract violations fixed
- [ ] No cross-test pollution
- [ ] Persistence layer working correctly
- [ ] Test files organized by infrastructure needs

**Documentation:**
- [ ] Each audit documented with findings
- [ ] Architectural issues logged
- [ ] Debugging patterns captured
- [ ] Future developer guidance written

### Original Journey Test Goals (Deferred)

**Defer until audit complete:**
- Journey 1: Offline-first complete flow
- Journey 2: Video orchestration end-to-end
- Journey 3: Multi-device real-time coordination

**Why Deferred:** No point implementing complex journey tests on unstable foundation. Fix base tests first.

---

## 🛠️ RUNNING THE TESTS

### Audit Phase Commands

```bash
cd backend

# Run verified baseline (should always pass)
npx playwright test tests/e2e/flows/00-smoke-test.test.js --project=chromium
npx playwright test tests/e2e/flows/01-session-lifecycle.test.js --project=chromium
npx playwright test tests/e2e/flows/01-session-persistence.test.js --project=chromium

# Audit Test 07 series (next phase)
npx playwright test tests/e2e/flows/07a-gm-scanner-standalone-blackmarket.test.js --project=chromium
npx playwright test tests/e2e/flows/07b-gm-scanner-networked-blackmarket.test.js --project=chromium
npx playwright test tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js --project=chromium

# Audit Test 21 (player scanner)
npx playwright test tests/e2e/flows/21-player-scanner-networked-scanning.test.js --project=chromium

# Audit Test 31 (websocket events)
npx playwright test tests/e2e/flows/31-websocket-events.test.js --project=chromium

# Run single test in isolation (check for pollution)
npx playwright test tests/e2e/flows/01-session-lifecycle.test.js:206 --project=chromium

# Debug mode
npx playwright test tests/e2e/flows/07a-gm-scanner-standalone-blackmarket.test.js --debug
```

### Regression Check After Each Fix

```bash
# After fixing any test, ALWAYS run baseline
npx playwright test tests/e2e/flows/00-smoke-test.test.js --project=chromium
npx playwright test tests/e2e/flows/01-session-lifecycle.test.js --project=chromium

# If baseline fails, you introduced a regression - revert and rethink
```

---

## 📚 KEY ARCHITECTURAL FINDINGS

### Test 07b: NFC Simulation and Event Contracts (2025-10-28 Late Evening)

**Finding 1: NFC Simulation Pattern (Not Manual Entry)**
- **Anti-pattern:** Using `scanner.manualEntry()` (clicks button, triggers prompt dialog)
- **Correct pattern:** Call `processNFCRead()` directly via `page.evaluate()`
  ```javascript
  await page.evaluate((tokenId) => {
    window.App.processNFCRead({
      id: tokenId,
      source: 'nfc',
      raw: tokenId
    });
  }, 'sof002');
  ```
- **Why:** Tests actual NFC API flow, avoids dialog blocking, matches 07a successful pattern

**Finding 2: WebSocket Event Structure Must Match AsyncAPI Contract Exactly**
- `transaction:new` has nested structure: `event.data.transaction.tokenId` (NOT `event.data.tokenId`)
- Backend broadcasts transform domain events (service layer → broadcast layer)
- Example: `group:completed` domain event emits `groupId` and `bonus`, but broadcast sends `group` and `bonusPoints`
- **Lesson:** Always check `backend/contracts/asyncapi.yaml` AND `backend/src/websocket/broadcasts.js` for actual structure

**Finding 3: Group Completion is Retroactive**
- Scanning all tokens in a group triggers bonus calculation
- Bonus formula: `(multiplier - 1) × sum_of_all_token_values`
- Example: 5 tokens worth 26,600 base → x2 multiplier → 26,600 bonus → 53,200 total
- Backend emits `group:completed` event after last token, then `score:updated` with final total

**Finding 4: Test Investigation Using Plan Agents**
- User directive: "fill gaps in knowledge before writing test" → Use Plan agent to research
- Plan agent provided complete spec: token data, calculation formulas, event flows, edge cases
- Prevented test mistakes by understanding exact behavior before implementation
- Pattern: Investigation phase → Write test → Verify → Fix if needed

### Dual Storage Pattern (Disk + Memory)

**Discovery:** ALN uses TWO storage layers for session data:
1. **Disk Storage** (node-persist): Survives restarts, slow
2. **Memory Storage** (service state): Fast, lost on restart

**Problem:** `clearSessionData()` only clears disk. Memory state persists.

**Solution:** Restart orchestrator process to clear BOTH layers.

**Future Pattern:**
```javascript
// For guaranteed clean state
afterEach: stopOrchestrator() + clearSessionData() + startOrchestrator()

// For tests that need data to survive
afterEach: closeContexts() + cleanupSockets() (no orchestrator restart)
```

### Session Persistence Architecture

**Pattern:** Use reference keys for "current" pointers:
```javascript
// Save
await persistenceService.saveSession(sessionData);           // session:{id}
await persistenceService.save('session:current', sessionData); // reference key

// Load
const sessionData = await persistenceService.load('session:current');
```

**Why:** Decouples session loading from computed state (gameState) that may be deleted by other services.

### Contract-First Development

**Critical Files:**
- `backend/contracts/openapi.yaml` - HTTP API contract
- `backend/contracts/asyncapi.yaml` - WebSocket event contract

**Rule:** NEVER change contracts to match bugs. Fix implementation to match contracts.

**Workflow:**
1. Test fails with contract mismatch
2. Check contract (source of truth)
3. Fix implementation (not contract)
4. Verify with contract tests

---

## 🔄 PLAN REVISION HISTORY

**Version 1 (Original):**
- Status: "90 passing tests"
- Phase 1: Implement Test 07 series
- Next: Journey tests

**Version 2 (2025-10-28 - This Document):**
- Status: "28 verified passing, 5 files need audit"
- Phase 0: Fix Test 01 ✅ COMPLETE
- Phase 1: Audit Test 07 series ⏳ NEXT
- Journey tests: 🚫 BLOCKED until audits complete

**Reason for Revision:** Test 01 audit revealed systemic issues requiring methodical fix approach before adding new tests.

---

## 🎯 NEXT IMMEDIATE ACTIONS

**For Developers:**
1. ✅ Read this entire document (especially audit methodology)
2. ⏳ Run Test 07 series and document actual status
3. ⏸️ Apply Three-Issue Pattern to categorize failures
4. ⏸️ Fix issues following Test 01 learnings
5. ⏸️ Verify no regressions in baseline (00, 01)
6. ⏸️ Commit with detailed documentation
7. ⏸️ Move to Test 21 audit

**For Future Planning:**
- Do NOT implement Journey tests until ALL audits complete
- Do NOT trust "passing" status without verification
- Do NOT skip audit methodology steps
- DO document every finding for future developers

---

## 📎 APPENDIX: Detailed Audit Reports

<details>
<summary><b>Test 07a Anti-Patterns Audit (2025-10-28 Evening)</b></summary>

**Issue:** Test helper `scanner-init.js:getTeamScore()` duplicated 64 lines of production scoring logic as "fallback" for suspected bug.

**Why Wrong:**
- If production broke, test would pass using fallback calculation
- Test validated test logic, not production behavior
- Violated Iron Law #3: "NEVER mock without understanding dependencies"

**Fix:** Removed fallback. Test now reads `team?.score || 0` directly from production's localStorage.

**Result:** Test still passes (1/1) → Production was working all along. No bug existed.

**Learning:** Defensive fallbacks in tests hide production bugs instead of catching them.

**Commit:** [To be added when committed]

</details>

---

**Plan Status:** 🟡 AUDIT IN PROGRESS - Phase 1 (Test 07) - 1.67/3 files complete
**Next Action:** Complete 07b tests 5-6 (duplicate rejection), then audit 07c
**Verified Passing:** 33 tests (00: 14, 01: 14, 07a: 1, 07b: 4/6)

🤖 Updated after Test 07b partial completion (2025-10-28 Late Evening)
