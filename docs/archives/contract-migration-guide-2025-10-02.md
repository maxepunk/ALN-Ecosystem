# Breaking Changes Guide (ARCHIVED)

> **⚠️ ARCHIVED DOCUMENT** - Created 2025-10-02
> **Status**: Migration Completed
> **Context**: This was a one-time guide for October 2025 contract alignment refactoring.
> Migration completed around October 2025. For current contract changes, see backend/contracts/README.md.
> Retained for historical reference.

**Target**: Developers implementing contract-compliant code
**Context**: Pre-production refactoring (Oct 2025) - no backwards compatibility needed
**Approach**: All changes applied at once (backend + scanners together)

---

## TL;DR

**Coordination Required**: Backend and scanner changes must be applied together in single PR/commit.

**Critical Changes**:
1. Field renames: `scannerId` → `deviceId`, `sessionId` → `id`
2. WebSocket wrapping: `gm:identified`, `video:status` now use envelope
3. Admin transport: HTTP POST endpoints → WebSocket `gm:command`
4. New required fields: `video:status.queueLength`, `session.teams`

**Implementation Strategy**:
- Write failing tests for target contracts first (TDD)
- Update backend to match contracts
- Update scanners to match contracts
- All tests pass → done

---

## Decision-by-Decision Changes

### Decision #2: Wrapped WebSocket Envelope

**What Changed**: All WebSocket events now use `{event, data, timestamp}` structure.

**Backend Changes**:
```javascript
// BEFORE (unwrapped)
socket.emit('gm:identified', { success: true, deviceId: 'GM_1' });

// AFTER (wrapped)
socket.emit('gm:identified', {
  event: 'gm:identified',
  data: { success: true, deviceId: 'GM_1' },
  timestamp: new Date().toISOString()
});
```

**Scanner Changes**:
```javascript
// BEFORE
socket.on('gm:identified', (data) => {
  const deviceId = data.deviceId;
});

// AFTER
socket.on('gm:identified', (message) => {
  const deviceId = message.data.deviceId;
});
```

**Affected Events**: `gm:identified`, `video:status` (were unwrapped, now wrapped)

---

### Decision #4: Field Naming Standardization

**What Changed**: Consistent field names across all APIs.

**Field Renames**:
- `scannerId` → `deviceId` (everywhere)
- `stationId` → `deviceId` (GM Scanner normalization)
- `sessionId` → `id` (within session resource only)

**Backend Changes**:
```javascript
// BEFORE
{ scannerId: 'GM_1', sessionId: 'abc-123' }

// AFTER
{ deviceId: 'GM_1', sessionId: 'abc-123' }  // sessionId only at top-level
{ id: 'abc-123' }  // id within session resource
```

**Scanner Changes**:
```javascript
// BEFORE
const scannerId = localStorage.getItem('scannerId');
socket.emit('transaction:submit', { tokenId, teamId, scannerId });

// AFTER
const deviceId = localStorage.getItem('deviceId');
socket.emit('transaction:submit', {
  event: 'transaction:submit',
  data: { tokenId, teamId, deviceId },
  timestamp: new Date().toISOString()
});
```

**Database/Storage**: Update all references from scannerId → deviceId

---

### Decision #5: video:status Fixed Structure

**What Changed**: Field rename + new required field.

**Backend Changes**:
```javascript
// BEFORE
socket.emit('video:status', {
  current: 'playing',
  tokenId: '534e2b03',
  duration: 30
});

// AFTER
socket.emit('video:status', {
  event: 'video:status',
  data: {
    status: 'playing',          // renamed from 'current'
    queueLength: 2,             // NEW REQUIRED FIELD
    tokenId: '534e2b03',
    duration: 30,
    progress: 45,
    expectedEndTime: '2025-10-15T20:16:00.000Z',
    error: null
  },
  timestamp: new Date().toISOString()
});
```

**Scanner Changes**:
```javascript
// BEFORE
socket.on('video:status', (status) => {
  if (status.current === 'playing') { /* ... */ }
});

// AFTER
socket.on('video:status', (message) => {
  const { status, queueLength } = message.data;
  if (status === 'playing') { /* ... */ }
  updateQueueDisplay(queueLength);
});
```

---

### Decision #7: session:update Full Resource

**What Changed**: Send complete session object instead of minimal delta.

