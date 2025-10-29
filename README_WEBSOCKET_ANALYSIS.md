# WebSocket Analysis Documentation

Complete analysis of WebSocket event flows and state synchronization for the ALN Orchestrator system.

## Documents Included

### 1. WEBSOCKET_ANALYSIS.md (1493 lines, 59KB)
**Deep Technical Reference**

The most comprehensive document covering:
- Complete 6-step authentication flow with diagrams
- All 25+ WebSocket events cataloged with contracts and triggers
- 3 detailed critical event sequences with timing diagrams:
  - GM Transaction Flow (T+0 to T+25ms)
  - Session Lifecycle (T+0 to T+12ms)
  - Offline Queue Processing (T+0 to T+20ms)
- Socket.io room architecture and membership lifecycle
- Event envelope validation and error handling
- Session vs GameState architecture (critical distinction)
- sync:full event complete specification
- Service event coordination patterns
- 3 complete E2E test scenario patterns
- Comprehensive race condition analysis (5 major patterns)
- Event flow tracing and contract validation strategies
- State consistency verification checklist

**Best for:** Understanding the complete architecture, race conditions, and implementing complex E2E tests

### 2. WEBSOCKET_QUICK_REFERENCE.md (286 lines, 8.9KB)
**Quick Lookup Guide**

Fast reference for:
- Event types summary table (12 server→client, 6 client→server)
- Authentication flow checklist (4 steps)
- Critical event sequences in text format (3 scenarios)
- Room broadcasting reference with membership rules
- Event envelope structure template
- E2E test template code ready to copy/paste
- Debugging checklist (8 items)
- Common error codes (9 codes)
- Key file references with file purposes
- Real-world event timeline example
- Race conditions to watch (5 patterns)

**Best for:** Quick lookups while coding, testing, or debugging

### 3. WEBSOCKET_TESTING_GUIDE.md (421 lines, 11KB)
**Practical Testing Guide**

Hands-on testing guide featuring:
- Quick start: Create your first E2E test in 5 minutes
- Complete test suite template with setup/teardown
- 3 common test patterns with code:
  - Simple event-response
  - Broadcast to multiple sockets
  - Race condition testing
- Debugging failed tests with flowcharts
- Contract validation using validateWebSocketEvent()
- Performance metrics and timing expectations
- Common pitfalls and solutions
- Key takeaways (7 critical points)

**Best for:** Writing actual tests, debugging test failures, learning by example

## Event Summary

### Server → Client Events (12 major types)

| Event | Room | Payload | Reference |
|-------|------|---------|-----------|
| `sync:full` | Direct | Complete game state | ANALYSIS §6.2 |
| `device:connected` | Global | New device info | ANALYSIS §2.1 |
| `transaction:new` | GM-stations + session | Transaction enriched | ANALYSIS §3.1 |
| `score:updated` | GM-stations | Team score update | ANALYSIS §3.1 |
| `video:status` | GM-stations | Video playback state | ANALYSIS §3.1 |
| `session:update` | Global | Session lifecycle | ANALYSIS §3.2 |
| `error` | Direct | Error code & message | ANALYSIS §5.2 |
| + 5 more | Various | See documents | ANALYSIS §2.1 |

### Client → Server Events (6 major types)

| Event | Handler | Response | Reference |
|-------|---------|----------|-----------|
| `transaction:submit` | handleTransactionSubmit | transaction:result | QUICK_REF |
| `gm:command` | handleGmCommand | gm:command:ack + effects | QUICK_REF |
| `sync:request` | handleSyncRequest | sync:full | QUICK_REF |
| `heartbeat` | handleHeartbeat | heartbeat:ack | QUICK_REF |
| + 2 more | Various | See documents | QUICK_REF |

## Authentication Flow (6 Steps)

```
1. HTTP POST /api/admin/auth → Get JWT token (24h expiry)
2. WebSocket connect with token in handshake.auth
3. Server validates JWT in middleware
4. Server auto-calls handleGmIdentify()
5. Server broadcasts device:connected (to other clients)
6. Server sends sync:full (to new device)
```

## Critical Architectural Patterns

### Pattern 1: Event Envelope Wrapping
```javascript
// ALL WebSocket events follow this structure
{
  event: string,              // Event name
  data: object,               // Payload per AsyncAPI schema
  timestamp: string           // ISO 8601 UTC
}
```

### Pattern 2: Room Broadcasting
- **'gm-stations'** - All connected GMs (for GM-exclusive broadcasts)
- **'session:${sessionId}'** - Devices in current session
- **Direct socket** - Single device responses

### Pattern 3: Service Event Coordination
```
Service emits domain event
  ↓
broadcasts.js listens
  ↓
Wraps in event envelope
  ↓
Broadcasts via Socket.io room
  ↓
Clients receive wrapped event
```

### Pattern 4: State Synchronization
- **Session** - Persistent source of truth (stored on disk)
- **GameState** - Computed on-demand (never stored)
- **sync:full** - Sent on connection and after major changes

