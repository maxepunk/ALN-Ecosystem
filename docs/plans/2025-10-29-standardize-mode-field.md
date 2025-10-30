# Standardize 'mode' Field (Remove 'stationMode') Implementation Plan

> **For Claude:** REQUIRED SUB-SKILLS: Use superpowers:executing-plans to implement this plan task-by-task. Use verification-before-completion for EACH task. 

**Goal:** Eliminate the `stationMode` vs `mode` architectural inconsistency by standardizing on `mode` throughout the codebase, removing all references to `stationMode`.

**Architecture:** This is a pure refactoring task with no functional changes. We will remove the deprecated `stationMode` field from backend validators, remove the alias property from GM Scanner's ConnectionManager, and update all test code to use `mode` consistently. The AsyncAPI/OpenAPI contracts already specify `mode` as canonical. NO migration code will be added - users must clear localStorage if needed (breaking change).

**Tech Stack:** Node.js (backend), Vanilla JavaScript (frontend), Joi validation, Jest/Playwright tests
**Testing Baseline:** PASSING: 682 | FAILURES: 68
---

## Pre-Implementation Checklist

**Before starting:**
1. Ensure all existing tests pass: `cd backend && npm test`
2. Create backup branch: `git checkout -b backup-before-mode-cleanup`
3. Verify current behavior with manual test:
   - Start orchestrator: `cd backend && npm run dev:no-video`
   - Connect GM Scanner and verify mode toggle works
   - Scan tokens in both detective and blackmarket modes
   - Confirm transactions process correctly

---

## Task 1: Update Backend Validator Schema

**Files:**
- Modify: `backend/src/utils/validators.js:38-49`
- Test: `backend/tests/unit/validators.test.js` (if exists, else manual verification)

**Step 1: Remove stationMode from transactionSchema**

**Before** (lines 38-49):
```javascript
const transactionSchema = Joi.object({
  id: uuid.required(),
  tokenId: Joi.string().required().min(1).max(100),
  teamId: teamId.required(),
  deviceId: Joi.string().required().min(1).max(100),
  stationMode: Joi.string().valid('detective', 'blackmarket').optional().default('blackmarket'),
  timestamp: isoDate.required(),
  sessionId: uuid.required(),
  status: Joi.string().valid('accepted', 'error', 'duplicate').required(),
  rejectionReason: Joi.string().optional().allow(null),
  points: Joi.number().integer().min(0).required(),
});
```

**After**:
```javascript
const transactionSchema = Joi.object({
  id: uuid.required(),
  tokenId: Joi.string().required().min(1).max(100),
  teamId: teamId.required(),
  deviceId: Joi.string().required().min(1).max(100),
  mode: Joi.string().valid('detective', 'blackmarket').required(),  // Changed from optional stationMode to required mode
  timestamp: isoDate.required(),
  sessionId: uuid.required(),
  status: Joi.string().valid('accepted', 'error', 'duplicate').required(),
  rejectionReason: Joi.string().optional().allow(null),
  points: Joi.number().integer().min(0).required(),
});
```

**Step 2: Verify no other references to stationMode in validators.js**

Run: `grep -n "stationMode" backend/src/utils/validators.js`
Expected: No matches

**Step 3: Test backend services still start**

Run: `cd backend && npm run dev:no-video`
Expected: Server starts without errors, logs show "Transaction service initialized"

**Step 4: Commit**

```bash
git add backend/src/utils/validators.js
git commit -m "refactor: remove stationMode from transactionSchema, use mode"
```

---

## Task 2: Remove stationMode Alias from GM Scanner ConnectionManager

**Files:**
- Modify: `ALNScanner/js/network/connectionManager.js:91-97`
- Verify: `ALNScanner/js/network/connectionManager.js:16` (STORAGE_KEYS.STATION_MODE can stay for now)

**Step 1: Remove stationMode getter and setter**

**Before** (lines 83-97):
```javascript
get mode() {
    return localStorage.getItem(this.STORAGE_KEYS.STATION_MODE) || 'detective';
}

set mode(value) {
    localStorage.setItem(this.STORAGE_KEYS.STATION_MODE, value);
}

get stationMode() {
    return localStorage.getItem(this.STORAGE_KEYS.STATION_MODE) || 'detective';
}

set stationMode(value) {
    localStorage.setItem(this.STORAGE_KEYS.STATION_MODE, value);
}
```

**After**:
```javascript
get mode() {
    return localStorage.getItem(this.STORAGE_KEYS.STATION_MODE) || 'detective';
}

set mode(value) {
    localStorage.setItem(this.STORAGE_KEYS.STATION_MODE, value);
}

// Note: localStorage key name 'stationMode' kept for backward compatibility with existing deployments
// But property name is now consistently 'mode'
```

**Step 2: Search for any code using connectionManager.stationMode**

