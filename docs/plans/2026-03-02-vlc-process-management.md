# VLC Process Management Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move VLC process lifecycle from PM2 into `vlcMprisService.init()`, eliminating the PM2 death loop and removing all vestigial HTTP-era VLC infrastructure.

**Architecture:** VLC was originally controlled via HTTP API (PM2 managed process, `vlc-managed.sh` wrapper). It's now controlled via D-Bus MPRIS (`vlcMprisService` extending `MprisPlayerBase`). PM2 still launches VLC with HTTP interface flags and a wrapper script whose `pkill vlc` causes a SIGTERM cascade during rapid restarts. The fix: vlcMprisService spawns VLC directly via `child_process.spawn` with a simple restart-on-exit wrapper (~20 lines). ProcessMonitor is NOT suitable — its `receivedData` heuristic checks stdout, but VLC writes to stderr, so it would hit `maxFailures` and give up (same failure mode as PM2).

**Tech Stack:** Node.js, child_process.spawn, D-Bus MPRIS, Jest

---

## Summary of Changes

| Action | File | What |
|--------|------|------|
| Modify | `src/services/vlcMprisService.js` | Add VLC process spawn/stop, platform detection, updated init/reset/cleanup |
| Modify | `src/app.js` | Remove duplicate `initializeIdleLoop()` call (now in `init()`) |
| Modify | `src/services/systemReset.js` | Full reset + re-check + restart D-Bus monitor |
| Modify | `src/server.js` | Add `vlcService.cleanup()` to shutdown handler |
| Modify | `tests/unit/services/vlcMprisService.test.js` | Update spawn mocks, add VLC process tests |
| Modify | `ecosystem.config.js` | Remove `vlc-http` app block and all VLC functions |
| Modify | `package.json` | Remove VLC scripts and `concurrently` devDependency |
| Modify | `scripts/start-dev.js` | Remove VLC options, simplify menu |
| Modify | `scripts/check-health.sh` | Replace HTTP checks with D-Bus/process checks |
| Delete | `scripts/vlc-managed.sh` | PM2 wrapper with `pkill vlc` race condition |
| Delete | `scripts/vlc-gui.sh` | Dev script using HTTP interface |
| Delete | `scripts/vlc-headless.sh` | CI script using HTTP interface |

---

### Task 1: Add VLC Process Spawn to vlcMprisService

This is the core change. Add methods to spawn/stop the VLC process directly.

**Files:**
- Modify: `backend/src/services/vlcMprisService.js`

**Context:** vlcMprisService already imports `fs` and `path` directly. `child_process` is only in MprisPlayerBase (which imports `execFile`). The `spawn` function needs a separate import in vlcMprisService. Platform detection currently lives in `ecosystem.config.js` — move it here.

**Step 1: Add spawn import and VLC process methods**

Add `spawn` import at the top of the file (after existing imports), then add these methods to the class:

```javascript
// At top of file, after existing requires:
const { spawn } = require('child_process');

// New class properties in constructor (after existing ones):
this._vlcProc = null;
this._vlcRestartTimer = null;
this._vlcStopped = false;      // Flag to prevent restart after intentional stop
this._processExitHandler = null; // For orphan prevention
```

Add these methods to the class (before the `// -- Init --` section):

