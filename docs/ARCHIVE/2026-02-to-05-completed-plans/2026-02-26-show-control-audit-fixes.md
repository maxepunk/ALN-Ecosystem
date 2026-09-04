# Show Control System Audit Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 13 gaps found during the show control system audit so that every GM Scanner admin action produces correct state broadcasts and user feedback.

**Architecture:** Three layers need fixes: (1) Backend command routing and event emission, (2) Backend broadcast wiring, (3) GM Scanner event handling and error feedback. All fixes follow existing patterns — no new abstractions needed.

**Tech Stack:** Node.js (backend services, EventEmitter), ES6 modules (GM Scanner), Jest (both), Vite (GM Scanner build)

**Test Baselines:** Backend 972 unit tests (1 todo), ALNScanner 974 unit tests. All must pass after each task.

---

### Task 1: Route video commands through videoQueueService

**Context:** commandExecutor calls `vlcService.pause()/resume()/stop()` directly for `video:play`, `video:pause`, `video:stop`. But broadcasts.js only listens to `videoQueueService` events. This means video pause/resume/stop produce NO broadcasts — GM Scanner never learns the video state changed. videoQueueService already has `pauseCurrent()`, `resumeCurrent()`, and `skipCurrent()` methods that call VLC AND emit events AND manage playback timers.

**Files:**
- Modify: `backend/src/services/commandExecutor.js` (lines 132-157)
- Modify: `backend/tests/unit/services/commandExecutor.test.js`

**Step 1: Update tests to expect videoQueueService calls instead of vlcService**

In `commandExecutor.test.js`, the mock setup (around line 50) already mocks both services. Update the video command tests (around line 267) to verify the correct service is called:

```javascript
// In the video commands describe block:
it('should route video:play through videoQueueService.resumeCurrent()', async () => {
  videoQueueService.resumeCurrent.mockResolvedValue(true);
  const result = await executeCommand({ action: 'video:play', payload: {}, source: 'gm' });
  expect(result.success).toBe(true);
  expect(videoQueueService.resumeCurrent).toHaveBeenCalled();
  expect(vlcService.resume).not.toHaveBeenCalled();
});

it('should route video:pause through videoQueueService.pauseCurrent()', async () => {
  videoQueueService.pauseCurrent.mockResolvedValue(true);
  const result = await executeCommand({ action: 'video:pause', payload: {}, source: 'gm' });
  expect(result.success).toBe(true);
  expect(videoQueueService.pauseCurrent).toHaveBeenCalled();
  expect(vlcService.pause).not.toHaveBeenCalled();
});

it('should route video:stop through videoQueueService (clear + skip)', async () => {
  videoQueueService.skipCurrent.mockResolvedValue(true);
  const result = await executeCommand({ action: 'video:stop', payload: {}, source: 'gm' });
  expect(result.success).toBe(true);
  expect(videoQueueService.clearQueue).toHaveBeenCalled();
  expect(videoQueueService.skipCurrent).toHaveBeenCalled();
  expect(vlcService.stop).not.toHaveBeenCalled();
});
```

Add `pauseCurrent` and `resumeCurrent` to the videoQueueService mock (around line 50):
```javascript
jest.mock('../../../src/services/videoQueueService', () => ({
  addVideoByFilename: jest.fn(),
  reorderQueue: jest.fn(),
  clearQueue: jest.fn(),
  skipCurrent: jest.fn(),
  pauseCurrent: jest.fn(),
  resumeCurrent: jest.fn(),
}));
```

And add default mock implementations (around line 147):
```javascript
videoQueueService.pauseCurrent.mockResolvedValue(true);
videoQueueService.resumeCurrent.mockResolvedValue(true);
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js --verbose 2>&1 | tail -20`
Expected: New tests FAIL (videoQueueService.resumeCurrent not called, vlcService.resume called instead)

**Step 3: Update commandExecutor.js**

Replace the three video cases (lines 132-157):

