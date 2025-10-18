# Test Suite Cleanup Plan: Decisive Action

**Created**: 2025-09-30
**Purpose**: Catalog existing tests, identify what to DELETE/REWRITE/KEEP/ARCHIVE
**Status**: Complete - Awaiting User Approval for Execution

---

## Executive Summary

**Current Test Suite**: ~4,700 lines across 13 files (1 disabled)
**Target Architecture**: 24 essential APIs (8 HTTP + 16 WebSocket)

**Cleanup Philosophy**: **DELETE confusing/outdated tests BEFORE Phase 6 implementation**

**Key Decision**: Err on the side of removal. Tests that validate eliminated APIs or broken behaviors actively harm Phase 6/7 work.

---

## Test File Inventory

```
backend/tests/
├── contract/
│   ├── http-api-contracts.test.js                 238 lines
│   ├── websocket-contracts-simple.test.js         305 lines  ❌ DELETE
│   ├── http-test-utils.js                         242 lines
│   └── ws-test-utils.js                           196 lines
│
├── integration/
│   ├── gm_scanner.test.js.disabled                499 lines  ❌ DELETE
│   ├── admin_panel.test.js                        568 lines  ❌ DELETE
│   ├── offline_mode.test.js                       503 lines  ⚠️ EXTRACT
│   ├── restart_recovery.test.js                   636 lines  ⚠️ EXTRACT
│   ├── network_recovery.test.js                   394 lines  ✅ KEEP
│   ├── video_playback.test.js                     245 lines  ✅ KEEP
│   ├── player_scanner.test.js                     293 lines  ⚠️ REVIEW
│   └── test-helpers.js                            173 lines  ✅ KEEP
│
└── unit/
    ├── services/offlineQueueService.test.js       286 lines  ✅ KEEP
    └── middleware/offlineStatus.test.js           119 lines  ✅ KEEP
```

---

## DECISION MATRIX: File-by-File Analysis

### **Category 1: DELETE NOW (Before Phase 6)**

These files actively harm Phase 6/7 work by validating wrong behavior or eliminated APIs.

---

#### 1.1 websocket-contracts-simple.test.js (305 lines)

**Decision**: ❌ **DELETE IMMEDIATELY**

**What It Tests**:
- Fake example objects (not real backend)
- Tests eliminated events: `state:sync`, `state:update`
- Tests that may reference eliminated granular session events

**Example from file (lines 19-26)**:
```javascript
const exampleMessage = {  // ← FAKE OBJECT!
  message: 'Please identify your device type'
};
expect(exampleMessage).toHaveProperty('message');
```

**Why Delete**:
- **Zero regression detection**: Backend could emit anything, tests still pass
- **Tests eliminated events**: state:sync, state:update (per Phase 4.9)
- **Wrong approach**: Phase 4.5 analysis identified this as useless
- **Will be replaced**: Phase 6 creates real WebSocket contract tests (Decision 2 from 06-test-architecture.md)

**Replacement**:
- Phase 6 will create new WebSocket contract tests using:
  - Real Socket.IO connections
  - ajv validation against AsyncAPI contracts
  - withSocket() helper pattern

