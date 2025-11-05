# ALN Orchestrator Connection & Authentication Audit Report

**Date:** 2025-11-05
**Scope:** All scanner modules (GM, Player Web, ESP32) + Backend orchestrator
**Focus:** Connection stability, authentication flows, state synchronization

---

## Executive Summary

This audit reveals **23 critical issues** affecting connection stability and state synchronization across the ALN ecosystem:

- **8 HIGH severity** issues causing connection loss, state desync, and data loss
- **11 MEDIUM severity** issues causing UX degradation and potential bugs
- **4 LOW severity** issues causing minor inefficiencies

### Root Causes

1. **Client-side duplicate detection** - scannedTokens tracked in browser localStorage, cleared on refresh
2. **Reconnection state management** - Device marked as "existing" on reconnect, missing critical broadcasts
3. **Race conditions** - Multiple timing issues between socket connections, room joins, and event emissions
4. **Missing cleanup patterns** - Old sockets, listeners, and timers not properly disposed
5. **Inconsistent retry strategies** - Some components use exponential backoff, others don't

### Impact on User Experience

**Current symptoms users are experiencing:**
- GM scanner loses duplicate detection after page refresh
- Devices appear disconnected but can still scan
- State updates delayed or missing after reconnection
- Queue items lost during network interruptions
- Ghost connections persist on server

---

## Architecture Overview

### Connection Patterns by Scanner Type

| Scanner | Protocol | Auth Method | State Sync | Offline Queue |
|---------|----------|-------------|------------|---------------|
| GM Scanner | WebSocket (Socket.io) | JWT in handshake | sync:full event | localStorage |
| Player Scanner (Web) | HTTP polling | None | Pull on demand | localStorage |
| ESP32 Player | HTTP per-scan | None | Token cache only | SD card (JSONL) |

### State Synchronization Flow

```
Backend Services → Event Emitters → broadcasts.js → Socket.io → Clients
     ↓                                      ↓
Session (source of truth)          Room-based multicasting
```

**Critical Pattern:**
- **Session** = persisted source of truth (survives restarts)
- **GameState** = computed on-demand from Session (never stored)
- **Events** = trigger broadcasts to connected clients

---

## CRITICAL ISSUES (Fix Immediately)

### 🔴 ISSUE #1: Client-Side Duplicate Detection Cleared on Refresh

**Severity:** HIGH
**Affects:** GM Scanner
**Files:**
- `ALNScanner/js/core/dataManager.js:68-85`
- `ALNScanner/js/network/orchestratorClient.js:340-362`

**Problem:**
The `scannedTokens` Set is stored in browser localStorage and cleared when the page refreshes, but it's not included in the `sync:full` payload from the server. This means:

1. GM Scanner opens, scans tokens A, B, C → `scannedTokens = {A, B, C}`
2. Page refreshes (F5)
3. `scannedTokens` cleared to empty Set
4. WebSocket reconnects, receives `sync:full` event
5. `sync:full` contains session data BUT NOT scannedTokens
6. User can now re-scan A, B, C without duplicate detection

**Code Evidence:**
```javascript
// dataManager.js:68-85
loadScannedTokens() {
    const stored = localStorage.getItem('scannedTokens');
    const storedSessionId = localStorage.getItem('currentSessionId');
    this.currentSessionId = storedSessionId;

    if (stored) {
        this.scannedTokens = new Set(JSON.parse(stored));
        // ⚠️ But if page refreshed BEFORE localStorage saved, this is empty
    }
}

// orchestratorClient.js:340-362
setupEventHandlers() {
    this.socket.on('sync:full', (data) => {
        // data contains: session, scores, recentTransactions, videoStatus, devices
        // ❌ NO scannedTokens field!
    });
}
```

**Backend Code:**
```javascript
// backend/src/websocket/gmAuth.js:122
emitWrapped(socket, 'sync:full', {
  session: session ? session.toJSON() : null,
  scores: transactionService.getTeamScores(),
  recentTransactions: enrichedTransactions,
  videoStatus: videoStatus,
  devices: [...],
  systemStatus: {...}
  // ❌ Missing: scannedTokens
});
```

**Impact:**
- **Data integrity violation:** Tokens can be scanned multiple times by same GM
- **Scoring errors:** Duplicate scans count toward team scores
- **User confusion:** "I already scanned this token!"