Run: `grep -rn "connectionManager.stationMode" ALNScanner/js --include="*.js"`
Expected: No matches (all code should use .mode)

Run: `grep -rn "\.stationMode" ALNScanner/js --include="*.js" | grep -v "STORAGE_KEYS.STATION_MODE"`
Expected: No matches except the storage key constant

**Step 3: Test GM Scanner still loads**

1. Open `ALNScanner/index.html` in browser
2. Open DevTools Console
3. Check: `window.connectionManager.mode` returns 'detective' or 'blackmarket'
4. Try setting: `window.connectionManager.mode = 'blackmarket'`
5. Verify localStorage updated: `localStorage.getItem('stationMode')` returns 'blackmarket'
6. Try accessing deprecated property: `window.connectionManager.stationMode`
7. Expected: `undefined` (property no longer exists)

**Step 4: Commit**

```bash
git add ALNScanner/js/network/connectionManager.js
git commit -m "refactor(scanner): remove stationMode alias from ConnectionManager"
```

---

## Task 3: Update Backend Test Helpers to Use mode

**Files:**
- Modify: `backend/tests/helpers/websocket-helpers.js:33-39`
- Modify: `backend/tests/helpers/browser-mocks.js:25, 28, 30`

**Step 1: Update websocket-helpers.js**

**Before** (lines 33-39):
```javascript
async function createAuthenticatedScanner(url, deviceId, mode = 'blackmarket', password = process.env.ADMIN_PASSWORD || 'admin') {
  // ... existing code ...
  Settings.stationMode = mode;

  // ... existing code ...
  socket.emit('gm:identify', {
    stationMode: mode
  });
```

**After**:
```javascript
async function createAuthenticatedScanner(url, deviceId, mode = 'blackmarket', password = process.env.ADMIN_PASSWORD || 'admin') {
  // ... existing code ...
  Settings.mode = mode;

  // ... existing code ...
  socket.emit('gm:identify', {
    mode: mode  // Changed from stationMode
  });
```

**Step 2: Update browser-mocks.js**

Find and replace all instances:
- Line 25: `settings.stationMode = 'blackmarket';` → `settings.mode = 'blackmarket';`
- Line 28: `stationMode: 'detective',` → `mode: 'detective',`
- Line 30: Comment reference → Update comment to use `mode`

**After** (example lines):
```javascript
// Line ~25
settings.mode = 'blackmarket';

// Line ~28 (in mock Settings object)
const Settings = {
  deviceId: '001',
  mode: 'detective',  // Changed from stationMode
  // ...
};
```

**Step 3: Search for remaining stationMode in test helpers**

Run: `grep -rn "stationMode" backend/tests/helpers --include="*.js"`
Expected: No matches

**Step 4: Commit**

```bash
git add backend/tests/helpers/websocket-helpers.js backend/tests/helpers/browser-mocks.js
git commit -m "test: update test helpers to use mode instead of stationMode"
```

---

## Task 4: Update Functional Tests (Transaction Processing)

**Files:**
- Modify: `backend/tests/functional/fr-transaction-processing.test.js:45, 73, 93, 117, 145, 173`

**Step 1: Replace all scanner.Settings.stationMode with scanner.Settings.mode**

Run a targeted search first:
```bash
grep -n "Settings.stationMode" backend/tests/functional/fr-transaction-processing.test.js
```

**For each occurrence, change:**
```javascript
// Before
scanner.Settings.stationMode = 'blackmarket';

// After
scanner.Settings.mode = 'blackmarket';
```

**Specific lines to update:**
- Line ~45: `scanner.Settings.mode = 'blackmarket';`
- Line ~73: `scanner.Settings.mode = 'blackmarket';`
- Line ~93: `scanner.Settings.mode = 'detective';`
- Line ~117: `scanner.Settings.mode = 'blackmarket';`
- Line ~145: `scanner.Settings.mode = 'blackmarket';`
- Line ~173: `scanner.Settings.mode = 'blackmarket';`

**Step 2: Run functional tests to verify**

Run: `cd backend && npm run test:functional -- fr-transaction-processing.test.js`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/tests/functional/fr-transaction-processing.test.js
git commit -m "test: update transaction processing tests to use mode"
```

---

## Task 5: Update Functional Tests (Deployment Modes)

**Files:**
- Modify: `backend/tests/functional/fr-deployment-modes.test.js:28, 53, 72, 88`

**Step 1: Replace stationMode references**

**Line ~28:**
```javascript
// Before
Settings.stationMode = 'detective';

// After
Settings.mode = 'detective';
```

**Line ~53:**
```javascript
// Before
Settings.stationMode = 'blackmarket';

// After
Settings.mode = 'blackmarket';
```

**Line ~72:**
```javascript
// Before
Settings.stationMode = 'detective';

// After
Settings.mode = 'detective';
```

**Line ~88:**
```javascript
// Before
expect(Settings.stationMode).toBe('blackmarket');

