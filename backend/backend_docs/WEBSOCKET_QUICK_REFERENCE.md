# WebSocket Event Flows - Quick Reference Guide

## Event Types Summary

### Server-to-Client Events (Broadcasts)

| Event | Room | Trigger | Key Payload |
|-------|------|---------|------------|
| `sync:full` | Direct | Connection, offline resync, admin commands | Complete game state |
| `device:connected` | Global | GM handshake completes | deviceId, type, IP, time |
| `device:disconnected` | Global | Socket closes | deviceId, reason (manual/timeout/error) |
| `session:update` | Global | Session create/pause/resume/end | id, name, status, teams |
| `transaction:result` | Direct | Transaction processing complete | status, transactionId, points, message |
| `transaction:new` | gm-stations + session | Transaction added to session | transaction, teamScore, groupBonusInfo |
| `score:updated` | gm-stations | **DEPRECATED** - Use `transaction:new.teamScore` | teamId, scores, bonuses, adjustments |
| `video:status` | gm-stations | Video playback state change | status, queueLength, progress |
| `group:completed` | gm-stations | Token group bonus earned | teamId, group, bonusPoints |
| `offline:queue:processed` | gm-stations | Offline batch processed | queueSize, results array |
| `gm:command:ack` | Direct | Admin command executed | action, success, message |
| `error` | Direct | Any error condition | code, message, details |

### Client-to-Server Events (Commands)

| Event | Handler | Key Fields | Response |
|-------|---------|-----------|----------|
| `transaction:submit` | handleTransactionSubmit | tokenId, teamId, deviceId, mode | transaction:result |
| `gm:command` | handleGmCommand | action (11 types), payload | gm:command:ack + side effects |
| `sync:request` | handleSyncRequest | (empty) | sync:full |
| `state:request` | handleStateRequest | (empty) | state:sync |
| `heartbeat` | handleHeartbeat | stationId | heartbeat:ack |

---

## Authentication Flow Checklist

### Step 1: HTTP Authentication
```bash
POST /api/admin/auth
{ "password": "admin-secret" }
Response: { "token": "eyJh...", "expiresIn": 86400 }
```

### Step 2: WebSocket Connection
```javascript
io.connect('http://orchestrator:3000', {
  auth: {
    token: "eyJh...",           // From Step 1
    deviceId: "GM_Station_1",   // Required
    deviceType: "gm",           // Required: "gm" or "admin"
    version: "1.0.0"            // Optional
  }
})
```

### Step 3: Auto-Identification
- Server validates JWT in middleware
- Server calls handleGmIdentify()
- Socket joins 'gm-stations' room
- Server sends sync:full event

### Step 4: Verify Connection
```javascript
socket.on('sync:full', (event) => {
  console.log('Connected! Initial state:', event.data.session?.id);
});
```

---

## Critical Event Sequences

### Transaction Submission
```
Client submits: transaction:submit (tokenId, teamId, deviceId, mode)
                ↓
Server returns: transaction:result (to submitter only)
                ↓
Server broadcasts: transaction:new (to all GMs in session)
                  → Contains: {transaction, teamScore, groupBonusInfo}
                  → teamScore: Updated team total after this transaction
                  → groupBonusInfo: {groupName, multiplier, bonusAmount} if group completed
                ↓
(Optional) Server broadcasts: video:status (if token has video)
```

**Note:** `score:updated` is deprecated. Extract score from `transaction:new.teamScore`.

### Session Creation
```
Client sends: gm:command (action: "session:create", payload: {name, teams})
              ↓
Server broadcasts: session:update (to all clients)
                ↓
Server calls: initializeSessionDevices() 
              - Adds existing sockets to session room
              - Joins them to session:${sessionId}
              ↓
Server returns: gm:command:ack (to sender only)
```

### Offline Queue Processing
```
Player scanner uploads: HTTP POST /api/scan/batch
                        ↓
Backend processes batch:
  - Validates each transaction
  - Updates scores
  - Emits multiple transaction:added events
                        ↓
Broadcasts: offline:queue:processed (to GMs)
                        ↓
Broadcasts: sync:full (complete updated state)
```

---

## Room Broadcasting Reference

### 'gm-stations' Room
Contains: All connected GM scanners
Broadcasts:
- `transaction:new`
- `score:updated`
- `video:status`, `video:progress`, `video:queue:update`
- `group:completed`
- `offline:queue:processed`

### 'session:${sessionId}' Room
Contains: All devices in current session
Broadcasts:
- `transaction:new` (session-scoped)

### Direct Socket (No Room)
Single device only:
- `sync:full` (initial connection)
- `transaction:result` (submitter only)
- `gm:command:ack` (command sender only)
- `error` (relevant client)

