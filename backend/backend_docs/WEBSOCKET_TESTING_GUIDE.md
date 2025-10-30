# WebSocket E2E Testing Guide

## Document Overview

This folder contains comprehensive WebSocket analysis and testing guides for the ALN Orchestrator:

### Core Documents

1. **WEBSOCKET_ANALYSIS.md** (1493 lines)
   - Complete deep dive into WebSocket architecture
   - Event flow patterns with timing diagrams
   - Service coordination and state synchronization
   - Detailed race condition analysis
   - Full E2E test examples

2. **WEBSOCKET_QUICK_REFERENCE.md** (this file)
   - Quick lookup tables
   - Common commands and payloads
   - Debugging checklist
   - Template test structures

3. **CLAUDE.md** (project instructions)
   - Overall system architecture
   - Contract-first development approach
   - Key service patterns

### Contract Documents

- `backend/contracts/asyncapi.yaml` - WebSocket event contract (source of truth)
- `backend/contracts/openapi.yaml` - HTTP API contract

---

## Quick Start: Write Your First E2E Test

### 1. Setup Test File

```javascript
// backend/tests/e2e/my-websocket-feature.test.js

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const sessionService = require('../../src/services/sessionService');
const listenerRegistry = require('../../src/websocket/listenerRegistry');
```

### 2. Implement Test Suite

```javascript
describe('My WebSocket Feature', () => {
  let testContext;
  let socket;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Reset to clean state
    await sessionService.reset();
    
    // Create test session
    await sessionService.createSession({
      name: 'Test Session',
      teams: ['001', '002']
    });

    // Connect WebSocket as GM
    socket = await connectAndIdentify(
      testContext.socketUrl,
      'gm',
      'TEST_GM_1'
    );
  });

  afterEach(async () => {
    // Critical: cleanup listeners to prevent accumulation
    listenerRegistry.cleanup();
    
    // Disconnect
    if (socket?.connected) {
      socket.disconnect();
    }
    
    // Reset services
    await sessionService.reset();
  });

  it('should handle transaction submission', async () => {
    // 1. Setup: Listen for events BEFORE sending
    const resultListener = waitForEvent(socket, 'transaction:result');
    const newListener = waitForEvent(socket, 'transaction:new');

    // 2. Trigger: Send transaction:submit
    socket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'TEST_GM_1',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    // 3. Wait: For responses
    const resultEvent = await resultListener;
    const newEvent = await newListener;

    // 4. Verify: Results match contract
    expect(resultEvent.event).toBe('transaction:result');
    expect(resultEvent.data.status).toBe('accepted');
    
    expect(newEvent.event).toBe('transaction:new');
    expect(newEvent.data.transaction.tokenId).toBe('534e2b03');
  });
});
```

### 3. Run Test

```bash
cd backend
npm test -- my-websocket-feature.test.js
```

---

## Architecture Overview

### Authentication Flow (Always First)

```
1. HTTP: POST /api/admin/auth → Get JWT token
2. WebSocket: Connect with token in handshake.auth
3. Server: Validates JWT in middleware
4. Server: Calls handleGmIdentify() → Sets socket.isAuthenticated
5. Server: Sends sync:full event (complete initial state)
6. Now ready to send/receive WebSocket events
```

### Event Categories

**Initiated by Client:**
- `transaction:submit` - GM submits token scan
- `gm:command` - Admin control commands (11 types)
- `sync:request` - Request full state sync
- `heartbeat` - Keep-alive signal

**Broadcast by Server:**
- `transaction:new` - New transaction in session
- `score:updated` - Team score changed
- `video:status` - Video playback state
- `sync:full` - Complete state snapshot
- `device:connected`/`device:disconnected` - Device tracking
- `session:update` - Session state change
- `group:completed` - Token group bonus
- `offline:queue:processed` - Offline batch complete

### Room Structure

- **'gm-stations'** - All GM scanners (for GM-exclusive broadcasts)
- **'session:${sessionId}'** - Devices in specific session
- **Direct socket** - Individual device (for responses/acknowledgments)

---

## Common Test Patterns

### Pattern 1: Simple Event-Response

```javascript
it('should respond to heartbeat', async () => {
  const ackListener = waitForEvent(socket, 'heartbeat:ack');
  
  socket.emit('heartbeat', {
    event: 'heartbeat',
    data: { stationId: 'TEST_GM_1' },
    timestamp: new Date().toISOString()
  });

  const ackEvent = await ackListener;
  expect(ackEvent.event).toBe('heartbeat:ack');
});
```

### Pattern 2: Broadcast to Multiple Sockets

```javascript
it('should broadcast to all GMs', async () => {
  // Connect 2 GMs
  const gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_1');
  const gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_2');

  // Setup listeners on both
  const gm1Listener = waitForEvent(gm1, 'transaction:new');
  const gm2Listener = waitForEvent(gm2, 'transaction:new');

  // Submit from GM1
  gm1.emit('transaction:submit', {
    event: 'transaction:submit',
    data: {
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'GM_1',
      mode: 'blackmarket'
    },
    timestamp: new Date().toISOString()
  });

  // Both should receive transaction:new
  const event1 = await gm1Listener;
  const event2 = await gm2Listener;
  
  expect(event1.data.transaction.tokenId).toBe('534e2b03');
  expect(event2.data.transaction.tokenId).toBe('534e2b03');

  gm1.disconnect();
  gm2.disconnect();
});
```

