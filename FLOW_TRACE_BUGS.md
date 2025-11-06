# Flow Trace Bug Report

**Date:** 2025-11-06
**Status:** In Progress - Systematic flow trace of all phases

---

## Bugs Found

### BUG #1: GM Scanner Missing deviceType Field ❌ CRITICAL

**Location:** `/home/user/ALN-Ecosystem/ALNScanner/js/app/app.js:805-811`

**Issue:** GM Scanner does not send `deviceType: 'gm'` when submitting transactions

**Code:**
```javascript
// app.js:805 - MISSING deviceType!
window.queueManager.queueTransaction({
    tokenId: tokenId,
    teamId: this.currentTeamId,
    deviceId: Settings.deviceId,
    mode: Settings.mode,
    timestamp: transaction.timestamp
    // ❌ deviceType: 'gm' - MISSING!
});
```

**Backend Expectation:** `validators.js:175` requires `deviceType: Joi.string().valid('gm').required()`

**Impact:**
- ALL GM Scanner transactions rejected by backend (400 validation error)
- P2.2.1 duplicate toast never triggers (no successful transactions)
- P2.2.4 duplicate markers never show (no transactions in history)
- GM Scanner completely broken in networked mode

**Severity:** CRITICAL - Complete feature failure

**Root Cause:** P0.1 implementation updated backend validators but missed GM Scanner client code

---

## Flow Traces

### P2.2: GM Scanner UX Improvements

#### P2.2.1: Duplicate Scan Toast ❌ BLOCKED BY BUG #1

**Expected Flow:**
1. User taps NFC token (already scanned)
2. `processNFCRead()` → `queueTransaction()` (app.js:805)
3. WebSocket emits `transaction:submit` (networkedQueueManager.js:61)
4. Backend validates → rejects duplicate → emits `transaction:result` with `status: 'duplicate'`
5. Client receives event (orchestratorClient.js:264)
6. Toast displays (orchestratorClient.js:276)

**Actual Flow:**
1. ✅ User taps NFC token
2. ✅ `queueTransaction()` called
3. ❌ **BROKEN**: Backend rejects with 400 validation error (missing deviceType)
4. ❌ No `transaction:result` event sent
5. ❌ Toast never triggers

**Verification Status:** ❌ BLOCKED - Feature non-functional due to BUG #1

---

#### P2.2.2: Reconnection Banner ⚠️ PARTIAL BUG

**Expected Flow:**
1. User connects to orchestrator → `hasEverConnected` set to `true`
2. Connection drops
3. User reconnects → backend sends `sync:full` with session data
4. Client receives `sync:full` event (orchestratorClient.js:365)
5. Check `hasEverConnected` && `payload.session.transactions` (line 388)
6. Show toast "Reconnected! X scans restored" (line 390-396)

**Actual Flow:**
1. ✅ First connection: `hasEverConnected` = false → sets to true (line 401)
2. ✅ Backend sends `sync:full` with `session.toJSON()` including transactions (session.js:255)
3. ✅ Client receives event
4. ⚠️ **ISSUE**: Logic checks `hasEverConnected && payload.session && payload.session.transactions`
   - If `payload.session.transactions` is `null` or `undefined`, condition fails
   - Falls through to `else` → sets `hasEverConnected = true` again (harmless)
   - **No reconnection toast shown**

**Bug:** Reconnection toast won't show if `payload.session.transactions` is falsy (empty array, null, undefined)

**Verification Status:** ⚠️ PARTIAL - Works when transactions exist, fails when transactions array is empty/missing

---

### BUG #2: Reconnection Banner Logic Fragile ⚠️ MINOR

**Location:** `/home/user/ALN-Ecosystem/ALNScanner/js/network/orchestratorClient.js:388`

**Issue:** Reconnection banner logic depends on `payload.session.transactions` being truthy

**Current Code:**
```javascript
if (this.hasEverConnected && payload.session && payload.session.transactions) {
    // Show reconnection toast
} else {
    this.hasEverConnected = true;
}
```

**Problem:** If `payload.session.transactions` is `null`, `undefined`, or `[]`, the condition fails and no toast is shown

**Correct Logic:**
```javascript
if (this.hasEverConnected) {
    // This is a reconnection - always show toast
    const restoredCount = payload.session?.transactions?.length || 0;
    if (restoredCount > 0 && window.UIManager) {
        window.UIManager.showToast(`Reconnected! ${restoredCount} scans restored`, 'success', 5000);
    } else if (window.UIManager) {
        window.UIManager.showToast('Reconnected to orchestrator', 'success', 3000);
    }
} else {
    // First connection
    this.hasEverConnected = true;
}
```

**Impact:**
- Reconnection toast may not show if session has no transactions
- User doesn't get feedback that reconnection succeeded

**Severity:** MINOR - Toast still shows if transactions exist, just inconsistent UX

---

#### P2.2.3: Queue Status Indicator ✅ WORKING

**Expected Flow:**
1. `setInterval` calls `updateQueueIndicator()` every 1 second (index.html:2249)
2. Function reads `window.queueManager.getStatus()` (line 2234)
3. Gets `queuedCount` from NetworkedQueueManager.tempQueue.length (networkedQueueManager.js:245)
4. Updates DOM: `countSpan.textContent = queueCount` (line 2238)
5. Shows/hides indicator: adds `.visible` class if count > 0 (line 2241-2244)
6. CSS shows fixed position badge (index.html:205-249)

