# Phase 5.2: Contract Violations Found During Investigation

**Created**: 2025-10-03
**Purpose**: Document all contract violations found before writing tests
**Status**: Investigation Complete - Ready for TDD implementation

---

## Summary

Investigation of 8 missing WebSocket events revealed **3 contract violations** that tests will expose:

1. **device:disconnected** - Missing required fields (type, disconnectionTime)
2. **sync:full** - Incomplete payload (missing scores, videoStatus, systemStatus)
3. **gm:command + gm:command:ack** - Wrong data structure (command vs action, missing fields)

---

## Event 1: device:disconnected

**File**: `backend/src/websocket/deviceTracking.js:28-31`

**Current Implementation**:
```javascript
emitWrapped(io, 'device:disconnected', {
  deviceId: socket.deviceId,
  reason: 'manual',
});
```

**AsyncAPI Contract** (lines 229-257):
```yaml
required:
  - deviceId
  - type
  - disconnectionTime
properties:
  deviceId: string
  type: enum [gm, scanner]
  disconnectionTime: string (date-time)
  reason: enum [manual, timeout, error]
```

**Violations**:
- ❌ Missing `type` field (required)
- ❌ Missing `disconnectionTime` field (required)

**Test Will Fail With**:
```
WebSocket event validation failed for device:disconnected:
  event.data: must have required property 'type'
  event.data: must have required property 'disconnectionTime'
```

**Fix Required**:
```javascript
emitWrapped(io, 'device:disconnected', {
  deviceId: socket.deviceId,
  type: socket.deviceType,  // ADD
  disconnectionTime: new Date().toISOString(),  // ADD
  reason: 'manual',
});
```

---

## Event 2: sync:full

**File**: `backend/src/websocket/deviceTracking.js:72-77`

**Current Implementation**:
```javascript
emitWrapped(socket, 'sync:full', {
  session: session?.toJSON(),
  state: state?.toJSON(),
  devices: session?.connectedDevices || [],
  transactions: session?.transactions?.slice(-100) || [],  // WRONG NAME
});
```

**AsyncAPI Contract** (lines 298-387):
```yaml
required:
  - session
  - scores
  - recentTransactions
  - videoStatus
  - devices
  - systemStatus
```

**Violations**:
- ❌ Missing `scores` field (required) - array of TeamScore objects
- ❌ Missing `videoStatus` field (required) - object with status, queueLength, tokenId
- ❌ Missing `systemStatus` field (required) - object with orchestratorOnline, vlcConnected
- ❌ Wrong field name: `transactions` should be `recentTransactions`
- ❌ Has extra field `state` (not in contract, likely legacy)

**Test Will Fail With**:
```
WebSocket event validation failed for sync:full:
  event.data: must have required property 'scores'
  event.data: must have required property 'videoStatus'
  event.data: must have required property 'systemStatus'
  event.data: must have required property 'recentTransactions'
  event.data: must NOT have additional property 'state'
```

**Fix Required**:
```javascript
emitWrapped(socket, 'sync:full', {
  session: session?.toJSON(),
  scores: transactionService.getAllTeamScores(),  // ADD
  recentTransactions: session?.transactions?.slice(-100) || [],  // RENAME
  videoStatus: {  // ADD
    status: videoQueueService.currentStatus || 'idle',
    queueLength: videoQueueService.queue?.length || 0,
    tokenId: videoQueueService.currentVideo?.tokenId || null
  },
  devices: session?.connectedDevices || [],
  systemStatus: {  // ADD
    orchestratorOnline: true,
    vlcConnected: vlcService?.isConnected() || false
  }
  // REMOVE: state field
});
```

---

## Event 3: gm:command

**File**: `backend/src/websocket/adminEvents.js:28`

**Current Implementation**:
```javascript
switch (data.command) {  // WRONG: should be data.action
  case 'pause_session':  // WRONG: should be 'session:pause'
    await sessionService.updateSession({ status: 'paused' });
    break;
  // ... 4 more cases with wrong names
}
```

**AsyncAPI Contract** (lines 1046-1111):
```yaml
gm:command:
  data:
    required:
      - action
      - payload
    properties:
      action:
        type: string
        enum: [session:create, session:pause, session:resume, session:end,
               video:play, video:pause, video:stop, video:skip,
               video:queue:add, video:queue:reorder, video:queue:clear,
               score:adjust, transaction:delete, transaction:create, system:reset]
      payload:
        type: object
```

