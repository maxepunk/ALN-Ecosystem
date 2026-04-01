# Service Layer Review Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all bugs, dead code, and wiring gaps identified in the deep code review of the ALN backend services, GM Scanner frontend, and config tool.

**Architecture:** Fixes are organized in 5 phases by blast radius: backend critical (runtime failures during games) → backend important (real bugs, lower probability) → dead code removal → config tool cleanup → GM Scanner frontend. Each phase is independently committable. All fixes are surgical — no architectural changes.

**Tech Stack:** Node.js (backend services), ES6/Vite (GM Scanner), vanilla JS (config tool). Tests: Jest (backend unit/contract), Playwright (E2E).

**Test baselines (pre-fix):** Backend: 1468 unit+contract. Integration: 278. ALNScanner: 1116 unit.

---

## Phase 1: Backend Critical Fixes

These fixes prevent runtime failures during game sessions.

### Task 1: Fix `progressTimer` interval leak in videoQueueService

The 1-second D-Bus polling interval (`progressTimer`) keeps firing after `clearQueue()` and `skipCurrent()` because neither method clears it. Only the `playbackTimer` (fallback timeout) is cleared. After a GM stops video, orphaned `checkStatus` closures keep calling `vlcService.getStatus()` against a stopped VLC.

**Files:**
- Modify: `backend/src/services/videoQueueService.js`
- Test: `backend/tests/unit/services/videoQueueService.test.js`

**Step 1: Write the failing tests**

Add to `videoQueueService.test.js` in the appropriate describe block:

```javascript
describe('progressTimer cleanup', () => {
  it('should clear progressTimer on skipCurrent', async () => {
    // Set up a playing item with a progressTimer
    videoQueueService.currentItem = {
      isPlaying: () => true, id: 'test', tokenId: 'tok1',
      completePlayback: jest.fn(), getPlaybackDuration: () => 5,
    };
    videoQueueService.progressTimer = setInterval(() => {}, 1000);

    await videoQueueService.skipCurrent();

    expect(videoQueueService.progressTimer).toBeNull();
  });

  it('should clear progressTimer on clearQueue', () => {
    videoQueueService.currentItem = {
      failPlayback: jest.fn(), isPlaying: () => true,
    };
    videoQueueService.progressTimer = setInterval(() => {}, 1000);

    videoQueueService.clearQueue();

    expect(videoQueueService.progressTimer).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/services/videoQueueService.test.js -t "progressTimer cleanup" --no-coverage`
Expected: FAIL — `progressTimer` is not null after calls

**Step 3: Fix `skipCurrent()`**

In `backend/src/services/videoQueueService.js`, in `skipCurrent()` method (around line 462), add progressTimer cleanup BEFORE `completePlayback`:

```javascript
  async skipCurrent() {
    if (!this.currentItem || !this.currentItem.isPlaying()) {
      return false;
    }

    logger.info('Skipping current video', {
      itemId: this.currentItem.id,
      tokenId: this.currentItem.tokenId,
    });

    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    if (config.features.videoPlayback) {
      await vlcService.stop();
    }

    this.completePlayback(this.currentItem);
    return true;
  }
```

**Step 4: Fix `clearQueue()`**

In `clearQueue()` (around line 738), add progressTimer cleanup after playbackTimer cleanup:

```javascript
  clearQueue() {
    // Stop current playback
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    if (this.currentItem) {
      this.currentItem.failPlayback('Queue cleared');
    }
    // ... rest unchanged
```

**Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/videoQueueService.test.js --no-coverage`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/src/services/videoQueueService.js backend/tests/unit/services/videoQueueService.test.js
git commit -m "fix: clear progressTimer in skipCurrent/clearQueue to prevent leaked D-Bus polling"
```

---

### Task 2: Fix `_processStateChange` calling `_resolveOwner` directly

When spotifyd auto-recovers (was down, MPRIS signal received), `_processStateChange` calls `this._resolveOwner()` fire-and-forget. If the D-Bus lookup times out, `_resolveOwner` sets `_ownerBusName = null`, disabling cross-contamination filtering until next signal. Should call `_refreshOwner()` which preserves the old value on failure.

**Files:**
- Modify: `backend/src/services/spotifyService.js:370`

**Step 1: Fix the call**

In `backend/src/services/spotifyService.js`, in `_processStateChange()` (line 370), change:

```javascript
      this._resolveOwner(); // Fire-and-forget: re-resolve after restart
```

to:

```javascript
      this._refreshOwner(); // Fire-and-forget: re-resolve after restart (preserves old owner on failure)
```

**Step 2: Update the test**

