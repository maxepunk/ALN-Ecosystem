# Test Coverage Analysis - Device-Type Specific Behavior

**Date:** 2025-11-06
**Context:** Phase 3 (P2.1, P2.2, P2.3) implementation complete
**Purpose:** Identify test gaps for device-type-specific duplicate detection and integration testing

---

## Current Test Coverage

### ✅ Unit Tests (Comprehensive)

**File:** `backend/tests/unit/services/transactionService-deviceType.test.js`

**Coverage:**
- ✅ GM Scanner duplicate detection (same scanner, different scanner)
- ✅ Player Scanner allows duplicates (same scanner, different scanner)
- ✅ ESP32 Scanner allows duplicates (same scanner, different scanner)
- ✅ Mixed device type scenarios
- ✅ Session metadata tracking
- ✅ deviceType validation (missing, invalid)

**Verdict:** **EXCELLENT** - All device-type-specific business logic thoroughly tested

---

### ⚠️ Integration Tests (Gaps Identified)

#### **File:** `backend/tests/integration/duplicate-detection.test.js`

**Current Coverage:**
- ✅ GM Scanner duplicate detection (same team, cross-team)
- ✅ First-come-first-served mechanics
- ❌ **MISSING:** Player Scanner duplicate scenarios
- ❌ **MISSING:** ESP32 Scanner duplicate scenarios
- ❌ **MISSING:** Mixed device type scenarios (GM + Player + ESP32 in same session)

**Test Type:** WebSocket integration tests with real backend

---

#### **File:** `backend/tests/integration/offline-queue-sync.test.js`

**Current Coverage:**
- ✅ Player scan queue processing (no scoring)
- ✅ GM transaction queue processing (with scoring)
- ❌ **MISSING:** ESP32 scanner offline queue
- ❌ **MISSING:** Device-type-specific duplicate detection during queue replay
- ❌ **MISSING:** Mixed queue scenarios (Player + GM + ESP32 scans in same queue)

**Test Type:** WebSocket integration tests with real backend

---

#### **File:** `backend/tests/integration/player-scanner/networked-mode.test.js`

**Current Coverage:**
- ✅ Orchestrator detection
- ✅ Video playback integration
- ⚠️ **MOCK-BASED** - Uses mocks, not real backend integration

**Test Type:** Unit tests with mocks (NOT true integration)

---

### ⚠️ E2E Tests (Limited Coverage)

#### **File:** `backend/tests/e2e/flows/21-player-scanner-networked-scanning.test.js`

**Current Coverage:**
- ✅ Online scanning POST /api/scan
- ✅ Offline queue management
- ✅ Batch endpoint integration
- ❌ **MISSING:** Duplicate token scanning
- ❌ **MISSING:** Device-type-specific behavior validation

**Test Type:** Playwright E2E tests with real orchestrator + browser

---

#### **File:** `backend/tests/e2e/flows/07a-gm-scanner-standalone-blackmarket.test.js`

**Current Coverage:**
- ✅ GM Scanner standalone mode
- ✅ Duplicate detection in standalone mode
- ❌ **MISSING:** Networked mode duplicate detection
- ❌ **MISSING:** Interaction with Player/ESP32 scanners

**Test Type:** Playwright E2E tests with real orchestrator + browser

---

### ❌ ESP32 Scanner Tests (No Coverage)

**Current State:** NO integration or E2E tests for ESP32 scanner

**Reason:** ESP32 is hardware-based (Arduino), requires either:
1. Hardware-in-loop testing (impractical for CI/CD)
2. HTTP API simulation tests

---

## Test Gaps - Prioritized Recommendations

### 🔴 CRITICAL: Integration Tests for Device-Type Scenarios

**Test File:** `backend/tests/integration/device-type-duplicate-detection.test.js` *(NEW)*

**Coverage Needed:**
1. **Player Scanner allows duplicates** (Integration, not just unit)
   - Connect Player Scanner via HTTP
   - Scan same token multiple times
   - Verify ALL scans accepted (status: 'accepted')
   - Verify no duplicate rejection

2. **ESP32 Scanner allows duplicates** (HTTP simulation)
   - Send POST /api/scan with deviceType: 'esp32'
   - Scan same token multiple times
   - Verify ALL scans accepted
   - Verify no duplicate rejection

3. **Mixed Device Type Session**
   - GM Scanner scans token A → accepted
   - Player Scanner scans token A → accepted (NOT rejected)
   - ESP32 Scanner scans token A → accepted (NOT rejected)
   - GM Scanner scans token A again → rejected (duplicate)

4. **Offline Queue Replay with Device Types**
   - Queue offline scans from all 3 device types
   - Process queue
   - Verify GM duplicates rejected
   - Verify Player/ESP32 duplicates allowed