```javascript
// ── VLC Process Management ──

/**
 * Spawn the VLC process with platform-appropriate args.
 * Simple restart-on-exit wrapper — always restarts after 3s unless stopped.
 * NOT using ProcessMonitor: its receivedData heuristic checks stdout,
 * but VLC writes to stderr, causing false maxFailures give-up.
 */
_spawnVlcProcess() {
  if (this._vlcProc) return; // Already running

  // Remove stale exit handler from previous spawn (prevents listener leak on crash/restart cycles)
  if (this._processExitHandler) {
    process.removeListener('exit', this._processExitHandler);
    this._processExitHandler = null;
  }

  // Kill any orphaned VLC from a previous crash (prevents D-Bus name conflict
  // where the stale instance holds org.mpris.MediaPlayer2.vlc and our new
  // spawn gets a PID-suffixed name that _destination won't find)
  try { require('child_process').execFileSync('pkill', ['-x', 'cvlc']); } catch { /* none running */ }

  const args = this._buildVlcArgs();
  const env = { ...process.env, DISPLAY: process.env.DISPLAY || ':0' };

  logger.info('[VLC] Spawning process', { args: args.join(' ') });
  this._vlcProc = spawn('cvlc', args, {
    env,
    stdio: ['ignore', 'ignore', 'pipe'], // stderr only (for error logging)
  });

  this._vlcProc.stderr.on('data', (data) => {
    // Log VLC errors but don't treat as health signal
    const msg = data.toString().trim();
    if (msg) logger.debug('[VLC] stderr:', msg);
  });

  this._vlcProc.on('close', (code, signal) => {
    logger.warn('[VLC] Process exited', { code, signal });
    this._vlcProc = null;
    this._setConnected(false);

    if (!this._vlcStopped) {
      logger.info('[VLC] Scheduling restart in 3s');
      this._vlcRestartTimer = setTimeout(() => {
        this._vlcRestartTimer = null;
        this._spawnVlcProcess();
      }, 3000);
    }
  });

  // Orphan prevention: kill VLC if Node exits unexpectedly
  this._processExitHandler = () => {
    if (this._vlcProc) {
      this._vlcProc.kill('SIGTERM');
    }
  };
  process.on('exit', this._processExitHandler);
}

/**
 * Stop VLC process and prevent restart.
 */
_stopVlcProcess() {
  this._vlcStopped = true;

  if (this._vlcRestartTimer) {
    clearTimeout(this._vlcRestartTimer);
    this._vlcRestartTimer = null;
  }

  if (this._processExitHandler) {
    process.removeListener('exit', this._processExitHandler);
    this._processExitHandler = null;
  }

  if (this._vlcProc) {
    this._vlcProc.kill('SIGTERM');
    this._vlcProc = null;
  }
}

/**
 * Wait for VLC to become reachable on D-Bus after spawn.
 * Polls checkConnection() every 500ms for up to timeoutMs.
 * Returns true if connected, false if timed out (non-fatal — D-Bus monitor will catch later).
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<boolean>}
 */
async _waitForVlcReady(timeoutMs = 5000) {
  const interval = 500;
  const maxAttempts = Math.ceil(timeoutMs / interval);

  for (let i = 0; i < maxAttempts; i++) {
    const connected = await this.checkConnection();
    if (connected) return true;
    await new Promise(r => setTimeout(r, interval));
  }

  return false;
}

/**
 * Build cvlc command-line arguments.
 * @returns {string[]}
 */
_buildVlcArgs() {
  const baseArgs = [
    '--no-loop', '-A', 'pulse', '--fullscreen',
    '--video-on-top', '--no-video-title-show',
    '--no-video-deco', '--no-osd',
  ];
  const hwArgs = this._getHwAccelArgs();
  return hwArgs.length > 0 ? [...baseArgs, ...hwArgs] : baseArgs;
}

/**
 * Detect Raspberry Pi model and return hardware acceleration flags.
 * Pi 4: v4l2_m2m hardware decode.
 * Pi 5: --vout=gl (prevents HDMI signal loss from DRM plane conflicts with Xorg).
 * VLC_HW_ACCEL env var overrides auto-detection.
 * @returns {string[]}
 */
_getHwAccelArgs() {
  if (process.env.VLC_HW_ACCEL !== undefined) {
    return process.env.VLC_HW_ACCEL ? process.env.VLC_HW_ACCEL.split(' ') : [];
  }
  try {
    const model = fs.readFileSync('/proc/device-tree/model', 'utf8').trim();
    if (model.includes('Raspberry Pi 5')) return ['--vout=gl'];
    if (model.includes('Raspberry Pi 4')) return ['--codec=avcodec', '--avcodec-hw=v4l2_m2m'];
  } catch {
    // Not a Pi (dev machine, CI)
  }
  return [];
}
```

