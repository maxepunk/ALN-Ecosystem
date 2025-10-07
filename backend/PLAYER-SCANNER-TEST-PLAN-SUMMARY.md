# Player Scanner Test Plan - Summary
## Simplified Strategy for ESP32-Compatible Design

**Component:** aln-memory-scanner (Player Scanner PWA)
**Current Coverage:** 0 tests
**Target Coverage:** ~50 tests
**Time Estimate:** ~10 hours
**Bugs Found:** 3 actual bugs (vs 8+ suspected before clarification)

---

## Key Architectural Insights

### What We Learned

1. **Fire-and-Forget by Design:**
   - Scanner ignores HTTP responses (ESP32 compatibility)
   - No complex error handling needed
   - Simple retry on reconnection acceptable

2. **Dual Mode is Permanent:**
   - Standalone: GitHub Pages, no orchestrator, entire game session
   - Networked: Orchestrator hosting, video playback, entire game session
   - Not "offline mode" - these are distinct deployment modes

3. **Shared Token Database:**
   - Bundled `data/tokens.json` (submodule) is correct
   - No live updates from orchestrator needed

4. **Simplicity is Required:**
   - ESP32 port planned
   - Minimal dependencies
   - No complex browser APIs

### What This Means for Testing

**Before Clarification:** 100+ tests, testing "bugs" that were correct design
**After Clarification:** ~50 tests, verifying simplicity constraints

---

## Actual Bugs Found (3 Total)

| Bug # | Description | Severity | Location | Fix Complexity |
|-------|-------------|----------|----------|----------------|
| #3 | No client-side token ID validation | LOW-MEDIUM | index.html:1040 | SIMPLE (add regex check) |
| #4 | Connection check race condition | MEDIUM | orchestratorIntegration.js:176 | MEDIUM (debounce) |
| #5 | Video modal never times out | LOW | index.html:1069 | SIMPLE (add timeout) |

**Not Bugs (Correct Design):**
- Token database from submodule (not orchestrator) ✅
- Batch response not parsed (fire-and-forget) ✅
- No HTTP error code handling (fire-and-forget) ✅

---

## Test Suite Structure

### Organization (~50 tests total)

```
tests/
├── contract/player-scanner/
│   └── http-request-compliance.test.js          (12 tests) - CRITICAL
├── integration/player-scanner/
│   ├── standalone-mode.test.js                  (10 tests) - CRITICAL
│   ├── networked-mode.test.js                    (8 tests) - HIGH
│   └── dual-mode-independence.test.js            (6 tests) - MEDIUM
└── unit/player-scanner/
    ├── orchestratorIntegration.test.js          (10 tests) - HIGH
    └── esp32-simplicity-constraints.test.js      (4 tests) - MEDIUM
```

### Test Priorities

**CRITICAL (Day 1-2):** 22 tests
- Contract compliance (HTTP request formatting)
- Standalone mode works independently
- No complex dependencies

