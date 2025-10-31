# VLC Video Playback Fix - Design Document

**Date:** 2025-10-31
**Status:** Approved
**Implementation Approach:** Service-First (bottom-up)

## Problem Statement

Videos are being cut short after 5-7 seconds instead of playing to completion (e.g., jaw001.mp4 plays 5-7 seconds instead of expected 77 seconds).

### Root Cause Analysis

**Primary Issue:** `vlcService.setLoop()` bug
- Sends VLC toggle commands (`pl_repeat`) without checking current state
- After `pl_empty` (clear playlist), VLC loop state is unknown
- Toggle puts VLC in undefined state
- VLC reports `state: 'stopped'` instead of `'playing'`

**Secondary Issue:** Grace period timeout
- `monitorVlcPlayback()` allows 3 seconds of non-playing state before marking video complete
- When VLC is in bad state, grace period expires → video marked complete prematurely

**Tertiary Issue:** Arbitrary delays instead of condition-based waiting
- 1.5-second delay before monitoring starts (guessing at transition time)
- 1-second delay + 5 retries for duration metadata (guessing at load time)
- Violates condition-based-waiting patterns

## Solution Design

### Architecture Overview

**Files Modified:**
1. `backend/src/services/vlcService.js` - Fix VLC state management
2. `backend/src/services/videoQueueService.js` - Add condition-based waiting
3. `backend/ecosystem.config.js` - Add VLC startup flag

**Implementation Sequence (Service-First):**
1. Layer 1: VLC Service Foundation (getStatus, setLoop)
2. Layer 2: Condition-Based Waiting (waitForVlcState helper)
3. Layer 3: Video Queue Integration (remove grace period, remove delays)
4. Layer 4: VLC Initialization (--no-loop flag)

### Layer 1: VLC Service Foundation

**File:** `backend/src/services/vlcService.js`

#### Change 1.1: Extend getStatus() to Return Loop/Repeat Fields

**Location:** Lines 312-346

**Add to response object:**
```javascript
loop: status.loop || false,      // Boolean from VLC
repeat: status.repeat || false,  // Boolean from VLC
```

**Add to disconnected/error responses:**
```javascript
loop: false,
repeat: false,
```

**Rationale:** Required for read-modify-write pattern in setLoop()

#### Change 1.2: Rewrite setLoop() with Read-Modify-Write Pattern

**Location:** Lines 475-490

**New Implementation:**
```javascript
async setLoop(enabled) {
  if (!this.connected) {
    logger.warn('VLC not connected - loop setting simulated');
    return;
  }

  try {
    // STEP 1: Read current state
    const status = await this.getStatus();
    const currentLoopState = status.loop || false;

    // STEP 2: Only toggle if current state differs from desired state
    if (currentLoopState !== enabled) {
      await this.client.get('/requests/status.json', {
        params: { command: 'pl_loop' },  // pl_loop is a toggle
      });
      logger.info(`Playlist loop toggled to ${enabled ? 'enabled' : 'disabled'}`);

      // STEP 3: Verify the toggle worked (defensive)
      const verifyStatus = await this.getStatus();
      if (verifyStatus.loop !== enabled) {
        logger.warn('Loop state verification failed', {
          desired: enabled,
          actual: verifyStatus.loop
        });
      }
    } else {
      logger.debug(`Playlist loop already ${enabled ? 'enabled' : 'disabled'}, no toggle needed`);
    }
  } catch (error) {
    logger.error('Failed to set loop mode', error);
    throw error; // Don't silently fail - critical for playback
  }
}
```

**Key Decisions:**
- **Read before write:** Prevents blind toggling
- **Verification step:** Catches silent VLC failures
- **Throw on error:** Loop state is critical, silent failure causes hard-to-debug issues
- **Debug logging:** Helps trace loop state during troubleshooting

### Layer 2: Condition-Based Waiting

**File:** `backend/src/services/videoQueueService.js`

#### Change 2.1: Add waitForVlcState() Helper Function

**Location:** After line 222, before monitorVlcPlayback()