**Step 2: Update init() to spawn VLC first, then wait for D-Bus**

Replace the existing `init()` method:

```javascript
async init() {
  logger.info('[VLC] Initializing MPRIS service');

  // Spawn VLC process (backend owns VLC lifecycle now)
  this._vlcStopped = false;
  this._spawnVlcProcess();

  // Wait for VLC to register on D-Bus
  const ready = await this._waitForVlcReady();
  if (ready) {
    logger.info('[VLC] D-Bus connection established');
  } else {
    logger.warn('[VLC] Not ready after spawn (D-Bus monitor will detect when available)');
  }

  // Start D-Bus monitor regardless — catches state changes
  this.startPlaybackMonitor();
}
```

NOTE: The old `init()` called `initializeIdleLoop()` here, AND `app.js:233` called it again immediately after `init()`. This was a pre-existing double call. `initializeIdleLoop()` is removed from `init()` — `app.js` is the sole caller (it needs the call sequenced after `displayControlService.init()`).

**Step 2.5: Remove duplicate `initializeIdleLoop()` comment in app.js**

In `backend/src/app.js`, update the comment at line 232 to reflect that `init()` no longer calls `initializeIdleLoop()`:

Replace:
```javascript
        await vlcService.init();
        // Initialize idle loop after VLC is connected
        await vlcService.initializeIdleLoop();
```

With:
```javascript
        await vlcService.init();
        await vlcService.initializeIdleLoop();
```

(Just remove the stale comment — `init()` no longer touches idle loop, so "after VLC is connected" is misleading. The call sequence is self-documenting.)

**Step 3: Update reset() and add cleanup() override**

Replace the existing `reset()` method and add `cleanup()`:

```javascript
/**
 * Reset VLC-specific state plus base class cleanup.
 * Preserves VLC process — system reset should not kill VLC.
 */
reset() {
  super.reset(); // stops D-Bus monitor, reports health down, resets state
  this._previousDelta = null;
  this._loopEnabled = false;
  this._rawVolume = 1.0;
  // VLC process intentionally preserved (same as Spotify's spotifyd)
}

/**
 * Full cleanup — stop VLC process and remove all listeners.
 * Called on server shutdown (not on system reset).
 */
cleanup() {
  this._stopVlcProcess();
  super.cleanup(); // calls reset() + removeAllListeners()
}
```

**Step 4: Run tests to verify nothing is broken yet**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/unit/services/vlcMprisService.test.js --verbose`

Expected: Some tests may need updating (init tests will now try to spawn VLC). That's addressed in Task 4.

**Step 5: Commit**

```bash
git add backend/src/services/vlcMprisService.js backend/src/app.js
git commit -m "feat(vlc): add inline process spawn to vlcMprisService

