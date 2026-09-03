# VLC Load Listener Race Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix race condition in `videoQueueService.playVideo()` where VLC's `state:changed` event can fire during `await vlcService.playVideo(videoPath)` — before `waitForVlcLoaded()` has registered its listener — causing the 30s timeout to fire even though VLC is correctly playing the requested file.

**Architecture:** Reorder operations in `playVideo()` so the wait listener is registered BEFORE triggering VLC's OpenUri command. The listener is then guaranteed to exist when VLC's debounced PropertiesChanged signal fires. Attach a no-op `.catch()` to the wait promise so a failure in `vlcService.playVideo()` doesn't surface as an unhandled promise rejection from the orphaned 30s timeout.

**Tech Stack:** Node.js, Jest, EventEmitter, MPRIS D-Bus

**Why now:** Latent race introduced 2026-03-27 (commit `c66d7c4b`, polling→reactive). Exposed 2026-04-17 by `apt upgrade` (kernel 6.12.62→6.12.75 with new `rpi-hevc-dec` driver + GStreamer 1.22.0 deb12u5→u6) which shifted VLC's MPRIS signal timing during file transitions.

**Scope:** Backend only. No contract or schema changes. No scanner or UI changes.

---

## Task 1: Write failing regression test for race condition

**Files:**
- Modify: `backend/tests/unit/services/videoQueueService.test.js` (add new `describe` block at end of file, before final `});` at line 908)

**Why this test:** Existing `waitForVlcLoaded` tests verify the listener catches an event when emitted AFTER `waitForVlcLoaded()` is called. They miss the production scenario: VLC's debounced signal fires during `await vlcService.playVideo()`, before `waitForVlcLoaded` has registered its listener. This new test simulates that exact ordering.

**Step 1: Write the failing test**

Insert the following block immediately before line 908 (the final `});` of the outer `describe('VideoQueueService', ...)`):

```javascript
  describe('playVideo() — listener race during vlcService.playVideo() (regression for 2026-04-17 endgame cutoff)', () => {
    let vlcService;
    let registry;

    beforeEach(() => {
      vlcService = require('../../../src/services/vlcMprisService');
      registry = require('../../../src/services/serviceHealthRegistry');
      vlcService.state = 'stopped';
      vlcService.track = null;

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      const config = require('../../../src/config');
      config.features.videoPlayback = true; // exercise the VLC code path

      registry.report('vlc', 'healthy', 'test setup');

      jest.spyOn(vlcService, 'getStatus').mockResolvedValue({
        state: 'playing',
        currentItem: 'target.mp4',
        length: 60,
        position: 0,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
      const config = require('../../../src/config');
      config.features.videoPlayback = false;
      registry.reset();
    });

    it('resolves when state:changed fires during vlcService.playVideo() execution', async () => {
      // Simulate the production race: VLC emits state:changed while playVideo() is
      // still running (before waitForVlcLoaded() has registered its listener).
      // Pre-fix: state:changed has no listener → wait promise never resolves → 30s timeout.
      // Post-fix: listener registered before playVideo() → state:changed caught immediately.
      jest.spyOn(vlcService, 'playVideo').mockImplementation(async () => {
        // Simulate VLC's debounced signal firing during the OpenUri/getStatus D-Bus chain
        vlcService.state = 'playing';
        vlcService.track = { filename: 'target.mp4', length: 60 };
        vlcService.emit('state:changed', {
          previous: { state: 'playing', filename: 'idle-loop.mp4' },
          current: { state: 'playing', filename: 'target.mp4' },
        });
        // Yield to event loop so the emit is fully processed before returning
        await new Promise(resolve => setImmediate(resolve));
      });

      const item = VideoQueueItem.fromToken({
        SF_RFID: 'target',
        video: 'target.mp4',
      }, 'DEVICE_1');

      // playVideo() should complete and emit video:started (not video:failed)
      const startedPromise = new Promise(resolve => {
        videoQueueService.once('video:started', resolve);
      });
      const failedPromise = new Promise(resolve => {
        videoQueueService.once('video:failed', resolve);
      });

      await videoQueueService.playVideo(item);

      // Race the events: started should win, not failed
      const winner = await Promise.race([
        startedPromise.then(() => 'started'),
        failedPromise.then(() => 'failed'),
        new Promise(resolve => setTimeout(() => resolve('neither'), 200)),
      ]);

      expect(winner).toBe('started');
    });
  });
```

