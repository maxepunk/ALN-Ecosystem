# Scoreboard Video Overlay — Design Document

**Date:** 2026-03-30
**Status:** Draft
**Scope:** Backend display control, GM Scanner UI, contract updates, dead code cleanup

## Problem

When the GM clicks "Scoreboard" while a video is playing (e.g., the endgame video), VLC is stopped immediately and the video is lost. The GM cannot return to it. This is overly destructive — the GM may want to briefly check scores then return to the video.

## Solution

Allow VLC to keep playing behind the Chromium scoreboard window. The GM can show the scoreboard as an overlay during video playback, then hide it to reveal the still-playing video. VLC audio remains audible while the scoreboard is visible.

## Architecture

The HDMI output is an X11 display with two windows:

```
HDMI Output
  └── X11 Display (:0)
      ├── VLC window (gles2 vout) — always rendering underneath
      └── Chromium window (kiosk) — fullscreen on top when shown
```

Chromium covers VLC when fullscreened. Minimizing Chromium reveals VLC. VLC does not stop decoding when its window is covered — audio and video continue.

The core change: `displayControlService._doSetScoreboard()` conditionally skips `vlcService.stop()` when transitioning from VIDEO mode. A new `returnToVideo()` method hides the scoreboard to reveal the still-playing video.

## Display Mode State Machine

### Current Modes

| Mode | Display | VLC State |
|------|---------|-----------|
| `IDLE_LOOP` | VLC plays idle-loop.mp4 on loop | Playing idle loop |
| `SCOREBOARD` | Chromium fullscreen | Stopped |
| `VIDEO` | VLC plays queued video | Playing video |

### Changed Behavior

`SCOREBOARD` mode now has two contexts:

| Transition Into | VLC State | Meaning |
|-----------------|-----------|---------|
| From IDLE_LOOP | Stopped (as today) | Normal scoreboard |
| From VIDEO | Keeps playing | Scoreboard overlay — video playing behind |

The system distinguishes these by checking `videoQueueService.currentItem?.isPlaying()`, not by adding new state. No new display mode enum value needed.

### previousMode Tracking

**Critical design decision:** When transitioning from VIDEO → SCOREBOARD (overlay), `previousMode` is NOT updated. It preserves whatever was set before VIDEO mode (the restore-to target from the pre-play hook).

This ensures correct restore behavior:

```
1. mode=IDLE_LOOP, prev=IDLE_LOOP
2. Video queued (pre-play hook): prev=IDLE_LOOP, mode=VIDEO
3. GM → Scoreboard (overlay): mode=SCOREBOARD, prev=IDLE_LOOP (preserved)
4. GM → Return to Video: mode=VIDEO, prev=IDLE_LOOP (untouched)
5. Video ends → restores prev=IDLE_LOOP ✅
```

And when the pre-video mode was SCOREBOARD:

```
1. mode=SCOREBOARD, prev=IDLE_LOOP
2. Video queued (pre-play hook): prev=SCOREBOARD, mode=VIDEO
3. GM → Scoreboard (overlay): mode=SCOREBOARD, prev=SCOREBOARD (preserved)
4. Video ends while scoreboard showing → no-op (mode≠VIDEO), scoreboard stays ✅
```

### returnToVideo() Method

New method on `displayControlService`:

- Acquires `_switchLock`
- Validates: `currentMode === SCOREBOARD` AND `videoQueueService.currentItem?.isPlaying()`
- Calls `displayDriver.hideScoreboard()` (minimizes Chromium)
- Sets `currentMode = VIDEO`
- Emits `display:mode:changed`
- Does NOT touch `previousMode`
- Returns `{success, mode}` or `{success: false, error: 'No video playing'}`

## Audio Ducking Behavior

Ducking is driven by video lifecycle events (`video:started`, `video:completed`, `video:paused`, `video:resumed`), not display mode. This means no ducking code changes are needed.

| Scenario | Ducking | Why |
|----------|---------|-----|
| Video playing, GM shows scoreboard | Spotify stays ducked | No `video:completed` — VLC still playing |
| Video ends while scoreboard showing | Spotify restored | `video:completed` fires from `monitorVlcPlayback` |
| GM returns to video | No change | VLC was already playing, already ducked |
| GM pauses video while scoreboard showing | Spotify restored | `video:paused` fires → ducking stop |
| GM resumes video while scoreboard showing | Spotify ducked again | `video:resumed` fires → ducking start |