**Backend Changes**:
```javascript
// BEFORE
socket.emit('session:update', { status: 'paused' });

// AFTER
socket.emit('session:update', {
  event: 'session:update',
  data: {
    id: 'abc-123',              // renamed from sessionId
    name: 'About Last Night - Oct 15 2025',
    startTime: '2025-10-15T19:00:00.000Z',
    endTime: null,
    status: 'paused',
    teams: ['001', '002'],      // NEW REQUIRED FIELD
    metadata: { /* ... */ }
  },
  timestamp: new Date().toISOString()
});
```

**Scanner Changes**: Already handles full resource correctly (no change needed).

---

### Decision #10: Error Display

**What Changed**: New `error` event for user-facing errors.

**Backend Changes**:
```javascript
// BEFORE (console only)
console.error('Token not found:', tokenId);

// AFTER (user-facing)
socket.emit('error', {
  event: 'error',
  data: {
    code: 'TOKEN_NOT_FOUND',
    message: 'Token not found in database',
    details: { tokenId }
  },
  timestamp: new Date().toISOString()
});
```

**Scanner Changes**:
```javascript
// NEW - Add error handler
socket.on('error', (message) => {
  const { code, message: errorMsg } = message.data;
  displayErrorToUser(errorMsg);
  console.error(`[${code}] ${errorMsg}`);
});
```

---

### Admin Commands: HTTP → WebSocket

**What Changed**: All admin POST endpoints moved to WebSocket `gm:command`.

**Eliminated HTTP Endpoints**:
- POST /api/admin/reset-scores
- POST /api/admin/clear-transactions
- POST /api/admin/stop-all-videos
- POST /api/admin/offline-mode
- POST /api/admin/reset
- POST /api/admin/config
- POST /api/video/control
- POST /api/session (create/update)

**Replaced By**: Single WebSocket `gm:command` event

**Admin Panel Changes**:
```javascript
// BEFORE (HTTP)
fetch('/api/video/control', {
  method: 'POST',
  body: JSON.stringify({ action: 'skip' }),
  headers: { 'Authorization': `Bearer ${token}` }
});

// AFTER (WebSocket)
socket.emit('gm:command', {
  event: 'gm:command',
  data: {
    action: 'video:skip',
    payload: {}
  },
  timestamp: new Date().toISOString()
});

// Listen for acknowledgment
socket.on('gm:command:ack', (message) => {
  const { action, success, message: msg } = message.data;
  if (success) {
    console.log(`${action} succeeded: ${msg}`);
  } else {
    displayError(msg);
  }
});
```

---

## Eliminated Events

These events were removed from the contract (use replacements instead):

| Eliminated Event | Replacement | Reason |
|------------------|-------------|--------|
| `state:sync` | `sync:full` | Redundant (sync:full is richer) |
| `state:update` | Domain events | Contract violation (delta vs full) |
| `session:new` | `session:update` (status='active') | Over-engineered |
| `session:paused` | `session:update` (status='paused') | Over-engineered |
| `session:resumed` | `session:update` (status='active') | Over-engineered |
| `session:ended` | `session:update` (status='ended') | Over-engineered |
| `video:skipped` | `gm:command:ack` + `video:status` | Redundant with side effects |
| `scores:reset` | `gm:command:ack` + `score:updated` | Redundant with side effects |
| `heartbeat` / `heartbeat:ack` | Socket.IO ping/pong | Built-in mechanism |
| `sync:request` | Automatic `sync:full` | Over-engineered |
| `team:created` | Teams in session creation | Teams not dynamic |
| `disconnect` | Socket.IO native event | Built-in event |

**Action Required**: Remove event listeners/emitters for eliminated events.

---

## New Required Fields

### session.teams (array)

**Target State** (not currently implemented):
```javascript
{
  id: 'abc-123',
  name: 'About Last Night - Oct 15 2025',
  teams: ['001', '002', '003'],  // NEW REQUIRED
  // ... other fields
}
```

**Implementation**: Add teams array to Session model, include in session creation.

### video:status.queueLength (integer)

**Required Field**:
```javascript
{
  status: 'playing',
  queueLength: 2,  // NEW REQUIRED - number of videos in queue
  tokenId: '534e2b03',
  // ... other fields
}
```

**Implementation**: Track queue length in videoQueueService, include in broadcasts.

---

## Implementation Checklist

### Backend