Backend now owns VLC process lifecycle. Uses simple spawn+restart
wrapper instead of ProcessMonitor (VLC writes stderr, not stdout,
so ProcessMonitor's receivedData heuristic would false-fail).

Kills stale VLC orphans before spawn to prevent D-Bus name conflicts.
Removes duplicate initializeIdleLoop() call (app.js is sole caller).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Update systemReset.js for Proper VLC Reset Lifecycle

**Files:**
- Modify: `backend/src/services/systemReset.js`

**Context:** Currently systemReset.js only clears `vlcService._previousDelta` (lines 118-121) and re-checks connection (lines 257-262) but doesn't restart the D-Bus monitor. The old workaround avoided calling `reset()` because it stops the D-Bus monitor — but now that the VLC process persists across resets, the correct lifecycle is: `reset()` in step 4 (stops monitor, clears state, reports health down), then `checkConnection()` + `startPlaybackMonitor()` in step 6 (re-establishes health and monitor). This is how MPRIS services should be reset — clean state teardown, then re-probe.

**Step 1: Update Step 4 VLC reset**

Replace lines 118-121:

```javascript
// Clear VLC state delta cache (don't call full reset — VLC connection should persist)
if (vlcService) {
  vlcService._previousDelta = null;
}
```

With:

```javascript
// Reset VLC state (preserves VLC process — reset() doesn't touch it)
if (vlcService) {
  vlcService.reset();
}
```

**Step 2: Update Step 6 VLC re-initialization**

Replace lines 257-262:

```javascript
// VLC: force health re-check (D-Bus monitor still running, registry was cleared)
if (vlcService && typeof vlcService.checkConnection === 'function') {
  try { await vlcService.checkConnection(); } catch (err) {
    logger.debug('VLC health re-check failed after reset:', err.message);
  }
}
```

With:

```javascript
// VLC: re-check connection and restart D-Bus monitor (stopped by reset)
if (vlcService) {
  try { await vlcService.checkConnection(); } catch (err) {
    logger.debug('VLC health re-check failed after reset:', err.message);
  }
  vlcService.startPlaybackMonitor();
}
```

NOTE: No `typeof` guards needed. `vlcService` is a singleton extending `MprisPlayerBase` — `checkConnection()` and `startPlaybackMonitor()` are guaranteed by the base class. The `if (vlcService)` null check is the only guard required.

**Step 3: Run tests**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/unit/services/systemReset.test.js --verbose`

Expected: PASS (systemReset tests mock vlcService, so calling `.reset()` and `.startPlaybackMonitor()` will just call mock functions)

**Step 4: Commit**

```bash
git add backend/src/services/systemReset.js
git commit -m "fix(reset): proper VLC reset lifecycle in system reset

System reset now calls vlcService.reset() (not just _previousDelta
clear) and restarts D-Bus monitor afterward. Correct MPRIS lifecycle:
reset (stop monitor + clear state) then re-probe (checkConnection +
startPlaybackMonitor).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Add vlcService.cleanup() to Server Shutdown

**Files:**
- Modify: `backend/src/server.js`

**Context:** The `shutdown()` function (line 161) cleans up bluetooth, audio, lighting, and state services. It does NOT clean up VLC. Now that the backend owns the VLC process, `vlcService.cleanup()` must be called to kill VLC on shutdown.

**Step 1: Add vlcService cleanup to shutdown function**

In the shutdown function, after the existing cleanup calls (around line 187), add VLC cleanup:

```javascript
// After: await lightingService.cleanup();
// Add:
vlcService.cleanup();
```

Place it alongside the other service cleanups (after `audioRoutingService.cleanup()`, before `await stateService.cleanup()`).

**Step 2: Commit**

```bash
git add backend/src/server.js
git commit -m "fix(shutdown): cleanup VLC process on server exit

Backend owns VLC lifecycle now, so graceful shutdown must call
vlcService.cleanup() to kill the VLC process.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Update Unit Tests for VLC Process Spawn

**Files:**
- Modify: `backend/tests/unit/services/vlcMprisService.test.js`

**Context:** The existing test file needs updates because:
1. `spawn.mockReturnValue(createMockSpawnProc())` returns the SAME mock proc for both VLC spawn and dbus-monitor spawn. Change to `mockImplementation(() => createMockSpawnProc())` so each spawn call gets a separate proc.
2. `init()` now spawns VLC and calls `_waitForVlcReady()`, which polls `checkConnection()` every 500ms. Tests must mock `_waitForVlcReady` to avoid 5s timeouts.
3. New tests needed for: VLC process spawn, cleanup kills VLC, reset preserves VLC, platform detection, DISPLAY env, stale exit handler cleanup on restart, stale VLC kill before spawn.

**Step 1: Fix spawn mock in beforeEach**

Change line 48 from:
```javascript
spawn.mockReturnValue(createMockSpawnProc());
```
To:
```javascript
spawn.mockImplementation(() => createMockSpawnProc());
```

Also ensure `execFileSync` is extracted alongside `spawn` and `execFile` from the mocked `child_process` (it needs to exist as a mock for the stale VLC kill). In the variable declarations (around line 19), add:

```javascript
let vlcMprisService, execFile, execFileSync, spawn, registry;
```

And in beforeEach, after the `require('child_process')`:

```javascript
execFileSync = require('child_process').execFileSync;
```

**Step 2: Update existing init tests to mock _waitForVlcReady**

In the `describe('init', ...)` block, add a `beforeEach` that mocks `_waitForVlcReady` and `_spawnVlcProcess` to prevent spawn side effects:

```javascript
describe('init', () => {
  beforeEach(() => {
    // Mock VLC process spawn to prevent side effects
    vlcMprisService._spawnVlcProcess = jest.fn();
    vlcMprisService._waitForVlcReady = jest.fn().mockResolvedValue(true);
  });

  // existing tests...
```

Update the first test ('should check connection via D-Bus') — since `_waitForVlcReady` is mocked, init no longer directly calls `checkConnection`. Change the assertion:

```javascript
it('should spawn VLC process and wait for D-Bus', async () => {
  vlcMprisService._idleLoopExists = jest.fn().mockReturnValue(false);
  await vlcMprisService.init();

  expect(vlcMprisService._spawnVlcProcess).toHaveBeenCalled();
  expect(vlcMprisService._waitForVlcReady).toHaveBeenCalled();
});
```

Update the connection failure test — `_waitForVlcReady` returning false is the failure case:

```javascript
it('should handle connection failure gracefully', async () => {
  vlcMprisService._waitForVlcReady = jest.fn().mockResolvedValue(false);
  vlcMprisService._idleLoopExists = jest.fn().mockReturnValue(false);
  await vlcMprisService.init();

  // Monitor starts regardless — catches when VLC is ready
  expect(spawn).toHaveBeenCalled();
});
```

The 'should start playback monitor' test stays as-is (spawn is still called for dbus-monitor).

**Step 3: Add new test describe blocks**

Add after the existing `describe('reset', ...)` block and before the closing `});`:

```javascript
// ── VLC Process Spawn ──

describe('_spawnVlcProcess', () => {
  it('should spawn cvlc with platform args', () => {
    vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
    vlcMprisService._spawnVlcProcess();

    expect(spawn).toHaveBeenCalledWith(
      'cvlc',
      expect.arrayContaining(['--fullscreen', '--no-osd', '-A', 'pulse']),
      expect.objectContaining({
        env: expect.objectContaining({ DISPLAY: expect.any(String) }),
      })
    );
  });

  it('should not spawn if already running', () => {
    vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
    vlcMprisService._spawnVlcProcess();
    const firstCallCount = spawn.mock.calls.length;

    vlcMprisService._spawnVlcProcess(); // second call — should no-op
    expect(spawn.mock.calls.length).toBe(firstCallCount);
  });

  it('should schedule restart on process exit', () => {
    jest.useFakeTimers();
    vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
    vlcMprisService._spawnVlcProcess();

    const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
    const spawnCountBefore = spawn.mock.calls.length;

    // Simulate VLC exiting
    proc.emit('close', 1, null);

    // Should schedule restart
    expect(vlcMprisService._vlcRestartTimer).not.toBeNull();

    // After 3s, should respawn
    jest.advanceTimersByTime(3000);
    expect(spawn.mock.calls.length).toBe(spawnCountBefore + 1);

    jest.useRealTimers();
  });

  it('should remove stale process.on(exit) handler before registering new one', () => {
    jest.useFakeTimers();
    vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
    vlcMprisService._spawnVlcProcess();

    const firstHandler = vlcMprisService._processExitHandler;
    const removeListenerSpy = jest.spyOn(process, 'removeListener');

    // Simulate VLC crash + restart
    const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
    proc.emit('close', 1, null);
    jest.advanceTimersByTime(3000);

    // Should have removed the old handler before adding new one
    expect(removeListenerSpy).toHaveBeenCalledWith('exit', firstHandler);
    expect(vlcMprisService._processExitHandler).not.toBe(firstHandler);

    removeListenerSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should kill stale VLC before spawning', () => {
    const { execFileSync } = require('child_process');
    vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
    vlcMprisService._spawnVlcProcess();

    expect(execFileSync).toHaveBeenCalledWith('pkill', ['-x', 'cvlc']);
  });

  it('should NOT restart when _vlcStopped is true', () => {
    jest.useFakeTimers();
    vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
    vlcMprisService._spawnVlcProcess();

    vlcMprisService._vlcStopped = true;
    const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
    const spawnCountBefore = spawn.mock.calls.length;

    proc.emit('close', 0, 'SIGTERM');

    jest.advanceTimersByTime(5000);
    expect(spawn.mock.calls.length).toBe(spawnCountBefore); // No new spawn

    jest.useRealTimers();
  });
});

// ── _stopVlcProcess ──

describe('_stopVlcProcess', () => {
  it('should kill VLC process and set stopped flag', () => {
    vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
    vlcMprisService._spawnVlcProcess();

    const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
    vlcMprisService._stopVlcProcess();

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(vlcMprisService._vlcStopped).toBe(true);
    expect(vlcMprisService._vlcProc).toBeNull();
  });

  it('should clear pending restart timer', () => {
    jest.useFakeTimers();
    vlcMprisService._vlcRestartTimer = setTimeout(() => {}, 3000);
    vlcMprisService._stopVlcProcess();
    expect(vlcMprisService._vlcRestartTimer).toBeNull();
    jest.useRealTimers();
  });
});

// ── _waitForVlcReady ──

describe('_waitForVlcReady', () => {
  it('should resolve true when checkConnection succeeds', async () => {
    mockExecFileSuccess('variant       string "Stopped"\n');
    const result = await vlcMprisService._waitForVlcReady(1000);
    expect(result).toBe(true);
  });

  it('should resolve false after timeout when VLC never connects', async () => {
    mockExecFileError('org.freedesktop.DBus.Error.ServiceUnknown');
    const result = await vlcMprisService._waitForVlcReady(600); // short timeout
    expect(result).toBe(false);
  });
});

// ── cleanup ──

describe('cleanup', () => {
  it('should stop VLC process', () => {
    vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
    vlcMprisService._spawnVlcProcess();

    const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
    vlcMprisService.cleanup();

    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('should remove all listeners', () => {
    vlcMprisService.on('test-event', () => {});
    expect(vlcMprisService.listenerCount('test-event')).toBe(1);

    vlcMprisService.cleanup();
    expect(vlcMprisService.listenerCount('test-event')).toBe(0);
  });
});

// ── Platform Detection ──

describe('_getHwAccelArgs', () => {
  const originalEnv = process.env.VLC_HW_ACCEL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.VLC_HW_ACCEL = originalEnv;
    } else {
      delete process.env.VLC_HW_ACCEL;
    }
  });

  it('should return [] when VLC_HW_ACCEL is empty string', () => {
    process.env.VLC_HW_ACCEL = '';
    expect(vlcMprisService._getHwAccelArgs()).toEqual([]);
  });

  it('should split VLC_HW_ACCEL by spaces', () => {
    process.env.VLC_HW_ACCEL = '--vout=gl --extra';
    expect(vlcMprisService._getHwAccelArgs()).toEqual(['--vout=gl', '--extra']);
  });
});

