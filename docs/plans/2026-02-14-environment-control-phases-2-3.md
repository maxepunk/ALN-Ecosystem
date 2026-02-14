# Environment Control Phases 2 & 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add compound cue timelines (video-synced + clock-synced), Spotify integration, multi-speaker routing, and automatic audio ducking to the ALN environment control system.

**Architecture:** Phase 2 extends the Phase 1 cue engine with timeline execution, nesting, cascading stop, and video conflict detection. A new spotifyService wraps D-Bus MPRIS for spotifyd control. Phase 3 adds PipeWire combine-sink management for multi-speaker output and an event-driven ducking engine. All new gm:command actions flow through the existing commandExecutor → executeCommand() path.

**Tech Stack:** Node.js (backend), PipeWire/pactl (audio routing), D-Bus MPRIS (Spotify via spotifyd), Vite ES6 modules (GM Scanner), Jest (testing), Socket.IO (WebSocket)

**Roadmap Reference:** `docs/plans/2026-02-13-environment-control-roadmap.md`

**Phase 1 Reference:** `docs/plans/2026-02-14-environment-control-phase1.md`

---

## Branch & Submodule Strategy

### Repository Structure

```
ALN-Ecosystem/              ← Parent repo (contains backend/ directly)
├── backend/                ← NOT a submodule — direct in parent
├── ALNScanner/             ← SUBMODULE — separate git repo
│   └── data/               ← Nested submodule → ALN-TokenData
└── ...other submodules
```

### Branch Plan

**Parent repo (ALN-Ecosystem):**
- Create branch `phase2/compound-cues-spotify` from `main`
- All backend/ changes committed here
- ALNScanner submodule ref updated here after submodule commits

**ALNScanner submodule:**
- Create branch `phase2/compound-cues-spotify` from `main` (inside ALNScanner/)
- All GM Scanner changes committed here first
- Then parent repo stages the updated submodule ref

**Commit ordering (every time GM Scanner changes):**
1. `cd ALNScanner && git add ... && git commit` (submodule commit)
2. `cd .. && git add ALNScanner && git commit` (parent stages updated ref)

**Phase 3 continues on the same branches** (compound cues + multi-speaker are tightly coupled). If Phase 2 is merged to main first, Phase 3 branches from the updated main.

### Merge Strategy

1. Merge ALNScanner `phase2/compound-cues-spotify` → ALNScanner `main`
2. Update parent's ALNScanner submodule ref to new main HEAD
3. Merge parent `phase2/compound-cues-spotify` → parent `main`
4. `git submodule update --init --recursive` to verify clean state

---

## Bellwether E2E Test: Test 30

**Test:** `backend/tests/e2e/flows/30-full-game-session-multi-device.test.js`
**Name:** "complete game session with multiple GM and player scanners"
**Run command:**
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx playwright test 30-full-game-session-multi-device.test.js
```

**What it covers:** 2 GMs + 3 player scanners + 1 scoreboard. Session lifecycle, environment control, scoring, video, multi-GM sync, team creation, transaction deletion/rescan. 180-second timeout, requires `npm run dev:full`.

**Usage:** Run test 30 at key checkpoints to validate no regressions. Additionally, **extend** test 30 during implementation to cover new Phase 2/3 lifecycle events (compound cue broadcasts, Spotify status, video conflicts, etc.) so it becomes the integration bellwether for the full environment control stack.

### Checkpoint Schedule

| After Task | Why | Action |
|------------|-----|--------|
| Task 5 (commandExecutor) | Core command dispatch changed | **Run** test 30 — verify no regression |
| Task 11 (service init + reset) | Service wiring changed in app.js/systemReset.js | **Run** test 30 — verify startup/reset still works |
| Task 14 (Phase 2 integration) | All Phase 2 backend complete | **Run + extend** test 30 with compound cue + Spotify assertions |
| Task 22 (final verification) | All Phases 2+3 complete | **Run** extended test 30 — full regression check before merge |

---

## Task 0: Branch Setup

**Step 1: Create parent branch**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git checkout main && git pull
git checkout -b phase2/compound-cues-spotify
```

**Step 2: Create ALNScanner submodule branch**

```bash
cd ALNScanner
git checkout main && git pull
git checkout -b phase2/compound-cues-spotify
cd ..
```

**Step 3: Verify clean state**

```bash
git submodule status --recursive
git status
```

Expected: Both repos on `phase2/compound-cues-spotify`, working tree clean.

**Step 4: Commit branch setup**

```bash
git add ALNScanner
git commit -m "chore: create phase2/compound-cues-spotify branch"
```

---

# PHASE 2: Compound Cues + Spotify

---

## Task 1: AsyncAPI Contract — Phase 2 Events

Update the contract FIRST before implementation (Decision D41).

**Files:**
- Modify: `backend/contracts/asyncapi.yaml`
- Test: `backend/tests/unit/contracts/` (contract tests auto-validate against schema)

**Step 1: Add Phase 2 WebSocket event schemas to asyncapi.yaml**

Add these channel definitions alongside existing Phase 1 events:

```yaml
# Under channels: section, add:

  cue/status:
    description: Compound cue progress update (Phase 2)
    subscribe:
      message:
        payload:
          type: object
          properties:
            event:
              type: string
              const: "cue:status"
            data:
              type: object
              properties:
                cueId:
                  type: string
                state:
                  type: string
                  enum: [started, running, paused, completed, stopped]
                progress:
                  type: number
                  description: Elapsed seconds into timeline
                duration:
                  type: number
                  description: Total timeline duration in seconds
                hasVideo:
                  type: boolean
              required: [cueId, state]
            timestamp:
              type: string
              format: date-time
          required: [event, data, timestamp]

  cue/conflict:
    description: Video conflict prompt for GM (Phase 2)
    subscribe:
      message:
        payload:
          type: object
          properties:
            event:
              type: string
              const: "cue:conflict"
            data:
              type: object
              properties:
                cueId:
                  type: string
                reason:
                  type: string
                currentVideo:
                  type: string
                autoCancel:
                  type: boolean
                  default: true
                autoCancelMs:
                  type: number
                  default: 10000
              required: [cueId, reason, currentVideo]
            timestamp:
              type: string
              format: date-time
          required: [event, data, timestamp]

  spotify/status:
    description: Spotify playback state (Phase 2)
    subscribe:
      message:
        payload:
          type: object
          properties:
            event:
              type: string
              const: "spotify:status"
            data:
              type: object
              properties:
                connected:
                  type: boolean
                state:
                  type: string
                  enum: [playing, paused, stopped]
                track:
                  type: object
                  properties:
                    title:
                      type: string
                    artist:
                      type: string
                volume:
                  type: number
                  minimum: 0
                  maximum: 100
                playlist:
                  type: string
                cacheStatus:
                  type: string
                  enum: [verified, missing, unchecked]
              required: [connected, state]
            timestamp:
              type: string
              format: date-time
          required: [event, data, timestamp]
```

Also add gm:command action schemas for `spotify:*`, `cue:stop`, `cue:pause`, `cue:resume`, `audio:volume:set` under the existing gm:command channel's oneOf list.

**Step 2: Run contract validation**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test -- --testPathPattern="contracts" --verbose
```

Expected: All contract tests pass (schemas are syntactically valid).

**Step 3: Commit**

```bash
git add backend/contracts/asyncapi.yaml
git commit -m "feat(contracts): add Phase 2 AsyncAPI events for compound cues, Spotify, conflicts"
```

---

## Task 2: audioRoutingService — VALID_STREAMS Expansion + Volume Control

Picks up deferred Phase 1 items: expand VALID_STREAMS, add fallback field, add `audio:volume:set`.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js`
- Test: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Write failing tests for multi-stream volume control**

Add to the existing audioRoutingService test file. **Note:** `mockExecFileSuccess` and `mockExecFileError` are local helper functions already defined in this test file (lines ~48-57) — they are NOT shared test utilities. Any new test file that needs these helpers must define its own copies.

```javascript
describe('audio:volume:set', () => {
  it('should set volume for a valid stream via pactl', async () => {
    // Mock findSinkInput to return a sink-input index
    jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: 42 });
    mockExecFileSuccess('');

    await audioRoutingService.setStreamVolume('spotify', 75);

    expect(execFile).toHaveBeenCalledWith(
      'pactl', ['set-sink-input-volume', '42', '75%'],
      expect.any(Object), expect.any(Function)
    );
  });

  it('should reject invalid stream names', async () => {
    await expect(audioRoutingService.setStreamVolume('invalid', 50))
      .rejects.toThrow(/invalid stream/i);
  });

  it('should clamp volume to 0-100 range', async () => {
    jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: 42 });
    mockExecFileSuccess('');

    await audioRoutingService.setStreamVolume('video', 150);

    expect(execFile).toHaveBeenCalledWith(
      'pactl', ['set-sink-input-volume', '42', '100%'],
      expect.any(Object), expect.any(Function)
    );
  });
});

describe('VALID_STREAMS expansion', () => {
  it('should accept spotify as a valid stream', () => {
    expect(audioRoutingService.isValidStream('spotify')).toBe(true);
  });

  it('should accept sound as a valid stream', () => {
    expect(audioRoutingService.isValidStream('sound')).toBe(true);
  });
});

describe('fallback routing', () => {
  it('should try fallback sink when primary is unavailable', async () => {
    // First call fails (primary unavailable), second succeeds (fallback)
    jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: 42 });
    const moveStream = jest.spyOn(audioRoutingService, 'moveStreamToSink');
    moveStream.mockRejectedValueOnce(new Error('sink not found'));
    moveStream.mockResolvedValueOnce(undefined);

    const route = { sink: 'bluez_output.missing', fallback: 'hdmi' };
    jest.spyOn(audioRoutingService, 'getStreamRoute').mockReturnValue(route);

    await audioRoutingService.applyRoutingWithFallback('video');

    expect(moveStream).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test -- --testPathPattern="audioRoutingService" --verbose
```

