# Video-Driven Compound Cue Bidirectional Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make compound cue lifecycle commands (stop/pause/resume) cascade to the video that IS the cue's spine, emit proper progress for video-driven cues, and let video completion drive cue completion.

**Architecture:** All changes are in `cueEngineService.js` (the source) and its test file. The cascade works through existing event wiring in `broadcasts.js` and `cueEngineWiring.js` — ducking restore, display mode restoration, and queue cleanup all fire automatically via the existing `video:completed` → `video:idle` chain. No new files, no new wiring.

**Tech Stack:** Node.js, Jest, EventEmitter (internal service communication)

---

## Context

During live testing of the ENDGAME compound cue, three symptoms surfaced — all from one root cause: **compound cue lifecycle commands don't cascade to the video that IS the cue's spine.**

### What happens today (broken)

```
GM presses "Stop Cue" on ENDGAME:
  stopCue('ENDGAME')
    → deletes from activeCues
    → VIDEO KEEPS PLAYING (orphaned)
    → Ducking stuck (Spotify at 20%), display stuck in VIDEO mode
    → No new videos can play (currentItem still set)
```

### What should happen (fixed)

```
GM presses "Stop Cue" on ENDGAME:
  stopCue('ENDGAME')
    → deletes from activeCues
    → videoQueueService.skipCurrent() → VLC stops → completePlayback()
      → video:completed → ducking restore → video:idle → display restore
    → Clean state: no orphaned video, ducking restored, display restored
```

## Investigations & Corrections from Original Plan

During codebase investigation, I identified these issues with the original plan draft:

**1. stopCue feedback loop (CRITICAL):** The original plan proposed cascading to video BEFORE deleting from activeCues. This creates a feedback loop: `skipCurrent()` → `completePlayback()` → `video:completed` event (synchronous EventEmitter) → `cueEngineWiring` → `handleVideoLifecycleEvent('completed')` → finds the cue still in activeCues → double-completes it. **Fix:** Delete from activeCues BEFORE the video cascade. Then `handleVideoLifecycleEvent` won't find the cue.

**2. Missing videoStarted guard:** `handleVideoLifecycleEvent` only checks `hasVideo`, not `videoStarted`. A `video:completed` from an unrelated player scan could prematurely complete a cue whose video hasn't started yet (e.g., a cue with `video:queue:add` at `t=60`). **Fix:** Add `videoStarted` guard to the `completed` case.

**3. pauseCue/resumeCue are sync, not async:** Currently sync. Making them async is safe — `commandExecutor.js` already `await`s them at lines 524 and 534.

**4. Existing mock is incomplete:** The `videoQueueService` mock (test line 764) has `isPlaying`, `getCurrentVideo`, `skipCurrent` but is missing `pauseCurrent`, `resumeCurrent`, `clearQueue`.

All assertions about line numbers, method signatures, and event wiring have been verified against the actual codebase.

---

## Task 1: Add `videoDuration` to activeCue initialization

**Files:**
- Modify: `backend/src/services/cueEngineService.js` — `_startCompoundCue()` (line 552)
- Test: `backend/tests/unit/services/cueEngineService.test.js`

**Step 1: Write the failing test**

Add to the existing `video-driven compound cues` describe block (after line 729):

```js
    it('should initialize videoDuration to 0 in activeCue', async () => {
      cueEngineService.loadCues([{
        id: 'vd-init', label: 'VD Init',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
          { at: 60, action: 'sound:play', payload: { file: 'end.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('vd-init');

      const activeCue = cueEngineService.activeCues.get('vd-init');
      expect(activeCue).toBeDefined();
      expect(activeCue.videoDuration).toBe(0);
      expect(activeCue.videoStarted).toBe(false);
    });
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should initialize videoDuration" --no-coverage`
Expected: FAIL — `activeCue.videoDuration` is `undefined`

**Step 3: Write minimal implementation**

In `cueEngineService.js`, inside `_startCompoundCue()`, add `videoDuration: 0` to the activeCue object at line 566 (after `videoStarted: false`):

