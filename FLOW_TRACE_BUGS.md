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

---

## P1 (Phase 2): Connection Stability

### P1.1: JWT Authentication at Connection Boundary ✅ WORKING

**User Flow:** GM Scanner connects to orchestrator → JWT validated before connection accepted

**Code Trace:**
1. ✅ GM Scanner creates socket with auth (orchestratorClient.js:142-147):
   ```javascript
   auth: {
       token: this.token,
       deviceId: this.config.deviceId,
       deviceType: 'gm',
       version: this.config.version
   }
   ```
2. ✅ Backend middleware intercepts at handshake (socketServer.js:45-88)
3. ✅ Checks `deviceType === 'gm'` (line 49)
4. ✅ Validates JWT with `verifyToken(token)` (line 62)
5. ✅ Verifies role === 'admin' (line 63)
6. ✅ Pre-authenticates socket: sets `socket.isAuthenticated = true` (line 72-77)
7. ✅ If invalid: returns error, connection rejected (line 68)
8. ✅ If valid: connection accepted, `next()` called (line 87)

**Verification:** ✅ WORKING - Proper handshake-level authentication

---

### P1.2: Batch Acknowledgment ⚠️ PARTIAL + BUG #4

**User Flow:** GM Scanner goes offline → scans tokens → reconnects → queued scans upload as batch → receives batch:ack → queue cleared

**Code Trace:**
1. ✅ GM Scanner offline → queueTransaction() adds to tempQueue (networkedQueueManager.js:52)
   - ❌ **BUG #1**: Transactions missing `deviceType: 'gm'` field
   - ✅ Saved to localStorage (line 53)
2. ✅ GM Scanner reconnects → calls syncQueue() (line 81)
3. ✅ syncQueue() sends HTTP POST to /api/scan/batch (line 95)
   - ✅ Includes batchId (line 99)
   - ✅ Includes transactions array (line 100)
   - ❌ **BUG #1**: Transactions missing deviceType field
4. ⚠️ Backend processes batch (scanRoutes.js:186-331)
   - ✅ Validates batchId (line 190)
   - ✅ Checks idempotency cache (line 205)
   - ❌ **BUG #4**: NO scoring/game mechanics applied (comment line 183: "NO SCORING OR GAME MECHANICS")
   - ✅ Queues videos if applicable (line 250-252)
   - ⚠️ Returns success but scans not scored
5. ✅ Backend emits batch:ack WebSocket event (scanRoutes.js:309)
   - ✅ Emits to device room: `device:${deviceId}` (line 309)
   - ✅ Payload includes batchId, counts, failures (lines 310-318)
6. ✅ GM Scanner socket in device room (gmAuth.js:78)
   - ✅ Socket joins `device:${deviceId}` on connection
7. ✅ GM Scanner receives batch:ack (networkedQueueManager.js:182)
   - ✅ Listener registered in waitForBatchAck() (line 182)
   - ✅ Checks batchId matches (line 165)
   - ✅ Resolves promise (line 175)
8. ✅ GM Scanner clears queue (line 121)
   - ✅ Only clears AFTER ACK received (line 116 waits for ACK)
   - ✅ Saves empty queue to localStorage (line 122)

**Verification:** ⚠️ PARTIAL - Batch:ack flow works correctly, but **GM offline scans are NOT scored**

---

### BUG #4: GM Scanner Offline Queue Uses Wrong Endpoint ❌ CRITICAL

**Location:** `/home/user/ALN-Ecosystem/ALNScanner/js/network/networkedQueueManager.js:95`

**Issue:** GM Scanner sends offline queue to `/api/scan/batch` endpoint designed for Player Scanner

**Current Code:**
```javascript
// Line 95: syncQueue() sends to batch endpoint
const response = await fetch(`${this.connection.config.url}/api/scan/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        batchId: batchId,
        transactions: batch
    })
});
```

**Backend Endpoint:**
```javascript
// scanRoutes.js:182-183
/**
 * POST /api/scan/batch
 * Process multiple scan requests from player scanner offline queue
 * NO SCORING OR GAME MECHANICS (handled by GM scanner)
 */