**Actual Flow:**
1. ✅ `setInterval` registered on page load
2. ✅ `window.queueManager` created by connectionManager (connectionManager.js:174)
3. ✅ Optional chaining handles case where queueManager not yet initialized
4. ✅ CSS `.visible` class changes `display: none` → `display: flex`
5. ✅ Badge appears bottom-right with orange background

**Verification Status:** ✅ WORKING - Properly wired, safe null handling

---

#### P2.2.4: Duplicate Markers ❌ BLOCKED BY BUG #1 AND BUG #3

**Expected Flow:**
1. Backend sends `transaction:new` with `status: 'duplicate'` for duplicate scans
2. GM Scanner receives event → calls `DataManager.addTransaction()`
3. Transaction stored with `status` field preserved
4. User opens history → calls `App.showHistory()` (app.js:874)
5. Calls `UIManager.renderTransactions()` (app.js:876)
6. Checks `t.status === 'duplicate'` (uiManager.js:543)
7. Adds `.duplicate` class and badge (uiManager.js:544, 547)
8. CSS applies yellow background (index.html:752-756)

**Actual Flow:**
1. ❌ **BLOCKED**: BUG #1 prevents transactions from succeeding (no deviceType)
2. ❌ **BUG #3**: Even if fixed, `DataManager.addTransaction()` strips `status` field
3. ❌ Normalized transaction object doesn't include `status` (dataManager.js:145-161)
4. ❌ `t.status` is always `undefined`
5. ❌ Duplicate check `t.status === 'duplicate'` always false
6. ❌ Markers never display

**Verification Status:** ❌ BLOCKED - Two critical bugs prevent feature from working

---

### BUG #3: DataManager Strips Transaction Status Field ❌ CRITICAL

**Location:** `/home/user/ALN-Ecosystem/ALNScanner/js/core/dataManager.js:145-161`

**Issue:** `addTransaction()` normalizes backend transactions but drops the `status` field

**Current Code:**
```javascript
const normalizedTx = {
    id: transaction.id,
    timestamp: transaction.timestamp || new Date().toISOString(),
    deviceId: transaction.deviceId || this.settings?.deviceId,
    mode: transaction.mode || this.settings?.mode,
    teamId: transaction.teamId || this.app?.currentTeamId,
    rfid: transaction.tokenId || transaction.rfid,
    tokenId: transaction.tokenId || transaction.rfid,
    memoryType: transaction.memoryType || (tokenData?.SF_MemoryType) || 'UNKNOWN',
    group: transaction.group || tokenData?.SF_Group || 'No Group',
    valueRating: transaction.valueRating !== undefined ? transaction.valueRating :
                 (tokenData?.SF_ValueRating !== undefined ? tokenData.SF_ValueRating : 0),
    isUnknown: transaction.isUnknown !== undefined ? transaction.isUnknown : !tokenData
    // ❌ MISSING: status field!
};
```

**Fix Required:**
```javascript
const normalizedTx = {
    // ... all existing fields ...
    status: transaction.status || 'accepted',  // ← ADD THIS
    // ... rest of fields ...
};
```

**Impact:**
- P2.2.4 duplicate markers completely non-functional
- Duplicate status from backend is lost
- All UI that depends on transaction.status will fail

**Severity:** CRITICAL - Feature built on top of this data (P2.2.4) is broken

---

### P2.2 Summary

✅ **Working:** P2.2.3 Queue Status Indicator
⚠️ **Partial:** P2.2.2 Reconnection Banner (works with transactions, fails without)
❌ **Broken:** P2.2.1 Duplicate Toast (blocked by BUG #1)
❌ **Broken:** P2.2.4 Duplicate Markers (blocked by BUG #1 and BUG #3)

---

### P2.1: Player Scanner Integration

#### Single Scan ✅ WORKING

**User Flow:** Player scans token → backend processes → returns response

**Code Trace:**
1. ✅ User scans token (orchestratorIntegration.js:81)
2. ✅ Sends `deviceType: 'player'` (line 88)
3. ✅ Backend validates (validators.js:164: `deviceType: Joi.string().valid('player', 'esp32').required()`)
4. ✅ Backend allows duplicates for player (transactionService.js:isDuplicate checks deviceType !== 'gm')

**Verification:** ✅ WORKING

#### Batch Upload ✅ WORKING

**User Flow:** Player goes offline → scans tokens → reconnects → queued scans upload

**Code Trace:**
1. ✅ Generates batchId (orchestratorIntegration.js:162)
2. ✅ Maps transactions with `deviceType: 'player'` (line 174)
3. ✅ Backend batch endpoint validates batchId (scanRoutes.js:187-195)
4. ✅ Idempotency cache prevents duplicate processing

**Verification:** ✅ WORKING

---

## CRITICAL BUGS SUMMARY

### Must Fix (Phase 0-2 Broken):
1. **BUG #1 (CRITICAL):** GM Scanner missing `deviceType: 'gm'` → All GM transactions fail
2. **BUG #3 (CRITICAL):** DataManager strips `status` field → Duplicate markers broken

### Should Fix (UX Issues):
3. **BUG #2 (MINOR):** Reconnection banner logic fragile → Inconsistent feedback

---

**Next Steps:**
1. Continue flow trace for P1 (Phase 2) and P0 (Phase 1)
2. Create comprehensive bug fix plan
3. Fix all critical bugs before Phase 3