```js
      hasVideo,
      videoStarted: false,
      videoDuration: 0,    // Actual video duration (set by handleVideoProgressEvent)
      parentChain: chain,
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should initialize videoDuration" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat(cue-engine): add videoDuration field to activeCue initialization"
```

---

## Task 2: Store video duration from progress events

**Files:**
- Modify: `backend/src/services/cueEngineService.js` — `handleVideoProgressEvent()` (line 803)
- Test: `backend/tests/unit/services/cueEngineService.test.js`

**Step 1: Write the failing test**

Add to the `video-driven compound cues` describe block:

```js
    it('should store video duration from first progress event', async () => {
      cueEngineService.loadCues([{
        id: 'vd-duration', label: 'VD Duration',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
        ]
      }]);

      await cueEngineService.fireCue('vd-duration');

      // Simulate video progress with duration (VLC position=0.0-1.0, duration=seconds)
      cueEngineService.handleVideoProgressEvent({ position: 0.05, duration: 660 });

      const activeCue = cueEngineService.activeCues.get('vd-duration');
      expect(activeCue.videoDuration).toBe(660);
      expect(activeCue.videoStarted).toBe(true);
    });

    it('should not overwrite videoDuration once set', async () => {
      cueEngineService.loadCues([{
        id: 'vd-no-overwrite', label: 'VD No Overwrite',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
        ]
      }]);

      await cueEngineService.fireCue('vd-no-overwrite');

      // First progress sets duration
      cueEngineService.handleVideoProgressEvent({ position: 0.05, duration: 660 });
      // Second progress has different duration (VLC metadata correction)
      cueEngineService.handleVideoProgressEvent({ position: 0.10, duration: 650 });

      const activeCue = cueEngineService.activeCues.get('vd-no-overwrite');
      expect(activeCue.videoDuration).toBe(660); // First value kept
    });
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should store video duration" --no-coverage`
Expected: FAIL — `videoDuration` stays at 0

**Step 3: Write minimal implementation**

In `handleVideoProgressEvent()`, after `activeCue.videoStarted = true` (line 814), add:

```js
        if (!activeCue.videoStarted) {
          activeCue.videoStarted = true;
          logger.info(`[CueEngine] Video progress received, switching to video-driven: ${cueId}`);
        }
        // Store video duration for accurate progress calculations
        if (duration > 0 && !activeCue.videoDuration) {
          activeCue.videoDuration = duration;
        }
        this.handleVideoProgress(cueId, positionSeconds);
```

