# Display Control E2E Test Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 1 hard-failing and 3 flaky backend E2E tests caused by a cross-worker Chromium conflict, a conditional sleep optimization, and an env var typo — all production-quality improvements, not test workarounds.

**Architecture:** The root cause is that test file `08-display-control.test.js` runs in both Playwright projects (chromium + mobile-chrome) simultaneously with 2 workers. Each worker starts its own orchestrator, and both call `pkill -f chromium.*--kiosk` during Chromium launch, killing each other's browser in an infinite loop. Fixing the resource conflict, optimizing the launch path, and correcting a misconfigured env var together resolve the failures while improving production code quality.

**Tech Stack:** Node.js, Playwright, child_process (spawn/execFileSync), xdotool/wmctrl, Jest

---

## Background: Current Test Status

| Layer | Result |
|-------|--------|
| ALNScanner unit | 1102 passed |
| Backend unit+contract | 1540 passed, 1 todo |
| Backend integration | 273 passed |
| ALNScanner E2E | 50 passed |
| Backend E2E | 129 passed, **1 failed**, **3 flaky** |

**Failures:**
- **HARD FAIL** — `[mobile-chrome] 08-display-control.test.js:106` — "toggle Idle Loop to Scoreboard"
- **FLAKY** — `[chromium] 08-display-control.test.js:106` — same test, other project
- **FLAKY** — `[mobile-chrome] 24-scoreboard-restart-recovery.test.js:130` — scoreboard data survives restart
- **FLAKY** — `[mobile-chrome] 25-scoreboard-video-lifecycle.test.js:169` — kiosk overlay lifecycle

## Root Cause Analysis

### Primary: Cross-Worker Chromium Conflict (Test 08)

Test file 08 has **no `isMobile` skip guard**, so it runs in both `chromium` and `mobile-chrome` projects simultaneously when `--workers=2` is used (npm script default). Each worker starts its own orchestrator process via `startOrchestrator()`. Both orchestrators call `displayControlService.init()` → `displayDriver.ensureBrowserRunning()` → `_doLaunch()` → `pkill -f chromium.*--kiosk`. This `pkill` is **system-wide** — it kills the other worker's Chromium. The result is an infinite kill loop where neither orchestrator can keep Chromium alive.

Every other test file that starts its own orchestrator and does anything display-related has a skip guard:
- `23-scoreboard-live-data.test.js:40` — `!isMobile` guard (mobile-chrome only)
- `24-scoreboard-restart-recovery.test.js:41` — `!isMobile` guard
- `25-scoreboard-video-lifecycle.test.js:39` — `!isMobile` guard

Test 08 is the only display-related test missing this guard.

### Secondary: Unconditional 2-Second Sleep (Production Optimization)

`displayDriver._doLaunch()` always sleeps 2 seconds after `pkill`, even when no Chromium was killed. This adds unnecessary latency to the first `showScoreboard()` call in production (common case: clean server start, no orphan Chromium to kill).

### Tertiary: Wrong Env Var Name Across Multiple Files

`config/index.js:111` reads `process.env.ENABLE_VIDEO_PLAYBACK`, but several files reference the old name `FEATURE_VIDEO_PLAYBACK`. This is not just a cosmetic issue — two files that SET the env var to disable video (`package.json:20` `dev:no-video` script, `scripts/start-dev.js:96` option 2) silently fail because the config never reads the variable they set.

**Files using the wrong name:**
| File | Line | Impact |
|------|------|--------|
| `tests/e2e/setup/test-server.js` | 79 | Sets wrong name; works by accident (`undefined !== 'false'` = true) |
| `package.json` | 20 | `dev:no-video` script silently fails to disable video |
| `scripts/start-dev.js` | 96 | "Orchestrator Only" mode silently fails to disable video |
| `playwright.config.js` | 94, 115 | Reads wrong name for GPU disable; cosmetic (always truthy) |
| `.env.example` | 20 | Documents wrong name |
| `scripts/lib/validators/VideoPlaybackCheck.js` | 118 | Error message string only (no functional impact) |
| `CLAUDE.md` | 475 | Documentation |

---

### Task 1: Add `isMobile` Skip Guard to Test 08

**Files:**
- Modify: `tests/e2e/flows/08-display-control.test.js:41`

This is the primary fix. Test 08 uses `createBrowserContext(browser, 'desktop', ...)` for all tests — there's nothing mobile-specific about display control tests. Running them once in the `chromium` project is sufficient. Adding a skip guard ensures only one orchestrator manages Chromium at a time, eliminating the cross-worker kill loop.

**Step 1: Add the skip guard**

Add at file level, before the `test.describe` block (matching the convention in tests 23, 24, 25 which place `test.skip` at file level):

```javascript
// Display control tests manage a system-wide Chromium kiosk process via pkill/spawn.
// Running in both projects with --workers=2 causes cross-worker Chromium kill loops.
// Run once in chromium project (desktop viewport matches createBrowserContext 'desktop').
test.skip(({ isMobile }) => isMobile, 'Display control tests only run on chromium project');

test.describe('Display Control - Admin Panel', () => {
```