Expected: FAIL — `setStreamVolume`, `isValidStream`, `applyRoutingWithFallback` not defined.

**Step 3: Implement the changes**

In `audioRoutingService.js`:

- Add `STREAM_APP_NAMES` map: `{ video: 'VLC', spotify: 'spotifyd', sound: 'pw-play' }`
- Add `isValidStream(stream)` method
- Add `setStreamVolume(stream, volume)` method — find sink-input by app name, call `pactl set-sink-input-volume`
- Add `applyRoutingWithFallback(stream)` method — try primary sink, on failure try fallback from route config
- Add `getStreamVolume(stream)` — query current volume via pactl

**Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="audioRoutingService" --verbose
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add backend/src/services/audioRoutingService.js backend/tests/unit/services/audioRoutingService.test.js
git commit -m "feat: expand audioRoutingService with multi-stream volume control and fallback routing"
```

---

## Task 3: Overtime Detection via Game Clock

Replace the standalone `setTimeout` approach with tick-based checking.

**Files:**
- Modify: `backend/src/services/gameClockService.js`
- Modify: `backend/src/services/sessionService.js` (remove `startSessionTimeout`/`stopSessionTimeout`)
- Test: `backend/tests/unit/services/gameClockService.test.js`

**Step 1: Write failing test for overtime detection**

```javascript
describe('overtime detection', () => {
  it('should emit gameclock:overtime when elapsed exceeds threshold', () => {
    const handler = jest.fn();
    gameClockService.on('gameclock:overtime', handler);

    gameClockService.setOvertimeThreshold(120 * 60); // 2 hours in seconds
    gameClockService.start();

    // Advance past 2 hours
    jest.advanceTimersByTime(120 * 60 * 1000 + 1000);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ elapsed: expect.any(Number) })
    );
  });

  it('should only emit overtime once', () => {
    const handler = jest.fn();
    gameClockService.on('gameclock:overtime', handler);

    gameClockService.setOvertimeThreshold(10);
    gameClockService.start();
    jest.advanceTimersByTime(15000);

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement overtime detection in gameClockService tick()**

Add `overtimeThreshold`, `overtimeFired` flag. On each tick, if elapsed >= threshold and !overtimeFired, emit `gameclock:overtime` and set flag.

**Step 4: Remove standalone timeout from sessionService**

Remove `startSessionTimeout()` and `stopSessionTimeout()` methods. Instead, listen for `gameclock:overtime` event in session service.

**Step 5: Run full test suite**

```bash
npm test -- --verbose
```

Expected: All pass (865+ unit, 214+ integration).

**Step 6: Commit**

```bash
git add backend/src/services/gameClockService.js backend/src/services/sessionService.js \
  backend/tests/unit/services/gameClockService.test.js
git commit -m "feat: replace session timeout with game clock overtime detection"
```

---

## Task 4: spotifyService — D-Bus MPRIS Wrapper

New backend service wrapping spotifyd control via D-Bus.

**Files:**
- Create: `backend/src/services/spotifyService.js`
- Create: `backend/tests/unit/services/spotifyService.test.js`

**Step 1: Write failing tests**

**Note:** This is a NEW test file. You must define local `mockExecFileSuccess(stdout)` and `mockExecFileError(message)` helpers that configure the mocked `execFile` callback — see `audioRoutingService.test.js` lines ~48-57 for the pattern. These helpers are NOT shared utilities.

```javascript
jest.mock('child_process');

describe('SpotifyService', () => {
  let spotifyService, execFile;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    const cp = require('child_process');
    execFile = cp.execFile;
    spotifyService = require('../../../src/services/spotifyService');
    spotifyService.reset();
  });

  afterEach(() => {
    spotifyService.cleanup();
  });

  describe('transport controls', () => {
    it('should call dbus-send for play', async () => {
      mockExecFileSuccess('');
      await spotifyService.play();
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Play']),
        expect.any(Object), expect.any(Function)
      );
    });

    it('should call dbus-send for pause', async () => {
      mockExecFileSuccess('');
      await spotifyService.pause();
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Pause']),
        expect.any(Object), expect.any(Function)
      );
    });

    it('should call dbus-send for stop', async () => {
      mockExecFileSuccess('');
      await spotifyService.stop();
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Stop']),
        expect.any(Object), expect.any(Function)
      );
    });

    it('should call dbus-send for next', async () => {
      mockExecFileSuccess('');
      await spotifyService.next();
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Next']),
        expect.any(Object), expect.any(Function)
      );
    });
  });

  describe('playlist switching', () => {
    it('should call OpenUri with spotify URI', async () => {
      mockExecFileSuccess('');
      await spotifyService.setPlaylist('spotify:playlist:act2');
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['string:spotify:playlist:act2']),
        expect.any(Object), expect.any(Function)
      );
    });
  });

  describe('volume control', () => {
    it('should set volume via dbus property', async () => {
      mockExecFileSuccess('');
      await spotifyService.setVolume(80);
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['double:0.8']),
        expect.any(Object), expect.any(Function)
      );
    });

    it('should clamp volume to 0-100', async () => {
      mockExecFileSuccess('');
      await spotifyService.setVolume(150);
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['double:1']),
        expect.any(Object), expect.any(Function)
      );
    });
  });

  describe('connection detection', () => {
    it('should detect when spotifyd is not running', async () => {
      mockExecFileError('org.freedesktop.DBus.Error.ServiceUnknown');
      const result = await spotifyService.checkConnection();
      expect(result).toBe(false);
    });

    it('should detect when spotifyd is running', async () => {
      mockExecFileSuccess('boolean true');
      const result = await spotifyService.checkConnection();
      expect(result).toBe(true);
    });
  });

  describe('cache verification', () => {
    it('should return verified when cache directory has tracks', async () => {
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      jest.spyOn(require('fs'), 'readdirSync').mockReturnValue(['track1.ogg', 'track2.ogg']);
      const status = await spotifyService.verifyCacheStatus();
      expect(status.status).toBe('verified');
    });

    it('should return missing when cache directory is empty', async () => {
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      jest.spyOn(require('fs'), 'readdirSync').mockReturnValue([]);
      const status = await spotifyService.verifyCacheStatus();
      expect(status.status).toBe('missing');
    });
  });

  describe('pause cascade', () => {
    it('should track pausedByGameClock flag', async () => {
      mockExecFileSuccess('');
      await spotifyService.pauseForGameClock();
      expect(spotifyService.isPausedByGameClock()).toBe(true);
    });

    it('should resume only if paused by game clock', async () => {
      mockExecFileSuccess('');
      await spotifyService.pauseForGameClock();
      await spotifyService.resumeFromGameClock();
      expect(spotifyService.isPausedByGameClock()).toBe(false);
    });

    it('should NOT resume if GM manually paused', async () => {
      mockExecFileSuccess('');
      await spotifyService.pause(); // GM manual pause
      // Game clock resume should not unpause
      expect(spotifyService.isPausedByGameClock()).toBe(false);
    });
  });

  describe('events', () => {
    it('should emit playback:changed on play', async () => {
      const handler = jest.fn();
      spotifyService.on('playback:changed', handler);
      mockExecFileSuccess('');
      await spotifyService.play();
      expect(handler).toHaveBeenCalledWith({ state: 'playing' });
    });
  });
});
```

**Step 2: Run test — expect FAIL (module not found)**

**Step 3: Implement spotifyService.js**

```javascript
// backend/src/services/spotifyService.js
const EventEmitter = require('events');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

const DBUS_DEST = 'org.mpris.MediaPlayer2.spotifyd';
const DBUS_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';

class SpotifyService extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
    this.state = 'stopped';
    this.volume = 100;
    this._pausedByGameClock = false;
    this.cachePath = process.env.SPOTIFY_CACHE_PATH || '/home/maxepunk/.cache/spotifyd';
  }

  async _dbusCall(method, args = []) {
    const cmdArgs = [
      '--session', '--type=method_call', '--print-reply',
      '--dest=' + DBUS_DEST, DBUS_PATH,
      method, ...args
    ];
    return execFileAsync('dbus-send', cmdArgs, { timeout: 5000 });
  }

  async _dbusSetProperty(iface, property, type, value) {
    return this._dbusCall('org.freedesktop.DBus.Properties.Set', [
      `string:${iface}`, `string:${property}`, `variant:${type}:${value}`
    ]);
  }

  async play() {
    await this._dbusCall(`${PLAYER_IFACE}.Play`);
    this.state = 'playing';
    this._pausedByGameClock = false;
    this.emit('playback:changed', { state: 'playing' });
  }

  async pause() {
    await this._dbusCall(`${PLAYER_IFACE}.Pause`);
    this.state = 'paused';
    this.emit('playback:changed', { state: 'paused' });
  }

  async stop() {
    await this._dbusCall(`${PLAYER_IFACE}.Stop`);
    this.state = 'stopped';
    this._pausedByGameClock = false;
    this.emit('playback:changed', { state: 'stopped' });
  }

  async next() { await this._dbusCall(`${PLAYER_IFACE}.Next`); }
  async previous() { await this._dbusCall(`${PLAYER_IFACE}.Previous`); }

  async setPlaylist(uri) {
    await this._dbusCall(`${PLAYER_IFACE}.OpenUri`, [`string:${uri}`]);
    this.emit('playlist:changed', { uri });
  }

  async setVolume(vol) {
    const clamped = Math.max(0, Math.min(100, vol));
    const normalized = clamped / 100;
    await this._dbusSetProperty(PLAYER_IFACE, 'Volume', 'double', normalized);
    this.volume = clamped;
    this.emit('volume:changed', { volume: clamped });
  }

  async pauseForGameClock() {
    if (this.state === 'playing') {
      await this.pause();
      this._pausedByGameClock = true;
    }
  }

  async resumeFromGameClock() {
    if (this._pausedByGameClock) {
      await this.play();
      this._pausedByGameClock = false;
    }
  }

  isPausedByGameClock() { return this._pausedByGameClock; }

  async checkConnection() {
    try {
      await execFileAsync('dbus-send', [
        '--session', '--type=method_call', '--print-reply',
        '--dest=' + DBUS_DEST, DBUS_PATH,
        'org.freedesktop.DBus.Peer.Ping'
      ], { timeout: 2000 });
      this.connected = true;
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }

  async verifyCacheStatus() {
    if (!fs.existsSync(this.cachePath)) {
      return { status: 'missing', message: 'Cache directory not found' };
    }
    const files = fs.readdirSync(this.cachePath);
    if (files.length === 0) {
      return { status: 'missing', message: 'Cache is empty' };
    }
    return { status: 'verified', trackCount: files.length };
  }

  getState() {
    return {
      connected: this.connected,
      state: this.state,
      volume: this.volume,
      pausedByGameClock: this._pausedByGameClock,
    };
  }

  reset() {
    this.connected = false;
    this.state = 'stopped';
    this.volume = 100;
    this._pausedByGameClock = false;
  }

  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

module.exports = new SpotifyService();
```

**Step 4: Run tests — expect PASS**

```bash
npm test -- --testPathPattern="spotifyService" --verbose
```

**Step 5: Commit**

```bash
git add backend/src/services/spotifyService.js backend/tests/unit/services/spotifyService.test.js
git commit -m "feat: add spotifyService for D-Bus MPRIS control of spotifyd"
```

---

## Task 5: commandExecutor — New Action Cases

Add spotify:*, cue:stop/pause/resume, audio:volume:set to the command executor.

**Files:**
- Modify: `backend/src/services/commandExecutor.js`
- Modify: `backend/tests/unit/services/commandExecutor.test.js`

**Step 1: Write failing tests for new commands**

Add to commandExecutor.test.js — mock the new spotifyService:

```javascript
jest.mock('../../../src/services/spotifyService', () => ({
  play: jest.fn().mockResolvedValue(),
  pause: jest.fn().mockResolvedValue(),
  stop: jest.fn().mockResolvedValue(),
  next: jest.fn().mockResolvedValue(),
  previous: jest.fn().mockResolvedValue(),
  setPlaylist: jest.fn().mockResolvedValue(),
  setVolume: jest.fn().mockResolvedValue(),
  verifyCacheStatus: jest.fn().mockResolvedValue({ status: 'verified', trackCount: 42 }),
  getState: jest.fn().mockReturnValue({ connected: true, state: 'playing', volume: 80 }),
  reset: jest.fn(),
}));

describe('spotify commands', () => {
  it('should execute spotify:play', async () => {
    const result = await executeCommand({ action: 'spotify:play', payload: {}, source: 'gm' });
    expect(result.success).toBe(true);
    expect(spotifyService.play).toHaveBeenCalled();
  });

  it('should execute spotify:playlist with uri', async () => {
    const result = await executeCommand({
      action: 'spotify:playlist',
      payload: { uri: 'spotify:playlist:act2' },
      source: 'gm'
    });
    expect(result.success).toBe(true);
    expect(spotifyService.setPlaylist).toHaveBeenCalledWith('spotify:playlist:act2');
  });

  it('should execute spotify:volume with clamping', async () => {
    const result = await executeCommand({
      action: 'spotify:volume',
      payload: { volume: 80 },
      source: 'gm'
    });
    expect(result.success).toBe(true);
    expect(spotifyService.setVolume).toHaveBeenCalledWith(80);
  });

  it('should execute spotify:cache:verify', async () => {
    const result = await executeCommand({
      action: 'spotify:cache:verify',
      payload: {},
      source: 'gm'
    });
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('verified');
  });
});

describe('audio:volume:set', () => {
  it('should set per-stream volume', async () => {
    const result = await executeCommand({
      action: 'audio:volume:set',
      payload: { stream: 'spotify', volume: 60 },
      source: 'gm'
    });
    expect(result.success).toBe(true);
    expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 60);
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Add switch cases to commandExecutor.js**

Use BT_COMMANDS-style lookup table for spotify transport commands:

```javascript
const SPOTIFY_TRANSPORT = {
  'spotify:play': 'play',
  'spotify:pause': 'pause',
  'spotify:stop': 'stop',
  'spotify:next': 'next',
  'spotify:previous': 'previous',
};

// Inside the switch statement:
case 'spotify:play':
case 'spotify:pause':
case 'spotify:stop':
case 'spotify:next':
case 'spotify:previous': {
  const spotifyService = require('./spotifyService');
  const method = SPOTIFY_TRANSPORT[action];
  await spotifyService[method]();
  return { success: true, message: `Spotify: ${method}`, source,
    broadcasts: [{ event: 'spotify:status', data: spotifyService.getState(), target: 'gm' }] };
}

case 'spotify:playlist': {
  const spotifyService = require('./spotifyService');
  const { uri } = payload;
  if (!uri) return { success: false, message: 'uri required', source };
  await spotifyService.setPlaylist(uri);
  return { success: true, message: `Spotify playlist: ${uri}`, source,
    broadcasts: [{ event: 'spotify:status', data: spotifyService.getState(), target: 'gm' }] };
}

case 'spotify:volume': {
  const spotifyService = require('./spotifyService');
  const { volume } = payload;
  if (volume === undefined) return { success: false, message: 'volume required', source };
  await spotifyService.setVolume(volume);
  return { success: true, message: `Spotify volume: ${volume}`, source,
    broadcasts: [{ event: 'spotify:status', data: spotifyService.getState(), target: 'gm' }] };
}

case 'spotify:cache:verify': {
  const spotifyService = require('./spotifyService');
  const status = await spotifyService.verifyCacheStatus();
  return { success: true, message: 'Cache verification complete', data: status, source };
}

case 'audio:volume:set': {
  const { stream, volume } = payload;
  if (!stream || volume === undefined) {
    return { success: false, message: 'stream and volume required', source };
  }
  await audioRoutingService.setStreamVolume(stream, volume);
  return { success: true, message: `Volume set: ${stream}=${volume}`, source };
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Also replace Phase 2 stubs for cue:stop, cue:pause, cue:resume**

**Sequencing note:** These cases call `cueEngineService.stopCue()`, `pauseCue()`, `resumeCue()` which don't exist until Task 6. This is safe because:
- Task 5's **unit tests** mock cueEngineService, so they pass regardless
- Task 5 and Task 6 **must be in the same batch or adjacent batches** — do NOT run integration tests between them
- Only run `npm test -- --testPathPattern="commandExecutor"` after Task 5 (not the full suite)

Replace the stubs with real method calls:

```javascript
case 'cue:stop': {
  const cueEngineService = require('./cueEngineService');
  const { cueId } = payload;
  if (!cueId) return { success: false, message: 'cueId required', source };
  await cueEngineService.stopCue(cueId);
  return { success: true, message: `Cue stopped: ${cueId}`, source,
    broadcasts: [{ event: 'cue:status', data: { cueId, state: 'stopped' }, target: 'gm' }] };
}

case 'cue:pause': {
  const cueEngineService = require('./cueEngineService');
  const { cueId } = payload;
  if (!cueId) return { success: false, message: 'cueId required', source };
  await cueEngineService.pauseCue(cueId);
  return { success: true, message: `Cue paused: ${cueId}`, source,
    broadcasts: [{ event: 'cue:status', data: { cueId, state: 'paused' }, target: 'gm' }] };
}

case 'cue:resume': {
  const cueEngineService = require('./cueEngineService');
  const { cueId } = payload;
  if (!cueId) return { success: false, message: 'cueId required', source };
  await cueEngineService.resumeCue(cueId);
  return { success: true, message: `Cue resumed: ${cueId}`, source,
    broadcasts: [{ event: 'cue:status', data: { cueId, state: 'running' }, target: 'gm' }] };
}
```

**Step 6: Run commandExecutor tests only** (full suite deferred until after Task 6 — see sequencing note above)

```bash
npm test -- --testPathPattern="commandExecutor" --verbose
```

**Step 7: Commit**

```bash
git add backend/src/services/commandExecutor.js backend/tests/unit/services/commandExecutor.test.js
git commit -m "feat: add spotify, audio:volume:set, and cue lifecycle commands to commandExecutor"
```

**Step 8: CHECKPOINT — Run bellwether E2E test 30**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx playwright test 30-full-game-session-multi-device.test.js
```

Expected: PASS — all existing flows still work. Core command dispatch has new cases but existing cases are unchanged.

---

## Task 6: Compound Cue Timeline Engine

The core Phase 2 feature. Extend `cueEngineService.js` to execute timeline entries.

**Files:**
- Modify: `backend/src/services/cueEngineService.js`
- Modify: `backend/tests/unit/services/cueEngineService.test.js`

**Step 1: Write failing tests for compound cue execution**

```javascript
describe('compound cue execution', () => {
  it('should execute timeline entries at correct elapsed positions', async () => {
    cueEngineService.loadCues([{
      id: 'compound-1', label: 'Test Compound',
      timeline: [
        { at: 0, action: 'lighting:scene:activate', payload: { sceneId: 'scene.dim' } },
        { at: 5, action: 'sound:play', payload: { file: 'hit.wav' } },
        { at: 10, action: 'lighting:scene:activate', payload: { sceneId: 'scene.bright' } },
      ]
    }]);

    await cueEngineService.fireCue('compound-1');
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'lighting:scene:activate', source: 'cue' })
    );

    // Simulate 5 clock ticks
    for (let i = 1; i <= 5; i++) {
      cueEngineService._tickActiveCompoundCues(i);
    }
    await flushAsync();

    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'sound:play' })
    );
  });

  it('should emit cue:started for compound cues', async () => {
    const handler = jest.fn();
    cueEngineService.on('cue:started', handler);

    cueEngineService.loadCues([{
      id: 'compound-2', label: 'Test',
      timeline: [{ at: 0, action: 'sound:play', payload: { file: 'a.wav' } }]
    }]);

    await cueEngineService.fireCue('compound-2');
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      cueId: 'compound-2', hasVideo: false
    }));
  });

  it('should emit cue:completed when timeline finishes', async () => {
    const handler = jest.fn();
    cueEngineService.on('cue:completed', handler);

    cueEngineService.loadCues([{
      id: 'compound-3', label: 'Short',
      timeline: [{ at: 0, action: 'sound:play', payload: { file: 'a.wav' } }]
    }]);

    await cueEngineService.fireCue('compound-3');
    // Tick past the last entry
    cueEngineService._tickActiveCompoundCues(1);
    await flushAsync();

    expect(handler).toHaveBeenCalledWith({ cueId: 'compound-3' });
  });

  it('should track active compound cues', async () => {
    cueEngineService.loadCues([{
      id: 'compound-active', label: 'Active',
      timeline: [
        { at: 0, action: 'sound:play', payload: { file: 'a.wav' } },
        { at: 60, action: 'sound:play', payload: { file: 'b.wav' } },
      ]
    }]);

    await cueEngineService.fireCue('compound-active');
    const active = cueEngineService.getActiveCues();
    expect(active).toHaveLength(1);
    expect(active[0].cueId).toBe('compound-active');
    expect(active[0].state).toBe('running');
  });
});

