# DisplayDriver Chromium Process Kill Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three Chromium process management bugs: orphan recovery uses unreliable SIGTERM, cleanup() SIGKILL escalation is dead code, and _doLaunch() can't detect early Chromium crashes.

**Architecture:** Three targeted fixes in `displayDriver.js`, all internal — no public API changes. Fix 1: SIGKILL for orphan recovery. Fix 2: Use `process.kill(pid, 0)` alive-check instead of `.killed` property for SIGKILL escalation. Fix 3: Brief alive-check after spawn to detect early crashes.

**Tech Stack:** Node.js, child_process, Jest

---

## Context

### What Happened

During manual verification of the fresh-window-lookup refactor, a PM2 restart failed to kill the old Chromium. The old Chromium orphan held the single-instance lock, preventing the new Chromium from starting. The system appeared to work "by accident" because the old Chromium reconnected to the new server.

### Root Causes

**Bug 1 — Orphan recovery uses SIGTERM (line 109):** Chromium can ignore SIGTERM. The PID-file-based orphan recovery sends SIGTERM and hopes for the best. No verification, no escalation.

**Bug 2 — cleanup() SIGKILL escalation is dead code (lines 276-284):** Node.js `ChildProcess.killed` is set to `true` the moment `.kill()` is called, NOT when the process dies. After `browserProcess.kill('SIGTERM')`, `.killed` becomes `true`, so the `if (!browserProcess.killed)` SIGKILL branch never executes. Verified empirically.

**Bug 3 — _doLaunch() doesn't detect early crashes (our regression):** The old `findWindowId()` with 10 retries over 5s inadvertently served as a crash detector. Our fresh-lookup refactor removed it. Now `_doLaunch()` returns `true` unconditionally after spawn.

### Failure Chain
1. `cleanup()` → SIGTERM → Chromium ignores it → SIGKILL dead code → orphan survives
2. `_doLaunch()` → reads PID file → SIGTERM to orphan → still alive after 2s
3. New Chromium spawns → single-instance lock conflict → crashes immediately
4. `_doLaunch()` returns `true` (no alive check) → system thinks scoreboard is running

### Key Fact: SIGKILL on Parent Kills All Children
Chromium children have a `prctl(PR_SET_PDEATHSIG)` watchdog. When the parent dies to SIGKILL, the kernel sends SIGTERM to all children, and they exit. Verified on Pi: `kill -9 <parent_pid>` → all children dead within 2s.

---

## Task 1: Fix Orphan Recovery + Early Crash Detection in _doLaunch()

**Files:**
- Modify: `backend/src/utils/displayDriver.js` (lines 99-171)
- Modify: `backend/tests/unit/utils/displayDriver.test.js` (orphan + timing tests)

### Step 1: Change orphan kill from SIGTERM to SIGKILL

In `backend/src/utils/displayDriver.js`, line 109:

Old:
```js
        process.kill(oldPid, 'SIGTERM');
```

New:
```js
        process.kill(oldPid, 'SIGKILL');
```

Orphans from a crashed server don't need graceful shutdown. SIGKILL is reliable and propagates to Chromium children via the kernel death signal.

### Step 2: Add early crash detection after spawn

In `backend/src/utils/displayDriver.js`, replace lines 167-170:

Old:
```js
  logger.info('[DisplayDriver] Chromium process started', {
    pid: browserProcess?.pid
  });
  return true;
```

New:
```js
  // Brief alive check — catches early crashes (e.g., single-instance lock conflict,
  // binary missing, GPU init failure). The on('exit') handler nulls browserProcess.
  await new Promise(r => setTimeout(r, 1000));
  if (!browserProcess) {
    logger.error('[DisplayDriver] Chromium process died during startup');
    return false;
  }

  logger.info('[DisplayDriver] Chromium process started', {
    pid: browserProcess?.pid
  });
  return true;
```

Why `!browserProcess` not `.killed`: When Chromium crashes, the `on('exit')` handler fires and sets `browserProcess = null`. The `.killed` property only becomes true when YOUR code calls `.kill()` — it stays false for self-initiated crashes. So `!browserProcess` is the correct check.

Why 1000ms: Chromium's single-instance lock conflict takes 1-3s on Pi. 500ms might miss it. 1000ms catches most failures. If Chromium crashes later, `showScoreboard()` handles it gracefully via `_findScoreboardWindow()` returning null.

### Step 3: Update orphan kill test assertion

In `backend/tests/unit/utils/displayDriver.test.js`, line 452:

Old:
```js
        expect(killSpy).toHaveBeenCalledWith(9999, 'SIGTERM');
```

New:
```js
        expect(killSpy).toHaveBeenCalledWith(9999, 'SIGKILL');
```

### Step 4: Update timing test threshold