**Pre-existing gap (not introduced by this change):** `video:failed` is not wired to ducking in `broadcasts.js`. If VLC crashes during playback, Spotify stays ducked until the next video cycle.

## GM Scanner UI

### Button Row

```
[🔄 Idle Loop]  [🏆 Scoreboard]  [▶ Return to Video (conditional)]
```

"Return to Video" is hidden by default (`display: none`). Visible when **both**:
1. Display mode is `SCOREBOARD` (from `display:mode` event)
2. Video domain status is `playing` (from StateStore `video` subscription)

### Visibility Logic

`MonitoringDisplay` already handles both data sources — `display:mode` events via `_handleDisplayMode()` and video state via the StateStore `video` subscription feeding `VideoRenderer`. A new private method `_updateReturnToVideoVisibility()` is called from both paths, reads two cached values, and toggles visibility on the button.

When video ends behind the scoreboard, the video domain pushes `status: 'idle'` via `service:state`. The StateStore subscription fires, `_updateReturnToVideoVisibility()` runs, button disappears. No display mode event needed.

### Button Action

`DisplayController.returnToVideo()` → `sendCommand(connection, 'display:return-to-video', {})`. Same pattern as existing display commands. On failure ("No video playing"), button is already disappearing from the state update.

### "Now Showing" Text

During overlay, display mode is SCOREBOARD → shows "Now Showing: Scoreboard". This is accurate — the TV is showing the scoreboard. The video progress bar in the video controls section still shows the playing video's progress, giving the GM visibility into both.

### Active Button Styling

The `.btn-toggle.active` class (crimson background `#c41e3a`, white text) toggles on idle loop and scoreboard buttons based on display mode events. Defined in `admin.css:729-733`. "Return to Video" is an action button, not a mode indicator — it does not use the active toggle pattern.

## sync:full — Display Status

`buildSyncFullPayload()` does not currently include display mode. A reconnecting GM Scanner wouldn't know the current display state. This is a pre-existing gap that this feature makes important to fix (the "Return to Video" button needs display mode on reconnect).

**Change:** Add `displayStatus: displayControlService.getStatus()` inside `buildSyncFullPayload()` by importing the singleton directly (same pattern as `serviceHealthRegistry.getSnapshot()`). This avoids changing the function signature and all 7 call sites. Returns `{currentMode, previousMode, pendingVideo, timestamp}`.

The 7 call sites (`gmAuth.js`, `broadcasts.js` ×3, `stateRoutes.js`, `server.js`, `integration-test-server.js`) remain unchanged — `displayControlService` is read from the singleton inside the function body.

**GM Scanner sync:full handling:** In `networkedSession.js`, extract `displayStatus` from the sync:full payload and call `MonitoringDisplay._handleDisplayMode({mode: displayStatus.currentMode})` to set initial button states on reconnect. This follows the same pattern as other sync:full fields that route to non-StateStore handlers.

**Note:** The `sync:full` `videoStatus` shape (from `syncHelpers.js`) differs from the `service:state` video domain shape (from `videoQueueService.getState()`). This is pre-existing. The "Return to Video" button visibility logic on reconnect must handle both shapes, or the sync:full handler should normalize the video status before pushing to the StateStore.

## Dead Code Cleanup — display:toggle

The `display:toggle` command has zero UI consumers. GMs use the direct `display:scoreboard` and `display:idle-loop` buttons. The `DisplayController.toggleDisplayMode()` method exists but nothing calls it.

**CRITICAL NAMING DISTINCTION:** `app.toggleMode()` (`app.js:269`) toggles the **game mode** (detective ↔ blackmarket) via the header mode indicator. This is alive and must not be touched. `displayControlService.toggleMode()` / `display:toggle` is the dead **display mode** toggle API being removed.

### Files to Clean Up

