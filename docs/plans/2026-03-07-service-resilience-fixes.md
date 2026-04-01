# Service Resilience Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix silent failure modes, missing recovery paths, and observability gaps in the venue experience services (audio, bluetooth, lighting, VLC, cue engine, display control, sound) that could degrade the game experience without GM awareness.

**Architecture:** Each fix targets a specific service's resilience gap. These are independent of each other and independent of the layer transition cleanup (`2026-03-07-layer-transition-cleanup.md`). They can be done in any order. Prioritized by gameplay impact.

**Tech Stack:** Node.js EventEmitter services, ProcessMonitor utility, PipeWire/PulseAudio, BlueZ D-Bus, Home Assistant WebSocket, Jest tests

---

## Priority Tiers

**Tier 1 — Silent failures the GM can't see (fix first):**
- Task 1: ProcessMonitor gave-up → health reporting
- Task 2: Cue engine video_busy hold timeout too aggressive

**Tier 2 — Missing recovery paths (fix next):**
- Task 3: Lighting auth_invalid permanent death
- Task 4: Display control stuck in VIDEO mode on VLC failure

**Tier 3 — Observability gaps (quick wins):**
- Task 5: A2DP profile enforcement failure detection
- Task 6: Sound service missing from sync:full
- Task 7: Combine-sink pw-loopback health notification

**Tier 4 — Maintenance hazards (when time permits):**
- Task 8: EVENT_NORMALIZERS silent payload mismatch

---

## Tier 1: Silent Failures

### Task 1: ProcessMonitor Gave-Up → Health Reporting

When a ProcessMonitor gives up (5 consecutive failures), it emits `gave-up` but nobody listens. The service continues to appear healthy. Four services are affected.

The fix: each service listens for `gave-up` on its monitor and reports health down via serviceHealthRegistry. The GM sees a red indicator in the admin panel.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (startSinkMonitor)
- Modify: `backend/src/services/bluetoothService.js` (startDeviceMonitor)
- Modify: `backend/src/services/mprisPlayerBase.js` (startPlaybackMonitor)
- Test: `backend/tests/unit/services/audioRoutingService.test.js`
- Test: `backend/tests/unit/services/mprisPlayerBase.test.js`
- Test: `backend/tests/unit/services/bluetoothService.test.js`

**Changes to `audioRoutingService.js` in `startSinkMonitor()` (after line 1068):**
```javascript
this._sinkMonitor.on('gave-up', ({ failures }) => {
  logger.error(`pactl subscribe monitor gave up after ${failures} failures`);
  registry.report('audio', 'down', `Sink monitor failed ${failures} times`);
});
```

**Changes to `bluetoothService.js` in `startDeviceMonitor()` (after line 453):**
```javascript
this._deviceMonitor.on('gave-up', ({ failures }) => {
  logger.error(`BlueZ D-Bus monitor gave up after ${failures} failures`);
  registry.report('bluetooth', 'down', `Device monitor failed ${failures} times`);
});
```

**Changes to `mprisPlayerBase.js` in `startPlaybackMonitor()` (after line 219):**
```javascript
this._playbackMonitor.on('gave-up', ({ failures }) => {
  logger.error(`[${this._label}] D-Bus playback monitor gave up after ${failures} failures`);
  this._setConnected(false);
});
```
Note: `_setConnected(false)` calls `registry.report(healthServiceId, 'down', ...)` — this covers both VLC and Spotify since they both extend MprisPlayerBase.

**Tests:** For each service, add a test that:
1. Creates the monitor
2. Simulates `gave-up` event on the monitor
3. Asserts `registry.report()` was called with `'down'` status

**Verify:** `cd backend && npm test`

**Commit:** `fix: report health down when ProcessMonitor gives up (audio, bluetooth, MPRIS)`

---

### Task 2: Cue Engine Video-Busy Hold Timeout

When a cue fires while a video is playing, it's held with a `video_busy` reason and auto-discarded after 10 seconds. The GM has a 10-second window to notice and release it — too aggressive for an immersive game where the GM is watching the video or helping a team.

The fix: increase the timeout to 60 seconds. The GM has a full minute to notice the held item in the admin panel. `service_down` holds remain indefinite (no change).

**Files:**
- Modify: `backend/src/services/cueEngineService.js:512-524`
- Test: `backend/tests/unit/services/cueEngineService.test.js`

**Changes to `cueEngineService.js`:**

Add a named constant at the top of the file (near `heldIdCounter`):
```javascript
/** Auto-discard timeout for video_busy held cues (ms). Long enough for GM to notice. */
const VIDEO_BUSY_HOLD_TIMEOUT = 60000;
```

Replace the hardcoded `10000` on line 524:
```javascript
}, VIDEO_BUSY_HOLD_TIMEOUT);
```