// ── reset preserves VLC process ──

describe('reset (VLC process preservation)', () => {
  it('should NOT kill VLC process on reset', () => {
    vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
    vlcMprisService._spawnVlcProcess();

    const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
    vlcMprisService.reset();

    expect(proc.kill).not.toHaveBeenCalled();
    expect(vlcMprisService._vlcProc).not.toBeNull();
  });
});
```

**Step 4: Run all VLC tests**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/unit/services/vlcMprisService.test.js --verbose`

Expected: All tests PASS

**Step 5: Run full unit test suite to check for regressions**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/unit --maxWorkers=4`

Expected: All passing (existing count ~1431)

**Step 6: Commit**

```bash
git add backend/tests/unit/services/vlcMprisService.test.js
git commit -m "test(vlc): add process spawn tests, fix spawn mock isolation

- spawn.mockImplementation (not mockReturnValue) for separate procs
- Mock _waitForVlcReady in init tests to prevent polling timeout
- Add tests: spawn, restart-on-exit, stop, cleanup, platform detection
- Add test: reset preserves VLC process (cleanup kills it)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Remove PM2 VLC Infrastructure

**Files:**
- Delete: `backend/scripts/vlc-managed.sh`
- Delete: `backend/scripts/vlc-gui.sh`
- Delete: `backend/scripts/vlc-headless.sh`
- Modify: `backend/ecosystem.config.js`
- Modify: `backend/package.json`
- Modify: `backend/scripts/start-dev.js`
- Modify: `backend/scripts/check-health.sh`

