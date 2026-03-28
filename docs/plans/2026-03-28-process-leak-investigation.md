# Process Leak Fix — VLC & Chromium Orphan Prevention

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate orphaned VLC and Chromium processes that accumulate during test runs and server restarts. 314 VLC processes spawned in a single day, 44 found orphaned at cleanup time.

**Architecture:** Three independent leak sources, each requiring a different fix: (1) contract tests spawn real VLC via `initializeServices()` with no cleanup, (2) integration test cleanup calls `vlcService.reset()` which explicitly preserves VLC, (3) `ProcessMonitor.stop()` removes the PID file before the child process actually dies, breaking orphan recovery on next startup. Chromium leaks are from manual launches outside `displayDriver` ownership — operational, but `displayDriver.cleanup()` should also be more robust.

**Tech Stack:** Node.js, Jest (unit/contract/integration tests), ProcessMonitor utility, PM2

**Root cause evidence (2026-03-27 investigation):**
- `grep "VLC monitor started"` in combined.log: 314 spawns in one day, bursts of 40-56 aligned with test runs (01:00, 03:00, 04:00, 12:00, 13:00, 18:00, 23:00)
- Contract tests (`admin.test.js`, `scan.test.js`, `session.test.js`, `state.test.js`, `resource.test.js`) call `initializeServices()` → `vlcService.init()` → spawns real `cvlc`. No `afterAll` cleanup. `ENABLE_VIDEO_PLAYBACK` defaults to `true` (env var `ENABLE_VIDEO_PLAYBACK` not set in test env)
- Integration test `cleanupIntegrationTestServer()` calls `vlcService.reset()` — but `reset()` comment says "VLC ProcessMonitor intentionally NOT stopped (process preserved)"
- `ProcessMonitor.stop()` sends SIGTERM then immediately nulls `_proc` and removes PID file — doesn't wait for child to die
- `process.on('exit')` handler does `this._proc.kill()` but `_proc` is already null if `stop()` ran first
- PM2 `kill_timeout: 5000` — sends SIGKILL after 5s if graceful shutdown doesn't complete
- Chromium: `displayDriver._doLaunch()` uses `spawn('chromium-browser', ...)` with `detached: false`. On server restart or manual `pkill`, Chromium single-instance lock means new launches exit immediately if old process survives

---

## Phase 1: Stop Tests From Spawning Real VLC

### Task 1: Disable VLC in contract test environment

**Files:**
- Modify: `backend/jest.config.js` (or `backend/jest.config.base.js`)

The simplest fix: set `ENABLE_VIDEO_PLAYBACK=false` as a Jest environment variable so `initializeServices()` skips `vlcService.init()` entirely. This is correct because contract tests mock VLC interactions anyway — they test HTTP/WebSocket contracts, not video playback.

**Step 1: Check what env vars contract tests need**

Verify no contract test actually depends on VLC being initialized:

```bash
grep -rn "vlcService\|videoQueueService\|video:play\|video:queue" backend/tests/contract/ --include="*.js" | grep -v "mock\|Mock\|jest.fn" | head -10
```

**Step 2: Add test env var to jest config**

In `backend/jest.config.base.js`, add a `testEnvironmentOptions` or use `globals` to set the env var. The cleanest approach is to set it in the `jest.setup.js` or directly in the base config:

Add to `backend/jest.config.base.js`:

```javascript
// Prevent tests from spawning real VLC/Chromium processes
process.env.ENABLE_VIDEO_PLAYBACK = process.env.ENABLE_VIDEO_PLAYBACK || 'false';
```

Wait — this runs at config parse time, which is before `setupFilesAfterEnv`. But `config/index.js` reads the env var at require time (module-level). Since Jest caches modules, the config module will be loaded AFTER this env var is set. Verify by checking require order.

Actually, the safest approach: put it in `jest.setup.js` since that runs before each test file but after config is parsed. BUT — `config/index.js` might already be cached from a previous test file in the same worker. Since `resetModules: false` in the config, the config singleton is shared.

The truly safe approach: set it in the `jest.config.base.js` file itself at the top level (before `module.exports`):