In `backend/tests/unit/services/spotifyService.test.js`, find the test "should call _resolveOwner in auto-recovery" and update it to expect `_refreshOwner`:

Change the mock setup line from:
```javascript
      spotifyService._resolveOwner = jest.fn().mockResolvedValue(undefined);
```
to:
```javascript
      spotifyService._refreshOwner = jest.fn().mockResolvedValue(undefined);
```

And change the assertion from:
```javascript
        expect(spotifyService._resolveOwner).toHaveBeenCalled();
```
to:
```javascript
        expect(spotifyService._refreshOwner).toHaveBeenCalled();
```

**Step 3: Run tests**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add backend/src/services/spotifyService.js backend/tests/unit/services/spotifyService.test.js
git commit -m "fix: use _refreshOwner in auto-recovery to preserve cross-contamination filter on failure"
```

---

### Task 3: Guard `gameClockService.start()` against paused state

Calling `start()` on a paused clock silently resets `gameStartTime` and `totalPausedMs`, erasing all elapsed time. This could lose 2 hours of game time if triggered accidentally.

**Files:**
- Modify: `backend/src/services/gameClockService.js:30`
- Test: `backend/tests/unit/services/gameClockService.test.js`

**Step 1: Write the failing test**

```javascript
it('should throw when called on a paused clock', () => {
  gameClockService.start();
  gameClockService.pause();
  expect(() => gameClockService.start()).toThrow('paused');
});
```

**Step 2: Run to verify failure**

Run: `cd backend && npx jest tests/unit/services/gameClockService.test.js -t "should throw when called on a paused" --no-coverage`
Expected: FAIL — does not throw

**Step 3: Add the guard**

In `backend/src/services/gameClockService.js`, replace the `start()` method:

```javascript
  start() {
    if (this.status === 'running') {
      throw new Error('Game clock is already running');
    }
    if (this.status === 'paused') {
      throw new Error('Game clock is paused — call resume() instead of start()');
    }
    this.gameStartTime = Date.now();
    // ... rest unchanged
```

**Step 4: Run tests**

Run: `cd backend && npx jest tests/unit/services/gameClockService.test.js --no-coverage`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/src/services/gameClockService.js backend/tests/unit/services/gameClockService.test.js
git commit -m "fix: guard gameClockService.start() against paused state to prevent silent time reset"
```

---

### Task 4: Add `error` handler to `pw-loopback` spawn

If `pw-loopback` binary is not found, `spawn` emits an unhandled `error` event that crashes the Node.js process. Every other process spawn in the codebase handles this.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (around line 533-548)
- Test: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Add error handlers**

In `backend/src/services/audioRoutingService.js`, inside the `for (const sink of targetSinks)` loop in `createCombineSink()`, after the existing `proc.on('close', ...)` handler (line 539-542), add:

```javascript
      proc.on('error', (err) => {
        logger.error('pw-loopback spawn error', { sink: sink.name, error: err.message });
        // NOTE: 'close' also fires after 'error' on ENOENT — _combineSinkActive guard
        // in _onCombineLoopbackExit prevents double teardown
        this._onCombineLoopbackExit(proc.pid);
      });
```

**Step 2: Run existing tests to verify no regression**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js --no-coverage`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/src/services/audioRoutingService.js
git commit -m "fix: add error handler to pw-loopback spawn to prevent ENOENT crash"
```

---

### Task 5: Emit `combine-sink:destroyed` in `_onCombineLoopbackExit`

When a loopback crashes (vs intentional teardown via `destroyCombineSink()`), the combine-sink is torn down but `combine-sink:destroyed` is never emitted. The GM panel continues showing "All Bluetooth Speakers" as an available sink option.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (line 697)
- Test: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Write the failing test**

```javascript
it('should emit combine-sink:destroyed on loopback exit', async () => {
  // Pre-set combine sink state
  audioRoutingService._combineSinkActive = true;
  audioRoutingService._combineSinkPids = [123, 456];
  audioRoutingService._combineSinkProcs = [
    { kill: jest.fn() },
    { kill: jest.fn() },
  ];
  audioRoutingService._combineSinkModuleId = '99';

  // Mock the unload call
  execFile.mockImplementation((cmd, args, opts, cb) => cb(null, '', ''));

  const handler = jest.fn();
  audioRoutingService.on('combine-sink:destroyed', handler);

  await audioRoutingService._onCombineLoopbackExit(123);

  expect(handler).toHaveBeenCalled();
  expect(audioRoutingService._combineSinkActive).toBe(false);
});
```

**Step 2: Run to verify failure**

Expected: FAIL — `combine-sink:destroyed` not emitted

**Step 3: Add the emit**

At the end of `_onCombineLoopbackExit()` (line 697, before the closing `}`), add:

```javascript
    this.emit('combine-sink:destroyed');
```

**Step 4: Run tests**

Run: `cd backend && npx jest tests/unit/services/audioRoutingService.test.js --no-coverage`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/src/services/audioRoutingService.js backend/tests/unit/services/audioRoutingService.test.js
git commit -m "fix: emit combine-sink:destroyed on loopback crash for GM panel state consistency"
```

---

## Phase 2: Backend Important Fixes

Real bugs with lower probability or graceful degradation paths.

### Task 6: Fix Spotify concurrent recovery — use Promise lock

The boolean `_recovering` flag doesn't serialize concurrent callers. Two simultaneous D-Bus failures each enter recovery and call `activate()` (TransferPlayback), potentially corrupting spotifyd state.

**Design:** Recovery is separated from retry. Recovery (shared promise, command-agnostic) re-activates spotifyd once. Each caller then retries its **own** command after recovery succeeds. On recovery failure, each caller throws its **own** original error. This prevents result mismatch where caller B receives caller A's retry result.

**Files:**
- Modify: `backend/src/services/spotifyService.js:131-162`
- Test: `backend/tests/unit/services/spotifyService.test.js`

**Step 1: Replace `_recovering` boolean with `_recoveringPromise` in constructor**

In `spotifyService.js` constructor (line 41), replace:
```javascript
    this._recovering = false; // Prevents infinite recursion in reactive recovery
```
with:
```javascript
    this._recoveringPromise = null; // Shared promise serializes concurrent recovery
```

**Step 2: Rewrite the recovery logic in `_dbusCall`**

Replace lines 131-162 with:

```javascript
  async _dbusCall(method, args = []) {
    const dest = await this._discoverDbusDest();
    if (!dest) throw new Error('spotifyd not found on D-Bus');
    try {
      return await super._dbusCall(method, args);
    } catch (err) {
      // Serialize concurrent recovery via shared promise (command-agnostic)
      if (!this._recoveringPromise) {
        this._recoveringPromise = this._attemptRecovery()
          .finally(() => { this._recoveringPromise = null; });
      }
      try {
        await this._recoveringPromise;
      } catch {
        // Recovery failed — throw our own original error
        throw err;
      }
      // Recovery succeeded — retry OUR command (not the first caller's)
      return await super._dbusCall(method, args);
    }
  }

  /**
   * Attempt to recover spotifyd via TransferPlayback.
   * Command-agnostic — just re-activates the connection.
   * Shared by all concurrent callers via _recoveringPromise.
   * @private
   */
  async _attemptRecovery() {
    logger.warn('[Spotify] D-Bus call failed, attempting recovery');
    this._dbusDest = null;
    this._dbusCacheTime = 0;
    this._spotifydDest = null;
    this._spotifydCacheTime = 0;
    this._ownerBusName = null;
    const activated = await this.activate();
    if (!activated) throw new Error('Spotify recovery failed');
    logger.info('[Spotify] Recovery succeeded, callers will retry');
    const dest = await this._discoverDbusDest();
    if (!dest) throw new Error('MPRIS interface not found after recovery');
  }
```

**Step 3: Update tests that reference `_recovering`**

Three locations in `spotifyService.test.js` reference `_recovering`:

1. **Reset test** (line 350): Change `spotifyService._recovering = true` → `spotifyService._recoveringPromise = Promise.resolve()`
2. **Reset assertion** (line 357): Change `expect(spotifyService._recovering).toBe(false)` → `expect(spotifyService._recoveringPromise).toBeNull()`
3. **Recovery test assertion** (line 589): Change `expect(spotifyService._recovering).toBe(false)` → `expect(spotifyService._recoveringPromise).toBeNull()`

**Step 4: Update `reset()` in spotifyService.js**

In `reset()` (line 442), change `this._recovering = false` → `this._recoveringPromise = null`.

**Step 5: Run tests**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/src/services/spotifyService.js backend/tests/unit/services/spotifyService.test.js
git commit -m "fix: serialize concurrent Spotify recovery with Promise lock instead of boolean flag"
```

---

### Task 7: Fix `pauseForGameClock` flag ordering

`_pausedByGameClock = true` is set AFTER the async `pause()` call. If the D-Bus monitor fires the state change during the await, `resumeFromGameClock()` would see `false` and not resume.

**Files:**
- Modify: `backend/src/services/spotifyService.js:261-266`

**Step 1: Move the flag**

Replace:
```javascript
  async pauseForGameClock() {
    if (this.state === 'playing') {
      await this.pause();
      this._pausedByGameClock = true;
    }
  }
```

with:

```javascript
  async pauseForGameClock() {
    if (this.state === 'playing') {
      this._pausedByGameClock = true;
      try {
        await this.pause();
      } catch (err) {
        this._pausedByGameClock = false;
        throw err;
      }
    }
  }
```

**Step 2: Run tests**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/src/services/spotifyService.js
git commit -m "fix: set _pausedByGameClock before async pause to prevent race with D-Bus monitor"
```

---

### Task 8: Clear stale `currentItem` after file-not-found error

`playVideo()` sets `this.currentItem = queueItem` (line 151) BEFORE the file-existence check (line 161). When the file check throws, `processQueue()`'s catch block calls `failPlayback()` but doesn't null out `currentItem`. This leaves `currentItem` pointing to a failed item until the next `playVideo()` overwrites it. During this window, `getState()` reports a stale `currentItem` and the held-video logic could be confused by a non-playing item in `currentItem`.

**Files:**
- Modify: `backend/src/services/videoQueueService.js:113-123`

**Step 1: Add `currentItem = null` to the catch block**

Replace:
```javascript
    } catch (error) {
      logger.error('Failed to play video', { error, itemId: nextItem.id });
      nextItem.failPlayback(error.message);
      this.emit('video:failed', nextItem);

      // Clean up failed items from queue
      this.clearCompleted();

      // Try next item
      setImmediate(() => this.processQueue());
    }