**Step 2: Run the test and verify it fails**

Run:
```bash
cd backend && npx jest tests/unit/services/videoQueueService.test.js -t "listener race during vlcService.playVideo" --testTimeout=35000
```

Expected: **FAIL** with the test resolving to `'failed'` or `'neither'` (because the mocked `vlcService.playVideo` emits `state:changed` before `waitForVlcLoaded` registers its listener; the listener is never triggered, the wait hangs, then `playVideo()` either times out at 30s or never resolves).

**Step 3: Commit the failing test**

```bash
git add backend/tests/unit/services/videoQueueService.test.js
git commit -m "test: add regression for waitForVlcLoaded listener race during playVideo()"
```

---

## Task 2: Apply the surgical fix

**Files:**
- Modify: `backend/src/services/videoQueueService.js` lines 175-205 (within the `if (config.features.videoPlayback) { ... }` branch of `playVideo()`)

**Step 1: Read the current code**

The block currently looks like:

```javascript
      // If video playback is enabled, use VLC
      if (config.features.videoPlayback) {
        // Actually play the video through VLC
        await vlcService.playVideo(videoPath);

        // Wait for VLC to actually load and play the NEW video (condition-based waiting)
        // ROOT CAUSE FIX: VLC's in_play doesn't immediately switch videos
        // We need to wait for currentItem to match the expected video file
        const expectedFilename = videoPath.split('/').pop(); // Extract filename
        const status = await this.waitForVlcLoaded(
          expectedFilename,
          'VLC to load and play new video',
          30000  // 30s — Pi 4 needs time to buffer large video files (e.g., 1.6GB ENDGAME)
        );
```

**Step 2: Replace with the reordered version**

Replace the entire block above with:

```javascript
      // If video playback is enabled, use VLC
      if (config.features.videoPlayback) {
        // RACE FIX (2026-04-17): Register the wait listener BEFORE triggering VLC.
        // VLC's debounced state:changed signal can fire during the OpenUri/getStatus
        // D-Bus chain inside vlcService.playVideo() — if waitForVlcLoaded() runs
        // afterward, the event is already gone and the wait hangs until the 30s
        // timeout. Latent since 2026-03-27 (polling→reactive), exposed by the
        // 2026-04-17 kernel/GStreamer upgrade that shifted MPRIS signal timing.
        const expectedFilename = videoPath.split('/').pop(); // Extract filename
        const waitPromise = this.waitForVlcLoaded(
          expectedFilename,
          'VLC to load and play new video',
          30000
        );
        // Suppress unhandled-rejection if vlcService.playVideo() throws —
        // we re-throw via the outer catch and never await waitPromise in that path.
        waitPromise.catch(() => {});

        // Trigger VLC playback. PropertiesChanged signals will arrive shortly;
        // the listener registered above is guaranteed to catch them.
        await vlcService.playVideo(videoPath);

        const status = await waitPromise;
```

**Step 3: Run the new regression test — should now pass**

Run:
```bash
cd backend && npx jest tests/unit/services/videoQueueService.test.js -t "listener race during vlcService.playVideo" --testTimeout=10000
```

Expected: **PASS** — the test resolves to `'started'` because the listener is now registered before `vlcService.playVideo()` emits `state:changed`.

**Step 4: Commit the fix**

```bash
git add backend/src/services/videoQueueService.js
git commit -m "fix(video): register waitForVlcLoaded listener before triggering VLC

VLC's debounced state:changed signal can fire during the D-Bus chain
inside vlcService.playVideo() (OpenUri + setLoop + getStatus). The
previous code awaited playVideo() before calling waitForVlcLoaded(),
leaving a window where the signal arrived with no listener attached.

Latent since c66d7c4b (polling→reactive, 2026-03-27). Exposed by the
2026-04-17 apt upgrade (kernel 6.12.62→6.12.75, GStreamer 1.22.0
deb12u5→u6) which shifted VLC's MPRIS signal timing during file
transitions.

Reorder so the listener is registered before playVideo() is called.
Attach a no-op .catch() to suppress the orphaned 30s rejection if
playVideo() itself throws."
```