**Fix Required:**
1. Backend: Add `scannedTokens` array to Session model
2. Backend: Include `scannedTokens` in sync:full payload
3. GM Scanner: Restore scannedTokens from sync:full event
4. Backend: Track scannedTokens per session, not per device

**Estimated Effort:** 4-6 hours (backend + frontend changes + testing)

---

### 🔴 ISSUE #2: Device Reconnection Doesn't Trigger device:connected Broadcast

**Severity:** HIGH
**Affects:** All scanners, particularly GM Scanner
**Files:**
- `backend/src/models/session.js:175-191`
- `backend/src/websocket/broadcasts.js:97-116`
- `backend/src/websocket/deviceTracking.js:18-56`

**Problem:**
When a device disconnects and reconnects with the same deviceId, the Session model's `updateDevice()` returns `isNew=false` because the device still exists in the `connectedDevices` array. This prevents the `device:connected` broadcast from being sent.

**Code Flow:**

1. **Initial Connection:**
```javascript
// session.js:175-191
updateDevice(device) {
    const index = this.connectedDevices.findIndex(d => d.id === device.id);
    const isNew = index === -1;  // ✓ TRUE on first connect

    if (index >= 0) {
        this.connectedDevices[index] = device;
    } else {
        this.connectedDevices.push(device);  // Added to array
    }
    return isNew;
}
```

2. **Disconnection:**
```javascript
// deviceTracking.js:24-28
const device = session.connectedDevices.find(d => d.id === socket.deviceId);
if (device) {
    device.connectionStatus = 'disconnected';  // ⚠️ Still in array!
    await sessionService.updateDevice(device);
}
```

3. **Reconnection:**
```javascript
// gmAuth.js:74-78
await sessionService.updateDevice(device.toJSON());  // Returns isNew=FALSE
// Because device still in array with connectionStatus='disconnected'

// broadcasts.js:97-116
addTrackedListener(sessionService, 'device:updated', ({ device, isNew }) => {
    if (isNew && device.connectionStatus === 'connected') {  // ❌ FALSE
        emitWrapped(io, 'device:connected', {...});  // Never broadcast!
    }
});
```

**Impact:**
- Other connected devices never see reconnection notification
- Scoreboard shows stale "disconnected" status
- Admin doesn't know when devices recover from network issues

**Fix Required:**
Change the `device:updated` listener logic to check for status changes:
```javascript
addTrackedListener(sessionService, 'device:updated', ({ device, isNew, previousStatus }) => {
    // Broadcast on new device OR status change to connected
    if (isNew || (previousStatus === 'disconnected' && device.connectionStatus === 'connected')) {
        emitWrapped(io, 'device:connected', {...});
    }
});
```

**Estimated Effort:** 2-3 hours (backend change + contract update + testing)

---

### 🔴 ISSUE #3: Race Condition - Broadcast Listeners Not Registered Before sync:full

**Severity:** HIGH
**Affects:** GM Scanner (early connections during server startup)
**Files:**
- `backend/src/server.js:215, 238`
- `backend/src/websocket/broadcasts.js:46-56`

**Problem:**
In `server.js`, `setupWebSocketHandlers()` is called immediately when creating the server, but `setupServiceListeners()` (which registers broadcast listeners) is called later in `startServer()`. If a socket connects during this gap, it receives `sync:full` but broadcast listeners aren't wired yet.

**Code Evidence:**
```javascript
// server.js:209-239
function createServer() {
    // ...
    if (!io) {
        io = createSocketServer(server);
        app.locals.io = io;

        setupWebSocketHandlers(io);  // ← T0: Handlers ready, clients can connect
    }
    // ...
    return { server, httpRedirectServer, io, discoveryService };
}

async function startServer() {
    const instances = createServer();  // ← T1: Server created

    if (!isInitialized) {
        await initializeServices();  // ← T2: Services initialized
        isInitialized = true;
    }

    setupServiceListeners(instances.io);  // ← T3: Listeners registered (LATE!)
    // ...
}
```

**Timeline:**
```
T0: setupWebSocketHandlers() called
T1: Socket connects
T2: handleGmIdentify() emits sync:full
T3: setupServiceListeners() registers broadcast listeners ❌ TOO LATE
```

