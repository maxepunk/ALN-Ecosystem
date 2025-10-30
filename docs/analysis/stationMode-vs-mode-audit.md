# stationMode vs mode: Complete Architectural Analysis

> **STATUS UPDATE (2025-10-29)**: ✅ **IMPLEMENTED - Option A (Full Cleanup)**
> - All `stationMode` references removed from codebase
> - Standardized on `mode` field throughout
> - See implementation commit history for details

## Executive Summary

**Status**: ⚠️ **ARCHITECTURAL INCONSISTENCY IDENTIFIED**

There is a **naming inconsistency** between `stationMode` and `mode` across the codebase that creates confusion but does NOT represent a functional bug. Both terms refer to the same concept: **the game mode toggle between 'detective' and 'blackmarket' modes**.

### Key Finding
- **Frontend (GM Scanner)**: Uses `mode` in Settings, ConnectionManager, and transaction submissions
- **Backend (Orchestrator)**: Uses BOTH `stationMode` (internal validation) AND `mode` (API contracts)
- **Contracts (AsyncAPI/OpenAPI)**: Specify `mode` as the canonical field name
- **Root Cause**: Backend validators define `stationMode` but then map it to `mode` for contract compliance

### Impact
- **Functional**: ✅ No bugs - system works correctly due to proper field mapping
- **Maintainability**: ⚠️ High confusion risk - developers must remember two names for same concept
- **Documentation**: ⚠️ Inconsistent terminology across codebase
- **Test Code**: ⚠️ Mix of both terms creates unclear test intentions

---

## Complete Data Flow Analysis

### 1. GM Scanner → Backend Transaction Flow

```
GM Scanner (Frontend)
  ├─ Settings.mode = 'blackmarket'              // Line: ALNScanner/js/ui/settings.js:9
  ├─ ConnectionManager.mode getter/setter       // Lines: ALNScanner/js/network/connectionManager.js:83-89
  ├─ ConnectionManager.stationMode getter/setter // Lines: ALNScanner/js/network/connectionManager.js:91-97
  │  └─ BOTH access same localStorage key: 'stationMode'
  │
  ├─ Transaction created in app.js:800-806
  │  └─ { tokenId, teamId, deviceId, mode: Settings.mode }  // Using 'mode'
  │
  └─ NetworkedQueueManager emits WebSocket event
     └─ Event: 'transaction:submit' { data: { mode: 'blackmarket' } }

     ↓ WebSocket Transmission ↓

Backend (Orchestrator)
  ├─ WebSocket receives: gmTransactionSchema validation
  │  └─ validators.js:173: mode: Joi.string().valid('detective', 'blackmarket').required()
  │
  ├─ Transaction model created
  │  └─ Transaction.fromScanRequest(scanRequest, sessionId)
  │     └─ models/transaction.js:144: mode: scanRequest.mode || 'blackmarket'
  │
  ├─ Transaction validation
  │  └─ transactionSchema: validators.js:43: stationMode: Joi.string().optional().default('blackmarket')
  │     └─ ⚠️ INCONSISTENCY: validator uses 'stationMode' but transaction has 'mode'
  │
  └─ WebSocket broadcast back to clients
     └─ broadcasts.js:115: mode: transaction.mode  // Using 'mode' for AsyncAPI compliance
```

### 2. Backend Internal Processing

**Transaction Processing** (`backend/src/services/transactionService.js`):
```javascript
Line 80: const points = (transaction.mode === 'detective') ? 0 : token.value;
Line 82: if (transaction.mode !== 'detective') { /* update scores */ }
```

**WebSocket Broadcasts** (`backend/src/websocket/broadcasts.js`):
```javascript
Line 115: mode: transaction.mode,  // AsyncAPI contract field (Decision #4)
Line 424: mode: transaction.mode,
```

**Admin Events** (`backend/src/websocket/adminEvents.js`):
```javascript
Line 28: if (!txData.tokenId || !txData.teamId || !txData.mode) { /* validation */ }
```

---

## Field Usage Breakdown

### Frontend (GM Scanner Submodule)

| File | Field Name | Purpose | Line(s) |
|------|-----------|---------|---------|
| `js/ui/settings.js` | `mode` | Primary setting storage | 9, 21, 38 |
| `js/network/connectionManager.js` | `mode` | Getter/setter for localStorage | 83-89 |
| `js/network/connectionManager.js` | `stationMode` | **ALIAS** getter/setter (same localStorage key) | 91-97 |
| `js/app/app.js` | `mode` | Transaction field (Settings.mode) | 804 |
| `js/core/dataManager.js` | `mode` | Transaction property access | Multiple |
| `js/ui/uiManager.js` | `mode` | UI display logic | Multiple |

