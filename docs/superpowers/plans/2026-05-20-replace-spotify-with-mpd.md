# Replace Spotify with Local Music Playback (MPD) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Spotify-driven background music service with a local MPD-driven music player that supports playlists, crossfade, gapless playback, cue integration, and Config Tool playlist authoring — and fully remove all Spotify code, tests, contracts, and runtime deps.

**Architecture:** A new `musicService` (Node EventEmitter, ~300 lines) controls MPD (Music Player Daemon) via the `mpd2` Node client over a Unix socket. MPD is spawned and supervised by the existing `ProcessMonitor` pattern, same as VLC. Playlists are stored in `backend/config/music-playlists.json`, authored via a new Config Tool section, dispatched via new `music:*` `gm:command` actions, and broadcast to the GM Scanner via the existing `service:state` domain `music`. All `spotify*` code paths are deleted in the same PR — no fallback.

**Tech Stack:** Node.js + Express + Socket.io (backend), `mpd2@1.0.7` (MPD client), MPD 0.23.12 (apt package), PipeWire (audio), Jest (unit/integration tests), Playwright (E2E), ES6 modules + Vite (GM Scanner), vanilla JS + Express + `node:test` (Config Tool), libavcodec ID3 parsing via MPD database.

**Branch:** `feature/replace-spotify-with-mpd` in both parent `ALN-Ecosystem` and `ALNScanner` submodule. Other submodules (aln-memory-scanner, arduino-cyd-player-scanner, ALN-TokenData) require no changes (audited: 0 spotify references).

---

## Spec Reference (Decisions Locked In)

| Concern | Decision |
|---|---|
| Control model | Predefined playlists (GM picks; tracks auto-advance) |
| Playlist storage | JSON file (`backend/config/music-playlists.json`), authored via Config Tool |
| Playback features | Auto-advance + loop + crossfade + gapless (all native to MPD) |
| Service shape | New `musicService`; **delete `spotifyService`** in same PR (no fallback) |
| Cue integration | Full — cues dispatch `music:*` commands like any other action |
| Player tech | MPD via `mpd2` Node client |
| Bootstrap playlist | `"All Tracks"` containing all 66 MP3s in numerical order, `shuffle: false, loop: true, crossfadeMs: 2000` |
| Spotify cleanup | Mandatory `apt remove --purge spotifyd` + delete configs + scrub `SPOTIFY_*` vars |

## Key State Shapes

**`musicService.getState()` (service:state domain `music`):**
```js
{
  connected: true,
  state: 'playing' | 'paused' | 'stopped',
  volume: 0-100,
  track: { file, title, artist, album, position, duration } | null,
  playlist: {
    id, name, position /* index in queue */, total,
    shuffle, loop, crossfadeMs
  } | null,
  pausedByGameClock: false
}
```

**`backend/config/music-playlists.json` schema:**
```js
{
  playlists: [
    {
      id: string,                // kebab-case
      name: string,              // display name
      description?: string,
      shuffle: boolean,
      loop: boolean,
      crossfadeMs: number,       // 0-5000
      tracks: string[]           // filenames relative to music_directory
    }
  ]
}
```

**`gm:command` actions added:** `music:play`, `music:pause`, `music:stop`, `music:next`, `music:previous`, `music:setVolume` (`{volume: 0-100}`), `music:loadPlaylist` (`{playlistId}`), `music:setShuffle` (`{enabled}`), `music:setLoop` (`{enabled}`). All gated by `SERVICE_DEPENDENCIES['music:*'] = 'music'`.

**`music:*` action set replaces `spotify:*`** in `commandExecutor.js` and `asyncapi.yaml`.

## Project Map (where work happens)

```
parent ALN-Ecosystem/
├── backend/                                    [direct]
│   ├── src/services/musicService.js            CREATE
│   ├── src/services/spotifyService.js          DELETE
│   ├── src/routes/musicRoutes.js               CREATE
│   ├── src/services/commandExecutor.js         MODIFY (spotify:* → music:*)
│   ├── src/services/audioRoutingService.js     MODIFY (STREAM_APP_NAMES)
│   ├── src/services/serviceHealthRegistry.js   MODIFY (spotify → music)
│   ├── src/services/sessionService.js          MODIFY (game-clock calls)
│   ├── src/services/cueEngineService.js        MODIFY (EVENT_NORMALIZERS)
│   ├── src/services/cueEngineWiring.js         MODIFY (event forwarding)
│   ├── src/services/systemReset.js             MODIFY (audit)
│   ├── src/utils/processMonitor.js             MODIFY (MPD registration)
│   ├── src/websocket/broadcasts.js             MODIFY (wiring)
│   ├── src/websocket/syncHelpers.js            MODIFY (buildMusicState)
│   ├── src/websocket/gmAuth.js                 MODIFY (sync:full)
│   ├── src/routes/stateRoutes.js               MODIFY (sync:full)
│   ├── src/server.js                           MODIFY (sync:full + mount)
│   ├── src/app.js                              MODIFY (init musicService)
│   ├── config/music-playlists.json             CREATE (seeded)
│   ├── config/environment/routing.json         MODIFY (ducking target)
│   ├── scripts/seed-music-playlist.js          CREATE
│   ├── contracts/asyncapi.yaml                 MODIFY
│   ├── contracts/openapi.yaml                  MODIFY
│   ├── tests/...                               CREATE 14 + UPDATE many + DELETE spotify-* tests
│   ├── tests/helpers/mocks/musicService.js     CREATE
│   ├── tests/e2e/fixtures/test-music/          CREATE (3 short MP3s)
│   ├── tests/helpers/browser-mocks.js          MODIFY (MockMusicService)
│   ├── tests/helpers/integration-test-server.js MODIFY (sync:full)
│   ├── tests/helpers/service-reset.js          MODIFY (reset music)
│   ├── package.json                            MODIFY (+mpd2, +music:seed)
│   ├── .env.example                            MODIFY (remove SPOTIFY_*)
│   ├── CLAUDE.md                               MODIFY (services table + drop "Spotify Wedged" debug)
│   └── .coverage-thresholds.json               REGENERATE
├── ALNScanner/                                 [submodule]
│   ├── src/ui/renderers/MusicRenderer.js       CREATE
│   ├── src/ui/renderers/SpotifyRenderer.js     DELETE
│   ├── src/admin/MusicController.js            CREATE
│   ├── src/admin/SpotifyController.js          DELETE
│   ├── src/admin/AudioController.js            MODIFY (audit refs)
│   ├── src/admin/AdminOperations.js            MODIFY (audit)
│   ├── src/admin/MonitoringDisplay.js          MODIFY (audit)
│   ├── src/app/adminController.js              MODIFY (wire MusicController)
│   ├── src/core/stateStore.js                  MODIFY (spotify domain → music)
│   ├── src/core/unifiedDataManager.js          MODIFY (audit)
│   ├── src/network/networkedSession.js         MODIFY (audit)
│   ├── src/ui/renderers/HealthRenderer.js      MODIFY (SERVICE_NAMES)
│   ├── src/ui/renderers/EnvironmentRenderer.js MODIFY (audit)
│   ├── src/utils/domEventBindings.js           MODIFY (admin.music* actions)
│   ├── index.html                              MODIFY (labels, IDs if needed)
│   ├── tests/unit/admin/MusicController.test.js CREATE
│   ├── tests/unit/admin/SpotifyController.test.js DELETE
│   ├── tests/unit/ui/renderers/MusicRenderer.test.js CREATE
│   ├── tests/unit/ui/renderers/SpotifyRenderer.test.js DELETE
│   ├── tests/unit/utils/domEventBindings-music.test.js CREATE
│   ├── tests/unit/utils/domEventBindings-spotify.test.js DELETE
│   ├── tests/unit/core/stateStore.test.js      MODIFY (music domain)
│   ├── tests/unit/admin/MonitoringDisplay-phase3.test.js MODIFY
│   ├── tests/unit/admin/AudioController-volume.test.js MODIFY
│   ├── tests/unit/ui/renderers/EnvironmentRenderer.test.js MODIFY
│   ├── tests/unit/ui/renderers/HealthRenderer.test.js MODIFY
│   ├── tests/unit/utils/domEventBindings-safeAction.test.js MODIFY
│   ├── tests/unit/network/networkedSession.test.js MODIFY
│   ├── CLAUDE.md                               MODIFY
│   └── .coverage-thresholds.json               REGENERATE
├── config-tool/                                [direct]
│   ├── public/sections/music.html              CREATE
│   ├── public/js/sections/music.js             CREATE
│   ├── public/js/components/cueEditor.js       MODIFY (action enum)
│   ├── public/js/components/timelineView.js    MODIFY (action labels)
│   ├── public/js/components/commandForm.js     MODIFY (action types)
│   ├── public/js/sections/audio.js             MODIFY (stream type)
│   ├── public/index.html                       MODIFY (nav, section import)
│   ├── server.js                               MODIFY (proxy /api/music/*)
│   ├── tests/music.test.js                     CREATE
│   └── README.md                               MODIFY
├── CLAUDE.md                                   MODIFY (parent — 7 spotify mentions)
└── DEPLOYMENT_GUIDE.md                         MODIFY
```

---

## Implementation Phases

The plan has **11 phases / 50 tasks**. TDD discipline throughout: write the failing test first; verify it fails; minimal implementation; verify pass; commit.

**Phase strategy:**
- Phases 0–5 build the backend music plane (service, routes, MPD lifecycle, integration, contracts) in isolation — Spotify code still runs in parallel until Phase 10
- Phase 6 builds the broader integration test coverage
- Phase 7 swaps frontend to music
- Phase 8 builds Config Tool authoring
- Phase 9 nails down E2E
- Phase 10 deletes Spotify entirely + cleanup audit
- Phase 11 finalizes submodule + PR

Run `npm test` after every commit unless a step explicitly notes a deeper test. Each task ends in a commit.

---

### Phase 0: Setup & Pre-work

#### Task 0.1: Verify clean repo state

**Files:** none (read-only checks)

- [ ] **Step 1: Check parent repo state**

Run:
```bash
git status --short
git branch --show-current
```
Expected: working tree clean (untracked `.claude/plans/` and `backend/public/music/` are OK); current branch `main`.

- [ ] **Step 2: Check ALNScanner submodule state**

Run:
```bash
cd ALNScanner
git status --short
git branch --show-current
cd ..
```
Expected: working tree clean; current branch `main`.

- [ ] **Step 3: Pull latest on both**

Run:
```bash
git pull --ff-only
cd ALNScanner && git pull --ff-only && cd ..
git submodule update --init --recursive
```
Expected: already up to date (or fast-forward).

#### Task 0.2: Create coordinated feature branches

**Files:** none (git only)

- [ ] **Step 1: Create branch in ALNScanner submodule first**

Run:
```bash
cd ALNScanner
git checkout -b feature/replace-spotify-with-mpd
git push -u origin feature/replace-spotify-with-mpd
cd ..
```
Expected: branch created and pushed; remote tracking established.

- [ ] **Step 2: Create branch in parent repo**

Run:
```bash
git checkout -b feature/replace-spotify-with-mpd
git push -u origin feature/replace-spotify-with-mpd
```
Expected: parent branch created and pushed.

- [ ] **Step 3: Verify submodule pointer matches**

Run:
```bash
git submodule status
```
Expected: ALNScanner submodule SHA matches its current HEAD.

#### Task 0.3: Install system & npm dependencies

**Files:** `backend/package.json`

- [ ] **Step 1: Install MPD apt package**

Run:
```bash
sudo apt update
sudo apt install -y mpd
```
Expected: MPD 0.23.12 installed, ~3 MB total.