```

**Problem:** Backend batch endpoint does NOT:
- Apply game mechanics (scoring, bonuses, group completion)
- Check for duplicates
- Call transactionService.processTransaction()
- Emit transaction:new events to update GM stations

**Impact:**
- GM offline scans are lost from scoring perspective
- Teams don't get points for scans made while GM was offline
- No duplicate detection for offline scans
- Game state inconsistent after reconnection

**Severity:** CRITICAL - GM offline functionality completely broken for game scoring

**Root Cause:** Design confusion - batch endpoint intended for Player Scanner, but GM Scanner uses it too

**Correct Behavior:**
- GM Scanner offline queue should replay transactions via WebSocket (transaction:submit)
- OR backend batch endpoint needs GM-specific logic branch
- OR separate endpoint for GM batch uploads with scoring

---

### P1.3: State Restoration on Reconnection ⚠️ WORKING (MINOR UX ISSUE)

**User Flow:** GM Scanner loses connection → orchestrator restarts → GM Scanner reconnects → receives full state sync

**Code Trace:**
1. ✅ GM Scanner reconnects → socket connects to backend
2. ✅ Backend gmAuth handler called (gmAuth.js:21-185)
3. ✅ Backend retrieves session from sessionService (line 86)
4. ✅ Backend gets device-specific scanned tokens (line 148-150):
   ```javascript
   const deviceScannedTokens = session
     ? Array.from(session.getDeviceScannedTokens(deviceId))
     : [];
   ```
5. ✅ Backend sends sync:full event (line 165-184):
   - session.toJSON()
   - scores (all teams)
   - recentTransactions (last 100, enriched with token data)
   - videoStatus (current video + queue)
   - devices (all connected devices)
   - systemStatus (orchestrator + VLC status)
   - deviceScannedTokens (device-specific duplicates)
   - reconnection flag
6. ✅ GM Scanner receives sync:full (orchestratorClient.js:365)
7. ✅ Updates connectedDevices (line 368)
8. ✅ Checks if session is new → resets DataManager if new session (lines 373-384)
9. ⚠️ **MINOR ISSUE**: Ignores payload.deviceScannedTokens (not used anywhere)
10. ✅ Shows reconnection banner (P2.2.2, lines 386-402)
11. ✅ Emits sync:full to adminModule for display updates (line 404)
12. ✅ AdminModule updates all displays (adminModule.js:892-953)

**Verification:** ✅ WORKING - State fully restored, minor UX degradation if localStorage cleared

---

### BUG #5: Frontend Doesn't Restore Scanned Tokens from Backend ⚠️ MINOR UX

**Location:** `/home/user/ALN-Ecosystem/ALNScanner/js/network/orchestratorClient.js:365-405`

**Issue:** Frontend ignores `payload.deviceScannedTokens` sent by backend in sync:full event

**Current Behavior:**
- Backend sends deviceScannedTokens in sync:full (gmAuth.js:182)
- Frontend receives sync:full but doesn't use deviceScannedTokens
- Frontend relies on localStorage for duplicate detection UI feedback

**Problem:**
- If frontend localStorage cleared but session continues (e.g., clear cache, orchestrator restart)
- Frontend scannedTokens Set is empty
- User scans duplicate token → no immediate UI feedback (frontend doesn't know it's duplicate)
- Backend still rejects with status: 'duplicate'
- Frontend shows toast from transaction:result event

**Impact:**
- **Functional:** No impact - backend duplicate detection still works
- **UX:** Degraded - no immediate duplicate feedback, user sees network round-trip delay

**Severity:** MINOR - Functional correctness maintained, only UX degradation

**Correct Behavior:**
```javascript
// In orchestratorClient.js sync:full handler
if (payload.deviceScannedTokens && window.DataManager) {
    // Restore scanned tokens from backend for immediate duplicate detection
    window.DataManager.scannedTokens = new Set(payload.deviceScannedTokens);
    window.DataManager.saveScannedTokens();
}
```

---

### P1.4: Connection Cleanup ✅ WORKING

**User Flow:** GM Scanner disconnects → backend cleans up → broadcasts disconnect event → other GMs notified

**Code Trace:**
1. ✅ Socket.io detects disconnect → triggers handler (deviceTracking.js:18)
2. ✅ Checks if socket authenticated (has deviceId) (line 21)
3. ✅ Retrieves session from sessionService (line 23)
4. ✅ Finds device in session.connectedDevices (line 25)
5. ✅ Updates device.connectionStatus = 'disconnected' (line 27)
6. ✅ Calls sessionService.updateDevice() to persist (line 28)
7. ✅ Broadcasts device:disconnected event (lines 31-36):
   ```javascript
   emitWrapped(io, 'device:disconnected', {
     deviceId: socket.deviceId,
     type: socket.deviceType,
     disconnectionTime: new Date().toISOString(),
     reason: 'manual'
   });
   ```
8. ✅ Logs disconnect with device info (lines 41-44)
9. ✅ Pre-auth disconnects handled gracefully (lines 45-52)

**Verification:** ✅ WORKING - Clean disconnect handling, proper broadcast, pre-auth disconnect safety

---

## FLOW TRACE COMPLETE

**Date Completed:** 2025-11-06

### Summary of Phases Traced

✅ **P2.2 (GM Scanner UX):** 4 features traced - 1 working, 3 blocked by critical bugs
✅ **P2.1 (Player Scanner):** 2 features traced - both working
✅ **P1 (Connection Stability):** 4 features traced - 3 working, 1 partial

### Features Verified Working
- ✅ P2.2.3: Queue Status Indicator
- ✅ P2.1: Player Scanner single scan + batch upload
- ✅ P1.1: JWT Authentication at Connection Boundary
- ✅ P1.3: State Restoration on Reconnection
- ✅ P1.4: Connection Cleanup

### Features Blocked or Broken
- ❌ P2.2.1: Duplicate Toast (BLOCKED by BUG #1)
- ❌ P2.2.4: Duplicate Markers (BLOCKED by BUG #1 and BUG #3)
- ⚠️ P2.2.2: Reconnection Banner (PARTIAL - BUG #2 minor issue)
- ⚠️ P1.2: Batch Acknowledgment (PARTIAL - BUG #4 critical scoring issue)
- ⚠️ P1.3: State Restoration (WORKING with BUG #5 minor UX issue)

---

## COMPREHENSIVE BUG SUMMARY

### Critical Bugs (Complete Feature Failures)

#### BUG #1: GM Scanner Missing deviceType Field ❌ CRITICAL
- **Location:** `ALNScanner/js/app/app.js:805`
- **Impact:** ALL GM Scanner transactions rejected (400 validation error)
- **Blocks:** P2.2.1 (duplicate toast), P2.2.4 (duplicate markers), entire networked GM Scanner
- **Fix:** Add `deviceType: 'gm'` to queueTransaction() call
- **Effort:** 5 minutes (1-line change)

#### BUG #3: DataManager Strips Transaction Status Field ❌ CRITICAL
- **Location:** `ALNScanner/js/core/dataManager.js:145-161`
- **Impact:** Duplicate markers never display (status field lost)
- **Blocks:** P2.2.4 completely non-functional
- **Fix:** Add `status: transaction.status || 'accepted'` to normalizedTx object
- **Effort:** 5 minutes (1-line change)

#### BUG #4: GM Scanner Offline Queue Uses Wrong Endpoint ❌ CRITICAL
- **Location:** `ALNScanner/js/network/networkedQueueManager.js:95`
- **Impact:** GM offline scans NOT scored (no game mechanics applied)
- **Blocks:** Entire GM offline functionality for game scoring
- **Fix:** Complex - need to design proper solution:
  - **Option A:** Replay via WebSocket (transaction:submit) one-by-one
  - **Option B:** Backend batch endpoint needs GM-specific scoring logic
  - **Option C:** New endpoint /api/scan/batch/gm with full scoring
- **Effort:** 2-4 hours (requires design decision + implementation + testing)

### Minor Bugs (UX Issues)

#### BUG #2: Reconnection Banner Logic Fragile ⚠️ MINOR
- **Location:** `ALNScanner/js/network/orchestratorClient.js:388`
- **Impact:** Reconnection toast may not show if session has no transactions
- **Fix:** Check `hasEverConnected` first, then show appropriate toast
- **Effort:** 10 minutes (logic refactor)

#### BUG #5: Frontend Doesn't Restore Scanned Tokens from Backend ⚠️ MINOR UX
- **Location:** `ALNScanner/js/network/orchestratorClient.js:365-405`
- **Impact:** No immediate duplicate feedback if localStorage cleared
- **Fix:** Restore scannedTokens from payload.deviceScannedTokens in sync:full handler
- **Effort:** 15 minutes (add restoration logic + save to localStorage)

---

## BUG FIX PLAN

### Phase 1: Quick Wins (15 minutes)
**Goal:** Fix BUG #1 and #3 to unblock P2.2.1 and P2.2.4

1. **Fix BUG #1** (5 min)
   - File: `ALNScanner/js/app/app.js:805`
   - Change:
     ```javascript
     window.queueManager.queueTransaction({
         tokenId: tokenId,
         teamId: this.currentTeamId,
         deviceId: Settings.deviceId,
         deviceType: 'gm',  // ← ADD THIS LINE
         mode: Settings.mode,
         timestamp: transaction.timestamp
     });
     ```
   - Test: Scan token, verify transaction accepted (not 400 error)

2. **Fix BUG #3** (5 min)
   - File: `ALNScanner/js/core/dataManager.js:145-161`
   - Change:
     ```javascript
     const normalizedTx = {
         id: transaction.id,
         timestamp: transaction.timestamp || new Date().toISOString(),
         // ... all existing fields ...
         status: transaction.status || 'accepted',  // ← ADD THIS LINE
         // ... rest of fields ...
     };
     ```
   - Test: Scan duplicate token, check history shows duplicate marker

3. **Test P2.2.1 and P2.2.4** (5 min)
   - Scan duplicate token → verify toast shows "Duplicate transaction"
   - Open history → verify duplicate badge displays

### Phase 2: Minor UX Improvements (25 minutes)
**Goal:** Fix BUG #2 and #5 for polish

4. **Fix BUG #2** (10 min)
   - File: `ALNScanner/js/network/orchestratorClient.js:388`
   - Change:
     ```javascript
     if (this.hasEverConnected) {
         // This is a reconnection
         const restoredCount = payload.session?.transactions?.length || 0;
         if (restoredCount > 0 && window.UIManager) {
             window.UIManager.showToast(
                 `Reconnected! ${restoredCount} scans restored`,
                 'success',
                 5000
             );
         } else if (window.UIManager) {
             window.UIManager.showToast('Reconnected to orchestrator', 'success', 3000);
         }
     } else {
         // First connection
         this.hasEverConnected = true;
     }
     ```
   - Test: Disconnect/reconnect with empty session → verify toast shows

5. **Fix BUG #5** (15 min)
   - File: `ALNScanner/js/network/orchestratorClient.js:365-405`
   - Add after line 384:
     ```javascript
     // Restore scanned tokens from backend for immediate duplicate detection
     if (payload.deviceScannedTokens && window.DataManager) {
         window.DataManager.scannedTokens = new Set(payload.deviceScannedTokens);
         window.DataManager.saveScannedTokens();
     }
     ```
   - Test: Clear localStorage, reconnect, scan duplicate → verify immediate toast

### Phase 3: Critical Design Fix (2-4 hours)
**Goal:** Fix BUG #4 (GM offline queue scoring)

6. **Design Decision Required** (30 min)
   - Review options A, B, C
   - Check AsyncAPI contract compliance
   - Decide on approach
   - Document decision

7. **Implement Solution** (1-2 hours)
   - **Recommended: Option A (Replay via WebSocket)**
     - Modify `networkedQueueManager.syncQueue()` to replay transactions via WebSocket
     - Send transaction:submit for each queued transaction
     - Wait for transaction:result for each
     - Only clear queue after all ACKs received
   - **Pros:** Uses existing backend logic, proper scoring/mechanics
   - **Cons:** Slower than batch upload (sequential processing)

8. **Test GM Offline Flow** (1 hour)
   - Go offline → scan tokens → reconnect
   - Verify all transactions processed with scoring
   - Verify duplicate detection works
   - Verify group completion bonuses applied
   - Verify queue cleared after all ACKs

---

## FIX EXECUTION CHECKLIST

### Before Starting
- [ ] Commit current state of FLOW_TRACE_BUGS.md
- [ ] Create new branch for bug fixes
- [ ] Read full bug descriptions above

### Quick Wins (Phase 1)
- [ ] Fix BUG #1 (deviceType field)
- [ ] Fix BUG #3 (status field)
- [ ] Test P2.2.1 (duplicate toast)
- [ ] Test P2.2.4 (duplicate markers)
- [ ] Commit: "fix: add deviceType and status fields (BUG #1, #3)"

### UX Improvements (Phase 2)
- [ ] Fix BUG #2 (reconnection banner)
- [ ] Fix BUG #5 (restore scannedTokens)
- [ ] Test reconnection flows
- [ ] Commit: "fix: improve reconnection UX (BUG #2, #5)"

### Critical Design Fix (Phase 3)
- [ ] Make design decision for BUG #4
- [ ] Implement chosen solution
- [ ] Test GM offline queue comprehensively
- [ ] Commit: "fix: GM offline queue scoring (BUG #4)"

### Final Validation
- [ ] Run all contract tests: `npm run test:contract`
- [ ] Test all P2.2 features end-to-end
- [ ] Test offline/online transitions
- [ ] Update IMPLEMENTATION_STATUS.md
- [ ] Push all changes to branch
- [ ] Ready for Phase 3 continuation (P2.3: ESP32 Scanner)

---

## DEPENDENCIES BETWEEN BUGS

```
BUG #1 (deviceType) ──BLOCKS──> P2.2.1 (duplicate toast)
                    └──BLOCKS──> P2.2.4 (duplicate markers)
                    └──BLOCKS──> BUG #4 (offline queue)

BUG #3 (status field) ──BLOCKS──> P2.2.4 (duplicate markers)

BUG #4 (offline endpoint) ──INDEPENDENT──> Can fix anytime

BUG #2 (reconnection) ──INDEPENDENT──> Polish only
BUG #5 (restore tokens) ──INDEPENDENT──> Polish only
```

**Fix Order:** #1 → #3 → (test P2.2) → #2 → #5 → #4 → (comprehensive testing)

---

## ESTIMATED TOTAL TIME

- **Phase 1 (Quick Wins):** 15 minutes
- **Phase 2 (UX Polish):** 25 minutes
- **Phase 3 (Design Fix):** 2-4 hours
- **Testing & Validation:** 1 hour

**Total:** ~3.5-5.5 hours

**Recommendation:** Execute Phase 1 + 2 immediately (40 minutes), defer Phase 3 to separate session if needed.

---