// After
expect(Settings.mode).toBe('blackmarket');
```

**Step 2: Run deployment mode tests**

Run: `cd backend && npm run test:functional -- fr-deployment-modes.test.js`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/tests/functional/fr-deployment-modes.test.js
git commit -m "test: update deployment mode tests to use mode"
```

---

## Task 6: Update Integration Tests (Scanner Initialization)

**Files:**
- Modify: `backend/tests/integration/scanner/app-initialization.test.js:47, 61, 72`

**Step 1: Replace Settings.stationMode references**

**Line ~47:**
```javascript
// Before
expect(Settings.stationMode).toBe('blackmarket');

// After
expect(Settings.mode).toBe('blackmarket');
```

**Line ~61:**
```javascript
// Before
expect(Settings.stationMode).toBe('blackmarket');

// After
expect(Settings.mode).toBe('blackmarket');
```

**Line ~72:**
```javascript
// Before
const originalMode = Settings.stationMode;
// ... test code ...
expect(Settings.stationMode).not.toBe('invalid_mode');

// After
const originalMode = Settings.mode;
// ... test code ...
expect(Settings.mode).not.toBe('invalid_mode');
```

**Step 2: Run app initialization tests**

Run: `cd backend && npm run test:integration -- scanner/app-initialization.test.js`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/tests/integration/scanner/app-initialization.test.js
git commit -m "test: update app initialization tests to use mode"
```

---

## Task 7: Update Integration Tests (Scanner Helpers)

**Files:**
- Modify: `backend/tests/integration/_scanner-helpers.test.js:23, 41`

**Step 1: Replace scanner.Settings.stationMode references**

**Line ~23:**
```javascript
// Before
expect(scanner.Settings.stationMode).toBe('blackmarket');

// After
expect(scanner.Settings.mode).toBe('blackmarket');
```

**Line ~41:**
```javascript
// Before
scanner.Settings.stationMode = 'blackmarket';

// After
scanner.Settings.mode = 'blackmarket';
```

**Step 2: Run scanner helper tests**

Run: `cd backend && npm run test:integration -- _scanner-helpers.test.js`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/tests/integration/_scanner-helpers.test.js
git commit -m "test: update scanner helper tests to use mode"
```

---

## Task 8: Update Unit Tests (UIManager)

**Files:**
- Modify: `backend/tests/unit/scanner/uiManager.test.js:15, 28, 41, 54`

**Step 1: Replace global.Settings.stationMode references**

**Line ~15:**
```javascript
// Before
global.Settings = { stationMode: 'blackmarket' };

// After
global.Settings = { mode: 'blackmarket' };
```

**Line ~28:**
```javascript
// Before
global.Settings.stationMode = 'blackmarket';

// After
global.Settings.mode = 'blackmarket';
```

**Line ~41:**
```javascript
// Before
global.Settings.stationMode = 'detective';

// After
global.Settings.mode = 'detective';
```

**Line ~54:**
```javascript
// Before
global.Settings.stationMode = 'blackmarket';

// After
global.Settings.mode = 'blackmarket';
```

**Step 2: Run UIManager tests**

