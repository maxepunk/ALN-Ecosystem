# ALNScanner Frontend Work To Redo

**Date:** 2025-11-05
**Context:** Merge of `claude/review-orchestrator-auth-fixes-011CUpsENqyYz1EW3aVzzabm` into `claude/merge-orchestrator-auth-fixes-011CUqZktJWU9nUsv2AuLzBc`

---

## Summary

The previous branch (`claude/review-orchestrator-auth-fixes-011CUpsENqyYz1EW3aVzzabm`) included ALNScanner submodule work that was **never pushed to the remote repository**. The parent repo was successfully merged, but the ALNScanner submodule commit `b3839ea8e362cc8b621c4d4dd68cf09ebdbfb3ff` doesn't exist on GitHub.

**Resolution:** The ALNScanner submodule has been reset to the latest available commit (`74954a98b54e19b33ecf065e5e9efbdb2e11d2e0`), and the following work needs to be re-implemented.

---

## Backend Work Status ✅

**All backend orchestrator work from Phase 2 has been successfully merged:**

1. ✅ **P0.1** - Server-side per-device duplicate detection
2. ✅ **P0.2** - Batch acknowledgment system (backend)
3. ✅ **P0.3** - Service initialization order with state machine
4. ✅ **P0.4** - Memory leak prevention (cleanup listeners)
5. ✅ **P1.1** - Reconnection state restoration (`deviceScannedTokens` in `sync:full`)
6. ✅ **P1.2** - Structured socket room joining order
7. ✅ **P1.3** - Socket.io middleware JWT authentication
8. ✅ **Tests** - All 87 new tests, 8 new test suites

**Files:** All backend files (`backend/src/`, `backend/tests/`) are complete and working.

---

## ALNScanner Frontend Work To Redo ⚠️

The following frontend implementations need to be recreated in the ALNScanner submodule:

### 1. P0.2: Offline Queue ACK Confirmation (Frontend)

**Original Commit:** `d8b3c65` (not available on remote)

**What Was Done:**
- Frontend waits for `batch:ack` WebSocket event before clearing offline queue
- Prevents data loss if server doesn't confirm receipt
- Ensures network resilience

**Files to Modify:**
- `ALNScanner/js/scanner/offlineQueueManager.js` (or similar queue handling file)
- May need to update queue processing logic in connection manager

**Backend Contract (Already Working):**
```javascript
// Backend emits after processing batch:
io.to(`device:${deviceId}`).emit('batch:ack', {
  deviceId,
  count: scans.length,
  timestamp: new Date().toISOString()
});
```

**Frontend Implementation Needed:**
```javascript
// Wait for batch:ack before clearing queue
this.socket.on('batch:ack', (data) => {
  if (data.deviceId === this.deviceId) {
    // Clear queue only after server confirms
    this.offlineQueue.clearConfirmed(data.count);
  }
});
```

**Why This Matters:**
- Without this, queue is cleared immediately on upload
- Network failures could lose scans
- Backend already sends the ACK, frontend just needs to listen

---

### 2. P1.4: Frontend Socket Cleanup (Reconnection)

**Original Commit:** `1c98558` (not available on remote)

**What Was Done:**
- Clean up old socket before creating new connection
- Remove all event listeners on reconnection
- Add `beforeunload` handler for clean disconnect
- Defensive checks for test environment compatibility

**Files to Modify:**
- `ALNScanner/js/network/orchestratorClient.js` - Socket connection management
- `ALNScanner/index.html` - Add beforeunload handler

**Implementation Needed:**

#### A. Socket Cleanup Before New Connection
```javascript
// In createSocketConnection() - BEFORE creating new socket:
if (this.socket) {
    // Remove all listeners
    if (typeof this.socket.removeAllListeners === 'function') {
        this.socket.removeAllListeners();
    }

    // Disconnect and force transport close
    if (typeof this.socket.disconnect === 'function') {
        this.socket.disconnect(true);
    }

    this.socket = null;
}

// NOW create new socket:
this.socket = io(this.serverUrl, { /* options */ });
```

#### B. Listener Cleanup on Reconnection
```javascript
// In setupSocketEventHandlers() - BEFORE registering new listeners:
if (this.socket && typeof this.socket.removeAllListeners === 'function') {
    this.socket.removeAllListeners();
}

// NOW register event handlers:
this.socket.on('connect', () => { /* ... */ });
// ... other handlers
```

#### C. Enhanced cleanup() Method
```javascript
cleanup() {
    // Enhanced socket cleanup
    if (this.socket) {
        if (typeof this.socket.removeAllListeners === 'function') {
            this.socket.removeAllListeners();
        }
        if (typeof this.socket.disconnect === 'function') {
            this.socket.disconnect(true);
        }
        this.socket = null;
    }

    // ... rest of cleanup
}
```

#### D. beforeunload Handler (index.html)
```html
<script>
// Add before closing </body> tag:
window.addEventListener('beforeunload', () => {
    if (window.connectionManager?.orchestratorClient?.socket) {
        console.log('Page unloading - disconnecting socket');
        window.connectionManager.orchestratorClient.disconnect();
    }
});
</script>
```

**Why This Matters:**
- Prevents ghost connections (old socket stays connected)
- Stops listener accumulation (memory leaks)
- Clean reconnection after network failures
- Mirrors backend cleanup (P0.4)

---

## Testing Requirements

### After Implementing P0.2 (Offline Queue ACK)