**Step 1: Delete VLC scripts**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
rm scripts/vlc-managed.sh scripts/vlc-gui.sh scripts/vlc-headless.sh
```

**Step 2: Clean up ecosystem.config.js**

Remove the `detectPlatform()` function (lines 9-22), `getVlcPlatformArgs()` function (lines 24-47), `VLC_BASE_ARGS`/`vlcHwArgs`/`VLC_ARGS` constants (lines 49-51), and the entire `vlc-http` app block (lines 135-168). Also remove the `fs` require on line 7 (no longer needed).

The file should retain ONLY the `aln-orchestrator` app config, deploy config, and comment reference block. The result:

```javascript
/**
 * PM2 Ecosystem Configuration
 * Production deployment configuration for ALN Orchestrator
 * Optimized for Raspberry Pi (8GB RAM)
 */

module.exports = {
  apps: [
    {
      // Application configuration
      name: 'aln-orchestrator',
      script: './src/server.js',
      // ... (keep entire aln-orchestrator block unchanged)
    },
    // vlc-http block REMOVED — VLC process managed by vlcMprisService.init()
  ],

  // Deploy configuration (keep unchanged)
  deploy: { ... },
};

// PM2 Commands Reference (keep unchanged)
```

**Step 3: Clean up package.json scripts**

Remove these scripts:
- `vlc:gui` — references deleted vlc-gui.sh
- `vlc:headless` — references deleted vlc-headless.sh
- `vlc:stop` — `pkill -f 'vlc.*http'` is vestigial
- `health:vlc` — HTTP health check on port 8080
- `dev:headless` — uses concurrently with vlc-headless.sh

Update these scripts:
- `dev:full`: Change from `concurrently ... 'npm run vlc:gui' 'npm run orchestrator:dev'` to `npm run orchestrator:dev` (VLC is spawned by init now)
- `prod:stop`: Change `pm2 stop aln-orchestrator vlc-http; ...` to `pm2 stop aln-orchestrator; ...`

Remove `concurrently` from `devDependencies` (only used by VLC scripts — verified: no other runtime usage in codebase).

After modifying `package.json`, run `npm install` to update `package-lock.json`.

**Step 4: Simplify start-dev.js**

Current menu has 4 options. Remove options 1 (Full System — was VLC+orchestrator via concurrently) and 4 (Headless). Renumber remaining:

```
1) Full System (Orchestrator with video)       ← was option 2 behavior, but default now includes VLC
   Best for: Testing complete functionality
   Starts: Orchestrator with hot reload (VLC auto-spawned)

