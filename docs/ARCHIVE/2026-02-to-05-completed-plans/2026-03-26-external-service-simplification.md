# External Service Simplification Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate unnecessary complexity in the backend's interaction with external processes (VLC, Chromium, Spotify, PulseAudio), fixing the root causes of the 0321game session failures: frozen scoreboard, invisible video, audio routing failures, and Spotify control failures.

**Architecture:** Replace process kill/spawn with persistent processes + window management for the display layer. Replace polling with reactive event consumption for VLC status and PulseAudio sink-inputs. Fix race conditions, duplicate event handlers, and error observability across the entire external service interaction layer.

**Tech Stack:** Node.js, xdotool + wmctrl (new dependencies), D-Bus MPRIS, PulseAudio/PipeWire, winston

**Verified on Pi (2026-03-26):** `xdotool windowunmap/windowmap` does NOT preserve kiosk fullscreen (window comes back 1024x704). The correct approach is `xdotool windowminimize` to hide, `xdotool windowactivate` + `wmctrl -b add,fullscreen` to restore (verified: 0,0 1920x1080). Window search must use `xdotool search --class chromium` (not `--pid` — Chromium forks, window belongs to child process, not spawned parent).

**Session context:** The 0321game investigation (2026-03-26) identified that Chromium was killed/spawned 38 times during a 2.5hr game. The final instance was SIGKILL'd, orphaning renderer processes that froze the HDMI display. VLC played behind the frozen scoreboard invisibly. Audio routing failed from stale sink-input IDs. Spotify health stayed stale-healthy after daemon crash. Error logs showed `"error":{}` (zero diagnostic info) for all 186 video failures.

---

## Phase 1: Error Observability (must come first)

### Task 1: Fix winston Error serialization

Without this fix, all subsequent work produces undiagnosable logs.

**Files:**
- Modify: `backend/src/utils/logger.js` (format chain, ~line 18-22)
- Test: `backend/tests/unit/utils/logger.test.js` (create if not exists)

**Step 1: Write the failing test**

```javascript
// tests/unit/utils/logger.test.js
const winston = require('winston');
const { Writable } = require('stream');

describe('Logger Error Serialization', () => {
  test('Error objects in metadata are serialized with message and stack', (done) => {
    // Create a test logger with the same format chain as production
    const logger = require('../../src/utils/logger');

    // Capture output
    const chunks = [];
    const capture = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk.toString()); cb(); }
    });

    logger.add(new winston.transports.Stream({ stream: capture, format: winston.format.json() }));

    const testError = new Error('test failure');
    logger.error('Operation failed', { error: testError, context: 'test' });

    setImmediate(() => {
      const output = JSON.parse(chunks[chunks.length - 1]);
      expect(output.metadata.error).toBeDefined();
      expect(output.metadata.error).not.toEqual({});
      expect(output.metadata.error.message).toBe('test failure');
      expect(output.metadata.error.stack).toContain('test failure');
      logger.remove(logger.transports[logger.transports.length - 1]);
      done();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/utils/logger.test.js --no-coverage`
Expected: FAIL — `output.metadata.error` equals `{}`

**Step 3: Write minimal implementation**

Add a custom format to `logger.js` that walks metadata and serializes Error instances. Insert BEFORE `winston.format.json()` and AFTER `winston.format.metadata()`:

```javascript
// In logger.js, add this format function before the logger creation:
const serializeErrors = winston.format((info) => {
  if (info.metadata && typeof info.metadata === 'object') {
    for (const [key, val] of Object.entries(info.metadata)) {
      if (val instanceof Error) {
        info.metadata[key] = { message: val.message, stack: val.stack, name: val.name };
      }
      // Also check one level deeper (metadata.metadata from winston's metadata format)
      if (val && typeof val === 'object' && !(val instanceof Error)) {
        for (const [k2, v2] of Object.entries(val)) {
          if (v2 instanceof Error) {
            val[k2] = { message: v2.message, stack: v2.stack, name: v2.name };
          }
        }
      }
    }
  }
  return info;
});

// Then in logFormat:
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  serializeErrors()  // <-- ADD THIS
);
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/utils/logger.test.js --no-coverage`
Expected: PASS

**Step 5: Run full unit tests to verify no regressions**

Run: `cd backend && npm test`
Expected: All existing tests pass

**Step 6: Commit**

```bash
git add backend/src/utils/logger.js backend/tests/unit/utils/logger.test.js
git commit -m "fix: serialize Error objects in winston metadata — fixes blind error:{} logging"
```

---

## Phase 2: Display Layer — Window Management

### Task 2: Install xdotool + wmctrl

Both are already installed on the Pi as of 2026-03-26. Document the dependency.

**Step 1: Verify installation**