Run: `cd backend && npm run test:unit -- scanner/uiManager.test.js`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/tests/unit/scanner/uiManager.test.js
git commit -m "test: update uiManager tests to use mode"
```

---

## Task 9: Update Unit Tests (DataManager)

**Files:**
- Modify: `backend/tests/unit/scanner/dataManager.test.js:27`

**Step 1: Update comment and verify field usage**

**Before** (line ~27):
```javascript
mode: 'blackmarket'  // Production code uses 'mode', not 'stationMode'
```

**After**:
```javascript
mode: 'blackmarket'  // Field name standardized to 'mode' across codebase
```

**Step 2: Verify test uses mode field correctly**

Search the file for any stationMode references:
```bash
grep -n "stationMode" backend/tests/unit/scanner/dataManager.test.js
```
Expected: No matches (comment already removed)

**Step 3: Run DataManager tests**

Run: `cd backend && npm run test:unit -- scanner/dataManager.test.js`
Expected: All tests pass

**Step 4: Commit**

```bash
git add backend/tests/unit/scanner/dataManager.test.js
git commit -m "test: update dataManager test comment for mode field"
```

---

## Task 10: Update Unit Tests (Broadcasts)

**Files:**
- Modify: `backend/tests/unit/websocket/broadcasts.test.js` (search for stationMode)

**Step 1: Search for stationMode in broadcasts test**

Run: `grep -n "stationMode" backend/tests/unit/websocket/broadcasts.test.js`

Expected output (line ~27):
```
stationMode: 'blackmarket',
```

**Step 2: Update mock transaction data**

**Before** (line ~27):
```javascript
const mockTransaction = {
  id: 'tx-123',
  tokenId: 'token-abc',
  teamId: '001',
  deviceId: 'device-1',
  stationMode: 'blackmarket',
  status: 'accepted',
  points: 100,
  timestamp: '2024-01-01T00:00:00.000Z'
};
```

**After**:
```javascript
const mockTransaction = {
  id: 'tx-123',
  tokenId: 'token-abc',
  teamId: '001',
  deviceId: 'device-1',
  mode: 'blackmarket',  // Changed from stationMode
  status: 'accepted',
  points: 100,
  timestamp: '2024-01-01T00:00:00.000Z'
};
```

**Step 3: Run broadcasts tests**

Run: `cd backend && npm run test:unit -- websocket/broadcasts.test.js`
Expected: All tests pass

**Step 4: Commit**

```bash
git add backend/tests/unit/websocket/broadcasts.test.js
git commit -m "test: update broadcasts test to use mode field"
```

---

## Task 11: Update Integration Tests (Admin Interventions)

**Files:**
- Modify: `backend/tests/integration/admin-interventions.test.js` (multiple occurrences)

**Step 1: Search and replace all stationMode → mode**

Run: `grep -n "stationMode" backend/tests/integration/admin-interventions.test.js`

Expected: Multiple lines with `stationMode: 'blackmarket'` in transaction objects

**Step 2: Replace all occurrences**

Use sed or manual editing:
```bash
sed -i "s/stationMode: 'blackmarket'/mode: 'blackmarket'/g" backend/tests/integration/admin-interventions.test.js
sed -i "s/stationMode: 'detective'/mode: 'detective'/g" backend/tests/integration/admin-interventions.test.js
```

**Or manually change each:**
```javascript
// Before
{ tokenId: 'token1', teamId: '001', stationMode: 'blackmarket', ... }

// After
{ tokenId: 'token1', teamId: '001', mode: 'blackmarket', ... }
```

**Step 3: Verify no stationMode remains**

Run: `grep -n "stationMode" backend/tests/integration/admin-interventions.test.js`
Expected: No matches

**Step 4: Run admin intervention tests**

Run: `cd backend && npm run test:integration -- admin-interventions.test.js`
Expected: All tests pass

**Step 5: Commit**

```bash
git add backend/tests/integration/admin-interventions.test.js
git commit -m "test: update admin interventions tests to use mode"
```

---

## Task 12: Update Integration Tests (Duplicate Detection)

**Files:**
- Modify: `backend/tests/integration/duplicate-detection.test.js` (search for stationMode)

**Step 1: Search for stationMode**

Run: `grep -n "stationMode" backend/tests/integration/duplicate-detection.test.js`

**Step 2: Replace with mode**

For each occurrence:
```javascript
// Before
mode: 'blackmarket'  // (or stationMode: 'blackmarket')

// After
mode: 'blackmarket'
```

**Step 3: Run duplicate detection tests**

Run: `cd backend && npm run test:integration -- duplicate-detection.test.js`
Expected: All tests pass

**Step 4: Commit**

```bash
git add backend/tests/integration/duplicate-detection.test.js
git commit -m "test: update duplicate detection tests to use mode"
```

---

## Task 13: Search and Verify No Remaining stationMode References

**Files:**
- Search: All backend and GM Scanner code
- Document: Any missed references

**Step 1: Search backend for stationMode**

Run: `grep -rn "stationMode" backend/src --include="*.js"`
Expected: No matches

**Step 2: Search backend tests for stationMode**

Run: `grep -rn "stationMode" backend/tests --include="*.js"`
Expected: No matches (all should be updated by now)

**Step 3: Search GM Scanner for stationMode**

Run: `grep -rn "stationMode" ALNScanner/js --include="*.js"`
Expected: Only `STORAGE_KEYS.STATION_MODE` constant (line 16) - this is OK for localStorage key name

**Step 4: Search contracts for stationMode**

Run: `grep -rn "stationMode" backend/contracts --include="*.yaml"`
Expected: No matches (contracts already use 'mode')

**Step 5: Document any findings**

If any stationMode references found:
- Create list in comment or separate file
- Determine if they need updating
- Create additional tasks if needed

**Step 6: Commit documentation**

```bash
git add -A
git commit -m "docs: verify no remaining stationMode references"
```

---

## Task 14: Run Full Test Suite

**Files:**
- Verify: All tests pass

**Step 1: Run all backend tests**

Run: `cd backend && npm test`
Expected: All tests pass (unit + contract + integration)

**Step 2: Run contract validation tests**

Run: `cd backend && npm run test:contract`
Expected: All contract tests pass (validates AsyncAPI/OpenAPI compliance)

**Step 3: Check for test warnings**

Review test output for:
- Deprecation warnings
- Unexpected console logs
- Validation errors

Expected: Clean output, no warnings about stationMode

**Step 4: Document test results**

Create summary:
```
Test Results (Post-Refactor):
- Unit tests: XX/XX passed
- Integration tests: XX/XX passed
- Contract tests: XX/XX passed
- E2E tests: Not run (manual testing phase)
```

**Step 5: Commit test results**

```bash
git add -A
git commit -m "test: verify all tests pass after mode standardization"
```

---

## Task 14a: Fix connection-manager.test.js HTTPS Expectations

**Context:** ConnectionManager now defaults to `https://` (Oct 29, 2025 HTTPS architecture), but tests expect `http://`

