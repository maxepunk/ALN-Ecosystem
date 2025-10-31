# VLC Video Playback Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5-7 second video cutoff bug by implementing condition-based waiting and fixing VLC loop state management

**Architecture:** Service-First (bottom-up) approach - fix vlcService foundation, add condition-based waiting helper, integrate into videoQueueService, then add VLC initialization flag

**Tech Stack:** Node.js, VLC HTTP API, EventEmitter patterns, PM2 process management

**Testing Strategy:** Manual testing only (no automated tests for this fix)

---

## Task 1: Extend vlcService.getStatus() to Return Loop/Repeat Fields

**Files:**
- Modify: `src/services/vlcService.js:312-346`

**Step 1: Add loop/repeat fields to disconnected response**

Locate the disconnected return object (lines 314-321):

```javascript
if (!this.connected) {
  return {
    connected: false,
    state: 'disconnected',
    currentItem: null,
    position: 0,
    length: 0,
    volume: 0,
    loop: false,      // ADD THIS LINE
    repeat: false,    // ADD THIS LINE
  };
}
```

**Step 2: Add loop/repeat fields to successful response**

Locate the successful return object (lines 328-337):

```javascript
return {
  connected: true,
  state: status.state,
  currentItem: status.information?.category?.meta?.filename || null,
  position: status.position || 0,
  length: status.length || 0,
  time: status.time || 0,
  volume: status.volume || 0,
  fullscreen: status.fullscreen || false,
  loop: status.loop || false,      // ADD THIS LINE
  repeat: status.repeat || false,  // ADD THIS LINE
};
```

**Step 3: Add loop/repeat fields to error response**

Locate the error return object (lines 340-344):

```javascript
return {
  connected: false,
  state: 'error',
  error: error.message,
  loop: false,      // ADD THIS LINE
  repeat: false,    // ADD THIS LINE
};
```

**Step 4: Verify changes syntactically**

Run: `node -c src/services/vlcService.js`
Expected: No output (syntax valid)

**Step 5: Manual verification - check VLC status includes loop field**

Run (if VLC is running):
```bash
curl -u :vlc http://localhost:8080/requests/status.json | jq '.loop, .repeat'
```
Expected: Two boolean values (true or false)

**Step 6: Commit**

```bash
git add src/services/vlcService.js
git commit -m "feat(vlc): add loop and repeat fields to getStatus() response

- Extends getStatus() to return loop and repeat boolean fields from VLC
- Required for read-modify-write pattern in setLoop()
- Adds fields to all response types: connected, disconnected, error"
```

---

## Task 2: Rewrite vlcService.setLoop() with Read-Modify-Write Pattern

**Files:**
- Modify: `src/services/vlcService.js:475-490`

**Step 1: Backup current setLoop() implementation**

Current implementation (lines 475-490) for reference:
```javascript
async setLoop(enabled) {
  if (!this.connected) {
    logger.warn('VLC not connected - loop setting simulated');
    return;
  }

  try {
    const command = enabled ? 'pl_loop' : 'pl_repeat';
    await this.client.get('/requests/status.json', {
      params: { command },
    });
    logger.info(`Playlist loop ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    logger.error('Failed to set loop mode', error);
  }
}
```

**Step 2: Replace with read-modify-write implementation**

Replace the entire function (lines 475-490):

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
    throw error; // Don't silently fail - this is critical for video playback
  }
}
```

**Step 3: Verify changes syntactically**

Run: `node -c src/services/vlcService.js`
Expected: No output (syntax valid)

**Step 4: Commit**

```bash
git add src/services/vlcService.js
git commit -m "fix(vlc): implement read-modify-write pattern for setLoop()

- Fixes bug where setLoop() sent toggle commands without checking current state
- Now reads current loop state, only toggles if different from desired
- Adds verification step to catch silent VLC failures
- Throws error on failure (critical for video playback flow)
- Adds debug logging for no-op cases (troubleshooting aid)

Root cause: VLC pl_loop command is a toggle, not a set operation.
Blind toggling after pl_empty (clear playlist) put VLC in undefined state."
```

---

## Task 3: Add waitForVlcState() Helper to videoQueueService

**Files:**
- Modify: `src/services/videoQueueService.js` (add after line 222, before monitorVlcPlayback)

**Step 1: Locate insertion point**

Find the `playVideo()` method (ends around line 222) and the `monitorVlcPlayback()` method (starts around line 230).

Insert the new helper function BETWEEN these two methods.

**Step 2: Add waitForVlcState() helper function**

Insert this complete function after line 222:

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
          return status; // Success!
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

        // Poll every 100ms (not too fast, not too slow)
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

        // Otherwise, keep trying (VLC might be recovering)
        logger.debug('VLC status check failed, retrying', { error: error.message });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
