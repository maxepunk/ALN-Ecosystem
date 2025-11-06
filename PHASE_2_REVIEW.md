# Phase 2: Connection Stability - Complete Review & Implementation Plan

**Date:** 2025-11-05
**Status:** Ready to Begin
**Dependencies:** Phase 1 Complete ✅
**Estimated Time:** 18 hours

---

## 📊 Phase 2 Overview

Phase 2 builds on Phase 1's solid foundation (data integrity & lifecycle) to create **robust, stable connections** that handle disconnections, reconnections, and cleanup gracefully.

### Phase 2 Tasks

| Task | Description | Time | Dependencies |
|------|-------------|------|--------------|
| **P1.1** | Reconnection Broadcast | 7h | P0.1, P0.2 |
| **P1.2** | Socket Join Order | 4h | P0.3 |
| **P1.3** | Socket.io Middleware | 3h | P0.3, P1.2 |
| **P1.4** | Frontend Socket Cleanup | 4h | P0.4, P1.3 |
| **TOTAL** | | **18h** | |

---

## 🔗 How Phase 2 Builds on Phase 1

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 1 COMPLETE ✅                       │
├─────────────────────────────────────────────────────────────┤
│ P0.1: Duplicate Detection     → scannedTokensByDevice       │
│ P0.2: Batch ACK               → Offline queue resilience    │
│ P0.3: Init Order              → State machine, listeners    │
│ P0.4: Cleanup                 → Memory leak prevention      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                   PHASE 2: BUILD ON IT                       │
├─────────────────────────────────────────────────────────────┤
│ P1.1: Uses P0.1 data to restore state on reconnect          │
│ P1.2: Uses P0.3 ordering for room joins                     │
│ P1.3: Uses P0.3 state machine for middleware placement      │
│ P1.4: Mirrors P0.4 cleanup pattern on frontend              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 P1.1: Reconnection Broadcast (7 hours)