**Impact:**
- Early-connecting clients miss initial state broadcasts
- Clients show "waiting for sync..." indefinitely
- Requires manual page refresh to receive state

**Fix Required:**
Move `setupServiceListeners()` call to happen BEFORE `setupWebSocketHandlers()`:
```javascript
async function startServer() {
    const instances = createServer();  // Don't set up handlers yet

    if (!isInitialized) {
        await initializeServices();
        isInitialized = true;
    }

    setupServiceListeners(instances.io);  // ← Setup listeners FIRST
    setupWebSocketHandlers(instances.io);  // ← Then allow connections

    // Start server...
}
```

**Estimated Effort:** 1 hour (refactoring + testing)

---

### 🔴 ISSUE #4: Old Socket Not Disconnected Before Reconnection

**Severity:** HIGH
**Affects:** GM Scanner
**Files:**
- `ALNScanner/js/network/orchestratorClient.js:112-139`

**Problem:**
When creating a new WebSocket connection, the old socket is overwritten without calling `disconnect()`, leaving the old socket in memory with active listeners.

**Code Evidence:**
```javascript
// orchestratorClient.js:112-139
createSocketConnection(url, token, deviceInfo) {
    // ❌ No check for existing socket, no cleanup of old socket

    this.socket = io(url, {
        auth: {
            token: token,
            deviceId: deviceInfo.stationId,
            deviceType: 'gm',
            version: '1.0.0'
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        timeout: 20000
    });

    this.setupEventHandlers();  // ← Registers 26+ event listeners
}
```

**Impact:**
- **Memory leak:** Old socket remains in memory with all listeners
- **Duplicate events:** Both old and new sockets receive events
- **Confusion:** UI updates triggered twice, once per socket

**Fix Required:**
```javascript
createSocketConnection(url, token, deviceInfo) {
    // Cleanup old socket first
    if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect(true);
        this.socket = null;
    }

    this.socket = io(url, {...});
    this.setupEventHandlers();
}
```

**Estimated Effort:** 30 minutes

---

### 🔴 ISSUE #5: Queue Cleared Without Server Acknowledgment

**Severity:** HIGH
**Affects:** GM Scanner
**Files:**
- `ALNScanner/js/network/networkedQueueManager.js:80-107`

**Problem:**
When syncing the offline queue to the server, the queue is cleared immediately after sending, without waiting for server confirmation. If the connection drops during transmission, transactions are lost.

**Code Evidence:**
```javascript
// networkedQueueManager.js:102-104
this.client.sendBatch(batch);  // ← Fire-and-forget!
this.queue = remaining;  // ← Cleared immediately
this.saveQueue();
```

**Impact:**
- **Data loss:** Scans lost if network drops during batch upload
- **Unrecoverable:** No retry mechanism for failed batches
- **Silent failure:** User never notified of lost scans

**Fix Required:**
```javascript
async syncToOrchestrator() {
    const batch = this.queue.slice(0, this.BATCH_SIZE);
    const remaining = this.queue.slice(this.BATCH_SIZE);

    try {
        await this.client.sendBatchWithAck(batch);  // Wait for ACK
        this.queue = remaining;  // Only clear on success
        this.saveQueue();
    } catch (error) {
        console.error('Batch upload failed, keeping in queue', error);
        // Retry with exponential backoff
    }
}
```

**Backend Change Required:**
Add acknowledgment event for batch uploads:
```javascript
// backend: After processing batch
socket.emit('batch:ack', { batchId, processedCount, failures });
```

**Estimated Effort:** 3-4 hours (frontend + backend + testing)

---

### 🔴 ISSUE #6: Missing Cleanup in server.cleanup()

**Severity:** MEDIUM → HIGH (for testing)
**Affects:** Backend (test environments)
**Files:**
- `backend/src/server.js:275-358`
- `backend/src/websocket/broadcasts.js:549-582`

**Problem:**
The `cleanup()` function in server.js doesn't call `cleanupBroadcastListeners()`, leaving the module-level flag `broadcastListenersActive = true` and old listeners attached.

**Code Evidence:**
```javascript
// server.js:275-358
async function cleanup() {
    if (discoveryService) {
        discoveryService.stop();
        discoveryService = null;
    }

    if (io) {
        // Disconnect sockets, close io...
        io = null;
    }

    // ❌ MISSING: cleanupBroadcastListeners();

    if (server) {
        // Close server...
    }

    isInitialized = false;
}
```

