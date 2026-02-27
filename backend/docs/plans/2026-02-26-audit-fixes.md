# Code Audit Fix Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 3 bugs, 3 inconsistencies, 2 DRY violations, 2 comment cleanups, and 3 test coverage gaps found by code-simplifier audit.

**Architecture:** All changes are within the backend orchestrator. Bug fixes target audioRoutingService ducking engine and combine-sink lifecycle. Consistency fixes normalize commandExecutor's error handling to the throw/break pattern. DRY extractions reduce copy-paste in ducking `.catch()` blocks and lazy `require()` calls.

**Tech Stack:** Node.js, Jest, EventEmitter pattern, PipeWire/pactl CLI

---

### Task 1: Fix `return` → `continue` in `_handleDuckingStop`

**Bug:** `return` on line 822 of `audioRoutingService.js` exits the entire function when one target stream has no active ducking — all remaining target streams are skipped. Should be `continue`.

**Files:**
- Modify: `src/services/audioRoutingService.js:822`
- Test: `tests/unit/services/audioRoutingService.test.js`

**Step 1: Write the failing test**

In `tests/unit/services/audioRoutingService.test.js`, inside the `describe('handleDuckingEvent() - completed lifecycle', ...)` block (around line 1715), add this test:

```javascript
it('should process all target streams even when first has no active ducking', () => {
  // Rules: video ducks BOTH spotify AND sound
  audioRoutingService.loadDuckingRules([
    { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
    { when: 'video', duck: 'sound', to: 30, fadeMs: 200 },
  ]);

  // Only start ducking for 'sound', NOT for 'spotify'
  // Manually set up state so spotify has no active sources but sound does
  audioRoutingService._activeDuckingSources = { sound: ['video'] };
  audioRoutingService._preDuckVolumes = { sound: 80 };

  // Complete video — should restore 'sound' even though 'spotify' has no active sources
  audioRoutingService.handleDuckingEvent('video', 'completed');

  // 'sound' should be restored to pre-duck volume
  expect(setVolume).toHaveBeenCalledWith('sound', 80);
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "should process all target streams" --no-coverage
```

Expected: FAIL — `setVolume` never called because `return` exits before reaching the 'sound' target.

**Step 3: Fix the bug**

In `src/services/audioRoutingService.js`, change line 822:

```javascript
// BEFORE (line 822)
        return; // No active ducking for this target

// AFTER
        continue; // No active ducking for this target — check next
```

**Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "should process all target streams" --no-coverage
```

Expected: PASS

**Step 5: Run full audioRoutingService tests**

```bash
cd backend && npx jest tests/unit/services/audioRoutingService.test.js --no-coverage
```

Expected: All ~126 tests pass.

**Step 6: Commit**

```bash
git add src/services/audioRoutingService.js tests/unit/services/audioRoutingService.test.js
git commit -m "fix: return→continue in _handleDuckingStop skipped remaining target streams"
```

---

### Task 2: Fix `_onCombineLoopbackExit` orphaned null sink module

**Bug:** When a pw-loopback process exits unexpectedly, `_killCombineSinkProcs()` is called but the null sink PipeWire module (`_combineSinkModuleId`) is never unloaded. Compare with `destroyCombineSink()` (line 535) which does unload it. This leaves an orphaned PipeWire module.

**Files:**
- Modify: `src/services/audioRoutingService.js:638-647`
- Test: `tests/unit/services/audioRoutingService.test.js:1531-1558`

**Step 1: Update the existing test to verify null sink unload**

In `tests/unit/services/audioRoutingService.test.js`, find the test `'should auto-destroy combine-sink if a pw-loopback process exits unexpectedly'` (around line 1531). Add assertions at the end:

```javascript
// After the existing assertions (line 1556-1557), add:

// Null sink module should be unloaded
expect(execFile).toHaveBeenCalledWith(
  'pactl',
  ['unload-module', '42'],
  expect.any(Object),
  expect.any(Function)
);
expect(audioRoutingService._combineSinkModuleId).toBeNull();
```

**Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "should auto-destroy combine-sink" --no-coverage
```