describe('compound cue stop/pause/resume', () => {
  it('should stop an active compound cue', async () => {
    cueEngineService.loadCues([{
      id: 'stoppable', label: 'Stoppable',
      timeline: [{ at: 0, action: 'sound:play', payload: {} }, { at: 60, action: 'sound:play', payload: {} }]
    }]);

    await cueEngineService.fireCue('stoppable');
    expect(cueEngineService.getActiveCues()).toHaveLength(1);

    await cueEngineService.stopCue('stoppable');
    expect(cueEngineService.getActiveCues()).toHaveLength(0);
  });

  it('should pause and resume a compound cue', async () => {
    cueEngineService.loadCues([{
      id: 'pausable', label: 'Pausable',
      timeline: [{ at: 0, action: 'sound:play', payload: {} }, { at: 60, action: 'sound:play', payload: {} }]
    }]);

    await cueEngineService.fireCue('pausable');
    await cueEngineService.pauseCue('pausable');
    expect(cueEngineService.getActiveCues()[0].state).toBe('paused');

    await cueEngineService.resumeCue('pausable');
    expect(cueEngineService.getActiveCues()[0].state).toBe('running');
  });
});

describe('compound cue nesting', () => {
  it('should fire nested cue via cue:fire in timeline', async () => {
    cueEngineService.loadCues([
      { id: 'child', label: 'Child', commands: [{ action: 'sound:play', payload: { file: 'child.wav' } }] },
      { id: 'parent', label: 'Parent', timeline: [
        { at: 0, action: 'cue:fire', payload: { cueId: 'child' } }
      ]}
    ]);

    await cueEngineService.fireCue('parent');
    await flushAsync();

    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cue:fire', payload: { cueId: 'child' } })
    );
  });

  it('should detect and prevent cycles', async () => {
    const errorHandler = jest.fn();
    cueEngineService.on('cue:error', errorHandler);

    cueEngineService.loadCues([
      { id: 'cycle-a', label: 'A', timeline: [{ at: 0, action: 'cue:fire', payload: { cueId: 'cycle-b' } }] },
      { id: 'cycle-b', label: 'B', timeline: [{ at: 0, action: 'cue:fire', payload: { cueId: 'cycle-a' } }] },
    ]);

    // This should not infinite loop — cycle detection stops it
    await cueEngineService.fireCue('cycle-a');
    await flushAsync();
    // Cycle-b tries to fire cycle-a but it's in the visited set
  });

  it('should cascade stop to children', async () => {
    cueEngineService.loadCues([
      { id: 'child-cue', label: 'Child',
        timeline: [{ at: 0, action: 'sound:play', payload: {} }, { at: 120, action: 'sound:play', payload: {} }] },
      { id: 'parent-cue', label: 'Parent',
        timeline: [{ at: 0, action: 'cue:fire', payload: { cueId: 'child-cue' } }, { at: 120, action: 'sound:play', payload: {} }] },
    ]);

    await cueEngineService.fireCue('parent-cue');
    await flushAsync();

    // Both parent and child should be active
    expect(cueEngineService.getActiveCues().length).toBeGreaterThanOrEqual(1);

    // Stop parent — child should also stop
    await cueEngineService.stopCue('parent-cue');
    expect(cueEngineService.getActiveCues()).toHaveLength(0);
  });
});

