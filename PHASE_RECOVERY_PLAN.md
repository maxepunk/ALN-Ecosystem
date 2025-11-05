# Phase 1 & 2 Frontend Recovery Plan

**Date:** 2025-11-05
**Branch:** `claude/review-orchestrator-auth-implementation-011CUqRXs5YTh1UPCPvArGsU`
**Issue:** ALNScanner submodule commits lost before push to remote
**Impact:** P0.2, P1.1, and P1.4 frontend integration incomplete

---

## 🚨 Problem Summary

The completion documents (PHASE_1.2_FRONTEND_COMPLETE.md, PHASE_2.1_P1.1_COMPLETE.md) claim frontend integration is complete, but ALNScanner submodule inspection reveals:

- ❌ P0.2 frontend: No batch ACK implementation
- ❌ P1.1 frontend: No state restoration implementation
- ❌ P1.4 frontend: Not started (as expected)

**Root Cause:** ALNScanner commits were made locally but never pushed to remote before being lost.

---

## ✅ Confirmed Complete (Backend Only)

### Phase 1 Backend - COMPLETE
- ✅ P0.1: Server-side duplicate detection (`backend/src/models/session.js`)
- ✅ P0.2: Batch ACK backend (`backend/src/routes/scanRoutes.js`)
- ✅ P0.3: Service initialization order (`backend/src/server.js`)
- ✅ P0.4: Cleanup call (`backend/src/server.js`)

### Phase 2 Backend - COMPLETE
- ✅ P1.1: deviceScannedTokens in sync:full (`backend/src/websocket/gmAuth.js`)
- ✅ P1.2: Socket room joining order (`backend/src/websocket/gmAuth.js`)
- ✅ P1.3: Socket.io middleware (`backend/src/websocket/socketServer.js`)

---

## ❌ Missing Frontend Work

### P0.2: Batch ACK Frontend - TO IMPLEMENT

**File:** `ALNScanner/js/network/networkedQueueManager.js`

**Current State (Lines 80-107):**
```javascript
async syncQueue() {
    // Sends transactions one-by-one
    for (const transaction of this.tempQueue) {
        this.connection.socket.emit('transaction:submit', ...);
    }

    // Clears queue immediately (NO ACK WAIT!)
    this.tempQueue = [];
    this.saveQueue();
    this.syncing = false;
}
```

**Required Implementation:**
1. Generate unique `batchId` (uuid)
2. Send batch via `/api/scan/batch` endpoint
3. Wait for `batch:ack` WebSocket event (60s timeout)
4. Only clear queue after ACK received
5. Retry on timeout (idempotent with same batchId)

**Estimated Time:** 2 hours

---

### P1.1: State Restoration Frontend - TO IMPLEMENT

**File 1:** `ALNScanner/js/core/dataManager.js`

**Required Implementation:**
```javascript
/**
 * Restore scanned tokens from server (source of truth)
 * Called on reconnection via sync:full event
 */
restoreScannedTokens(tokenIds) {
    if (!Array.isArray(tokenIds)) {
        console.error('Invalid tokenIds', tokenIds);
        return;
    }

    // Clear existing
    this.scannedTokens.clear();

    // Add server tokens
    tokenIds.forEach(tokenId => {
        this.scannedTokens.add(tokenId);
    });

    // Persist
    this.saveScannedTokens();

    console.log('Scanned tokens restored from server', {
        count: this.scannedTokens.size
    });
}
```

**File 2:** `ALNScanner/js/network/orchestratorClient.js` (Line 340-362)

**Current sync:full Handler:**
```javascript
this.socket.on('sync:full', (eventData) => {
    const payload = eventData.data;

    // ... handles devices, session

    // MISSING: deviceScannedTokens handling

    this.emit('sync:full', payload);
});
```

**Required Addition:**
```javascript
this.socket.on('sync:full', (eventData) => {
    const payload = eventData.data;

    // ... existing device/session handling ...

    // PHASE 2.1 (P1.1): Restore scanned tokens from server
    if (payload.deviceScannedTokens && Array.isArray(payload.deviceScannedTokens)) {
        console.log('Restoring scanned tokens from server', {
            count: payload.deviceScannedTokens.length,
            reconnection: payload.reconnection
        });

        // Server is source of truth
        if (window.DataManager) {
            window.DataManager.restoreScannedTokens(payload.deviceScannedTokens);
        }
    }

    // Show reconnection notification
    if (payload.reconnection && window.UIManager) {
        window.UIManager.showToast('info', 'Reconnected - state synchronized');
    }

    this.emit('sync:full', payload);
});
```

**Estimated Time:** 1.5 hours

---

### P1.4: Socket Cleanup Frontend - TO IMPLEMENT