Expected: FAIL — `pactl unload-module` never called, `_combineSinkModuleId` still `'42'`.

**Step 3: Fix the bug**

In `src/services/audioRoutingService.js`, replace `_onCombineLoopbackExit` (lines 638-647):

```javascript
  async _onCombineLoopbackExit(exitedPid) {
    if (!this._combineSinkActive) return;

    logger.warn('pw-loopback exited unexpectedly, tearing down combine-sink', {
      exitedPid,
    });

    // Kill any remaining processes (the one that didn't exit)
    this._killCombineSinkProcs();

    // Unload the null sink module (matches destroyCombineSink behavior)
    if (this._combineSinkModuleId) {
      try {
        await this._execFile('pactl', ['unload-module', this._combineSinkModuleId]);
        logger.info('Unloaded null sink after loopback exit', { moduleId: this._combineSinkModuleId });
      } catch (err) {
        logger.warn('Failed to unload null sink after loopback exit', {
          error: err.message, moduleId: this._combineSinkModuleId,
        });
      }
      this._combineSinkModuleId = null;
    }
  }
```

Note: the method signature changes from sync to `async` because `_execFile` returns a promise.

**Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "should auto-destroy combine-sink" --no-coverage
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/audioRoutingService.js tests/unit/services/audioRoutingService.test.js
git commit -m "fix: _onCombineLoopbackExit now unloads null sink module (matches destroyCombineSink)"
```

---

### Task 3: Fix `reset()` not clearing `_combineSinkModuleId`

**Bug:** `reset()` clears `_combineSinkActive`, `_combineSinkPids`, `_combineSinkProcs` but not `_combineSinkModuleId`. Stale module ID persists across test resets.

**Files:**
- Modify: `src/services/audioRoutingService.js:156-171`
- Test: `tests/unit/services/audioRoutingService.test.js:1517-1527`

**Step 1: Update the existing reset test**

In `tests/unit/services/audioRoutingService.test.js`, find `'should reset combine-sink state on reset()'` (around line 1517). Add setup and assertion:

```javascript
it('should reset combine-sink state on reset()', () => {
  audioRoutingService._combineSinkActive = true;
  audioRoutingService._combineSinkPids = [1001, 1002];
  audioRoutingService._combineSinkProcs = [createMockSpawnProc(), createMockSpawnProc()];
  audioRoutingService._combineSinkModuleId = '42';  // ADD THIS LINE

  audioRoutingService.reset();

  expect(audioRoutingService._combineSinkActive).toBe(false);
  expect(audioRoutingService._combineSinkPids).toEqual([]);
  expect(audioRoutingService._combineSinkProcs).toEqual([]);
  expect(audioRoutingService._combineSinkModuleId).toBeNull();  // ADD THIS LINE
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "should reset combine-sink state on reset" --no-coverage
```

Expected: FAIL — `_combineSinkModuleId` is still `'42'`.

**Step 3: Fix the bug**

In `src/services/audioRoutingService.js`, in `reset()` (around line 164), add after `this._combineSinkProcs = [];`:

```javascript
    this._combineSinkProcs = [];
    this._combineSinkModuleId = null;  // ADD THIS LINE
```

**Step 4: Run test to verify it passes**

```bash
cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "should reset combine-sink state on reset" --no-coverage
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/audioRoutingService.js tests/unit/services/audioRoutingService.test.js
git commit -m "fix: reset() now clears _combineSinkModuleId"
```

---

### Task 4: DRY ducking `.catch()` blocks

**DRY violation:** Three nearly identical `.catch(err => { if (err.message.includes('No active sink-input')) ... })` blocks in `_handleDuckingStart` (line 780), `_handleDuckingStop` restore (line 834), and `_handleDuckingStop` re-evaluate (line 863).

**Files:**
- Modify: `src/services/audioRoutingService.js`

**Step 1: Extract `_setVolumeForDucking` helper**

Add this method to `AudioRoutingService`, near the other ducking private helpers (after `_calculateEffectiveVolume`, around line 920):

```javascript
  /**
   * Set stream volume with graceful handling for missing sink-inputs.
   * Shared by ducking start, restore, and re-evaluate paths.
   * @param {string} target - Target stream name
   * @param {number} volume - Volume to set
   * @param {string} context - Context label for logging (e.g., 'apply', 'restore', 're-evaluate')
   * @private
   */
  _setVolumeForDucking(target, volume, context) {
    this.setStreamVolume(target, volume).catch(err => {
      if (err.message.includes('No active sink-input')) {
        logger.warn(`Ducking ${context} skipped: sink-input not available`, { target, volume });
      } else {
        logger.error(`Failed to ${context} ducked volume`, { target, volume, error: err.message });
      }
    });
  }
```

**Step 2: Replace three `.catch()` blocks**

In `_handleDuckingStart` (line 780-790), replace:
```javascript
      // BEFORE
      this.setStreamVolume(target, effectiveVolume).catch(err => {
        if (err.message.includes('No active sink-input')) {
          logger.warn('Ducking skipped: sink-input not available for ducking', {
            target, volume: effectiveVolume,
          });
        } else {
          logger.error('Failed to set ducked volume', {
            target, volume: effectiveVolume, error: err.message,
          });
        }
      });

      // AFTER
      this._setVolumeForDucking(target, effectiveVolume, 'apply');
```

In `_handleDuckingStop` restore path (line 834-844), replace:
```javascript
      // BEFORE
        this.setStreamVolume(target, restoreVolume).catch(err => {
          if (err.message.includes('No active sink-input')) {
            logger.warn('Ducking restore skipped: sink-input not available', {
              target, volume: restoreVolume,
            });
          } else {
            logger.error('Failed to restore volume after ducking', {
              target, volume: restoreVolume, error: err.message,
            });
          }
        });

      // AFTER
        this._setVolumeForDucking(target, restoreVolume, 'restore');
```

In `_handleDuckingStop` re-evaluate path (line 863-873), replace:
```javascript
      // BEFORE
        this.setStreamVolume(target, effectiveVolume).catch(err => {
          if (err.message.includes('No active sink-input')) {
            logger.warn('Ducking re-evaluate skipped: sink-input not available', {
              target, volume: effectiveVolume,
            });
          } else {
            logger.error('Failed to re-evaluate ducked volume', {
              target, volume: effectiveVolume, error: err.message,
            });
          }
        });

      // AFTER
        this._setVolumeForDucking(target, effectiveVolume, 're-evaluate');
```

**Step 3: Run all ducking tests**

```bash
cd backend && npx jest tests/unit/services/audioRoutingService.test.js -t "ducking" --no-coverage
```

Expected: All ducking tests pass (pure refactoring — no behavior change).

**Step 4: Commit**

```bash
git add src/services/audioRoutingService.js
git commit -m "refactor: extract _setVolumeForDucking to DRY three identical catch blocks"
```

---

### Task 5: commandExecutor — convert direct returns to throw/break pattern

**Inconsistency:** Cases `cue:stop`, `cue:pause`, `cue:resume`, `cue:conflict:resolve`, `sound:play` (null entry), and `audio:volume:set` use direct `return` which bypasses the outer `catch` block (no error logging) and the standard response shape (missing `data` field).

**DRY:** Six repeated `require('./cueEngineService')` lazy imports.

**Files:**
- Modify: `src/services/commandExecutor.js:410-555`
- Modify: `tests/unit/services/commandExecutor.test.js`

**Step 1: Hoist lazy cueEngineService getter**

At the top of the `executeCommand` function (after `let resultData = null;`, around line 52), add:

```javascript
    // Lazy getter for circular dependency (cueEngineService imports commandExecutor)
    let _cueEngine;
    const getCueEngine = () => {
      if (!_cueEngine) _cueEngine = require('./cueEngineService');
      return _cueEngine;
    };
```

**Step 2: Convert `sound:play` null entry from return to throw**

In `src/services/commandExecutor.js`, around line 412:

```javascript
      // BEFORE
      case 'sound:play': {
        const entry = soundService.play(payload);
        if (!entry) {
          return { success: false, message: `Failed to play ${payload.file}`, source };
        }

      // AFTER
      case 'sound:play': {
        const entry = soundService.play(payload);
        if (!entry) throw new Error(`Failed to play ${payload.file}`);
```

**Step 3: Convert cue lifecycle cases from return to throw/break**

Replace the four cue lifecycle cases (lines 459-490). Use `getCueEngine()` instead of `require()`:

```javascript
      case 'cue:stop': {
        const cueEngineService = getCueEngine();
        const { cueId } = payload;
        if (!cueId) throw new Error('cueId required');
        await cueEngineService.stopCue(cueId);
        resultMessage = `Cue stopped: ${cueId}`;
        logger.info('Cue stopped', { source, deviceId, cueId });
        break;
      }

      case 'cue:pause': {
        const cueEngineService = getCueEngine();
        const { cueId } = payload;
        if (!cueId) throw new Error('cueId required');
        await cueEngineService.pauseCue(cueId);
        resultMessage = `Cue paused: ${cueId}`;
        logger.info('Cue paused', { source, deviceId, cueId });
        break;
      }

      case 'cue:resume': {
        const cueEngineService = getCueEngine();
        const { cueId } = payload;
        if (!cueId) throw new Error('cueId required');
        await cueEngineService.resumeCue(cueId);
        resultMessage = `Cue resumed: ${cueId}`;
        logger.info('Cue resumed', { source, deviceId, cueId });
        break;
      }

      case 'cue:conflict:resolve': {
        const cueEngineService = getCueEngine();
        const { cueId, decision } = payload;
        if (!cueId) throw new Error('cueId required');
        if (!decision) throw new Error('decision required');
        await cueEngineService.resolveConflict(cueId, decision);
        resultMessage = `Conflict resolved (${decision}): ${cueId}`;
        logger.info('Cue conflict resolved', { source, deviceId, cueId, decision });
        break;
      }
```

**Step 4: Convert `audio:volume:set` from return to throw/break**

```javascript
      // BEFORE
      case 'audio:volume:set': {
        const { stream, volume } = payload;
        if (!stream || volume === undefined) {
          return { success: false, message: 'stream and volume required', source };
        }
        await audioRoutingService.setStreamVolume(stream, volume);
        return { success: true, message: `Volume set: ${stream}=${volume}`, source };
      }

      // AFTER
      case 'audio:volume:set': {
        const { stream, volume } = payload;
        if (!stream || volume === undefined) throw new Error('stream and volume required');
        await audioRoutingService.setStreamVolume(stream, volume);
        resultMessage = `Volume set: ${stream}=${volume}`;
        logger.info('Audio volume set', { source, deviceId, stream, volume });
        break;
      }
```

**Step 5: Replace remaining lazy requires with `getCueEngine()`**

In `cue:fire` (line 432), `cue:enable` (line 441), `cue:disable` (line 449) — replace:
```javascript
const cueEngineService = require('./cueEngineService');
```
with:
```javascript
const cueEngineService = getCueEngine();
```

**Step 6: Run commandExecutor tests**

```bash
cd backend && npx jest tests/unit/services/commandExecutor.test.js --no-coverage
```

Expected: All tests pass. The tests already check `result.success` and `result.message` — the throw/break pattern still produces the same response shape via the outer catch block (for failures) and the post-switch return (for success).

Note: The `audio:volume:set` rejection tests check `result.message` containing `'stream and volume required'` — this still works because the outer catch produces `{ success: false, message: error.message, source }`.

**Step 7: Commit**

```bash
git add src/services/commandExecutor.js
git commit -m "refactor: normalize commandExecutor to throw/break pattern, DRY lazy require"
```

---

### Task 6: spotifyService — DRY `checkConnection` args + debug logging

**Files:**
- Modify: `src/services/spotifyService.js:305-331, 253, 266, 325`

**Step 1: Use `_buildDbusArgs` in `checkConnection`**

In `src/services/spotifyService.js`, replace the inline D-Bus args construction in `checkConnection` (lines 313-318):

```javascript
      // BEFORE
      const { stdout } = await execFileAsync('dbus-send', [
        '--session', '--type=method_call', '--print-reply',
        '--dest=' + dest, DBUS_PATH,
        'org.freedesktop.DBus.Properties.Get',
        `string:${PLAYER_IFACE}`, 'string:PlaybackStatus'
      ], { timeout: 2000 });

      // AFTER
      const cmdArgs = this._buildDbusArgs(dest, 'org.freedesktop.DBus.Properties.Get', [
        `string:${PLAYER_IFACE}`, 'string:PlaybackStatus'
      ]);
      const { stdout } = await execFileAsync('dbus-send', cmdArgs, { timeout: 2000 });
```

**Step 2: Add debug logging to silent `.catch(() => {})` calls**

Replace three `.catch(() => {})` instances:

In `_transport` (line 253):
```javascript
      // BEFORE
      setTimeout(() => this._refreshMetadata().catch(() => {}), 200);
      // AFTER
      setTimeout(() => this._refreshMetadata().catch(e =>
        logger.debug('[Spotify] Deferred metadata refresh failed:', e.message)
      ), 200);
```

In `setPlaylist` (line 266):
```javascript
      // BEFORE
    setTimeout(() => this._refreshMetadata().catch(() => {}), 200);
      // AFTER
    setTimeout(() => this._refreshMetadata().catch(e =>
      logger.debug('[Spotify] Deferred metadata refresh failed:', e.message)
    ), 200);
```

In `checkConnection` (line 325):
```javascript
      // BEFORE
      this._refreshMetadata().catch(() => {});
      // AFTER
      this._refreshMetadata().catch(e =>
        logger.debug('[Spotify] Metadata refresh failed during checkConnection:', e.message)
      );
```

**Step 3: Run spotifyService tests**

```bash
cd backend && npx jest tests/unit/services/spotifyService.test.js --no-coverage
```

Expected: All tests pass (pure refactoring + debug logging).

**Step 4: Commit**

```bash
git add src/services/spotifyService.js
git commit -m "refactor: DRY checkConnection D-Bus args, add debug logging for metadata refresh"
```

---

### Task 7: broadcasts.js comment cleanup

**Files:**
- Modify: `src/websocket/broadcasts.js:11, 477`

**Step 1: Fix leftover dev comment**

Line 11:
```javascript
// BEFORE
// ADD: Module-level tracking

// AFTER
// Module-level listener tracking for cleanup
```

**Step 2: Fix stale line reference**

Line 477:
```javascript
// BEFORE
  // NOTE: video:completed queue update moved to main video:completed handler at line 341

// AFTER
  // NOTE: video:completed queue update handled in main video:completed handler above
```

**Step 3: Run broadcasts tests**

```bash
cd backend && npx jest tests/unit/websocket/broadcasts.test.js --no-coverage
```

Expected: All tests pass (comments only).

**Step 4: Commit**

```bash
git add src/websocket/broadcasts.js
git commit -m "chore: clean up stale comments in broadcasts.js"
```

---

### Task 8: Test coverage gaps

**Files:**
- Modify: `tests/unit/services/spotifyService.test.js`
- Modify: `tests/unit/websocket/broadcasts.test.js`

**Step 8a: Add `previous()` D-Bus method test**

In `tests/unit/services/spotifyService.test.js`, in the `'transport controls'` describe block (around line 280), add:

```javascript
    it('should call Player.Previous via D-Bus', async () => {
      mockExecFileSuccess('');
      await spotifyService.previous();
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Previous']),
        expect.any(Object),
        expect.any(Function)
      );
    });
```

**Step 8b: Add `stop()` and `pause()` event emission tests**

In `tests/unit/services/spotifyService.test.js`, in the `'events'` describe block (around line 521), add:

```javascript
    it('should emit playback:changed on pause', async () => {
      const handler = jest.fn();
      spotifyService.on('playback:changed', handler);
      mockExecFileSuccess('');
      await spotifyService.pause();
      expect(handler).toHaveBeenCalledWith({ state: 'paused' });
    });

    it('should emit playback:changed on stop', async () => {
      const handler = jest.fn();
      spotifyService.on('playback:changed', handler);
      mockExecFileSuccess('');
      await spotifyService.stop();
      expect(handler).toHaveBeenCalledWith({ state: 'stopped' });
    });
```

**Step 8c: Add `setVolume(-50)` clamping test**

In `tests/unit/services/spotifyService.test.js`, in the `'volume control'` describe block (find the test that checks clamping at 150), add nearby:

```javascript
    it('should clamp negative volume to 0', async () => {
      mockExecFileSuccess('');
      await spotifyService.setVolume(-50);
      expect(spotifyService.volume).toBe(0);
    });
```

**Step 8d: Add `ducking:changed` broadcast test**

In `tests/unit/websocket/broadcasts.test.js`, after the `'Spotify broadcast listeners'` describe block (around line 1079), add a new describe block:

```javascript
  describe('ducking:changed broadcast', () => {
    let mockAudioRoutingService;

    beforeEach(() => {
      mockAudioRoutingService = new EventEmitter();
      // Stub getRoutingStatus so sink:added/removed handlers don't fail
      mockAudioRoutingService.getRoutingStatus = jest.fn().mockResolvedValue({ availableSinks: [] });
      mockAudioRoutingService.handleDuckingEvent = jest.fn();

      setupBroadcastListeners(mockIo, {
        sessionService: mockSessionService,
        transactionService: mockTransactionService,
        stateService: mockStateService,
        videoQueueService: mockVideoQueueService,
        offlineQueueService: mockOfflineQueueService,
        audioRoutingService: mockAudioRoutingService,
      });
    });

    it('should broadcast audio:ducking:status on ducking:changed', () => {
      mockIo.sockets.adapter.rooms.set('gm', new Set(['socket1']));

      const duckingData = {
        stream: 'spotify',
        ducked: true,
        volume: 20,
        activeSources: ['video'],
      };
      mockAudioRoutingService.emit('ducking:changed', duckingData);

      expect(mockIo.to).toHaveBeenCalledWith('gm');
      expect(mockIo.emit).toHaveBeenCalledWith(
        'audio:ducking:status',
        expect.objectContaining({
          event: 'audio:ducking:status',
          data: expect.objectContaining({ stream: 'spotify', ducked: true }),
        })
      );
    });
  });
```

**Step 8e: Run all tests**

```bash
cd backend && npm test
```

Expected: ~1110+ tests pass (8 new tests across files).

**Step 8f: Commit**

```bash
git add tests/unit/services/spotifyService.test.js tests/unit/websocket/broadcasts.test.js
git commit -m "test: fill coverage gaps — previous(), stop/pause events, volume clamp, ducking broadcast"
```

---

## Final Verification

```bash
cd backend && npm test
```

Expected: ~1115 tests pass, 0 failures. All 66 test suites pass.

## Findings NOT Addressed (By Design)

| Finding | Reason Skipped |
|---------|----------------|
| 1a (dual `execFileAsync`) | Intentional divergence — spotifyService needs `{stdout, stderr}` return shape for Jest compatibility |
| 1b (`_parseMetadata` regex fragility) | Works for known spotifyd output format; hardening for hypothetical format changes is YAGNI |
| 1c (`JSON.stringify` comparison) | Fixed property shape `{title, artist}` makes order-dependent comparison safe |
| 1f (mixed error handling styles) | `checkConnection` returning boolean vs `_dbusCall` throwing is intentional API design |
| 3e (`handleDisplayCommand` helper) | Marginal DRY benefit for 3 commands; inlining would be equally verbose |
| 3f (display:toggle response divergence) | Functionally equivalent; unifying would add complexity for no behavioral change |
| 4d-4e (broadcasts minor style) | Arrow function vs function keyword in local scope is cosmetic |
| 5c (cache test fragility) | Current mock approach works; defensive restructuring is YAGNI |
| 5e (recovery test `_spotifydDest` assertion) | Existing recovery test validates the important behavior (retry succeeds) |
| 6a, 6b (audioRoutingService test gaps) | Covered by the new tests in Tasks 1-3 |
| 6d, 6e (cosmetic test issues) | No behavioral impact |
| 7a (track:changed test validates getState) | This IS correct behavior — noted as "Good test" in audit |
| 7d (display mode:changed minimal test) | Adequate for current scope |