describe('video-driven compound cues', () => {
  it('should sync timeline to video:progress events', async () => {
    cueEngineService.loadCues([{
      id: 'video-cue', label: 'Video Cue',
      timeline: [
        { at: 0, action: 'video:play', payload: { file: 'test.mp4' } },
        { at: 30, action: 'lighting:scene:activate', payload: { sceneId: 'scene.dim' } },
      ]
    }]);

    await cueEngineService.fireCue('video-cue');
    await flushAsync();

    // Simulate video progress at 30 seconds
    cueEngineService.handleVideoProgress('video-cue', 30);
    await flushAsync();

    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'lighting:scene:activate' })
    );
  });

  it('should pause compound cue when video pauses', async () => {
    cueEngineService.loadCues([{
      id: 'video-pause-cue', label: 'VP',
      timeline: [
        { at: 0, action: 'video:play', payload: { file: 'test.mp4' } },
        { at: 60, action: 'sound:play', payload: { file: 'end.wav' } },
      ]
    }]);

    await cueEngineService.fireCue('video-pause-cue');
    cueEngineService.handleVideoPaused('video-pause-cue');
    expect(cueEngineService.getActiveCues()[0].state).toBe('paused');
  });
});

describe('timeline error handling (D36)', () => {
  it('should continue timeline when a command fails', async () => {
    const errorHandler = jest.fn();
    cueEngineService.on('cue:error', errorHandler);

    executeCommand.mockRejectedValueOnce(new Error('lighting failed'));
    executeCommand.mockResolvedValue({ success: true });

    cueEngineService.loadCues([{
      id: 'error-cue', label: 'Error Test',
      timeline: [
        { at: 0, action: 'lighting:scene:activate', payload: { sceneId: 'bad' } },
        { at: 0, action: 'sound:play', payload: { file: 'good.wav' } },
      ]
    }]);

    await cueEngineService.fireCue('error-cue');
    await flushAsync();

    // Error emitted for first command
    expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
      cueId: 'error-cue', action: 'lighting:scene:activate'
    }));
    // Second command still executed
    expect(executeCommand).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement compound cue engine**

Key additions to `cueEngineService.js`:

- `this.activeCues = new Map()` — tracks running compound cues with `{ cueId, state, startTime, elapsed, timeline, firedEntries, spawnedBy, children, hasVideo }`
- Modify `fireCue()` — if cue has `timeline`, start compound execution instead of simple command sequence
- `_startCompoundCue(cue, trigger, parentChain)` — creates active cue entry, fires `at: 0` entries immediately, subscribes to tick or video progress
- `_tickActiveCompoundCues(elapsed)` — called from game clock tick, advances clock-driven compound cues
- `handleVideoProgress(cueId, position)` — advances video-driven compound cues
- `handleVideoPaused(cueId)` / `handleVideoResumed(cueId)` — pause/resume video-driven cues
- `stopCue(cueId)` — stop cue + cascade to children via `spawnedBy` tracking
- `pauseCue(cueId)` / `resumeCue(cueId)` — pause/resume compound cue
- `getActiveCues()` — return array of `{ cueId, state, progress, duration }`
- Cycle detection: `parentChain` Set passed through `cue:fire` dispatch, max depth 5

**Step 4: Run tests — expect PASS**

**Step 5: Run full test suite**

```bash
npm test -- --verbose
```

**Step 6: Commit**

```bash
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat: add compound cue timeline engine with nesting, cascading stop, and video sync"
```

---

## Task 7: Video Conflict Detection

When a compound cue with video starts while something is playing, prompt the GM.

**Files:**
- Modify: `backend/src/services/cueEngineService.js` (conflict detection in `_startCompoundCue`)
- Modify: `backend/tests/unit/services/cueEngineService.test.js`

**Step 1: Write failing tests**

```javascript
describe('video conflict detection (D13, D37)', () => {
  it('should emit cue:conflict when video is already playing', async () => {
    const conflictHandler = jest.fn();
    cueEngineService.on('cue:conflict', conflictHandler);

    // Mock videoQueueService.isPlaying() to return true
    const videoQueueService = require('../../../src/services/videoQueueService');
    videoQueueService.isPlaying.mockReturnValue(true);
    videoQueueService.getCurrentVideo.mockReturnValue({ filename: 'current.mp4' });

    cueEngineService.loadCues([{
      id: 'conflict-cue', label: 'Conflict',
      timeline: [
        { at: 0, action: 'video:play', payload: { file: 'new.mp4' } },
        { at: 30, action: 'sound:play', payload: { file: 'hit.wav' } },
      ]
    }]);

    await cueEngineService.fireCue('conflict-cue');

    expect(conflictHandler).toHaveBeenCalledWith(expect.objectContaining({
      cueId: 'conflict-cue',
      currentVideo: 'current.mp4',
    }));
  });

  it('should start compound cue immediately when no video conflict', async () => {
    const videoQueueService = require('../../../src/services/videoQueueService');
    videoQueueService.isPlaying.mockReturnValue(false);

    cueEngineService.loadCues([{
      id: 'no-conflict', label: 'No Conflict',
      timeline: [
        { at: 0, action: 'video:play', payload: { file: 'new.mp4' } },
      ]
    }]);

    await cueEngineService.fireCue('no-conflict');
    await flushAsync();

    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'video:play' })
    );
  });

  it('should auto-cancel conflict after 10 seconds timeout', async () => {
    jest.useFakeTimers();
    const videoQueueService = require('../../../src/services/videoQueueService');
    videoQueueService.isPlaying.mockReturnValue(true);
    videoQueueService.getCurrentVideo.mockReturnValue({ filename: 'current.mp4' });

    cueEngineService.loadCues([{
      id: 'timeout-cue', label: 'Timeout',
      timeline: [{ at: 0, action: 'video:play', payload: { file: 'new.mp4' } }]
    }]);

    await cueEngineService.fireCue('timeout-cue');

    // Advance 10 seconds — should auto-cancel
    jest.advanceTimersByTime(10000);
    expect(cueEngineService.getActiveCues()).toHaveLength(0);

    jest.useRealTimers();
  });
});
```

**Step 2: Run tests — FAIL**

**Step 3: Implement conflict detection in _startCompoundCue**

Check if timeline contains a `video:play` action. If so, check `videoQueueService.isPlaying()`. If conflict, emit `cue:conflict` and set a 10-second auto-cancel timer. GM can resolve via `cue:fire` (override) or `cue:stop` (cancel) commands.

**Step 4: Run tests — PASS**

**Step 5: Commit**

```bash
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat: add video conflict detection with 10s auto-cancel for compound cues"
```

---

## Task 8: Wire Compound Cues to Video Progress

Connect cueEngineService to video events for video-driven compound cues.

**Files:**
- Modify: `backend/src/events/cueEngineWiring.js`
- Modify: `backend/tests/integration/cue-engine.test.js`

**Step 1: Add video:progress forwarding in cueEngineWiring.js**

```javascript
// Add to setupCueEngineForwarding():
listenerRegistry.addTrackedListener(
  videoQueueService, 'video:progress',
  (data) => {
    // Forward to cue engine for video-driven compound cue timeline advancement
    cueEngineService.handleVideoProgressEvent(data);
  },
  'videoQueue->video:progress->cueEngine'
);

listenerRegistry.addTrackedListener(
  videoQueueService, 'video:paused',
  (data) => cueEngineService.handleVideoLifecycleEvent('paused', data),
  'videoQueue->video:paused->cueEngine'
);

listenerRegistry.addTrackedListener(
  videoQueueService, 'video:resumed',
  (data) => cueEngineService.handleVideoLifecycleEvent('resumed', data),
  'videoQueue->video:resumed->cueEngine'
);

listenerRegistry.addTrackedListener(
  videoQueueService, 'video:completed',
  (data) => cueEngineService.handleVideoLifecycleEvent('completed', data),
  'videoQueue->video:completed->cueEngine'
);
```

**Step 2: Add clock tick forwarding for compound cues**

The existing `gameclock:tick → handleClockTick()` wiring already exists. Add compound cue tick advancement:

```javascript
// Modify the existing gameclock:tick handler:
listenerRegistry.addTrackedListener(
  gameClockService, 'gameclock:tick',
  (data) => {
    cueEngineService.handleClockTick(data.elapsed);
    cueEngineService._tickActiveCompoundCues(data.elapsed); // NEW: advance clock-driven compound cues
  },
  'gameClock->tick->cueEngine'
);
```

**Step 3: Run integration tests**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test -- --config jest.integration.config.js --verbose
```

**Step 4: Commit**

```bash
git add backend/src/events/cueEngineWiring.js
git commit -m "feat: wire video progress and lifecycle events to compound cue engine"
```

---

## Task 9: Broadcasts + sync:full — Phase 2 Events

Add compound cue and Spotify events to the broadcast layer.

**Files:**
- Modify: `backend/src/events/broadcasts.js`
- Modify: `backend/src/helpers/syncHelpers.js` (or wherever sync:full is built)
- Test: existing broadcast tests

**Step 1: Add Phase 2 broadcast listeners in broadcasts.js**

```javascript
// Compound cue lifecycle broadcasts
listenerRegistry.addTrackedListener(
  cueEngineService, 'cue:started',
  (data) => emitToGm(io, 'cue:status', { ...data, state: 'started' }),
  'cueEngine->cue:started->gm'
);

listenerRegistry.addTrackedListener(
  cueEngineService, 'cue:paused',
  (data) => emitToGm(io, 'cue:status', { ...data, state: 'paused' }),
  'cueEngine->cue:paused->gm'
);

listenerRegistry.addTrackedListener(
  cueEngineService, 'cue:conflict',
  (data) => emitToGm(io, 'cue:conflict', data),
  'cueEngine->cue:conflict->gm'
);

// Spotify broadcasts
listenerRegistry.addTrackedListener(
  spotifyService, 'playback:changed',
  () => emitToGm(io, 'spotify:status', spotifyService.getState()),
  'spotify->playback->gm'
);

listenerRegistry.addTrackedListener(
  spotifyService, 'volume:changed',
  () => emitToGm(io, 'spotify:status', spotifyService.getState()),
  'spotify->volume->gm'
);
```

**Step 2: Expand sync:full payload**

In the sync:full builder (likely `syncHelpers.js` or `stateService`), add:

```javascript
spotify: {
  connected: spotifyService.connected,
  state: spotifyService.state,
  volume: spotifyService.volume,
  cacheStatus: 'unchecked', // Updated after verify command
},
// cueEngine section already exists from Phase 1, add activeCues:
cueEngine: {
  loaded: cueEngineService.getCues().length > 0,
  cues: cueEngineService.getCueSummaries(),
  activeCues: cueEngineService.getActiveCues(),
  disabledCues: cueEngineService.getDisabledCues(),
},
```

**Step 3: Run tests**

```bash
npm test -- --verbose
```

**Step 4: Commit**

```bash
git add backend/src/events/broadcasts.js backend/src/helpers/syncHelpers.js
git commit -m "feat: add Phase 2 broadcasts for compound cue lifecycle and Spotify status"
```

---

## Task 10: Pause Cascade — Spotify Integration

Extend the session pause cascade to include Spotify.

**Files:**
- Modify: `backend/src/services/sessionService.js` (`updateSessionStatus`)
- Test: `backend/tests/unit/services/session-lifecycle-phase1.test.js` (rename to session-lifecycle.test.js)

**Step 1: Write failing test**

```javascript
describe('pause cascade includes Spotify', () => {
  it('should pause Spotify on session:pause', async () => {
    const spotifyService = require('../../../src/services/spotifyService');
    await sessionService.createSession({ name: 'Test' });
    await sessionService.startGame();
    await sessionService.updateSession({ status: 'paused' });
    expect(spotifyService.pauseForGameClock).toHaveBeenCalled();
  });

  it('should resume Spotify on session:resume only if pausedByGameClock', async () => {
    const spotifyService = require('../../../src/services/spotifyService');
    await sessionService.createSession({ name: 'Test' });
    await sessionService.startGame();
    await sessionService.updateSession({ status: 'paused' });
    await sessionService.updateSession({ status: 'active' });
    expect(spotifyService.resumeFromGameClock).toHaveBeenCalled();
  });
});
```

**Step 2: Run test — FAIL**

**Step 3: Add to updateSessionStatus()**

```javascript
case 'paused':
  gameClockService.pause();
  cueEngineService.suspend();
  spotifyService.pauseForGameClock();  // NEW
  break;
case 'active':
  if (previousStatus === 'paused') {
    gameClockService.resume();
    cueEngineService.activate();
    spotifyService.resumeFromGameClock();  // NEW
  }
  break;
```

**Step 4: Run tests — PASS**

**Step 5: Commit**

```bash
git add backend/src/services/sessionService.js backend/tests/unit/services/session-lifecycle*.test.js
git commit -m "feat: extend pause cascade to include Spotify via pausedByGameClock flag"
```

---

## Task 11: Service Initialization + Reset for Phase 2

Wire new services into app.js and systemReset.js.

**Files:**
- Modify: `backend/src/app.js`
- Modify: `backend/src/services/systemReset.js`

**Step 1: Add spotifyService to app.js initialization**

```javascript
// After Phase 1 service init, add:
const spotifyService = require('./services/spotifyService');
// Check connection (non-blocking, graceful if not available)
spotifyService.checkConnection().catch(err => {
  logger.warn('spotifyd not available:', err.message);
});
```

**Step 2: Add to systemReset.js**

In the service reset section:
```javascript
spotifyService.reset();
```

In the services object passed to setupCueEngineForwarding and setupBroadcastListeners, include spotifyService.

**Step 3: Run integration tests**

```bash
npm test -- --config jest.integration.config.js --verbose
```

**Step 4: Run full suite**

```bash
npm test -- --verbose
```

**Step 5: Commit**

```bash
git add backend/src/app.js backend/src/services/systemReset.js
git commit -m "feat: wire spotifyService into app initialization and system reset"
```

**Step 6: CHECKPOINT — Run bellwether E2E test 30**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx playwright test 30-full-game-session-multi-device.test.js
```

Expected: PASS — app.js initialization and systemReset changes haven't broken existing session lifecycle, scoring, or video flows. This checkpoint validates that new service wiring (spotifyService) is gracefully handled when spotifyd is not running.

---

## Task 12: GM Scanner — SpotifyController

New controller for GM Scanner Spotify commands.

**Files:**
- Create: `ALNScanner/src/admin/SpotifyController.js`
- Create: `ALNScanner/tests/unit/admin/SpotifyController.test.js`

**Step 1: Write failing tests (in ALNScanner submodule)**

```javascript
import SpotifyController from '../../../src/admin/SpotifyController.js';
import { sendCommand } from '../../../src/admin/utils/CommandSender.js';

jest.mock('../../../src/admin/utils/CommandSender.js', () => ({
  sendCommand: jest.fn().mockResolvedValue({ success: true, message: 'ok' })
}));

describe('SpotifyController', () => {
  let controller, mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new EventTarget();
    controller = new SpotifyController(mockClient);
  });

  afterEach(() => { controller.destroy(); });

  it('should send spotify:play', async () => {
    await controller.play();
    expect(sendCommand).toHaveBeenCalledWith(mockClient, 'spotify:play', {}, 5000);
  });

  it('should send spotify:pause', async () => {
    await controller.pause();
    expect(sendCommand).toHaveBeenCalledWith(mockClient, 'spotify:pause', {}, 5000);
  });

  it('should send spotify:next', async () => {
    await controller.next();
    expect(sendCommand).toHaveBeenCalledWith(mockClient, 'spotify:next', {}, 5000);
  });

  it('should send spotify:playlist with URI', async () => {
    await controller.setPlaylist('spotify:playlist:act2');
    expect(sendCommand).toHaveBeenCalledWith(
      mockClient, 'spotify:playlist', { uri: 'spotify:playlist:act2' }, 5000
    );
  });

  it('should send spotify:volume', async () => {
    await controller.setVolume(75);
    expect(sendCommand).toHaveBeenCalledWith(
      mockClient, 'spotify:volume', { volume: 75 }, 5000
    );
  });

  it('should send spotify:cache:verify', async () => {
    await controller.verifyCacheStatus();
    expect(sendCommand).toHaveBeenCalledWith(
      mockClient, 'spotify:cache:verify', {}, 10000
    );
  });
});
```

**Step 2: Run test in ALNScanner — FAIL**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm test -- --testPathPattern="SpotifyController" --verbose
```

**Step 3: Implement SpotifyController.js**

Follow same pattern as CueController — thin wrapper using sendCommand():

```javascript
import { sendCommand } from './utils/CommandSender.js';

export class SpotifyController {
  constructor(connection) { this.connection = connection; }

  async play(timeout = 5000) { return sendCommand(this.connection, 'spotify:play', {}, timeout); }
  async pause(timeout = 5000) { return sendCommand(this.connection, 'spotify:pause', {}, timeout); }
  async stop(timeout = 5000) { return sendCommand(this.connection, 'spotify:stop', {}, timeout); }
  async next(timeout = 5000) { return sendCommand(this.connection, 'spotify:next', {}, timeout); }
  async previous(timeout = 5000) { return sendCommand(this.connection, 'spotify:previous', {}, timeout); }
  async setPlaylist(uri, timeout = 5000) { return sendCommand(this.connection, 'spotify:playlist', { uri }, timeout); }
  async setVolume(volume, timeout = 5000) { return sendCommand(this.connection, 'spotify:volume', { volume }, timeout); }
  async verifyCacheStatus(timeout = 10000) { return sendCommand(this.connection, 'spotify:cache:verify', {}, timeout); }
  destroy() {}
}

export default SpotifyController;
```

**Step 4: Run tests — PASS**

**Step 5: Add SpotifyController to AdminController initialization**

In `ALNScanner/src/app/adminController.js`, import and add:
```javascript
import { SpotifyController } from '../admin/SpotifyController.js';
// In initialize():
spotifyController: new SpotifyController(this.client),
```

**Step 6: Add to orchestratorClient messageTypes (REQUIRED)**

**CRITICAL:** `spotify:status` and `cue:conflict` are **NOT** in the messageTypes array and **MUST** be added. Without them, GM Scanner silently drops these events. `cue:status` is already present from Phase 1.

In `ALNScanner/src/network/orchestratorClient.js`, add to the `messageTypes` array (lines ~240-273):
```javascript
'spotify:status',
'cue:conflict',
```

**Step 7: Commit in submodule, then parent**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/admin/SpotifyController.js tests/unit/admin/SpotifyController.test.js \
  src/app/adminController.js src/network/orchestratorClient.js
git commit -m "feat(phase2): add SpotifyController and wire to AdminController"

cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add ALNScanner
git commit -m "feat: update ALNScanner submodule with SpotifyController"
```

---

## Task 13: GM Scanner — Active Cues UI + Now Playing

Extend MonitoringDisplay with compound cue progress and Spotify status.

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js`
- Create: `ALNScanner/tests/unit/admin/MonitoringDisplay-phase2.test.js`

**Step 1: Write failing tests**

```javascript
describe('MonitoringDisplay - Phase 2', () => {
  // ... standard setup with mockClient, mockDataManager, display ...

  describe('cue:status (compound cue progress)', () => {
    it('should render active compound cue in Active Cues list', () => {
      const syncData = {
        cueEngine: {
          loaded: true,
          cues: [{ id: 'opening', label: 'Opening Sequence', quickFire: true }],
          activeCues: [{ cueId: 'opening', state: 'running', progress: 30, duration: 120 }],
        }
      };
      display.updateAllDisplays(syncData);
      const activeCuesList = document.getElementById('active-cues-list');
      expect(activeCuesList.textContent).toContain('Opening Sequence');
    });

    it('should update compound cue progress from cue:status event', () => {
      const event = new CustomEvent('message:received', {
        detail: { type: 'cue:status', payload: { cueId: 'opening', state: 'running', progress: 45, duration: 120 } }
      });
      mockClient.dispatchEvent(event);
      // Verify progress indicator updated
    });

    it('should remove compound cue when cue:completed received', () => {
      // First add an active cue
      display.updateAllDisplays({
        cueEngine: {
          loaded: true, cues: [],
          activeCues: [{ cueId: 'opening', state: 'running', progress: 30, duration: 120 }],
        }
      });
      // Then complete it
      const event = new CustomEvent('message:received', {
        detail: { type: 'cue:completed', payload: { cueId: 'opening' } }
      });
      mockClient.dispatchEvent(event);
      const activeCuesList = document.getElementById('active-cues-list');
      expect(activeCuesList.textContent).not.toContain('Opening Sequence');
    });
  });

  describe('cue:conflict', () => {
    it('should show conflict toast with Override and Cancel buttons', () => {
      const event = new CustomEvent('message:received', {
        detail: { type: 'cue:conflict', payload: {
          cueId: 'evidence-reel', reason: 'Video conflict', currentVideo: 'opening.mp4'
        }}
      });
      mockClient.dispatchEvent(event);
      // Toast should contain Override and Cancel
      expect(display.showToast).toHaveBeenCalledWith(
        expect.stringContaining('evidence-reel'),
        'warning',
        expect.any(Number)
      );
    });
  });

  describe('spotify:status', () => {
    it('should update Now Playing section', () => {
      const event = new CustomEvent('message:received', {
        detail: { type: 'spotify:status', payload: {
          connected: true, state: 'playing', track: { title: 'Noir Jazz', artist: 'Various' }, volume: 80
        }}
      });
      mockClient.dispatchEvent(event);
      // Now Playing should show track info
    });
  });
});
```

**Step 2: Run tests — FAIL**

**Step 3: Implement MonitoringDisplay handlers**

Add to the `_handleMessage()` switch:
- `case 'cue:status'`: Update active cues list (progress bar, state indicator)
- `case 'cue:conflict'`: Show conflict toast with [Override] [Cancel] buttons
- `case 'spotify:status'`: Update Now Playing section

Add rendering methods:
- `_renderActiveCues(activeCues)` — list with progress bars, pause/stop buttons
- `_renderNowPlaying(spotifyState)` — track info, transport controls, volume slider

Add to `updateAllDisplays()`:
- Render active cues from `syncData.cueEngine.activeCues`
- Render Now Playing from `syncData.spotify`

**Step 4: Add DOM event routing for new buttons**

In `domEventBindings.js`, add cases for:
- `'pauseCue'` → `cueController.pauseCue(cueId)`
- `'stopCue'` → `cueController.stopCue(cueId)`
- `'resumeCue'` → `cueController.resumeCue(cueId)`
- `'spotifyPlay'` → `spotifyController.play()`
- `'spotifyPause'` → `spotifyController.pause()`
- `'spotifyNext'` → `spotifyController.next()`
- `'spotifyPrevious'` → `spotifyController.previous()`

Also update CueController to add `pauseCue()`, `stopCue()`, `resumeCue()` methods.

**Step 5: Run GM Scanner tests**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm test -- --verbose
```

**Step 6: Commit submodule then parent**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/admin/MonitoringDisplay.js src/admin/CueController.js \
  src/utils/domEventBindings.js tests/unit/admin/MonitoringDisplay-phase2.test.js
git commit -m "feat(phase2): add Active Cues progress, Now Playing, and conflict UI"

cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add ALNScanner
git commit -m "feat: update ALNScanner submodule with Phase 2 UI"
```

---

## Task 14: Phase 2 Integration Tests

End-to-end tests for compound cues and Spotify commands.

**Files:**
- Create: `backend/tests/integration/compound-cues.test.js`
- Modify: `backend/tests/helpers/service-reset.js` (add spotifyService)

**Step 1: Write integration tests**

```javascript
describe('Compound Cue Integration', () => {
  // Use standard integration test setup pattern

  it('should fire compound cue and receive cue:status broadcasts', async () => {
    // Load cues with a compound cue
    // Start session
    // Fire compound cue
    // Verify cue:status broadcast received
  });

  it('should detect video conflict and broadcast cue:conflict', async () => {
    // Start a video playing
    // Fire a compound cue with video
    // Verify cue:conflict broadcast
  });

  it('should cascade stop from parent to child compound cues', async () => {
    // Fire parent compound cue that nests child
    // Stop parent
    // Verify both stopped
  });
});

describe('Spotify Command Integration', () => {
  it('should execute spotify:play and broadcast spotify:status', async () => {
    // Mock spotifyService at integration level
    // Send spotify:play command
    // Verify ack and broadcast
  });
});
```

**Step 2: Add spotifyService to service-reset.js**

**Step 3: Run integration tests**

```bash
npm test -- --config jest.integration.config.js --verbose
```

**Step 4: Run full test suites (backend + ALNScanner)**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npm test -- --verbose
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm test -- --verbose
```

**Step 5: Commit**

```bash
git add backend/tests/integration/compound-cues.test.js backend/tests/helpers/service-reset.js
git commit -m "test: add Phase 2 integration tests for compound cues and Spotify"
```

**Step 6: CHECKPOINT — Extend and run bellwether E2E test 30**

Extend test 30 to cover Phase 2 lifecycle events. Add assertions for:
- `spotify:status` broadcast received by GMs after spotify commands
- `cue:status` broadcasts received during compound cue execution
- Compound cue stop/pause/resume lifecycle
- Pause cascade includes spotify state tracking

Add these assertions near the existing environment control section of test 30. The test should verify that:

```javascript
// After environment control setup assertions, add:
// --- Phase 2: Compound Cues + Spotify ---

// Spotify command broadcasts spotify:status to all GMs
await gm1.sendCommand('spotify:play', {});
const spotifyStatus = await gm2.waitForEvent('spotify:status');
expect(spotifyStatus.state).toBe('playing');

// Compound cue fires and broadcasts cue:status
await gm1.sendCommand('cue:fire', { cueId: 'test-compound' });
const cueStatus = await gm1.waitForEvent('cue:status');
expect(cueStatus.state).toBe('started');

// Session pause cascades to Spotify
await gm1.sendCommand('session:pause', {});
const pausedSpotify = await gm1.waitForEvent('spotify:status');
expect(pausedSpotify.state).toBe('paused');
```

Run the extended test:

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx playwright test 30-full-game-session-multi-device.test.js
```

Expected: PASS — both existing flows and new Phase 2 assertions pass.

Commit the test extension:

```bash
git add backend/tests/e2e/flows/30-full-game-session-multi-device.test.js
git commit -m "test: extend bellwether E2E test 30 with Phase 2 compound cue and Spotify assertions"
```

---

## Task 15: Phase 2 CLAUDE.md Updates

Update documentation to reflect Phase 2 changes.

**Files:**
- Modify: `backend/CLAUDE.md` (new services, events, commands)
- Modify: `ALNScanner/CLAUDE.md` (new controllers, UI sections)
- Modify: `CLAUDE.md` (root — event list update)

**Step 1: Update all three CLAUDE.md files**

Add spotifyService, compound cue lifecycle, new gm:command actions, new broadcast events.

**Step 2: Commit**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Phase 2 compound cues and Spotify"

cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add backend/CLAUDE.md CLAUDE.md ALNScanner
git commit -m "docs: update CLAUDE.md files for Phase 2 implementation"
```

---

# PHASE 3: Multi-Speaker Routing + Ducking

---

## Task 16: AsyncAPI Contract — Phase 3 Events

**Files:**
- Modify: `backend/contracts/asyncapi.yaml`

**Step 1: Add ducking and expanded routing schemas**

Add `audio:ducking:status` event and expand `audio:route:set` payload to include combine-sink options and per-stream routing.

**Step 2: Commit**

```bash
git add backend/contracts/asyncapi.yaml
git commit -m "feat(contracts): add Phase 3 AsyncAPI events for ducking and multi-speaker routing"
```

---

## Task 17: PipeWire Combine-Sink Management

Create/manage a virtual combine-sink that forwards to both BT speakers.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js`
- Modify: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Write failing tests**

```javascript
describe('combine-sink management', () => {
  it('should create combine-sink from two BT speakers', async () => {
    jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
      { name: 'bluez_output.AA.a2dp', type: 'bluetooth' },
      { name: 'bluez_output.BB.a2dp', type: 'bluetooth' },
    ]);
    mockExecFileSuccess(''); // pw-loopback creation

    await audioRoutingService.createCombineSink();
    expect(execFile).toHaveBeenCalledWith(
      expect.stringContaining('pw-loopback'),
      expect.any(Array),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should return combine-bt as available sink', async () => {
    audioRoutingService._combineSinkActive = true;
    const sinks = await audioRoutingService.getAvailableSinksWithCombine();
    expect(sinks.some(s => s.name === 'combine-bt')).toBe(true);
  });

  it('should tear down combine-sink on cleanup', async () => {
    audioRoutingService._combineSinkActive = true;
    audioRoutingService._combineSinkPids = [123, 456];
    await audioRoutingService.destroyCombineSink();
    expect(audioRoutingService._combineSinkActive).toBe(false);
  });
});
```

**Step 2: Run tests — FAIL**

**Step 3: Implement combine-sink using pw-loopback**

PipeWire `pw-loopback` creates virtual routing nodes. Use two instances to fork audio to both BT speakers. Alternative: use `libpipewire-module-combine-stream` via `pw-cli`.

Track PIDs for cleanup. Auto-create when two BT speakers are connected, auto-destroy when either disconnects.

**Step 4: Run tests — PASS**

**Step 5: Commit**

```bash
git add backend/src/services/audioRoutingService.js backend/tests/unit/services/audioRoutingService.test.js
git commit -m "feat: add PipeWire combine-sink management for multi-speaker output"
```

---

## Task 18: Ducking Engine

Event-driven automatic volume ducking.

**Files:**
- Modify: `backend/src/services/audioRoutingService.js` (add ducking methods)
- Modify: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Write failing tests**

```javascript
describe('ducking engine', () => {
  it('should duck Spotify when video starts', async () => {
    const setVolume = jest.spyOn(audioRoutingService, 'setStreamVolume').mockResolvedValue();
    audioRoutingService.loadDuckingRules([
      { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
    ]);

    audioRoutingService.handleDuckingEvent('video', 'started');
    expect(setVolume).toHaveBeenCalledWith('spotify', 20);
  });

  it('should restore Spotify when video completes', async () => {
    const setVolume = jest.spyOn(audioRoutingService, 'setStreamVolume').mockResolvedValue();
    audioRoutingService.loadDuckingRules([
      { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
    ]);

    audioRoutingService.handleDuckingEvent('video', 'started');
    audioRoutingService.handleDuckingEvent('video', 'completed');
    // Second call should restore to original volume
    expect(setVolume).toHaveBeenLastCalledWith('spotify', 100);
  });

  it('should duck lighter for sound effects', async () => {
    const setVolume = jest.spyOn(audioRoutingService, 'setStreamVolume').mockResolvedValue();
    audioRoutingService.loadDuckingRules([
      { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 }
    ]);

    audioRoutingService.handleDuckingEvent('sound', 'started');
    expect(setVolume).toHaveBeenCalledWith('spotify', 40);
  });

  it('should not restore if another ducking source is still active', async () => {
    const setVolume = jest.spyOn(audioRoutingService, 'setStreamVolume').mockResolvedValue();
    audioRoutingService.loadDuckingRules([
      { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
      { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 },
    ]);

    audioRoutingService.handleDuckingEvent('video', 'started'); // Duck to 20
    audioRoutingService.handleDuckingEvent('sound', 'started'); // Also active
    audioRoutingService.handleDuckingEvent('sound', 'completed'); // Sound done
    // Should NOT restore — video is still ducking
    expect(setVolume).not.toHaveBeenLastCalledWith('spotify', 100);
  });
});
```

**Step 2: Run tests — FAIL**

**Step 3: Implement ducking engine**

- `loadDuckingRules(rules)` — loads from `routing.json`
- `handleDuckingEvent(stream, lifecycle)` — called when video/sound starts/completes
- Track active ducking sources per target stream
- Use lowest `to` value when multiple sources are active
- Store pre-duck volume for restoration
- Ducking engine subscribes to videoQueueService and soundService events (wired in broadcasts.js or cueEngineWiring.js)

**Step 4: Run tests — PASS**

**Step 5: Wire ducking to service events**

In `broadcasts.js` or a new `duckingWiring.js`:

```javascript
videoQueueService.on('video:started', () => audioRoutingService.handleDuckingEvent('video', 'started'));
videoQueueService.on('video:completed', () => audioRoutingService.handleDuckingEvent('video', 'completed'));
videoQueueService.on('video:paused', () => audioRoutingService.handleDuckingEvent('video', 'paused'));
videoQueueService.on('video:resumed', () => audioRoutingService.handleDuckingEvent('video', 'resumed'));
soundService.on('sound:started', () => audioRoutingService.handleDuckingEvent('sound', 'started'));
soundService.on('sound:completed', () => audioRoutingService.handleDuckingEvent('sound', 'completed'));
```

**Step 6: Commit**

```bash
git add backend/src/services/audioRoutingService.js backend/tests/unit/services/audioRoutingService.test.js
git commit -m "feat: add event-driven ducking engine for automatic Spotify volume management"
```

---

## Task 19: Routing Inheritance in Cue Engine

Resolve 3-tier routing (global → compound cue → command) at dispatch time.

**Files:**
- Modify: `backend/src/services/cueEngineService.js`
- Modify: `backend/tests/unit/services/cueEngineService.test.js`

**Step 1: Write failing tests**

```javascript
describe('routing inheritance (D9, D51)', () => {
  it('should resolve command-level target override', async () => {
    cueEngineService.loadCues([{
      id: 'routing-test', label: 'Routing',
      routing: { sound: 'bt-right' },
      timeline: [
        { at: 0, action: 'sound:play', payload: { file: 'door.wav', target: 'bt-left' } },
      ]
    }]);

    await cueEngineService.fireCue('routing-test');
    await flushAsync();

    // Command-level target wins over cue-level routing
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ target: 'bt-left' })
      })
    );
  });

  it('should resolve cue-level routing when no command target', async () => {
    cueEngineService.loadCues([{
      id: 'cue-routing', label: 'Cue Route',
      routing: { sound: 'bt-right' },
      timeline: [
        { at: 0, action: 'sound:play', payload: { file: 'glass.wav' } },
      ]
    }]);

    await cueEngineService.fireCue('cue-routing');
    await flushAsync();

    // Cue-level routing injected into payload
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ target: 'bt-right' })
      })
    );
  });

  it('should fall back to global routing when no cue or command target', async () => {
    cueEngineService.loadCues([{
      id: 'global-routing', label: 'Global',
      timeline: [
        { at: 0, action: 'sound:play', payload: { file: 'plain.wav' } },
      ]
    }]);

    await cueEngineService.fireCue('global-routing');
    await flushAsync();

    // No target injected — audioRoutingService handles global routing at play time
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.not.objectContaining({ target: expect.anything() })
      })
    );
  });
});
```

**Step 2: Run tests — FAIL**

**Step 3: Implement routing resolution in compound cue dispatch**

When dispatching a timeline command in `_executeTimelineEntry()`:
1. Check if command payload has `target` → use it
2. Else check if cue definition has `routing[streamType]` → inject as `target`
3. Else leave payload as-is (global routing resolves at service level)

Stream type derived from action prefix: `sound:play` → `sound`, `video:play` → `video`.

**Step 4: Run tests — PASS**

**Step 5: Commit**

```bash
git add backend/src/services/cueEngineService.js backend/tests/unit/services/cueEngineService.test.js
git commit -m "feat: add 3-tier routing inheritance resolution in compound cue dispatch"
```

---

## Task 20: GM Scanner — Per-Stream Routing Dropdowns

Replace Phase 0 HDMI/Bluetooth radio with per-stream dropdowns.

**Files:**
- Modify: `ALNScanner/src/admin/MonitoringDisplay.js` (audio routing section)
- Modify: `ALNScanner/src/admin/AudioController.js` (expand for multi-stream)
- Create: `ALNScanner/tests/unit/admin/MonitoringDisplay-phase3.test.js`

**Step 1: Write failing tests**

```javascript
describe('MonitoringDisplay - Phase 3 Audio Routing', () => {
  it('should render per-stream routing dropdowns', () => {
    const syncData = {
      environment: {
        audio: {
          routes: {
            video: { sink: 'combine-bt', fallback: 'hdmi' },
            spotify: { sink: 'combine-bt', fallback: 'hdmi' },
            sound: { sink: 'combine-bt', fallback: 'hdmi' },
          },
          availableSinks: [
            { name: 'hdmi', label: 'HDMI' },
            { name: 'bluez_output.AA', label: 'BT Speaker 1' },
            { name: 'bluez_output.BB', label: 'BT Speaker 2' },
            { name: 'combine-bt', label: 'Both BT Speakers' },
          ]
        }
      }
    };
    display.updateAllDisplays(syncData);

    const videoDropdown = document.querySelector('[data-stream="video"]');
    expect(videoDropdown).toBeTruthy();
    expect(videoDropdown.options.length).toBe(4);
  });
});
```

**Step 2: Run test — FAIL**

**Step 3: Implement per-stream dropdowns**

Replace the existing audio routing section with three dropdown selectors (Video Audio, Spotify Music, Sound Effects), each populated from available sinks. On change, send `audio:route:set` command with `{ stream, sink }`.

**Step 4: Run tests — PASS**

**Step 5: Commit submodule then parent**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add src/admin/MonitoringDisplay.js src/admin/AudioController.js \
  tests/unit/admin/MonitoringDisplay-phase3.test.js
git commit -m "feat(phase3): add per-stream routing dropdowns with combine-sink support"

cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add ALNScanner
git commit -m "feat: update ALNScanner submodule with Phase 3 routing UI"
```