---

## Event Envelope Structure (ALL Events)

### Server → Client
```javascript
{
  event: string,        // e.g., "transaction:new"
  data: object,         // Payload per AsyncAPI schema
  timestamp: string     // ISO 8601 UTC: "2025-10-15T19:05:00.000Z"
}
```

### Client → Server
```javascript
{
  event: string,        // e.g., "transaction:submit"
  data: object,         // Required fields per AsyncAPI
  timestamp: string     // ISO 8601 UTC
}
```

---

## E2E Test Template

```javascript
describe('WebSocket Feature', () => {
  let testContext;
  let socket;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await sessionService.createSession({
      name: 'Test Session',
      teams: ['001', '002']
    });
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM');
  });

  afterEach(async () => {
    if (socket?.connected) socket.disconnect();
    listenerRegistry.cleanup();  // CRITICAL!
    await sessionService.reset();
  });

  it('should do something', async () => {
    // 1. Setup listeners BEFORE triggering
    const eventListener = waitForEvent(socket, 'event:name');

    // 2. Trigger event
    socket.emit('event:name', {
      event: 'event:name',
      data: { /* payload */ },
      timestamp: new Date().toISOString()
    });

    // 3. Await event
    const event = await eventListener;

    // 4. Verify
    expect(event.event).toBe('event:name');
    validateWebSocketEvent(event, 'event:name');
  });
});
```

---

## Debugging Checklist

- [ ] Listener cleanup in afterEach? `listenerRegistry.cleanup()`
- [ ] Proper async/await? Use `waitForEvent(socket, 'name')` with timeout
- [ ] Session exists? `sessionService.getCurrentSession()`
- [ ] Event envelope? `{ event, data, timestamp }`
- [ ] Room membership? `io.sockets.adapter.rooms.get('gm-stations')`
- [ ] Authentication? `socket.handshake.auth?.token`
- [ ] Timestamp format? ISO 8601 UTC only
- [ ] Two sockets for broadcasts? (Broadcast events don't echo to sender)

---

## Common Error Codes

```
AUTH_REQUIRED         → Missing/invalid JWT or authentication
PERMISSION_DENIED     → Insufficient permissions
VALIDATION_ERROR      → Invalid input data
SESSION_NOT_FOUND     → No active session
TOKEN_NOT_FOUND       → Token ID not in database
DUPLICATE_TRANSACTION → Token already scanned (within 1hr window)
INVALID_REQUEST       → Malformed request
VLC_ERROR             → Video playback system error
INTERNAL_ERROR        → Unhandled server error
```

---

## Key File References

| File | Purpose |
|------|---------|
| `backend/contracts/asyncapi.yaml` | Event contract (source of truth) |
| `backend/src/websocket/socketServer.js` | Socket.io server creation |
| `backend/src/websocket/gmAuth.js` | Device auth & sync:full |
| `backend/src/websocket/broadcasts.js` | Event listener setup & wrapping |
| `backend/src/websocket/adminEvents.js` | gm:command & transaction:submit handlers |
| `backend/src/websocket/deviceTracking.js` | Device disconnect & sync request handlers |
| `backend/src/websocket/eventWrapper.js` | Event envelope wrapping |
| `backend/src/server.js:40-127` | WebSocket handler setup |
| `backend/src/services/stateService.js` | State event emission |
| `backend/src/middleware/auth.js` | JWT token management |

---

## Race Conditions to Watch

1. **Listener Accumulation**: Call `listenerRegistry.cleanup()` in afterEach
2. **Duplicate Transactions**: Window is 1 session hour per token+team
3. **Session Change During Transaction**: Lock session during processing
4. **WebSocket Handshake Timeout**: Pre-auth from handshake prevents this
5. **Event Ordering**: Use timestamps to verify correct sequence

---

## Real-World Event Timeline Example

```
[19:00:00.000Z] Device connects → sync:full sent
[19:00:05.000Z] Admin creates session → session:update broadcast
[19:05:30.000Z] GM1 scans token 534e2b03
[19:05:30.010Z] → transaction:result (GM1)
[19:05:30.015Z] → transaction:new (all GMs) {teamScore: 1500, groupBonusInfo: null}
[19:05:35.000Z] Player scanner offline
[19:06:00.000Z] Player scanner comes online, uploads batch
[19:06:00.100Z] → offline:queue:processed (all GMs)
[19:06:00.150Z] → sync:full (all GMs)
[19:30:00.000Z] Admin ends session → session:update (status: 'ended')
[19:35:00.000Z] GM1 disconnects → device:disconnected broadcast
```