### Pattern 3: Race Condition Testing

```javascript
it('should handle simultaneous transactions', async () => {
  const socket2 = await connectAndIdentify(
    testContext.socketUrl,
    'gm',
    'TEST_GM_2'
  );

  const listener1 = new Promise(resolve => {
    socket.once('transaction:result', resolve);
  });
  const listener2 = new Promise(resolve => {
    socket2.once('transaction:result', resolve);
  });

  // Both send same token simultaneously
  socket.emit('transaction:submit', {
    event: 'transaction:submit',
    data: {
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'TEST_GM_1',
      mode: 'blackmarket'
    },
    timestamp: new Date().toISOString()
  });

  socket2.emit('transaction:submit', {
    event: 'transaction:submit',
    data: {
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'TEST_GM_2',
      mode: 'blackmarket'
    },
    timestamp: new Date().toISOString()
  });

  const [result1, result2] = await Promise.all([listener1, listener2]);

  // One should be accepted, other duplicate
  const statuses = [result1.data.status, result2.data.status].sort();
  expect(statuses).toEqual(['accepted', 'duplicate']);

  socket2.disconnect();
  listenerRegistry.cleanup();
});
```

---

## Debugging Failed Tests

### Issue: Events Never Arrive

**Checklist:**
- [ ] Is session created? `await sessionService.createSession(...)`
- [ ] Is socket connected? `socket.connected === true`
- [ ] Is socket authenticated? `socket.handshake.auth?.token` set?
- [ ] Are listeners setup BEFORE sending? Order matters!
- [ ] Is timeout sufficient? `waitForEvent(socket, 'event', 5000)`

**Debug:**
```javascript
// Log all events
socket.onAny((eventName, data) => {
  console.log(`[Event] ${eventName}:`, data);
});

// Check room membership
const gmRoom = testContext.io.sockets.adapter.rooms.get('gm-stations');
console.log('GMs in room:', gmRoom?.size);

// Check authentication
console.log('Socket authenticated:', socket.isAuthenticated);
console.log('Socket device:', socket.deviceId);
```

### Issue: Listener Accumulation / Duplicate Events

**Solution:**
```javascript
afterEach(async () => {
  listenerRegistry.cleanup();  // ADD THIS!
});
```

### Issue: Timestamp Validation Fails

**Requirement:** ISO 8601 UTC format
```javascript
// CORRECT
timestamp: new Date().toISOString()
// Result: "2025-10-15T19:05:00.000Z"

// WRONG
timestamp: Date.now()  // Milliseconds
timestamp: new Date().toString()  // Local format
```

### Issue: Envelope Validation Fails

**Requirement:** ALL events must have `{ event, data, timestamp }`
```javascript
// CORRECT
socket.emit('transaction:submit', {
  event: 'transaction:submit',
  data: { tokenId: '534e2b03', teamId: '001', ... },
  timestamp: new Date().toISOString()
});

// WRONG
socket.emit('transaction:submit', {
  tokenId: '534e2b03',  // Missing envelope!
  teamId: '001'
});
```

---

## Verify Contract Compliance

### Use validateWebSocketEvent()

```javascript
const { validateWebSocketEvent } = require('../helpers/contract-validator');

it('should match AsyncAPI contract', async () => {
  const listener = waitForEvent(socket, 'transaction:result');
  
  socket.emit('transaction:submit', {
    event: 'transaction:submit',
    data: {
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'TEST_GM_1',
      mode: 'blackmarket'
    },
    timestamp: new Date().toISOString()
  });

  const event = await listener;

  // Validates structure AND schema compliance
  validateWebSocketEvent(event, 'transaction:result');
  // Throws if not valid
});
```

---

## Performance & Timing

### Expected Event Latencies

| Scenario | Latency | Notes |
|----------|---------|-------|
| transaction:result | 10ms | Direct response |
| transaction:new | 15ms | After result sent |
| score:updated | 20ms | After transaction:new |
| sync:full | 100ms | Complete state rebuild |
| video:status | 25ms | If token has video |

### Test Timeout Recommendations

```javascript
const resultListener = waitForEvent(socket, 'event:name', 1000);  // 1 second
const broadcastListener = waitForEvent(socket, 'event:name', 2000);  // 2 seconds
const syncListener = waitForEvent(socket, 'event:name', 5000);  // 5 seconds
```

---

## Key Takeaways

1. **Authentication First**: Always get JWT token via HTTP auth before WebSocket
2. **Wrapped Envelopes**: ALL events follow `{ event, data, timestamp }`
3. **Room Broadcasting**: Understand which room each event goes to
4. **Listener Cleanup**: Call `listenerRegistry.cleanup()` in afterEach
5. **Async/Await**: Use helpers like `waitForEvent()` for proper async handling
6. **Contract Validation**: Use `validateWebSocketEvent()` to verify compliance
7. **Two Sockets for Broadcasts**: Broadcast events don't echo to sender

---

## References

- **Full Analysis**: See WEBSOCKET_ANALYSIS.md (1493 lines)
- **Contract**: See backend/contracts/asyncapi.yaml
- **Test Helpers**: See backend/tests/helpers/websocket-helpers.js
- **Contract Validator**: See backend/tests/helpers/contract-validator.js
- **Test Examples**: See backend/tests/contract/websocket/*.test.js