**Files:**
- Modify: `backend/tests/unit/scanner/connection-manager.test.js:856, 880, 1012`

**Step 1: Update URL normalization test expectations (lines 856, 880)**

Replace http expectations with https:
```javascript
// Line 856 (TEST 19: should add http:// prefix when missing)
// Before
expect(connectionManager.url).toBe('http://localhost:3000');

// After
expect(connectionManager.url).toBe('https://localhost:3000');

// Line 880 (TEST 19: should trim whitespace from URL)
// Before
expect(connectionManager.url).toBe('http://localhost:3000');

// After
expect(connectionManager.url).toBe('https://localhost:3000');
```

**Step 2: Update configuration test expectation (line 1012)**

```javascript
// Line 1012 (TEST 23: Complete configuration flow)
// Before
expect(connectionManager.url).toBe('http://localhost:3000');

// After
expect(connectionManager.url).toBe('https://localhost:3000');
```

**Step 3: Verify tests pass**

Run: `cd backend && npm run test:unit -- scanner/connection-manager.test.js`
Expected: All 85 tests pass (was 82/85 before fix)

**Step 4: Commit fix**

```bash
git add backend/tests/unit/scanner/connection-manager.test.js
git commit -m "test(connection-manager): update URL expectations to https (HTTPS architecture)"
```

---

## Task 14b: Fix transaction.test.js Missing mode Field

**Context:** Transaction validator now requires `mode` field (changed from optional `stationMode`), test data needs updating

**Files:**
- Modify: `backend/tests/unit/models/transaction.test.js`

**Step 1: Identify failing test objects**

Search for transaction objects causing ValidationError, add `mode` field:
```javascript
// Pattern to find and fix
const transaction = {
  tokenId: 'test-token',
  teamId: '001',
  // MISSING: mode field (now required)
};

// Should be
const transaction = {
  tokenId: 'test-token',
  teamId: '001',
  mode: 'blackmarket',  // ADD THIS
};
```

**Step 2: Update all test transaction objects**

Add `mode: 'blackmarket'` or `mode: 'detective'` to each test transaction object that's missing it

**Step 3: Verify tests pass**

Run: `cd backend && npm run test:unit -- models/transaction.test.js`
Expected: All tests pass (no ValidationErrors)

**Step 4: Commit fix**

```bash
git add backend/tests/unit/models/transaction.test.js
git commit -m "test(transaction): add required mode field to test data"
```

---

## Task 15: Update CLAUDE.md Documentation (Backend)

**Files:**
- Modify: `backend/CLAUDE.md` (search for stationMode references)

**Step 1: Search for stationMode in documentation**

Run: `grep -n "stationMode" backend/CLAUDE.md`

Expected: Possibly none, or references in examples

**Step 2: Update any examples using stationMode**

If found, change to use `mode`:
```markdown
<!-- Before -->
Settings.stationMode = 'blackmarket';

<!-- After -->
Settings.mode = 'blackmarket';
```

**Step 3: Add note about field standardization**

Add to "Recent Changes" or "Architecture Notes" section:
```markdown
## Recent Changes

### October 2025: mode Field Standardization
- **Breaking Change**: Removed `stationMode` field entirely
- All code now uses `mode` consistently (matches AsyncAPI/OpenAPI contracts)
- localStorage key remains `'stationMode'` for backward compatibility with existing deployments
- **Migration**: Users must clear localStorage or re-configure station mode after update
```

**Step 4: Commit documentation**

```bash
git add backend/CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect mode standardization"
```

---

## Task 16: Update CLAUDE.md Documentation (GM Scanner)

**Files:**
- Modify: `ALNScanner/CLAUDE.md` (search for stationMode references)

**Step 1: Search for stationMode in scanner documentation**

Run: `grep -n "stationMode" ALNScanner/CLAUDE.md`

**Step 2: Update examples and architecture notes**

For each occurrence:
```markdown
<!-- Before -->
console.log(Settings.stationMode);  // 'detective' or 'blackmarket'

<!-- After -->
console.log(Settings.mode);  // 'detective' or 'blackmarket'
```

**Step 3: Update debugging section**

Add note about removed property:
```markdown
### Common Debug Tasks
```javascript
// Check current mode
console.log(Settings.mode);  // 'detective' or 'blackmarket'

