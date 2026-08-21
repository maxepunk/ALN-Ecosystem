# Process Leak Fix — VLC & Chromium Orphan Prevention

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate orphaned VLC and Chromium processes that accumulate during test runs and server restarts. 314 VLC processes spawned in a single day, 44 found orphaned at cleanup time.

**Architecture:** Three independent leak sources, each requiring a different fix: (1) contract tests spawn real VLC via `initializeServices()` with no cleanup, (2) `ProcessMonitor.stop()` nulls `_proc` and removes exit handler before the child dies — if `process.exit()` fires in the gap, the exit handler is gone and the child survives, (3) Chromium leaks from manual launches outside `displayDriver` ownership — operational, but `displayDriver.cleanup()` should also be more robust.

**Tech Stack:** Node.js, Jest (unit/contract/integration tests), ProcessMonitor utility, PM2

**Root cause evidence (2026-03-27 investigation):**
- `grep "VLC monitor started"` in combined.log: 314 spawns in one day, bursts of 40-56 aligned with test runs (01:00, 03:00, 04:00, 12:00, 13:00, 18:00, 23:00)
- Contract tests (`admin.test.js`, `scan.test.js`, `session.test.js`, `state.test.js`, `resource.test.js`) call `initializeServices()` → `vlcService.init()` → spawns real `cvlc`. No `afterAll` cleanup. `ENABLE_VIDEO_PLAYBACK` defaults to `true` (env var not set in test env). WebSocket contract tests DO have `afterAll(cleanupIntegrationTestServer(...))` but that calls `vlcService.reset()` which preserves VLC.
- `ProcessMonitor.stop()` sends SIGTERM then immediately nulls `_proc` and removes the `process.on('exit')` handler — so if `process.exit()` fires before the child dies, the safety net handler is already gone
- `process.on('exit')` handler sends SIGTERM (default) — should send SIGKILL since there's no event loop to wait for graceful shutdown
- PM2 `kill_timeout: 5000` — sends SIGKILL after 5s if graceful shutdown doesn't complete
- Chromium: `displayDriver._doLaunch()` uses `spawn('chromium-browser', ...)` with `detached: false`. On server restart or manual `pkill`, Chromium single-instance lock means new launches exit immediately if old process survives

**Review findings (pre-implementation):**
- Integration tests do NOT call `vlcService.init()` — `setupIntegrationTestServer()` does selective initialization (persistenceService, transactionService, sessionService only). `vlcService.reset()` in cleanup is a no-op since no VLC was spawned. Original plan Task 2 was based on false premise (removed).
- Making `ProcessMonitor.stop()` async would cascade through 12+ methods: `stopPlaybackMonitor()`, `mprisPlayerBase.reset()`, `cleanup()`, all 4 service cleanup/reset methods, `systemReset.js`, `integration-test-server.js`, `service-reset.js`. Sync approach chosen instead — 3 lines changed vs 12+ async method conversions.
- `isRunning()` (line 199) checks `this._proc !== null` — must preserve null semantics in stop().
- PID file race condition: if `_removePidFile()` is moved to the close handler, old PM's close handler can delete a NEW PM's PID file when PM references are recycled (e.g., `systemReset.js` stop→null→new PM→start sequence). PID file stays in stop() to avoid this.
- `displayDriver.js` imports `{ spawn, execFile }` — `execFileSync` must be added for pkill calls.
- Exit handler upgrade from SIGTERM→SIGKILL with captured `proc` ref is the key fix: even after stop() nulls `_proc`, the closure still holds the child process reference.

---

## Phase 1: Stop Tests From Spawning Real VLC

### Task 1: Disable VLC in contract test environment

**Files:**
- Modify: `backend/jest.config.base.js`

The simplest fix: set `ENABLE_VIDEO_PLAYBACK=false` as a Jest environment variable so `initializeServices()` skips `vlcService.init()` entirely (`app.js:234` checks `config.features.videoPlayback`). Contract tests don't need real VLC — they test HTTP/WebSocket contracts.

**Step 1: Verify no contract test depends on real VLC**

```bash
grep -rn "vlcService\|videoQueueService\|video:play\|video:queue" backend/tests/contract/ --include="*.js" | grep -v "mock\|Mock\|jest.fn" | head -10
```

**Step 2: Add env var to jest.config.base.js**