**HIGH (Day 2-3):** 18 tests
- Networked mode with video playback
- Orchestrator integration (simple queue)
- Bug fixes (#3, #4, #5)

**MEDIUM (Day 3):** 10 tests
- Dual-mode independence (no cross-contamination)
- ESP32 simplicity verification

---

## Phase 1: Contract Compliance (Day 1 - 2 hours)

### Tests: HTTP Request Formatting Only

**File:** `tests/contract/player-scanner/http-request-compliance.test.js`

**Focus:** Verify requests match OpenAPI schema (ignore responses - fire-and-forget)

#### Test Cases (12 tests)

1. **POST /api/scan - Required Fields**
   - ✅ Includes tokenId, deviceId, timestamp
   - ✅ tokenId matches pattern `^[A-Za-z_0-9]+$`
   - ✅ timestamp is ISO8601 format
   - ✅ deviceId is string (1-100 chars)

2. **POST /api/scan - Optional teamId**
   - ✅ Omits teamId when not provided (not null/undefined)
   - ✅ Includes teamId when provided (pattern `^[0-9]{3}$`)

3. **POST /api/scan/batch - Batch Structure**
   - ✅ transactions array present
   - ✅ Each transaction has required fields
   - ✅ Batch size <= 10 items (per implementation)

4. **Fire-and-Forget Verification**
   - ✅ Scanner continues on HTTP 500
   - ✅ Scanner continues on HTTP 409
   - ✅ Scanner continues on network timeout
   - **KEY:** Scanner NEVER crashes on bad responses

**Exit Criteria:**
- All requests formatted per OpenAPI spec
- Scanner resilient to all response types
- Bug #3 fixed (token ID validation)

---

## Phase 2: Standalone Mode (Day 1-2 - 2 hours)

### Tests: Primary Deployment Mode (GitHub Pages)

**File:** `tests/integration/player-scanner/standalone-mode.test.js`

**Focus:** Verify scanner works WITHOUT orchestrator (critical player experience)

#### Test Cases (10 tests)

1. **Token Database Loading**
   - ✅ Loads bundled data/tokens.json
   - ✅ Falls back to demo tokens if missing
   - ✅ Token lookup works

2. **Scan Flow (No Network)**
   - ✅ QR scan → token lookup → media display
   - ✅ NFC scan → token lookup → media display
   - ✅ Manual entry → token lookup → media display

3. **Media Display**
   - ✅ Shows image if token.image exists
   - ✅ Shows audio player if token.audio exists
   - ✅ Shows placeholder if no media

4. **No Orchestrator Features**
   - ✅ No video playback attempted
   - ✅ No HTTP requests made
   - ✅ No connection errors shown

**Exit Criteria:**
- Scanner fully functional without network
- All scan methods work (QR, NFC, manual)
- No errors when orchestrator absent

---

## Phase 3: Networked Mode (Day 2-3 - 1.5 hours)

### Tests: Orchestrator Integration with Video Playback

**File:** `tests/integration/player-scanner/networked-mode.test.js`

**Focus:** Verify scanner works WITH orchestrator (video playback enabled)

#### Test Cases (8 tests)

1. **Orchestrator Detection**
   - ✅ Detects orchestrator via /health endpoint
   - ✅ Shows "connected" indicator
   - ✅ Enables video playback features

2. **Video Playback Trigger**
   - ✅ Sends POST /api/scan for tokens with video property
   - ✅ Shows "processing" modal
   - ✅ Modal hides after timeout (Bug #5 fix)

3. **Offline Queue (Simple)**
   - ✅ Queues scans when disconnected
   - ✅ Retries batch on reconnection
   - ✅ Clears queue on HTTP 200 (fire-and-forget)

4. **Connection Monitoring**
   - ✅ Checks /health every 10 seconds
   - ✅ No race condition (Bug #4 fix)

**Exit Criteria:**
- Video playback works when orchestrator present
- Simple offline queue functions
- Bugs #4 and #5 fixed

---

## Phase 4: Dual-Mode Independence (Day 3 - 1 hour)

### Tests: Modes Don't Interfere with Each Other

**File:** `tests/integration/player-scanner/dual-mode-independence.test.js`

**Focus:** Verify standalone doesn't break networked, and vice versa

#### Test Cases (6 tests)

1. **Standalone Doesn't Break Networked**
   - ✅ Bundled tokens used even when orchestrator present
   - ✅ No localStorage conflicts

2. **Networked Doesn't Break Standalone**
   - ✅ Scanner works when orchestrator becomes unavailable
   - ✅ No dependency on orchestrator-only features

3. **Mode Detection**
   - ✅ Correctly detects deployment mode
   - ✅ Features enabled/disabled appropriately

**Exit Criteria:**
- Both modes work independently
- No cross-contamination
- Graceful degradation

---

## Phase 5: ESP32 Simplicity Verification (Day 3 - 1 hour)

### Tests: Verify No Complex APIs Used

**File:** `tests/unit/player-scanner/esp32-simplicity-constraints.test.js`

**Focus:** Ensure code remains ESP32-portable

#### Test Cases (4 tests)

1. **Simple HTTP Only**
   - ✅ Uses fetch() or XMLHttpRequest only
   - ✅ No WebSocket usage
   - ✅ No complex request options

2. **No Advanced Browser APIs**
   - ✅ No IndexedDB (uses localStorage only)
   - ✅ No Web Workers
   - ✅ No SharedArrayBuffer

3. **Simple Response Handling**
   - ✅ Only checks response.ok
   - ✅ No complex JSON parsing in critical path
   - ✅ No promise chaining >2 levels

4. **Minimal Dependencies**
   - ✅ No external libraries beyond QR scanner
   - ✅ No build process dependencies

**Exit Criteria:**
- All code is ESP32-portable
- No complex browser-only features
- Clear path for ESP32 port

---

## Implementation Roadmap

### Week 1: Core Tests (Days 1-3)

**Day 1: Contract + Standalone (CRITICAL)**
- [ ] Setup test infrastructure (2 hours)
- [ ] Contract compliance tests (2 hours)
- [ ] Standalone mode tests (2 hours)
- [ ] Fix Bug #3 (token validation)

**Day 2: Networked Mode (HIGH)**
- [ ] Networked mode tests (1.5 hours)
- [ ] Orchestrator integration tests (2 hours)
- [ ] Fix Bug #4 (race condition)
- [ ] Fix Bug #5 (modal timeout)

**Day 3: Independence + Simplicity (MEDIUM)**
- [ ] Dual-mode independence tests (1 hour)
- [ ] ESP32 simplicity tests (1 hour)
- [ ] Code review & documentation

---

## Success Metrics

### Coverage Targets

| Metric | Current | Target | Priority |
|--------|---------|--------|----------|
| Contract Compliance | 0% | 100% | CRITICAL |
| Standalone Mode | 0% | 100% | CRITICAL |
| Networked Mode | 0% | 90% | HIGH |
| Bug Fixes | 0/3 | 3/3 | HIGH |
| ESP32 Simplicity | Unknown | Verified | MEDIUM |

### Quality Gates

**DO NOT DEPLOY** until:
1. ✅ Contract compliance tests passing (12/12)
2. ✅ Standalone mode fully tested (10/10)
3. ✅ All 3 bugs fixed and verified
4. ✅ At least 40/50 tests passing

---

## Risk Assessment

### Current Risks (No Tests)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Contract drift | MEDIUM | Contract tests (Phase 1) |
| Standalone broken | HIGH | Standalone tests (Phase 2) |
| ESP32 port blocked | MEDIUM | Simplicity tests (Phase 5) |

### Post-Test-Suite Risks

- Contract drift: LOW (automated validation)
- Standalone mode: LOW (comprehensive testing)
- Regression bugs: LOW (CI integration)
- Deployment confidence: HIGH (85% → 95%)

---

## Next Steps

### Immediate Actions (This Week)

1. **Review & Approve** (30 min)
   - Confirm test priorities
   - Adjust scope if needed

2. **Day 1: Foundation** (6 hours)
   - Setup test infrastructure
   - Contract compliance tests
   - Standalone mode tests
   - Fix Bug #3

3. **Day 2: Integration** (4 hours)
   - Networked mode tests
   - Orchestrator integration
   - Fix Bugs #4, #5

4. **Day 3: Verification** (2 hours)
   - Dual-mode tests
   - ESP32 simplicity tests
   - Documentation

**Total Time:** ~12 hours (includes setup + documentation)

---

## Questions for Review

Before starting implementation, please confirm:

1. ✅ **Fire-and-forget pattern** - Correct that scanner ignores responses?
2. ✅ **Token database** - Always use bundled submodule, never fetch from orchestrator?
3. ✅ **Offline queue** - Accept simple retry without per-transaction error handling?
4. ✅ **Test priorities** - Standalone mode is equally important as networked?

---

## Conclusion

The Player Scanner is a **deliberately simple component** designed for **ESP32 portability**. After architectural clarifications:

- **Reduced scope:** 50 tests (was 100+)
- **Reduced bugs:** 3 bugs (was 8-16 suspected)
- **Reduced time:** 10 hours (was 15+ hours)
- **Increased focus:** Simplicity verification, not complex error handling

**Key Insight:** Many "bugs" were actually correct design choices for ESP32 compatibility.

**Recommendation:** Proceed with simplified test suite focused on:
1. Contract compliance (request formatting)
2. Dual-mode independence (standalone & networked)
3. ESP32 simplicity constraints

**Deployment Confidence:** After tests, confidence increases from ~40% → ~90%

---

**Ready to begin implementation when approved.**