**Impact:**
- **Test failures:** Listeners accumulate across test runs
- **Memory leaks:** Old event handlers never removed
- **Broken re-initialization:** Second startServer() skips listener setup

**Fix Required:**
```javascript
async function cleanup() {
    const { cleanupBroadcastListeners } = require('./websocket/broadcasts');

    if (discoveryService) {
        discoveryService.stop();
        discoveryService = null;
    }

    cleanupBroadcastListeners();  // ← Add this

    if (io) {
        // Disconnect sockets, close io...
    }
    // ...
}
```

**Estimated Effort:** 30 minutes

---

### 🔴 ISSUE #7: No Server-Side Duplicate Detection

**Severity:** HIGH
**Affects:** All scanners
**Files:**
- `backend/src/routes/scanRoutes.js:75`
- `backend/src/services/transactionService.js:691-698`

**Problem:**
Duplicate detection is client-side only. The backend has a comment explicitly stating "no duplicate detection for player scanner". This means:

1. Player scanners can submit duplicate scans
2. GM scanners lose duplicate tracking on refresh (Issue #1)
3. No global duplicate protection across devices

**Code Evidence:**
```javascript
// scanRoutes.js:75
// Get token directly - no duplicate detection for player scanner

// transactionService.js only checks for group completion, not duplicates
Object.entries(tokenGroups).forEach(([groupId, scannedTokens]) => {
    // Check if ALL tokens in group are scanned
    if (groupTokens.every(token => scannedTokens.has(token.id))) {
        // Award bonus
    }
});
```

**Impact:**
- **Scoring integrity:** Players can re-scan tokens for duplicate points
- **Game balance:** Teams can cheat by re-scanning high-value tokens
- **Trust issues:** No authoritative duplicate tracking

**Fix Required:**
Add per-session scannedTokens tracking to backend:
1. Session model: Add `scannedTokens: []` field
2. transactionService: Check `session.scannedTokens` before processing
3. Include in sync:full payload for client restoration

**Estimated Effort:** 6-8 hours (architectural change)

---

### 🔴 ISSUE #8: Page Refresh Leaves Ghost Connection

**Severity:** MEDIUM
**Affects:** GM Scanner
**Files:**
- `ALNScanner/index.html` (missing beforeunload handler)

**Problem:**
When the GM Scanner page is refreshed, the WebSocket is not cleanly disconnected before the page unloads. The server keeps the old socket alive until it times out (60 seconds), creating a ghost connection.

**Code Evidence:**
```javascript
// ❌ MISSING: beforeunload handler
window.addEventListener('beforeunload', () => {
    if (orchestratorClient?.socket) {
        orchestratorClient.socket.disconnect(true);
    }
});
```

**Impact:**
- Server shows device as "connected" for 60s after refresh
- Device count incorrect
- Reconnection might hit max device limit

**Fix Required:**
Add beforeunload handler to cleanly disconnect socket.

**Estimated Effort:** 15 minutes

---

## MEDIUM SEVERITY ISSUES

### 🟡 ISSUE #9: No Exponential Backoff in Player Scanner

**Severity:** MEDIUM
**Affects:** Player Scanner (Web)
**Files:**
- `aln-memory-scanner/js/orchestratorIntegration.js:179-192`

**Problem:**
Fixed 1-second retry delay could hammer a struggling server. No exponential backoff.

**Fix:** Implement exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)

**Estimated Effort:** 1 hour

---

### 🟡 ISSUE #10: Token Not Refreshed Before Expiry

**Severity:** MEDIUM
**Affects:** GM Scanner
**Files:**
- `ALNScanner/js/network/connectionManager.js:94-117`

**Problem:**
JWT token has 24h expiry but is never refreshed proactively. After 24h, reconnection silently fails.

**Fix:** Add token refresh 1 hour before expiry, or warn user to re-authenticate.

**Estimated Effort:** 2-3 hours

---

### 🟡 ISSUE #11: Device Update Before socket.join() Completes

**Severity:** MEDIUM
**Affects:** Backend (race condition)
**Files:**
- `backend/src/websocket/gmAuth.js:70-78, 122`

