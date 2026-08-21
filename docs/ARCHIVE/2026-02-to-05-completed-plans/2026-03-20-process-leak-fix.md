# VLC & D-Bus Monitor Process Leak Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate VLC and D-Bus monitor process leaks after SIGKILL by making ProcessMonitor handle its own complete lifecycle — including orphan recovery via PID files — and migrating VLC's custom process management to ProcessMonitor.

**Architecture:** ProcessMonitor is the system's reusable process lifecycle manager. It already handles spawn, auto-restart, graceful stop, and `process.on('exit')` orphan prevention — but exit handlers don't fire on SIGKILL. This plan adds PID-file-based orphan recovery to ProcessMonitor (the abstraction that owns process lifecycle), adds configurable stdio/env to support VLC, fixes the `receivedData` heuristic to count stderr (eliminating VLC's incompatibility), and migrates VLC from bespoke spawn/stop/restart code to ProcessMonitor. All child processes — VLC player, 3 D-Bus monitors, pactl subscriber — are then managed by a single, tested abstraction. The D-Bus MPRIS communication layer (video playback, cue timelines, state events) is completely separate from the process management layer and is unaffected.

**Tech Stack:** Node.js, child_process (spawn), fs (sync read/write/unlink), Jest, D-Bus MPRIS

---

## Background

**Root cause confirmed on target Pi:** `/usr/bin/cvlc` is a shell script that `exec`s `/usr/bin/vlc`. After exec, the process name becomes `vlc`. All `pkill -x cvlc` calls in the codebase are dead code. When Node gets SIGKILL'd (PM2 kill, OOM), `process.on('exit')` handlers don't fire, so child processes are orphaned under PID 1. Confirmed: 10 orphaned `dbus-monitor` processes on the target Pi.

**Why ProcessMonitor owns this fix:** The existing architecture principle is "each service owns its complete process lifecycle." ProcessMonitor already owns spawn, restart, and graceful cleanup for 4 child processes. The SIGKILL gap is a ProcessMonitor responsibility — not an app.js concern and not a per-service concern.

**Why PID files (not pkill patterns):** VLC and Spotify MPRIS monitors spawn identical command lines (`dbus-monitor --session --monitor type='signal',...,path='/org/mpris/MediaPlayer2'`). Pattern-based `pkill -f` can't distinguish them. PID files give per-instance orphan tracking via ProcessMonitor's unique `label`.

**Why VLC migrates to ProcessMonitor:** VLC was excluded from ProcessMonitor because its `receivedData` heuristic only checks stdout — VLC writes to stderr, causing false `maxFailures` give-up. Fixing the heuristic to count stderr eliminates this incompatibility. Migrating VLC unifies all child process management under one tested abstraction and gives VLC automatic PID-file orphan recovery.

**Gameplay safety:** The D-Bus MPRIS communication layer (video playback control, 1-second position polling, video-driven cue timelines, state change events) is entirely separate from the process management layer. `videoQueueService.monitorVlcPlayback()` polls VLC via `dbus-send` commands — it never touches the spawned process's stdio. Migrating VLC's spawn/kill/restart to ProcessMonitor has zero impact on video playback or cue timeline advancement.

**ProcessMonitor consumers after migration (5 instances):**

| Label | Command | Service | PID File |
|-------|---------|---------|----------|
| `VLC` | `cvlc` | vlcMprisService | `/tmp/aln-pm-vlc.pid` |
| `vlc-dbus-monitor` | `dbus-monitor --session ...MediaPlayer2` | vlcMprisService (via mprisPlayerBase) | `/tmp/aln-pm-vlc-dbus-monitor.pid` |
| `spotify-dbus-monitor` | `dbus-monitor --session ...MediaPlayer2` | spotifyService (via mprisPlayerBase) | `/tmp/aln-pm-spotify-dbus-monitor.pid` |
| `bluez-dbus-monitor` | `dbus-monitor --system ...org.bluez` | bluetoothService | `/tmp/aln-pm-bluez-dbus-monitor.pid` |
| `pactl-subscribe` | `pactl subscribe` | audioRoutingService | `/tmp/aln-pm-pactl-subscribe.pid` |

**Non-ProcessMonitor processes (unchanged by this plan):**
- **pw-loopback**: Spawned on-demand by `audioRoutingService.createCombineSink()`. Orphan cleanup stays in `audioRoutingService._killStaleMonitors()`.

**Lifecycle scenarios (all must work after migration):**

| Scenario | Mechanism |
|----------|-----------|
| Clean boot | PID file not found → no-op → spawn fresh |
| SIGKILL recovery | PID file on disk → verify `/proc/PID/cmdline` → kill orphan → spawn fresh |
| Graceful shutdown | `stop()` kills process + removes PID file |
| System reset | D-Bus monitors: `stop()` removes PID → `start()` spawns fresh. VLC: ProcessMonitor NOT stopped (process preserved) |
| VLC crash mid-video | ProcessMonitor auto-restart (3s fixed delay) → 'restarted' event → D-Bus reconnect |
| Video-driven cue during playback | Unaffected — D-Bus polling layer is separate from process management |
| PID reuse after long uptime | `/proc/PID/cmdline` verification → skip kill if different command |

---

### Task 1: Commit VLC pkill process name fix

**Status:** Already implemented in working tree. Verify and commit.

**Files:**
- Modified: `backend/src/services/vlcMprisService.js:45-48,117-120`
- Modified: `backend/tests/unit/services/vlcMprisService.test.js:893`

**Step 1: Verify the changes are in place**

In `vlcMprisService.js`, confirm both pkill calls use `'vlc'` not `'cvlc'`:
- Line 47: `try { execFileSync('pkill', ['-x', 'vlc']); } catch { /* none running */ }`
- Line 120: `try { execFileSync('pkill', ['-x', 'vlc']); } catch { /* none running */ }`

In the test file, confirm:
- `expect(execFileSync).toHaveBeenCalledWith('pkill', ['-x', 'vlc']);`

**Step 2: Run tests**

Run: `cd backend && npx jest tests/unit/services/vlcMprisService.test.js --no-coverage`

Expected: ALL PASS (75 tests)

**Step 3: Commit**

```bash
cd backend
git add src/services/vlcMprisService.js tests/unit/services/vlcMprisService.test.js
git commit -m "fix: pkill -x vlc instead of cvlc (cvlc is a shell script that exec's vlc)"
```

**Note:** Both pkill call sites are removed in Task 6 when VLC migrates to ProcessMonitor. This commit is a safe rollback point if the migration needs reverting.

---

### Task 2: Commit VLC restart timer fix

**Status:** Already implemented in working tree. Verify and commit.

**Files:**
- Modified: `backend/src/services/vlcMprisService.js:524-530`
- Modified: `backend/tests/unit/services/vlcMprisService.test.js` (new test in reset block)

**Step 1: Verify the changes are in place**

In `vlcMprisService.js`, confirm `reset()` starts with timer clearing before `super.reset()`.

In the test file, confirm the "should clear pending VLC restart timer" test exists.

**Step 2: Run tests**

Run: `cd backend && npx jest tests/unit/services/vlcMprisService.test.js --no-coverage`

Expected: ALL PASS (75 tests)

**Step 3: Commit**

```bash
cd backend
git add src/services/vlcMprisService.js tests/unit/services/vlcMprisService.test.js
git commit -m "fix: clear VLC restart timer in reset() to prevent orphaned spawn after system reset"
```

**Note:** `_vlcRestartTimer` is removed in Task 6 (ProcessMonitor handles restart timers internally). This commit is a safe rollback point.

---

### Task 3: Revert `cleanupOrphanedProcesses()` from app.js

**Rationale:** This centralized function reaches across service boundaries — app.js knowing about VLC process names, D-Bus monitor paths. ProcessMonitor PID files (Task 5) and VLC's ProcessMonitor migration (Task 6) replace it.

**Files:**
- Modify: `backend/src/app.js`

**Step 1: Remove `cleanupOrphanedProcesses()` function and its call**

Remove the entire function definition (the block starting with `function cleanupOrphanedProcesses()`) and remove the call to it inside `initializeServices()`. The result should be:

```javascript
// Initialize services
async function initializeServices() {
  try {
    logger.info('Initializing services...');

    // Initialize persistence first
    await persistenceService.init();
```

No `cleanupOrphanedProcesses` function definition anywhere in the file, no call to it.

**Step 2: Run tests**

Run: `cd backend && npx jest --no-coverage`

Expected: ALL PASS

**Step 3: Commit**

```bash
cd backend
git add src/app.js
git commit -m "revert: remove centralized cleanupOrphanedProcesses (replaced by ProcessMonitor PID files)"
```

---

### Task 4: ProcessMonitor lifecycle enhancements

Four small changes to ProcessMonitor that are prerequisites for VLC migration. All changes to the same two files.

**Files:**
- Modify: `backend/src/utils/processMonitor.js`
- Modify: `backend/tests/unit/utils/processMonitor.test.js`

**Step 1: Write failing tests for all four enhancements**

In `backend/tests/unit/utils/processMonitor.test.js`, add these test blocks.

**4a — Custom stdio and env:**

Add after the `describe('custom configuration')` block:

```javascript
  describe('custom stdio and env', () => {
    it('should pass custom stdio to spawn', () => {
      const customMonitor = new ProcessMonitor({
        command: 'cvlc',
        args: ['--no-loop'],
        label: 'vlc',
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      customMonitor.start();

      expect(spawn).toHaveBeenCalledWith('cvlc', ['--no-loop'], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      customMonitor.stop();
    });

    it('should pass custom env to spawn', () => {
      const customMonitor = new ProcessMonitor({
        command: 'cvlc',
        args: [],
        label: 'vlc',
        env: { DISPLAY: ':0', HOME: '/tmp' },
      });
      customMonitor.start();

      expect(spawn).toHaveBeenCalledWith('cvlc', [], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { DISPLAY: ':0', HOME: '/tmp' },
      });
      customMonitor.stop();
    });

    it('should not crash when stdout is null (ignored in stdio)', () => {
      const nullStdoutProc = new EventEmitter();
      nullStdoutProc.stdout = null;
      nullStdoutProc.stderr = new EventEmitter();
      nullStdoutProc.kill = jest.fn();
      nullStdoutProc.pid = 88888;
      spawn.mockReturnValueOnce(nullStdoutProc);

      const customMonitor = new ProcessMonitor({
        command: 'cvlc',
        args: [],
        label: 'vlc',
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      expect(() => customMonitor.start()).not.toThrow();
      customMonitor.stop();
    });
  });
```

**4b — stderr counts toward receivedData:**

Add after the `describe('stderr logging')` block:

```javascript
  describe('stderr receivedData', () => {
    it('should reset failure count when only stderr received (not stdout)', () => {
      monitor.start();

      // Emit stderr data (not stdout) — process ran successfully
      mockProc.stderr.emit('data', Buffer.from('some output\n'));

      // Process exits — should be treated as normal exit (failures reset)
      spawn.mockClear();
      const newProc = createMockSpawnProc();
      spawn.mockReturnValue(newProc);
      mockProc.emit('close', 0);

      // Restart delay should be base delay (5000ms * 2^0 = 5000ms), not backoff
      jest.advanceTimersByTime(5000);
      expect(spawn).toHaveBeenCalledTimes(1);
    });
  });
```

**4c — 'exited' event and 'restarted' emit order:**

Add after the `describe('orphan prevention')` block:

```javascript
  describe('exited event', () => {
    it('should emit exited with code and signal when process dies', () => {
      monitor.start();
      const events = [];
      monitor.on('exited', (data) => events.push(data));

      mockProc.emit('close', 1, 'SIGTERM');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ code: 1, signal: 'SIGTERM' });
    });

    it('should emit exited even when stopped (intentional kill)', () => {
      monitor.start();
      const events = [];
      monitor.on('exited', (data) => events.push(data));

      monitor.stop();
      mockProc.emit('close', null, 'SIGTERM');

      expect(events).toHaveLength(1);
    });
  });

  describe('restarted event ordering', () => {
    it('should emit restarted AFTER process is spawned (not before)', () => {
      monitor.start();
      let procWasRunningWhenRestarted = false;

      monitor.on('restarted', () => {
        procWasRunningWhenRestarted = monitor.isRunning();
      });

      const newProc = createMockSpawnProc();
      spawn.mockReturnValue(newProc);
      mockProc.emit('close', 1);
      jest.advanceTimersByTime(10000);

      expect(procWasRunningWhenRestarted).toBe(true);
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/utils/processMonitor.test.js --no-coverage`

Expected: FAIL — ProcessMonitor doesn't accept `stdio`/`env`, doesn't count stderr toward receivedData, doesn't emit 'exited', emits 'restarted' before start().

**Step 3: Implement all four enhancements**

In `backend/src/utils/processMonitor.js`:

**Constructor** — add `stdio`, `env` options:

```javascript
  constructor({ command, args, label, pidFile, stdio, env, maxFailures, restartDelay, backoffMultiplier }) {
    super();
    this._command = command;
    this._args = args;
    this._label = label;
    this._pidFile = pidFile || null;
    this._stdio = stdio || null;
    this._env = env || undefined;
    this._maxFailures = maxFailures ?? DEFAULTS.maxFailures;
    this._restartDelay = restartDelay ?? DEFAULTS.restartDelay;
    this._backoffMultiplier = backoffMultiplier ?? DEFAULTS.backoffMultiplier;

    this._proc = null;
    this._restartTimer = null;
    this._failures = 0;
    this._stopped = false;
    this._processExitHandler = null;
  }
```

**start() method** — use custom stdio/env, guard null stdout/stderr, add receivedData to stderr, emit 'exited', fix 'restarted' order:

```javascript
  start() {
    if (this._proc) return;

    this._stopped = false;

    // Clean up previous exit handler if any (from restart — prevents listener accumulation)
    if (this._processExitHandler) {
      process.removeListener('exit', this._processExitHandler);
    }

    this._proc = spawn(this._command, this._args, {
      stdio: this._stdio || ['ignore', 'pipe', 'pipe'],
      ...(this._env && { env: this._env }),
    });
    logger.info(`${this._label} monitor started`, { pid: this._proc.pid });

    // Orphan prevention: kill child on parent exit (e.g., PM2 restart)
    this._processExitHandler = () => {
      if (this._proc) this._proc.kill();
    };
    process.on('exit', this._processExitHandler);

    let buffer = '';
    let receivedData = false;

    if (this._proc.stdout) {
      this._proc.stdout.on('data', (data) => {
        if (this._stopped) return;
        receivedData = true;
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            this.emit('line', line);
          }
        }
      });
    }

    if (this._proc.stderr) {
      this._proc.stderr.on('data', (data) => {
        receivedData = true;
        logger.debug(`${this._label} stderr`, { data: data.toString() });
      });
    }

    this._proc.on('close', (code, signal) => {
      this._proc = null;

      this.emit('exited', { code, signal });

      if (this._stopped) return;

      if (receivedData) {
        this._failures = 0;
        logger.info(`${this._label} exited normally, restarting`, { exitCode: code });
      } else {
        this._failures++;
        if (this._failures >= this._maxFailures) {
          logger.error(`${this._label} failed ${this._failures} times, giving up`);
          this.emit('gave-up', { failures: this._failures });
          return;
        }
        logger.warn(`${this._label} exited`, { exitCode: code, failures: this._failures });
      }

      const delay = this._restartDelay * Math.pow(this._backoffMultiplier, this._failures);
      this._restartTimer = setTimeout(() => {
        this._restartTimer = null;
        logger.info(`Restarting ${this._label}`, { delay });
        this.start();
        this.emit('restarted', { attempt: this._failures || 1, delay });
      }, delay);
    });
  }
```

Update the JSDoc:

```javascript
  /**
   * @param {Object} options
   * @param {string} options.command - Command to spawn
   * @param {string[]} options.args - Arguments for the command
   * @param {string} options.label - Label for logging
   * @param {string} [options.pidFile] - Path to PID file for orphan recovery after SIGKILL
   * @param {string[]} [options.stdio] - stdio config for spawn (default: ['ignore', 'pipe', 'pipe'])
   * @param {Object} [options.env] - Environment variables for spawn (default: inherit parent)
   * @param {number} [options.maxFailures=5] - Max consecutive failures before giving up
   * @param {number} [options.restartDelay=5000] - Base restart delay (ms)
   * @param {number} [options.backoffMultiplier=2] - Backoff multiplier
   */
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/utils/processMonitor.test.js --no-coverage`

Expected: ALL PASS

**Step 5: Run full unit suite**

Run: `cd backend && npx jest --no-coverage`

Expected: ALL PASS

**Step 6: Commit**

```bash
cd backend
git add src/utils/processMonitor.js tests/unit/utils/processMonitor.test.js
git commit -m "feat: ProcessMonitor lifecycle enhancements (stdio, env, stderr heuristic, exited event)"
```

---

### Task 5: Add PID-file orphan recovery to ProcessMonitor

**Files:**
- Modify: `backend/src/utils/processMonitor.js`
- Modify: `backend/tests/unit/utils/processMonitor.test.js`

**Step 1: Write failing tests**

At the top of `backend/tests/unit/utils/processMonitor.test.js`, add `fs` mock after the existing `child_process` mock:

```javascript
jest.mock('fs');
const fs = require('fs');
```

In the existing top-level `beforeEach` block (after `spawn.mockReturnValue(mockProc)`), add a default `fs` mock so that `_killOrphan()` in every `monitor.start()` call explicitly hits the "no PID file" path instead of relying on automock returning `undefined` (which would cause a TypeError that's silently swallowed):

```javascript
    // Default: no PID file exists (clean boot). Overridden in orphan recovery tests.
    fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    fs.writeFileSync.mockImplementation(() => {});
    fs.unlinkSync.mockImplementation(() => {});
```

Add a `describe('orphan recovery (PID files)')` block after the `describe('exited event')` block:

```javascript
  describe('orphan recovery (PID files)', () => {
    let pidMonitor;

    beforeEach(() => {
      pidMonitor = new ProcessMonitor({
        command: 'dbus-monitor',
        args: ['--session', '--monitor'],
        label: 'test-monitor',
        pidFile: '/tmp/aln-pm-test-monitor.pid',
      });
    });

    afterEach(() => {
      pidMonitor.stop();
    });

    it('should kill orphaned process found in PID file on start', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === '/tmp/aln-pm-test-monitor.pid') return '12345';
        if (filePath === '/proc/12345/cmdline') return 'dbus-monitor\0--session\0--monitor';
        throw new Error('ENOENT');
      });

      pidMonitor.start();

      expect(killSpy).toHaveBeenCalledWith(12345, 'SIGTERM');
      killSpy.mockRestore();
    });

    it('should NOT kill process if PID was reused by different command', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === '/tmp/aln-pm-test-monitor.pid') return '12345';
        if (filePath === '/proc/12345/cmdline') return 'node\0src/server.js';
        throw new Error('ENOENT');
      });

      pidMonitor.start();

      expect(killSpy).not.toHaveBeenCalledWith(12345, expect.anything());
      killSpy.mockRestore();
    });

    it('should handle missing PID file gracefully (clean boot)', () => {
      fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      expect(() => pidMonitor.start()).not.toThrow();
      expect(spawn).toHaveBeenCalled();
    });

    it('should handle dead process gracefully (ESRCH)', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === '/tmp/aln-pm-test-monitor.pid') return '12345';
        if (filePath === '/proc/12345/cmdline') return 'dbus-monitor\0--session\0--monitor';
        throw new Error('ENOENT');
      });

      expect(() => pidMonitor.start()).not.toThrow();
      expect(spawn).toHaveBeenCalled();
      killSpy.mockRestore();
    });

    it('should write PID file after spawn', () => {
      fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      pidMonitor.start();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/aln-pm-test-monitor.pid',
        String(mockProc.pid)
      );
    });

    it('should remove PID file on stop', () => {
      fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      pidMonitor.start();
      pidMonitor.stop();

      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/aln-pm-test-monitor.pid');
    });

    it('should NOT write PID file when pidFile option is omitted', () => {
      fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      monitor.start();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/utils/processMonitor.test.js --no-coverage`

Expected: FAIL — ProcessMonitor doesn't read/write PID files or kill orphans.

**Step 3: Implement PID file support**

In `backend/src/utils/processMonitor.js`, add `fs` require at the top:

```javascript
const fs = require('fs');
```

Add three methods before `isRunning()`:

```javascript
  /**
   * Kill an orphaned process from a previous server instance.
   * Reads PID file, verifies /proc/PID/cmdline matches our command
   * (guards against PID reuse), sends SIGTERM if confirmed.
   */
  _killOrphan() {
    if (!this._pidFile) return;
    try {
      const pid = parseInt(fs.readFileSync(this._pidFile, 'utf8').trim(), 10);
      if (isNaN(pid)) return;
      const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ');
      if (!cmdline.includes(this._command)) return;
      process.kill(pid, 'SIGTERM');
      logger.info(`${this._label}: killed orphan process`, { pid });
    } catch {
      // PID file missing, process already dead, or PID reused — all expected
    }
  }

  /** Write child PID to file for orphan recovery on next boot. */
  _writePidFile() {
    if (!this._pidFile || !this._proc) return;
    try {
      fs.writeFileSync(this._pidFile, String(this._proc.pid));
    } catch (err) {
      logger.debug(`${this._label}: failed to write PID file`, { error: err.message });
    }
  }

  /** Remove PID file (process was stopped cleanly). */
  _removePidFile() {
    if (!this._pidFile) return;
    try {
      fs.unlinkSync(this._pidFile);
    } catch {
      // File doesn't exist or already cleaned up
    }
  }
```

In `start()`, add `_killOrphan()` after the `_stopped = false` line (before exit handler cleanup), and add `_writePidFile()` after the spawn:

```javascript
    this._stopped = false;

    // Kill orphaned instance from previous crash (PID file tracking)
    this._killOrphan();

    // Clean up previous exit handler...
```

```javascript
    this._proc = spawn(this._command, this._args, {
      stdio: this._stdio || ['ignore', 'pipe', 'pipe'],
      ...(this._env && { env: this._env }),
    });
    logger.info(`${this._label} monitor started`, { pid: this._proc.pid });

    // Write PID file for orphan recovery on next boot
    this._writePidFile();

    // Orphan prevention: kill child on parent exit...
```

In `stop()`, add `_removePidFile()` after killing the process:

```javascript
    if (this._proc) {
      this._proc.kill();
      this._proc = null;
    }
    this._removePidFile();
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/utils/processMonitor.test.js --no-coverage`

Expected: ALL PASS

**Step 5: Run full unit suite**

Run: `cd backend && npx jest --no-coverage`

Expected: ALL PASS

**Step 6: Commit**

```bash
cd backend
git add src/utils/processMonitor.js tests/unit/utils/processMonitor.test.js
git commit -m "feat: add PID-file orphan recovery to ProcessMonitor for SIGKILL survival"
```

---

### Task 6: Migrate VLC process management to ProcessMonitor

This is the largest task. It replaces `_spawnVlcProcess()`, `_stopVlcProcess()`, and associated timer/flag/handler code with a ProcessMonitor instance.

**Files:**
- Modify: `backend/src/services/vlcMprisService.js`
- Modify: `backend/tests/unit/services/vlcMprisService.test.js`

**What gets removed:**
- `_spawnVlcProcess()` method (lines 36-93) — replaced by ProcessMonitor
- `_stopVlcProcess()` method (lines 98-120) — replaced by ProcessMonitor.stop()
- `_vlcRestartTimer` property — replaced by ProcessMonitor internal timer
- `_vlcStopped` flag — replaced by ProcessMonitor._stopped
- `_processExitHandler` property — replaced by ProcessMonitor orphan prevention
- Both `pkill -x vlc` calls — replaced by PID file orphan recovery
- `const { spawn, execFileSync } = require('child_process')` import — `spawn` no longer needed; `execFileSync` kept for audit logging only

**What stays unchanged:**
- `_buildVlcArgs()`, `_getHwAccelArgs()` — still builds args, passed to ProcessMonitor
- `_waitForVlcReady()` — still polls D-Bus after spawn
- `_resolveOwner()` — still resolves D-Bus owner name
- `playVideo()`, `stop()`, `pause()`, `resume()`, `getStatus()` — all D-Bus layer, untouched
- `initializeIdleLoop()`, `returnToIdleLoop()` — D-Bus layer, untouched
- D-Bus MPRIS monitor (`startPlaybackMonitor()` via mprisPlayerBase) — separate ProcessMonitor, untouched

**Step 1: Update ALL test blocks that reference removed VLC process internals**

In `backend/tests/unit/services/vlcMprisService.test.js`, **six locations** reference removed identifiers (`_spawnVlcProcess`, `_stopVlcProcess`, `_vlcRestartTimer`, `_vlcStopped`, `_vlcProc`). ALL must be updated:

| # | Block | Lines | What to do |
|---|-------|-------|------------|
| 1 | `init` describe `beforeEach` | ~80-86 | Remove `_spawnVlcProcess = jest.fn()` mock. Rewrite init tests to let init() call through to ProcessMonitor. |
| 2 | `init` describe tests | ~87-115 | Rewrite to verify ProcessMonitor is started (check spawn called with 'cvlc'). |
| 3 | `reset` describe — last test | ~821-841 | Remove "should clear pending VLC restart timer" test (timer no longer exists). |
| 4 | `_spawnVlcProcess` describe | ~846-995 | **Remove entirely** (14 tests). Replace with `VLC ProcessMonitor lifecycle` describe below. |
| 5 | `_stopVlcProcess` describe | ~999-1019 | **Remove entirely** (2 tests). Covered by cleanup test below. |
| 6 | `cleanup` describe — first test | ~1039-1048 | Rewrite to verify ProcessMonitor.stop() is called (check proc.kill via spawn mock). |
| 7 | `reset (VLC process preservation)` describe | ~1083-1096 | Rewrite to verify VLC spawn process is NOT killed on reset. |

Replace the `describe('_spawnVlcProcess', ...)` block (find it by its opening comment `// ── VLC Process Spawn ──`) and the `describe('_stopVlcProcess', ...)` block with:

```javascript
  // ── VLC Process Lifecycle (ProcessMonitor) ──

  describe('VLC ProcessMonitor lifecycle', () => {
    it('should create VLC ProcessMonitor with correct options in init()', async () => {
      mockExecFileSuccess(''); // for checkConnection and resolveOwner
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);

      await vlcMprisService.init();

      // ProcessMonitor spawns cvlc
      expect(spawn).toHaveBeenCalledWith(
        'cvlc',
        expect.arrayContaining(['--no-loop', '-A', 'pulse', '--fullscreen']),
        expect.objectContaining({
          stdio: ['ignore', 'ignore', 'pipe'],
          env: expect.objectContaining({ DISPLAY: expect.any(String) }),
        })
      );
    });

    it('should clear ownerBusName and report health down on VLC exit', async () => {
      mockExecFileSuccess('');
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      await vlcMprisService.init();

      vlcMprisService._ownerBusName = ':1.42';
      registry.report('vlc', 'healthy');

      // Find the VLC process (not the dbus-monitor)
      const vlcSpawnCall = spawn.mock.calls.find(c => c[0] === 'cvlc');
      const vlcSpawnIndex = spawn.mock.calls.indexOf(vlcSpawnCall);
      const vlcProc = spawn.mock.results[vlcSpawnIndex].value;

      vlcProc.emit('close', 1, 'SIGTERM');

      expect(vlcMprisService._ownerBusName).toBeNull();
      expect(registry.isHealthy('vlc')).toBe(false);
    });

    it('should stop VLC ProcessMonitor on cleanup', async () => {
      mockExecFileSuccess('');
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      await vlcMprisService.init();

      const vlcSpawnCall = spawn.mock.calls.find(c => c[0] === 'cvlc');
      const vlcSpawnIndex = spawn.mock.calls.indexOf(vlcSpawnCall);
      const vlcProc = spawn.mock.results[vlcSpawnIndex].value;

      vlcMprisService.cleanup();

      expect(vlcProc.kill).toHaveBeenCalled();
    });

    it('should NOT stop VLC ProcessMonitor on reset (process preserved)', async () => {
      mockExecFileSuccess('');
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      await vlcMprisService.init();

      const vlcSpawnCall = spawn.mock.calls.find(c => c[0] === 'cvlc');
      const vlcSpawnIndex = spawn.mock.calls.indexOf(vlcSpawnCall);
      const vlcProc = spawn.mock.results[vlcSpawnIndex].value;

      vlcMprisService.reset();

      // VLC process should NOT be killed
      expect(vlcProc.kill).not.toHaveBeenCalled();
    });
  });
```

Also remove or update any tests in the existing file that reference `_spawnVlcProcess`, `_stopVlcProcess`, `_vlcRestartTimer`, or `_vlcStopped` directly. Search the test file for these references and update accordingly. The "should kill stale VLC before spawning" test and "should clear pending VLC restart timer" test from Tasks 1-2 should be removed (those code paths no longer exist).

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/services/vlcMprisService.test.js --no-coverage`

Expected: FAIL — vlcMprisService still uses custom spawn code, init() still calls _spawnVlcProcess().

**Step 3: Implement VLC ProcessMonitor migration**

In `backend/src/services/vlcMprisService.js`:

**Update imports** (line 6):
```javascript
const { execFileSync } = require('child_process');
const ProcessMonitor = require('../utils/processMonitor');
```

Remove `spawn` from the import (no longer needed).

**Update constructor** — remove VLC process properties, add ProcessMonitor reference:
```javascript
  constructor() {
    super({
      destination: 'org.mpris.MediaPlayer2.vlc',
      label: 'VLC',
      healthServiceId: 'vlc',
      signalDebounceMs: 100,
    });
    this._previousDelta = null;
    this._loopEnabled = false;
    this._rawVolume = 1.0;
    this._vlcProcessMonitor = null;
  }
```

Remove: `_vlcProc`, `_vlcRestartTimer`, `_vlcStopped`, `_processExitHandler`.

**Remove `_spawnVlcProcess()` entirely** (the method starting at line 36).

**Remove `_stopVlcProcess()` entirely** (the method starting at line 98).

**Rewrite `init()`:**
```javascript
  async init() {
    logger.info('[VLC] Initializing MPRIS service');

    // Audit: log any existing VLC processes (helps diagnose leaks in production)
    try {
      const result = execFileSync('pgrep', ['-a', 'vlc']);
      const procs = result.toString().trim();
      if (procs) {
        logger.warn('[VLC] Existing VLC processes found at init', { processes: procs });
      }
    } catch { /* none running — clean state */ }

    // Create VLC ProcessMonitor
    this._vlcProcessMonitor = new ProcessMonitor({
      command: 'cvlc',
      args: this._buildVlcArgs(),
      label: 'VLC',
      pidFile: '/tmp/aln-pm-vlc.pid',
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' },
      restartDelay: 3000,
      backoffMultiplier: 1,   // Fixed 3s delay (no exponential backoff)
    });

    // State cleanup on VLC exit (crash or intentional stop)
    this._vlcProcessMonitor.on('exited', ({ code, signal }) => {
      logger.warn('[VLC] Process exited', { code, signal });
      this._ownerBusName = null;
      this._setConnected(false);
    });

    // Post-restart: wait for D-Bus registration, re-resolve owner
    this._vlcProcessMonitor.on('restarted', async () => {
      const ready = await this._waitForVlcReady();
      if (ready) {
        this._resolveOwner().catch(err => {
          logger.debug('[VLC] Owner re-resolution failed after crash restart:', err.message);
        });
      }
    });

    this._vlcProcessMonitor.start();

    // Wait for VLC to register on D-Bus
    const ready = await this._waitForVlcReady();
    if (ready) {
      logger.info('[VLC] D-Bus connection established');
    } else {
      logger.warn('[VLC] Not ready after spawn (D-Bus monitor will detect when available)');
    }

    // Start D-Bus monitor regardless — catches state changes
    this.startPlaybackMonitor();

    // Resolve unique bus name for D-Bus signal sender filtering
    await this._resolveOwner();
  }
```

**Rewrite `reset()`:**
```javascript
  reset() {
    super.reset(); // stops D-Bus monitor, reports health down, resets state
    this._previousDelta = null;
    this._loopEnabled = false;
    this._rawVolume = 1.0;
    // VLC ProcessMonitor intentionally NOT stopped (process preserved, same as Spotify's spotifyd)
  }
```

**Rewrite `cleanup()`:**
```javascript
  cleanup() {
    if (this._vlcProcessMonitor) {
      this._vlcProcessMonitor.stop();
      this._vlcProcessMonitor.removeAllListeners();
      this._vlcProcessMonitor = null;
    }
    super.cleanup();
  }
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/vlcMprisService.test.js --no-coverage`

Expected: ALL PASS. Some tests may need adjustment for the new init() flow. Fix any failures iteratively — the key behaviors to verify are: spawn with correct args, exited clears state, cleanup stops process, reset preserves process.

**Step 5: Run full unit suite**

Run: `cd backend && npx jest --no-coverage`

Expected: ALL PASS

**Step 6: Commit**

```bash
cd backend
git add src/services/vlcMprisService.js tests/unit/services/vlcMprisService.test.js
git commit -m "feat: migrate VLC process management to ProcessMonitor

Replaces custom _spawnVlcProcess/_stopVlcProcess with ProcessMonitor.
VLC gets automatic PID-file orphan recovery, self-healing restart,
and consistent lifecycle management alongside D-Bus monitors.

The D-Bus MPRIS communication layer (playback, cue timelines, state
events) is entirely separate and unaffected by this change."
```

---

### Task 7: Wire PID files into all other ProcessMonitor consumers

**Files:**
- Modify: `backend/src/services/mprisPlayerBase.js:215-219`
- Modify: `backend/src/services/bluetoothService.js:450-454`
- Modify: `backend/src/services/audioRoutingService.js:1073-1077`

**Step 1: Add `pidFile` to mprisPlayerBase's ProcessMonitor**

In `backend/src/services/mprisPlayerBase.js`, in `startPlaybackMonitor()`, add `pidFile`:

```javascript
    this._playbackMonitor = new ProcessMonitor({
      command: 'dbus-monitor',
      args: ['--session', '--monitor', matchRule],
      label: `${this._label}-dbus-monitor`,
      pidFile: `/tmp/aln-pm-${this._label.toLowerCase()}-dbus-monitor.pid`,
    });
```

This produces unique PID files per service:
- VLC: `/tmp/aln-pm-vlc-dbus-monitor.pid`
- Spotify: `/tmp/aln-pm-spotify-dbus-monitor.pid`

**Step 2: Add `pidFile` to bluetoothService's ProcessMonitor**

In `backend/src/services/bluetoothService.js`, in `startDeviceMonitor()`, add `pidFile`:

```javascript
    this._deviceMonitor = new ProcessMonitor({
      command: 'dbus-monitor',
      args: ['--system', '--monitor', matchRule],
      label: 'bluez-dbus-monitor',
      pidFile: '/tmp/aln-pm-bluez-dbus-monitor.pid',
    });
```

**Step 3: Add `pidFile` to audioRoutingService's ProcessMonitor**

In `backend/src/services/audioRoutingService.js`, in `startSinkMonitor()`, add `pidFile`:

```javascript
    this._sinkMonitor = new ProcessMonitor({
      command: 'pactl',
      args: ['subscribe'],
      label: 'pactl-subscribe',
      pidFile: '/tmp/aln-pm-pactl-subscribe.pid',
    });
```

**Step 4: Run tests**

Run: `cd backend && npx jest --no-coverage`

Expected: ALL PASS. PID file operations in tests will either hit real `/tmp/` (harmless) or fail silently (caught). If any tests break from unexpected `fs` calls, add `jest.mock('fs')` to that test file.

**Step 5: Commit**

```bash
cd backend
git add src/services/mprisPlayerBase.js src/services/bluetoothService.js src/services/audioRoutingService.js
git commit -m "feat: wire PID files into all ProcessMonitor consumers for orphan recovery"
```

---

### Task 8: Run full test suite

**Step 1: Run unit + contract tests**

Run: `cd backend && npm test`

Expected: ALL PASS

**Step 2: Run integration tests**

Run: `cd backend && npm run test:integration`

Expected: ALL PASS. Integration tests call `resetAllServicesForTesting()` → `performSystemReset()` which:
1. Calls `reset()` on all services (D-Bus monitors stopped, PID files removed; VLC ProcessMonitor preserved)
2. Re-inits services (D-Bus monitors restarted with fresh PID files; VLC still running)

**Step 3: Commit if any test fixes needed**

---

## Verification (manual, on the Pi)

```bash
# 1. Check PID files exist after startup
ls /tmp/aln-pm-*.pid
# Expected: vlc.pid, vlc-dbus-monitor.pid, spotify-dbus-monitor.pid,
#           bluez-dbus-monitor.pid, pactl-subscribe.pid

# 2. Verify PID file contents match running processes
for f in /tmp/aln-pm-*.pid; do
  pid=$(cat "$f")
  echo "$f → PID $pid → $(cat /proc/$pid/cmdline 2>/dev/null | tr '\0' ' ' || echo 'DEAD')"
done

# 3. Simulate SIGKILL and verify orphan recovery
kill -9 $(pgrep -f 'node.*server.js')
sleep 2
pgrep -a vlc           # Orphaned VLC still running
pgrep -a dbus-monitor  # Orphaned monitors still running
ls /tmp/aln-pm-*.pid   # PID files still on disk

# 4. Restart server — verify orphans cleaned up
npm run dev:full &
sleep 8
pgrep -a vlc           # Exactly 1 (orphan killed, fresh one spawned)
pgrep -a dbus-monitor  # Exactly 3 (orphans killed, fresh ones spawned)

# 5. Verify no accumulation: repeat steps 3-4
```

## Impact Summary

| File | Change | Why |
|------|--------|-----|
| `src/utils/processMonitor.js` | Add `pidFile`, `stdio`, `env`, stderr heuristic, `exited` event | Core: ProcessMonitor handles complete lifecycle |
| `tests/unit/utils/processMonitor.test.js` | ~15 new tests | Verify all ProcessMonitor enhancements |
| `src/services/vlcMprisService.js` | Remove custom spawn/stop/restart, add ProcessMonitor | VLC unified under ProcessMonitor |
| `tests/unit/services/vlcMprisService.test.js` | Rewrite spawn/stop tests for ProcessMonitor | Test new VLC lifecycle |
| `src/services/mprisPlayerBase.js` | Add `pidFile` to ProcessMonitor constructor | Wire MPRIS D-Bus monitor PID files |
| `src/services/bluetoothService.js` | Add `pidFile` to ProcessMonitor constructor | Wire BlueZ monitor PID file |
| `src/services/audioRoutingService.js` | Add `pidFile` to ProcessMonitor constructor | Wire pactl monitor PID file |
| `src/app.js` | Remove `cleanupOrphanedProcesses()` | Replaced by ProcessMonitor PID files |

**Unchanged:**
- `systemReset.js` — VLC ProcessMonitor preserved during reset, D-Bus monitors stopped+restarted. Works without changes.
- `server.js` — calls `vlcService.cleanup()` which now calls `ProcessMonitor.stop()`. Works without changes.
- `audioRoutingService._killStaleMonitors()` — still handles `pw-loopback` orphans (not ProcessMonitor-managed).
- `videoQueueService.js` — video playback, progress monitoring, cue timeline chain all use D-Bus MPRIS layer. Unaffected.
- `cueEngineService.js` — video-driven cue timelines receive `video:progress` from videoQueueService. Unaffected.
- `displayControlService.js` — pre-play hooks and idle loop management use D-Bus layer. Unaffected.