- [ ] Update all `scannerId` references → `deviceId`
- [ ] Update session resource: `sessionId` → `id` (within resource only)
- [ ] Wrap `gm:identified` event
- [ ] Wrap `video:status` event
- [ ] Rename `video:status.current` → `video:status.status`
- [ ] Add `video:status.queueLength` field
- [ ] Add `session.teams` array to Session model
- [ ] Update `session:update` to send full resource
- [ ] Add `error` event emission for user-facing errors
- [ ] Move admin HTTP endpoints → `gm:command` WebSocket handler
- [ ] Remove eliminated event emitters
- [ ] Update contract tests for new structure

### GM Scanner

- [ ] Update all `scannerId` references → `deviceId`
- [ ] Update WebSocket event handlers for wrapped envelope
- [ ] Update `video:status` handler (field rename + queueLength)
- [ ] Update `session:update` handler (field rename)
- [ ] Add `error` event handler (display to user)
- [ ] Replace admin HTTP calls → `gm:command` WebSocket
- [ ] Add `gm:command:ack` handler
- [ ] Remove eliminated event listeners
- [ ] Update localStorage keys (scannerId → deviceId)

### Player Scanner

- [ ] Update all `scannerId` references → `deviceId`
- [ ] Update HTTP request bodies (deviceId field)
- [ ] Update offline queue storage (deviceId field)
- [ ] No WebSocket changes (Player Scanner is HTTP-only)

### Admin Panel

- [ ] Update all `scannerId` references → `deviceId`
- [ ] Update WebSocket event handlers for wrapped envelope
- [ ] Replace all HTTP POST admin calls → `gm:command` WebSocket
- [ ] Add `gm:command:ack` handler
- [ ] Update device display (handle wrapped device:connected/disconnected)

---

## Testing Strategy

**Test-Driven Approach**:

1. **Write Failing Contract Tests** (validates target contracts)
   ```javascript
   describe('video:status contract', () => {
     it('should match AsyncAPI schema', () => {
       const message = {
         event: 'video:status',
         data: {
           status: 'playing',
           queueLength: 2,
           tokenId: '534e2b03',
           duration: 30,
           progress: 45,
           expectedEndTime: '2025-10-15T20:16:00.000Z',
           error: null
         },
         timestamp: '2025-10-15T20:15:45.000Z'
       };

       const valid = validateVideoStatus(message);
       expect(valid).toBe(true);
     });
   });
   ```

2. **Update Implementation** (make tests pass)
3. **Verify Integration** (end-to-end tests)

---

## Coordination Strategy

**Single PR/Commit Approach**:

All breaking changes applied together in coordinated fashion:

```bash
# Feature branch
git checkout -b feature/contract-alignment

# Update backend
# Update GM Scanner
# Update Player Scanner
# Update Admin Panel
# Update tests

# Single commit (atomic change)
git add .
git commit -m "feat: Implement contract alignment (Breaking Changes)

- Field renames: scannerId → deviceId, sessionId → id
- WebSocket wrapping: gm:identified, video:status
- Admin transport: HTTP → WebSocket gm:command
- New fields: video:status.queueLength, session.teams

BREAKING CHANGES:
All APIs updated to match OpenAPI/AsyncAPI contracts.
Backend + scanners updated together (no migration needed).

Refs: docs/api-alignment/04-alignment-decisions.md"

# Merge when all tests pass
git push origin feature/contract-alignment
```

---

## Quick Reference: Field Mapping

| Old Name | New Name | Location |
|----------|----------|----------|
| `scannerId` | `deviceId` | All APIs |
| `stationId` | `deviceId` | GM Scanner normalization |
| `sessionId` | `id` | Within session resource only |
| `video:status.current` | `video:status.status` | video:status event |

## Quick Reference: Transport Changes

| Endpoint | Old Transport | New Transport |
|----------|---------------|---------------|
| Session create | HTTP POST /api/session | WebSocket gm:command |
| Session pause/resume | HTTP PUT /api/session | WebSocket gm:command |
| Video control | HTTP POST /api/video/control | WebSocket gm:command |
| Score reset | HTTP POST /api/admin/reset-scores | WebSocket gm:command |
| All admin ops | HTTP POST /api/admin/* | WebSocket gm:command |

---

**Questions?** See:
- Contracts: `openapi.yaml`, `asyncapi.yaml`
- Decisions: `docs/api-alignment/04-alignment-decisions.md`
- Requirements: `docs/api-alignment/08-functional-requirements.md`