In `backend/tests/unit/utils/displayDriver.test.js`, line 500. The new 1000ms alive-check in `_doLaunch()` adds to every launch. Update the threshold:

Old:
```js
      expect(elapsed).toBeLessThan(1500);
```

New:
```js
      // _doLaunch() has a 1000ms alive check after spawn.
      // Without an orphan to kill, total should be ~1000ms (no 2s orphan wait).
      expect(elapsed).toBeLessThan(2500);
```

### Step 5: Add test for early crash detection

Add this test in the `ensureBrowserRunning()` describe block:

```js
    test('returns false if Chromium crashes during startup', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        cb(null, '', '');
      });

      // Simulate Chromium crashing: trigger the exit handler during the 1s alive check
      // The on('exit') handler is registered as the second .on() call
      const onExitHandler = () => {
        const exitCb = mockProc.on.mock.calls.find(c => c[0] === 'exit')?.[1];
        if (exitCb) exitCb(1, null); // exit code 1
      };
      // Trigger after spawn but before the 1s check completes
      setTimeout(onExitHandler, 100);

      const result = await displayDriver.ensureBrowserRunning();
      expect(result).toBe(false);
    });
```

### Step 6: Run tests

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/unit/utils/displayDriver.test.js --verbose`

Expected: All tests pass (26 existing + 1 new = 27).

### Step 7: Commit

```
fix: use SIGKILL for Chromium orphan recovery + detect early crashes

SIGTERM is unreliable for Chromium — switch to SIGKILL for orphan
recovery. Add 1s alive-check after spawn to detect early crashes
(single-instance lock conflict, GPU failure, etc.).
```

---

## Task 2: Fix cleanup() SIGKILL Escalation Dead Code

**Files:**
- Modify: `backend/src/utils/displayDriver.js` (lines 275-295)
- Modify: `backend/tests/unit/utils/displayDriver.test.js` (cleanup tests)

### Step 1: Fix cleanup() to use process.kill(pid, 0) alive check

In `backend/src/utils/displayDriver.js`, replace lines 275-295:

Old:
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

  // Remove PID file (clean shutdown — no orphan to recover)
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // Already removed or never written
  }
}
```

New:
```js
async function cleanup() {
  if (browserProcess && !browserProcess.killed) {
    const pid = browserProcess.pid;
    logger.info('[DisplayDriver] Killing browser process on shutdown', { pid });
    browserProcess.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 1000));
    // .killed reflects kill() was CALLED, not that process died.
    // Use signal 0 to check if actually dead.
    try {
      process.kill(pid, 0); // Throws ESRCH if process doesn't exist
      process.kill(pid, 'SIGKILL');
      logger.warn('[DisplayDriver] Browser process required SIGKILL', { pid });
    } catch {
      // Process is dead — SIGTERM worked
    }
  }
  browserProcess = null;
  visible = false;

  // Remove PID file (clean shutdown — no orphan to recover)
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // Already removed or never written
  }
}
```

Note: Both `process.kill(pid, 0)` and `process.kill(pid, 'SIGKILL')` are in the same try block. If the process dies between the two calls, the SIGKILL throws ESRCH, caught by the same catch. No TOCTOU issue.

### Step 2: Add test for SIGKILL escalation when SIGTERM fails

Add in the `cleanup()` describe block:

```js
    test('escalates to SIGKILL when process survives SIGTERM', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false, kill: jest.fn() };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();

      // process.kill(pid, 0) not throwing = process still alive after SIGTERM
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      try {
        await displayDriver.cleanup();

        // Should have probed with signal 0, then sent SIGKILL
        expect(killSpy).toHaveBeenCalledWith(1234, 0);
        expect(killSpy).toHaveBeenCalledWith(1234, 'SIGKILL');
      } finally {
        killSpy.mockRestore();
      }
    });

    test('does not SIGKILL when process dies from SIGTERM', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false, kill: jest.fn() };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();

      // process.kill(pid, 0) throwing ESRCH = process already dead
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
        const err = new Error('ESRCH');
        err.code = 'ESRCH';
        throw err;
      });
      try {
        await displayDriver.cleanup();

        // Should have probed with signal 0 but NOT sent SIGKILL
        expect(killSpy).toHaveBeenCalledWith(1234, 0);
        expect(killSpy).not.toHaveBeenCalledWith(1234, 'SIGKILL');
      } finally {
        killSpy.mockRestore();
      }
    });
```

### Step 3: Run tests

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx jest tests/unit/utils/displayDriver.test.js --verbose`

Expected: All tests pass (27 from Task 1 + 2 new = 29).

### Step 4: Run full backend suite

Run: `cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npm test`

Expected: All pass. displayControlService tests mock entire displayDriver module — unaffected.

### Step 5: Commit

```
fix: cleanup() SIGKILL escalation was dead code