**Implementation:**
```javascript
/**
 * Wait for VLC to reach expected state (condition-based waiting pattern)
 * @param {Array<string>} expectedStates - States to wait for (e.g., ['playing'])
 * @param {string} description - Description for timeout error message
 * @param {number} timeoutMs - Timeout in milliseconds (default 5000)
 * @returns {Promise<Object>} VLC status when condition met
 * @throws {Error} If timeout exceeded
 * @private
 */
async waitForVlcState(expectedStates, description, timeoutMs = 5000) {
  const startTime = Date.now();

  while (true) {
    try {
      const status = await vlcService.getStatus();

      // Check if VLC reached expected state
      if (expectedStates.includes(status.state)) {
        logger.debug('VLC reached expected state', {
          expectedStates,
          actualState: status.state,
          elapsed: Date.now() - startTime
        });
        return status;
      }

      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        throw new Error(
          `Timeout waiting for ${description} after ${timeoutMs}ms. ` +
          `Expected states: [${expectedStates.join(', ')}], ` +
          `Current state: ${status.state}`
        );
      }

      // Poll every 100ms
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      // If it's our timeout error, rethrow it
      if (error.message.includes('Timeout waiting for')) {
        throw error;
      }

      // VLC connection error - check if we've exceeded timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(
          `VLC connection failed while waiting for ${description}: ${error.message}`
        );
      }

      // Keep trying (VLC might be recovering)
      logger.debug('VLC status check failed, retrying', { error: error.message });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

**Key Decisions:**
- **100ms poll interval:** Fast enough to catch transitions, slow enough to not spam VLC
- **Clear timeout errors:** Include expected vs actual state for debugging
- **Graceful error handling:** If VLC connection drops temporarily, keep polling
- **Returns status object:** Caller gets fresh VLC state (duration, position, etc.)

**Pattern Source:** Follows superpowers:condition-based-waiting skill

### Layer 3: Video Queue Integration

**File:** `backend/src/services/videoQueueService.js`

#### Change 3.1: Replace Arbitrary Delays with Condition-Based Waiting

**Location:** playVideo() method, lines 125-163

**Remove:**
- 1-second arbitrary delay (`await new Promise(resolve => setTimeout(resolve, 1000))`)
- Retry loop for duration metadata (5 retries with 500ms delays)

**Replace with:**
```javascript
try {
  // Wait for VLC to actually start playing (condition-based waiting)
  const status = await this.waitForVlcState(
    ['playing'],
    'VLC to start playing video',
    5000  // 5 second timeout (generous for Pi 4)
  );

  // VLC is now playing - duration is reliable
  let duration = status.length || 0;

  if (duration <= 1) {
    // Fallback to default if VLC still hasn't loaded metadata
    duration = this.getVideoDuration(queueItem.tokenId);
    logger.warn('VLC playing but no duration metadata, using default', {
      tokenId: queueItem.tokenId,
      defaultDuration: duration
    });
  } else {
    logger.debug('Got reliable duration from playing VLC', {
      tokenId: queueItem.tokenId,
      duration
    });
  }

  // Update queue item with real duration
  queueItem.duration = duration;

  const expectedEndTime = queueItem.calculateExpectedEndTime(duration);

  // Emit play event
  this.emit('video:started', {
    queueItem,
    duration,
    expectedEndTime,
  });

  logger.info('Video playback started via VLC', {
    itemId: queueItem.id,
    tokenId: queueItem.tokenId,
    duration,
    vlcConnected: vlcService.connected,
  });

  // Start monitoring immediately (VLC is confirmed playing)
  this.monitorVlcPlayback(queueItem, duration);

} catch (error) {
  // waitForVlcState timed out or VLC failed
  logger.error('Failed to confirm VLC playback started', {
    error: error.message,
    itemId: queueItem.id,
    tokenId: queueItem.tokenId
  });
  throw error;
}
```

#### Change 3.2: Remove Monitoring Delay Timer

**Location:** Lines 186-190

**Delete entire block:**
```javascript
// DELETE THIS:
this.monitoringDelayTimer = setTimeout(() => {
  this.monitoringDelayTimer = null;
  this.monitorVlcPlayback(queueItem, duration);
}, 1500);
```

**Rationale:** Monitoring starts immediately after `waitForVlcState()` confirms VLC is playing

#### Change 3.3: Remove Grace Period from monitorVlcPlayback()

**Location:** Lines 239-267

**Remove:**
```javascript
// DELETE GRACE PERIOD LOGIC:
let graceCounter = 0;
const maxGracePeriod = 3;

if (status.state !== 'playing' && status.state !== 'paused') {
  graceCounter++;

  if (graceCounter >= maxGracePeriod) {
    clearInterval(this.progressTimer);
    this.progressTimer = null;
    this.completePlayback(queueItem);
    return;
  }

  logger.debug('Video in transition state', {
    state: status.state,
    graceCounter,
    maxGracePeriod
  });
  return;
}

