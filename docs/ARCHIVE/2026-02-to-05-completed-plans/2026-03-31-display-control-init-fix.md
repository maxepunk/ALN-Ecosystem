# Display Control Init Decoupling — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 failing backend E2E display control tests by pre-launching Chromium at server startup and decoupling displayControlService init from VLC success.

**Architecture:** displayControlService.init() is currently inside the VLC try/catch block in app.js, so it's skipped when VLC init fails. This means the display state machine has no event listeners (pre-play hook, video:idle) and — critically — Chromium is never pre-launched. When a GM clicks "Scoreboard", displayDriver.showScoreboard() lazily launches Chromium (7 seconds), exceeding the GM Scanner's command ack timeout and Playwright's assertion timeout. The fix moves displayControlService init outside the VLC block and adds Chromium pre-launch to displayDriver.

**Tech Stack:** Node.js, child_process (spawn/execFile), Playwright E2E, Jest unit tests

---

## Problem Analysis

### Root Cause Chain

1. `app.js:241-251` — `displayControlService.init()` is inside `try { await vlcService.init(); ... displayControlService.init(...) } catch { ... }`. When VLC init fails (common in E2E, possible in production after VLC crash), displayControlService is never initialized.

2. `displayDriver.js:104-162` — `_doLaunch()` has ~7 second minimum latency: `pkill` + 2s sleep + spawn + `findWindowId(10, 500)` = 5s retries. This blocks `showScoreboard()` on first call.

3. `displayControlService.js:200-201` — `_doSetScoreboard()` does `await displayDriver.showScoreboard()` synchronously before emitting `display:mode:changed`. The 7-second block delays the WebSocket event to all GM Scanners.

4. `displayDriver.showScoreboard():195-197` — Returns `false` on failure, never throws. `_doSetScoreboard` ignores the return value, so after 7 seconds it "succeeds" and emits the event — but Playwright's 5s assertion has already failed.

### Secondary Issue

5. `tests/e2e/setup/vlc-service.js:66` — References `scripts/vlc-headless.sh` which was deleted. VLC setup always fails in E2E.

### What Needs to Change

| Change | Where | Why |
|--------|-------|-----|
| Move displayControlService.init() outside VLC try/catch | `app.js` | Init display even without VLC |
| Same in systemReset.js | `systemReset.js` | Reset path mirrors init path |
| Add `ensureBrowserRunning()` export + call at init time | `displayDriver.js` | Pre-launch Chromium during startup, not on first use |
| Call `displayDriver.ensureBrowserRunning()` in displayControlService.init() | `displayControlService.js` | Chromium ready before any GM interaction |
| Check `showScoreboard()` return value | `displayControlService.js` | Log warning on driver failure (currently silent) |
| Fix VLC E2E setup to not reference deleted script | `vlc-service.js` | VLC setup shouldn't crash on missing script |

### What Does NOT Change

- The `_switchLock` serialization — stays as-is
- The event emission timing relative to driver calls — stays synchronous (driver completes, then emit)
- The `display:mode:changed` → `display:mode` broadcast wiring — untouched
- GM Scanner display mode UI handler (`MonitoringDisplay._handleDisplayMode`) — untouched
- The pre-play hook — still awaits `hideScoreboard()` before setting VIDEO mode

---

## Task 1: Export ensureBrowserRunning from displayDriver

**Files:**
- Modify: `backend/src/utils/displayDriver.js:293-299`
- Test: `backend/tests/unit/utils/displayDriver.test.js`

**Step 1: Write the failing test**

Add to `displayDriver.test.js` after the existing tests:

```javascript
describe('ensureBrowserRunning()', () => {
  test('is exported and callable', () => {
    expect(typeof displayDriver.ensureBrowserRunning).toBe('function');
  });

  test('launches Chromium and returns true when spawn succeeds', async () => {
    const { spawn, execFile } = require('child_process');
    const mockProc = { pid: 1234, on: jest.fn(), killed: false };
    spawn.mockReturnValue(mockProc);

    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; }
      if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
      else cb(null, '', '');
    });

    const result = await displayDriver.ensureBrowserRunning();
    expect(result).toBe(true);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  test('returns true without relaunching on second call', async () => {
    const { spawn, execFile } = require('child_process');
    const mockProc = { pid: 1234, on: jest.fn(), killed: false };
    spawn.mockReturnValue(mockProc);

    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; }
      if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
      else cb(null, '', '');
    });

    await displayDriver.ensureBrowserRunning();
    const result = await displayDriver.ensureBrowserRunning();
    expect(result).toBe(true);
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/utils/displayDriver.test.js -v`
Expected: FAIL — `displayDriver.ensureBrowserRunning is not a function`

