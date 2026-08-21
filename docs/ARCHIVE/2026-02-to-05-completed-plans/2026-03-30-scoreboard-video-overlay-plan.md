# Scoreboard Video Overlay — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow VLC to keep playing behind the Chromium scoreboard so the GM can overlay scores during video playback and return to the video.

**Architecture:** Conditional VLC stop in `displayControlService._doSetScoreboard()` (skip when coming from VIDEO), new `returnToVideo()` method, new GM Scanner button. No new display mode enum — overlay state derived from `videoQueueService.currentItem?.isPlaying()`.

**Tech Stack:** Node.js backend (EventEmitter services), Vite-built ES6 GM Scanner, Jest unit/contract tests, Playwright E2E.

**Design doc:** `docs/plans/2026-03-30-scoreboard-video-overlay-design.md`

---

## Task 1: Dead Code Cleanup — Remove `display:toggle`

Remove the unused `display:toggle` command. No UI consumer exists — GMs use `display:scoreboard` and `display:idle-loop` directly.

**CRITICAL:** `app.toggleMode()` (`ALNScanner/src/app/app.js:269`) is the **game mode** toggle (detective ↔ blackmarket). DO NOT TOUCH IT. Only remove `displayControlService.toggleMode()` / `display:toggle` / `DisplayController.toggleDisplayMode()`.

**Files:**
- Modify: `backend/src/services/displayControlService.js` — remove `toggleMode()` method (lines 312-325)
- Modify: `backend/src/services/commandExecutor.js` — remove `display:toggle` from case block (line 245) and its `else if` branch (lines 269-278)
- Modify: `backend/contracts/asyncapi.yaml` — remove `display:toggle` from action enum (line 1392) and from "When Sent" description (line 1099)
- Modify: `ALNScanner/src/admin/DisplayController.js` — remove `toggleDisplayMode()` method (lines 42-44)
- Modify: `config-tool/public/js/components/commandForm.js` — remove `display:toggle` entry (line 56)
- Modify: `backend/tests/unit/services/displayControlService.test.js` — remove `toggleMode()` describe block (lines 206-236)
- Modify: `backend/tests/unit/services/commandExecutor.test.js` — remove `toggleMode` from mock (line 70), remove `display:toggle` test (lines 380-388)
- Modify: `backend/tests/contract/websocket/display-events.test.js` — remove both `display:toggle` tests (lines 142-191)
- Modify: `ALNScanner/tests/unit/utils/adminModule.test.js` — remove `display:toggle` test (find `toggleDisplayMode` test case and remove it)
- Modify: `backend/tests/unit/websocket/adminEvents-envControl.test.js` — remove `toggleMode` from displayControlService mock

**Step 1: Remove backend production code**

In `displayControlService.js`, delete the `toggleMode()` method (lines 312-325):
```javascript
// DELETE this entire method:
  async toggleMode() {
    return this._withLock(async () => {
      if (this.currentMode === DisplayMode.IDLE_LOOP) {
        return await this._doSetScoreboard();
      } else if (this.currentMode === DisplayMode.SCOREBOARD) {
        return await this._doSetIdleLoop();
      } else {
        logger.info('[DisplayControl] Cannot toggle while in VIDEO mode');
        return { success: false, error: 'Cannot toggle during video playback' };
      }
    });
  }
```

In `commandExecutor.js`, change the case block at lines 243-279. Remove `display:toggle` from the fall-through labels and remove its `else if` branch:

Before:
```javascript
      case 'display:idle-loop':
      case 'display:scoreboard':
      case 'display:toggle': {
```
After:
```javascript
      case 'display:idle-loop':
      case 'display:scoreboard': {
```

And delete lines 269-278 (the `else if (action === 'display:toggle')` branch).

In `DisplayController.js`, delete the `toggleDisplayMode()` method (lines 38-44):
```javascript
// DELETE this entire method:
    /**
     * Toggle between Idle Loop and Scoreboard modes
     * @returns {Promise<Object>} Response with { success, mode: 'IDLE_LOOP'|'SCOREBOARD' }
     */
    async toggleDisplayMode() {
        return sendCommand(this.connection, 'display:toggle', {});
    }
```