| File | Change |
|------|--------|
| `backend/src/services/displayControlService.js` | Remove `toggleMode()` method |
| `backend/src/services/commandExecutor.js` | Remove `display:toggle` case and handler |
| `backend/contracts/asyncapi.yaml` | Remove `display:toggle` from action enum and description |
| `ALNScanner/src/admin/DisplayController.js` | Remove `toggleDisplayMode()` method |
| `backend/tests/unit/services/displayControlService.test.js` | Remove `toggleMode()` describe block |
| `backend/tests/unit/services/commandExecutor.test.js` | Remove `display:toggle` test and mock entry |
| `backend/tests/contract/websocket/display-events.test.js` | Remove both `display:toggle` tests |
| `ALNScanner/tests/unit/utils/adminModule.test.js` | Remove `display:toggle` test |
| `backend/tests/unit/websocket/adminEvents-envControl.test.js` | Remove `toggleMode` from mock |
| `config-tool/public/js/components/commandForm.js` | Remove `display:toggle` command definition (line 56) |

### DO NOT TOUCH

- `app.toggleMode()` — game mode toggle (detective ↔ blackmarket)
- `#modeIndicator[data-action="app.toggleMode"]` — header game mode indicator
- `GMScannerPage.toggleMode()` — E2E page object for game mode
- All E2E tests calling `toggleMode()` — all are game mode toggles

## Backend Changes Summary

### displayControlService.js

1. **`_doSetScoreboard()`** — conditional behavior when `oldMode === VIDEO`:
   - Do NOT call `vlcService.stop()` (VLC keeps playing behind Chromium)
   - Do NOT update `this.previousMode` (preserve restore-to target)
   - When `oldMode !== VIDEO`: behave exactly as today (stop VLC, update previousMode)

2. **New `returnToVideo()` method** — acquires lock, validates, hides scoreboard, sets mode to VIDEO

3. **Remove `toggleMode()` method** — dead code

### commandExecutor.js

1. **New `display:return-to-video` case** — calls `displayControlService.returnToVideo()`. No service dependency gate needed (validation is inside the method). **Implementation note:** This should be a separate `case` block, NOT added to the existing `display:idle-loop` / `display:scoreboard` fall-through group (lines 243-279) which shares a `handleDisplayCommand` helper. `returnToVideo()` has different semantics (validation-based, no mode name parameter).

2. **Remove `display:toggle` from the existing fall-through case block** (line 245) and its `else if` branch (lines 269-278). The remaining `display:idle-loop` and `display:scoreboard` cases and their `if`/`else if` branches stay intact.

### displayControlService.reset()

**Bug fix (pre-existing):** Add `displayDriver.hideScoreboard()` call to ensure Chromium is minimized when state resets. Currently `reset()` sets `currentMode = IDLE_LOOP` but leaves the Chromium window fullscreened.

### videoQueueService.js — No changes

The monitor, queue processing, event emission, and `getState()` all work as-is. The queue item's `isPlaying()` checks item status (not VLC state), so it correctly reports a playing item regardless of display mode.

### vlcMprisService.js — No changes

### displayDriver.js — No changes

### broadcasts.js — No changes

Ducking wired to video lifecycle events. Display mode events already broadcast. All existing listeners work.

### syncHelpers.js

Add `displayStatus` to `buildSyncFullPayload()` by importing the singleton directly (no signature change, no call site updates).

## Edge Cases

| Scenario | Behavior | Verified |
|----------|----------|----------|
| Video ends while scoreboard showing | `video:completed` → ducking restored. `video:idle` → no-op (mode≠VIDEO). Scoreboard stays (sticky). | ✅ |
| VLC crashes while scoreboard showing | Monitor catches error → `video:failed` → queue advances or idles. Ducking NOT restored (pre-existing gap). | ⚠️ Pre-existing |
| Multi-video queue, scoreboard during first | Video A completes → Video B pre-play hook hides scoreboard, plays on screen. Queue drains → restores to SCOREBOARD (not IDLE_LOOP). See note below. | ✅ |
| GM clicks "Idle Loop" during overlay | `_doSetIdleLoop()` replaces VLC video with idle-loop.mp4, hides scoreboard. Deliberate action. "Return to Video" button briefly visible (~2s) until monitor detects VLC filename change and completes the queue item. | ✅ |
| GM clicks "Return to Video" after video ended (race) | `currentItem` is null → returns `{success: false}`. Button already disappearing from state update. | ✅ |
| Reconnecting GM during overlay | `sync:full` includes `displayStatus.currentMode: 'SCOREBOARD'` + video domain `status: 'playing'` → button appears. | ✅ |
| `video:skip` during overlay | Stops VLC, completes item, next video hides scoreboard or queue drains. | ✅ |
| `video:pause` during overlay | VLC pauses (audio stops), ducking restores. Queue item stays `playing` status. Button stays visible. | ✅ |
| `video:stop` during overlay | Skips + clears queue. No more video → button disappears. | ✅ |
| Two GMs connected, one clicks scoreboard | Both receive `display:mode:changed`, both see overlay state and button. | ✅ |
| System reset during overlay | `performSystemReset()` resets displayControlService state to IDLE_LOOP. See note below. | ⚠️ Needs fix |
| Session end during overlay | `sessionService.endSession()` does not touch VLC or display mode. Overlay persists. GM changes display manually. | ✅ Benign |
| Server restart during overlay | Display state not persisted. Chromium killed by orphan cleanup, respawned. Self-heals to IDLE_LOOP. GM Scanner loses overlay state on reconnect (sync:full reports IDLE_LOOP). | ✅ Benign |