---

## Task 3: Run the existing waitForVlcLoaded test suite to confirm no regressions

**Step 1: Run the waitForVlcLoaded describe block**

```bash
cd backend && npx jest tests/unit/services/videoQueueService.test.js -t "waitForVlcLoaded" --testTimeout=10000
```

Expected: **all 8 existing tests still PASS** (fast path, reactive resolution, ignores wrong filename, ignores non-playing, timeout rejection, timeout error message, dangling listener cleanup on resolution, dangling listener cleanup on timeout, no-polling pattern).

**Step 2: Run the playVideo() concurrent-entry suite**

```bash
cd backend && npx jest tests/unit/services/videoQueueService.test.js -t "playVideo.. concurrent entry" --testTimeout=10000
```

Expected: **all 3 tests PASS** (no behavioral interaction with the reorder).

---

## Task 4: Run the full videoQueueService unit suite

**Step 1: Full file**

```bash
cd backend && npx jest tests/unit/services/videoQueueService.test.js --testTimeout=15000
```

Expected: **all tests PASS**, no new failures vs. baseline.

**Step 2: If anything fails, stop and investigate**

Common failure modes to watch for:
- Tests that assert ordering of `vlcService.playVideo` and `waitForVlcLoaded` calls (none exist today, but check)
- Tests that mock `vlcService.playVideo` to throw and expect the exception to propagate before `waitForVlcLoaded` is called — with the fix, `waitForVlcLoaded` is *called* first (creates the wait promise) but the throw still propagates correctly because we await `vlcService.playVideo(videoPath)` before `await waitPromise`

If everything passes, proceed.

---

## Task 5: Run the broader unit + contract suite

**Step 1: Run unit + contract tests**

```bash
cd backend && npm test
```

Expected: baseline pass count maintained (currently ~1644 backend unit+contract tests per memory). No new failures.

**Step 2: If failures appear, investigate before proceeding**

The fix is contained to `videoQueueService.playVideo()` and only changes the call ordering. Failures elsewhere likely indicate a test was implicitly relying on the broken ordering — fix the test, not the implementation, but verify it's a test-only issue.

---

## Task 6: Manual verification on the running orchestrator

**Step 1: Confirm the orchestrator is running and a session is active**

```bash
curl -k https://localhost:3000/health 2>/dev/null | python3 -m json.tool | head -20
```

Expected: `status: "online"`, `vlc.connected: true`, session present.

**Step 2: Restart the orchestrator to pick up the fix**

If running under nodemon (`npm run dev:full`), the file save will auto-restart. Otherwise:

```bash
cd backend && npm run prod:restart
```

Wait ~10s for VLC to re-spawn and idle loop to start.

**Step 3: Verify idle loop is playing**

```bash
tail -5 /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/logs/combined.log | grep -E "Idle loop|VLC"
```

Expected: `[VLC] Idle loop initialized with continuous playback` recently.

**Step 4: Trigger the endgame cue from GM Scanner**

From the GM Scanner UI: Admin Panel → Cues → fire `cue-1772423004537` (ENDGAME).

**Step 5: Watch the log for success or failure**

```bash
tail -f /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/logs/combined.log | grep -E "Video playback|Failed to play|Returned to idle|policesequencewoverlay"
```

Expected within ~5 seconds:
- `[VLC] Video playback started ... policesequencewoverlay.mp4`
- `Video playback started via VLC ... policesequencewoverlay`
- (NO `Failed to play video through VLC` with timeout error)
- (NO premature `Returned to idle loop`)

The video should play continuously for its full duration (~11 minutes) without cutting back to idle.

**Step 6: If it cuts to idle within 30s, the fix didn't take effect**

Check:
- Is the file actually saved? `git diff backend/src/services/videoQueueService.js | head -40`
- Is the orchestrator running the updated code? `tail -50 backend/logs/combined.log | grep "Server.*started"` — should show a recent restart
- Is there a stale node process? `ps -ef | grep "node.*server.js"` — should be one PID, recent etime

**Step 7: Stop the cue once verified**