2) Orchestrator Only (no video playback)       ← was option 2
   Best for: API development, scanner integration
   Starts: Just the orchestrator, VLC disabled

3) PM2 Managed (production-like)               ← was option 3
   Best for: Testing production configuration
```

Option 1 command: `nodemon src/server.js` (VLC is spawned by vlcMprisService.init)
Option 2 command: `FEATURE_VIDEO_PLAYBACK=false nodemon src/server.js` (unchanged)
Option 3 command: `pm2 start ecosystem.config.js && pm2 logs` (unchanged)

**Step 5: Update check-health.sh**

Line 51: Change `pgrep -f "vlc.*http.*8080"` to `pgrep -x cvlc`
Lines 62: Remove `check_service "VLC HTTP Interface" "http://localhost:8080/requests/status.json" ":vlc"` entirely
Lines 99-103: Remove port 8080 check block entirely

Replace the VLC HTTP integration check (lines 71-75) with a D-Bus ping:

```bash
# Check VLC D-Bus availability
if dbus-send --session --dest=org.mpris.MediaPlayer2.vlc --print-reply /org/mpris/MediaPlayer2 org.freedesktop.DBus.Peer.Ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} VLC Integration: Connected (D-Bus MPRIS)"
else
    echo -e "${YELLOW}⚠️${NC}  VLC Integration: Not connected (degraded mode)"