## Test Pattern Template

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
      name: 'Test',
      teams: ['001', '002']
    });
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM');
  });

  afterEach(async () => {
    listenerRegistry.cleanup();  // CRITICAL!
    if (socket?.connected) socket.disconnect();
    await sessionService.reset();
  });

  it('should handle events', async () => {
    // 1. Setup listener BEFORE sending
    const listener = waitForEvent(socket, 'event:name');

    // 2. Trigger
    socket.emit('event:name', {
      event: 'event:name',
      data: { /* ... */ },
      timestamp: new Date().toISOString()
    });

    // 3. Wait for response
    const event = await listener;

    // 4. Verify
    validateWebSocketEvent(event, 'event:name');
  });
});
```

## Race Conditions Identified

1. **Listener Accumulation** - Solution: `listenerRegistry.cleanup()` in afterEach
2. **Duplicate Transactions** - Prevention: 1-hour window per token+team+session
3. **Session Change During Transaction** - Mitigation: Lock session during processing
4. **WebSocket Handshake Timeout** - Prevention: Pre-auth from handshake
5. **Event Ordering Collisions** - Monitoring: Use timestamps to verify sequence

## Key Files Referenced

| File | Purpose |
|------|---------|
| `backend/contracts/asyncapi.yaml` | WebSocket event contract (source of truth) |
| `backend/src/websocket/broadcasts.js` | Event listener setup & wrapping |
| `backend/src/websocket/gmAuth.js` | Device auth & sync:full emission |
| `backend/src/server.js:40-127` | WebSocket handler setup |
| `backend/tests/contract/websocket/*.test.js` | Test examples |

## Quick Start

### For Understanding the Architecture
1. Start with WEBSOCKET_QUICK_REFERENCE.md (5 min read)
2. Review authentication flow section
3. Look at event types table
4. Check room broadcasting reference

### For Writing Tests
1. Copy test template from WEBSOCKET_TESTING_GUIDE.md
2. Reference common test patterns
3. Use WEBSOCKET_QUICK_REFERENCE.md for event details
4. Run tests and debug using provided checklist

### For Deep Debugging
1. Read WEBSOCKET_ANALYSIS.md race condition section
2. Use debugging strategies from §9 (Monitoring & Debugging)
3. Implement event flow tracing
4. Verify state consistency

## Document Statistics

| Document | Lines | Size | Content |
|----------|-------|------|---------|
| WEBSOCKET_ANALYSIS.md | 1493 | 59KB | Deep technical reference |
| WEBSOCKET_QUICK_REFERENCE.md | 286 | 8.9KB | Quick lookup guide |
| WEBSOCKET_TESTING_GUIDE.md | 421 | 11KB | Practical testing guide |
| **Total** | **2200** | **79KB** | Complete coverage |

## Related Documents

- **CLAUDE.md** - Overall project instructions and architecture
- **backend/contracts/asyncapi.yaml** - WebSocket event contract (1403 lines)
- **backend/contracts/openapi.yaml** - HTTP API contract
- **docs/ARCHIVE/api-alignment/*.md** - Functional requirements

## How to Use These Documents

### Reading Order by Goal

**Goal: Understand WebSocket Architecture**
1. This file (overview)
2. WEBSOCKET_QUICK_REFERENCE.md (Event types & auth)
3. WEBSOCKET_ANALYSIS.md §1-3 (Auth & events)
4. WEBSOCKET_ANALYSIS.md §4-6 (Broadcasting & state)

**Goal: Write E2E Tests**
1. WEBSOCKET_TESTING_GUIDE.md (Start here)
2. WEBSOCKET_QUICK_REFERENCE.md (Reference during coding)
3. Copy test template and examples
4. Use debugging checklist when tests fail

**Goal: Debug Race Conditions**
1. WEBSOCKET_ANALYSIS.md §10 (Race conditions)
2. WEBSOCKET_QUICK_REFERENCE.md (Debugging checklist)
3. WEBSOCKET_ANALYSIS.md §9 (Monitoring strategies)
4. Implement fixes with WEBSOCKET_TESTING_GUIDE.md patterns

**Goal: Understand State Synchronization**
1. WEBSOCKET_ANALYSIS.md §6.1 (Session vs GameState)
2. WEBSOCKET_ANALYSIS.md §6.2 (sync:full event)
3. WEBSOCKET_ANALYSIS.md §3.3 (Offline resync example)
4. Review stateService.js implementation

## Key Takeaways

1. **Contract-First**: ALL WebSocket events follow AsyncAPI contract
2. **Wrapped Envelopes**: `{ event, data, timestamp }` structure mandatory
3. **Room-Based Broadcasting**: Understand which event goes to which room
4. **Listener Cleanup**: CRITICAL for test isolation - call `listenerRegistry.cleanup()`
5. **Session Source of Truth**: Session is persistent, GameState computed on-demand
6. **Async/Await Patterns**: Use `waitForEvent()` helper for proper async handling
7. **Two Sockets for Broadcasts**: Broadcast events don't echo to sender

## Next Steps

1. **For Architecture Understanding**: Read WEBSOCKET_ANALYSIS.md
2. **For Quick Reference**: Bookmark WEBSOCKET_QUICK_REFERENCE.md
3. **For Test Implementation**: Follow WEBSOCKET_TESTING_GUIDE.md
4. **For Contract Compliance**: Reference backend/contracts/asyncapi.yaml
5. **For Working Examples**: Check backend/tests/contract/websocket/*.test.js

---

**Generated**: 2025-10-27  
**Analysis Scope**: Backend WebSocket implementation for E2E testing  
**Coverage**: 25+ event types, 5 race conditions, 3 event flows, 2100+ lines of documentation
