# DisplayDriver Fresh Window Lookup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate stale X11 window ID bugs by looking up the scoreboard Chromium window fresh before each show/hide operation, instead of caching the ID at launch time.

**Architecture:** Remove the module-level `windowId` cache. Replace with a `_findScoreboardWindow()` function that searches by window name (`xdotool search --name`) on every show/hide call. `ensureBrowserRunning()` becomes purely a process-alive check (no window search). The scoreboard HTML title "Case File: About Last Night" is static and provides a reliable, unique selector that distinguishes the content window from Chromium's internal windows (zygote, GPU, crashpad).

**Tech Stack:** Node.js, xdotool, wmctrl, Jest

---

## Context

### The Bug

After a PM2 restart, `_doLaunch()` found window `25165825` via `xdotool search --class chromium` at 0.6s post-spawn. This was Chromium's shell/frame window (title: "chromium"). The actual kiosk content window (`20971523`, title: "Case File: About Last Night - Chromium") appeared later. All subsequent show/hide operations used the stale `25165825`:

- `hideScoreboard()` minimized the wrong window — the real scoreboard stayed fullscreen showing a "Video Playing..." overlay
- `showScoreboard()` tried `windowactivate` on the wrong window → `XGetWindowProperty` failure after 5s timeout

### The Fix

Instead of `xdotool search --class chromium` (returns ALL Chromium windows including zygote, GPU process, etc.), use `xdotool search --name "Case File"` which only matches the content window with the page title. `--name` does substring matching — only the content window carries the HTML `<title>` ("Case File: About Last Night"), so there should be exactly one match. Do this fresh each time, not cached.

### Behavioral Changes to Note

- `hideScoreboard()` previously short-circuited when `windowId` was null (nothing ever shown). Now it always searches. This is more robust — it catches orphaned Chromium windows from previous server instances — but is a deliberate behavioral change.
- `ensureBrowserRunning()` previously returned `true` meaning "process alive AND window ID known". Now it means "process alive". Window lookup is deferred to show/hide time.

### Files Involved

| File | Action |
|------|--------|
| `backend/src/utils/displayDriver.js` | Modify: refactor window lookup |
| `backend/tests/unit/utils/displayDriver.test.js` | Modify: update tests for new behavior |

### Files NOT Touched (verified safe)

| File | Why Safe |
|------|----------|
| `backend/src/services/displayControlService.js` | Calls `showScoreboard()`, `hideScoreboard()`, `ensureBrowserRunning()`, `cleanup()` — all public APIs unchanged |
| `backend/tests/unit/services/displayControlService.test.js` | Mocks entire displayDriver module — doesn't test internals |
| `backend/src/server.js` | Calls `displayDriver.cleanup()` — API unchanged |
| `backend/tests/e2e/flows/23-scoreboard-live-data.test.js` | Tests scoreboard WebSocket data, not display switching |

---

## Task 1: Refactor displayDriver.js — Replace Cached Window ID with Fresh Lookup

**Files:**
- Modify: `backend/src/utils/displayDriver.js`

### Step 1: Update header comment, remove `windowId`, replace `findWindowId()`

**Update file header comment** (lines 9-13) — replace the old xdotool notes:

Old:
```
 * - xdotool search --pid does NOT work for Chromium (window belongs to forked child)
 * - xdotool search --class chromium DOES work
 * - windowunmap/windowmap does NOT preserve fullscreen (comes back 1024x704) — NOT USED
 * - windowminimize to hide + windowactivate + wmctrl -b add,fullscreen to show — VERIFIED 0,0 1920x1080
 * - execFile (not exec) for all xdotool/wmctrl calls — no shell injection
```

New:
```
 * - xdotool search --name "Case File" finds the content window by HTML <title>
 *   (--class chromium returns ALL windows including zygote/GPU; --pid doesn't work for Chromium)
 * - Window ID looked up fresh per show/hide operation — never cached (eliminates stale-ID bugs)
 * - windowminimize to hide + windowactivate + wmctrl -b add,fullscreen to show — VERIFIED 0,0 1920x1080
 * - execFile (not exec) for all xdotool/wmctrl calls — no shell injection
```

**Remove module-level `windowId` (line 27):**

Old:
```js
let windowId = null;  // X11 window ID string (e.g. '12345678')
let visible = false;
```

New:
```js
let visible = false;
```

Replace the existing `findWindowId()` function (lines 82-101) with a new function that searches by name.

