# WebSocket Broadcast Bugs - Contract Test Failures

**Date**: 2025-10-30
**Status**: Active Investigation
**Severity**: High (blocks test suite)
**Test File**: `backend/tests/contract/websocket/score-events.test.js`

## Summary

After implementing the sync:full wait fix for WebSocket room join timing (Task 2.8), contract tests still fail with timeout errors. The tests now timeout waiting for the `sync:full` event itself, suggesting the event is not being sent or received correctly in the test environment.

## Test Failures

### Before Fix (Original Issue)
- **Symptom**: Tests timed out waiting for `score:updated` and `group:completed` events
- **Root Cause**: Race condition where tests emitted to 'gm-stations' room before socket finished joining
- **Expected Fix**: Wait for `sync:full` event (sent after room join per AsyncAPI contract lines 244-252)

### After Fix (Current Issue)
- **Symptom**: Tests timeout in `beforeEach` hook waiting for `sync:full` event (10 seconds)
- **Error Message**:
  ```
  thrown: "Exceeded timeout of 10000 ms for a hook.
  Add a timeout value to this test to increase the timeout, if this is a long-running test."
  ```
- **Test Results**: 2 failed, 0 passed (both tests in score-events.test.js)

## Investigation Needed

### 1. Verify sync:full Event Emission

**Check if integration-test-server.js properly triggers sync:full:**
```javascript
// backend/tests/helpers/integration-test-server.js:97
await handleGmIdentify(socket, {
  deviceId: socket.deviceId,
  version: socket.version,
  token: token
});
```

**Expected behavior** (per gmAuth.js:122):
```javascript
emitWrapped(socket, 'sync:full', { ... });
```

**Questions:**
- Is `handleGmIdentify` being called in test environment?
- Is `emitWrapped` actually emitting the event?
- Is the socket in the correct state to receive events?

### 2. Check Broadcast Listeners Setup

**File**: `backend/src/websocket/broadcasts.js`

**Check if:**
- Broadcast listeners are initialized in test server (integration-test-server.js:19)
- `setupBroadcastListeners()` properly wraps `stateService` events for WebSocket emission
- Room emission targets correct room name ('gm-stations')

### 3. Verify Event Envelope Format

**Per AsyncAPI contract**, events should be wrapped:
```javascript
{
  event: 'sync:full',
  data: { ... },
  timestamp: '2025-10-30T...'
}
```

**Check if:**
- `emitWrapped` in gmAuth.js uses correct format
- Test's `waitForEvent` listens for correct event name

### 4. Check Room Join Timing

**Possible issue**: Socket joins 'gm-stations' room AFTER `handleGmIdentify` sends sync:full

**Verify in gmAuth.js:**
- Where does `socket.join('gm-stations')` happen relative to `emitWrapped(..., 'sync:full', ...)`?
- Is room join synchronous or asynchronous?

## Reproduction Steps

```bash
cd backend
npm run test:contract -- score-events
```

## Expected vs Actual Behavior

### Expected Flow
1. Test calls `connectAndIdentify(url, 'gm', 'TEST_GM_SCORE')`
2. Socket connects with handshake.auth containing token, deviceId, deviceType
3. Server validates handshake (integration-test-server.js:75-88)
4. Server calls `handleGmIdentify` (integration-test-server.js:97)
5. `handleGmIdentify` joins socket to 'gm-stations' room
6. `handleGmIdentify` sends `sync:full` event via `emitWrapped`
7. Test receives `sync:full` event
8. Test confirms room join complete
9. Test proceeds with score event testing

### Actual Behavior
1-6. (Assumed to work based on logs showing "GM already authenticated")
7. **Test never receives sync:full event**
8. Test times out after 10 seconds

## Log Evidence

From test run (2025-10-30 12:08:15):
```json
{"level":"info","message":"GM already authenticated from handshake","metadata":{"metadata":{"deviceId":"TEST_GM_VIDEO","service":"aln-orchestrator","socketId":"AxEntiaKdZyOxQWTAAAB"}},"timestamp":"2025-10-30 12:08:15.293"}
```

**Note**: Log shows "GM already authenticated" which suggests handshake works, but no log showing sync:full emission.

## Files to Investigate

1. **backend/src/websocket/gmAuth.js** (lines 87-138)
   - Verify `emitWrapped(socket, 'sync:full', ...)` is called
   - Check if room join happens before emission

2. **backend/src/websocket/broadcasts.js**
   - Verify broadcast listeners wrap stateService events
   - Check room emission logic

3. **backend/tests/helpers/integration-test-server.js** (lines 68-103)
   - Verify `handleGmIdentify` is called correctly
   - Check if broadcast listeners are initialized

4. **backend/src/websocket/listenerRegistry.js**
   - Check if duplicate listener prevention interferes with test setup

## Potential Fixes

### Option A: Add Debug Logging
Add temporary debug logs to trace event flow:
```javascript
// In gmAuth.js before emitWrapped
logger.debug('About to send sync:full', { socketId: socket.id, deviceId });

// In emitWrapped
logger.debug('Emitting wrapped event', { event, socketId: socket.id });

// In test after waitForEvent
logger.debug('Received sync:full', { data });
```

### Option B: Check Event Timing
Modify test to log all events received:
```javascript
socket.onAny((event, data) => {
  console.log('Received event:', event, data);
});
```

### Option C: Verify Room Membership
Add assertion before waiting for events:
```javascript
// In test
const rooms = await io.in('gm-stations').fetchSockets();
console.log('Sockets in gm-stations:', rooms.map(s => s.id));
```

## Related Files

- Contract: `backend/contracts/asyncapi.yaml` (lines 234-252)
- Implementation: `backend/src/websocket/gmAuth.js` (lines 87-138)
- Test: `backend/tests/contract/websocket/score-events.test.js`
- Test Helpers: `backend/tests/helpers/websocket-helpers.js`
- Test Server: `backend/tests/helpers/integration-test-server.js`

## Next Steps

1. Add debug logging to trace sync:full emission
2. Verify handleGmIdentify is called with correct parameters
3. Check if room join happens before or after sync:full emission
4. Verify emitWrapped actually emits the event
5. Check if test environment has different Socket.io behavior

## Impact

**Blocks**:
- Task 2.8 completion (WebSocket room join timing fix)
- All score-events contract tests (2 tests)
- Potentially other contract tests using broadcast events

**Workaround**: None currently - tests must pass before moving to next tasks.