From GM Scanner: stop the running endgame cue (so you don't have to wait 11 minutes).

---

## Task 7: Update CLAUDE.md memory note (project memory)

**Files:**
- Modify: `/home/maxepunk/.claude/projects/-home-maxepunk-projects-AboutLastNight-ALN-Ecosystem/memory/MEMORY.md` (add a one-line entry under "Project Patterns")

**Step 1: Add the lesson**

Append this line to the "Project Patterns" section in MEMORY.md (one-line entry):

```
- waitForVlcLoaded race fix (2026-04-17): listener MUST be registered before triggering vlcService.playVideo() — VLC's debounced state:changed can fire during the OpenUri D-Bus chain. See [finding](finding_vlc_load_listener_race.md).
```

**Step 2: Write the supporting finding file**

Create `/home/maxepunk/.claude/projects/-home-maxepunk-projects-AboutLastNight-ALN-Ecosystem/memory/finding_vlc_load_listener_race.md`:

```markdown
---
name: VLC waitForVlcLoaded listener race
description: Race condition where VLC state:changed fires during playVideo() before waitForVlcLoaded registers its listener
type: project
---

# VLC waitForVlcLoaded Listener Race

**Discovered:** 2026-04-17 during pre-game endgame cue test
**Symptom:** Endgame video cut to idle loop after exactly 30s; cue continued running on GM scanner UI
**Trigger:** apt upgrade (kernel 6.12.62→6.12.75, GStreamer 1.22.0 deb12u5→u6) on 2026-04-17 00:43

## Root cause

`videoQueueService.playVideo()` previously did:
1. `await vlcService.playVideo(videoPath)` — sends OpenUri via D-Bus (~150-200ms with 3 sequential D-Bus calls)
2. `await this.waitForVlcLoaded(...)` — registers `state:changed` listener

VLC's MPRIS PropertiesChanged signals arrive during step 1, get debounced 100ms in `mprisPlayerBase`, then `_processStateChange` runs and emits `state:changed`. If this happens before step 2 runs, the listener doesn't exist yet — the event is lost. The fast-path inside `waitForVlcLoaded` only catches the case where state AND filename are already updated by the time the function is entered; if either lags by a few ms, the listener is registered with no event coming.

The 2026-04-17 apt upgrade shifted VLC's signal timing (likely via the new `rpi-hevc-dec` kernel driver and updated GStreamer plugins), pushing the race window across the failure threshold for the 712MB police HEVC video.

## Why:

The 2026-03-27 commit `c66d7c4b` replaced the polling implementation of `waitForVlcLoaded` with a reactive `state:changed` listener (perf: eliminated 300-900 dbus-send processes per video). Polling was robust to any signal ordering; the reactive listener has a tight registration-before-emission requirement.

## How to apply:

For any code that triggers a service via D-Bus and then awaits an event response: register the event listener BEFORE triggering the service. Attach a no-op `.catch()` to the resulting promise to suppress unhandled rejection if the trigger itself throws.

Verify the fix by running the regression test:
`cd backend && npx jest tests/unit/services/videoQueueService.test.js -t "listener race during vlcService.playVideo"`
```

**Step 3: Commit memory update**

Memory files live outside the repo, so no `git add`. Just save them via the Write tool.

---

## Task 8: Final commit summary

After all the above:

```bash
git log --oneline -3
```

Expected:
```
<sha> fix(video): register waitForVlcLoaded listener before triggering VLC
<sha> test: add regression for waitForVlcLoaded listener race during playVideo()
<sha> [previous commit before this work]
```

---

## Verification Checklist

- [ ] New regression test fails on baseline code, passes after fix
- [ ] All 8 existing `waitForVlcLoaded` tests still pass
- [ ] All 3 `playVideo() concurrent entry` tests still pass
- [ ] Full `videoQueueService.test.js` suite passes
- [ ] Full `npm test` (unit + contract) passes
- [ ] Manual verification: endgame cue plays the full police video without cutoff
- [ ] No `Failed to play video through VLC` errors in logs after manual test
- [ ] Memory note added with cross-reference to finding file

## Rollback

If the fix causes unexpected issues mid-game:

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git revert HEAD~1 --no-edit  # revert the fix only, keep the test
cd backend && npm run prod:restart
```

The pre-fix behavior cuts the endgame video at 30s but is otherwise stable. The test commit is harmless to keep.