```javascript
// Prevent contract/unit tests from spawning real VLC processes
// Integration tests that need VLC should explicitly set this to 'true'
if (!process.env.ENABLE_VIDEO_PLAYBACK) {
  process.env.ENABLE_VIDEO_PLAYBACK = 'false';
}
```

**Step 3: Verify contract tests still pass**

```bash
cd backend && npm test
```

Expected: All pass. VLC-dependent contract tests should still work because they mock VLC at the service level.

**Step 4: Check if any contract test actually NEEDS real VLC**

If any test fails, it's because it depends on `vlcService.init()` having run. Those tests should mock vlcService instead of relying on real initialization.

**Step 5: Verify no VLC processes spawned during test**

```bash
# Before
pgrep -c vlc || echo 0
# Run tests
npm test
# After
pgrep -c vlc || echo 0
```

Should be the same count before and after.

**Step 6: Commit**

```bash
git add backend/jest.config.base.js
git commit -m "fix: disable VLC spawning during unit/contract tests

ENABLE_VIDEO_PLAYBACK defaults to true, causing every contract test
that calls initializeServices() to spawn a real cvlc process.
314 VLC processes accumulated in one day from test runs alone."
```

### Task 2: Fix integration test cleanup to stop VLC

**Files:**
- Modify: `backend/tests/helpers/integration-test-server.js`