In `commandForm.js`, delete line 56:
```javascript
// DELETE this line:
  'display:toggle': { label: 'Toggle Display', category: 'display', fields: [] },
```

In `asyncapi.yaml`, delete `display:toggle` from the action enum at line 1392, and delete line 1099 (`- GM sends display:toggle command → broadcast new mode`).

**Step 2: Remove test code**

In `displayControlService.test.js`, delete the entire `toggleMode()` describe block (lines 206-236).

In `commandExecutor.test.js`:
- Remove `toggleMode: jest.fn(),` from the displayControlService mock (line 70)
- Delete the `display:toggle` test (lines 380-388)

In `display-events.test.js`, delete both `display:toggle` tests (lines 142-191 — the two `it()` blocks).

In `adminModule.test.js`, find and delete the `display:toggle` test (`it('should send display:toggle command via sendCommand'`).

In `adminEvents-envControl.test.js`, remove `toggleMode: jest.fn(),` from the displayControlService mock (line 98).

**Step 3: Run tests**

```bash
cd backend && npm test
```
Expected: All pass. The deleted tests are gone, no remaining code references `toggleMode` or `display:toggle`.

```bash
cd ALNScanner && npm test
```
Expected: All pass.

```bash
cd config-tool && npm test
```
Expected: All pass.

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: remove dead display:toggle command

display:toggle / toggleMode() / toggleDisplayMode() had zero UI consumers.
GMs use display:scoreboard and display:idle-loop buttons directly.
Removes from: backend service, executor, contract, GM Scanner controller,
config-tool command form, and all associated tests.

NOTE: app.toggleMode() (game mode detective/blackmarket) is unrelated and untouched."
```

---

## Task 2: Backend Core — Conditional Scoreboard + returnToVideo + reset fix

**Files:**
- Modify: `backend/src/services/displayControlService.js` — modify `_doSetScoreboard()`, add `returnToVideo()`, fix `reset()`
- Modify: `backend/src/services/commandExecutor.js` — add `display:return-to-video` case
- Modify: `backend/tests/unit/services/displayControlService.test.js` — modify + add tests
- Modify: `backend/tests/unit/services/commandExecutor.test.js` — add test

**Step 1: Write failing tests for displayControlService**

Add these tests to `displayControlService.test.js`. Place them in appropriate describe blocks.

In the `setScoreboard()` describe block, add:

```javascript
    it('should NOT stop VLC when switching from VIDEO mode (overlay)', async () => {
      // Enter VIDEO mode
      await displayControlService.playVideo('test.mp4');
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);
      mockVlcService.stop.mockClear();

      await displayControlService.setScoreboard();

      expect(mockVlcService.stop).not.toHaveBeenCalled();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);
    });

    it('should NOT overwrite previousMode when switching from VIDEO (overlay)', async () => {
      // IDLE_LOOP -> VIDEO -> SCOREBOARD
      // previousMode should stay IDLE_LOOP (set by pre-play hook), not become VIDEO
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
      await displayControlService.playVideo('test.mp4');

      // playVideo sets previousMode to IDLE_LOOP
      const preScoreboardPrev = displayControlService.previousMode;
      expect(preScoreboardPrev).toBe(DisplayMode.IDLE_LOOP);

      await displayControlService.setScoreboard();

      // previousMode preserved — still IDLE_LOOP, not VIDEO
      expect(displayControlService.previousMode).toBe(DisplayMode.IDLE_LOOP);
    });

    it('should still stop VLC when switching from IDLE_LOOP', async () => {
      await displayControlService.setScoreboard();

      expect(mockVlcService.stop).toHaveBeenCalled();
    });