**Update tests:** Any test that asserts on the 10-second timeout needs updating to 60 seconds (or to use the named constant via `jest.advanceTimersByTime`).

**Verify:** `cd backend && npm test`

**Commit:** `fix: increase video_busy cue hold timeout from 10s to 60s`

---

## Tier 2: Missing Recovery Paths

### Task 3: Lighting auth_invalid Recovery

When HA returns `auth_invalid`, the WebSocket stops permanently (`_wsStopped = true`) with no recovery path. If the token is rotated mid-game, the GM loses scene activation detection forever.

The fix: instead of permanent death, report health down, log the error clearly, and allow `init()` (via systemReset or manual reconnect) to retry with the same or updated token. The `_wsStopped` flag should prevent auto-reconnect (correct — don't spam a bad token), but should be clearable by `reset()` (already is — line 450) and by explicit re-init.

**Files:**
- Modify: `backend/src/services/lightingService.js:211-215`

**Changes to `lightingService.js`:**

Replace the `auth_invalid` handler:
```javascript
case 'auth_invalid':
  logger.error('HA WebSocket auth failed — token may be expired or rotated. Re-init or restart required.');
  if (this._ws) this._ws.close();
  this._wsStopped = true; // Don't auto-reconnect with bad token
  registry.report('lighting', 'down', 'Auth failed — token invalid');
  break;
```

The key addition is `registry.report('lighting', 'down', ...)`. Currently, the service goes permanently dead without telling the health registry. After this change, the GM sees a red indicator with a clear message. `reset()` already sets `_wsStopped = false` (line 450), so between-game reset allows re-init to retry.

**Verify:** `cd backend && npm test`

**Commit:** `fix: lighting reports health down on auth_invalid (was silent permanent death)`

---

### Task 4: Display Control Recovery on VLC Failure

When the pre-play hook switches to VIDEO mode and then VLC fails to play, the display stays in VIDEO mode (black/stale screen) until the entire queue drains via `video:idle`. If there are more items in the queue, or if the queue gets stuck, the TV shows nothing useful.

The fix: listen for `video:failed` events and revert the display mode, same as `video:idle` does. This catches individual video failures rather than waiting for the whole queue to empty.

**Files:**
- Modify: `backend/src/services/displayControlService.js` (init method)
- Test: `backend/tests/unit/services/displayControlService.test.js`

**Changes to `displayControlService.js` in `init()` (after line 58):**

Add a `video:failed` listener alongside the existing `video:idle` listener:
```javascript
// Recover display mode if a video fails to play (VLC error, missing file, etc.)
// Without this, a failed video leaves the display in VIDEO mode (black screen)
// until the queue fully drains.
this._boundVideoFailedHandler = () => this._handleVideoComplete();
this.videoQueueService.on('video:failed', this._boundVideoFailedHandler);
```

**Update `reset()` method** to remove the new listener:
```javascript
if (this.videoQueueService) {
  this.videoQueueService.removeListener('video:idle', this._boundVideoIdleHandler);
  this.videoQueueService.removeListener('video:failed', this._boundVideoFailedHandler);
}
```

**Verify:** `cd backend && npm test`

**Commit:** `fix: display control recovers on video:failed (was stuck in VIDEO mode)`

---

## Tier 3: Observability Gaps

### Task 5: A2DP Profile Enforcement Failure Detection

When `_enforceA2DPProfile()` fails, it logs a warning but the GM has no visibility. Audio sounds garbled (HFP mode) with no diagnostic info in the admin panel.

The fix: emit a `profile:warning` event that broadcasts.js can pick up, or include the profile state in the bluetooth `getState()` response. The simpler approach: include the last enforcement result in `getState()`.

**Files:**
- Modify: `backend/src/services/bluetoothService.js` (_enforceA2DPProfile, getState)

**Changes:**

Add tracking field in constructor:
```javascript
this._a2dpEnforcementFailed = new Set(); // addresses where A2DP enforcement failed
```

In `_enforceA2DPProfile()` catch block (line 349-353):
```javascript
} catch (err) {
  logger.warn('A2DP profile enforcement failed (device may not support A2DP)', {
    address, error: err.message,
  });
  this._a2dpEnforcementFailed.add(address);
}
```

On success (after line 348):
```javascript
this._a2dpEnforcementFailed.delete(address);
```

In `getState()`, include the warning:
```javascript
// In the devices array mapping, add:
a2dpFailed: this._a2dpEnforcementFailed.has(device.address),
```

Clear in `reset()`:
```javascript
this._a2dpEnforcementFailed.clear();
```

**Verify:** `cd backend && npm test`

**Commit:** `fix: expose A2DP enforcement failures in bluetooth getState()`

---

### Task 6: Add Sound Service to sync:full

`buildSyncFullPayload()` doesn't include sound state. On GM reconnect, any currently-playing sound won't appear in the admin panel.

**Files:**
- Modify: `backend/src/websocket/syncHelpers.js`

**Changes:**

Add `soundService` to the function parameter destructure (line 33):
```javascript
async function buildSyncFullPayload({
  sessionService,
  transactionService,
  videoQueueService,
  bluetoothService,
  audioRoutingService,
  lightingService,
  gameClockService,
  cueEngineService,
  spotifyService,
  soundService,        // ADD
  deviceFilter = {},
}) {
```

Add sound state to the return object (before `return {`):
```javascript
const sound = soundService ? soundService.getState() : { playing: [] };
```

Include in return:
```javascript
return {
  // ... existing fields ...
  sound,
};
```

**Then update ALL callers of `buildSyncFullPayload`** to pass `soundService`:
- `backend/src/websocket/broadcasts.js` (scores:reset handler ~line 326, offline:queue:processed handler ~line 366)
- `backend/src/websocket/gmAuth.js` (~line 142)
- `backend/src/server.js` (~line 77)
- `backend/tests/helpers/integration-test-server.js` (if it calls buildSyncFullPayload)

Each caller needs `soundService` added to the service bag. Import where needed:
```javascript
const soundService = require('../services/soundService');
```

**GM Scanner side:** `networkedSession.js` sync:full handler should populate the StateStore `sound` domain if present:
```javascript
if (payload.sound) this._store.update('sound', payload.sound);
```

**Verify:** `cd backend && npm test`

**Commit:** `fix: include sound state in sync:full payload`

---

### Task 7: Combine-Sink pw-loopback Health Notification

When a `pw-loopback` process exits unexpectedly, `_onCombineLoopbackExit()` sets `_combineSinkActive = false` but doesn't notify the GM. One speaker goes silent with no admin panel indication.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (_onCombineLoopbackExit)

**Changes:**

In `_onCombineLoopbackExit()`, after setting `_combineSinkActive = false`, emit a state change:
```javascript
// Notify GM that combine-sink degraded (one speaker lost)
this.emit('routing:changed', this.getState());
logger.warn('Combine-sink degraded — pw-loopback process exited. One speaker may be silent.');
```

The existing `routing:changed` event is already wired in broadcasts.js to push `service:state` domain `audio`. The GM will see the combine-sink status change in the audio routing panel.

**Verify:** `cd backend && npm test`

**Commit:** `fix: notify GM when combine-sink pw-loopback exits (was silent)`

---

## Tier 4: Maintenance Hazards

### Task 8: EVENT_NORMALIZERS Payload Validation

The cue engine's EVENT_NORMALIZERS assume specific payload shapes. If a service changes its event payload, normalizer fields silently return `undefined` and cues never match.

The fix: add a warning log when a normalizer produces mostly-undefined output, indicating a payload shape mismatch.

**Files:**
- Modify: `backend/src/services/cueEngineService.js` (handleGameEvent)

**Changes in `handleGameEvent()` (around line 404-405):**

After normalization:
```javascript
const normalizer = EVENT_NORMALIZERS[eventName];
const context = normalizer ? normalizer(payload) : payload;

// Warn if normalizer produced mostly-undefined fields (payload shape may have changed)
if (normalizer && context) {
  const fields = Object.entries(context);
  const undefinedCount = fields.filter(([, v]) => v === undefined).length;
  if (fields.length > 0 && undefinedCount === fields.length) {
    logger.warn(`[CueEngine] EVENT_NORMALIZER for "${eventName}" produced all-undefined fields — payload shape may have changed`, {
      payloadKeys: Object.keys(payload || {}),
    });
  }
}
```

This only warns when ALL fields are undefined (complete mismatch), not partial — partial undefined is normal (e.g., optional fields).

**Verify:** `cd backend && npm test`

**Commit:** `fix: warn when cue engine EVENT_NORMALIZER produces all-undefined fields`

---

## Verification Checklist

```bash
# All backend tests
cd backend && npm test

# Integration tests
cd backend && npm run test:integration

# GM Scanner tests (only if Task 6 touches GM Scanner)
cd ALNScanner && npm test
```

---

## What This Does NOT Change

- ProcessMonitor `maxFailures` default (stays at 5) — the fix is notification, not prevention
- Cue engine `service_down` hold behavior — stays indefinite (correct behavior)
- Lighting HTTP polling interval (30s) — stays the same
- VLC custom restart logic — already handles crash recovery, just needed owner resolution (separate plan)
- Bluetooth interactive pairing state machine — complex but functional
- Display control lock pattern — interleave window is theoretical, not worth the complexity to fix
- Service health registry hardcoded list — maintenance hazard but not a gameplay risk