**Violations**:
- ❌ Uses `data.command` instead of `data.action` (field name wrong)
- ❌ Missing `data.payload` (required field)
- ❌ Action names wrong format:
  - `pause_session` → `session:pause`
  - `resume_session` → `session:resume`
  - `end_session` → `session:end`
  - `skip_video` → `video:skip`
  - `clear_scores` → `score:adjust` (NOT score:reset!)

**Test Will Fail With**:
```
WebSocket event validation failed for gm:command:
  event.data: must have required property 'action'
  event.data: must have required property 'payload'
  event.data.command: is not allowed by the schema
```

**Fix Required**:
```javascript
// Change from:
switch (data.command) {
  case 'pause_session':

// To:
const { action, payload } = data;
switch (action) {
  case 'session:pause':
    await sessionService.updateSession({ status: 'paused' });
    break;
  case 'session:resume':
    await sessionService.updateSession({ status: 'active' });
    break;
  case 'session:end':
    await sessionService.endSession();
    break;
  case 'video:skip':
    videoQueueService.skipCurrent();
    break;
  case 'score:adjust':  // NOT 'clear_scores'
    const { teamId, delta } = payload;
    transactionService.adjustScore(teamId, delta);
    break;
  // ... add all 15 actions from AsyncAPI enum
}
```

---

## Event 4: gm:command:ack

**File**: `backend/src/websocket/adminEvents.js:79-82`

**Current Implementation**:
```javascript
emitWrapped(socket, 'gm:command:ack', {
  command: data.command,  // WRONG: should be 'action'
  success: true,  // OK
  // Missing: message (required)
});
```

**AsyncAPI Contract** (lines 1140-1195):
```yaml
gm:command:ack:
  data:
    required:
      - action
      - success
      - message
    properties:
      action: string
      success: boolean
      message: string
      error: string (nullable)
      result: object (nullable)
```

**Violations**:
- ❌ Uses `command` instead of `action` (field name wrong)
- ❌ Missing `message` field (required)

**Test Will Fail With**:
```
WebSocket event validation failed for gm:command:ack:
  event.data: must have required property 'action'
  event.data: must have required property 'message'
  event.data.command: is not allowed by the schema
```

**Fix Required**:
```javascript
emitWrapped(socket, 'gm:command:ack', {
  action: action,  // Use original action from gm:command
  success: true,
  message: `Command ${action} executed successfully`,  // ADD
  error: null,
  result: {}  // Optional: can include command-specific results
});
```

---

## Events Expected to Pass (Quick Wins)

These implementations already match AsyncAPI contracts:

### video:status
**File**: `backend/src/websocket/broadcasts.js:186-257`
**Status**: ✅ Correct - All 6 status types properly implemented
- idle, loading, playing, paused, completed, error
- All have required fields: status, queueLength, tokenId (when applicable)

### offline:queue:processed
**File**: `backend/src/websocket/broadcasts.js:280-292`
**Status**: ✅ Correct
- Payload: `{processed: number, failed: number}` matches AsyncAPI

### error
**File**: `backend/src/websocket/broadcasts.js:296-310`
**Status**: ✅ Correct
- Payload: `{service: string, message: string, code: string}` matches AsyncAPI

---

## Test Implementation Order

Based on findings:

1. **Quick Wins First** (build confidence):
   - video:status (6 tests) - expect all pass ✅
   - offline:queue:processed - expect pass ✅
   - error - expect pass ✅

2. **Medium Complexity** (reveal issues, simple fixes):
   - device:disconnected - expect fail (2 missing fields)
   - sync:full - expect fail (incomplete payload)

3. **TDD Failures** (expose major violations, complex fixes):
   - gm:command - expect fail (wrong structure, wrong names)
   - gm:command:ack - expect fail (wrong fields, missing message)

---

## Summary Statistics

**Total Events Investigated**: 8
**Contract-Compliant**: 3 (video:status, offline:queue:processed, error)
**Contract Violations**: 3 (device:disconnected, sync:full, gm:command/ack)
**Missing Fields Total**: 10
**Wrong Field Names**: 3
**Wrong Enum Values**: 5

**Expected Test Results**:
- Quick Win Tests: ~9 tests, all passing
- Medium Tests: ~3 tests, all failing initially
- TDD Tests: ~5 tests, all failing initially
- **Total New Tests**: ~17
- **Final Count**: 77 → 94 tests

---

**Document Status**: Investigation Complete
**Next Step**: Begin Quick Win implementation (video:status tests)