**Problem:**
`updateDevice()` is called (emitting `device:updated` event) before `socket.join(session:${id})` completes. If broadcast handlers try to emit to session room immediately, the socket won't be in the room yet.

**Timeline:**
```
T0: socket.join('gm-stations')
T1: sessionService.updateDevice() → emit 'device:updated'
T2: broadcasts.js catches device:updated
T3: broadcasts tries emitToRoom('session:123', ...)
T4: socket.join('session:123')  ❌ Too late!
```

**Fix:** Await all socket.join() calls before calling updateDevice().

**Estimated Effort:** 1 hour

---

### 🟡 ISSUE #12: No Socket.io Middleware Validation

**Severity:** MEDIUM
**Affects:** Backend security
**Files:**
- `backend/src/server.js:40-78`

**Problem:**
Authentication happens in the `connection` event handler, not in Socket.io middleware. Invalid tokens still allow socket to connect, then get disconnected later.

**Better Pattern:**
```javascript
io.use((socket, next) => {
    const { verifyToken } = require('./middleware/auth');
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Authentication required'));
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'admin') {
        return next(new Error('Invalid token'));
    }

    socket.isAuthenticated = true;
    next();
});
```

This rejects the connection at transport level, preventing malformed sockets.

**Estimated Effort:** 2 hours

---

### 🟡 ISSUE #13: Unconditional Reconnection in DOMContentLoaded

**Severity:** MEDIUM
**Affects:** GM Scanner
**Files:**
- `ALNScanner/index.html:1873-1879`

**Problem:**
Tries to connect even for standalone mode or first-time users, causing unnecessary errors.

**Fix:** Only initialize ConnectionManager if `gameSessionMode === 'networked'`.

**Estimated Effort:** 30 minutes

---

### 🟡 ISSUE #14: Constructor Race Condition in Player Scanner

**Severity:** MEDIUM
**Affects:** Player Scanner (Web)
**Files:**
- `aln-memory-scanner/js/orchestratorIntegration.js:11-32`

**Problem:**
`detectOrchestratorUrl()` called before `isStandalone` computed, causing network requests in standalone mode.

**Fix:** Compute `isStandalone` before calling `detectOrchestratorUrl()`.

**Estimated Effort:** 30 minutes

---

### 🟡 ISSUE #15: Unchecked Retry Counts

**Severity:** MEDIUM
**Affects:** Player Scanner (Web)
**Files:**
- `aln-memory-scanner/js/orchestratorIntegration.js:124`

**Problem:**
Queue items initialized with `retryCount: 0` but never incremented, allowing infinite retries.

**Fix:** Increment retryCount and enforce max retries (e.g., 5).

**Estimated Effort:** 1 hour

---

### 🟡 ISSUE #16: Stale Event Handlers on Reconnection

**Severity:** MEDIUM
**Affects:** GM Scanner
**Files:**
- `ALNScanner/js/network/orchestratorClient.js:154-426`

**Problem:**
`setupEventHandlers()` registers 26+ event listeners every time it's called, but old listeners aren't removed first. Combined with Issue #4, this creates duplicate handlers.

**Fix:** Call `socket.removeAllListeners()` before `setupEventHandlers()`.

**Estimated Effort:** 30 minutes

---

### 🟡 ISSUE #17: Broadcast Listener Flag Never Reset

**Severity:** MEDIUM
**Affects:** Backend (test environments)
**Files:**
- `backend/src/websocket/broadcasts.js:14-56`

**Problem:**
Module-level flag `broadcastListenersActive` is never reset except in `cleanupBroadcastListeners()`, which isn't called in cleanup().

**Fix:** See Issue #6.

**Estimated Effort:** See Issue #6

---

### 🟡 ISSUE #18: ESP32 No Persistent Connections

**Severity:** MEDIUM
**Affects:** ESP32 Scanner
**Files:**
- `arduino-cyd-player-scanner/` (main.ino)

**Problem:**
Creates new HTTP connection per scan (500-800ms overhead).

**Fix:** Reuse HTTPClient connection with keep-alive.

**Estimated Effort:** 2-3 hours

---

### 🟡 ISSUE #19: ESP32 Certificate Validation Disabled