**Manual Test:**
1. Start orchestrator: `cd backend && npm run dev:full`
2. Open GM Scanner: `https://localhost:3000/gm-scanner/`
3. Authenticate and connect
4. Disable network (DevTools → Network → Offline)
5. Scan 3 tokens (queued locally)
6. Re-enable network
7. Click "Upload Offline Queue"
8. **Verify:** Queue cleared ONLY after `batch:ack` received
9. **Verify:** Server logs show batch processed
10. **Verify:** No duplicate scans if re-uploading

**Expected Behavior:**
- Queue shows "Uploading..." status
- After server confirms, queue clears
- If network fails, queue persists for retry

---

### After Implementing P1.4 (Socket Cleanup)

**Manual Test:**
1. Start orchestrator
2. Open GM Scanner
3. Authenticate and connect
4. **Disconnect network** (DevTools → Offline)
5. Wait 10 seconds (socket times out)
6. **Reconnect network** (DevTools → Online)
7. **Verify:** Old socket cleaned up
8. **Verify:** New socket connects successfully
9. **Verify:** No duplicate event listeners (check browser console for warnings)
10. **Close tab** → Verify clean disconnect in server logs

**Expected Behavior:**
- Single active socket connection at all times
- No "MaxListenersExceeded" warnings
- Clean disconnect on page close
- Reconnection works smoothly

---

## Backend Contract Validation ✅

Both features rely on backend contracts that are **already implemented and tested**:

### P0.2: Batch ACK Event
**AsyncAPI Contract:** `backend/contracts/asyncapi.yaml`
```yaml
batch:ack:
  payload:
    type: object
    properties:
      deviceId: { type: string }
      count: { type: number }
      timestamp: { type: string, format: date-time }
```

**Backend Implementation:** `backend/src/websocket/broadcasts.js:68-80`
```javascript
emitBatchAck(io, deviceId, count) {
  io.to(`device:${deviceId}`).emit('batch:ack', {
    deviceId,
    count,
    timestamp: new Date().toISOString()
  });
}
```

**Tests:** `backend/tests/unit/websocket/broadcasts-batch-ack.test.js` (10 tests, all passing)

---

### P1.4: Room-Based Broadcasting
**Backend Implementation:** `backend/src/websocket/gmAuth.js:93-107`
```javascript
// Device-specific room for batch:ack
socket.join(`device:${deviceId}`);
socket.join('gm');
socket.join(`session:${session.sessionId}`);
```

**Tests:** `backend/tests/unit/websocket/roomJoining.test.js` (11 tests, all passing)

---

## Implementation Order

**Recommended sequence:**

1. **First:** Implement **P1.4 (Socket Cleanup)**
   - Foundation for reliable connections
   - Prevents confusion during P0.2 testing
   - Easier to test independently

2. **Second:** Implement **P0.2 (Offline Queue ACK)**
   - Depends on stable socket connection (P1.4)
   - Tests offline/online transitions
   - Validates full data flow

---

## Reference Documentation

For detailed context, see the following files from the merged branch:

- `PHASE_2_COMPLETE.md` - Full Phase 2 summary
- `PHASE_2.4_P1.4_COMPLETE.md` - P1.4 detailed implementation
- `PHASE_1.2_FRONTEND_COMPLETE.md` - P0.2 detailed implementation
- `SUBMODULE_PUSH_STATUS.md` - Why this work was lost
- `backend/contracts/asyncapi.yaml` - WebSocket event contracts

---

## Quick Reference: Original Implementation Details

### P0.2 Original Changes (d8b3c65)
```diff
// offlineQueueManager.js (approximate structure)
+ this.socket.on('batch:ack', (data) => {
+   if (data.deviceId === this.deviceId) {
+     this.clearQueue();
+   }
+ });

- // Old: Clear immediately after sending
- this.clearQueue();
```

### P1.4 Original Changes (1c98558)
**Files:** `js/network/orchestratorClient.js`, `index.html`
**Lines Changed:** ~40 lines added for cleanup logic
**Tests:** Defensive `typeof` checks for test compatibility

---

## Status Summary

| Component | Status | Location |
|-----------|--------|----------|
| Backend (P0.1-P1.3) | ✅ Complete | `backend/src/`, `backend/tests/` |
| Backend Contracts | ✅ Complete | `backend/contracts/*.yaml` |
| Documentation | ✅ Complete | `PHASE_*_COMPLETE.md` files |
| ALNScanner P0.2 | ⚠️ **Needs Redo** | `ALNScanner/js/scanner/` |
| ALNScanner P1.4 | ⚠️ **Needs Redo** | `ALNScanner/js/network/`, `index.html` |

---

## Next Steps

1. Review this document to understand required changes
2. Implement **P1.4** (Socket Cleanup) first
3. Test P1.4 thoroughly (reconnection, cleanup)
4. Implement **P0.2** (Offline Queue ACK)
5. Test P0.2 (offline/online transitions)
6. Run full integration test with physical scanners
7. Commit and push ALNScanner changes to remote
8. Update parent repo submodule reference
9. Validate end-to-end system

---

**Prepared by:** Claude Code
**Date:** 2025-11-05
**Parent Branch:** `claude/merge-orchestrator-auth-fixes-011CUqZktJWU9nUsv2AuLzBc`
**Submodule Current:** ALNScanner @ `74954a9`
**Submodule Target:** ALNScanner @ main (with P0.2 + P1.4 re-implemented)