graceCounter = 0;
```

**Replace with:**
```javascript
// Simplified logic - no grace period needed
if (status.state !== 'playing' && status.state !== 'paused') {
  // Video stopped - it's actually complete
  clearInterval(this.progressTimer);
  this.progressTimer = null;
  this.completePlayback(queueItem);
  return;
}
```

**Rationale:** We waited for VLC to actually be playing before monitoring, so 'stopped' state is trustworthy

### Layer 4: VLC Initialization

**File:** `backend/ecosystem.config.js`

#### Change 4.1: Add --no-loop Flag to VLC Startup

**Location:** Line 100, vlc-http app configuration

**Old:**
```javascript
args: '--intf http --http-password vlc --http-host 0.0.0.0 --http-port 8080 -A alsa --alsa-audio-device=hdmi:CARD=vc4hdmi0,DEV=0 --fullscreen --video-on-top --no-video-title-show --no-video-deco --no-osd --codec=avcodec --avcodec-hw=v4l2_m2m',
```

**New:**
```javascript
args: '--no-loop --intf http --http-password vlc --http-host 0.0.0.0 --http-port 8080 -A alsa --alsa-audio-device=hdmi:CARD=vc4hdmi0,DEV=0 --fullscreen --video-on-top --no-video-title-show --no-video-deco --no-osd --codec=avcodec --avcodec-hw=v4l2_m2m',
```

**Rationale:**
- Sets global default for VLC playlist behavior
- Prevents flip-flopping behavior documented in Stack Overflow research
- Idle loop handled in code via `vlcService.initializeIdleLoop()` which explicitly enables loop
- Requires VLC restart: `pm2 restart vlc-http`

## Testing Plan

**Scope:** Manual testing only

### Test 1: VLC Loop State Control
1. Start system: `pm2 restart all`
2. Check VLC starts with loop disabled:
   ```bash
   curl -u :vlc http://localhost:8080/requests/status.json | jq .loop
   # Expected: false
   ```
3. Verify idle loop enables after init (wait 2 seconds, check again)
   ```bash
   # Expected: true
   ```

### Test 2: Video Playback (Full Duration)
1. Scan a video token with ESP32 (e.g., jaw001)
2. Watch TV screen - video should play completely (77 seconds for jaw001)
3. Check logs:
   ```bash
   pm2 logs aln-orchestrator --lines 50 | grep "playback completed"
   ```
4. Verify duration matches expected (should show ~77 seconds, not 5-7)

### Test 3: Multiple Video Queue
1. Scan 3 video tokens rapidly
2. All 3 should play to completion
3. System returns to idle loop after last video

### Test 4: Loop State Logging
1. Check logs during video transition:
   ```bash
   pm2 logs | grep "loop"
   ```
2. Should see "already disabled" messages (no unnecessary toggles)
3. Should see "toggled to enabled" when returning to idle loop

### Success Criteria
- ✅ Videos play to full duration (no 5-7 second cutoff)
- ✅ No "Video in transition state" warnings
- ✅ No unnecessary loop toggles in logs
- ✅ Idle loop resumes after videos complete

## Deployment Process

**Target:** Production Pi 4 (immediate deployment)

1. Implement all changes in working directory (main branch)
2. Manual testing per plan above
3. If tests pass:
   - Commit changes: `git add . && git commit -m "fix: VLC video playback duration bug with condition-based waiting"`
   - Restart PM2: `pm2 restart all`
   - Verify production: Scan test token, watch full playback
4. If tests fail:
   - Debug with additional logging
   - Iterate on fix

## Risk Assessment

**Low Risk Changes:**
- Layer 1 (VLC Service): Purely additive (new fields in getStatus, safer setLoop)
- Layer 4 (VLC Init): Simple flag addition, easily reversible

**Medium Risk Changes:**
- Layer 2 (Condition-Based Waiting): New code path, but follows proven pattern
- Layer 3 (Video Queue): Removes defensive code (grace period), relies on VLC state being accurate

**Mitigation:**
- Service-First approach allows testing each layer independently
- Comprehensive manual testing plan
- Production deployment allows immediate rollback if issues found

## References

- **Root Cause Analysis:** Traced in session 2025-10-31
- **VLC HTTP API Research:** https://wiki.videolan.org/VLC_HTTP_requests/
- **VLC Loop Toggle Behavior:** https://stackoverflow.com/questions/6430945/
- **Condition-Based Waiting Pattern:** superpowers:condition-based-waiting skill

## Future Improvements (Out of Scope)

- Add unit tests for `setLoop()` read-modify-write logic
- Add integration test for condition-based waiting
- Add E2E test for full video playback flow
- Consider VLC restart detection and recovery