// NOTE: Settings.stationMode removed (October 2025) - use Settings.mode
```

**Step 4: Update recent changes section**

```markdown
## Recent Changes

### October 2025: Field Standardization
- Removed `ConnectionManager.stationMode` alias property
- Use `ConnectionManager.mode` exclusively
- localStorage key name unchanged (`'stationMode'`)
```

**Step 5: Commit scanner documentation**

```bash
git add ALNScanner/CLAUDE.md
git commit -m "docs: update scanner CLAUDE.md for mode standardization"
```

---

## Task 17: Update Analysis Document

**Files:**
- Modify: `docs/analysis/stationMode-vs-mode-audit.md`

**Step 1: Add implementation completion note**

At the top of the document, add:
```markdown
# stationMode vs mode: Complete Architectural Analysis

> **STATUS UPDATE (2025-10-29)**: ✅ **IMPLEMENTED - Option A (Full Cleanup)**
> - All `stationMode` references removed from codebase
> - Standardized on `mode` field throughout
> - See implementation commit history for details

## Executive Summary
```

**Step 2: Update recommendations section**

Mark Option A as completed:
```markdown
## Recommendations

### ✅ Priority 1: Standardize on `mode` (COMPLETED)

**Implementation Date**: 2025-10-29
**Commits**: [List commit SHAs from this implementation]

**Changes Completed**:
- ✅ Backend Validator (`validators.js`) - removed stationMode
- ✅ ConnectionManager (`connectionManager.js`) - removed stationMode alias
- ✅ All test code - updated to use mode
- ✅ Documentation - updated to reflect changes
```

**Step 3: Commit updated analysis**

```bash
git add docs/analysis/stationMode-vs-mode-audit.md
git commit -m "docs: mark mode standardization as implemented"
```

---

## Task 18: Create Breaking Changes Notice

**Files:**
- Create: `docs/BREAKING_CHANGES.md` (or append to existing)

**Step 1: Create breaking changes entry**

```markdown
# Breaking Changes

## 2025-10-29: mode Field Standardization

### Summary
Removed `stationMode` field entirely. All code now uses `mode` consistently.

### Affected Components
- **Backend**: `transactionSchema` validator now requires `mode` field
- **GM Scanner**: `ConnectionManager.stationMode` property removed
- **Tests**: All test code updated to use `mode`

### Migration Required
⚠️ **BREAKING CHANGE** - No automatic migration provided

**For GM Scanner Users:**
1. Clear browser localStorage: `localStorage.clear()`
2. Reload GM Scanner application
3. Reconfigure station settings (device ID, mode)
4. Reconnect to orchestrator

**For Developers:**
- Update any custom code using `Settings.stationMode` to `Settings.mode`
- Update any custom code using `connectionManager.stationMode` to `connectionManager.mode`
- No backend API changes (contracts already used `mode`)

### Rationale
- Eliminated architectural inconsistency between `stationMode` and `mode`
- Aligned with AsyncAPI/OpenAPI contract specifications
- Reduced developer confusion and maintenance burden

### Related Issues
- Analysis: `docs/analysis/stationMode-vs-mode-audit.md`
- Implementation Plan: `docs/plans/2025-10-29-standardize-mode-field.md`
```

**Step 2: Commit breaking changes notice**

```bash
git add docs/BREAKING_CHANGES.md
git commit -m "docs: add breaking changes notice for mode standardization"
```

---

## Task 19: Update Root README (If Applicable)

**Files:**
- Modify: `README.md` (if it exists at root of ALN-Ecosystem)

**Step 1: Check if README exists and mentions stationMode**

Run: `grep -n "stationMode" README.md`

**Step 2: Update if needed**

If references found:
```markdown
<!-- Before -->
Set the station mode with `stationMode` property

<!-- After -->
Set the station mode with `mode` property
```

**Step 3: Add note about recent changes**

If README has a "Recent Updates" or "Changelog" section:
```markdown
## Recent Updates

### October 2025
- **Breaking Change**: Standardized on `mode` field (removed `stationMode`)
  - See `docs/BREAKING_CHANGES.md` for migration guide