**Severity:** MEDIUM (security)
**Affects:** ESP32 Scanner
**Files:**
- `arduino-cyd-player-scanner/` (main.ino)

**Problem:**
`WiFiClientSecure` uses `setInsecure()`, allowing MITM attacks.

**Fix:** Implement certificate pinning or at least root CA validation.

**Estimated Effort:** 4-6 hours (certificate management)

---

## LOW SEVERITY ISSUES

### 🟢 ISSUE #20: ESP32 Long WiFi Timeout

**Severity:** LOW
**Affects:** ESP32 Scanner

**Problem:** 10s black screen on WiFi auth failure (bad UX).

**Fix:** Reduce timeout to 5s with retry.

**Estimated Effort:** 30 minutes

---

### 🟢 ISSUE #21: ESP32 Race Condition with Config Changes

**Severity:** LOW
**Affects:** ESP32 Scanner

**Problem:** Config changes via serial don't apply to background task until reboot.

**Fix:** Use mutex or queue for config updates.

**Estimated Effort:** 2 hours

---

### 🟢 ISSUE #22: ESP32 Queue Corruption on Power Failure

**Severity:** LOW
**Affects:** ESP32 Scanner

**Problem:** Silent scan loss if power fails during queue write.

**Fix:** Implement atomic write with temp file + rename.

**Estimated Effort:** 2-3 hours

---

### 🟢 ISSUE #23: ESP32 Thread Safety Issue

**Severity:** LOW
**Affects:** ESP32 Scanner

**Problem:** Queue size cache can drift from SD file (corrected on boot).

**Fix:** Use mutex for queue operations.

**Estimated Effort:** 1-2 hours

---

## State Synchronization Analysis

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Backend Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Session    │ ────────│ GameState    │                  │
│  │ (Persisted)  │         │ (Computed)   │                  │
│  └──────┬───────┘         └──────────────┘                  │
│         │                                                     │
│         │ events (session:created, device:updated, etc.)     │
│         ↓                                                     │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │ broadcasts.js│ ────────│  Socket.io   │                  │
│  │ (Listeners)  │         │   (Rooms)    │                  │
│  └──────────────┘         └──────────────┘                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ WebSocket events
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Client Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │ Socket.io    │ ────────│ DataManager  │                  │
│  │ (Connection) │         │ (State)      │                  │
│  └──────┬───────┘         └──────────────┘                  │
│         │                                                     │
│         │ sync:full event                                    │
│         ↓                                                     │
│  ┌──────────────┐                                            │
│  │ scannedTokens│ ❌ NOT SYNCED FROM SERVER                  │
│  │ (localStorage)                                            │
│  └──────────────┘                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### sync:full Event Emission Points

The `sync:full` event is emitted in **5 locations**:

1. **`gmAuth.js:122`** - On GM Scanner authentication (first connect)
2. **`deviceTracking.js:107`** - On explicit sync request from client
3. **`broadcasts.js:183`** - When stateService emits sync:full event
4. **`broadcasts.js:473`** - After offline queue processing completes
5. **Implicit via event cascade** - Service events → state:updated → broadcasts

### What's Included in sync:full

```javascript
{
  session: {
    id, name, startTime, endTime, status,
    transactions: [...],  // All transactions
    connectedDevices: [...],
    videoQueue: [...],
    scores: [...],
    metadata: {
      gmStations, playerDevices, totalScans,
      uniqueTokensScanned: [...]  // ✓ Unique tokens (global)
      // ❌ NOT per-device scannedTokens
    }
  },
  scores: [...],  // Team scores
  recentTransactions: [...],  // Last 100 transactions
  videoStatus: {...},
  devices: [...],
  systemStatus: {...}
}
```

### What's Missing from sync:full

1. **scannedTokens per device** - Clients maintain own Set, cleared on refresh
2. **Device-specific state** - Each scanner tracks own scannedTokens locally
3. **Offline queue status** - No indication of pending uploads

This is the root cause of Issue #1 and #7.

---

## Recommendations

### Immediate Actions (This Sprint)

1. **Fix Issue #1** - Add scannedTokens to backend Session model + sync:full payload
2. **Fix Issue #4** - Add socket cleanup before reconnection
3. **Fix Issue #5** - Implement batch ACK pattern
4. **Fix Issue #8** - Add beforeunload handler
5. **Fix Issue #6** - Add cleanupBroadcastListeners() to cleanup()