At the top of `backend/jest.config.base.js`, BEFORE `module.exports`:

```javascript
// Prevent unit/contract tests from spawning real VLC processes.
// Integration tests that need VLC should explicitly set this to 'true'.
// config/index.js reads this at require time: videoPlayback = process.env.ENABLE_VIDEO_PLAYBACK !== 'false'
if (!process.env.ENABLE_VIDEO_PLAYBACK) {
  process.env.ENABLE_VIDEO_PLAYBACK = 'false';
}
```

This runs at config parse time (before any test file loads), and since `resetModules: false` in the config, the config singleton loaded after this env var is set will persist across all test files in the worker.

**Step 3: Verify contract tests still pass**

```bash
cd backend && npm test
```

Expected: All pass. VLC-dependent contract tests should still work because they mock VLC at the service level.

**Step 4: Verify no VLC processes spawned during test**

```bash
# Before
pgrep -c vlc || echo 0
# Run tests
cd backend && npm test
# After
pgrep -c vlc || echo 0
```

Should be the same count before and after.

**Step 5: Commit**

---

## Phase 2: Harden ProcessMonitor Exit Handler

### Task 2: Upgrade exit handler to SIGKILL with captured proc ref

**Files:**
- Modify: `backend/src/utils/processMonitor.js`
- Modify: `backend/tests/unit/utils/processMonitor.test.js`

**Problem:** Current `stop()` nulls `_proc` and removes the `process.on('exit')` handler. If `process.exit()` fires before the child actually dies (e.g., server shutdown sequence), the safety net handler is gone and `_proc` is null — the child survives as an orphan.

**Fix:** Three changes (~8 lines):
1. Exit handler captures `proc` ref in closure and sends SIGKILL (not SIGTERM)
2. `stop()` no longer removes exit handler (close handler does instead)
3. Close handler removes exit handler when child actually exits

This keeps `stop()` synchronous (no async cascade) and preserves `isRunning()` semantics (`_proc` still nulled in `stop()`).

**Step 1: Write failing test**

Add a test that verifies exit handler uses SIGKILL:

```javascript
it('should send SIGKILL (not SIGTERM) in process.on("exit") handler', () => {
  const onSpy = jest.spyOn(process, 'on');
  monitor.start();
  const exitHandler = onSpy.mock.calls.find(c => c[0] === 'exit')[1];
  exitHandler();
  expect(mockProc.kill).toHaveBeenCalledWith('SIGKILL');
});
```

**Step 2: Modify exit handler in start() (lines 78-80)**

Replace:
```javascript
this._processExitHandler = () => {
  if (this._proc) this._proc.kill();
};
```

With:
```javascript
const proc = this._proc;
this._processExitHandler = () => {
  try { proc.kill('SIGKILL'); } catch { /* already dead */ }
};
```

Key: captured `proc` ref survives `stop()` nulling `this._proc`. SIGKILL ensures child dies immediately during `process.exit()` (no event loop to wait for graceful shutdown).

**Step 3: Move exit handler removal from stop() to close handler**

In the close handler (line 109), add exit handler cleanup BEFORE emit:

```javascript
this._proc.on('close', (code, signal) => {
  this._proc = null;

  // Remove exit handler now that child is confirmed dead
  if (this._processExitHandler) {
    process.removeListener('exit', this._processExitHandler);
    this._processExitHandler = null;
  }

  this.emit('exited', { code, signal });

  if (this._stopped) return;
  // ... restart logic unchanged
});
```

In `stop()` (lines 148-151), DELETE the exit handler removal block:

```javascript
// REMOVE these lines from stop():
// if (this._processExitHandler) {
//   process.removeListener('exit', this._processExitHandler);
//   this._processExitHandler = null;
// }
```

**Step 4: Update existing test (line 252-257)**

The test "should clean up process.on('exit') handler" currently asserts removal happens in `stop()`. Update to verify it happens when the child exits:

```javascript
it('should clean up process.on("exit") handler when child exits after stop', () => {
  const removeSpy = jest.spyOn(process, 'removeListener');
  monitor.start();
  monitor.stop();

  // Exit handler NOT removed yet — it's the safety net
  const removeCallsAfterStop = removeSpy.mock.calls.filter(c => c[0] === 'exit').length;

  // Child exits
  mockProc.emit('close', 0, null);

  // NOW exit handler removed
  const removeCallsAfterClose = removeSpy.mock.calls.filter(c => c[0] === 'exit').length;
  expect(removeCallsAfterClose).toBeGreaterThan(removeCallsAfterStop);
});
```