```

with:

```javascript
    } catch (error) {
      logger.error('Failed to play video', { error, itemId: nextItem.id });
      nextItem.failPlayback(error.message);
      this.currentItem = null;
      this.emit('video:failed', nextItem);

      // Clean up failed items from queue
      this.clearCompleted();

      // Try next item
      setImmediate(() => this.processQueue());
    }
```

**Step 2: Run tests**

Run: `cd backend && npx jest tests/unit/services/videoQueueService.test.js --no-coverage`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/src/services/videoQueueService.js
git commit -m "fix: null currentItem after file-not-found to prevent stale reference in getState()"
```

---

### Task 9: Fix `bluetoothService.cleanup()` scan:stopped promise leak

`cleanup()` kills `_scanProc` and sets it to `null` without emitting `scan:stopped`. Any pending `stopScan()` promise hangs forever.

**Files:**
- Modify: `backend/src/services/bluetoothService.js:409-414`

**Step 1: Emit scan:stopped in cleanup**

Replace:
```javascript
  cleanup() {
    this.stopDeviceMonitor();
    if (this._scanProc) {
      this._scanProc.kill();
      this._scanProc = null;
    }
```

with:

```javascript
  cleanup() {
    this.stopDeviceMonitor();
    if (this._scanProc) {
      this._scanProc.kill();
      this._scanProc = null;
      this.emit('scan:stopped', { exitCode: null });
    }
```