Integration tests use `cleanupIntegrationTestServer()` which calls `vlcService.reset()`. But `reset()` explicitly preserves the VLC ProcessMonitor (by design — system reset during a game shouldn't kill VLC). Test cleanup needs to call `cleanup()` instead, which stops the ProcessMonitor.

**Step 1: Read the current cleanup function**

Read `backend/tests/helpers/integration-test-server.js` lines 205-273 to understand the full teardown sequence.

**Step 2: Change vlcService.reset() to vlcService.cleanup()**

At line 264, change:

```javascript
  vlcService.reset();
```

to:

```javascript
  vlcService.cleanup();
```

**Step 3: Also cleanup spotifyService D-Bus monitor**

Check if `spotifyService.reset()` has the same problem — does it preserve the D-Bus monitor ProcessMonitor?

```bash
grep -A5 "reset()" backend/src/services/spotifyService.js | head -8
```

If spotifyService.reset() also preserves its monitor, change it to `cleanup()` too. Same for bluetoothService and audioRoutingService — check each one.

**Step 4: Verify integration tests still pass**

```bash
cd backend && npm run test:integration
```

**Step 5: Verify no orphaned processes after test run**

```bash
pgrep -a vlc; pgrep -a "dbus-monitor"; pgrep -a "pactl subscribe"
```

Should find zero processes (or only pre-existing ones).

**Step 6: Commit**

```bash
git add backend/tests/helpers/integration-test-server.js
git commit -m "fix: integration test cleanup stops VLC and monitor processes

cleanupIntegrationTestServer() called reset() which preserves
ProcessMonitor instances (by design for production system reset).
Tests must call cleanup() to actually stop child processes."
```

---

## Phase 2: Make ProcessMonitor Stop Reliable

### Task 3: ProcessMonitor.stop() must wait for child to die

**Files:**
- Modify: `backend/src/utils/processMonitor.js`
- Modify: `backend/tests/unit/utils/processMonitor.test.js`

Current `stop()` sends SIGTERM, immediately nulls `_proc`, and removes PID file. If the child doesn't die before Node exits, it's orphaned with no PID file for recovery.

**Step 1: Write failing test**

```javascript
it('should not remove PID file until child process exits', async () => {
  monitor.start();

  // Don't trigger the close event yet (simulates child still dying)
  const stopPromise = monitor.stop();

  // PID file should still exist while child is dying
  expect(fs.unlinkSync).not.toHaveBeenCalled();

  // Now simulate child exit
  const closeHandler = mockProc.on.mock.calls.find(c => c[0] === 'close')[1];
  closeHandler(0, null);

  await stopPromise;

  // NOW PID file should be removed
  expect(fs.unlinkSync).toHaveBeenCalled();
});
```

**Step 2: Make stop() wait for child exit**

Replace `stop()` with:

```javascript
stop() {
  this._stopped = true;

  if (this._restartTimer) {
    clearTimeout(this._restartTimer);
    this._restartTimer = null;
  }

  if (this._processExitHandler) {
    process.removeListener('exit', this._processExitHandler);
    this._processExitHandler = null;
  }

  if (!this._proc) {
    this._removePidFile();
    this._failures = 0;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const proc = this._proc;

    // Listen for actual exit before cleaning up
    proc.once('close', () => {
      this._proc = null;
      this._removePidFile();
      this._failures = 0;
      resolve();
    });

    // Send SIGTERM
    try {
      proc.kill('SIGTERM');
    } catch {
      // Process may have already exited
      this._proc = null;
      this._removePidFile();
      this._failures = 0;
      resolve();
    }

    // Safety timeout: if child doesn't die within 3s, SIGKILL and clean up
    setTimeout(() => {
      if (this._proc === proc) {
        try { proc.kill('SIGKILL'); } catch { /* already dead */ }
        this._proc = null;
        this._removePidFile();
        this._failures = 0;
        resolve();
      }
    }, 3000);
  });
}
```

Key changes:
- Returns a Promise (callers can await)
- Doesn't remove PID file until child actually exits
- 3s safety timeout with SIGKILL escalation
- Doesn't null `_proc` until child confirms exit

**Step 3: Update callers to await stop()**

Check all callers of `ProcessMonitor.stop()`:

```bash
grep -rn "\.stop()" backend/src/ --include="*.js" | grep -v "test\|node_modules" | head -15
```

Callers in cleanup methods (vlcService.cleanup, bluetoothService.cleanup, audioRoutingService.cleanup, mprisPlayerBase.stopPlaybackMonitor) — these are called from `server.js shutdown()` which is already async. But `vlcService.cleanup()` is sync:

```javascript
cleanup() {
  if (this._vlcProcessMonitor) {
    this._vlcProcessMonitor.stop();  // Now returns Promise
    ...
  }
}
```

This needs to become async, and `server.js` needs to await it:

```javascript
async cleanup() {
  if (this._vlcProcessMonitor) {
    await this._vlcProcessMonitor.stop();
    this._vlcProcessMonitor.removeAllListeners();
    this._vlcProcessMonitor = null;
  }
  super.cleanup();
}
```

And in `server.js` shutdown:

```javascript
await vlcService.cleanup();  // was: vlcService.cleanup()
```

Check all other cleanup callers similarly.

**Step 4: Update process.on('exit') handler**

The `process.on('exit')` handler can't do async work. Keep it as a last-resort sync kill, but make it more aggressive:

```javascript
this._processExitHandler = () => {
  if (this._proc) {
    try { this._proc.kill('SIGKILL'); } catch { /* already dead */ }
  }
};
```

Use SIGKILL instead of SIGTERM in the exit handler — there's no time to wait for graceful shutdown when the parent process is exiting.

**Step 5: Run ProcessMonitor tests**

```bash
cd backend && npx jest tests/unit/utils/processMonitor.test.js --verbose
```

**Step 6: Run full test suite**

```bash
cd backend && npm test
```

**Step 7: Commit**

```bash
git add backend/src/utils/processMonitor.js backend/tests/unit/utils/processMonitor.test.js
git commit -m "fix: ProcessMonitor.stop() waits for child exit before removing PID file

Previously sent SIGTERM and immediately removed PID file. If Node
exited before the child died, the orphan had no PID file for
recovery on next startup. Now waits for actual exit (3s timeout
with SIGKILL escalation)."
```

---

## Phase 3: Fix Shutdown Process Cleanup Chain

### Task 4: Make server shutdown await all process cleanup

**Files:**
- Modify: `backend/src/server.js` (shutdown function)
- Modify: `backend/src/services/vlcMprisService.js` (cleanup → async)
- Modify: `backend/src/services/mprisPlayerBase.js` (stopPlaybackMonitor → async, cleanup → async)
- Modify: `backend/src/services/bluetoothService.js` (cleanup → async)
- Modify: `backend/src/services/audioRoutingService.js` (cleanup → async)

After Task 3 makes `ProcessMonitor.stop()` return a Promise, all callers in the cleanup chain must await it.

**Step 1: Identify every cleanup method that calls ProcessMonitor.stop()**

```bash
grep -rn "\.stop()\|\.cleanup()" backend/src/services/ --include="*.js" | grep -v test | grep -v "node_modules" | grep -v "_stopped\|_restartTimer"
```

**Step 2: Make each cleanup method async and await stop()**

For each service that has a ProcessMonitor:
- `vlcMprisService.cleanup()` → `async cleanup()`, await `_vlcProcessMonitor.stop()`
- `mprisPlayerBase.stopPlaybackMonitor()` → `async stopPlaybackMonitor()`, await `_playbackMonitor.stop()`
- `mprisPlayerBase.cleanup()` → `async cleanup()`, await `stopPlaybackMonitor()`
- `bluetoothService.stopDeviceMonitor()` → already stops monitor, make async
- `bluetoothService.cleanup()` → `async cleanup()`, await `stopDeviceMonitor()`
- `audioRoutingService.cleanup()` → `async cleanup()`, await `_sinkMonitor.stop()`

**Step 3: Update server.js shutdown to await all cleanups**

```javascript
// Current (sync calls mixed with async):
vlcService.cleanup();
bluetoothService.cleanup();
audioRoutingService.cleanup();

// Fixed:
await vlcService.cleanup();
await bluetoothService.cleanup();
await audioRoutingService.cleanup();
```

**Step 4: Update systemReset.js if needed**

Check if `performSystemReset()` calls any cleanup methods that are now async.

**Step 5: Run all tests**

```bash
cd backend && npm test && npm run test:integration
```

**Step 6: Manual verification**

```bash
# Start server
pm2 start ecosystem.config.js
sleep 5
# Check process count
pgrep -c vlc; pgrep -c "dbus-monitor"; pgrep -c "pactl subscribe"
# Restart server
pm2 restart aln-orchestrator
sleep 8
# Check: should be same count (no orphans)
pgrep -c vlc; pgrep -c "dbus-monitor"; pgrep -c "pactl subscribe"
```

**Step 7: Commit**

```bash
git add backend/src/
git commit -m "fix: server shutdown awaits all child process cleanup

Cleanup methods now async — server.js shutdown() awaits each one.
Prevents Node from exiting while VLC/dbus-monitor/pactl children
are still dying."
```

---

## Phase 4: Chromium Cleanup Robustness

### Task 5: displayDriver cleanup kills all Chromium reliably

**Files:**
- Modify: `backend/src/utils/displayDriver.js`
- Modify: `backend/tests/unit/utils/displayDriver.test.js`

Current `displayDriver.cleanup()` kills the tracked `browserProcess`. But if the Node process was killed before cleanup ran (SIGKILL from PM2), the tracked reference is lost. On next startup, `_doLaunch()` spawns a new Chromium, which exits immediately due to Chromium's single-instance lock — leaving the old orphaned Chromium running and the new one dead.

**Step 1: Read current cleanup implementation**

```bash
grep -n "cleanup\|kill\|browserProcess" backend/src/utils/displayDriver.js | head -15
```

**Step 2: Add orphan Chromium cleanup on launch**

Before spawning a new Chromium in `_doLaunch()`, kill any existing Chromium kiosk processes. This is the same pattern as ProcessMonitor's `_killOrphan()` but using `pkill` since Chromium doesn't have a PID file:

```javascript
async function _doLaunch() {
  // Kill any orphaned Chromium from previous server instance
  try {
    execFileSync('pkill', ['-f', 'chromium.*kiosk'], { timeout: 3000 });
    // Wait for Chromium to fully exit (releases single-instance lock)
    await new Promise(r => setTimeout(r, 2000));
  } catch {
    // No Chromium running — clean state
  }

  // ... existing spawn code ...
}
```

**Step 3: Make cleanup() more robust**

Current cleanup sends SIGTERM via `browserProcess.kill()`. Add a fallback `pkill` in case the tracked process reference is stale:

```javascript
async function cleanup() {
  if (browserProcess) {
    try { browserProcess.kill(); } catch { /* already dead */ }
    browserProcess = null;
  }
  windowId = null;
  visible = false;

  // Fallback: kill any Chromium kiosk that escaped tracking
  try {
    execFileSync('pkill', ['-f', 'chromium.*kiosk'], { timeout: 3000 });
  } catch {
    // None running
  }
}
```

**Step 4: Update tests**

Mock `execFileSync` for the new `pkill` calls. Verify the orphan cleanup runs before spawn.

**Step 5: Run tests**

```bash
cd backend && npx jest tests/unit/utils/displayDriver.test.js --verbose
```

**Step 6: Commit**

```bash
git add backend/src/utils/displayDriver.js backend/tests/unit/utils/displayDriver.test.js
git commit -m "fix: displayDriver kills orphaned Chromium before launching new instance

On startup, pkill any existing kiosk Chromium left from previous
server instance. Prevents Chromium single-instance lock from
blocking new launches."
```

---

## Phase 5: Verification

### Task 6: End-to-end process leak verification

**Step 1: Verify test suite doesn't leak**

```bash
echo "Before: $(pgrep -c vlc 2>/dev/null || echo 0) VLC, $(pgrep -c chromium 2>/dev/null || echo 0) Chromium"
cd backend && npm test
echo "After unit+contract: $(pgrep -c vlc 2>/dev/null || echo 0) VLC, $(pgrep -c chromium 2>/dev/null || echo 0) Chromium"
npm run test:integration
echo "After integration: $(pgrep -c vlc 2>/dev/null || echo 0) VLC, $(pgrep -c chromium 2>/dev/null || echo 0) Chromium"
```

Expected: Zero VLC/Chromium processes leaked by tests.

**Step 2: Verify server restart doesn't leak**

```bash
pm2 start ecosystem.config.js
sleep 5
echo "Running: $(pgrep -c vlc) VLC, $(pgrep -c 'dbus-monitor') dbus-mon, $(pgrep -c 'pactl subscribe') pactl"
pm2 restart aln-orchestrator
sleep 8
echo "After restart: $(pgrep -c vlc) VLC, $(pgrep -c 'dbus-monitor') dbus-mon, $(pgrep -c 'pactl subscribe') pactl"
```

Expected: Same process count before and after restart (old ones killed, new ones spawned).

**Step 3: Verify PM2 SIGKILL scenario**

```bash
pm2 start ecosystem.config.js
sleep 5
echo "Before: $(pgrep -c vlc) VLC"
pm2 kill  # Sends SIGKILL
sleep 3
echo "After kill: $(pgrep -c vlc) VLC"
pm2 start ecosystem.config.js
sleep 8
echo "After re-start: $(pgrep -c vlc) VLC"
```

Expected: After `pm2 kill`, VLC orphans may exist (SIGKILL can't be caught). After re-start, orphans should be cleaned up by ProcessMonitor's `_killOrphan()` and displayDriver's `pkill` fallback. Final count should be exactly the expected number (1 VLC).

---

## Summary of Changes

| Area | Before | After |
|------|--------|-------|
| Contract tests | Spawn real VLC via `initializeServices()` | `ENABLE_VIDEO_PLAYBACK=false` in test env |
| Integration test cleanup | `vlcService.reset()` (preserves VLC) | `vlcService.cleanup()` (stops VLC) |
| ProcessMonitor.stop() | SIGTERM + immediate PID file removal | SIGTERM → wait for exit → PID file removal (3s SIGKILL escalation) |
| process.on('exit') handler | `this._proc.kill()` (SIGTERM, _proc may be null) | `proc.kill('SIGKILL')` (immediate, captured ref) |
| Service cleanup methods | Sync (fire-and-forget) | Async (await child exit) |
| Server shutdown | Sync cleanup calls | `await` all cleanup methods |
| displayDriver._doLaunch() | Spawns directly | `pkill` orphaned kiosk Chromium first |
| displayDriver.cleanup() | Kills tracked process only | Also `pkill` fallback for escaped Chromium |

**Estimated process leak reduction:** 314 VLC spawns/day → ~5 (server restarts only, properly cleaned up)