**New function (replaces `findWindowId`):**
```js
/**
 * Find the scoreboard Chromium window by its page title.
 * Searches fresh every time — no caching, no stale IDs.
 * Uses --name to match the HTML <title>, which distinguishes the content
 * window from Chromium's internal windows (zygote, GPU, crashpad).
 * @returns {Promise<string|null>} X11 window ID or null if not found
 */
async function _findScoreboardWindow() {
  try {
    const ids = await run('xdotool', ['search', '--name', 'Case File']);
    if (ids) {
      const idList = ids.split('\n').filter(Boolean);
      if (idList.length > 0) {
        return idList[0];
      }
    }
  } catch {
    // Window not found
  }
  return null;
}
```

Note: Uses `'Case File'` as a substring match — `xdotool search --name` does substring matching by default. The full title is "Case File: About Last Night - Chromium" but we only need enough to uniquely identify it.

### Step 2: Simplify `_doLaunch()`

Three changes:

**2a. Remove `windowId = null` from `on('error')` and `on('exit')` handlers (lines 155-167).**

The module-level `windowId` variable no longer exists. Remove the `windowId = null;` line from both handlers. Keep the rest (nulling `browserProcess`, setting `visible = false`, logging).

Old handlers:
```js
  browserProcess.on('error', (error) => {
    logger.error('[DisplayDriver] Browser process error', { error: error.message });
    browserProcess = null;
    windowId = null;
    visible = false;
  });

  browserProcess.on('exit', (code, signal) => {
    logger.warn('[DisplayDriver] Browser process exited', { code, signal });
    browserProcess = null;
    windowId = null;
    visible = false;
  });
```

New handlers:
```js
  browserProcess.on('error', (error) => {
    logger.error('[DisplayDriver] Browser process error', { error: error.message });
    browserProcess = null;
    visible = false;
  });

  browserProcess.on('exit', (code, signal) => {
    logger.warn('[DisplayDriver] Browser process exited', { code, signal });
    browserProcess = null;
    visible = false;
  });
```

**2b. Replace lines 178-189** (the window search and log at end of `_doLaunch`) with:

```js
  logger.info('[DisplayDriver] Chromium process started', {
    pid: browserProcess?.pid
  });
  return true;
```

No sleep needed. The whole point of fresh-per-operation lookup is that `_findScoreboardWindow()` in `showScoreboard()`/`hideScoreboard()` handles the "not ready yet" case gracefully (returns `false` / no-ops). By the time the GM sends the first display command (seconds after server start), the page is long loaded.

### Step 3: Simplify `ensureBrowserRunning()`

Remove the window ID re-search logic. Just check if the process is alive.

**Replace entire function with:**
```js
async function ensureBrowserRunning() {
  if (browserProcess && !browserProcess.killed) {
    return true;
  }

  if (launchPromise) return launchPromise;
  launchPromise = _doLaunch();
  try {
    return await launchPromise;
  } finally {
    launchPromise = null;
  }
}
```

### Step 4: Update `showScoreboard()` to use fresh lookup

**Replace entire function with:**
```js
async function showScoreboard() {
  const running = await ensureBrowserRunning();
  if (!running) return false;

  const wid = await _findScoreboardWindow();
  if (!wid) {
    logger.error('[DisplayDriver] Scoreboard window not found (title match failed)');
    return false;
  }

  try {
    await run('xdotool', ['windowactivate', '--sync', wid]);
    await run('wmctrl', ['-i', '-r', wid, '-b', 'add,fullscreen']);
    visible = true;
    logger.info('[DisplayDriver] Scoreboard shown (fullscreen)', { windowId: wid });
    return true;
  } catch (error) {
    logger.error('[DisplayDriver] Failed to show scoreboard', { error: error.message });
    visible = false;
    return false;
  }
}
```

Key changes:
- Fresh `_findScoreboardWindow()` call each time
- No stale-ID error handler needed (no cache to clear)
- `windowId` param to logger is now the fresh `wid` (for debug traceability)

### Step 5: Update `hideScoreboard()` to use fresh lookup

**Replace entire function with:**
```js
async function hideScoreboard() {
  const wid = await _findScoreboardWindow();
  if (!wid) {
    visible = false;
    return true;
  }

  try {
    await run('xdotool', ['windowminimize', wid]);
    visible = false;
    logger.info('[DisplayDriver] Scoreboard minimized', { windowId: wid });
    return true;
  } catch (error) {
    logger.error('[DisplayDriver] Failed to hide scoreboard', { error: error.message });
    visible = false;
    return true; // Non-fatal — VLC renders underneath
  }
}
```

### Step 6: Update `isScoreboardVisible()`

Current code is `return visible && windowId !== null;` — references the deleted `windowId`. With fresh lookups, the `visible` boolean alone is the correct state tracker.

