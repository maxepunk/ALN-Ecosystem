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
| `transaction:new` | gm + session | Transaction added to session | transaction, teamScore |
| `score:adjusted` | session | Admin score adjustment | teamScore |
| `service:state` | gm | Service domain state change (10 domains) | domain, state (see Unified `service:state` section) |
| `group:completed` | gm | Token group bonus earned | teamId, group, bonusPoints |
| `offline:queue:processed` | gm | Offline batch processed | queueSize, results array |
| `display:mode` | Global | Display mode change | mode |
| `gm:command:ack` | Direct | Admin command executed | action, success, message |
| `error` | Direct | Any error condition | code, message, details |

> **Note:** All per-service state (video, music, health, bluetooth, audio, lighting, sound, gameclock, cueengine, held) is delivered via the unified `service:state` event — the old discrete `video:status` event was removed. See the **Unified `service:state` Pattern** section below.

### Client-to-Server Events (Commands)

| Event | Handler | Key Fields | Response |
|-------|---------|-----------|----------|
| `transaction:submit` | handleTransactionSubmit | tokenId, teamId, deviceId, mode | transaction:result |
| `gm:command` | handleGmCommand | action, payload | gm:command:ack + side effects |
| `sync:request` | inline handler in `server.js` | (empty) | sync:full |

> **`gm:command` actions:** The full set of `action` types (session lifecycle, video, score, cue, sound, music, audio, bluetooth, lighting, display, held, system) is enumerated in the **Admin Commands (gm:command)** table in `backend/CLAUDE.md`. Dispatch happens in `src/services/commandExecutor.js` (one `case` per action).
>
> **No WebSocket `heartbeat` event:** Device heartbeating is HTTP `/health` polling handled by `heartbeatMonitorService` (player/ESP32 scanners poll `/health?deviceId=X&type=player`), not a WebSocket event.

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
- Socket joins 'gm' room (`gmAuth.js`: `socket.join('gm')`)
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
                  → Contains: {transaction, teamScore}
                  → teamScore: Updated team total after this transaction
                  → (group bonus, when one is completed, is also broadcast separately as group:completed)
```

**Note:** GM token scans do NOT trigger video playback — `transactionService` explicitly skips video for GM. Video playback (and its `service:state` domain `video` push) is triggered by player-scanner video tokens or admin queue controls (`video:queue:add`), not by `transaction:submit`.

**Note:** Scores are delivered via `transaction:new.teamScore` (per-transaction), `score:adjusted` (admin adjustments), and `sync:full` (reconnection).

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

### 'gm' Room
Contains: All connected GM scanners
Broadcasts:
- `sync:full`
- `transaction:new`
- `service:state` (all 10 service domains, including video)
- `group:completed`
- `offline:queue:processed`
- `transaction:deleted`, `player:scan`, `display:mode`, `cue:fired`/`cue:completed`/`cue:error`

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

## Unified `service:state` Pattern

`service:state` is the **SOLE push mechanism** for all per-service domain state. The old per-service discrete events (`video:status`, `gameclock:status`, `bluetooth:device`, `lighting:scene`, etc.) have been removed.

**Envelope:** Each push wraps the full `getState()` snapshot of one domain:
```javascript
// data field of the event envelope:
{ domain: "video", state: { /* full videoQueueService.getState() snapshot */ } }
```

**10 domains:**

| Domain | Owning service | Notes |
|--------|----------------|-------|
| `music` | `musicService` | MPD playback/track/volume |
| `video` | `videoQueueService` | Composes VLC connection state from `vlcMprisService.getState()` |
| `health` | `serviceHealthRegistry` | 8-service health snapshot |
| `bluetooth` | `bluetoothService` | Pairing/connection/scan |
| `audio` | `audioRoutingService` | Routing + per-stream volume + ducking |
| `lighting` | `lightingService` | HA scene state |
| `sound` | `soundService` | Active pw-play playback |
| `gameclock` | `gameClockService` | Clock status/elapsed |
| `cueengine` | `cueEngineService` | Cues, active/standing cues |
| `held` | `buildHeldItemsState()` | Aggregated held cues + videos, pushed via `pushHeldState()` |

**Delivery mechanics (`broadcasts.js`):**
- `pushServiceState(domain, service)` emits `service:state` `{domain, state: service.getState()}` to the `gm` room.
- **Debounced per domain (50ms)** to coalesce rapid back-to-back state changes.
- **`video:failed` bypasses the debounce** with an immediate push so error state is captured before any later state overwrites it.
- Pushes are triggered ONLY by service events (D-Bus monitors, service lifecycle) — there is no post-command state push. State after a `gm:command` arrives via `service:state`, not in the `gm:command:ack` (the ack is just `{action, success, message}`).

**Test gotcha:** Because pushes are debounced 50ms, tests asserting on `service:state` must use `jest.useFakeTimers()` and `jest.advanceTimersByTime(51)` to flush the debounce (51 > 50).

**Remaining discrete events** (NOT delivered via `service:state`):
- Game events: `transaction:new`, `session:update`, `group:completed`, `display:mode`
- Cue lifecycle: `cue:fired`, `cue:completed`, `cue:error`
- Session/queue: `transaction:deleted`, `scores:reset`, `offline:queue:processed`, `player:scan`, `score:adjusted`, `session:overtime`, `scoreboard:page`
- Connection: `device:connected`, `device:disconnected`
- Per-socket: `sync:full`, `transaction:result`, `gm:command:ack`, `error`

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
- [ ] Room membership? `io.sockets.adapter.rooms.get('gm')`
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
DUPLICATE_TRANSACTION → GM token already processed this session (per-session global rejection — NO time window; per-device + first-come-first-served per duplicatePolicy.js)
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
| `backend/src/websocket/deviceTracking.js` | Device disconnect handler |
| `backend/src/websocket/syncHelpers.js` | Assembles `sync:full` payload (`buildSyncFullPayload`) |
| `backend/src/websocket/eventWrapper.js` | Event envelope wrapping |
| `backend/src/server.js` | WebSocket handler setup; inline `sync:request` handler |
| `backend/src/services/sessionService.js` | Session = single source of truth (state derived from session) |
| `backend/src/services/commandExecutor.js` | Shared gm:command dispatch (one `case` per action) |
| `backend/src/middleware/auth.js` | JWT token management |

---

## Race Conditions to Watch

1. **Listener Accumulation**: Call `listenerRegistry.cleanup()` in afterEach
2. **Duplicate Transactions**: GM duplicate rejection is per-session global (per-device + first-come-first-served) with NO time window
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
[19:05:30.015Z] → transaction:new (all GMs) {transaction: {...}, teamScore: 1500}
[19:05:35.000Z] Player scanner offline
[19:06:00.000Z] Player scanner comes online, uploads batch
[19:06:00.100Z] → offline:queue:processed (all GMs)
[19:06:00.150Z] → sync:full (all GMs)
[19:30:00.000Z] Admin ends session → session:update (status: 'ended')
[19:35:00.000Z] GM1 disconnects → device:disconnected broadcast
```