```

**Step 4: Commit if changes made**

```bash
git add README.md
git commit -m "docs: update README for mode field standardization"
```

---

## Task 20: Final Manual Testing

**Files:**
- Test: Full system integration

**Step 1: Clear localStorage and restart fresh**

1. Open GM Scanner in browser
2. Open DevTools Console
3. Run: `localStorage.clear()`
4. Reload page
5. Verify: No errors in console

**Step 2: Test networked mode connection**

1. Start backend: `cd backend && npm run dev:no-video`
2. Open GM Scanner
3. Select "Networked Mode"
4. Enter orchestrator URL
5. Authenticate with password
6. Verify: Connection succeeds, status shows "Connected"

**Step 3: Test detective mode scanning**

1. Set mode toggle to Detective (OFF)
2. Verify: Settings.mode = 'detective' in console
3. Select team (e.g., "001")
4. Use Manual Entry to scan token (e.g., "534e2b03")
5. Verify: Transaction appears, points = 0 (detective mode)

**Step 4: Test blackmarket mode scanning**

1. Set mode toggle to Black Market (ON)
2. Verify: Settings.mode = 'blackmarket' in console
3. Select team (e.g., "001")
4. Use Manual Entry to scan token (e.g., "534e2b03")
5. Verify: Transaction appears, points > 0 (scoring applied)

**Step 5: Verify mode persists across page reloads**

1. Set mode to Black Market
2. Reload page
3. Verify: Mode toggle still shows Black Market
4. Check console: `Settings.mode` returns 'blackmarket'

**Step 6: Test backend transaction processing**

1. Check backend logs for transaction processing
2. Verify: Logs show `mode: 'blackmarket'` or `mode: 'detective'`
3. Verify: NO references to `stationMode` in logs
4. Check transaction broadcasts to clients
5. Verify: WebSocket events use `mode` field

**Step 7: Document test results**

Create test report:
```markdown
## Manual Test Results (2025-10-29)

### GM Scanner Frontend
- ✅ localStorage clear and fresh start works
- ✅ Networked mode connection succeeds
- ✅ Detective mode scanning works (0 points)
- ✅ Black Market mode scanning works (scoring applied)
- ✅ Mode persists across page reloads
- ✅ No console errors related to stationMode

### Backend Orchestrator
- ✅ Transaction processing uses 'mode' field
- ✅ WebSocket broadcasts include 'mode' field
- ✅ No stationMode references in logs
- ✅ Contract validation passes

### Property Access
- ✅ Settings.mode works correctly
- ✅ connectionManager.mode works correctly
- ❌ Settings.stationMode returns undefined (expected)
- ❌ connectionManager.stationMode returns undefined (expected)
```

**Step 8: Commit test report**

```bash
git add docs/plans/2025-10-29-standardize-mode-field.md  # (append test results)
git commit -m "test: manual testing results for mode standardization"
```

---

## Task 21: Create Deployment Checklist

**Files:**
- Create: `docs/plans/2025-10-29-mode-deployment-checklist.md`

**Step 1: Create deployment checklist document**

```markdown
# mode Field Standardization - Deployment Checklist

## Pre-Deployment

- [ ] All commits from implementation plan merged
- [ ] Full test suite passing (`npm test` in backend)
- [ ] Manual testing completed successfully
- [ ] Documentation updated (CLAUDE.md, BREAKING_CHANGES.md)
- [ ] Breaking changes notice communicated to team

## Backend Deployment

- [ ] Stop orchestrator: `pm2 stop aln-orchestrator`
- [ ] Pull latest code: `git pull origin main`
- [ ] Update ALNScanner submodule: `git submodule update --remote --merge`
- [ ] Install dependencies: `npm install` (if package.json changed)
- [ ] Restart orchestrator: `pm2 restart aln-orchestrator`
- [ ] Check logs: `pm2 logs aln-orchestrator --lines 50`
- [ ] Verify health: `curl http://localhost:3000/health`

## GM Scanner Deployment (GitHub Pages)

- [ ] Navigate to ALNScanner submodule: `cd ALNScanner`
- [ ] Pull latest: `git pull origin main`
- [ ] Sync tokens: `python3 sync.py --deploy`
- [ ] Verify deployment: Visit `https://[username].github.io/ALNScanner/`
- [ ] Test in browser: Clear localStorage and reconnect

## User Communication

**⚠️ BREAKING CHANGE - Notify all GM operators:**

> **Subject: GM Scanner Update - Action Required**
>
> We've updated the GM Scanner to fix an internal inconsistency. This requires a one-time reset:
>
> **What to do:**
> 1. Open GM Scanner in browser
> 2. Press F12 (DevTools)
> 3. Go to Console tab
> 4. Type: `localStorage.clear()` and press Enter
> 5. Reload the page (F5)
> 6. Reconfigure your station settings
>
> **When:** Before next game session
> **Why:** Internal field name standardization (no functional changes)
> **Impact:** 2-3 minutes per station

## Rollback Plan (If Issues Arise)

- [ ] Backend rollback: `git revert <merge-commit-sha>`
- [ ] Restart orchestrator: `pm2 restart aln-orchestrator`
- [ ] Scanner rollback: `cd ALNScanner && git checkout <previous-commit>`
- [ ] Redeploy scanner: `python3 sync.py --deploy`
- [ ] Notify users: "Update reverted, no action needed"

## Post-Deployment Verification

- [ ] Connect GM Scanner to orchestrator
- [ ] Test detective mode transaction
- [ ] Test blackmarket mode transaction
- [ ] Check orchestrator logs for errors
- [ ] Verify WebSocket events use 'mode' field
- [ ] Confirm no stationMode references in logs