**Step 5: Verify all edge cases pass**

Existing tests that should still pass unchanged:
- "should kill process and prevent restart" (line 224) — `_proc` still nulled, `isRunning()` still false
- "should clear pending restart timers" (line 238) — restart timer logic unchanged
- "should be safe to call multiple times" (line 259) — stop() idempotent
- "should be safe to call without start" (line 265) — no-op path unchanged
- "should not emit line events after stop" (line 269) — `_stopped` flag unchanged

**Step 6: Run tests**

```bash
cd backend && npx jest tests/unit/utils/processMonitor.test.js --verbose
cd backend && npm test
```

**Step 7: Commit**

---

## Phase 3: Chromium Cleanup Robustness

### Task 3: displayDriver cleanup kills all Chromium reliably

**Files:**
- Modify: `backend/src/utils/displayDriver.js`
- Modify: `backend/tests/unit/utils/displayDriver.test.js`

Current `displayDriver.cleanup()` kills the tracked `browserProcess`. But if the Node process was killed before cleanup ran (SIGKILL from PM2), the tracked reference is lost. On next startup, `_doLaunch()` spawns a new Chromium, which exits immediately due to Chromium's single-instance lock — leaving the old orphaned Chromium running and the new one dead.

**Step 1: Add execFileSync to imports**

At line 19 of `displayDriver.js`:

```javascript
// BEFORE:
const { spawn, execFile } = require('child_process');

// AFTER:
const { spawn, execFile, execFileSync } = require('child_process');
```

**Step 2: Add orphan Chromium cleanup before launch**

In `_doLaunch()`, before spawning Chromium, kill any existing kiosk Chromium:

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

**Step 3: Add pkill fallback to cleanup()**

After the tracked process kill, add a fallback pkill:

```javascript
async function cleanup() {
  if (browserProcess && !browserProcess.killed) {
    logger.info('[DisplayDriver] Killing browser process on shutdown', {
      pid: browserProcess.pid
    });
    browserProcess.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 1000));
    if (browserProcess && !browserProcess.killed) {
      browserProcess.kill('SIGKILL');
    }
  }
  browserProcess = null;
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

---

## Phase 4: Verification

### Task 4: End-to-end process leak verification

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
pm2 kill  # Sends SIGKILL after timeout
sleep 3
echo "After kill: $(pgrep -c vlc) VLC"
pm2 start ecosystem.config.js
sleep 8
echo "After re-start: $(pgrep -c vlc) VLC"
```

Expected: After `pm2 kill`, VLC orphans may exist (SIGKILL can't be caught). After re-start, orphans should be cleaned up by ProcessMonitor's `_killOrphan()` PID file recovery. Final count should be exactly 1 VLC.

---

## Summary of Changes

| Area | Before | After |
|------|--------|-------|
| Contract tests | Spawn real VLC via `initializeServices()` | `ENABLE_VIDEO_PLAYBACK=false` in jest config |
| Exit handler signal | SIGTERM (default) | SIGKILL (immediate kill) |
| Exit handler ref | `this._proc` (null after stop) | Captured `proc` closure (survives stop) |
| Exit handler lifetime | Removed in `stop()` | Removed in `close` handler (child confirmed dead) |
| displayDriver._doLaunch() | Spawns directly | `pkill` orphaned kiosk Chromium first |
| displayDriver.cleanup() | Kills tracked process only | Also `pkill` fallback for escaped Chromium |

**What was removed from original plan:**
- ~~Task 2 (integration test cleanup)~~: Based on false premise — integration tests don't call `vlcService.init()`, so `vlcService.reset()` is already a no-op
- ~~Task 3 (async ProcessMonitor.stop())~~: Would cascade through 12+ methods. Replaced with sync approach (captured proc ref + SIGKILL) that achieves the same safety with ~8 lines changed
- ~~Task 4 (async shutdown chain)~~: No longer needed — stop() stays sync

**Estimated process leak reduction:** 314 VLC spawns/day → ~5 (server restarts only, properly cleaned up via exit handler SIGKILL)