Run: `xdotool --version && wmctrl --version`

**Step 2: Document in DEPLOYMENT_GUIDE.md**

Add to system dependencies section:

```bash
sudo apt-get install -y xdotool wmctrl
```

**Step 3: Commit**

```bash
git add DEPLOYMENT_GUIDE.md
git commit -m "docs: add xdotool + wmctrl as system dependencies for display management"
```

---

### Task 3: Rewrite displayDriver.js — persistent Chromium, window show/hide

This is the core display fix. Chromium launches once and is shown/hidden via `xdotool windowmap/windowunmap` instead of killed/spawned.

**Files:**
- Modify: `backend/src/utils/displayDriver.js` (full rewrite)
- Test: `backend/tests/unit/utils/displayDriver.test.js` (create)

**Step 1: Write failing tests**

```javascript
// tests/unit/utils/displayDriver.test.js
const { execFile } = require('child_process');
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execFile: jest.fn(),
}));

// Reset module between tests
let displayDriver;
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  displayDriver = require('../../src/utils/displayDriver');
});

describe('displayDriver — window management', () => {
  test('showScoreboard launches Chromium on first call', async () => {
    const { spawn } = require('child_process');
    const mockProc = { pid: 1234, on: jest.fn(), killed: false };
    spawn.mockReturnValue(mockProc);
    // Mock xdotool search to return window ID after spawn
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (!cb && typeof opts === 'function') { cb = opts; opts = {}; }
      if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
      else cb(null, '', '');
    });

    await displayDriver.showScoreboard();
    expect(spawn).toHaveBeenCalledWith('chromium-browser', expect.any(Array), expect.any(Object));
  });

  test('showScoreboard does NOT relaunch Chromium on subsequent calls', async () => {
    const { spawn } = require('child_process');
    const mockProc = { pid: 1234, on: jest.fn(), killed: false };
    spawn.mockReturnValue(mockProc);
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (!cb && typeof opts === 'function') { cb = opts; opts = {}; }
      if (cmd === 'xdotool') cb(null, '12345678\n', '');
      else cb(null, '', '');
    });

    await displayDriver.showScoreboard();
    await displayDriver.showScoreboard();
    expect(spawn).toHaveBeenCalledTimes(1); // Only once!
  });

  test('hideScoreboard uses xdotool windowunmap, does NOT kill process', async () => {
    const { spawn } = require('child_process');
    const mockProc = { pid: 1234, on: jest.fn(), killed: false, kill: jest.fn() };
    spawn.mockReturnValue(mockProc);
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (!cb && typeof opts === 'function') { cb = opts; opts = {}; }
      cb(null, '12345678\n', '');
    });

    await displayDriver.showScoreboard();
    await displayDriver.hideScoreboard();

    expect(mockProc.kill).not.toHaveBeenCalled();
    // Should have called xdotool windowunmap
    expect(execFile).toHaveBeenCalledWith(
      'xdotool', expect.arrayContaining(['windowunmap']),
      expect.any(Object), expect.any(Function)
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/utils/displayDriver.test.js --no-coverage`
Expected: FAIL

**Step 3: Implement the rewrite**

Replace `displayDriver.js` contents. Key changes:
- `showScoreboard()`: if Chromium isn't running, spawn it and wait for window ID via `xdotool search --name`. If already running, `xdotool windowmap` + `xdotool windowraise` the stored window ID.
- `hideScoreboard()`: `xdotool windowunmap` the stored window ID. Do NOT kill the process.
- `cleanup()`: kill the process (shutdown only).
- `isScoreboardVisible()`: check window map state, not process liveness.
- Use `execFile` (not `exec`) for all xdotool calls (no shell injection).
- Store `windowId` alongside `browserProcess`.
- If xdotool can't find the window (Chromium crashed), set `browserProcess = null` so next `showScoreboard` respawns.

```javascript
const { spawn, execFile } = require('child_process');
const os = require('os');
const logger = require('./logger');

let browserProcess = null;
let windowId = null;  // X11 window ID (string)
let visible = false;

const DISPLAY = process.env.DISPLAY || ':0';
const ENV = { ...process.env, DISPLAY };
const SCOREBOARD_URL = `https://${getLocalIP()}:${process.env.PORT || 3000}/scoreboard?kiosk=true`;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') return iface.address;
    }
  }
  return 'localhost';
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { env: ENV, timeout: 5000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

// Chromium forks — window belongs to child process, not spawned parent.
// Must search by class, not PID.
async function findWindowId(retries = 10, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const ids = await run('xdotool', ['search', '--class', 'chromium']);
      if (ids) {
        // Return the main content window (largest, usually the last one)
        const idList = ids.split('\n').filter(Boolean);
        if (idList.length > 0) return idList[idList.length - 1];
      }
    } catch { /* not found yet */ }
    if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}