**Step 2: Run tests**

Run: `cd backend && npx jest tests/unit/services/bluetoothService.test.js --no-coverage`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/src/services/bluetoothService.js
git commit -m "fix: emit scan:stopped in cleanup to prevent hanging stopScan promises"
```

---

### Task 10: Guard `soundService.play()` against undefined `proc.pid`

If `pw-play` binary is missing, `spawn` returns a process with `pid === undefined`. This creates zombie Map entries and emits `sound:started` with `pid: undefined`.

**Files:**
- Modify: `backend/src/services/soundService.js:67-96`

**Step 1: Guard `processes.set` and `sound:started` against undefined pid**

When `spawn` fails (e.g., ENOENT), `proc.pid` is `undefined`. The existing error/close handlers tolerate this (`Map.delete(undefined)` is a no-op), but we should prevent the zombie Map entry and misleading `sound:started` event.

Replace lines 69-96:
```javascript
    const entry = { file, target: target || 'default', volume: volume || 100, pid: proc.pid };

    // Guard: spawn can fail with pid=undefined (e.g., binary not found)
    if (proc.pid) {
      this.processes.set(proc.pid, { ...entry, process: proc });
    }

    // Completion promise: resolves when pw-play exits (callers decide whether to await)
    entry.completion = new Promise(resolve => {
      proc.on('close', (code) => {
        resolve({ file, completed: code === 0 });
      });
    });

    proc.on('close', (code) => {
      this.processes.delete(proc.pid);
      if (code === 0) {
        this.emit('sound:completed', { file, pid: proc.pid });
      } else {
        this.emit('sound:stopped', { file, pid: proc.pid, reason: code === null ? 'killed' : 'error' });
      }
    });

    proc.on('error', (err) => {
      this.processes.delete(proc.pid);
      logger.error(`[Sound] pw-play error for ${file}:`, err.message);
      this.emit('sound:error', { file, error: err.message });
    });

    if (proc.pid) {
      this.emit('sound:started', entry);
      logger.info(`[Sound] Playing ${file} (pid=${proc.pid}, target=${entry.target})`);
    }

    return entry;