---

## Task 21: Phase 3 Integration Tests

**Files:**
- Create: `backend/tests/integration/audio-routing-phase3.test.js`

**Step 1: Write integration tests**

Test end-to-end: ducking activates when video starts, restores when video completes. Per-stream volume commands work. Combine-sink creation/destruction.

**Step 2: Run integration tests**

```bash
npm test -- --config jest.integration.config.js --verbose
```

**Step 3: Commit**

```bash
git add backend/tests/integration/audio-routing-phase3.test.js
git commit -m "test: add Phase 3 integration tests for multi-speaker routing and ducking"
```

---

## Task 22: Phase 3 CLAUDE.md Updates + Final Verification

**Step 1: Update CLAUDE.md files**

Add ducking rules, combine-sink, routing inheritance to backend and ALNScanner CLAUDE.md files.

**Step 2: Extend bellwether E2E test 30 with Phase 3 assertions**

Add to test 30 to cover Phase 3 lifecycle events:

```javascript
// --- Phase 3: Multi-Speaker Routing + Ducking ---

// Per-stream routing command
await gm1.sendCommand('audio:route:set', { stream: 'spotify', sink: 'combine-bt' });
// Verify routing is reflected in sync:full after reconnect

// Ducking: video playback ducks Spotify volume
// (verify spotify volume adjusts when video starts, restores when video completes)
```