async function ensureBrowserRunning() {
  if (browserProcess && !browserProcess.killed) return true;

  logger.info('[DisplayDriver] Launching persistent scoreboard kiosk', { url: SCOREBOARD_URL });
  browserProcess = spawn('chromium-browser', [
    '--kiosk', '--noerrdialogs', '--disable-infobars',
    '--disable-session-crashed-bubble', '--ignore-certificate-errors',
    '--password-store=basic', '--disable-background-networking',
    '--disable-sync', '--disable-features=TranslateUI',
    '--check-for-update-interval=31536000', '--no-first-run',
    '--disable-default-apps', '--autoplay-policy=no-user-gesture-required',
    SCOREBOARD_URL
  ], { env: ENV, detached: false, stdio: 'ignore' });

  browserProcess.on('error', (error) => {
    logger.error('[DisplayDriver] Browser process error', { error: error.message });
    browserProcess = null;
    windowId = null;
  });

  browserProcess.on('exit', (code, signal) => {
    logger.warn('[DisplayDriver] Browser process exited', { code, signal });
    browserProcess = null;
    windowId = null;
    visible = false;
  });

  windowId = await findWindowId();
  if (!windowId) {
    logger.error('[DisplayDriver] Could not find Chromium window after launch');
    return false;
  }

  logger.info('[DisplayDriver] Scoreboard window found', { pid: browserProcess?.pid, windowId });
  return true;
}

async function showScoreboard() {
  const running = await ensureBrowserRunning();
  if (!running) return false;

  try {
    // Activate window, then force fullscreen via wmctrl (verified on Pi: 0,0 1920x1080)
    await run('xdotool', ['windowactivate', '--sync', windowId]);
    await run('wmctrl', ['-i', '-r', windowId, '-b', 'add,fullscreen']);
    visible = true;
    logger.info('[DisplayDriver] Scoreboard shown (fullscreen)', { windowId });
    return true;
  } catch (error) {
    logger.error('[DisplayDriver] Failed to show scoreboard', { error: error.message });
    windowId = null;
    browserProcess = null;
    return false;
  }
}

async function hideScoreboard() {
  if (!windowId) {
    visible = false;
    return true;
  }

  try {
    // Minimize hides the window without destroying fullscreen state
    await run('xdotool', ['windowminimize', windowId]);
    visible = false;
    logger.info('[DisplayDriver] Scoreboard minimized', { windowId });
    return true;
  } catch (error) {
    logger.error('[DisplayDriver] Failed to hide scoreboard', { error: error.message });
    visible = false;
    return true; // Non-fatal — VLC renders underneath
  }
}

function isScoreboardVisible() {
  return visible && windowId !== null;
}

function getStatus() {
  return {
    scoreboardVisible: isScoreboardVisible(),
    browserPid: browserProcess?.pid || null,
    windowId,
    display: DISPLAY,
    scoreboardUrl: SCOREBOARD_URL
  };
}

async function cleanup() {
  if (browserProcess && !browserProcess.killed) {
    browserProcess.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 1000));
    if (browserProcess && !browserProcess.killed) browserProcess.kill('SIGKILL');
  }
  browserProcess = null;
  windowId = null;
  visible = false;
}