```

**Step 2: Run tests**

Run: `cd backend && npx jest tests/unit/services/soundService.test.js --no-coverage`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/src/services/soundService.js
git commit -m "fix: guard soundService against undefined proc.pid on spawn failure"
```

---

### Task 11: Guard `lightingService.getScenes()` entity attributes

One malformed HA entity (with null `attributes`) throws TypeError, discarding ALL scenes and falling back to fixtures silently.

**Files:**
- Modify: `backend/src/services/lightingService.js:311`

**Step 1: Add optional chaining**

Change line 311 from:
```javascript
          name: entity.attributes.friendly_name,
```
to:
```javascript
          name: entity.attributes?.friendly_name ?? entity.entity_id,
```

**Step 2: Run tests**

Run: `cd backend && npx jest tests/unit/services/lightingService.test.js --no-coverage`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/src/services/lightingService.js
git commit -m "fix: guard lightingService.getScenes against malformed HA entity attributes"
```

---

### Task 12: Add `display:idle-loop` to `SERVICE_DEPENDENCIES`

`display:idle-loop` calls VLC via `displayControlService.setIdleLoop()` but bypasses the health gate. GM gets an opaque error instead of "vlc is down".

**Files:**
- Modify: `backend/src/services/commandExecutor.js:27-58`

**Step 1: Add the dependency**

In the `SERVICE_DEPENDENCIES` map, add after the video entries:

```javascript
  'display:idle-loop': 'vlc',
```

**Step 2: Run tests**

Run: `cd backend && npx jest tests/unit/services/commandExecutor.test.js --no-coverage`
Expected: ALL PASS (or adjust any test that expects `display:idle-loop` to succeed without VLC health)

**Step 3: Commit**

```bash
git add backend/src/services/commandExecutor.js
git commit -m "fix: gate display:idle-loop on vlc health in SERVICE_DEPENDENCIES"
```

---

## Phase 3: Dead Code Removal

Clean up dead code to reduce confusion and maintenance burden.

### Task 13: Fix `VideoQueueItem.failPlayback()` dead code

`failPlayback()` sets `this.status = 'failed'` then checks `if (this.status === 'playing')` — always false. Fix to capture state before overwriting.

**Files:**
- Modify: `backend/src/models/videoQueueItem.js:102-108`

**Step 1: Fix the method**

Replace:
```javascript
  failPlayback(error) {
    this.status = 'failed';
    this.error = error;
    if (this.status === 'playing' && !this.playbackEnd) {
      this.playbackEnd = new Date().toISOString();
    }
  }
```

with:

```javascript
  failPlayback(error) {
    const wasPlaying = this.status === 'playing';
    this.status = 'failed';
    this.error = error;
    if (wasPlaying && !this.playbackEnd) {
      this.playbackEnd = new Date().toISOString();
    }
  }
```

**Step 2: Run tests**

Run: `cd backend && npx jest tests/unit/models/videoQueueItem.test.js --no-coverage`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/src/models/videoQueueItem.js
git commit -m "fix: capture playing state before overwriting in failPlayback for correct playbackEnd"
```

---

### Task 14: Remove dead `checkQueueHealth()` and `vlcService.skip()`

`checkQueueHealth()` is 30 lines never called. `vlcService.skip()` is never called (only `stop()` is used). Both are dead code.

**Files:**
- Modify: `backend/src/services/videoQueueService.js` (remove `checkQueueHealth` method, lines 918-946)
- Modify: `backend/src/services/vlcMprisService.js` (remove `skip()` method, lines 271-275)
- Modify: Any test files that test these methods

**Step 1: Remove `checkQueueHealth()` from videoQueueService.js**

Delete the entire `checkQueueHealth()` method (lines 918-946).

**Step 2: Remove `skip()` from vlcMprisService.js**

Delete the `skip()` method (lines 267-275).

**Step 3: Remove or comment out corresponding tests**

If tests exist for `checkQueueHealth` or `vlcService.skip()`, remove them.

**Step 4: Run full test suite to verify no callers**

Run: `cd backend && npm test`
Expected: ALL PASS (no callers means no breakage)

**Step 5: Commit**

```bash
git add backend/src/services/videoQueueService.js backend/src/services/vlcMprisService.js
# Add any modified test files
git commit -m "chore: remove dead checkQueueHealth and vlcService.skip methods"
```

---

### Task 15: Remove dead `stateService` error listener from broadcasts.js