**Step 3: Add ensureBrowserRunning to module.exports**

In `displayDriver.js`, change the exports block (line 293-299):

```javascript
module.exports = {
  ensureBrowserRunning,
  showScoreboard,
  hideScoreboard,
  isScoreboardVisible,
  getStatus,
  cleanup
};
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/utils/displayDriver.test.js -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/displayDriver.js tests/unit/utils/displayDriver.test.js
git commit -m "feat: export ensureBrowserRunning from displayDriver for pre-launch"
```

---

## Task 2: Move displayControlService.init() outside VLC try/catch in app.js

**Files:**
- Modify: `backend/src/app.js:234-254`
- Test: `backend/tests/unit/server/initialization.test.js` (verify no regression)

**Step 1: Understand the current structure**

Current (`app.js:234-254`):
```javascript
if (config.features.videoPlayback) {
  vlcService.on('error', ...);
  try {
    await vlcService.init();
    await vlcService.initializeIdleLoop();
    displayControlService.init({ vlcService, videoQueueService });  // INSIDE try
  } catch (error) {
    logger.warn('VLC service initialization failed...');
  }
}
```

**Step 2: Restructure to decouple**

Change `app.js:234-254` to:

```javascript
if (config.features.videoPlayback) {
  vlcService.on('error', (error) => {
    logger.error('VLC service error (non-fatal)', error);
    logger.info('System will continue without video playback functionality');
  });

  try {
    await vlcService.init();
    await vlcService.initializeIdleLoop();
  } catch (error) {
    logger.warn('VLC service initialization failed - continuing without video playback', error);
  }

  // Display control initializes regardless of VLC status.
  // It manages Scoreboard mode (Chromium) independently of VLC.
  // VLC and videoQueueService are optional dependencies (null-checked internally).
  displayControlService.init({ vlcService, videoQueueService });
}
```

**Step 3: Run existing tests**

Run: `cd backend && npx jest tests/unit/server/initialization.test.js -v`
Expected: PASS (or update if it asserts on init order)

Run: `cd backend && npx jest tests/unit/services/displayControlService.test.js -v`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app.js
git commit -m "fix: init displayControlService outside VLC try/catch