Commit:
```bash
git add backend/tests/e2e/flows/30-full-game-session-multi-device.test.js
git commit -m "test: extend bellwether E2E test 30 with Phase 3 routing and ducking assertions"
```

**Step 3: Run ALL tests**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npm test -- --verbose
npm test -- --config jest.integration.config.js --verbose

cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
npm test -- --verbose
```

Expected: All tests pass. Baseline should increase by the number of new tests added.

**Step 4: FINAL CHECKPOINT — Run bellwether E2E test 30**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend
npx playwright test 30-full-game-session-multi-device.test.js
```

Expected: PASS — the fully extended test 30 now covers the complete environment control stack including Phase 1 (game clock, simple cues, sound), Phase 2 (compound cues, Spotify, pause cascade), and Phase 3 (multi-speaker routing, ducking). This is the final regression gate before merge.

**Step 5: Update roadmap document**

Mark Phases 2 and 3 as complete in `docs/plans/2026-02-13-environment-control-roadmap.md`.

**Step 6: Final commits**

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Phase 3 multi-speaker routing and ducking"

cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add ALNScanner backend/CLAUDE.md CLAUDE.md docs/plans/
git commit -m "docs: update CLAUDE.md files and roadmap for Phases 2-3 completion"
```

---

## Merge Checklist

When all tasks are complete and verified:

1. **ALNScanner submodule merge:**
   ```bash
   cd ALNScanner
   git checkout main
   git merge phase2/compound-cues-spotify
   git push
   ```

2. **Parent repo — update submodule ref:**
   ```bash
   cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
   git checkout phase2/compound-cues-spotify
   cd ALNScanner && git checkout main && cd ..
   git add ALNScanner
   git commit -m "chore: update ALNScanner submodule to merged main"
   ```

3. **Parent repo merge:**
   ```bash
   git checkout main
   git merge phase2/compound-cues-spotify
   git push
   ```

4. **Verify clean state:**
   ```bash
   git submodule status --recursive
   git submodule update --init --recursive
   ```

---

## Task Dependency Graph

```
Task 0: Branch Setup
  ├── Task 1: AsyncAPI Contracts (Phase 2)
  ├── Task 2: audioRoutingService expansion ──────────────────┐
  ├── Task 3: Overtime via game clock                         │
  ├── Task 4: spotifyService ─────────────┐                   │
  │                                        │                   │
  ├── Task 5: commandExecutor new actions ←┘                   │
  │     (depends on Task 4)                                    │
  │                                                            │
  ├── Task 6: Compound cue timeline engine                     │
  │     ├── Task 7: Video conflict detection                   │
  │     └── Task 8: Wire to video progress                     │
  │                                                            │
  ├── Task 9: Broadcasts + sync:full ←── Tasks 4,6            │
  ├── Task 10: Pause cascade + Spotify ←── Task 4             │
  ├── Task 11: Service init + reset ←── Task 4                │
  │                                                            │
  ├── Task 12: GM Scanner SpotifyController (submodule)        │
  ├── Task 13: GM Scanner Active Cues + Now Playing (submodule)│
  │                                                            │
  ├── Task 14: Phase 2 integration tests ←── Tasks 1-13       │
  ├── Task 15: Phase 2 CLAUDE.md updates                       │
  │                                                            │
  ├── Task 16: AsyncAPI Contracts (Phase 3)                    │
  ├── Task 17: Combine-sink management ←── Task 2 ────────────┘
  ├── Task 18: Ducking engine ←── Task 17
  ├── Task 19: Routing inheritance ←── Task 6
  ├── Task 20: GM Scanner per-stream routing (submodule)
  ├── Task 21: Phase 3 integration tests ←── Tasks 16-20
  └── Task 22: Phase 3 CLAUDE.md + final verification
```

**Parallelizable groups:**
- Tasks 2, 3, 4 can run in parallel (independent services)
- Tasks 6, 12 can run in parallel (backend vs GM Scanner)
- Tasks 17, 19 can run in parallel after Task 6 is done