`stateService` no longer does async work — it only provides `getCurrentState()` and `reset()`. Its error listener can never fire.

**Files:**
- Modify: `backend/src/websocket/broadcasts.js:527`

**Step 1: Remove the listener**

Delete line 527:
```javascript
  addTrackedListener(stateService, 'error', (error) => handleServiceError('state', error));
```

**Step 2: Check if `stateService` can be removed from the destructuring**

If `stateService` is not used elsewhere in `setupBroadcastListeners`, remove it from the destructuring at line 62.

**Step 3: Run tests**

Run: `cd backend && npm test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add backend/src/websocket/broadcasts.js
git commit -m "chore: remove dead stateService error listener from broadcasts"
```

---

### Task 16: Fix stale Spotify `init()` tests

The init tests assert an `activate()`-first flow that was removed. The actual `init()` (line 219) only calls `checkConnection()` passively then starts the playback monitor. Tests pass accidentally through mock coincidence — the execFile mocks satisfy `checkConnection`'s D-Bus calls without actually testing the activate path they claim to test.

**Files:**
- Modify: `backend/tests/unit/services/spotifyService.test.js` (the `describe('init', ...)` block)

**Step 1: Replace all 3 tests in the `describe('init', ...)` block (lines 515-554)**

The existing block has 3 tests: "should attempt activate first", "should fall back to checkConnection when activate fails", "should not throw when both activate and checkConnection fail". Replace the entire block with:

```javascript
  describe('init', () => {
    it('should check existing connection passively', async () => {
      // Mock checkConnection returning true
      spotifyService.checkConnection = jest.fn().mockResolvedValue(true);
      spotifyService.startPlaybackMonitor = jest.fn();

      await spotifyService.init();

      expect(spotifyService.checkConnection).toHaveBeenCalled();
      expect(spotifyService.startPlaybackMonitor).toHaveBeenCalled();
    });

    it('should start monitor even when not connected', async () => {
      spotifyService.checkConnection = jest.fn().mockResolvedValue(false);
      spotifyService.startPlaybackMonitor = jest.fn();

      await spotifyService.init();

      expect(spotifyService.startPlaybackMonitor).toHaveBeenCalled();
    });

    it('should not call activate on init', async () => {
      spotifyService.checkConnection = jest.fn().mockResolvedValue(false);
      spotifyService.startPlaybackMonitor = jest.fn();
      spotifyService.activate = jest.fn();

      await spotifyService.init();

      expect(spotifyService.activate).not.toHaveBeenCalled();
    });
  });
```

**Step 2: Run tests**

Run: `cd backend && npx jest tests/unit/services/spotifyService.test.js -t "init" --no-coverage`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/tests/unit/services/spotifyService.test.js
git commit -m "test: rewrite stale Spotify init tests to match passive-only init behavior"
```

---

## Phase 4: Config Tool Cleanup

Fix stale/wrong config keys that mislead operators.

### Task 17: Remove stale VLC env vars and dead config keys

**Files:**
- Modify: `config-tool/public/js/sections/infra.js`
- Modify: `config-tool/public/js/sections/audio.js`

**Step 1: Remove stale VLC group from infra.js**

In `config-tool/public/js/sections/infra.js`, replace the VLC group (lines 35-42):

```javascript
  {
    label: 'VLC', fields: [
      { key: 'VLC_HOST', label: 'VLC Host', type: 'text' },
      { key: 'VLC_PORT', label: 'VLC Port', type: 'number' },
      { key: 'VLC_PASSWORD', label: 'VLC Password', type: 'password' },
      { key: 'VLC_RECONNECT_INTERVAL', label: 'Reconnect Interval (ms)', type: 'number' },
      { key: 'VLC_MAX_RETRIES', label: 'Max Retries', type: 'number' },
      { key: 'VIDEO_DIR', label: 'Video Directory', type: 'text' },
    ],
  },
```

with:

```javascript
  {
    label: 'Video', fields: [
      { key: 'VIDEO_DIR', label: 'Video Directory', type: 'text' },
      { key: 'VLC_HW_ACCEL', label: 'VLC HW Accel Override', type: 'text', hint: 'auto, vaapi, none' },
    ],
  },