Node.js ChildProcess.killed is set true when .kill() is called, not
when the process dies. The SIGKILL branch after SIGTERM never executed.
Use process.kill(pid, 0) to probe if process is actually dead.
```

---

## Task 3: Update Stale Documentation

**Files:**
- Modify: `backend/CLAUDE.md` (lines 220-221)
- Modify: `~/.claude/projects/-home-maxepunk-projects-AboutLastNight-ALN-Ecosystem/memory/MEMORY.md` (line 82)

### Step 1: Fix backend CLAUDE.md

In `backend/CLAUDE.md`, replace lines 220-221:

Old:
```
- `displayDriver.cleanup()` is the only kill path (called from server.js shutdown handler). Also runs `pkill -f chromium.*--kiosk` as fallback for Chromium that escaped tracking.
- `_doLaunch()` runs `pkill -f chromium.*--kiosk` before spawning to kill orphans from previous server crashes
```

New:
```
- `displayDriver.cleanup()` is the only kill path (called from server.js shutdown handler). Sends SIGTERM, waits 1s, escalates to SIGKILL via `process.kill(pid, 0)` alive-check.
- `_doLaunch()` kills orphaned Chromium via PID file (`/tmp/aln-pm-scoreboard-chromium.pid`) with SIGKILL before spawning. Includes 1s alive-check after spawn to detect early crashes.
```

### Step 2: Fix memory entry

In `~/.claude/projects/-home-maxepunk-projects-AboutLastNight-ALN-Ecosystem/memory/MEMORY.md`, line 82:

Old:
```
- displayDriver `_doLaunch()` runs `pkill -f chromium.*--kiosk` before spawning Chromium to kill orphans from previous server crash. cleanup() has same pkill as fallback after tracked process kill.
```

New:
```
- displayDriver `_doLaunch()` kills orphaned Chromium via PID file with SIGKILL before spawning. cleanup() uses SIGTERM → 1s wait → `process.kill(pid, 0)` alive-check → SIGKILL escalation. 1s alive-check after spawn detects early crashes.
```

### Step 3: Commit

```
docs: update CLAUDE.md and memory for displayDriver kill behavior
```

---

## Task 4: Manual Verification on Pi

**No code changes — verification only.**

### Step 1: Restart the server

```bash
pm2 restart aln-orchestrator
```

### Step 2: Wait for startup and verify

```bash
sleep 8 && pm2 logs aln-orchestrator --lines 15 --nostream | grep -i "chromium\|display\|kill\|orphan\|SIGKILL"
```

Expected:
- `[DisplayDriver] Chromium process started` (no orphan to kill)
- NO `died during startup` error

### Step 3: Verify all managed processes alive

```bash
for f in /tmp/aln-pm-*.pid; do
  pid=$(cat "$f" 2>/dev/null)
  name=$(basename "$f" .pid | sed 's/aln-pm-//')
  alive="DEAD ⚠️"; kill -0 "$pid" 2>/dev/null && alive="ALIVE"
  echo "  $name: PID=$pid ($alive)"
done
```

Expected: All 6 processes ALIVE, including `scoreboard-chromium`.

### Step 4: Verify correct Chromium window

```bash
DISPLAY=:0 xdotool search --name 'Case File' | while read wid; do
  echo "Window $wid: $(DISPLAY=:0 xdotool getwindowname "$wid")"
done
```

Expected: Exactly 1 window: "Case File: About Last Night - Chromium"

### Step 5: Test display switching

From GM Scanner admin panel: tap Idle Loop → Scoreboard → Idle Loop.

Expected: Each transition works. Logs show correct window IDs. No "Video Playing..." overlay stuck on screen.

### Step 6: Full environment status

```bash
# Resources
free -h && vcgencmd measure_temp && vcgencmd get_throttled && uptime

# Bluetooth
bluetoothctl info | grep -E "Name:|Connected:" && pactl list sinks short

# Audio streams
wpctl status | sed -n '/Streams:/,/^$/p'
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| SIGKILL on orphan kills innocent process | PID file + `/proc/pid/cmdline` chromium check before kill. PID recycling to another chromium process within 2s is astronomically unlikely |
| TOCTOU between signal-0 check and SIGKILL in cleanup() | Both inside same try/catch — if process dies between check and kill, SIGKILL throws ESRCH, caught cleanly |
| 1s alive-check makes launch slower | Acceptable — launch happens once on server start (30s startup budget). Not on every show/hide |
| 1s alive-check misses delayed crashes (>1s) | `showScoreboard()` handles this via `_findScoreboardWindow()` returning null. Defense-in-depth, not sole guard |
| Timing test threshold change (1500→2500ms) | Generous margin. Real execution is ~1050ms without orphan. Only testing that the 2s orphan wait doesn't fire |