## Success Criteria

✅ All checklist items completed
✅ No errors in orchestrator logs
✅ GM Scanner connects and scans successfully
✅ Both detective and blackmarket modes work
✅ Mode setting persists across reloads
```

**Step 2: Commit deployment checklist**

```bash
git add docs/plans/2025-10-29-mode-deployment-checklist.md
git commit -m "docs: add deployment checklist for mode standardization"
```

---

## Task 22: Final Verification and Tagging

**Files:**
- Tag: Create git tag for this refactoring

**Step 1: Review all commits**

Run: `git log --oneline --all --graph | head -30`

Expected: See all commits from this plan in order

**Step 2: Verify clean working directory**

Run: `git status`
Expected: "nothing to commit, working tree clean"

**Step 3: Final stationMode search across entire repo**

Run: `grep -rn "stationMode" . --include="*.js" --include="*.md" --include="*.yaml" --exclude-dir=node_modules --exclude-dir=.git`

Expected matches:
- `ALNScanner/js/network/connectionManager.js:16` - `STATION_MODE: 'stationMode'` (localStorage key constant - OK)
- `docs/analysis/stationMode-vs-mode-audit.md` - Documentation references (OK)
- `docs/plans/2025-10-29-standardize-mode-field.md` - Implementation plan (OK)
- Possibly `docs/BREAKING_CHANGES.md` - Breaking change notice (OK)

**NO matches expected in:**
- Active code (*.js property access or variable names)
- Validator schemas
- Test code
- Contracts

**Step 4: Create git tag**

```bash
git tag -a v1.0.0-mode-standardization -m "Standardize 'mode' field, remove 'stationMode' architectural inconsistency"
```

**Step 5: Push changes and tag**

```bash
git push origin main
git push origin v1.0.0-mode-standardization
```

**Step 6: Update implementation plan status**

Add to top of this file:
```markdown
# mode Field Standardization Implementation Plan

> **STATUS**: ✅ COMPLETED (2025-10-29)
> **Tag**: v1.0.0-mode-standardization
> **Commits**: 22 commits (see git log)
```

**Step 7: Final commit**

```bash
git add docs/plans/2025-10-29-standardize-mode-field.md
git commit -m "docs: mark implementation plan as completed"
git push origin main
```

---

## Completion Checklist

### Code Changes
- [ ] Task 1: Backend validator updated (stationMode removed)
- [ ] Task 2: ConnectionManager stationMode alias removed
- [ ] Task 3: Backend test helpers updated
- [ ] Task 4-12: All test files updated to use mode
- [ ] Task 13: Verified no remaining stationMode in code

### Testing
- [ ] Task 14: Full test suite passes
- [ ] Task 20: Manual testing completed successfully

### Documentation
- [ ] Task 15: Backend CLAUDE.md updated
- [ ] Task 16: Scanner CLAUDE.md updated
- [ ] Task 17: Analysis document updated
- [ ] Task 18: Breaking changes notice created
- [ ] Task 19: Root README updated (if applicable)
- [ ] Task 21: Deployment checklist created

### Deployment
- [ ] Task 22: Changes tagged and pushed
- [ ] Backend deployed with new code
- [ ] GM Scanner deployed with new code
- [ ] Users notified of breaking change

### Verification
- [ ] No stationMode references remain in active code
- [ ] localStorage key 'stationMode' retained for compatibility
- [ ] All tests passing
- [ ] Manual testing confirms functionality
- [ ] Documentation reflects new standard

---

## Notes for Engineer

**Context:** This is a pure refactoring task with NO functional changes. The system already works correctly - we're just removing architectural inconsistency.

**Key Points:**
1. `mode` is the canonical field name (matches contracts)
2. `stationMode` was a legacy alias causing confusion
3. NO migration code - this is a breaking change requiring localStorage clear
4. localStorage key `'stationMode'` kept for backward compatibility (value storage)
5. Property names all change to `mode` (value access)

**If Something Breaks:**
- Check that transaction objects use `mode` field, not `stationMode`
- Verify Settings.mode and connectionManager.mode work
- Ensure test mocks use `mode` field
- Check contract validation expects `mode` (not `stationMode`)

**Testing Strategy:**
- Focus on transaction processing (both modes work)
- Verify WebSocket events include `mode` field
- Confirm mode setting persists in localStorage
- Test detective mode (0 points) vs blackmarket mode (scoring)

**Commit Messages:**
Follow conventional commit format:
- `refactor:` for code changes
- `test:` for test updates
- `docs:` for documentation updates
- `chore:` for build/deployment tasks

**Questions?**
- Review `docs/analysis/stationMode-vs-mode-audit.md` for background
- Check AsyncAPI contract: `backend/contracts/asyncapi.yaml`
- Reference Decision #4 comments in code for rationale