Note: `!activeCue.videoDuration` is truthy when `videoDuration` is 0 (initial value), so the first progress event with `duration > 0` always sets it. Subsequent events are rejected (`!660` is false).

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should store video duration|should not overwrite videoDuration" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat(cue-engine): store video duration from progress events"
```

---

## Task 3: Emit cue:status from handleVideoProgress

**Files:**
- Modify: `backend/src/services/cueEngineService.js` — `handleVideoProgress()` (line 749)
- Test: `backend/tests/unit/services/cueEngineService.test.js`

**Step 1: Write the failing test**

Add to the `video-driven compound cues` describe block:

```js
    it('should emit cue:status from handleVideoProgress for UI updates', async () => {
      const statusHandler = jest.fn();
      cueEngineService.on('cue:status', statusHandler);

      cueEngineService.loadCues([{
        id: 'vd-progress', label: 'VD Progress',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
          { at: 300, action: 'sound:play', payload: { file: 'mid.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('vd-progress');
      statusHandler.mockClear(); // Clear the cue:started status emission

      // Set videoDuration on the activeCue (normally set by handleVideoProgressEvent)
      const activeCue = cueEngineService.activeCues.get('vd-progress');
      activeCue.videoDuration = 660;

      // Call handleVideoProgress directly with 330 seconds
      cueEngineService.handleVideoProgress('vd-progress', 330);

      expect(statusHandler).toHaveBeenCalledWith(expect.objectContaining({
        cueId: 'vd-progress',
        state: 'running',
        progress: 50,  // 330/660 * 100 = 50
        duration: 660,
      }));
    });

    it('should use maxAt for progress when videoDuration is 0', async () => {
      const statusHandler = jest.fn();
      cueEngineService.on('cue:status', statusHandler);

      cueEngineService.loadCues([{
        id: 'vd-maxat', label: 'VD MaxAt',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
          { at: 100, action: 'sound:play', payload: { file: 'end.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('vd-maxat');
      statusHandler.mockClear();

      // videoDuration is 0 (no progress event yet), maxAt is 100
      cueEngineService.handleVideoProgress('vd-maxat', 50);

      expect(statusHandler).toHaveBeenCalledWith(expect.objectContaining({
        cueId: 'vd-maxat',
        progress: 50,  // 50/100 * 100 = 50
        duration: 100,  // Falls back to maxAt
      }));
    });
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should emit cue:status from handleVideoProgress|should use maxAt for progress" --no-coverage`
Expected: FAIL — no `cue:status` emitted from `handleVideoProgress`

**Step 3: Write minimal implementation**

In `handleVideoProgress()`, after `activeCue.elapsed = position` (line 754), add the status emission:

```js
  handleVideoProgress(cueId, position) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue) return;
    if (activeCue.state !== 'running') return;

    activeCue.elapsed = position;

    // Emit progress for UI (video-driven cues skip _tickActiveCompoundCues)
    const videoDuration = activeCue.videoDuration || activeCue.maxAt;
    const progress = videoDuration > 0 ? Math.min(100, (position / videoDuration) * 100) : 0;
    this.emit('cue:status', {
      cueId,
      state: activeCue.state,
      progress,
      duration: videoDuration,
    });

    this._fireTimelineEntries(cueId, position).catch(err => {
      logger.error(`[CueEngine] Error advancing video-driven cue "${cueId}":`, err.message);
    });

    this._checkCompoundCueCompletion(cueId);
  }
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should emit cue:status from handleVideoProgress|should use maxAt for progress" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat(cue-engine): emit cue:status from video-driven progress updates"
```

---

## Task 4: Use videoDuration in getActiveCues()

**Files:**
- Modify: `backend/src/services/cueEngineService.js` — `getActiveCues()` (line 1026)
- Test: `backend/tests/unit/services/cueEngineService.test.js`

**Step 1: Write the failing test**

Add to the `video-driven compound cues` describe block:

```js
    it('should use videoDuration in getActiveCues() when available', async () => {
      cueEngineService.loadCues([{
        id: 'vd-active', label: 'VD Active',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
          { at: 541, action: 'sound:play', payload: { file: 'end.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('vd-active');

      // Set videoDuration (longer than maxAt, as in ENDGAME)
      const activeCue = cueEngineService.activeCues.get('vd-active');
      activeCue.videoDuration = 660;
      activeCue.elapsed = 330;

      const result = cueEngineService.getActiveCues();
      expect(result[0].duration).toBe(660);     // videoDuration, not maxAt (541)
      expect(result[0].progress).toBe(0.5);     // 330/660 = 0.5
    });

    it('should fall back to maxAt in getActiveCues() for non-video cues', async () => {
      cueEngineService.loadCues([{
        id: 'clock-active', label: 'Clock Active',
        timeline: [
          { at: 0, action: 'sound:play', payload: { file: 'start.wav' } },
          { at: 120, action: 'sound:play', payload: { file: 'end.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('clock-active');

      const activeCue = cueEngineService.activeCues.get('clock-active');
      activeCue.elapsed = 60;

      const result = cueEngineService.getActiveCues();
      expect(result[0].duration).toBe(120);     // maxAt (videoDuration is 0)
      expect(result[0].progress).toBe(0.5);     // 60/120 = 0.5
    });
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should use videoDuration in getActiveCues|should fall back to maxAt in getActiveCues" --no-coverage`
Expected: FAIL — duration shows 541 (maxAt) not 660 (videoDuration)

**Step 3: Write minimal implementation**

In `getActiveCues()` (line 1026), replace the progress/duration calculation:

```js
  getActiveCues() {
    const result = [];
    for (const [cueId, activeCue] of this.activeCues) {
      const effectiveDuration = activeCue.videoDuration || activeCue.maxAt;
      result.push({
        cueId,
        state: activeCue.state,
        progress: effectiveDuration > 0 ? activeCue.elapsed / effectiveDuration : 0,
        duration: effectiveDuration,
      });
    }
    return result;
  }
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should use videoDuration in getActiveCues|should fall back to maxAt in getActiveCues" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat(cue-engine): use video duration for progress in getActiveCues()"
```

---

## Task 5: Video-driven cues complete via video lifecycle, not elapsed check

**Files:**
- Modify: `backend/src/services/cueEngineService.js` — `_checkCompoundCueCompletion()` (line 691) and `handleVideoLifecycleEvent()` (line 829)
- Test: `backend/tests/unit/services/cueEngineService.test.js`

**Step 1: Write the failing tests**

Add to the `video-driven compound cues` describe block:

```js
    it('should NOT complete video-driven cue via _checkCompoundCueCompletion', async () => {
      const completedHandler = jest.fn();
      cueEngineService.on('cue:completed', completedHandler);

      cueEngineService.loadCues([{
        id: 'vd-no-elapsed-complete', label: 'VD No Elapsed',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
          { at: 541, action: 'sound:play', payload: { file: 'end.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('vd-no-elapsed-complete');
      completedHandler.mockClear();

      // Set videoStarted and advance past maxAt
      const activeCue = cueEngineService.activeCues.get('vd-no-elapsed-complete');
      activeCue.videoStarted = true;
      activeCue.elapsed = 600;  // past maxAt of 541
      activeCue.firedEntries = new Set([0, 1]);

      // This should NOT complete the cue (video hasn't completed yet)
      cueEngineService._checkCompoundCueCompletion('vd-no-elapsed-complete');

      expect(completedHandler).not.toHaveBeenCalled();
      expect(cueEngineService.activeCues.has('vd-no-elapsed-complete')).toBe(true);
    });

    it('should complete video-driven cue on handleVideoLifecycleEvent completed', async () => {
      const completedHandler = jest.fn();
      cueEngineService.on('cue:completed', completedHandler);

      cueEngineService.loadCues([{
        id: 'vd-video-complete', label: 'VD Video Complete',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
          { at: 30, action: 'sound:play', payload: { file: 'mid.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('vd-video-complete');
      completedHandler.mockClear();

      // Simulate video started
      const activeCue = cueEngineService.activeCues.get('vd-video-complete');
      activeCue.videoStarted = true;
      activeCue.completedCommands = [{ action: 'video:queue:add' }, { action: 'sound:play' }];

      // Simulate video:completed lifecycle event
      cueEngineService.handleVideoLifecycleEvent('completed', {});

      expect(completedHandler).toHaveBeenCalledWith(expect.objectContaining({
        cueId: 'vd-video-complete',
      }));
      expect(cueEngineService.activeCues.has('vd-video-complete')).toBe(false);
    });

    it('should NOT complete cue on video:completed if videoStarted is false', async () => {
      const completedHandler = jest.fn();
      cueEngineService.on('cue:completed', completedHandler);

      cueEngineService.loadCues([{
        id: 'vd-not-started', label: 'VD Not Started',
        timeline: [
          { at: 60, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
          { at: 120, action: 'sound:play', payload: { file: 'end.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('vd-not-started');
      completedHandler.mockClear();

      // videoStarted is false (video entry is at t=60, hasn't fired yet)
      // An unrelated video:completed should NOT affect this cue
      cueEngineService.handleVideoLifecycleEvent('completed', {});

      expect(completedHandler).not.toHaveBeenCalled();
      expect(cueEngineService.activeCues.has('vd-not-started')).toBe(true);
    });
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should NOT complete video-driven cue via|should complete video-driven cue on handleVideoLifecycleEvent|should NOT complete cue on video:completed if videoStarted" --no-coverage`
Expected: FAIL — first test passes the elapsed check; second test doesn't complete directly; third test has no guard

**Step 3: Write minimal implementation**

**`_checkCompoundCueCompletion()` (line 691)** — add early return for video-driven cues:

```js
  _checkCompoundCueCompletion(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'running') return;

    // Video-driven cues complete via handleVideoLifecycleEvent('completed'), not elapsed check
    if (activeCue.hasVideo && activeCue.videoStarted) return;

    const { timeline, firedEntries, maxAt, elapsed } = activeCue;

    // All entries must be fired AND elapsed must be >= max(at)
    if (firedEntries.size >= timeline.length && elapsed >= maxAt) {
      const { completedCommands, failedCommands } = activeCue;
      logger.info(`[CueEngine] Compound cue completed: ${cueId}`, {
        completed: completedCommands.length,
        failed: failedCommands.length,
      });
      this.activeCues.delete(cueId);
      this.emit('cue:completed', { cueId, completedCommands, failedCommands });
    }
  }
```

**`handleVideoLifecycleEvent()` (line 829)** — directly complete on `video:completed`, add `videoStarted` guard:

```js
  handleVideoLifecycleEvent(eventType, data) {
    // Forward to all active video-driven cues
    for (const [cueId, activeCue] of this.activeCues) {
      if (!activeCue.hasVideo) continue;

      if (eventType === 'paused') {
        this.handleVideoPaused(cueId);
      } else if (eventType === 'resumed') {
        this.handleVideoResumed(cueId);
      } else if (eventType === 'completed') {
        // Guard: ignore video:completed from unrelated videos
        if (!activeCue.videoStarted) continue;
        // Video IS the cue's spine — video end = cue complete
        const { completedCommands, failedCommands } = activeCue;
        logger.info(`[CueEngine] Video-driven cue completed: ${cueId}`);
        this.activeCues.delete(cueId);
        this.emit('cue:completed', { cueId, completedCommands, failedCommands });
      }
    }
  }
```

**IMPORTANT:** The `for...of` loop over `this.activeCues` iterates a Map. We delete from the Map inside the loop. This is safe in JavaScript — `Map.prototype.delete` during `for...of` iteration is well-defined (the iterator visits entries that exist at time of advancement). However, only one video can play at a time (enforced by video conflict detection), so only one cue will match.

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should NOT complete video-driven cue via|should complete video-driven cue on handleVideoLifecycleEvent|should NOT complete cue on video:completed if videoStarted" --no-coverage`
Expected: PASS

**Step 5: Run full test suite to check for regressions**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js --no-coverage`
Expected: All existing tests still pass. The existing test "should sync timeline to video:progress events" (line 694) may now NOT complete the cue at the end of progress (since video:completed hasn't fired), which is correct new behavior.

**Step 6: Commit**

```bash
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat(cue-engine): video-driven cues complete via video lifecycle, not elapsed check"
```

---

## Task 6: Cascade stop to video (Fix A — stopCue)

**Files:**
- Modify: `backend/src/services/cueEngineService.js` — `stopCue()` (line 852)
- Test: `backend/tests/unit/services/cueEngineService.test.js`

**Step 1: Update the videoQueueService mock**

First, update the existing mock at line 764 to include the new methods. The mock is scoped to the `video conflict detection` describe block. We need a similar mock available for our new tests.

Add a new describe block after the `video conflict detection` block (after line 935):

```js
  describe('video cascade (cue→video lifecycle)', () => {
    let videoQueueService;

    beforeEach(() => {
      jest.mock('../../../src/services/videoQueueService', () => ({
        isPlaying: jest.fn().mockReturnValue(false),
        getCurrentVideo: jest.fn().mockReturnValue(null),
        skipCurrent: jest.fn().mockResolvedValue(true),
        pauseCurrent: jest.fn().mockResolvedValue(true),
        resumeCurrent: jest.fn().mockResolvedValue(true),
        clearQueue: jest.fn(),
      }));
      videoQueueService = require('../../../src/services/videoQueueService');
    });
```

**Step 2: Write the failing tests**

Inside the new describe block:

```js
    it('should cascade stop to video for video-driven cue with videoStarted', async () => {
      cueEngineService.loadCues([{
        id: 'stop-video-cue', label: 'Stop Video',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'endgame.mp4' } },
          { at: 300, action: 'sound:play', payload: { file: 'mid.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('stop-video-cue');

      // Simulate video started
      const activeCue = cueEngineService.activeCues.get('stop-video-cue');
      activeCue.videoStarted = true;

      await cueEngineService.stopCue('stop-video-cue');

      expect(videoQueueService.skipCurrent).toHaveBeenCalled();
      expect(videoQueueService.clearQueue).toHaveBeenCalled();
      expect(cueEngineService.activeCues.has('stop-video-cue')).toBe(false);
    });

    it('should NOT cascade stop to video when videoStarted is false', async () => {
      cueEngineService.loadCues([{
        id: 'stop-no-video-started', label: 'No Video Yet',
        timeline: [
          { at: 60, action: 'video:queue:add', payload: { videoFile: 'later.mp4' } },
        ]
      }]);

      await cueEngineService.fireCue('stop-no-video-started');

      // videoStarted is false (video entry at t=60 hasn't fired)
      await cueEngineService.stopCue('stop-no-video-started');

      expect(videoQueueService.skipCurrent).not.toHaveBeenCalled();
    });

    it('should NOT cascade stop to video for non-video cue', async () => {
      cueEngineService.loadCues([{
        id: 'stop-no-video', label: 'No Video',
        timeline: [
          { at: 0, action: 'sound:play', payload: { file: 'start.wav' } },
          { at: 60, action: 'lighting:scene:activate', payload: { sceneId: 'dim' } },
        ]
      }]);

      await cueEngineService.fireCue('stop-no-video');
      await cueEngineService.stopCue('stop-no-video');

      expect(videoQueueService.skipCurrent).not.toHaveBeenCalled();
    });

    it('should delete from activeCues BEFORE video cascade (feedback loop prevention)', async () => {
      cueEngineService.loadCues([{
        id: 'stop-order', label: 'Stop Order',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
        ]
      }]);

      await cueEngineService.fireCue('stop-order');
      const activeCue = cueEngineService.activeCues.get('stop-order');
      activeCue.videoStarted = true;

      // When skipCurrent is called, verify cue is already deleted from activeCues
      videoQueueService.skipCurrent.mockImplementation(async () => {
        // At this point in stopCue, activeCues should already be cleared
        expect(cueEngineService.activeCues.has('stop-order')).toBe(false);
        return true;
      });

      await cueEngineService.stopCue('stop-order');
    });
```

**Step 3: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should cascade stop to video|should NOT cascade stop to video|should delete from activeCues BEFORE" --no-coverage`
Expected: FAIL — `skipCurrent` never called (no cascade exists yet)

**Step 4: Write minimal implementation**

Replace the `stopCue` method:

```js
  async stopCue(cueId) {
    // Clear conflict timer if exists
    if (this.conflictTimers && this.conflictTimers.has(cueId)) {
      clearTimeout(this.conflictTimers.get(cueId));
      this.conflictTimers.delete(cueId);
      logger.info(`[CueEngine] Cleared conflict timer for: ${cueId}`);
    }

    const activeCue = this.activeCues.get(cueId);
    if (!activeCue) {
      logger.info(`[CueEngine] stopCue: "${cueId}" not active, ignoring`);
      return;
    }

    // Cascade stop to children first (depth-first)
    for (const childId of activeCue.children) {
      await this.stopCue(childId);
    }

    logger.info(`[CueEngine] Stopping compound cue: ${cueId}`);
    activeCue.state = 'stopped';
    this.activeCues.delete(cueId);

    // Cascade stop to video AFTER deleting from activeCues
    // (prevents feedback loop: skipCurrent→video:completed→handleVideoLifecycleEvent→cue not found→no-op)
    if (activeCue.hasVideo && activeCue.videoStarted) {
      const videoQueueService = require('./videoQueueService');
      await videoQueueService.skipCurrent();
      videoQueueService.clearQueue();
      logger.info(`[CueEngine] Cascaded stop to video for cue: ${cueId}`);
    }

    this.emit('cue:status', { cueId, state: 'stopped' });
  }
```

**Key ordering:** `activeCues.delete(cueId)` BEFORE `skipCurrent()`. When `skipCurrent()` → `completePlayback()` → `video:completed` fires synchronously, `handleVideoLifecycleEvent('completed')` iterates `this.activeCues` and won't find this cue. No feedback loop.

**Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "video cascade" --no-coverage`
Expected: PASS

**Step 6: Run full test suite**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js --no-coverage`
Expected: All tests pass

**Step 7: Commit**

```bash
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat(cue-engine): cascade stop to video for video-driven cues"
```

---

## Task 7: Cascade pause/resume to video (Fix A — pauseCue, resumeCue)

**Files:**
- Modify: `backend/src/services/cueEngineService.js` — `pauseCue()` (line 882) and `resumeCue()` (line 909)
- Test: `backend/tests/unit/services/cueEngineService.test.js`

**Step 1: Write the failing tests**

Add to the `video cascade` describe block from Task 6:

```js
    it('should cascade pause to video for video-driven cue', async () => {
      cueEngineService.loadCues([{
        id: 'pause-video-cue', label: 'Pause Video',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
          { at: 300, action: 'sound:play', payload: { file: 'mid.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('pause-video-cue');
      const activeCue = cueEngineService.activeCues.get('pause-video-cue');
      activeCue.videoStarted = true;

      await cueEngineService.pauseCue('pause-video-cue');

      expect(videoQueueService.pauseCurrent).toHaveBeenCalled();
      expect(cueEngineService.getActiveCues()[0].state).toBe('paused');
    });

    it('should cascade resume to video for video-driven cue', async () => {
      cueEngineService.loadCues([{
        id: 'resume-video-cue', label: 'Resume Video',
        timeline: [
          { at: 0, action: 'video:queue:add', payload: { videoFile: 'test.mp4' } },
          { at: 300, action: 'sound:play', payload: { file: 'mid.wav' } },
        ]
      }]);

      await cueEngineService.fireCue('resume-video-cue');
      const activeCue = cueEngineService.activeCues.get('resume-video-cue');
      activeCue.videoStarted = true;
      activeCue.state = 'paused';

      await cueEngineService.resumeCue('resume-video-cue');

      expect(videoQueueService.resumeCurrent).toHaveBeenCalled();
      expect(cueEngineService.getActiveCues()[0].state).toBe('running');
    });

    it('should NOT cascade pause to video when videoStarted is false', async () => {
      cueEngineService.loadCues([{
        id: 'pause-no-video', label: 'No Video',
        timeline: [
          { at: 0, action: 'sound:play', payload: { file: 'start.wav' } },
          { at: 60, action: 'video:queue:add', payload: { videoFile: 'later.mp4' } },
        ]
      }]);

      await cueEngineService.fireCue('pause-no-video');
      // hasVideo=true but videoStarted=false
      await cueEngineService.pauseCue('pause-no-video');

      expect(videoQueueService.pauseCurrent).not.toHaveBeenCalled();
    });
  }); // Close the video cascade describe block
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "should cascade pause to video|should cascade resume to video|should NOT cascade pause" --no-coverage`
Expected: FAIL — `pauseCurrent`/`resumeCurrent` never called

**Step 3: Write minimal implementation**

**`pauseCue()`** — make async, add video cascade after state change but before children cascade:

```js
  async pauseCue(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'running') {
      logger.info(`[CueEngine] pauseCue: "${cueId}" not running, ignoring`);
      return;
    }

    activeCue.state = 'paused';
    logger.info(`[CueEngine] Paused compound cue: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'paused' });

    // Cascade pause to video (AFTER setting state='paused' to prevent feedback loop:
    // pauseCurrent→video:paused→handleVideoPaused→guard activeCue.state!=='running'→skips)
    if (activeCue.hasVideo && activeCue.videoStarted) {
      const videoQueueService = require('./videoQueueService');
      await videoQueueService.pauseCurrent();
    }

    // Cascade pause to children (same pattern as stopCue)
    for (const childId of activeCue.children) {
      const childCue = this.activeCues.get(childId);
      if (childCue && childCue.state === 'running') {
        childCue.state = 'paused';
        logger.info(`[CueEngine] Cascade-paused child cue: ${childId}`);
        this.emit('cue:status', { cueId: childId, state: 'paused' });
      }
    }
  }
```

**`resumeCue()`** — make async, add video cascade after state change but before children cascade:

```js
  async resumeCue(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'paused') {
      logger.info(`[CueEngine] resumeCue: "${cueId}" not paused, ignoring`);
      return;
    }

    activeCue.state = 'running';
    logger.info(`[CueEngine] Resumed compound cue: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'running' });

    // Cascade resume to video (AFTER setting state='running' to prevent feedback loop:
    // resumeCurrent→video:resumed→handleVideoResumed→guard activeCue.state!=='paused'→skips)
    if (activeCue.hasVideo && activeCue.videoStarted) {
      const videoQueueService = require('./videoQueueService');
      await videoQueueService.resumeCurrent();
    }

    // Cascade resume to children
    for (const childId of activeCue.children) {
      const childCue = this.activeCues.get(childId);
      if (childCue && childCue.state === 'paused') {
        childCue.state = 'running';
        logger.info(`[CueEngine] Cascade-resumed child cue: ${childId}`);
        this.emit('cue:status', { cueId: childId, state: 'running' });
      }
    }
  }
```

**Feedback loop safety (both methods):**
- `pauseCue`: Sets `state='paused'` BEFORE calling `pauseCurrent()`. When `video:paused` fires synchronously → `handleVideoPaused()` → checks `activeCue.state !== 'running'` → already 'paused' → returns. Safe.
- `resumeCue`: Sets `state='running'` BEFORE calling `resumeCurrent()`. When `video:resumed` fires synchronously → `handleVideoResumed()` → checks `activeCue.state !== 'paused'` → already 'running' → returns. Safe.

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "video cascade" --no-coverage`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js --no-coverage`
Expected: All tests pass. Existing `pauseCue`/`resumeCue` tests (lines 591-633) should still pass — they test non-video cues where `hasVideo` is false.

**Step 6: Commit**

```bash
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat(cue-engine): cascade pause/resume to video for video-driven cues"
```

---

## Task 8: Full regression test

**Files:**
- No files modified — verification only

**Step 1: Run full backend unit + contract tests**

Run: `cd backend && npm test`
Expected: All tests pass (baseline: 1431 tests)

**Step 2: Run integration tests (if time permits)**

Run: `cd backend && npm run test:integration`
Expected: All integration tests pass (baseline: 278 tests). These test the event wiring in `cueEngineWiring.js` and `broadcasts.js` that our cascade relies on.

**Step 3: Commit (tag)**

If all pass, no commit needed — tests are already committed with each task.

---

## Event Flow After Fix (Complete Trace)

```
GM: cue:stop {cueId: 'ENDGAME'}
  → commandExecutor.executeCommand({action:'cue:stop', payload:{cueId:'ENDGAME'}})
    → cueEngineService.stopCue('ENDGAME')
      1. Cascade children (none for ENDGAME)
      2. activeCue.state = 'stopped'
      3. activeCues.delete('ENDGAME')  ← BEFORE video cascade
      4. videoQueueService.skipCurrent()
         → vlcService.stop()  (VLC stops playback)
         → completePlayback(currentItem)
           → emit 'video:completed'  (sync EventEmitter)
             → broadcasts.js: handleDuckingEvent('video','completed') → Spotify volume restored
             → cueEngineWiring: handleVideoLifecycleEvent('completed')
               → for...of activeCues → ENDGAME not found (already deleted) → no-op ✓
           → setImmediate: processQueue() → queue empty → emit 'video:idle'
             → displayControlService._handleVideoComplete() → returns to IDLE_LOOP
      5. videoQueueService.clearQueue() → defensive cleanup
      6. emit cue:status: {cueId:'ENDGAME', state:'stopped'}
         → broadcasts.js: pushServiceState('cueengine')
```

## Summary of Changes

| File | What Changes |
|------|-------------|
| `backend/src/services/cueEngineService.js` | `videoDuration` field in activeCue (Task 1), store duration from progress (Task 2), emit `cue:status` from handleVideoProgress (Task 3), use videoDuration in getActiveCues (Task 4), skip completion check for video-driven cues + direct completion on video:completed with videoStarted guard (Task 5), cascade stop to video after delete (Task 6), cascade pause/resume to video as async (Task 7) |
| `backend/tests/unit/services/cueEngineService.test.js` | ~15 new tests across Tasks 1-7 covering all new behaviors, feedback loop prevention, guard conditions |

**No other files change.** The cascade leverages existing wiring in `broadcasts.js` and `cueEngineWiring.js`.