**Risk of Keeping**:
- Developers may think WebSocket contracts are covered (they're not)
- May reference eliminated events, causing confusion

**Execution**:
```bash
rm backend/tests/contract/websocket-contracts-simple.test.js
```

---

#### 1.2 gm_scanner.test.js.disabled (499 lines)

**Decision**: ❌ **DELETE IMMEDIATELY**

**What It Tests**:
- GM Scanner WebSocket functionality
- Uses `POST /api/session` (ELIMINATED)
- Uses `'TEAM_A'` format (should be `"001"`)

**Example from file (lines 33-38)**:
```javascript
await request(testContext.app)
  .post('/api/session')  // ❌ ELIMINATED ENDPOINT
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    name: 'GM Scanner Test Session',
    teams: ['TEAM_A', 'TEAM_B']  // ❌ Wrong format
  });
```

**Why Delete**:
- **Already disabled**: Acknowledged as broken
- **Tests eliminated API**: POST /api/session moved to WebSocket gm:command
- **Wrong field formats**: Uses 'TEAM_A' instead of "001"
- **Uncertain scope**: 499 lines likely mix unit/contract/integration concerns (Phase 4.5 analysis)

**Replacement**:
- Phase 6 will create:
  - Unit tests for GM Scanner logic (standalone mode)
  - Contract tests for WebSocket events
  - Focused integration tests for GM broadcast flows

**Risk of Keeping**:
- Provides false sense of coverage
- May confuse during refactor ("why is this failing?" → "oh it's disabled")
- Takes mental energy to remember it's disabled

**Execution**:
```bash
rm backend/tests/integration/gm_scanner.test.js.disabled
```

---

#### 1.3 admin_panel.test.js (568 lines)

**Decision**: ❌ **DELETE IMMEDIATELY**

**What It Tests**:
- POST /api/session (ELIMINATED)
- PUT /api/session (ELIMINATED)
- POST /api/video/control (ELIMINATED)
- Admin authentication (still valid)
- GET /api/state (still valid)

**Evidence from file**:
- Lines 80-89: Tests `POST /api/session` (session commands moved to WebSocket)
- Lines 99-114: Tests `PUT /api/session` (eliminated)
- Lines 139-151: Tests `POST /api/video/control` (eliminated)

**Why Delete**:
- **~80% tests eliminated APIs**: Most tests validate HTTP endpoints that moved to WebSocket
- **Wrong transport pattern**: Tests HTTP POST for admin operations (should be WebSocket gm:command)
- **Large file**: 568 lines of mostly-wrong tests

**What to Salvage**:
- Admin authentication tests (lines 38-77) → Migrate to contract test for `POST /api/admin/auth`
- GET /api/state tests (lines 224, 366, 398, 423) → Already covered by http-api-contracts.test.js

**Replacement**:
- Phase 6 will create:
  - Contract test for POST /api/admin/auth (HTTP)
  - Contract tests for gm:command WebSocket event (admin commands)
  - Integration test for admin command flow (command → ack → side effect)

**Risk of Keeping**:
- **Actively misleading**: Suggests admin HTTP endpoints are correct pattern
- **Tests will fail**: POST /api/session etc. will be removed in Phase 7
- **Wasted time**: Developers may try to "fix" these tests during refactor

**Execution**:
```bash
# Extract admin auth test to new location (optional, can rewrite from scratch)
# Then delete
rm backend/tests/integration/admin_panel.test.js
```

---

### **Category 2: EXTRACT THEN DELETE**

Large files mixing unit/contract/integration concerns. Extract valuable pieces, delete the rest.

---

#### 2.1 offline_mode.test.js (503 lines)

**Decision**: ⚠️ **EXTRACT unit tests, DELETE integration tests**

**What It Tests**:
- Offline queue functionality (valuable)
- Player Scanner offline behavior (valuable)
- GM Scanner offline behavior (likely mixes concerns)

**Phase 4.5 Analysis**:
> "Most 'integration' tests are actually testing business logic in isolation → Should be unit tests"

**Why Extract**:
- **Offline queue logic** is essential for standalone mode (functional requirement)
- **Client-side game logic** must work without orchestrator
- **BUT**: Tests likely at wrong level (integration when should be unit)

**Extraction Plan**:
1. Read file, identify unit test candidates (offline queue logic, duplicate detection)
2. Create new unit tests in `tests/unit/services/`
3. Keep 1-2 TRUE integration tests (offline → reconnect → sync flow)
4. Delete remaining tests

**What to Extract**:
- Offline queue processing logic → `unit/services/offlineQueueService.test.js` (already exists, may need expansion)
- Client-side score calculation → `unit/services/scoringService.test.js` (new)
- Duplicate detection logic → `unit/services/transactionService.test.js` (new)

**What to Keep as Integration**:
- Full offline recovery flow: disconnect → queue → reconnect → sync → state match

**Execution**:
```bash
# Phase 6 task: Extract valuable logic tests
# Then delete original file
rm backend/tests/integration/offline_mode.test.js
```

---

#### 2.2 restart_recovery.test.js (636 lines)

**Decision**: ⚠️ **EXTRACT persistence tests, DELETE redundant tests**

**What It Tests** (likely):
- State persistence across restarts
- Session recovery
- Transaction history persistence
- Connection re-establishment

**Why Extract**:
- **Persistence logic** should be unit tested (state service, session service)
- **Recovery flows** may have 1-2 valid integration tests
- **636 lines** suggests heavy mixing of concerns

**Extraction Plan**:
1. Read file, identify persistence logic tests
2. Create unit tests for stateService.restore(), sessionService.recover()
3. Keep 1-2 integration tests for full restart recovery flow
4. Delete remaining tests

**Execution**:
```bash
# Phase 6 task: Extract persistence logic tests
# Then delete original file
rm backend/tests/integration/restart_recovery.test.js
```

---

### **Category 3: REWRITE (Wrong validation, right intent)**

Test structure is correct but validates broken/outdated behavior.

---

#### 3.1 http-api-contracts.test.js (238 lines)

**Decision**: ⚠️ **REWRITE to use ajv validation**

**What It Tests**:
- POST /api/scan ✅ (Essential API #2)
- GET /api/state ✅ (Essential API #6)
- GET /api/tokens ✅ (Essential API #5)
- POST /api/session ❌ (ELIMINATED)

**What's Good**:
- Uses supertest (tests real backend) ✅
- Uses async/await ✅
- Tests essential APIs ✅

**What's Wrong**:
- Manual validation (not ajv) ❌
- Uses `scannerId` instead of `deviceId` ❌
- Uses `'TEAM_A'` instead of `"001"` ❌
- Tests eliminated endpoint (POST /api/session) ❌

**Rewrite Plan**:
1. **Phase 6 Priority**: Update to use ajv validation (Decision 1 from 06-test-architecture.md)
2. Update field names: `scannerId` → `deviceId`
3. Update team format: `'TEAM_A'` → `"001"`
4. Remove POST /api/session test
5. Add missing essential endpoints:
   - POST /api/scan/batch
   - GET /api/session
   - GET /api/admin/logs
   - POST /api/admin/auth
   - GET /health

**Execution**:
```bash
# Phase 6 task: Rewrite with ajv validation
# Keep file, update contents
```

**Example Target Structure**:
```javascript
const { validateHTTPResponse } = require('../helpers/contract-validator');

it('POST /api/scan matches OpenAPI contract', async () => {
  const response = await request(app)
    .post('/api/scan')
    .send({
      tokenId: '534e2b03',
      teamId: '001',  // ← Correct format
      deviceId: 'PLAYER_SCANNER_01',  // ← Correct field
      timestamp: new Date().toISOString()
    });

  // Single line validates against OpenAPI schema
  validateHTTPResponse(response, '/api/scan', 'post', 200);
});
```

---

### **Category 4: REVIEW THEN DECIDE**

Needs deeper analysis to determine keep/extract/delete.

---

#### 4.1 player_scanner.test.js (293 lines)

**Decision**: ⚠️ **REVIEW required**

**What It Tests** (likely):
- Player Scanner HTTP endpoints (POST /api/scan, POST /api/scan/batch)
- Fire-and-forget pattern
- Offline queue behavior

**Why Review Needed**:
- **May have good integration tests** (Player Scanner → orchestrator → VLC)
- **May mix unit/integration concerns**
- **Uncertain without reading**: Could be valuable or could be wrong level

**Review Questions**:
1. Does it test TRUE integration (Player Scanner → Orchestrator → VLC)?
2. Or does it test logic in isolation (should be unit tests)?
3. Does it validate target contracts or broken behavior?

**Action**:
- **Phase 6**: Read file, categorize tests
- **Likely outcome**: Extract unit tests, keep 1-2 integration tests

---

### **Category 5: KEEP (Valid, aligned)**

These files are correct and aligned with target architecture.

---

#### 5.1 network_recovery.test.js (394 lines)

**Decision**: ✅ **KEEP (TRUE integration test)**

**Why Keep**:
- **TRUE integration**: Tests network failure → recovery → state sync
- **Essential for deployment modes**: Validates offline → networked transition
- **Phase 4.5 identified as good**: "TRUE integration test ✅"
- **Functional requirement**: Standalone mode constraint requires network resilience testing

**Minor Updates Needed**:
- May need field name updates (scannerId → deviceId)
- May need team format updates ('TEAM_A' → "001")

---

#### 5.2 video_playback.test.js (245 lines)

**Decision**: ✅ **KEEP (TRUE integration test)**

**Why Keep**:
- **TRUE integration**: Tests Player Scanner → Orchestrator → VLC → video playback
- **Essential functionality**: Core video playback feature
- **Phase 4.5 identified as good**: "TRUE integration test ✅"

**Minor Updates Needed**:
- May need field name updates
- May need team format updates

---

#### 5.3 test-helpers.js (173 lines)

**Decision**: ✅ **KEEP (infrastructure)**

**Why Keep**:
- **Good patterns**: connectAndIdentify(), waitForEvent(), promise-based
- **Already used**: Integration tests depend on these helpers
- **Decision 2 approved**: withSocket() helper will be added to this file

**Updates Needed**:
- Add withSocket() helper (10 lines, per Decision 2 from 06-test-architecture.md)

---

#### 5.4 http-test-utils.js (242 lines)

**Decision**: ✅ **KEEP (infrastructure)**

**Why Keep**:
- **Test infrastructure**: Utilities for HTTP contract tests
- **May be useful**: Even though rewriting tests, utilities may help

**Review Needed**:
- Verify utilities align with ajv validation approach
- May need updates for contract-first patterns

---

#### 5.5 ws-test-utils.js (196 lines)

**Decision**: ✅ **KEEP (infrastructure)**

**Why Keep**:
- **setupTestServer()**: Essential for WebSocket tests (197 lines, Phase 4.5 approved)
- **cleanupTestServer()**: Prevents test contamination
- **Phase 4.5 identified**: "What Works Well ✅"

**No Changes Needed**: Already correct

---

#### 5.6 unit/services/offlineQueueService.test.js (286 lines)

**Decision**: ✅ **KEEP (proper unit test)**

**Why Keep**:
- **Proper unit test**: Tests service logic in isolation
- **Phase 4.5 identified**: "Keep existing: already good ✅"
- **Essential for standalone mode**: Offline queue logic must work without orchestrator

**No Changes Needed**: Already correct

---

#### 5.7 unit/middleware/offlineStatus.test.js (119 lines)

**Decision**: ✅ **KEEP (proper unit test)**

**Why Keep**:
- **Proper unit test**: Tests middleware in isolation
- **Phase 4.5 identified**: "Keep existing: already good ✅"

**No Changes Needed**: Already correct

---

## Cleanup Sequencing & Timing

### **Phase 1: IMMEDIATE DELETION (Before Phase 6 planning)**

**When**: NOW (before creating 07-refactor-plan.md)

**Why**: These files actively confuse and mislead. Remove them BEFORE planning Phase 6.

**Files to Delete**:
```bash
# Fake contract tests
rm backend/tests/contract/websocket-contracts-simple.test.js

# Disabled/broken tests
rm backend/tests/integration/gm_scanner.test.js.disabled

# Tests eliminated HTTP endpoints
rm backend/tests/integration/admin_panel.test.js
```

**Total Removed**: 1,372 lines of confusing/outdated tests

**Impact**:
- ✅ Prevents confusion during Phase 6 planning
- ✅ Makes test suite reflect reality (no fake tests, no eliminated endpoints)
- ✅ Forces Phase 6 to create correct WebSocket contract tests from scratch

---

### **Phase 2: EXTRACTION (During Phase 6 unit test creation)**

**When**: Phase 6 Step 1 - Create Unit Tests

**Why**: Extract valuable logic tests while creating new unit tests. Delete original files after extraction.

**Files to Extract**:
1. `offline_mode.test.js` (503 lines)
   - Extract: Offline queue logic, client-side game logic
   - Keep: 1-2 TRUE integration tests (offline recovery flow)
   - Delete: Remaining file after extraction

2. `restart_recovery.test.js` (636 lines)
   - Extract: State persistence, session recovery logic
   - Keep: 1-2 TRUE integration tests (restart recovery flow)
   - Delete: Remaining file after extraction

**Approach**:
- Read file
- Identify unit test candidates (pure logic, mocked dependencies)
- Create proper unit tests in correct location
- Archive any valuable integration tests
- Delete original file

**Total Removed**: 1,139 lines (after extracting valuable tests)

---

### **Phase 3: REWRITE (During Phase 6 contract test creation)**

**When**: Phase 6 Step 2 - Create Contract Tests

**Why**: Update to use ajv validation and match 24 essential APIs.

**Files to Rewrite**:
1. `http-api-contracts.test.js` (238 lines)
   - Update to ajv validation (per Decision 1)
   - Fix field names (scannerId → deviceId)
   - Fix team format ('TEAM_A' → "001")
   - Remove POST /api/session test
   - Add missing essential HTTP endpoints

**Approach**:
- Use as skeleton (good structure, wrong validation)
- Replace manual assertions with ajv validation
- Update examples to match contracts
- Add missing endpoints

---

### **Phase 4: REVIEW & UPDATE (During Phase 6 integration test consolidation)**

**When**: Phase 6 Step 3 - Consolidate Integration Tests

**Files to Review**:
1. `player_scanner.test.js` (293 lines)
   - Determine TRUE integration vs unit concerns
   - Extract unit tests if needed
   - Update field names/formats
   - Keep focused integration tests

2. `network_recovery.test.js` (394 lines)
   - Update field names (scannerId → deviceId)
   - Update team format ('TEAM_A' → "001")
   - Verify still aligned with contracts

3. `video_playback.test.js` (245 lines)
   - Update field names
   - Update team format
   - Verify still aligned with contracts

---

## Summary: Before & After

### **Before Cleanup**

```
Tests: 4,697 lines across 13 files

Contract:
  ✅ http-api-contracts.test.js (238) - needs updates
  ❌ websocket-contracts-simple.test.js (305) - fake tests
  ✅ http-test-utils.js (242)
  ✅ ws-test-utils.js (196)

Integration:
  ❌ gm_scanner.test.js.disabled (499) - broken
  ❌ admin_panel.test.js (568) - eliminated endpoints
  ⚠️ offline_mode.test.js (503) - extract
  ⚠️ restart_recovery.test.js (636) - extract
  ✅ network_recovery.test.js (394)
  ✅ video_playback.test.js (245)
  ⚠️ player_scanner.test.js (293) - review
  ✅ test-helpers.js (173)

Unit:
  ✅ offlineQueueService.test.js (286)
  ✅ offlineStatus.test.js (119)
```

### **After Phase 1 (Immediate Deletion)**

```
Tests: ~3,325 lines (1,372 removed)

Contract:
  ✅ http-api-contracts.test.js (238) - needs rewrite
  ✅ http-test-utils.js (242)
  ✅ ws-test-utils.js (196)

Integration:
  ⚠️ offline_mode.test.js (503) - extract
  ⚠️ restart_recovery.test.js (636) - extract
  ✅ network_recovery.test.js (394)
  ✅ video_playback.test.js (245)
  ⚠️ player_scanner.test.js (293) - review
  ✅ test-helpers.js (173)

Unit:
  ✅ offlineQueueService.test.js (286)
  ✅ offlineStatus.test.js (119)
```

### **After Full Cleanup (Phase 6 complete)**

```
Tests: ~2,500 lines essential tests + ~2,500 lines new tests

Contract: (~900 lines, 25-35 tests)
  ✅ http/ - 8 HTTP endpoint tests (ajv validation)
  ✅ websocket/ - 16 WebSocket event tests (ajv validation)
  ✅ helpers/contract-validator.js (85 lines)
  ✅ http-test-utils.js (242)
  ✅ ws-test-utils.js (196)

Integration: (~500 lines, 5-10 tests)
  ✅ transaction-broadcast-flow.test.js
  ✅ offline-recovery-flow.test.js
  ✅ network-recovery.test.js (394, updated)
  ✅ video-playback.test.js (245, updated)
  ✅ player-scanner-flow.test.js (extracted from player_scanner.test.js)
  ✅ test-helpers.js (173 + withSocket)

Unit: (~3,500 lines, 100+ tests)
  ✅ services/ - 20+ files (transaction, scoring, state, session, video, offline, etc.)
  ✅ middleware/ - 3-5 files (auth, offline, validation)
  ✅ websocket/ - 2-3 files (gmAuth, deviceTracking)
```

**Net Result**:
- ✅ **Proper test pyramid**: 100+ unit, 30-40 contract, 5-10 integration
- ✅ **All tests validate target contracts** (not broken behavior)
- ✅ **No confusing/outdated tests remaining**
- ✅ **Single source of truth**: OpenAPI/AsyncAPI contracts drive all validation

---

## Execution Commands

### **Phase 1: Immediate Deletion**

```bash
cd /home/spide/projects/AboutLastNight/ALN-Ecosystem/backend/tests

# Delete fake WebSocket contract tests
git rm contract/websocket-contracts-simple.test.js

# Delete disabled GM scanner tests
git rm integration/gm_scanner.test.js.disabled

# Delete admin panel tests (eliminated HTTP endpoints)
git rm integration/admin_panel.test.js

# Commit
git add -A
git commit -m "test: Remove outdated/confusing tests before Phase 6

Removes 1,372 lines of tests that validate eliminated APIs or fake objects:
- websocket-contracts-simple.test.js: Validated fake objects, not real backend
- gm_scanner.test.js.disabled: Tested eliminated POST /api/session endpoint
- admin_panel.test.js: Tested eliminated admin HTTP endpoints

Per Phase 6 cleanup plan, these tests actively confuse refactor work.
Will be replaced with contract-aligned tests in Phase 6.

Refs: docs/api-alignment/work/TEST-CLEANUP-PLAN.md"
```

---

## Risk Assessment

### **Risk: Deleting too much**

**Mitigation**:
- Git history preserves everything (can retrieve if needed)
- Files identified for deletion have ZERO value:
  - Fake tests: Don't test backend at all
  - Eliminated endpoint tests: APIs won't exist
  - Broken tests: Already disabled

**Worst Case**: Need to rewrite test from scratch
**Reality**: We're rewriting anyway (Phase 6 creates contract-aligned tests)

---

### **Risk: Breaking CI/CD**

**Mitigation**:
- Check if deleted files referenced in package.json test scripts
- Update any test:watch patterns if needed
- Verify remaining tests still run

**Action After Deletion**:
```bash
npm test  # Verify remaining tests run
```

---

### **Risk: Losing valuable test coverage**

**Mitigation**:
- Keep valuable infrastructure: test-helpers.js, ws-test-utils.js
- Keep TRUE integration tests: network_recovery.test.js, video_playback.test.js
- Keep proper unit tests: offlineQueueService.test.js, offlineStatus.test.js
- **Only deleting confusing/wrong tests**

---

## Recommendation

**APPROVE Phase 1 Immediate Deletion**

Execute the 3 deletions NOW (before Phase 6 planning):
1. ✅ websocket-contracts-simple.test.js (305 lines) - Fake tests
2. ✅ gm_scanner.test.js.disabled (499 lines) - Disabled/broken
3. ✅ admin_panel.test.js (568 lines) - Eliminated endpoints

**Total**: 1,372 lines removed

**Benefit**: Clean slate for Phase 6 planning. No confusion about what's valid.

**Then proceed with Phase 6**:
- Phase 2: Extract valuable tests from offline_mode.test.js, restart_recovery.test.js
- Phase 3: Rewrite http-api-contracts.test.js with ajv validation
- Phase 4: Review and update player_scanner.test.js, network_recovery.test.js, video_playback.test.js

---

*Analysis Complete: 2025-09-30*
*Recommendation: DELETE 3 files immediately (1,372 lines)*
*Status: Awaiting User Approval*