```

Add a new describe block for `returnToVideo()`:

```javascript
  describe('returnToVideo()', () => {
    it('should return to VIDEO mode when video is playing behind scoreboard', async () => {
      // Setup: VIDEO -> SCOREBOARD (overlay)
      await displayControlService.playVideo('test.mp4');
      mockVideoQueueService.currentItem = { isPlaying: () => true };
      await displayControlService.setScoreboard();

      const result = await displayControlService.returnToVideo();

      expect(result.success).toBe(true);
      expect(result.mode).toBe(DisplayMode.VIDEO);
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);
    });

    it('should fail when not in SCOREBOARD mode', async () => {
      const result = await displayControlService.returnToVideo();

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not in scoreboard mode/i);
    });

    it('should fail when no video is playing', async () => {
      await displayControlService.setScoreboard();
      // No currentItem on videoQueueService

      const result = await displayControlService.returnToVideo();

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no video playing/i);
    });

    it('should not touch previousMode', async () => {
      await displayControlService.playVideo('test.mp4');
      mockVideoQueueService.currentItem = { isPlaying: () => true };
      await displayControlService.setScoreboard();

      const prevBefore = displayControlService.previousMode;
      await displayControlService.returnToVideo();

      expect(displayControlService.previousMode).toBe(prevBefore);
    });

    it('should emit display:mode:changed', async () => {
      await displayControlService.playVideo('test.mp4');
      mockVideoQueueService.currentItem = { isPlaying: () => true };
      await displayControlService.setScoreboard();

      const spy = jest.fn();
      displayControlService.on('display:mode:changed', spy);

      await displayControlService.returnToVideo();

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        mode: DisplayMode.VIDEO,
        previousMode: DisplayMode.SCOREBOARD
      }));
    });
  });
```

Add lifecycle tests in a new describe block:

```javascript
  describe('Overlay lifecycle', () => {
    it('IDLE_LOOP -> VIDEO -> SCOREBOARD -> returnToVideo -> complete -> IDLE_LOOP', async () => {
      mockVideoQueueService.currentItem = { isPlaying: () => true };

      await displayControlService.playVideo('test.mp4');
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);
      expect(displayControlService.previousMode).toBe(DisplayMode.IDLE_LOOP);

      await displayControlService.setScoreboard();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);
      expect(displayControlService.previousMode).toBe(DisplayMode.IDLE_LOOP); // preserved

      await displayControlService.returnToVideo();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.VIDEO);

      // Video completes
      await displayControlService._handleVideoComplete();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);
    });

    it('_handleVideoComplete is no-op when mode is SCOREBOARD (video ends behind overlay)', async () => {
      mockVideoQueueService.currentItem = { isPlaying: () => true };

      await displayControlService.playVideo('test.mp4');
      await displayControlService.setScoreboard();
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);

      // Video ends while scoreboard is showing
      await displayControlService._handleVideoComplete();

      // Should NOT change mode — scoreboard is sticky
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.SCOREBOARD);
    });
  });