### Problem
Currently when a GM Scanner reconnects after network interruption:
- ❌ Local state is stale (doesn't know what was scanned)
- ❌ No sync of `scannedTokensByDevice` from server
- ❌ Could allow duplicate scans (client thinks token not scanned)
- ❌ Could reject valid scans (client thinks token was scanned)

### Solution
Send complete state on reconnection, including per-device scanned tokens.

### Implementation

**Backend: Enhanced sync:full on reconnection**

```javascript
// backend/src/websocket/gmAuth.js
async function handleGmIdentify(socket, data, io) {
  const { deviceId, version, token } = data;

  // ... existing auth validation

  // Get current session
  const session = sessionService.getCurrentSession();

  // Build complete state
  const state = stateService.getCurrentState();

  // PHASE 2.1: Include scannedTokensByDevice for THIS device
  const deviceScannedTokens = session
    ? session.getDeviceScannedTokens(deviceId)
    : [];

  // Send sync:full with device-specific data
  emitWrapped(socket, 'sync:full', {
    ...state,
    // PHASE 2.1: Add device-specific scanned tokens
    deviceScannedTokens: Array.from(deviceScannedTokens),
    reconnection: socket.recovered || false
  });

  logger.info('GM reconnected, state synchronized', {
    deviceId,
    scannedCount: deviceScannedTokens.size,
    reconnection: socket.recovered
  });
}
```

**Frontend: Restore scanned tokens on sync:full**

```javascript
// ALNScanner/js/network/orchestratorClient.js
setupSocketEventHandlers() {
  this.socket.on('sync:full', (eventData) => {
    const data = eventData.data;

    // ... existing state updates

    // PHASE 2.1: Restore scanned tokens from server
    if (data.deviceScannedTokens && Array.isArray(data.deviceScannedTokens)) {
      console.log('Restoring scanned tokens from server', {
        count: data.deviceScannedTokens.length,
        reconnection: data.reconnection
      });

      // Replace local scanned tokens with server state (source of truth)
      window.dataManager.restoreScannedTokens(data.deviceScannedTokens);
    }

    // Show reconnection notification
    if (data.reconnection) {
      window.showNotification('info', 'Reconnected - state synchronized');
    }
  });
}
```

```javascript
// ALNScanner/js/data/dataManager.js
class DataManager {
  // ... existing methods

  // PHASE 2.1: Restore scanned tokens from server
  restoreScannedTokens(tokenIds) {
    if (!Array.isArray(tokenIds)) {
      console.error('Invalid tokenIds for restoration', tokenIds);
      return;
    }

    // Clear existing
    this.scannedTokens.clear();

    // Add server tokens
    tokenIds.forEach(tokenId => {
      this.scannedTokens.add(tokenId);
    });

    // Persist to localStorage
    this.saveToLocalStorage();

    console.log('Scanned tokens restored from server', {
      count: this.scannedTokens.size
    });
  }
}
```

### Tests

**Unit Tests:**
```javascript
// backend/tests/unit/websocket/gmAuth.test.js
describe('handleGmIdentify - Reconnection (Phase 2.1)', () => {
  it('should include deviceScannedTokens in sync:full', async () => {
    // Setup session with scanned tokens
    await session.addDeviceScannedToken('GM_001', 'kaa001');
    await session.addDeviceScannedToken('GM_001', 'rat001');

    await handleGmIdentify(mockSocket, { deviceId: 'GM_001' }, mockIo);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'sync:full',
      expect.objectContaining({
        data: expect.objectContaining({
          deviceScannedTokens: expect.arrayContaining(['kaa001', 'rat001'])
        })
      })
    );
  });
});
```

**Integration Tests:**
```javascript
// backend/tests/integration/reconnection.test.js
it('should restore scanned tokens after reconnection', async () => {
  // Scan tokens
  await transactionService.processTransaction({
    tokenId: 'kaa001',
    deviceId: 'GM_001',
    teamId: '001'
  });

  // Disconnect
  gmSocket.disconnect();

  // Reconnect
  gmSocket = await connectAndIdentify(url, 'gm', 'GM_001');

  // Wait for sync:full
  const syncEvent = await waitForEvent(gmSocket, 'sync:full');

  // Verify scanned tokens included
  expect(syncEvent.data.deviceScannedTokens).toContain('kaa001');
});
```

### Validation Checkpoint
```bash
# Backend tests
npm run test:unit -- gmAuth-reconnection
npm run test:integration -- reconnection

# Manual test
# 1. Open GM Scanner, scan 3 tokens
# 2. Turn off WiFi for 10 seconds
# 3. Turn on WiFi (automatic reconnect)
# 4. Verify: Scanned tokens list shows all 3 tokens
# 5. Try to scan one of the 3 again
# 6. Expected: "Already scanned" message (duplicate detection works)
```

---

## 🎯 P1.2: Socket Join Order (4 hours)

### Problem
Currently sockets join rooms in arbitrary order during connection:
- ❌ Race condition: room join vs handler setup
- ❌ Early broadcasts might miss specific rooms
- ❌ Team-specific events not delivered reliably

### Solution
Ensure rooms joined in correct order AFTER authentication.

### Implementation

**Backend: Structured room joining**

```javascript
// backend/src/websocket/gmAuth.js
async function handleGmIdentify(socket, data, io) {
  const { deviceId, version, token } = data;

  // ... existing auth validation

  // PHASE 2.2: Join rooms in correct order
  // Order matters: device room → type room → team rooms

  // 1. Device-specific room (for targeted messages)
  socket.join(`device:${deviceId}`);
  logger.debug('Socket joined device room', { deviceId, room: `device:${deviceId}` });

  // 2. Device type room (for broadcast to all GMs)
  socket.join('gm');
  logger.debug('Socket joined type room', { deviceId, room: 'gm' });

  // 3. Team rooms (if session active)
  const session = sessionService.getCurrentSession();
  if (session && session.teams) {
    session.teams.forEach(teamId => {
      socket.join(`team:${teamId}`);
      logger.debug('Socket joined team room', { deviceId, room: `team:${teamId}` });
    });
  }

  // Store rooms for tracking
  socket.rooms = Array.from(socket.rooms);

  // ... rest of sync:full logic
}
```

**Backend: Room-based broadcasts**

```javascript
// backend/src/websocket/broadcasts.js
function emitToTeam(io, teamId, event, data) {
  // PHASE 2.2: Use team rooms for targeted broadcasts
  const room = `team:${teamId}`;
  emitWrapped(io.to(room), event, data);

  logger.debug('Broadcast to team room', { room, event });
}

function emitToAllGMs(io, event, data) {
  // PHASE 2.2: Use 'gm' room instead of broadcasting to all
  emitWrapped(io.to('gm'), event, data);

  logger.debug('Broadcast to all GMs', { event });
}
```

### Tests

**Unit Tests:**
```javascript
// backend/tests/unit/websocket/gmAuth.test.js
describe('Socket Room Joining (Phase 2.2)', () => {
  it('should join rooms in correct order', async () => {
    const joinSpy = jest.spyOn(mockSocket, 'join');

    await handleGmIdentify(mockSocket, { deviceId: 'GM_001' }, mockIo);

    // Verify order
    expect(joinSpy.mock.calls[0][0]).toBe('device:GM_001');  // Device first
    expect(joinSpy.mock.calls[1][0]).toBe('gm');             // Type second
    expect(joinSpy.mock.calls[2][0]).toMatch(/^team:/);      // Teams last
  });

  it('should join all team rooms when session active', async () => {
    await sessionService.createSession({ teams: ['001', '002', '003'] });

    await handleGmIdentify(mockSocket, { deviceId: 'GM_001' }, mockIo);

    expect(mockSocket.join).toHaveBeenCalledWith('team:001');
    expect(mockSocket.join).toHaveBeenCalledWith('team:002');
    expect(mockSocket.join).toHaveBeenCalledWith('team:003');
  });
});
```

**Integration Tests:**
```javascript
// backend/tests/integration/room-broadcasts.test.js
it('should receive team-specific broadcasts only', async () => {
  await sessionService.createSession({ teams: ['001', '002'] });

  const gm1 = await connectAndIdentify(url, 'gm', 'GM_001');
  const gm2 = await connectAndIdentify(url, 'gm', 'GM_002');

  // Listen for team broadcasts
  const team001Promise = waitForEvent(gm1, 'team:message');

  // Emit to team 001 only
  testContext.io.to('team:001').emit('team:message', { msg: 'Team 001 only' });

  // GM 1 receives (all GMs join all team rooms)
  const event = await team001Promise;
  expect(event.data.msg).toBe('Team 001 only');
});
```

### Validation Checkpoint
```bash
# Tests
npm run test:unit -- room-joining
npm run test:integration -- room-broadcasts

# Manual test
# 1. Connect 2 GMs
# 2. Check server logs for room joins
# 3. Expected order: device → gm → team:001 → team:002
```

---

## 🎯 P1.3: Socket.io Middleware (3 hours)

### Problem
Currently auth happens inside connection handler:
- ❌ Unauthenticated sockets briefly connected
- ❌ Auth logic mixed with business logic
- ❌ Cannot reject connection before handler runs

### Solution
Move auth to Socket.io middleware (validates at handshake).

### Implementation (From Plan)

**Backend: Add middleware**

```javascript
// backend/src/websocket/socketServer.js
function createSocketServer(server) {
  const io = new Server(server, {
    cors: { /* ... */ },
    transports: ['websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // PHASE 2.3: Authentication middleware (validates BEFORE connection)
  io.use((socket, next) => {
    const { verifyToken } = require('../middleware/auth');
    const token = socket.handshake.auth?.token;

    if (!token) {
      const error = new Error('Authentication token required');
      error.data = { code: 'NO_TOKEN' };
      return next(error);
    }

    try {
      const decoded = verifyToken(token);

      if (!decoded || decoded.role !== 'admin') {
        const error = new Error('Invalid or unauthorized token');
        error.data = { code: 'INVALID_TOKEN' };
        return next(error);
      }

      // Attach to socket (available in connection handler)
      socket.isAuthenticated = true;
      socket.deviceId = socket.handshake.auth.deviceId;
      socket.deviceType = socket.handshake.auth.deviceType || 'gm';
      socket.version = socket.handshake.auth.version || '1.0.0';

      next(); // Allow connection

    } catch (error) {
      error.data = { code: 'AUTH_ERROR' };
      next(error); // Reject connection
    }
  });

  return io;
}
```

**Backend: Simplify connection handler**

```javascript
// backend/src/server.js - setupWebSocketHandlers()
function setupWebSocketHandlers(ioInstance) {
  // ... state validation

  ioInstance.on('connection', async (socket) => {
    // PHASE 2.3: Auth already done in middleware!
    // socket.isAuthenticated, socket.deviceId, etc. already set

    logger.info('Authenticated WebSocket connection', {
      deviceId: socket.deviceId,
      deviceType: socket.deviceType,
      socketId: socket.id
    });

    // PHASE 2.2: Join rooms (auth already validated)
    await handleGmIdentify(socket, {
      deviceId: socket.deviceId,
      version: socket.version
    }, ioInstance);

    // ... rest of handlers (no auth checks needed)
  });
}
```

### Tests

**Unit Tests:**
```javascript
// backend/tests/unit/websocket/middleware.test.js
describe('Socket.io Middleware Auth (Phase 2.3)', () => {
  it('should reject connection with no token', (done) => {
    const client = io('http://localhost:3000', {
      auth: {} // No token
    });

    client.on('connect_error', (err) => {
      expect(err.message).toContain('token required');
      expect(err.data.code).toBe('NO_TOKEN');
      client.disconnect();
      done();
    });
  });

  it('should reject connection with invalid token', (done) => {
    const client = io('http://localhost:3000', {
      auth: { token: 'invalid-token' }
    });

    client.on('connect_error', (err) => {
      expect(err.message).toContain('Invalid');
      expect(err.data.code).toBe('INVALID_TOKEN');
      client.disconnect();
      done();
    });
  });

  it('should accept connection with valid token', (done) => {
    const validToken = generateTestToken({ role: 'admin' });

    const client = io('http://localhost:3000', {
      auth: { token: validToken, deviceId: 'GM_TEST' }
    });

    client.on('connect', () => {
      expect(client.connected).toBe(true);
      client.disconnect();
      done();
    });
  });
});
```

### Validation Checkpoint
```bash
# Tests
npm run test:unit -- middleware

# Manual test
node -e "
const io = require('socket.io-client');

// No token - should fail
const s1 = io('https://localhost:3000', { rejectUnauthorized: false });
s1.on('connect_error', (err) => console.log('No token:', err.message));

// Valid token - should succeed
const s2 = io('https://localhost:3000', {
  rejectUnauthorized: false,
  auth: { token: 'YOUR_JWT_TOKEN', deviceId: 'TEST' }
});
s2.on('connect', () => console.log('Valid token: Connected'));
"
```

---

## 🎯 P1.4: Frontend Socket Cleanup (4 hours)

### Problem
GM Scanner doesn't clean up sockets on page refresh:
- ❌ Multiple sockets per GM (ghost connections)
- ❌ Old listeners not removed
- ❌ Memory leaks in browser

### Solution (From Plan)
Always clean up old socket before creating new one.

### Implementation

**Frontend: Cleanup before creating**

```javascript
// ALNScanner/js/network/orchestratorClient.js
createSocketConnection() {
  // PHASE 2.4: ALWAYS cleanup old socket first
  if (this.socket) {
    console.log('Cleaning up old socket before creating new one');
    this.socket.removeAllListeners();
    this.socket.disconnect(true);
    this.socket = null;
  }

  // Create new socket
  this.socket = io(this.config.url, {
    transports: this.config.transports,
    reconnection: this.token ? this.config.reconnection : false,
    reconnectionDelay: this.config.reconnectionDelay,
    reconnectionAttempts: this.config.reconnectionAttempts,
    timeout: this.config.connectionTimeout,
    auth: {
      token: this.token,
      deviceId: this.config.deviceId,
      deviceType: 'gm',
      version: '2.1.0'  // Phase 2 version
    }
  });

  this.setupSocketEventHandlers();
}

setupSocketEventHandlers() {
  // PHASE 2.4: Remove all existing handlers first
  if (this.socket) {
    this.socket.removeAllListeners();
  }

  // Register fresh handlers
  this.socket.on('connect', () => { /* ... */ });
  this.socket.on('disconnect', () => { /* ... */ });
  this.socket.on('sync:full', (data) => { /* ... */ });
  // ... 23 more handlers
}

cleanup() {
  // Stop timers
  if (this.rateLimitTimer) {
    clearTimeout(this.rateLimitTimer);
    this.rateLimitTimer = null;
  }

  // PHASE 2.4: Clean socket (mirrors P0.4 backend cleanup)
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

**Frontend: Cleanup on page unload**

```javascript
// ALNScanner/index.html
<script>
window.addEventListener('beforeunload', () => {
  // PHASE 2.4: Disconnect on page unload
  if (window.connectionManager?.orchestratorClient?.socket) {
    console.log('Page unloading - disconnecting socket');
    window.connectionManager.orchestratorClient.disconnect();
  }
});
</script>
```

### Tests

**E2E Tests:**
```javascript
// backend/tests/e2e/socket-cleanup.spec.js
test('should not leak sockets on page refresh', async ({ page }) => {
  // Navigate to GM Scanner
  await page.goto('https://localhost:3000/gm-scanner/');

  // Wait for connection
  await page.waitForSelector('.connection-status.connected');

  // Check backend socket count
  const response1 = await page.request.get('https://localhost:3000/api/admin/sockets');
  const data1 = await response1.json();
  expect(data1.count).toBe(1);

  // Refresh page 5 times
  for (let i = 0; i < 5; i++) {
    await page.reload();
    await page.waitForSelector('.connection-status.connected');
  }

  // Check socket count again
  const response2 = await page.request.get('https://localhost:3000/api/admin/sockets');
  const data2 = await response2.json();

  // CRITICAL: Should still be 1, not 6!
  expect(data2.count).toBe(1);
});

test('should disconnect immediately on tab close', async ({ page, context }) => {
  await page.goto('https://localhost:3000/gm-scanner/');
  await page.waitForSelector('.connection-status.connected');

  // Close page
  await page.close();

  // Wait 2 seconds
  await new Promise(r => setTimeout(r, 2000));

  // Create new page to check sockets
  const newPage = await context.newPage();
  const response = await newPage.request.get('https://localhost:3000/api/admin/sockets');
  const data = await response.json();

  // Socket should be disconnected
  expect(data.count).toBe(0);
});
```

### Validation Checkpoint
```bash
# E2E tests
npx playwright test socket-cleanup

# Manual test
# 1. Open GM Scanner
# 2. Check backend: curl -k https://localhost:3000/api/admin/sockets
#    Expected: { count: 1 }
# 3. Refresh page 5 times
# 4. Check backend: curl -k https://localhost:3000/api/admin/sockets
#    Expected: { count: 1 } (not 5!)
# 5. Close tab
# 6. Wait 2 seconds
# 7. Check backend: curl -k https://localhost:3000/api/admin/sockets
#    Expected: { count: 0 }
```

---

## 🎯 Phase 2 Implementation Order

### Recommended Sequence

**1. P1.3 First (Socket.io Middleware)** ⭐ START HERE
- **Why first:** Foundation for P1.1 and P1.2
- **Dependencies:** Only needs P0.3 (state machine)
- **Risk:** Low - well-defined, backend only
- **Time:** 3 hours

**2. P1.2 Second (Socket Join Order)**
- **Why second:** Needs P1.3 middleware auth
- **Dependencies:** P1.3 (auth before rooms)
- **Risk:** Low - clear ordering logic
- **Time:** 4 hours

**3. P1.1 Third (Reconnection Broadcast)**
- **Why third:** Uses P1.2 rooms, P1.3 auth
- **Dependencies:** P0.1 (duplicate data), P1.2 (rooms), P1.3 (auth)
- **Risk:** Medium - frontend + backend
- **Time:** 7 hours

**4. P1.4 Last (Frontend Cleanup)**
- **Why last:** Mirrors P0.4, touches frontend only
- **Dependencies:** P1.3 (clean auth flow)
- **Risk:** Low - similar to P0.4
- **Time:** 4 hours

---

## 📋 Phase 2 TDD Checklist

For each task, follow our proven TDD approach:

### RED Phase (Write Failing Tests)
- [ ] Unit tests that define expected behavior
- [ ] Integration tests for full flow
- [ ] E2E tests for user-visible behavior (if applicable)
- [ ] Run tests - verify they FAIL

### GREEN Phase (Make Tests Pass)
- [ ] Implement minimal code to pass tests
- [ ] Run tests - verify they PASS
- [ ] No additional features beyond tests

### REFACTOR Phase (Clean Up)
- [ ] Document implementation
- [ ] Check for edge cases
- [ ] Run full test suite - no regressions
- [ ] Commit with clear message

---

## ✅ Phase 2 Success Criteria

**By the end of Phase 2, we should have:**
- ✅ Socket.io middleware auth (no unauth connections)
- ✅ Correct room joining order (device → type → teams)
- ✅ State restoration on reconnect (scannedTokens synced)
- ✅ Clean socket lifecycle on frontend (no ghost connections)
- ✅ All tests passing (no regressions from Phase 1)
- ✅ 850+ passing tests (Phase 1: 847 + new Phase 2 tests)

**Quality metrics:**
- No auth bypass vulnerabilities
- No race conditions in room joins
- No memory leaks (browser or server)
- Reconnections seamless for users

---

## 🚀 Ready to Start Phase 2!

**Current Status:**
- ✅ Phase 1 complete (847 passing tests)
- ✅ Foundation solid (data integrity, lifecycle)
- ✅ TDD process proven and working
- ✅ Clear path forward

**Recommended Start:** P1.3 (Socket.io Middleware)
- Clean separation of concerns
- Foundation for rest of Phase 2
- Well-defined in implementation plan
- 3 hours estimated

**Ready to proceed with P1.3?**