```

**Step 2: Remove dead `HEARTBEAT_INTERVAL` from the Session group**

Remove `HEARTBEAT_INTERVAL` from the Session group (line 50). No backend service reads this key.

**NOTE:** Do NOT rename `ENABLE_VIDEO_PLAYBACK`. The config tool key matches the backend (`config/index.js:111` reads `process.env.ENABLE_VIDEO_PLAYBACK`). The `FEATURE_VIDEO_PLAYBACK` references in `test-server.js` and `start-dev.js` are bugs in those scripts (they set a key the backend never reads) — separate cleanup.

**Step 3: Remove dead `SPOTIFY_DEFAULT_PLAYLIST` from audio.js**

In `config-tool/public/js/sections/audio.js`, remove the `makeEnvField` call for `SPOTIFY_DEFAULT_PLAYLIST` (line 89). No backend service reads this key.

**Step 4: Run config tool tests**

Run: `cd config-tool && npm test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add config-tool/public/js/sections/infra.js config-tool/public/js/sections/audio.js
git commit -m "fix: remove stale VLC HTTP config keys, dead HEARTBEAT_INTERVAL and SPOTIFY_DEFAULT_PLAYLIST"
```

---

### Task 18: Add ENOENT guard to `configManager._readJson`

Fresh setup with no `cues.json` or `routing.json` crashes the entire config tool.

**Files:**
- Modify: `config-tool/lib/configManager.js:40-42`

**Step 1: Add try/catch**

Replace:
```javascript
  _readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
```

with:

```javascript
  _readJson(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return {};
      throw err;
    }
  }
```

**Step 2: Run tests**

Run: `cd config-tool && npm test`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add config-tool/lib/configManager.js
git commit -m "fix: gracefully handle missing config files in configManager._readJson"
```

---

## Phase 5: GM Scanner Frontend Fixes

Fix state consumption and wiring issues in the GM Scanner.

### Task 19: Fix ducking state shape mismatch in MonitoringDisplay

`audioRoutingService.getState().ducking` returns `{ spotify: ['video', 'sound'] }` (array), but `SpotifyRenderer.renderDucking()` expects `{ ducked: boolean, activeSources: Array }`.

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js:82-88`

**Step 1: Transform the shape**

Replace:
```javascript
    // Environment: Audio + ducking forwarding
    on('audio', (state, prev) => {
      this.envRenderer.renderAudio(state, prev);
      const spotifyDucking = state?.ducking?.spotify;
      if (spotifyDucking) {
        this.spotifyRenderer.renderDucking(spotifyDucking);
      }
    });
```

with:

```javascript
    // Environment: Audio + ducking forwarding
    on('audio', (state, prev) => {
      this.envRenderer.renderAudio(state, prev);
      // Transform backend shape { spotify: ['video'] } → renderer shape { ducked, activeSources }
      const duckingSources = state?.ducking?.spotify;
      this.spotifyRenderer.renderDucking(
        duckingSources && duckingSources.length > 0
          ? { ducked: true, activeSources: duckingSources }
          : { ducked: false, activeSources: [] }
      );
    });
```

**Step 2: Run ALNScanner tests**

Run: `cd ALNScanner && npm test -- --testPathPattern="MonitoringDisplay" --no-coverage`
Expected: ALL PASS (or update test mocks to use new shape)

**Step 3: Commit**

```bash
cd ALNScanner && git add src/admin/MonitoringDisplay.js
git commit -m "fix: transform ducking state shape for SpotifyRenderer (array → {ducked, activeSources})"
```

---

### Task 20: Fix `CommandSender` ack race condition

`CommandSender` consumes the first `gm:command:ack` regardless of which action it's for. Concurrent admin operations get mismatched acks.

**Files:**
- Modify: `ALNScanner/src/admin/utils/CommandSender.js:37-42`

**Step 1: Add action check**

After line 41 (`if (type !== 'gm:command:ack') return;`), add:

```javascript
      // Only consume acks for OUR action (prevent cross-command mismatch)
      if (response.action !== action) return;
```

**Step 2: Run tests**

Run: `cd ALNScanner && npm test -- --testPathPattern="CommandSender" --no-coverage`
Expected: ALL PASS

**Step 3: Commit**

```bash
cd ALNScanner && git add src/admin/utils/CommandSender.js
git commit -m "fix: match CommandSender ack by action to prevent concurrent command mismatch"
```

---

### Task 21: Remove dead `video:queue:update` handler

This event no longer exists in the unified state architecture. The handler can never fire.

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js:188-190`

**Step 1: Remove the case**

Delete lines 188-190:
```javascript
      case 'video:queue:update':
        this.updateQueueDisplay(payload);
        break;
```

**Step 2: Run tests**

Run: `cd ALNScanner && npm test -- --testPathPattern="MonitoringDisplay" --no-coverage`
Expected: ALL PASS

**Step 3: Commit**

```bash
cd ALNScanner && git add src/admin/MonitoringDisplay.js
git commit -m "chore: remove dead video:queue:update handler from MonitoringDisplay"
```

---

### Task 22: (Defensive) Re-apply routes after audio dropdown rebuild