This goes between the existing `let` declarations (line 39) and the `test.describe` at line 41.

**Step 2: Run test 08 only to verify the skip guard works**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx playwright test flows/08-display-control --workers=2`

Expected: All 6 tests pass in chromium project. Mobile-chrome tests show as skipped.

**Step 3: Commit**

```bash
git add tests/e2e/flows/08-display-control.test.js
git commit -m "fix(e2e): add isMobile skip guard to display control tests

Display control tests manage a system-wide Chromium kiosk process via
pkill/spawn. Running in both chromium and mobile-chrome projects with
--workers=2 caused cross-worker Chromium kill loops where each
orchestrator's pkill killed the other's browser.

All other display-related E2E suites (23, 24, 25) already have skip
guards. Test 08 was the only one missing it."
```

---

### Task 2: Make `_doLaunch()` Sleep Conditional

**Files:**
- Modify: `src/utils/displayDriver.js:104-112`
- Modify: `tests/unit/utils/displayDriver.test.js:344-389`

The current `_doLaunch()` unconditionally sleeps 2 seconds after `pkill`, even when no Chromium process was found. `pkill` returns exit code 0 when it killed something, and throws (via `execFileSync`) when no matching process exists. The current code catches the throw but still sleeps. Fix: only sleep when `pkill` actually killed something.

**Step 1: Write a failing test**

In `tests/unit/utils/displayDriver.test.js`, add after the existing "proceeds with launch even if no orphaned Chromium exists" test (after line 388):

```javascript
    test('skips 2-second wait when no orphaned Chromium was running', async () => {
      const { spawn, execFile, execFileSync } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      // pkill throws when no matching process (exit code 1)
      execFileSync.mockImplementation(() => { throw new Error('no process found'); });

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      const start = Date.now();
      await displayDriver.showScoreboard();
      const elapsed = Date.now() - start;

      // Without an orphan to kill, launch should NOT include the 2-second cleanup wait.
      // Allow generous margin for test execution overhead, but should be well under 2000ms.
      expect(elapsed).toBeLessThan(1500);
    });
```

**Step 2: Run test to verify it fails**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/unit/utils/displayDriver.test.js -t "skips 2-second wait" --verbose`

Expected: FAIL — elapsed >= 2000ms because the current code always sleeps.

Note: This test depends on real setTimeout timing. The existing displayDriver tests all use mocked child_process but real timers. The 2-second sleep in `_doLaunch` uses a real `setTimeout` (not mocked). The test measures wall-clock time. With `jest.useFakeTimers()` we could make this more deterministic, but the existing test file uses real timers throughout and adding fake timers would require refactoring all tests. The 1500ms threshold gives enough margin.

**Step 3: Implement the conditional sleep**

In `src/utils/displayDriver.js`, replace lines 104-112:

Current:
```javascript
async function _doLaunch() {
  // Kill any orphaned Chromium from previous server instance
  try {
    execFileSync('pkill', ['-f', 'chromium.*--kiosk'], { timeout: 3000 });
    // Wait for Chromium to fully exit (releases single-instance lock)
    await new Promise(r => setTimeout(r, 2000));
  } catch {
    // No Chromium running — clean state
  }
```

New:
```javascript
async function _doLaunch() {
  // Kill any orphaned Chromium from previous server instance
  let killedOrphan = false;
  try {
    execFileSync('pkill', ['-f', 'chromium.*--kiosk'], { timeout: 3000 });
    killedOrphan = true;
  } catch {
    // No Chromium running — clean state, no wait needed
  }

  if (killedOrphan) {
    // Wait for Chromium to fully exit (releases single-instance lock)
    await new Promise(r => setTimeout(r, 2000));
  }
```

**Step 4: Run the full displayDriver test suite**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/unit/utils/displayDriver.test.js --verbose`

Expected: All tests pass, including the new timing test.

**Step 5: Run the full backend unit+contract suite to check for regressions**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npm test`

Expected: 74 suites, 1541+ tests, all pass.

**Step 6: Commit**

```bash
git add src/utils/displayDriver.js tests/unit/utils/displayDriver.test.js
git commit -m "perf: skip 2-second sleep in _doLaunch when no orphan Chromium found

pkill returns exit 0 when it killed a process and throws when no match.
The 2-second wait is only needed when an orphan was actually killed (to
let it release the single-instance lock). Previously the sleep ran
unconditionally, adding 2 seconds to every clean Chromium launch."
```

---

### Task 3: Fix `FEATURE_VIDEO_PLAYBACK` → `ENABLE_VIDEO_PLAYBACK` Across Codebase

**Files:**
- Modify: `tests/e2e/setup/test-server.js:79`
- Modify: `package.json:20`
- Modify: `scripts/start-dev.js:96`
- Modify: `playwright.config.js:94,115`
- Modify: `.env.example:20`
- Modify: `scripts/lib/validators/VideoPlaybackCheck.js:118`
- Modify: `CLAUDE.md:475`