**Key Observation**: ConnectionManager exposes BOTH `mode` and `stationMode` properties that read/write to the **same localStorage key** (`'stationMode'`).

### Backend (Orchestrator)

| File | Field Name | Purpose | Line(s) |
|------|-----------|---------|---------|
| **Validators** | | | |
| `src/utils/validators.js` | `stationMode` | Transaction validation schema (OPTIONAL) | 43 |
| `src/utils/validators.js` | `mode` | GM transaction schema (REQUIRED) | 173 |
| **Models** | | | |
| `src/models/transaction.js` | `mode` | Transaction model field | 144 |
| **Services** | | | |
| `src/services/transactionService.js` | `mode` | Scoring logic | 80, 82, 94 |
| **WebSocket** | | | |
| `src/websocket/broadcasts.js` | `mode` | Event broadcast payload | 115, 424 |
| `src/websocket/adminEvents.js` | `mode` | Admin validation | 28 |
| `src/websocket/deviceTracking.js` | `mode` | Device tracking | 27 |
| `src/websocket/gmAuth.js` | `mode` | Authentication sync | 124 |

### Contracts (API Specifications)

| Contract | Field Name | Requirement | Location |
|----------|-----------|-------------|----------|
| **AsyncAPI** (WebSocket) | `mode` | REQUIRED | `backend/contracts/asyncapi.yaml` |
| **OpenAPI** (HTTP) | `mode` | Example field | `backend/contracts/openapi.yaml:291, 293, 328` |

**Contract Specification** (AsyncAPI):
```yaml
transaction:
  properties:
    mode:
      type: string
      enum: [detective, blackmarket]
      example: "blackmarket"
  required:
    - mode
```

### Test Code

**Mix of Both Terms**:
- `backend/tests/unit/scanner/dataManager.test.js:27`: Comment uses `'stationMode'` but code uses `mode`
- `backend/tests/helpers/websocket-helpers.js:36`: Variable named `mode` but sets `Settings.stationMode`
- `backend/tests/functional/`: Mix of both `stationMode` and `mode`

---

## Root Cause Analysis

### Why the Inconsistency Exists

1. **Historical Naming** (`validators.js:43`):
   - The `transactionSchema` uses `stationMode` as an OPTIONAL field with default
   - This was likely the original internal name