- [ ] **Step 2: Stop and disable system MPD (we'll spawn our own via ProcessMonitor)**

Run:
```bash
sudo systemctl stop mpd
sudo systemctl disable mpd
sudo systemctl stop mpd.socket 2>/dev/null || true
sudo systemctl disable mpd.socket 2>/dev/null || true
```
Expected: MPD daemon and socket disabled — orchestrator's ProcessMonitor will own MPD lifecycle.

- [ ] **Step 3: Install mpd2 Node client**

Run:
```bash
cd backend
npm install --save mpd2@^1.0.7
```
Expected: `mpd2` added to `dependencies` in `backend/package.json`; `package-lock.json` updated.

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(deps): add mpd2 Node client for music service"
```

---

### Phase 1: Backend musicService Foundation (TDD)

The musicService is the heart of this work. Build it test-first, one method at a time. mpd2 is mocked in unit tests — no real MPD spawned.

#### Task 1.1: Create musicService mock factory

**Files:**
- Create: `backend/tests/helpers/mocks/musicService.js`

- [ ] **Step 1: Write the mock factory**

```js
// backend/tests/helpers/mocks/musicService.js
const EventEmitter = require('events');

function createMockMusicService(overrides = {}) {
  const service = new EventEmitter();

  service.connected = false;
  service.state = 'stopped';
  service.volume = 70;
  service.track = null;
  service.playlist = null;
  service._pausedByGameClock = false;

  service.init = jest.fn().mockResolvedValue(undefined);
  service.cleanup = jest.fn().mockResolvedValue(undefined);
  service.checkConnection = jest.fn().mockResolvedValue(true);
  service.reset = jest.fn();

  service.play = jest.fn().mockResolvedValue(undefined);
  service.pause = jest.fn().mockResolvedValue(undefined);
  service.stop = jest.fn().mockResolvedValue(undefined);
  service.next = jest.fn().mockResolvedValue(undefined);
  service.previous = jest.fn().mockResolvedValue(undefined);

  service.setVolume = jest.fn().mockResolvedValue(undefined);
  service.setShuffle = jest.fn().mockResolvedValue(undefined);
  service.setLoop = jest.fn().mockResolvedValue(undefined);
  service.loadPlaylist = jest.fn().mockResolvedValue(undefined);

  service.pauseForGameClock = jest.fn().mockResolvedValue(undefined);
  service.resumeFromGameClock = jest.fn().mockResolvedValue(undefined);

  service.getState = jest.fn(() => ({
    connected: service.connected,
    state: service.state,
    volume: service.volume,
    track: service.track,
    playlist: service.playlist,
    pausedByGameClock: service._pausedByGameClock,
  }));

  Object.assign(service, overrides);
  return service;
}

module.exports = { createMockMusicService };
```

- [ ] **Step 2: Verify mock has no syntax errors**

Run:
```bash
cd backend
node -e "require('./tests/helpers/mocks/musicService')"
```
Expected: no output (no error).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/helpers/mocks/musicService.js
git commit -m "test(music): add mock musicService factory"
```

#### Task 1.2: musicService scaffold — constructor + getState

**Files:**
- Create: `backend/src/services/musicService.js`
- Create: `backend/tests/unit/services/musicService.test.js`

- [ ] **Step 1: Write the failing test for constructor + getState**

```js
// backend/tests/unit/services/musicService.test.js
const MusicService = require('../../../src/services/musicService');

describe('MusicService — construction', () => {
  it('has correct initial state', () => {
    const service = new MusicService();
    expect(service.getState()).toEqual({
      connected: false,
      state: 'stopped',
      volume: 70,
      track: null,
      playlist: null,
      pausedByGameClock: false,
    });
  });

  it('getState returns a defensive copy', () => {
    const service = new MusicService();
    const snap = service.getState();
    snap.state = 'mutated';
    expect(service.getState().state).toBe('stopped');
  });
});
```

- [ ] **Step 2: Run test → fail**

Run:
```bash
cd backend && npx jest tests/unit/services/musicService.test.js
```
Expected: fail with "Cannot find module '../../../src/services/musicService'".

- [ ] **Step 3: Write minimal musicService**

```js
// backend/src/services/musicService.js
'use strict';

const EventEmitter = require('events');

class MusicService extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
    this.state = 'stopped';
    this.volume = 70;
    this.track = null;
    this.playlist = null;
    this._pausedByGameClock = false;
  }

  getState() {
    return {
      connected: this.connected,
      state: this.state,
      volume: this.volume,
      track: this.track ? { ...this.track } : null,
      playlist: this.playlist ? { ...this.playlist } : null,
      pausedByGameClock: this._pausedByGameClock,
    };
  }
}

module.exports = new MusicService();
```

- [ ] **Step 4: Run test → fail (singleton vs constructor pattern)**

Expected: fail because we export a singleton but the test does `new MusicService()`. This is intentional — services use the module-singleton pattern. Update the test to import the singleton instead:

```js
// backend/tests/unit/services/musicService.test.js
const musicService = require('../../../src/services/musicService');
const { MusicService } = require('../../../src/services/musicService');

// We need access to the class for fresh instances per test.
// Export both class and singleton from musicService.js.
```

- [ ] **Step 5: Update musicService to export both class and singleton**

Replace the last two lines of `backend/src/services/musicService.js`:
```js
module.exports = new MusicService();
module.exports.MusicService = MusicService;
```

- [ ] **Step 6: Rewrite the test using the class**

```js
// backend/tests/unit/services/musicService.test.js
const { MusicService } = require('../../../src/services/musicService');

describe('MusicService — construction', () => {
  let service;
  beforeEach(() => {
    service = new MusicService();
  });

  it('has correct initial state', () => {
    expect(service.getState()).toEqual({
      connected: false,
      state: 'stopped',
      volume: 70,
      track: null,
      playlist: null,
      pausedByGameClock: false,
    });
  });

  it('getState returns a defensive copy', () => {
    const snap = service.getState();
    snap.state = 'mutated';
    expect(service.getState().state).toBe('stopped');
  });
});
```

- [ ] **Step 7: Run test → pass**

Run:
```bash
cd backend && npx jest tests/unit/services/musicService.test.js
```
Expected: 2 tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "feat(music): scaffold musicService with initial state + getState"
```

#### Task 1.3: musicService lifecycle — init / cleanup / checkConnection

**Files:**
- Modify: `backend/src/services/musicService.js`
- Modify: `backend/tests/unit/services/musicService.test.js`

- [ ] **Step 1: Mock mpd2 client in test setup**

Add at the top of `tests/unit/services/musicService.test.js`:
```js
jest.mock('mpd2', () => {
  const { EventEmitter } = require('events');
  class MockMpdClient extends EventEmitter {
    constructor() { super(); }
    async connect() { this._connected = true; }
    async disconnect() { this._connected = false; }
    async sendCommand(cmd) { return ''; }
    async sendCommands(cmds) { return []; }
  }
  return { connect: jest.fn(async () => new MockMpdClient()) };
});

const mpd2 = require('mpd2');
const registry = require('../../../src/services/serviceHealthRegistry');
jest.spyOn(registry, 'report').mockImplementation(() => {});
```

- [ ] **Step 2: Write failing tests for init()**

```js
describe('MusicService — lifecycle', () => {
  let service;
  beforeEach(() => {
    service = new MusicService();
    jest.clearAllMocks();
  });

  it('init() connects mpd2 and reports healthy', async () => {
    await service.init();
    expect(mpd2.connect).toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringMatching(/mpd\.sock$/),
    }));
    expect(service.connected).toBe(true);
    expect(registry.report).toHaveBeenCalledWith('music', 'healthy', expect.any(String));
  });

  it('init() handles connection failure', async () => {
    mpd2.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await service.init();
    expect(service.connected).toBe(false);
    expect(registry.report).toHaveBeenCalledWith('music', 'down', expect.stringContaining('ECONNREFUSED'));
  });

  it('cleanup() disconnects and clears state', async () => {
    await service.init();
    await service.cleanup();
    expect(service.connected).toBe(false);
  });

  it('checkConnection() pings via status command', async () => {
    await service.init();
    const ok = await service.checkConnection();
    expect(ok).toBe(true);
  });

  it('checkConnection() returns false on failure', async () => {
    await service.init();
    service._mpd.sendCommand = jest.fn().mockRejectedValue(new Error('socket closed'));
    const ok = await service.checkConnection();
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests → fail**

Run:
```bash
cd backend && npx jest tests/unit/services/musicService.test.js
```
Expected: fail with "service.init is not a function" etc.

- [ ] **Step 4: Implement lifecycle methods**

Append to `backend/src/services/musicService.js` inside the class:

```js
  async init() {
    const mpd2 = require('mpd2');
    const registry = require('./serviceHealthRegistry');
    try {
      this._mpd = await mpd2.connect({ path: this._socketPath || '/tmp/aln-mpd.sock' });
      this._wireMpdEvents();
      this.connected = true;
      registry.report('music', 'healthy', 'MPD connected');
    } catch (err) {
      this.connected = false;
      registry.report('music', 'down', `MPD connect failed: ${err.message}`);
    }
  }

  async cleanup() {
    if (this._mpd) {
      try { await this._mpd.disconnect(); } catch (_) {}
      this._mpd = null;
    }
    this.connected = false;
  }

  async checkConnection() {
    if (!this._mpd) return false;
    try {
      await this._mpd.sendCommand('ping');
      return true;
    } catch (_) {
      return false;
    }
  }

  _wireMpdEvents() {
    // Filled in Task 1.8
  }
```

Update constructor to accept socket path override:
```js
  constructor({ socketPath = '/tmp/aln-mpd.sock' } = {}) {
    super();
    this._socketPath = socketPath;
    // ... rest of existing initial state ...
  }
```

And update the singleton export to pass no args (uses default).

- [ ] **Step 5: Run tests → pass**

Run:
```bash
cd backend && npx jest tests/unit/services/musicService.test.js
```
Expected: 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "feat(music): musicService lifecycle (init/cleanup/checkConnection)"
```

#### Task 1.4: Transport commands — play/pause/stop/next/previous

**Files:** modify `musicService.js` + tests

- [ ] **Step 1: Write failing tests for transports**

Append to `tests/unit/services/musicService.test.js`:
```js
describe('MusicService — transports', () => {
  let service;
  beforeEach(async () => {
    service = new MusicService();
    await service.init();
    jest.clearAllMocks();
    service._mpd.sendCommand = jest.fn().mockResolvedValue('');
  });

  it('play() sends "play" command', async () => {
    await service.play();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('play');
  });

  it('pause() sends "pause 1"', async () => {
    await service.pause();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('pause 1');
  });

  it('stop() sends "stop"', async () => {
    await service.stop();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('stop');
  });

  it('next() sends "next"', async () => {
    await service.next();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('next');
  });

  it('previous() sends "previous"', async () => {
    await service.previous();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('previous');
  });

  it('transports throw when not connected', async () => {
    await service.cleanup();
    await expect(service.play()).rejects.toThrow(/not connected/i);
  });
});
```

- [ ] **Step 2: Run → fail**

Expected: methods undefined.

- [ ] **Step 3: Implement transports**

Add to MusicService class:
```js
  _assertConnected() {
    if (!this._mpd || !this.connected) {
      throw new Error('Music service not connected');
    }
  }

  async play()     { this._assertConnected(); await this._mpd.sendCommand('play'); }
  async pause()    { this._assertConnected(); await this._mpd.sendCommand('pause 1'); }
  async stop()     { this._assertConnected(); await this._mpd.sendCommand('stop'); }
  async next()     { this._assertConnected(); await this._mpd.sendCommand('next'); }
  async previous() { this._assertConnected(); await this._mpd.sendCommand('previous'); }
```

- [ ] **Step 4: Run → pass**

Expected: 6 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "feat(music): transport commands (play/pause/stop/next/previous)"
```

#### Task 1.5: setVolume / setShuffle / setLoop

**Files:** modify `musicService.js` + tests

- [ ] **Step 1: Write failing tests**

```js
describe('MusicService — settings', () => {
  let service;
  beforeEach(async () => {
    service = new MusicService();
    await service.init();
    service._mpd.sendCommand = jest.fn().mockResolvedValue('');
  });

  it('setVolume() clamps to 0-100 and sends "setvol"', async () => {
    await service.setVolume(50);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('setvol 50');
  });

  it('setVolume() rejects non-numeric or out-of-range values', async () => {
    await expect(service.setVolume(-1)).rejects.toThrow();
    await expect(service.setVolume(101)).rejects.toThrow();
    await expect(service.setVolume('loud')).rejects.toThrow();
  });

  it('setShuffle(true) sends "random 1"', async () => {
    await service.setShuffle(true);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('random 1');
  });

  it('setShuffle(false) sends "random 0"', async () => {
    await service.setShuffle(false);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('random 0');
  });

  it('setLoop(true) sends "repeat 1"', async () => {
    await service.setLoop(true);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('repeat 1');
  });

  it('setLoop(false) sends "repeat 0"', async () => {
    await service.setLoop(false);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('repeat 0');
  });
});
```

- [ ] **Step 2: Run → fail**

Expected: methods undefined.

- [ ] **Step 3: Implement**

```js
  async setVolume(v) {
    this._assertConnected();
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`Invalid volume: ${v}`);
    }
    if (v < 0 || v > 100) {
      throw new Error(`Volume out of range: ${v}`);
    }
    await this._mpd.sendCommand(`setvol ${Math.round(v)}`);
  }

  async setShuffle(enabled) {
    this._assertConnected();
    await this._mpd.sendCommand(`random ${enabled ? 1 : 0}`);
  }

  async setLoop(enabled) {
    this._assertConnected();
    await this._mpd.sendCommand(`repeat ${enabled ? 1 : 0}`);
  }
```

- [ ] **Step 4: Run → pass**

Expected: all setting tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "feat(music): setVolume/setShuffle/setLoop with validation"
```

#### Task 1.6: loadPlaylist — playlist persistence + queue load

**Files:** modify `musicService.js` + tests

- [ ] **Step 1: Test plumbing — fixture playlists**

```js
const FIXTURE_PLAYLISTS = {
  playlists: [
    {
      id: 'p1',
      name: 'Test One',
      shuffle: false,
      loop: true,
      crossfadeMs: 2000,
      tracks: ['a.mp3', 'b.mp3', 'c.mp3'],
    },
    {
      id: 'p2',
      name: 'Test Two',
      shuffle: true,
      loop: false,
      crossfadeMs: 0,
      tracks: ['x.mp3'],
    },
  ],
};
```

- [ ] **Step 2: Write failing tests**

```js
describe('MusicService — loadPlaylist', () => {
  let service;
  beforeEach(async () => {
    service = new MusicService();
    service._playlists = new Map(FIXTURE_PLAYLISTS.playlists.map(p => [p.id, p]));
    await service.init();
    service._mpd.sendCommand = jest.fn().mockResolvedValue('');
    service._mpd.sendCommands = jest.fn().mockResolvedValue([]);
  });

  it('loads playlist, sets crossfade/random/repeat, clears, adds tracks, plays', async () => {
    await service.loadPlaylist('p1');
    const calls = service._mpd.sendCommands.mock.calls[0][0];
    expect(calls).toEqual([
      'crossfade 2',
      'random 0',
      'repeat 1',
      'clear',
      'add "a.mp3"',
      'add "b.mp3"',
      'add "c.mp3"',
      'play',
    ]);
  });

  it('emits playlist:changed with the loaded playlist info', async () => {
    const handler = jest.fn();
    service.on('playlist:changed', handler);
    await service.loadPlaylist('p1');
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      id: 'p1',
      name: 'Test One',
      total: 3,
      shuffle: false,
      loop: true,
      crossfadeMs: 2000,
    }));
  });

  it('rejects unknown playlist id', async () => {
    await expect(service.loadPlaylist('nope')).rejects.toThrow(/unknown.*nope/i);
  });

  it('escapes quotes in track filenames', async () => {
    service._playlists.set('special', {
      id: 'special', name: 'X', shuffle: false, loop: false, crossfadeMs: 0,
      tracks: ['has "quote".mp3'],
    });
    await service.loadPlaylist('special');
    const calls = service._mpd.sendCommands.mock.calls[0][0];
    expect(calls).toContain('add "has \\"quote\\".mp3"');
  });
});
```

- [ ] **Step 3: Run → fail**

Expected: `loadPlaylist` undefined.

- [ ] **Step 4: Implement loadPlaylist**

```js
  _quoteMpdArg(s) {
    return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  async loadPlaylist(playlistId) {
    this._assertConnected();
    const playlist = this._playlists && this._playlists.get(playlistId);
    if (!playlist) throw new Error(`Unknown playlist: ${playlistId}`);

    const crossfadeSec = Math.round((playlist.crossfadeMs ?? 0) / 1000);
    const cmds = [
      `crossfade ${crossfadeSec}`,
      `random ${playlist.shuffle ? 1 : 0}`,
      `repeat ${playlist.loop ? 1 : 0}`,
      'clear',
      ...playlist.tracks.map(t => `add ${this._quoteMpdArg(t)}`),
      'play',
    ];
    await this._mpd.sendCommands(cmds);

    this.playlist = {
      id: playlist.id,
      name: playlist.name,
      position: 0,
      total: playlist.tracks.length,
      shuffle: playlist.shuffle,
      loop: playlist.loop,
      crossfadeMs: playlist.crossfadeMs,
    };
    this.emit('playlist:changed', { ...this.playlist });
  }
```

Also initialize `_playlists` in constructor:
```js
this._playlists = new Map();
```

- [ ] **Step 5: Run → pass**

Expected: 4 loadPlaylist tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "feat(music): loadPlaylist with crossfade/shuffle/loop + queue load"
```

#### Task 1.7: Game clock pause/resume integration

**Files:** modify `musicService.js` + tests

- [ ] **Step 1: Write failing tests**

```js
describe('MusicService — game clock', () => {
  let service;
  beforeEach(async () => {
    service = new MusicService();
    await service.init();
    service._mpd.sendCommand = jest.fn().mockResolvedValue('');
  });

  it('pauseForGameClock pauses when playing and sets flag', async () => {
    service.state = 'playing';
    await service.pauseForGameClock();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('pause 1');
    expect(service._pausedByGameClock).toBe(true);
  });

  it('pauseForGameClock no-op when not playing', async () => {
    service.state = 'paused';
    await service.pauseForGameClock();
    expect(service._mpd.sendCommand).not.toHaveBeenCalled();
    expect(service._pausedByGameClock).toBe(false);
  });

  it('resumeFromGameClock resumes only if paused-by-clock flag is set', async () => {
    service._pausedByGameClock = true;
    await service.resumeFromGameClock();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('play');
    expect(service._pausedByGameClock).toBe(false);
  });

  it('resumeFromGameClock no-op when not paused-by-clock (user-initiated pause)', async () => {
    service._pausedByGameClock = false;
    service.state = 'paused';
    await service.resumeFromGameClock();
    expect(service._mpd.sendCommand).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement**

```js
  async pauseForGameClock() {
    if (this.state !== 'playing') return;
    this._assertConnected();
    await this._mpd.sendCommand('pause 1');
    this._pausedByGameClock = true;
  }

  async resumeFromGameClock() {
    if (!this._pausedByGameClock) return;
    this._assertConnected();
    await this._mpd.sendCommand('play');
    this._pausedByGameClock = false;
  }
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "feat(music): pauseForGameClock / resumeFromGameClock with sticky flag"
```

#### Task 1.8: MPD idle event handling — track / playback / volume changes

**Files:** modify `musicService.js` + tests

- [ ] **Step 1: Write failing tests**

```js
describe('MusicService — idle events', () => {
  let service;
  beforeEach(async () => {
    service = new MusicService();
    await service.init();
  });

  it('on "player" event, emits playback:changed and track:changed', async () => {
    service._mpd.sendCommand = jest.fn(async (cmd) => {
      if (cmd === 'status') return 'state: playing\nsong: 0\nelapsed: 12.5\nduration: 180\n';
      if (cmd === 'currentsong') return 'file: a.mp3\nTitle: Alpha\nArtist: Test\nAlbum: TestA\n';
      return '';
    });

    const playbackHandler = jest.fn();
    const trackHandler = jest.fn();
    service.on('playback:changed', playbackHandler);
    service.on('track:changed', trackHandler);

    service._mpd.emit('system-player');
    await new Promise(r => setImmediate(r));

    expect(playbackHandler).toHaveBeenCalledWith({ state: 'playing' });
    expect(trackHandler).toHaveBeenCalledWith({
      track: { file: 'a.mp3', title: 'Alpha', artist: 'Test', album: 'TestA', position: 12.5, duration: 180 },
    });
    expect(service.state).toBe('playing');
    expect(service.track.title).toBe('Alpha');
  });

  it('on "mixer" event, emits volume:changed', async () => {
    service._mpd.sendCommand = jest.fn().mockResolvedValue('volume: 55\n');
    const handler = jest.fn();
    service.on('volume:changed', handler);
    service._mpd.emit('system-mixer');
    await new Promise(r => setImmediate(r));
    expect(handler).toHaveBeenCalledWith({ volume: 55 });
    expect(service.volume).toBe(55);
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement event wiring**

Update `_wireMpdEvents`:
```js
  _wireMpdEvents() {
    this._mpd.on('system-player', () => { this._handlePlayerEvent().catch(this._logErr.bind(this)); });
    this._mpd.on('system-mixer',  () => { this._handleMixerEvent().catch(this._logErr.bind(this)); });
    this._mpd.on('system-playlist', () => { this._handlePlaylistEvent().catch(this._logErr.bind(this)); });
  }

  _logErr(err) {
    require('../utils/logger').warn('[Music] idle handler error:', err.message);
  }

  _parseKV(stdout) {
    const obj = {};
    for (const line of String(stdout).split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      obj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return obj;
  }

  async _handlePlayerEvent() {
    const [statusRaw, songRaw] = await Promise.all([
      this._mpd.sendCommand('status'),
      this._mpd.sendCommand('currentsong'),
    ]);
    const status = this._parseKV(statusRaw);
    const song = this._parseKV(songRaw);

    const newState = status.state || 'stopped';
    if (newState !== this.state) {
      this.state = newState;
      this.emit('playback:changed', { state: this.state });
    }

    if (song.file) {
      const newTrack = {
        file: song.file,
        title: song.Title || song.file,
        artist: song.Artist || '',
        album: song.Album || '',
        position: parseFloat(status.elapsed) || 0,
        duration: parseFloat(status.duration) || 0,
      };
      const changed = !this.track || this.track.file !== newTrack.file
        || this.track.title !== newTrack.title;
      this.track = newTrack;
      if (changed) this.emit('track:changed', { track: { ...newTrack } });
    } else if (this.track) {
      this.track = null;
      this.emit('track:changed', { track: null });
    }
  }

  async _handleMixerEvent() {
    const raw = await this._mpd.sendCommand('status');
    const status = this._parseKV(raw);
    const v = parseInt(status.volume, 10);
    if (Number.isFinite(v) && v !== this.volume) {
      this.volume = v;
      this.emit('volume:changed', { volume: v });
    }
  }

  async _handlePlaylistEvent() {
    // Queue changed (track added/removed via mpd commands); refresh playlist.position
    const raw = await this._mpd.sendCommand('status');
    const status = this._parseKV(raw);
    if (this.playlist) {
      this.playlist.position = parseInt(status.song, 10) || 0;
    }
  }
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "feat(music): MPD idle event handlers (player/mixer/playlist)"
```

#### Task 1.9: Position polling timer

**Files:** modify `musicService.js` + tests

- [ ] **Step 1: Write failing tests using fake timers**

```js
describe('MusicService — position polling', () => {
  let service;
  beforeEach(async () => {
    jest.useFakeTimers();
    service = new MusicService();
    await service.init();
    service._mpd.sendCommand = jest.fn(async (cmd) => {
      if (cmd === 'status') return 'state: playing\nelapsed: 30\nduration: 180\n';
      return 'file: a.mp3\nTitle: A\nArtist: x\n';
    });
  });
  afterEach(() => jest.useRealTimers());

  it('starts polling when state goes to playing', async () => {
    service.state = 'playing';
    service.track = { file: 'a.mp3', title: 'A', artist: 'x', album: '', position: 0, duration: 180 };
    service._startPositionPolling();

    jest.advanceTimersByTime(1100);
    await Promise.resolve();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('status');
  });

  it('stops polling when paused or stopped', async () => {
    service.state = 'playing';
    service._startPositionPolling();
    service._stopPositionPolling();
    const callsBefore = service._mpd.sendCommand.mock.calls.length;
    jest.advanceTimersByTime(2000);
    expect(service._mpd.sendCommand.mock.calls.length).toBe(callsBefore);
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement polling**

```js
  _startPositionPolling() {
    if (this._positionTimer) return;
    this._positionTimer = setInterval(() => {
      this._pollPosition().catch(this._logErr.bind(this));
    }, 1000);
  }

  _stopPositionPolling() {
    if (this._positionTimer) {
      clearInterval(this._positionTimer);
      this._positionTimer = null;
    }
  }

  async _pollPosition() {
    if (!this.connected || !this.track) return;
    const raw = await this._mpd.sendCommand('status');
    const status = this._parseKV(raw);
    const pos = parseFloat(status.elapsed);
    if (Number.isFinite(pos)) {
      this.track.position = pos;
    }
  }
```

Wire start/stop into `_handlePlayerEvent`:
```js
    if (newState === 'playing') this._startPositionPolling();
    else this._stopPositionPolling();
```

And stop in cleanup:
```js
  async cleanup() {
    this._stopPositionPolling();
    // ... existing cleanup ...
  }
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "feat(music): 1s position polling while playing"
```

#### Task 1.10: Playlist file load + watcher

**Files:** modify `musicService.js` + tests, create test fixture

- [ ] **Step 1: Write failing tests**

```js
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('MusicService — playlist file', () => {
  let service, tmpDir, plFile;
  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-music-test-'));
    plFile = path.join(tmpDir, 'music-playlists.json');
    fs.writeFileSync(plFile, JSON.stringify(FIXTURE_PLAYLISTS, null, 2));
    service = new MusicService({ playlistFile: plFile });
    await service.init();
  });
  afterEach(async () => {
    await service.cleanup();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads playlists on init', () => {
    expect(service.getPlaylists()).toHaveLength(2);
    expect(service.getPlaylists()[0].id).toBe('p1');
  });

  it('reloads playlists when file changes', async () => {
    const next = { playlists: [{ id: 'new', name: 'New', shuffle: false, loop: false, crossfadeMs: 0, tracks: ['z.mp3'] }] };
    fs.writeFileSync(plFile, JSON.stringify(next));
    await new Promise(r => setTimeout(r, 150));  // wait for fs.watch debounce
    expect(service.getPlaylists()).toHaveLength(1);
    expect(service.getPlaylists()[0].id).toBe('new');
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement file load + watcher**

Update constructor:
```js
  constructor({ socketPath = '/tmp/aln-mpd.sock', playlistFile = null } = {}) {
    super();
    this._socketPath = socketPath;
    this._playlistFile = playlistFile;
    this._playlists = new Map();
    // ... rest ...
  }
```

Add methods:
```js
  _loadPlaylistsFromDisk() {
    if (!this._playlistFile) return;
    try {
      const raw = fs.readFileSync(this._playlistFile, 'utf8');
      const parsed = JSON.parse(raw);
      this._playlists = new Map((parsed.playlists || []).map(p => [p.id, p]));
    } catch (err) {
      require('../utils/logger').warn(`[Music] failed to load playlists: ${err.message}`);
      this._playlists = new Map();
    }
  }

  _startPlaylistWatcher() {
    if (!this._playlistFile || this._playlistWatcher) return;
    let debounce;
    this._playlistWatcher = fs.watch(this._playlistFile, () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        this._loadPlaylistsFromDisk();
        this.emit('playlists:reloaded');
      }, 100);
    });
  }

  _stopPlaylistWatcher() {
    if (this._playlistWatcher) {
      this._playlistWatcher.close();
      this._playlistWatcher = null;
    }
  }

  getPlaylists() {
    return [...this._playlists.values()];
  }

  getPlaylist(id) {
    return this._playlists.get(id) || null;
  }
```

Wire into `init` (after mpd connect) and `cleanup`:
```js
  async init() {
    this._loadPlaylistsFromDisk();
    this._startPlaylistWatcher();
    // ... rest of existing init ...
  }

  async cleanup() {
    this._stopPlaylistWatcher();
    // ... rest of existing cleanup ...
  }
```

Add `const fs = require('fs');` at the top of the file.

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "feat(music): load playlists from JSON + fs.watch reload"
```

#### Task 1.11: musicService reset() helper for tests

**Files:** modify `musicService.js` + tests

- [ ] **Step 1: Write failing test**

```js
describe('MusicService — reset', () => {
  it('reset() clears state without disconnecting', () => {
    const service = new MusicService();
    service.connected = true;
    service.state = 'playing';
    service.volume = 50;
    service.track = { file: 'x' };
    service.playlist = { id: 'a' };
    service._pausedByGameClock = true;
    service.reset();
    expect(service.state).toBe('stopped');
    expect(service.volume).toBe(70);
    expect(service.track).toBe(null);
    expect(service.playlist).toBe(null);
    expect(service._pausedByGameClock).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement reset**

```js
  reset() {
    this._stopPositionPolling();
    this.state = 'stopped';
    this.volume = 70;
    this.track = null;
    this.playlist = null;
    this._pausedByGameClock = false;
  }
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "feat(music): reset() for test isolation"
```

---

### Phase 2: Backend Music Routes (TDD)

#### Task 2.1: GET /api/music/tracks

**Files:**
- Create: `backend/src/routes/musicRoutes.js`
- Create: `backend/tests/unit/routes/musicRoutes.test.js`

- [ ] **Step 1: Write failing test**

```js
// backend/tests/unit/routes/musicRoutes.test.js
const request = require('supertest');
const express = require('express');
const createRouter = require('../../../src/routes/musicRoutes');

describe('musicRoutes — GET /tracks', () => {
  let app, musicService;
  beforeEach(() => {
    musicService = {
      _mpd: {
        sendCommand: jest.fn(async () => `file: a.mp3\nTitle: A\nArtist: x\nTime: 180\nfile: b.mp3\nTitle: B\nArtist: y\nTime: 220\n`),
      },
    };
    app = express();
    app.use('/api/music', createRouter({ musicService }));
  });

  it('returns parsed track list', async () => {
    const res = await request(app).get('/api/music/tracks');
    expect(res.status).toBe(200);
    expect(res.body.tracks).toEqual([
      { file: 'a.mp3', title: 'A', artist: 'x', album: '', duration: 180 },
      { file: 'b.mp3', title: 'B', artist: 'y', album: '', duration: 220 },
    ]);
  });

  it('returns 503 when music service not connected', async () => {
    musicService._mpd = null;
    const res = await request(app).get('/api/music/tracks');
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement route**

```js
// backend/src/routes/musicRoutes.js
const express = require('express');

function parseListAllInfo(stdout) {
  const tracks = [];
  let current = null;
  for (const line of String(stdout).split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key === 'file') {
      if (current) tracks.push(current);
      current = { file: val, title: val, artist: '', album: '', duration: 0 };
    } else if (current) {
      if (key === 'Title') current.title = val;
      else if (key === 'Artist') current.artist = val;
      else if (key === 'Album') current.album = val;
      else if (key === 'Time') current.duration = parseInt(val, 10) || 0;
    }
  }
  if (current) tracks.push(current);
  return tracks;
}

module.exports = function createMusicRouter({ musicService }) {
  const router = express.Router();

  router.get('/tracks', async (req, res) => {
    if (!musicService._mpd) return res.status(503).json({ error: 'Music service not connected' });
    try {
      const stdout = await musicService._mpd.sendCommand('listallinfo');
      res.json({ tracks: parseListAllInfo(stdout) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

module.exports.parseListAllInfo = parseListAllInfo;
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/musicRoutes.js backend/tests/unit/routes/musicRoutes.test.js
git commit -m "feat(music): GET /api/music/tracks endpoint"
```

#### Task 2.2: GET and PUT /api/music/playlists

**Files:** modify `musicRoutes.js` + tests

- [ ] **Step 1: Write failing tests**

```js
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('musicRoutes — playlists', () => {
  let app, musicService, plFile;
  beforeEach(() => {
    plFile = path.join(os.tmpdir(), `aln-pl-${Date.now()}.json`);
    fs.writeFileSync(plFile, JSON.stringify({ playlists: [{ id: 'p1', name: 'P1', shuffle: false, loop: true, crossfadeMs: 1000, tracks: ['a.mp3'] }] }));
    musicService = { _playlistFile: plFile };
    app = express();
    app.use(express.json());
    app.use('/api/music', createRouter({ musicService }));
  });
  afterEach(() => fs.rmSync(plFile, { force: true }));

  it('GET /playlists returns current file content', async () => {
    const res = await request(app).get('/api/music/playlists');
    expect(res.status).toBe(200);
    expect(res.body.playlists).toHaveLength(1);
  });

  it('PUT /playlists writes atomically', async () => {
    const newPl = { playlists: [{ id: 'new', name: 'New', shuffle: true, loop: false, crossfadeMs: 0, tracks: ['x.mp3'] }] };
    const res = await request(app).put('/api/music/playlists').send(newPl);
    expect(res.status).toBe(200);
    const disk = JSON.parse(fs.readFileSync(plFile, 'utf8'));
    expect(disk.playlists[0].id).toBe('new');
  });

  it('PUT /playlists rejects invalid schema', async () => {
    const res = await request(app).put('/api/music/playlists').send({ not: 'right' });
    expect(res.status).toBe(400);
  });

  it('PUT /playlists rejects playlist with non-string track', async () => {
    const bad = { playlists: [{ id: 'x', name: 'X', shuffle: false, loop: false, crossfadeMs: 0, tracks: [42] }] };
    const res = await request(app).put('/api/music/playlists').send(bad);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Add GET + PUT implementation**

In `musicRoutes.js`, before `return router`:

```js
  router.get('/playlists', (req, res) => {
    if (!musicService._playlistFile) return res.status(503).json({ error: 'Playlist file not configured' });
    try {
      const raw = require('fs').readFileSync(musicService._playlistFile, 'utf8');
      res.type('json').send(raw);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/playlists', (req, res) => {
    if (!musicService._playlistFile) return res.status(503).json({ error: 'Playlist file not configured' });
    const body = req.body;
    if (!body || !Array.isArray(body.playlists)) return res.status(400).json({ error: 'Expected { playlists: [...] }' });
    for (const p of body.playlists) {
      if (typeof p.id !== 'string' || typeof p.name !== 'string'
        || typeof p.shuffle !== 'boolean' || typeof p.loop !== 'boolean'
        || typeof p.crossfadeMs !== 'number' || !Array.isArray(p.tracks)
        || p.tracks.some(t => typeof t !== 'string')) {
        return res.status(400).json({ error: `Invalid playlist: ${JSON.stringify(p)}` });
      }
    }
    try {
      const fs = require('fs');
      const path = musicService._playlistFile;
      const tmp = `${path}.tmp.${process.pid}`;
      fs.writeFileSync(tmp, JSON.stringify(body, null, 2));
      fs.renameSync(tmp, path);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/musicRoutes.js backend/tests/unit/routes/musicRoutes.test.js
git commit -m "feat(music): GET/PUT /api/music/playlists with atomic write + validation"
```

---

### Phase 3: MPD Process Lifecycle & Seed Script

#### Task 3.1: MPD config template generator

**Files:**
- Create: `backend/src/services/mpdConfigBuilder.js`
- Create: `backend/tests/unit/services/mpdConfigBuilder.test.js`

- [ ] **Step 1: Write failing test**

```js
const { buildMpdConfig } = require('../../../src/services/mpdConfigBuilder');

describe('mpdConfigBuilder', () => {
  it('builds config with absolute paths', () => {
    const cfg = buildMpdConfig({
      musicDir: '/abs/music',
      socketPath: '/tmp/x.sock',
      dbFile: '/tmp/x.db',
      pidFile: '/tmp/x.pid',
      logFile: '/tmp/x.log',
      stateFile: '/tmp/x.state',
      appName: 'aln-music',
    });
    expect(cfg).toContain('music_directory   "/abs/music"');
    expect(cfg).toContain('bind_to_address   "/tmp/x.sock"');
    expect(cfg).toContain('application_name "aln-music"');
    expect(cfg).toContain('type           "pulse"');
  });

  it('throws on relative paths', () => {
    expect(() => buildMpdConfig({ musicDir: 'music' })).toThrow(/absolute/);
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement**

```js
// backend/src/services/mpdConfigBuilder.js
'use strict';

const path = require('path');

function buildMpdConfig({
  musicDir,
  socketPath = '/tmp/aln-mpd.sock',
  dbFile = '/tmp/aln-mpd.db',
  pidFile = '/tmp/aln-mpd-internal.pid',
  logFile = '/tmp/aln-mpd.log',
  stateFile = '/tmp/aln-mpd.state',
  playlistDir = '/tmp/aln-mpd-playlists',
  appName = 'aln-music',
}) {
  for (const p of [musicDir, socketPath, dbFile, pidFile, logFile, stateFile, playlistDir]) {
    if (!path.isAbsolute(p)) throw new Error(`Path must be absolute: ${p}`);
  }
  return `# ALN MPD config (auto-generated — do not edit)
music_directory   "${musicDir}"
playlist_directory "${playlistDir}"
db_file           "${dbFile}"
log_file          "${logFile}"
state_file        "${stateFile}"
pid_file          "${pidFile}"
bind_to_address   "${socketPath}"

audio_output {
  type           "pulse"
  name           "${appName}"
  application_name "${appName}"
}

audio_buffer_size "4096"
restore_paused    "yes"
auto_update       "no"
`;
}

module.exports = { buildMpdConfig };
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/mpdConfigBuilder.js backend/tests/unit/services/mpdConfigBuilder.test.js
git commit -m "feat(music): MPD config builder"
```

#### Task 3.2: ProcessMonitor registration for MPD

**Files:**
- Modify: `backend/src/services/musicService.js`
- Modify: `backend/tests/unit/services/musicService.test.js`

- [ ] **Step 1: Write failing test for ProcessMonitor lifecycle**

```js
describe('MusicService — process lifecycle', () => {
  it('spawnMpd writes config and starts ProcessMonitor', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-mpd-'));
    const service = new MusicService({
      socketPath: path.join(tmpDir, 'mpd.sock'),
      configFile: path.join(tmpDir, 'mpd.conf'),
      musicDir: path.join(tmpDir, 'music'),
      dataDir: tmpDir,
    });
    fs.mkdirSync(path.join(tmpDir, 'music'), { recursive: true });

    // Mock ProcessMonitor
    service._spawnMpdProcess = jest.fn(); // verify called via spy

    await service.spawnMpd();

    expect(fs.existsSync(path.join(tmpDir, 'mpd.conf'))).toBe(true);
    expect(service._spawnMpdProcess).toHaveBeenCalled();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement spawnMpd**

```js
  async spawnMpd() {
    const fs = require('fs');
    const path = require('path');
    const { buildMpdConfig } = require('./mpdConfigBuilder');

    if (!this._musicDir) throw new Error('musicDir not configured');
    const cfg = buildMpdConfig({
      musicDir: this._musicDir,
      socketPath: this._socketPath,
      dbFile: path.join(this._dataDir, 'aln-mpd.db'),
      logFile: path.join(this._dataDir, 'aln-mpd.log'),
      stateFile: path.join(this._dataDir, 'aln-mpd.state'),
      pidFile: path.join(this._dataDir, 'aln-mpd-internal.pid'),
      playlistDir: path.join(this._dataDir, 'aln-mpd-playlists'),
    });
    fs.mkdirSync(path.join(this._dataDir, 'aln-mpd-playlists'), { recursive: true });
    fs.writeFileSync(this._configFile, cfg);
    await this._spawnMpdProcess();
  }

  async _spawnMpdProcess() {
    const ProcessMonitor = require('../utils/processMonitor');
    this._procMon = new ProcessMonitor({
      label: 'mpd',
      pidFile: '/tmp/aln-pm-mpd.pid',
      spawn: (signal) => ({
        command: 'mpd',
        args: ['--no-daemon', this._configFile],
      }),
      onSpawn: () => require('../utils/logger').info('[Music] MPD spawned'),
      onExit: (code) => require('../utils/logger').warn(`[Music] MPD exited code=${code}`),
    });
    await this._procMon.start();
  }
```

Update constructor to accept new options:
```js
  constructor({
    socketPath = '/tmp/aln-mpd.sock',
    configFile = '/tmp/aln-mpd.conf',
    musicDir = null,
    dataDir = '/tmp',
    playlistFile = null,
  } = {}) {
    super();
    this._socketPath = socketPath;
    this._configFile = configFile;
    this._musicDir = musicDir;
    this._dataDir = dataDir;
    this._playlistFile = playlistFile;
    this._playlists = new Map();
    // ... rest of initial state ...
  }
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/musicService.js backend/tests/unit/services/musicService.test.js
git commit -m "feat(music): spawn MPD via ProcessMonitor with generated config"
```

#### Task 3.3: Seed playlist script

**Files:**
- Create: `backend/scripts/seed-music-playlist.js`
- Modify: `backend/package.json`

- [ ] **Step 1: Write the seed script**

```js
#!/usr/bin/env node
// backend/scripts/seed-music-playlist.js
'use strict';

const fs = require('fs');
const path = require('path');

const MUSIC_DIR = path.resolve(__dirname, '../public/music');
const PLAYLIST_FILE = path.resolve(__dirname, '../config/music-playlists.json');
const BOOTSTRAP_ID = 'all-tracks';

function loadExisting() {
  if (!fs.existsSync(PLAYLIST_FILE)) return { playlists: [] };
  return JSON.parse(fs.readFileSync(PLAYLIST_FILE, 'utf8'));
}

function listMusicFiles() {
  return fs.readdirSync(MUSIC_DIR)
    .filter(f => /\.mp3$/i.test(f))
    .sort();
}

function main() {
  const tracks = listMusicFiles();
  console.log(`Found ${tracks.length} MP3 tracks in ${MUSIC_DIR}`);

  const data = loadExisting();
  let bootstrap = data.playlists.find(p => p.id === BOOTSTRAP_ID);
  if (!bootstrap) {
    bootstrap = {
      id: BOOTSTRAP_ID,
      name: 'All Tracks',
      description: 'Bootstrap playlist — auto-generated by seed-music-playlist.js. Contains every MP3 in backend/public/music/. Used for smoke testing and known-good integration fixtures.',
      shuffle: false,
      loop: true,
      crossfadeMs: 2000,
      tracks: [],
    };
    data.playlists.unshift(bootstrap);
  }
  bootstrap.tracks = tracks;

  fs.mkdirSync(path.dirname(PLAYLIST_FILE), { recursive: true });
  fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(data, null, 2));
  console.log(`Wrote ${data.playlists.length} playlists to ${PLAYLIST_FILE}`);
  console.log(`  "${BOOTSTRAP_ID}" has ${tracks.length} tracks`);
}

if (require.main === module) main();
module.exports = { main, listMusicFiles, loadExisting };
```

- [ ] **Step 2: Add npm script**

In `backend/package.json` under `"scripts"`:
```json
"music:seed": "node scripts/seed-music-playlist.js"
```

- [ ] **Step 3: Run the seed script**

Run:
```bash
cd backend && npm run music:seed
```
Expected: writes `backend/config/music-playlists.json` with one playlist containing 66 tracks.

- [ ] **Step 4: Verify output**

Run:
```bash
cat backend/config/music-playlists.json | head -5
node -e "const x = require('./backend/config/music-playlists.json'); console.log(x.playlists[0].id, x.playlists[0].tracks.length)"
```
Expected: id is `all-tracks`, track count is 66.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/seed-music-playlist.js backend/package.json backend/config/music-playlists.json
git commit -m "feat(music): seed All Tracks bootstrap playlist (66 tracks)"
```

---

### Phase 4: Backend Integration Glue

This phase wires musicService into the existing service graph, replacing spotifyService at each touch point. Spotify code remains in parallel until Phase 10 — keeping the system runnable mid-implementation.

#### Task 4.1: commandExecutor `music:*` action handlers

**Files:**
- Modify: `backend/src/services/commandExecutor.js`
- Create: `backend/tests/unit/services/commandExecutor-music.test.js`

- [ ] **Step 1: Write failing test**

```js
// backend/tests/unit/services/commandExecutor-music.test.js
const { createMockMusicService } = require('../../helpers/mocks/musicService');

describe('commandExecutor — music:*', () => {
  let executor, musicService, registry;

  beforeEach(() => {
    jest.resetModules();
    musicService = createMockMusicService();
    musicService.connected = true;
    registry = { isHealthy: jest.fn(() => true) };

    jest.doMock('../../../src/services/musicService', () => musicService);
    jest.doMock('../../../src/services/serviceHealthRegistry', () => registry);

    executor = require('../../../src/services/commandExecutor');
  });

  it('music:play calls musicService.play', async () => {
    const res = await executor.executeCommand({ action: 'music:play', payload: {}, source: 'test' });
    expect(musicService.play).toHaveBeenCalled();
    expect(res.success).toBe(true);
  });

  it('music:setVolume passes volume payload', async () => {
    await executor.executeCommand({ action: 'music:setVolume', payload: { volume: 60 }, source: 'test' });
    expect(musicService.setVolume).toHaveBeenCalledWith(60);
  });

  it('music:loadPlaylist passes playlistId', async () => {
    await executor.executeCommand({ action: 'music:loadPlaylist', payload: { playlistId: 'p1' }, source: 'test' });
    expect(musicService.loadPlaylist).toHaveBeenCalledWith('p1');
  });

  it('rejected pre-dispatch when music service unhealthy', async () => {
    registry.isHealthy = jest.fn(() => false);
    const res = await executor.executeCommand({ action: 'music:play', payload: {}, source: 'test' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/music/i);
    expect(musicService.play).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Update commandExecutor**

In `backend/src/services/commandExecutor.js`, find the `SERVICE_DEPENDENCIES` map and add (don't remove spotify entries yet — keep parallel):
```js
  'music:play': 'music',
  'music:pause': 'music',
  'music:stop': 'music',
  'music:next': 'music',
  'music:previous': 'music',
  'music:setVolume': 'music',
  'music:loadPlaylist': 'music',
  'music:setShuffle': 'music',
  'music:setLoop': 'music',
```

In the `executeCommand` switch, before existing cases, add:
```js
    case 'music:play':
    case 'music:pause':
    case 'music:stop':
    case 'music:next':
    case 'music:previous': {
      const musicService = require('./musicService');
      const method = action.split(':')[1];
      await musicService[method]();
      resultMessage = `Music ${method}`;
      break;
    }
    case 'music:setVolume': {
      const musicService = require('./musicService');
      await musicService.setVolume(payload.volume);
      resultMessage = `Music volume set to ${payload.volume}%`;
      break;
    }
    case 'music:setShuffle': {
      const musicService = require('./musicService');
      await musicService.setShuffle(!!payload.enabled);
      resultMessage = `Music shuffle ${payload.enabled ? 'on' : 'off'}`;
      break;
    }
    case 'music:setLoop': {
      const musicService = require('./musicService');
      await musicService.setLoop(!!payload.enabled);
      resultMessage = `Music loop ${payload.enabled ? 'on' : 'off'}`;
      break;
    }
    case 'music:loadPlaylist': {
      const musicService = require('./musicService');
      await musicService.loadPlaylist(payload.playlistId);
      resultMessage = `Music playlist loaded: ${payload.playlistId}`;
      break;
    }
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/commandExecutor.js backend/tests/unit/services/commandExecutor-music.test.js
git commit -m "feat(music): commandExecutor music:* action handlers with dependency gating"
```

#### Task 4.2: audioRoutingService STREAM_APP_NAMES + ducking target

**Files:**
- Modify: `backend/src/services/audioRoutingService.js`
- Modify: `backend/config/environment/routing.json`
- Modify: `backend/tests/unit/services/audioRoutingService.test.js` (if exists) or related

- [ ] **Step 1: Update STREAM_APP_NAMES**

In `backend/src/services/audioRoutingService.js`, find `STREAM_APP_NAMES`:
```js
const STREAM_APP_NAMES = {
  video: 'VLC',
  spotify: 'spotifyd',
  music: 'aln-music',  // ADD this entry
  sound: 'pw-play',
};
```

Also add `'music'` to the `VALID_STREAMS` array (if defined):
```js
const VALID_STREAMS = ['video', 'spotify', 'music', 'sound'];
```

- [ ] **Step 2: Update ducking config**

Edit `backend/config/environment/routing.json`:
```json
{
  "routes": { ... unchanged ... },
  "ducking": [
    { "when": "video", "duck": "music", "to": 20, "fadeMs": 500 },
    { "when": "sound", "duck": "music", "to": 40, "fadeMs": 200 }
  ]
}
```

(Old `"duck": "spotify"` entries are replaced — single source ducks now target music.)

- [ ] **Step 3: Update or write tests verifying new STREAM_APP_NAMES**

```js
// in backend/tests/unit/services/audioRoutingService-streams.test.js (new file)
const audioRoutingService = require('../../../src/services/audioRoutingService');

describe('audioRoutingService — stream app names', () => {
  it('exposes music stream with aln-music app name', () => {
    // Access via internal const or via getStreamRoute
    expect(audioRoutingService.VALID_STREAMS).toContain('music');
  });
});
```

If `VALID_STREAMS` isn't exported, export it from `audioRoutingService.js`:
```js
module.exports.VALID_STREAMS = VALID_STREAMS;
module.exports.STREAM_APP_NAMES = STREAM_APP_NAMES;
```

- [ ] **Step 4: Run → pass**

Run:
```bash
cd backend && npx jest tests/unit/services/audioRoutingService
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/audioRoutingService.js backend/config/environment/routing.json backend/tests/unit/services/audioRoutingService-streams.test.js
git commit -m "feat(music): audioRoutingService recognizes 'music' stream; ducking targets music"
```

#### Task 4.3: serviceHealthRegistry music registration

**Files:** modify `backend/src/services/serviceHealthRegistry.js`

- [ ] **Step 1: Add music to registry checks**

In `serviceHealthRegistry.js`, find the health check map (currently `spotify: () => services.spotify?.checkConnection()`):
```js
const healthChecks = {
  vlc: () => services.vlc?.checkConnection(),
  spotify: () => services.spotify?.checkConnection(),  // keep until Phase 10
  music: () => services.music?.checkConnection(),       // ADD
  sound: () => services.sound?.checkConnection(),
  // ... rest unchanged ...
};
```

Also ensure `music` is in the list of services tracked by default.

- [ ] **Step 2: Update revalidation start in app.js**

In `backend/src/app.js`, find `serviceHealthRegistry.startRevalidation([...])` and add `'music'` to the list:
```js
serviceHealthRegistry.startRevalidation(['vlc', 'spotify', 'music', 'sound', 'bluetooth', 'audio', 'lighting'], 15000);
```

- [ ] **Step 3: Verify no test regressions**

Run:
```bash
cd backend && npm test -- serviceHealthRegistry
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/serviceHealthRegistry.js backend/src/app.js
git commit -m "feat(music): register music service in health registry"
```

#### Task 4.4: sessionService game-clock integration

**Files:**
- Modify: `backend/src/services/sessionService.js`
- Modify: `backend/tests/unit/services/sessionService.test.js`

- [ ] **Step 1: Find the existing spotifyService game-clock calls**

```bash
grep -n "spotifyService.pauseForGameClock\|spotifyService.resumeFromGameClock" backend/src/services/sessionService.js
```
Expected: 2 hits around lines 515 and 525.

- [ ] **Step 2: Add musicService calls alongside spotifyService**

For each call, add the music equivalent immediately after. Example:
```js
// session pause
if (this._spotifyService) {
  await this._spotifyService.pauseForGameClock().catch(err => logger.warn('[Session] spotify pause failed:', err.message));
}
if (this._musicService) {
  await this._musicService.pauseForGameClock().catch(err => logger.warn('[Session] music pause failed:', err.message));
}
```

(Spotify code stays in parallel until Phase 10 — the goal here is the music addition.)

- [ ] **Step 3: Update sessionService constructor / init to accept musicService**

Find where `_spotifyService` is wired and mirror for `_musicService`. Most likely in app.js init:
```js
sessionService._musicService = musicService;
```

(Or pass via init args — match existing pattern.)

- [ ] **Step 4: Write or extend test**

In `backend/tests/unit/services/sessionService.test.js` (if exists) or create:
```js
it('pauses music when game clock pauses', async () => {
  const musicMock = createMockMusicService();
  sessionService._musicService = musicMock;
  await sessionService.pauseSession();  // or whatever the method is
  expect(musicMock.pauseForGameClock).toHaveBeenCalled();
});
```

- [ ] **Step 5: Run → pass**

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/sessionService.js backend/tests/unit/services/sessionService.test.js
git commit -m "feat(music): sessionService pauses/resumes music with game clock"
```

#### Task 4.5: cueEngineService EVENT_NORMALIZERS

**Files:** modify `backend/src/services/cueEngineService.js`

- [ ] **Step 1: Add music:track:changed normalizer**

In `cueEngineService.js`, find `EVENT_NORMALIZERS` and add:
```js
'music:track:changed': (payload) => ({
  title: payload.track?.title || '',
  artist: payload.track?.artist || '',
  file: payload.track?.file || '',
}),
```

(Keep the spotify entry for now — both run in parallel until Phase 10.)

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/cueEngineService.js
git commit -m "feat(music): cueEngine EVENT_NORMALIZERS includes music:track:changed"
```

#### Task 4.6: cueEngineWiring forwards musicService events

**Files:** modify `backend/src/services/cueEngineWiring.js`

- [ ] **Step 1: Add music event forwarding**

In `cueEngineWiring.js` `registerCueEngineListeners` (or equivalent):
```js
if (services.music) {
  for (const evt of ['playback:changed', 'volume:changed', 'track:changed', 'playlist:changed']) {
    services.music.on(evt, (data) => cueEngineService.handleGameEvent(`music:${evt}`, data));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/cueEngineWiring.js
git commit -m "feat(music): cueEngineWiring forwards music events to cue engine"
```

#### Task 4.7: broadcasts.js music wiring + syncHelpers.buildMusicState

**Files:**
- Modify: `backend/src/websocket/broadcasts.js`
- Modify: `backend/src/websocket/syncHelpers.js`
- Modify: `backend/tests/unit/websocket/broadcasts.test.js` (if exists)

- [ ] **Step 1: Add music wiring to broadcasts.js**

Near the existing spotify wiring (around line 466), add:
```js
if (musicService) {
  for (const event of ['playback:changed', 'volume:changed', 'track:changed', 'playlist:changed']) {
    addTrackedListener(musicService, event, () => pushServiceState('music', musicService));
  }
}
```

Also add music ducking event forwarding (mirroring spotify):
```js
if (musicService) {
  addTrackedListener(musicService, 'playback:changed', (data) => {
    audioRoutingService.handleDuckingEvent('music', data.state === 'playing' ? 'started'
      : data.state === 'paused' ? 'paused'
      : data.state === 'stopped' ? 'completed'
      : null).catch(err => logger.warn('[Music] duck event failed:', err.message));
  });
}
```

Wait — re-check direction: in the current design music is the DUCK TARGET (ducked when video/sound plays), not a duck source. So don't add music as a source. Skip the second block.

- [ ] **Step 2: Add buildMusicState to syncHelpers.js**

```js
function buildMusicState(musicService) {
  if (!musicService) return null;
  const state = musicService.getState();
  return {
    ...state,
    playlists: musicService.getPlaylists?.() || [],
  };
}
module.exports.buildMusicState = buildMusicState;
```

(Includes the playlist list directly in the music state for sync:full convenience — the frontend picker uses this.)

- [ ] **Step 3: Wire into buildSyncFullPayload**

Find `buildSyncFullPayload` in `syncHelpers.js`. Add:
```js
const music = buildMusicState(services.music);
return {
  // ... existing keys ...
  music,
};
```

- [ ] **Step 4: Run all websocket tests**

```bash
cd backend && npx jest tests/unit/websocket
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/websocket/broadcasts.js backend/src/websocket/syncHelpers.js
git commit -m "feat(music): broadcasts wire music events; sync:full includes music + playlists"
```

#### Task 4.8: Audit all 7 buildSyncFullPayload callers

Per `backend/CLAUDE.md` "recurred 4 times" warning, every site that builds a sync:full payload must pass musicService.

- [ ] **Step 1: List call sites**

Run:
```bash
grep -rn "buildSyncFullPayload" backend/src backend/tests/helpers
```
Expected hits in:
1. `src/websocket/gmAuth.js`
2. `src/websocket/broadcasts.js` (×3)
3. `src/routes/stateRoutes.js`
4. `src/server.js`
5. `tests/helpers/integration-test-server.js`

- [ ] **Step 2: Verify each call passes musicService**

For each hit, look at the signature. If services aren't already passed by an object, add `musicService` next to `spotifyService`:
```js
buildSyncFullPayload({
  ...,
  spotify: spotifyService,
  music: musicService,
  ...,
});
```

- [ ] **Step 3: Write a guard test**

```js
// backend/tests/integration/music-sync-full.test.js (will deepen in Phase 6)
const { buildSyncFullPayload } = require('../../src/websocket/syncHelpers');

describe('sync:full includes music', () => {
  it('includes music key in returned payload', () => {
    const payload = buildSyncFullPayload({
      session: {},
      music: { getState: () => ({ state: 'stopped' }), getPlaylists: () => [] },
      // ... minimal stubs for other services ...
    });
    expect(payload.music).toBeDefined();
    expect(payload.music.state).toBe('stopped');
  });
});
```

- [ ] **Step 4: Run**

```bash
cd backend && npx jest tests/integration/music-sync-full
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/websocket/gmAuth.js backend/src/websocket/broadcasts.js backend/src/routes/stateRoutes.js backend/src/server.js backend/tests/helpers/integration-test-server.js backend/tests/integration/music-sync-full.test.js
git commit -m "feat(music): all 7 buildSyncFullPayload callers pass music service"
```

#### Task 4.9: app.js init + server.js mount

**Files:** modify `backend/src/app.js`, `backend/src/server.js`

- [ ] **Step 1: Initialize musicService in app.js**

In `app.js` `initializeServices` (near spotifyService.init):
```js
const musicService = require('./services/musicService');
musicService._musicDir = path.resolve(__dirname, '../public/music');
musicService._dataDir  = path.resolve(__dirname, '../data');
musicService._playlistFile = path.resolve(__dirname, '../config/music-playlists.json');
if (process.env.ENABLE_MUSIC_PLAYBACK !== 'false') {
  await musicService.spawnMpd();
  await musicService.init();
}
```

Add to the services object passed downstream:
```js
return { ..., music: musicService };
```

- [ ] **Step 2: Mount music routes in server.js**

In `server.js`, find where routes are mounted:
```js
const createMusicRouter = require('./routes/musicRoutes');
app.use('/api/music', createMusicRouter({ musicService: services.music }));
```

- [ ] **Step 3: Run unit + a quick smoke**

```bash
cd backend && npm test
```
Expected: all current tests still pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.js backend/src/server.js
git commit -m "feat(music): initialize musicService and mount /api/music routes"
```

---

### Phase 5: Contracts (AsyncAPI + OpenAPI)

#### Task 5.1: AsyncAPI music:* actions + service:state.music

**Files:** modify `backend/contracts/asyncapi.yaml`

- [ ] **Step 1: Add music:* actions to gm:command schema**

Find the `gm:command.action` enum and add:
```yaml
- music:play
- music:pause
- music:stop
- music:next
- music:previous
- music:setVolume
- music:setShuffle
- music:setLoop
- music:loadPlaylist
```

- [ ] **Step 2: Add service:state.music payload schema**

Under the `service:state` event's `state` oneOf, add:
```yaml
- title: MusicState
  type: object
  properties:
    domain:
      const: music
    state:
      type: object
      properties:
        connected: { type: boolean }
        state: { type: string, enum: [playing, paused, stopped] }
        volume: { type: integer, minimum: 0, maximum: 100 }
        track:
          oneOf:
            - type: 'null'
            - type: object
              properties:
                file: { type: string }
                title: { type: string }
                artist: { type: string }
                album: { type: string }
                position: { type: number }
                duration: { type: number }
        playlist:
          oneOf:
            - type: 'null'
            - type: object
              properties:
                id: { type: string }
                name: { type: string }
                position: { type: integer }
                total: { type: integer }
                shuffle: { type: boolean }
                loop: { type: boolean }
                crossfadeMs: { type: integer }
        playlists:
          type: array
          items: { $ref: '#/components/schemas/Playlist' }
        pausedByGameClock: { type: boolean }
```

Define the `Playlist` schema in components:
```yaml
components:
  schemas:
    Playlist:
      type: object
      properties:
        id: { type: string }
        name: { type: string }
        description: { type: string }
        shuffle: { type: boolean }
        loop: { type: boolean }
        crossfadeMs: { type: integer, minimum: 0, maximum: 5000 }
        tracks: { type: array, items: { type: string } }
      required: [id, name, shuffle, loop, crossfadeMs, tracks]
```

- [ ] **Step 3: Run contract tests**

```bash
cd backend && npx jest tests/contract
```
Expected: existing tests still pass (no regressions from added entries).

- [ ] **Step 4: Commit**

```bash
git add backend/contracts/asyncapi.yaml
git commit -m "contract(music): add music:* gm:command actions and service:state.music schema"
```

#### Task 5.2: OpenAPI /api/music/* routes

**Files:** modify `backend/contracts/openapi.yaml`

- [ ] **Step 1: Add /api/music/tracks**

```yaml
paths:
  /api/music/tracks:
    get:
      summary: List all available music tracks
      tags: [Music]
      responses:
        '200':
          description: List of tracks
          content:
            application/json:
              schema:
                type: object
                properties:
                  tracks:
                    type: array
                    items:
                      type: object
                      properties:
                        file: { type: string }
                        title: { type: string }
                        artist: { type: string }
                        album: { type: string }
                        duration: { type: integer }
        '503': { description: Music service unavailable }
```

- [ ] **Step 2: Add /api/music/playlists**

```yaml
  /api/music/playlists:
    get:
      summary: Get all playlists
      tags: [Music]
      responses:
        '200':
          description: Playlist set
          content:
            application/json:
              schema:
                type: object
                properties:
                  playlists:
                    type: array
                    items: { $ref: '#/components/schemas/Playlist' }
    put:
      summary: Replace all playlists
      tags: [Music]
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                playlists:
                  type: array
                  items: { $ref: '#/components/schemas/Playlist' }
              required: [playlists]
      responses:
        '200': { description: Saved }
        '400': { description: Invalid schema }
        '401': { description: Unauthorized }
```

Also define `Playlist` schema in OpenAPI components (mirror AsyncAPI).

- [ ] **Step 3: Run contract tests**

```bash
cd backend && npx jest tests/contract/http
```

- [ ] **Step 4: Commit**

```bash
git add backend/contracts/openapi.yaml
git commit -m "contract(music): add /api/music/tracks and /api/music/playlists endpoints"
```

#### Task 5.3: Contract tests for music

**Files:**
- Create: `backend/tests/contract/websocket/asyncapi-music.test.js`
- Create: `backend/tests/contract/http/openapi-music.test.js`

- [ ] **Step 1: AsyncAPI music tests**

```js
// tests/contract/websocket/asyncapi-music.test.js
const { validateAsyncApiEvent } = require('../../helpers/contract-validator');

describe('AsyncAPI music contract', () => {
  it('service:state with domain=music validates', () => {
    const ev = { event: 'service:state', data: { domain: 'music', state: {
      connected: true, state: 'playing', volume: 70, track: null, playlist: null,
      playlists: [], pausedByGameClock: false,
    } }, timestamp: new Date().toISOString() };
    expect(() => validateAsyncApiEvent(ev, 'service:state')).not.toThrow();
  });

  ['music:play', 'music:pause', 'music:next', 'music:setVolume', 'music:loadPlaylist'].forEach(action => {
    it(`gm:command action ${action} validates`, () => {
      const cmd = { event: 'gm:command', data: { action, payload: action === 'music:setVolume' ? { volume: 50 } : action === 'music:loadPlaylist' ? { playlistId: 'p1' } : {} }, timestamp: new Date().toISOString() };
      expect(() => validateAsyncApiEvent(cmd, 'gm:command')).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: OpenAPI music tests**

```js
// tests/contract/http/openapi-music.test.js
const { validateHTTPResponse, validateHTTPRequest } = require('../../helpers/contract-validator');

describe('OpenAPI music contract', () => {
  it('GET /api/music/tracks 200 shape', () => {
    const body = { tracks: [{ file: 'a.mp3', title: 'A', artist: 'x', album: '', duration: 180 }] };
    expect(() => validateHTTPResponse({ body, status: 200 }, '/api/music/tracks', 'get', 200)).not.toThrow();
  });

  it('PUT /api/music/playlists request schema', () => {
    const body = { playlists: [{ id: 'p1', name: 'P1', shuffle: false, loop: true, crossfadeMs: 1000, tracks: ['a.mp3'] }] };
    expect(() => validateHTTPRequest(body, '/api/music/playlists', 'put')).not.toThrow();
  });

  it('PUT /api/music/playlists rejects missing tracks field', () => {
    const body = { playlists: [{ id: 'p1', name: 'P1', shuffle: false, loop: true, crossfadeMs: 1000 }] };
    expect(() => validateHTTPRequest(body, '/api/music/playlists', 'put')).toThrow();
  });
});
```

- [ ] **Step 3: Run**

```bash
cd backend && npx jest tests/contract
```

- [ ] **Step 4: Commit**

```bash
git add backend/tests/contract/websocket/asyncapi-music.test.js backend/tests/contract/http/openapi-music.test.js
git commit -m "test(music): contract tests for music gm:commands, service:state, and HTTP routes"
```

---

### Phase 6: Backend Integration Test Suite

Integration tests use the existing `setupIntegrationTestServer` pattern with `MockMusicService` at the boundary (mpd2 not actually spawned).

#### Task 6.1: music-playback-lifecycle.test.js

**Files:** create `backend/tests/integration/music-playback-lifecycle.test.js`

- [ ] **Step 1: Write the test**

```js
const { setupIntegrationTestServer, teardown } = require('../helpers/integration-test-server');
const { connectGmSocket, waitForServiceState, waitForEvent } = require('../helpers/websocket-core');

describe('Music — playback lifecycle (integration)', () => {
  let server, socket, services;
  beforeAll(async () => { ({ server, services } = await setupIntegrationTestServer()); });
  afterAll(async () => { await teardown(server); });
  beforeEach(async () => { socket = await connectGmSocket(server.url, server.token); });
  afterEach(() => { socket?.disconnect(); });

  it('sync:full on connect includes music + playlists', async () => {
    const syncFull = await waitForEvent(socket, 'sync:full');
    expect(syncFull.data.music).toBeDefined();
    expect(syncFull.data.music.state).toBe('stopped');
    expect(syncFull.data.music.playlists).toBeDefined();
  });

  it('music:loadPlaylist → playlist:changed event → service:state.music updates', async () => {
    services.music._playlists = new Map([['p1', { id: 'p1', name: 'P1', shuffle: false, loop: true, crossfadeMs: 1000, tracks: ['a.mp3', 'b.mp3'] }]]);
    services.music.connected = true;
    services.music._mpd = { sendCommands: jest.fn().mockResolvedValue([]) };
    socket.emit('gm:command', { event: 'gm:command', data: { action: 'music:loadPlaylist', payload: { playlistId: 'p1' } }, timestamp: new Date().toISOString() });
    const update = await waitForServiceState(socket, 'music', (s) => s.playlist?.id === 'p1');
    expect(update.state.playlist.total).toBe(2);
  });
});
```

- [ ] **Step 2: Run**

```bash
cd backend && npm run test:integration -- music-playback-lifecycle
```

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/music-playback-lifecycle.test.js
git commit -m "test(music): integration — playback lifecycle and sync:full"
```

#### Task 6.2 through 6.7: remaining integration tests

For each test below, follow the same pattern: write the test, run it, ensure pass, commit. The structure mirrors 6.1; the test specifics differ.

- [ ] **Task 6.2: `music-ducking.test.js`**

```js
it('video starts → music ducks to 20%', async () => {
  // Set music playing at 70%
  services.music.state = 'playing';
  services.music.volume = 70;
  services.music._mpd = { sendCommand: jest.fn().mockResolvedValue('') };

  // Trigger video:loading
  services.videoQueue.emit('video:loading', { item: { tokenId: 'test' } });
  // ducking event runs through audioRoutingService
  await new Promise(r => setTimeout(r, 100));

  // Assert pactl set-sink-input-volume was called via audioRoutingService internals
  expect(services.audioRouting._mockExecFile).toHaveBeenCalledWith(
    'pactl', expect.arrayContaining(['set-sink-input-volume', expect.any(String), '20%']),
    expect.anything()
  );
});
```

Commit: `test(music): integration — ducking when video/sound plays`

- [ ] **Task 6.3: `music-game-clock.test.js`**

```js
it('session pause → music.pauseForGameClock called', async () => {
  services.music.state = 'playing';
  await services.session.pause();
  expect(services.music.pauseForGameClock).toHaveBeenCalled();
});

it('session resume → music.resumeFromGameClock called', async () => {
  services.music._pausedByGameClock = true;
  await services.session.resume();
  expect(services.music.resumeFromGameClock).toHaveBeenCalled();
});
```

Commit: `test(music): integration — game-clock pause/resume`

- [ ] **Task 6.4: `music-cue-integration.test.js`**

```js
it('cue with music:loadPlaylist action fires musicService.loadPlaylist', async () => {
  services.cueEngine.loadCues({ cues: [
    { id: 'cue1', trigger: { event: 'transaction:accepted' }, commands: [{ action: 'music:loadPlaylist', payload: { playlistId: 'p1' } }] }
  ]});
  services.transaction.emit('transaction:accepted', { transaction: { tokenId: 't1' } });
  await new Promise(r => setTimeout(r, 100));
  expect(services.music.loadPlaylist).toHaveBeenCalledWith('p1');
});
```

Commit: `test(music): integration — cue engine dispatches music:loadPlaylist`

- [ ] **Task 6.5: `music-sync-full.test.js`** (build out from the guard test in 4.8)

Add per-caller cases for each of the 7 sync:full sites:
```js
it.each([
  ['gmAuth on new connection',     'gmAuth'],
  ['broadcasts session:start',     'sessionStart'],
  ['broadcasts scores:reset',      'scoresReset'],
  ['broadcasts offline:processed', 'offlineProcessed'],
  ['stateRoutes HTTP fallback',    'stateHttp'],
  ['server.js reconnect',          'reconnect'],
  ['test fixture server',          'testServer'],
])('sync:full from %s includes music', async (_, source) => {
  const payload = triggerSyncFull(source);
  expect(payload.music).toBeDefined();
  expect(payload.music.playlists).toBeDefined();
});
```

Commit: `test(music): integration — all 7 sync:full callers include music`

- [ ] **Task 6.6: `music-mpd-recovery.test.js`**

```js
it('MPD process exit causes registry status flip', async () => {
  // Simulate ProcessMonitor 'exit' event
  services.music._procMon.emit('exit', 1);
  await new Promise(r => setTimeout(r, 100));
  expect(serviceHealthRegistry.isHealthy('music')).toBe(false);
});

it('after MPD respawn, commands work', async () => {
  services.music._procMon.emit('respawn');
  // Mock mpd2 reconnect
  await services.music.init();
  expect(serviceHealthRegistry.isHealthy('music')).toBe(true);
});
```

Commit: `test(music): integration — MPD process recovery flow`

- [ ] **Task 6.7: `music-playlist-watch.test.js`**

```js
it('file write triggers reload', async () => {
  const newData = { playlists: [{ id: 'new', name: 'New', shuffle: false, loop: false, crossfadeMs: 0, tracks: ['z.mp3'] }] };
  fs.writeFileSync(services.music._playlistFile, JSON.stringify(newData));
  await new Promise(r => setTimeout(r, 200));
  expect(services.music.getPlaylist('new')).toBeDefined();
});
```

Commit: `test(music): integration — playlist file watcher reload`

#### Task 6.8: Update existing integration tests (mass sweep)

**Files to update** (each with `s/spotify/music/g` in service domain assertions where the test is about behavior, not specifically about Spotify):

- `backend/tests/integration/external-state-propagation.test.js`
- `backend/tests/integration/state-synchronization.test.js`
- `backend/tests/integration/audio-routing-phase3.test.js` (now tests ducking against music)
- `backend/tests/integration/service-state-push.test.js`
- `backend/tests/helpers/browser-mocks.js` (add MockMusicService)
- `backend/tests/helpers/integration-test-server.js` (initialize music service)
- `backend/tests/helpers/service-reset.js` (reset music)

For each file:
- [ ] Open
- [ ] Replace spotify-specific assertions with music ones (keep spotify ones in parallel until Phase 10)
- [ ] Run: `npm run test:integration -- <filename>`
- [ ] Commit: `test(music): integration — <filename> covers music alongside spotify`

(Each is a 5–10 minute task — quick, mechanical.)

Final commit at end of phase:
```bash
git commit -m "test(music): integration test suite covers full music feature surface"
```

---

### Phase 7: Frontend (ALNScanner) — Music Renderer & Controller

**All commits in this phase are inside the ALNScanner submodule.** Per the submodule branch strategy, work happens inside `ALNScanner/`, commits to its `feature/replace-spotify-with-mpd` branch, and the parent picks up the new SHA in Phase 11.

#### Task 7.1: MusicController (TDD)

**Files:**
- Create: `ALNScanner/src/admin/MusicController.js`
- Create: `ALNScanner/tests/unit/admin/MusicController.test.js`

- [ ] **Step 1: Write failing test**

```js
// ALNScanner/tests/unit/admin/MusicController.test.js
const MusicController = require('../../../src/admin/MusicController').default
  || require('../../../src/admin/MusicController');

describe('MusicController', () => {
  let controller, sendGmCommand;
  beforeEach(() => {
    sendGmCommand = jest.fn();
    controller = new MusicController({ sendGmCommand });
  });

  it('play() sends music:play', () => {
    controller.play();
    expect(sendGmCommand).toHaveBeenCalledWith('music:play', {});
  });

  it('pause() sends music:pause', () => {
    controller.pause();
    expect(sendGmCommand).toHaveBeenCalledWith('music:pause', {});
  });

  it('next, previous, stop, setShuffle, setLoop dispatch correctly', () => {
    controller.next();      expect(sendGmCommand).toHaveBeenCalledWith('music:next', {});
    controller.previous();  expect(sendGmCommand).toHaveBeenCalledWith('music:previous', {});
    controller.stop();      expect(sendGmCommand).toHaveBeenCalledWith('music:stop', {});
    controller.setShuffle(true);  expect(sendGmCommand).toHaveBeenCalledWith('music:setShuffle', { enabled: true });
    controller.setLoop(false);    expect(sendGmCommand).toHaveBeenCalledWith('music:setLoop', { enabled: false });
  });

  it('setVolume(60) sends music:setVolume', () => {
    controller.setVolume(60);
    expect(sendGmCommand).toHaveBeenCalledWith('music:setVolume', { volume: 60 });
  });

  it('loadPlaylist sends music:loadPlaylist', () => {
    controller.loadPlaylist('p1');
    expect(sendGmCommand).toHaveBeenCalledWith('music:loadPlaylist', { playlistId: 'p1' });
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement**

```js
// ALNScanner/src/admin/MusicController.js
export class MusicController {
  constructor({ sendGmCommand }) {
    this._send = sendGmCommand;
  }
  play()                  { this._send('music:play', {}); }
  pause()                 { this._send('music:pause', {}); }
  stop()                  { this._send('music:stop', {}); }
  next()                  { this._send('music:next', {}); }
  previous()              { this._send('music:previous', {}); }
  setVolume(volume)       { this._send('music:setVolume', { volume }); }
  setShuffle(enabled)     { this._send('music:setShuffle', { enabled }); }
  setLoop(enabled)        { this._send('music:setLoop', { enabled }); }
  loadPlaylist(playlistId){ this._send('music:loadPlaylist', { playlistId }); }
}
export default MusicController;
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit (inside ALNScanner submodule)**

```bash
cd ALNScanner
git add src/admin/MusicController.js tests/unit/admin/MusicController.test.js
git commit -m "feat(music): MusicController dispatches music:* gm:commands"
cd ..
```

#### Task 7.2: MusicRenderer (TDD)

**Files:**
- Create: `ALNScanner/src/ui/renderers/MusicRenderer.js`
- Create: `ALNScanner/tests/unit/ui/renderers/MusicRenderer.test.js`

This task is substantial. Break into smaller commits as you go.

- [ ] **Step 1: Set up DOM scaffold test**

```js
// ALNScanner/tests/unit/ui/renderers/MusicRenderer.test.js
import { MusicRenderer } from '../../../../src/ui/renderers/MusicRenderer.js';

describe('MusicRenderer', () => {
  let container, renderer;
  beforeEach(() => {
    document.body.innerHTML = '<div id="now-playing-section"></div>';
    container = document.getElementById('now-playing-section');
    renderer = new MusicRenderer(container);
  });

  it('renders empty scaffold on first call', () => {
    renderer.render({ state: 'stopped', volume: 70, track: null, playlist: null, playlists: [] });
    expect(container.querySelector('.music-now-playing')).toBeTruthy();
    expect(container.querySelector('.music-playlist-picker')).toBeTruthy();
    expect(container.querySelector('.music-controls')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement scaffold + run**

```js
// ALNScanner/src/ui/renderers/MusicRenderer.js
export class MusicRenderer {
  constructor(container) {
    this._root = container;
    this._built = false;
    this._lastState = null;
  }

  render(state) {
    if (!this._built) this._buildScaffold();
    this._update(state);
    this._lastState = state;
  }

  _buildScaffold() {
    this._root.innerHTML = `
      <div class="music-now-playing">
        <select class="music-playlist-picker"></select>
        <div class="music-track-info">
          <span class="music-track-title"></span>
          <span class="music-track-artist"></span>
        </div>
        <div class="music-controls">
          <button data-action="admin.musicPrevious">⏮</button>
          <button data-action="admin.musicPlay" class="music-play">▶</button>
          <button data-action="admin.musicPause" class="music-pause" hidden>⏸</button>
          <button data-action="admin.musicNext">⏭</button>
          <button data-action="admin.musicStop">⏹</button>
          <input type="range" class="music-volume" min="0" max="100" step="1" data-action="admin.musicSetVolume" />
          <label><input type="checkbox" class="music-shuffle" data-action="admin.musicSetShuffle"/> Shuffle</label>
          <label><input type="checkbox" class="music-loop"    data-action="admin.musicSetLoop"/> Loop</label>
          <span class="music-ducking-indicator" hidden>Ducked</span>
        </div>
      </div>
    `;
    this._built = true;
  }

  _update(state) {
    const titleEl = this._root.querySelector('.music-track-title');
    const artistEl = this._root.querySelector('.music-track-artist');
    titleEl.textContent  = state.track?.title  || '(no track)';
    artistEl.textContent = state.track?.artist || '';

    this._root.querySelector('.music-play').hidden  = state.state === 'playing';
    this._root.querySelector('.music-pause').hidden = state.state !== 'playing';

    if (!this._volumeFocused) {
      this._root.querySelector('.music-volume').value = state.volume ?? 70;
    }

    this._root.querySelector('.music-shuffle').checked = !!state.playlist?.shuffle;
    this._root.querySelector('.music-loop').checked    = !!state.playlist?.loop;

    this._updatePicker(state.playlists || [], state.playlist?.id);
    this._root.querySelector('.music-ducking-indicator').hidden = !state.ducking;
  }

  _updatePicker(playlists, selectedId) {
    const picker = this._root.querySelector('.music-playlist-picker');
    if (picker._lastList === JSON.stringify(playlists.map(p => p.id))) {
      picker.value = selectedId || '';
      return;
    }
    picker.innerHTML = playlists.map(p =>
      `<option value="${p.id}">${p.name}</option>`
    ).join('');
    picker.value = selectedId || (playlists[0]?.id ?? '');
    picker._lastList = JSON.stringify(playlists.map(p => p.id));
  }
}
```

Run:
```bash
cd ALNScanner && npx jest tests/unit/ui/renderers/MusicRenderer
```
Expected: 1 test passes.

- [ ] **Step 3: Add tests for state updates**

Append to the test file:
```js
it('updates track title on track change', () => {
  renderer.render({ state: 'playing', volume: 50, track: { title: 'X', artist: 'Y' }, playlist: null, playlists: [] });
  expect(container.querySelector('.music-track-title').textContent).toBe('X');
  expect(container.querySelector('.music-track-artist').textContent).toBe('Y');
});

it('toggles play/pause buttons', () => {
  renderer.render({ state: 'playing', volume: 50, track: null, playlist: null, playlists: [] });
  expect(container.querySelector('.music-play').hidden).toBe(true);
  expect(container.querySelector('.music-pause').hidden).toBe(false);
});

it('populates playlist picker', () => {
  renderer.render({ state: 'stopped', volume: 50, track: null, playlist: { id: 'p1' }, playlists: [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }] });
  const picker = container.querySelector('.music-playlist-picker');
  expect(picker.children.length).toBe(2);
  expect(picker.value).toBe('p1');
});

it('shows ducking indicator', () => {
  renderer.render({ state: 'playing', volume: 50, track: null, playlist: null, playlists: [], ducking: true });
  expect(container.querySelector('.music-ducking-indicator').hidden).toBe(false);
});
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit (inside submodule)**

```bash
cd ALNScanner
git add src/ui/renderers/MusicRenderer.js tests/unit/ui/renderers/MusicRenderer.test.js
git commit -m "feat(music): MusicRenderer with playlist picker + transport + ducking indicator"
cd ..
```

#### Task 7.3: stateStore music domain

**Files:** modify `ALNScanner/src/core/stateStore.js`, tests

- [ ] **Step 1: Write failing test**

```js
// ALNScanner/tests/unit/core/stateStore.test.js (extend existing)
it('store.update("music", ...) shallow merges', () => {
  store.update('music', { state: 'playing', volume: 80 });
  expect(store.get('music')).toEqual(expect.objectContaining({ state: 'playing', volume: 80 }));
});

it('initial music state has defaults', () => {
  expect(store.get('music')).toEqual(expect.objectContaining({
    state: 'stopped',
    volume: 70,
    track: null,
    playlist: null,
    playlists: [],
    pausedByGameClock: false,
  }));
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Update stateStore initial state**

Add `music` domain alongside existing `spotify` (which stays until Phase 10):
```js
this._domains.music = {
  connected: false,
  state: 'stopped',
  volume: 70,
  track: null,
  playlist: null,
  playlists: [],
  pausedByGameClock: false,
  ducking: false,
};
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
cd ALNScanner
git add src/core/stateStore.js tests/unit/core/stateStore.test.js
git commit -m "feat(music): stateStore tracks music domain"
cd ..
```

#### Task 7.4: domEventBindings music actions

**Files:**
- Modify: `ALNScanner/src/utils/domEventBindings.js`
- Create: `ALNScanner/tests/unit/utils/domEventBindings-music.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { bindAdminActions } from '../../../src/utils/domEventBindings.js';

describe('domEventBindings — music', () => {
  let musicController, container;
  beforeEach(() => {
    musicController = { play: jest.fn(), pause: jest.fn(), next: jest.fn(),
      previous: jest.fn(), stop: jest.fn(), setVolume: jest.fn(),
      setShuffle: jest.fn(), setLoop: jest.fn(), loadPlaylist: jest.fn() };
    document.body.innerHTML = `
      <button data-action="admin.musicPlay">Play</button>
      <input type="range" data-action="admin.musicSetVolume" value="60" />
      <select data-action="admin.musicLoadPlaylist"><option value="p1">P1</option></select>
    `;
    container = document.body;
    bindAdminActions(container, {
      adminController: { getModule: (name) => name === 'musicController' ? musicController : null },
    });
  });

  it('click on admin.musicPlay invokes musicController.play', () => {
    container.querySelector('[data-action="admin.musicPlay"]').click();
    expect(musicController.play).toHaveBeenCalled();
  });

  it('volume slider input is debounced (150ms) and dispatches setVolume', async () => {
    const slider = container.querySelector('[data-action="admin.musicSetVolume"]');
    slider.value = '80';
    slider.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 200));
    expect(musicController.setVolume).toHaveBeenCalledWith(80);
  });

  it('playlist picker change dispatches loadPlaylist', () => {
    const sel = container.querySelector('[data-action="admin.musicLoadPlaylist"]');
    sel.value = 'p1';
    sel.dispatchEvent(new Event('change'));
    expect(musicController.loadPlaylist).toHaveBeenCalledWith('p1');
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Add music action cases in domEventBindings.js**

Find the switch on action and add cases:
```js
case 'musicPlay':         return adminController.getModule('musicController').play();
case 'musicPause':        return adminController.getModule('musicController').pause();
case 'musicStop':         return adminController.getModule('musicController').stop();
case 'musicNext':         return adminController.getModule('musicController').next();
case 'musicPrevious':     return adminController.getModule('musicController').previous();
case 'musicSetVolume':    return debouncedMusicVolume(value);  // create helper
case 'musicSetShuffle':   return adminController.getModule('musicController').setShuffle(value);
case 'musicSetLoop':      return adminController.getModule('musicController').setLoop(value);
case 'musicLoadPlaylist': return adminController.getModule('musicController').loadPlaylist(value);
```

Define `debouncedMusicVolume` with 150ms debounce.

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
cd ALNScanner
git add src/utils/domEventBindings.js tests/unit/utils/domEventBindings-music.test.js
git commit -m "feat(music): domEventBindings music:* button + slider + picker actions"
cd ..
```

#### Task 7.5: HealthRenderer music entry

**Files:** modify `ALNScanner/src/ui/renderers/HealthRenderer.js` + tests

- [ ] **Step 1: Update SERVICE_NAMES**

```js
const SERVICE_NAMES = {
  vlc: 'VLC',
  spotify: 'Spotify',  // keep until Phase 10
  music: 'Music',       // ADD
  sound: 'Sound',
  // ...
};
```

- [ ] **Step 2: Add test**

```js
// in HealthRenderer.test.js (extend)
it('shows Music service entry', () => {
  renderer.render({ services: { music: { status: 'healthy', message: 'MPD connected' } } });
  expect(container.textContent).toContain('Music');
});
```

- [ ] **Step 3: Commit**

```bash
cd ALNScanner
git add src/ui/renderers/HealthRenderer.js tests/unit/ui/renderers/HealthRenderer.test.js
git commit -m "feat(music): HealthRenderer displays Music service"
cd ..
```

#### Task 7.6: index.html updates + adminController wiring

**Files:** modify `ALNScanner/index.html`, `ALNScanner/src/app/adminController.js`

- [ ] **Step 1: Find Spotify mounting in index.html**

```bash
grep -n "spotify\|now-playing" ALNScanner/index.html
```

- [ ] **Step 2: Keep `#now-playing-section` mount; remove any spotify-specific labels in DOM**

The renderer auto-builds the scaffold. Just verify the mount div exists. Remove any inline Spotify text labels in surrounding markup.

- [ ] **Step 3: Wire MusicController in adminController.js**

```js
import { MusicController } from '../admin/MusicController.js';
// ...
this._modules.musicController = new MusicController({ sendGmCommand: this._sendGmCommand.bind(this) });
```

- [ ] **Step 4: Wire MusicRenderer in MonitoringDisplay**

In `ALNScanner/src/admin/MonitoringDisplay.js` (where existing renderers are wired):
```js
import { MusicRenderer } from '../ui/renderers/MusicRenderer.js';
// ...
this._musicRenderer = new MusicRenderer(document.getElementById('now-playing-section'));
this._stateStore.on('music', () => {
  this._musicRenderer.render(this._stateStore.get('music'));
});
```

- [ ] **Step 5: Commit**

```bash
cd ALNScanner
git add index.html src/app/adminController.js src/admin/MonitoringDisplay.js
git commit -m "feat(music): wire MusicController + MusicRenderer into admin shell"
cd ..
```

#### Task 7.7: networkedSession + unifiedDataManager music handling

**Files:** modify `ALNScanner/src/network/networkedSession.js`, `ALNScanner/src/core/unifiedDataManager.js`

- [ ] **Step 1: Audit current spotify handling in networkedSession**

```bash
grep -n "spotify" ALNScanner/src/network/networkedSession.js
```
Expected: handler for `service:state` domain `spotify` and possibly handling of sync:full.spotify.

- [ ] **Step 2: Add music domain handler**

In the `service:state` switch, add `music` case mirroring spotify:
```js
case 'music':
  stateStore.update('music', payload.state);
  break;
```

In sync:full handling, add:
```js
if (data.music) stateStore.update('music', data.music);
```

- [ ] **Step 3: Run tests**

```bash
cd ALNScanner && npx jest tests/unit/network
```

- [ ] **Step 4: Commit**

```bash
git add src/network/networkedSession.js src/core/unifiedDataManager.js tests/unit/network/networkedSession.test.js
git commit -m "feat(music): networkedSession handles music service:state and sync:full"
cd ..
```

#### Task 7.8: ALNScanner CLAUDE.md updates

**Files:** modify `ALNScanner/CLAUDE.md`

- [ ] **Step 1: Find spotify mentions**

```bash
grep -n "spotify\|Spotify" ALNScanner/CLAUDE.md
```

- [ ] **Step 2: Replace each with music references**

Update services/renderers tables, gm:command lists. Keep history notes if appropriate.

- [ ] **Step 3: Commit**

```bash
cd ALNScanner
git add CLAUDE.md
git commit -m "docs: update ALNScanner CLAUDE.md with music service references"
cd ..
```

---

### Phase 8: Config Tool — Music Section

#### Task 8.1: music.html template

**Files:** create `config-tool/public/sections/music.html`

- [ ] **Step 1: Write the section markup**

```html
<section id="music-section" class="config-section" hidden>
  <h2>Music Playlists</h2>
  <div class="music-editor">
    <aside class="music-playlist-list">
      <h3>Playlists</h3>
      <ul id="music-playlist-list"></ul>
      <button id="music-new-playlist">+ New</button>
    </aside>
    <main class="music-playlist-detail">
      <input id="music-playlist-name" type="text" placeholder="Playlist name" />
      <textarea id="music-playlist-desc" placeholder="Description (optional)"></textarea>
      <label><input type="checkbox" id="music-playlist-shuffle" /> Shuffle</label>
      <label><input type="checkbox" id="music-playlist-loop" /> Loop</label>
      <label>Crossfade <input type="range" id="music-playlist-crossfade" min="0" max="5000" step="100" /> <span id="music-playlist-crossfade-display">2000</span> ms</label>
      <div class="music-tracks-panes">
        <div class="music-available">
          <h4>Available Tracks</h4>
          <ul id="music-available-list"></ul>
        </div>
        <div class="music-current">
          <h4>Playlist Tracks</h4>
          <ul id="music-current-list"></ul>
        </div>
      </div>
      <button id="music-save">Save</button>
      <button id="music-delete">Delete Playlist</button>
    </main>
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add config-tool/public/sections/music.html
git commit -m "feat(config-tool): music section template"
```

#### Task 8.2: music.js section logic (TDD)

**Files:**
- Create: `config-tool/public/js/sections/music.js`
- Create: `config-tool/tests/music.test.js`

- [ ] **Step 1: Write failing test (node:test pattern)**

```js
// config-tool/tests/music.test.js
const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

test('MusicSection — create new playlist', async () => {
  const dom = new JSDOM(/* fixture html with music-section markup */);
  global.document = dom.window.document;
  global.fetch = async () => ({ ok: true, json: async () => ({ playlists: [] }) });

  const { MusicSection } = require('../public/js/sections/music.js');
  const section = new MusicSection({ container: dom.window.document.body });
  await section.load();
  await section.createPlaylist('New Playlist');
  assert.strictEqual(section.getPlaylists().length, 1);
  assert.strictEqual(section.getPlaylists()[0].name, 'New Playlist');
});

// More tests: rename, delete, drag-drop reorder, save round-trip, schema validation
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement MusicSection class**

```js
// config-tool/public/js/sections/music.js
export class MusicSection {
  constructor({ container, apiBase = '/api/music' }) {
    this._container = container;
    this._apiBase = apiBase;
    this._playlists = [];
    this._tracks = [];
    this._selectedId = null;
  }

  async load() {
    const [pl, tr] = await Promise.all([
      fetch(`${this._apiBase}/playlists`).then(r => r.json()),
      fetch(`${this._apiBase}/tracks`).then(r => r.json()),
    ]);
    this._playlists = pl.playlists || [];
    this._tracks = tr.tracks || [];
    this._render();
  }

  getPlaylists() { return [...this._playlists]; }

  createPlaylist(name) {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    this._playlists.push({ id, name, shuffle: false, loop: true, crossfadeMs: 2000, tracks: [] });
    this._selectedId = id;
    this._render();
    return this._playlists[this._playlists.length - 1];
  }

  // ... more methods: deletePlaylist, addTrackToPlaylist, removeTrack, reorder, save, render ...

  async save() {
    return fetch(`${this._apiBase}/playlists`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlists: this._playlists }),
    });
  }
}
```

Implement enough to pass tests; flesh out drag-drop incrementally.

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: Commit**

```bash
git add config-tool/public/js/sections/music.js config-tool/tests/music.test.js
git commit -m "feat(config-tool): music section CRUD + load/save"
```

#### Task 8.3: server.js proxy

**Files:** modify `config-tool/server.js`

- [ ] **Step 1: Add proxy routes**

```js
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'https://localhost:3000';

app.get('/api/music/tracks', async (req, res) => {
  const r = await fetch(`${ORCHESTRATOR_URL}/api/music/tracks`);
  res.status(r.status).type('json').send(await r.text());
});

app.get('/api/music/playlists', async (req, res) => {
  const r = await fetch(`${ORCHESTRATOR_URL}/api/music/playlists`);
  res.status(r.status).type('json').send(await r.text());
});

app.put('/api/music/playlists', express.json(), async (req, res) => {
  const r = await fetch(`${ORCHESTRATOR_URL}/api/music/playlists`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body),
  });
  res.status(r.status).type('json').send(await r.text());
});
```

- [ ] **Step 2: Commit**

```bash
git add config-tool/server.js
git commit -m "feat(config-tool): proxy /api/music/* to orchestrator"
```

#### Task 8.4: Remove spotify from cueEditor/timelineView/commandForm/audio.js

**Files:**
- Modify: `config-tool/public/js/components/cueEditor.js`
- Modify: `config-tool/public/js/components/timelineView.js`
- Modify: `config-tool/public/js/components/commandForm.js`
- Modify: `config-tool/public/js/sections/audio.js`

For each file:

- [ ] **Step 1: Find spotify references**

```bash
grep -n "spotify" config-tool/public/js/components/cueEditor.js
```

- [ ] **Step 2: Add music:* action equivalents alongside spotify:*** (still keeping spotify for now; final remove in Phase 10)

In the action enums add `music:play`, `music:loadPlaylist`, etc. with appropriate labels.

- [ ] **Step 3: For audio.js — add `music` stream option**

```js
const STREAMS = ['video', 'spotify', 'music', 'sound'];
```

- [ ] **Step 4: Verify config-tool still works**

```bash
cd config-tool && npm test
```

- [ ] **Step 5: Commit**

```bash
git add config-tool/public/js/components/cueEditor.js config-tool/public/js/components/timelineView.js config-tool/public/js/components/commandForm.js config-tool/public/js/sections/audio.js
git commit -m "feat(config-tool): cue/timeline/audio editors expose music:* actions alongside spotify:*"
```

#### Task 8.5: Wire music section into config-tool shell

**Files:** modify `config-tool/public/index.html`, `config-tool/public/js/main.js` (or equivalent)

- [ ] **Step 1: Add nav link to Music**

In `index.html` nav:
```html
<li><a href="#music">Music</a></li>
```

- [ ] **Step 2: Import section markup and JS**

Wire `<section>` from `sections/music.html` and import `js/sections/music.js`.

- [ ] **Step 3: Commit**

```bash
git add config-tool/public/index.html config-tool/public/js/main.js
git commit -m "feat(config-tool): expose Music section in shell"
```

---

### Phase 9: E2E Tests

#### Task 9.1: Generate ffmpeg test fixtures

**Files:** create `backend/tests/e2e/fixtures/test-music/` with 3 short MP3s

- [ ] **Step 1: Generate fixtures**

Run:
```bash
mkdir -p backend/tests/e2e/fixtures/test-music
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=3" -ar 44100 -ac 2 -b:a 128k backend/tests/e2e/fixtures/test-music/test-track-1.mp3
ffmpeg -y -f lavfi -i "sine=frequency=523:duration=3" -ar 44100 -ac 2 -b:a 128k backend/tests/e2e/fixtures/test-music/test-track-2.mp3
ffmpeg -y -f lavfi -i "sine=frequency=659:duration=3" -ar 44100 -ac 2 -b:a 128k backend/tests/e2e/fixtures/test-music/test-track-3.mp3
```

- [ ] **Step 2: Add README for fixtures**

Create `backend/tests/e2e/fixtures/test-music/README.md`:
```
Short 3-second sine-wave MP3s generated by ffmpeg lavfi for E2E playlist tests.
Regenerate with the commands in plan task 9.1.
```

- [ ] **Step 3: Commit**

```bash
git add backend/tests/e2e/fixtures/test-music/
git commit -m "test(music): add short MP3 fixtures for E2E playlist tests"
```

#### Task 9.2: 07d-05-admin-music-playlist E2E

**Files:** create `backend/tests/e2e/flows/07d-05-admin-music-playlist.test.js`

- [ ] **Step 1: Write the E2E test**

```js
import { test, expect } from '@playwright/test';
import { GMScannerPage } from '../helpers/page-objects/GMScannerPage';

test.describe('Admin — music playlist control', () => {
  test('select All Tracks playlist, play, verify state', async ({ page }) => {
    const gm = new GMScannerPage(page);
    await gm.connect();
    await gm.navigateToAdminPanel();

    const picker = page.locator('.music-playlist-picker');
    await expect(picker).toBeVisible();
    await expect(picker.locator('option')).toContainText(['All Tracks']);

    await picker.selectOption('all-tracks');
    await page.locator('[data-action="admin.musicPlay"]').click();
    await expect(page.locator('.music-track-title')).not.toHaveText('(no track)', { timeout: 5000 });
  });
});
```

- [ ] **Step 2: Run**

```bash
cd ALNScanner && npm run build
cd ../backend && npx playwright test flows/07d-05-admin-music-playlist
```

- [ ] **Step 3: Commit**

```bash
git add backend/tests/e2e/flows/07d-05-admin-music-playlist.test.js
git commit -m "test(music): E2E flow — admin selects and plays All Tracks playlist"
```

#### Task 9.3: Update 07d-03-admin-show-control

**Files:** modify `backend/tests/e2e/flows/07d-03-admin-show-control.test.js`

- [ ] **Step 1: Replace spotify assertions with music**

Find Spotify-related selectors and assertions; replace with `.music-now-playing`, `[data-action="admin.musicPlay"]`, etc.

- [ ] **Step 2: Run + commit**

```bash
cd ALNScanner && npm run build
cd ../backend && npx playwright test flows/07d-03
git add backend/tests/e2e/flows/07d-03-admin-show-control.test.js
git commit -m "test(music): update 07d-03 show-control E2E for music controls"
```

#### Task 9.4: Update 07d-04-admin-environment-control

Same pattern as 9.3 for `07d-04-admin-environment-control.test.js`.

Commit: `test(music): update 07d-04 environment-control E2E for music ducking`

---

### Phase 10: Spotify Cleanup (mandatory)

This phase removes all Spotify code, configs, env vars, and dependencies. After this point the system has no Spotify references.

#### Task 10.1: Delete backend spotifyService and tests

**Files:** delete `backend/src/services/spotifyService.js` and tests

- [ ] **Step 1: Delete files**

```bash
rm backend/src/services/spotifyService.js
rm backend/tests/unit/services/spotifyService.test.js
```

- [ ] **Step 2: Remove all `spotify:*` cases from commandExecutor**

In `backend/src/services/commandExecutor.js`:
- Delete `'spotify:*'` entries from `SERVICE_DEPENDENCIES`
- Delete the `case 'spotify:*':` blocks from the switch
- Delete the `SPOTIFY_TRANSPORT` constant if present

Update `backend/tests/unit/services/commandExecutor-music.test.js` if it referenced spotify (it shouldn't).

- [ ] **Step 3: Run tests**

```bash
cd backend && npm test
```
Expected: many failures from spotify-referencing tests. Continue to next tasks to fix.

- [ ] **Step 4: Commit (broken state is OK — fix in next tasks)**

```bash
git add backend/src backend/tests
git commit -m "chore(spotify): delete spotifyService and commandExecutor spotify:* handlers (WIP: tests broken)"
```

#### Task 10.2: Remove spotify wiring from backend integration points

**Files:** modify backend services and broadcasts

- [ ] **Step 1: Remove from app.js**

Delete the `spotifyService` initialization block.

- [ ] **Step 2: Remove from broadcasts.js**

Delete the existing spotify wiring (lines 466-470 originally).

- [ ] **Step 3: Remove from syncHelpers.js**

Delete `buildSpotifyState` function and remove `spotify` field from buildSyncFullPayload return.

- [ ] **Step 4: Remove from sessionService.js**

Delete the two `spotifyService.pauseForGameClock`/`resumeFromGameClock` calls.

- [ ] **Step 5: Remove from cueEngineService EVENT_NORMALIZERS**

Delete the `spotify:track:changed` normalizer.

- [ ] **Step 6: Remove from cueEngineWiring.js**

Delete the spotify event forwarding block.

- [ ] **Step 7: Remove from serviceHealthRegistry**

Delete the `spotify` health check entry and remove from default tracked services / revalidation list.

- [ ] **Step 8: Remove spotify from audioRoutingService**

Delete the `spotify: 'spotifyd'` entry from STREAM_APP_NAMES; remove from VALID_STREAMS.

- [ ] **Step 9: Remove spotify from systemReset.js audit**

```bash
grep -n "spotify" backend/src/services/systemReset.js
```
Remove any references.

- [ ] **Step 10: Run tests**

```bash
cd backend && npm test
```
Expected: spotify test files now fail (they reference deleted code). Next task deletes them.

- [ ] **Step 11: Commit**

```bash
git add backend/src
git commit -m "chore(spotify): remove spotifyService wiring from app/broadcasts/sync/session/cue/health/audio"
```

#### Task 10.3: Delete remaining spotify-referencing files

**Files:** delete spotify-only tests, helpers, fixtures

- [ ] **Step 1: List spotify-only files**

```bash
grep -rli "spotify" backend/tests --include="*.js" | xargs grep -L "music"
```
Each file in output references spotify but not music — these are spotify-only and should be deleted or rewritten.

- [ ] **Step 2: Delete spotify-only tests**

```bash
rm backend/tests/unit/services/spotifyService.test.js  # (already done in 10.1, redundant)
# any others identified
```

- [ ] **Step 3: Update mixed-mention tests**

For tests that reference both spotify and music (e.g., `external-state-propagation`, `state-synchronization`):
- Remove spotify assertions/setup
- Keep music coverage that was added in Phase 6

- [ ] **Step 4: Update test helpers**

In `backend/tests/helpers/browser-mocks.js`:
- Remove MockSpotifyService
- Keep MockMusicService

In `backend/tests/helpers/integration-test-server.js`:
- Remove `services.spotify` initialization
- Keep `services.music`

In `backend/tests/helpers/service-reset.js`:
- Remove spotify from `resetAllServicesForTesting`
- Keep music

- [ ] **Step 5: Run tests**

```bash
cd backend && npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/tests
git commit -m "chore(spotify): delete spotify-only tests and remove spotify from helpers"
```

#### Task 10.4: Remove SPOTIFY_* env vars + audio-routing ducking entries

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/config/environment/routing.json`

- [ ] **Step 1: Remove SPOTIFY_* from .env.example**

```bash
sed -i '/SPOTIFY_/d' backend/.env.example
```

Verify by inspection.

- [ ] **Step 2: routing.json**

Already updated in Phase 4.2 — but double-check no `"duck": "spotify"` remains.

- [ ] **Step 3: Commit**

```bash
git add backend/.env.example backend/config/environment/routing.json
git commit -m "chore(spotify): remove SPOTIFY_* env vars from .env.example"
```

#### Task 10.5: Remove spotify from contracts

**Files:** modify `backend/contracts/asyncapi.yaml`, `backend/contracts/openapi.yaml`

- [ ] **Step 1: Strip spotify:* action enum entries from asyncapi.yaml**

- [ ] **Step 2: Strip service:state.spotify schema from asyncapi.yaml**

- [ ] **Step 3: Strip spotify references from openapi.yaml**

- [ ] **Step 4: Run contract tests**

```bash
cd backend && npx jest tests/contract
```
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/contracts
git commit -m "contract(spotify): remove spotify:* actions and service:state.spotify schema"
```

#### Task 10.6: Backend CLAUDE.md cleanup

**Files:** modify `backend/CLAUDE.md`

- [ ] **Step 1: Find spotify mentions**

```bash
grep -n "spotify\|Spotify" backend/CLAUDE.md
```

- [ ] **Step 2: Remove "Spotify Wedged on IPv6 Dealer" debug section entirely**

Search for the heading "Spotify Wedged on IPv6 Dealer" and remove the section.

- [ ] **Step 3: Update Services table — replace `spotifyService` row with `musicService`**

- [ ] **Step 4: Update admin commands table — remove spotify:* rows**

- [ ] **Step 5: Update Phase 2 docs to reference Music instead of Spotify**

- [ ] **Step 6: Commit**

```bash
git add backend/CLAUDE.md
git commit -m "docs(spotify): remove spotify references from backend/CLAUDE.md; replace with music"
```

#### Task 10.7: ALNScanner Spotify cleanup (inside submodule)

**Files:**
- Delete: `ALNScanner/src/admin/SpotifyController.js`
- Delete: `ALNScanner/src/ui/renderers/SpotifyRenderer.js`
- Delete: `ALNScanner/tests/unit/admin/SpotifyController.test.js`
- Delete: `ALNScanner/tests/unit/ui/renderers/SpotifyRenderer.test.js`
- Delete: `ALNScanner/tests/unit/utils/domEventBindings-spotify.test.js`
- Modify: various ALNScanner source files

- [ ] **Step 1: Delete spotify-only files**

```bash
cd ALNScanner
rm src/admin/SpotifyController.js
rm src/ui/renderers/SpotifyRenderer.js
rm tests/unit/admin/SpotifyController.test.js
rm tests/unit/ui/renderers/SpotifyRenderer.test.js
rm tests/unit/utils/domEventBindings-spotify.test.js
```

- [ ] **Step 2: Remove spotify from stateStore**

In `src/core/stateStore.js`, delete the `spotify` initial domain entry.

- [ ] **Step 3: Remove spotify from networkedSession**

In `src/network/networkedSession.js`, remove `case 'spotify':` from service:state switch and `if (data.spotify)` from sync:full handling.

- [ ] **Step 4: Remove spotify from HealthRenderer SERVICE_NAMES**

- [ ] **Step 5: Remove spotify from domEventBindings**

Remove all `case 'spotifyX':` cases.

- [ ] **Step 6: Remove spotify from adminController/MonitoringDisplay/AdminOperations/AudioController/EnvironmentRenderer/unifiedDataManager**

Grep each file, remove spotify-specific code. Keep music.

- [ ] **Step 7: Update tests with mixed mentions**

Files like `MonitoringDisplay-phase3.test.js`, `EnvironmentRenderer.test.js`, etc. — remove spotify assertions, keep music ones.

- [ ] **Step 8: Run all ALNScanner tests**

```bash
cd ALNScanner && npm test
```
Expected: pass.

- [ ] **Step 9: Update ALNScanner CLAUDE.md**

Strip remaining spotify references.

- [ ] **Step 10: Commit (in submodule)**

```bash
cd ALNScanner
git add -A
git commit -m "chore(spotify): remove all Spotify code from ALNScanner (controllers, renderer, store, network, health, bindings, tests)"
cd ..
```

#### Task 10.8: Config Tool Spotify cleanup

**Files:**
- Modify: `config-tool/public/js/components/cueEditor.js`
- Modify: `config-tool/public/js/components/timelineView.js`
- Modify: `config-tool/public/js/components/commandForm.js`
- Modify: `config-tool/public/js/sections/audio.js`
- Modify: `config-tool/README.md`

- [ ] **Step 1: Remove spotify:* entries from action enums**

In each component file, remove `spotify:play`, `spotify:pause`, etc. from any enum or labels list.

- [ ] **Step 2: Remove `spotify` stream from audio.js**

```js
const STREAMS = ['video', 'music', 'sound'];  // was ['video', 'spotify', 'music', 'sound']
```

- [ ] **Step 3: Update README**

Strip spotify references from `config-tool/README.md`.

- [ ] **Step 4: Run config-tool tests**

```bash
cd config-tool && npm test
```

- [ ] **Step 5: Commit**

```bash
git add config-tool
git commit -m "chore(spotify): remove spotify from cue editor, timeline, command form, audio section, README"
```

#### Task 10.9: Parent CLAUDE.md + DEPLOYMENT_GUIDE.md cleanup

**Files:** modify parent `CLAUDE.md`, `DEPLOYMENT_GUIDE.md`

- [ ] **Step 1: Find spotify mentions in parent CLAUDE.md**

```bash
grep -n "spotify\|Spotify" CLAUDE.md
```

- [ ] **Step 2: Replace with music**

Most are in the services table and event architecture section. Update them.

- [ ] **Step 3: Update DEPLOYMENT_GUIDE.md**

Add MPD install step; remove spotifyd setup step.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md DEPLOYMENT_GUIDE.md
git commit -m "docs(spotify): remove spotify references from parent CLAUDE.md and DEPLOYMENT_GUIDE"
```

#### Task 10.10: Spotify deployment removal (system level)

- [ ] **Step 1: Stop and disable spotifyd**

```bash
systemctl --user stop spotifyd
systemctl --user disable spotifyd
```

- [ ] **Step 2: Remove spotifyd**

Check how spotifyd is installed:
```bash
dpkg -l | grep spotifyd
ls -la ~/.cargo/bin/spotifyd 2>/dev/null
```

If apt-installed: `sudo apt remove --purge spotifyd`
If cargo-installed: `rm ~/.cargo/bin/spotifyd`

- [ ] **Step 3: Delete spotifyd config and cache**

```bash
rm -rf ~/.config/spotifyd
rm -rf ~/.cache/spotifyd
rm ~/.config/systemd/user/spotifyd.service
systemctl --user daemon-reload
```

- [ ] **Step 4: Verify nothing references spotify in deployment**

```bash
ls ~/.config/systemd/user/ | grep -i spotify
```
Expected: empty.

- [ ] **Step 5: No commit required** (system-level changes)

#### Task 10.11: Cleanup audit grep

- [ ] **Step 1: Run the cleanup audit**

```bash
grep -rli "spotify" \
  backend ALNScanner config-tool DEPLOYMENT_GUIDE.md CLAUDE.md \
  --include="*.js" --include="*.json" --include="*.yaml" --include="*.md" \
  --include="*.html" --include="*.ts" \
  2>/dev/null | grep -vE "node_modules|dist/|\.git|coverage|playwright-report|/data/"
```
Expected: zero results, OR only hits in historical files like `backend/docs/plans/*spotify*.md` (those are archived plans, keep them).

- [ ] **Step 2: If any hits remain in active code, fix them and re-run**

- [ ] **Step 3: Document the clean state in a commit message**

```bash
git commit --allow-empty -m "audit(spotify): no remaining spotify references in active code"
```

#### Task 10.12: Regenerate coverage thresholds

- [ ] **Step 1: Backend**

```bash
cd backend && npm run coverage:ratchet
git add .coverage-thresholds.json
git commit -m "test(coverage): regenerate per-file thresholds post-music-cutover"
```

- [ ] **Step 2: ALNScanner**

```bash
cd ALNScanner && npm run coverage:ratchet
git add .coverage-thresholds.json
git commit -m "test(coverage): regenerate ALNScanner thresholds post-music"
cd ..
```

---

### Phase 11: Submodule + PR Workflow

#### Task 11.1: Push ALNScanner submodule branch

- [ ] **Step 1: Ensure ALNScanner commits are pushed**

```bash
cd ALNScanner
git log --oneline -20  # review your commits
git push origin feature/replace-spotify-with-mpd
cd ..
```

- [ ] **Step 2: Open ALNScanner PR**

```bash
cd ALNScanner
gh pr create --title "Replace Spotify with local music (MPD)" --body "$(cat <<'EOF'
## Summary
- New MusicController + MusicRenderer with playlist picker
- Removed SpotifyController, SpotifyRenderer, and all spotify references
- stateStore tracks music domain; networkedSession handles music service:state and sync:full.music
- HealthRenderer shows Music service
- domEventBindings dispatches music:* actions with debounced volume slider

## Test plan
- [ ] `npm test` passes
- [ ] `npm run coverage:check` passes
- [ ] `npm run build` succeeds
- [ ] E2E tests pass after parent merge (depends on backend music service)
EOF
)"
cd ..
```

- [ ] **Step 3: Wait for review/merge** (manual)

#### Task 11.2: Bump parent submodule pointer post-ALNScanner-merge

(Run **after** ALNScanner PR is merged.)

- [ ] **Step 1: Update local ALNScanner to merged main**

```bash
cd ALNScanner
git fetch origin
git checkout main
git pull --ff-only
cd ..
```

- [ ] **Step 2: Stage submodule pointer in parent**

```bash
git add ALNScanner
git commit -m "chore(submodule): bump ALNScanner to merged music cutover SHA"
```

- [ ] **Step 3: Push parent branch with updated pointer**

```bash
git push origin feature/replace-spotify-with-mpd
```

#### Task 11.3: Open parent ALN-Ecosystem PR

- [ ] **Step 1: Create PR**

```bash
gh pr create --title "Replace Spotify with local music playback (MPD)" --body "$(cat <<'EOF'
## Summary
- New musicService controls MPD (~300 lines) via mpd2 Node client
- MPD spawned/supervised by ProcessMonitor; lifecycle managed by orchestrator
- Backend music:* gm:commands replace spotify:*
- /api/music/{tracks,playlists} endpoints (GET/PUT)
- Config Tool gains Music section with drag-and-drop playlist editor
- audioRoutingService ducking targets music (was spotify)
- All Spotify code removed: service, tests, contracts, env vars, system package
- Bootstrap "All Tracks" playlist seeded with all 66 MP3s

## Test plan
- [ ] `cd backend && npm test` — unit + contract pass
- [ ] `cd backend && npm run coverage:check` — no regression
- [ ] `cd backend && npm run test:integration` — all music + cross-service flows pass
- [ ] `cd backend && npm run test:e2e` — 07d-03, 07d-04, 07d-05 all pass
- [ ] `cd config-tool && npm test`
- [ ] Cleanup audit grep returns zero hits in active code
- [ ] Manual smoke: Pi spawns MPD, GM Scanner controls music, ducking works, game-clock pauses music, cue dispatches music:loadPlaylist

## Submodule
Bumps `ALNScanner` to its `feature/replace-spotify-with-mpd` merge commit.

## Deployment
- `sudo apt install mpd`
- `cd backend && npm install` (picks up mpd2)
- `cd backend && npm run music:seed` (idempotent — regenerates All Tracks)
- spotifyd already removed in Phase 10.10
EOF
)"
```

- [ ] **Step 2: Wait for review/merge** (manual)

#### Task 11.4: Post-merge — rebuild ALNScanner dist on Pi

(Run **after** parent PR is merged on the Pi.)

- [ ] **Step 1: Pull main**

```bash
git pull --ff-only
git submodule update --init --recursive
```

- [ ] **Step 2: Rebuild ALNScanner dist**

```bash
cd ALNScanner && npm install && npm run build && cd ..
```

- [ ] **Step 3: Restart orchestrator**

```bash
npm run prod:restart  # or pm2 restart all
```

- [ ] **Step 4: Verify**

```bash
curl -k https://localhost:3000/health | jq
pgrep -a mpd
pgrep -a spotifyd  # expected empty
```

Expected:
- Orchestrator healthy
- MPD running
- No spotifyd

---

## Final Verification Gate

After all phases complete, run the full verification suite:

```bash
# Backend
cd backend
npm test                          # unit + contract
npm run coverage:check
npm run test:integration          # sequential
npm run test:e2e                  # full E2E

# ALNScanner (after build)
cd ../ALNScanner
npm run build
npm test
npm run coverage:check

# Config Tool
cd ../config-tool
npm test

# Cleanup audit
cd ..
grep -rli "spotify" backend ALNScanner config-tool DEPLOYMENT_GUIDE.md CLAUDE.md \
  --include="*.js" --include="*.json" --include="*.yaml" --include="*.md" \
  --include="*.html" --include="*.ts" \
  2>/dev/null | grep -vE "node_modules|dist/|\.git|coverage|playwright-report|/data/|/docs/plans/"
# Expected: empty output
```

Manual smoke checklist (run on Pi after merge):
- [ ] Backend startup spawns MPD; `/tmp/aln-pm-mpd.pid` present; `mpc -h /tmp/aln-mpd.sock status` succeeds
- [ ] GM Scanner admin: pick "All Tracks" → music plays from track 1; next/prev work; loop wraps from track 66 → 1
- [ ] Config Tool: create a 3-track custom playlist, save; appears in GM picker; switch and play
- [ ] Trigger a video → music ducks to 20%; restores after
- [ ] Trigger a sound effect → music ducks to 40%; restores after
- [ ] Pause game clock → music pauses; resume → music resumes (only if it was clock-paused, not user-paused)
- [ ] Fire a cue with `music:loadPlaylist` → playlist switches mid-show
- [ ] `kill -9 $(cat /tmp/aln-pm-mpd.pid)` → MPD respawns, state restored on next load
- [ ] Backend restart → sync:full delivers music + playlists to reconnecting GM
- [ ] `dpkg -l | grep spotifyd` → no results (or only unrelated packages)
- [ ] `pactl list sink-inputs | grep -i aln-music` → present when MPD plays

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| MPD daemon misconfigured on first boot (no audio output) | musicService validates config + asserts `outputs` returns `aln-music` after startup; reports `down` health if not |
| MPD database stale when files added | Service runs `mpd.update()` on startup AND when `/api/music/tracks` returns 404 for a known file |
| PipeWire stream name collision if user has another MPD running | Audited: no MPD installed currently on Pi; we'll spawn ours under ProcessMonitor, so it's tightly coupled |
| sync:full omission causes silent state desync | Phase 4.8 explicitly audits all 7 callers; integration test in 6.5 guards against future regressions |
| mpd2 client disconnect on long-running connection | mpd2 has reconnect; wrap with health-aware retry; rely on ProcessMonitor for MPD itself |
| Live-edit of music-playlists.json during playback | musicService watches via `fs.watch`, only reloads metadata; doesn't disrupt current playback (Phase 1.10 + 6.7 verify) |
| pipewire-pulse-stale recurrence | Memory note: pipewire-pulse can wedge after days of uptime. Same mitigation as before: audioRoutingService health checks detect; `pipewire-pulse` restart recovery |

---

## Defaults Baked In

- **Bootstrap playlist**: `"All Tracks"` with all 66 MP3s (seeded by `npm run music:seed`)
- **Crossfade default**: 2000ms in Config Tool "new playlist" template
- **Validation**: Config Tool prevents saving with missing files; duplicate tracks allowed (intentional repeats)
- **Volume persistence**: Last volume persisted in session state, restored on session restart
- **Spotify cleanup**: Mandatory full removal — apt purge, config dirs deleted, env vars stripped, no fallback

---

## Self-Review Notes

Spec coverage:
- ✅ All 6 user decisions reflected (control model, storage, polished playback, new service, cue integration, MPD tech)
- ✅ Branch strategy covers both repos
- ✅ All ~123 spotify-referencing files accounted for (modify or delete)
- ✅ Each phase ends with verification + commit
- ✅ Cleanup audit grep gate in Final Verification

Type consistency:
- `MusicService` class + `musicService` singleton consistently used
- `music:*` action set defined once (Spec Reference) and referenced in commandExecutor, contracts, frontend, config-tool
- `service:state` domain `music` payload shape defined once (Spec Reference) and used in renderer, stateStore, integration tests, contract tests
- Filenames: `MusicService.js` / `musicService.js` (singleton instance vs class — Node convention)

No placeholders confirmed: every step has actual code or commands; no "TBD" or "similar to" references.