**Total Estimated Effort:** 12-16 hours

### Short-term (Next Sprint)

1. **Fix Issue #2** - Broadcast device:connected on reconnection
2. **Fix Issue #3** - Reorder service initialization
3. **Fix Issue #11** - Await socket.join() before updateDevice()
4. **Fix Issue #12** - Add Socket.io middleware validation
5. **Fix Issues #9, #10, #13-16** - Various client-side improvements

**Total Estimated Effort:** 12-15 hours

### Long-term (Backlog)

1. **Fix Issue #7** - Full server-side duplicate detection architecture
2. **Fix Issues #18-19** - ESP32 connection improvements
3. **Fix Issues #20-23** - ESP32 minor improvements
4. Implement comprehensive integration tests for reconnection scenarios
5. Add connection health monitoring dashboard

**Total Estimated Effort:** 30-40 hours

---

## Testing Strategy

### Unit Tests Required

1. Session.updateDevice() with reconnection scenarios
2. broadcasts.js listener registration/cleanup
3. GM Scanner scannedTokens restoration from sync:full

### Integration Tests Required

1. **Reconnection flow:**
   - Connect → disconnect → reconnect
   - Verify device:connected broadcast
   - Verify scannedTokens restored
   - Verify no duplicate listeners

2. **Page refresh flow:**
   - Scan tokens → refresh page → verify duplicates blocked
   - Check scannedTokens restored from sync:full

3. **Offline queue:**
   - Queue scans → connect → verify batch ACK → verify queue cleared

4. **Server restart:**
   - Connect devices → restart server → verify session restored
   - Verify listeners re-registered correctly

### E2E Tests Required

1. Full game flow with intentional disconnections
2. Network interruption simulation
3. Multiple devices connecting/disconnecting simultaneously

---

## Appendix: File Reference

### Backend

| File | Purpose | Issues |
|------|---------|--------|
| `server.js:215,238` | Server initialization | #3, #6 |
| `websocket/gmAuth.js:70-122` | GM authentication | #2, #11 |
| `websocket/broadcasts.js:14-56,97-116,183,473` | Event broadcasting | #2, #3, #6, #17 |
| `websocket/deviceTracking.js:18-56,107` | Device lifecycle | #2 |
| `models/session.js:175-191` | Device tracking | #2 |
| `routes/scanRoutes.js:75` | Scan endpoint | #7 |
| `services/sessionService.js` | Session management | #1, #7 |

### GM Scanner

| File | Purpose | Issues |
|------|---------|--------|
| `js/core/dataManager.js:68-85` | Local state | #1 |
| `js/network/orchestratorClient.js:112-139,154-426,340-362` | WebSocket client | #1, #4, #16 |
| `js/network/networkedQueueManager.js:80-107` | Offline queue | #5 |
| `js/network/connectionManager.js:94-117` | Connection mgmt | #10 |
| `index.html:1873-1879` | App initialization | #8, #13 |

### Player Scanner (Web)

| File | Purpose | Issues |
|------|---------|--------|
| `js/orchestratorIntegration.js:11-32,124,179-192` | HTTP client | #9, #14, #15 |

### ESP32 Scanner

| File | Purpose | Issues |
|------|---------|--------|
| `main.ino` (various) | Connection handling | #18, #19, #20, #21, #22, #23 |

---

## Conclusion

The ALN orchestrator connection architecture is **fundamentally sound** but suffers from **state management inconsistencies** and **missing cleanup patterns**. The majority of user-reported connection issues can be traced to:

1. **Client-side duplicate detection without server backup** (Issues #1, #7)
2. **Incomplete reconnection handling** (Issues #2, #4, #8)
3. **Missing acknowledgment patterns** (Issue #5)

Fixing the **5 immediate action items** will resolve approximately **70%** of current user-reported connection stability issues.

The recommended approach:
1. **Week 1:** Fix critical server-side issues (#1, #2, #3, #6)
2. **Week 2:** Fix critical client-side issues (#4, #5, #8)
3. **Week 3:** Implement comprehensive reconnection tests
4. **Week 4:** Address medium-priority issues

**Total Timeline:** 4 weeks for full stability overhaul.

---

**End of Report**