```

Modify existing test "should call VLC stop when connected" (line 117-121) to clarify it tests from IDLE_LOOP:

```javascript
    it('should call VLC stop when switching from IDLE_LOOP', async () => {
      // Ensure starting from IDLE_LOOP (not VIDEO)
      expect(displayControlService.getCurrentMode()).toBe(DisplayMode.IDLE_LOOP);

      await displayControlService.setScoreboard();

      expect(mockVlcService.stop).toHaveBeenCalled();
    });
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest tests/unit/services/displayControlService.test.js --verbose 2>&1 | tail -30
```
Expected: New tests fail (returnToVideo not defined, VLC stop still called from VIDEO).

**Step 3: Implement displayControlService changes**

In `_doSetScoreboard()` (lines 181-210), change the previousMode and VLC stop logic:

Replace lines 184-192:
```javascript
    const oldMode = this.currentMode;
    this.previousMode = oldMode;
    this.currentMode = DisplayMode.SCOREBOARD;
    this.pendingVideo = null;

    try {
      // Stop VLC playback when switching to scoreboard
      if (this.vlcService && this.vlcService.isConnected()) {
        await this.vlcService.stop();
      }
```

With:
```javascript
    const oldMode = this.currentMode;
    // When overlaying scoreboard on video, preserve previousMode (the restore-to target
    // set by the pre-play hook). Only update previousMode for non-overlay transitions.
    if (oldMode !== DisplayMode.VIDEO) {
      this.previousMode = oldMode;
    }
    this.currentMode = DisplayMode.SCOREBOARD;
    this.pendingVideo = null;

    try {
      // Stop VLC only when switching from non-VIDEO modes.
      // When switching from VIDEO, VLC keeps playing behind the scoreboard.
      if (oldMode !== DisplayMode.VIDEO && this.vlcService && this.vlcService.isConnected()) {
        await this.vlcService.stop();
      }
```

Add the `returnToVideo()` method after `setScoreboard()` and before `playVideo()` (around line 212):

```javascript
  /**
   * Return to video from scoreboard overlay.
   * Hides scoreboard to reveal the still-playing VLC video.
   * Only valid when in SCOREBOARD mode with a video playing behind it.
   * @returns {Promise<Object>} Result of mode switch
   */
  async returnToVideo() {
    return this._withLock(async () => {
      if (this.currentMode !== DisplayMode.SCOREBOARD) {
        return { success: false, error: 'Not in scoreboard mode' };
      }

      if (!this.videoQueueService?.currentItem?.isPlaying()) {
        return { success: false, error: 'No video playing' };
      }

      logger.info('[DisplayControl] Returning to video from scoreboard overlay');

      const oldMode = this.currentMode;
      this.currentMode = DisplayMode.VIDEO;
      // Do NOT touch previousMode — it's already correct from the pre-play hook

      try {
        await displayDriver.hideScoreboard();

        this.emit('display:mode:changed', {
          mode: DisplayMode.VIDEO,
          previousMode: oldMode
        });

        logger.info('[DisplayControl] Now showing VIDEO (returned from overlay)');
        return { success: true, mode: DisplayMode.VIDEO };
      } catch (error) {
        logger.error('[DisplayControl] Failed to return to video', { error: error.message });
        this.currentMode = oldMode;
        return { success: false, error: error.message };
      }
    });
  }
```

Fix `reset()` — add `displayDriver.hideScoreboard()` call. In the `reset()` method (around line 330), add after the listener removal and before state reset:

```javascript
  reset() {
    // Remove listeners WE added to other services FIRST
    if (this.videoQueueService) {
      this.videoQueueService.removeListener('video:idle', this._boundVideoIdleHandler);
    }

    // Then remove our own listeners
    this.removeAllListeners();

    // Hide scoreboard if visible (prevents stale Chromium window after reset)
    displayDriver.hideScoreboard().catch(() => {});

    // Reset state
    this.currentMode = DisplayMode.IDLE_LOOP;
    // ... rest unchanged
```

**Step 4: Add `display:return-to-video` to commandExecutor**

In `commandExecutor.js`, add a new case block AFTER the `display:status` case (after line 289). This is a separate case block, not added to the idle-loop/scoreboard group:

```javascript
      case 'display:return-to-video': {
        const returnResult = await displayControlService.returnToVideo();
        if (!returnResult.success) {
          throw new Error(returnResult.error || 'Failed to return to video');
        }
        resultData = { mode: returnResult.mode };
        resultMessage = 'Returned to video from scoreboard overlay';
        logger.info('Display returned to video', { source, deviceId });
        break;
      }
```

Also add `returnToVideo` to the displayControlService mock in `commandExecutor.test.js` (line 67-72):

```javascript
jest.mock('../../../src/services/displayControlService', () => ({
  setIdleLoop: jest.fn(),
  setScoreboard: jest.fn(),
  returnToVideo: jest.fn(),
  getStatus: jest.fn(),
}));
```

And add a test for it (after the display:status test):

```javascript
    it('should execute display:return-to-video', async () => {
      displayControlService.returnToVideo.mockResolvedValue({ success: true, mode: 'VIDEO' });
      const result = await executeCommand({
        action: 'display:return-to-video',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(displayControlService.returnToVideo).toHaveBeenCalled();
    });

    it('should handle display:return-to-video failure', async () => {
      displayControlService.returnToVideo.mockResolvedValue({ success: false, error: 'No video playing' });
      const result = await executeCommand({
        action: 'display:return-to-video',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
    });
```

**Step 5: Run tests**

```bash
cd backend && npm test
```
Expected: All pass.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: scoreboard overlay — keep VLC playing behind scoreboard

When switching to scoreboard from VIDEO mode, VLC keeps playing instead of
being stopped. New returnToVideo() action hides scoreboard to reveal video.

Changes:
- _doSetScoreboard(): skip vlcService.stop() when oldMode is VIDEO,
  preserve previousMode (restore-to target from pre-play hook)
- New returnToVideo() method with lock, validation, display:mode:changed
- New display:return-to-video command in commandExecutor
- Fix: reset() now calls displayDriver.hideScoreboard() (pre-existing bug)"
```

---

## Task 3: Sync Payload — Add displayStatus

**Files:**
- Modify: `backend/src/websocket/syncHelpers.js` — import displayControlService singleton, add to payload
- Verify: no call site changes needed (singleton import inside function body)

**Step 1: Modify syncHelpers.js**

At the top of `syncHelpers.js`, add the import after line 14:

```javascript
const displayControlService = require('../services/displayControlService');
```

In `buildSyncFullPayload()`, add `displayStatus` to the return object. After line 122 (`const sound = ...`), add:

```javascript
  // Display mode status (singleton import — no call site changes needed)
  const displayStatus = displayControlService.getStatus
    ? displayControlService.getStatus()
    : { currentMode: 'IDLE_LOOP', previousMode: 'IDLE_LOOP', pendingVideo: null };
```

In the return block (line 124-138), add `displayStatus` to the object:

```javascript
  return {
    session: session ? session.toJSON() : null,
    scores,
    recentTransactions,
    videoStatus,
    devices,
    serviceHealth,
    playerScans: session?.playerScans || [],
    environment,
    gameClock,
    cueEngine,
    spotify,
    heldItems,
    sound,
    displayStatus,
  };
```

**Step 2: Run tests**

```bash
cd backend && npm test
```
Expected: All pass. Existing callers get `displayStatus` in the payload automatically.

```bash
cd backend && npm run test:integration 2>&1 | tail -5
```
Expected: Integration tests pass (`integration-test-server.js` calls `buildSyncFullPayload` — the singleton import works even in test context since displayControlService exports a module-level instance).

**Step 3: Commit**

```bash
git add backend/src/websocket/syncHelpers.js && git commit -m "feat: include displayStatus in sync:full payload

Reconnecting GM Scanners now receive current display mode on connect.
Uses singleton import (like serviceHealthRegistry) — no call site changes."
```

---

## Task 4: Contract Update — asyncapi.yaml

**Files:**
- Modify: `backend/contracts/asyncapi.yaml` — add `display:return-to-video` to action enum and description
- Modify: `backend/tests/contract/websocket/display-events.test.js` — add contract test

**Step 1: Update asyncapi.yaml**

In the action enum (around line 1390), add `display:return-to-video` after `display:scoreboard`:

```yaml
                  - display:idle-loop
                  - display:scoreboard
                  - display:return-to-video
                  - display:status
```

In the "When Sent" description (around line 1097), add a line after the scoreboard line:

```yaml
        - GM sends display:scoreboard command → broadcast SCOREBOARD
        - GM sends display:return-to-video command → broadcast VIDEO (from overlay)
```

**Step 2: Write contract test**

In `display-events.test.js`, add a test after the display:scoreboard test (around line 140):

```javascript
    it('should match AsyncAPI schema for display:return-to-video command', async () => {
      // Setup: enter VIDEO mode, then SCOREBOARD (overlay)
      await displayControlService.playVideo('test-video.mp4');
      const videoPromise = waitForEvent(socket, 'display:mode');
      await videoPromise; // consume VIDEO mode event

      const sbPromise = waitForEvent(socket, 'display:mode');
      await displayControlService.setScoreboard();
      await sbPromise; // consume SCOREBOARD mode event

      const eventPromise = waitForEvent(socket, 'display:mode');

      // Trigger: return to video
      sendGmCommand(socket, 'display:return-to-video', {});

      const event = await eventPromise;

      expect(event).toHaveProperty('event', 'display:mode');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.data.mode).toBe('VIDEO');
      expect(event.data).toHaveProperty('previousMode');

      validateWebSocketEvent(event, 'display:mode');
    });
```

Note: This test requires `videoQueueService.currentItem` to be set for `returnToVideo()` validation. The contract test server calls `initializeServices()` which initializes displayControlService with the real videoQueueService. `playVideo()` on displayControlService calls `vlcService.playVideo()` which is mocked (ENABLE_VIDEO_PLAYBACK=false). The `currentItem` check depends on whether `videoQueueService` has a playing item. You may need to add a video to the queue first via the videoQueueService directly, or mock the check. Review the contract test setup to determine the right approach.

**Step 3: Run contract tests**

```bash
cd backend && npx jest tests/contract/ --verbose 2>&1 | tail -20
```
Expected: All pass including the new test.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add display:return-to-video to AsyncAPI contract

New action for returning to video from scoreboard overlay.
Includes contract test verifying display:mode broadcast."
```

---

## Task 5: GM Scanner — Button, Controller, Visibility Logic

**Files:**
- Modify: `ALNScanner/index.html` — add "Return to Video" button (after line 353)
- Modify: `ALNScanner/src/admin/DisplayController.js` — add `returnToVideo()` method
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js` — add visibility logic
- Modify: `ALNScanner/src/network/networkedSession.js` — handle displayStatus from sync:full
- Modify: `ALNScanner/src/app/app.js` — add `adminReturnToVideo()` method

**Step 1: Add button to index.html**

After line 353 (the scoreboard button), add:

```html
                        <button class="btn btn-toggle" id="btn-return-to-video" data-action="app.adminReturnToVideo" style="display: none;">▶ Return to Video</button>
```

The full button row becomes:
```html
                    <div class="idle-mode-toggle__buttons">
                        <button class="btn btn-toggle active" id="btn-idle-loop" data-action="app.adminSetIdleLoop">🔄 Idle Loop</button>
                        <button class="btn btn-toggle" id="btn-scoreboard" data-action="app.adminSetScoreboard">🏆 Scoreboard</button>
                        <button class="btn btn-toggle" id="btn-return-to-video" data-action="app.adminReturnToVideo" style="display: none;">▶ Return to Video</button>
                    </div>
```

**Step 2: Add returnToVideo to DisplayController**

In `ALNScanner/src/admin/DisplayController.js`, add after `setScoreboard()` (after line 36):

```javascript
    /**
     * Return to video from scoreboard overlay.
     * Only valid when scoreboard is showing over a playing video.
     * @returns {Promise<Object>} Response with { success, mode: 'VIDEO' }
     */
    async returnToVideo() {
        return sendCommand(this.connection, 'display:return-to-video', {});
    }
```

**Step 3: Add adminReturnToVideo to app.js**

Find the `adminSetScoreboard()` / `adminSetIdleLoop()` methods (around line 1539-1540) and add:

```javascript
  async adminReturnToVideo() {
    return this._adminDisplayAction('returnToVideo', 'Return to Video');
  }
```

**Step 4: Add visibility logic to MonitoringDisplay**

In `MonitoringDisplay.js`, add state tracking. At the top of the class constructor (or near other state variables), add:

```javascript
    this._currentDisplayMode = 'IDLE_LOOP';
```

Modify `_handleDisplayMode()` (line 224) to cache the mode and update button visibility:

```javascript
  _handleDisplayMode(payload) {
    const nowShowingVal = document.getElementById('now-showing-value');
    const nowShowingIcon = document.getElementById('now-showing-icon');
    const btnIdle = document.getElementById('btn-idle-loop');
    const btnScore = document.getElementById('btn-scoreboard');

    if (payload.mode === 'SCOREBOARD') {
      if (nowShowingVal) nowShowingVal.textContent = 'Scoreboard';
      if (nowShowingIcon) nowShowingIcon.textContent = '\uD83C\uDFC6';
    } else if (payload.mode === 'IDLE_LOOP') {
      if (nowShowingVal) nowShowingVal.textContent = 'Idle Loop';
      if (nowShowingIcon) nowShowingIcon.textContent = '\uD83D\uDD04';
    }

    if (btnIdle) btnIdle.classList.toggle('active', payload.mode === 'IDLE_LOOP');
    if (btnScore) btnScore.classList.toggle('active', payload.mode === 'SCOREBOARD');

    this._currentDisplayMode = payload.mode;
    this._updateReturnToVideoVisibility();
  }
```

In the StateStore video subscription (find where MonitoringDisplay subscribes to the `video` domain — look in `_wireStoreSubscriptions()` or the constructor), add a call to `_updateReturnToVideoVisibility()` after the VideoRenderer render call. You need to find the exact location where `store.on('video', ...)` is registered and add the visibility update there.

Add the visibility method:

```javascript
  _updateReturnToVideoVisibility() {
    const btn = document.getElementById('btn-return-to-video');
    if (!btn) return;

    const videoState = this.store?.get('video');
    const videoPlaying = videoState?.status === 'playing';
    const inScoreboard = this._currentDisplayMode === 'SCOREBOARD';

    btn.style.display = (inScoreboard && videoPlaying) ? '' : 'none';
  }
```

**Step 5: Handle displayStatus in sync:full**

In `networkedSession.js`, find where `sync:full` payload fields are processed. After existing field handling, add:

```javascript
    // Restore display mode on reconnect
    if (payload.displayStatus && this.monitoringDisplay) {
      this.monitoringDisplay._handleDisplayMode({ mode: payload.displayStatus.currentMode });
    }
```

The exact location depends on how `networkedSession.js` processes sync:full. Find the handler and add the displayStatus extraction there. The MonitoringDisplay reference may need to be passed through — check how other non-StateStore fields (like `playerScans`) are routed.

**Step 6: Run tests**

```bash
cd ALNScanner && npm test
```
Expected: All pass. New button has no existing test dependencies.

**Step 7: Build for E2E**

```bash
cd ALNScanner && npm run build
```
Expected: Build succeeds. The `dist/` directory is updated (backend symlinks to it for E2E).

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: GM Scanner Return to Video button

Conditional button appears when scoreboard is overlaying a playing video.
Visibility driven by display:mode events + StateStore video domain state.
DisplayStatus included in sync:full reconnect handling."
```

---

## Task 6: E2E — Overlay Scenario

**Files:**
- Modify: `backend/tests/e2e/flows/08-display-control.test.js` — add overlay test

**Step 1: Add overlay test**

Add a new test to the display control E2E suite. The test should:

1. Create session with teams, start game
2. Queue a video (via `video:queue:add` command or player scan)
3. Wait for video to start playing (wait for `service:state` video domain with `status: 'playing'`)
4. Switch to scoreboard (`display:scoreboard` command)
5. Verify display mode is SCOREBOARD (via `display:mode` event or `gm:command:ack`)
6. Verify video is still tracked as playing (check `service:state` video domain — should still show `status: 'playing'`)
7. Send `display:return-to-video` command
8. Verify display mode changes back to VIDEO (via `display:mode` event)

This test requires a video file to exist in `public/videos/`. Check the E2E fixtures to see what test videos are available. The test may need `ENABLE_VIDEO_PLAYBACK=true` or may work with the test mode timer.

**Step 2: Run E2E**

```bash
cd backend && npx playwright test flows/08-display-control --verbose 2>&1 | tail -20
```
Expected: All pass including the new overlay scenario.

**Step 3: Commit**

```bash
git add -A && git commit -m "test(e2e): add scoreboard video overlay scenario

Tests: video playing → scoreboard overlay → video still playing →
return to video → display mode restored to VIDEO."
```

---

## Verification Checklist

After all tasks are complete, run the full test suites:

```bash
cd backend && npm test                  # Unit + contract
cd backend && npm run test:integration  # Integration (sequential)
cd ALNScanner && npm test               # GM Scanner unit
cd config-tool && npm test              # Config tool
cd backend && npm run test:e2e          # E2E (requires running server)
```

Verify these baselines:
- Backend unit+contract: ~1557 pass (minus ~5 removed toggle tests, plus ~12 new tests)
- ALNScanner: ~1116 pass (minus 1 toggle test)
- E2E: all display control tests pass