displayControlService manages Scoreboard mode (Chromium) independently
of VLC. It should initialize even when VLC fails, so the GM can toggle
display modes without video playback."
```

---

## Task 3: Pre-launch Chromium in displayControlService.init()

**Files:**
- Modify: `backend/src/services/displayControlService.js:44-83`
- Modify: `backend/tests/unit/services/displayControlService.test.js`

**Step 1: CRITICAL — Add displayDriver mock to existing test file**

The existing `displayControlService.test.js` calls `init()` in `beforeEach` without mocking displayDriver.
After adding `ensureBrowserRunning()` to `init()`, every test would trigger real `pkill`/`spawn`.
Add a top-level auto-mock BEFORE the require:

```javascript
// Mock displayDriver to prevent real Chromium spawn during init()
jest.mock('../../../src/utils/displayDriver', () => ({
  ensureBrowserRunning: jest.fn().mockResolvedValue(true),
  showScoreboard: jest.fn().mockResolvedValue(true),
  hideScoreboard: jest.fn().mockResolvedValue(true),
  isScoreboardVisible: jest.fn().mockReturnValue(false),
  getStatus: jest.fn().mockReturnValue({}),
  cleanup: jest.fn().mockResolvedValue(),
}));
```

**Step 2: Write the new init tests**

Add to `displayControlService.test.js` in the top-level describe, after beforeEach:

```javascript
describe('init', () => {
  test('should call displayDriver.ensureBrowserRunning during init', async () => {
    const displayDriver = require('../../../src/utils/displayDriver');
    displayDriver.ensureBrowserRunning.mockClear();

    displayControlService.reset();
    displayControlService.init({
      vlcService: mockVlcService,
      videoQueueService: mockVideoQueueService
    });

    // ensureBrowserRunning is fire-and-forget (non-blocking)
    await new Promise(r => setImmediate(r));

    expect(displayDriver.ensureBrowserRunning).toHaveBeenCalled();
  });

  test('should still initialize if ensureBrowserRunning fails', async () => {
    const displayDriver = require('../../../src/utils/displayDriver');
    displayDriver.ensureBrowserRunning.mockRejectedValueOnce(new Error('No display'));

    displayControlService.reset();
    displayControlService.init({
      vlcService: mockVlcService,
      videoQueueService: mockVideoQueueService
    });

    await new Promise(r => setImmediate(r));

    // Service is still initialized despite driver failure
    expect(displayControlService._initialized).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/displayControlService.test.js -t "init" -v`
Expected: FAIL — `ensureBrowserRunning` not called

**Step 3: Add pre-launch to init()**

In `displayControlService.js`, at the end of `init()` (before `this._initialized = true`), add:

```javascript
    // Pre-launch scoreboard Chromium so showScoreboard() is instant.
    // Fire-and-forget: init should not block on Chromium spawn.
    displayDriver.ensureBrowserRunning().catch(err => {
      logger.warn('[DisplayControl] Chromium pre-launch failed (non-fatal)', { error: err.message });
    });

    this._initialized = true;
```

Also add the require at the top of the file if not already present. Currently `displayDriver` is already required at line 17:
```javascript
const displayDriver = require('../utils/displayDriver');
```
(Confirmed — already there.)

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/displayControlService.test.js -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/services/displayControlService.js tests/unit/services/displayControlService.test.js
git commit -m "feat: pre-launch Chromium during displayControlService init

Eliminates 7-second delay on first Scoreboard switch by launching
Chromium during server startup instead of lazily on first use."
```

---

## Task 4: Fail cleanly when showScoreboard returns false

**Files:**
- Modify: `backend/src/services/displayControlService.js:193-215`
- Test: `backend/tests/unit/services/displayControlService.test.js`

**Step 1: Write failing test**

Add test in the `setScoreboard` describe:

```javascript
test('should return failure and revert mode when displayDriver.showScoreboard returns false', async () => {
  const displayDriver = require('../../../src/utils/displayDriver');
  displayDriver.showScoreboard.mockResolvedValueOnce(false);

  const result = await displayControlService.setScoreboard();

  expect(result.success).toBe(false);
  expect(result.error).toMatch(/Chromium/i);
  expect(displayControlService.getCurrentMode()).toBe('IDLE_LOOP');
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/displayControlService.test.js -t "showScoreboard returns false" -v`
Expected: FAIL — `success` is `true` (current behavior ignores return value)

**Step 3: Add return value check in _doSetScoreboard**

Change line 201 from:
```javascript
      await displayDriver.showScoreboard();
```
To:
```javascript
      const shown = await displayDriver.showScoreboard();
      if (!shown) {
        throw new Error('Chromium display driver failed — scoreboard may not be visible');
      }
```

This uses the existing catch block (line 210-214) which reverts the mode and returns `{ success: false }`. The GM gets an accurate failure ack and can retry.

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/displayControlService.test.js -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/services/displayControlService.js tests/unit/services/displayControlService.test.js
git commit -m "fix: return failure when displayDriver.showScoreboard fails

showScoreboard returns false on failure without throwing. Previously
the return value was ignored, reporting success to the GM while the
physical display didn't switch. Now throws into the existing catch
block, reverting the mode and sending a failure ack."
```

---

## Task 5: Mirror the init decoupling in systemReset.js

**Files:**
- Modify: `backend/src/services/systemReset.js:149-156`
- Test: `backend/tests/unit/services/systemReset.test.js`

**Step 1: Change the guard condition**

Current (line 150):
```javascript
  if (displayControlService && vlcService) {
    displayControlService.init({
      vlcService,
      videoQueueService
    });
```

Change to:
```javascript
  if (displayControlService) {
    displayControlService.init({
      vlcService,
      videoQueueService
    });
```

This mirrors the app.js change — displayControlService should re-init after reset regardless of VLC state.

**Step 2: Run tests**

Run: `cd backend && npx jest tests/unit/services/systemReset.test.js -v`
Expected: PASS

**Step 3: Commit**

```bash
git add src/services/systemReset.js
git commit -m "fix: decouple displayControlService re-init from VLC in systemReset

Mirrors app.js change — display control should re-initialize after
system reset even when VLC is unavailable."
```

---

## Task 6: Fix E2E VLC setup to not reference deleted script

**Files:**
- Modify: `backend/tests/e2e/setup/vlc-service.js:56-89`

**Step 1: Update startVLCIfNeeded to use cvlc directly**

The deleted `vlc-headless.sh` just ran `cvlc`. Replace the script reference with a direct spawn. Change `startVLCIfNeeded()` (lines 56-89):

```javascript
async function startVLCIfNeeded() {
  if (await isVLCAvailable()) {
    logger.info('VLC already running - skipping startup');
    return true;
  }

  logger.info('Starting VLC for E2E tests...');

  try {
    vlcProcess = spawn('cvlc', [
      '--intf', 'dummy',
      '--no-video-title-show',
      '--quiet'
    ], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
    });
    vlcProcess.unref();

    logger.debug('VLC process spawned', { pid: vlcProcess.pid });

    const ready = await waitForVLCReady(VLC_MAX_WAIT_MS);

    if (ready) {
      logger.info('VLC started successfully for E2E tests');
      return true;
    } else {
      logger.warn('VLC failed to become ready within timeout');
      vlcProcess = null;
      return false;
    }
  } catch (error) {
    logger.error('Failed to start VLC', { error: error.message });
    vlcProcess = null;
    return false;
  }
}
```

Also remove the `path` import if it's only used for the deleted script path (line 18). Check first:
- Line 18: `const path = require('path');` — only used at line 65 for the script path. Remove it.

**Step 2: Verify**

No unit tests for this file (it's E2E infrastructure). Verify by running the display control E2E suite after all other tasks are complete.

**Step 3: Commit**

```bash
git add tests/e2e/setup/vlc-service.js
git commit -m "fix: replace deleted vlc-headless.sh with direct cvlc spawn in E2E setup"
```

---

## Task 7: Run all test suites sequentially

**Step 1:** ALNScanner unit tests
```bash
cd ALNScanner && npx jest
```
Expected: 55 suites, 1102 passed

**Step 2:** Backend unit+contract tests
```bash
cd backend && npm test
```
Expected: 74 suites, ~1536 passed (new tests added)

**Step 3:** Backend integration tests
```bash
cd backend && npm run test:integration
```
Expected: 32 suites, 273 passed

**Step 4:** Check for orphan processes
```bash
pgrep -af "dbus-monitor|pactl subscribe|node.*vite|node.*jest" | grep -v "pgrep\|bash"
```
Expected: Clean

**Step 5:** ALNScanner E2E tests
```bash
cd ALNScanner && npm run test:e2e
```
Expected: 50 passed

**Step 6:** Rebuild ALNScanner dist (required for backend E2E)
```bash
cd ALNScanner && npm run build
```

**Step 7:** Check for orphan processes again
```bash
pgrep -af "dbus-monitor|pactl subscribe|chromium.*headless_shell" | grep -v "pgrep\|bash"
```
Expected: Clean (production kiosk Chromium is OK)

**Step 8:** Backend E2E tests
```bash
cd backend && npm run test:e2e
```
Expected: Display control tests (08, 25) now pass. Total: ~131 passed, 0 failed, ~39 skipped

**Step 9: Final commit (if all green)**

```bash
# No code changes here — this is just the verification step
```

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Chromium pre-launch fails during server init on Pi | Low | Fire-and-forget with catch — init continues, first showScoreboard() retries |
| Pre-launch background work runs for ~7s after init returns | Medium | Fire-and-forget — does NOT block startup. Background Chromium spawn + window polling completes asynchronously. `launchPromise` guard prevents double-spawn if `showScoreboard` is called during the window. |
| displayControlService.init() without VLC misses pre-play hook wiring | None | Pre-play hook is on videoQueueService, null-checked: `if (this.videoQueueService)` |
| systemReset re-inits displayControlService without VLC | None | vlcService is still passed (may be unavailable but that's fine — null-checked in setIdleLoop/setScoreboard) |
| E2E cvlc spawn doesn't register D-Bus interface | Low | Same behavior as before — `waitForVLCReady` polls D-Bus, returns false on timeout |
| Existing displayControlService unit tests break | Low | Tests use mocks for displayDriver — the pre-launch call just needs to be mockable |