**Replace with:**
```js
function isScoreboardVisible() {
  return visible;
}
```

### Step 7: Update `getStatus()`

Remove the `windowId` field (no longer cached). Replace with a note that it's looked up fresh.

**Replace with:**
```js
function getStatus() {
  return {
    scoreboardVisible: isScoreboardVisible(),
    browserPid: browserProcess?.pid || null,
    display: DISPLAY,
    scoreboardUrl: SCOREBOARD_URL
  };
}
```

### Step 8: Update `cleanup()`

Remove `windowId = null` line (variable no longer exists). Rest stays the same.

```js
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
  visible = false;

  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // Already removed or never written
  }
}
```

### Step 9: Run existing tests to verify failures

Run: `cd backend && npx jest tests/unit/utils/displayDriver.test.js --verbose 2>&1 | tail -30`

Expected: Several tests fail because they mock `xdotool search` with `--class`-style responses but the code now uses `--name`. This confirms the tests are exercising the right code paths.

### Step 10: Commit implementation

```
fix: use fresh window lookup for display switching

Replace cached X11 window ID with per-operation xdotool search by
window title. Eliminates stale-ID bugs when Chromium's content window
has a different ID than the initially-found shell window.
```

---

## Task 2: Update Unit Tests

**Files:**
- Modify: `backend/tests/unit/utils/displayDriver.test.js`

### Step 1: Update the `execFile` mock to handle `--name` search

The key change in test mocking: the `xdotool search` calls now use `['search', '--name', 'Case File']` instead of `['search', '--class', 'chromium']`. Tests need to match this new pattern.

Create a reusable mock setup helper at the top of the describe block (after `beforeEach`):

```js
/**
 * Setup execFile mock that responds to xdotool search --name with a window ID.
 * @param {string} windowId - The window ID to return from search
 * @param {object} [overrides] - Override specific commands: { windowactivate, windowminimize, wmctrl }
 */
function mockExecForWindow(windowId, overrides = {}) {
  const { execFile } = require('child_process');
  execFile.mockImplementation((cmd, args, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; }
    if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') {
      if (windowId) cb(null, windowId + '\n', '');
      else cb(new Error('no windows found'), '', '');
    } else if (overrides.windowactivate && cmd === 'xdotool' && args[0] === 'windowactivate') {
      overrides.windowactivate(cmd, args, cb);
    } else if (overrides.windowminimize && cmd === 'xdotool' && args[0] === 'windowminimize') {
      overrides.windowminimize(cmd, args, cb);
    } else {
      cb(null, '', '');
    }
  });
}
```

### Step 2: Update `showScoreboard()` tests

Update all tests in the `showScoreboard()` describe block to use `mockExecForWindow()` and update assertions.

Key behavioral changes to test:
- First call still launches Chromium (spawn) — same as before
- No longer caches window ID — each show/hide does fresh search
- Window search uses `--name 'Case File'` not `--class chromium`
- Remove `getStatus().windowId` assertion (field removed)

### Step 3: Update `hideScoreboard()` tests

- `hideScoreboard()` when no window found (title search returns nothing) → returns true (no-op, same as before)
- `hideScoreboard()` after show → finds window by name, minimizes it
- `hideScoreboard()` when minimize fails → still returns true (non-fatal, same as before)

### Step 4: Update `getStatus()` test

Remove `windowId` from expected fields. Add no new fields.

### Step 5: Update `ensureBrowserRunning()` tests

- First call still spawns and returns true
- Second call returns true without re-spawning (process still alive)
- Remove any assertions about window ID being found during ensure

### Step 6: Update orphan cleanup tests