**Multi-video queue `previousMode` behavior:** When Video B's pre-play hook fires after the GM overlaid scoreboard during Video A, the hook sets `previousMode = SCOREBOARD` (the current mode at that point). When the entire queue drains, `_handleVideoComplete` restores to SCOREBOARD — not the original IDLE_LOOP. This is intentional: the GM explicitly chose scoreboard as their preferred display during the queue, so restoring to it is the correct behavior.

**System reset fix required:** `displayControlService.reset()` resets internal state to IDLE_LOOP but does NOT call `displayDriver.hideScoreboard()`. After reset, Chromium stays fullscreened on HDMI while the backend thinks mode is IDLE_LOOP. **Fix:** Add `displayDriver.hideScoreboard()` call to `reset()` to ensure Chromium is minimized when state resets. This is a pre-existing bug (reset during normal SCOREBOARD mode has the same problem) but this feature makes it more visible.

## Testing Strategy

### Unit Tests — displayControlService.test.js

**New:**
- `setScoreboard()` from VIDEO: VLC NOT stopped, previousMode NOT overwritten
- `setScoreboard()` from IDLE_LOOP: VLC stopped, previousMode updated (preserved behavior)
- `returnToVideo()` success: mode→VIDEO, scoreboard hidden, previousMode untouched
- `returnToVideo()` fails when mode is not SCOREBOARD
- `returnToVideo()` fails when no video playing
- `_handleVideoComplete()` no-op when mode is SCOREBOARD
- Full lifecycle: IDLE_LOOP → VIDEO → SCOREBOARD → returnToVideo → video ends → IDLE_LOOP
- Full lifecycle: SCOREBOARD → VIDEO → SCOREBOARD (overlay) → video ends → stays SCOREBOARD

**Modified:**
- Existing `setScoreboard()` tests: only assert VLC stop when coming from IDLE_LOOP
- Remove `toggleMode()` describe block

### Unit Tests — commandExecutor.test.js

**New:**
- `display:return-to-video` routes to `displayControlService.returnToVideo()`
- `display:return-to-video` returns failure message when no video

**Modified:**
- Remove `display:toggle` test

### Contract Tests — display-events.test.js

**New:**
- `display:return-to-video` emits `display:mode` with mode VIDEO

**Modified:**
- Remove both `display:toggle` tests

### E2E Tests

Add overlay scenario to `08-display-control.test.js`: start video → scoreboard → verify video tracked as playing → return to video → verify mode returns to VIDEO.

## Implementation Order

1. **Dead code cleanup** — remove `display:toggle` / `toggleMode()` / `toggleDisplayMode()` from backend, GM Scanner, config-tool, contracts, and tests. Run tests. Commit.
2. **Backend core** — modify `_doSetScoreboard()`, add `returnToVideo()`, add executor case, fix `reset()` to hide scoreboard. Write unit tests. Commit.
3. **Sync payload** — add `displayStatus` to `buildSyncFullPayload()` (singleton import, no call site changes). Commit.
4. **GM Scanner** — add button to `index.html`, add `returnToVideo()` to `DisplayController`, add visibility logic to `MonitoringDisplay`, handle `displayStatus` in sync:full restore. Write unit tests. Commit.
5. **Contract update** — update `asyncapi.yaml` with `display:return-to-video`. Update contract tests. Commit.
6. **E2E** — add overlay scenario to display control E2E flow. Commit.

Steps 1-3 are backend-only. Step 4 requires `npm run build` for E2E to see changes.