**NOTE: This is a defensive improvement, not a confirmed bug.** `service:state` sends full `getState()` snapshots, so `routes` and `availableSinks` always arrive together. The current code handles this correctly — after rebuilding dropdowns, the route-application block at lines 157-168 runs in the same call and sets values on the fresh dropdowns. However, the explicit re-application after rebuild makes the code more resilient to future changes in state delivery patterns.

**Files:**
- Modify: `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:144-154`

**Step 1: Re-apply routes after dropdown rebuild**

Replace the `renderAudio` method's sink rebuild section:

```javascript
  renderAudio(audioState, prev = null) {
    const { routes, availableSinks } = audioState;

    // Build dropdowns if sinks available and changed
    if (availableSinks && availableSinks.length > 0 && this.audioRoutingContainer) {
      const sinkKey = availableSinks.map(s => s.name).join(',');
      if (sinkKey !== this._lastSinkKey) {
        this._renderAudioDropdowns(availableSinks);
        this._lastSinkKey = sinkKey;
        // Re-apply routes after rebuilding dropdowns (they were wiped by rebuild)
        if (routes) {
          Object.entries(routes).forEach(([stream, sink]) => {
            const dropdown = this.audioRoutingContainer?.querySelector(`select[data-stream="${stream}"]`);
            if (dropdown) dropdown.value = sink;
          });
        }
        return; // Routes already applied above — skip duplicate application below
      }
    }

    // Update selection values (differential — only change if different)
    if (routes) {
```

Note: Keep the existing route-update logic below for subsequent state updates where sinks haven't changed.

**Step 2: Run tests**

Run: `cd ALNScanner && npm test -- --testPathPattern="EnvironmentRenderer" --no-coverage`
Expected: ALL PASS

**Step 3: Commit**

```bash
cd ALNScanner && git add src/ui/renderers/EnvironmentRenderer.js
git commit -m "refactor: defensively re-apply routes after audio dropdown rebuild"
```

---

### Task 23: Rebuild ALNScanner dist for E2E tests

The `backend/public/gm-scanner` is a symlink to `ALNScanner/dist`. After changing ALNScanner source, the dist must be rebuilt for E2E tests to see the changes.

**Step 1: Build**

Run: `cd ALNScanner && npm run build`
Expected: Build succeeds with no errors

**Step 2: Commit the submodule ref update from parent repo (if needed)**

If ALNScanner is a submodule, stage the updated ref:

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add ALNScanner
git commit -m "chore: update ALNScanner submodule ref after frontend fixes"
```

---

## Phase 6: Full Test Verification

### Task 24: Run all test suites

**Step 1: Backend unit + contract tests**

Run: `cd backend && npm test`
Expected: ~1468 tests pass (baseline may shift up from new tests added in this plan)

**Step 2: Backend integration tests**

Run: `cd backend && npm run test:integration`
Expected: ~278 tests pass

**Step 3: ALNScanner unit tests**

Run: `cd ALNScanner && npm test`
Expected: ~1116 tests pass

**Step 4: If all pass, create a final summary commit (optional)**

If any uncommitted changes remain from adjusting tests:

```bash
git add -A
git commit -m "test: update test baselines after service layer review fixes"
```

---

## Cross-Cutting Notes for the Implementer

1. **Uncommitted changes exist** — `audioRoutingService.js`, `mprisPlayerBase.js`, `spotifyService.js` and their tests have uncommitted changes (HDMI activation, sender filtering, passive init). These are **in scope** and should be committed first or alongside the plan fixes. Do not discard them.

2. **ALNScanner is a git submodule** — Changes to files in `ALNScanner/` must be committed inside the submodule first, then the updated ref staged in the parent repo.

3. **`jest.clearAllMocks()`** — Many test files use this in `beforeEach`. New mocks added in these tasks should survive this if they use the class-based mock pattern documented in MEMORY.md.

4. **Order matters** — Phase 1 and Phase 2 are independent and can be done in any order. Phase 3 (dead code) should come after Phase 1-2 so you're not touching files being actively fixed. Phase 5 (GM Scanner) should come after Phase 2 since some shape mismatches relate to understanding backend `getState()` output. Phase 4 (config tool) is fully independent.

5. **`processMonitor.js`** — Referenced by multiple services but no changes needed. Just be aware that `spotifyService`, `audioRoutingService`, and `bluetoothService` all use it.

6. **The volume control gap** — This plan does NOT include adding per-stream volume sliders to the GM Scanner (the main UI gap identified). That requires UI design decisions and is scoped as a separate feature, not a bug fix. The backend command `audio:volume:set` is fully implemented and ready.