```

**Step 3: Verify changes syntactically**

Run: `node -c src/services/videoQueueService.js`
Expected: No output (syntax valid)

**Step 4: Commit**

```bash
git add src/services/videoQueueService.js
git commit -m "feat(video): add waitForVlcState() condition-based waiting helper

- Implements condition-based waiting pattern from superpowers skill
- Polls VLC status every 100ms until expected state reached
- Throws clear timeout error with expected vs actual state
- Handles temporary VLC connection drops gracefully
- Returns fresh VLC status for immediate use by caller

Replaces arbitrary delays (1s, 1.5s, 3s grace periods) with actual
condition checking. Follows best practice: wait for condition, not guess."
```

---

## Task 4: Update playVideo() to Use Condition-Based Waiting

**Files:**
- Modify: `src/services/videoQueueService.js:125-190`

**Step 1: Locate the section to replace**

Find lines 125-163 in the `playVideo()` method. This section starts with:
```javascript
// Wait for VLC to switch to the new video and load metadata
await new Promise(resolve => setTimeout(resolve, 1000));
```

And ends before:
```javascript
} else {
  // Only in test mode without VLC - use timer simulation
```

**Step 2: Delete lines 127-163 (arbitrary delay + retry loop)**

Remove the entire block from line 127 to line 163:
- Delete: `await new Promise(resolve => setTimeout(resolve, 1000));`
- Delete: The entire `let duration = 0; let retries = 5; while (retries > 0) { ... }` block
- Delete: The fallback duration warning and assignment

**Step 3: Replace with condition-based waiting implementation**

Insert this code at line 127 (where you just deleted):

```javascript
        // Wait for VLC to actually start playing (condition-based waiting)
        // This replaces arbitrary 1000ms delay + retry loop
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

        // Emit play event with VLC data
        logger.debug('Emitting video:started with VLC data', { tokenId: queueItem.tokenId, duration });
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
```

**Step 4: Delete monitoring delay timer (lines 186-190)**

Find and delete this entire block:
```javascript
        // Give VLC a moment to transition before monitoring (especially from idle loop)
        this.monitoringDelayTimer = setTimeout(() => {
          this.monitoringDelayTimer = null;
          // Monitor VLC status for completion
          this.monitorVlcPlayback(queueItem, duration);
        }, 1500); // 1.5 second delay before monitoring starts
```

Replace with: (nothing - monitoring now starts immediately in the code above)

**Step 5: Verify changes syntactically**

Run: `node -c src/services/videoQueueService.js`
Expected: No output (syntax valid)

**Step 6: Check the changes visually**

Run: `git diff src/services/videoQueueService.js`
Expected: Should show deletion of arbitrary delays and addition of waitForVlcState call

**Step 7: Commit**

```bash
git add src/services/videoQueueService.js
git commit -m "fix(video): replace arbitrary delays with condition-based waiting in playVideo()

- Replaces 1000ms delay + 5-retry loop with waitForVlcState(['playing'])
- Removes 1500ms monitoring delay timer (no longer needed)
- Monitoring starts immediately after VLC confirms playing state
- Duration metadata now reliable (VLC confirmed loaded)

Fixes: Videos starting to play but monitoring assuming they failed due
to grace period expiring during arbitrary delay window."
```

---

## Task 5: Remove Grace Period from monitorVlcPlayback()

**Files:**
- Modify: `src/services/videoQueueService.js:230-315`

**Step 1: Locate grace period variables**

Find these variable declarations near the start of `monitorVlcPlayback()` (around lines 239-241):

```javascript
    // Grace period tracking for video transitions
    let graceCounter = 0;
    const maxGracePeriod = 3; // Allow up to 3 checks (3 seconds) of non-playing state
```

Delete these two lines.

**Step 2: Locate grace period logic in checkStatus**

Find the grace period handling block (around lines 248-267):

```javascript
        // Check if still playing
        if (status.state !== 'playing' && status.state !== 'paused') {
          // Video might be transitioning, use grace period
          graceCounter++;

          if (graceCounter >= maxGracePeriod) {
            // Video has been stopped for too long, consider it complete
            clearInterval(this.progressTimer);
            this.progressTimer = null;
            this.completePlayback(queueItem);
            return;
          }

          // Still in grace period, wait for next check
          logger.debug('Video in transition state', {
            state: status.state,
            graceCounter,
            maxGracePeriod
          });
          return;
        }

        // Video is playing/paused, reset grace counter
        graceCounter = 0;
```

**Step 3: Replace with simplified logic**

Replace the entire block above with:

```javascript
        // Check if still playing or paused
        if (status.state !== 'playing' && status.state !== 'paused') {
          // Video stopped - it's actually complete (no grace period needed)
          // We waited for 'playing' state before monitoring, so 'stopped' is real
          clearInterval(this.progressTimer);
          this.progressTimer = null;
          this.completePlayback(queueItem);
          return;
        }
```

**Step 4: Verify changes syntactically**

Run: `node -c src/services/videoQueueService.js`
Expected: No output (syntax valid)

**Step 5: Check the changes visually**

Run: `git diff src/services/videoQueueService.js | head -50`
Expected: Should show deletion of grace period tracking and simplified state check

**Step 6: Commit**

```bash
git add src/services/videoQueueService.js
git commit -m "fix(video): remove 3-second grace period from monitorVlcPlayback()

- Deletes graceCounter and maxGracePeriod tracking
- Simplifies state check: if not playing/paused, video is complete
- Grace period no longer needed because waitForVlcState() ensures VLC
  actually playing before monitoring starts
- 'stopped' state is now trustworthy (not a transition artifact)

Root cause of 5-7 second cutoff: Grace period expired while VLC was in
bad state from buggy setLoop(), causing premature completion detection."
```

---

## Task 6: Add --no-loop Flag to VLC Startup

**Files:**
- Modify: `ecosystem.config.js:100`

**Step 1: Locate VLC args configuration**

Find the `vlc-http` app configuration, specifically line 100:

```javascript
args: '--intf http --http-password vlc --http-host 0.0.0.0 --http-port 8080 -A alsa --alsa-audio-device=hdmi:CARD=vc4hdmi0,DEV=0 --fullscreen --video-on-top --no-video-title-show --no-video-deco --no-osd --codec=avcodec --avcodec-hw=v4l2_m2m',
```

**Step 2: Add --no-loop flag at the beginning**

Replace line 100 with:

```javascript
args: '--no-loop --intf http --http-password vlc --http-host 0.0.0.0 --http-port 8080 -A alsa --alsa-audio-device=hdmi:CARD=vc4hdmi0,DEV=0 --fullscreen --video-on-top --no-video-title-show --no-video-deco --no-osd --codec=avcodec --avcodec-hw=v4l2_m2m',
```

**Step 3: Verify changes visually**

Run: `git diff ecosystem.config.js`
Expected: Should show `--no-loop` added at the beginning of args string

**Step 4: Commit**

```bash
git add ecosystem.config.js
git commit -m "fix(vlc): add --no-loop flag to VLC startup args

- Sets VLC global default: playlist won't loop by default
- Prevents loop state flip-flopping documented in Stack Overflow
- Idle loop handled separately by vlcService.initializeIdleLoop()
- Requires VLC restart: pm2 restart vlc-http

Note: This change takes effect on next VLC restart, not immediately."
```

---

## Task 7: Manual Testing - Pre-deployment Verification

**Files:**
- None (testing only)

**Step 1: Restart VLC to apply --no-loop flag**

Run: `pm2 restart vlc-http`
Expected:
```
[PM2] Applying action restartProcessId on app [vlc-http](ids: [ 1 ])
[PM2] [vlc-http](1) ✓
```

**Step 2: Wait for VLC to initialize (5 seconds)**

Run: `sleep 5`

**Step 3: Verify VLC loop state starts as false**

Run: `curl -u :vlc http://localhost:8080/requests/status.json | jq .loop`
Expected: `false`

**Step 4: Restart orchestrator to load code changes**

Run: `pm2 restart aln-orchestrator`
Expected:
```
[PM2] Applying action restartProcessId on app [aln-orchestrator](ids: [ 0 ])
[PM2] [aln-orchestrator](0) ✓
```

**Step 5: Wait for idle loop to initialize (3 seconds)**

Run: `sleep 3`

**Step 6: Verify idle loop enabled after init**

Run: `curl -u :vlc http://localhost:8080/requests/status.json | jq .loop`
Expected: `true`

**Step 7: Check orchestrator logs for successful startup**

Run: `pm2 logs aln-orchestrator --lines 20 --nostream | grep -E "(initialized|loop)"`
Expected: Should see "Idle loop video initialized with continuous playback enabled"

**Step 8: Document test results**

If all steps passed:
- Note: Pre-deployment verification PASSED
- Ready for video playback test

If any step failed:
- Note which step failed
- Check logs: `pm2 logs --lines 100`
- DO NOT PROCEED to Task 8

---

## Task 8: Manual Testing - Video Playback Verification

**Files:**
- None (testing only)

**Prerequisites:**
- Task 7 must have PASSED
- ESP32 scanner must be available
- jaw001 token must be available for scanning

**Step 1: Clear logs to isolate test**

Run: `pm2 flush aln-orchestrator`
Expected: `[PM2] Flushing /home/maxepunk/.pm2/logs/aln-orchestrator-out.log`

**Step 2: Scan jaw001 token with ESP32 scanner**

Action: Physically scan jaw001 token with ESP32 device
Expected: Scanner displays "Video queued for playback" or similar

**Step 3: Observe TV screen during playback**

Action: Watch the TV/monitor where VLC displays video
Expected:
- Idle loop stops
- jaw001.mp4 starts playing
- Video plays for full duration (~77 seconds)
- Video does NOT cut off after 5-7 seconds

**Step 4: Check completion logs after video finishes**

Run: `pm2 logs aln-orchestrator --lines 50 --nostream | grep "playback completed"`
Expected: Should see log line with `"duration":77` or close to it (NOT 5-7)

Example expected log:
```json
{"level":"info","message":"Video playback completed","metadata":{"metadata":{"duration":77,"itemId":"...","service":"aln-orchestrator","tokenId":"jaw001"}}}
```

**Step 5: Verify idle loop resumed**

Action: Watch TV screen after video completes
Expected: Idle loop video resumes playing

**Step 6: Check for loop toggle logs**

Run: `pm2 logs aln-orchestrator --lines 100 --nostream | grep -E "(loop|Loop)"`
Expected:
- Should see "Playlist loop already disabled, no toggle needed" (when playing video)
- Should see "Playlist loop toggled to enabled" (when returning to idle)
- Should NOT see "Video in transition state" warnings

**Step 7: Test multiple videos in queue**

Action: Scan 3 different video tokens rapidly (e.g., jaw001, rat001, sof001)
Expected:
- All 3 videos queue successfully
- All 3 play to completion (no cutoffs)
- Idle loop resumes after last video

**Step 8: Document test results**

If all steps passed:
- Video playback fix SUCCESSFUL
- System ready for production use
- Proceed to Task 9 (final commit)

If any step failed:
- Document which step failed and symptoms
- Check logs: `pm2 logs --lines 200 | grep -E "(Video|VLC|state|timeout)"`
- DO NOT proceed to Task 9
- Report findings for debugging

---

## Task 9: Final Verification and Deployment Summary

**Files:**
- None (documentation only)

**Step 1: Verify all commits are present**

Run: `git log --oneline --decorate -7`
Expected: Should show 6 commits from this implementation:
1. "feat(vlc): add loop and repeat fields to getStatus() response"
2. "fix(vlc): implement read-modify-write pattern for setLoop()"
3. "feat(video): add waitForVlcState() condition-based waiting helper"
4. "fix(video): replace arbitrary delays with condition-based waiting in playVideo()"
5. "fix(video): remove 3-second grace period from monitorVlcPlayback()"
6. "fix(vlc): add --no-loop flag to VLC startup args"

**Step 2: Check git status is clean**

Run: `git status`
Expected: "nothing to commit, working tree clean"

**Step 3: Review implementation against design document**

Run: `cat docs/plans/2025-10-31-vlc-video-playback-fix-design.md | grep "^## Layer"`
Expected: Should list all 4 layers that were implemented

**Step 4: Document deployment**

Create summary:
- Fix deployed: 2025-10-31
- Branch: main
- PM2 services restarted: aln-orchestrator, vlc-http
- Testing completed: Manual verification passed
- Videos now play to full duration (no 5-7 second cutoff)

**Step 5: Monitor production for 24 hours**

Action: Watch for any errors or anomalies over next day
Check: `pm2 logs aln-orchestrator | grep -E "(error|warn|timeout|fail)"`
Expected: No video playback errors

**Step 6: Mark implementation complete**

The VLC video playback fix is now deployed and verified in production.

---

## Rollback Procedure (If Issues Found)

If issues are discovered after deployment:

**Step 1: Identify problematic commit**

Run: `git log --oneline -7`
Identify which of the 6 implementation commits introduced the issue.

**Step 2: Revert the problematic commit**

Run: `git revert <commit-hash>`
Example: `git revert abc1234`

**Step 3: Restart services**

Run: `pm2 restart all`

**Step 4: Verify rollback**

Test video playback with ESP32 scanner.

**Step 5: Report findings**

Document what failed and why for future debugging.

---

## Success Criteria Summary

- ✅ Videos play to full duration (jaw001.mp4 = ~77 seconds, not 5-7)
- ✅ No "Video in transition state" warnings in logs
- ✅ No unnecessary loop toggles in logs (only when needed)
- ✅ Idle loop resumes correctly after videos complete
- ✅ VLC loop state starts as `false` on startup
- ✅ System handles multiple video queue without errors
- ✅ All 6 commits present and clean

**Implementation Time Estimate:** 30-45 minutes (assuming no issues)

**Testing Time Estimate:** 15-20 minutes

**Total Time:** ~1 hour