module.exports = { showScoreboard, hideScoreboard, isScoreboardVisible, getStatus, cleanup };
```

**Step 4: Run unit tests**

Run: `cd backend && npx jest tests/unit/utils/displayDriver.test.js --no-coverage`
Expected: PASS

**Step 5: Run displayControlService tests to verify no regression**

Run: `cd backend && npx jest tests/unit/services/displayControlService.test.js --no-coverage`
Expected: PASS (displayControlService interface is unchanged)

**Step 6: Commit**

```bash
git add backend/src/utils/displayDriver.js backend/tests/unit/utils/displayDriver.test.js
git commit -m "refactor: displayDriver uses window management instead of kill/spawn"
```

---

### Task 4: Fix clearQueue unconditional video:idle emission

`clearQueue()` always emits `video:idle`, which triggers `_handleVideoComplete()` → `setIdleLoop()` → VLC loads idle-loop.mp4. This happens even during session teardown or when no video was playing.

**Files:**
- Modify: `backend/src/services/videoQueueService.js` (~line 748-772)
- Test: existing `backend/tests/unit/services/videoQueueService.test.js`

**Step 1: Write failing test**

```javascript
test('clearQueue does not emit video:idle when no video was playing', () => {
  const idleSpy = jest.fn();
  videoQueueService.on('video:idle', idleSpy);
  videoQueueService.clearQueue();
  expect(idleSpy).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL — `video:idle` is emitted unconditionally

**Step 3: Fix**

In `clearQueue()`, only emit `video:idle` if there was actually a currentItem or pending items:

```javascript
clearQueue() {
  if (this.playbackTimer) { clearTimeout(this.playbackTimer); this.playbackTimer = null; }
  if (this.progressTimer) { clearInterval(this.progressTimer); this.progressTimer = null; }

  const wasPlaying = this.currentItem !== null;
  const hadPending = this.queue.some(item => item.isPending());

  if (this.currentItem) {
    this.currentItem.failPlayback('Queue cleared');
  }

  this.queue = [];
  this.currentItem = null;

  logger.info('Video queue cleared');
  this.emit('queue:reset');

  // Only emit idle if we were actually playing or had pending items
  if (wasPlaying || hadPending) {
    this.emit('video:idle');
  }
}
```

**Step 4: Run tests**

Run: `cd backend && npx jest tests/unit/services/videoQueueService.test.js --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/videoQueueService.js backend/tests/unit/services/videoQueueService.test.js
git commit -m "fix: clearQueue only emits video:idle when video was actually playing"
```

---

### Task 5: Fix scoreboard connect_error re-authentication

**Files:**
- Modify: `backend/public/scoreboard.html` (~line 1426-1429)

**Step 1: Fix the connect_error handler**

Replace the current no-op handler:

```javascript
state.socket.on('connect_error', (error) => {
    console.error('[Scoreboard] Connection error:', error.message || error);
    updateConnectionStatus('offline', 'CONN ERROR');

    // Re-authenticate immediately on auth failures
    if (error.message && (error.message.includes('AUTH_INVALID') || error.message.includes('AUTH_REQUIRED'))) {
        console.log('[Scoreboard] Auth failure detected, re-authenticating...');
        cleanupSocket();
        authenticate().then(authenticated => {
            if (authenticated) connectWebSocket();
        });
    }
});
```

**Step 2: Manual test**

Restart the backend while scoreboard is connected. Scoreboard should automatically re-authenticate and reconnect within seconds, not wait 5 minutes.

**Step 3: Commit**

```bash
git add backend/public/scoreboard.html
git commit -m "fix: scoreboard re-authenticates on connect_error instead of waiting 5min"
```

---

## Phase 3: VLC — Trust the D-Bus Monitor

### Task 6: Fix getStatus() to only query Position from D-Bus

`getStatus()` currently issues 3 dbus-send calls. PlaybackStatus and Metadata are already kept current by the D-Bus monitor. Only Position needs a live query.

**Files:**
- Modify: `backend/src/services/vlcMprisService.js` (`getStatus()` ~line 214-263)
- Test: `backend/tests/unit/services/vlcMprisService.test.js`

**Step 1: Write failing test**

```javascript
test('getStatus only queries Position from D-Bus, uses cached state and track', async () => {
  // Set cached state via monitor
  vlcService.state = 'playing';
  vlcService.track = { filename: 'test.mp4', length: 60 };

  const dbusGetSpy = jest.spyOn(vlcService, '_dbusGetProperty');
  await vlcService.getStatus();

  // Should only call _dbusGetProperty once (for Position)
  expect(dbusGetSpy).toHaveBeenCalledTimes(1);
  expect(dbusGetSpy).toHaveBeenCalledWith(expect.any(String), 'Position');
});
```

**Step 2: Run test — FAIL**

Expected: FAIL — currently calls _dbusGetProperty 3 times

**Step 3: Simplify getStatus()**

Remove the PlaybackStatus and Metadata D-Bus reads. Use `this.state` and `this.track` directly (already maintained by the D-Bus monitor's `_processStateChange`):

```javascript
async getStatus() {
  await this._ensureConnection();

  // Position is the only property not tracked by PropertiesChanged signals
  let positionUs = 0;
  try {
    const { stdout } = await this._dbusGetProperty(PLAYER_IFACE, 'Position');
    const match = stdout.match(/int64\s+(\d+)/);
    positionUs = match ? parseInt(match[1], 10) : 0;
  } catch {
    // Position read failed — use 0
  }

  const lengthSec = this.track?.length || 0;
  const timeSec = positionUs / 1000000;
  const positionRatio = lengthSec > 0 ? Math.min(1, timeSec / lengthSec) : 0;

  return {
    connected: true,
    state: this.state,
    currentItem: this.track?.filename || null,
    position: positionRatio,
    length: lengthSec,
    time: timeSec,
    volume: Math.round(this._rawVolume * 256),
    fullscreen: false,
    loop: this._loopEnabled,
  };
}
```

**Step 4: Run tests**

Run: `cd backend && npx jest tests/unit/services/vlcMprisService.test.js --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/vlcMprisService.js
git commit -m "perf: getStatus queries only Position from D-Bus, uses cached state/track"
```

---

### Task 7: Replace waitForVlcLoaded polling with reactive wait

Currently spawns 300-900 dbus-send processes per video. The D-Bus monitor already emits `state:changed` reactively.

**Files:**
- Modify: `backend/src/services/videoQueueService.js` (`waitForVlcLoaded` ~line 263-313 and `playVideo` ~line 170-180)

**Step 1: Write failing test**

```javascript
test('playVideo waits for vlcService state:changed instead of polling getStatus', async () => {
  const getStatusSpy = jest.spyOn(vlcService, 'getStatus');
  // Simulate VLC emitting state:changed with the correct filename after 50ms
  setTimeout(() => {
    vlcService.emit('state:changed', { state: 'playing', filename: 'test.mp4' });
  }, 50);

  await videoQueueService.playVideo(mockQueueItem);
  // Should NOT have polled getStatus in a loop
  expect(getStatusSpy.mock.calls.length).toBeLessThan(5);
});
```

**Step 2: Implement reactive wait**

Replace the `waitForVlcLoaded` polling loop with a Promise that resolves on `vlcService`'s `state:changed` event.

**IMPORTANT**: The `state:changed` payload is `{ previous: { state, filename }, current: { state, filename } }` — NOT flat `{ state, filename }`. Also, `_previousDelta` is null after init/reset, so the first state change doesn't emit. Must seed `_previousDelta` to enable first-play emission.

**Pre-requisite sub-step**: In `vlcMprisService.js` constructor, change `this._previousDelta = null` to:
```javascript
this._previousDelta = { state: 'stopped', filename: null };
```
And remove the same line from `reset()` (line ~465) — replace with:
```javascript
this._previousDelta = { state: 'stopped', filename: null };
```
This ensures the very first state change after startup/reset WILL emit `state:changed`.

**Then replace `waitForVlcLoaded`:**

```javascript
async waitForVlcLoaded(expectedFilename, description, timeoutMs = 30000) {
  // Fast path: already playing the right file
  if (vlcService.state === 'playing' && vlcService.track?.filename === expectedFilename) {
    return vlcService.getStatus();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      vlcService.removeListener('state:changed', handler);
      reject(new Error(
        `Timeout waiting for ${description} after ${timeoutMs}ms. ` +
        `Expected: ${expectedFilename}, Current: ${vlcService.track?.filename || 'null'}, State: ${vlcService.state}`
      ));
    }, timeoutMs);

    const handler = (data) => {
      // Payload is { previous: {state, filename}, current: {state, filename} }
      if (data.current.state === 'playing' && data.current.filename === expectedFilename) {
        clearTimeout(timeout);
        vlcService.removeListener('state:changed', handler);
        vlcService.getStatus().then(resolve).catch(reject);
      }
    };

    vlcService.on('state:changed', handler);
  });
}
```

**Step 3: Run tests**

Run: `cd backend && npx jest tests/unit/services/videoQueueService.test.js --no-coverage`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/services/videoQueueService.js
git commit -m "perf: replace waitForVlcLoaded polling with reactive state:changed listener"
```

---

### Task 8: Fix processQueue race — claim item before pre-play hooks

**Files:**
- Modify: `backend/src/services/videoQueueService.js` (`playVideo` ~line 133-152)

**Step 1: Write failing test**

```javascript
test('concurrent processQueue calls do not play the same item twice', async () => {
  const playVideoSpy = jest.spyOn(vlcService, 'playVideo');
  // Add one item, trigger two processQueue calls
  videoQueueService.addToQueue(mockVideoToken, 'player1');
  // Force a second processQueue before hooks complete
  setImmediate(() => videoQueueService.processQueue());

  await new Promise(r => setTimeout(r, 200));
  expect(playVideoSpy).toHaveBeenCalledTimes(1);
});
```

**Step 2: Fix — claim item before hooks**

Move `this.currentItem = queueItem` to before the pre-play hook loop:

```javascript
async playVideo(queueItem) {
  // Claim item BEFORE hooks to prevent concurrent processQueue re-entry
  queueItem.startPlayback();
  this.currentItem = queueItem;

  // Run pre-play hooks (blocking — e.g., attention sound completes before video)
  for (const hook of this._prePlayHooks) {
    try {
      await hook({ queueItem, tokenId: queueItem.tokenId });
    } catch (err) {
      logger.warn('[VideoQueue] Pre-play hook failed:', err.message);
    }
  }

  // ... rest of playVideo unchanged (remove the duplicate startPlayback/currentItem lines)
```

Note: the inner try/catch starting at line 157 must also handle the case where hooks succeeded but VLC playback fails — on failure, null `this.currentItem` and call `queueItem.failPlayback()`.

**Step 3: Run tests**

Run: `cd backend && npx jest tests/unit/services/videoQueueService.test.js --no-coverage`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/services/videoQueueService.js
git commit -m "fix: claim queue item before pre-play hooks to prevent concurrent playVideo race"
```

---

## Phase 4: Audio — Reactive Sink-Input Tracking

### Task 9: Add sink-input event handling to pactl subscribe

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (~line 1080-1112 handler + new `_sinkInputs` map)

**Step 1: Write failing test**

```javascript
test('pactl sink-input new event updates internal sink-input map', () => {
  // Simulate a pactl subscribe line for a new sink-input
  const handler = audioRoutingService._handlePactlLine.bind(audioRoutingService);
  handler("Event 'new' on sink-input #42");

  // Internal map should have the entry (we'll need a getter)
  expect(audioRoutingService._sinkInputRegistry.has('42')).toBe(true);
});

test('pactl sink-input remove event clears from map', () => {
  audioRoutingService._sinkInputRegistry.set('42', { index: '42' });
  const handler = audioRoutingService._handlePactlLine.bind(audioRoutingService);
  handler("Event 'remove' on sink-input #42");

  expect(audioRoutingService._sinkInputRegistry.has('42')).toBe(false);
});
```

**Step 2: Implement**

Add `_sinkInputRegistry = new Map()` to constructor. In the pactl subscribe handler, add the missing branch:

```javascript
} else if ((event.action === 'new' || event.action === 'remove') && event.type === 'sink-input') {
  if (event.action === 'new') {
    // Fetch details for this sink-input to get app name
    this._identifySinkInput(event.id).catch(() => {});
  } else {
    this._sinkInputRegistry.delete(event.id);
  }
}
```

Add helper:
```javascript
async _identifySinkInput(id) {
  try {
    const stdout = await this._execFile('pactl', ['list', 'sink-inputs']);
    // Parse just the entry for this ID
    const sections = stdout.split(/Sink Input #/);
    for (const section of sections) {
      const idMatch = section.match(/^(\d+)/);
      if (idMatch && idMatch[1] === id) {
        const appMatch = section.match(/application\.name = "([^"]+)"/i) ||
                          section.match(/application\.process\.binary = "([^"]+)"/i);
        if (appMatch) {
          this._sinkInputRegistry.set(id, { index: id, appName: appMatch[1] });
        }
        break;
      }
    }
  } catch { /* non-fatal */ }
}
```

**Step 3: Run tests, commit**

```bash
git commit -m "feat: track sink-inputs reactively from pactl subscribe events"
```

---

### Task 10: Replace findSinkInput polling with registry reads

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (`findSinkInput`, `_findSinkInputWithRetry`)

**Step 1: Implement**

Add a fast-path to `findSinkInput` that checks the reactive registry first:

```javascript
async findSinkInput(appName) {
  // Fast path: check reactive registry
  for (const [id, entry] of this._sinkInputRegistry) {
    if (entry.appName && entry.appName.toLowerCase().includes(appName.toLowerCase())) {
      return { index: id };
    }
  }

  // Fallback: poll pactl (registry might not have caught up yet)
  try {
    const stdout = await this._execFile('pactl', ['list', 'sink-inputs']);
    const index = this._parseSinkInputs(stdout, appName);
    return index ? { index } : null;
  } catch (err) {
    logger.error('Failed to list sink-inputs', { error: err.message });
    return null;
  }
}
```

This makes `_findSinkInputWithRetry` effectively instant in the common case (registry is warm). The retry loop becomes a fallback for cold starts only.

**Step 2: Run tests, commit**

```bash
git commit -m "perf: findSinkInput reads from reactive registry, falls back to pactl"
```

---

### Task 11: Fix ducking pre-duck volume capture race

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (`_handleDuckingStart` ~line 815)

**Step 1: Write failing test**

```javascript
test('pre-duck volume is captured BEFORE duck volume is applied', async () => {
  // Mock getStreamVolume to return 100 (pre-duck)
  jest.spyOn(audioRoutingService, 'getStreamVolume').mockResolvedValue(100);
  const setVolSpy = jest.spyOn(audioRoutingService, 'setStreamVolume').mockResolvedValue();

  await audioRoutingService._handleDuckingStart('video', [{ duck: 'spotify', to: 20 }]);

  // setStreamVolume should be called AFTER getStreamVolume resolves
  const getCallOrder = audioRoutingService.getStreamVolume.mock.invocationCallOrder[0];
  const setCallOrder = setVolSpy.mock.invocationCallOrder[0];
  expect(getCallOrder).toBeLessThan(setCallOrder);
});
```

**Step 2: Fix — await capture before applying duck**

Make `_handleDuckingStart` async, await `_capturePreDuckVolume` before `_setVolumeForDucking`:

```javascript
async _handleDuckingStart(source, matchingRules) {
  const targetStreams = new Set(matchingRules.map(r => r.duck));

  for (const target of targetStreams) {
    if (!this._activeDuckingSources[target]) this._activeDuckingSources[target] = [];
    if (!this._activeDuckingSources[target].includes(source)) {
      this._activeDuckingSources[target].push(source);
    }

    // Capture pre-duck volume BEFORE applying duck (was fire-and-forget — caused race)
    if (this._preDuckVolumes[target] === undefined) {
      await this._capturePreDuckVolume(target);
    }

    const effectiveVolume = this._calculateEffectiveVolume(target);
    this._setVolumeForDucking(target, effectiveVolume, 'apply');

    this.emit('ducking:changed', { /* ... same as before ... */ });
  }
}
```

**Step 3: Run tests, commit**

```bash
git commit -m "fix: await pre-duck volume capture before applying duck to prevent race"
```

---

## Phase 5: Cue Engine + Spotify Cleanup

### Task 12: Remove duplicate video:paused/resumed registrations

**Files:**
- Modify: `backend/src/services/cueEngineWiring.js` (~line 57)

**Step 1: Write test**

```javascript
test('video:paused only triggers one cueEngineService handler', () => {
  const handleGameSpy = jest.spyOn(cueEngineService, 'handleGameEvent');
  const handleLifecycleSpy = jest.spyOn(cueEngineService, 'handleVideoLifecycleEvent');

  videoQueueService.emit('video:paused', { tokenId: 'test' });

  // Should call lifecycle handler (the explicit registration), NOT game event handler
  expect(handleLifecycleSpy).toHaveBeenCalledTimes(1);
  expect(handleGameSpy).not.toHaveBeenCalledWith('video:paused', expect.anything());
});
```

**Step 2: Fix — remove from the loop**

Change line 57 from:
```javascript
for (const event of ['video:started', 'video:completed', 'video:paused', 'video:resumed']) {
```
To:
```javascript
for (const event of ['video:started', 'video:completed']) {
```

`video:paused` and `video:resumed` are already handled by the explicit lifecycle registrations at lines 73-83.

**Step 3: Run tests, commit**

```bash
git commit -m "fix: remove duplicate video:paused/resumed registrations in cueEngineWiring"
```

---

### Task 13: Fix spotifyService _dbusCall missing _setConnected(false)

**Files:**
- Modify: `backend/src/services/spotifyService.js` (~line 132-133)

**Step 1: Write failing test**

```javascript
test('_dbusCall sets connected=false when spotifyd not found on D-Bus', async () => {
  jest.spyOn(spotifyService, '_discoverDbusDest').mockResolvedValue(null);
  const registrySpy = jest.spyOn(registry, 'report');

  await expect(spotifyService._dbusCall('Pause')).rejects.toThrow('spotifyd not found on D-Bus');
  expect(registrySpy).toHaveBeenCalledWith('spotify', 'down', expect.any(String));
});
```

**Step 2: Fix**

```javascript
async _dbusCall(method, args = []) {
  const dest = await this._discoverDbusDest();
  if (!dest) {
    this._setConnected(false);  // <-- ADD THIS
    throw new Error('spotifyd not found on D-Bus');
  }
  // ... rest unchanged
```

**Step 3: Run tests, commit**

```bash
git commit -m "fix: spotifyService._dbusCall updates health registry when spotifyd not found"
```

---

### Task 14: Use shared execHelper instead of duplicate execFileAsync

**Files:**
- Modify: `backend/src/utils/execHelper.js` (add variant)
- Modify: `backend/src/services/mprisPlayerBase.js` (remove local def, import)
- Modify: `backend/src/services/spotifyService.js` (remove local def, import)

**Step 1: Add `execFileWithStderr` to execHelper.js**

```javascript
function execFileWithStderr(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: opts.timeout || 5000, ...opts }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}
module.exports = { execFileAsync, execFileWithStderr };
```

**Step 2: Replace in mprisPlayerBase.js and spotifyService.js**

Remove local `execFileAsync` definitions, replace with:
```javascript
const { execFileWithStderr: execFileAsync } = require('../utils/execHelper');
```

**Step 3: Run tests, commit**

```bash
git commit -m "refactor: use shared execHelper instead of duplicate execFileAsync in MPRIS services"
```

---

## Phase 6: Previously Omitted Fixes

These were initially dismissed as "correctly omitted" but are real operational issues.

### Task 15: Fix _handleVideoComplete TOCTOU — move mode check inside lock

The `currentMode` check at line 271 of `displayControlService.js` is outside the lock. Between the check and lock acquisition, a concurrent GM command can change the mode, causing `display:video:complete` to never emit.

**Files:**
- Modify: `backend/src/services/displayControlService.js` (`_handleVideoComplete` ~line 270)

**Step 1: Fix**

Wrap `_handleVideoComplete` in the lock, moving the mode check inside:

```javascript
async _handleVideoComplete() {
  return this._withLock(async () => {
    if (this.currentMode !== DisplayMode.VIDEO) {
      return;
    }

    logger.info('[DisplayControl] Video complete, returning to previous mode', {
      previousMode: this.previousMode
    });

    const completedVideo = this.pendingVideo;
    this.pendingVideo = null;

    switch (this.previousMode) {
      case DisplayMode.SCOREBOARD:
        await this._doSetScoreboard();  // Use internal _do* to avoid deadlock
        break;
      case DisplayMode.IDLE_LOOP:
      default:
        await this._doSetIdleLoop();
        break;
    }

    this.emit('display:video:complete', {
      video: completedVideo,
      returnedTo: this.currentMode
    });
  });
}
```

Note: must call `_doSetScoreboard()` / `_doSetIdleLoop()` (internal, no-lock versions) since we're already holding the lock. The current code calls `setScoreboard()` / `setIdleLoop()` (public, acquires lock) which would deadlock.

**Step 2: Run tests, commit**

```bash
git commit -m "fix: _handleVideoComplete checks mode inside lock to prevent TOCTOU race"
```

---

### Task 16: Debounce service:state pushes per domain

`video:loading`, `video:started`, and `vlcService state:changed` each independently push `service:state { domain: 'video' }` within milliseconds. Three near-simultaneous WebSocket messages to all GM clients.

**Files:**
- Modify: `backend/src/websocket/broadcasts.js` (`pushServiceState`)

**Step 1: Add per-domain debounce**

```javascript
const _pushTimers = {};

function pushServiceState(domain, service) {
  // Debounce per domain — coalesce rapid pushes within 50ms
  if (_pushTimers[domain]) clearTimeout(_pushTimers[domain]);
  _pushTimers[domain] = setTimeout(() => {
    delete _pushTimers[domain];
    const state = service.getState();
    emitToRoom(io, 'gm', 'service:state', { domain, state });
  }, 50);
}
```

50ms is imperceptible to the GM Scanner but coalesces the triple push into one.

**Step 2: Run integration tests to verify no regressions**

Run: `cd backend && npm run test:integration`

**Step 3: Commit**

```bash
git commit -m "perf: debounce service:state pushes per domain (50ms) to prevent triple-send"
```

---

### Task 17: Fix commandExecutor cueengine health reporting

`commandExecutor.js` line 660 reports cueengine as `down` when no cues are loaded. No cues loaded is a valid configuration, not a failure. This confuses GMs during pre-show health checks.

**Files:**
- Modify: `backend/src/services/commandExecutor.js` (~line 658-664)
- Modify: `backend/src/services/cueEngineService.js` (add `checkHealth()`)

**Step 1: Move health check to the service**

Add to `cueEngineService.js`:
```javascript
checkHealth() {
  const hasCues = this.getCues().length > 0;
  registry.report('cueengine', 'healthy',
    hasCues ? `${this.getCues().length} cues loaded` : 'No cues configured');
  return true; // Always healthy — absence of cues is not a failure
}
```

Update `commandExecutor.js` HEALTH_CHECKS:
```javascript
cueengine: () => getCueEngine().checkHealth(),
```

**Step 2: Commit**

```bash
git commit -m "fix: cueengine health always reports healthy — no cues is valid config"
```

---

### Task 18: Wrap initializeSessionDevices in try/catch

A bad socket during session creation could block the sync:full broadcast.

**Files:**
- Modify: `backend/src/websocket/broadcasts.js` (~line 84)

**Step 1: Fix**

```javascript
// In session:created handler:
try {
  await initializeSessionDevices(io, session);
} catch (err) {
  logger.error('Failed to initialize session devices', { error: err.message });
}
```

**Step 2: Commit**

```bash
git commit -m "fix: wrap initializeSessionDevices in try/catch to prevent broadcast blocking"
```

---

## Verification

### After all tasks: Run full test suite

```bash
cd backend && npm run test:all
```

Expected: All unit + contract + integration tests pass.

### Manual verification on Pi

1. Start orchestrator, verify scoreboard launches once and stays alive through video cycles
2. Trigger 3 video tokens — scoreboard should hide/show without Chromium respawning
3. Check `pgrep -a chromium` before and after — same PIDs throughout
4. Verify Spotify pause command correctly reports "down" if spotifyd isn't running
5. Verify error logs show actual error messages (not `{}`)
6. Verify audio routing works on first video play (no "No such entity")