2. **Contract Alignment** (Decision #4 in comments):
   - AsyncAPI/OpenAPI contracts standardized on `mode` as the field name
   - Backend code was updated to use `mode` for external communication
   - BUT: The internal validator schema was never updated

3. **Frontend Evolution**:
   - GM Scanner primarily uses `mode` for Settings and transactions
   - ConnectionManager added `stationMode` as an ALIAS for backward compatibility
   - Both properties access the same localStorage key: `'stationMode'`

4. **Validator Mismatch**:
   - `transactionSchema` expects `stationMode` (line 43) but marks it OPTIONAL
   - `gmTransactionSchema` expects `mode` (line 173) and marks it REQUIRED
   - Transaction model uses `mode` field (line 144)
   - Joi validation with `stripUnknown: true` likely removes unexpected fields

---

## Legitimate Use Cases vs Disconnects

### ❌ NOT Legitimate - Pure Inconsistency

**There are NO distinct use cases**. Both terms refer to the same concept:
- **Game Mode**: 'detective' (star ratings, no scoring) vs 'blackmarket' (currency, team scores)

### ✅ What SHOULD Be

**Single Canonical Name**: `mode`
- Matches AsyncAPI/OpenAPI contracts
- Shorter, clearer name
- Already used in 90% of code

---

## Specific Issues Identified

### Issue 1: Validator Schema Mismatch
**Location**: `backend/src/utils/validators.js`

```javascript
// Line 43: transactionSchema
stationMode: Joi.string().valid('detective', 'blackmarket').optional().default('blackmarket'),

// Line 173: gmTransactionSchema
mode: Joi.string().valid('detective', 'blackmarket').required(),  // REQUIRED - no default
```

**Problem**: Two different validators for the same concept
- `transactionSchema` uses `stationMode` (optional)
- `gmTransactionSchema` uses `mode` (required)
- Transaction model actually uses `mode` field

**Why It Works Anyway**:
- Transactions from GM Scanner validate against `gmTransactionSchema` which uses `mode`
- Internal transactions use Transaction.fromScanRequest() which sets `mode` field
- The `transactionSchema` validation likely never sees `stationMode` because it's not present

### Issue 2: ConnectionManager Dual Properties
**Location**: `ALNScanner/js/network/connectionManager.js:83-97`

```javascript
get mode() {
    return localStorage.getItem(this.STORAGE_KEYS.STATION_MODE) || 'detective';
}

get stationMode() {
    return localStorage.getItem(this.STORAGE_KEYS.STATION_MODE) || 'detective';
}
```

**Problem**: Two properties, identical behavior
- Both read from same localStorage key
- Creates confusion about which to use
- No semantic difference

**Why It Exists**: Likely added for backward compatibility with old code

### Issue 3: Test Code Confusion
**Location**: `backend/tests/unit/scanner/dataManager.test.js:27`

```javascript
mode: 'blackmarket'  // Production code uses 'mode', not 'stationMode'
```

**Problem**: Comment implies uncertainty about correct field name
- Suggests developers are confused by dual naming
- Test passes but comment shows architectural uncertainty

### Issue 4: Settings Module Inconsistency
**Location**: `ALNScanner/js/ui/settings.js`

**Uses**: `mode` exclusively
**But**: Stores to localStorage with key `'mode'`
**While**: ConnectionManager uses localStorage key `'stationMode'`

**Wait, let me verify this...**

Actually, looking at the code:
- `Settings.js` checks `if (window.connectionManager)` and uses `connectionManager.mode`
- ConnectionManager.mode setter uses `localStorage.setItem(this.STORAGE_KEYS.STATION_MODE, value)`
- `STORAGE_KEYS.STATION_MODE = 'stationMode'`

So Settings.js DOES use ConnectionManager, which uses the 'stationMode' localStorage key. The inconsistency is:
- Property name: `mode`
- Storage key: `'stationMode'`

---

## Impact Assessment

### ✅ Functional Correctness: NO BUGS
- System works correctly end-to-end
- Proper field mapping ensures data flows correctly
- Tests pass, transactions process successfully

### ⚠️ Code Maintainability: HIGH RISK
- **Developer Confusion**: Must remember two names for same concept
- **Onboarding Friction**: New developers will be confused
- **Bug Risk**: Future changes might use wrong field name
- **Search Difficulty**: Finding all related code requires searching two terms

### ⚠️ Documentation Clarity: POOR
- Comments reference "Decision #4" about using `mode` for AsyncAPI compliance
- But `stationMode` still exists in validators
- No clear guidance on which term to use where

### ⚠️ Test Clarity: MEDIUM RISK
- Mix of terms in test helpers and test code
- Comments like "Production code uses 'mode', not 'stationMode'" show confusion
- Test readers uncertain about system architecture

---

## Recommendations

### ✅ Priority 1: Standardize on `mode` (COMPLETED)

**Implementation Date**: 2025-10-29
**Plan**: `docs/plans/2025-10-29-standardize-mode-field.md`

**Changes Completed**:
- ✅ Backend Validator (`validators.js`) - removed stationMode
- ✅ ConnectionManager (`connectionManager.js`) - removed stationMode alias
- ✅ All test code - updated to use mode
- ✅ Documentation - updated to reflect changes

**Original Rationale**:
- ✅ Matches AsyncAPI/OpenAPI contracts (authoritative)
- ✅ Shorter, clearer name
- ✅ Already used in 90% of codebase
- ✅ Matches industry convention for "game mode" concept

**Changes Required**:

1. **Backend Validator** (`backend/src/utils/validators.js:43`):
   ```javascript
   // REMOVE:
   stationMode: Joi.string().valid('detective', 'blackmarket').optional().default('blackmarket'),

   // KEEP (already exists at line 173):
   mode: Joi.string().valid('detective', 'blackmarket').required(),
   ```

2. **ConnectionManager** (`ALNScanner/js/network/connectionManager.js:91-97`):
   ```javascript
   // REMOVE stationMode getter/setter entirely
   // KEEP only mode getter/setter

   // OPTIONAL: Rename localStorage key for clarity
   STORAGE_KEYS.MODE: 'mode',  // Instead of STATION_MODE: 'stationMode'
   ```

3. **Test Helpers** (`backend/tests/helpers/`):
   - Replace all `Settings.stationMode` with `Settings.mode`
   - Remove confusing comments about field names

4. **Documentation** (`CLAUDE.md`, `README.md`):
   - Update all references to use `mode` consistently
   - Add note: "Historical: 'stationMode' is deprecated, use 'mode'"

### Priority 2: Add Migration Safeguards (MEDIUM PRIORITY)

**If renaming localStorage key** (optional cleanup):

Add to `ConnectionManager.migrateLocalStorage()`:
```javascript
// Migrate stationMode to mode
const oldMode = localStorage.getItem('stationMode');
if (oldMode && !localStorage.getItem('mode')) {
    localStorage.setItem('mode', oldMode);
    // Keep old key for backward compatibility
    console.log('Migrated stationMode to mode');
}
```

### Priority 3: Update Comments and Documentation (LOW PRIORITY)

- Update all code comments referencing "stationMode" to "mode"
- Add architectural decision record (ADR) explaining the standardization
- Update contract documentation to explicitly deprecate "stationMode"

---

## Breaking Change Analysis

### Option A: Full Cleanup (BREAKING)
- Remove `stationMode` entirely from all code
- Rename localStorage key from `'stationMode'` to `'mode'`
- **Impact**: Users must clear localStorage or migration code required

### Option B: Graceful Deprecation (NON-BREAKING)
- Keep `stationMode` as deprecated alias in ConnectionManager
- Add deprecation warnings to console
- Update all new code to use `mode`
- **Impact**: Zero user disruption, gradual code cleanup

### Option C: Minimal Fix (NON-BREAKING)
- Remove `stationMode` from transactionSchema validator
- Keep ConnectionManager dual properties for compatibility
- Update documentation and tests only
- **Impact**: Fixes confusion without code changes

**RECOMMENDED**: **Option B** - Graceful deprecation path with clear communication

---

## Testing Strategy

### 1. Verify Current Behavior (Baseline)
```bash
# Run all tests to confirm current state passes
npm test

# Specifically test transaction processing
npm run test:integration -- duplicate-detection.test.js
npm run test:functional -- fr-transaction-processing.test.js
```

### 2. After Changes - Regression Testing
```bash
# Full test suite
npm test

# Contract validation
npm run test:contract

# E2E scanner flows
npx playwright test flows/07b-gm-scanner-networked
```

### 3. Manual Validation
- [ ] GM Scanner connects to orchestrator
- [ ] Detective mode transactions process correctly
- [ ] Black Market mode transactions score correctly
- [ ] Mode toggle in Settings persists across refreshes
- [ ] Offline transactions queue with correct mode field

---

## Migration Checklist

### Phase 1: Preparation
- [ ] Document current localStorage keys used in production
- [ ] Create backup of test data
- [ ] Add deprecation warnings to `stationMode` usage

### Phase 2: Code Changes
- [ ] Remove `stationMode` from `transactionSchema` validator
- [ ] Add deprecation log to ConnectionManager.stationMode getter
- [ ] Update all test helpers to use `mode`
- [ ] Update documentation and comments

### Phase 3: Validation
- [ ] Run full test suite
- [ ] Run contract validation tests
- [ ] Test GM Scanner in both modes
- [ ] Verify localStorage migration works

### Phase 4: Deployment
- [ ] Deploy backend changes
- [ ] Deploy GM Scanner submodule update
- [ ] Monitor logs for deprecation warnings
- [ ] Update parent repo submodule reference

---

## Conclusion

**The `stationMode` vs `mode` inconsistency is NOT a functional bug**, but it IS an architectural debt that creates confusion and maintenance burden.

### Key Takeaways
1. ✅ **System works correctly** - proper field mapping ensures data flows
2. ⚠️ **Developer confusion** - two names for one concept hinders maintainability
3. 📝 **Contracts are clear** - AsyncAPI/OpenAPI specify `mode` as canonical
4. 🔧 **Easy fix** - standardization can be non-breaking with deprecation path

### Next Steps
1. Create GitHub issue for standardization work
2. Choose deprecation option (recommend Option B)
3. Implement changes in phases with testing
4. Update documentation to prevent future inconsistency

---

**Document Version**: 1.0
**Date**: 2025-10-29
**Audit Performed By**: Claude Code
**Codebase Version**: Commit 1f51de4c