fi
```

**Step 6: Run tests to verify nothing breaks**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npm test`

Expected: All pass. No tests depend on the deleted scripts or VLC HTTP interface.

**Step 7: Commit**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
git add -A scripts/vlc-managed.sh scripts/vlc-gui.sh scripts/vlc-headless.sh
git add ecosystem.config.js package.json package-lock.json scripts/start-dev.js scripts/check-health.sh
git commit -m "chore(vlc): remove PM2 vlc-http and HTTP-era scripts

Delete vlc-managed.sh (pkill race condition), vlc-gui.sh, vlc-headless.sh.
Remove vlc-http PM2 app, VLC platform detection from ecosystem.config.js
(moved to vlcMprisService). Remove VLC HTTP scripts from package.json.
Simplify start-dev.js menu. Update check-health.sh to use D-Bus.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Run Integration Tests and Verify End-to-End

**Files:** None (verification only)

**Step 1: Run integration tests**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npm run test:integration`

Expected: All 278 integration tests pass. Key suites to watch:
- `external-state-propagation.test.js` — uses vlcService mock
- `service-state-push.test.js` — verifies video service:state delivery

**Step 2: Run full unit + contract suite**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npm test`

Expected: All ~1431 tests pass

**Step 3: Verify PM2 config works (manual)**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && pm2 start ecosystem.config.js --env development && pm2 status`

Expected: Only `aln-orchestrator` appears (no `vlc-http`). Orchestrator starts normally.

Run: `pm2 stop all` to clean up.

**Step 4: Commit (if any fixes were needed)**

Only commit if test failures required code changes.

---

### Task 7: Update Documentation

**Files:**
- Modify: `backend/CLAUDE.md`

**Step 1: Update CLAUDE.md VLC references**

In the "PM2 Ecosystem" section under Deployment, change:

```
- `vlc`: VLC media player (controlled via D-Bus MPRIS)
```

To:

```
- VLC is spawned by `vlcMprisService.init()` (not PM2)
```

In "Key Commands > Development", update `dev:full` description:

```
npm run dev:full         # Orchestrator + VLC (hot reload)
```

To:

```
npm run dev:full         # Orchestrator with VLC (hot reload, VLC auto-spawned)
```

Remove `health:vlc` from utilities section.

In "Video Playback Issues > Debug", the D-Bus check is already correct. No change needed.

**Step 2: Commit**

```bash
git add backend/CLAUDE.md
git commit -m "docs: update CLAUDE.md for VLC process management migration

VLC is now spawned by vlcMprisService.init(), not PM2.
Remove references to vlc-http PM2 process and HTTP health checks.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