`config/index.js:111` reads `process.env.ENABLE_VIDEO_PLAYBACK` but multiple files reference the old name `FEATURE_VIDEO_PLAYBACK`. Two of these (`package.json` `dev:no-video`, `scripts/start-dev.js` option 2) are real bugs — they silently fail to disable video playback because the config never reads the variable they set.

**Step 1: Fix all functional references**

In `tests/e2e/setup/test-server.js`, line 79:
```diff
-  FEATURE_VIDEO_PLAYBACK: 'true',
+  ENABLE_VIDEO_PLAYBACK: 'true',
```

In `package.json`, line 20:
```diff
-    "dev:no-video": "FEATURE_VIDEO_PLAYBACK=false npm run orchestrator:dev",
+    "dev:no-video": "ENABLE_VIDEO_PLAYBACK=false npm run orchestrator:dev",
```

In `scripts/start-dev.js`, line 96:
```diff
-                    'FEATURE_VIDEO_PLAYBACK=false nodemon src/server.js',
+                    'ENABLE_VIDEO_PLAYBACK=false nodemon src/server.js',
```

In `playwright.config.js`, lines 94 and 115 (two occurrences):
```diff
-            ...(process.env.FEATURE_VIDEO_PLAYBACK !== 'false' ? ['--disable-gpu'] : []),
+            ...(process.env.ENABLE_VIDEO_PLAYBACK !== 'false' ? ['--disable-gpu'] : []),
```

**Step 2: Fix documentation references**

In `.env.example`, line 20:
```diff
-FEATURE_VIDEO_PLAYBACK=true
+ENABLE_VIDEO_PLAYBACK=true
```

In `scripts/lib/validators/VideoPlaybackCheck.js`, line 118 (error message string):
```diff
-            'FEATURE_VIDEO_PLAYBACK=false',
+            'ENABLE_VIDEO_PLAYBACK=false',
```

In `CLAUDE.md`, line 475:
```diff
-FEATURE_VIDEO_PLAYBACK=true
+ENABLE_VIDEO_PLAYBACK=true
```

**Step 3: Verify no references remain**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && grep -r "FEATURE_VIDEO_PLAYBACK" --include="*.js" --include="*.json" --include="*.md" --include=".env*" . | grep -v node_modules | grep -v docs/plans/2026-03-31`

Expected: Zero matches.

**Step 4: Run backend unit tests to check for regressions**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npm test`

Expected: All pass (env var only affects runtime, not test mocking).

**Step 5: Commit**

```bash
git add tests/e2e/setup/test-server.js package.json scripts/start-dev.js playwright.config.js .env.example scripts/lib/validators/VideoPlaybackCheck.js CLAUDE.md
git commit -m "fix: rename FEATURE_VIDEO_PLAYBACK → ENABLE_VIDEO_PLAYBACK everywhere

config/index.js reads ENABLE_VIDEO_PLAYBACK but multiple files still used
the old FEATURE_VIDEO_PLAYBACK name. Two were real bugs: dev:no-video npm
script and start-dev.js option 2 silently failed to disable video
playback because the config never saw the variable they set."
```

---

### Task 4: Run Full E2E Suite to Verify All Fixes

**Files:** None (verification only)

**Step 1: Clean up any orphan processes**

Run: `pkill -f 'chromium.*--kiosk' 2>/dev/null; pkill -f 'node.*server.js' 2>/dev/null; sleep 2`

**Step 2: Run complete backend E2E suite**

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx playwright test --workers=2`

Expected:
- Test 08: All 6 tests pass in chromium project, skipped in mobile-chrome
- Test 24: Passes (was flaky due to cross-worker interference from test 08)
- Test 25: Passes or skipped (depends on VLC availability; overlay test should not be affected by Chromium conflicts now)
- Total: 0 failures, fewer flaky tests

**Step 3: If any tests still fail, investigate**

Test 24 and 25 flakiness may have secondary causes (VLC reliability, video playback timing). If they still fail AFTER the cross-worker fix, investigate independently — they should be isolated issues now that the Chromium kill loop is eliminated.

**Step 4: Run the full 5-layer test suite to confirm no regressions**

Run sequentially:
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm test
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npm test
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npm run test:integration
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm run test:e2e
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx playwright test --workers=2
```

Expected: All layers green. No regressions.

---

## What This Plan Does NOT Do (and Why)

**Does NOT move `display:mode:changed` emit before `showScoreboard()`:** The independent review identified this as architecturally wrong. The event should reflect physical reality — emitting before the display actually switches creates a lie-to-clients bug with no correction mechanism. The current emit placement (after `showScoreboard()`) is correct.

**Does NOT increase assertion timeouts:** With the cross-worker fix, `showScoreboard()` should complete in < 500ms (Chromium already running from pre-launch). A 5-second assertion timeout is generous. Increasing it would mask real production slowness.

**Does NOT change `init()` from sync to async:** The fire-and-forget `ensureBrowserRunning()` + `launchPromise` guard is correct. The first `showScoreboard()` call waits via the shared `launchPromise` if pre-launch hasn't finished. Making `init()` async would require changes in `app.js` and `systemReset.js` for marginal benefit — the real problem was cross-worker interference, not init timing.