**Effort:** 2-3 hours
**Priority:** HIGH (validates core Phase 3 functionality)

---

### 🟡 MEDIUM: E2E Tests for Cross-Scanner Scenarios

**Test File:** `backend/tests/e2e/flows/22-multi-device-type-session.test.js` *(NEW)*

**Coverage Needed:**
1. **GM + Player Scanner in same session**
   - GM Scanner claims token for Team 001
   - Player Scanner views same token (different team) → allowed
   - Verify video queued only once (from GM scan)

2. **Player Scanner duplicate viewing**
   - Player Scanner scans token A
   - Same Player Scanner scans token A again
   - Verify BOTH scans trigger UI updates
   - Verify content displayed both times

3. **State Sync Across Device Types**
   - Orchestrator restart
   - All device types reconnect
   - Verify session state restored correctly
   - Verify device-specific scanned tokens restored

**Effort:** 4-5 hours
**Priority:** MEDIUM (validates end-to-end integration)

---

### 🟢 LOW: HTTP API Simulation for ESP32

**Test File:** `backend/tests/integration/esp32-scanner-simulation.test.js` *(NEW)*

**Coverage Needed:**
1. **ESP32 single scan** (POST /api/scan)
   - Send scan with deviceType: 'esp32'
   - Verify accepted
   - Verify content logged (no scoring)

2. **ESP32 batch upload** (POST /api/scan/batch)
   - Send batch with deviceType: 'esp32'
   - Verify all accepted
   - Verify batch:ack event emitted

3. **ESP32 offline queue replay**
   - Simulate offline period
   - Queue scans with deviceType: 'esp32'
   - Replay queue
   - Verify duplicates allowed

**Effort:** 1-2 hours
**Priority:** LOW (ESP32 logic identical to Player Scanner)

---

### 🟢 LOW: Contract Tests for Device-Type Validation

**Test File:** `backend/tests/contract/http/scan-device-types.test.js` *(NEW)*

**Coverage Needed:**
1. **Validate deviceType required**
   - Send POST /api/scan without deviceType → 400 error
   - Send POST /api/scan/batch without deviceType → 400 error

2. **Validate deviceType enum**
   - Send with deviceType: 'invalid' → 400 error
   - Send with deviceType: 'gm' → 200 accepted
   - Send with deviceType: 'player' → 200 accepted
   - Send with deviceType: 'esp32' → 200 accepted

**Effort:** 30 minutes
**Priority:** LOW (validators.js already tested, but explicit contract tests valuable)

---

## Recommended Test Implementation Order

### Sprint 1: Critical Integration Tests (2-3 hours)
✅ **NEW:** `backend/tests/integration/device-type-duplicate-detection.test.js`
- Mixed device type session scenarios
- Offline queue replay with device types
- Player/ESP32 duplicate allowance verification

### Sprint 2: E2E Cross-Scanner Tests (4-5 hours)
✅ **NEW:** `backend/tests/e2e/flows/22-multi-device-type-session.test.js`
- GM + Player Scanner in same session
- State sync across device types
- Player Scanner duplicate viewing

### Sprint 3: ESP32 Simulation + Contract Tests (2-3 hours)
✅ **NEW:** `backend/tests/integration/esp32-scanner-simulation.test.js`
✅ **NEW:** `backend/tests/contract/http/scan-device-types.test.js`

---

## Test Coverage Summary

| Test Type | Current Coverage | Gaps | Priority |
|-----------|-----------------|------|----------|
| **Unit Tests** | ✅ Excellent | None | N/A |
| **Integration Tests** | ⚠️ Partial | Player/ESP32 scenarios | 🔴 HIGH |
| **E2E Tests** | ⚠️ Limited | Cross-device scenarios | 🟡 MEDIUM |
| **Contract Tests** | ✅ Good | deviceType validation | 🟢 LOW |
| **ESP32 Tests** | ❌ None | All ESP32 scenarios | 🟢 LOW |

---

## Conclusion

**Current State:**
- Unit-level device-type logic is **comprehensively tested** ✅
- Integration-level device-type scenarios have **significant gaps** ⚠️
- E2E cross-scanner scenarios are **not tested** ❌

**Recommended Action:**
1. **Implement Critical Integration Tests** (Sprint 1) to validate Phase 3 functionality
2. **Add E2E Cross-Scanner Tests** (Sprint 2) for production confidence
3. **Optional:** Add ESP32 simulation tests (Sprint 3) for completeness

**Risk Assessment:**
- **Without Sprint 1 tests:** Medium risk - device-type logic is unit-tested but not integration-tested
- **Without Sprint 2 tests:** Low risk - E2E scenarios covered by manual testing
- **Without Sprint 3 tests:** Very low risk - ESP32 uses same backend logic as Player Scanner

**Estimated Total Effort:** 8-11 hours for complete test coverage