```javascript
      case 'video:play':
        if (config.features.videoPlayback) {
          await videoQueueService.resumeCurrent();
        }
        resultMessage = 'Video playback resumed';
        logger.info('Video playback resumed', { source, deviceId });
        break;

      case 'video:pause':
        if (config.features.videoPlayback) {
          await videoQueueService.pauseCurrent();
        }
        resultMessage = 'Video playback paused';
        logger.info('Video playback paused', { source, deviceId });
        break;

      case 'video:stop':
        if (config.features.videoPlayback) {
          videoQueueService.clearQueue();
          await videoQueueService.skipCurrent();
        }
        resultMessage = 'Video playback stopped';
        logger.info('Video playback stopped', { source, deviceId });
        break;
```

Remove the `vlcService` require at the top of commandExecutor.js if it's only used for these three cases. Check if any other case uses vlcService — if not, remove the import entirely.

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js --verbose 2>&1 | tail -20`
Expected: ALL tests pass

**Step 5: Run full backend unit test suite**

Run: `cd backend && npm run test:unit 2>&1 | tail -5`
Expected: 972+ passing (may increase with new tests), 0 failures

**Step 6: Commit**

```bash
git add backend/src/services/commandExecutor.js backend/tests/unit/services/commandExecutor.test.js
git commit -m "fix: route video commands through videoQueueService for proper broadcasts"
```

---

### Task 2: Add queue:reordered broadcast listener

**Context:** `videoQueueService.reorderQueue()` already emits `queue:reordered` (line 721), but broadcasts.js has no listener for it. GM Scanner queue display doesn't update after reorder.

**Files:**
- Modify: `backend/src/websocket/broadcasts.js`
- Modify: `backend/tests/unit/websocket/broadcasts.test.js`

**Step 1: Write failing test**

In broadcasts.test.js, find the video queue broadcast tests and add:

```javascript
it('should broadcast queue update on queue:reordered', () => {
  mockVideoQueueService.emit('queue:reordered', { fromIndex: 0, toIndex: 1 });
  expect(mockIo.to).toHaveBeenCalledWith('gm');
  // broadcastQueueUpdate is called, which emits video:queue:update
  expect(mockIo.emit).toHaveBeenCalledWith('video:queue:update', expect.any(Object));
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/websocket/broadcasts.test.js -t "queue:reordered" --verbose 2>&1 | tail -10`
Expected: FAIL

**Step 3: Add listener in broadcasts.js**

Find the existing `queue:cleared` listener (around line 473) and add after it:

```javascript
  addTrackedListener(videoQueueService, 'queue:reordered', () => {
    broadcastQueueUpdate();
  });
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/websocket/broadcasts.test.js -t "queue:reordered" --verbose 2>&1 | tail -10`
Expected: PASS

**Step 5: Run full suite and commit**

```bash
cd backend && npm run test:unit 2>&1 | tail -5
git add backend/src/websocket/broadcasts.js backend/tests/unit/websocket/broadcasts.test.js
git commit -m "fix: broadcast queue update on video:queue:reorder"
```

---

### Task 3: Fix Spotify metadata timing

**Context:** `_transport()` emits `playback:changed` immediately, then schedules `_refreshMetadata()` 200ms later via setTimeout. Broadcast fires with stale track info. Also, `_refreshMetadata()` sets `this.track = null` when metadata parse fails (e.g., during track transitions), wiping good data.

Two fixes: (a) await metadata refresh in _transport instead of fire-and-forget, (b) don't overwrite track with null.

**Files:**
- Modify: `backend/src/services/spotifyService.js` (lines 243-278)
- Modify: `backend/tests/unit/services/spotifyService.test.js`

**Step 1: Update tests for metadata timing**

Find the `_transport` / metadata refresh tests (around line 712). The existing test uses `jest.useFakeTimers()` and `jest.advanceTimersByTime(200)` to verify the deferred refresh. Update to verify metadata is awaited:

```javascript
it('should await metadata refresh after next()', async () => {
  mockExecFileSuccess(''); // D-Bus call success
  const spy = jest.spyOn(spotifyService, '_refreshMetadata').mockResolvedValue(true);
  await spotifyService.next();
  // Metadata should be called synchronously (awaited), not deferred
  expect(spy).toHaveBeenCalled();
});

it('should emit track:changed after metadata refreshes on next()', async () => {
  const handler = jest.fn();
  spotifyService.on('track:changed', handler);
  // First call: D-Bus Next command
  // Second call: D-Bus Properties.Get for metadata
  let callCount = 0;
  execFile.mockImplementation((cmd, args, opts, cb) => {
    callCount++;
    if (callCount <= 2) {
      // Discovery + Next command
      cb(null, '', '');
    } else {
      // Metadata fetch
      cb(null, 'dict entry(\n  string "xesam:title"\n  variant       string "New Track"\n)', '');
    }
  });
  await spotifyService.next();
  expect(handler).toHaveBeenCalled();
});
```

Add test for null metadata protection:

```javascript
it('should not overwrite track with null on empty metadata', async () => {
  spotifyService.track = { title: 'Old Song', artist: 'Old Artist' };
  // Return empty metadata from D-Bus
  mockExecFileSuccess('no metadata here');
  await spotifyService._refreshMetadata();
  // Track should be preserved, not set to null
  expect(spotifyService.track).toEqual({ title: 'Old Song', artist: 'Old Artist' });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --verbose 2>&1 | tail -20`
Expected: New tests FAIL

**Step 3: Fix _transport and _refreshMetadata**

In `spotifyService.js`, replace `_transport` (lines 267-278):

```javascript
  async _transport(method, newState, { clearPausedFlag = false, refreshMetadata = false } = {}) {
    await this._ensureConnection();
    await this._dbusCall(`${PLAYER_IFACE}.${method}`);
    this.state = newState;
    if (clearPausedFlag) this._pausedByGameClock = false;
    this.emit('playback:changed', { state: newState });
    if (refreshMetadata) {
      // Await metadata so broadcast includes fresh track info
      await this._refreshMetadata();
    }
  }
```

Replace `_refreshMetadata` (lines 243-257):

```javascript
  async _refreshMetadata() {
    try {
      const { stdout } = await this._dbusGetProperty(PLAYER_IFACE, 'Metadata');
      const newTrack = this._parseMetadata(stdout);
      // Don't overwrite valid track with null during transitions
      if (!newTrack) return false;
      const changed = JSON.stringify(newTrack) !== JSON.stringify(this.track);
      this.track = newTrack;
      if (changed) {
        this.emit('track:changed', { track: newTrack });
      }
      return changed;
    } catch (err) {
      logger.debug('[Spotify] Metadata refresh failed:', err.message);
      return false;
    }
  }
```

**Step 4: Run tests**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --verbose 2>&1 | tail -20`
Expected: ALL pass. Check that existing tests for `_refreshMetadata` and `_transport` still pass. The `jest.useFakeTimers()` tests that expected deferred refresh may need updating — remove those tests or update them to verify synchronous behavior.

**Step 5: Full suite and commit**

```bash
cd backend && npm run test:unit 2>&1 | tail -5
git add backend/src/services/spotifyService.js backend/tests/unit/services/spotifyService.test.js
git commit -m "fix: await Spotify metadata refresh in _transport, protect against null track"
```

---

### Task 4: Emit events for cue enable/disable

**Context:** `cueEngineService.enableCue()` and `disableCue()` mutate `this.disabledCues` Set but emit no event. broadcasts.js has no listener. GM Scanner toggle buttons get no server confirmation.

**Files:**
- Modify: `backend/src/services/cueEngineService.js` (lines 321-333)
- Modify: `backend/src/websocket/broadcasts.js`
- Modify: `backend/tests/unit/services/cueEngineService.test.js`
- Modify: `backend/tests/unit/websocket/broadcasts.test.js`

**Step 1: Write failing tests**

In cueEngineService.test.js, add:

```javascript
describe('cue enable/disable events', () => {
  it('should emit cue:status with state enabled on enableCue', () => {
    const handler = jest.fn();
    cueEngineService.on('cue:status', handler);
    cueEngineService.disabledCues.add('test-cue');
    cueEngineService.enableCue('test-cue');
    expect(handler).toHaveBeenCalledWith({ cueId: 'test-cue', state: 'enabled' });
  });

  it('should emit cue:status with state disabled on disableCue', () => {
    const handler = jest.fn();
    cueEngineService.on('cue:status', handler);
    cueEngineService.disableCue('test-cue');
    expect(handler).toHaveBeenCalledWith({ cueId: 'test-cue', state: 'disabled' });
  });
});
```

**Step 2: Run to verify fail**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js -t "cue enable/disable" --verbose`
Expected: FAIL

**Step 3: Add event emission**

In cueEngineService.js, replace `enableCue` (line 321-324):

```javascript
  enableCue(cueId) {
    this.disabledCues.delete(cueId);
    logger.info(`[CueEngine] Enabled cue: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'enabled' });
  }
```

Replace `disableCue` (line 330-333):

```javascript
  disableCue(cueId) {
    this.disabledCues.add(cueId);
    logger.info(`[CueEngine] Disabled cue: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'disabled' });
  }
```

No broadcast change needed — broadcasts.js already listens to `cue:status` (line 715) and forwards it.

**Step 4: Run tests**

Run: `cd backend && npx jest tests/unit/services/cueEngineService.test.js --verbose 2>&1 | tail -20`
Expected: PASS

**Step 5: Full suite and commit**

```bash
cd backend && npm run test:unit 2>&1 | tail -5
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "fix: emit cue:status events on enable/disable for GM feedback"
```

---

### Task 5: Wire video state to GM Scanner MonitoringDisplay

**Context:** DataManager emits `video-state:updated` events, VideoRenderer exists and works, but MonitoringDisplay never wires them together. Video state never renders in the admin panel.

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js` (line ~70, end of `_wireDataManagerEvents`)
- Modify: `ALNScanner/tests/unit/admin/MonitoringDisplay-phase2.test.js` (or whichever has video tests)

**Step 1: Write failing test**

In a MonitoringDisplay test file, add:

```javascript
it('should wire video-state:updated to videoRenderer.render', () => {
  const renderSpy = jest.spyOn(display.videoRenderer, 'render');
  const videoState = { nowPlaying: 'test.mp4', isPlaying: true, progress: 0.5 };

  // Simulate DataManager emitting video state update
  const event = new CustomEvent('video-state:updated', { detail: videoState });
  mockDataManager.dispatchEvent(event);

  expect(renderSpy).toHaveBeenCalledWith(videoState);
});
```

Note: mockDataManager needs to be an EventTarget (not just mock with addEventListener). Check the existing test pattern — MonitoringDisplay-phase1 tests use `mockDataManager = { addEventListener: jest.fn() }` which means the actual event dispatch won't work. If tests use mock addEventListener, test that the listener is registered instead:

```javascript
it('should register listener for video-state:updated', () => {
  expect(mockDataManager.addEventListener).toHaveBeenCalledWith(
    'video-state:updated',
    expect.any(Function)
  );
});
```

**Step 2: Run to verify fail**

Run: `cd ALNScanner && npx jest tests/unit/admin/ -t "video-state" --verbose`
Expected: FAIL

**Step 3: Add the wire**

In MonitoringDisplay.js `_wireDataManagerEvents()` method, add after the Spotify wire (around line 69):

```javascript
    // Video State
    on('video-state:updated', (e) => this.videoRenderer.render(e.detail));
```

**Step 4: Run tests**

Run: `cd ALNScanner && npx jest tests/unit/admin/ --verbose 2>&1 | tail -20`
Expected: PASS

**Step 5: Full suite, rebuild, and commit**

```bash
cd ALNScanner && npm test 2>&1 | tail -5
cd ALNScanner && npm run build
git add ALNScanner/src/admin/MonitoringDisplay.js ALNScanner/tests/unit/admin/
git commit -m "fix: wire video state updates to VideoRenderer in admin panel"
```

---

### Task 6: Add command error feedback in GM Scanner

**Context:** All admin button clicks call controller methods without try/catch. If a command fails (timeout, backend error), user sees nothing. CommandSender rejects the promise, but it's unhandled.

**Approach:** Add a single `safeAdminAction` wrapper in domEventBindings.js that catches errors and shows a toast. DRY — one wrapper for all actions.

**Files:**
- Modify: `ALNScanner/src/utils/domEventBindings.js`
- Modify: `ALNScanner/tests/unit/utils/domEventBindings.test.js` (if exists, otherwise create)

**Step 1: Write failing test**

```javascript
it('should show error toast when admin action rejects', async () => {
  const mockController = {
    getModule: jest.fn().mockReturnValue({
      play: jest.fn().mockRejectedValue(new Error('spotify:play timeout after 5000ms'))
    })
  };
  // Simulate spotifyPlay action
  handleAdminAction('spotifyPlay', document.createElement('button'));
  // Wait for async rejection
  await new Promise(resolve => setTimeout(resolve, 0));
  // Verify error was shown to user
  expect(mockDebug.log).toHaveBeenCalledWith(expect.stringContaining('timeout'), true);
});
```

**Step 2: Run to verify fail**

**Step 3: Add safeAdminAction wrapper**

In domEventBindings.js, add a helper near the top of the file:

```javascript
function safeAdminAction(actionPromise, actionName) {
  if (actionPromise && typeof actionPromise.catch === 'function') {
    actionPromise.catch(err => {
      debug.log(`Command failed: ${actionName} — ${err.message}`, true);
    });
  }
}
```

Then wrap each admin action call. Replace the pattern:

```javascript
// Before (fire-and-forget, no error handling):
case 'spotifyPlay':
  adminController.getModule('spotifyController').play();
  break;

// After (errors caught and shown):
case 'spotifyPlay':
  safeAdminAction(adminController.getModule('spotifyController').play(), 'Spotify Play');
  break;
```

Apply this wrapper to ALL admin action cases in handleAdminAction. Each controller method returns a Promise (from CommandSender.sendCommand), so the catch will fire on timeout or backend error.

**Step 4: Run tests**

**Step 5: Full suite, rebuild, and commit**

```bash
cd ALNScanner && npm test 2>&1 | tail -5
cd ALNScanner && npm run build
git add ALNScanner/src/utils/domEventBindings.js ALNScanner/tests/unit/utils/
git commit -m "fix: show error feedback for all admin command failures"
```

---

### Task 7: Emit playback:changed in checkConnection when state changes

**Context:** `spotifyService.checkConnection()` reads PlaybackStatus from D-Bus and directly sets `this.state` without emitting an event. State changes during connection probes are invisible to broadcasts.

**Files:**
- Modify: `backend/src/services/spotifyService.js` (lines 341-365)
- Modify: `backend/tests/unit/services/spotifyService.test.js`

**Step 1: Write failing test**

```javascript
it('should emit playback:changed when checkConnection detects state change', async () => {
  spotifyService.state = 'stopped';
  spotifyService.connected = false;
  const handler = jest.fn();
  spotifyService.on('playback:changed', handler);

  // Mock D-Bus returning "Playing" status
  let callCount = 0;
  execFile.mockImplementation((cmd, args, opts, cb) => {
    callCount++;
    if (callCount === 1) {
      // Discovery
      cb(null, '"org.mpris.MediaPlayer2.spotifyd.instance123"', '');
    } else if (callCount === 2) {
      // PlaybackStatus
      cb(null, 'variant       string "Playing"', '');
    } else {
      // Metadata
      cb(null, '', '');
    }
  });

  await spotifyService.checkConnection();
  expect(handler).toHaveBeenCalledWith({ state: 'playing' });
});

it('should NOT emit playback:changed when state has not changed', async () => {
  spotifyService.state = 'playing';
  spotifyService.connected = true;
  spotifyService._dbusDest = 'org.mpris.MediaPlayer2.spotifyd.instance123';
  spotifyService._dbusCacheTime = Date.now();
  const handler = jest.fn();
  spotifyService.on('playback:changed', handler);

  // Mock D-Bus returning same "Playing" status
  execFile.mockImplementation((cmd, args, opts, cb) => {
    cb(null, 'variant       string "Playing"', '');
  });

  await spotifyService.checkConnection();
  expect(handler).not.toHaveBeenCalled();
});
```

**Step 2: Run to verify fail**

**Step 3: Fix checkConnection**

Replace the state-setting block in `checkConnection()` (around line 355):

```javascript
    this._setConnected(true);
    // Sync state from actual D-Bus status
    let newState;
    if (stdout.includes('"Playing"')) newState = 'playing';
    else if (stdout.includes('"Paused"')) newState = 'paused';
    else newState = 'stopped';

    if (newState !== this.state) {
      this.state = newState;
      this.emit('playback:changed', { state: newState });
    }
    // Await metadata so getState().track is populated before sync:full
    await this._refreshMetadata();
```

**Step 4: Run tests and commit**

```bash
cd backend && npm run test:unit 2>&1 | tail -5
git add backend/src/services/spotifyService.js backend/tests/unit/services/spotifyService.test.js
git commit -m "fix: emit playback:changed when checkConnection detects state change"
```

---

### Task 8: Report VLC degraded mode in command results

**Context:** When VLC is disconnected, vlcService methods "simulate" success (emit events, no throw). commandExecutor returns `success: true`. GM thinks video is playing but nothing happened.

**Files:**
- Modify: `backend/src/services/commandExecutor.js`
- Modify: `backend/tests/unit/services/commandExecutor.test.js`

**Step 1: Write failing test**

```javascript
it('should return success:false for video:play when VLC is disconnected', async () => {
  vlcService.connected = false;
  const result = await executeCommand({ action: 'video:play', payload: {}, source: 'gm' });
  expect(result.success).toBe(false);
  expect(result.message).toContain('VLC');
});
```

Note: After Task 1, `video:play` routes through videoQueueService. The check should be in videoQueueService methods (which already check `config.features.videoPlayback`). But for explicit degraded mode reporting, check `vlcService.connected` in commandExecutor before calling queue methods.

**Step 2: Run to verify fail**

**Step 3: Add VLC connection check**

In commandExecutor.js, add a helper at the top (after requires):

```javascript
function requireVlc(action) {
  if (config.features.videoPlayback && !vlcService.connected) {
    throw new Error(`VLC not connected — cannot execute ${action}`);
  }
}
```

Then add `requireVlc(action)` call at the start of each video case:

```javascript
      case 'video:play':
        requireVlc('video:play');
        await videoQueueService.resumeCurrent();
        // ...
```

Note: vlcService import may have been removed in Task 1. If so, re-add just for the `connected` property check:
```javascript
const vlcService = require('./vlcService');
```

**Step 4: Run tests and commit**

```bash
cd backend && npm run test:unit 2>&1 | tail -5
git add backend/src/services/commandExecutor.js backend/tests/unit/services/commandExecutor.test.js
git commit -m "fix: report VLC disconnected state in video command results"
```

---

### Task 9: Add sound:error broadcast listener

**Context:** soundService emits `sound:error` but broadcasts.js has no listener. Sound playback failures are silently dropped.

**Files:**
- Modify: `backend/src/websocket/broadcasts.js`
- Modify: `backend/tests/unit/websocket/broadcasts.test.js`

**Step 1: Write failing test**

```javascript
it('should broadcast sound:status on sound:error', () => {
  mockSoundService.emit('sound:error', { file: 'missing.wav', error: 'File not found' });
  expect(mockIo.to).toHaveBeenCalledWith('gm');
  expect(mockIo.emit).toHaveBeenCalledWith('sound:status', expect.objectContaining({
    error: expect.any(Object)
  }));
});
```

**Step 2: Run to verify fail**

**Step 3: Add listener**

In broadcasts.js, after the existing sound:stopped listener (around line 702):

```javascript
  addTrackedListener(soundService, 'sound:error', (data) => {
    emitToRoom(io, 'gm', 'sound:status', { playing: soundService.getPlaying(), error: data });
    logger.error('Broadcasted sound:status (error)', { file: data?.file });
  });
```

**Step 4: Run tests and commit**

```bash
cd backend && npm run test:unit 2>&1 | tail -5
git add backend/src/websocket/broadcasts.js backend/tests/unit/websocket/broadcasts.test.js
git commit -m "fix: broadcast sound:error events to GM Scanner"
```

---

### Task 10: Ducking status indicator in GM Scanner

**Context:** Backend broadcasts `audio:ducking:status`, GM Scanner receives and stores it in DataManager, but no UI shows it. GM can't see that Spotify is being auto-ducked during video/sound playback.

**Approach:** Add a simple ducking indicator to the SpotifyRenderer — when ducked, show "Volume reduced (video playing)" below the volume slider.

**Files:**
- Modify: `ALNScanner/src/ui/renderers/SpotifyRenderer.js`
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js`
- Modify: `ALNScanner/tests/unit/ui/renderers/SpotifyRenderer.test.js`
- Modify: `ALNScanner/tests/unit/admin/MonitoringDisplay-phase3.test.js`

**Step 1: Write failing test**

In SpotifyRenderer.test.js:

```javascript
it('should show ducking indicator when ducked', () => {
  renderer.renderDucking({ ducked: true, volume: 20, activeSources: ['video'] });
  const indicator = document.getElementById('spotify-ducking-indicator');
  expect(indicator).toBeTruthy();
  expect(indicator.textContent).toContain('video');
});

it('should hide ducking indicator when not ducked', () => {
  renderer.renderDucking({ ducked: false, volume: 100, activeSources: [] });
  const indicator = document.getElementById('spotify-ducking-indicator');
  expect(indicator.style.display).toBe('none');
});
```

**Step 2: Run to verify fail**

**Step 3: Add renderDucking method to SpotifyRenderer**

```javascript
renderDucking(duckingState) {
  let indicator = document.getElementById('spotify-ducking-indicator');
  if (!indicator) {
    // Create element if not in DOM yet (SpotifyRenderer may not have rendered)
    const container = document.getElementById('spotify-control-panel');
    if (!container) return;
    indicator = document.createElement('div');
    indicator.id = 'spotify-ducking-indicator';
    indicator.className = 'ducking-indicator';
    container.appendChild(indicator);
  }

  if (duckingState?.ducked) {
    const sources = duckingState.activeSources?.join(', ') || 'system';
    indicator.textContent = `🔉 Volume reduced (${sources} playing)`;
    indicator.style.display = 'block';
  } else {
    indicator.style.display = 'none';
  }
}
```

Wire in MonitoringDisplay._wireDataManagerEvents():

```javascript
    // Audio Ducking
    on('audio-ducking:updated', (e) => this.spotifyRenderer.renderDucking(e.detail));
```

Check that DataManager emits `audio-ducking:updated` when it receives ducking state. If the event name differs, match the existing name in `UnifiedDataManager.updateAudioDucking()`.

**Step 4: Run tests, rebuild, and commit**

```bash
cd ALNScanner && npm test 2>&1 | tail -5
cd ALNScanner && npm run build
git add ALNScanner/src/ui/renderers/SpotifyRenderer.js ALNScanner/src/admin/MonitoringDisplay.js ALNScanner/tests/unit/
git commit -m "feat: show ducking status indicator in Spotify admin panel"
```

---

### Task 11: Spotify reconnect ack data

**Context:** `spotify:reconnect` command ack only includes `{connected: boolean}`. GM Scanner has no track/state info after reconnect.

**Files:**
- Modify: `backend/src/services/commandExecutor.js`
- Modify: `backend/tests/unit/services/commandExecutor.test.js`

**Step 1: Write failing test**

```javascript
it('should include full spotify state in reconnect ack data', async () => {
  spotifyService.activate.mockResolvedValue(true);
  spotifyService.getState.mockReturnValue({
    connected: true, state: 'playing', volume: 80,
    track: { title: 'Song', artist: 'Artist' }
  });
  const result = await executeCommand({ action: 'spotify:reconnect', payload: {}, source: 'gm' });
  expect(result.data).toEqual(expect.objectContaining({
    connected: true, state: 'playing', volume: 80,
    track: expect.objectContaining({ title: 'Song' })
  }));
});
```

**Step 2: Run to verify fail**

**Step 3: Update commandExecutor spotify:reconnect case**

Find the spotify:reconnect case and update the result to include full state:

```javascript
      case 'spotify:reconnect': {
        const activated = await spotifyService.activate();
        resultData = spotifyService.getState();
        resultMessage = activated ? 'Spotify reconnected' : 'Spotify reconnection failed';
        if (!activated) {
          throw new Error('Spotify reconnection failed — spotifyd not responding');
        }
        break;
      }
```

Ensure `resultData` is included in the return value (check the return statement at the bottom of executeCommand — it should already return `{ success, message, data: resultData, source }`).

**Step 4: Run tests and commit**

```bash
cd backend && npm run test:unit 2>&1 | tail -5
git add backend/src/services/commandExecutor.js backend/tests/unit/services/commandExecutor.test.js
git commit -m "fix: include full Spotify state in reconnect ack"
```

---

### Task 12: Ducking volume failure reporting

**Context:** `_setVolumeForDucking()` catches all errors silently. GM thinks ducking worked but volume may not have changed.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js`
- Modify: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Write failing test**

```javascript
it('should emit ducking:failed when volume set fails (non-missing-sink)', async () => {
  const handler = jest.fn();
  audioRoutingService.on('ducking:failed', handler);

  // Mock setStreamVolume to reject with non-missing-sink error
  jest.spyOn(audioRoutingService, 'setStreamVolume')
    .mockRejectedValue(new Error('PipeWire daemon not responding'));

  audioRoutingService._setVolumeForDucking('spotify', 20, 'duck');
  await new Promise(resolve => setTimeout(resolve, 10)); // Let catch fire

  expect(handler).toHaveBeenCalledWith(expect.objectContaining({
    target: 'spotify',
    error: expect.stringContaining('PipeWire')
  }));
});

it('should NOT emit ducking:failed for missing sink-input (expected case)', async () => {
  const handler = jest.fn();
  audioRoutingService.on('ducking:failed', handler);

  jest.spyOn(audioRoutingService, 'setStreamVolume')
    .mockRejectedValue(new Error('No active sink-input for spotify'));

  audioRoutingService._setVolumeForDucking('spotify', 20, 'duck');
  await new Promise(resolve => setTimeout(resolve, 10));

  expect(handler).not.toHaveBeenCalled();
});
```

**Step 2: Run to verify fail**

**Step 3: Add ducking:failed emission**

In audioRoutingService.js `_setVolumeForDucking` (around line 915):

```javascript
  _setVolumeForDucking(target, volume, context) {
    this.setStreamVolume(target, volume).catch(err => {
      if (err.message.includes('No active sink-input')) {
        logger.warn(`Ducking ${context} skipped: sink-input not available`, { target, volume });
      } else {
        logger.error(`Failed to ${context} ducked volume`, { target, volume, error: err.message });
        this.emit('ducking:failed', { target, volume, context, error: err.message });
      }
    });
  }
```

**Step 4: Run tests and commit**

```bash
cd backend && npm run test:unit 2>&1 | tail -5
git add backend/src/services/audioRoutingService.js backend/tests/unit/services/audioRoutingService.test.js
git commit -m "fix: emit ducking:failed for non-recoverable volume errors"
```

---

### Task 13: Final verification — rebuild GM Scanner and run full test suites

**Step 1: Run backend full test suite**

```bash
cd backend && npm run test:unit 2>&1 | tail -10
```

Expected: All tests pass, count should be baseline + new tests (~985+)

**Step 2: Run ALNScanner full test suite**

```bash
cd ALNScanner && npm test 2>&1 | tail -10
```

Expected: All tests pass, count should be baseline + new tests (~980+)

**Step 3: Rebuild GM Scanner for production**

```bash
cd ALNScanner && npm run build 2>&1 | tail -5
```

Expected: Build succeeds

**Step 4: Restart backend to pick up changes**

```bash
cd backend && npm run dev:full
```

**Step 5: Commit final state**

```bash
git add -A
git status  # Verify only expected files
git commit -m "chore: rebuild GM Scanner after show control audit fixes"
```

---

## Summary of Changes

| Task | Files Modified | Issue Fixed |
|------|---------------|-------------|
| 1 | commandExecutor.js | Video commands routed through videoQueueService |
| 2 | broadcasts.js | Queue reorder broadcasts to GM |
| 3 | spotifyService.js | Metadata awaited, null-protected |
| 4 | cueEngineService.js | Enable/disable emit cue:status |
| 5 | MonitoringDisplay.js | Video state renders in admin |
| 6 | domEventBindings.js | Command errors shown to GM |
| 7 | spotifyService.js | checkConnection emits state changes |
| 8 | commandExecutor.js | VLC degraded mode reports failure |
| 9 | broadcasts.js | Sound errors broadcast |
| 10 | SpotifyRenderer.js, MonitoringDisplay.js | Ducking status visible |
| 11 | commandExecutor.js | Reconnect ack includes full state |
| 12 | audioRoutingService.js | Ducking failures reported |
| 13 | — | Full verification pass |