The "skips 2-second wait when no orphaned Chromium was running" test (line 426) asserts `elapsed < 1500`. Since `_doLaunch()` no longer has ANY artificial sleep (not even the old 2s orphan-kill wait is unconditional anymore — it's only when `killedOrphan` is true, unchanged), this test should still pass. Verify it does. If timing is tight, increase the threshold to `2000` as margin.

### Step 7: Add new test: fresh lookup on every show/hide

```js
test('looks up window ID fresh on every showScoreboard call (no caching)', async () => {
  const { spawn, execFile } = require('child_process');
  const mockProc = { pid: 1234, on: jest.fn(), killed: false };
  spawn.mockReturnValue(mockProc);

  let searchCount = 0;
  execFile.mockImplementation((cmd, args, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; }
    if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') {
      searchCount++;
      cb(null, '12345678\n', '');
    } else {
      cb(null, '', '');
    }
  });

  await displayDriver.showScoreboard();
  await displayDriver.showScoreboard();
  await displayDriver.showScoreboard();

  // Each show call should search for window (no caching)
  expect(searchCount).toBe(3);
});
```

### Step 8: Add new test: hideScoreboard also does fresh lookup

```js
test('looks up window ID fresh on every hideScoreboard call', async () => {
  const { spawn, execFile } = require('child_process');
  const mockProc = { pid: 1234, on: jest.fn(), killed: false };
  spawn.mockReturnValue(mockProc);

  let searchCount = 0;
  execFile.mockImplementation((cmd, args, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; }
    if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') {
      searchCount++;
      cb(null, '12345678\n', '');
    } else {
      cb(null, '', '');
    }
  });

  await displayDriver.ensureBrowserRunning();
  searchCount = 0; // Reset after launch
  await displayDriver.hideScoreboard();
  await displayDriver.hideScoreboard();

  expect(searchCount).toBe(2);
});
```

### Step 9: Add new test: showScoreboard returns false when browser running but window not found

This covers the case where Chromium is alive but the page hasn't loaded yet (no title to match).

```js
test('returns false when browser is running but window title not found', async () => {
  const { spawn, execFile } = require('child_process');
  const mockProc = { pid: 1234, on: jest.fn(), killed: false };
  spawn.mockReturnValue(mockProc);

  execFile.mockImplementation((cmd, args, opts, cb) => {
    if (typeof opts === 'function') { cb = opts; }
    if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') {
      cb(new Error('no windows found'), '', '');
    } else {
      cb(null, '', '');
    }
  });

  // First call launches Chromium (process alive)
  await displayDriver.ensureBrowserRunning();
  // But window search by name finds nothing
  const result = await displayDriver.showScoreboard();
  expect(result).toBe(false);
});
```

### Step 10: Run tests

Run: `cd backend && npx jest tests/unit/utils/displayDriver.test.js --verbose`

Expected: All tests pass.

### Step 11: Run full backend test suite

Run: `cd backend && npm test`

Expected: All tests pass. displayControlService tests are unaffected (mock entire module).

### Step 12: Commit tests

```
test: update displayDriver tests for fresh window lookup
```

---

## Task 3: Manual Verification on Pi

**No code changes — verification only.**

### Step 1: Restart the server

```bash
pm2 restart aln-orchestrator
```

### Step 2: Wait for startup, verify Chromium launched

```bash
sleep 5 && pm2 logs aln-orchestrator --lines 10 --nostream | grep -i "chromium\|display"
```

Expected: `[DisplayDriver] Chromium process started` (no longer logs window ID at launch).

### Step 3: Test idle-loop switching from GM Scanner

From GM Scanner admin panel: tap "Idle Loop" button.

Expected:
- Scoreboard minimizes (confirmed by log: `Scoreboard minimized` with correct window ID)
- VLC idle loop video appears on screen (not "Video Playing..." overlay)

### Step 4: Test scoreboard switching

From GM Scanner admin panel: tap "Scoreboard" button.

Expected:
- VLC stops
- Scoreboard appears fullscreen
- Log shows `Scoreboard shown (fullscreen)` with window ID matching the content window

### Step 5: Rapid switching test

Tap idle-loop → scoreboard → idle-loop → scoreboard in quick succession (1-2 seconds between each).

Expected: Each transition works correctly. No stale window ID errors in logs.

### Step 6: Commit verification result (if all passes)

No code commit needed — just confirm the fix works on real hardware.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| `xdotool search --name` slower than cached lookup | ~10ms per search; display switches happen a few times per game — negligible |
| Title substring "Case File" matches unrelated window | No other app on this dedicated Pi uses "Case File" in window title. `--name` does substring match — only the content window has this in its title |
| Chromium page hasn't loaded yet (no title to match) | `_findScoreboardWindow()` returns null, `showScoreboard()` returns false. `displayControlService.init()` calls `ensureBrowserRunning()` at startup (30s budget). By the time GM sends first display command, page is long loaded |
| `getStatus()` no longer returns `windowId` | No code reads `getStatus().windowId` — field was informational only. The window ID is still logged in show/hide operations for debugging |
| `isScoreboardVisible()` simplified | Now `return visible` instead of `return visible && windowId !== null`. With no cached windowId, `visible` alone is the correct tracker — set true by `showScoreboard()`, false by `hideScoreboard()` and error/exit handlers |
| `hideScoreboard()` now searches even when nothing shown | More robust — catches orphaned windows. Adds ~10ms xdotool call. Non-fatal if nothing found (returns true) |
| E2E tests break | E2E tests test scoreboard data flow via WebSocket, not display switching xdotool calls. No impact |