**File 1:** `ALNScanner/js/network/orchestratorClient.js`

**Required Changes:**

**1. createSocketConnection() - Add cleanup (Line ~107):**
```javascript
createSocketConnection() {
    // PHASE 2.4: ALWAYS cleanup old socket first
    if (this.socket) {
        console.log('Cleaning up old socket before creating new one');
        this.socket.removeAllListeners();
        this.socket.disconnect(true);
        this.socket = null;
    }

    // ... existing socket creation code ...
}
```

**2. setupSocketEventHandlers() - Add removeAllListeners (Line ~133):**
```javascript
setupSocketEventHandlers() {
    // PHASE 2.4: Remove all existing handlers first
    if (this.socket) {
        this.socket.removeAllListeners();
    }

    // ... existing handler registration ...
}
```

**3. cleanup() - Ensure comprehensive cleanup:**
```javascript
cleanup() {
    // Stop timers
    if (this.rateLimitTimer) {
        clearTimeout(this.rateLimitTimer);
        this.rateLimitTimer = null;
    }

    // PHASE 2.4: Clean socket
    if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect(true);
        this.socket = null;
    }

    // Clear state
    this.isConnected = false;
    this.connectionStatus = 'disconnected';
    this.token = null;
}
```

**File 2:** `ALNScanner/index.html`

**Required Addition (Before </body>):**
```html
<script>
// PHASE 2.4: Disconnect on page unload
window.addEventListener('beforeunload', () => {
    if (window.connectionManager?.orchestratorClient?.socket) {
        console.log('Page unloading - disconnecting socket');
        window.connectionManager.orchestratorClient.disconnect();
    }
});
</script>
```

**Estimated Time:** 1 hour

---

## 🎯 Implementation Order

### Step 1: Verify Backend Works (30 min)
- [ ] Test batch:ack endpoint manually
- [ ] Test sync:full includes deviceScannedTokens
- [ ] Confirm backend changes stable

### Step 2: Implement P0.2 Frontend (2 hours)
- [ ] Add uuid library or implement simple uuid generator
- [ ] Implement batch upload with batchId
- [ ] Implement waitForAck() method
- [ ] Update syncQueue() to wait for ACK
- [ ] Test manually: send batch, verify ACK, verify queue cleared

### Step 3: Implement P1.1 Frontend (1.5 hours)
- [ ] Add restoreScannedTokens() to dataManager.js
- [ ] Update sync:full handler in orchestratorClient.js
- [ ] Add reconnection notification
- [ ] Test manually: disconnect, reconnect, verify tokens restored

### Step 4: Implement P1.4 Frontend (1 hour)
- [ ] Add socket cleanup in createSocketConnection()
- [ ] Add removeAllListeners in setupSocketEventHandlers()
- [ ] Add beforeunload handler in index.html
- [ ] Test manually: refresh 5x, verify 1 socket

### Step 5: Integration Testing (1 hour)
- [ ] Full flow test: scan → offline → reconnect → verify state
- [ ] Socket cleanup test: refresh multiple times
- [ ] Batch ACK test: send large batch, verify idempotency

### Step 6: Commit & Push (30 min)
- [ ] Commit ALNScanner changes to submodule
- [ ] Push ALNScanner to remote
- [ ] Update parent repo submodule reference
- [ ] Push parent repo to branch

**Total Estimated Time:** 6.5 hours

---

## ✅ Success Criteria

### P0.2 Success:
- [ ] Batch upload generates unique batchId
- [ ] Queue NOT cleared until batch:ack received
- [ ] Retry with same batchId on timeout (idempotent)
- [ ] Backend logs show "Duplicate batch detected" on retry

### P1.1 Success:
- [ ] Reconnection restores scannedTokens from server
- [ ] Duplicate scan rejected after reconnection
- [ ] Reconnection notification shown to user
- [ ] Server state overrides local storage

### P1.4 Success:
- [ ] Page refresh 5x → still 1 socket on backend
- [ ] Tab close → socket disconnects within 2 seconds
- [ ] No "MaxListenersExceeded" warnings
- [ ] Clean connection lifecycle

---

## 📝 Documentation Updates Required

After implementation:
- [ ] Update PHASE_1.2_FRONTEND_COMPLETE.md with actual implementation
- [ ] Update PHASE_2.1_P1.1_COMPLETE.md with actual implementation
- [ ] Create PHASE_2.4_P1.4_COMPLETE.md
- [ ] Create PHASE_2_ACTUAL_COMPLETION.md
- [ ] Update SIMPLIFIED_IMPLEMENTATION_PLAN.md status

---

**Prepared by:** Claude Code
**Date:** 2025-11-05
**Status:** Ready to Begin Implementation
